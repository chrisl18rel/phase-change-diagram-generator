// phase-diagram-controls.js

// ── State ──────────────────────────────────────────────────────────────────
const STATE = {
  mode: 'real',
  compoundKey: null,
  compoundData: null,       // curves/points converted to current display units
  fakeCompound: null,       // active fake compound object
  tempUnit: 'C',
  pressUnit: 'atm',

  axes: { xMin: -100, xMax: 500, yMin: 0, yMax: 250,
          xMajor: 100, xMinor: 25, yMajor: 50, yMinor: 10, showGrid: true },

  zoom: 100,

  style: { titleText: '', titleSize: 18, titleColor: '#111111',
           labelSize: 13, labelColor: '#333333',
           tickSize: 11,  tickColor: '#444444' },

  regions: {
    solid:  { fill: false, color: '#b3cde3', opacity: 35, showLabel: false },
    liquid: { fill: false, color: '#8ec6f7', opacity: 35, showLabel: false },
    gas:    { fill: false, color: '#fde8a8', opacity: 35, showLabel: false },
    super:  { fill: false, color: '#d4aadd', opacity: 30, showLabel: false },
    labelSize: 14, labelColor: '#333333'
  },

  boundaries: { sl: { color: '#222222', width: 2 }, lv: { color: '#222222', width: 2 },
                sv: { color: '#222222', width: 2 }, showAnomaly: false, anomalyColor: '#e74c3c' },

  markers: {
    triple:   { show: true,  color: '#e74c3c', size: 6, label: 'Triple Point',        pair: false, lines: false, lineColor: '#e74c3c', lineWidth: 1 },
    critical: { show: true,  color: '#8e44ad', size: 6, label: 'Critical Point',       pair: false, lines: false, lineColor: '#8e44ad', lineWidth: 1 },
    nmp:      { show: false, color: '#2980b9', size: 5, label: 'Normal Melting Point', pair: false, lines: false, lineColor: '#2980b9', lineWidth: 1 },
    nbp:      { show: false, color: '#27ae60', size: 5, label: 'Normal Boiling Point', pair: false, lines: false, lineColor: '#27ae60', lineWidth: 1 }
  },

  points: [],
  annotations: [],
  fakeLibrary: [],

  drag: { active: false, type: null, id: null, ox: 0, oy: 0, pendingClick: null },

  canvas: { w: 800, h: 600, margin: { top: 60, right: 50, bottom: 72, left: 88 } }
};

const BASE_W = 800, BASE_H = 600;

