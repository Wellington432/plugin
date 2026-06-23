<?php

use GlpiPlugin\Carbooking\Booking;
use GlpiPlugin\Carbooking\Car;
use Glpi\Application\View\TemplateRenderer;

include('../../../inc/includes.php');

$booking = new Booking();

if (isset($_POST['add'])) {
    // Qualquer usuário com CREATE pode solicitar um agendamento.
    $booking->check(-1, CREATE, $_POST);
    $newID = $booking->add($_POST);

    // Repetição: cria o mesmo agendamento nos demais dias da semana marcados.
    if ($newID && !empty($_POST['_repeat_weekdays'])) {
        $wd = is_array($_POST['_repeat_weekdays'])
            ? $_POST['_repeat_weekdays']
            : explode(',', (string) $_POST['_repeat_weekdays']);
        $n = Booking::createWeekRepeats($_POST, $wd);
        if ($n > 0) {
            Session::addMessageAfterRedirect(
                sprintf(__('Mais %d agendamento(s) criados nos dias da semana selecionados.', 'carbooking'), $n),
                true
            );
        }
    }

    // Volta para o calendário quando o pedido veio do popup do calendário.
    if (!empty($_POST['_from_calendar'])) {
        $m = $_POST['_calendar_month'] ?? '';
        $q = preg_match('/^\d{4}-\d{2}$/', (string) $m) ? ('?month=' . $m) : '';
        Html::redirect(Plugin::getWebDir('carbooking') . '/front/calendar.php' . $q);
    }

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

} elseif (isset($_POST['cancel'])) {
    // Cancelamento exige motivo. O dono pode cancelar o próprio pedido;
    // o aprovador pode cancelar qualquer um (validado em canCancel()).
    if ($booking->getFromDB((int) $_POST['id'])) {
        $booking->cancel((string) ($_POST['cancel_reason'] ?? ''));
    }
    Html::back();

} elseif (isset($_POST['arrive'])) {
    // Confirmação de chegada do carro (somente aprovador). A folha de
    // agendamento é opcional, mas o checkbox de confirmação é obrigatório.
    Session::checkRight(Booking::$rightname, Booking::APPROVE);
    if (empty($_POST['confirm_ok'])) {
        Session::addMessageAfterRedirect(__('Você precisa marcar a confirmação para registrar a chegada.', 'carbooking'), false, ERROR);
        Html::back();
    }
    if ($booking->getFromDB((int) $_POST['id'])) {
        $sheet = null;
        if (!empty($_FILES['arrival_sheet']['name'])) {
            $sheet = Booking::storeArrivalSheet((int) $_POST['id'], $_FILES['arrival_sheet']);
        }
        $when = !empty($_POST['returned_at']) ? str_replace('T', ' ', (string) $_POST['returned_at']) : null;
        $obs  = isset($_POST['arrival_obs']) ? trim((string) $_POST['arrival_obs']) : null;
        $booking->markReturned($sheet, $when, $obs);
    }
    Html::redirect(Plugin::getWebDir('carbooking') . '/front/calendar.php#carbooking-arrived-section');

} elseif (isset($_POST['upload_sheet'])) {
    // Adiciona folha a um agendamento já marcado como chegada (sem folha ainda).
    Session::checkRight(Booking::$rightname, Booking::APPROVE);
    if (empty($_POST['confirm_ok'])) {
        Session::addMessageAfterRedirect(__('Você precisa marcar a confirmação para enviar a folha.', 'carbooking'), false, ERROR);
        Html::back();
    }
    if ($booking->getFromDB((int) $_POST['id'])) {
        if ((int) ($booking->fields['status'] ?? 0) !== Booking::STATUS_ARRIVED) {
            Session::addMessageAfterRedirect(__('A folha só pode ser anexada após marcar o retorno.', 'carbooking'), false, ERROR);
            Html::back();
        }
        if (!empty($_FILES['arrival_sheet']['name'])) {
            $sheet = Booking::storeArrivalSheet((int) $_POST['id'], $_FILES['arrival_sheet']);
            if ($sheet !== null) {
                $booking->update(['id' => (int) $_POST['id'], 'arrival_sheet' => $sheet]);
            }
        }
    }
    Html::back();

} elseif (isset($_POST['update'])) {
    $booking->check($_POST['id'], UPDATE);
    $booking->update($_POST);
    
    // Volta para o calendário quando o pedido veio do popup do calendário.
    if (!empty($_POST['_from_calendar'])) {
        $m = $_POST['_calendar_month'] ?? '';
        $q = preg_match('/^\d{4}-\d{2}$/', (string) $m) ? ('?month=' . $m) : '';
        Html::redirect(Plugin::getWebDir('carbooking') . '/front/calendar.php' . $q);
    }
    Html::back();

} elseif (isset($_POST['delete'])) {
    $booking->check($_POST['id'], DELETE);
    if ((int) ($booking->fields['status'] ?? 0) !== Booking::STATUS_PENDING) {
        Session::addMessageAfterRedirect(__('Apenas agendamentos pendentes podem ser excluídos.', 'carbooking'), false, ERROR);
        Html::back();
    }
    $booking->delete($_POST);
    $booking->redirectToList();

} elseif (isset($_POST['restore'])) {
    $booking->check($_POST['id'], DELETE);
    $booking->restore($_POST);
    $booking->redirectToList();

} elseif (isset($_POST['purge'])) {
    $booking->check($_POST['id'], PURGE);
    if ((int) ($booking->fields['status'] ?? 0) !== Booking::STATUS_PENDING) {
        Session::addMessageAfterRedirect(__('Apenas agendamentos pendentes podem ser excluídos.', 'carbooking'), false, ERROR);
        Html::back();
    }
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
        'calendar'
    );

    $booking->display(['id' => $ID]);

    Html::footer();
}
