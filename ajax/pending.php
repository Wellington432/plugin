<?php

use GlpiPlugin\Carbooking\Booking;

include('../../../inc/includes.php');

Session::checkRight(Booking::$rightname, READ);

header('Content-Type: application/json; charset=utf-8');

// Só aprovadores recebem a contagem de pendentes (a notificação é para eles).
$count = Booking::canApprove() ? Booking::countPending() : 0;

echo json_encode([
    'count' => $count,
    'url'   => Plugin::getWebDir('carbooking') . '/front/booking.php',
]);
