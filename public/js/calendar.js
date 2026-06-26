/* global document, fetch, window, confirm */

/**
 * Carbooking — calendário mensal (estilo "calendário de mesa").
 * Lê o array de agendamentos de ajax/month.php e desenha a grade do mês.
 * Só age quando #carbooking-calendar existe.
 */
(function () {
    'use strict';

    var WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    var WEEK_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    var MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    var CAR_PALETTE = [
        '#4263eb', '#0ca678', '#e8590c', '#7048e8', '#1098ad', '#d6336c',
        '#f59f00', '#37b24d', '#1c7ed6', '#ae3ec9', '#f76707', '#0c8599',
        '#2b8a3e', '#c2255c', '#5f3dc4', '#0b7285'
    ];
    function carColor(b) {
        var key = b && b.car_id ? b.car_id : 0;
        if (!key && b && b.car) {
            for (var i = 0; i < b.car.length; i++) { key += b.car.charCodeAt(i); }
        }
        return CAR_PALETTE[Math.abs(key) % CAR_PALETTE.length];
    }
    function carTint(hex, a) {
        var n = parseInt(hex.slice(1), 16);
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function todayStr() {
        var t = new Date();
        return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function timeOf(dt) {
        // "2026-06-10 08:30:00" -> "08:30"
        if (!dt) { return ''; }
        var s = String(dt);
        return s.length >= 16 ? s.substr(11, 5) : s;
    }

    function init() {
        var root = document.getElementById('carbooking-calendar');
        if (!root) { return; }

        var ajaxMonth = root.dataset.ajaxMonth;
        var bform = root.dataset.bform;
        var agendaUrl = root.dataset.aurl || '';
        var csrf = root.dataset.csrf || '';
        var canDelete = root.dataset.candelete === '1';
        var canCreate = root.dataset.cancreate === '1';

        var grid = document.getElementById('carbooking-grid');
        var titleEl = document.getElementById('carbooking-cal-title');
        var modal = document.getElementById('carbooking-day-modal');
        var modalTitle = document.getElementById('carbooking-modal-title');
        var modalExisting = document.getElementById('carbooking-modal-existing');
        var modalDate = document.getElementById('carbooking-modal-date');
        var modalDep = document.getElementById('cb-m-dep');
        var modalArr = document.getElementById('cb-m-arr');
        var modalMonth = document.getElementById('carbooking-modal-month');
        var mDate = document.getElementById('cb-m-date');
        var mTime = document.getElementById('cb-m-time');
        var mADate = document.getElementById('cb-m-adate');
        var mATime = document.getElementById('cb-m-atime');
        var modalForm = document.getElementById('carbooking-modal-form');
        var modalWeekdays = document.getElementById('cb-m-weekdays');
        var carSel = document.getElementById('cb-m-car');
        var carImg = document.getElementById('cb-m-car-img');
        var conflictBox = document.getElementById('cb-m-conflict');
        var conflictUrl = (root.dataset.ajaxMonth || '').replace('month.php', 'conflict.php');

        // Tooltip flutuante (criado uma vez).
        var tip = document.createElement('div');
        tip.className = 'carbooking-tip';
        tip.hidden = true;
        document.body.appendChild(tip);

        // mês corrente do componente (Date no dia 1)
        var parts = String(root.dataset.month || '').split('-');
        var cur = new Date(
            parseInt(parts[0], 10) || new Date().getFullYear(),
            (parseInt(parts[1], 10) || (new Date().getMonth() + 1)) - 1,
            1
        );

        function currentYm() {
            return cur.getFullYear() + '-' + pad(cur.getMonth() + 1);
        }

        // agrupa a lista de agendamentos por dia do mês -> { 10: [b, b], ... }
        function groupByDay(list) {
            var map = {};
            if (!Array.isArray(list)) { return map; }
            list.forEach(function (b) {
                if (!b) { return; }
                var d = b.day || (b.date ? parseInt(String(b.date).substr(8, 2), 10) : 0);
                if (!d) { return; }
                if (!map[d]) { map[d] = []; }
                map[d].push(b);
            });
            return map;
        }

        function load() {
            var ym = currentYm();
            titleEl.textContent = MONTHS[cur.getMonth()] + ' ' + cur.getFullYear();
            grid.innerHTML = '<div class="carbooking-grid-loading"><span class="carbooking-spinner"></span></div>';
            closeModal();
            if (typeof hideTip === 'function') { hideTip(); }

            fetch(ajaxMonth + '?month=' + encodeURIComponent(ym), {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin'
            })
                .then(function (r) {
                    if (!r.ok) { throw new Error('HTTP ' + r.status); }
                    return r.json();
                })
                .then(function (data) {
                    // aceita tanto array puro quanto {bookings:[...]}
                    var list = Array.isArray(data) ? data : (data && data.bookings) || [];
                    render(groupByDay(list));
                })
                .catch(function (err) {
                    // mantém o erro real visível no console para depuração
                    if (window.console) { window.console.error('[carbooking] calendário:', err); }
                    grid.innerHTML = '<div class="carbooking-grid-loading">'
                        + 'Não foi possível carregar o calendário. Recarregue a página.</div>';
                });
        }

        function render(byDay) {
            var year = cur.getFullYear();
            var month = cur.getMonth();
            var firstWeekday = new Date(year, month, 1).getDay();   // 0=Dom
            var daysInMonth = new Date(year, month + 1, 0).getDate();
            var todayStr = (function () {
                var t = new Date();
                return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
            }());

            var html = '<div class="carbooking-grid-head">';
            for (var w = 0; w < 7; w++) {
                html += '<div class="carbooking-grid-wd">' + WEEK_SHORT[w] + '</div>';
            }
            html += '</div><div class="carbooking-grid-body">';

            // células do mês anterior (vazias)
            for (var e = 0; e < firstWeekday; e++) {
                html += '<div class="carbooking-cell is-empty"></div>';
            }

            for (var d = 1; d <= daysInMonth; d++) {
                var items = byDay[d] || [];
                var dateStr = year + '-' + pad(month + 1) + '-' + pad(d);
                var isToday = dateStr === todayStr;

                var chips = '';
                items.slice(0, 4).forEach(function (b) {
                    chips += '<span class="carbooking-evt s-' + (b.status || 1) + (b.conflict ? ' is-conflict' : '') + '"'
                        + ' title="' + esc(b.car) + '">'
                        + '<b>' + esc(timeOf(b.departure)) + '</b> '
                        + esc(b.car) + ' — ' + esc(b.user)
                        + '</span>';
                });
                if (items.length > 4) {
                    chips += '<span class="carbooking-evt-more">+' + (items.length - 4) + ' '
                        + (items.length - 4 === 1 ? 'outro' : 'outros') + '</span>';
                }

                var hasAllArrived = items.length > 0 && items.every(function (b) { return (b.status || 1) === 5; });
                var hasSomeArrived = !hasAllArrived && items.some(function (b) { return (b.status || 1) === 5; });
                html += '<div class="carbooking-cell' + (items.length ? ' has-items' : '')
                    + (isToday ? ' is-today' : '')
                    + (hasAllArrived ? ' is-all-arrived' : (hasSomeArrived ? ' is-some-arrived' : ''))
                    + '" data-day="' + d + '">'
                    + '<span class="carbooking-cell__num">' + d + '</span>'
                    + '<div class="carbooking-cell__evts">' + chips + '</div>'
                    + '</div>';
            }

            // completa a última linha
            var totalCells = firstWeekday + daysInMonth;
            var tail = (7 - (totalCells % 7)) % 7;
            for (var t = 0; t < tail; t++) {
                html += '<div class="carbooking-cell is-empty"></div>';
            }

            html += '</div>';
            grid.innerHTML = html;

            grid.querySelectorAll('.carbooking-cell[data-day]').forEach(function (cell) {
                var dayItems = byDay[cell.dataset.day] || [];
                cell.addEventListener('click', function () {
                    openDay(parseInt(cell.dataset.day, 10), dayItems);
                });
                if (dayItems.length) {
                    cell.addEventListener('mouseenter', function () {
                        showTip(parseInt(cell.dataset.day, 10), dayItems);
                    });
                    cell.addEventListener('mousemove', moveTip);
                    cell.addEventListener('mouseleave', hideTip);
                }
            });
        }

        // ----- Tooltip (passar o mouse mostra os agendamentos do dia) -----
        function tipItem(b) {
            var period = b.arrival
                ? timeOf(b.departure) + ' → ' + timeOf(b.arrival)
                : timeOf(b.departure);
            return '<div class="carbooking-tip__item s-' + (b.status || 1) + '">'
                + '<div class="carbooking-tip__line"><b>' + esc(period) + '</b> · ' + esc(b.car) + '</div>'
                + '<div class="carbooking-tip__sub"><i class="ti ti-user"></i> ' + esc(b.user)
                + ' · <i class="ti ti-steering-wheel"></i> ' + esc(b.driver || '—')
                + ' · ' + esc(b.status_label) + '</div>'
                + (b.destination ? '<div class="carbooking-tip__sub"><i class="ti ti-map-pin"></i> ' + esc(b.destination) + '</div>' : '')
                + '</div>';
        }

        function showTip(day, items) {
            if (!tip) { return; }
            tip.innerHTML = '<div class="carbooking-tip__head">' + pad(day) + '/' + pad(cur.getMonth() + 1)
                + ' · ' + items.length + (items.length === 1 ? ' agendamento' : ' agendamentos') + '</div>'
                + items.map(tipItem).join('');
            tip.hidden = false;
        }

        function moveTip(e) {
            if (!tip || tip.hidden) { return; }
            var pad2 = 14;
            var w = tip.offsetWidth, h = tip.offsetHeight;
            var x = e.clientX + pad2;
            var y = e.clientY + pad2;
            if (x + w > window.innerWidth - 8) { x = e.clientX - w - pad2; }
            if (y + h > window.innerHeight - 8) { y = e.clientY - h - pad2; }
            tip.style.left = Math.max(8, x) + 'px';
            tip.style.top = Math.max(8, y) + 'px';
        }

        function hideTip() {
            if (tip) { tip.hidden = true; }
        }

        function openDay(day, items) {
            if (!modal) { return; }
            hideTip();
            var weekday = WEEK[new Date(cur.getFullYear(), cur.getMonth(), day).getDay()];
            var dateStr = cur.getFullYear() + '-' + pad(cur.getMonth() + 1) + '-' + pad(day);

            modalTitle.textContent = pad(day) + '/' + pad(cur.getMonth() + 1) + '/' + cur.getFullYear()
                + ' · ' + weekday;

            // Lista (somente leitura) dos agendamentos já existentes no dia.
            var listHtml = items.map(function (b) {
                var period = b.arrival
                    ? timeOf(b.departure) + ' → ' + timeOf(b.arrival)
                    : 'Saída ' + timeOf(b.departure);
                var cancelBtn = b.can_cancel
                    ? '<button type="button" class="carbooking-btn-cancel" data-cb-cancel'
                        + ' data-id="' + b.id + '" data-bform="' + bform + '" data-csrf="' + esc(csrf) + '">'
                        + '<i class="ti ti-ban"></i> Cancelar</button>'
                    : '';
                var uploadSheetBtn = '';
                if (!b.has_sheet && (b.status === 5 || b.returned_at)) {
                    uploadSheetBtn = '<button type="button" class="carbooking-btn-sheet" data-cb-attach'
                        + ' data-id="' + b.id + '" data-bform="' + bform + '" data-csrf="' + esc(csrf) + '"'
                        + ' title="Adicionar folha de agendamento">'
                        + '<i class="ti ti-paperclip"></i> Folha</button>';
                }
                var sheetBtn = (b.has_sheet && bform)
                    ? '<a class="carbooking-open" href="' + bform.replace('booking.form.php', 'sheet.php') + '?id=' + b.id + '"><i class="ti ti-download"></i> Baixar folha</a>'
                    : '';
                var openUrl = bform ? (bform + '?id=' + b.id) : '';
                var hasObs = (b.status === 5 && b.obs);
                return '<div class="carbooking-day-item s-' + (b.status || 1) + (b.conflict ? ' is-conflict' : '') + (hasObs ? ' has-obs' : '') + '"'
                    + (openUrl ? ' data-open="' + openUrl + '" style="cursor:pointer;"' : '')
                    + '>'
                    + '<div class="carbooking-day-item__body">'
                    + '<div class="carbooking-day-item__top">'
                    + '<span class="carbooking-chip status-' + (b.conflict ? 'conflict' : statusName(b.status)) + '">'
                    + (b.conflict ? 'Conflito' : esc(b.status_label)) + '</span>'
                    + (hasObs ? '<span class="carbooking-obsdot" title="Tem observação"></span> ' : '')
                    + '<strong>' + esc(b.car) + '</strong></div>'
                    + '<div class="carbooking-day-item__meta"><i class="ti ti-user"></i> ' + esc(b.user)
                    + ' &nbsp;·&nbsp; <i class="ti ti-steering-wheel"></i> ' + esc(b.driver || '—') + '</div>'
                    + '<div class="carbooking-day-item__meta"><i class="ti ti-clock"></i> ' + esc(period)
                    + (b.destination ? ' &nbsp;·&nbsp; <i class="ti ti-map-pin"></i> ' + esc(b.destination) : '')
                    + '</div>'
                    + (b.status === 4 && b.note ? '<div class="carbooking-day-item__reason"><i class="ti ti-info-circle"></i> Motivo: ' + esc(b.note) + '</div>' : '')
                    + (hasObs ? '<div class="carbooking-day-item__reason obs"><i class="ti ti-message-circle"></i> Observação: ' + esc(b.obs) + '</div>' : '')
                    + '</div>'
                    + '<div class="carbooking-day-item__actions">' + sheetBtn + cancelBtn + uploadSheetBtn + '</div>'
                    + '</div>';
            }).join('');

            if (items.length) {
                listHtml = '<div class="carbooking-modal__existinghead">'
                    + items.length + (items.length === 1 ? ' agendamento neste dia' : ' agendamentos neste dia')
                    + '</div>' + listHtml;
            }
            modalExisting.innerHTML = listHtml;

            // Clicar no card preenche o formulário para edição.
            modalExisting.querySelectorAll('.carbooking-day-item').forEach(function (card, idx) {
                card.addEventListener('click', function (e) {
                    if (e.target.closest('a, button')) { return; }
                    var b = items[idx];
                    if (!b) { return; }
                    
                    // Muda para modo edição
                    document.getElementById('cb-m-action-add').disabled = true;
                    document.getElementById('cb-m-action-update').disabled = false;
                    document.getElementById('cb-m-id').disabled = false;
                    document.getElementById('cb-m-id').value = b.id;
                    document.getElementById('cb-m-form-title').innerHTML = '<i class="ti ti-pencil"></i> Editar agendamento';
                    document.getElementById('cb-m-submit').innerHTML = '<i class="ti ti-device-floppy"></i> Salvar alterações';
                    
                    // Preenche os campos
                    if (carSel) {
                        carSel.value = b.car_id;
                        carSel.disabled = true; // Trava o carro
                        updateCarImg();
                    }
                    var driverInp = document.getElementById('cb-m-driver');
                    if (driverInp) { driverInp.value = b.driver || ''; }
                    var compQ = document.getElementById('cb-m-companion-q');
                    var compWrap = document.getElementById('cb-m-companion-wrap');
                    var compInp = document.getElementById('cb-m-companion');
                    if (compQ) { compQ.value = b.has_companion ? '1' : '0'; }
                    if (compWrap) { compWrap.hidden = !b.has_companion; }
                    if (compInp) { compInp.value = b.companion || ''; }
                    
                    if (mDate) { mDate.value = b.departure.substr(0, 10); }
                    if (mTime) { mTime.value = b.departure.substr(11, 5); }
                    
                    if (mADate) { mADate.value = b.arrival ? b.arrival.substr(0, 10) : ''; }
                    if (mATime) { mATime.value = b.arrival ? b.arrival.substr(11, 5) : ''; }
                    
                    var destInput = document.getElementById('cb-m-dest');
                    if (destInput) { destInput.value = b.destination || ''; }
                    
                    var reasonInput = document.getElementById('cb-m-reason');
                    if (reasonInput) { reasonInput.value = b.reason || ''; }
                    
                    // Remove destaque de outros cards e destaca este
                    modalExisting.querySelectorAll('.carbooking-day-item').forEach(function(c){ c.classList.remove('is-editing'); });
                    card.classList.add('is-editing');
                });
            });

            // Pré-preenche o dia no formulário do popup (data e hora separadas).
            if (modalDate) { modalDate.value = dateStr; }
            if (modalMonth) { modalMonth.value = currentYm(); }
            if (mDate) { mDate.value = dateStr; }
            if (mTime && !mTime.value) { mTime.value = '08:00'; }
            if (mADate) { mADate.value = ''; }
            if (mATime) { mATime.value = ''; }
            if (typeof updateCarImg === 'function') { updateCarImg(); }
            if (typeof checkConflict === 'function') { checkConflict(); }

            modal.hidden = false;
            document.body.classList.add('carbooking-modal-open');
        }

        function closeModal() {
            if (!modal) { return; }
            modal.hidden = true;
            document.body.classList.remove('carbooking-modal-open');
            
            // Reseta o formulário para modo criação
            document.getElementById('cb-m-action-add').disabled = false;
            document.getElementById('cb-m-action-update').disabled = true;
            document.getElementById('cb-m-id').disabled = true;
            document.getElementById('cb-m-id').value = '';
            document.getElementById('cb-m-form-title').innerHTML = '<i class="ti ti-calendar-plus"></i> Novo agendamento';
            document.getElementById('cb-m-submit').innerHTML = '<i class="ti ti-send"></i> Solicitar agendamento';
            
            if (carSel) {
                carSel.disabled = false;
                carSel.value = '';
                updateCarImg();
            }
            if (modalForm) { modalForm.reset(); }
        }

        function statusName(s) {
            return s === 2 ? 'approved' : (s === 3 ? 'rejected' : (s === 4 ? 'cancelled' : (s === 5 ? 'arrived' : 'pending')));
        }

        function doDelete(id) {
            if (!confirm('Apagar este agendamento? Esta ação não pode ser desfeita.')) { return; }
            var form = document.createElement('form');
            form.method = 'post';
            form.action = bform;
            form.innerHTML =
                '<input type="hidden" name="id" value="' + esc(id) + '">'
                + '<input type="hidden" name="purge" value="1">'
                + '<input type="hidden" name="_glpi_csrf_token" value="' + esc(csrf) + '">';
            document.body.appendChild(form);
            form.submit();
        }

        // navegação
        root.querySelectorAll('[data-nav]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var nav = btn.dataset.nav;
                if (nav === 'today') {
                    cur = new Date();
                    cur.setDate(1);
                } else {
                    cur.setMonth(cur.getMonth() + parseInt(nav, 10));
                }
                load();
            });
        });

        // Fechar o popup: botão X, clique no fundo (backdrop) ou tecla ESC.
        if (modal) {
            modal.querySelectorAll('[data-close]').forEach(function (el) {
                el.addEventListener('click', closeModal);
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && !modal.hidden) { closeModal(); }
            });
        }

        // Combina dia + hora nos campos ocultos e junta os dias da semana
        // marcados, antes de enviar o formulário do popup.
        if (modalForm) {
            if (mDate) { mDate.removeAttribute('min'); }
            modalForm.addEventListener('submit', function (e) {
                if (mDate && mDate.value && mDate.value < todayStr()) {
                    e.preventDefault();
                    alert('Não é possível agendar em uma data que já passou. Escolha hoje ou uma data futura.');
                    return;
                }
                if (mDate && mTime && mDate.value && mTime.value) {
                    modalDep.value = mDate.value + 'T' + mTime.value;
                } else {
                    e.preventDefault();
                    alert('Informe o dia e a hora da saída.');
                    return;
                }
                // Chegada: basta escolher o DIA. Se não informar a hora,
                // herda a hora da saída — assim o intervalo (saída → chegada)
                // é preenchido no calendário mesmo sem digitar horário.
                if (modalArr) {
                    if (mADate && mADate.value) {
                        var at = (mATime && mATime.value)
                            ? mATime.value
                            : (mTime && mTime.value ? mTime.value : '18:00');
                        modalArr.value = mADate.value + 'T' + at;
                    } else {
                        modalArr.value = '';
                    }
                }
                
                // Se for edição, garante que o select do carro (desabilitado) seja enviado se necessário,
                // mas como o backend já tem o carro no DB, o mais importante é enviar o ID.
                // Reabilitamos temporariamente apenas para o POST se o browser não enviar campos disabled.
                if (carSel && carSel.disabled) {
                    // carSel.disabled = false; // Opcional: o backend geralmente não muda o carro no update
                }
            });
        }

        // Imagem do carro selecionado, ao lado do select.
        function updateCarImg() {
            if (!carImg || !carSel) { return; }
            var opt = carSel.options[carSel.selectedIndex];
            var img = opt ? opt.getAttribute('data-img') : '';
            if (img && img !== 'null') {
                carImg.src = img;
                carImg.hidden = false;
            } else {
                carImg.hidden = true;
                carImg.removeAttribute('src');
            }
        }

        function toMin(hhmm) {
            var p = (hhmm || '').split(':');
            return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
        }

        function renderConflict(items) {
            if (!conflictBox) { return; }
            var span = conflictBox.querySelector('span');
            if (!items || !items.length) {
                conflictBox.hidden = true;
                conflictBox.classList.remove('is-hard');
                return;
            }
            var times = items.map(function (it) { return it.start + (it.end ? '–' + it.end : ''); });
            var hard = false;
            if (mTime && mTime.value) {
                var nStart = toMin(mTime.value), nEnd = nStart + 60;
                items.forEach(function (it) {
                    var s = toMin(it.start), e = it.end ? toMin(it.end) : s + 60;
                    if (nStart < e && s < nEnd) { hard = true; }
                });
            }
            conflictBox.hidden = false;
            conflictBox.classList.toggle('is-hard', hard);
            span.textContent = hard
                ? 'Este carro já está agendado nesse horário (' + times.join(', ') + ').'
                : 'Atenção: este carro já tem agendamento neste dia (' + times.join(', ') + ').';
        }

        function checkConflict() {
            if (!conflictBox || !carSel || !mDate) { return; }
            if (!carSel.value || !mDate.value || !conflictUrl) {
                conflictBox.hidden = true;
                return;
            }
            fetch(conflictUrl + '?car=' + encodeURIComponent(carSel.value) + '&date=' + encodeURIComponent(mDate.value),
                  { credentials: 'same-origin' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (d) { renderConflict(d ? d.items : []); })
                .catch(function () {});
        }

        if (carSel) { carSel.addEventListener('change', function () { updateCarImg(); checkConflict(); }); }
        if (mDate) { mDate.addEventListener('change', checkConflict); }
        if (mTime) { mTime.addEventListener('change', checkConflict); }

        load();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
