import { canvas } from '../canvas.js';

const SIZE = 160, ZOOM = 4, OFF = 22, GAP = 7;
let _active = false;
let _disabled = false;

// Retina-aware loupe canvas: SIZE*dpr physical pixels, displayed at SIZE CSS pixels
const dpr = () => window.devicePixelRatio || 1;
const c = document.createElement('canvas');
const el = document.createElement('div');
el.id = 'loupe';
el.appendChild(c);
document.body.appendChild(el);

function _resizeCanvas() {
  const d = dpr();
  c.width  = SIZE * d;
  c.height = SIZE * d;
  c.style.width  = SIZE + 'px';
  c.style.height = SIZE + 'px';
}
_resizeCanvas();
const ctx = c.getContext('2d');

export function show() {
  if (_disabled || _active) return;
  _active = true;
  _resizeCanvas(); // refresh in case DPR changed (e.g. moved to another screen)
  el.style.display = 'block';
  if (canvas.upperCanvasEl) canvas.upperCanvasEl.style.cursor = 'none';
}

export function hide() {
  if (!_active) return;
  _active = false;
  el.style.display = 'none';
  if (canvas.upperCanvasEl) canvas.upperCanvasEl.style.cursor = '';
}

// offsetX/Y = mouse position on the canvas element in CSS pixels
export function update(clientX, clientY, offsetX, offsetY) {
  if (!_active) return;
  const d = dpr();

  // Position loupe top-right of cursor, flip near viewport edges
  let left = clientX + OFF, top = clientY - SIZE - OFF;
  if (left + SIZE > window.innerWidth - 10)  left = clientX - SIZE - OFF;
  if (top < 10)                               top  = clientY + OFF;
  el.style.left = left + 'px';
  el.style.top  = top  + 'px';

  // lowerCanvasEl pixels = CSS pixels × dpr (Fabric scales the canvas bitmap by DPR).
  // offsetX is in CSS pixels, so the cursor sits at physical pixel offsetX * dpr in the bitmap.
  const cpx = offsetX * d;
  const cpy = offsetY * d;

  // Source region in lowerCanvasEl (physical pixels): SIZE/ZOOM pixels wide → 4× magnification
  const srcW = (SIZE / ZOOM) * d;
  const srcH = (SIZE / ZOOM) * d;
  const srcX = cpx - srcW / 2;
  const srcY = cpy - srcH / 2;

  ctx.clearRect(0, 0, SIZE * d, SIZE * d);
  try { ctx.drawImage(canvas.lowerCanvasEl, srcX, srcY, srcW, srcH, 0, 0, SIZE * d, SIZE * d); } catch(_) {}

  // Crosshair – draw in logical pixels via scale
  ctx.save();
  ctx.scale(d, d);
  const h = SIZE / 2;

  // White halo at center so the exact endpoint is always visible through any fill/line
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.beginPath(); ctx.arc(h, h, GAP + 1, 0, Math.PI * 2); ctx.fill();

  // Dashed crosshair lines
  ctx.strokeStyle = 'rgba(210,30,30,0.92)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 3]);
  ctx.beginPath(); ctx.moveTo(0, h);         ctx.lineTo(h - GAP, h);     ctx.stroke();
  ctx.beginPath(); ctx.moveTo(h + GAP, h);   ctx.lineTo(SIZE, h);        ctx.stroke();
  ctx.beginPath(); ctx.moveTo(h, 0);         ctx.lineTo(h, h - GAP);     ctx.stroke();
  ctx.beginPath(); ctx.moveTo(h, h + GAP);   ctx.lineTo(h, SIZE);        ctx.stroke();

  // Center dot
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(210,30,30,1)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(h, h, 2.5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

export function isActive() { return _active; }

/** Disable the loupe entirely (e.g. on touch devices). */
export function disable() {
  _disabled = true;
  hide();
}

// ── RAF-Throttle for mouse:move renderAll ─────────────────
let _rafPending = false;
export function throttledRender() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => { _rafPending = false; canvas.renderAll(); });
}
