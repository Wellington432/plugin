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

header('Content-Type: application/json; charset=utf-8');
Html::header_nocache();

$month = $_GET['month'] ?? date('Y-m');
if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
    $month = date('Y-m');
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(Booking::getBookingsForMonth($month));
