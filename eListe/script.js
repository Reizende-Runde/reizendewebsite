/* ===== Helpers ===== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const NULLS = ['Null', 'Null Hand', 'Null Hand Ouvert', 'Null Ouvert'];
const BASES = { Karo: 9, Herz: 10, Pik: 11, Kreuz: 12, Grand: 24 };
const initialState = () => ({ players: [], mode: 'esf', use4: false, rounds: [], editIdx: null });

function isNullGame(art) { return NULLS.includes(art); }
function currentGameNumber() { return (S.rounds?.length || 0) + 1; }
function dealerIdxForGame(gameNumber, n) { return (gameNumber - 1) % n; }
function sitterIdxForGame(gameNumber, n) { return n === 4 ? dealerIdxForGame(gameNumber, n) : null; }

/* Optionen-Kaskade */
function wireOptionCascade() {
    const inputs = $$('input[name="opt"]');
    const autoAllPrev = ["Schneider angesagt", "Schwarz angesagt", "Ouvert"];
    inputs.forEach((inp, i) => {
        inp.addEventListener('change', () => {
            if (inp.checked) {
                if (autoAllPrev.includes(inp.value)) {
                    for (let j = 0; j <= i; j++) inputs[j].checked = true;
                } else if (inp.value === "Schwarz") {
                    const idx = inputs.findIndex(x => x.value === "Schneider");
                    if (idx !== -1) inputs[idx].checked = true;
                }
            } else {
                for (let k = i + 1; k < inputs.length; k++) inputs[k].checked = false;
            }
            preview(); updateMeta();
        });
    });
}

/* Null sperrt Mit/Ohne/Faktor/Optionen */
function enforceNullLock() {
    const artRadios = $$('input[name="art"]');
    const mo = $$('input[name="mo"]');
    const f = $$('input[name="f"]');
    const fDrop = $('#fDrop');
    const opt = $$('input[name="opt"]');

    function setDisabled(isNull) {
        [...mo, ...f, ...opt].forEach(el => {
            el.checked = false; el.disabled = isNull;
            const lab = el.closest('label'); if (lab) lab.classList.toggle('disabled', isNull);
        });
        if (fDrop) {
            fDrop.disabled = isNull;
            if (isNull) { fDrop.value = ""; fDrop.closest('label').classList.add('disabled'); }
            else { fDrop.closest('label').classList.remove('disabled'); }
        }
    }
    artRadios.forEach(r => r.addEventListener('change', () => {
        setDisabled(isNullGame(r.value));
        preview(); updateMeta();
    }));
}

/* Dropdown Faktor -> Radio wählen */
function wireFactorDropdown() {
    const radio = document.querySelector('input[name="f"][value="dropdown"]');
    const sel = $('#fDrop');
    if (!sel) return;
    sel.addEventListener('change', () => { if (sel.value !== "") radio.checked = true; preview(); updateMeta(); });
}

/* Spielwert-Berechnung ohne Kontra/Re */
function computeGameValue(state) {
    const { art, res, mo, f, opts } = state;
    if (!art || !res) return { value: 0, base: 0, maxF: 0, summary: "" };
    const sign = res === 'Gewonnen' ? 1 : -2;

    if (isNullGame(art)) {
        const base = art === 'Null' ? 23 : art === 'Null Hand' ? 35 : art === 'Null Ouvert' ? 46 : 59;
        return { value: base * sign, base, maxF: sign, summary: buildSummary(state, base, sign) };
    }

    const base = BASES[art] || 0;
    let faktor = 0;
    if (f && f !== 'dropdown') faktor = parseInt(f, 10);
    if (f === 'dropdown') { const d = $('#fDrop').value; if (d) faktor = parseInt(d, 10); }
    const mult = (faktor || 0) + 1 + (opts ? opts.length : 0);
    const v = base * mult * sign;
    let maxF = mult * (sign === -2 ? -2 : 1);
    return { value: v, base, maxF, summary: buildSummary(state, base, maxF) };
}

