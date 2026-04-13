// phase-diagram-fake.js

const FAKE_LIBRARY_KEY = 'phaseDiagramFakeLibrary';
const FAKE_LIB_MAX = 5;
const DRAG_RADIUS = 10; // px hit radius for drag handles

// ── Library ────────────────────────────────────────────────────────────────
function loadFakeLibrary() {
  try { STATE.fakeLibrary = JSON.parse(localStorage.getItem(FAKE_LIBRARY_KEY)) || []; }
  catch { STATE.fakeLibrary = []; }
  renderLibraryUI();
}

function saveFakeLibraryToStorage() {
  localStorage.setItem(FAKE_LIBRARY_KEY, JSON.stringify(STATE.fakeLibrary));
}

function generateFakeCompound() {
  if (STATE.fakeLibrary.length >= FAKE_LIB_MAX) {
    showToast(`Library full — delete one to add more (max ${FAKE_LIB_MAX})`, 'error');
    return;
  }
  const fc = _buildFakeCompound();
  STATE.fakeCompound = fc;
  el('fake-name').value = fc.name;
  autoScaleToCompound(fc);   // use same smart scale as real compounds
  setMode('fake');
  renderDiagram();
}

function _buildFakeCompound() {
  const seed = Date.now();
  const rng = _seededRng(seed);

  const T_tp_K  = 150 + rng() * 300;              // triple point temp K: 150-450
  const T_cp_K  = T_tp_K * (1.5 + rng() * 1.5);  // critical T: 1.5-3× triple

  // Make P_tp 8–18% of P_cp so triple point is clearly visible on the diagram
  const P_cp_Pa = Math.pow(10, 5 + rng() * 2);            // critical P: 100k-10M Pa
  const P_tp_Pa = P_cp_Pa * (0.08 + rng() * 0.10);        // triple P: 8-18% of critical

  const slSlope  = 20e6 + rng() * 30e6;   // dP/dT Pa/K for SL line
  const lvCurve  = 0.6  + rng() * 0.8;   // LV curvature exponent
  const svExtent = 0.4  + rng() * 0.4;   // how far left SV extends

  const adjectives = ['Alpha','Beta','Gamma','Delta','Omega','Sigma','Zeta','Eta'];
  const nouns      = ['Compound','Substance','Element','Species','Phase','Matter'];
  const name = adjectives[Math.floor(rng()*adjectives.length)] + '-' +
               nouns[Math.floor(rng()*nouns.length)];

  return {
    id: seed,
    name,
    _T_tp: T_tp_K, _P_tp: P_tp_Pa,
    _T_cp: T_cp_K, _P_cp: P_cp_Pa,
    _slSlope: slSlope,
    _lvCurve: lvCurve,
    _svExtent: svExtent,
    ...buildFakeCurveData(T_tp_K, P_tp_Pa, T_cp_K, P_cp_Pa, slSlope, lvCurve, svExtent, rng)
  };
}

