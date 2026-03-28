import { PIPE_TYPES, state, measureId, nextMeasureId, setMeasureId, CANVAS_SERIAL_PROPS, _isTouchDevice, TOUCH_SCALE } from './state.js';
import { canvas, wrapper, _safeHandler, showZoomHUD, setZoom, zoomToFit, startPan, stopPan } from './canvas.js';
import { history, registerRestoreHook, getSnapshot, saveSnapshot, restoreSnapshot, undo, redo, updateUndoRedoButtons } from './undo.js';
import { showToast, haptic, showMeasurementToast, createModal } from './ui/modals.js';
import { snapToPixel, projectPointOnLine, closestPointOnSegment, addLabel, addEndpointDot, addRefEndmarks, addTickMarks, ptDist, pointToSegmentDist, polygonArea, formatDistance, formatArea, formatErr } from './utils/helpers.js';
import * as _loupe from './utils/loupe.js';
import { throttledRender } from './utils/loupe.js';
import { drawGrid, toggleGrid, setGridStep, setGridColor, setGridOpacity } from './ui/grid.js';
import { MATERIALS, openMaterialCalc } from './ui/materialrechner.js';
import { _prevCounts, _notifyBadge } from './ui/statusbar.js';
import { showWelcomeOnboarding } from './onboarding/welcome.js';
import { initRefOnboarding, showRefOnboarding } from './onboarding/ref-onboarding.js';
import { initWhatsNew } from './ui/whats-new.js';
import { TOOL_NAMES, TOOL_HINTS, MEASURE_TOOLS, setTool, requireScale, updateMeasureButtons, initToolManager, initToolbar, registerToolHook } from './tools/tool-manager.js';
import { handleDistanceClick, finishDistance } from './tools/distance.js';
import { handleAreaClick, updatePreviewPolygon, finishArea } from './tools/area.js';
import { handleCircleClick, updatePreviewCircle, finishCircle } from './tools/circle.js';
import { handleArcClick, updatePreviewArc, arcSweepDir, buildSectorPath, finishArc } from './tools/arc.js';
import { handleLabelClick, editLabel, updateLiveLabel, removeLiveLabel } from './tools/label.js';
import { SENSOR_DB, lookupSensor, calcGSD, calcAccuracy, calcRequiredForTarget, calcFlightRecommendation, flightRecommendationTableHTML, distErr_m, areaRelErr_pct, showAccuracyDetail, hideAccuracyDetail } from './io/photogrammetry.js';
import { handleRefClick, promptReference, updateRefStatus } from './tools/ref.js';
import { PIPE_LINE_WIDTH, handlePipeClick, updatePreviewPipe, finishPipe, startPipeEdit, endPipeEdit, updatePipeFromHandles, insertPipeVertex, deletePipeVertex, togglePipeLayer, sendPipesToBack, offsetOverlappingPipes, updatePipePanel } from './tools/pipe.js';
import { PIPE_REF_LINE_COLOR, PIPE_REF_GUIDE_COLOR, handlePipeRefClick, promptPipeRefName, createPipeRefLine, createPipeRefPoint, removePipeRef, togglePipeRef, updatePipeRefList, setPipeRefId, resetPipeRefId } from './tools/pipe-refs.js';
import { clearPipeDistanceGuides, showPipeDistanceGuides, computeDimLine, renderDimLinesForPipe, renderAllDimLines, clearDimLinesForPipe } from './ui/pipe-guides.js';
import { startAssignMode, endAssignMode, confirmAssignMode, cancelAssignMode, toggleRefAssignment, directToggleRef } from './ui/pipe-assign.js';
import { updatePipeLegend } from './ui/pipe-legend.js';
import { updateMeasurementList, removeMeasurement, toggleAcc, openAccSection, initSidebarResize, resizeLabelCluster } from './ui/sidebar.js';
import { LIBRARY, LIB_CATS, EIGENE_CAT, renderLibrary, placeLibraryItem, placeCustomLibItem, toggleLibLayer, initCustomLib, linkCustomLibFolder, refreshFromDir, uploadCustomLibFiles, deleteCustomLibItem, sanitizeSVG } from './io/library.js';
import { loadFileAuto, loadImageFromDataUrl, readAndApplyExif } from './io/image-loader.js';
import { openSaveModal, openLoadModal, doSavePNG, doSavePDF, doSaveProjectJSON } from './io/save-load.js';
import { exportLeitungen, handleLeitungenAlignClick } from './io/pipe-transfer.js';
import { initMobileDrawer, initBottomToolbar, initOrientationChange } from './mobile/drawer.js';
import { initTouchHandlers, initTouchPinchPan, _mobileMag } from './mobile/touch.js';