function buildSummary(state, base, maxFshown) {
    const { art, mo, f, opts, res } = state;
    let parts = [];
    if (!isNullGame(art)) {
        let factor = 0;
        if (f && f !== 'dropdown') factor = parseInt(f, 10);
        if (f === 'dropdown') { const d = $('#fDrop').value; if (d) factor = parseInt(d, 10); }
        let baseStr = art;
        if (mo) baseStr += ` ${mo}`;
        baseStr += ` Spiel ${(factor || 0) + 1}`;
        if (opts?.length) { let cur = (factor || 0) + 1; opts.forEach(o => { cur += 1; parts.push(`${o} ${cur}`); }); }
        parts.unshift(baseStr.trim());
    } else {
        parts.push(art);
    }
    const tail = res === 'Gewonnen' ? ', Gewonnen.' : `, Verloren ${maxFshown}.`;
    return parts.join(', ') + `${tail}<br>${maxFshown} × ${base} (für ${art}) = ${base * maxFshown}`;
}

/* ESF-Verteilung */
function distributeESF(value, players, soloIdx, sitterIdx, res) {
    const n = players.length;
    const delta = Array(n).fill(0);

    if (res === 'Gewonnen') {
        delta[soloIdx] += value + 50;
        return delta;
    }
    delta[soloIdx] += value - 50;
    if (n === 3) {
        for (let i = 0; i < 3; i++) { if (i !== soloIdx) delta[i] += 40; }
    } else if (n === 4) {
        for (let i = 0; i < 4; i++) { if (i !== soloIdx && i !== sitterIdx) delta[i] += 30; }
        if (sitterIdx != null) delta[sitterIdx] += 30;
    }
    return delta;
}

/* ===== State ===== */
let S = initialState();

/* Setup */
$('#use4').addEventListener('change', e => {
    $('#p4wrap').style.display = e.target.checked ? '' : 'none';
});
$('#start').addEventListener('click', () => {
    const p1 = $('#p1').value?.trim() || 'Spielerin 1';
    const p2 = $('#p2').value?.trim() || 'Spielerin 2';
    const p3 = $('#p3').value?.trim() || 'Spielerin 3';
    const use4 = $('#use4').checked;
    const p4 = use4 ? ($('#p4').value?.trim() || 'Spielerin 4') : null;
    S.players = use4 ? [p1, p2, p3, p4] : [p1, p2, p3];
    S.mode = 'esf';
    S.use4 = use4;
    initRunning();
    save();
});

/* Init Laufbetrieb */
function initRunning() {
    $('#setup').style.display = 'none';
    $('#running').style.display = '';
    $('#metaBar').style.display = '';

    const soloSel = $('#solo'); soloSel.innerHTML = '';
    S.players.forEach((n, i) => soloSel.add(new Option(n, String(i))));

    wireOptionCascade();
    wireFactorDropdown();
    enforceNullLock();

    $$('input[name="res"]').forEach(r => r.addEventListener('change', () => { preview(); updateMeta(); }));
    $$('input[name="art"]').forEach(r => r.addEventListener('change', () => { preview(); updateMeta(); }));
    $$('input[name="mo"]').forEach(r => r.addEventListener('change', () => { preview(); updateMeta(); }));
    $$('input[name="f"]').forEach(r => r.addEventListener('change', () => { preview(); updateMeta(); }));

    $('#add').addEventListener('click', addGame);
    $('#pass').addEventListener('click', addPassed);
    $('#undo').addEventListener('click', undo);
    $('#export').addEventListener('click', exportCSV);
    $('#abort').addEventListener('click', abortList);

    // Edit-Buttons
    $('#saveEdit').addEventListener('click', saveEdit);
    $('#cancelEdit').addEventListener('click', cancelEdit);

    preview();
    renderTable();
    updateMeta();
}

/* Zustand lesen */
function readState() {
    const art = (document.querySelector('input[name="art"]:checked') || {}).value || '';
    const res = (document.querySelector('input[name="res"]:checked') || {}).value || '';
    const mo = (document.querySelector('input[name="mo"]:checked') || {}).value || '';
    const f = (document.querySelector('input[name="f"]:checked') || {}).value || '';
    const opts = $$('input[name="opt"]:checked').map(x => x.value);
    const soloIdx = parseInt($('#solo').value || '0', 10);
    const n = S.players.length;
    const g = currentGameNumber();
    const sitterIdx = sitterIdxForGame(g, n);
    return { art, res, mo, f, opts, soloIdx, sitterIdx };
}