function buildFakeCurveData(T_tp, P_tp, T_cp, P_cp, slSlope, lvCurve, svExtent, rng) {
  // Work in display units (convert K/Pa → current units)
  const toT = (k) => UNIT_CONVERSIONS.temperature.fromKelvin[STATE.tempUnit](k);
  const toP = (pa) => UNIT_CONVERSIONS.pressure.fromPa[STATE.pressUnit](pa);

  const tp = { T: toT(T_tp), P: toP(P_tp) };
  const cp = { T: toT(T_cp), P: toP(P_cp) };

  // Solid-liquid curve: nearly vertical from tp upward.
  // End at 1.00–1.15× critical pressure so the drag handle is visible
  // in the critical-point-centred auto-scale (y_max ≈ 1.28× cp.P).
  const slTop_Pa = P_cp * (1.00 + rng() * 0.15);
  const dT_sl    = (slTop_Pa - P_tp) / slSlope; // delta in Kelvin
  const slCurve  = [
    tp,
    { T: toT(T_tp + dT_sl * 0.33), P: toP(P_tp + (slTop_Pa - P_tp) * 0.33) },
    { T: toT(T_tp + dT_sl * 0.66), P: toP(P_tp + (slTop_Pa - P_tp) * 0.66) },
    { T: toT(T_tp + dT_sl),        P: toP(slTop_Pa) }
  ];

  // Liquid-vapor curve: from tp to cp with some curvature
  const lvCurve_pts = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const T_lv = T_tp + (T_cp - T_tp) * frac;
    // Antoine-like: pressure grows exponentially from tp to cp
    const fracP = Math.pow(frac, lvCurve);
    const P_lv  = P_tp + (P_cp - P_tp) * fracP;
    lvCurve_pts.push({ T: toT(T_lv), P: toP(P_lv) });
  }

  // Solid-vapor curve: from low T/P to triple point
  const svCurve = [];
  const T_sv_start_K = T_tp * (1 - svExtent);
  for (let i = 0; i <= 6; i++) {
    const frac = i / 6;
    const T_sv = T_sv_start_K + (T_tp - T_sv_start_K) * frac;
    const P_sv = P_tp * Math.pow(frac, 2.5);
    svCurve.push({ T: toT(T_sv), P: toP(P_sv) });
  }

  // Normal boiling point at 1 atm
  const oneAtm_Pa = 101325;
  const oneAtm_disp = UNIT_CONVERSIONS.pressure.fromPa[STATE.pressUnit](oneAtm_Pa);

  return {
    triplePoint:       tp,
    criticalPoint:     cp,
    normalMeltingPoint: oneAtm_Pa >= P_tp ? { T: tp.T, P: oneAtm_disp } : null,
    normalBoilingPoint: oneAtm_Pa >= P_tp && oneAtm_Pa <= P_cp
      ? { T: lvCurve_pts.find(p => Math.abs(p.P - oneAtm_disp) < oneAtm_disp * 0.2)?.T || cp.T, P: oneAtm_disp }
      : null,
    solidLiquidCurve: slCurve,
    liquidVaporCurve: lvCurve_pts,
    solidVaporCurve:  svCurve,
    negativeSlope: false,
    // Drag handle endpoints (far ends of each line)
    _handleSL: { ...slCurve[slCurve.length - 1] },
    _handleSV: { ...svCurve[0] },
    _handleLV: { ...cp } // LV far end IS the critical point
  };
}

function _seededRng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function autoScaleAxesForFake(fc) {
  const allT = [], allP = [];
  ['solidLiquidCurve','liquidVaporCurve','solidVaporCurve'].forEach(k => {
    (fc[k] || []).forEach(p => { allT.push(p.T); allP.push(p.P); });
  });
  if (!allT.length) return;

  const tPad = (Math.max(...allT) - Math.min(...allT)) * 0.2;
  const pPad = Math.max(...allP) * 0.2;

  const xMin = Math.floor(Math.min(...allT) - tPad);
  const xMax = Math.ceil(Math.max(...allT)  + tPad);
  const yMax = Math.ceil(Math.max(...allP)  + pPad);
  const xMaj = niceTick(xMax - xMin), yMaj = niceTick(yMax);

  setInp('x-min', xMin); setInp('x-max', xMax);
  setInp('x-major', parseFloat(xMaj.toPrecision(3)));
  setInp('x-minor', parseFloat((xMaj/4).toPrecision(2)));
  setInp('y-min', 0); setInp('y-max', yMax);
  setInp('y-major', parseFloat(yMaj.toPrecision(3)));
  setInp('y-minor', parseFloat((yMaj/5).toPrecision(2)));
  syncStateFromDOM();
}

// ── Library CRUD ───────────────────────────────────────────────────────────
function saveFakeCompound() {
  const fc = STATE.fakeCompound;
  if (!fc) { showToast('No fake compound to save', 'error'); return; }
  if (STATE.fakeLibrary.length >= FAKE_LIB_MAX) {
    showToast(`Library full (max ${FAKE_LIB_MAX})`, 'error'); return;
  }
  fc.name = el('fake-name')?.value?.trim() || fc.name;
  const existing = STATE.fakeLibrary.findIndex(c => c.id === fc.id);
  if (existing >= 0) { STATE.fakeLibrary[existing] = fc; showToast('Compound updated', 'success'); }
  else { STATE.fakeLibrary.push(fc); showToast('Compound saved to library', 'success'); }
  saveFakeLibraryToStorage();
  renderLibraryUI();
}

