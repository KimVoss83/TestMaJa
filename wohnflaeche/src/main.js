import { state, _isTouchDevice } from './state.js';
import { canvas, wrapper, _safeHandler, setZoom, zoomToFit, startPan, stopPan } from './canvas.js';
import { history, registerRestoreHook, saveSnapshot, undo, redo, updateUndoRedoButtons } from './undo.js';
import { createModal } from './ui/modals.js';
import { snapToPixel, ptDist, formatDistance } from './utils/helpers.js';
import * as _loupe from './utils/loupe.js';
import { throttledRender } from './utils/loupe.js';
import { drawGrid } from './ui/grid.js';
import { TOOL_HINTS, initToolManager, initToolbar, registerToolHook } from './tools/tool-manager.js';
import { handleDistanceClick, finishDistance } from './tools/distance.js';
import { handleAreaClick, updatePreviewPolygon, finishArea, startAreaEdit, endAreaEdit, updateAreaFromHandles, getAreaSnap90, setAreaSnap90, setShiftHeld } from './tools/area.js';
import { handleCircleClick, updatePreviewCircle, finishCircle } from './tools/circle.js';
import { handleArcClick, updatePreviewArc, finishArc } from './tools/arc.js';
import { handleLabelClick, editLabel, updateLiveLabel, removeLiveLabel } from './tools/label.js';
import { handleRefClick, updateRefStatus } from './tools/ref.js';
import { handleRoomClick, handleRoomDblClick, cancelRoomDraft, rebuildRooms } from './tools/room.js';
import { handleZoneClick, handleZoneDblClick, cancelZoneDraft } from './tools/zone.js';
import { updateMeasurementList, removeMeasurement, initSidebarResize, resizeLabelCluster } from './ui/sidebar.js';
import { updateRoomList } from './ui/raumliste.js';
import './io/library.js'; // side-effect: inits custom lib, renders library, sets window.* for onclick
import './io/image-loader.js'; // side-effect: sets up file-input and drag-drop handlers
import './io/save-load.js'; // side-effect: sets window.openSaveModal, window.openLoadModal
import { initMobileDrawer, initBottomToolbar, initOrientationChange } from './mobile/drawer.js';
import { initTouchHandlers, initTouchPinchPan, _mobileMag } from './mobile/touch.js';

// =========================================================
// TOUCH STATE (shared refs — declared here so canvas event handlers below can access them)
// =========================================================
// These are passed into initTouchHandlers / initTouchPinchPan further below.
const _touchSuppressClickRef = { value: false, _pinchCooldownUntil: 0 };
const _mobileAdjust = {
  active: false,       // currently adjusting a point
  lastCanvasPos: null, // last known canvas-coordinate position
};

// =========================================================
// CANVAS EVENTS
// =========================================================

canvas.on('mouse:move', _safeHandler(opt => {
  const p = canvas.getPointer(opt.e);
  document.getElementById('status-coords').textContent = `x: ${Math.round(p.x)}, y: ${Math.round(p.y)}`;

  // Auf Touch-Geräten: Preview-Updates nur wenn NICHT im Adjust-Modus
  // (dort übernimmt der Capture-Touchmove-Handler die Updates, um Doppel-Rendering zu vermeiden)
  const _skipPreview = _mobileAdjust.active;
  if (!_skipPreview) {
  // Ref line preview
  if (state.tool === 'ref' && state.refPoints.length === 1 && state.drawingLine) {
    state.drawingLine.set({ x2: p.x, y2: p.y });
    throttledRender();
  }
  // Distance preview mit Live-Messwert
  if (state.tool === 'distance' && state.distPoints.length === 1 && state.drawingLine) {
    state.drawingLine.set({ x2: p.x, y2: p.y });
    const p1 = state.distPoints[0];
    const pxDist = ptDist(p1.x, p1.y, p.x, p.y) / state.imgDisplayScale;
    const meters = state.scale ? pxDist / state.scale : null;
    const liveText = meters ? formatDistance(meters) : `${Math.round(pxDist)} px`;
    updateLiveLabel(p1, p, liveText);
    throttledRender();
  }
  // Area preview
  if (state.tool === 'area' && state.areaPoints.length > 0) {
    updatePreviewPolygon([...state.areaPoints, p]);
  }
  // Circle preview mit Live-Radius
  if (state.tool === 'circle' && state.circleCenter) {
    const r = Math.hypot(p.x - state.circleCenter.x, p.y - state.circleCenter.y);
    updatePreviewCircle(state.circleCenter, r, p);
    const rOrig = r / state.imgDisplayScale;
    const rMeters = state.scale ? rOrig / state.scale : null;
    const liveText = rMeters ? `r = ${formatDistance(rMeters)}` : `r = ${Math.round(r)} px`;
    updateLiveLabel(state.circleCenter, p, liveText);
  }
  // Arc preview
  if (state.tool === 'arc' && state.arcStep >= 1) {
    updatePreviewArc(p);
  }
  } // end !_skipPreview

  // Loupe: show when a drawing/measurement tool is active, hide during pan
  const _loupeActive =
    state.tool !== 'select' &&
    !state.panning && !state.spacePan && !!state.backgroundImage;
  if (_loupeActive) { _loupe.show(); _loupe.update(opt.e.clientX, opt.e.clientY, opt.e.offsetX, opt.e.offsetY); }
  else              { _loupe.hide(); }

  // Mobile Magnifiers werden jetzt über die Touch-Capture-Handlers gesteuert
}));

