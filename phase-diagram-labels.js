// phase-diagram-labels.js
// Label drag (region, marker, point labels/pairs) + extended arrow attachment.

const LABEL_HIT_PAD = 5;  // extra px hit area around every draggable label

// ═══════════════════════════════════════════════════════════════════════════
// ── LABEL DRAG ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function startLabelDrag(pos) {
  // 1. Region labels (SOLID, LIQUID, GAS, SUPERCRITICAL)
  const rl = STATE._regionLabelBoxes || {};
  for (const key of ['solid','liquid','gas','super']) {
    const b = rl[key];
    if (!b) continue;
    if (_lhit(pos, b)) {
      STATE.drag.active = true;
      STATE.drag.type   = 'region-label';
      STATE.drag.id     = key;
      STATE.drag.ox     = pos.x - b.x;
      STATE.drag.oy     = pos.y - b.y;
      return true;
    }
  }
  // 2. Marker labels / pairs  (key encoded as 'triple:label' etc.)
  const ml = STATE._markerLabelBoxes || {};
  for (const [bkey, b] of Object.entries(ml)) {
    if (!b) continue;
    if (_lhit(pos, b)) {
      STATE.drag.active = true;
      STATE.drag.type   = 'marker-label';
      STATE.drag.id     = bkey;
      STATE.drag.ox     = pos.x - b.x;
      STATE.drag.oy     = pos.y - b.y;
      return true;
    }
  }
  // 3. User point labels / pairs  (key encoded as 'pt:5:label' etc.)
  const pl = STATE._pointLabelBoxes || {};
  for (const [bkey, b] of Object.entries(pl)) {
    if (!b) continue;
    if (_lhit(pos, b)) {
      STATE.drag.active = true;
      STATE.drag.type   = 'point-label';
      STATE.drag.id     = bkey;
      STATE.drag.ox     = pos.x - b.x;
      STATE.drag.oy     = pos.y - b.y;
      return true;
    }
  }
  return false;
}

function _lhit(pos, b) {
  return pos.x >= b.x - LABEL_HIT_PAD && pos.x <= b.x + b.w + LABEL_HIT_PAD &&
         pos.y >= b.y - LABEL_HIT_PAD && pos.y <= b.y + b.h + LABEL_HIT_PAD;
}

// ── Move handlers (called from continueDrag in fake.js) ────────────────────
function moveRegionLabel(key, pos) {
  STATE.regionLabelOffsets = STATE.regionLabelOffsets || {};

  const b      = STATE._regionLabelBoxes?.[key];
  const bounds = STATE._regionBounds?.[key];
  const tw     = b ? b.w : 50;
  const th     = b ? b.h : 16;

  // Center position after drag, accounting for where user grabbed the label
  let cx = (pos.x - STATE.drag.ox) + tw / 2;
  let cy = (pos.y - STATE.drag.oy) + th / 2;

  // Hard-clamp to region bounds so label can never leave its region
  if (bounds) {
    cx = Math.max(bounds.xMin + tw / 2, Math.min(bounds.xMax - tw / 2, cx));
    cy = Math.max(bounds.yMin + th / 2, Math.min(bounds.yMax - th / 2, cy));
  }

  STATE.regionLabelOffsets[key] = { x: cx - tw / 2, y: cy - th / 2 };
}

// ── Hit-test a rotated rectangle bbox (used for arrow labels) ─────────────
function _hitRotatedRect(pos, bbox) {
  if (!bbox) return false;
  const dx = pos.x - bbox.cx, dy = pos.y - bbox.cy;
  const cosA = Math.cos(-bbox.angle), sinA = Math.sin(-bbox.angle);
  const lx   =  dx * cosA - dy * sinA;
  const ly   =  dx * sinA + dy * cosA;
  return Math.abs(lx) <= bbox.w / 2 + 4 && Math.abs(ly) <= bbox.h / 2 + 4;
}

function moveMarkerLabel(bkey, pos) {
  // bkey = 'triple:label' or 'critical:pair' etc.
  const parts = bkey.split(':');
  const markerKey = parts[0];
  const cd = STATE.mode === 'fake' ? STATE.fakeCompound : STATE.compoundData;
  if (!cd) return;
  const pt = _getMarkerPt(markerKey, cd);
  if (!pt) return;
  const dotCv = dataToCanvas(pt.T, pt.P);
  STATE.labelOverrides = STATE.labelOverrides || {};
  STATE.labelOverrides[bkey] = {
    dx: (pos.x - STATE.drag.ox) - dotCv.x,
    dy: (pos.y - STATE.drag.oy) - dotCv.y
  };
}