function deleteFakeCompound(id) {
  STATE.fakeLibrary = STATE.fakeLibrary.filter(c => c.id !== id);
  if (STATE.fakeCompound?.id === id) { STATE.fakeCompound = null; }
  saveFakeLibraryToStorage();
  renderLibraryUI();
  renderDiagram();
  showToast('Compound deleted', '');
}

function loadFromLibrary(id) {
  const fc = STATE.fakeLibrary.find(c => c.id === id);
  if (!fc) return;
  STATE.fakeCompound = fc;
  el('fake-name').value = fc.name;
  document.querySelectorAll('.library-item').forEach(li => li.classList.remove('active'));
  document.querySelector(`.library-item[data-id="${id}"]`)?.classList.add('active');
  autoScaleAxesForFake(fc);
  renderDiagram();
}

function updateFakeName() {
  if (STATE.fakeCompound) STATE.fakeCompound.name = el('fake-name')?.value || STATE.fakeCompound.name;
}

function renderLibraryUI() {
  const list = el('library-list');
  const countEl = el('library-count');
  const fillEl  = el('storage-fill');
  if (!list) return;

  const count = STATE.fakeLibrary.length;
  countEl.textContent = `${count} / ${FAKE_LIB_MAX}`;
  fillEl.style.width  = (count / FAKE_LIB_MAX * 100) + '%';

  if (!count) { list.innerHTML = '<div class="empty-hint">No saved compounds yet</div>'; return; }

  list.innerHTML = STATE.fakeLibrary.map(fc => `
    <div class="library-item${STATE.fakeCompound?.id === fc.id ? ' active' : ''}" data-id="${fc.id}" onclick="loadFromLibrary(${fc.id})">
      <span class="library-item-name">⚗ ${fc.name}</span>
      <button class="library-item-del" onclick="event.stopPropagation(); confirmDeleteFake(${fc.id})" title="Delete">✕</button>
    </div>`).join('');
}

function confirmDeleteFake(id) {
  const fc = STATE.fakeLibrary.find(c => c.id === id);
  el('confirm-msg').textContent = `Delete "${fc?.name || 'this compound'}" from your library? This cannot be undone.`;
  el('confirm-delete-btn').onclick = () => { deleteFakeCompound(id); closeModal('modal-confirm'); };
  showModal('modal-confirm');
}

// ── Drag interaction ───────────────────────────────────────────────────────
// Types: 'triple', 'critical', 'sl-handle', 'sv-handle'
function startFakeDrag(pos) {
  const fc = STATE.fakeCompound;
  if (!fc) return false;

  const hits = [
    { type: 'triple',    pt: fc.triplePoint },
    { type: 'critical',  pt: fc.criticalPoint },
    { type: 'sl-handle', pt: fc._handleSL },
    { type: 'sv-handle', pt: fc._handleSV }
  ];

  for (const h of hits) {
    if (!h.pt) continue;
    const cv = dataToCanvas(h.pt.T, h.pt.P);
    const dist = Math.hypot(pos.x - cv.x, pos.y - cv.y);
    if (dist <= DRAG_RADIUS) {
      STATE.drag.active = true;
      STATE.drag.type   = h.type;
      STATE.drag.id     = null;
      return true;
    }
  }
  return false;
}

function continueDrag(pos) {
  if (!STATE.drag.active) return;

  const type = STATE.drag.type;
  const snapped = _snapIfNeeded(pos);
  const data = canvasToData(snapped.x, snapped.y);

  if (type === 'triple' || type === 'critical') {
    _moveFakeKeyPoint(type, data);
  } else if (type === 'sl-handle' || type === 'sv-handle') {
    _moveFakeLineHandle(type, data);
  } else if (type === 'point') {
    if (typeof movePoint === 'function') movePoint(STATE.drag.id, data);
  } else if (type === 'annotation') {
    if (typeof moveAnnotation === 'function') moveAnnotation(STATE.drag.id, data);
  }
}

