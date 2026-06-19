<?php

use GlpiPlugin\Carbooking\Booking;
use GlpiPlugin\Carbooking\XlsxExporter;

include('../../../inc/includes.php');

// Mesma exigência da página de Análise: só quem pode aprovar exporta.
Session::checkRight(Booking::$rightname, Booking::APPROVE);

// Ano selecionado (YYYY); padrão = ano atual.
$year = (int) ($_GET['year'] ?? date('Y'));
if ($year < 2000 || $year > 2100) {
    $year = (int) date('Y');
}

$bookings = Booking::getBookingsForYear($year);

$meses = [1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
          5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
          9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'];
$dias_semana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

$headers = [
    __('Data', 'carbooking'),
    __('Dia da semana', 'carbooking'),
    __('Mês', 'carbooking'),
    __('Hora saída', 'carbooking'),
    __('Hora chegada', 'carbooking'),
    __('Carro', 'carbooking'),
    __('Solicitante', 'carbooking'),
    __('Setor', 'carbooking'),
    __('Destino', 'carbooking'),
    __('Motivo', 'carbooking'),
    __('Status', 'carbooking'),
    __('Motivo de cancelamento', 'carbooking'),
];

$rows = [];
foreach ($bookings as $b) {
    $dep = (string) $b['departure'];          // "YYYY-MM-DD HH:MM:SS"
    $date_iso = substr($dep, 0, 10);
    $ts = strtotime($date_iso);

    $data_br = $ts ? date('d/m/Y', $ts) : $date_iso;
    $dia     = $ts ? ($dias_semana[(int) date('w', $ts)] ?? '') : '';
    $mes     = $meses[(int) $b['month']] ?? '';

    $hora_saida   = strlen($dep) >= 16 ? substr($dep, 11, 5) : '';
    $arr          = (string) ($b['arrival'] ?? '');
    $hora_chegada = strlen($arr) >= 16 ? substr($arr, 11, 5) : '';

    $rows[] = [
        $data_br,
        $dia,
        $mes,
        $hora_saida,
        $hora_chegada,
        $b['car'],
        $b['user'],
        $b['sector'],
        $b['destination'],
        $b['reason'] ?? '',
        $b['status_label'],
        $b['cancel_reason'] ?? '',
    ];
}

$filename = 'agendamentos_' . $year . '.xlsx';

XlsxExporter::download($filename, (string) $year, $headers, $rows);