/* Formular nach Eintrag leeren und reaktivieren */
function clearCurrentForm() {
    $$('input[name="art"]').forEach(e => e.checked = false);
    $$('input[name="res"]').forEach(e => e.checked = false);
    $$('input[name="mo"]').forEach(e => e.checked = false);
    $$('input[name="f"]').forEach(e => e.checked = false);
    const fDrop = $('#fDrop'); if (fDrop) fDrop.value = '';
    $$('input[name="opt"]').forEach(e => e.checked = false);

    // Reaktivieren nach Null-Spiel
    const toEnable = [
        ...$$('input[name="mo"]'),
        ...$$('input[name="f"]'),
        ...$$('input[name="opt"]')
    ];
    toEnable.forEach(el => {
        el.disabled = false;
        const lab = el.closest('label');
        if (lab) lab.classList.remove('disabled');
    });
    if (fDrop) {
        fDrop.disabled = false;
        const lab = fDrop.closest('label');
        if (lab) lab.classList.remove('disabled');
    }

    $('#valuePreview').className = 'badge';
    $('#valuePreview').textContent = 'Spielwert: 0';
    $('#summary').textContent = '';
}

/* Toasts */
let toastTimer = null;
function toast(msg, big = false) {
    $('#toastMsg').innerHTML = msg;
    const t = $('#toast');
    t.classList.toggle('big', !!big);
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = 'none'; t.classList.remove('big'); }, 1800);
}

/* Validierung Farb/Grand */
function validateTrumpGame(st) {
    if (isNullGame(st.art) || !st.art) return true;
    if (!st.mo) { alert('Bitte Mit/Ohne wählen.'); return false; }
    if (!st.f) { alert('Bitte Bubenanzahl wählen (Faktor ≥ 1).'); return false; }
    if (st.f === 'dropdown' && !$('#fDrop').value) { alert('Bitte Bubenanzahl im Dropdown wählen.'); return false; }
    return true;
}

/* Spiel eintragen */
function addGame(e) {
    e.preventDefault();
    const st = readState();
    if (!st.art || !st.res) { alert('Bitte Spielart und Ergebnis wählen.'); return; }
    if (!validateTrumpGame(st)) return;

    const calc = computeGameValue(st);
    const factorNum = (st.f === 'dropdown' ? parseInt($('#fDrop').value || '0', 10)
        : parseInt(st.f || '0', 10)) || 0;

    const n = S.players.length;
    const g = currentGameNumber();
    const sitterIdx = sitterIdxForGame(g, n);

    const delta = distributeESF(calc.value, S.players, st.soloIdx, sitterIdx, st.res);
    const prev = S.rounds.at(-1)?.totals || Array(n).fill(0);
    const totals = prev.slice();
    delta.forEach((d, i) => totals[i] += d);

    const wins = (S.rounds.at(-1)?.wins || Array(n).fill(0)).slice();
    const losses = (S.rounds.at(-1)?.losses || Array(n).fill(0)).slice();
    if (st.res === 'Gewonnen') wins[st.soloIdx] += 1; else losses[st.soloIdx] += 1;

    S.rounds.push({
        passed: false,
        state: { ...st, sitterIdx },
        value: calc.value,
        base: calc.base,
        mo: st.mo,
        factor: factorNum,
        opts: st.opts.slice(),
        delta,
        soloIdx: st.soloIdx,
        sitterIdx,
        totals, wins, losses,
        summary: calc.summary
    });
    save();
    renderTable();
    updateMeta();

    // großer Toast: Alleinspielerin + Delta
    const soloName = S.players[st.soloIdx];
    const deltaSolo = delta[st.soloIdx] || 0;
    const sign = deltaSolo > 0 ? '+' : '';
    toast(`<b>${soloName}</b><br>${sign}${deltaSolo}`, true);

    clearCurrentForm();
}

/* Eingepasst */
function addPassed(e) {
    e.preventDefault();
    const n = S.players.length;
    const g = currentGameNumber();
    const sitterIdx = sitterIdxForGame(g, n);
    const delta = Array(n).fill(0);
    const prev = S.rounds.at(-1)?.totals || Array(n).fill(0);
    const totals = prev.slice();
    const wins = (S.rounds.at(-1)?.wins || Array(n).fill(0)).slice();
    const losses = (S.rounds.at(-1)?.losses || Array(n).fill(0)).slice();

    S.rounds.push({
        passed: true,
        state: { art: '', res: '', mo: '', f: '', opts: [] },
        value: 0, base: 0, mo: '', factor: 0, opts: [],
        delta,
        soloIdx: parseInt($('#solo').value || '0', 10),
        sitterIdx,
        totals, wins, losses,
        summary: 'Eingepasst'
    });
    save();
    renderTable();
    updateMeta();
    toast('<b>Eingepasst</b>', true);
    clearCurrentForm();
}

