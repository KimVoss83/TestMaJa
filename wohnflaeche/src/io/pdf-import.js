import { state } from '../state.js';
import { createModal, showToast } from '../ui/modals.js';

export function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function renderPage(pdf, pageNo, targetWidthPx) {
  const page = await pdf.getPage(pageNo);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = targetWidthPx / vp1.width;
  const vp = page.getViewport({ scale });
  const cnv = document.createElement('canvas');
  cnv.width = Math.round(vp.width); cnv.height = Math.round(vp.height);
  await page.render({ canvasContext: cnv.getContext('2d'), viewport: vp }).promise;
  return { dataUrl: cnv.toDataURL('image/jpeg', 0.92),
           widthPt: vp1.width, heightPt: vp1.height, renderedWidthPx: cnv.width };
}

async function pickPage(pdf) {
  if (pdf.numPages === 1) return 1;
  // Thumbnails rendern und im Modal anbieten
  const thumbs = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 12); i++)
    thumbs.push(await renderPage(pdf, i, 120));
  return new Promise(resolve => {
    createModal('Seite wählen',
      `<div style="display:flex;flex-wrap:wrap;gap:8px;">` +
      thumbs.map((t, i) =>
        `<img src="${t.dataUrl}" data-page="${i + 1}" class="pdf-thumb"
              style="width:120px;border:2px solid #d1d5db;border-radius:6px;cursor:pointer;" />`).join('') +
      `</div>`,
      () => resolve(parseInt(document.querySelector('.pdf-thumb.sel')?.dataset.page || '1')),
      () => resolve(1));
    setTimeout(() => document.querySelectorAll('.pdf-thumb').forEach(el => {
      el.onclick = () => {
        document.querySelectorAll('.pdf-thumb').forEach(x => { x.classList.remove('sel'); x.style.borderColor = '#d1d5db'; });
        el.classList.add('sel'); el.style.borderColor = '#8B3DFF';
      };
    }), 50);
  });
}

export async function loadPdfFile(file) {
  const buf = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  } catch (e) {
    showToast('PDF konnte nicht gelesen werden (beschädigt oder geschützt).');
    throw e;
  }
  const pageNo = await pickPage(pdf);
  const r = await renderPage(pdf, pageNo, 2400);
  state.pdfPage = { widthPt: r.widthPt, heightPt: r.heightPt, renderedWidthPx: r.renderedWidthPx };
  return r;
}