// =========================================================
// LIBRARY — extracted to ./io/library.js
// =========================================================


// =========================================================
// TOOL MANAGEMENT — extracted to ./tools/tool-manager.js
// TOOL_NAMES, TOOL_HINTS, MEASURE_TOOLS, setTool, requireScale,
// updateMeasureButtons, initToolManager, initToolbar imported above.
// =========================================================

// Init pipe ref list
updatePipeRefList();

// readAndApplyExif extracted to ./io/image-loader.js


// =========================================================
// IMAGE UPLOAD — extracted to ./io/image-loader.js
// normalizeOrientation, loadImageFromDataUrl, loadImage, loadPdf,
// loadFileAuto, drag-and-drop handlers imported above.
// =========================================================

// _loupe and throttledRender are imported from ./utils/loupe.js

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
  // Pipe preview
  if (state.tool === 'pipe') {
    if (state.pipePoints.length > 0) {
      updatePreviewPipe([...state.pipePoints, p]);
    }
  }
  // Distance guides for all measurement tools + pipe + Maßstab (when not in ref mode)
  if (['ref','distance','area','circle','arc','pipe'].includes(state.tool) && !state.pipeRefMode) {
    showPipeDistanceGuides(p);
  }
  } // end !_skipPreview
  // Ref line preview for all measurement tools + pipe + Maßstab
  if (['ref','distance','area','circle','arc','pipe'].includes(state.tool) && state.pipeRefMode === 'line-2' && state.pipeRefTempPt) {
    canvas.getObjects().filter(o => o._pipeRefTemp && o.type === 'line').forEach(o => canvas.remove(o));
    const tempLine = new fabric.Line([state.pipeRefTempPt.x, state.pipeRefTempPt.y, p.x, p.y], {
      stroke: PIPE_REF_LINE_COLOR, strokeWidth: 1, strokeDashArray: [6, 3], opacity: 0.6,
      selectable: false, evented: false, _pipeRefTemp: true, _noSelect: true,
    });
    canvas.add(tempLine);
    throttledRender();
  }

  // Loupe: show when a drawing/measurement tool or anchor mode is active, hide during pan
  const _loupeActive =
    (state.tool !== 'select' || _anchorExport.active || _anchorImport.active) &&
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

  // 2-Punkt-Ausrichtung beim Einmessen von Leitungen
  if (handleLeitungenAlignClick(p)) return;

  // End pipe edit when clicking on something that isn't a pipe handle or the edited pipe
  if (state.tool === 'select' && state.editingPipe && opt.target) {
    if (!opt.target._pipeHandle && opt.target !== state.editingPipe.polyline && !opt.target._isPipeLegend) {
      endPipeEdit();
    }
  }
  // End pipe edit when clicking on empty canvas
  if (state.tool === 'select' && state.editingPipe && !opt.target) {
    endPipeEdit();
  }

  // Ignore clicks on legend — it's always draggable
  if (opt.target && opt.target._isPipeLegend) return;

  // Label tool: clicking an existing label → select/drag, not create new
  if (state.tool === 'label' && opt.target && opt.target._userLabel) return;

  // Reference creation works from all tools (auch Auswahl)
  if (['select','ref','distance','area','circle','arc','pipe'].includes(state.tool) && handlePipeRefClick(p)) return;

  switch (state.tool) {
    case 'ref':      handleRefClick(p); break;
    case 'distance': handleDistanceClick(p); break;
    case 'area':     handleAreaClick(p); break;
    case 'circle':   handleCircleClick(p); break;
    case 'arc':      handleArcClick(p); break;
    case 'label':    handleLabelClick(p); break;
    case 'pipe':     handlePipeClick(p); break;
  }
}));

