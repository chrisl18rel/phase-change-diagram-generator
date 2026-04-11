// phase-diagram-annotations.js

const ANN_MAX_WIDTH  = 180;  // max text-box width in canvas px
const ANN_HANDLE_R   = 8;    // radius for arrow endpoint handles

let _annotCounter     = 0;
let _pendingAnnotType = null;   // 'text' | 'arrow-start' | 'arrow-end'
let _arrowStart       = null;   // canvas pos of first arrow click (= head)

// ── Start add modes ────────────────────────────────────────────────────────
function startAddTextAnnotation() {
  _pendingAnnotType = 'text';
  el('phaseDiagramCanvas').style.cursor = 'text';
  showToast('Click on the graph to place a text box', '');
}

function startAddArrow() {
  _pendingAnnotType = 'arrow-start';
  el('phaseDiagramCanvas').style.cursor = 'crosshair';
  showToast('Click to place the arrow HEAD (tip), then click again for the tail', '');
}

// ── Text wrap helper ───────────────────────────────────────────────────────
function _wrapText(ctx, text, maxWidth) {
  if (!text) return [''];
  const lines = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}

// ── Hit-test: is canvas pos inside a rendered text box? ───────────────────
function _pointInTextBox(pos, ann) {
  const cv  = dataToCanvas(ann.T, ann.P);
  const pad = 6;
  const ctx = el('phaseDiagramCanvas').getContext('2d');
  ctx.font  = `${ann.fontSize}px DM Sans, sans-serif`;
  const lines = _wrapText(ctx, ann.text, ANN_MAX_WIDTH);
  const lineH = ann.fontSize + 4;
  const bw = Math.min(
    Math.max(...lines.map(l => ctx.measureText(l).width), 20),
    ANN_MAX_WIDTH
  ) + pad * 2;
  const bh = lines.length * lineH + pad * 2;
  return pos.x >= cv.x         && pos.x <= cv.x + bw &&
         pos.y >= cv.y - bh/2  && pos.y <= cv.y + bh/2;
}

// ── Click intercept ────────────────────────────────────────────────────────
// Called by controls.js before addUserPoint. Returns true if click consumed.
function handleAnnotationClick(pos) {
  if (_pendingAnnotType === 'text') {
    _placeTextAnnotation(pos);
    el('phaseDiagramCanvas').style.cursor = 'crosshair';
    _pendingAnnotType = null;
    return true;
  }
  if (_pendingAnnotType === 'arrow-start') {
    _arrowStart = pos;          // head = first click
    _pendingAnnotType = 'arrow-end';
    showToast('Now click to place the arrow TAIL', '');
    return true;
  }
  if (_pendingAnnotType === 'arrow-end') {
    _placeArrowAnnotation(_arrowStart, pos);   // head, tail
    _pendingAnnotType = null;
    _arrowStart = null;
    el('phaseDiagramCanvas').style.cursor = 'crosshair';
    return true;
  }

  // Normal mode: consume clicks inside existing text boxes so no point is created
  const hit = STATE.annotations.find(a => a.type === 'text' && _pointInTextBox(pos, a));
  return !!hit;
}

// ── Place ──────────────────────────────────────────────────────────────────
function _placeTextAnnotation(pos) {
  const data = canvasToData(pos.x, pos.y);
  _annotCounter++;
  const ann = {
    id: _annotCounter, type: 'text',
    T: data.T, P: data.P,
    text:        'Annotation',
    fontSize:    12,
    fontColor:   '#111111',
    bgColor:     '#ffffff',
    bgOpacity:   85,
    showBorder:  true,
    borderColor: '#333333'
  };
  STATE.annotations.push(ann);
  el('annotations-hint').style.display = 'none';
  buildAnnotationCard(ann);
  renderDiagram();
}

