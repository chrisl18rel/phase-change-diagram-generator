// phase-diagram-export.js

// ── Shared helpers ─────────────────────────────────────────────────────────
function _compoundFilename() {
  const name = STATE.compoundKey
    ? (COMPOUND_DATA[STATE.compoundKey]?.name || 'diagram')
    : (STATE.fakeCompound?.name || 'diagram');
  return `phase-diagram-${name.replace(/\s+/g, '-').toLowerCase()}`;
}

function _compoundTitle() {
  const name = STATE.compoundKey
    ? (COMPOUND_DATA[STATE.compoundKey]?.name || 'Phase Diagram')
    : (STATE.fakeCompound?.name || 'Phase Diagram');
  return STATE.style.titleText || `Phase Diagram of ${name}`;
}

// Render to the live canvas with export flags set, return dataURL + canvas ref.
// transparent=true skips the white background fill (handled in renderDiagram).
function _captureCanvas(transparent) {
  const canvas = el('phaseDiagramCanvas');
  STATE._exporting         = true;
  STATE._exportTransparent = !!transparent;
  renderDiagram();
  const dataUrl = canvas.toDataURL('image/png');
  STATE._exporting         = false;
  STATE._exportTransparent = false;
  renderDiagram(); // restore drag handles / normal view
  return { canvas, dataUrl };
}

// ── PNG Download ───────────────────────────────────────────────────────────
function exportPNG() {
  const transparent = val('export-transparent');
  const { dataUrl } = _captureCanvas(transparent);
  const link = document.createElement('a');
  link.download = _compoundFilename() + '.png';
  link.href     = dataUrl;
  link.click();
  showToast('PNG downloaded', 'success');
}

// ── Copy to Clipboard ──────────────────────────────────────────────────────
function copyToClipboard() {
  const { canvas } = _captureCanvas(false);
  canvas.toBlob(blob => {
    if (!blob) { showToast('Copy failed — try PNG download instead', 'error'); return; }
    try {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(()  => showToast('Copied to clipboard', 'success'))
        .catch(()  => showToast('Clipboard not supported in this browser', 'error'));
    } catch {
      showToast('Clipboard not supported in this browser', 'error');
    }
  });
}

// ── Embed Code ─────────────────────────────────────────────────────────────
function showEmbedModal() {
  const { dataUrl } = _captureCanvas(false);
  const title = _compoundTitle();
  const alt   = `Phase Diagram — ${title}`;

  el('embed-code').value =
`<figure style="text-align:center; margin:1em 0;">
  <img
    src="${dataUrl}"
    alt="${alt}"
    title="${title}"
    style="max-width:100%; height:auto; border:1px solid #e0e0e0; border-radius:4px;"
  />
  <figcaption style="font-size:0.85em; color:#555; margin-top:6px;">
    ${title}
  </figcaption>
</figure>`;

  showModal('modal-embed');
}

function copyEmbedCode() {
  const code = el('embed-code')?.value;
  if (!code) return;
  navigator.clipboard.writeText(code)
    .then(()  => showToast('Embed code copied', 'success'))
    .catch(()  => {
      el('embed-code')?.select();
      document.execCommand('copy');
      showToast('Embed code copied', 'success');
    });
}