/* Undo */
function undo() {
    if (!S.rounds.length) return;
    S.rounds.pop();
    save();
    renderTable();
    updateMeta();
    toast('Letztes Spiel entfernt.');
}

/* Liste abbrechen */
function abortList() {
    if (!confirm('Liste abbrechen und alles löschen?')) return;

    localStorage.removeItem('skat_list_state');
    S = initialState();

    $('#setup').style.display = '';
    $('#running').style.display = 'none';
    $('#metaBar').style.display = 'none';
    $('#listTable').innerHTML = '';

    $('#p1').value = '';
    $('#p2').value = '';
    $('#p3').value = '';
    $('#use4').checked = false;
    $('#p4wrap').style.display = 'none';
    $('#p4').value = '';

    $('#solo').innerHTML = '';
    clearCurrentForm();

    toast('Liste abgebrochen. Neue Spielerliste anlegen.');
}

/* Spieler-Stats (Header) */
function computePlayerStats() {
    const n = S.players.length;
    const stats = Array.from({ length: n }, () => ({ sum: 0, won: 0, lost: 0 }));
    if (!S.rounds.length) return stats;
    const last = S.rounds.at(-1);
    last.totals.forEach((v, i) => stats[i].sum = v);
    last.wins.forEach((v, i) => stats[i].won = v);
    last.losses.forEach((v, i) => stats[i].lost = v);
    return stats;
}

/* Tabellen-Render inkl. Klick zum Editieren */
function renderTable() {
    const tbl = $('#listTable');
    const stats = computePlayerStats();

    const playerHeads = S.players.map((p, i) => `
    <th>
      <div>${escapeHtml(p)}</div>
      <div class="th-sub"><span class="numB">${stats[i]?.sum || 0}</span></div>
      <div class="th-sub">gew.: ${stats[i]?.won || 0} &nbsp; verl.: ${stats[i]?.lost || 0}</div>
      <div class="th-sub">Platz ${i + 1}</div>
    </th>`).join('');

    const head = `<thead>
    <tr>
      <th class="vhead">#</th>
      <th class="vhead">Grundwert</th>
      <th class="vhead">mit&nbsp;Spitzen</th>
      <th class="vhead">ohne&nbsp;Spitzen</th>
      <th class="vhead">Hand</th>
      <th class="vhead">Schneider</th>
      <th class="vhead">-&nbsp;angesagt</th>
      <th class="vhead">Schwarz</th>
      <th class="vhead">-&nbsp;angesagt</th>
      <th class="vhead">Offen</th>
      <th colspan="2">Spielwert</th>
      ${playerHeads}
      <th class="vhead">Eingepasst</th>
    </tr>
    <tr>
      <th></th><th></th><th></th><th></th>
      <th></th><th></th><th></th><th></th><th></th><th></th>
      <th class="cell-center">+</th><th class="cell-center">−</th>
      ${S.players.map(() => '<th></th>').join('')}
      <th></th>
    </tr>
  </thead>`;

    const rows = S.rounds.map((r, i) => {
        const x = v => v ? '<span class="x">X</span>' : '';
        const plus = r.value > 0 ? r.value : (r.passed ? 'E' : '');
        const minus = r.value < 0 ? Math.abs(r.value) : '';
        const mit = (r.mo === 'Mit') ? (r.factor || '') : '';
        const ohne = (r.mo === 'Ohne') ? (r.factor || '') : '';
        const has = name => r.state?.opts?.includes(name) || r.opts?.includes(name);

        const playerCells = r.delta.map(v =>
            `<td class="cell-right" style="${v > 0 ? 'color:#0e6b34' : (v < 0 ? 'color:#7a1420' : '')}">${v > 0 ? '+' : ''}${v || ''}</td>`
        ).join('');

        const cls = [
            r.passed ? 'passed' : '',
            'clickable',
            (S.editIdx === i) ? 'editing' : ''
        ].filter(Boolean).join(' ');

        return `<tr class="${cls}" data-idx="${i}" onclick="onRowEdit(${i})" title="${escapeHtml((r.summary || '').replace(/<br>/g, ' | '))}">
      <td>${i + 1}</td>
      <td>${r.base || ''}</td>
      <td class="cell-right">${mit}</td>
      <td class="cell-right">${ohne}</td>
      <td class="cell-center">${x(has('Hand'))}</td>
      <td class="cell-center">${x(has('Schneider'))}</td>
      <td class="cell-center">${x(has('Schneider angesagt'))}</td>
      <td class="cell-center">${x(has('Schwarz'))}</td>
      <td class="cell-center">${x(has('Schwarz angesagt'))}</td>
      <td class="cell-center">${x(has('Ouvert'))}</td>
      <td class="cell-right">${plus}</td>
      <td class="cell-right">${minus}</td>
      ${playerCells}
      <td class="cell-center">${r.passed ? 'E' : ''}</td>
    </tr>`;
    }).join('');

    const totals = (S.rounds.at(-1)?.totals || Array(S.players.length).fill(0));
    const preCols = Array(9).fill('<td></td>').join('');
    const plusMinus = '<td></td><td></td>';
    const playerTotals = totals.map(v => `<td class="cell-right">${v > 0 ? '+' : ''}${v}</td>`).join('');

    const foot = `<tfoot>
    <tr>
      <td>Summe</td>
      ${preCols}
      ${plusMinus}
      ${playerTotals}
      <td></td>
    </tr>
  </tfoot>`;

    tbl.innerHTML = head + '<tbody>' + rows + '</tbody>' + foot;
}

