/* global window, document, fetch */

/**
 * Carbooking — lógica da página de agenda.
 * Carregado em todas as páginas do GLPI, mas só age quando o board existe.
 */
(function () {
    'use strict';

    /* Paleta automotiva curada (azul, verde, vermelho, roxo, âmbar, ciano). */
    var CAR_PALETTE = [212, 152, 8, 278, 33, 190];

    /* hsl -> hex (sem depender de CSS para colorir o SVG do carro) */
    function hslHex(h, s, l) {
        s /= 100; l /= 100;
        const k = function (n) { return (n + h / 30) % 12; };
        const a = s * Math.min(l, 1 - l);
        const f = function (n) {
            const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
            return Math.round(255 * c).toString(16).padStart(2, '0');
        };
        return '#' + f(0) + f(8) + f(4);
    }

    /* Ilustração vetorial do carro, colorida conforme o "hue". */
    function carSvg(hue, uid) {
        const body1 = hslHex(hue, 72, 58);
        const body2 = hslHex(hue, 78, 44);
        const dark  = hslHex(hue, 55, 30);
        const win1  = hslHex(205, 85, 90);
        const win2  = hslHex(208, 75, 72);
        return ''
            + '<svg viewBox="0 0 260 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carro">'
            + '<defs>'
            + '<linearGradient id="b' + uid + '" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0" stop-color="' + body1 + '"/><stop offset="1" stop-color="' + body2 + '"/>'
            + '</linearGradient>'
            + '<linearGradient id="g' + uid + '" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0" stop-color="' + win1 + '"/><stop offset="1" stop-color="' + win2 + '"/>'
            + '</linearGradient>'
            + '<radialGradient id="s' + uid + '" cx="0.5" cy="0.5" r="0.5">'
            + '<stop offset="0" stop-color="rgba(15,23,42,0.28)"/><stop offset="1" stop-color="rgba(15,23,42,0)"/>'
            + '</radialGradient></defs>'
            + '<ellipse cx="130" cy="120" rx="98" ry="12" fill="url(#s' + uid + ')"/>'
            + '<path d="M22 100 L22 84 Q24 74 40 72 L70 70 Q80 70 86 60 L98 45 Q101 41 110 41 '
            +   'L166 41 Q177 41 183 49 L195 67 Q198 71 207 71 L224 72 Q238 74 238 86 L238 100 Z" '
            +   'fill="url(#b' + uid + ')" stroke="' + dark + '" stroke-width="1.5"/>'
            + '<path d="M40 73 L70 71 Q80 71 86 61 L98 46 Q101 42 110 42 L150 42 L150 47 L112 47 '
            +   'Q104 47 101 51 L90 66 Q84 74 72 74 L42 76 Z" fill="rgba(255,255,255,0.22)"/>'
            + '<path d="M96 58 L106 47 L131 47 L131 58 Z" fill="url(#g' + uid + ')"/>'
            + '<path d="M137 47 L163 47 Q172 47 176 54 L179 58 L137 58 Z" fill="url(#g' + uid + ')"/>'
            + '<rect x="232" y="78" width="8" height="7" rx="2" fill="#fca5a5"/>'
            + '<path d="M22 86 q-3 1 -3 5 l0 4 q0 2 4 2 l4 0 0 -4 q0 -4 -5 -11 Z" fill="#fde68a"/>'
            + '<line x1="40" y1="100" x2="238" y2="100" stroke="' + dark + '" stroke-width="2" opacity="0.5"/>'
            + '<g><circle cx="74" cy="100" r="17" fill="#1f2937"/><circle cx="74" cy="100" r="9.5" fill="#e5e7eb"/>'
            +   '<circle cx="74" cy="100" r="3.5" fill="#9ca3af"/></g>'
            + '<g><circle cx="190" cy="100" r="17" fill="#1f2937"/><circle cx="190" cy="100" r="9.5" fill="#e5e7eb"/>'
            +   '<circle cx="190" cy="100" r="3.5" fill="#9ca3af"/></g>'
            + '</svg>';
    }

    function init() {
        const root = document.getElementById('carbooking-agenda');
        if (!root) { return; }

        const ajaxUrl = root.dataset.ajax;
        const bformUrl = root.dataset.bform;
        const isHelpdesk = root.dataset.helpdesk === '1';
        const cardsEl = document.getElementById('carbooking-cards');
        const dateInput = document.getElementById('carbooking-date');
        const formDate = document.getElementById('carbooking-form-date');
        const carSelect = document.getElementById('cb-car');
        const depInput = document.getElementById('cb-dep');
        const conflictBox = document.getElementById('carbooking-conflict');
        const boardTitle = document.getElementById('carbooking-board-title');

        let current = [];

        function escapeHtml(str) {
            return String(str == null ? '' : str)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function fmtTime(dt) {
            if (!dt) { return ''; }
            const parts = dt.split(' ');
            const d = parts[0] ? parts[0].split('-').reverse().join('/') : '';
            const t = parts[1] ? parts[1].substring(0, 5) : '';
            return (d + ' ' + t).trim();
        }

        function statusMeta(status) {
            if (status === 'approved') { return { cls: 'is-approved', label: 'Em uso', icon: 'ti-steering-wheel' }; }
            if (status === 'pending') { return { cls: 'is-pending', label: 'Pendente', icon: 'ti-clock' }; }
            return { cls: 'is-free', label: 'Livre', icon: 'ti-circle-check' };
        }

        function renderCar(car, index) {
            const meta = statusMeta(car.status);
            const hue = CAR_PALETTE[car.id % CAR_PALETTE.length];
            const visual = car.picture
                ? '<img src="' + escapeHtml(car.picture) + '" alt="' + escapeHtml(car.name) + '">'
                : carSvg(hue, 'c' + car.id);
            const stageClass = car.picture ? 'carbooking-card__stage has-photo' : 'carbooking-card__stage';
            const pulse = car.status === 'pending' ? '<span class="pulse"></span>' : '';

            let detail;
            if (!car.bookings || !car.bookings.length) {
                detail = '<p class="carbooking-card__free"><i class="ti ti-circle-check"></i>Disponível neste dia</p>';
            } else {
                detail = '<ul class="carbooking-uses">';
                car.bookings.forEach(function (b) {
                    const period = b.arrival ? fmtTime(b.departure) + ' → ' + fmtTime(b.arrival) : fmtTime(b.departure);
                    const inner = '<span class="mini-chip s-' + b.status + '">' + escapeHtml(b.status_label) + '</span>'
                        + '<div><div class="user">' + escapeHtml(b.user) + '</div>'
                        + '<div class="time">' + escapeHtml(period)
                        + (b.destination ? ' · ' + escapeHtml(b.destination) : '') + '</div></div>';
                    if (isHelpdesk || !bformUrl) {
                        // Funcionário (interface simplificada): só exibe, sem link.
                        detail += '<li>' + inner + '</li>';
                    } else {
                        detail += '<a class="carbooking-use" href="' + bformUrl + '?id=' + b.id + '">'
                            + inner + '<i class="ti ti-chevron-right carbooking-use__arrow"></i></a>';
                    }
                });
                detail += '</ul>';
            }

            return ''
                + '<article class="carbooking-card ' + meta.cls + '" style="--d:' + (index * 55) + 'ms">'
                + '  <div class="' + stageClass + '">'
                + '    <span class="carbooking-card__status">' + pulse + '<i class="ti ' + meta.icon + '"></i>' + meta.label + '</span>'
                + '    <div class="carbooking-card__car">' + visual + '</div>'
                + '  </div>'
                + '  <div class="carbooking-card__body">'
                + '    <div class="carbooking-card__head">'
                + '      <p class="carbooking-card__name">' + escapeHtml(car.name) + '</p>'
                + (car.model_year ? '<span class="carbooking-card__year">' + escapeHtml(car.model_year) + '</span>' : '')
                + '    </div>'
                + (car.plate ? '<span class="carbooking-card__plate">' + escapeHtml(car.plate) + '</span>' : '')
                + detail
                + '  </div>'
                + '</article>';
        }

        function render() {
            if (!current.length) {
                cardsEl.innerHTML = '<div class="carbooking-loading">Nenhum carro ativo cadastrado.</div>';
                return;
            }
            cardsEl.innerHTML = current.map(renderCar).join('');
            annotateSelect();
            checkConflict();
        }

        function annotateSelect() {
            if (!carSelect) { return; }
            const byId = {};
            current.forEach(function (c) { byId[c.id] = c; });
            Array.prototype.forEach.call(carSelect.options, function (opt) {
                if (!opt.value) { return; }
                const car = byId[parseInt(opt.value, 10)];
                const base = opt.textContent.replace(/\s+·\s+(Livre|Em uso|Pendente)$/, '');
                if (car && car.status !== 'free') {
                    opt.textContent = base + ' · ' + (car.status === 'approved' ? 'Em uso' : 'Pendente');
                } else {
                    opt.textContent = base;
                }
            });
        }

        function checkConflict() {
            if (!carSelect || !conflictBox) { return; }
            const id = parseInt(carSelect.value, 10);
            const car = current.find(function (c) { return c.id === id; });
            if (car && car.status !== 'free' && car.bookings.length) {
                const names = car.bookings.map(function (b) { return b.user; }).join(', ');
                conflictBox.querySelector('span').textContent =
                    'Este carro já tem agendamento neste dia (' + names + '). Você ainda pode solicitar — o administrador decide.';
                conflictBox.hidden = false;
            } else {
                conflictBox.hidden = true;
            }
        }

        function load(date) {
            cardsEl.innerHTML = '<div class="carbooking-loading"><span class="carbooking-spinner"></span>Carregando frota…</div>';
            fetch(ajaxUrl + '?date=' + encodeURIComponent(date), {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin'
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    current = data.cars || [];
                    render();
                    if (boardTitle) {
                        boardTitle.textContent = 'Carros em ' + date.split('-').reverse().join('/');
                    }
                })
                .catch(function () {
                    cardsEl.innerHTML = '<div class="carbooking-loading">Não foi possível carregar a frota. Recarregue a página.</div>';
                });
        }

        function changeDate(date) {
            if (dateInput) { dateInput.value = date; }
            if (formDate) { formDate.value = date; }
            if (depInput && depInput.value) {
                depInput.value = date + 'T' + depInput.value.substring(11);
            } else if (depInput) {
                depInput.value = date + 'T08:00';
            }
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('date', date);
                window.history.replaceState({}, '', url);
            } catch (e) { /* ignore */ }
            load(date);
        }

        if (dateInput) {
            dateInput.addEventListener('change', function () {
                if (dateInput.value) { changeDate(dateInput.value); }
            });
        }
        root.querySelectorAll('.carbooking-nav').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const step = parseInt(btn.dataset.step, 10) || 0;
                const base = (dateInput && dateInput.value) || root.dataset.date;
                const d = new Date(base + 'T00:00:00');
                d.setDate(d.getDate() + step);
                changeDate(d.toISOString().substring(0, 10));
            });
        });
        const todayBtn = root.querySelector('.carbooking-today');
        if (todayBtn) {
            todayBtn.addEventListener('click', function () {
                changeDate(new Date().toISOString().substring(0, 10));
            });
        }
        if (carSelect) { carSelect.addEventListener('change', checkConflict); }

        load(root.dataset.date);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
