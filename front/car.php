<?php

use GlpiPlugin\Carbooking\Car;

include('../../../inc/includes.php');

// Se for interface simplificada, basta estar logado.
// Se for interface central, exige a permissão específica do plugin.
if (Session::getCurrentInterface() === 'helpdesk') {
    Session::checkLoginUser();
} else {
    Session::checkRight("carbooking::car", READ);
}

Html::header(
    Car::getTypeName(2),
    $_SERVER['PHP_SELF'],
    'tools',
    Car::class,
    'car'
);

Search::show(Car::class);

Html::footer();
