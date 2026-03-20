# Release Notes & Bug Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatisch geclusterte Release Notes bei jedem Push in die App injizieren und einen minimalistischen "Neu"- sowie "Bug"-Button in die Toolbar einfügen.

**Architecture:** Eine GitHub Action liest Commits seit dem letzten Push, clustert sie und injiziert ein JSON-Objekt als HTML-Kommentar in `index-1.html`. Die App liest den Kommentar via TreeWalker beim Start, zeigt einen roten Punkt wenn es Neues gibt, und bietet einen Bug-Button der per `mailto:` eine vorausgefüllte E-Mail öffnet.

**Tech Stack:** GitHub Actions, Python 3 (stdlib only), Vanilla JS, Single HTML file (Fabric.js app)

---

## File Structure

| Datei | Aktion | Zweck |
|---|---|---|
| `index-1.html` | Modify | CSS, HTML-Buttons, Popover, JS-Logik, initialer Platzhalter |
| `.github/workflows/release-notes.yml` | Create | GitHub Action: trigger, checkout, script, commit |
| `.github/scripts/inject_release_notes.py` | Create | Commits lesen, clustern, JSON in HTML injizieren |

---

## Task 1: Initialen Platzhalter in index-1.html einfügen

**Files:**
- Modify: `index-1.html` — direkt vor `</body>`

- [ ] **Schritt 1: Platzhalter einfügen**

Suche in `index-1.html` die letzte Zeile `</body>` (Zeile ~6936) und füge direkt davor ein:

```html
<!-- RELEASE_NOTES_DATA:{} -->
</body>
```

- [ ] **Schritt 2: Visuell prüfen**

Öffne `index-1.html` im Browser. Verhalten: App lädt normal, keine Fehlermeldung in der Konsole.

- [ ] **Schritt 3: Commit**

```bash
git add index-1.html
git commit -m "feat: add release notes data placeholder"
```

---

## Task 2: GitHub Action Workflow erstellen

**Files:**
- Create: `.github/workflows/release-notes.yml`

- [ ] **Schritt 1: Workflow-Datei anlegen**

Inhalt von `.github/workflows/release-notes.yml`:

```yaml
name: Update Release Notes
on:
  push:
    branches: [main]

jobs:
  update:
    if: "!contains(github.event.head_commit.message, '[skip ci]')"
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Generate and inject release notes
        env:
          BEFORE_SHA: ${{ github.event.before }}
        run: python3 .github/scripts/inject_release_notes.py
      - name: Commit if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git diff --quiet || (git commit -am "chore: update release notes [skip ci]" && git pull --rebase && git push)
```

- [ ] **Schritt 2: Commit**

```bash
git add .github/workflows/release-notes.yml
git commit -m "ci: add release notes workflow"
```

---

## Task 3: Python-Injektionsskript erstellen

**Files:**
- Create: `.github/scripts/inject_release_notes.py`

- [ ] **Schritt 1: Skript anlegen**

Inhalt von `.github/scripts/inject_release_notes.py`:

```python
#!/usr/bin/env python3
import subprocess, os, re, json, sys
from datetime import date

# JSON wird ohne Zeilenumbrüche serialisiert (json.dumps mit separators), daher kein re.DOTALL nötig
PLACEHOLDER_RE = re.compile(r'<!-- RELEASE_NOTES_DATA:.*? -->')

NEW_KEYWORDS     = ['add', 'neu', 'hinzugefügt', 'erstellt', 'feature']
FIXED_KEYWORDS   = ['fix', 'bug', 'fehler', 'behoben', 'korrigiert']

def classify(msg):
    m = msg.lower()
    if any(re.search(kw, m) for kw in FIXED_KEYWORDS):
        return 'Behoben'
    if any(re.search(kw, m) for kw in NEW_KEYWORDS):
        return 'Neu'
    return 'Geändert'

def get_commits():
    before = os.environ.get('BEFORE_SHA', '')
    if not before or before.startswith('0000000'):
        cmd = ['git', 'log', '--format=%s', 'HEAD']
    else:
        cmd = ['git', 'log', '--format=%s', f'{before}..HEAD']
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.strip().splitlines()

def main():
    html_path = 'index-1.html'
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    if not PLACEHOLDER_RE.search(html):
        print('ERROR: RELEASE_NOTES_DATA placeholder not found in index-1.html')
        sys.exit(1)

    commits = get_commits()
    entries = []
    for msg in commits:
        msg = msg.strip()
        if not msg:
            continue
        # Filtert sowohl manuelle Merge-Commits als auch GitHub PR-Merges ("Merge pull request #N from ...")
        if msg.startswith('Merge '):
            continue
        if '[skip ci]' in msg:
            continue
        entries.append({'cat': classify(msg), 'msg': msg})

    if not entries:
        print('No relevant commits — skipping.')
        sys.exit(0)

    data = {
        'version': date.today().isoformat(),
        'entries': entries
    }
    json_str = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
    new_comment = f'<!-- RELEASE_NOTES_DATA:{json_str} -->'
    new_html = PLACEHOLDER_RE.sub(new_comment, html)

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_html)

    print(f'Injected {len(entries)} entries.')

if __name__ == '__main__':
    main()
```

