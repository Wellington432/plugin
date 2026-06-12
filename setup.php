<?php

/**
 * Carbooking — Agendamento de carros para GLPI 11
 *
 * setup.php: ponto de entrada do plugin. Declara versão, requisitos,
 * hooks (CSS/JS, menu, abas de perfil) e a checagem de pré-requisitos.
 */

use Glpi\Plugin\Hooks;
use GlpiPlugin\Carbooking\Booking;
use GlpiPlugin\Carbooking\Profile as CarbookingProfile;

define('PLUGIN_CARBOOKING_VERSION', '1.0.9');

// Faixa de versões do GLPI suportadas
define('PLUGIN_CARBOOKING_MIN_GLPI_VERSION', '11.0.0');
define('PLUGIN_CARBOOKING_MAX_GLPI_VERSION', '11.0.99');

/**
 * Inicialização do plugin — chamada em todas as páginas do GLPI.
 */
function plugin_init_carbooking()
{
    global $PLUGIN_HOOKS;

    // O plugin segue a proteção CSRF do GLPI (formulários enviam o token).
    $PLUGIN_HOOKS['csrf_compliant']['carbooking'] = true;

    // Folha de estilo e script. Os arquivos ficam em public/ (exigência do
    // GLPI 11), mas o caminho registrado NÃO inclui "public/" — o GLPI resolve
    // /plugins/carbooking/css/carbooking.css -> public/css/carbooking.css.
    $PLUGIN_HOOKS[Hooks::ADD_CSS]['carbooking']        = 'css/carbooking.css';
    $PLUGIN_HOOKS[Hooks::ADD_JAVASCRIPT]['carbooking'] = ['js/agenda.js', 'js/analytics.js', 'js/calendar.js'];

    // Aba de permissões dentro de Administração > Perfis.
    Plugin::registerClass(CarbookingProfile::class, [
        'addtabon' => Profile::class,
    ]);

    // Entrada de menu em "Ferramentas".
    $PLUGIN_HOOKS[Hooks::MENU_TOADD]['carbooking'] = [
        'tools' => Booking::class,
    ];

    // Link na interface simplificada (Helpdesk), para usuários self-service.
    $PLUGIN_HOOKS['helpdesk_menu_entry']['carbooking']      = '/front/agenda.php';
    $PLUGIN_HOOKS['helpdesk_menu_entry_icon']['carbooking'] = 'ti ti-car';

    // GLPI 11: por padrão os scripts de plugin exigem a interface central.
    // Liberamos as páginas usadas pelo funcionário (interface simplificada)
    // para qualquer usuário autenticado — a permissão real continua sendo
    // verificada por Session::checkRight() dentro de cada script.
    if (class_exists(\Glpi\Http\Firewall::class)) {
        $auth = \Glpi\Http\Firewall::STRATEGY_AUTHENTICATED;
        \Glpi\Http\Firewall::addPluginStrategyForLegacyScripts('carbooking', '#^/front/agenda\.php$#', $auth);
        \Glpi\Http\Firewall::addPluginStrategyForLegacyScripts('carbooking', '#^/front/calendar\.php$#', $auth);
        \Glpi\Http\Firewall::addPluginStrategyForLegacyScripts('carbooking', '#^/ajax/carsstatus\.php$#', $auth);
        \Glpi\Http\Firewall::addPluginStrategyForLegacyScripts('carbooking', '#^/ajax/month\.php$#', $auth);
        \Glpi\Http\Firewall::addPluginStrategyForLegacyScripts('carbooking', '#^/front/booking\.form\.php$#', $auth);
        \Glpi\Http\Firewall::addPluginStrategyForLegacyScripts('carbooking', '#^/front/car\.picture\.php$#', $auth);
    }

    // Sincroniza direitos quando um objeto Profile é atualizado.
    $PLUGIN_HOOKS['item_update']['carbooking'] = ['Profile' => 'plugin_carbooking_post_profile_update'];
    // Remove permissões relacionadas ao carbooking quando um Profile é apagado.
    $PLUGIN_HOOKS['item_purge']['carbooking']  = ['Profile' => 'plugin_carbooking_post_profile_purge'];
}

/**
 * Metadados exibidos em Configurar > Plugins.
 */
function plugin_version_carbooking()
{
    return [
        'name'         => 'Agendamento de Carros',
        'version'      => PLUGIN_CARBOOKING_VERSION,
        'author'       => 'Fox',
        'license'      => 'MIT',
        'homepage'     => '',
        'requirements' => [
            'glpi' => [
                'min' => PLUGIN_CARBOOKING_MIN_GLPI_VERSION,
                'max' => PLUGIN_CARBOOKING_MAX_GLPI_VERSION,
            ],
        ],
    ];
}

/**
 * Checagem de pré-requisitos antes da instalação.
 */
function plugin_carbooking_check_prerequisites()
{
    // A faixa de versões já é validada pelo GLPI a partir de plugin_version.
    return true;
}

/**
 * Checagem de configuração — chamada em todas as páginas.
 * Retornar false desativa o plugin automaticamente.
 */
function plugin_carbooking_check_config($verbose = false)
{
    return true;
}
