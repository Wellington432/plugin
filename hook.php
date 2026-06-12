<?php

/**
 * hook.php: instalação e desinstalação do plugin.
 * Cria as tabelas, registra os direitos de perfil e as colunas padrão de busca.
 */

use GlpiPlugin\Carbooking\Booking;
use GlpiPlugin\Carbooking\Car;
use GlpiPlugin\Carbooking\Profile as CarbookingProfile;

/**
 * Instalação: cria as tabelas e configura permissões.
 */
function plugin_carbooking_install()
{
    /** @var DBmysql $DB */
    global $DB;

    $charset   = DBConnection::getDefaultCharset();
    $collation = DBConnection::getDefaultCollation();
    $migration = new Migration(PLUGIN_CARBOOKING_VERSION);

    // ---- Tabela de carros (frota) ----
    $cars = Car::getTable();
    if (!$DB->tableExists($cars)) {
        $DB->doQuery("CREATE TABLE `$cars` (
            `id`            int unsigned NOT NULL AUTO_INCREMENT,
            `name`          varchar(255) NOT NULL DEFAULT '',
            `plate`         varchar(20)  NOT NULL DEFAULT '',
            `model_year`    int          NOT NULL DEFAULT 0,
            `picture`       varchar(255) DEFAULT NULL,
            `is_active`     tinyint      NOT NULL DEFAULT 1,
            `comment`       text         DEFAULT NULL,
            `is_deleted`    tinyint      NOT NULL DEFAULT 0,
            `date_creation` timestamp    NULL DEFAULT NULL,
            `date_mod`      timestamp    NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `plate` (`plate`),
            KEY `is_active` (`is_active`),
            KEY `is_deleted` (`is_deleted`)
        ) ENGINE=InnoDB DEFAULT CHARSET={$charset} COLLATE={$collation}");
    }

    // ---- Tabela de agendamentos ----
    $bookings = Booking::getTable();
    if (!$DB->tableExists($bookings)) {
        $DB->doQuery("CREATE TABLE `$bookings` (
            `id`                         int unsigned NOT NULL AUTO_INCREMENT,
            `name`                       varchar(255) NOT NULL DEFAULT '',
            `plugin_carbooking_cars_id`  int unsigned NOT NULL DEFAULT 0,
            `users_id`                   int unsigned NOT NULL DEFAULT 0,
            `groups_id`                  int unsigned NOT NULL DEFAULT 0,
            `date_departure`             datetime     DEFAULT NULL,
            `date_arrival`               datetime     DEFAULT NULL,
            `destination`                varchar(255) DEFAULT NULL,
            `reason`                     text         DEFAULT NULL,
            `status`                     int          NOT NULL DEFAULT 1,
            `users_id_approver`          int unsigned NOT NULL DEFAULT 0,
            `date_validation`            datetime     DEFAULT NULL,
            `comment_validation`         text         DEFAULT NULL,
            `is_deleted`                 tinyint      NOT NULL DEFAULT 0,
            `date_creation`              timestamp    NULL DEFAULT NULL,
            `date_mod`                   timestamp    NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `plugin_carbooking_cars_id` (`plugin_carbooking_cars_id`),
            KEY `users_id` (`users_id`),
            KEY `groups_id` (`groups_id`),
            KEY `users_id_approver` (`users_id_approver`),
            KEY `status` (`status`),
            KEY `date_departure` (`date_departure`),
            KEY `is_deleted` (`is_deleted`)
        ) ENGINE=InnoDB DEFAULT CHARSET={$charset} COLLATE={$collation}");
    }

    // Migração: adiciona o campo Setor (groups_id) em instalações que já
    // existiam antes desta versão.
    if ($DB->tableExists($bookings) && !$DB->fieldExists($bookings, 'groups_id')) {
        $DB->doQuery("ALTER TABLE `$bookings`
            ADD COLUMN `groups_id` int unsigned NOT NULL DEFAULT 0 AFTER `users_id`,
            ADD KEY `groups_id` (`groups_id`)");
    }

    $migration->executeMigration();

    // ---- Permissões ----
    // Limpa resíduos de uma instalação anterior (caso o plugin tenha sido
    // removido apagando a pasta, sem desinstalar pelo GLPI). Sem isto, o
    // ProfileRight::addProfileRights abaixo falharia com "Duplicate entry".
    foreach (CarbookingProfile::getAllRights() as $right) {
        $DB->delete('glpi_profilerights', ['name' => $right['field']]);
    }

    // Registra os direitos (valor 0) para todos os perfis.
    foreach (CarbookingProfile::getAllRights() as $right) {
        ProfileRight::addProfileRights([$right['field']]);
    }

    // Concede todos os direitos ao perfil atual (normalmente o super-admin
    // que está instalando), incluindo o direito de aprovar agendamentos.
    $current_profile = (int) ($_SESSION['glpiactiveprofile']['id'] ?? 0);
    if ($current_profile > 0) {
        $DB->update('glpi_profilerights', [
            'rights' => ALLSTANDARDRIGHT,
        ], [
            'profiles_id' => $current_profile,
            'name'        => 'carbooking::car',
        ]);
        $DB->update('glpi_profilerights', [
            'rights' => ALLSTANDARDRIGHT | Booking::APPROVE,
        ], [
            'profiles_id' => $current_profile,
            'name'        => 'carbooking::booking',
        ]);
    }

    // ---- Colunas padrão exibidas na listagem ----
    $prefs = [
        Car::class => [2, 3, 4],     // placa, ano, ativo
        Booking::class => [2, 3, 5, 8], // carro, solicitante, saída, status
    ];
    foreach ($prefs as $itemtype => $columns) {
        $rank = 1;
        foreach ($columns as $num) {
            $exists = countElementsInTable('glpi_displaypreferences', [
                'itemtype' => $itemtype,
                'num'      => $num,
                'users_id' => 0,
            ]);
            if (!$exists) {
                $DB->insert('glpi_displaypreferences', [
                    'itemtype' => $itemtype,
                    'num'      => $num,
                    'rank'     => $rank++,
                    'users_id' => 0,
                ]);
            }
        }
    }

    return true;
}

/**
 * Hook called after a Profile is updated — sincroniza direitos do plugin.
 *
 * @param mixed $item
 * @return void
 */
function plugin_carbooking_post_profile_update($item)
{
    // Confirma que é um objeto Profile do GLPI.
    if (! ($item instanceof Profile)) {
        return;
    }

    /** @var DBmysql $DB */
    global $DB;

    $profiles_id = (int) $item->getField('id');
    if ($profiles_id <= 0) {
        return;
    }

    // Direitos do plugin que queremos sincronizar.
    $rights_names = [
        'carbooking::booking',
        'carbooking::car',
    ];

    // Captura os direitos do POST (enviados pela interface de edição de Perfil).
    // No GLPI 11, os direitos são enviados em $_POST['_rights'] com chaves como
    // 'carbooking::booking' e valores que são bitmasks (READ=1, UPDATE=2, CREATE=4, DELETE=8, PURGE=16).
    $post_rights = [];
    if (!empty($_POST['_rights']) && is_array($_POST['_rights'])) {
        $post_rights = $_POST['_rights'];
    }

    $rights_updated = false;

    foreach ($rights_names as $rname) {
        // Determina o valor a persistir: prefere POST, senão mantém DB ou 0.
        $value = 0;
        if (is_array($post_rights) && array_key_exists($rname, $post_rights)) {
            // Valor vindo do formulário (bitmask).
            $value = (int) $post_rights[$rname];
        } else {
            // Se não veio no POST, tenta ler do banco (manter valor anterior).
            $iterator = $DB->request([
                'SELECT' => ['rights'],
                'FROM'   => 'glpi_profilerights',
                'WHERE'  => [
                    'profiles_id' => $profiles_id,
                    'name'        => $rname,
                ],
                'LIMIT'  => 1,
            ]);
            foreach ($iterator as $row) {
                $value = (int) ($row['rights'] ?? 0);
                break;
            }
        }

        // Persistência segura: usa updateOrInsert (GLPI 11) ou fallback a update/insert.
        $criteria = [
            'profiles_id' => $profiles_id,
            'name'        => $rname,
        ];
        $data = ['rights' => $value];

        // Tenta usar updateOrInsert se disponível (GLPI 11.0+).
        if (method_exists($DB, 'updateOrInsert')) {
            $DB->updateOrInsert('glpi_profilerights', $criteria + $data, $criteria);
        } else {
            // Fallback para GLPI 10 e anteriores.
            $exists = countElementsInTable('glpi_profilerights', $criteria);
            if ($exists) {
                $DB->update('glpi_profilerights', $data, $criteria);
            } else {
                $DB->insert('glpi_profilerights', $criteria + $data);
            }
        }
        $rights_updated = true;
    }

    // Sincroniza a sessão do usuário imediatamente se o perfil editado for o ativo (GLPI 11).
    if ($rights_updated && isset($_SESSION['glpiactiveprofile']['id']) && (int) $_SESSION['glpiactiveprofile']['id'] === $profiles_id) {
        $_SESSION['glpiactiveprofile']['rights'] = ProfileRight::getProfileRights($profiles_id);
        
        // Verifica se a sincronização foi bem-sucedida para carbooking.
        if (isset($_SESSION['glpiactiveprofile']['rights']['carbooking::booking']) || isset($_SESSION['glpiactiveprofile']['rights']['carbooking::car'])) {
            if (class_exists('Toolbox')) {
                Toolbox::logInFile('carbooking', "GLPI 11: Perfil $profiles_id sincronizado com sucesso.\n");
            }
        
        // Verifica se a sincronização foi bem-sucedida para carbooking.
        if (isset($_SESSION['glpiactiveprofile']['rights']['carbooking::booking']) || isset($_SESSION['glpiactiveprofile']['rights']['carbooking::car'])) {
            if (class_exists('Toolbox')) {
                Toolbox::logInFile('carbooking', "GLPI 11: Perfil $profiles_id sincronizado com sucesso.\n");
            }
        }
    }
}

/**
 * Hook called when a Profile is purged (deleted). Remove carbooking rights.
 *
 * @param mixed $item
 * @return void
 */
function plugin_carbooking_post_profile_purge($item)
{
    // Confirma que é um objeto Profile do GLPI.
    if (! ($item instanceof Profile)) {
        return;
    }

    /** @var DBmysql $DB */
    global $DB;

    $profiles_id = (int) $item->getField('id');
    if ($profiles_id <= 0) {
        return;
    }

    // Remove todas as permissões do plugin para este perfil.
    $DB->delete('glpi_profilerights', [
        'profiles_id' => $profiles_id,
        'name'        => ['LIKE', 'carbooking::%'],
    ]);
}

/**
 * Desinstalação: remove tabelas, direitos e preferências de exibição.
 */
function plugin_carbooking_uninstall()
{
    /** @var DBmysql $DB */
    global $DB;

    // Remove os direitos de perfil.
    foreach (CarbookingProfile::getAllRights() as $right) {
        ProfileRight::deleteProfileRights([$right['field']]);
    }

    // Remove preferências de exibição.
    foreach ([Car::class, Booking::class] as $itemtype) {
        $DB->delete('glpi_displaypreferences', ['itemtype' => $itemtype]);
    }

    // Remove as tabelas.
    foreach ([Booking::getTable(), Car::getTable()] as $table) {
        if ($DB->tableExists($table)) {
            $DB->doQuery("DROP TABLE `$table`");
        }
    }

    return true;
}
