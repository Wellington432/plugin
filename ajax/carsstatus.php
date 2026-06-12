<?php

use GlpiPlugin\Carbooking\Booking;

include('../../../inc/includes.php');

header('Content-Type: application/json; charset=UTF-8');
Html::header_nocache();

// Se for interface simplificada, basta estar logado.
// Se for interface central, exige a permissão específica do plugin.
if (Session::getCurrentInterface() === 'helpdesk') {
    Session::checkLoginUser();
} else {
    Session::checkRight("carbooking::booking", READ);
}

$date = $_GET['date'] ?? date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    $date = date('Y-m-d');
}

echo json_encode([
    'date' => $date,
    'cars' => Booking::getCarsStatusForDate($date),
], JSON_UNESCAPED_UNICODE);
