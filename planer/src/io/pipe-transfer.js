import { state, PIPE_TYPES, nextMeasureId } from '../state.js';
import { canvas } from '../canvas.js';
import { showToast, createModal } from '../ui/modals.js';
import { saveSnapshot } from '../undo.js';
import { endPipeEdit, sendPipesToBack, offsetOverlappingPipes, PIPE_LINE_WIDTH } from '../tools/pipe.js';
import { addEndpointDot, addLabel, addTickMarks, ptDist, formatDistance, formatArea, polygonArea } from '../utils/helpers.js';
import { clearPipeDistanceGuides, renderAllDimLines } from '../ui/pipe-guides.js';
import { updateMeasurementList } from '../ui/sidebar.js';
import { updatePipeLegend } from '../ui/pipe-legend.js';
import { addAreaEdgeLabels } from '../tools/area.js';
import { buildSectorPath, arcSweepDir } from '../tools/arc.js';

// =========================================================
// LEITUNGEN EXPORTIEREN / EINMESSEN
// =========================================================


// ── Hilfsfunktionen ──────────────────────────────────────

function _leitungenToMeters(cx, cy) {
  const img = state.backgroundImage;
  return {
    x: (cx - img.left) / (state.imgDisplayScale * state.scale),
    y: (cy - img.top)  / (state.imgDisplayScale * state.scale),
  };
}

function _leitungenToCanvas(mx, my) {
  const img = state.backgroundImage;
  return {
    x: mx * state.imgDisplayScale * state.scale + img.left,
    y: my * state.imgDisplayScale * state.scale + img.top,
  };
}

function _collectPipeData() {
  const pipes = canvas.getObjects()
    .filter(o => o._pipeType && o.type === 'polyline' && !o._pipePreview)
    .map(polyline => {
      const matrix = polyline.calcTransformMatrix();
      const pts = polyline.points.map(pt => {
        const abs = fabric.util.transformPoint(
          new fabric.Point(pt.x - polyline.pathOffset.x, pt.y - polyline.pathOffset.y),
          matrix
        );
        return _leitungenToMeters(abs.x, abs.y);
      });
      const meas = state.measurements.find(m => m.id === polyline._measureId);
      return {
        id:        polyline._measureId,
        pipeType:  polyline._pipeType,
        pipeDepth: polyline._pipeDepth || null,
        label:     meas ? meas.label : (PIPE_TYPES[polyline._pipeType]?.label || ''),
        points_m:  pts,
      };
    });
  const pipeReferences = state.pipeReferences.map(r => {
    if (r.type === 'line') {
      const p1 = _leitungenToMeters(r.x1, r.y1);
      const p2 = _leitungenToMeters(r.x2, r.y2);
      return { id: r.id, type: r.type, name: r.name, x1_m: p1.x, y1_m: p1.y, x2_m: p2.x, y2_m: p2.y };
    }
    const p = _leitungenToMeters(r.x, r.y);
    return { id: r.id, type: r.type, name: r.name, x_m: p.x, y_m: p.y };
  });
  return { pipes, pipeReferences };
}

