// phase-diagram-draw.js

// ── roundRect polyfill (Safari < 15.4 doesn't support ctx.roundRect) ──────
if (typeof CanvasRenderingContext2D !== 'undefined' &&
    !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y,     x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x,     y + h, x,     y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x,     y,     x + r, y);
    this.closePath();
  };
}

// ── Utilities ──────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatVal(v) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 100000 || (a < 0.001 && a > 0)) return parseFloat(v.toPrecision(3)).toExponential();
  if (a < 0.1)  return parseFloat(v.toPrecision(3)).toString();
  if (a < 10)   return parseFloat(v.toPrecision(4)).toString();
  if (Number.isInteger(v) || Math.abs(v - Math.round(v)) < 0.005) return Math.round(v).toString();
  return parseFloat(v.toPrecision(4)).toString();
}

// Catmull-Rom spline through canvas-space points
function catmullRom(ctx, pts) {
  if (!pts || pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i-1, 0)];
    const p1 = pts[i];
    const p2 = pts[i+1];
    const p3 = pts[Math.min(i+2, pts.length-1)];
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y
    );
  }
}

// Convert an array of data-space {T,P} points to canvas-space {x,y} points
function toCvs(dataPts) {
  return dataPts.map(p => dataToCanvas(p.T, p.P));
}