function _placeArrowAnnotation(headPos, tailPos) {
  // ann.T/P = HEAD (first click, where arrowhead is drawn)
  // ann.T2/P2 = TAIL (second click, the other end)
  const h = canvasToData(headPos.x, headPos.y);
  const t = canvasToData(tailPos.x,  tailPos.y);
  _annotCounter++;
  const ann = {
    id: _annotCounter, type: 'arrow',
    T:  h.T, P:  h.P,    // head
    T2: t.T, P2: t.P,    // tail
    color: '#333333',
    width: 1.5,
    label: ''
  };
  STATE.annotations.push(ann);
  el('annotations-hint').style.display = 'none';
  buildAnnotationCard(ann);
  renderDiagram();
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderAnnotations(ctx, isExport) {
  if (!val('export-annotations') && isExport) return;
  STATE.annotations.forEach(ann => {
    if (ann.type === 'text')  _renderTextAnnotation(ctx, ann, isExport);
    if (ann.type === 'arrow') _renderArrowAnnotation(ctx, ann, isExport);
  });
}

function _renderTextAnnotation(ctx, ann, isExport) {
  const cv  = dataToCanvas(ann.T, ann.P);
  const pad = 6;

  ctx.save();
  ctx.font = `${ann.fontSize}px DM Sans, sans-serif`;
  const lines = _wrapText(ctx, ann.text, ANN_MAX_WIDTH);
  const lineH = ann.fontSize + 4;
  const bw = Math.min(
    Math.max(...lines.map(l => ctx.measureText(l).width), 20),
    ANN_MAX_WIDTH
  ) + pad * 2;
  const bh = lines.length * lineH + pad * 2;

  if (ann.bgOpacity > 0) {
    ctx.fillStyle = hexToRgba(ann.bgColor, ann.bgOpacity / 100);
    _roundRect(ctx, cv.x, cv.y - bh/2, bw, bh, 3);
    ctx.fill();
  }
  if (ann.showBorder) {
    ctx.strokeStyle = ann.borderColor;
    ctx.lineWidth   = 1;
    _roundRect(ctx, cv.x, cv.y - bh/2, bw, bh, 3);
    ctx.stroke();
  }

  ctx.fillStyle    = ann.fontColor;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  const textTop = cv.y - bh/2 + pad;
  lines.forEach((line, i) => ctx.fillText(line, cv.x + pad, textTop + i * lineH));

  if (!isExport) {
    ctx.strokeStyle = 'rgba(74,144,226,0.4)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(cv.x - 2, cv.y - bh/2 - 2, bw + 4, bh + 4);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function _renderArrowAnnotation(ctx, ann, isExport) {
  // ann.T/P = head (arrowhead drawn here), ann.T2/P2 = tail
  const head = dataToCanvas(ann.T,  ann.P);
  const tail = dataToCanvas(ann.T2, ann.P2);

  ctx.save();
  ctx.strokeStyle = ann.color;
  ctx.lineWidth   = ann.width;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';

  // Line: tail → head
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();

  // Arrowhead at HEAD (first click / ann.T,P)
  const angle = Math.atan2(head.y - tail.y, head.x - tail.x);
  const hLen  = 10 + ann.width;
  ctx.beginPath();
  ctx.moveTo(head.x, head.y);
  ctx.lineTo(head.x - hLen * Math.cos(angle - 0.38), head.y - hLen * Math.sin(angle - 0.38));
  ctx.moveTo(head.x, head.y);
  ctx.lineTo(head.x - hLen * Math.cos(angle + 0.38), head.y - hLen * Math.sin(angle + 0.38));
  ctx.stroke();

  // Label at midpoint
  if (ann.label) {
    ctx.fillStyle    = ann.color;
    ctx.font         = `${11 + ann.width}px DM Sans, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    const mx = (head.x + tail.x) / 2;
    const my = Math.min(head.y, tail.y) - 4;
    ctx.fillText(ann.label, mx, my);
  }

  // Drag handles at both ends (non-export only)
  if (!isExport) {
    [
      { pt: head, label: '▲' },   // head handle
      { pt: tail, label: '●' }    // tail handle
    ].forEach(h => {
      ctx.beginPath();
      ctx.arc(h.pt.x, h.pt.y, ANN_HANDLE_R, 0, Math.PI * 2);
      ctx.fillStyle   = hexToRgba(ann.color, 0.20);
      ctx.strokeStyle = ann.color;
      ctx.lineWidth   = 1.5;
      ctx.fill();
      ctx.stroke();
    });
  }

  ctx.restore();
}

// ── Cross-browser roundRect ────────────────────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
}

// ── Drag ───────────────────────────────────────────────────────────────────
function startAnnotationDrag(pos) {
  for (let i = STATE.annotations.length - 1; i >= 0; i--) {
    const ann = STATE.annotations[i];

    if (ann.type === 'arrow') {
      const head = dataToCanvas(ann.T,  ann.P);
      const tail = dataToCanvas(ann.T2, ann.P2);

      if (Math.hypot(pos.x - head.x, pos.y - head.y) <= ANN_HANDLE_R + 2) {
        STATE.drag.active   = true;
        STATE.drag.type     = 'annotation';
        STATE.drag.id       = ann.id;
        STATE.drag.endpoint = 'head';
        return true;
      }
      if (Math.hypot(pos.x - tail.x, pos.y - tail.y) <= ANN_HANDLE_R + 2) {
        STATE.drag.active   = true;
        STATE.drag.type     = 'annotation';
        STATE.drag.id       = ann.id;
        STATE.drag.endpoint = 'tail';
        return true;
      }
    }

    if (ann.type === 'text' && _pointInTextBox(pos, ann)) {
      STATE.drag.active   = true;
      STATE.drag.type     = 'annotation';
      STATE.drag.id       = ann.id;
      STATE.drag.endpoint = null;
      return true;
    }
  }
  return false;
}

function moveAnnotation(id, data) {
  const ann = STATE.annotations.find(a => a.id === id);
  if (!ann) return;

  if (ann.type === 'arrow') {
    const ep = STATE.drag.endpoint;
    if (ep === 'head') {
      ann.T  = data.T;
      ann.P  = data.P;
    } else if (ep === 'tail') {
      ann.T2 = data.T;
      ann.P2 = data.P;
    }
  } else {
    // Text box: move whole annotation
    ann.T = data.T;
    ann.P = data.P;
  }
}

// ── Sidebar cards ──────────────────────────────────────────────────────────
function buildAnnotationCard(ann) {
  const list = el('annotation-list');
  const card = document.createElement('div');
  card.className = 'point-card';
  card.id = `ann-card-${ann.id}`;

  if (ann.type === 'text') {
    card.innerHTML = `
      <div class="point-card-header">
        <span class="point-card-label">✏ Text Box #${ann.id}</span>
      </div>
      <div class="field">
        <label>Text</label>
        <textarea id="ann-text-${ann.id}" rows="3"
          oninput="updateAnnProp(${ann.id},'text',this.value)"
        >${ann.text}</textarea>
      </div>
      <div class="point-card-controls">
        <div class="field"><label>Font Size</label>
          <input type="number" value="${ann.fontSize}" min="8" max="36"
            oninput="updateAnnProp(${ann.id},'fontSize',parseFloat(this.value))"></div>
        <div class="color-row"><label>Font Color</label>
          <input type="color" value="${ann.fontColor}"
            oninput="updateAnnProp(${ann.id},'fontColor',this.value)"></div>
      </div>
      <div class="point-card-controls">
        <div class="color-row"><label>BG Color</label>
          <input type="color" value="${ann.bgColor}"
            oninput="updateAnnProp(${ann.id},'bgColor',this.value)"></div>
        <div class="color-row"><label>Border</label>
          <input type="color" value="${ann.borderColor}"
            oninput="updateAnnProp(${ann.id},'borderColor',this.value)"></div>
      </div>
      <div class="toggle-wrap">
        <span class="toggle-label">Show Border</span>
        <label class="toggle-switch">
          <input type="checkbox" ${ann.showBorder ? 'checked' : ''}
            onchange="updateAnnProp(${ann.id},'showBorder',this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <button class="btn btn-red btn-sm" style="margin-top:6px;"
        onclick="removeAnnotation(${ann.id})">Remove</button>`;
  } else {
    card.innerHTML = `
      <div class="point-card-header">
        <span class="point-card-label">→ Arrow #${ann.id}</span>
      </div>
      <div class="empty-hint" style="text-align:left; font-style:normal; font-size:0.69rem; color:var(--text-muted);">
        Drag the ▲ handle to move the <strong>head</strong>, drag ● to move the <strong>tail</strong>.
      </div>
      <div class="field"><label>Label (optional)</label>
        <input type="text" value="${ann.label}"
          oninput="updateAnnProp(${ann.id},'label',this.value)"></div>
      <div class="point-card-controls">
        <div class="color-row"><label>Color</label>
          <input type="color" value="${ann.color}"
            oninput="updateAnnProp(${ann.id},'color',this.value)"></div>
        <div class="field"><label>Width</label>
          <input type="number" value="${ann.width}" min="0.5" max="8" step="0.5"
            oninput="updateAnnProp(${ann.id},'width',parseFloat(this.value))"></div>
      </div>
      <button class="btn btn-red btn-sm" style="margin-top:6px;"
        onclick="removeAnnotation(${ann.id})">Remove</button>`;
  }

  list.appendChild(card);
}

function updateAnnProp(id, prop, value) {
  const ann = STATE.annotations.find(a => a.id === id);
  if (ann) { ann[prop] = value; renderDiagram(); }
}

function removeAnnotation(id) {
  STATE.annotations = STATE.annotations.filter(a => a.id !== id);
  document.getElementById(`ann-card-${id}`)?.remove();
  if (!STATE.annotations.length) el('annotations-hint').style.display = '';
  renderDiagram();
}
