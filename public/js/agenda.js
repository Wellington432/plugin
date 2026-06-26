/* global window, document, fetch */

/**
 * Carbooking — lógica da página de agenda.
 * Carregado em todas as páginas do GLPI, mas só age quando o board existe.
 */
(function () {
    'use strict';

    /* Botão "Voltar" — funciona em qualquer página do plugin (delegação no
       documento, fora do init, pois este script carrega em todo o GLPI). */
    document.addEventListener('click', function (e) {
        var back = e.target.closest && e.target.closest('.carbooking-back');
        if (!back) { return; }
        if (back.hasAttribute('data-x')) { return; } // botão de fechar modal: tratado em outro handler
        e.preventDefault();
        // Vai direto para o destino do botão (link ou data-home); só usa o
        // histórico do navegador como último recurso.
        var dest = back.dataset.home || (back.tagName === 'A' ? back.getAttribute('href') : '');
        if (dest) {
            window.location.href = dest;
        } else if (window.history.length > 1) {
            window.history.back();
        }
    });

    /* Popup informativo (ex.: ver motivo do agendamento). */
    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-cb-info]');
        if (!btn) { return; }
        e.preventDefault();
        var title = btn.getAttribute('data-title') || 'Detalhes';
        var text = btn.getAttribute('data-text') || '';
        var overlay = document.createElement('div');
        overlay.className = 'carbooking-modal';
        var dlg = document.createElement('div');
        dlg.className = 'carbooking-modal__dialog';
        dlg.style.maxWidth = '460px';
        var head = document.createElement('div');
        head.className = 'carbooking-modal__head';
        var h = document.createElement('h3'); h.textContent = title;
        var x = document.createElement('button');
        x.type = 'button'; x.className = 'carbooking-modal__close'; x.innerHTML = '<i class="ti ti-x"></i>';
        head.appendChild(h); head.appendChild(x);
        var body = document.createElement('div');
        body.className = 'carbooking-modal__body';
        var p = document.createElement('p');
        p.style.whiteSpace = 'pre-wrap'; p.style.margin = '0'; p.textContent = text;
        body.appendChild(p);
        var bd = document.createElement('div'); bd.className = 'carbooking-modal__backdrop';
        dlg.appendChild(head); dlg.appendChild(body);
        overlay.appendChild(bd); overlay.appendChild(dlg);
        document.body.appendChild(overlay);
        document.body.classList.add('carbooking-modal-open');
        function close() { overlay.remove(); document.body.classList.remove('carbooking-modal-open'); }
        x.addEventListener('click', close);
        bd.addEventListener('click', close);
    });

    /* Mostra/esconde o nome do acompanhante conforme "Vai ter acompanhante?". */
    document.addEventListener('change', function (e) {
        var sel = e.target.closest && e.target.closest('.carbooking-companion-q');
        if (!sel) { return; }
        var wrap = document.getElementById(sel.getAttribute('data-target'));
        if (wrap) { wrap.hidden = (sel.value !== '1'); }
    });

    /* Aprovação: mostra os detalhes numa telinha e exige confirmação (checkbox)
       antes de aprovar de verdade. */
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || !form.getAttribute || !form.hasAttribute('data-cb-approve')) { return; }
        if (form.dataset.cbApproved === '1') { return; }
        e.preventDefault();

        function fmt(dt) {
            if (!dt) { return '—'; }
            var d = ('' + dt).replace('T', ' ');
            // YYYY-MM-DD HH:MM
            return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) + ' ' + d.slice(11, 16);
        }
        function esc2(s) {
            return ('' + (s || '')).replace(/[&<>"]/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
            });
        }
        var d = form.dataset;
        var conflict = d.conflict === '1';

        var rows = ''
            + row('ti-user', 'Solicitante', d.user)
            + row('ti-steering-wheel', 'Motorista', d.driver || '—')
            + (d.companion ? row('ti-users', 'Acompanhante', d.companion === '1' ? 'Sim' : d.companion) : '')
            + row('ti-car', 'Carro', d.car)
            + row('ti-logout', 'Saída', fmt(d.departure))
            + row('ti-login', 'Chegada', d.arrival ? fmt(d.arrival) : '—')
            + row('ti-map-pin', 'Destino', d.destination || '—')
            + row('ti-note', 'Motivo', d.reason || '—');

        function row(icon, label, val) {
            return '<div class="carbooking-rowdetail__line"><span class="lbl"><i class="ti ' + icon + '"></i> ' + label + '</span> <strong>' + esc2(val) + '</strong></div>';
        }

        var overlay = document.createElement('div');
        overlay.className = 'carbooking-modal';
        overlay.innerHTML =
            '<div class="carbooking-modal__backdrop" data-x></div>'
          + '<div class="carbooking-modal__dialog" style="max-width:480px;">'
          + '<div class="carbooking-modal__head"><h3><i class="ti ti-checkbox"></i> Aprovar agendamento</h3>'
          + '<button type="button" class="carbooking-modal__close" data-x><i class="ti ti-x"></i></button></div>'
          + '<div class="carbooking-modal__body">'
          + (conflict ? '<div class="carbooking-warnbox" style="margin-bottom:0.8rem;"><i class="ti ti-alert-triangle"></i> Atenção: este horário tem conflito com outro agendamento do mesmo carro.</div>' : '')
          + '<div class="carbooking-rowdetail" style="margin-bottom:0.9rem;">' + rows + '</div>'
          + '<label class="carbooking-check"><input type="checkbox" class="cb-approve-ok"> Confirmo que revisei os detalhes e desejo aprovar este agendamento.</label>'
          + '<div class="carbooking-confirm-actions">'
          + '<button type="button" class="carbooking-back" data-x>Cancelar</button>'
          + '<button type="button" class="carbooking-submit cb-approve-go" style="margin:0;background:#2f9e44;" disabled><i class="ti ti-check"></i> Confirmar aprovação</button>'
          + '</div></div></div>';
        document.body.appendChild(overlay);
        document.body.classList.add('carbooking-modal-open');

        function close() { overlay.remove(); document.body.classList.remove('carbooking-modal-open'); }
        overlay.querySelectorAll('[data-x]').forEach(function (el) { el.addEventListener('click', close); });

        var chk = overlay.querySelector('.cb-approve-ok');
        var go = overlay.querySelector('.cb-approve-go');
        chk.addEventListener('change', function () { go.disabled = !chk.checked; });
        go.addEventListener('click', function () {
            if (!chk.checked) { return; }
            form.dataset.cbApproved = '1';
            close();
            if (form.requestSubmit) { form.requestSubmit(); } else { form.submit(); }
        });
    });

    /* Confirmação estilizada para formulários (ex.: aprovar com conflito). */
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || !form.getAttribute || !form.getAttribute('data-cb-confirm')) { return; }
        if (form.dataset.cbConfirmed === '1') { return; }
        e.preventDefault();
        var msg = form.getAttribute('data-cb-confirm');
        var title = form.getAttribute('data-cb-confirm-title') || 'Confirmação';
        var overlay = document.createElement('div');
        overlay.className = 'carbooking-modal';
        overlay.innerHTML =
            '<div class="carbooking-modal__backdrop" data-x></div>'
          + '<div class="carbooking-modal__dialog" style="max-width:440px;">'
          + '<div class="carbooking-modal__head"><h3><i class="ti ti-alert-triangle" style="color:#f97316;"></i> ' + title + '</h3>'
          + '<button type="button" class="carbooking-modal__close" data-x><i class="ti ti-x"></i></button></div>'
          + '<div class="carbooking-modal__body">'
          + '<p>' + msg + '</p>'
          + '<div class="carbooking-confirm-actions">'
          + '<button type="button" class="carbooking-back" data-x>Cancelar</button>'
          + '<button type="button" class="carbooking-submit cb-yes" style="margin:0;background:#2f9e44;"><i class="ti ti-check"></i> Confirmar aprovação</button>'
          + '</div></div></div>';
        document.body.appendChild(overlay);
        document.body.classList.add('carbooking-modal-open');
        function close() { overlay.remove(); document.body.classList.remove('carbooking-modal-open'); }
        overlay.querySelectorAll('[data-x]').forEach(function (el) { el.addEventListener('click', close); });
        overlay.querySelector('.cb-yes').addEventListener('click', function () {
            form.dataset.cbConfirmed = '1';
            close();
            if (form.requestSubmit) { form.requestSubmit(); } else { form.submit(); }
        });
    });

    /* Linhas expansíveis (ex.: Retornos com observação). */
    document.addEventListener('click', function (e) {
        var row = e.target.closest && e.target.closest('tr[data-rowtoggle]');
        if (!row) { return; }
        if (e.target.closest('a, button')) { return; }
        var child = row.nextElementSibling;
        if (child && child.classList.contains('carbooking-arow-child')) {
            child.hidden = !child.hidden;
            row.classList.toggle('is-open', !child.hidden);
        }
    });

    /* Prévia da imagem ao cadastrar/editar carro. */
    document.addEventListener('change', function (e) {
        var inp = e.target;
        if (!inp.classList || !inp.classList.contains('carbooking-imgfile')) { return; }
        var f = inp.files && inp.files[0];
        var nameBox = document.querySelector('.carbooking-imgname');
        var preview = document.querySelector('.carbooking-photo-preview');
        if (nameBox) { nameBox.textContent = f ? f.name : ''; }
        if (f && preview && /^image\//.test(f.type)) {
            var url = URL.createObjectURL(f);
            preview.innerHTML = '';
            var img = document.createElement('img');
            img.alt = f.name;
            img.onload = function () { URL.revokeObjectURL(url); };
            img.src = url;
            preview.appendChild(img);
        }
    });

    /* Marcar chegada com anexo opcional (folha) + confirmação obrigatória. */
    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-cb-arrive]');
        if (!btn) { return; }
        e.preventDefault();
        var id = btn.getAttribute('data-id');
        var bform = btn.getAttribute('data-bform');
        var csrf = btn.getAttribute('data-csrf') || '';
        var overlay = document.createElement('div');
        overlay.className = 'carbooking-modal';
        overlay.innerHTML =
            '<div class="carbooking-modal__backdrop" data-x></div>'
          + '<div class="carbooking-modal__dialog" style="max-width:460px;">'
          + '<div class="carbooking-modal__head"><h3>Finalizar viagem</h3>'
          + '<button type="button" class="carbooking-modal__close" data-x><i class="ti ti-x"></i></button></div>'
          + '<div class="carbooking-modal__body">'
          + '<p>Confirme o retorno do carro. A data e a hora vêm preenchidas com o momento atual, mas você pode ajustar.</p>'
          + '<form method="post" action="' + bform + '" enctype="multipart/form-data">'
          + '<input type="hidden" name="id" value="' + id + '">'
          + '<input type="hidden" name="arrive" value="1">'
          + '<input type="hidden" name="_glpi_csrf_token" value="' + csrf + '">'
          + '<input type="hidden" name="_redirect_anchor" value="carbooking-arrived-section">'
          + '<label class="form-label"><b>Data e hora do retorno</b></label>'
          + '<div class="carbooking-datetime">'
          + '<input type="date" class="form-control cb-rdate">'
          + '<input type="time" class="form-control cb-rtime">'
          + '</div>'
          + '<input type="hidden" name="returned_at" class="cb-rwhen">'
          + '<label class="form-label" style="margin-top:0.7rem;"><b>Folha de agendamento</b> (opcional)</label>'
          + '<input type="file" name="arrival_sheet" class="form-control cb-file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.odt,.ods">'
          + '<div class="carbooking-filepreview" hidden></div>'
          + '<label class="form-label" style="margin-top:0.7rem;"><b>Observação</b> (opcional)</label>'
          + '<textarea name="arrival_obs" class="form-control" rows="2" placeholder="Se preenchida, vira a observação do carro."></textarea>'
          + '<label class="carbooking-check"><input type="checkbox" class="cb-confirm" name="confirm_ok" value="1"> Confirmo que as informações enviadas estão corretas.</label>'
          + '<button type="submit" class="carbooking-submit cb-go" style="margin-top:0.8rem;" disabled><i class="ti ti-flag-check"></i> Finalizar viagem</button>'
          + '</form></div></div>';
        document.body.appendChild(overlay);
        document.body.classList.add('carbooking-modal-open');
        wireFileConfirm(overlay, false);
        wireArrivalWhen(overlay);
        function close() { overlay.remove(); document.body.classList.remove('carbooking-modal-open'); }
        overlay.querySelectorAll('[data-x]').forEach(function (el) { el.addEventListener('click', close); });
    });

    /* Preenche data/hora da chegada com o momento atual e mantém sincronizado. */
    function wireArrivalWhen(overlay) {
        var d = overlay.querySelector('.cb-rdate');
        var t = overlay.querySelector('.cb-rtime');
        var hid = overlay.querySelector('.cb-rwhen');
        if (!d || !t || !hid) { return; }
        var now = new Date();
        function p(n) { return n < 10 ? '0' + n : '' + n; }
        d.value = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
        t.value = p(now.getHours()) + ':' + p(now.getMinutes());
        function sync() { hid.value = (d.value && t.value) ? (d.value + 'T' + t.value) : ''; }
        sync();
        d.addEventListener('change', sync);
        t.addEventListener('change', sync);
    }

    /* Adicionar folha pelo calendário: prévia do arquivo + confirmação obrigatória. */
    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-cb-attach]');
        if (!btn) { return; }
        e.preventDefault();
        var id = btn.getAttribute('data-id');
        var bform = btn.getAttribute('data-bform');
        var csrf = btn.getAttribute('data-csrf') || '';
        var overlay = document.createElement('div');
        overlay.className = 'carbooking-modal';
        overlay.innerHTML =
            '<div class="carbooking-modal__backdrop" data-x></div>'
          + '<div class="carbooking-modal__dialog" style="max-width:460px;">'
          + '<div class="carbooking-modal__head"><h3>Adicionar folha de agendamento</h3>'
          + '<button type="button" class="carbooking-modal__close" data-x><i class="ti ti-x"></i></button></div>'
          + '<div class="carbooking-modal__body">'
          + '<form method="post" action="' + bform + '" enctype="multipart/form-data">'
          + '<input type="hidden" name="id" value="' + id + '">'
          + '<input type="hidden" name="upload_sheet" value="1">'
          + '<input type="hidden" name="_glpi_csrf_token" value="' + csrf + '">'
          + '<label class="form-label"><b>Arquivo da folha</b></label>'
          + '<input type="file" name="arrival_sheet" class="form-control cb-file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.odt,.ods">'
          + '<div class="carbooking-filepreview" hidden></div>'
          + '<label class="carbooking-check"><input type="checkbox" class="cb-confirm" name="confirm_ok" value="1"> Confirmo que as informações enviadas estão corretas.</label>'
          + '<button type="submit" class="carbooking-submit cb-go" style="margin-top:0.8rem;" disabled><i class="ti ti-upload"></i> Enviar folha</button>'
          + '</form></div></div>';
        document.body.appendChild(overlay);
        document.body.classList.add('carbooking-modal-open');
        wireFileConfirm(overlay, true);
        function close() { overlay.remove(); document.body.classList.remove('carbooking-modal-open'); }
        overlay.querySelectorAll('[data-x]').forEach(function (el) { el.addEventListener('click', close); });
    });

    /* Liga prévia do arquivo + checkbox obrigatório ao botão de envio.
       requireFile = true exige também que um arquivo seja escolhido. */
    function wireFileConfirm(overlay, requireFile) {
        var file = overlay.querySelector('.cb-file');
        var prev = overlay.querySelector('.carbooking-filepreview');
        var chk = overlay.querySelector('.cb-confirm');
        var go = overlay.querySelector('.cb-go');
        function refresh() {
            var hasFile = file && file.files && file.files.length > 0;
            go.disabled = !(chk.checked && (!requireFile || hasFile));
        }
        function fmtSize(n) {
            if (n < 1024) { return n + ' B'; }
            if (n < 1048576) { return (n / 1024).toFixed(1) + ' KB'; }
            return (n / 1048576).toFixed(1) + ' MB';
        }
        if (file) {
            file.addEventListener('change', function () {
                prev.innerHTML = '';
                prev.hidden = true;
                if (file.files && file.files[0]) {
                    var f = file.files[0];
                    if (/^image\//.test(f.type)) {
                        var img = document.createElement('img');
                        img.alt = f.name;
                        img.onload = function () { URL.revokeObjectURL(img.src); };
                        img.src = URL.createObjectURL(f);
                        prev.appendChild(img);
                    }
                    var info = document.createElement('div');
                    info.className = 'carbooking-fileinfo';
                    info.innerHTML = '<i class="ti ti-file-description"></i> <b>' + (f.name || '—') + '</b>'
                        + '<br><span>' + (f.type || 'tipo desconhecido') + ' · ' + fmtSize(f.size || 0) + '</span>';
                    prev.appendChild(info);
                    prev.hidden = false;
                }
                refresh();
            });
        }
        if (chk) { chk.addEventListener('change', refresh); }
        refresh();
    }

    /* Filtros das tabelas da Análise (data, hora a partir de, status). */
    (function tableFilters() {
        function run() {
            document.querySelectorAll('.carbooking-tablefilter').forEach(function (box) {
                var fDate = box.querySelector('.cb-f-date');
                var fTime = box.querySelector('.cb-f-time');
                var fStatus = box.querySelector('.cb-f-status');
                var clear = box.querySelector('.cb-f-clear');
                var rows = box.querySelectorAll('table tbody tr');
                if (!rows.length) { return; }
                function apply() {
                    var d = fDate ? fDate.value : '';
                    var t = fTime ? fTime.value : '';
                    var s = fStatus ? fStatus.value : '';
                    rows.forEach(function (tr) {
                        var ok = (!d || tr.dataset.date === d)
                            && (!s || tr.dataset.status === s)
                            && (!t || (tr.dataset.time || '') >= t);
                        tr.style.display = ok ? '' : 'none';
                    });
                }
                if (fDate) { fDate.addEventListener('change', apply); }
                if (fTime) { fTime.addEventListener('change', apply); }
                if (fStatus) { fStatus.addEventListener('change', apply); }
                if (clear) {
                    clear.addEventListener('click', function () {
                        if (fDate) { fDate.value = ''; }
                        if (fTime) { fTime.value = ''; }
                        if (fStatus) { fStatus.value = ''; }
                        apply();
                    });
                }
            });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    }());

    /* Filtro do histórico (data, hora a partir de, status). */
    (function historyFilter() {
        function run() {
            var root = document.getElementById('carbooking-history');
            if (!root) { return; }
            var fDate = document.getElementById('cb-h-date');
            var fTime = document.getElementById('cb-h-time');
            var fStatus = document.getElementById('cb-h-status');
            var fCar = document.getElementById('cb-h-car');
            var clear = document.getElementById('cb-h-clear');
            var empty = document.getElementById('cb-h-empty');
            var rows = root.querySelectorAll('#cb-h-table tbody tr');
            if (!rows.length) { return; }

            function apply() {
                var d = fDate ? fDate.value : '';
                var t = fTime ? fTime.value : '';
                var s = fStatus ? fStatus.value : '';
                var car = fCar ? fCar.value : '';
                var shown = 0;
                rows.forEach(function (tr) {
                    var ok = (!d || tr.dataset.date === d)
                        && (!s || tr.dataset.status === s)
                        && (!t || (tr.dataset.time || '') >= t)
                        && (!car || tr.dataset.car === car);
                    tr.style.display = ok ? '' : 'none';
                    if (ok) { shown++; }
                });
                if (empty) { empty.hidden = shown !== 0; }
            }
            if (fDate) { fDate.addEventListener('change', apply); }
            if (fTime) { fTime.addEventListener('change', apply); }
            if (fStatus) { fStatus.addEventListener('change', apply); }
            if (fCar) { fCar.addEventListener('change', apply); }
            if (clear) {
                clear.addEventListener('click', function () {
                    if (fDate) { fDate.value = ''; }
                    if (fTime) { fTime.value = ''; }
                    if (fStatus) { fStatus.value = ''; }
                    if (fCar) { fCar.value = ''; }
                    apply();
                });
            }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    }());

    /* Cancelamento com motivo obrigatório (popup) — funciona em qualquer
       página do plugin, tanto para usuário comum quanto para o aprovador. */
    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-cb-cancel]');
        if (!btn) { return; }
        e.preventDefault();
        openCancelModal(btn.getAttribute('data-id'), btn.getAttribute('data-bform'), btn.getAttribute('data-csrf'));
    });

    function openCancelModal(id, bform, csrf) {
        var overlay = document.createElement('div');
        overlay.className = 'carbooking-modal';
        overlay.innerHTML =
            '<div class="carbooking-modal__backdrop" data-x></div>'
          + '<div class="carbooking-modal__dialog" role="dialog" aria-modal="true">'
          + '  <div class="carbooking-modal__head"><h3>Cancelar agendamento</h3>'
          + '    <button type="button" class="carbooking-modal__close" data-x aria-label="Fechar"><i class="ti ti-x"></i></button></div>'
          + '  <div class="carbooking-modal__body">'
          + '    <label class="form-label" for="cb-cancel-reason"><b>Por que está cancelando?</b> (obrigatório)</label>'
          + '    <textarea id="cb-cancel-reason" class="form-control" rows="3" placeholder="Ex.: a viagem foi desmarcada"></textarea>'
          + '    <p class="carbooking-cancel-err" hidden>Digite o motivo para continuar.</p>'
          + '    <button type="button" class="carbooking-submit carbooking-cancel-confirm"><i class="ti ti-ban"></i> Confirmar cancelamento</button>'
          + '  </div></div>';
        document.body.appendChild(overlay);
        document.body.classList.add('carbooking-modal-open');
        var ta = overlay.querySelector('#cb-cancel-reason');
        ta.focus();

        function close() {
            overlay.remove();
            document.body.classList.remove('carbooking-modal-open');
            document.removeEventListener('keydown', onKey);
        }
        function onKey(ev) { if (ev.key === 'Escape') { close(); } }
        document.addEventListener('keydown', onKey);
        overlay.querySelectorAll('[data-x]').forEach(function (el) { el.addEventListener('click', close); });

        overlay.querySelector('.carbooking-cancel-confirm').addEventListener('click', function () {
            var reason = ta.value.trim();
            if (!reason) { overlay.querySelector('.carbooking-cancel-err').hidden = false; ta.focus(); return; }
            var form = document.createElement('form');
            form.method = 'post';
            form.action = bform;
            form.innerHTML =
                '<input type="hidden" name="id" value="' + id + '">'
              + '<input type="hidden" name="cancel" value="1">'
              + '<input type="hidden" name="_glpi_csrf_token" value="' + (csrf || '') + '">';
            var r = document.createElement('input');
            r.type = 'hidden'; r.name = 'cancel_reason'; r.value = reason;
            form.appendChild(r);
            document.body.appendChild(form);
            form.submit();
        });
    }

    /* Notificação de pendentes para o aprovador — usa a URL exposta no HTML
       da página (atributo data-cb-pending-url), sem adivinhar caminho. */
    (function notifyPending() {
        function run() {
            var el = document.querySelector('[data-cb-pending-url]');
            if (!el) { return; }
            var url = el.getAttribute('data-cb-pending-url');
            try {
                fetch(url, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'same-origin'
                }).then(function (r) { return r.ok ? r.json() : null; })
                  .then(function (d) { if (d && d.count) { showToast(d.count, d.url); } })
                  .catch(function () {});
            } catch (e) {}
        }

        function showToast(count, url) {
            var t = document.createElement('div');
            t.className = 'carbooking-toast';
            var label = count === 1
                ? '1 agendamento pendente aguardando aprovação'
                : count + ' agendamentos pendentes aguardando aprovação';
            t.innerHTML = '<i class="ti ti-bell-ringing"></i>'
                + '<a href="' + url + '">' + label + '</a>'
                + '<button type="button" class="carbooking-toast__close" aria-label="Fechar"><i class="ti ti-x"></i></button>';
            document.body.appendChild(t);
            t.querySelector('.carbooking-toast__close').addEventListener('click', function () { t.remove(); });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    }());


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

    /* Auto-scroll para âncora após marcar chegada */
    (function scrollToAnchor() {
        function run() {
            if (window.location.hash === '#carbooking-arrived-section') {
                var el = document.getElementById('carbooking-arrived-section');
                if (el) {
                    setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
                }
            }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    }());
}());
