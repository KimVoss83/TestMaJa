import { state, PIPE_TYPES, nextMeasureId } from '../state.js';
import { canvas } from '../canvas.js';
import { showToast, createModal } from '../ui/modals.js';
import { saveSnapshot } from '../undo.js';
import { endPipeEdit, sendPipesToBack, offsetOverlappingPipes, PIPE_LINE_WIDTH } from '../tools/pipe.js';
import { addEndpointDot } from '../utils/helpers.js';
import { clearPipeDistanceGuides, renderAllDimLines } from '../ui/pipe-guides.js';
import { updateMeasurementList } from '../ui/sidebar.js';
import { updatePipeLegend } from '../ui/pipe-legend.js';

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

export const _anchorExport = { active: false, step: 0, collected: [], markerObjs: [], pendingData: null };

export function exportLeitungen() {
  if (!state.backgroundImage) { showToast('Bitte zuerst ein Luftbild laden.', 'error'); return; }
  if (!state.scale)           { showToast('Bitte zuerst den Maßstab setzen.', 'error'); return; }
  endPipeEdit();
  clearPipeDistanceGuides();

  const { pipes } = _collectPipeData();
  if (pipes.length === 0) { showToast('Keine Leitungen zum Speichern vorhanden.', 'error'); return; }

  const pendingData = _collectPipeData();

  createModal(
    'Ankerpunkte setzen',
    `<p style="margin:0 0 12px;color:#555;font-size:13px;">
      Um die Leitungen später in ein neues Luftbild einzumessen, werden <b>2 Ankerpunkte</b> benötigt.<br><br>
      Du klickst gleich zwei gut erkennbare, feste Punkte im Bild an und gibst ihnen einen Namen –
      zum Beispiel eine <b>Hausecke</b>, einen <b>Schachtdeckel</b> oder einen <b>Vermessungsstein</b>.<br><br>
      Beim Laden wirst du gebeten, dieselben Punkte im neuen Luftbild zu markieren.
    </p>`,
    () => {
      _anchorExport.pendingData = pendingData;
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
      const data = {
        version: 2,
        exportDate: new Date().toISOString(),
        anchors: _anchorExport.collected,
        imageInfo: {
          scale: state.scale,
          imgDisplayScale: state.imgDisplayScale,
          imgOriginalWidth: state.imgOriginalWidth,
        },
        pipes,
        pipeReferences,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'leitungen.json';
      a.click();
      showToast(`${pipes.length} Leitung${pipes.length === 1 ? '' : 'en'} gespeichert`, 'success');
      _anchorExport.collected   = [];
      _anchorExport.pendingData = null;
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
  updateMeasurementList();
  updatePipeLegend();
  saveSnapshot();
  showToast(`${importedCount} Leitung${importedCount === 1 ? '' : 'en'} eingemessen`, 'success');
  renderAllDimLines();
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
      if (!data.pipes || !Array.isArray(data.pipes)) throw new Error('Ungültiges Format');
      if (data.version !== 2 || !Array.isArray(data.anchors) || data.anchors.length < 2) {
        createModal(
          'Älteres Dateiformat',
          `<p style="margin:0 0 12px;color:#555;font-size:13px;">
            Diese Leitungsdatei hat <b>keine Ankerpunkte</b> und kann nicht eingemessen werden.<br><br>
            So geht's: Öffne das <b>Original-Luftbild</b> als Projekt (Laden), wechsle dann ins
            Leitungen-Panel und klicke <b>„Leitungen speichern"</b> – dabei werden die Ankerpunkte neu festgelegt.
          </p>`,
          () => {},
          null
        );
        return;
      }

      const dateStr = data.exportDate ? new Date(data.exportDate).toLocaleDateString('de-DE') : '–';
      const names   = data.anchors.map(a => `<b>${a.name}</b>`).join(', ');
      const ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.innerHTML = `<div class="modal" style="max-width:400px;">
        <h2>Leitungen einmessen</h2>
        <p style="margin:0 0 12px;color:#555;font-size:13px;">
          <b>${data.pipes.length} Leitung${data.pipes.length === 1 ? '' : 'en'}</b> vom ${dateStr}.<br><br>
          Du wirst jetzt nacheinander gebeten, folgende Ankerpunkte im neuen Luftbild anzuklicken:<br>
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
    } catch (err) { showToast(err.message || 'Fehler beim Laden der Leitungsdatei.', 'error'); e.target.value = ''; }
  };
  reader.readAsText(file);
  e.target.value = '';
};


// Expose cancel functions for inline onclick in banner HTML
window._cancelAnchorExport = _cancelAnchorExport;
window._cancelAnchorImport = _cancelAnchorImport;
// Expose exportLeitungen for save-load modal
window.exportLeitungen = exportLeitungen;
