<?php

use GlpiPlugin\Carbooking\Booking;

include('../../../inc/includes.php');

// Se for interface simplificada, basta estar logado.
// Se for interface central, exige a permissão específica do plugin.
if (Session::getCurrentInterface() === 'helpdesk') {
    Session::checkLoginUser();
} else {
    Session::checkRight("carbooking::booking", READ);
}

Html::header(
    Booking::getTypeName(2),
    $_SERVER['PHP_SELF'],
    'tools',
    Booking::class,
    'booking'
);

Search::show(Booking::class);

Html::footer();
