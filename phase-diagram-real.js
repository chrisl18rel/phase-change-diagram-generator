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
  // For NORMAL slope: left of SL, above SV
  // For NEGATIVE slope (water): SL leans left, solid region is to the LEFT of SL
  // In both cases: trace bottom-left corner → up SV curve (reversed) → up SL curve → top edge → close
  fill(() => {
    if (!sv.length || !sl.length || !tp) return;

    if (negSlope) {
      // Water: SL slopes left (higher pressure = lower T)
      // Solid is: left edge → bottom-left → up SV reversed → along SL (going left+up) → top edge
      ctx.moveTo(plotL, plotB);
      // Traverse SV in reverse (bottom to triple point)
      sv.slice().reverse().forEach(pt => ctx.lineTo(pt.x, pt.y));
      // At triple point, follow SL upward (which goes LEFT as pressure increases)
      sl.forEach(pt => ctx.lineTo(pt.x, pt.y));
      // SL end goes off the top — close via left edge
      ctx.lineTo(plotL, plotT);
      ctx.closePath();
    } else {
      // Normal slope: SL curves slightly right as pressure increases
      ctx.moveTo(plotL, plotB);
      sv.slice().reverse().forEach(pt => ctx.lineTo(pt.x, pt.y));
      sl.forEach(pt => ctx.lineTo(pt.x, pt.y));
      const slEnd = sl[sl.length - 1];
      // SL end: go straight up to top, then left to plotL
      ctx.lineTo(slEnd.x, plotT);
      ctx.lineTo(plotL, plotT);
      ctx.closePath();
    }
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

  if (STATE.regions.solid.showLabel && tp) {
    // Place SOLID label in the middle of the solid region
    // For water (negative slope), solid is to the left of SL
    const slMidX = sl.length ? sl[Math.floor(sl.length / 2)].x : tp.x;
    const solidLabelX = (plotL + Math.min(slMidX, tp.x)) / 2;
    const solidLabelY = plotT + ph * 0.3;
    drawRegionLabel(ctx, 'SOLID', solidLabelX, solidLabelY);
  }

  if (STATE.regions.liquid.showLabel && tp && cp) {
    drawRegionLabel(ctx, 'LIQUID', (tp.x + cp.x) / 2, plotT + ph * 0.25);
  }

  if (STATE.regions.gas.showLabel && tp) {
    // GAS label: position below and right of the SV+LV junction area
    // Use a point well into the gas region
    const gasLabelX = tp.x + (plotR - tp.x) * 0.45;
    const gasLabelY = tp.y + (plotB - tp.y) * 0.55;
    // Clamp within plot area
    const gx = Math.min(plotR - 40, Math.max(plotL + 40, gasLabelX));
    const gy = Math.min(plotB - 20, Math.max(plotT + 20, gasLabelY));
    drawRegionLabel(ctx, 'GAS', gx, gy);
  }

  if (STATE.regions.super.showLabel && cp) {
    drawRegionLabel(ctx, 'SUPERCRITICAL', (cp.x + plotR) / 2, plotT + ph * 0.12);
  }
}
