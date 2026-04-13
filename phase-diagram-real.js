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

  // ── Compute GENEROUS safe zones — always, for every region ───────────────
  // The label should be freely movable anywhere within its region.
  // Use the natural canvas coordinates of tp and cp as the primary dividers.
  // Keep margins tiny (2px) so the user has maximum freedom.

  if (tp) {
    // SOLID: everything to the LEFT of the SL curve.
    // tp.x is where the SL curve begins (triple point), so solid ends there.
    const solidXMax = tp.x - 2;
    STATE._regionBounds.solid = {
      xMin: plotL + 2,
      xMax: Math.max(plotL + 10, solidXMax),
      yMin: plotT + 2,
      yMax: plotB - 2
    };

    // GAS: below the LV and SV curves, i.e., below the triple-point pressure.
    // In canvas coords: tp.y is HIGH (larger number = lower pressure = lower on screen).
    // Gas region exists for canvas y > tp.y.
    // The x range for gas covers the full width (gas can be far left at very low P).
    STATE._regionBounds.gas = {
      xMin: plotL + 2,
      xMax: plotR - 2,
      yMin: tp.y + 2,    // strictly below triple point pressure
      yMax: plotB - 2
    };
  }

  if (tp && cp) {
    // LIQUID: between the SL curve (left) and LV curve (right), above triple point.
    // x: tp.x → cp.x  |  y: plotT → tp.y  (canvas y < tp.y means higher pressure)
    STATE._regionBounds.liquid = {
      xMin: tp.x + 2,
      xMax: Math.max(tp.x + 10, cp.x - 2),
      yMin: plotT + 2,
      yMax: Math.max(plotT + 10, tp.y - 2)  // tp.y is the floor of liquid
    };
  }

  if (cp) {
    // SUPERCRITICAL: upper-right corner beyond the critical point.
    // cp.y is relatively small (high pressure = high on canvas = small y value).
    STATE._regionBounds.super = {
      xMin: Math.min(cp.x + 2, plotR - 10),
      xMax: plotR - 2,
      yMin: plotT + 2,
      yMax: Math.max(plotT + 10, cp.y - 2)
    };
  }

  // ── Draw a label — apply stored override, clamp, auto-clear grossly stale ─
  const drawLabel = (key, defaultX, defaultY, text) => {
    const bounds = STATE._regionBounds[key];

    ctx.font = `bold ${labelSize}px DM Sans, sans-serif`;
    const tw = ctx.measureText(text).width;
    const th = labelSize;

    let cx = defaultX;
    let cy = defaultY;

    const ov = STATE.regionLabelOffsets?.[key];
    if (ov) {
      const desiredCx = ov.x + tw / 2;
      const desiredCy = ov.y + th / 2;

      // Clear overrides that have drifted BADLY outside the current region
      // (e.g. user moved fake compound dramatically). Threshold = 25% of plot.
      if (bounds) {
        const farMargin = Math.max(pw, ph) * 0.25;
        const stale = desiredCx < bounds.xMin - farMargin ||
                      desiredCx > bounds.xMax + farMargin ||
                      desiredCy < bounds.yMin - farMargin ||
                      desiredCy > bounds.yMax + farMargin;
        if (stale) {
          delete STATE.regionLabelOffsets[key];
        } else {
          cx = desiredCx;
          cy = desiredCy;
        }
      } else {
        cx = desiredCx;
        cy = desiredCy;
      }
    }

    // Clamp to region bounds when they exist and have positive area
    if (bounds && bounds.xMax > bounds.xMin && bounds.yMax > bounds.yMin) {
      // Only clamp the center — allow text that's slightly bigger than bounds to still show
      cx = Math.max(bounds.xMin + tw / 2, Math.min(bounds.xMax - tw / 2, cx));
      cy = Math.max(bounds.yMin + th / 2, Math.min(bounds.yMax - th / 2, cy));
    }
    // Fallback clamp: always stay within the full plot area
    cx = Math.max(plotL + tw / 2, Math.min(plotR - tw / 2, cx));
    cy = Math.max(plotT + th / 2, Math.min(plotB - th / 2, cy));

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
