// phase-diagram-annotations.js

const ANN_MAX_WIDTH  = 180;
const ANN_HANDLE_R   = 8;

let _annotCounter     = 0;
let _pendingAnnotType = null;
let _arrowStart       = null;

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
  for (const para of text.split('\n')) {
    const words = para.split(' ');
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

// ── Hit-test: is a canvas pos inside a rendered text box? ─────────────────
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

// ── Options HTML for attachment dropdowns ─────────────────────────────────
function _textBoxOptionsHtml(selectedId) {
  const boxes = STATE.annotations.filter(a => a.type === 'text');
  let html = `<option value="">— None —</option>`;
  boxes.forEach(b => {
    const preview = b.text.length > 18 ? b.text.substring(0, 18) + '…' : b.text;
    const sel     = selectedId === b.id ? 'selected' : '';
    html += `<option value="${b.id}" ${sel}>Box #${b.id}: "${preview}"</option>`;
  });
  return html;
}

// Rebuild attachment dropdowns on all arrow cards when text box list changes
function _refreshAttachDropdowns() {
  STATE.annotations.forEach(ann => {
    if (ann.type !== 'arrow') return;
    const hEl = document.getElementById(`ann-attach-head-${ann.id}`);
    const tEl = document.getElementById(`ann-attach-tail-${ann.id}`);
    if (hEl) hEl.innerHTML = _textBoxOptionsHtml(ann.attachHead);
    if (tEl) tEl.innerHTML = _textBoxOptionsHtml(ann.attachTail);
  });
}

// ── Click intercept ────────────────────────────────────────────────────────
function handleAnnotationClick(pos) {
  if (_pendingAnnotType === 'text') {
    _placeTextAnnotation(pos);
    el('phaseDiagramCanvas').style.cursor = 'crosshair';
    _pendingAnnotType = null;
    return true;
  }
  if (_pendingAnnotType === 'arrow-start') {
    _arrowStart = pos;
    _pendingAnnotType = 'arrow-end';
    showToast('Now click to place the arrow TAIL', '');
    return true;
  }
  if (_pendingAnnotType === 'arrow-end') {
    _placeArrowAnnotation(_arrowStart, pos);
    _pendingAnnotType = null;
    _arrowStart = null;
    el('phaseDiagramCanvas').style.cursor = 'crosshair';
    return true;
  }
  // Normal mode: consume clicks inside text boxes so no point is accidentally created
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
    text: 'Annotation', fontSize: 12,
    fontColor: '#111111', bgColor: '#ffffff',
    bgOpacity: 85, showBorder: true, borderColor: '#333333'
  };
  STATE.annotations.push(ann);
  el('annotations-hint').style.display = 'none';
  buildAnnotationCard(ann);
  _refreshAttachDropdowns();  // update arrow cards to include new box
  renderDiagram();
}