canvas.on('mouse:out', () => { _loupe.hide(); });


canvas.on('mouse:down', _safeHandler(opt => {
  if (_touchSuppressClickRef.value) { _touchSuppressClickRef.value = false; return; }
  if (opt.e.altKey || state.spacePan) { startPan(opt.e); return; }
  const pRaw = canvas.getPointer(opt.e);
  const p = (state.tool !== 'select' && state.tool !== 'label') ? snapToPixel(pRaw) : pRaw;

  // End area edit when clicking on something that isn't an area handle or the edited polygon
  if (state.tool === 'select' && state.editingArea && opt.target) {
    if (!opt.target._areaHandle && opt.target !== state.editingArea.polygon) {
      endAreaEdit(); saveSnapshot();
    }
  }
  if (state.tool === 'select' && state.editingArea && !opt.target) {
    endAreaEdit(); saveSnapshot();
  }

  // Label tool: clicking an existing label → select/drag, not create new
  if (state.tool === 'label' && opt.target && opt.target._userLabel) return;

  switch (state.tool) {
    case 'ref':      handleRefClick(p); break;
    case 'distance': handleDistanceClick(p); break;
    case 'area':     handleAreaClick(p); break;
    case 'circle':   handleCircleClick(p); break;
    case 'arc':      handleArcClick(p); break;
    case 'label':    handleLabelClick(p); break;
    case 'room':     handleRoomClick(p, opt.e); break;
    case 'zone':      handleZoneClick(p, 'zone'); break;
    case 'deduction': handleZoneClick(p, 'deduction'); break;
  }
}));

canvas.on('mouse:up', _safeHandler(() => {
  stopPan();
}));

// Area handle dragging — live update polygon + area label
canvas.on('object:moving', _safeHandler(opt => {
  const obj = opt.target;
  if (!obj || !obj._areaHandle || !state.editingArea) return;
  updateAreaFromHandles();
}));

// Snapshot after any object is moved/scaled/rotated
canvas.on('object:modified', _safeHandler(() => {
  saveSnapshot();
}));

canvas.on('mouse:dblclick', _safeHandler(opt => {
  // Doppelklick auf Label → bearbeiten (in jedem Tool-Modus)
  if (opt.target && opt.target._userLabel) {
    editLabel(opt.target);
    return;
  }

  // Werkzeug-spezifische Aktionen
  if (state.tool === 'area' && state.areaPoints.length >= 3) { finishArea(); return; }
  if (state.tool === 'room') { handleRoomDblClick(); return; }
  if (state.tool === 'zone' || state.tool === 'deduction') { handleZoneDblClick(state.tool === 'zone' ? 'zone' : 'deduction'); return; }
  // End area edit when double-clicking on empty area
  if (state.tool === 'select' && state.editingArea && (!opt.target || (!opt.target._areaHandle && opt.target._measureId !== state.editingArea.id))) {
    endAreaEdit(); saveSnapshot();
  }
  if (state.tool === 'arc' && state.arcStep === 2) { finishArc(snapToPixel(canvas.getPointer(opt.e))); return; }

  if (state.tool === 'select') {
    const target = opt.target;
    // Double-click on area polygon → enter area edit mode
    if (target && target.type === 'polygon' && target._measureId != null) {
      startAreaEdit(target);
      return;
    }
    // Apple-Zoom: Doppelklick → 1:1 / Fit-Toggle
    const z = canvas.getZoom();
    const cx = opt.e.offsetX, cy = opt.e.offsetY;
    if (Math.abs(z - 1) < 0.08 && Math.abs(canvas.viewportTransform[4]) < 4 && Math.abs(canvas.viewportTransform[5]) < 4) {
      setZoom(2, { x: cx, y: cy });      // fit → 2x
    } else {
      zoomToFit();                        // irgendwas → Fit
    }
  }
}));