- [ ] **Schritt 2: Lokal testen (optional, braucht git-Repo)**

```bash
cd /tmp/TestMaJa
BEFORE_SHA=$(git rev-parse HEAD~2) python3 .github/scripts/inject_release_notes.py
```

Erwartetes Ergebnis: `Injected N entries.`
Prüfen: In `index-1.html` ist `<!-- RELEASE_NOTES_DATA:{"version":...` sichtbar.

**Wichtig:** Danach unbedingt rückgängig machen — sonst wird der befüllte Platzhalter versehentlich committed:
```bash
git diff index-1.html   # prüfen ob Platzhalter befüllt wurde
git checkout index-1.html
```

- [ ] **Schritt 3: Commit**

```bash
git add .github/scripts/inject_release_notes.py
git commit -m "ci: add release notes injection script"
```

---

## Task 4: CSS für neue Buttons und Popover

**Files:**
- Modify: `index-1.html` — im `<style>`-Block, nach dem `#help-popover`-Block (Zeile ~882)

- [ ] **Schritt 1: CSS einfügen**

Füge nach dem Block `#help-popover hr { ... }` (Zeile ~882) folgendes CSS ein:

```css
/* ── Whats-New Popover ── */
#whats-new-popover {
  position: fixed;
  top: 52px; right: 10px;
  width: 260px;
  background: rgba(255,255,255,0.98);
  border-radius: 12px;
  padding: 14px 15px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06);
  z-index: 600;
  font-size: 11.5px;
  line-height: 1.6;
  display: none;
}
#whats-new-popover.open { display: block; }
#whats-new-popover h3 { font-size: 12px; font-weight: 700; color: #1d1d1f; margin: 0 0 8px 0; }
#whats-new-popover .rn-category { font-size: 10px; font-weight: 700; color: #9ca3af;
  text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 3px 0; }
#whats-new-popover .rn-entry { color: #3c3c43; padding: 1px 0; }

/* ── Neu-Button Badge ── */
.btn-with-badge { position: relative; }
.btn-badge {
  position: absolute; top: 2px; right: 2px;
  width: 6px; height: 6px;
  background: #ff3b30;
  border-radius: 50%;
  display: none;
}
.btn-badge.visible { display: block; }
```

- [ ] **Schritt 2: Visuell prüfen**

Öffne `index-1.html` im Browser. Seite muss normal laden, kein CSS-Fehler in der Konsole.

- [ ] **Schritt 3: Commit**

```bash
git add index-1.html
git commit -m "feat: add CSS for whats-new popover and badge"
```

---

## Task 5: HTML — Buttons und Popover einfügen

**Files:**
- Modify: `index-1.html` — Toolbar (Zeile ~1050) und nach `#help-popover` (Zeile ~1340)

- [ ] **Schritt 1: Buttons in Toolbar einfügen**

Suche den tool-group Block mit `btn-help` (Zeile ~1050):

```html
    <div class="tool-group" style="border-right:none;padding-right:4px;">
      <button id="btn-help" title="Tastenkürzel & Hilfe" style="font-size:14px;padding:4px 9px;">?</button>
    </div>
```

Ersetze ihn durch:

```html
    <div class="tool-group" style="border-right:none;padding-right:4px;gap:4px;">
      <button id="btn-bug" title="Fehler melden" style="font-size:12px;padding:4px 9px;">Bug</button>
      <span class="btn-with-badge">
        <button id="btn-whats-new" title="Was ist neu?" style="font-size:12px;padding:4px 9px;">Neu</button>
        <span class="btn-badge" id="whats-new-badge"></span>
      </span>
      <button id="btn-help" title="Tastenkürzel & Hilfe" style="font-size:14px;padding:4px 9px;">?</button>
    </div>
```

- [ ] **Schritt 2: Whats-New Popover HTML einfügen**

Suche den Kommentar `<!-- Help Popover -->` (Zeile ~1306) und füge direkt davor ein:

```html
<!-- Whats-New Popover -->
<div id="whats-new-popover">
  <h3>Was ist neu?</h3>
  <div id="whats-new-content"></div>
</div>
```

- [ ] **Schritt 3: Visuell prüfen**

