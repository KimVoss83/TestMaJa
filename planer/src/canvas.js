import { state } from './state.js';

// =========================================================
// CANVAS
// =========================================================
const wrapper = document.getElementById('canvas-wrapper');
const canvas = new fabric.Canvas('c', {
  width: wrapper.clientWidth,
  height: wrapper.clientHeight,
  selection: true,
  backgroundColor: '#a8e6cf',
});

export { canvas, wrapper };

// Error boundary for canvas event handlers
export function _safeHandler(fn) {
  return function(opt) {
    try { fn.call(this, opt); }
    catch (e) { console.error('Canvas-Event-Handler Fehler:', e); }
  };
}

// =========================================================
// PAN & ZOOM
// =========================================================
let _zoomHudTimer = null;
const _zoomHud = () => document.getElementById('zoom-hud');

export function showZoomHUD(z) {
  const hud = _zoomHud();
  const pct = Math.round(z * 100) + '%';
  hud.textContent = pct;
  hud.classList.remove('fading');
  hud.classList.add('visible');
  document.getElementById('status-zoom').textContent = pct;
  clearTimeout(_zoomHudTimer);
  _zoomHudTimer = setTimeout(() => {
    hud.classList.add('fading');
    setTimeout(() => hud.classList.remove('visible', 'fading'), 650);
  }, 900);
}

export function setZoom(z, point) {
  z = Math.min(Math.max(z, 0.05), 20);
  if (point && isFinite(point.x) && isFinite(point.y)) canvas.zoomToPoint(point, z);
  else canvas.setZoom(z);
  state.zoom = z;
  showZoomHUD(z);
}

export function zoomToFit() {
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  setZoom(1);
}

export function startPan(e) {
  state.panning = true;
  state.lastPan = { x: e.clientX, y: e.clientY };
  canvas.defaultCursor = 'grabbing';
  wrapper.classList.add('panning');
}

export function stopPan() {
  state.panning = false;
  wrapper.classList.remove('panning');
  if (!state.spacePan) canvas.defaultCursor = state.tool === 'select' ? 'default' : 'crosshair';
}

// Expose for inline onclick handlers
window.zoomToFit = zoomToFit;