function movePointLabel(bkey, pos) {
  // bkey = 'pt:5:label' or 'pt:5:pair'
  const [, idStr] = bkey.split(':');
  const pt = STATE.points.find(p => Number(p.id) === Number(idStr));
  if (!pt) return;
  const dotCv = dataToCanvas(pt.T, pt.P);
  STATE.labelOverrides = STATE.labelOverrides || {};
  STATE.labelOverrides[bkey] = {
    dx: (pos.x - STATE.drag.ox) - dotCv.x,
    dy: (pos.y - STATE.drag.oy) - dotCv.y
  };
}

// ── Cursor detection ───────────────────────────────────────────────────────
function findNearLabel(pos) {
  const allBoxes = [
    ...Object.values(STATE._regionLabelBoxes || {}),
    ...Object.values(STATE._markerLabelBoxes || {}),
    ...Object.values(STATE._pointLabelBoxes  || {})
  ];
  if (allBoxes.some(b => b && _lhit(pos, b))) return true;
  // Arrow labels use rotated bboxes
  return STATE.annotations.some(ann =>
    ann.type === 'arrow' && ann.label && ann._labelBbox &&
    typeof _hitRotatedRect === 'function' && _hitRotatedRect(pos, ann._labelBbox)
  );
}

// ── Reset all override state ───────────────────────────────────────────────
function resetAllLabelOverrides() {
  STATE.labelOverrides     = {};
  STATE.regionLabelOffsets = {};
}

// ═══════════════════════════════════════════════════════════════════════════
// ── ARROW ATTACHMENT RESOLUTION ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Returns {T,P} for a given attachment value + the "other" endpoint (used for
// closest-edge calculation on text boxes).
function _resolveAttachPos(attachVal, otherT, otherP) {
  if (!attachVal) return null;

  const str = String(attachVal);

  // Legacy: plain number → treat as textbox ID
  if (!isNaN(Number(str)) && str !== '') {
    const box = STATE.annotations.find(a => Number(a.id) === Number(str) && a.type === 'text');
    return box ? _closestPointOnTextBox(box, otherT, otherP) : null;
  }

  if (str.startsWith('marker:')) {
    const key = str.slice(7);
    const cd  = STATE.mode === 'fake' ? STATE.fakeCompound : STATE.compoundData;
    if (!cd) return null;
    const pt  = _getMarkerPt(key, cd);
    return pt ? { T: pt.T, P: pt.P } : null;
  }

  if (str.startsWith('point:')) {
    const ptId = Number(str.slice(6));
    const pt   = STATE.points.find(p => Number(p.id) === ptId);
    return pt ? { T: pt.T, P: pt.P } : null;
  }

  if (str.startsWith('textbox:')) {
    const annId = Number(str.slice(8));
    const box   = STATE.annotations.find(a => Number(a.id) === annId && a.type === 'text');
    return box ? _closestPointOnTextBox(box, otherT, otherP) : null;
  }

  return null;
}

// Returns the resolved position for one end of an arrow, honouring attachments.
function _getArrowEndpoint(arrow, endpoint) {
  const attachVal = endpoint === 'head' ? arrow.attachHead : arrow.attachTail;
  const freeT     = endpoint === 'head' ? arrow.T  : arrow.T2;
  const freeP     = endpoint === 'head' ? arrow.P  : arrow.P2;
  const otherT    = endpoint === 'head' ? arrow.T2 : arrow.T;
  const otherP    = endpoint === 'head' ? arrow.P2 : arrow.P;
  if (!attachVal) return { T: freeT, P: freeP };
  return _resolveAttachPos(attachVal, otherT, otherP) || { T: freeT, P: freeP };
}

