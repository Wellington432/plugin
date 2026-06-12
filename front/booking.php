<?php

use GlpiPlugin\Carbooking\Booking;

include('../../../inc/includes.php');

Session::checkRight("carbooking::booking", READ);

Html::header(
    Booking::getTypeName(2),
    $_SERVER['PHP_SELF'],
    'tools',
    Booking::class,
    'booking'
);

Search::show(Booking::class);

Html::footer();