// ── Shared utility — used by controls & fake.js ────────────────────────────
function niceTick(range) {
  if (range <= 0) return 1;
  const raw = range / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n   = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

// ── DOM helpers ────────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id);
const val = (id) => { const e = el(id); if (!e) return null; return e.type === 'checkbox' ? e.checked : e.value; };
const numVal = (id, def = 0) => parseFloat(val(id)) || def;
const setInp = (id, v) => { const e = el(id); if (e) e.value = v; };

function syncStateFromDOM() {
  const { style, axes, regions, boundaries, markers } = STATE;
  style.titleText  = val('chart-title') || '';
  style.titleSize  = numVal('title-size', 18);
  style.titleColor = val('title-color') || '#111111';
  style.labelSize  = numVal('label-size', 13);
  style.labelColor = val('label-color') || '#333333';
  style.tickSize   = numVal('tick-size', 11);
  style.tickColor  = val('tick-color') || '#444444';

  axes.xMin = numVal('x-min', -100); axes.xMax = numVal('x-max', 500);
  axes.xMajor = numVal('x-major', 100); axes.xMinor = numVal('x-minor', 25);
  axes.yMin = numVal('y-min', 0); axes.yMax = numVal('y-max', 250);
  axes.yMajor = numVal('y-major', 50); axes.yMinor = numVal('y-minor', 10);
  axes.showGrid = val('toggle-grid');

  ['solid','liquid','gas','super'].forEach(r => {
    regions[r].fill      = val(`fill-${r}`);
    regions[r].color     = val(`color-${r}`) || '#cccccc';
    regions[r].opacity   = parseInt(el(`opacity-${r}`)?.value) || 35;
    regions[r].showLabel = val(`label-${r}`);
  });
  regions.labelSize  = numVal('region-label-size', 14);
  regions.labelColor = val('region-label-color') || '#333333';

  ['sl','lv','sv'].forEach(k => {
    boundaries[k].color = val(`line-${k}`) || '#222222';
    boundaries[k].width = numVal(`width-${k}`, 2);
  });
  boundaries.showAnomaly  = val('toggle-anomaly');
  boundaries.anomalyColor = val('anomaly-color') || '#e74c3c';

  ['triple','critical','nmp','nbp'].forEach(m => {
    const mk = markers[m];
    mk.show      = val(`show-${m}`);
    mk.color     = val(`${m}-color`) || '#333333';
    mk.size      = numVal(`${m}-size`, 5);
    mk.label     = val(`${m}-label`) || '';
    mk.pair      = val(`${m}-pair`);
    mk.lines     = val(`${m}-lines`);
    mk.lineColor = val(`${m}-line-color`) || '#333333';
    mk.lineWidth = numVal(`${m}-line-width`, 1);
  });
}

// ── Coordinate math ────────────────────────────────────────────────────────
function getPlot() {
  const m = STATE.canvas.margin;
  return { m, pw: BASE_W - m.left - m.right, ph: BASE_H - m.top - m.bottom };
}

function dataToCanvas(T, P) {
  const { m, pw, ph } = getPlot();
  const { xMin, xMax, yMin, yMax } = STATE.axes;
  return {
    x: m.left + (T - xMin) / (xMax - xMin) * pw,
    y: m.top  + (1 - (P - yMin) / (yMax - yMin)) * ph
  };
}

function canvasToData(cx, cy) {
  const { m, pw, ph } = getPlot();
  const { xMin, xMax, yMin, yMax } = STATE.axes;
  return {
    T: xMin + (cx - m.left) / pw * (xMax - xMin),
    P: yMin + (1 - (cy - m.top) / ph) * (yMax - yMin)
  };
}

function inPlotArea(cx, cy) {
  const { m, pw, ph } = getPlot();
  return cx >= m.left && cx <= m.left + pw && cy >= m.top && cy <= m.top + ph;
}

function getCanvasPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (BASE_W / rect.width),
    y: (e.clientY - rect.top)  * (BASE_H / rect.height)
  };
}

// ── Accordion ──────────────────────────────────────────────────────────────
function togglePanel(id) {
  el(id)?.classList.toggle('open');
}

// ── Mode toggle ────────────────────────────────────────────────────────────
function setMode(mode) {
  STATE.mode = mode;
  el('btn-mode-real').classList.toggle('active', mode === 'real');
  el('btn-mode-fake').classList.toggle('active', mode === 'fake');
  el('section-real').style.display        = mode === 'real' ? 'flex' : 'none';
  el('section-fake').style.display        = mode === 'fake' ? 'flex' : 'none';
  el('section-real').style.flexDirection  = 'column';
  el('section-fake').style.flexDirection  = 'column';
  el('panel-fake-controls').style.display = mode === 'fake' ? '' : 'none';
  if (mode === 'fake') el('panel-fake-controls').style.display = '';
  renderDiagram();
}

// ── Compound loading ───────────────────────────────────────────────────────
function loadCompound(key) {
  if (!key) { STATE.compoundKey = null; STATE.compoundData = null; renderDiagram(); return; }
  STATE.compoundKey = key;
  STATE.compoundData = getCompoundInDisplayUnits(key, STATE.tempUnit, STATE.pressUnit);
  updateCompoundInfoCard();
  updateWaterAnomalyUI();
  renderDiagram();
}

function updateCompoundInfoCard() {
  const cd = STATE.compoundData;
  const src = COMPOUND_DATA[STATE.compoundKey];
  if (!cd || !src) { el('compound-info').classList.remove('visible'); return; }

  el('compound-info').classList.add('visible');
  el('info-name').textContent    = src.name;
  el('info-formula').textContent = src.formula;

  const fmtT = (pt) => pt ? `${formatVal(pt.T)} ${UNIT_CONVERSIONS.temperature.symbols[STATE.tempUnit]}` : '—';
  const fmtP = (pt) => pt ? `${formatVal(pt.P)} ${STATE.pressUnit}` : '—';

  el('info-stats').innerHTML = `
    <div class="stat-row"><span class="stat-label">Triple Point T</span><span class="stat-val">${fmtT(cd.triplePoint)}</span></div>
    <div class="stat-row"><span class="stat-label">Triple Point P</span><span class="stat-val">${fmtP(cd.triplePoint)}</span></div>
    <div class="stat-row"><span class="stat-label">Critical Point T</span><span class="stat-val">${fmtT(cd.criticalPoint)}</span></div>
    <div class="stat-row"><span class="stat-label">Critical Point P</span><span class="stat-val">${fmtP(cd.criticalPoint)}</span></div>
    <div class="stat-row"><span class="stat-label">Normal Boiling / Sub. Pt</span><span class="stat-val">${fmtT(cd.normalBoilingPoint)}</span></div>`;

  el('sublimate-note').classList.toggle('visible', !!src.sublimatesAtSTP);
}

