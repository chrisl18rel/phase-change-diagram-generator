// phase-diagram-colorpicker.js
// Advanced HSB color picker — ported from Solubility Curve Generator.

let _cpPopover  = null;
let _cpCallback = null;

// ── Color conversion ───────────────────────────────────────────────────────
function _cpHexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}
function _cpRgbToHex(r,g,b) {
  return '#' + [r,g,b].map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
}
function _cpRgbToHsb(r,g,b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0;
  if (d>0) {
    if (max===r) h=((g-b)/d+6)%6;
    else if (max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h=Math.round(h*60);
  }
  return { h, s: max>0?Math.round(d/max*100):0, v: Math.round(max*100) };
}
function _cpHsbToRgb(h,s,v) {
  s/=100; v/=100;
  const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  let r=0,g=0,b=0;
  if (h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;}
  else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else{r=c;b=x;}
  return { r:Math.round((r+m)*255), g:Math.round((g+m)*255), b:Math.round((b+m)*255) };
}
function _cpHsbToHex(h,s,v) { const {r,g,b}=_cpHsbToRgb(h,s,v); return _cpRgbToHex(r,g,b); }

// ── Open picker ────────────────────────────────────────────────────────────
function openColorPicker(anchorEl, currentColor, onColorChange) {
  closeColorPicker();
  _cpCallback = onColorChange;

  const { r:ir, g:ig, b:ib } = _cpHexToRgb(currentColor || '#e74c3c');
  let { h:cpH, s:cpS, v:cpV } = _cpRgbToHsb(ir,ig,ib);
  let cpMode = 'HSB';

  const pop = document.createElement('div');
  pop.className = 'cp-popover';
  pop.innerHTML = `
    <canvas class="cp-sb-canvas" id="cp-sb" width="280" height="150"></canvas>
    <div class="cp-strips">
      <div class="cp-strip-col">
        <div class="cp-hue-bar" id="cp-hue"><div class="cp-strip-thumb" id="cp-hue-thumb"></div></div>
      </div>
      <div class="cp-preview-col">
        <div class="cp-preview-swatch" id="cp-preview"></div>
      </div>
    </div>
    <div class="cp-mode-row">
      <button class="cp-mode-btn active" data-mode="HSB">HSB</button>
      <button class="cp-mode-btn" data-mode="RGB">RGB</button>
    </div>
    <div class="cp-inputs" id="cp-inputs"></div>`;
  document.body.appendChild(pop);
  _cpPopover = pop;

  // Position below anchor, flip if off-screen
  const rect = anchorEl.getBoundingClientRect();
  let top = rect.bottom + 6, left = rect.left;
  if (left + 290 > window.innerWidth) left = window.innerWidth - 298;
  if (top + 310 > window.innerHeight) top = rect.top - 316;
  pop.style.top = top + 'px'; pop.style.left = left + 'px';

  const sbCanvas = pop.querySelector('#cp-sb');
  const sbCtx    = sbCanvas.getContext('2d');
  const hueBar   = pop.querySelector('#cp-hue');
  const hueThumb = pop.querySelector('#cp-hue-thumb');
  const preview  = pop.querySelector('#cp-preview');
  const inputsEl = pop.querySelector('#cp-inputs');

  function drawSB() {
    const W = sbCanvas.width, H = sbCanvas.height;
    const gradH = sbCtx.createLinearGradient(0,0,W,0);
    gradH.addColorStop(0,'#fff'); gradH.addColorStop(1,`hsl(${cpH},100%,50%)`);
    sbCtx.fillStyle = gradH; sbCtx.fillRect(0,0,W,H);
    const gradV = sbCtx.createLinearGradient(0,0,0,H);
    gradV.addColorStop(0,'rgba(0,0,0,0)'); gradV.addColorStop(1,'rgba(0,0,0,1)');
    sbCtx.fillStyle = gradV; sbCtx.fillRect(0,0,W,H);
    const cx=(cpS/100)*W, cy=(1-cpV/100)*H;
    sbCtx.beginPath(); sbCtx.arc(cx,cy,7,0,Math.PI*2);
    sbCtx.strokeStyle='#fff'; sbCtx.lineWidth=2; sbCtx.stroke();
    sbCtx.beginPath(); sbCtx.arc(cx,cy,5,0,Math.PI*2);
    sbCtx.strokeStyle='rgba(0,0,0,0.4)'; sbCtx.lineWidth=1; sbCtx.stroke();
  }
  function updateHueThumb() { hueThumb.style.left = (cpH/360*100)+'%'; }
  function updatePreview() {
    const hex = _cpHsbToHex(cpH,cpS,cpV);
    preview.style.background = hex;
    anchorEl.style.background = hex;
    _cpCallback && _cpCallback(hex);
  }
  function buildInputs() {
    inputsEl.innerHTML = '';
    if (cpMode === 'HSB') {
      [['H',cpH,0,360],['S',cpS,0,100],['B',cpV,0,100]].forEach(([lbl,val,mn,mx]) => {
        const g = document.createElement('div'); g.className='cp-input-group';
        g.innerHTML=`<input type="number" min="${mn}" max="${mx}" value="${Math.round(val)}"><span class="cp-input-label">${lbl}</span>`;
        const inp = g.querySelector('input');
        inp.addEventListener('change',()=>{
          const v=Math.max(mn,Math.min(mx,parseInt(inp.value)||0));
          inp.value=v;
          if(lbl==='H')cpH=v; else if(lbl==='S')cpS=v; else cpV=v;
          refreshAll();
        });
        inputsEl.appendChild(g);
      });
    } else {
      const {r,g:gv,b}=_cpHsbToRgb(cpH,cpS,cpV);
      [['R',r],['G',gv],['B',b]].forEach(([lbl,val2]) => {
        const gp=document.createElement('div'); gp.className='cp-input-group';
        gp.innerHTML=`<input type="number" min="0" max="255" value="${Math.round(val2)}"><span class="cp-input-label">${lbl}</span>`;
        const inp=gp.querySelector('input');
        inp.addEventListener('change',()=>{
          const inputs=pop.querySelectorAll('.cp-input-group input');
          const {h,s,v}=_cpRgbToHsb(
            Math.max(0,Math.min(255,parseInt(inputs[0].value)||0)),
            Math.max(0,Math.min(255,parseInt(inputs[1].value)||0)),
            Math.max(0,Math.min(255,parseInt(inputs[2].value)||0))
          );
          cpH=h; cpS=s; cpV=v; refreshAll();
        });
        inputsEl.appendChild(gp);
      });
    }
    const hg=document.createElement('div'); hg.className='cp-input-group cp-hex-group';
    const hexVal=_cpHsbToHex(cpH,cpS,cpV).slice(1).toUpperCase();
    hg.innerHTML=`<input type="text" maxlength="6" value="${hexVal}"><span class="cp-input-label">#</span>`;
    const hexInp=hg.querySelector('input');
    hexInp.addEventListener('change',()=>{
      const v='#'+hexInp.value.replace(/[^0-9a-fA-F]/g,'').padStart(6,'0').slice(0,6);
      const {r,g,b}=_cpHexToRgb(v); const hsb=_cpRgbToHsb(r,g,b);
      cpH=hsb.h; cpS=hsb.s; cpV=hsb.v; refreshAll();
    });
    inputsEl.appendChild(hg);
  }
  function refreshAll() { drawSB(); updateHueThumb(); updatePreview(); buildInputs(); }
  refreshAll();

  pop.querySelectorAll('.cp-mode-btn').forEach(btn => {
    btn.addEventListener('click',()=>{
      pop.querySelectorAll('.cp-mode-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); cpMode=btn.dataset.mode; buildInputs();
    });
  });

  function sbPick(e) {
    const r2=sbCanvas.getBoundingClientRect();
    const x=Math.max(0,Math.min(sbCanvas.width,(e.clientX-r2.left)*sbCanvas.width/r2.width));
    const y=Math.max(0,Math.min(sbCanvas.height,(e.clientY-r2.top)*sbCanvas.height/r2.height));
    cpS=Math.round(x/sbCanvas.width*100); cpV=Math.round((1-y/sbCanvas.height)*100); refreshAll();
  }
  let sbDragging=false;
  sbCanvas.addEventListener('mousedown',e=>{sbDragging=true;sbPick(e);e.preventDefault();});
  document.addEventListener('mousemove',e=>{if(sbDragging)sbPick(e);});
  document.addEventListener('mouseup',()=>{sbDragging=false;});

  function huePick(e) {
    const r2=hueBar.getBoundingClientRect();
    cpH=Math.round(Math.max(0,Math.min(359,(e.clientX-r2.left)/r2.width*360))); refreshAll();
  }
  let hueDragging=false;
  hueBar.addEventListener('mousedown',e=>{hueDragging=true;huePick(e);e.preventDefault();});
  document.addEventListener('mousemove',e=>{if(hueDragging)huePick(e);});
  document.addEventListener('mouseup',()=>{hueDragging=false;});

  setTimeout(()=>{document.addEventListener('mousedown',_cpOutside);},20);
}

function _cpOutside(e) {
  if (_cpPopover && !_cpPopover.contains(e.target)) closeColorPicker();
}
function closeColorPicker() {
  if (_cpPopover) { _cpPopover.remove(); _cpPopover = null; }
  document.removeEventListener('mousedown',_cpOutside);
}

// ── Upgrade all native color inputs to swatch buttons ─────────────────────
// Called once at DOMContentLoaded. Any <input type="color"> gets hidden and
// a swatch button inserted before it. The picker callback updates the input
// value so existing syncStateFromDOM() calls continue to work unchanged.
function initColorSwatches() {
  document.querySelectorAll('input[type="color"]').forEach(input => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-swatch-btn-pd';
    btn.style.background = input.value || '#222222';
    btn.title = 'Pick color';
    // Hide native input but keep it in DOM for val() reads
    input.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    input.parentNode.insertBefore(btn, input);
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const orig = input.onchange;
      openColorPicker(btn, input.value || '#222222', col => {
        btn.style.background = col;
        input.value = col;
        // Fire the original onchange logic
        if (typeof renderDiagram === 'function') renderDiagram();
      });
    });
  });
}
