<?php

use GlpiPlugin\Carbooking\Booking;
use GlpiPlugin\Carbooking\Car;
use Glpi\Application\View\TemplateRenderer;

include('../../../inc/includes.php');

// Protege acesso à lista.
Session::checkRight(Booking::$rightname, READ);

$used_help = false;
if (Session::getCurrentInterface() === 'helpdesk' && method_exists(Html::class, 'helpHeader')) {
    Html::helpHeader(Booking::getTypeName(2));
    $used_help = true;
} else {
    Html::header(
        Booking::getTypeName(2),
        $_SERVER['PHP_SELF'],
        'tools',
        Booking::class,
        'booking'
    );
}

TemplateRenderer::getInstance()->display('@carbooking/booking.list.html.twig', [
    'web_dir'            => Plugin::getWebDir('carbooking'),
    'groups'             => Booking::getGroupedByStatus(),
    'pending_count'      => Booking::countPending(),
    'can_approve'        => Booking::canApprove(),
    'can_manage_cars'    => Session::haveRight(Car::$rightname, READ),
    'can_view_analytics' => Booking::canApprove(),
    'csrf'               => Session::getNewCSRFToken(),
]);

if ($used_help) {
    Html::helpFooter();
} else {
    Html::footer();
}