// Closest point on the text box perimeter to (epT, epP).
function _closestPointOnTextBox(box, epT, epP) {
  const cvBox = dataToCanvas(box.T, box.P);
  const ctx   = el('phaseDiagramCanvas').getContext('2d');
  ctx.font    = `${box.fontSize}px DM Sans, sans-serif`;
  const lines = (typeof _wrapText === 'function')
    ? _wrapText(ctx, box.text, 180)
    : [box.text];
  const lineH = box.fontSize + 4;
  const pad   = 6;
  const bw    = Math.min(
    Math.max(...lines.map(l => ctx.measureText(l).width), 20), 180
  ) + pad * 2;
  const bh    = lines.length * lineH + pad * 2;

  const boxL = cvBox.x, boxR = cvBox.x + bw;
  const boxT = cvBox.y - bh / 2, boxB = cvBox.y + bh / 2;

  const epCv = dataToCanvas(epT, epP);
  let cx, cy;

  const inside = epCv.x >= boxL && epCv.x <= boxR && epCv.y >= boxT && epCv.y <= boxB;
  if (inside) {
    const dists = [
      { v: epCv.x - boxL, fx: boxL,   fy: epCv.y },
      { v: boxR - epCv.x, fx: boxR,   fy: epCv.y },
      { v: epCv.y - boxT, fx: epCv.x, fy: boxT   },
      { v: boxB - epCv.y, fx: epCv.x, fy: boxB   },
    ];
    const nearest = dists.reduce((a, b) => a.v < b.v ? a : b);
    cx = nearest.fx; cy = nearest.fy;
  } else {
    cx = Math.max(boxL, Math.min(boxR, epCv.x));
    cy = Math.max(boxT, Math.min(boxB, epCv.y));
  }
  return canvasToData(cx, cy);
}

// ── Attachment dropdown options (all target types) ─────────────────────────
function _attachOptionsHtml(selectedVal) {
  const sel = String(selectedVal || '');
  let html  = `<option value="">— None —</option>`;

  const cd = STATE.mode === 'fake' ? STATE.fakeCompound : STATE.compoundData;
  const markerDefs = [
    { key: 'triple',   label: 'Triple Point'        },
    { key: 'critical', label: 'Critical Point'       },
    { key: 'nmp',      label: 'Normal Melting Point' },
    { key: 'nbp',      label: 'Normal Boiling Point' },
  ];
  const visMarkers = markerDefs.filter(m =>
    STATE.markers[m.key]?.show && cd && _getMarkerPt(m.key, cd)
  );
  if (visMarkers.length) {
    html += `<optgroup label="Special Markers">`;
    visMarkers.forEach(m => {
      const v = `marker:${m.key}`;
      html += `<option value="${v}" ${sel === v ? 'selected' : ''}>${m.label}</option>`;
    });
    html += `</optgroup>`;
  }

  if (STATE.points.length) {
    html += `<optgroup label="User Points">`;
    STATE.points.forEach((pt, i) => {
      const v = `point:${pt.id}`;
      html += `<option value="${v}" ${sel === v ? 'selected' : ''}>P${i+1} (${formatVal(pt.T)}, ${formatVal(pt.P)})</option>`;
    });
    html += `</optgroup>`;
  }

  const boxes = STATE.annotations.filter(a => a.type === 'text');
  if (boxes.length) {
    html += `<optgroup label="Text Boxes">`;
    boxes.forEach(b => {
      const v       = `textbox:${b.id}`;
      const preview = b.text.length > 18 ? b.text.substring(0,18) + '…' : b.text;
      html += `<option value="${v}" ${sel === v ? 'selected' : ''}>Box #${b.id}: "${preview}"</option>`;
    });
    html += `</optgroup>`;
  }
  return html;
}

function _refreshAttachDropdowns() {
  STATE.annotations.forEach(ann => {
    if (ann.type !== 'arrow') return;
    const hEl = document.getElementById(`ann-attach-head-${ann.id}`);
    const tEl = document.getElementById(`ann-attach-tail-${ann.id}`);
    if (hEl) hEl.innerHTML = _attachOptionsHtml(ann.attachHead);
    if (tEl) tEl.innerHTML = _attachOptionsHtml(ann.attachTail);
  });
}

// Helper: get marker point from compound data
function _getMarkerPt(key, cd) {
  if (!cd) return null;
  const map = { triple: cd.triplePoint, critical: cd.criticalPoint,
                nmp: cd.normalMeltingPoint, nbp: cd.normalBoilingPoint };
  return map[key] || null;
}