Öffne im Browser. Beide neuen Buttons `Neu` und `Bug` müssen in der Toolbar sichtbar sein, rechts neben `?`. Kein Layout-Bruch.

- [ ] **Schritt 4: Commit**

```bash
git add index-1.html
git commit -m "feat: add Neu and Bug buttons to toolbar"
```

---

## Task 6: JavaScript — Release Notes lesen und Badge zeigen

**Files:**
- Modify: `index-1.html` — JS-Abschnitt, nach dem Help-Button-Block (Zeile ~6765)

- [ ] **Schritt 1: Release-Notes-Logik einfügen**

Füge nach dem Block `// Help-Button` (nach Zeile ~6765) folgenden Code ein:

```javascript
// =========================================================
// RELEASE NOTES & BUG REPORT
// =========================================================

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
    document.getElementById('whats-new-badge').classList.add('visible');
  }
})();
```

- [ ] **Schritt 2: Manuell testen**

Öffne `index-1.html` im Browser. Öffne die Konsole und prüfe:
```javascript
// Eingabe in Browser-Konsole:
releaseData
```
Erwartetes Ergebnis: `null` (Platzhalter ist noch leer `{}`). Kein JS-Fehler.

Setze manuell einen Testwert im Kommentar (direkt vor `</body>`):
```html
<!-- RELEASE_NOTES_DATA:{"version":"2026-03-20","entries":[{"cat":"Geändert","msg":"Test"}]} -->
```
Lade neu. `releaseData` in der Konsole zeigt nun das Objekt. Badge-Punkt muss sichtbar sein (roter 6px-Kreis am Neu-Button).

Danach Platzhalter wieder auf `<!-- RELEASE_NOTES_DATA:{} -->` zurücksetzen.

- [ ] **Schritt 3: Commit**

```bash
git add index-1.html
git commit -m "feat: read release notes from HTML comment and show badge"
```

---

## Task 7: JavaScript — "Neu"-Popover Interaktion

**Files:**
- Modify: `index-1.html` — direkt nach dem Code aus Task 6

- [ ] **Schritt 1: Popover-Logik einfügen**

Füge direkt nach dem Code aus Task 6 ein:

```javascript
// Schritt 3: "Neu"-Popover befüllen und öffnen
function renderWhatsNew() {
  if (!releaseData?.entries?.length) {
    document.getElementById('whats-new-content').innerHTML =
      '<div style="color:#9ca3af;font-size:11px;">Keine Einträge vorhanden.</div>';
    return;
  }
  const cats = ['Neu', 'Behoben', 'Geändert'];
  let html = `<div style="font-size:10px;color:#9ca3af;margin-bottom:8px;">${releaseData.version}</div>`;
  for (const cat of cats) {
    const items = releaseData.entries.filter(e => e.cat === cat);
    if (!items.length) continue;
    html += `<div class="rn-category">${cat}</div>`;
    items.forEach(e => { html += `<div class="rn-entry">· ${e.msg}</div>`; });
  }
  document.getElementById('whats-new-content').innerHTML = html;
}

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
      document.getElementById('whats-new-badge').classList.remove('visible');
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
// Der ursprüngliche Handler (Zeile ~6757) bleibt unverändert und kümmert sich um help-popover.
// Zwei unabhängige Listener auf demselben Button sind hier korrekt und gewollt —
// jeder Handler hat eine einzige, klar abgegrenzte Aufgabe.
document.getElementById('btn-help').addEventListener('click', () => {
  document.getElementById('whats-new-popover').classList.remove('open');
});
```

- [ ] **Schritt 2: Manuell testen**

Setze in `index-1.html` temporär einen Testwert:
```html
<!-- RELEASE_NOTES_DATA:{"version":"2026-03-20","entries":[{"cat":"Geändert","msg":"Canvas auf Mintgrün"},{"cat":"Behoben","msg":"Bilddarstellung korrigiert"}]} -->
```
Öffne im Browser und prüfe (Häkchen mental abhaken):
- Klick auf "Neu" öffnet Popover mit Datum + gruppierten Einträgen
- Klick auf "?" schließt "Neu"-Popover
- Klick außerhalb schließt Popover
- Nach Öffnen: Badge-Punkt verschwindet
- Nach Seite neu laden: Badge nicht mehr sichtbar (localStorage gesetzt)
- Klick auf "Neu" schließt Popover wenn es offen ist (Toggle)

Platzhalter danach wieder zurücksetzen: `<!-- RELEASE_NOTES_DATA:{} -->`

- [ ] **Schritt 3: Commit**

```bash
git add index-1.html
git commit -m "feat: implement whats-new popover with badge logic"
```

---

## Task 8a: createModal um optionalen okLabel erweitern

**Files:**
- Modify: `index-1.html` — Funktion `createModal` (Zeile ~5874)