// ── Grid ───────────────────────────────────────────────────────────────────
function drawGrid(ctx, m, pw, ph) {
  const { xMin, xMax, yMin, yMax, xMajor, yMajor, grid, logPressure } = STATE.axes;
  const g = grid || { color: '#000000', opacity: 7, width: 0.5 };
  const strokeColor = hexToRgba(g.color, (g.opacity || 7) / 100);

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth   = g.width || 0.5;

  // X grid lines (same for linear and log)
  const xStart = Math.ceil((xMin + 1e-9) / xMajor) * xMajor;
  for (let t = xStart; t <= xMax + 1e-9; t += xMajor) {
    const cx = dataToCanvas(t, yMin).x;
    ctx.beginPath(); ctx.moveTo(cx, m.top); ctx.lineTo(cx, m.top + ph); ctx.stroke();
  }

  // Y grid lines
  if (logPressure && yMin > 0 && yMax > 0) {
    const dMin = Math.floor(Math.log10(yMin));
    const dMax = Math.ceil(Math.log10(yMax));
    for (let d = dMin; d <= dMax; d++) {
      const P = Math.pow(10, d);
      if (P < yMin * 0.99 || P > yMax * 1.01) continue;
      const cy = dataToCanvas(xMin, P).y;
      ctx.beginPath(); ctx.moveTo(m.left, cy); ctx.lineTo(m.left + pw, cy); ctx.stroke();
    }
  } else {
    const yStart = Math.ceil((yMin + 1e-9) / yMajor) * yMajor;
    for (let p = yStart; p <= yMax + 1e-9; p += yMajor) {
      const cy = dataToCanvas(xMin, p).y;
      ctx.beginPath(); ctx.moveTo(m.left, cy); ctx.lineTo(m.left + pw, cy); ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Axes ───────────────────────────────────────────────────────────────────
function drawAxes(ctx, m, pw, ph) {
  const { xMin, xMax, yMin, yMax, xMajor, xMinor, yMajor, yMinor } = STATE.axes;
  const { tickSize, tickColor, labelSize, labelColor } = STATE.style;
  const plotB = m.top + ph;

  ctx.save();

  // Axis lines
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(m.left, m.top); ctx.lineTo(m.left, plotB); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(m.left, plotB); ctx.lineTo(m.left + pw, plotB); ctx.stroke();

  // Tick helper
  const drawTick = (x1,y1,x2,y2) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  };

  // X ticks
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 1;
  ctx.fillStyle = tickColor;
  ctx.font = `${tickSize}px DM Sans, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const xStart = Math.ceil((xMin + 1e-9) / xMajor) * xMajor;
  for (let t = xStart; t <= xMax + 1e-9; t += xMajor) {
    const cx = dataToCanvas(t, yMin).x;
    drawTick(cx, plotB, cx, plotB + 7);
    ctx.fillText(formatVal(t), cx, plotB + 9);
  }

  if (xMinor > 0 && xMajor / xMinor <= 50) {
    const xMinStart = Math.ceil((xMin + 1e-9) / xMinor) * xMinor;
    for (let t = xMinStart; t <= xMax + 1e-9; t += xMinor) {
      if (Math.abs(t % xMajor) < 1e-6 * xMajor) continue;
      const cx = dataToCanvas(t, yMin).x;
      drawTick(cx, plotB, cx, plotB + 4);
    }
  }

  // Y ticks
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  if (STATE.axes.logPressure && yMin > 0 && yMax > 0) {
    // ── Log scale Y ticks ──────────────────────────────────────────────────
    const logYMin = Math.log10(yMin);
    const logYMax = Math.log10(yMax);
    const dMin = Math.floor(logYMin);
    const dMax = Math.ceil(logYMax);

    for (let d = dMin; d <= dMax; d++) {
      const P = Math.pow(10, d);
      if (P < yMin * 0.99 || P > yMax * 1.01) continue;
      const cy = dataToCanvas(xMin, P).y;
      drawTick(m.left, cy, m.left - 7, cy);
      ctx.fillText(formatVal(P), m.left - 10, cy);

      // Minor ticks at 2–9 × 10^d
      for (let sub = 2; sub <= 9; sub++) {
        const Psub = sub * Math.pow(10, d);
        if (Psub < yMin || Psub > yMax) continue;
        const cySub = dataToCanvas(xMin, Psub).y;
        drawTick(m.left, cySub, m.left - 4, cySub);
      }
    }
  } else {
    // ── Linear scale Y ticks ──────────────────────────────────────────────
    const yStart = Math.ceil((yMin + 1e-9) / yMajor) * yMajor;
    for (let p = yStart; p <= yMax + 1e-9; p += yMajor) {
      const cy = dataToCanvas(xMin, p).y;
      drawTick(m.left, cy, m.left - 7, cy);
      ctx.fillText(formatVal(p), m.left - 10, cy);
    }

    if (yMinor > 0 && yMajor / yMinor <= 50) {
      const yMinStart = Math.ceil((yMin + 1e-9) / yMinor) * yMinor;
      for (let p = yMinStart; p <= yMax + 1e-9; p += yMinor) {
        if (Math.abs(p % yMajor) < 1e-6 * yMajor) continue;
        const cy = dataToCanvas(xMin, p).y;
        drawTick(m.left, cy, m.left - 4, cy);
      }
    }
  }

  // Axis labels
  ctx.fillStyle = labelColor;
  ctx.font = `${labelSize}px DM Sans, sans-serif`;

  // X label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(UNIT_CONVERSIONS.temperature.labels[STATE.tempUnit], m.left + pw / 2, BASE_H - 6);

  // Y label (rotated)
  ctx.save();
  ctx.translate(13, m.top + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(UNIT_CONVERSIONS.pressure.labels[STATE.pressUnit], 0, 0);
  ctx.restore();

  ctx.restore();
}

// ── Title ──────────────────────────────────────────────────────────────────
function drawTitle(ctx) {
  const { titleText, titleSize, titleColor } = STATE.style;
  if (!titleText.trim()) return;
  ctx.save();
  ctx.fillStyle = titleColor;
  ctx.font = `bold ${titleSize}px Playfair Display, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(titleText, BASE_W / 2, 10);
  ctx.restore();
}

// ── Region labels ──────────────────────────────────────────────────────────
function drawRegionLabel(ctx, text, x, y) {
  const { labelSize, labelColor } = STATE.regions;
  ctx.save();
  ctx.fillStyle = labelColor;
  ctx.font = `bold ${labelSize}px DM Sans, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.75;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── Special markers (triple, critical, NMP, NBP) ───────────────────────────
function drawMarkers(ctx) {
  // Use mode to pick correct data source — fixes fake markers following drag
  const cd = STATE.mode === 'fake' ? STATE.fakeCompound : STATE.compoundData;
  if (!cd) return;

  const pts = {
    triple:   cd.triplePoint,
    critical: cd.criticalPoint,
    nmp:      cd.normalMeltingPoint,
    nbp:      cd.normalBoilingPoint
  };

  // Collect placed label rects for collision avoidance
  const placedRects = [];

  // Try a series of offsets to avoid collisions; returns best non-overlapping rect
  const placeLabel = (cx, cy, rw, rh) => {
    const tryOffsets = [
      { dx: 8,   dy: -rh - 2 },   // right, above
      { dx: 8,   dy: 4 },          // right, below
      { dx: -rw - 8, dy: -rh - 2 }, // left, above
      { dx: -rw - 8, dy: 4 },       // left, below
      { dx: 8,   dy: -rh / 2 },    // right, mid
      { dx: -rw - 8, dy: -rh / 2 }, // left, mid
      { dx: -rw / 2, dy: -rh - 10 }, // centered, above
      { dx: -rw / 2, dy: 10 },       // centered, below
    ];
    const { m, pw, ph } = getPlot();
    const plotL = m.left, plotR = m.left + pw, plotT = m.top, plotB = m.top + ph;

    for (const off of tryOffsets) {
      const rx = cx + off.dx;
      const ry = cy + off.dy;
      // Must be inside plot area
      if (rx < plotL || rx + rw > plotR || ry < plotT || ry + rh > plotB) continue;
      // Must not overlap any already-placed rect
      const overlaps = placedRects.some(p =>
        rx < p.x + p.w + 2 && rx + rw > p.x - 2 &&
        ry < p.y + p.h + 2 && ry + rh > p.y - 2
      );
      if (!overlaps) return { rx, ry, rw, rh };
    }
    // Fallback: nudge below the last placed rect
    const last = placedRects[placedRects.length - 1];
    if (last) return { rx: cx + 8, ry: last.y + last.h + 3, rw, rh };
    return { rx: cx + 8, ry: cy - rh - 2, rw, rh };
  };

  Object.entries(STATE.markers).forEach(([key, mk]) => {
    if (!mk.show) return;
    const pt = pts[key];
    if (!pt) return;

    const { xMin, xMax, yMin, yMax } = STATE.axes;
    if (pt.T < xMin || pt.T > xMax || pt.P < yMin || pt.P > yMax) return;

    const cv = dataToCanvas(pt.T, pt.P);

    if (mk.lines) drawDottedLines(ctx, cv, mk.lineColor, mk.lineWidth);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cv.x, cv.y, mk.size, 0, Math.PI * 2);
    ctx.fillStyle   = mk.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    // Label with collision avoidance
    if (mk.label) {
      ctx.save();
      ctx.font = `600 11px DM Sans, sans-serif`;
      const lw = ctx.measureText(mk.label).width;
      const lh = 13;
      const placed = placeLabel(cv.x, cv.y, lw, lh);
      ctx.fillStyle    = mk.color;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(mk.label, placed.rx, placed.ry);
      placedRects.push(placed);
      ctx.restore();
    }

    if (mk.pair) {
      const pair = `(${formatVal(pt.T)}, ${formatVal(pt.P)})`;
      ctx.save();
      ctx.font = `11px DM Mono, monospace`;
      const pw2 = ctx.measureText(pair).width;
      const ph2 = 12;
      const placed = placeLabel(cv.x, cv.y, pw2, ph2);
      ctx.fillStyle    = mk.color;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(pair, placed.rx, placed.ry);
      placedRects.push(placed);
      ctx.restore();
    }
  });
}

// ── Dotted lines from a canvas point to the axes ───────────────────────────
function drawDottedLines(ctx, cv, color, width) {
  const { m, pw, ph } = getPlot();
  const plotB = m.top + ph;
  const plotL = m.left;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = Math.max(0.5, width);
  ctx.setLineDash([4, 4]);
  ctx.lineCap = 'butt';

  // Horizontal line — LEFT to y-axis
  ctx.beginPath();
  ctx.moveTo(cv.x, cv.y);
  ctx.lineTo(plotL, cv.y);
  ctx.stroke();

  // Vertical line — DOWN to x-axis
  ctx.beginPath();
  ctx.moveTo(cv.x, cv.y);
  ctx.lineTo(cv.x, plotB);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}