/* Edit starten (Row-Klick) */
window.onRowEdit = function (i) {
    const r = S.rounds[i];
    S.editIdx = i;
    setControlsFromState(r);
    $('#add').style.display = 'none';
    $('#pass').style.display = 'none';
    $('#saveEdit').style.display = '';
    $('#cancelEdit').style.display = '';
    renderTable();
    toast(`Bearbeite Spiel ${i + 1}${r.passed ? ' (Eingepasst)' : ''}.`);
};

/* Formular aus Datensatz füllen */
function setControlsFromState(r) {
    $$('input[name="art"]').forEach(inpt => inpt.checked = inpt.value === (r.state.art || ''));
    $$('input[name="res"]').forEach(inpt => inpt.checked = inpt.value === (r.state.res || ''));
    $$('input[name="mo"]').forEach(inpt => inpt.checked = inpt.value === (r.state.mo || ''));
    const fRadio = $$('input[name="f"]');
    let fVal = r.state.f || '';
    if (!fVal && r.factor >= 1 && r.factor <= 4) fVal = String(r.factor);
    if (!fVal && r.factor >= 5) { fVal = 'dropdown'; }
    fRadio.forEach(inpt => inpt.checked = inpt.value === fVal);
    if ($('#fDrop')) $('#fDrop').value = r.factor >= 5 ? String(r.factor) : '';
    $('#solo').value = String(r.soloIdx ?? 0);
    preview();
}

/* Edit abbrechen */
function cancelEdit() {
    S.editIdx = null;
    $('#add').style.display = '';
    $('#pass').style.display = '';
    $('#saveEdit').style.display = 'none';
    $('#cancelEdit').style.display = 'none';
    preview();
    renderTable();
}

/* Änderung speichern */
function saveEdit(e) {
    e.preventDefault();
    if (S.editIdx == null) return;

    const st = readState();
    const makePassed = (!st.art && !st.res);

    let newRound;
    if (makePassed) {
        const n = S.players.length;
        newRound = {
            passed: true,
            state: { art: '', res: '', mo: '', f: '', opts: [] },
            value: 0, base: 0, mo: '', factor: 0, opts: [],
            delta: Array(n).fill(0),
            soloIdx: parseInt($('#solo').value || '0', 10),
            sitterIdx: sitterIdxForGame(S.editIdx + 1, n),
            totals: [], wins: [], losses: [],
            summary: 'Eingepasst'
        };
    } else {
        if (!st.art || !st.res) { alert('Bitte Spielart und Ergebnis wählen oder Eingepasst leer lassen.'); return; }
        if (!isNullGame(st.art) && !validateTrumpGame(st)) return;

        const calc = computeGameValue(st);
        const n = S.players.length;
        newRound = {
            passed: false, state: st,
            value: calc.value, base: calc.base, mo: st.mo, factor: parseInt(($('#fDrop')?.value || st.f || '0'), 10) || 0,
            opts: st.opts.slice(), delta: [],
            soloIdx: st.soloIdx, sitterIdx: sitterIdxForGame(S.editIdx + 1, n),
            totals: [], wins: [], losses: [],
            summary: calc.summary
        };
    }

    S.rounds[S.editIdx] = newRound;
    recalcAll();

    save();
    renderTable();
    updateMeta();
    toast(`Spiel ${S.editIdx + 1} aktualisiert.`);
    cancelEdit();
}

