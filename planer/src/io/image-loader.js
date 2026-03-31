import { state } from '../state.js';
import { canvas, wrapper } from '../canvas.js';
import { showToast, createModal } from '../ui/modals.js';
import { lookupSensor, calcGSD } from './photogrammetry.js';
import { updateRefStatus } from '../tools/ref.js';
import { updateMeasureButtons } from '../tools/tool-manager.js';
import { updateMeasurementList } from '../ui/sidebar.js';
import { showTutorial } from '../onboarding/tutorial.js';
import { showRefOnboarding } from '../onboarding/ref-onboarding.js';

// Absoluter Fehler in cm für eine Einzelmessung (Distanz in m).
export async function readAndApplyExif(file, imgWidthPx) {
  const panel = document.getElementById('meta-panel');
  const content = document.getElementById('meta-content');

  const noData = { autoScale: false, missing: ['Flughöhe','Brennweite','Sensorgröße'], partial: {} };

  if (!window.exifr) { panel.style.display = 'none'; return noData; }

  let raw, rawSep;
  try {
    // mergeOutput: true  → alle EXIF/GPS/TIFF-Tags flach zugänglich
    raw    = await exifr.parse(file, { xmp: true, gps: true, tiff: true, exif: true, mergeOutput: true });
    // mergeOutput: false → XMP-Segment separat, verhindert Kollision mit GPS-Tags
    rawSep = await exifr.parse(file, { xmp: true, mergeOutput: false });
  } catch (e) { panel.style.display = 'none'; return noData; }
  if (!raw) { panel.style.display = 'none'; return noData; }

  // ── 1. Kamera ──────────────────────────────────────────
  const make  = raw.Make  || raw.make  || '';
  const model = raw.Model || raw.model || '';
  const camera = [make, model].filter(Boolean).join(' ') || null;

  // ── 2. Brennweite ──────────────────────────────────────
  const focalLength   = raw.FocalLength || null;        // mm
  const focal35mm     = raw.FocalLengthIn35mmFilm || null;

  // ── 3. Flughöhe ────────────────────────────────────────
  // NUR XMP RelativeAltitude (Höhe über Abflugpunkt / AGL) verwenden.
  // GPSAltitude ist Höhe über Meeresspiegel (MSL) – völlig ungeeignet für GSD.
  // DJI speichert im XMP-Namespace "drone-dji:" als RelativeAltitude.
  // Separate Parsung (rawSep.xmp) ist zuverlässiger als mergeOutput,
  // weil mergeOutput GPS- und XMP-Tags kollidieren lassen kann.
  const xmp = rawSep?.xmp ?? {};
  const relAltRaw =
    xmp.RelativeAltitude ??
    xmp['drone-dji:RelativeAltitude'] ??
    raw.RelativeAltitude ??
    raw['drone-dji:RelativeAltitude'] ??
    raw['drone-djiRelativeAltitude'] ??
    raw.relative_altitude ??
    null;
  const altitude  = relAltRaw != null && !isNaN(parseFloat(relAltRaw))
    ? Math.abs(parseFloat(relAltRaw))
    : null;
  const altSource = altitude != null ? 'relativ (XMP)' : null;

  // ── 4. Gimbal / Neigung ────────────────────────────────
  const gimbalPitchRaw =
    xmp.GimbalPitch ?? xmp['drone-dji:GimbalPitch'] ??
    raw.GimbalPitch ?? raw['drone-dji:GimbalPitch'] ??
    raw.FlightPitch ?? raw.gimbal_pitch ?? null;
  const gimbalPitch  = gimbalPitchRaw != null ? parseFloat(gimbalPitchRaw) : null;
  // DJI: -90 = Nadir (gerade runter), 0 = horizontal
  const tiltFromNadir = gimbalPitch != null ? Math.abs(gimbalPitch + 90) : null; // Grad von Nadir

  // ── 5. Sensorgröße ─────────────────────────────────────
  let sensorEntry = lookupSensor(make, model);
  let sensorWidth = sensorEntry?.w ?? null;
  let sensorName  = sensorEntry?.name ?? camera;

  // Fallback: aus 35mm-Äquivalent ableiten (cropfaktor → Sensorbreite)
  if (!sensorWidth && focal35mm && focalLength && focal35mm > 0 && focalLength > 0) {
    const crop = focal35mm / focalLength;
    sensorWidth = 36 / crop;   // 36mm = Kleinbild-Sensorbreite
  }

  // ── 6. GSD + Neigungskorrektur ─────────────────────────
  let gsd        = null;
  let corrFactor = 1.0;
  let autoScale  = false;
  let warnings   = [];
  let missing    = [];
  const partial  = { altitude, focalLength, sensorWidth, tiltFromNadir };

  if (altitude && focalLength && sensorWidth && imgWidthPx) {
    gsd = calcGSD(altitude, focalLength, sensorWidth, imgWidthPx);

    if (tiltFromNadir != null && tiltFromNadir > 1.0) {
      const tiltRad = tiltFromNadir * Math.PI / 180;
      corrFactor = 1 / Math.cos(tiltRad);
      gsd *= corrFactor;

      if (tiltFromNadir > 30) {
        warnings.push(`Starke Neigung (${tiltFromNadir.toFixed(1)}°) – Messungen am Bildrand können erheblich abweichen. Referenzlinie empfohlen.`);
      } else if (tiltFromNadir > 5) {
        warnings.push(`Neigung ${tiltFromNadir.toFixed(1)}° korrigiert (Faktor ×${corrFactor.toFixed(3)}).`);
      }
    }

    state.scale = 1 / gsd;
    state.scaleSource = 'exif';
    state.exifAltitude = altitude;
    state.flightCam = sensorEntry?.f ? { sW: sensorEntry.w, f: sensorEntry.f, imgW: sensorEntry.imgW, name: sensorEntry.name } : null;
    autoScale = true;
    updateRefStatus();
    updateMeasureButtons();
  } else {
    if (!altitude)    missing.push('Flughöhe');
    if (!focalLength) missing.push('Brennweite');
    if (!sensorWidth) missing.push('Sensorgröße');
    if (missing.length) warnings.push(`Maßstab konnte nicht automatisch berechnet werden (fehlend: ${missing.join(', ')}).`);
  }

  // ── 7. Metadaten-Panel befüllen ────────────────────────
  const rows = [
    camera     ? ['Kamera',    camera]                          : null,
    focalLength ? ['Brennweite', `${focalLength} mm`]           : null,
    sensorWidth ? ['Sensor',    `${sensorWidth} × ${(sensorEntry?.h ?? '?')} mm`] : null,
    altitude    ? ['Flughöhe',  `${altitude.toFixed(1)} m (${altSource})`]       : null,
    tiltFromNadir != null ? ['Neigung', tiltFromNadir < 1 ? 'Nadir OK' : `${tiltFromNadir.toFixed(1)}° (${corrFactor.toFixed(3)}×)`] : null,
    gsd         ? ['GSD',       `${(gsd * 100).toFixed(3)} cm/px`]               : null,
  ].filter(Boolean);

  let html = rows.map(([k,v]) =>
    `<div class="meta-row"><span class="meta-key">${k}</span><span class="meta-val">${v}</span></div>`
  ).join('');

  if (autoScale) {
    html += `<div class="meta-ok">Maßstab automatisch aus Bilddaten berechnet. Zur Überprüfung kann zusätzlich eine Referenzlinie gezeichnet werden.</div>`;
  }
  warnings.forEach(w => { html += `<div class="meta-warn">${w}</div>`; });

  content.innerHTML = html;
  panel.style.display = '';

  return { gsd, altitude, focalLength, sensorWidth, tiltFromNadir, corrFactor, autoScale, camera, missing, partial };
}

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

export function loadImageFromDataUrl(dataUrl, sourceFile) {
  fabric.Image.fromURL(dataUrl, async img => {
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

      const exifResult = sourceFile ? await readAndApplyExif(sourceFile, img.width) : null;
      showRefOnboarding(exifResult);
  });
}

export async function loadImage(file) {
  const dataUrl = await normalizeOrientation(file);
  loadImageFromDataUrl(dataUrl, file);
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
      loadImageFromDataUrl(dataUrl, null);
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
        loadImageFromDataUrl(dataUrl, null);
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
document.getElementById('btn-how-it-works').addEventListener('click', () => showTutorial());
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