function _snapIfNeeded(pos) {
  if (!val('snap-to-grid')) return pos;
  const cv = dataToCanvas(STATE.axes.xMin, STATE.axes.yMin);
  const { m, pw, ph } = getPlot();
  const xStep = pw / ((STATE.axes.xMax - STATE.axes.xMin) / STATE.axes.xMajor);
  const yStep = ph / ((STATE.axes.yMax - STATE.axes.yMin) / STATE.axes.yMajor);
  return {
    x: m.left + Math.round((pos.x - m.left) / xStep) * xStep,
    y: m.top  + Math.round((pos.y - m.top)  / yStep) * yStep
  };
}

function _moveFakeKeyPoint(type, data) {
  const fc = STATE.fakeCompound;
  if (!fc) return;

  if (type === 'triple') {
    const dT = data.T - fc.triplePoint.T;
    const dP = data.P - fc.triplePoint.P;
    fc.triplePoint = { T: data.T, P: data.P };
    ['solidLiquidCurve','liquidVaporCurve','solidVaporCurve'].forEach(k => {
      fc[k] = fc[k].map(p => ({ T: p.T + dT, P: p.P + dP }));
    });
    fc._handleSL    = { T: fc._handleSL.T    + dT, P: fc._handleSL.P    + dP };
    fc._handleSV    = { T: fc._handleSV.T    + dT, P: fc._handleSV.P    + dP };
    fc.criticalPoint = { T: fc.criticalPoint.T + dT, P: fc.criticalPoint.P + dP };
    fc._handleLV    = { T: fc._handleLV.T    + dT, P: fc._handleLV.P    + dP };
    if (fc.normalMeltingPoint)
      fc.normalMeltingPoint = { T: fc.normalMeltingPoint.T + dT, P: fc.normalMeltingPoint.P + dP };
    if (fc.normalBoilingPoint)
      fc.normalBoilingPoint = { T: fc.normalBoilingPoint.T + dT, P: fc.normalBoilingPoint.P + dP };

  } else if (type === 'critical') {
    fc.criticalPoint = { T: data.T, P: data.P };
    const lv  = fc.liquidVaporCurve;
    const n   = lv.length;
    const tp  = fc.triplePoint;
    const exp = fc._lvCurve || 1.3;
    for (let i = 0; i < n; i++) {
      const frac  = i / (n - 1);
      const fracP = Math.pow(frac, exp);
      lv[i] = {
        T: tp.T + (data.T - tp.T) * frac,
        P: tp.P + (data.P - tp.P) * fracP
      };
    }
    fc._handleLV = { T: data.T, P: data.P };
    _recalcFakeStandardPoints(fc);
  }
}

// Recalculate NMP and NBP based on current curve state
function _recalcFakeStandardPoints(fc) {
  const oneAtm_disp = UNIT_CONVERSIONS.pressure.fromPa[STATE.pressUnit](101325);
  const tp = fc.triplePoint;
  fc.normalMeltingPoint = tp.P <= oneAtm_disp ? { T: tp.T, P: oneAtm_disp } : null;
  if (fc.criticalPoint.P >= oneAtm_disp && tp.P <= oneAtm_disp) {
    const lv = fc.liquidVaporCurve;
    let nbpT = null;
    for (let i = 0; i < lv.length - 1; i++) {
      const p1 = lv[i].P, p2 = lv[i + 1].P;
      if ((p1 <= oneAtm_disp && p2 >= oneAtm_disp) || (p1 >= oneAtm_disp && p2 <= oneAtm_disp)) {
        const frac = (oneAtm_disp - p1) / (p2 - p1);
        nbpT = lv[i].T + frac * (lv[i + 1].T - lv[i].T);
        break;
      }
    }
    fc.normalBoilingPoint = nbpT != null ? { T: nbpT, P: oneAtm_disp } : null;
  } else {
    fc.normalBoilingPoint = null;
  }
}

