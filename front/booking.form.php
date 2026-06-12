<?php

use GlpiPlugin\Carbooking\Booking;

include('../../../inc/includes.php');

$booking = new Booking();

if (isset($_POST['add'])) {
    // Qualquer usuário com CREATE pode solicitar um agendamento.
    $booking->check(-1, CREATE, $_POST);
    $newID = $booking->add($_POST);

    // Volta para a agenda quando o pedido veio de lá.
    if (!empty($_POST['_from_agenda'])) {
        Html::redirect(Plugin::getWebDir('carbooking') . '/front/agenda.php'
            . (isset($_POST['_agenda_date']) ? '?date=' . urlencode($_POST['_agenda_date']) : ''));
    }
    if ($newID && ($_SESSION['glpibackcreated'] ?? false)) {
        Html::redirect(Booking::getFormURL() . '?id=' . $newID);
    }
    Html::back();

} elseif (isset($_POST['approve'])) {
    // Aprovação: exige o direito específico.
    Session::checkRight(Booking::$rightname, Booking::APPROVE);
    if ($booking->getFromDB((int) $_POST['id'])) {
        $booking->approve($_POST['comment_validation'] ?? '');
    }
    Html::back();

} elseif (isset($_POST['reject'])) {
    Session::checkRight(Booking::$rightname, Booking::APPROVE);
    if ($booking->getFromDB((int) $_POST['id'])) {
        $booking->reject($_POST['comment_validation'] ?? '');
    }
    Html::back();

} elseif (isset($_POST['update'])) {
    $booking->check($_POST['id'], UPDATE);
    $booking->update($_POST);
    Html::back();

} elseif (isset($_POST['delete'])) {
    $booking->check($_POST['id'], DELETE);
    $booking->delete($_POST);
    $booking->redirectToList();

} elseif (isset($_POST['restore'])) {
    $booking->check($_POST['id'], DELETE);
    $booking->restore($_POST);
    $booking->redirectToList();

} elseif (isset($_POST['purge'])) {
    $booking->check($_POST['id'], PURGE);
    $booking->delete($_POST, 1);
    $booking->redirectToList();

} else {
    $ID = isset($_GET['id']) ? (int) $_GET['id'] : 0;

    Session::checkRight(Booking::$rightname, READ);

    Html::header(
        Booking::getTypeName(2),
        $_SERVER['PHP_SELF'],
        'tools',
        Booking::class,
        'booking'
    );

    $booking->display(['id' => $ID]);

    Html::footer();
}
