<?php

use Glpi\Application\View\TemplateRenderer;
use GlpiPlugin\Carbooking\Booking;
use GlpiPlugin\Carbooking\Car;

include('../../../inc/includes.php');

// Precisa poder ver agendamentos para abrir a agenda.
Session::checkRight("carbooking::booking", READ);

// Data selecionada (padrão: hoje). Validada como Y-m-d.
$date = $_GET['date'] ?? date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    $date = date('Y-m-d');
}

// Na interface simplificada (Helpdesk) usamos o cabeçalho do self-service;
// na central, o cabeçalho normal com o menu Ferramentas.
$used_help = false;
if (Session::getCurrentInterface() === 'helpdesk' && method_exists(Html::class, 'helpHeader')) {
    Html::helpHeader(__('Agendar carro', 'carbooking'));
    $used_help = true;
} else {
    Html::header(
        __('Agendar carro', 'carbooking'),
        $_SERVER['PHP_SELF'],
        'tools',
        Car::class,
        'agenda'
    );
}

TemplateRenderer::getInstance()->display('@carbooking/agenda.html.twig', [
    'web_dir'    => Plugin::getWebDir('carbooking'),
    'date'       => $date,
    'cars'       => Car::getActiveCars(),
    'can_create' => Session::haveRight(Booking::$rightname, CREATE),
    'can_manage_cars' => Session::haveRight(Car::$rightname, READ),
    'can_view_analytics' => Booking::canApprove(),
    'groups'     => Booking::getGroupsList(),
    'is_helpdesk' => $used_help,
    'cars_url'   => Plugin::getWebDir('carbooking') . '/front/car.form.php',
    'csrf'       => Session::getNewCSRFToken(),
]);

if ($used_help) {
    Html::helpFooter();
} else {
    Html::footer();
}