function _moveFakeLineHandle(type, data) {
  const fc = STATE.fakeCompound;
  if (!fc) return;
  // Triple point is always the FIXED anchor — only the far end moves
  const tp = fc.triplePoint;

  if (type === 'sl-handle') {
    fc._handleSL = { T: data.T, P: data.P };
    const sl = fc.solidLiquidCurve;
    const n  = sl.length;
    // Enforce: sl[0] stays at triple point
    sl[0] = { T: tp.T, P: tp.P };
    for (let i = 1; i < n; i++) {
      const frac = i / (n - 1);
      sl[i] = {
        T: tp.T + (data.T - tp.T) * frac,
        P: tp.P + (data.P - tp.P) * frac
      };
    }
  } else if (type === 'sv-handle') {
    fc._handleSV = { T: data.T, P: data.P };
    const sv = fc.solidVaporCurve;
    const n  = sv.length;
    // Enforce: sv[n-1] stays at triple point
    sv[n - 1] = { T: tp.T, P: tp.P };
    for (let i = 0; i < n - 1; i++) {
      const frac = i / (n - 1);
      sv[i] = {
        T: data.T + (tp.T - data.T) * frac,
        P: data.P + (tp.P - data.P) * frac
      };
    }
  }
}

function endDrag() { STATE.drag.active = false; }

function findNearDraggable(pos) {
  const fc = STATE.fakeCompound;
  const candidates = [];
  if (STATE.mode === 'fake' && fc) {
    [fc.triplePoint, fc.criticalPoint, fc._handleSL, fc._handleSV].forEach(pt => {
      if (!pt) return;
      const cv = dataToCanvas(pt.T, pt.P);
      if (Math.hypot(pos.x - cv.x, pos.y - cv.y) <= DRAG_RADIUS) candidates.push(true);
    });
  }
  STATE.points.forEach(pt => {
    const cv = dataToCanvas(pt.T, pt.P);
    if (Math.hypot(pos.x - cv.x, pos.y - cv.y) <= 8) candidates.push(true);
  });
  STATE.annotations.forEach(ann => {
    if (ann.type === 'arrow') {
      const h = dataToCanvas(ann.T,  ann.P);
      const t = dataToCanvas(ann.T2, ann.P2);
      if (Math.hypot(pos.x - h.x, pos.y - h.y) <= 10) candidates.push(true);
      if (Math.hypot(pos.x - t.x, pos.y - t.y) <= 10) candidates.push(true);
    }
  });
  return candidates.length > 0;
}

// ── Fake curve rendering ───────────────────────────────────────────────────
function drawFakeCurves(ctx, m, pw, ph) {
  const fc = STATE.fakeCompound;
  if (!fc) return;

  const drawCurve = (pts, color, width) => {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, pw, ph);
    ctx.clip();
    ctx.beginPath();
    catmullRom(ctx, toCvs(pts));
    ctx.strokeStyle = color;
    ctx.lineWidth   = width;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  };

  const { sl, lv, sv } = STATE.boundaries;
  drawCurve(fc.solidLiquidCurve, sl.color, sl.width);
  drawCurve(fc.liquidVaporCurve, lv.color, lv.width);
  drawCurve(fc.solidVaporCurve,  sv.color, sv.width);

  // Draw drag handles (not in export mode)
  if (!STATE._exporting) _drawFakeDragHandles(ctx, fc);
}

function _drawFakeDragHandles(ctx, fc) {
  const handles = [
    { pt: fc.triplePoint,  label: '⊕', color: '#e74c3c' },
    { pt: fc.criticalPoint,label: '⊕', color: '#8e44ad' },
    { pt: fc._handleSL,    label: '▪', color: '#3498db' },
    { pt: fc._handleSV,    label: '▪', color: '#27ae60' }
  ];
  handles.forEach(h => {
    if (!h.pt) return;
    const cv = dataToCanvas(h.pt.T, h.pt.P);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cv.x, cv.y, DRAG_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle   = hexToRgba(h.color, 0.18);
    ctx.strokeStyle = h.color;
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawFakeRegions(ctx, m, pw, ph) {
  const fc = STATE.fakeCompound;
  if (!fc) return;
  // Re-use the same region fill logic as real compounds, using fc as the data source
  const saved = STATE.compoundData;
  STATE.compoundData = fc;
  if (typeof drawRealRegions === 'function') drawRealRegions(ctx, m, pw, ph);
  STATE.compoundData = saved;
}