// =========================================================
// PANNING & ZOOM  (Apple-style)
// =========================================================

document.addEventListener('mousemove', e => {
  if (!state.panning) return;
  const dx = e.clientX - state.lastPan.x;
  const dy = e.clientY - state.lastPan.y;
  state.lastPan = { x: e.clientX, y: e.clientY };
  const vpt = canvas.viewportTransform.slice();
  vpt[4] += dx; vpt[5] += dy;
  canvas.setViewportTransform(vpt);
});
document.addEventListener('mouseup', stopPan);

// Leertaste → Pan-Modus
state.spacePan = false;
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat && !e.target.matches('input,textarea,select')) {
    e.preventDefault();
    state.spacePan = true;
    canvas.defaultCursor = 'grab';
    wrapper.classList.add('space-pan');
    _loupe.hide();
  }
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    state.spacePan = false;
    wrapper.classList.remove('space-pan', 'panning');
    canvas.defaultCursor = state.tool === 'select' ? 'default' : 'crosshair';
  }
});

// Shift → temporärer 90°-Snap für Flächentool
document.addEventListener('keydown', e => {
  if (e.key === 'Shift' && !e.repeat) setShiftHeld(true);
});
document.addEventListener('keyup', e => {
  if (e.key === 'Shift') setShiftHeld(false);
});

// Wheel: Pinch/Cmd+Scroll → Zoom  |  Rest → Pan
wrapper.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    // Pinch-Geste (Trackpad) oder Cmd+Scroll → Zoom
    const factor = Math.exp(-e.deltaY * 0.009);
    setZoom(canvas.getZoom() * factor, { x: e.offsetX, y: e.offsetY });
  } else {
    // Zwei-Finger-Scroll → Pan (wie Apple Photos)
    const vpt = canvas.viewportTransform.slice();
    vpt[4] -= e.deltaX;
    vpt[5] -= e.deltaY;
    canvas.setViewportTransform(vpt);
  }
}, { passive: false });

// =========================================================
// KEYBOARD
// =========================================================
document.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.tool === 'select') {
    const active = canvas.getActiveObjects();
    if (active.length) {
      // Delete measurements
      const ids = new Set(active.map(o => o._measureId).filter(id => id != null));
      ids.forEach(id => removeMeasurement(id));
      active.filter(o => o._measureId == null).forEach(o => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }
  if (e.key === 'Escape') {
    if (state.editingArea) { endAreaEdit(); saveSnapshot(); return; }
    cancelDrawing();
  }
  // Undo / Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (!e.target.matches('input,textarea,select')) { e.preventDefault(); undo(); }
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    if (!e.target.matches('input,textarea,select')) { e.preventDefault(); redo(); }
  }
});

// =========================================================
// CANCEL DRAWING
// =========================================================
function cancelDrawing() {
  removeLiveLabel();
  endAreaEdit();
  if (state.refLine) { canvas.remove(state.refLine); state.refLine = null; }
  state.refPoints = [];
  if (state.drawingLine) { canvas.remove(state.drawingLine); state.drawingLine = null; }
  if (state.drawingPolygon) { canvas.remove(state.drawingPolygon); state.drawingPolygon = null; }
  canvas.getObjects().filter(o => o._circlePreview || o._arcPreview || o._tempDraw).forEach(o => canvas.remove(o));
  cancelRoomDraft();
  cancelZoneDraft();
  state.distPoints = [];
  state.areaPoints = [];
  state.circleCenter = null;
  state.arcStep = 0;
  state.arcCenter = null;
  state.arcStartPt = null;
  canvas.renderAll();
  document.getElementById('status-hint').textContent = state.tool in TOOL_HINTS ? TOOL_HINTS[state.tool] : '';
}

// =========================================================
// WIRE UP TOOL MANAGER
// =========================================================
// Inject cancelDrawing and loupe callbacks into tool-manager
initToolManager({
  cancelDrawing,
  loupeHide: () => _loupe.hide(),
  mobileMagHide: () => { if (typeof _mobileMag !== 'undefined') _mobileMag.hide(); },
});

// =========================================================
// REGISTER HOOKS FOR TOOL MODULES
// =========================================================
registerToolHook('removeLiveLabel', removeLiveLabel);
registerToolHook('updateMeasurementList', updateMeasurementList);
registerToolHook('updateRefStatus', updateRefStatus);

initToolbar();

