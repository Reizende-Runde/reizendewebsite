/* ===== Helpers ===== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const NULLS = ['Null', 'Null Hand', 'Null Hand Ouvert', 'Null Ouvert'];
const BASES = { Karo: 9, Herz: 10, Pik: 11, Kreuz: 12, Grand: 24 };

const initialState = () => ({
    players: [],
    ort: '',
    mode: 'esf',
    use4: false,
    rounds: [],
    selectedIdx: null,
    editIdx: null,
    closed: false,
    showESF: false,
    setupEdit: false
});

let S = initialState();

/* ===== Basic helpers ===== */
function isNullGame(art) { return NULLS.includes(art); }
function currentGameNumber() { return (S.rounds?.length || 0) + 1; }
function dealerIdxForGame(gameNumber, n) { return (gameNumber - 1) % n; }
function sitterIdxForGame(gameNumber, n) { return n === 4 ? dealerIdxForGame(gameNumber, n) : null; }

function getPlayerCount() {
    const active = document.querySelector('.toggle-pill.active');
    return parseInt(active?.dataset.count || '3', 10);
}

function getSelectedSoloIdx() {
    const checked = document.querySelector('input[name="solo"]:checked');
    return checked ? parseInt(checked.value, 10) : null;
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

/* ===== UI helpers ===== */
function applyPlayerCountUI(count) {
    const use4 = count === 4;
    const p4wrap = $('#p4wrap');
    if (p4wrap) p4wrap.style.display = use4 ? '' : 'none';

    $$('.toggle-pill').forEach(p => {
        const c = parseInt(p.dataset.count, 10);
        p.classList.toggle('active', c === count);
    });
}

function renderSoloTiles() {
    const wrap = $('#soloTiles');
    if (!wrap) return;

    if (!S.players?.length) {
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

function enforceSoloNotDealer() {
    const radios = $$('input[name="solo"]');
    const n = S.players.length;
    if (!radios.length || !n) return;

    if (n !== 4) {
        radios.forEach(r => {
            r.disabled = false;
            r.closest('label')?.classList.remove('disabled');
        });
        return;
    }

    const dealerIdx = dealerIdxForGame(currentGameNumber(), n);

    radios.forEach((r, idx) => {
        const isDealer = idx === dealerIdx;
        r.disabled = isDealer;
        r.closest('label')?.classList.toggle('disabled', isDealer);
    });

    const checked = document.querySelector('input[name="solo"]:checked');
    if (checked && parseInt(checked.value, 10) === dealerIdx) {
        checked.checked = false;
    }
}

function positionForPlayer(idx, gameNumber, n) {
    if (n < 3) return '';

    const dealerIdx = dealerIdxForGame(gameNumber, n);
    const vhIdx = (dealerIdx + 1) % n;
    const mhIdx = (dealerIdx + 2) % n;
    const hhIdx = (dealerIdx + 3) % n;

    if (idx === vhIdx) return 'VH';
    if (idx === mhIdx) return 'MH';
    if (idx === hhIdx) return 'HH';

    return '';
}

/* ===== Wiring ===== */
let wired = false;

function wireOnce() {
    if (wired) return;
    wired = true;

    $$('.toggle-pill').forEach(p => {
        p.addEventListener('click', () => {
            const count = parseInt(p.dataset.count, 10) || 3;
            applyPlayerCountUI(count);
        });
    });

    wireOptionCascade();
    wireFactorDropdown();
    enforceNullLock();

    $$('input[name="res"]').forEach(r => r.addEventListener('change', onResultSelected));
    $$('input[name="art"]').forEach(r => r.addEventListener('change', () => { preview(); updateMeta(); }));
    $$('input[name="mo"]').forEach(r => r.addEventListener('change', () => { preview(); updateMeta(); }));
    $$('input[name="f"]').forEach(r => r.addEventListener('change', () => { preview(); updateMeta(); }));

    $('#pass')?.addEventListener('click', addPassed);
    $('#undo')?.addEventListener('click', undo);
    $('#editSelected')?.addEventListener('click', startSelectedEdit);
    $('#editSetup')?.addEventListener('click', editSetupScreen);
    $('#saveGoogleSheet')?.addEventListener('click', saveJsonToGoogleSheet);
    $('#finalSaveGoogleSheet')?.addEventListener('click', saveJsonToGoogleSheet);
    $('#export')?.addEventListener('click', exportCSV);
    $('#copyJson')?.addEventListener('click', copyJsonExport);
    $('#abort')?.addEventListener('click', abortList);
    $('#finish')?.addEventListener('click', finishList);

    $('#saveEdit')?.addEventListener('click', saveEdit);
    $('#cancelEdit')?.addEventListener('click', cancelEdit);

    $('#finalEnd')?.addEventListener('click', abortList);
    $('#finalExport')?.addEventListener('click', exportCSV);
    $('#finalCopyJson')?.addEventListener('click', copyJsonExport);
    $('#finalReopen')?.addEventListener('click', reopenList);

    const esfToggle = $('#esfToggle');
    if (esfToggle) {
        esfToggle.addEventListener('click', onEsfToggleClick);
    }
}

function wireOptionCascade() {
    const inputs = $$('input[name="opt"]');
    const autoAllPrev = ['Schneider angesagt', 'Schwarz angesagt', 'Ouvert'];

    inputs.forEach((inp, i) => {
        inp.addEventListener('change', () => {
            if (inp.checked) {
                if (autoAllPrev.includes(inp.value)) {
                    for (let j = 0; j <= i; j++) inputs[j].checked = true;
                } else if (inp.value === 'Schwarz') {
                    const idx = inputs.findIndex(x => x.value === 'Schneider');
                    if (idx !== -1) inputs[idx].checked = true;
                }
            } else {
                for (let k = i + 1; k < inputs.length; k++) inputs[k].checked = false;
            }

            preview();
            updateMeta();
        });
    });
}

function enforceNullLock() {
    const artRadios = $$('input[name="art"]');
    const mo = $$('input[name="mo"]');
    const f = $$('input[name="f"]');
    const fDrop = $('#fDrop');
    const opt = $$('input[name="opt"]');

    function setDisabled(isNull) {
        [...mo, ...f, ...opt].forEach(el => {
            el.checked = false;
            el.disabled = isNull;
            el.closest('label')?.classList.toggle('disabled', isNull);
        });

        if (fDrop) {
            fDrop.disabled = isNull;
            if (isNull) fDrop.value = '';
            fDrop.closest('label')?.classList.toggle('disabled', isNull);
        }
    }

    artRadios.forEach(r => {
        r.addEventListener('change', () => {
            setDisabled(isNullGame(r.value));
            preview();
            updateMeta();
        });
    });
}

function wireFactorDropdown() {
    const radio = document.querySelector('input[name="f"][value="dropdown"]');
    const sel = $('#fDrop');
    if (!sel) return;

    sel.addEventListener('change', () => {
        if (sel.value !== '' && radio) radio.checked = true;
        preview();
        updateMeta();
    });
}

/* ===== State reading / clearing ===== */
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

function clearCurrentForm() {
    $$('input[name="art"]').forEach(e => e.checked = false);
    $$('input[name="res"]').forEach(e => e.checked = false);
    $$('input[name="mo"]').forEach(e => e.checked = false);
    $$('input[name="f"]').forEach(e => e.checked = false);
    $$('input[name="opt"]').forEach(e => {
        e.checked = false;
        e.disabled = false;
        e.closest('label')?.classList.remove('disabled');
    });

    [...$$('input[name="mo"]'), ...$$('input[name="f"]')].forEach(e => {
        e.disabled = false;
        e.closest('label')?.classList.remove('disabled');
    });

    const fDrop = $('#fDrop');
    if (fDrop) {
        fDrop.value = '';
        fDrop.disabled = false;
        fDrop.closest('label')?.classList.remove('disabled');
    }

    const summaryEl = $('#summary');
    if (summaryEl) summaryEl.textContent = '';

    const winSpan = $('#resWinValue');
    const loseSpan = $('#resLoseValue');
    if (winSpan) winSpan.textContent = '';
    if (loseSpan) loseSpan.textContent = '';

    document.querySelector('.result-tile-win')?.classList.remove('selected');
    document.querySelector('.result-tile-lose')?.classList.remove('selected');

    const vp = $('#valuePreview');
    if (vp) {
        vp.className = 'badge';
        vp.textContent = 'Spielwert: 0';
    }
}

/* ===== Calculation ===== */
function computeGameValue(state) {
    const { art, res, mo, f, opts } = state;
    if (!art || !res) return { value: 0, base: 0, maxF: 0, summary: '' };

    const sign = res === 'Gewonnen' ? 1 : -2;

    if (isNullGame(art)) {
        const base =
            art === 'Null' ? 23 :
            art === 'Null Hand' ? 35 :
            art === 'Null Ouvert' ? 46 : 59;

        return {
            value: base * sign,
            base,
            maxF: sign,
            summary: buildSummary(state, base, sign)
        };
    }

    const base = BASES[art] || 0;
    let faktor = 0;

    if (f && f !== 'dropdown') faktor = parseInt(f, 10) || 0;
    if (f === 'dropdown') {
        const d = $('#fDrop')?.value;
        if (d) faktor = parseInt(d, 10) || 0;
    }

    const mult = faktor + 1 + (opts ? opts.length : 0);
    const value = base * mult * sign;
    const maxF = mult * (sign === -2 ? -2 : 1);

    return {
        value,
        base,
        maxF,
        summary: buildSummary(state, base, maxF)
    };
}

function computeGameValueForResult(baseState, res) {
    return computeGameValue({ ...baseState, res });
}

function buildSummary(state, base, maxFshown) {
    const { art, mo, f, opts, res } = state;
    const parts = [];

    if (!isNullGame(art)) {
        let factor = 0;
        if (f && f !== 'dropdown') factor = parseInt(f, 10) || 0;
        if (f === 'dropdown') {
            const d = $('#fDrop')?.value;
            if (d) factor = parseInt(d, 10) || 0;
        }

        let baseStr = art;
        if (mo) baseStr += ` ${mo}`;
        baseStr += ` Spiel ${factor + 1}`;

        if (opts?.length) {
            let cur = factor + 1;
            opts.forEach(o => {
                cur += 1;
                parts.push(`${o} ${cur}`);
            });
        }

        parts.unshift(baseStr.trim());
    } else {
        parts.push(art);
    }

    const tail = res === 'Gewonnen' ? ', Gewonnen.' : `, Verloren ${maxFshown}.`;
    return parts.join(', ') + `${tail}<br>${maxFshown} × ${base} (für ${art}) = ${base * maxFshown}`;
}

function distributeESF(value, players, soloIdx) {
    const delta = Array(players.length).fill(0);
    if (soloIdx != null) delta[soloIdx] += value;
    return delta;
}

/* ===== Preview ===== */
function isValidForPreview(st) {
    if (!S.players.length) return false;
    if (getSelectedSoloIdx() == null) return false;
    if (!st.art) return false;

    if (isNullGame(st.art)) return true;

    if (!st.mo) return false;
    if (!st.f) return false;
    if (st.f === 'dropdown' && !$('#fDrop')?.value) return false;

    return true;
}

function preview() {
    const st = readState();

    const winSpan = $('#resWinValue');
    const loseSpan = $('#resLoseValue');
    const vp = $('#valuePreview');
    const summaryEl = $('#summary');

    const winInput = document.querySelector('input[name="res"][value="Gewonnen"]');
    const loseInput = document.querySelector('input[name="res"][value="Verloren"]');

    document.querySelector('.result-tile-win')?.classList.toggle('selected', !!winInput?.checked);
    document.querySelector('.result-tile-lose')?.classList.toggle('selected', !!loseInput?.checked);

    if (!isValidForPreview(st)) {
        if (winSpan) winSpan.textContent = '';
        if (loseSpan) loseSpan.textContent = '';
        if (vp) {
            vp.className = 'badge';
            vp.textContent = 'Spielwert: 0';
        }
        if (summaryEl) summaryEl.innerHTML = '';
        return;
    }

    const baseState = { ...st, res: '' };
    const winCalc = computeGameValueForResult(baseState, 'Gewonnen');
    const loseCalc = computeGameValueForResult(baseState, 'Verloren');

    if (winSpan) {
        const v = winCalc.value || 0;
        winSpan.textContent = v > 0 ? `+${v}` : String(v);
    }

    if (loseSpan) {
        const v = loseCalc.value || 0;
        loseSpan.textContent = v > 0 ? `+${v}` : String(v);
    }

    const calcActual = computeGameValue(st);

    if (vp) {
        let cls = 'badge';
        if (calcActual.value > 0) cls += ' ok';
        else if (calcActual.value < 0) cls += ' bad';
        vp.className = cls;
        vp.textContent = `Spielwert: ${calcActual.value || 0}`;
    }

    if (summaryEl) summaryEl.innerHTML = calcActual.summary || '';
}

/* ===== Toast ===== */
let toastTimer = null;
function toast(msg, big = false) {
    $('#toastMsg').innerHTML = msg;
    const t = $('#toast');
    t.classList.toggle('big', !!big);
    t.style.display = 'block';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        t.style.display = 'none';
        t.classList.remove('big');
    }, 1800);
}

/* ===== Validation ===== */
function validateTrumpGame(st) {
    if (isNullGame(st.art) || !st.art) return true;
    if (!st.mo) { alert('Bitte Mit/Ohne wählen.'); return false; }
    if (!st.f) { alert('Bitte Bubenanzahl wählen (Faktor ≥ 1).'); return false; }
    if (st.f === 'dropdown' && !$('#fDrop')?.value) {
        alert('Bitte Bubenanzahl im Dropdown wählen.');
        return false;
    }
    return true;
}

/* ===== Add games ===== */
function addGameWithState(st) {
    const calc = computeGameValue(st);
    const factorNum = (st.f === 'dropdown'
        ? parseInt($('#fDrop')?.value || '0', 10)
        : parseInt(st.f || '0', 10)) || 0;

    const n = S.players.length;
    const g = currentGameNumber();
    const sitterIdx = sitterIdxForGame(g, n);

    const delta = distributeESF(calc.value, S.players, st.soloIdx);
    const prev = S.rounds.at(-1)?.totals || Array(n).fill(0);
    const totals = prev.slice();
    delta.forEach((d, i) => totals[i] += d);

    const wins = (S.rounds.at(-1)?.wins || Array(n).fill(0)).slice();
    const losses = (S.rounds.at(-1)?.losses || Array(n).fill(0)).slice();

    if (st.res === 'Gewonnen') wins[st.soloIdx] += 1;
    else losses[st.soloIdx] += 1;

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
        totals,
        wins,
        losses,
        summary: calc.summary
    });

    save();
    renderTable();
    updateMeta();

    const soloName = S.players[st.soloIdx];
    const deltaSolo = delta[st.soloIdx] || 0;
    const sign = deltaSolo > 0 ? '+' : '';
    toast(`<b>${soloName}</b><br>${sign}${deltaSolo}`, true);

    clearCurrentForm();
}

