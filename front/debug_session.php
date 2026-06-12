<?php

include('../../../inc/includes.php');

Session::checkLoginUser();

echo "<h1>Diagnóstico de Permissões - Carbooking</h1>";
echo "<pre>";
echo "Usuário: " . ($_SESSION['glpiname'] ?? '') . "\n";
echo "Perfil Ativo: " . ($_SESSION['glpiactiveprofile']['name'] ?? '') . " (ID: " . ($_SESSION['glpiactiveprofile']['id'] ?? '') . ")\n";
echo "\n--- Direitos Localizados na Sessão ---\n";
$found = false;
if (!empty($_SESSION['glpiactiveprofile']['rights']) && is_array($_SESSION['glpiactiveprofile']['rights'])) {
    foreach ($_SESSION['glpiactiveprofile']['rights'] as $key => $val) {
        if (strpos($key, 'carbooking') !== false) {
            echo "[$key] => Valor: $val\n";
            $found = true;
        }
    }
}
if (!$found) {
    echo "AVISO: Nenhuma permissão 'carbooking::' encontrada na sessão atual!\n";
}
echo "</pre>";