document.getElementById('btn-undo').onclick = () => undo();
document.getElementById('btn-redo').onclick = () => redo();

// 90° snap toggle for area tool
document.getElementById('btn-snap90').onclick = () => {
  const btn = document.getElementById('btn-snap90');
  setAreaSnap90(!getAreaSnap90());
  btn.classList.toggle('active', getAreaSnap90());
};

document.getElementById('btn-clear-all').onclick = () => {
  createModal(
    'Alles löschen?',
    '<p style="margin:0 0 12px;color:#555;font-size:13px;">Alle Markierungen und das Hintergrundbild werden unwiderruflich gelöscht.</p>',
    () => {
      history.past = []; history.future = []; updateUndoRedoButtons();
      canvas.clear();
      canvas.backgroundColor = '#e5e5ea';
      state.measurements = [];
      state.scale = null;
      state.scaleSource = null;
      state.exifAltitude = null;
      state.refLines = [];
      state.refSumL2 = 0;
      state.backgroundImage = null;
      state.gridVisible = false;
      const gcClear = document.getElementById('grid-canvas');
      if (gcClear) gcClear.getContext('2d').clearRect(0, 0, gcClear.width, gcClear.height);
      const btnGridTog = document.getElementById('btn-grid-toggle');
      if (btnGridTog) { btnGridTog.textContent = 'Ausgeblendet'; btnGridTog.classList.add('hidden-layer'); }
      const gridInfoClear = document.getElementById('grid-info');
      if (gridInfoClear) gridInfoClear.textContent = 'Kein Maßstab gesetzt';
      cancelDrawing();
      document.getElementById('drop-overlay').classList.remove('hidden');
      updateMeasurementList();
      updateRefStatus();
      canvas.renderAll();
    }
  );
};

// =========================================================
// RESIZE
// =========================================================
window.addEventListener('resize', () => {
  canvas.setWidth(wrapper.clientWidth);
  canvas.setHeight(wrapper.clientHeight);
  const gc = document.getElementById('grid-canvas');
  if (gc) { gc.width = wrapper.clientWidth; gc.height = wrapper.clientHeight; }
  canvas.renderAll();
});

// Register restore hooks for undo/redo
registerRestoreHook(() => updateRefStatus());
registerRestoreHook(() => updateMeasurementList());

// =========================================================
// INIT
// =========================================================

// Size grid canvas to match wrapper
(function initGridCanvas() {
  const gc = document.getElementById('grid-canvas');
  if (gc) { gc.width = wrapper.clientWidth; gc.height = wrapper.clientHeight; }
})();

initSidebarResize();

// Redraw grid after every Fabric.js render (covers zoom + pan)
let _gridRafPending = false;
canvas.on('after:render', () => {
  if (_gridRafPending) return;
  _gridRafPending = true;
  requestAnimationFrame(() => { _gridRafPending = false; drawGrid(); });
});

updateRefStatus();
updateMeasurementList();
updateRoomList();

document.getElementById('fs-measure').addEventListener('input', e => resizeLabelCluster('measure', e.target.value));
document.getElementById('fs-label').addEventListener('input',   e => resizeLabelCluster('label',   e.target.value));
document.getElementById('fs-ref').addEventListener('input',     e => resizeLabelCluster('ref',     e.target.value));

// Help-Button
document.getElementById('btn-help').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('help-popover').classList.toggle('open');
});
document.addEventListener('click', e => {
  if (!e.target.closest('#help-popover') && e.target.id !== 'btn-help') {
    document.getElementById('help-popover').classList.remove('open');
  }
});

// =========================================================
// MOBILE
// =========================================================
const { openDrawer } = initMobileDrawer();

// ── Mobile Onboarding dismiss ──
document.getElementById('mobile-ob-dismiss').onclick = () => {
  localStorage.setItem('gp_mobile_ob_seen', '1');
  document.getElementById('mobile-onboarding').classList.remove('visible');
};

// Mobile: Canvas-Größe an die nun größere Fläche anpassen (Header/Toolbar ausgeblendet)
if (_isTouchDevice) {
  requestAnimationFrame(() => {
    canvas.setWidth(wrapper.clientWidth);
    canvas.setHeight(wrapper.clientHeight);
    canvas.renderAll();
  });
}

// =========================================================
initBottomToolbar({ openDrawer });

// Wire up touch handlers (capture-phase point adjustment + pinch/pan)
initTouchHandlers({ _touchSuppressClickRef, _mobileAdjust });
initTouchPinchPan({ _touchSuppressClickRef, _mobileAdjust });

initOrientationChange();
