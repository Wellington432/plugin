<?php

use Glpi\Application\View\TemplateRenderer;
use GlpiPlugin\Carbooking\Booking;
use GlpiPlugin\Carbooking\Car;

include('../../../inc/includes.php');

Session::checkRight(Booking::$rightname, READ);

$month = $_GET['month'] ?? date('Y-m');
if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
    $month = date('Y-m');
}

// Cabeçalho conforme a interface (simplificada x central).
$used_help = false;
if (Session::getCurrentInterface() === 'helpdesk' && method_exists(Html::class, 'helpHeader')) {
    Html::helpHeader(__('Calendário', 'carbooking'));
    $used_help = true;
} else {
    Html::header(
        __('Calendário', 'carbooking'),
        $_SERVER['PHP_SELF'],
        'tools',
        Car::class,
        'calendar'
    );
}

TemplateRenderer::getInstance()->display('@carbooking/calendar.html.twig', [
    'web_dir'            => Plugin::getWebDir('carbooking'),
    'month'              => $month,
    'is_helpdesk'        => $used_help,
    'can_manage_cars'    => Session::haveRight(Car::$rightname, READ),
    'can_view_analytics' => Booking::canApprove(),
    'can_delete'         => Session::haveRight(Booking::$rightname, PURGE),
    'csrf'               => Session::getNewCSRFToken(),
]);

if ($used_help) {
    Html::helpFooter();
} else {
    Html::footer();
}
