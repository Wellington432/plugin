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
        var csrf = root.dataset.csrf || '';
        var canDelete = root.dataset.candelete === '1';

        var grid = document.getElementById('carbooking-grid');
        var titleEl = document.getElementById('carbooking-cal-title');
        var panel = document.getElementById('carbooking-day-panel');
        var panelTitle = document.getElementById('carbooking-day-title');
        var panelList = document.getElementById('carbooking-day-list');

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
            panel.hidden = true;

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
                    chips += '<span class="carbooking-evt s-' + (b.status || 1) + '">'
                        + '<b>' + esc(timeOf(b.departure)) + '</b> '
                        + esc(b.car) + ' — ' + esc(b.user)
                        + '</span>';
                });
                if (items.length > 4) {
                    chips += '<span class="carbooking-evt-more">+' + (items.length - 4) + ' '
                        + (items.length - 4 === 1 ? 'outro' : 'outros') + '</span>';
                }

                html += '<div class="carbooking-cell' + (items.length ? ' has-items' : '')
                    + (isToday ? ' is-today' : '') + '" data-day="' + d + '">'
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

            grid.querySelectorAll('.carbooking-cell.has-items').forEach(function (cell) {
                cell.addEventListener('click', function () {
                    openDay(parseInt(cell.dataset.day, 10), byDay[cell.dataset.day] || []);
                });
            });
        }

        function openDay(day, items) {
            panelTitle.textContent = pad(day) + '/' + pad(cur.getMonth() + 1) + '/' + cur.getFullYear()
                + ' · ' + WEEK[new Date(cur.getFullYear(), cur.getMonth(), day).getDay()]
                + ' — ' + items.length + (items.length === 1 ? ' agendamento' : ' agendamentos');

            panelList.innerHTML = items.map(function (b) {
                var period = b.arrival
                    ? timeOf(b.departure) + ' → ' + timeOf(b.arrival)
                    : 'Saída ' + timeOf(b.departure);
                var del = canDelete
                    ? '<button class="carbooking-del" data-id="' + b.id + '"><i class="ti ti-trash"></i> Apagar</button>'
                    : '';
                var open = bform
                    ? '<a class="carbooking-open" href="' + bform + '?id=' + b.id + '"><i class="ti ti-external-link"></i> Abrir</a>'
                    : '';
                return '<div class="carbooking-day-item s-' + (b.status || 1) + '">'
                    + '<div class="carbooking-day-item__body">'
                    + '<div class="carbooking-day-item__top">'
                    + '<span class="carbooking-chip status-' + statusName(b.status) + '">' + esc(b.status_label) + '</span>'
                    + '<strong>' + esc(b.car) + '</strong></div>'
                    + '<div class="carbooking-day-item__meta"><i class="ti ti-user"></i> ' + esc(b.user)
                    + ' &nbsp;·&nbsp; <i class="ti ti-building"></i> ' + esc(b.sector) + '</div>'
                    + '<div class="carbooking-day-item__meta"><i class="ti ti-clock"></i> ' + esc(period)
                    + (b.destination ? ' &nbsp;·&nbsp; <i class="ti ti-map-pin"></i> ' + esc(b.destination) : '')
                    + '</div>'
                    + (b.reason ? '<div class="carbooking-day-item__reason"><i class="ti ti-note"></i> ' + esc(b.reason) + '</div>' : '')
                    + '</div>'
                    + '<div class="carbooking-day-item__actions">' + open + del + '</div>'
                    + '</div>';
            }).join('');

            if (canDelete) {
                panelList.querySelectorAll('.carbooking-del').forEach(function (btn) {
                    btn.addEventListener('click', function () { doDelete(btn.dataset.id); });
                });
            }

            panel.hidden = false;
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function statusName(s) {
            return s === 2 ? 'approved' : (s === 3 ? 'rejected' : 'pending');
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
        document.getElementById('carbooking-day-close').addEventListener('click', function () {
            panel.hidden = true;
        });

        load();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
