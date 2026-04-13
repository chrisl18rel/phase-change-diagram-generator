// phase-diagram-real.js

// ── Draw equilibrium curves ────────────────────────────────────────────────
function drawRealCurves(ctx, m, pw, ph) {
  const cd  = STATE.compoundData;
  if (!cd) return;
  const src = COMPOUND_DATA[STATE.compoundKey];

  const drawCurve = (dataPts, color, width, isAnomaly) => {
    if (!dataPts || dataPts.length < 2) return;
    const cvPts = toCvs(dataPts);
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, pw, ph);
    ctx.clip();
    ctx.beginPath();
    catmullRom(ctx, cvPts);
    ctx.strokeStyle = (isAnomaly && STATE.boundaries.showAnomaly)
      ? STATE.boundaries.anomalyColor : color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  };

  const { sl, lv, sv } = STATE.boundaries;
  drawCurve(cd.solidLiquidCurve, sl.color, sl.width, src?.negativeSlope);
  drawCurve(cd.liquidVaporCurve, lv.color, lv.width, false);
  drawCurve(cd.solidVaporCurve,  sv.color, sv.width, false);

  if (src?.negativeSlope && STATE.boundaries.showAnomaly) {
    _drawAnomalyArrow(ctx, m, cd);
  }
}

function _drawAnomalyArrow(ctx, m, cd) {
  if (!cd.solidLiquidCurve || cd.solidLiquidCurve.length < 2) return;
  const pts = toCvs(cd.solidLiquidCurve);
  const mid = pts[Math.floor(pts.length / 2)];
  if (!mid) return;
  ctx.save();
  ctx.fillStyle = STATE.boundaries.anomalyColor;
  ctx.font = 'bold 10px DM Sans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('← negative slope', Math.max(m.left + 10, mid.x - 90), mid.y - 18);
  ctx.restore();
}

// ── Region fills ───────────────────────────────────────────────────────────
function drawRealRegions(ctx, m, pw, ph) {
  const cd = STATE.compoundData;
  if (!cd) return;

  const plotL = m.left, plotR = m.left + pw;
  const plotT = m.top,  plotB = m.top + ph;

  // Helper: clip all fills to the plot rectangle
  const fill = (buildPath, cfg) => {
    if (!cfg.fill) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(plotL, plotT, pw, ph); ctx.clip();
    ctx.beginPath();
    buildPath();
    ctx.fillStyle = hexToRgba(cfg.color, cfg.opacity / 100);
    ctx.fill();
    ctx.restore();
  };

  const sv = toCvs(cd.solidVaporCurve  || []);
  const sl = toCvs(cd.solidLiquidCurve || []);
  const lv = toCvs(cd.liquidVaporCurve || []);
  const tp = cd.triplePoint   ? dataToCanvas(cd.triplePoint.T,   cd.triplePoint.P)   : null;
  const cp = cd.criticalPoint ? dataToCanvas(cd.criticalPoint.T, cd.criticalPoint.P) : null;

  const src = COMPOUND_DATA[STATE.compoundKey];
  const negSlope = src?.negativeSlope;

  // ── GAS region ────────────────────────────────────────────────────────────
  // Bounded below/right by SV+LV curves, plotB, and plotR
  fill(() => {
    if (!sv.length || !lv.length || !tp) return;
    ctx.moveTo(plotL, plotB);
    ctx.lineTo(sv[0].x, plotB);
    sv.forEach(pt => ctx.lineTo(pt.x, pt.y));
    lv.forEach(pt => ctx.lineTo(pt.x, pt.y));
    const lvEnd = cp || lv[lv.length - 1];
    ctx.lineTo(plotR, lvEnd.y);
    ctx.lineTo(plotR, plotB);
    ctx.closePath();
  }, STATE.regions.gas);

  // ── SOLID region ──────────────────────────────────────────────────────────
  fill(() => {
    if (!sv.length || !sl.length || !tp) return;

    // For BOTH slope types: start at bottom-left, walk along the bottom to the
    // start of the SV curve, follow SV up to the triple point, then follow SL
    // upward. This eliminates the white gap between plotL and sv[0].
    ctx.moveTo(plotL, plotB);
    ctx.lineTo(sv[0].x, plotB);       // along bottom edge to SV start
    sv.forEach(pt => ctx.lineTo(pt.x, pt.y));  // UP the SV curve to triple point
    sl.forEach(pt => ctx.lineTo(pt.x, pt.y));  // UP the SL curve

    if (negSlope) {
      // Water: SL goes LEFT as pressure rises → exits through the left edge
      ctx.lineTo(plotL, plotT);
    } else {
      // Normal slope: SL drifts slightly right → close via top-left corner
      const slEnd = sl[sl.length - 1];
      ctx.lineTo(slEnd.x, plotT);
      ctx.lineTo(plotL, plotT);
    }
    ctx.closePath();
  }, STATE.regions.solid);

  // ── LIQUID region ─────────────────────────────────────────────────────────
  fill(() => {
    if (!sl.length || !lv.length || !tp || !cp) return;
    ctx.moveTo(tp.x, tp.y);
    sl.forEach(pt => ctx.lineTo(pt.x, pt.y));
    const slEnd = sl[sl.length - 1];
    ctx.lineTo(slEnd.x, plotT);
    ctx.lineTo(cp.x, plotT);
    ctx.lineTo(cp.x, cp.y);
    lv.slice().reverse().forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.closePath();
  }, STATE.regions.liquid);

  // ── SUPERCRITICAL region ──────────────────────────────────────────────────
  fill(() => {
    if (!cp) return;
    ctx.rect(cp.x, plotT, plotR - cp.x, cp.y - plotT);
  }, STATE.regions.super);

  // ── Region labels ─────────────────────────────────────────────────────────
  _drawRealRegionLabels(ctx, m, pw, ph, sv, sl, lv, tp, cp);
}

