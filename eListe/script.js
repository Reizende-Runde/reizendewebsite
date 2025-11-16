/* ===== Helpers ===== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const NULLS = ['Null', 'Null Hand', 'Null Hand Ouvert', 'Null Ouvert'];
const BASES = { Karo: 9, Herz: 10, Pik: 11, Kreuz: 12, Grand: 24 };
const initialState = () => ({
    players: [],
    mode: 'esf',
    use4: false,
    rounds: [],
    editIdx: null,
    closed: false,
    showESF: false          // neu: ESF-Anzeige an/aus
});



function isNullGame(art) { return NULLS.includes(art); }
function currentGameNumber() { return (S.rounds?.length || 0) + 1; }
function dealerIdxForGame(gameNumber, n) { return (gameNumber - 1) % n; }
function sitterIdxForGame(gameNumber, n) { return n === 4 ? dealerIdxForGame(gameNumber, n) : null; }
function getPlayerCount() {
    const active = document.querySelector('.toggle-pill.active');
    const count = active?.dataset.count || '3';
    return parseInt(count, 10);
}

function applyPlayerCountUI(count) {
    const use4 = count === 4;
    const p4wrap = $('#p4wrap');
    if (p4wrap) p4wrap.style.display = use4 ? '' : 'none';

    const pills = $$('.toggle-pill');
    pills.forEach(p => {
        const c = parseInt(p.dataset.count, 10);
        p.classList.toggle('active', c === count);
    });
}

function getSelectedSoloIdx() {
    const checked = document.querySelector('input[name="solo"]:checked');
    return checked ? parseInt(checked.value, 10) : null;
}

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
function computeGameValueForResult(baseState, res) {
    const { art, mo, f, opts } = baseState;
    if (!art) return { value: 0, base: 0, maxF: 0 };

    const sign = res === 'Gewonnen' ? 1 : -2;

    if (isNullGame(art)) {
        const base =
            art === 'Null' ? 23 :
            art === 'Null Hand' ? 35 :
            art === 'Null Ouvert' ? 46 : 59;
        return { value: base * sign, base, maxF: sign };
    }

    const base = BASES[art] || 0;
    let faktor = 0;
    if (f && f !== 'dropdown') faktor = parseInt(f, 10) || 0;
    if (f === 'dropdown') {
        const d = $('#fDrop')?.value;
        if (d) faktor = parseInt(d, 10) || 0;
    }

    const mult = (faktor || 0) + 1 + (opts ? opts.length : 0);
    const v = base * mult * sign;
    const maxF = mult * (sign === -2 ? -2 : 1);

    return { value: v, base, maxF };
}

/* Bei 4-Spieler-Liste: Geber kann nicht Alleinspielerin sein */
/* Bei 4-Spieler-Liste: Geber kann nicht Alleinspielerin sein */
function enforceSoloNotDealer() {
    const radios = $$('input[name="solo"]');
    const n = S.players.length;
    if (!radios.length || !n) return;

    // Bei 3 Spieler:innen keine Einschränkung
    if (n !== 4) {
        radios.forEach(r => {
            r.disabled = false;
            const lab = r.closest('label');
            if (lab) lab.classList.remove('disabled');
        });
        return;
    }

    const game = currentGameNumber();
    const dealerIdx = dealerIdxForGame(game, n);

    radios.forEach((r, idx) => {
        const isDealer = (idx === dealerIdx);
        r.disabled = isDealer;
        const lab = r.closest('label');
        if (lab) lab.classList.toggle('disabled', isDealer);
    });

    // Falls aktuell der Geber ausgewählt war → auf nächste Spielerin springen
    const checked = document.querySelector('input[name="solo"]:checked');
    if (checked && parseInt(checked.value, 10) === dealerIdx) {
        const nextIdx = (dealerIdx + 1) % n;
        const nextRadio = document.querySelector(`input[name="solo"][value="${nextIdx}"]`);
        if (nextRadio && !nextRadio.disabled) nextRadio.checked = true;
    }
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
/* Basis-Verteilung:
   In den Runden / in der Liste wird nur noch der "nackte" Spielwert
   (inkl. -2 bei Verlust) verbucht – ausschließlich auf die Alleinspielerin.
   ESF-Zuschläge (+50/-50, Gegnerspiel 40/30) kommen nur in der Abschluss-Statistik dazu. */
function distributeESF(value, players, soloIdx, sitterIdx, res) {
    const n = players.length;
    const delta = Array(n).fill(0);

    if (soloIdx != null) {
        delta[soloIdx] += value;
    }

    return delta;
}
function renderSoloTiles() {
    const wrap = $('#soloTiles');
    if (!wrap) return;
    if (!S.players || !S.players.length) {
        wrap.innerHTML = '';
        return;
    }

    wrap.innerHTML = S.players.map((name, idx) => `
        <label class="solo-tile-label">
            <input type="radio" name="solo" value="${idx}">
            <div class="solo-tile">${escapeHtml(name)}</div>
        </label>
    `).join('');
}


/* ===== State ===== */
let S = initialState();

$('#start').addEventListener('click', () => {
    const p1 = $('#p1').value?.trim() || 'Spielerin 1';
    const p2 = $('#p2').value?.trim() || 'Spielerin 2';
    const p3 = $('#p3').value?.trim() || 'Spielerin 3';

    const count = getPlayerCount();
    const use4 = count === 4;
    const p4 = use4 ? ($('#p4').value?.trim() || 'Spielerin 4') : null;

    S.players = use4 ? [p1, p2, p3, p4] : [p1, p2, p3];
    S.mode = 'esf';
    S.use4 = use4;

    initRunning();
    save();
});



/* Zustand lesen */
function readState() {
    const art = (document.querySelector('input[name="art"]:checked') || {}).value || '';
    const res = (document.querySelector('input[name="res"]:checked') || {}).value || '';
    const mo = (document.querySelector('input[name="mo"]:checked') || {}).value || '';
    const f = (document.querySelector('input[name="f"]:checked') || {}).value || '';
    const opts = $$('input[name="opt"]:checked').map(x => x.value);
    const soloIdx = getSelectedSoloIdx();
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

    const fDrop = $('#fDrop');
    if (fDrop) fDrop.value = '';

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

    const vp = $('#valuePreview');
    if (vp) {
        vp.className = 'badge';
        vp.textContent = 'Spielwert: 0';
    }

    const summaryEl = $('#summary');
    if (summaryEl) {
        summaryEl.textContent = '';
    }

    // Ergebnis-Preview-Tiles leeren + Auswahlfarben zurücksetzen
    const winSpan = $('#resWinValue');
    const loseSpan = $('#resLoseValue');
    if (winSpan) winSpan.textContent = '';
    if (loseSpan) loseSpan.textContent = '';

    const winTile = document.querySelector('.result-tile-win');
    const loseTile = document.querySelector('.result-tile-lose');
    if (winTile) winTile.classList.remove('selected');
    if (loseTile) loseTile.classList.remove('selected');
}


function isValidForPreview(st) {
    if (!S.players.length) return false;

    // Solo muss gewählt sein
// Solo muss gewählt sein
    const soloIdx = getSelectedSoloIdx();
    if (soloIdx == null) return false;


    // Spielart muss gewählt sein
    if (!st.art) return false;

    // Null-Spiele: sonst nichts nötig
    if (isNullGame(st.art)) return true;

    // Farb-/Grand: Mit/Ohne + Buben müssen gültig sein
    if (!st.mo) return false;
    if (!st.f) return false;
    if (st.f === 'dropdown') {
        const d = $('#fDrop')?.value;
        if (!d) return false;
    }
    return true;
}
function preview() {
    const st = readState();

    const winSpan = $('#resWinValue');
    const loseSpan = $('#resLoseValue');
    const vp = $('#valuePreview');
    const summaryEl = $('#summary');

    // Farbliches Markieren der ausgewählten Ergebnis-Tiles
    const winInput = document.querySelector('input[name="res"][value="Gewonnen"]');
    const loseInput = document.querySelector('input[name="res"][value="Verloren"]');
    const winTile = document.querySelector('.result-tile-win');
    const loseTile = document.querySelector('.result-tile-lose');

    if (winTile && winInput) {
        winTile.classList.toggle('selected', winInput.checked);
    }
    if (loseTile && loseInput) {
        loseTile.classList.toggle('selected', loseInput.checked);
    }

    // Wenn Auswahl noch nicht valide → alles leer lassen
    if (!isValidForPreview(st)) {
        if (winSpan) winSpan.textContent = '';
        if (loseSpan) loseSpan.textContent = '';

        if (vp) {
            vp.className = 'badge';
            vp.textContent = 'Spielwert: 0';
        }
        if (summaryEl) {
            summaryEl.innerHTML = '';
        }
        return;
    }

    // Ab hier: valide Auswahl -> Werte berechnen
    const baseState = { ...st, res: '' };
    const winCalc = computeGameValueForResult(baseState, 'Gewonnen');
    const loseCalc = computeGameValueForResult(baseState, 'Verloren');

    if (winSpan) {
        const v = winCalc.value || 0;
        const sign = v > 0 ? '+' : (v < 0 ? '-' : '');
        winSpan.textContent = sign ? `${sign}${Math.abs(v)}` : `${v}`;
    }

    if (loseSpan) {
        const v = loseCalc.value || 0;
        // Verlustwerte sind in der Regel negativ
        const sign = v > 0 ? '+' : (v < 0 ? '-' : '');
        loseSpan.textContent = sign ? `${sign}${Math.abs(v)}` : `${v}`;
    }

    // Badge + Summary für den tatsächlich gewählten Status (falls Ergebnis schon gewählt)
    const calcActual = computeGameValue(st);
    if (vp) {
        let cls = 'badge';
        if (calcActual.value > 0) cls += ' ok';
        else if (calcActual.value < 0) cls += ' bad';
        vp.className = cls;
        vp.textContent = `Spielwert: ${calcActual.value || 0}`;
    }

    if (summaryEl) {
        summaryEl.innerHTML = calcActual.summary || '';
    }
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

/* Spiel mit gegebenem State eintragen (ohne UI-Ereignis) */
function addGameWithState(st) {
    const calc = computeGameValue(st);
    const factorNum = (st.f === 'dropdown'
        ? parseInt($('#fDrop').value || '0', 10)
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

/* Fallback: generischer Eintrag (falls noch irgendwo benutzt) */
function addGame(e) {
    if (e) e.preventDefault();
    const st = readState();
    if (!st.art || !st.res) { alert('Bitte Spielart und Ergebnis wählen.'); return; }
    if (!validateTrumpGame(st)) return;
    addGameWithState(st);
}

/* Direkt-Eintrag bei Klick auf Gewonnen/Verloren */
function onResultSelected(e) {
    const val = e.target.value;
    if (!val) return;

    // Wenn wir im Edit-Modus sind: nur Vorschau aktualisieren
    if (S.editIdx != null) {
        preview();
        updateMeta();
        return;
    }

    const st = readState();

    if (!st.art) {
        alert('Bitte zuerst die Spielart wählen.');
        e.target.checked = false;
        return;
    }

    if (!isNullGame(st.art) && !validateTrumpGame(st)) {
        e.target.checked = false;
        return;
    }

    st.res = val;
    addGameWithState(st);
}

/* Eingepasst */
function addPassed(e) {
    e.preventDefault();

    // Im Edit-Modus kein automatisches Eingepasst über den Button
    if (S.editIdx != null) return;

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
        soloIdx: (getSelectedSoloIdx() ?? 0),
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
/* Liste abbrechen / beenden */
/* Liste abbrechen / beenden – immer mit Bestätigung */
function abortList(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!confirm('Liste abbrechen und alles löschen?')) {
        return;
    }

    localStorage.removeItem('skat_list_state');
    S = initialState();

    $('#setup').style.display = '';
    $('#running').style.display = 'none';
    $('#metaBar').style.display = 'none';
    $('#listTable').innerHTML = '';

    $('#p1').value = '';
    $('#p2').value = '';
    $('#p3').value = '';
    $('#p4').value = '';

    const soloTiles = $('#soloTiles');
    if (soloTiles) soloTiles.innerHTML = '';

    const statsWrap = $('#statsWrap');

    if (statsWrap) {
        statsWrap.style.display = 'none';
        const statsTableWrap = $('#statsTableWrap');
        if (statsTableWrap) statsTableWrap.innerHTML = '';
    }

    clearCurrentForm();

    // Spieleranzeige und Layout zurücksetzen
    const mini = $('#miniScores');
    if (mini) mini.innerHTML = '';

    // UI-Zustand an den neuen State (leere Spieler) anpassen
    applyClosedUI();
    updateMeta();
    applyPlayerCountUI(3);

    toast('Liste beendet. Neue Spielerliste anlegen.');
}


function reopenList() {
    S.closed = false;
    save();
    applyClosedUI();
    toast('Liste wieder geöffnet. Du kannst die Liste bearbeiten oder fortführen.');
}


function finishList() {
    if (!S.rounds.length) {
        alert('Es wurden noch keine Spiele eingetragen.');
        return;
    }
    if (!confirm('Liste wirklich abschließen? Danach sind keine Änderungen mehr möglich.')) {
        return;
    }

    S.closed = true;
    S.editIdx = null;
    save();

    // Oberfläche auf "nur Tabelle + Stats" umschalten
    renderTable();
    renderStats();
    applyClosedUI();

    toast('Liste abgeschlossen.');
}


/* Spieler-Stats (Header) */
/* Spieler-Stats (Header / Mini-Scores) */
function computePlayerStats() {
    const n = S.players.length;
    const stats = Array.from({ length: n }, () => ({
        baseSum: 0,   // Punkte ohne ESF-Zuschläge (so wie in der Liste summiert)
        esfSum: 0,    // Punkte mit ESF-Zuschlägen
        won: 0,
        lost: 0
    }));
    if (!S.rounds.length || !n) return stats;

    const last      = S.rounds.at(-1);
    const baseTotals = (last.totals || Array(n).fill(0)).slice();
    const wins       = (last.wins   || Array(n).fill(0)).slice();
    const losses     = (last.losses || Array(n).fill(0)).slice();

    const oppLossPts = (n === 3) ? 40 : 30;

    // Gegnerspiele verloren = Anzahl Runden mit "Verloren", an denen Spieler nicht Solo war
    const oppLostCount = Array(n).fill(0);
    S.rounds.forEach(r => {
        if (r.passed) return;
        if (r.state?.res === 'Verloren' && r.soloIdx != null) {
            for (let i = 0; i < n; i++) {
                if (i !== r.soloIdx) oppLostCount[i] += 1;
            }
        }
    });

    const plus50 = wins.map((w, i) => (w - losses[i]) * 50);
    const oppPts = oppLostCount.map(c => c * oppLossPts);
    const esfTotals = baseTotals.map((v, i) => v + plus50[i] + oppPts[i]);

    for (let i = 0; i < n; i++) {
        stats[i].baseSum = baseTotals[i] || 0;
        stats[i].esfSum  = esfTotals[i] || 0;
        stats[i].won     = wins[i]      || 0;
        stats[i].lost    = losses[i]    || 0;
    }
    return stats;
}


/* Tabellen-Render inkl. Klick zum Editieren */
/* Tabellen-Render inkl. Klick zum Editieren */
function renderTable() {
    const tbl = $('#listTable');
    const stats = computePlayerStats(); // ggf. später noch nützlich

    const playerHeads = S.players.map(p => `
        <th>
          <div>${escapeHtml(p)}</div>
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
    const preCols = Array(9).fill('<td></td>').join(''); // Grundwert + 8 Optionsspalten
    const plusMinus = '<td></td><td></td>';
    const playerTotals = totals.map(v => `<td class="cell-right">${v > 0 ? '+' : ''}${v}</td>`).join('');

    // Basis-Summenzeile (immer sichtbar)
    let footRows = `
    <tr>
      <td>Spielergebnis (ohne ESF-Zuschläge)</td>
      ${preCols}
      ${plusMinus}
      ${playerTotals}
      <td></td>
    </tr>`;

    // Erweiterte Statistik, sobald es mindestens eine Runde gibt
    if (S.rounds.length) {
        const n = S.players.length;
        const last = S.rounds.at(-1);
        const wins   = (last.wins   || Array(n).fill(0)).slice();
        const losses = (last.losses || Array(n).fill(0)).slice();

        const oppLossPts = (n === 3) ? 40 : 30;

        const oppLostCount = Array(n).fill(0);
        const oppWonCount  = Array(n).fill(0);
        const passes       = Array(n).fill(0);

        S.rounds.forEach(r => {
            if (r.passed) {
                if (r.soloIdx != null) passes[r.soloIdx] += 1;
                return;
            }
            if (r.state?.res === 'Verloren' && r.soloIdx != null) {
                // verlorene Gegenspiele (alle NICHT-Solo)
                for (let i = 0; i < n; i++) {
                    if (i !== r.soloIdx) oppLostCount[i] += 1;
                }
            }
            if (r.state?.res === 'Gewonnen' && r.soloIdx != null) {
                // gewonnene Gegenspiele (alle NICHT-Solo)
                for (let i = 0; i < n; i++) {
                    if (i !== r.soloIdx) oppWonCount[i] += 1;
                }
            }
        });

        const plus50 = wins.map((w, i) => (w - losses[i]) * 50);
        const oppPts = oppLostCount.map(c => c * oppLossPts);
        const finalTotals = totals.map((v, i) => v + plus50[i] + oppPts[i]);

        const emptyMetrics = `<td colspan="11"></td>`; // 9 Optionsspalten + 2 Spielwertspalten

        const rowCounts = (label, arr, extraClass = '') =>
            `<tr class="${extraClass}">
                <td>${label}</td>
                ${emptyMetrics}
                ${arr.map(v => `<td class="cell-right">${v}</td>`).join('')}
                <td></td>
            </tr>`;

        const rowPoints = (label, arr, bold = false, extraClass = '') =>
            `<tr class="${extraClass}">
                <td>${bold ? '<b>' + label + '</b>' : label}</td>
                ${emptyMetrics}
                ${arr.map(v => {
                    const sign = v > 0 ? '+' : (v < 0 ? '-' : '');
                    const num = v === 0 ? '0' : sign + Math.abs(v);
                    return `<td class="cell-right">${bold ? '<b>' + num + '</b>' : num}</td>`;
                }).join('')}
                <td></td>
            </tr>`;

        // erste Stats-Zeile mit Separator-Klasse für den Border
        footRows +=
            rowCounts('Gewonnene Spiele', wins, 'stats-separator') +
            rowCounts('Verlorene Spiele', losses) +
            rowCounts('Eingepasste Spiele', passes) +
            rowCounts('Gewonnene Gegnerspiele', oppWonCount) +
            rowPoints('+ (gewonnene − verlorene) Spiele × 50', plus50) +
            rowPoints(`+ verlorene Gegnerspiele × ${oppLossPts}`, oppPts) +
            rowPoints('Gesamtpunkte (mit ESF-Zuschlägen)', finalTotals, true);
    }

    const foot = `<tfoot>${footRows}</tfoot>`;

    tbl.innerHTML = head + '<tbody>' + rows + '</tbody>' + foot;
}
function renderStats() {}



/* Edit starten (Row-Klick) */
/* Edit starten (Row-Klick) */
window.onRowEdit = function (i) {
    // Wenn Liste abgeschlossen ist, keine Bearbeitung mehr zulassen
    if (S.closed) return;

    const r = S.rounds[i];
    S.editIdx = i;
    setControlsFromState(r);
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
const soloRadio = document.querySelector(`input[name="solo"][value="${r.soloIdx ?? 0}"]`);
if (soloRadio && !soloRadio.disabled) {
    soloRadio.checked = true;
}

    preview();
}

/* Edit abbrechen */
function cancelEdit() {
    S.editIdx = null;
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
/* Meta + Spieler-Kachel */
/* Meta + Spieler-Kachel */
function updateMeta() {
    const n = S.players.length;
    const wrap = $('#miniScores');

    // Keine Spieler → keine Meta-Infos anzeigen
    if (!n) {
        const mg = $('#metaGame');
        const mr = $('#metaRound');
        if (mg) mg.textContent = '';
        if (mr) mr.textContent = '';
        if (wrap) wrap.innerHTML = '';
        return;
    }

    // Spiel- und Rundenzahl:
    // - während die Liste läuft: nächstes Spiel (currentGameNumber)
    // - wenn die Liste abgeschlossen ist: letztes gespieltes Spiel
    let game;
    if (S.closed && S.rounds.length) {
        game = S.rounds.length;          // letztes eingetragenes Spiel
    } else {
        game = currentGameNumber();      // nächstes Spiel
    }
    const round = Math.ceil(game / n);
    const dealerIdx = dealerIdxForGame(game, n);

    const mg = $('#metaGame');
    const mr = $('#metaRound');
    if (mg) mg.textContent = String(game);
    if (mr) mr.textContent = String(round);

    // Spieler-Stats für Mini-Scores
    const stats = computePlayerStats();
    if (!stats.length || !wrap) return;

    const useESF = !!S.showESF;

    wrap.innerHTML = S.players.map((p, i) => {
        const s = stats[i] || { baseSum: 0, esfSum: 0 };
        const v = useESF ? s.esfSum : s.baseSum;
        const sign = v > 0 ? '+' : '';
        const dealerClass = (i === dealerIdx) ? ' dealer' : '';
        return `
            <div class="pill${dealerClass}">
                <span class="pill-name">${escapeHtml(p)}</span>
                <span class="pill-points">${sign}${v}</span>
            </div>
        `;
    }).join('');

    enforceSoloNotDealer();
}




function applyClosedUI() {
    const hasPlayers = !!(S.players && S.players.length);
    const isClosed = hasPlayers && !!S.closed;

    // Setup-Block:
    // - sichtbar, wenn keine Spieler vorhanden
    // - ausgeblendet, sobald eine Liste läuft/gelaufen ist
    const setup = $('#setup');
    if (setup) setup.style.display = hasPlayers ? 'none' : '';

    // Meta-Bar:
    // - nur anzeigen, wenn es überhaupt eine (aktive oder abgeschlossene) Liste gibt
    const metaBar = $('#metaBar');
    if (metaBar) metaBar.style.display = hasPlayers ? '' : 'none';

    // Spieler-Info-Karte:
    // - ebenfalls nur, wenn eine Liste existiert
    const cardInfo = $('#cardInfo');
    if (cardInfo) cardInfo.style.display = hasPlayers ? '' : 'none';

    // Oberer Grid-Bereich (Spielauswahl + Ergebnis/Aktionen):
    // - nur sichtbar, wenn Liste aktiv ist (nicht geschlossen)
    const gridUpper = $('.grid-upper');
    if (gridUpper) gridUpper.style.display = (hasPlayers && !isClosed) ? '' : 'none';

    // Stats-Bereich:
    // - nur im abgeschlossenen Zustand sichtbar
    const statsWrap = $('#statsWrap');
    if (statsWrap) statsWrap.style.display = (hasPlayers && isClosed) ? '' : 'none';

    // Final-Action-Buttons:
    // - ebenfalls nur im abgeschlossenen Zustand
    const finalActions = $('#finalActions');
    if (finalActions) finalActions.style.display = (hasPlayers && isClosed) ? '' : 'none';
}



function onEsfToggleClick() {
    S.showESF = !S.showESF;

    const esfToggle = $('#esfToggle');
    if (esfToggle) {
        esfToggle.classList.toggle('active', S.showESF);
    }

    save();
    updateMeta();
}



/* Init Laufbetrieb */
// außerhalb von initRunning definieren:
function onEsfToggleClick() {
    S.showESF = !S.showESF;

    const esfToggle = $('#esfToggle');
    if (esfToggle) {
        esfToggle.classList.toggle('active', S.showESF);
    }

    save();
    updateMeta();
}


// ------------------------
// Init Laufbetrieb
// ------------------------
function initRunning() {
    $('#setup').style.display = 'none';
    $('#running').style.display = '';
    $('#metaBar').style.display = '';

    // Spieleranzahl-UI an aktuellen State anpassen
    applyPlayerCountUI(S.players.length === 4 ? 4 : 3);

    // Toggle-Buttons (nur im Setup sichtbar, aber Event-Listener können immer existieren)
    const pills = $$('.toggle-pill');
    pills.forEach(p => {
        p.addEventListener('click', () => {
            const count = parseInt(p.dataset.count, 10) || 3;
            applyPlayerCountUI(count);
        });
    });

    // Solo-Tiles für Alleinspieler:innen aufbauen
    renderSoloTiles();
    enforceSoloNotDealer();

    // Falls noch niemand ausgewählt ist, erste nicht deaktivierte Spieler:in wählen
    let soloChecked = document.querySelector('input[name="solo"]:checked');
    if (!soloChecked) {
        const first = document.querySelector('input[name="solo"]:not(:disabled)');
        if (first) first.checked = true;
    }

    wireOptionCascade();
    wireFactorDropdown();
    enforceNullLock();

    // Ergebnis-Listener
    $$('input[name="res"]').forEach(r =>
        r.addEventListener('change', onResultSelected)
    );
    $$('input[name="art"]').forEach(r =>
        r.addEventListener('change', () => { preview(); updateMeta(); })
    );
    $$('input[name="mo"]').forEach(r =>
        r.addEventListener('change', () => { preview(); updateMeta(); })
    );
    $$('input[name="f"]').forEach(r =>
        r.addEventListener('change', () => { preview(); updateMeta(); })
    );

    // Buttons im laufenden Betrieb
    $('#pass').addEventListener('click', addPassed);
    $('#undo').addEventListener('click', undo);
    $('#export').addEventListener('click', exportCSV);
    $('#abort').addEventListener('click', abortList);
    $('#finish').addEventListener('click', finishList);

    // Edit-Buttons
    $('#saveEdit').addEventListener('click', saveEdit);
    $('#cancelEdit').addEventListener('click', cancelEdit);

    // Buttons im Abschluss-Screen
    const finalEnd = $('#finalEnd');
    if (finalEnd) finalEnd.addEventListener('click', abortList);

    const finalExport = $('#finalExport');
    if (finalExport) finalExport.addEventListener('click', exportCSV);

    const finalReopen = $('#finalReopen');
    if (finalReopen) finalReopen.addEventListener('click', reopenList);

    // ESF-Toggle (mit stabilem Handler, damit kein Doppelt-Toggle)
    const esfToggle = $('#esfToggle');
    if (esfToggle) {
        // aktuellen Zustand visuell setzen
        esfToggle.classList.toggle('active', !!S.showESF);

        // alten Handler (falls vorhanden) entfernen und neu registrieren
        esfToggle.removeEventListener('click', onEsfToggleClick);
        esfToggle.addEventListener('click', onEsfToggleClick);
    }

    preview();
    renderTable();
    updateMeta();
    applyClosedUI();
    if (S.closed) renderStats();
}




/* Persistence */
function save() { localStorage.setItem('skat_list_state', JSON.stringify(S)); }
(function restore() {
    const raw = localStorage.getItem('skat_list_state'); if (!raw) return;
    try {
        const s = JSON.parse(raw);
        if (!s.players?.length) return;
        S = { ...initialState(), ...s };
        $('#p1').value = S.players[0] || '';
        $('#p2').value = S.players[1] || '';
        $('#p3').value = S.players[2] || '';
                    if (S.players.length === 4) {
                $('#p4wrap').style.display = '';
                $('#p4').value = S.players[3] || '';
                applyPlayerCountUI(4);
            } else {
                applyPlayerCountUI(3);
            }

        // Modus ist implizit ESF, kein DOM-Element mehr nötig
        initRunning();
    } catch (e) { }
})();


/* Utils */
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

/* Placeholder für preview(), falls im ursprünglichen Code vorhanden */