canvas.on('mouse:up', _safeHandler(opt => {
  // Assign-Modus: Klick auf Ref-Objekt
  if (state.assignModePipeId != null && opt.target?._pipeRefId != null) {
    toggleRefAssignment(opt.target._pipeRefId);
    return;
  }
  stopPan();
  // After handle drag, clear guides
  if (state.editingPipe) clearPipeDistanceGuides();
}));

// Pipe handle dragging — live update polyline + distance guides
canvas.on('object:moving', _safeHandler(opt => {
  const obj = opt.target;
  if (!obj || !obj._pipeHandle || !state.editingPipe) return;
  // Show distance guides from this handle position
  showPipeDistanceGuides({ x: obj.left, y: obj.top });
  // Live-update the polyline shape
  updatePipeFromHandles();
}));

// Sync sibling objects (labels, endpoint circles) when a pipe reference is dragged
canvas.on('object:moving', _safeHandler(opt => {
  const obj = opt.target;
  if (!obj || obj._pipeRefId == null) return;

  const refId = obj._pipeRefId;
  const ref = state.pipeReferences.find(r => r.id === refId);
  if (!ref) return;

  // --- Line reference: reposition label + endpoint circles ---
  if (ref.type === 'line' && obj.type === 'line') {
    // calcLinePoints() gibt lokale Koordinaten (zentriert um 0,0)
    const lp = obj.calcLinePoints();
    const matrix = obj.calcTransformMatrix();
    const absP1 = fabric.util.transformPoint(new fabric.Point(lp.x1, lp.y1), matrix);
    const absP2 = fabric.util.transformPoint(new fabric.Point(lp.x2, lp.y2), matrix);

    // Reposition endpoint circles
    const circles = canvas.getObjects().filter(o => o._pipeRefId === refId && o._noSelect === true);
    if (circles.length >= 2) {
      circles[0].set({ left: absP1.x, top: absP1.y });
      circles[0].setCoords();
      circles[1].set({ left: absP2.x, top: absP2.y });
      circles[1].setCoords();
    }

    // Reposition label at midpoint with perpendicular offset
    const label = canvas.getObjects().find(o => o._pipeRefId === refId && o._pipeRefType === 'line-label');
    if (label) {
      const mx = (absP1.x + absP2.x) / 2, my = (absP1.y + absP2.y) / 2;
      const angle = Math.atan2(absP2.y - absP1.y, absP2.x - absP1.x);
      const offX = -Math.sin(angle) * 10, offY = Math.cos(angle) * 10;
      label.set({ left: mx + offX, top: my + offY });
      label.setCoords();
    }
  }

  // --- Point reference: reposition label ---
  if (ref.type === 'point' && obj._pipeRefType === 'point') {
    const center = obj.getCenterPoint();
    const dx = center.x - ref.x;
    const dy = center.y - ref.y;
    const label = canvas.getObjects().find(o => o._pipeRefId === refId && o._pipeRefType === 'point-label');
    if (label) {
      label.set({ left: ref.x + 6 + dx, top: ref.y - 6 + dy });
      label.setCoords();
    }
  }
}));

