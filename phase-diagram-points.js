// phase-diagram-points.js

let _pointCounter = 0;

// ── Add a point on canvas click ────────────────────────────────────────────
function addUserPoint(pos) {
  const data = canvasToData(pos.x, pos.y);
  _pointCounter++;
  const pt = {
    id:        _pointCounter,
    T:         data.T,
    P:         data.P,
    label:     `P${_pointCounter}`,
    color:     val('default-point-color') || '#e67e22',
    size:      numVal('default-point-size', 5),
    showLines: val('default-point-lines'),
    showPair:  val('default-point-pair'),
    lineColor: val('default-point-color') || '#e67e22',
    lineWidth: 1,
    annotation: ''
  };
  STATE.points.push(pt);
  el('points-hint').style.display = 'none';
  buildPointCard(pt);
  if (typeof _refreshAttachDropdowns === 'function') _refreshAttachDropdowns();
  renderDiagram();
}

// ── Render all user points ─────────────────────────────────────────────────
function renderPoints(ctx) {
  const { xMin, xMax, yMin, yMax } = STATE.axes;
  STATE.points.forEach(pt => {
    if (pt.T < xMin || pt.T > xMax || pt.P < yMin || pt.P > yMax) return;
    const cv = dataToCanvas(pt.T, pt.P);

    // Dotted lines
    if (pt.showLines) {
      drawDottedLines(ctx, cv, pt.lineColor, pt.lineWidth);
    }

    // Dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(cv.x, cv.y, pt.size, 0, Math.PI * 2);
    ctx.fillStyle   = pt.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth   = 1.2;
    ctx.stroke();
    ctx.restore();

    // Label — with optional drag override
    STATE._pointLabelBoxes = STATE._pointLabelBoxes || {};
    {
      ctx.save();
      ctx.fillStyle    = pt.color;
      ctx.font         = `600 11px DM Sans, sans-serif`;
      const lw = ctx.measureText(pt.label).width;
      const lh = 13;
      const ov = STATE.labelOverrides?.[`pt:${pt.id}:label`];
      const lx = cv.x + (ov != null ? ov.dx : pt.size + 4);
      const ly = cv.y + (ov != null ? ov.dy : -2 - lh);
      STATE._pointLabelBoxes[`pt:${pt.id}:label`] = { x: lx, y: ly, w: lw, h: lh };
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(pt.label, lx, ly);
      ctx.restore();
    }

    // Ordered pair — with optional drag override
    if (pt.showPair) {
      const pair = `(${formatVal(pt.T)}, ${formatVal(pt.P)})`;
      ctx.save();
      ctx.fillStyle    = pt.color;
      ctx.font         = `11px DM Mono, monospace`;
      const pw2 = ctx.measureText(pair).width;
      const ph2 = 12;
      const ov  = STATE.labelOverrides?.[`pt:${pt.id}:pair`];
      const px  = cv.x + (ov != null ? ov.dx : pt.size + 4);
      const py  = cv.y + (ov != null ? ov.dy : 2);
      STATE._pointLabelBoxes[`pt:${pt.id}:pair`] = { x: px, y: py, w: pw2, h: ph2 };
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(pair, px, py);
      ctx.restore();
    }
  });
}

// ── Drag ───────────────────────────────────────────────────────────────────
function startPointDrag(pos) {
  for (let i = STATE.points.length - 1; i >= 0; i--) {
    const pt = STATE.points[i];
    const cv = dataToCanvas(pt.T, pt.P);
    if (Math.hypot(pos.x - cv.x, pos.y - cv.y) <= 8) {
      STATE.drag.active = true;
      STATE.drag.type   = 'point';
      STATE.drag.id     = pt.id;
      return true;
    }
  }
  return false;
}

function movePoint(id, data) {
  const pt = STATE.points.find(p => p.id === id);
  if (pt) { pt.T = data.T; pt.P = data.P; updatePointCardCoords(pt); }
}

// ── Sidebar cards ──────────────────────────────────────────────────────────
function buildPointCard(pt) {
  const list = el('point-list');
  const card = document.createElement('div');
  card.className = 'point-card';
  card.id = `point-card-${pt.id}`;
  card.innerHTML = `
    <div class="point-card-header">
      <span class="point-card-label" id="pt-lbl-${pt.id}">${pt.label}</span>
      <span class="point-card-coords" id="pt-coords-${pt.id}">(${formatVal(pt.T)}, ${formatVal(pt.P)})</span>
    </div>
    <div class="point-card-controls">
      <div class="field">
        <label>Label</label>
        <input type="text" value="${pt.label}" oninput="updatePointProp(${pt.id},'label',this.value)">
      </div>
      <div class="color-row">
        <label>Color</label>
        <input type="color" value="${pt.color}" oninput="updatePointProp(${pt.id},'color',this.value)">
      </div>
    </div>
    <div class="point-card-controls">
      <div class="field">
        <label>Dot Size</label>
        <input type="number" value="${pt.size}" min="2" max="16" oninput="updatePointProp(${pt.id},'size',parseFloat(this.value))">
      </div>
      <div class="field">
        <label>Line Width</label>
        <input type="number" value="${pt.lineWidth}" min="0.5" max="6" step="0.5" oninput="updatePointProp(${pt.id},'lineWidth',parseFloat(this.value))">
      </div>
    </div>
    <div class="toggle-wrap">
      <span class="toggle-label">Dotted Lines</span>
      <label class="toggle-switch">
        <input type="checkbox" ${pt.showLines ? 'checked' : ''} onchange="updatePointProp(${pt.id},'showLines',this.checked)">
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="color-row">
      <label>Line Color</label>
      <input type="color" value="${pt.lineColor}" oninput="updatePointProp(${pt.id},'lineColor',this.value)">
    </div>
    <div class="toggle-wrap">
      <span class="toggle-label">Ordered Pair</span>
      <label class="toggle-switch">
        <input type="checkbox" ${pt.showPair ? 'checked' : ''} onchange="updatePointProp(${pt.id},'showPair',this.checked)">
        <span class="toggle-slider"></span>
      </label>
    </div>
    <button class="btn btn-red btn-sm" style="margin-top:4px;" onclick="removePoint(${pt.id})">Remove Point</button>`;
  list.appendChild(card);
  if (typeof initColorSwatches === 'function') initColorSwatches();
}

function updatePointCardCoords(pt) {
  const el2 = document.getElementById(`pt-coords-${pt.id}`);
  if (el2) el2.textContent = `(${formatVal(pt.T)}, ${formatVal(pt.P)})`;
}

function updatePointProp(id, prop, value) {
  const pt = STATE.points.find(p => p.id === id);
  if (!pt) return;
  pt[prop] = value;
  if (prop === 'label') {
    const lbl = document.getElementById(`pt-lbl-${id}`);
    if (lbl) lbl.textContent = value;
    // Keep arrow attachment dropdowns in sync with the new label
    if (typeof _refreshAttachDropdowns === 'function') _refreshAttachDropdowns();
  }
  renderDiagram();
}

function removePoint(id) {
  STATE.points = STATE.points.filter(p => p.id !== id);
  document.getElementById(`point-card-${id}`)?.remove();
  if (!STATE.points.length) el('points-hint').style.display = '';
  if (typeof _refreshAttachDropdowns === 'function') _refreshAttachDropdowns();
  renderDiagram();
}
