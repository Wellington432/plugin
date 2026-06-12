<?php

use Glpi\Application\View\TemplateRenderer;
use GlpiPlugin\Carbooking\Booking;
use GlpiPlugin\Carbooking\Car;

include('../../../inc/includes.php');

// Visão gerencial: exige sempre o direito de aprovar agendamentos,
// independentemente da interface (Helpdesk não tem acesso).
Session::checkRight("carbooking::booking", Booking::APPROVE);

// Mês selecionado (YYYY-MM); padrão = mês atual.
$month = $_GET['month'] ?? date('Y-m');
if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
    $month = date('Y-m');
}

Html::header(
    __('Análise', 'carbooking'),
    $_SERVER['PHP_SELF'],
    'tools',
    Car::class,
    'analytics'
);

$data = Booking::getAnalyticsForMonth($month);
$bookings = Booking::getBookingsForMonth($month);

$year = (int) substr($month, 0, 4);
$year_bookings = Booking::getBookingsForYear($year);

$meses = [1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
          5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
          9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'];
$ts = strtotime($month . '-01');
$month_label = $meses[(int) date('n', $ts)] . ' / ' . date('Y', $ts);

TemplateRenderer::getInstance()->display('@carbooking/analytics.html.twig', [
    'web_dir'         => Plugin::getWebDir('carbooking'),
    'month'           => $month,
    'month_label'     => $month_label,
    'year'            => $year,
    'meses'           => $meses,
    'can_manage_cars' => Session::haveRight(Car::$rightname, READ),
    'data'            => $data,
    'bookings'        => $bookings,
    'year_bookings'   => $year_bookings,
]);

Html::footer();
