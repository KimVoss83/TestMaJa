// =========================================================
// RELEASE NOTES & BUG REPORT
// =========================================================
import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { createModal } from './modals.js';

// Schritt 1: Daten aus HTML-Kommentar lesen (TreeWalker, Safari-sicher)
let releaseData = null;
(function () {
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) {
    const val = walker.currentNode.nodeValue.trim();
    if (val.startsWith('RELEASE_NOTES_DATA:')) {
      try { releaseData = JSON.parse(val.slice('RELEASE_NOTES_DATA:'.length)); } catch {}
      break;
    }
  }
})();

// Schritt 2: Badge zeigen wenn neue Version
(function () {
  if (!releaseData?.version) return;
  const lastSeen = localStorage.getItem('gp_last_seen_version');
  if (releaseData.version !== lastSeen) {
    document.getElementById('whats-new-badge')?.classList.add('visible');
  }
})();

// Schritt 3: "Neu"-Popover befüllen und öffnen
function _escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
export function renderWhatsNew() {
  if (!releaseData?.entries?.length) {
    document.getElementById('whats-new-content').innerHTML =
      '<div style="color:#9ca3af;font-size:11px;">Keine Einträge vorhanden.</div>';
    return;
  }
  const cats = ['Neu', 'Behoben', 'Geändert'];
  let html = `<div style="font-size:10px;color:#9ca3af;margin-bottom:8px;">${_escHtml(releaseData.version)}</div>`;
  for (const cat of cats) {
    const items = releaseData.entries.filter(e => e.cat === cat);
    if (!items.length) continue;
    html += `<div class="rn-category">${_escHtml(cat)}</div>`;
    items.forEach(e => { html += `<div class="rn-entry">· ${_escHtml(e.msg)}</div>`; });
  }
  document.getElementById('whats-new-content').innerHTML = html;
}

export function initWhatsNew() {
  document.getElementById('btn-whats-new').addEventListener('click', e => {
    e.stopPropagation();
    const pop = document.getElementById('whats-new-popover');
    const isOpening = !pop.classList.contains('open');
    // Andere Popovers schließen
    document.getElementById('help-popover').classList.remove('open');
    if (isOpening) {
      renderWhatsNew();
      pop.classList.add('open');
      // Badge entfernen und Version als gesehen markieren
      if (releaseData?.version) {
        localStorage.setItem('gp_last_seen_version', releaseData.version);
        document.getElementById('whats-new-badge')?.classList.remove('visible');
      }
    } else {
      pop.classList.remove('open');
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#whats-new-popover') && e.target.id !== 'btn-whats-new') {
      document.getElementById('whats-new-popover').classList.remove('open');
    }
  });

  // Zweiter Listener auf btn-help: schließt whats-new-popover wenn help geöffnet wird.
  // Der ursprüngliche Handler (Zeile ~6798) bleibt unverändert und kümmert sich um help-popover.
  // Zwei unabhängige Listener auf demselben Button sind hier korrekt und gewollt —
  // jeder Handler hat eine einzige, klar abgegrenzte Aufgabe.
  document.getElementById('btn-help').addEventListener('click', () => {
    document.getElementById('whats-new-popover').classList.remove('open');
  });

  // Bug-Report per mailto
  document.getElementById('btn-bug').addEventListener('click', () => {
    const bodyHTML = `
    <p style="font-size:12px;color:#6b7280;margin:0 0 8px 0;">
      Bitte beschreibe das Problem so genau wie möglich.
    </p>
    <textarea id="bug-text" rows="5"
      style="width:100%;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:8px;
             padding:8px;font-family:inherit;font-size:13px;resize:vertical;"
      placeholder="Problem beschreiben..."></textarea>`;

    createModal('Fehler melden', bodyHTML, () => {
      // onCancel: undefined (Modal schließt nur), okLabel: 'Senden'
      const text = document.getElementById('bug-text')?.value?.trim() || '';
      const version = releaseData?.version ?? 'unbekannt';
      const today = new Date().toISOString().slice(0, 10);
      const subject = encodeURIComponent(`[Bug] Planer – ${today}`);
      const body = encodeURIComponent(
        `Problem:\n${text || '(kein Text eingegeben)'}\n\n--- Systeminfo ---\nBrowser: ${navigator.userAgent}\nBildschirm: ${screen.width}x${screen.height}\nFenster: ${window.innerWidth}x${window.innerHeight}\nBild geladen: ${state.backgroundImage ? 'ja' : 'nein'}\nMaßstab gesetzt: ${state.scale ? 'ja (' + Math.round(state.scale * 100) / 100 + ' px/cm)' : 'nein'}\nCanvas: ${canvas.width}x${canvas.height}\nObjekte: ${canvas.getObjects().length}\nApp-Version: ${version}\nZeitstempel: ${new Date().toISOString()}`
      );
      window.location.href = `mailto:rumpelt-grauen.07@icloud.com?subject=${subject}&body=${body}`;
    }, undefined, 'Senden');
  });
}