function _collectAllMeasurements() {
  const objs = canvas.getObjects();
  const measurements = [];

  state.measurements.forEach(meas => {
    if (meas.type === 'pipe') return; // Pipes handled separately

    if (meas.type === 'distance') {
      const line = objs.find(o => o._measureId === meas.id && o.type === 'line' && !o._noSelect);
      if (!line) return;
      measurements.push({
        type: 'distance',
        p1_m: _leitungenToMeters(line.x1, line.y1),
        p2_m: _leitungenToMeters(line.x2, line.y2),
        color: line.stroke,
      });
    }

    if (meas.type === 'area') {
      const poly = objs.find(o => o._measureId === meas.id && o.type === 'polygon');
      if (!poly) return;
      const matrix = poly.calcTransformMatrix();
      const pts_m = poly.points.map(pt => {
        const abs = fabric.util.transformPoint(
          new fabric.Point(pt.x - poly.pathOffset.x, pt.y - poly.pathOffset.y), matrix
        );
        return _leitungenToMeters(abs.x, abs.y);
      });
      measurements.push({
        type: 'area',
        points_m: pts_m,
        color: poly.stroke,
      });
    }

    if (meas.type === 'circle') {
      const circ = objs.find(o => o._measureId === meas.id && o.type === 'circle');
      if (!circ) return;
      const cx = circ.left + circ.radius;
      const cy = circ.top + circ.radius;
      const radiusPx = circ.radius;
      const center_m = _leitungenToMeters(cx, cy);
      const edge_m = _leitungenToMeters(cx + radiusPx, cy);
      const radius_m = Math.hypot(edge_m.x - center_m.x, edge_m.y - center_m.y);
      measurements.push({
        type: 'circle',
        center_m,
        radius_m,
        color: circ.stroke,
      });
    }

    if (meas.type === 'arc') {
      // Arc has a Path (sector) + 2 Lines (radii from center)
      const lines = objs.filter(o => o._measureId === meas.id && o.type === 'line');
      if (lines.length < 2) return;
      // Both lines share the same start point (center)
      const center = { x: lines[0].x1, y: lines[0].y1 };
      const startPt = { x: lines[0].x2, y: lines[0].y2 };
      const endPt = { x: lines[1].x2, y: lines[1].y2 };
      const sweep = arcSweepDir(center, startPt, endPt);
      const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
      measurements.push({
        type: 'arc',
        center_m: _leitungenToMeters(center.x, center.y),
        startPt_m: _leitungenToMeters(startPt.x, startPt.y),
        endAngle,
        sweep,
        color: lines[0].stroke,
      });
    }
  });

  return measurements;
}

// ── Ankerpunkt-Marker auf Canvas ─────────────────────────

function _addAnchorMarker(x, y, label, idx) {
  const color = '#FF9500';
  const size  = 10;
  const objs  = [];
  // Kreuz
  [[[x - size, y], [x + size, y]], [[x, y - size], [x, y + size]]].forEach(([p1, p2]) => {
    const l = new fabric.Line([p1[0], p1[1], p2[0], p2[1]], {
      stroke: color, strokeWidth: 2,
      selectable: false, evented: false, _leitungenAnchorMarker: true,
    });
    canvas.add(l);
    objs.push(l);
  });
  // Kreis
  const c = new fabric.Circle({
    left: x, top: y, radius: 5,
    fill: color, opacity: 0.85,
    originX: 'center', originY: 'center',
    selectable: false, evented: false, _leitungenAnchorMarker: true,
  });
  canvas.add(c);
  objs.push(c);
  // Label
  const t = new fabric.Text(`AP${idx}: ${label}`, {
    left: x + 9, top: y - 16,
    fontSize: 11, fill: color,
    fontFamily: 'Inter, sans-serif', fontWeight: '600',
    selectable: false, evented: false, _leitungenAnchorMarker: true,
    shadow: new fabric.Shadow({ color: '#000', blur: 3, offsetX: 0, offsetY: 0 }),
  });
  canvas.add(t);
  objs.push(t);
  canvas.renderAll();
  return objs;
}

function _removeAnchorMarkers() {
  canvas.getObjects().filter(o => o._leitungenAnchorMarker).forEach(o => canvas.remove(o));
  canvas.renderAll();
}

// ── Overlay-Banner ───────────────────────────────────────

