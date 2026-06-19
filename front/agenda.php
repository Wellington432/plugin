<?php

use GlpiPlugin\Carbooking\Booking;

include('../../../inc/includes.php');

Session::checkRight(Booking::$rightname, READ);

// A tela de "Agendar" foi unificada ao Calendário (tela principal).
// Mantido apenas como redirecionamento para não quebrar links antigos.
$date = isset($_GET['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date'])
    ? ('?month=' . substr($_GET['date'], 0, 7))
    : '';

Html::redirect(Plugin::getWebDir('carbooking') . '/front/calendar.php' . $date);