function addGame(e) {
    if (e) e.preventDefault();

    const st = readState();
    if (!st.art || !st.res) {
        alert('Bitte Spielart und Ergebnis wählen.');
        return;
    }

    if (!validateTrumpGame(st)) return;
    addGameWithState(st);
}

function onResultSelected(e) {
    const val = e.target.value;
    if (!val) return;

    if (S.editIdx != null) {
        preview();
        updateMeta();
        return;
    }

    const st = readState();

    if (!st.art) {
        alert('Bitte zuerst die Spielart wählen.');
        e.target.checked = false;
        preview();
        return;
    }

    if (!isNullGame(st.art) && !validateTrumpGame(st)) {
        e.target.checked = false;
        preview();
        return;
    }

    st.res = val;
    addGameWithState(st);
}

function addPassed(e) {
    e.preventDefault();
    if (S.editIdx != null) return;
          if (!confirm('Spiel wirklich als eingepasst eintragen?')) {
              return;
          }
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
        value: 0,
        base: 0,
        mo: '',
        factor: 0,
        opts: [],
        delta,
        soloIdx: getSelectedSoloIdx() ?? 0,
        sitterIdx,
        totals,
        wins,
        losses,
        summary: 'Eingepasst'
    });

    save();
    renderTable();
    updateMeta();
    toast('<b>Eingepasst</b>', true);
    clearCurrentForm();
}