function _drawRealRegionLabels(ctx, m, pw, ph, sv, sl, lv, tp, cp) {
  const plotL = m.left, plotR = m.left + pw;
  const plotT = m.top,  plotB = m.top + ph;

  STATE._regionLabelBoxes = {};
  STATE._regionBounds     = {};
  const { labelSize, labelColor } = STATE.regions;

  const src      = COMPOUND_DATA[STATE.compoundKey];
  const negSlope = src?.negativeSlope;

  // ── Compute safe zone for EVERY region regardless of showLabel ────────────
  // This ensures bounds are always ready for clamping during drag.
  if (tp) {
    const slLeftX = sl.length ? Math.min(...sl.map(p => p.x)) : tp.x;

    // SOLID: everything left of the SL curve
    STATE._regionBounds.solid = negSlope
      ? { xMin: plotL + 4, xMax: Math.min(tp.x - 4, tp.x + (tp.x - plotL) * 0.35),
          yMin: plotT + 4,  yMax: plotB - 4 }
      : { xMin: plotL + 4, xMax: Math.max(plotL + 20, slLeftX - 8),
          yMin: plotT + 4,  yMax: plotB - 4 };

    // GAS: below the triple point (canvas y > tp.y means lower pressure = gas side)
    STATE._regionBounds.gas = {
      xMin: tp.x + (plotR - tp.x) * 0.05,
      xMax: plotR - 4,
      yMin: tp.y + (plotB - tp.y) * 0.05,  // slightly below tp
      yMax: plotB - 4
    };
  }
  if (tp && cp) {
    // LIQUID: between SL and LV curves, horizontally tp→cp, vertically plotT→tp
    // Note: in canvas coords, LOWER y = HIGHER on screen = HIGHER pressure.
    // tp.y > cp.y  (triple point is lower-pressure → lower on screen → higher canvas y)
    // Liquid sits ABOVE the LV curve, so y < tp.y.
    STATE._regionBounds.liquid = {
      xMin: Math.min(tp.x + 5, cp.x - 20),
      xMax: Math.max(cp.x - 5, tp.x + 20),
      yMin: plotT + 4,
      yMax: Math.max(tp.y - 8, plotT + 20)  // never collapses to nothing
    };
  }
  if (cp) {
    // SUPERCRITICAL: upper-right quadrant beyond the critical point
    STATE._regionBounds.super = {
      xMin: Math.min(cp.x + 8, plotR - 20),
      xMax: plotR - 4,
      yMin: plotT + 4,
      yMax: Math.max(cp.y - 4, plotT + 20)  // cp.y is small (high pressure = high on screen)
    };
  }

  // ── Draw a label — clamp to region, auto-clear stale overrides ────────────
  const drawLabel = (key, defaultX, defaultY, text) => {
    const bounds = STATE._regionBounds[key];
    if (!bounds) return;

    // Validate bounds have positive area; fallback to plot centre if degenerate
    const bw = bounds.xMax - bounds.xMin;
    const bh = bounds.yMax - bounds.yMin;
    if (bw < 10 || bh < 10) return;

    ctx.font = `bold ${labelSize}px DM Sans, sans-serif`;
    const tw = ctx.measureText(text).width;
    const th = labelSize;

    const ov = STATE.regionLabelOffsets?.[key];
    let cx, cy;

    if (ov) {
      cx = ov.x + tw / 2;
      cy = ov.y + th / 2;
      // Clear stale overrides that have drifted well outside the current region
      const margin = 60;
      const stale  = cx < bounds.xMin - margin || cx > bounds.xMax + margin ||
                     cy < bounds.yMin - margin || cy > bounds.yMax + margin;
      if (stale) {
        delete STATE.regionLabelOffsets[key];
        cx = defaultX;
        cy = defaultY;
      }
    } else {
      cx = defaultX;
      cy = defaultY;
    }

    // Hard-clamp to region bounds
    cx = Math.max(bounds.xMin + tw / 2, Math.min(bounds.xMax - tw / 2, cx));
    cy = Math.max(bounds.yMin + th / 2, Math.min(bounds.yMax - th / 2, cy));

    ctx.save();
    ctx.fillStyle    = labelColor;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha  = 0.75;
    ctx.fillText(text, cx, cy);
    ctx.restore();

    STATE._regionLabelBoxes[key] = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
  };

  if (STATE.regions.solid.showLabel && tp) {
    const slMidX = sl.length ? sl[Math.floor(sl.length / 2)].x : tp.x;
    drawLabel('solid', (plotL + Math.min(slMidX, tp.x)) / 2, plotT + ph * 0.30, 'SOLID');
  }
  if (STATE.regions.liquid.showLabel && tp && cp) {
    drawLabel('liquid', (tp.x + cp.x) / 2, plotT + ph * 0.25, 'LIQUID');
  }
  if (STATE.regions.gas.showLabel && tp) {
    drawLabel('gas', tp.x + (plotR - tp.x) * 0.45, tp.y + (plotB - tp.y) * 0.55, 'GAS');
  }
  if (STATE.regions.super.showLabel && cp) {
    drawLabel('super', (cp.x + plotR) / 2, plotT + ph * 0.12, 'SUPERCRITICAL');
  }
}
