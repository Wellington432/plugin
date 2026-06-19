<?php

use GlpiPlugin\Carbooking\Booking;
use GlpiPlugin\Carbooking\Car;
use Glpi\Application\View\TemplateRenderer;

include('../../../inc/includes.php');

Session::checkRight(Booking::$rightname, READ);

$used_help = false;
if (Session::getCurrentInterface() === 'helpdesk' && method_exists(Html::class, 'helpHeader')) {
    Html::helpHeader(__('Histórico', 'carbooking'));
    $used_help = true;
} else {
    Html::header(
        __('Histórico', 'carbooking'),
        $_SERVER['PHP_SELF'],
        'tools',
        Booking::class,
        'history'
    );
}

TemplateRenderer::getInstance()->display('@carbooking/history.html.twig', [
    'web_dir'            => Plugin::getWebDir('carbooking'),
    'history'            => Booking::getHistory(),
    'is_manager'         => Booking::canApprove(),
    'can_manage_cars'    => Session::haveRight(Car::$rightname, READ),
    'can_view_analytics' => Booking::canApprove(),
]);

if ($used_help) {
    Html::helpFooter();
} else {
    Html::footer();
}