/* ===== Setup edit ===== */
function applyPlayerRenames(oldPlayers, newPlayers) {
    S.rounds.forEach(r => {
        if (r.soloIdx != null && r.soloIdx >= newPlayers.length) r.soloIdx = null;
        if (r.state?.soloIdx != null && r.state.soloIdx >= newPlayers.length) r.state.soloIdx = null;
        if (r.sitterIdx != null && r.sitterIdx >= newPlayers.length) r.sitterIdx = null;
        if (r.state?.sitterIdx != null && r.state.sitterIdx >= newPlayers.length) r.state.sitterIdx = null;

        r.delta = Array(newPlayers.length).fill(0);
        r.totals = [];
        r.wins = [];
        r.losses = [];
    });
}

function editSetupScreen() {
    if (!S.players.length) return;

    if (S.editIdx != null) {
        alert('Bitte erst die aktuelle Bearbeitung speichern oder abbrechen.');
        return;
    }

    S.setupEdit = true;

    $('#setup').style.display = '';
    $('#running').style.display = 'none';
    $('#metaBar').style.display = 'none';

    $('#p1').value = S.players[0] || '';
    $('#p2').value = S.players[1] || '';
    $('#p3').value = S.players[2] || '';
    $('#p4').value = S.players[3] || '';
    if ($('#ort')) $('#ort').value = S.ort || '';

    applyPlayerCountUI(S.players.length === 4 ? 4 : 3);

    const startBtn = $('#start');
    if (startBtn) startBtn.textContent = 'Änderungen übernehmen';

    toast('Namen und Ort können jetzt bearbeitet werden.');
}

