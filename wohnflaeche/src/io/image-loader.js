import { state } from '../state.js';
import { canvas, wrapper } from '../canvas.js';
import { showToast, createModal } from '../ui/modals.js';
import { updateRefStatus } from '../tools/ref.js';
import { updateMeasurementList } from '../ui/sidebar.js';

// =========================================================
// IMAGE UPLOAD
// =========================================================

// Normalisiert EXIF-Orientierung: zeichnet das Bild auf einen temporären Canvas
// und gibt die korrigierten Pixeldaten als Data-URL zurück.
export async function normalizeOrientation(file) {
  return new Promise(resolve => {
    let orientation = 1;
    const proceed = dataUrl => {
      if (orientation === 1) { resolve(dataUrl); return; }
      const img = new Image();
      img.onload = () => {
        const swap = orientation === 6 || orientation === 8;
        const c = document.createElement('canvas');
        c.width  = swap ? img.height : img.width;
        c.height = swap ? img.width  : img.height;
        const ctx = c.getContext('2d');
        switch (orientation) {
          case 3: ctx.translate(c.width, c.height); ctx.rotate(Math.PI);        break;
          case 6: ctx.translate(c.width, 0);        ctx.rotate(Math.PI / 2);    break;
          case 8: ctx.translate(0, c.height);       ctx.rotate(-Math.PI / 2);   break;
        }
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.95));
      };
      img.src = dataUrl;
    };

    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      try {
        if (window.exifr) {
          const exif = await exifr.parse(file, { tiff: true, mergeOutput: true });
          orientation = exif?.Orientation ?? 1;
        }
      } catch (_) {}
      proceed(dataUrl);
    };
    reader.readAsDataURL(file);
  });
}

export function loadImageFromDataUrl(dataUrl) {
  fabric.Image.fromURL(dataUrl, img => {
      const scaleX = (canvas.width * 0.95) / img.width;
      const scaleY = (canvas.height * 0.95) / img.height;
      const s = Math.min(scaleX, scaleY, 1);
      img.scale(s);
      state.imgDisplayScale = s;
      img.set({
        left: (canvas.width - img.width * s) / 2,
        top: (canvas.height - img.height * s) / 2,
        selectable: false, evented: false, hasBorders: false, hasControls: false,
        _noSelect: true, _isBackground: true,
      });
      state.backgroundImage = img;
      state.imgOriginalWidth = img.width;
      canvas.clear();
      canvas.add(img);
      canvas.sendToBack(img);
      document.getElementById('drop-overlay').classList.add('hidden');
      state.scale = null;
      state.scaleSource = null;
      state.exifAltitude = null;
      state.refLines = [];
      state.refSumL2 = 0;
      state.measurements = [];
      updateMeasurementList();
      updateRefStatus();
  });
}

export async function loadImage(file) {
  const dataUrl = await normalizeOrientation(file);
  loadImageFromDataUrl(dataUrl);
}

export async function loadPdf(file) {
  if (!window.pdfjsLib) { showToast('PDF.js nicht verfügbar.', 'error'); return; }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    const renderPage = async pageNum => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 3 });
      const c = document.createElement('canvas');
      c.width = viewport.width;
      c.height = viewport.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
      return c.toDataURL('image/png');
    };

    if (numPages === 1) {
      const dataUrl = await renderPage(1);
      loadImageFromDataUrl(dataUrl);
    } else {
      const bodyHTML = `
        <p style="font-size:13px;color:#636366;margin-bottom:12px;">
          Die PDF hat <b>${numPages} Seiten</b>. Welche Seite soll geladen werden?
        </p>
        <input id="_pdf-page-input" type="number" min="1" max="${numPages}" value="1"
          style="width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:13px;" />
        <div style="font-size:11px;color:#8e8e93;margin-top:4px;">Seite 1 – ${numPages}</div>
      `;
      createModal('PDF-Seite auswählen', bodyHTML, async () => {
        const n = Math.min(numPages, Math.max(1, parseInt(document.getElementById('_pdf-page-input').value) || 1));
        const dataUrl = await renderPage(n);
        loadImageFromDataUrl(dataUrl);
      });
    }
  } catch (err) {
    showToast('PDF konnte nicht geladen werden.', 'error');
    console.error(err);
  }
}

export function loadFileAuto(file) {
  if (!file) return;
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    loadPdf(file);
  } else {
    loadImage(file);
  }
}

// btn-upload ist jetzt ein <label for="file-input"> — kein JS nötig
document.getElementById('file-input').onchange = e => { loadFileAuto(e.target.files[0]); };

wrapper.addEventListener('dragover', e => { e.preventDefault(); wrapper.style.outline = '3px dashed #4ecca3'; });
wrapper.addEventListener('dragleave', () => { wrapper.style.outline = ''; });
wrapper.addEventListener('drop', e => {
  e.preventDefault();
  wrapper.style.outline = '';
  const file = e.dataTransfer.files[0];
  if (file && (file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) loadFileAuto(file);
});

// _loupe and throttledRender are imported from ./utils/loupe.js

