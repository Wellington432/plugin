<?php

use GlpiPlugin\Carbooking\Profile;

include('../../../inc/includes.php');

// Quem edita perfis precisa do direito nativo "profile" com UPDATE.
Session::checkRight('profile', UPDATE);

if (isset($_POST['update'], $_POST['profiles_id'])) {
    // Validação CSRF padrão do GLPI (token gerado por Html::closeForm()).
    Session::checkCSRF($_POST);

    $profiles_id = (int) $_POST['profiles_id'];
    $rights      = is_array($_POST['rights'] ?? null) ? $_POST['rights'] : [];

    Profile::saveRights($profiles_id, $rights);

    // Aplica os novos direitos na sessão ativa imediatamente (sem relogar).
    Profile::changeProfile();

    Session::addMessageAfterRedirect(
        __('Permissões do Agendamento de Carros atualizadas.', 'carbooking'),
        true,
        INFO
    );
}

Html::back();