/* ===== Edit selection ===== */
window.onRowSelect = function (i) {
    if (S.closed) return;
    if (S.editIdx != null) return;

    S.selectedIdx = S.selectedIdx === i ? null : i;

    const editSelected = $('#editSelected');
    if (editSelected) {
        editSelected.style.display = S.selectedIdx != null ? '' : 'none';
    }

    renderTable();
};

function startSelectedEdit() {
    if (S.selectedIdx == null) return;
    if (S.closed) return;

    const i = S.selectedIdx;
    const r = S.rounds[i];

    S.editIdx = i;
    setControlsFromState(r);

    $('#pass').style.display = 'none';
    $('#saveEdit').style.display = '';
    $('#cancelEdit').style.display = '';

    const editSelected = $('#editSelected');
    if (editSelected) editSelected.style.display = 'none';

    renderTable();
    toast(`Bearbeite Spiel ${i + 1}${r.passed ? ' (Eingepasst)' : ''}.`);
}

function setControlsFromState(r) {
    clearCurrentForm();

    $$('input[name="art"]').forEach(inpt => {
        inpt.checked = inpt.value === (r.state.art || '');
    });

    $$('input[name="res"]').forEach(inpt => {
        inpt.checked = inpt.value === (r.state.res || '');
    });

    $$('input[name="mo"]').forEach(inpt => {
        inpt.checked = inpt.value === (r.state.mo || '');
    });

    let fVal = r.state.f || '';

    if (!fVal && r.factor >= 1 && r.factor <= 4) fVal = String(r.factor);
    if (!fVal && r.factor >= 5) fVal = 'dropdown';

    $$('input[name="f"]').forEach(inpt => {
        inpt.checked = inpt.value === fVal;
    });

    const fDrop = $('#fDrop');
    if (fDrop) fDrop.value = r.factor >= 5 ? String(r.factor) : '';

    const opts = r.state?.opts || r.opts || [];
    $$('input[name="opt"]').forEach(inpt => {
        inpt.checked = opts.includes(inpt.value);
    });

    const soloRadio = document.querySelector(`input[name="solo"][value="${r.soloIdx ?? 0}"]`);
    if (soloRadio && !soloRadio.disabled) {
        soloRadio.checked = true;
    }

    const isNull = isNullGame(r.state?.art);
    if (isNull) {
        [...$$('input[name="mo"]'), ...$$('input[name="f"]'), ...$$('input[name="opt"]')].forEach(el => {
            el.disabled = true;
            el.closest('label')?.classList.add('disabled');
        });

        if (fDrop) {
            fDrop.disabled = true;
            fDrop.closest('label')?.classList.add('disabled');
        }
    }

    preview();
}