Der Bug-Modal-Button soll "Senden" statt "OK" zeigen. `createModal` akzeptiert aktuell keinen Label-Parameter.

- [ ] **Schritt 1: createModal-Signatur erweitern**

Suche die Funktion `createModal` (Zeile ~5874):

```javascript
function createModal(title, bodyHTML, onConfirm, onCancel) {
```

Ersetze sie durch:

```javascript
function createModal(title, bodyHTML, onConfirm, onCancel, okLabel = 'OK') {
```

Und direkt darunter die Zeile mit `modal-ok`:

```javascript
      <button id="modal-ok" style="background:#4ecca3;color:#1a1a2e;border-color:#4ecca3;font-weight:600">OK</button>
```

ersetzen durch:

```javascript
      <button id="modal-ok" style="background:#4ecca3;color:#1a1a2e;border-color:#4ecca3;font-weight:600">${okLabel}</button>
```

- [ ] **Schritt 2: Prüfen dass bestehende Modals unverändert funktionieren**

Öffne im Browser, klicke auf "Beschriftung" oder "Referenzmaß" — Modal öffnet wie bisher mit "OK"-Button.

- [ ] **Schritt 3: Commit**

```bash
git add index-1.html
git commit -m "feat: add optional okLabel parameter to createModal"
```

---

## Task 8: JavaScript — Bug-Button und mailto

**Files:**
- Modify: `index-1.html` — direkt nach dem Code aus Task 7

- [ ] **Schritt 1: Bug-Button-Logik einfügen**

Füge direkt nach dem Code aus Task 7 ein:

```javascript
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
      `Problem:\n${text || '(kein Text eingegeben)'}\n\n--- Systeminfo ---\nBrowser: ${navigator.userAgent}\nBildschirm: ${screen.width}x${screen.height}\nApp-Version: ${version}`
    );
    window.location.href = `mailto:rumpelt-grauen.07@icloud.com?subject=${subject}&body=${body}`;
  }, undefined, 'Senden');
});
```

- [ ] **Schritt 2: Manuell testen**

Öffne im Browser:
- [ ] Klick auf "Bug" öffnet Modal mit Textarea und "Abbrechen"/"OK"-Buttons
- [ ] Text eingeben, OK klicken → E-Mail-App öffnet sich mit vorausgefülltem Betreff `[Bug] Planer – 2026-03-20`, Empfänger `rumpelt-grauen.07@icloud.com`, und Systeminfo im Body
- [ ] "Abbrechen" schließt Modal ohne E-Mail zu öffnen
- [ ] Ohne Text eingegeben: Body enthält `(kein Text eingegeben)`

- [ ] **Schritt 3: Commit**

```bash
git add index-1.html
git commit -m "feat: add bug report button with mailto"
```

---

## Task 9: End-to-End — GitHub Action testen

**Files:** keine Änderungen, nur Push und Beobachtung

- [ ] **Schritt 1: Alle Commits pushen (falls noch nicht geschehen)**

```bash
git push
```

- [ ] **Schritt 2: Action beobachten**

Öffne auf GitHub: Repository → Actions → "Update Release Notes"
Erwartetes Ergebnis: Action läuft durch, grünes Häkchen.

- [ ] **Schritt 3: Ergebnis prüfen**

Nach Abschluss der Action:
```bash
git pull
```
In `index-1.html` direkt vor `</body>` prüfen — der Platzhalter muss jetzt gefüllt sein:
```
<!-- RELEASE_NOTES_DATA:{"version":"2026-03-20","entries":[...]} -->
```

- [ ] **Schritt 4: App im Browser testen**

Öffne die aktualisierte `index-1.html`:
- [ ] Roter Punkt am "Neu"-Button sichtbar
- [ ] Klick auf "Neu" zeigt echte Commits, gruppiert nach Kategorie
- [ ] Nach Schließen: Punkt weg, bleibt weg nach Reload

---

## Hinweise für den Implementierer

- Das Projekt ist eine **einzelne HTML-Datei** ohne Build-System oder Package-Manager. Alle Änderungen erfolgen direkt in `index-1.html`.
- Es gibt kein automatisiertes Test-Framework. Tests sind manuelle Browser-Tests mit Konsole.
- Der initiale Platzhalter `<!-- RELEASE_NOTES_DATA:{} -->` muss in `index-1.html` vorhanden sein **bevor** die Action zum ersten Mal läuft.
- Wenn die Action fehlschlägt: zuerst unter Actions → Logs schauen ob der Platzhalter gefunden wurde.
- Die `git commit -am` Zeile im Workflow staged alle getrackten geänderten Dateien — das ist für dieses Single-File-Projekt ausreichend.