function updateWaterAnomalyUI() {
  const src = COMPOUND_DATA[STATE.compoundKey];
  const isWater = src?.negativeSlope;
  el('water-anomaly-section').style.display = isWater ? 'flex' : 'none';
  el('water-anomaly-badge').classList.toggle('visible', isWater);
  if (isWater) el('anomaly-text').textContent = src.negativeSlopeNote;
}

function filterCompounds(query) {
  const q = query.toLowerCase();
  const sel = el('compound-select');
  Array.from(sel.options).forEach(opt => {
    if (!opt.value) return;
    opt.style.display = opt.text.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── Units ──────────────────────────────────────────────────────────────────
function setTempUnit(unit, btn) {
  STATE.tempUnit = unit;
  el('temp-unit-group').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (STATE.compoundKey) STATE.compoundData = getCompoundInDisplayUnits(STATE.compoundKey, unit, STATE.pressUnit);
  updateAxisLabels();
  renderDiagram();
}

function setPressUnit(unit, btn) {
  STATE.pressUnit = unit;
  el('press-unit-group').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (STATE.compoundKey) STATE.compoundData = getCompoundInDisplayUnits(STATE.compoundKey, STATE.tempUnit, unit);
  updateAxisLabels();
  renderDiagram();
}

function updateAxisLabels() {
  el('xaxis-label').textContent = UNIT_CONVERSIONS.temperature.labels[STATE.tempUnit];
  el('yaxis-label').textContent = UNIT_CONVERSIONS.pressure.labels[STATE.pressUnit];
  if (el('nbp-label') && COMPOUND_DATA[STATE.compoundKey]?.sublimatesAtSTP) {
    el('nbp-label').value = 'Normal Sublimation Point';
  }
}

// ── Axes ───────────────────────────────────────────────────────────────────
function updateAxes() { syncStateFromDOM(); renderDiagram(); }

function autoScaleAxes() {
  const cd = STATE.compoundData;
  if (!cd) { showToast('Load a compound first', 'error'); return; }

  const allT = [], allP = [];
  ['liquidVaporCurve','solidVaporCurve','solidLiquidCurve'].forEach(k => {
    (cd[k] || []).forEach(pt => { allT.push(pt.T); allP.push(pt.P); });
  });
  if (!allT.length) return;

  const pad = (mn, mx, f) => [mn - (mx-mn)*f, mx + (mx-mn)*f];
  const [tMin, tMax] = pad(Math.min(...allT), Math.max(...allT), 0.15);
  const [, pMax]     = pad(0, Math.max(...allP), 0.15);

  const xMaj = niceTick(tMax - tMin), yMaj = niceTick(pMax);
  setInp('x-min',   Math.floor(tMin / xMaj) * xMaj);
  setInp('x-max',   Math.ceil(tMax  / xMaj) * xMaj);
  setInp('x-major', xMaj);
  setInp('x-minor', parseFloat((xMaj / 4).toPrecision(2)));
  setInp('y-min',   0);
  setInp('y-max',   Math.ceil(pMax / yMaj) * yMaj);
  setInp('y-major', yMaj);
  setInp('y-minor', parseFloat((yMaj / 5).toPrecision(2)));

  syncStateFromDOM();
  renderDiagram();
  showToast('Axes auto-scaled', 'success');
}

// ── Zoom ───────────────────────────────────────────────────────────────────
function setZoom(v) {
  STATE.zoom = parseInt(v);
  el('zoom-val').textContent = el('zoom-display').textContent = STATE.zoom + '%';
  applyZoom();
}
function adjustZoom(delta) {
  const z = Math.max(40, Math.min(250, STATE.zoom + delta));
  setInp('zoom-slider', z);
  setZoom(z);
}
function resetZoom() { setInp('zoom-slider', 100); setZoom(100); }
function applyZoom() {
  const c = el('phaseDiagramCanvas');
  c.style.width  = (BASE_W * STATE.zoom / 100) + 'px';
  c.style.height = (BASE_H * STATE.zoom / 100) + 'px';
}

// ── Toast & Modal ──────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  el('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function closeModal(id) { el(id)?.classList.remove('open'); }

function showModal(id) { el(id)?.classList.add('open'); }

// ── Canvas events ──────────────────────────────────────────────────────────
function bindCanvasEvents() {
  const canvas = el('phaseDiagramCanvas');

  canvas.addEventListener('mousedown', e => {
    const pos = getCanvasPos(canvas, e);
    if (STATE.mode === 'fake' && typeof startFakeDrag === 'function' && startFakeDrag(pos)) return;
    if (typeof startPointDrag === 'function' && startPointDrag(pos)) return;
    if (typeof startAnnotationDrag === 'function' && startAnnotationDrag(pos)) return;
    STATE.drag.pendingClick = { ...pos };
  });

  canvas.addEventListener('mousemove', e => {
    const pos = getCanvasPos(canvas, e);
    if (STATE.drag.active) {
      if (typeof continueDrag === 'function') continueDrag(pos);
      renderDiagram();
    } else {
      updateCursorStyle(canvas, pos);
    }
  });

  canvas.addEventListener('mouseup', e => {
    const pos = getCanvasPos(canvas, e);
    if (STATE.drag.active) {
      if (typeof endDrag === 'function') endDrag(pos);
    } else if (STATE.drag.pendingClick && inPlotArea(pos.x, pos.y)) {
      // Annotation intercept takes priority over point placement
      const intercepted = typeof handleAnnotationClick === 'function' && handleAnnotationClick(pos);
      if (!intercepted && typeof addUserPoint === 'function') addUserPoint(pos);
    }
    STATE.drag.active = false;
    STATE.drag.pendingClick = null;
    renderDiagram();
  });

  canvas.addEventListener('mouseleave', () => {
    STATE.drag.active = false;
    STATE.drag.pendingClick = null;
    canvas.style.cursor = 'crosshair';
    renderDiagram();
  });
}

function updateCursorStyle(canvas, pos) {
  const near = (typeof findNearDraggable === 'function') ? findNearDraggable(pos) : null;
  canvas.style.cursor = near ? 'grab' : inPlotArea(pos.x, pos.y) ? 'crosshair' : 'default';
}

// ── Main render orchestrator ───────────────────────────────────────────────
function renderDiagram() {
  syncStateFromDOM();
  const canvas = el('phaseDiagramCanvas');
  const ctx = canvas.getContext('2d');
  applyZoom();

  ctx.clearRect(0, 0, BASE_W, BASE_H);

  // Skip white background when exporting with transparency enabled
  if (!STATE._exportTransparent) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, BASE_W, BASE_H);
  }

  const { m, pw, ph } = getPlot();

  // Clip to plot area for fills
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.left, m.top, pw, ph);
  ctx.clip();

  if (STATE.axes.showGrid && typeof drawGrid === 'function') drawGrid(ctx, m, pw, ph);

  if (STATE.mode === 'real' && STATE.compoundData) {
    if (typeof drawRealRegions === 'function') drawRealRegions(ctx, m, pw, ph);
    if (typeof drawRealCurves  === 'function') drawRealCurves(ctx, m, pw, ph);
  } else if (STATE.mode === 'fake' && STATE.fakeCompound) {
    if (typeof drawFakeRegions === 'function') drawFakeRegions(ctx, m, pw, ph);
    if (typeof drawFakeCurves  === 'function') drawFakeCurves(ctx, m, pw, ph);
  }

  ctx.restore(); // end clip

  if (typeof drawAxes    === 'function') drawAxes(ctx, m, pw, ph);
  if (typeof drawTitle   === 'function') drawTitle(ctx);
  if (typeof drawMarkers === 'function') drawMarkers(ctx);
  if (typeof renderPoints === 'function') renderPoints(ctx);
  if (typeof renderAnnotations === 'function') renderAnnotations(ctx, STATE._exporting);
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadFakeLibrary === 'function') loadFakeLibrary();
  bindCanvasEvents();
  updateAxisLabels();
  renderDiagram();
});