function _placeArrowAnnotation(headPos, tailPos) {
  const h = canvasToData(headPos.x, headPos.y);
  const t = canvasToData(tailPos.x,  tailPos.y);
  _annotCounter++;
  const ann = {
    id: _annotCounter, type: 'arrow',
    T:  h.T, P:  h.P,   // head (arrowhead tip)
    T2: t.T, P2: t.P,   // tail
    color: '#333333', width: 1.5, label: '',
    attachHead: null,    // ID of text box the head is pinned to (or null)
    attachTail: null     // ID of text box the tail is pinned to (or null)
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

  // Arrowhead at HEAD
  const angle = Math.atan2(head.y - tail.y, head.x - tail.x);
  const hLen  = 10 + ann.width;
  ctx.beginPath();
  ctx.moveTo(head.x, head.y);
  ctx.lineTo(head.x - hLen * Math.cos(angle - 0.38), head.y - hLen * Math.sin(angle - 0.38));
  ctx.moveTo(head.x, head.y);
  ctx.lineTo(head.x - hLen * Math.cos(angle + 0.38), head.y - hLen * Math.sin(angle + 0.38));
  ctx.stroke();

  if (ann.label) {
    ctx.fillStyle    = ann.color;
    ctx.font         = `${11 + ann.width}px DM Sans, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(ann.label, (head.x + tail.x) / 2, Math.min(head.y, tail.y) - 4);
  }

  // Drag handles at both ends (hidden in export)
  if (!isExport) {
    [
      { pt: head, attached: ann.attachHead != null },
      { pt: tail, attached: ann.attachTail != null }
    ].forEach(h => {
      ctx.beginPath();
      ctx.arc(h.pt.x, h.pt.y, ANN_HANDLE_R, 0, Math.PI * 2);
      // Gold fill = attached to a text box; default = neutral
      ctx.fillStyle   = h.attached
        ? hexToRgba('#c9a03e', 0.30)
        : hexToRgba(ann.color, 0.18);
      ctx.strokeStyle = h.attached ? '#c9a03e' : ann.color;
      ctx.lineWidth   = h.attached ? 2 : 1.5;
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
      // Manually dragging head detaches it from any text box
      ann.attachHead = null;
      _syncAttachSelect(ann.id, 'head', null);
      ann.T  = data.T;
      ann.P  = data.P;
    } else if (ep === 'tail') {
      ann.attachTail = null;
      _syncAttachSelect(ann.id, 'tail', null);
      ann.T2 = data.T;
      ann.P2 = data.P;
    }
  } else {
    // Text box: move the box AND sync any attached arrow endpoints
    ann.T = data.T;
    ann.P = data.P;
    _syncAttachedArrows(ann);
  }
}

// After a text box moves, update all arrows attached to it
function _syncAttachedArrows(textBox) {
  const tbId = Number(textBox.id);  // normalize: prevent string vs number mismatch
  STATE.annotations.forEach(arrow => {
    if (arrow.type !== 'arrow') return;
    if (arrow.attachHead != null && Number(arrow.attachHead) === tbId) {
      arrow.T = textBox.T;
      arrow.P = textBox.P;
    }
    if (arrow.attachTail != null && Number(arrow.attachTail) === tbId) {
      arrow.T2 = textBox.T;
      arrow.P2 = textBox.P;
    }
  });
}

// Called when the user picks a text box from the attachment dropdown
function setArrowAttach(arrowId, endpoint, rawVal) {
  const arrow = STATE.annotations.find(a => Number(a.id) === Number(arrowId));
  if (!arrow) return;
  const boxId = (rawVal === '' || rawVal == null) ? null : Number(rawVal);
  const box   = boxId != null ? STATE.annotations.find(a => Number(a.id) === boxId) : null;

  if (endpoint === 'head') {
    arrow.attachHead = boxId;
    // Snap head to text box position immediately
    if (box) { arrow.T  = box.T; arrow.P  = box.P; }
  } else {
    arrow.attachTail = boxId;
    if (box) { arrow.T2 = box.T; arrow.P2 = box.P; }
  }
  renderDiagram();
}

// Silently update a select element to reflect a new value
function _syncAttachSelect(arrowId, endpoint, newVal) {
  const sel = document.getElementById(
    endpoint === 'head' ? `ann-attach-head-${arrowId}` : `ann-attach-tail-${arrowId}`
  );
  if (sel) sel.value = newVal == null ? '' : String(newVal);
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
    // Arrow card
    const hOpts = _textBoxOptionsHtml(ann.attachHead);
    const tOpts = _textBoxOptionsHtml(ann.attachTail);
    card.innerHTML = `
      <div class="point-card-header">
        <span class="point-card-label">→ Arrow #${ann.id}</span>
      </div>
      <div class="empty-hint" style="text-align:left;font-style:normal;font-size:0.69rem;color:var(--text-muted);">
        Drag <strong>▲ head handle</strong> or <strong>● tail handle</strong> to reposition.
        Attach endpoints to a text box to make them move together.
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
      <div class="field">
        <label>▲ Attach HEAD to text box</label>
        <select id="ann-attach-head-${ann.id}"
          onchange="setArrowAttach(${ann.id},'head',this.value)">
          ${hOpts}
        </select>
      </div>
      <div class="field">
        <label>● Attach TAIL to text box</label>
        <select id="ann-attach-tail-${ann.id}"
          onchange="setArrowAttach(${ann.id},'tail',this.value)">
          ${tOpts}
        </select>
      </div>
      <button class="btn btn-red btn-sm" style="margin-top:6px;"
        onclick="removeAnnotation(${ann.id})">Remove</button>`;
  }

  list.appendChild(card);
}

function updateAnnProp(id, prop, value) {
  const ann = STATE.annotations.find(a => Number(a.id) === Number(id));
  if (ann) { ann[prop] = value; renderDiagram(); }
}

function removeAnnotation(id) {
  const numId = Number(id);
  // Detach any arrows that reference this annotation by ID
  STATE.annotations.forEach(arrow => {
    if (arrow.type !== 'arrow') return;
    if (Number(arrow.attachHead) === numId) arrow.attachHead = null;
    if (Number(arrow.attachTail) === numId) arrow.attachTail = null;
  });
  STATE.annotations = STATE.annotations.filter(a => Number(a.id) !== numId);
  document.getElementById(`ann-card-${id}`)?.remove();
  if (!STATE.annotations.length) el('annotations-hint').style.display = '';
  _refreshAttachDropdowns();
  renderDiagram();
}
