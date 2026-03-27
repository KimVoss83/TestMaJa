import { state, CANVAS_SERIAL_PROPS } from '../state.js';
import { canvas } from '../canvas.js';
import { showToast, createModal } from '../ui/modals.js';
import { history, saveSnapshot, updateUndoRedoButtons } from '../undo.js';
import { endPipeEdit, offsetOverlappingPipes } from '../tools/pipe.js';
import { clearPipeDistanceGuides, renderAllDimLines } from '../ui/pipe-guides.js';
import { updateRefStatus } from '../tools/ref.js';
import { updateMeasurementList } from '../ui/sidebar.js';
import { updatePipeLegend } from '../ui/pipe-legend.js';
import { updatePipeRefList, setPipeRefId } from '../tools/pipe-refs.js';
import { calcAccuracy } from './photogrammetry.js';
import { PIPE_TYPES } from '../state.js';

// SAVE / LOAD  (Zentrales Modal)
// =========================================================

export function _saveOptionHTML(id, icon, title, desc) {
  return `<label class="save-load-option" data-action="${id}">
    <span class="slo-icon">${icon}</span>
    <span class="slo-text"><strong>${title}</strong><br><span class="slo-desc">${desc}</span></span>
  </label>`;
}

export function openSaveModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'save-load-modal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h2>Speichern</h2>
      <p style="margin:0 0 10px;color:#888;font-size:12px;">Was möchtest du speichern?</p>
      <div id="sl-step1" style="display:flex;flex-direction:column;gap:6px;">
        ${_saveOptionHTML('save-project', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>', 'Gesamtes Projekt', 'Alle Messungen, Leitungen, Einstellungen')}
        ${_saveOptionHTML('save-pipes', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', 'Nur Leitungen', 'Leitungen mit Ankerpunkten für neues Luftbild')}
      </div>
      <div id="sl-step2" style="display:none;">
        <p style="margin:0 0 10px;color:#888;font-size:12px;">In welchem Format?</p>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${_saveOptionHTML('fmt-json', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', 'Projektdatei (.json)', 'Zum Weiterarbeiten – kann wieder geladen werden')}
          ${_saveOptionHTML('fmt-pdf', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', 'PDF', 'Zum Drucken und Teilen')}
          ${_saveOptionHTML('fmt-png', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>', 'Bild (.png)', 'Als hochauflösende Bilddatei')}
        </div>
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button id="sl-back" style="display:none;">Zurück</button>
        <button id="sl-close">Abbrechen</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => document.body.removeChild(overlay);
  overlay.querySelector('#sl-close').onclick = close;

  // Step 1: Was speichern?
  overlay.querySelectorAll('#sl-step1 .save-load-option').forEach(opt => {
    opt.onclick = () => {
      const action = opt.dataset.action;
      if (action === 'save-pipes') {
        close();
        if (window.exportLeitungen) window.exportLeitungen();
      } else if (action === 'save-project') {
        overlay.querySelector('#sl-step1').style.display = 'none';
        overlay.querySelector('#sl-step2').style.display = '';
        overlay.querySelector('#sl-back').style.display = '';
        overlay.querySelector('h2').textContent = 'Projekt speichern';
        overlay.querySelector('p').textContent = 'In welchem Format?';
      }
    };
  });

  // Back button
  overlay.querySelector('#sl-back').onclick = () => {
    overlay.querySelector('#sl-step1').style.display = '';
    overlay.querySelector('#sl-step2').style.display = 'none';
    overlay.querySelector('#sl-back').style.display = 'none';
    overlay.querySelector('h2').textContent = 'Speichern';
    overlay.querySelector('p').textContent = 'Was möchtest du speichern?';
  };

  // Step 2: Format
  overlay.querySelectorAll('#sl-step2 .save-load-option').forEach(opt => {
    opt.onclick = () => {
      close();
      const fmt = opt.dataset.action;
      if (fmt === 'fmt-json') doSaveProjectJSON();
      else if (fmt === 'fmt-pdf') doSavePDF();
      else if (fmt === 'fmt-png') doSavePNG();
    };
  });

  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

export function openLoadModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'save-load-modal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h2>Laden</h2>
      <p style="margin:0 0 10px;color:#888;font-size:12px;">Was möchtest du laden?</p>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${_saveOptionHTML('load-project', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', 'Projekt laden (.json)', 'Gespeichertes Projekt öffnen und weiterarbeiten')}
        ${_saveOptionHTML('load-pipes', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', 'Leitungen einmessen', 'Gespeicherte Leitungen in neues Luftbild übertragen')}
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button id="sl-close">Abbrechen</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => document.body.removeChild(overlay);
  overlay.querySelector('#sl-close').onclick = close;

  overlay.querySelectorAll('.save-load-option').forEach(opt => {
    opt.onclick = () => {
      close();
      const action = opt.dataset.action;
      if (action === 'load-project') document.getElementById('json-input').click();
      else if (action === 'load-pipes') document.getElementById('leitungen-import-input').click();
    };
  });

  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

document.getElementById('btn-central-save').onclick = openSaveModal;
document.getElementById('btn-central-load').onclick = openLoadModal;

// ─── Einzelne Speicherfunktionen (vom Modal aufgerufen) ───

export function doSavePNG() {
  endPipeEdit(); clearPipeDistanceGuides();
  const url = canvas.toDataURL({ format: 'png', multiplier: 3 });

  // Data-URL → Blob konvertieren
  const byteString = atob(url.split(',')[1]);
  const mimeString = url.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: mimeString });
  const file = new File([blob], 'gartenplan.png', { type: 'image/png' });

  // iOS/Mobile: Share Sheet verwenden wenn verfügbar
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Gartenplan' }).catch(() => {});
    return;
  }

  // Fallback: Blob-URL Download (funktioniert besser als data: URL)
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = 'gartenplan.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

document.getElementById('btn-save-png').onclick = doSavePNG;

export function doSavePDF() {
  endPipeEdit(); clearPipeDistanceGuides();
  if (!state.backgroundImage) { showToast('Bitte zuerst ein Luftbild laden.'); return; }
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  if (!canvasW || !canvasH) { showToast('Canvas nicht initialisiert.'); return; }

  const btn = document.getElementById('btn-save-pdf');
  btn.textContent = 'Wird erstellt …';
  btn.disabled = true;

  // Render at 3× resolution
  const imgData = canvas.toDataURL({ format: 'png', multiplier: 3 });
  const isLandscape = canvasW >= canvasH;

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const footerH = 22; // mm for scale bar + legend
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2 - footerH;

  const aspect = canvasW / canvasH;
  let imgW = maxW;
  let imgH = imgW / aspect;
  if (imgH > maxH) { imgH = maxH; imgW = imgH * aspect; }

  const offsetX = margin + (maxW - imgW) / 2;
  const offsetY = margin + (maxH - imgH) / 2;

  pdf.addImage(imgData, 'PNG', offsetX, offsetY, imgW, imgH);

  // ── Rahmen um Karte ──
  pdf.setDrawColor(180); pdf.setLineWidth(0.2);
  pdf.rect(offsetX, offsetY, imgW, imgH);

  const footerY = offsetY + imgH + 4;

  // ── Maßstabsbalken ──
  if (state.scale && state.imgDisplayScale) {
    // Meter pro mm auf der Karte (PDF-Koordinaten)
    const pxPerMm = (canvasW / imgW);                           // canvas-px pro pdf-mm
    const mPerMm  = pxPerMm / (state.imgDisplayScale * state.scale); // m pro pdf-mm
    // Wähle schöne Balkenlänge
    const NICE = [1,2,5,10,20,25,50,100,200,500,1000];
    const targetMm = 30;
    const rawM = targetMm * mPerMm;
    const barM = NICE.find(n => n >= rawM) || NICE[NICE.length - 1];
    const barMm = barM / mPerMm;
    const bx = offsetX;
    const by = footerY + 3;

    pdf.setDrawColor(40); pdf.setLineWidth(0.4); pdf.setFillColor(40);
    // Hauptlinie
    pdf.line(bx, by, bx + barMm, by);
    // Endticks
    pdf.line(bx, by - 1.2, bx, by + 1.2);
    pdf.line(bx + barMm, by - 1.2, bx + barMm, by + 1.2);
    // Halbtick
    pdf.setLineWidth(0.2);
    pdf.line(bx + barMm / 2, by - 0.8, bx + barMm / 2, by + 0.8);
    // Labels
    pdf.setFontSize(6.5); pdf.setTextColor(40);
    pdf.text('0', bx, by + 3.5);
    pdf.text(`${barM >= 1000 ? (barM/1000)+'km' : barM+'m'}`, bx + barMm, by + 3.5, { align: 'right' });
    pdf.setFontSize(5.5); pdf.setTextColor(100);
    pdf.text('Maßstabsbalken', bx, by + 6);
  }

  // ── Legende (Leitungstypen) ──
  const pipeTypes = [...new Set(
    canvas.getObjects().filter(o => o._pipeType).map(o => o._pipeType)
  )];
  if (pipeTypes.length) {
    let lx = offsetX + 45;
    const ly = footerY + 1;
    pdf.setFontSize(6); pdf.setTextColor(80);
    pdf.text('Leitungen:', lx, ly + 3);
    lx += 18;
    pipeTypes.forEach(key => {
      const pt = PIPE_TYPES[key];
      if (!pt) return;
      const [r, g, b] = pt.color.match(/\w\w/g).map(x => parseInt(x, 16));
      pdf.setFillColor(r, g, b);
      pdf.setDrawColor(r, g, b);
      pdf.rect(lx, ly + 1, 8, 2, 'F');
      pdf.setTextColor(40); pdf.setFontSize(6);
      pdf.text(`${pt.icon} ${pt.label}`, lx + 10, ly + 3.5);
      lx += 10 + pdf.getTextWidth(`${pt.icon} ${pt.label}`) + 4;
    });
  }

  // ── Titelblock rechts ──
  const dateStr = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
  pdf.setFontSize(7); pdf.setTextColor(80);
  pdf.text(`Planer`, pageW - margin, footerY + 3, { align: 'right' });
  pdf.setFontSize(6); pdf.setTextColor(130);
  pdf.text(`Exportiert: ${dateStr}`, pageW - margin, footerY + 7, { align: 'right' });
  if (state.scale && state.imgDisplayScale) {
    const acc = calcAccuracy();
    if (acc) {
      const gsd = acc.gsd_cm < 1 ? `${(acc.gsd_cm*10).toFixed(1)} mm/px` : `${acc.gsd_cm.toFixed(1)} cm/px`;
      pdf.text(`GSD: ${gsd}`, pageW - margin, footerY + 11, { align: 'right' });
    }
  }

  // iOS/Mobile: Share Sheet wenn verfügbar
  const pdfBlob = pdf.output('blob');
  const pdfFile = new File([pdfBlob], 'gartenplan.pdf', { type: 'application/pdf' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    navigator.share({ files: [pdfFile], title: 'Gartenplan' }).catch(() => {});
  } else {
    pdf.save('gartenplan.pdf');
  }

  btn.textContent = 'PDF exportieren';
  btn.disabled = false;
}
document.getElementById('btn-save-pdf').onclick = doSavePDF;

export function doSaveProjectJSON() {
  endPipeEdit();
  clearPipeDistanceGuides();
  const data = {
    version: 3,
    scale: state.scale,
    scaleSource: state.scaleSource,
    imgDisplayScale: state.imgDisplayScale,
    exifAltitude: state.exifAltitude,
    refLines: state.refLines,
    refSumL2: state.refSumL2,
    imgOriginalWidth: state.imgOriginalWidth,
    flightCam: state.flightCam || null,
    fontSize: state.fontSize,
    labelBg: state.labelBg,
    gridStepM: state.gridStepM || 0,
    gridColor: state.gridColor || '#ffffff',
    gridOpacity: state.gridOpacity != null ? state.gridOpacity : 0.28,
    measurements: state.measurements.map(({ id, type, label, value, rMeters, pipeType, pipeDepth, refs, nennweite, dimFootOverrides }) => ({ id, type, label, value, rMeters, pipeType, pipeDepth, refs: refs || [], nennweite: nennweite || null, dimFootOverrides: dimFootOverrides || {} })),
    pipeReferences: state.pipeReferences,
    activePipeRefs: state.activePipeRefs,
    canvas: canvas.toJSON(CANVAS_SERIAL_PROPS),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], 'gartenplan.json', { type: 'application/json' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Gartenplan' }).catch(() => {});
    return;
  }
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl; a.download = 'gartenplan.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}
document.getElementById('btn-save-json').onclick = doSaveProjectJSON;

document.getElementById('btn-load-json').onclick = () => document.getElementById('json-input').click();
document.getElementById('json-input').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (typeof data !== 'object' || !data.canvas) throw new Error('Ungültiges Format');
      state.scale           = (typeof data.scale === 'number' && data.scale > 0) ? data.scale : null;
      state.scaleSource     = data.scaleSource || null;
      state.imgDisplayScale = (typeof data.imgDisplayScale === 'number' && data.imgDisplayScale > 0) ? data.imgDisplayScale : 1;
      state.exifAltitude    = (typeof data.exifAltitude === 'number' && data.exifAltitude > 0) ? data.exifAltitude : null;
      state.refLines        = Array.isArray(data.refLines) ? data.refLines : [];
      state.refSumL2        = (typeof data.refSumL2 === 'number') ? data.refSumL2 : 0;
      state.imgOriginalWidth = data.imgOriginalWidth || null;
      state.flightCam       = data.flightCam || null;
      state.fontSize = (Number.isInteger(data.fontSize) && data.fontSize >= 6 && data.fontSize <= 72) ? data.fontSize : 13;
      state.labelBg  = data.labelBg === true;
      state.gridStepM  = (typeof data.gridStepM === 'number') ? data.gridStepM : 0;
      state.gridColor  = (typeof data.gridColor === 'string' && /^#[0-9a-f]{6}$/i.test(data.gridColor)) ? data.gridColor : '#ffffff';
      state.gridOpacity = (typeof data.gridOpacity === 'number') ? data.gridOpacity : 0.28;
      // Update grid UI controls
      const _gss = document.getElementById('grid-step-select'); if (_gss) _gss.value = String(state.gridStepM);
      const _gci = document.getElementById('grid-color-input'); if (_gci) _gci.value = state.gridColor;
      const _gor = document.getElementById('grid-opacity-range'); if (_gor) _gor.value = Math.round(state.gridOpacity * 100);
      const _gol = document.getElementById('grid-opacity-label'); if (_gol) _gol.textContent = Math.round(state.gridOpacity * 100) + '%';
      state.measurements = (data.measurements || []).map(m => ({ ...m }));
      state.pipeReferences = Array.isArray(data.pipeReferences) ? data.pipeReferences : [];
      state.activePipeRefs = Array.isArray(data.activePipeRefs) ? data.activePipeRefs : [];
      setPipeRefId(state.pipeReferences.reduce((max, r) => Math.max(max, r.id), 0));
      document.getElementById('font-size-input').value = state.fontSize;
      if (window._syncLabelBgBtn) window._syncLabelBgBtn(); // syncs btn-label-bg (set by initToolbar)
      canvas.loadFromJSON(data.canvas, () => {
        canvas.renderAll();
        // Remove any stale dim-line objects that were saved in the canvas JSON
        canvas.getObjects().filter(o => o._dimLinePipeId != null).forEach(o => canvas.remove(o));
        renderAllDimLines();
        updateRefStatus();
        updateMeasurementList();
        updatePipeLegend();
        updatePipeRefList();
        offsetOverlappingPipes();
        document.getElementById('drop-overlay').classList.add('hidden');
        history.past = []; history.future = []; updateUndoRedoButtons();
        showToast('Projekt geladen', 'success');
      });
    } catch { showToast('Fehler beim Laden der Datei.', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
};


// Expose for inline onclick attributes
window.openSaveModal = openSaveModal;
window.openLoadModal = openLoadModal;
