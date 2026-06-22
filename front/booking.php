<?php

use GlpiPlugin\Carbooking\Booking;

include('../../../inc/includes.php');

Session::checkRight(Booking::$rightname, READ);

// A lista de Agendamentos foi unificada ao Calendário (aparece abaixo dele).
// Mantido apenas como redirecionamento para não quebrar links antigos.
$anchor = (isset($_GET['anchor']) && preg_match('/^[a-z0-9_-]+$/i', $_GET['anchor']))
    ? ('#' . $_GET['anchor'])
    : '#carbooking-booking-list';

Html::redirect(Plugin::getWebDir('carbooking') . '/front/calendar.php' . $anchor);