/* Alles neu berechnen */
function recalcAll() {
    const n = S.players.length;
    let totals = Array(n).fill(0);
    let wins = Array(n).fill(0);
    let losses = Array(n).fill(0);

    S.rounds.forEach((r, idx) => {
        let delta = Array(n).fill(0);
        const sitterIdx = sitterIdxForGame(idx + 1, n);
        if (!r.passed) {
            const st = r.state;
            const calc = computeGameValue(st);
            r.value = calc.value;
            r.base = calc.base;
            r.summary = calc.summary;
            delta = distributeESF(r.value, S.players, st.soloIdx, sitterIdx, st.res);
            if (st.res === 'Gewonnen') wins[st.soloIdx] += 1;
            else if (st.res === 'Verloren') losses[st.soloIdx] += 1;
        }
        r.sitterIdx = sitterIdx;
        r.delta = delta;
        totals = totals.map((v, i) => v + delta[i]);
        r.totals = totals.slice();
        r.wins = wins.slice();
        r.losses = losses.slice();
    });
}

/* CSV Export */
function exportCSV() {
    const sep = ';';
    let out = [
        ['#', 'Grundwert', 'mit Spitzen', 'ohne Spitzen', 'Hand', 'Schneider', '- angesagt', 'Schwarz', '- angesagt', 'Offen', 'Spielwert +', 'Spielwert -', ...S.players, 'Eingepasst'].join(sep)
    ];
    S.rounds.forEach((r, i) => {
        const plus = r.value > 0 ? r.value : (r.passed ? 'E' : '');
        const minus = r.value < 0 ? Math.abs(r.value) : '';
        const mit = (r.mo === 'Mit') ? (r.factor || '') : '';
        const ohne = (r.mo === 'Ohne') ? (r.factor || '') : '';
        const has = n => (r.state?.opts?.includes(n) || r.opts?.includes(n)) ? 'X' : '';
        out.push([
            i + 1, r.base || '', mit, ohne, has('Hand'), has('Schneider'), has('Schneider angesagt'),
            has('Schwarz'), has('Schwarz angesagt'), has('Ouvert'), plus, minus,
            ...r.delta, r.passed ? 'E' : ''
        ].join(sep));
    });
    const totals = (S.rounds.at(-1)?.totals || Array(S.players.length).fill(0));
    out.push(['Summe', '', '', '', '', '', '', '', '', '', '', '', ...totals, ''].join(sep));
    const blob = new Blob([out.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'skat_liste.csv'; a.click(); URL.revokeObjectURL(a.href);
}

/* Meta + Info-Kachel */
function updateMeta() {
    const game = currentGameNumber();
    const n = S.players.length || 3;
    const round = Math.ceil(game / n);
    const dIdx = dealerIdxForGame(game, n);
    const dealerName = S.players[dIdx] || '';

    $('#metaGame').textContent = String(game);
    $('#metaRound').textContent = String(round);
    $('#metaDealer').textContent = dealerName ? `${dealerName} (Platz ${dIdx + 1})` : '–';

    $('#infoGame').textContent = String(game);
    $('#infoRound').textContent = String(round);
    $('#infoDealer').textContent = dealerName ? `${dealerName}` : '–';

    // Mini-Scores
    const stats = computePlayerStats();
    const wrap = $('#miniScores');
    if (!stats.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = S.players.map((p, i) => {
        const s = stats[i] || { sum: 0, won: 0, lost: 0 };
        const v = s.sum || 0;
        const sign = v > 0 ? '+' : '';
        return `<div class="pill"><span>${escapeHtml(p)}</span><span>${sign}${v}</span></div>`;
    }).join('');
}

/* Persistence */
function save() { localStorage.setItem('skat_list_state', JSON.stringify(S)); }
(function restore() {
    const raw = localStorage.getItem('skat_list_state'); if (!raw) return;
    try {
        const s = JSON.parse(raw);
        if (!s.players?.length) return;
        S = { ...initialState(), ...s };
        $('#p1').value = S.players[0] || ''; $('#p2').value = S.players[1] || ''; $('#p3').value = S.players[2] || '';
        if (S.players.length === 4) { $('#use4').checked = true; $('#p4wrap').style.display = ''; $('#p4').value = S.players[3] || ''; }
        $('#mode').value = 'esf';
        initRunning();
    } catch (e) { }
})();

/* Utils */
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