function cancelEdit() {
    S.editIdx = null;
    S.selectedIdx = null;

    $('#pass').style.display = '';
    $('#saveEdit').style.display = 'none';
    $('#cancelEdit').style.display = 'none';

    const editSelected = $('#editSelected');
    if (editSelected) editSelected.style.display = 'none';

    clearCurrentForm();
    renderTable();
    updateMeta();
}

function saveEdit(e) {
    e.preventDefault();
    if (S.editIdx == null) return;

    const st = readState();
    const makePassed = !st.art && !st.res;

    let newRound;

    if (makePassed) {
        const n = S.players.length;

        newRound = {
            passed: true,
            state: { art: '', res: '', mo: '', f: '', opts: [] },
            value: 0,
            base: 0,
            mo: '',
            factor: 0,
            opts: [],
            delta: Array(n).fill(0),
            soloIdx: getSelectedSoloIdx() ?? 0,
            sitterIdx: sitterIdxForGame(S.editIdx + 1, n),
            totals: [],
            wins: [],
            losses: [],
            summary: 'Eingepasst'
        };
    } else {
        if (!st.art || !st.res) {
            alert('Bitte Spielart und Ergebnis wählen oder Eingepasst leer lassen.');
            return;
        }

        if (!isNullGame(st.art) && !validateTrumpGame(st)) return;

        const calc = computeGameValue(st);
        const n = S.players.length;

        newRound = {
            passed: false,
            state: st,
            value: calc.value,
            base: calc.base,
            mo: st.mo,
            factor: parseInt(($('#fDrop')?.value || st.f || '0'), 10) || 0,
            opts: st.opts.slice(),
            delta: [],
            soloIdx: st.soloIdx,
            sitterIdx: sitterIdxForGame(S.editIdx + 1, n),
            totals: [],
            wins: [],
            losses: [],
            summary: calc.summary
        };
    }

    const editedNr = S.editIdx + 1;

    S.rounds[S.editIdx] = newRound;
    recalcAll();

    S.editIdx = null;
    S.selectedIdx = null;

    save();
    clearCurrentForm();
    renderTable();
    updateMeta();

    $('#pass').style.display = '';
    $('#saveEdit').style.display = 'none';
    $('#cancelEdit').style.display = 'none';

    const editSelected = $('#editSelected');
    if (editSelected) editSelected.style.display = 'none';

    toast(`Spiel ${editedNr} aktualisiert.`);
}

/* ===== Recalc ===== */
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

            delta = distributeESF(r.value, S.players, st.soloIdx);

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

/* ===== List controls ===== */
function undo() {
    if (!S.rounds.length) return;

    S.rounds.pop();
    S.selectedIdx = null;
    S.editIdx = null;

    save();
    clearCurrentForm();
    renderTable();
    updateMeta();

    const editSelected = $('#editSelected');
    if (editSelected) editSelected.style.display = 'none';

    toast('Letztes Spiel entfernt.');
}

function abortList(e) {
    if (e?.preventDefault) e.preventDefault();

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
    $('#p4').value = '';
    if ($('#ort')) $('#ort').value = '';

    const startBtn = $('#start');
    if (startBtn) startBtn.textContent = 'Liste starten';

    const soloTiles = $('#soloTiles');
    if (soloTiles) soloTiles.innerHTML = '';

    const statsWrap = $('#statsWrap');
    if (statsWrap) {
        statsWrap.style.display = 'none';
        const statsTableWrap = $('#statsTableWrap');
        if (statsTableWrap) statsTableWrap.innerHTML = '';
    }

    clearCurrentForm();

    const mini = $('#miniScores');
    if (mini) mini.innerHTML = '';

    const editSelected = $('#editSelected');
    if (editSelected) editSelected.style.display = 'none';

    applyClosedUI();
    updateMeta();
    applyPlayerCountUI(3);

    toast('Liste beendet. Neue Spielerliste anlegen.');
}

function finishList() {
    if (!S.rounds.length) {
        alert('Es wurden noch keine Spiele eingetragen.');
        return;
    }

    if (!confirm('Liste wirklich abschließen? Danach sind keine Änderungen mehr möglich.')) return;

    S.closed = true;
    S.editIdx = null;
    S.selectedIdx = null;

    save();
    clearCurrentForm();
    renderTable();
    renderStats();
    applyClosedUI();

    const editSelected = $('#editSelected');
    if (editSelected) editSelected.style.display = 'none';

    toast('Liste abgeschlossen.');
}

function reopenList() {
    S.closed = false;
    save();
    applyClosedUI();
    toast('Liste wieder geöffnet. Du kannst die Liste bearbeiten oder fortführen.');
}

/* ===== Stats ===== */
function computePlayerStats() {
    const n = S.players.length;

    const stats = Array.from({ length: n }, () => ({
        baseSum: 0,
        esfSum: 0,
        won: 0,
        lost: 0
    }));

    if (!S.rounds.length || !n) return stats;

    const last = S.rounds.at(-1);
    const baseTotals = (last.totals || Array(n).fill(0)).slice();
    const wins = (last.wins || Array(n).fill(0)).slice();
    const losses = (last.losses || Array(n).fill(0)).slice();

    const oppLossPts = n === 3 ? 40 : 30;
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
        stats[i].esfSum = esfTotals[i] || 0;
        stats[i].won = wins[i] || 0;
        stats[i].lost = losses[i] || 0;
    }

    return stats;
}

