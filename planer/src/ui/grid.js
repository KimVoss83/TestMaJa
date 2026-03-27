import { state } from '../state.js';
import { canvas, wrapper } from '../canvas.js';

export const GRID_NICE_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 200, 500, 1000];

export function drawGrid() {
  const gc = document.getElementById('grid-canvas');
  if (!gc) return;
  const ctx = gc.getContext('2d');
  ctx.clearRect(0, 0, gc.width, gc.height);
  if (!state.gridVisible || !state.scale || !state.backgroundImage) return;

  const vpt = canvas.viewportTransform;
  const zoom = vpt[0];
  const img  = state.backgroundImage;

  // Screen-px per meter
  const pxPerMeter = state.imgDisplayScale * state.scale * zoom;

  // Choose grid step: fixed or auto (at least 55px apart)
  let gridStep;
  if (state.gridStepM > 0) {
    gridStep = state.gridStepM;
  } else {
    const rawStep = 55 / pxPerMeter;
    gridStep = GRID_NICE_STEPS.find(s => s >= rawStep) || GRID_NICE_STEPS[GRID_NICE_STEPS.length - 1];
  }
  const stepPx = gridStep * pxPerMeter;

  // Image bounds in screen coords
  const iL = img.left  * zoom + vpt[4];
  const iT = img.top   * zoom + vpt[5];
  const iW = img.width  * state.imgDisplayScale * zoom;
  const iH = img.height * state.imgDisplayScale * zoom;
  const iR = iL + iW;
  const iB = iT + iH;

  const fmtM = v => {
    if (gridStep >= 1)    return `${v}\u202fm`;
    if (gridStep >= 0.1)  return `${v.toFixed(1)}\u202fm`;
    return `${v.toFixed(2)}\u202fm`;
  };

  const nCols = Math.ceil(iW / stepPx);
  const nRows = Math.ceil(iH / stepPx);

  ctx.save();

  // ── Grid lines (Farbe + Deckkraft aus state) ───────────
  const _gc = state.gridColor || '#ffffff';
  const _go = state.gridOpacity != null ? state.gridOpacity : 0.28;
  // Hex → rgb für rgba()
  const _r = parseInt(_gc.slice(1,3),16), _g = parseInt(_gc.slice(3,5),16), _b = parseInt(_gc.slice(5,7),16);
  const gridLineStyle = `rgba(${_r},${_g},${_b},${_go})`;
  const gridAxisStyle = `rgba(${_r},${_g},${_b},${Math.min(1, _go * 2.5)})`;

  for (let i = 0; i <= nCols; i++) {
    const x = iL + i * stepPx;
    if (x < iL - 0.5 || x > iR + 0.5) continue;
    ctx.beginPath(); ctx.moveTo(x, iT); ctx.lineTo(x, iB);
    if (i === 0) {
      ctx.strokeStyle = gridAxisStyle; ctx.lineWidth = 1.2; ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = gridLineStyle; ctx.lineWidth = 0.8; ctx.setLineDash([3, 6]);
    }
    ctx.stroke();
  }
  for (let i = 0; i <= nRows; i++) {
    const y = iT + i * stepPx;
    if (y < iT - 0.5 || y > iB + 0.5) continue;
    ctx.beginPath(); ctx.moveTo(iL, y); ctx.lineTo(iR, y);
    if (i === 0) {
      ctx.strokeStyle = gridAxisStyle; ctx.lineWidth = 1.2; ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = gridLineStyle; ctx.lineWidth = 0.8; ctx.setLineDash([3, 6]);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── Axis labels ─────────────────────────────────────────
  const fs = 10;
  ctx.font = `bold ${fs}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textBaseline = 'top';

  // X-axis: labels along top edge (skip i=0)
  for (let i = 1; i <= nCols; i++) {
    const x = iL + i * stepPx;
    if (x < iL + 2 || x > iR - 2) continue;
    const label = fmtM(i * gridStep);
    const tw = ctx.measureText(label).width;
    const lx = x + 3;
    const ly = iT + 3;
    if (lx + tw + 3 > iR) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    roundRect(ctx, lx - 2, ly - 1, tw + 4, fs + 4, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx, ly);
  }

  // Y-axis: labels along left edge (skip i=0)
  for (let i = 1; i <= nRows; i++) {
    const y = iT + i * stepPx;
    if (y < iT + 2 || y > iB - 2) continue;
    const label = fmtM(i * gridStep);
    const tw = ctx.measureText(label).width;
    const lx = iL + 4;
    const ly = y + 3;
    if (ly + fs + 3 > iB) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    roundRect(ctx, lx - 2, ly - 1, tw + 4, fs + 4, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx, ly);
  }

  ctx.restore();

  // Update info text
  const info = document.getElementById('grid-info');
  if (info) info.textContent = `Raster: ${fmtM(gridStep).trim()} · Zoom: ${Math.round(zoom * 100)}%`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  const btn = document.getElementById('btn-grid-toggle');
  if (btn) {
    btn.textContent = state.gridVisible ? 'Sichtbar' : 'Ausgeblendet';
    btn.classList.toggle('hidden-layer', !state.gridVisible);
  }
  if (!state.gridVisible) {
    const gc = document.getElementById('grid-canvas');
    if (gc) gc.getContext('2d').clearRect(0, 0, gc.width, gc.height);
    const info = document.getElementById('grid-info');
    if (info) info.textContent = state.scale ? 'Raster ausgeblendet' : 'Kein Maßstab gesetzt';
  } else {
    const gc = document.getElementById('grid-canvas');
    if (gc) { gc.width = wrapper.clientWidth; gc.height = wrapper.clientHeight; }
    drawGrid();
  }
}

export function setGridStep(val) {
  state.gridStepM = parseFloat(val) || 0;
  drawGrid();
}

export function setGridColor(hex) {
  state.gridColor = hex;
  drawGrid();
}

export function setGridOpacity(val) {
  state.gridOpacity = parseInt(val, 10) / 100;
  document.getElementById('grid-opacity-label').textContent = val + '%';
  drawGrid();
}

// Expose on window for inline onclick handlers in HTML
window.toggleGrid = toggleGrid;
window.setGridStep = setGridStep;
window.setGridColor = setGridColor;
window.setGridOpacity = setGridOpacity;
