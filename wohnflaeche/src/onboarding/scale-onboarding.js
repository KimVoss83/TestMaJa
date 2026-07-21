import { state } from '../state.js';
import { scaleFromPrintScale } from '../woflv/calc.js';
import { updateRefStatus } from '../tools/ref.js';
import { setTool } from '../tools/tool-manager.js';

export function showScaleOnboarding() {
  document.getElementById('onboarding-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.4);
    backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
    display:flex;align-items:center;justify-content:center;z-index:2000;`;
  const isPdf = !!state.pdfPage;
  const card = document.createElement('div');
  card.style.cssText = `background:#fff;border-radius:20px;padding:28px 26px 22px;width:390px;
    max-width:95vw;box-shadow:0 40px 100px rgba(0,0,0,0.22);font-family:-apple-system,sans-serif;`;
  card.innerHTML = `
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:18px;font-weight:700;color:#1d1d1f;">Maßstab festlegen</div>
      <div style="font-size:12px;color:#636366;margin-top:4px;">
        ${isPdf ? 'Aufgedruckten Maßstab wählen oder Referenzlinie zeichnen.'
                : 'Referenzlinie über eine bekannte Strecke zeichnen (z.B. Bemaßung im Plan).'}</div>
    </div>
    ${isPdf ? `
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <button id="ob-scale-50"  class="ob-scale-btn" style="flex:1;">1:50</button>
        <button id="ob-scale-75"  class="ob-scale-btn" style="flex:1;">1:75</button>
        <button id="ob-scale-100" class="ob-scale-btn" style="flex:1;">1:100</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <input type="number" id="ob-scale-free" placeholder="frei: X für 1:X" min="1"
               style="flex:2;padding:9px;border:1px solid #d1d5db;border-radius:10px;" />
        <button id="ob-scale-apply" style="flex:1;">OK</button>
      </div>
      <div style="font-size:11px;color:#8e8e93;margin-bottom:12px;">Hinweis: Exposé-PDFs sind oft
        skaliert gedruckt — Referenzlinie über eine Bemaßungskette ist die sichere Kontrolle.</div>` : ''}
    <button id="ob-draw-ref" style="width:100%;padding:13px;border:none;border-radius:12px;
      background:#8B3DFF;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">
      Referenzlinie zeichnen →</button>
    <div style="text-align:center;margin-top:6px;">
      <button id="ob-skip" style="background:none;border:none;color:#8e8e93;font-size:12px;
        cursor:pointer;padding:4px;">Ohne Maßstab (Pixel)</button></div>`;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  // Button-Grundstil
  card.querySelectorAll('.ob-scale-btn, #ob-scale-apply').forEach(b => b.style.cssText +=
    ';padding:10px;border:1.5px solid rgba(0,0,0,0.15);border-radius:10px;background:transparent;cursor:pointer;font-weight:600;');

  const close = () => overlay.remove();
  const applyPrintScale = x => {
    if (!(x >= 1) || !state.pdfPage) return;
    state.scale = scaleFromPrintScale(x, state.pdfPage.widthPt, state.pdfPage.renderedWidthPx);
    state.printScale = x;
    state.scaleSource = 'pdf';
    updateRefStatus(); close(); setTool('select');
  };
  if (isPdf) {
    [50, 75, 100].forEach(x =>
      card.querySelector(`#ob-scale-${x}`).onclick = () => applyPrintScale(x));
    card.querySelector('#ob-scale-apply').onclick = () =>
      applyPrintScale(parseFloat(card.querySelector('#ob-scale-free').value));
  }
  card.querySelector('#ob-draw-ref').onclick = () => { close(); setTool('ref'); };
  card.querySelector('#ob-skip').onclick = () => { close(); setTool('select'); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}