function renderStats() {}

/* ===== Table ===== */
function renderTable() {
    const tbl = $('#listTable');
    if (!tbl) return;

    const playerHeads = S.players.map(p => `
        <th>
            <div>${escapeHtml(p)}</div>
        </th>
    `).join('');

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
        const mit = r.mo === 'Mit' ? (r.factor || '') : '';
        const ohne = r.mo === 'Ohne' ? (r.factor || '') : '';
        const has = name => r.state?.opts?.includes(name) || r.opts?.includes(name);

        const playerCells = r.delta.map(v =>
            `<td class="cell-right" style="${v > 0 ? 'color:#0e6b34' : (v < 0 ? 'color:#7a1420' : '')}">${v > 0 ? '+' : ''}${v || ''}</td>`
        ).join('');

        const cls = [
            r.passed ? 'passed' : '',
            'clickable',
            S.selectedIdx === i ? 'selected' : '',
            S.editIdx === i ? 'editing' : ''
        ].filter(Boolean).join(' ');

        return `<tr class="${cls}" data-idx="${i}" onclick="onRowSelect(${i})" title="${escapeHtml((r.summary || '').replace(/<br>/g, ' | '))}">
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

    const totals = S.rounds.at(-1)?.totals || Array(S.players.length).fill(0);
    const preCols = Array(9).fill('<td></td>').join('');
    const plusMinus = '<td></td><td></td>';
    const playerTotals = totals.map(v => `<td class="cell-right">${v > 0 ? '+' : ''}${v}</td>`).join('');

    let footRows = `
        <tr>
            <td>Spielergebnis (ohne ESF-Zuschläge)</td>
            ${preCols}
            ${plusMinus}
            ${playerTotals}
            <td></td>
        </tr>`;

    if (S.rounds.length) {
        const n = S.players.length;
        const last = S.rounds.at(-1);
        const wins = (last.wins || Array(n).fill(0)).slice();
        const losses = (last.losses || Array(n).fill(0)).slice();

        const oppLossPts = n === 3 ? 40 : 30;
        const oppLostCount = Array(n).fill(0);
        const oppWonCount = Array(n).fill(0);
        const passes = Array(n).fill(0);

        S.rounds.forEach(r => {
            if (r.passed) {
                if (r.soloIdx != null) passes[r.soloIdx] += 1;
                return;
            }

            if (r.state?.res === 'Verloren' && r.soloIdx != null) {
                for (let i = 0; i < n; i++) {
                    if (i !== r.soloIdx) oppLostCount[i] += 1;
                }
            }

            if (r.state?.res === 'Gewonnen' && r.soloIdx != null) {
                for (let i = 0; i < n; i++) {
                    if (i !== r.soloIdx) oppWonCount[i] += 1;
                }
            }
        });

        const plus50 = wins.map((w, i) => (w - losses[i]) * 50);
        const oppPts = oppLostCount.map(c => c * oppLossPts);
        const finalTotals = totals.map((v, i) => v + plus50[i] + oppPts[i]);
        const emptyMetrics = '<td colspan="11"></td>';

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

        footRows +=
            rowCounts('Gewonnene Spiele', wins, 'stats-separator') +
            rowCounts('Verlorene Spiele', losses) +
            rowCounts('Eingepasste Spiele', passes) +
            rowCounts('Gewonnene Gegnerspiele', oppWonCount) +
            rowPoints('+ (gewonnene − verlorene) Spiele × 50', plus50) +
            rowPoints(`+ verlorene Gegnerspiele × ${oppLossPts}`, oppPts) +
            rowPoints('Gesamtpunkte (mit ESF-Zuschlägen)', finalTotals, true);
    }

    tbl.innerHTML = head + '<tbody>' + rows + '</tbody>' + `<tfoot>${footRows}</tfoot>`;
}

/* ===== Export ===== */
function exportCSV() {
    const sep = ';';
    const out = [
        ['#', 'Grundwert', 'mit Spitzen', 'ohne Spitzen', 'Hand', 'Schneider', '- angesagt', 'Schwarz', '- angesagt', 'Offen', 'Spielwert +', 'Spielwert -', ...S.players, 'Eingepasst'].join(sep)
    ];

    S.rounds.forEach((r, i) => {
        const plus = r.value > 0 ? r.value : (r.passed ? 'E' : '');
        const minus = r.value < 0 ? Math.abs(r.value) : '';
        const mit = r.mo === 'Mit' ? (r.factor || '') : '';
        const ohne = r.mo === 'Ohne' ? (r.factor || '') : '';
        const has = n => (r.state?.opts?.includes(n) || r.opts?.includes(n)) ? 'X' : '';

        out.push([
            i + 1,
            r.base || '',
            mit,
            ohne,
            has('Hand'),
            has('Schneider'),
            has('Schneider angesagt'),
            has('Schwarz'),
            has('Schwarz angesagt'),
            has('Ouvert'),
            plus,
            minus,
            ...r.delta,
            r.passed ? 'E' : ''
        ].join(sep));
    });

    const totals = S.rounds.at(-1)?.totals || Array(S.players.length).fill(0);
    out.push(['Summe', '', '', '', '', '', '', '', '', '', '', '', ...totals, ''].join(sep));

    const blob = new Blob([out.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'skat_liste.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

function normalizeSpielart(art) {
    const map = {
        Karo: 'karo',
        Herz: 'herz',
        Pik: 'pik',
        Kreuz: 'kreuz',
        Grand: 'grand',
        Null: 'null',
        'Null Hand': 'nullHand',
        'Null Ouvert': 'nullOuvert',
        'Null Hand Ouvert': 'nullHandOuvert'
    };

    return map[art] || String(art || '').trim();
}

function buildJsonExport() {
    return {
        id: null,
        datum: new Date().toISOString().slice(0, 10),
        ort: S.ort || '',
        regeln: S.mode || 'turnier',
        spielerinnen: S.players.slice(),
        spiele: S.rounds.map((r, i) => {
            const nr = i + 1;
            const n = S.players.length;
            const geberIdx = dealerIdxForGame(nr, n);
            const geberin = S.players[geberIdx] || null;

            const aussetzende = r.sitterIdx != null && S.players[r.sitterIdx]
                ? [S.players[r.sitterIdx]]
                : [];

            if (r.passed) {
                return {
                    nr,
                    geberin,
                    spielart: 'eingepasst',
                    aussetzende
                };
            }

            const alleinspielerin = S.players[r.soloIdx] || null;
            const gegenpartei = S.players.filter((_, idx) =>
                idx !== r.soloIdx && idx !== r.sitterIdx
            );

            const opts = r.state?.opts || r.opts || [];

            let spitzen = null;
            if (!isNullGame(r.state?.art)) {
                const factor = Number(r.factor || 0);
                if (factor) spitzen = r.mo === 'Ohne' ? -factor : factor;
            }

            return {
                nr,
                geberin,
                spielart: normalizeSpielart(r.state?.art),
                grundwert: r.base || null,
                alleinspielerin,
                gegenpartei,
                aussetzende,
                spitzen,
                hand: opts.includes('Hand'),
                schneider: opts.includes('Schneider'),
                schneiderAngesagt: opts.includes('Schneider angesagt'),
                schwarz: opts.includes('Schwarz'),
                schwarzAngesagt: opts.includes('Schwarz angesagt'),
                ouvert: opts.includes('Ouvert'),
                gewonnen: r.state?.res === 'Gewonnen',
                spielwert: Number(r.value || 0)
            };
        })
    };
}

async function copyJsonExport() {
    const json = JSON.stringify(buildJsonExport(), null, 2);

    try {
        await navigator.clipboard.writeText(json);
        toast('JSON wurde in die Zwischenablage kopiert.');
    } catch (err) {
        console.error(err);

        const textarea = document.createElement('textarea');
        textarea.value = json;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            toast('JSON wurde in die Zwischenablage kopiert.');
        } catch (fallbackErr) {
            console.error(fallbackErr);
            toast('JSON konnte nicht kopiert werden.');
        } finally {
            document.body.removeChild(textarea);
        }
    }
}
let isSavingGoogleSheet = false;

async function saveJsonToGoogleSheet() {
    if (isSavingGoogleSheet) return;

    const data = buildJsonExport();
    const jsonString = JSON.stringify(data);
    const hash = simpleHash(jsonString);

    const last = JSON.parse(localStorage.getItem('skat_list_last_google_upload') || 'null');

    if (last && last.hash === hash) {
        if (!confirm('Diese Liste wurde vermutlich schon übertragen. Trotzdem erneut senden?')) {
            return;
        }
    }

    if (!confirm('Liste wirklich in die Ewige Liste übertragen?')) {
        return;
    }

    isSavingGoogleSheet = true;

    const btn = $('#saveGoogleSheet');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Wird gesendet...';
    }

    const url = "https://script.google.com/macros/s/AKfycbx63jqsUkWwtgKI4tIY4wGwrIsnNuTlvncMHIxD55FPaKY--E0l6eDJLQNrQocdQ69J/exec";

    data.clientHash = hash;

    try {
        await fetch(url, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(data)
        });

        toast(
            'Liste erfolgreich entgegengenommen. Prüfe in der „Ewigen Liste“, ob alles angekommen ist, oder exportiere sicherheitshalber CSV/JSON.',
            true
        );

        localStorage.setItem('skat_list_last_google_upload', JSON.stringify({
            at: new Date().toISOString(),
            hash,
            json: jsonString
        }));
    } catch (err) {
        console.error(err);
        toast("Speichern fehlgeschlagen.");
    } finally {
        isSavingGoogleSheet = false;

        if (btn) {
            btn.disabled = false;
            btn.textContent = 'In Google Sheet speichern';
        }
    }
}

/* ===== Simple Hash ===== */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}
/* ===== Meta / layout ===== */
function updateMeta() {
    const n = S.players.length;
    const wrap = $('#miniScores');

    if (!n) {
        if ($('#metaGame')) $('#metaGame').textContent = '';
        if ($('#metaRound')) $('#metaRound').textContent = '';
        if (wrap) wrap.innerHTML = '';
        return;
    }

    const game = S.closed && S.rounds.length ? S.rounds.length : currentGameNumber();
    const round = Math.ceil(game / n);
    const dealerIdx = dealerIdxForGame(game, n);

    if ($('#metaGame')) $('#metaGame').textContent = String(game);
    if ($('#metaRound')) $('#metaRound').textContent = String(round);

    const stats = computePlayerStats();
    if (!stats.length || !wrap) return;

    const useESF = !!S.showESF;

    wrap.innerHTML = S.players.map((p, i) => {
        const s = stats[i] || { baseSum: 0, esfSum: 0 };
        const v = useESF ? s.esfSum : s.baseSum;
        const sign = v > 0 ? '+' : '';
        const dealerClass = i === dealerIdx ? ' dealer' : '';
        const pos = positionForPlayer(i, game, n);

        return `
            <div class="pill${dealerClass}">
                <span class="pill-name">${escapeHtml(p)}</span>
                ${pos ? `<span class="pill-position">${pos}</span>` : ''}
                <span class="pill-points">${sign}${v}</span>
            </div>
        `;
    }).join('');

    enforceSoloNotDealer();
}

function applyClosedUI() {
    const hasPlayers = !!S.players?.length;
    const isClosed = hasPlayers && !!S.closed;

    if ($('#setup')) $('#setup').style.display = hasPlayers ? 'none' : '';
    if ($('#metaBar')) $('#metaBar').style.display = hasPlayers ? '' : 'none';
    if ($('#cardInfo')) $('#cardInfo').style.display = hasPlayers ? '' : 'none';

    const gridUpper = $('.grid-upper');
    if (gridUpper) gridUpper.style.display = hasPlayers && !isClosed ? '' : 'none';

    if ($('#statsWrap')) $('#statsWrap').style.display = hasPlayers && isClosed ? '' : 'none';
    if ($('#finalActions')) $('#finalActions').style.display = hasPlayers && isClosed ? '' : 'none';

    const editSelected = $('#editSelected');
    if (editSelected && (isClosed || S.selectedIdx == null || S.editIdx != null)) {
        editSelected.style.display = 'none';
    }
}

function onEsfToggleClick() {
    S.showESF = !S.showESF;

    const esfToggle = $('#esfToggle');
    if (esfToggle) esfToggle.classList.toggle('active', S.showESF);

    save();
    updateMeta();
}

/* ===== Init ===== */
$('#start').addEventListener('click', () => {
    const p1 = $('#p1').value?.trim() || 'Spielerin 1';
    const p2 = $('#p2').value?.trim() || 'Spielerin 2';
    const p3 = $('#p3').value?.trim() || 'Spielerin 3';

    const count = getPlayerCount();
    const use4 = count === 4;
    const p4 = use4 ? ($('#p4').value?.trim() || 'Spielerin 4') : null;

    const oldPlayers = S.players.slice();
    const newPlayers = use4 ? [p1, p2, p3, p4] : [p1, p2, p3];

    S.players = newPlayers;
    S.mode = 'esf';
    S.ort = $('#ort')?.value?.trim() || '';
    S.use4 = use4;

    if (S.setupEdit) {
        applyPlayerRenames(oldPlayers, newPlayers);
        S.setupEdit = false;

        const startBtn = $('#start');
        if (startBtn) startBtn.textContent = 'Liste starten';

        $('#setup').style.display = 'none';
        $('#running').style.display = '';
        $('#metaBar').style.display = '';

        renderSoloTiles();
        recalcAll();
        save();
        clearCurrentForm();
        renderTable();
        updateMeta();
        applyClosedUI();

        toast('Namen / Ort aktualisiert.');
        return;
    }

    initRunning();
    save();
});

function initRunning() {
    S.setupEdit = false;

    const startBtn = $('#start');
    if (startBtn) startBtn.textContent = 'Liste starten';

    $('#setup').style.display = 'none';
    $('#running').style.display = '';
    $('#metaBar').style.display = '';

    applyPlayerCountUI(S.players.length === 4 ? 4 : 3);

    wireOnce();

    renderSoloTiles();
    enforceSoloNotDealer();

    const esfToggle = $('#esfToggle');
    if (esfToggle) {
        esfToggle.classList.toggle('active', !!S.showESF);
    }

    preview();
    renderTable();
    updateMeta();
    applyClosedUI();

    if (S.closed) renderStats();
}

/* ===== Persistence ===== */
function save() {
    localStorage.setItem('skat_list_state', JSON.stringify(S));
}

(function restore() {
    const raw = localStorage.getItem('skat_list_state');
    if (!raw) return;

    try {
        const s = JSON.parse(raw);
        if (!s.players?.length) return;

        S = { ...initialState(), ...s, selectedIdx: null, editIdx: null, setupEdit: false };

        $('#p1').value = S.players[0] || '';
        $('#p2').value = S.players[1] || '';
        $('#p3').value = S.players[2] || '';
        if ($('#ort')) $('#ort').value = S.ort || '';

        if (S.players.length === 4) {
            $('#p4wrap').style.display = '';
            $('#p4').value = S.players[3] || '';
            applyPlayerCountUI(4);
        } else {
            applyPlayerCountUI(3);
        }

        initRunning();
    } catch (e) {
        console.error(e);
    }
})();
