// phase-diagram-real.js

// ── Draw equilibrium curves for a real compound ────────────────────────────
function drawRealCurves(ctx, m, pw, ph) {
  const cd = STATE.compoundData;
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
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  };

  const { sl, lv, sv } = STATE.boundaries;

  drawCurve(cd.solidLiquidCurve, sl.color, sl.width, src?.negativeSlope);
  drawCurve(cd.liquidVaporCurve, lv.color, lv.width, false);
  drawCurve(cd.solidVaporCurve,  sv.color, sv.width, false);

  // Anomaly arrow annotation when highlight is on
  if (src?.negativeSlope && STATE.boundaries.showAnomaly) {
    _drawAnomalyArrow(ctx, m, cd);
  }
}

function _drawAnomalyArrow(ctx, m, cd) {
  if (!cd.solidLiquidCurve || cd.solidLiquidCurve.length < 2) return;
  const pts = toCvs(cd.solidLiquidCurve);
  const mid = pts[Math.floor(pts.length / 2)];
  if (!mid) return;

  const color = STATE.boundaries.anomalyColor;
  const tx = Math.max(m.left + 10, mid.x - 90);
  const ty = mid.y - 18;

  ctx.save();
  ctx.fillStyle = color;
  ctx.font = 'bold 10px DM Sans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('← negative slope', tx, ty);
  ctx.restore();
}

// ── Region fills ───────────────────────────────────────────────────────────
function drawRealRegions(ctx, m, pw, ph) {
  const cd = STATE.compoundData;
  if (!cd) return;

  const plotL = m.left, plotR = m.left + pw;
  const plotT = m.top,  plotB = m.top + ph;

  const fill = (buildPath, cfg) => {
    if (!cfg.fill) return;
    ctx.save();
    ctx.beginPath();
    buildPath();
    ctx.fillStyle = hexToRgba(cfg.color, cfg.opacity / 100);
    ctx.fill();
    ctx.restore();
  };

  // Pre-compute canvas points for all curves
  const sv = toCvs(cd.solidVaporCurve  || []);
  const sl = toCvs(cd.solidLiquidCurve || []);
  const lv = toCvs(cd.liquidVaporCurve || []);
  const tp = cd.triplePoint  ? dataToCanvas(cd.triplePoint.T,  cd.triplePoint.P)  : null;
  const cp = cd.criticalPoint? dataToCanvas(cd.criticalPoint.T, cd.criticalPoint.P): null;

  // ── GAS region ────────────────────────────────────────────────────────────
  // Bounded by: solid-vapor (above), liquid-vapor (right of triple point),
  // and the bottom/right edges of the plot.
  fill(() => {
    if (!sv.length || !lv.length || !tp) return;
    // Start at bottom-left, travel along SV curve to triple point,
    // then along LV curve to critical point, then right/bottom edges.
    const svStart = sv[0];
    ctx.moveTo(plotL, plotB);
    ctx.lineTo(svStart.x, plotB);
    sv.forEach(pt => ctx.lineTo(pt.x, pt.y));
    lv.forEach(pt => ctx.lineTo(pt.x, pt.y));
    // From critical point, extend to right and bottom
    if (cp) {
      ctx.lineTo(plotR, cp.y);
    } else {
      ctx.lineTo(plotR, lv[lv.length-1].y);
    }
    ctx.lineTo(plotR, plotB);
    ctx.closePath();
  }, STATE.regions.gas);

  // ── SOLID region ──────────────────────────────────────────────────────────
  // Left of SL curve, above SV curve.
  fill(() => {
    if (!sv.length || !sl.length || !tp) return;
    ctx.moveTo(plotL, plotB);
    // Up SV curve in reverse (from plot-left to triple point)
    sv.slice().reverse().forEach(pt => ctx.lineTo(pt.x, pt.y));
    // Now at triple point, go up SL curve
    sl.forEach(pt => ctx.lineTo(pt.x, pt.y));
    // To top-left corner
    const slEnd = sl[sl.length - 1];
    ctx.lineTo(slEnd.x, plotT);
    ctx.lineTo(plotL, plotT);
    ctx.closePath();
  }, STATE.regions.solid);

  // ── LIQUID region ─────────────────────────────────────────────────────────
  // Between SL (left) and LV (right/bottom) curves, above triple point.
  fill(() => {
    if (!sl.length || !lv.length || !tp || !cp) return;
    // Triple point → up SL curve → top edge to CP-x → down to CP → back down LV
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
  // Above and to the right of the critical point — no phase boundary.
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

  if (STATE.regions.solid.showLabel && tp && sl.length) {
    // Center of solid region: between left edge and SL line, upper portion
    const slMidX = sl[Math.floor(sl.length/2)]?.x || (plotL + (tp?.x||0))/2;
    drawRegionLabel(ctx, 'SOLID', (plotL + slMidX) / 2, plotT + ph * 0.35);
  }

  if (STATE.regions.liquid.showLabel && tp && cp) {
    // Center between SL and LV curves, above triple point
    drawRegionLabel(ctx, 'LIQUID', (tp.x + cp.x) / 2, plotT + ph * 0.25);
  }

  if (STATE.regions.gas.showLabel && tp) {
    // Lower-right area
    const gasX = tp ? Math.min(plotR - 60, tp.x + pw * 0.35) : plotL + pw * 0.7;
    const gasY = tp ? Math.max(plotB - 50, tp.y + ph * 0.25) : m.top + ph * 0.7;
    drawRegionLabel(ctx, 'GAS', gasX, gasY);
  }

  if (STATE.regions.super.showLabel && cp) {
    drawRegionLabel(ctx, 'SUPERCRITICAL', (cp.x + plotR) / 2, plotT + ph * 0.12);
  }
}