function _anchorBannerExport(msg) {
  document.getElementById('leitungen-anchor-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'leitungen-anchor-overlay';
  el.style.cssText = 'position:fixed;bottom:52px;left:50%;transform:translateX(-50%);' +
    'background:#1c1c1e;color:#fff;padding:11px 18px;border-radius:10px;font-size:12.5px;' +
    'z-index:9999;display:flex;align-items:center;gap:14px;box-shadow:0 4px 20px rgba(0,0,0,0.4);' +
    'max-width:90vw;';
  el.innerHTML = `<span style="display:flex;align-items:center;gap:8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <span id="leitungen-anchor-msg">${msg}</span>
    </span>
    <button onclick="_cancelAnchorExport()" style="background:#3a3a3c;color:#fff;border:none;
      border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;white-space:nowrap;">Abbrechen</button>`;
  document.body.appendChild(el);
}

function _anchorBannerImport(msg) {
  document.getElementById('leitungen-anchor-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'leitungen-anchor-overlay';
  el.style.cssText = 'position:fixed;bottom:52px;left:50%;transform:translateX(-50%);' +
    'background:#1c1c1e;color:#fff;padding:11px 18px;border-radius:10px;font-size:12.5px;' +
    'z-index:9999;display:flex;align-items:center;gap:14px;box-shadow:0 4px 20px rgba(0,0,0,0.4);' +
    'max-width:90vw;';
  el.innerHTML = `<span style="display:flex;align-items:center;gap:8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <span id="leitungen-anchor-msg">${msg}</span>
    </span>
    <button onclick="_cancelAnchorImport()" style="background:#3a3a3c;color:#fff;border:none;
      border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;white-space:nowrap;">Abbrechen</button>`;
  document.body.appendChild(el);
}

function _removeBanner() {
  document.getElementById('leitungen-anchor-overlay')?.remove();
  document.getElementById('status-hint').textContent = '';
}

// ── EXPORT: Ankerpunkte sammeln, dann speichern ───────────

export const _anchorExport = { active: false, step: 0, collected: [], markerObjs: [], pendingData: null, pendingMeasurements: null };

export function exportLeitungen() {
  if (!state.backgroundImage) { showToast('Bitte zuerst ein Luftbild laden.', 'error'); return; }
  if (!state.scale)           { showToast('Bitte zuerst den Maßstab setzen.', 'error'); return; }
  endPipeEdit();
  clearPipeDistanceGuides();

  const { pipes } = _collectPipeData();
  const measurements = _collectAllMeasurements();
  if (pipes.length === 0 && measurements.length === 0) { showToast('Keine Messungen zum Speichern vorhanden.', 'error'); return; }

  const pendingData = _collectPipeData();
  const pendingMeasurements = measurements;

  createModal(
    'Ankerpunkte setzen',
    `<p style="margin:0 0 12px;color:#555;font-size:13px;">
      Um die Messungen später in ein neues Bild zu übertragen, werden <b>2 Ankerpunkte</b> benötigt.<br><br>
      Du klickst gleich zwei gut erkennbare, feste Punkte im Bild an und gibst ihnen einen Namen –
      zum Beispiel eine <b>Hausecke</b>, einen <b>Schachtdeckel</b> oder einen <b>Vermessungsstein</b>.<br><br>
      Beim Laden wirst du gebeten, dieselben Punkte im neuen Bild zu markieren.
    </p>`,
    () => {
      _anchorExport.pendingData = pendingData;
      _anchorExport.pendingMeasurements = pendingMeasurements;
      _anchorExport.collected   = [];
      _anchorExport.markerObjs  = [];
      _anchorExport.active      = true;
      _anchorExport.step        = 1;
      _startAnchorExportStep();
    },
    null
  );
}

function _startAnchorExportStep() {
  const step = _anchorExport.step;
  _anchorBannerExport(
    `Ankerpunkt ${step} von 2 – klicke auf einen <b>gut erkennbaren, festen Punkt</b> im Luftbild`
  );
}

function _cancelAnchorExport() {
  _anchorExport.active = false;
  _anchorExport.step   = 0;
  _anchorExport.markerObjs.forEach(o => canvas.remove(o));
  _anchorExport.markerObjs  = [];
  _anchorExport.collected   = [];
  _anchorExport.pendingData = null;
  _anchorExport.pendingMeasurements = null;
  _removeBanner();
  canvas.renderAll();
}

function _handleAnchorExportClick(p) {
  if (!_anchorExport.active) return false;
  const step = _anchorExport.step;

  // Namenseingabe per kleinem Modal
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal" style="max-width:360px;">
    <h2>Ankerpunkt ${step} benennen</h2>
    <p style="margin:0 0 10px;color:#555;font-size:13px;">
      Gib einen eindeutigen Namen ein, damit du diesen Punkt im neuen Luftbild wiederfindest.<br>
      <span style="color:#888;font-size:11px;">Beispiele: Hausecke NW, Schachtdeckel Einfahrt, Vermessungsstein</span>
    </p>
    <input id="_ap-name-input" type="text" placeholder="z.B. Hausecke NW"
      style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:13px;margin-bottom:4px;" />
    <div id="_ap-name-error" style="color:#ef4444;font-size:11px;margin-bottom:10px;display:none;">Bitte einen Namen eingeben.</div>
    <div class="btn-row">
      <button id="_ap-cancel">Abbrechen</button>
      <button id="_ap-ok" style="background:#4ecca3;color:#1a1a2e;font-weight:600;">Setzen</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const inp = ov.querySelector('#_ap-name-input');
  inp.focus();

  const errEl = ov.querySelector('#_ap-name-error');
  const confirm = () => {
    const name = inp.value.trim();
    if (!name) { inp.style.borderColor = '#ef4444'; errEl.style.display = 'block'; inp.focus(); return; }
    errEl.style.display = 'none';
    document.body.removeChild(ov);

    const m = _leitungenToMeters(p.x, p.y);
    _anchorExport.collected.push({ name, x_m: m.x, y_m: m.y });
    const newMarkers = _addAnchorMarker(p.x, p.y, name, step);
    _anchorExport.markerObjs.push(...newMarkers);

    if (step === 1) {
      _anchorExport.step = 2;
      _startAnchorExportStep();
    } else {
      // Beide Ankerpunkte gesetzt → Datei speichern
      _anchorExport.active = false;
      _removeBanner();
      setTimeout(() => {
        _anchorExport.markerObjs.forEach(o => canvas.remove(o));
        _anchorExport.markerObjs = [];
        canvas.renderAll();
      }, 1500);

      const { pipes, pipeReferences } = _anchorExport.pendingData;
      const measurements = _anchorExport.pendingMeasurements || [];
      const data = {
        version: 3,
        exportDate: new Date().toISOString(),
        anchors: _anchorExport.collected,
        imageInfo: {
          scale: state.scale,
          imgDisplayScale: state.imgDisplayScale,
          imgOriginalWidth: state.imgOriginalWidth,
        },
        pipes,
        pipeReferences,
        measurements,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'messungen.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 5000);
      const parts = [];
      if (pipes.length > 0) parts.push(`${pipes.length} Leitung${pipes.length === 1 ? '' : 'en'}`);
      if (measurements.length > 0) parts.push(`${measurements.length} Messung${measurements.length === 1 ? '' : 'en'}`);
      showToast(`${parts.join(' + ')} gespeichert`, 'success');
      _anchorExport.collected   = [];
      _anchorExport.pendingData = null;
      _anchorExport.pendingMeasurements = null;
    }
  };

  ov.querySelector('#_ap-ok').onclick     = confirm;
  ov.querySelector('#_ap-cancel').onclick = () => { document.body.removeChild(ov); _cancelAnchorExport(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { document.body.removeChild(ov); _cancelAnchorExport(); } });
  return true;
}

// ── IMPORT: Ankerpunkte im neuen Bild setzen ─────────────

export const _anchorImport = { active: false, anchors: [], step: 0, clicked: [], markerObjs: [], data: null };

function _cancelAnchorImport() {
  _anchorImport.active = false;
  _anchorImport.step   = 0;
  _anchorImport.clicked = [];
  _anchorImport.markerObjs.forEach(o => canvas.remove(o));
  _anchorImport.markerObjs = [];
  _anchorImport.data    = null;
  _removeBanner();
  canvas.renderAll();
}

function _startAnchorImport(data) {
  _anchorImport.data     = data;
  _anchorImport.anchors  = data.anchors;
  _anchorImport.step     = 0;
  _anchorImport.clicked  = [];
  _anchorImport.markerObjs = [];
  _anchorImport.active   = true;
  _showAnchorImportStep();
}

function _showAnchorImportStep() {
  const idx    = _anchorImport.step;
  const anchor = _anchorImport.anchors[idx];
  const total  = _anchorImport.anchors.length;
  _anchorBannerImport(
    `Ankerpunkt ${idx + 1} von ${total}: Klicke auf <b>&bdquo;${anchor.name}&ldquo;</b> im neuen Luftbild`
  );
}

function _handleAnchorImportClick(p) {
  if (!_anchorImport.active) return false;
  const idx    = _anchorImport.step;
  const anchor = _anchorImport.anchors[idx];

  // Marker setzen
  const newMarkers = _addAnchorMarker(p.x, p.y, anchor.name, idx + 1);
  _anchorImport.markerObjs.push(...newMarkers);
  _anchorImport.clicked.push({ x: p.x, y: p.y });
  _anchorImport.step++;

  if (_anchorImport.step < _anchorImport.anchors.length) {
    _showAnchorImportStep();
  } else {
    // Alle Ankerpunkte gesetzt → einmessen
    _anchorImport.active = false;
    _removeBanner();
    const data    = _anchorImport.data;
    const clicked = _anchorImport.clicked.slice();
    setTimeout(() => {
      _anchorImport.markerObjs.forEach(o => canvas.remove(o));
      _anchorImport.markerObjs = [];
      canvas.renderAll();
    }, 1500);
    _doImportLeitungen(data, clicked);
  }
  return true;
}

// ── Gemeinsamer Canvas-Klick-Handler (aus mouse:down) ────

export function handleLeitungenAlignClick(p) {
  if (_anchorExport.active) return _handleAnchorExportClick(p);
  if (_anchorImport.active) return _handleAnchorImportClick(p);
  return false;
}

// ── Leitungen tatsächlich auf Canvas platzieren ──────────

function _doImportLeitungen(data, clickedPts) {
  // clickedPts = Canvas-Koordinaten der vom Nutzer gesetzten Ankerpunkte
  // data.anchors = gespeicherte Ankerpunkte (x_m, y_m)
  const img   = state.backgroundImage;
  const s     = state.imgDisplayScale;
  const scale = state.scale;

  // Basis-Transformation: Meter → Canvas
  let toCanvas = (mx, my) => ({
    x: mx * s * scale + img.left,
    y: my * s * scale + img.top,
  });

  // Affine 2-Punkt-Transformation mit gespeicherten Ankerpunkten
  if (clickedPts && clickedPts.length >= 2 && data.anchors && data.anchors.length >= 2) {
    const base0 = toCanvas(data.anchors[0].x_m, data.anchors[0].y_m);
    const base1 = toCanvas(data.anchors[1].x_m, data.anchors[1].y_m);
    const dst0  = clickedPts[0];
    const dst1  = clickedPts[1];

    const dx0 = base1.x - base0.x, dy0 = base1.y - base0.y;
    const dx1 = dst1.x  - dst0.x,  dy1 = dst1.y  - dst0.y;
    const lenS = Math.hypot(dx0, dy0), lenD = Math.hypot(dx1, dy1);

    if (lenS > 0 && lenD > 0) {
      const sf   = lenD / lenS;
      const rot  = Math.atan2(dy1, dx1) - Math.atan2(dy0, dx0);
      const cosR = Math.cos(rot) * sf, sinR = Math.sin(rot) * sf;
      const tx   = dst0.x - (cosR * base0.x - sinR * base0.y);
      const ty   = dst0.y - (sinR * base0.x + cosR * base0.y);
      const base = toCanvas;
      toCanvas = (mx, my) => {
        const b = base(mx, my);
        return { x: cosR * b.x - sinR * b.y + tx, y: sinR * b.x + cosR * b.y + ty };
      };
    }
  }

  // Duplikat-Schutz: Rohre mit bereits vorhandener ID überspringen
  const existingIds = new Set(state.measurements.map(m => m.id));
  const pipesToImport = data.pipes.filter(p => !existingIds.has(p.id));
  const skipped = data.pipes.length - pipesToImport.length;
  if (skipped > 0) showToast(`${skipped} bereits vorhandene Leitung${skipped === 1 ? '' : 'en'} übersprungen.`, 'info');
  if (pipesToImport.length === 0) { showToast('Alle Leitungen bereits vorhanden – Import übersprungen.', 'warning'); return; }

  let importedCount = 0;
  pipesToImport.forEach(pipe => {
    if (!pipe.points_m || pipe.points_m.length < 2) return;
    if (!PIPE_TYPES[pipe.pipeType]) return;

    const pts = pipe.points_m.map(p => toCanvas(p.x, p.y));
    const id  = nextMeasureId();
    const pt  = PIPE_TYPES[pipe.pipeType];
    const depth = pipe.pipeDepth || null;

    const line = new fabric.Polyline(pts.map(p => ({ x: p.x, y: p.y })), {
      fill: 'transparent',
      stroke: pt.color, strokeWidth: PIPE_LINE_WIDTH,
      strokeDashArray: pt.dash && pt.dash.length ? pt.dash : undefined,
      selectable: true, evented: true,
      _measureId: id, _pipeType: pipe.pipeType, _pipeDepth: depth,
      lockMovementX: true, lockMovementY: true,
    });
    canvas.add(line);
    pts.forEach(p => addEndpointDot(p.x, p.y, pt.color, id));

    if (!state.pipeLayerVisible) {
      canvas.getObjects().filter(o => o._measureId === id && !o._pipeHandle).forEach(o => { o.visible = false; });
    }

    const depthLabel = depth ? ` (${depth} cm)` : '';
    state.measurements.push({ id, type: 'pipe', label: pt.label + depthLabel, value: null, pipeType: pipe.pipeType, pipeDepth: depth, refs: [] });
    importedCount++;
  });

  sendPipesToBack();
  offsetOverlappingPipes();

  // ── Messungen importieren (v3) ──
  let measImported = 0;
  if (Array.isArray(data.measurements)) {
    data.measurements.forEach(m => {
      if (m.type === 'distance') {
        const p1 = toCanvas(m.p1_m.x, m.p1_m.y);
        const p2 = toCanvas(m.p2_m.x, m.p2_m.y);
        const color = m.color || state.color;
        const id = nextMeasureId();

        const pxDist = ptDist(p1.x, p1.y, p2.x, p2.y) / state.imgDisplayScale;
        const meters = state.scale ? pxDist / state.scale : null;
        const labelText = meters ? formatDistance(meters) : `${Math.round(pxDist)} px`;

        const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
          stroke: color, strokeWidth: state.lineWidth,
          selectable: true, evented: true, _measureId: id,
          lockMovementX: true, lockMovementY: true,
          hasControls: false, hasBorders: false,
          lockScalingX: true, lockScalingY: true, lockRotation: true,
        });
        canvas.add(line);
        addEndpointDot(p1.x, p1.y, color, id);
        addEndpointDot(p2.x, p2.y, color, id);
        addTickMarks(line, color, id);

        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const offX = -Math.sin(angle) * 14;
        const offY =  Math.cos(angle) * 14;
        addLabel(mx + offX, my + offY, labelText, color, id);

        state.measurements.push({ id, type: 'distance', label: labelText, value: meters });
        measImported++;
      }

      if (m.type === 'area') {
        if (!m.points_m || m.points_m.length < 3) return;
        const pts = m.points_m.map(p => toCanvas(p.x, p.y));
        const color = m.color || state.color;
        const id = nextMeasureId();

        const pxArea = polygonArea(pts) / (state.imgDisplayScale ** 2);
        const m2 = state.scale ? pxArea / (state.scale ** 2) : null;
        const labelText = m2 ? formatArea(m2) : `${Math.round(pxArea)} px²`;

        const poly = new fabric.Polygon(pts.map(p => ({ x: p.x, y: p.y })), {
          fill: color + '33', stroke: color, strokeWidth: state.lineWidth,
          selectable: true, evented: true, _measureId: id,
          lockMovementX: true, lockMovementY: true,
          hasControls: false, hasBorders: false,
          lockScalingX: true, lockScalingY: true, lockRotation: true,
        });
        canvas.add(poly);

        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        addLabel(cx, cy, labelText, color, id);
        addAreaEdgeLabels(pts, id, color);

        state.measurements.push({ id, type: 'area', label: labelText, value: m2 });
        measImported++;
      }

      if (m.type === 'circle') {
        const center = toCanvas(m.center_m.x, m.center_m.y);
        // Reconstruct radius in canvas pixels from meters
        const edgePt = toCanvas(m.center_m.x + m.radius_m, m.center_m.y);
        const r = Math.hypot(edgePt.x - center.x, edgePt.y - center.y);
        const color = m.color || state.color;
        const id = nextMeasureId();

        const rOrig = r / state.imgDisplayScale;
        const rMeters = state.scale ? rOrig / state.scale : null;
        const m2 = rMeters ? Math.PI * rMeters * rMeters : null;
        const rLabel = rMeters ? `r = ${formatDistance(rMeters)}` : `r = ${Math.round(r)} px`;
        const aLabel = m2 ? `A = ${formatArea(m2)}` : `A = ${Math.round(Math.PI * r * r)} px²`;

        const circ = new fabric.Circle({
          left: center.x - r, top: center.y - r, radius: r,
          fill: color + '26', stroke: color, strokeWidth: state.lineWidth,
          selectable: true, evented: true, _measureId: id,
          lockMovementX: true, lockMovementY: true,
          hasControls: false, hasBorders: false,
          lockScalingX: true, lockScalingY: true, lockRotation: true,
        });
        const radiusLine = new fabric.Line([center.x, center.y, center.x + r, center.y], {
          stroke: color, strokeWidth: 1.5, strokeDashArray: [5, 3],
          selectable: false, evented: false, _measureId: id,
        });
        canvas.add(circ, radiusLine);
        addEndpointDot(center.x, center.y, color, id);
        addEndpointDot(center.x + r, center.y, color, id);
        addLabel(center.x + r / 2, center.y - 10, rLabel, color, id);
        addLabel(center.x, center.y + 10, aLabel, color, id);

        const combinedLabel = `${rLabel} | ${aLabel}`;
        state.measurements.push({ id, type: 'circle', label: combinedLabel, value: m2, rMeters });
        measImported++;
      }

      if (m.type === 'arc') {
        const center = toCanvas(m.center_m.x, m.center_m.y);
        const startPt = toCanvas(m.startPt_m.x, m.startPt_m.y);
        const r = ptDist(center.x, center.y, startPt.x, startPt.y);
        const color = m.color || state.color;
        const id = nextMeasureId();
        const sweep = m.sweep;
        const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
        const endAngle = m.endAngle;

        // Compute end point on circle
        const endPt = { x: center.x + r * Math.cos(endAngle), y: center.y + r * Math.sin(endAngle) };

        let diff = sweep === 1
          ? (endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI)
          : (startAngle - endAngle + 2 * Math.PI) % (2 * Math.PI);
        if (diff === 0) diff = 2 * Math.PI;

        const rOrig = r / state.imgDisplayScale;
        const rMeters = state.scale ? rOrig / state.scale : null;
        const arcLen = rOrig * diff;
        const arcLenM = state.scale ? arcLen / state.scale : null;
        const sectorArea = 0.5 * rOrig * rOrig * diff;
        const sectorAreaM = state.scale ? sectorArea / (state.scale ** 2) : null;
        const angleDeg = (diff * 180 / Math.PI).toFixed(1);

        const rLabel = rMeters ? `r=${formatDistance(rMeters)}` : `r=${Math.round(r)}px`;
        const arcLabel = arcLenM ? `Bogen: ${formatDistance(arcLenM)}` : `Bogen: ${Math.round(arcLen)}px`;
        const aLabel = sectorAreaM ? `A=${formatArea(sectorAreaM)}` : `A=${Math.round(sectorArea)}px²`;
        const fullLabel = `${angleDeg}° | ${rLabel} | ${aLabel}`;

        const sector = buildSectorPath(center, r, startAngle, endAngle, color, undefined, sweep);
        sector._measureId = id;

        const line1 = new fabric.Line([center.x, center.y, startPt.x, startPt.y], {
          stroke: color, strokeWidth: state.lineWidth,
          selectable: false, evented: false, _measureId: id,
        });
        const line2 = new fabric.Line([center.x, center.y, endPt.x, endPt.y], {
          stroke: color, strokeWidth: state.lineWidth,
          selectable: false, evented: false, _measureId: id,
        });
        canvas.add(sector, line1, line2);
        addEndpointDot(center.x, center.y, color, id);
        addEndpointDot(startPt.x, startPt.y, color, id);
        addEndpointDot(endPt.x, endPt.y, color, id);

        const midAngle = startAngle + diff / 2;
        const labelR = r * 0.55;
        const lx = center.x + labelR * Math.cos(midAngle);
        const ly = center.y + labelR * Math.sin(midAngle);
        addLabel(lx, ly, `${angleDeg}°`, color, id);
        addLabel(lx, ly + state.fontSize + 4, aLabel, color, id);
        const arcMidX = center.x + r * Math.cos(midAngle);
        const arcMidY = center.y + r * Math.sin(midAngle);
        addLabel(arcMidX, arcMidY - 10, arcLabel, color, id);

        state.measurements.push({ id, type: 'arc', label: fullLabel, value: sectorAreaM });
        measImported++;
      }
    });
  }

  updateMeasurementList();
  updatePipeLegend();
  saveSnapshot();
  const parts = [];
  if (importedCount > 0) parts.push(`${importedCount} Leitung${importedCount === 1 ? '' : 'en'}`);
  if (measImported > 0) parts.push(`${measImported} Messung${measImported === 1 ? '' : 'en'}`);
  showToast(`${parts.join(' + ')} eingemessen`, 'success');
  renderAllDimLines();
  canvas.renderAll();
}

// ── Import-Datei laden ────────────────────────────────────

document.getElementById('leitungen-import-input').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  if (!state.backgroundImage) { showToast('Bitte zuerst ein Luftbild laden.', 'error'); e.target.value = ''; return; }
  if (!state.scale)           { showToast('Bitte zuerst den Maßstab setzen.', 'error');  e.target.value = ''; return; }

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      const hasPipes = Array.isArray(data.pipes) && data.pipes.length > 0;
      const hasMeasurements = Array.isArray(data.measurements) && data.measurements.length > 0;
      if (!hasPipes && !hasMeasurements) throw new Error('Ungültiges Format');
      if ((data.version !== 2 && data.version !== 3) || !Array.isArray(data.anchors) || data.anchors.length < 2) {
        createModal(
          'Älteres Dateiformat',
          `<p style="margin:0 0 12px;color:#555;font-size:13px;">
            Diese Datei hat <b>keine Ankerpunkte</b> und kann nicht eingemessen werden.<br><br>
            So geht's: Öffne das <b>Original-Bild</b> als Projekt (Laden), dann
            <b>„Messungen transferieren"</b> – dabei werden die Ankerpunkte neu festgelegt.
          </p>`,
          () => {},
          null
        );
        return;
      }

      const dateStr = data.exportDate ? new Date(data.exportDate).toLocaleDateString('de-DE') : '–';
      const summaryParts = [];
      if (hasPipes) summaryParts.push(`<b>${data.pipes.length} Leitung${data.pipes.length === 1 ? '' : 'en'}</b>`);
      if (hasMeasurements) summaryParts.push(`<b>${data.measurements.length} Messung${data.measurements.length === 1 ? '' : 'en'}</b>`);
      const ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.innerHTML = `<div class="modal" style="max-width:400px;">
        <h2>Messungen einmessen</h2>
        <p style="margin:0 0 12px;color:#555;font-size:13px;">
          ${summaryParts.join(' + ')} vom ${dateStr}.<br><br>
          Du wirst jetzt nacheinander gebeten, folgende Ankerpunkte im neuen Bild anzuklicken:<br>
          <span style="display:block;margin:8px 0 0 0;line-height:1.9;">${data.anchors.map((a, i) =>
            `<span style="display:inline-flex;align-items:center;gap:5px;">
              <span style="background:#FF9500;color:#fff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${i+1}</span>
              ${a.name}
            </span>`).join('<br>')}</span>
        </p>
        <div class="btn-row">
          <button id="_li-cancel">Abbrechen</button>
          <button id="_li-ok" style="background:#4ecca3;color:#1a1a2e;font-weight:600;">Ankerpunkte setzen</button>
        </div>
      </div>`;
      document.body.appendChild(ov);
      const close = () => document.body.removeChild(ov);
      ov.querySelector('#_li-ok').onclick     = () => { close(); _startAnchorImport(data); };
      ov.querySelector('#_li-cancel').onclick = close;
    } catch (err) { showToast(err.message || 'Fehler beim Laden der Datei.', 'error'); e.target.value = ''; }
  };
  reader.readAsText(file);
  e.target.value = '';
};


// Expose cancel functions for inline onclick in banner HTML
window._cancelAnchorExport = _cancelAnchorExport;
window._cancelAnchorImport = _cancelAnchorImport;
// Expose exportLeitungen for save-load modal
window.exportLeitungen = exportLeitungen;
