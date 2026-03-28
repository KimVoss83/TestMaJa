import { state, _isTouchDevice } from '../state.js';
import { canvas, wrapper, setZoom } from '../canvas.js';
import { snapToPixel, ptDist, formatDistance } from '../utils/helpers.js';
import { throttledRender } from '../utils/loupe.js';
import * as _loupe from '../utils/loupe.js';
import { haptic } from '../ui/modals.js';
import { showPipeDistanceGuides } from '../ui/pipe-guides.js';
import { handleRefClick } from '../tools/ref.js';
import { handleDistanceClick } from '../tools/distance.js';
import { handleAreaClick, updatePreviewPolygon, finishArea } from '../tools/area.js';
import { handleCircleClick, updatePreviewCircle, finishCircle } from '../tools/circle.js';
import { handleArcClick, updatePreviewArc, finishArc } from '../tools/arc.js';
import { handlePipeClick, updatePreviewPipe, finishPipe } from '../tools/pipe.js';
import { handlePipeRefClick } from '../tools/pipe-refs.js';
import { updateLiveLabel } from '../tools/label.js';

// =========================================================
// MOBILE MAGNIFIER: Zwei Lupen-Kreise (Anfang links, Ende rechts)
// =========================================================
export const _mobileMag = (() => {
  if (!_isTouchDevice) return { show() {}, hide() {}, updateStart() {}, updateEnd() {}, hideStart() {}, hideEnd() {}, active: false };

  const SIZE = 130, ZOOM = 4;
  const dpr = () => window.devicePixelRatio || 1;

  function createMagCanvas(container) {
    const c = document.createElement('canvas');
    container.insertBefore(c, container.firstChild);
    const d = dpr();
    c.width = SIZE * d;
    c.height = SIZE * d;
    c.style.width = SIZE + 'px';
    c.style.height = SIZE + 'px';
    return { canvas: c, ctx: c.getContext('2d') };
  }

  const startEl = document.getElementById('mobile-mag-start');
  const endEl = document.getElementById('mobile-mag-end');
  const startMag = createMagCanvas(startEl);
  const endMag = createMagCanvas(endEl);

  function renderMag(mag, canvasX, canvasY, color) {
    const d = dpr();
    const ctx = mag.ctx;
    const c = mag.canvas;

    if (c.width !== SIZE * d) {
      c.width = SIZE * d; c.height = SIZE * d;
      c.style.width = SIZE + 'px'; c.style.height = SIZE + 'px';
    }

    const vpt = canvas.viewportTransform;
    const screenX = canvasX * vpt[0] + vpt[4];
    const screenY = canvasY * vpt[3] + vpt[5];
    const cpx = screenX * d, cpy = screenY * d;

    const srcW = (SIZE / ZOOM) * d, srcH = (SIZE / ZOOM) * d;
    const srcX = cpx - srcW / 2, srcY = cpy - srcH / 2;

    ctx.clearRect(0, 0, SIZE * d, SIZE * d);
    try { ctx.drawImage(canvas.lowerCanvasEl, srcX, srcY, srcW, srcH, 0, 0, SIZE * d, SIZE * d); } catch(_) {}

    ctx.save();
    ctx.scale(d, d);
    const h = SIZE / 2, GAP = 6;

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath(); ctx.arc(h, h, GAP + 1, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = color || 'rgba(210,30,30,0.92)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(h - GAP, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h + GAP, h); ctx.lineTo(SIZE, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h, 0); ctx.lineTo(h, h - GAP); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h, h + GAP); ctx.lineTo(h, SIZE); ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = color || 'rgba(210,30,30,1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(h, h, 2.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  let _active = false;
  return {
    get active() { return _active; },
    updateStart(canvasX, canvasY, color) { startEl.classList.add('visible'); _active = true; renderMag(startMag, canvasX, canvasY, color); },
    updateEnd(canvasX, canvasY, color) { endEl.classList.add('visible'); _active = true; renderMag(endMag, canvasX, canvasY, color); },
    hideStart() { startEl.classList.remove('visible'); },
    hideEnd() { endEl.classList.remove('visible'); },
    show() { _active = true; },
    hide() { _active = false; startEl.classList.remove('visible'); endEl.classList.remove('visible'); },
  };
})();

// =========================================================
// MOBILE CROSSHAIR: Positionierung + Sichtbarkeit
// =========================================================
const _crosshairEl = document.getElementById('mobile-crosshair');
const _finishBtn = document.getElementById('mobile-finish-btn');

function _showMobileCrosshair(clientX, clientY) {
  _crosshairEl.style.left = clientX + 'px';
  _crosshairEl.style.top = clientY + 'px';
  _crosshairEl.classList.add('visible');
}
function _hideMobileCrosshair() {
  _crosshairEl.classList.remove('visible');
}

// =========================================================
// MOBILE FINISH BUTTON: für Fläche/Leitung (Multi-Punkt)
// =========================================================
function _updateFinishBtn() {
  if (!_isTouchDevice) return;
  const showFinish =
    (state.tool === 'area' && state.areaPoints.length >= 3) ||
    (state.tool === 'pipe' && state.pipePoints.length >= 2);
  if (showFinish) {
    _finishBtn.classList.add('visible');
  } else {
    _finishBtn.classList.remove('visible');
  }
}

// =========================================================
// MOBILE: Punkt-Justierung via Capture-Phase
// Fängt touchstart VOR Fabric.js ab, damit mouse:down
// unterdrückt wird. Der Punkt wird erst bei touchend gesetzt.
// =========================================================
function _getCanvasPtrFromTouch(touch) {
  // Fabric.js getPointer verwenden für korrekte DPR/Retina-Berechnung
  return canvas.getPointer({
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.pageX,
    pageY: touch.pageY,
  });
}

function _updateMobileMagnifiers(p) {
  const col = state.color || 'rgba(210,30,30,0.92)';
  let hasStart = false;
  if (state.tool === 'ref' && state.refPoints.length === 1) {
    _mobileMag.updateStart(state.refPoints[0].x, state.refPoints[0].y, '#cc0000');
    hasStart = true;
  } else if (state.tool === 'distance' && state.distPoints.length === 1) {
    _mobileMag.updateStart(state.distPoints[0].x, state.distPoints[0].y, col);
    hasStart = true;
  } else if (state.tool === 'circle' && state.circleCenter) {
    _mobileMag.updateStart(state.circleCenter.x, state.circleCenter.y, col);
    hasStart = true;
  } else if (state.tool === 'arc' && state.arcStep >= 1 && state.arcCenter) {
    _mobileMag.updateStart(state.arcCenter.x, state.arcCenter.y, col);
    hasStart = true;
  } else if (state.tool === 'area' && state.areaPoints.length >= 1) {
    const lastPt = state.areaPoints[state.areaPoints.length - 1];
    _mobileMag.updateStart(lastPt.x, lastPt.y, col);
    hasStart = true;
  } else if (state.tool === 'pipe' && state.pipePoints.length >= 1) {
    const lastPt = state.pipePoints[state.pipePoints.length - 1];
    _mobileMag.updateStart(lastPt.x, lastPt.y, col);
    hasStart = true;
  }
  if (hasStart) {
    // Zweiter Punkt: A zeigt Startpunkt (oben gesetzt), B zeigt Fingerposition
    _mobileMag.updateEnd(p.x, p.y, col);
  } else {
    // Erster Punkt: A zeigt Fingerposition, B ausblenden
    _mobileMag.updateStart(p.x, p.y, col);
    _mobileMag.hideEnd();
  }
}

export function initTouchHandlers({ _touchSuppressClickRef, _mobileAdjust }) {
  const DRAWING_TOOLS = ['ref', 'distance', 'area', 'circle', 'arc', 'pipe'];

  if (_isTouchDevice) {
    // Lupe auf Touch-Geräten deaktivieren (Desktop-Lupe nicht nötig)
    _loupe.disable();

    // Finish-Button Handler
    _finishBtn.addEventListener('click', () => {
      if (state.tool === 'area' && state.areaPoints.length >= 3) {
        finishArea();
      } else if (state.tool === 'pipe' && state.pipePoints.length >= 2) {
        finishPipe();
      }
      _finishBtn.classList.remove('visible');
      _mobileMag.hide();
      _hideMobileCrosshair();
    });

    // Capture-Phase: fängt Touch VOR Fabric.js ab
    canvas.upperCanvasEl.addEventListener('touchstart', e => {
      if (!DRAWING_TOOLS.includes(state.tool)) return;
      if (!state.backgroundImage) return;
      if (e.touches.length !== 1) return;
      if (Date.now() < _touchSuppressClickRef._pinchCooldownUntil) return;

      // iOS-Standardverhalten verhindern (verhindert auch Fabric.js mouse:down via Maus-Emulation)
      e.preventDefault();
      e.stopImmediatePropagation();

      // Fabric.js mouse:down unterdrücken (falls es trotzdem feuert)
      _touchSuppressClickRef.value = true;
      _mobileAdjust.active = true;

      const touch = e.touches[0];
      const p = _getCanvasPtrFromTouch(touch);
      _mobileAdjust.lastCanvasPos = p;

      // Crosshair + Magnifier sofort zeigen
      _showMobileCrosshair(touch.clientX, touch.clientY);
      _updateMobileMagnifiers(p);
    }, { capture: true, passive: false });

    // Touchmove: Crosshair + Magnifier updaten, Preview-Linie updaten
    canvas.upperCanvasEl.addEventListener('touchmove', e => {
      if (!_mobileAdjust.active || e.touches.length !== 1) return;

      // Fabric.js darf diesen Move nicht verarbeiten (sonst Doppel-Rendering)
      e.preventDefault();
      e.stopImmediatePropagation();

      const touch = e.touches[0];
      const p = _getCanvasPtrFromTouch(touch);
      _mobileAdjust.lastCanvasPos = p;

      // Crosshair-Overlay verschieben
      _showMobileCrosshair(touch.clientX, touch.clientY);

      // Preview-Linie manuell updaten
      const snapped = snapToPixel(p);
      if (state.tool === 'ref' && state.refPoints.length === 1 && state.drawingLine) {
        state.drawingLine.set({ x2: snapped.x, y2: snapped.y });
        throttledRender();
      }
      if (state.tool === 'distance' && state.distPoints.length === 1 && state.drawingLine) {
        state.drawingLine.set({ x2: snapped.x, y2: snapped.y });
        const p1 = state.distPoints[0];
        const pxDist = ptDist(p1.x, p1.y, snapped.x, snapped.y) / state.imgDisplayScale;
        const meters = state.scale ? pxDist / state.scale : null;
        const liveText = meters ? formatDistance(meters) : `${Math.round(pxDist)} px`;
        updateLiveLabel(p1, snapped, liveText);
        throttledRender();
      }
      if (state.tool === 'area' && state.areaPoints.length > 0) {
        updatePreviewPolygon([...state.areaPoints, snapped]);
      }
      if (state.tool === 'circle' && state.circleCenter) {
        const r = Math.hypot(snapped.x - state.circleCenter.x, snapped.y - state.circleCenter.y);
        updatePreviewCircle(state.circleCenter, r, snapped);
        const rOrig = r / state.imgDisplayScale;
        const rMeters = state.scale ? rOrig / state.scale : null;
        const liveText = rMeters ? `r = ${formatDistance(rMeters)}` : `r = ${Math.round(r)} px`;
        updateLiveLabel(state.circleCenter, snapped, liveText);
      }
      if (state.tool === 'arc' && state.arcStep >= 1) {
        updatePreviewArc(snapped);
      }
      if (state.tool === 'pipe' && state.pipePoints.length > 0) {
        updatePreviewPipe([...state.pipePoints, snapped]);
      }
      if (DRAWING_TOOLS.includes(state.tool) && !state.pipeRefMode) {
        showPipeDistanceGuides(snapped);
      }

      // Magnifier updaten
      _updateMobileMagnifiers(snapped);
    }, { capture: true, passive: false });

    // Touchend: Punkt bestätigen
    canvas.upperCanvasEl.addEventListener('touchend', e => {
      if (!_mobileAdjust.active) return;

      // Fabric.js touchend unterdrücken
      e.preventDefault();
      e.stopImmediatePropagation();

      _mobileAdjust.active = false;
      _touchSuppressClickRef.value = false; // Reset für nächsten Touch
      _hideMobileCrosshair();
      haptic('light'); // Haptisches Feedback bei Punkt-Bestätigung

      const touch = e.changedTouches[0];
      const p = _getCanvasPtrFromTouch(touch);
      const snapped = snapToPixel(p);

      // Punkt an Tool-Handler übergeben
      // Prüfe zuerst Referenz-Erstellung
      if (DRAWING_TOOLS.includes(state.tool) && handlePipeRefClick(snapped)) {
        _mobileMag.hide();
        return;
      }

      switch (state.tool) {
        case 'ref':      handleRefClick(snapped); break;
        case 'distance': handleDistanceClick(snapped); break;
        case 'area':     handleAreaClick(snapped); break;
        case 'circle':   handleCircleClick(snapped); break;
        case 'arc':      handleArcClick(snapped); break;
        case 'pipe':     handlePipeClick(snapped); break;
      }

      // Finish-Button für Multi-Punkt-Tools aktualisieren
      _updateFinishBtn();

      // Magnifier aktualisieren: Start-Lupe zeigt den gerade gesetzten Punkt
      _updateMobileMagnifiers(snapped);

      // Wenn Messung abgeschlossen (Tool-State zurückgesetzt), Lupen ausblenden
      const toolDone =
        (state.tool === 'ref' && state.refPoints.length === 0) ||
        (state.tool === 'distance' && state.distPoints.length === 0) ||
        (state.tool === 'circle' && !state.circleCenter) ||
        (state.tool === 'arc' && state.arcStep === 0);
      if (toolDone) {
        _mobileMag.hide();
      }
    }, { capture: true });
  }
}

// =========================================================
// TOUCH: STATE-MACHINE MIT PUNKT-JUSTIERUNG (Pinch + Pan)
// =========================================================
export function initTouchPinchPan({ _touchSuppressClickRef, _mobileAdjust }) {
  // Prüfe ob Touch auf dem Drop-Overlay oder dessen Buttons stattfindet
  function _touchOnOverlay(e) {
    const overlay = document.getElementById('drop-overlay');
    return overlay && !overlay.classList.contains('hidden') && overlay.contains(e.target);
  }

  // Verhindere iOS-Bounce/Zoom auf dem Canvas-Bereich
  wrapper.addEventListener('touchmove', e => {
    if (_touchOnOverlay(e)) return; // Overlay-Buttons nicht blockieren
    if (e.touches.length >= 2 || state.tool !== 'select') {
      e.preventDefault();
    }
  }, { passive: false });

  let _touchState = { type: null, lastDist: 0, lastMid: null, startTime: 0 };
  const _PINCH_COOLDOWN_MS = 350;
  const _DOUBLE_TAP_MS = 400;

  // --- touchstart (Bubbling: Pinch + Pan) ---
  wrapper.addEventListener('touchstart', e => {
    if (_touchOnOverlay(e)) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      _touchSuppressClickRef.value = true;
      if (_mobileAdjust.active) { _mobileAdjust.active = false; _hideMobileCrosshairLocal(); }
      _touchState.type = 'pinch';
      _touchState.lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      _touchState.lastMid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      return;
    }

    if (e.touches.length === 1) {
      if (Date.now() < _touchSuppressClickRef._pinchCooldownUntil) {
        _touchSuppressClickRef.value = true;
        _touchState.type = 'cooldown';
        return;
      }
      _touchState.type = 'single';
      _touchState.startTime = Date.now();
      _touchState.lastMid = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: false });

  // --- touchmove (Pinch + Pan) ---
  wrapper.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && _touchState.type === 'pinch') {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const mid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      const factor = dist / _touchState.lastDist;
      const rect = wrapper.getBoundingClientRect();
      setZoom(canvas.getZoom() * factor, {
        x: mid.x - rect.left,
        y: mid.y - rect.top,
      });
      const dx = mid.x - _touchState.lastMid.x;
      const dy = mid.y - _touchState.lastMid.y;
      const vpt = canvas.viewportTransform.slice();
      vpt[4] += dx;
      vpt[5] += dy;
      canvas.setViewportTransform(vpt);
      _touchState.lastDist = dist;
      _touchState.lastMid = mid;
      return;
    }

    if (e.touches.length === 1 && _touchState.type === 'single' && state.tool === 'select') {
      e.preventDefault();
      const t = e.touches[0];
      if (_touchState.lastMid) {
        const dx = t.clientX - _touchState.lastMid.x;
        const dy = t.clientY - _touchState.lastMid.y;
        const vpt = canvas.viewportTransform.slice();
        vpt[4] += dx;
        vpt[5] += dy;
        canvas.setViewportTransform(vpt);
      }
      _touchState.lastMid = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });

  // --- touchend (Pinch-Cooldown) ---
  wrapper.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
      if (_touchState.type === 'pinch') {
        _touchSuppressClickRef._pinchCooldownUntil = Date.now() + _PINCH_COOLDOWN_MS;
        _touchSuppressClickRef.value = true;
      }
      _touchState.type = null;
      _touchState.lastMid = null;
    }
  }, { passive: true });

  // Verhindere Browser-Doppeltipp-Zoom auf Touch-Geräten
  document.addEventListener('dblclick', e => {
    if (_isTouchDevice) e.preventDefault();
  }, { passive: false });
}

// Local reference for _hideMobileCrosshair used inside pinch handler
function _hideMobileCrosshairLocal() {
  document.getElementById('mobile-crosshair')?.classList.remove('visible');
}