// Snapshot after any object is moved/scaled/rotated
canvas.on('object:modified', _safeHandler(opt => {
  const obj = opt.target;
  // Wenn eine Referenz verschoben wurde → Maßlinien aller Rohre neu berechnen die sie nutzen
  if (obj?._pipeRefId != null) {
    const refId = obj._pipeRefId;
    // Ref-Koordinaten aus Fabric-Objekt aktualisieren
    const ref = state.pipeReferences.find(r => r.id === refId);
    if (ref) {
      if (ref.type === 'line' && obj.type === 'line') {
        // calcLinePoints() gibt die lokalen Render-Koordinaten (zentriert um 0,0)
        // obj.x1/y1 sind die Original-Konstruktor-Werte — NICHT für transformPoint nutzbar
        const lp = obj.calcLinePoints();
        const matrix = obj.calcTransformMatrix();
        const absP1 = fabric.util.transformPoint(new fabric.Point(lp.x1, lp.y1), matrix);
        const absP2 = fabric.util.transformPoint(new fabric.Point(lp.x2, lp.y2), matrix);
        ref.x1 = absP1.x; ref.y1 = absP1.y; ref.x2 = absP2.x; ref.y2 = absP2.y;
      } else if (ref.type === 'point') {
        // getCenterPoint() gibt die Mitte des Objekts (nicht die BBox-Ecke wie left/top)
        const center = obj.getCenterPoint();
        ref.x = center.x; ref.y = center.y;
      }
    }
    // Alle Rohre die diese Ref nutzen neu rendern
    state.measurements
      .filter(m => m.type === 'pipe' && m.refs?.includes(refId))
      .forEach(m => renderDimLinesForPipe(m.id));
  }
  // Wenn ein Rohr verschoben wurde → seine Maßlinien neu berechnen
  if (obj?._measureId != null) {
    const meas = state.measurements.find(m => m.id === obj._measureId && m.type === 'pipe');
    if (meas) renderDimLinesForPipe(meas.id);
  }
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
  if (state.tool === 'pipe' && state.pipePoints.length >= 2) { finishPipe(); return; }
  if (state.tool === 'arc' && state.arcStep === 2) { finishArc(snapToPixel(canvas.getPointer(opt.e))); return; }

  // Pipe editing: double-click on pipe polyline → enter edit mode
  if (state.tool === 'select') {
    const target = opt.target;
    // Ignore double-click on legend (just drag it)
    if (target && target._isPipeLegend) return;
    if (target && target._pipeType && target.type === 'polyline') {
      startPipeEdit(target);
      return;
    }
    // Double-click on pipe segment during edit → insert vertex
    if (state.editingPipe) {
      const p = canvas.getPointer(opt.e);
      const ep = state.editingPipe;
      const pl = ep.polyline;
      const pts = ep.handles.map(h => ({ x: h.left, y: h.top }));
      // Find closest segment
      let bestDist = Infinity, bestSeg = -1;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = pointToSegmentDist(p, pts[i], pts[i + 1]);
        if (d < bestDist) { bestDist = d; bestSeg = i; }
      }
      if (bestSeg >= 0 && bestDist < 15) {
        insertPipeVertex(bestSeg, p);
        return;
      }
      // Click on empty area → end edit
      if (!opt.target || (!opt.target._pipeHandle && opt.target !== pl)) {
        endPipeEdit();
      }
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
  if (e.key === 'Enter' && state.assignModePipeId != null) { confirmAssignMode(); return; }
  if (e.key === 'Escape' && state.assignModePipeId != null) { cancelAssignMode(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.tool === 'select') {
    // If editing a pipe and a handle is selected, delete that vertex
    if (state.editingPipe) {
      const active = canvas.getActiveObjects();
      const handle = active.find(o => o._pipeHandle);
      if (handle) {
        e.preventDefault();
        deletePipeVertex(handle._pipeHandleIdx);
        canvas.discardActiveObject();
        return;
      }
    }
    const active = canvas.getActiveObjects();
    if (active.length) {
      // Delete pipe references
      const refIds = new Set(active.map(o => o._pipeRefId).filter(id => id != null));
      refIds.forEach(id => removePipeRef(id));
      // Delete measurements
      const ids = new Set(active.map(o => o._measureId).filter(id => id != null));
      ids.forEach(id => removeMeasurement(id));
      active.filter(o => o._measureId == null && o._pipeRefId == null).forEach(o => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }
  if (e.key === 'Escape') {
    if (state.editingPipe) { endPipeEdit(); return; }
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
// DISTANCE TOOL — extracted to ./tools/distance.js
// handleDistanceClick, finishDistance imported above.
// =========================================================

// =========================================================
// AREA TOOL — extracted to ./tools/area.js
// handleAreaClick, updatePreviewPolygon, finishArea imported above.
// =========================================================

// =========================================================
// PIPE TOOL — extracted to ./tools/pipe.js
// PIPE_LINE_WIDTH, handlePipeClick, updatePreviewPipe, finishPipe imported above.
// =========================================================

// =========================================================
// PIPE EDITING — extracted to ./tools/pipe.js
// startPipeEdit, endPipeEdit, updatePipeFromHandles, insertPipeVertex, deletePipeVertex imported above.
// =========================================================

// =========================================================
// PIPE REFERENCES — extracted to ./tools/pipe-refs.js
// PIPE_REF_LINE_COLOR, PIPE_REF_GUIDE_COLOR, handlePipeRefClick, promptPipeRefName,
// createPipeRefLine, createPipeRefPoint, removePipeRef, togglePipeRef, updatePipeRefList imported above.
// =========================================================

// --- Reference creation sub-modes (button handlers stay here — need TOOL_HINTS/state.tool) ---
document.getElementById('btn-pipe-ref-line').onclick = () => {
  if (state.pipeRefMode === 'line-1') {
    // Cancel
    state.pipeRefMode = null; state.pipeRefTempPt = null;
    canvas.getObjects().filter(o => o._pipeRefTemp).forEach(o => canvas.remove(o));
    document.getElementById('btn-pipe-ref-line').classList.remove('active');
    document.getElementById('tt-helpers')?.classList.remove('sub-active');
    document.getElementById('status-hint').textContent = TOOL_HINTS[state.tool] || '';
    canvas.renderAll();
    return;
  }
  state.pipeRefMode = 'line-1';
  state.pipeRefTempPt = null;
  document.getElementById('btn-pipe-ref-line').classList.add('active');
  document.getElementById('tt-helpers')?.classList.add('sub-active');
  document.getElementById('tt-helpers')?.classList.remove('sub-active');
  document.getElementById('btn-pipe-ref-point').classList.remove('active');
  document.getElementById('status-hint').textContent = 'Startpunkt der Hilfslinie klicken …';
};

document.getElementById('btn-pipe-ref-point').onclick = () => {
  if (state.pipeRefMode === 'point') {
    state.pipeRefMode = null;
    document.getElementById('btn-pipe-ref-point').classList.remove('active');
    document.getElementById('tt-helpers')?.classList.remove('sub-active');
    document.getElementById('status-hint').textContent = TOOL_HINTS[state.tool] || '';
    return;
  }
  state.pipeRefMode = 'point';
  state.pipeRefTempPt = null;
  document.getElementById('btn-pipe-ref-point').classList.add('active');
  document.getElementById('tt-helpers')?.classList.add('sub-active');
  document.getElementById('tt-helpers')?.classList.remove('sub-active');
  document.getElementById('btn-pipe-ref-line').classList.remove('active');
  document.getElementById('status-hint').textContent = 'Position des Hilfspunktes klicken …';
};

// clearPipeDistanceGuides, showPipeDistanceGuides, computeDimLine, renderDimLinesForPipe,
// renderAllDimLines, clearDimLinesForPipe extracted to ./ui/pipe-guides.js

// startAssignMode, endAssignMode, confirmAssignMode, cancelAssignMode,
// toggleRefAssignment, directToggleRef extracted to ./ui/pipe-assign.js

// updatePipeLegend extracted to ./ui/pipe-legend.js

// drawGrid, toggleGrid, setGridStep, setGridColor, setGridOpacity are imported from ./ui/grid.js

// =========================================================
// PIPE LAYER TOGGLE & SIDEBAR PANEL — extracted to ./tools/pipe.js
// togglePipeLayer, sendPipesToBack, offsetOverlappingPipes, updatePipePanel imported above.
// =========================================================

// =========================================================
// CIRCLE TOOL — extracted to ./tools/circle.js
// handleCircleClick, updatePreviewCircle, finishCircle imported above.
// =========================================================

// =========================================================
// ARC / SECTOR TOOL — extracted to ./tools/arc.js
// handleArcClick, updatePreviewArc, arcSweepDir, buildSectorPath, finishArc imported above.
// =========================================================

// =========================================================
// LABEL TOOL — extracted to ./tools/label.js
// handleLabelClick (was promptLabel), editLabel imported above.
// =========================================================

// =========================================================
// LIVE LABEL — extracted to ./tools/label.js
// updateLiveLabel, removeLiveLabel imported above.
// =========================================================


// distErr_m and areaRelErr_pct extracted to ./io/photogrammetry.js

// =========================================================
// CANCEL DRAWING
// =========================================================
function cancelDrawing() {
  removeLiveLabel();
  endPipeEdit();
  clearPipeDistanceGuides();
  if (state.refLine) { canvas.remove(state.refLine); state.refLine = null; }
  state.refPoints = [];
  if (state.drawingLine) { canvas.remove(state.drawingLine); state.drawingLine = null; }
  if (state.drawingPolygon) { canvas.remove(state.drawingPolygon); state.drawingPolygon = null; }
  if (state.drawingPipeLine) { canvas.remove(state.drawingPipeLine); state.drawingPipeLine = null; }
  canvas.getObjects().filter(o => o._circlePreview || o._arcPreview || o._tempDraw || o._pipePreview || o._pipeGuide || o._pipeRefTemp).forEach(o => canvas.remove(o));
  state.distPoints = [];
  state.areaPoints = [];
  state.pipePoints = [];
  state.pipeRefMode = null;
  state.pipeRefTempPt = null;
  state.circleCenter = null;
  state.arcStep = 0;
  state.arcCenter = null;
  state.arcStartPt = null;
  document.getElementById('btn-pipe-ref-line')?.classList.remove('active');
  document.getElementById('btn-pipe-ref-point')?.classList.remove('active');
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

// MATERIALS and openMaterialCalc are imported from ./ui/materialrechner.js

// =========================================================
// REGISTER HOOKS FOR TOOL MODULES
// =========================================================
// These allow tool modules (distance, area, circle, arc) to call back into main.js
// for functions that are still defined here.
registerToolHook('removeLiveLabel', removeLiveLabel);
registerToolHook('updateMeasurementList', updateMeasurementList);
registerToolHook('distErr_m', distErr_m);
registerToolHook('areaRelErr_pct', areaRelErr_pct);
registerToolHook('updateRefStatus', updateRefStatus);
// Hooks needed by pipe.js and pipe-assign.js
registerToolHook('showPipeDistanceGuides', showPipeDistanceGuides);
registerToolHook('clearPipeDistanceGuides', clearPipeDistanceGuides);
registerToolHook('updatePipeLegend', updatePipeLegend);
registerToolHook('renderDimLinesForPipe', renderDimLinesForPipe);

// window.removeMeasurement is set in ./ui/sidebar.js
// window.toggleAcc is set in ./ui/sidebar.js
// window.directToggleRef is set in ./ui/pipe-assign.js

// Init toolbar buttons, pickers, and line-width controls (extracted to tool-manager.js)
initToolbar();

// SAVE / LOAD — extracted to ./io/save-load.js
// openSaveModal, openLoadModal, doSavePNG, doSavePDF, doSaveProjectJSON imported above.
// =========================================================

// =========================================================
// LEITUNGEN EXPORTIEREN / EINMESSEN — extracted to ./io/pipe-transfer.js
// exportLeitungen, handleLeitungenAlignClick imported above.
// =========================================================


document.getElementById('btn-undo').onclick = () => undo();
document.getElementById('btn-redo').onclick = () => redo();

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
      state.flightCam = null;
      state.refLines = [];
      state.refSumL2 = 0;
      state.backgroundImage = null;
      state.pipeReferences = [];
      state.activePipeRefs = [];
      state.pipeLayerVisible = true;
      state.gridVisible = false;
      const gcClear = document.getElementById('grid-canvas');
      if (gcClear) gcClear.getContext('2d').clearRect(0, 0, gcClear.width, gcClear.height);
      const btnGridTog = document.getElementById('btn-grid-toggle');
      if (btnGridTog) { btnGridTog.textContent = 'Ausgeblendet'; btnGridTog.classList.add('hidden-layer'); }
      const gridInfoClear = document.getElementById('grid-info');
      if (gridInfoClear) gridInfoClear.textContent = 'Kein Maßstab gesetzt';
      resetPipeRefId();
      cancelDrawing();
      document.getElementById('drop-overlay').classList.remove('hidden');
      updateMeasurementList();
      updatePipeRefList();
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
registerRestoreHook(() => updatePipeLegend());
registerRestoreHook(() => updatePipeRefList());
registerRestoreHook(() => updatePipePanel());
registerRestoreHook(() => renderAllDimLines());

// =========================================================
// INIT
// =========================================================

// Size grid canvas to match wrapper
(function initGridCanvas() {
  const gc = document.getElementById('grid-canvas');
  if (gc) { gc.width = wrapper.clientWidth; gc.height = wrapper.clientHeight; }
})();

// =========================================================
// SIDEBAR RESIZE
// =========================================================
initSidebarResize();

// Redraw grid after every Fabric.js render (covers zoom + pan)
let _gridRafPending = false;
canvas.on('after:render', () => {
  if (_gridRafPending) return;
  _gridRafPending = true;
  requestAnimationFrame(() => { _gridRafPending = false; drawGrid(); });
});

// toggleAcc, openAccSection, resizeLabelCluster imported from ./ui/sidebar.js

updateRefStatus();
updateMeasurementList();

document.getElementById('fs-measure').addEventListener('input', e => resizeLabelCluster('measure', e.target.value));
document.getElementById('fs-label').addEventListener('input',   e => resizeLabelCluster('label',   e.target.value));
document.getElementById('fs-ref').addEventListener('input',     e => resizeLabelCluster('ref',     e.target.value));
document.getElementById('fs-guide').addEventListener('input',   e => resizeLabelCluster('guide',   e.target.value));

// Wire up ref-onboarding dependency on setTool
initRefOnboarding({ setTool });

// Welcome-Onboarding beim ersten Besuch
if (!localStorage.getItem('gp_ob_seen')) {
  showWelcomeOnboarding();
}

// Acc-Panel Close
document.getElementById('acc-panel-close').onclick = hideAccuracyDetail;

// Klick außerhalb schließt das Panel
document.addEventListener('click', e => {
  const panel = document.getElementById('acc-panel');
  if (panel.classList.contains('open') &&
      !panel.contains(e.target) &&
      !e.target.classList.contains('ref-detail-btn')) {
    hideAccuracyDetail();
  }
});

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
// RELEASE NOTES & BUG REPORT — init (extracted to ui/whats-new.js)
// =========================================================
initWhatsNew();

// =========================================================
// MOBILE: DRAWER TOGGLE — extracted to ./mobile/drawer.js
// =========================================================
const { openDrawer } = initMobileDrawer();

// =========================================================
// MOBILE: TOUCH EVENTS FÜR CANVAS — extracted to ./mobile/touch.js
// =========================================================

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
// MOBILE: BOTTOM TOUCH TOOLBAR — extracted to ./mobile/drawer.js
// =========================================================
initBottomToolbar({ openDrawer });

// Wire up touch handlers (capture-phase point adjustment + pinch/pan)
initTouchHandlers({ _touchSuppressClickRef, _mobileAdjust });
initTouchPinchPan({ _touchSuppressClickRef, _mobileAdjust });

// =========================================================
// MOBILE: CANVAS-GRÖßE BEI ORIENTATION-CHANGE — extracted to ./mobile/drawer.js
// =========================================================
initOrientationChange();
