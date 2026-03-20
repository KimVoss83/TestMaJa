# Design: Release Notes & Bug Report

**Datum:** 2026-03-20
**Projekt:** TestMaJa – Gartenplaner (index-1.html)

---

## Überblick

Zwei neue Features in der bestehenden Single-HTML-App:

1. **"Neu"-Button** mit Hinweispunkt — zeigt dem Nutzer geclusterte Release Notes direkt in der App
2. **Bug-Button** — ermöglicht einfaches Melden von Problemen per E-Mail mit automatisch gesammelten Systeminfos

---

## 1. Release Notes Mechanismus

### GitHub Action

Pfad: `.github/workflows/release-notes.yml`

- Trigger: `push` auf `main`, außer Commits die `[skip ci]` im Message enthalten (via `if: "!contains(github.event.head_commit.message, '[skip ci]')"`)
- `fetch-depth: 0` (vollständige History nötig für korrekte Commit-Range)
- Commit-Range: `${{ github.event.before }}..HEAD`, übergeben als Env-Variable `BEFORE_SHA` an das Python-Skript
- Permissions: `contents: write` explizit gesetzt

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
          git diff --quiet || (git commit -am "chore: update release notes [skip ci]" && git push)
```

### Python-Skript

Pfad: `.github/scripts/inject_release_notes.py`

**Inputs:**
- Env-Variable `BEFORE_SHA` (aus GitHub Action)
- Datei `index-1.html` (lesen + schreiben)

**Commit-Range:**
```python
import subprocess, os
before = os.environ.get("BEFORE_SHA", "")
# Erster Push: BEFORE_SHA ist "0000000..." → alle Commits bis HEAD
if not before or before.startswith("0000000"):
    result = subprocess.run(["git", "log", "--format=%s", "HEAD"], ...)
else:
    result = subprocess.run(["git", "log", "--format=%s", f"{before}..HEAD"], ...)
```

**Keyword-Matching** (case-insensitiv, `re.search` auf gesamte Message):

| Kategorie | Schlüsselwörter |
|---|---|
| Neu | `add`, `neu`, `hinzugefügt`, `erstellt`, `feature` |
| Behoben | `fix`, `bug`, `fehler`, `behoben`, `korrigiert` |
| Geändert | alles andere |

Übersprungen werden: leere Messages, Merge-Commit-Prefixes (`^Merge `), `[skip ci]`.

**Leere Ergebnisliste:** Wenn nach dem Filtern keine Einträge übrig bleiben, beendet das Skript sich ohne Änderung (`sys.exit(0)`). Kein Commit, kein Hinweispunkt.

**JSON-Injektion:**
- Sucht den Platzhalter-Kommentar via Regex: `<!-- RELEASE_NOTES_DATA:.*? -->`
- Ersetzt ihn durch: `<!-- RELEASE_NOTES_DATA:<json> -->`
- Wenn kein Platzhalter vorhanden: Skript gibt Fehler aus und bricht ab (Platzhalter muss initial gesetzt sein)
- JSON-Struktur:
```json
{
  "version": "2026-03-20",
  "entries": [
    {"cat": "Geändert", "msg": "Canvas-Hintergrundfarbe auf Mintgrün geändert"},
    {"cat": "Behoben",  "msg": "Bilddarstellung nach Laden korrigiert"}
  ]
}
```

**Initialer Platzhalter** (muss einmalig manuell in `index-1.html` gesetzt werden, direkt vor `</body>`):
```html
<!-- RELEASE_NOTES_DATA:{} -->
```

---

## 2. App-seitige Logik

### Daten lesen

Beim App-Start wird der Kommentar-Knoten via `TreeWalker` gelesen (nicht via `innerHTML`-Regex, da Safari/iOS Kommentare aus `innerHTML` filtern kann):

```javascript
const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
let releaseData = null;
while (walker.nextNode()) {
  const val = walker.currentNode.nodeValue.trim();
  if (val.startsWith('RELEASE_NOTES_DATA:')) {
    try { releaseData = JSON.parse(val.slice('RELEASE_NOTES_DATA:'.length)); } catch {}
    break;
  }
}
```

### Hinweispunkt

- `localStorage`-Key: `gp_last_seen_version` (konsistent mit bestehenden Keys wie `gp_ob_seen`)
- Beim Start: wenn `releaseData.version !== localStorage.getItem('gp_last_seen_version')` → Punkt einblenden
- Nach Öffnen des Panels: `localStorage.setItem('gp_last_seen_version', releaseData.version)`

---

## 3. UI

### Platzierung

Beide Buttons ganz rechts im `#header`, im Stil der bestehenden Buttons:
- Gleiche Schriftgröße, Höhe, border-radius
- Schwarz/weiß, kein Farb-Akzent im Ruhezustand

### "Neu"-Button

- Label: Text `Neu`
- Roter 6px-Kreis (`position: absolute`, `top: 2px`, `right: 2px`) nur sichtbar wenn neue Version
- Klick öffnet ein Popover analog zu `#help-popover` (`position: absolute; top: 52px; right: 10px`)
- Öffnen des "Neu"-Popovers schließt `#help-popover` (und umgekehrt) um Überlappung zu vermeiden
- Inhalt: Datum + gruppierte Einträge nach Kategorie (Neu / Behoben / Geändert), neueste Einträge oben

### Bug-Button

- Label: Text `Bug` (kein Unicode-Symbol, vermeidet Emoji-Rendering auf iOS)
- Klick öffnet Modal via bestehendem `createModal()`-Helper mit:
  - Freitextfeld: `<textarea placeholder="Problem beschreiben...">`
  - "Senden"-Button → baut `mailto:`-Link und öffnet ihn via `window.location.href`

**mailto-Aufbau:**
- **An:** `rumpelt-grauen.07@icloud.com`
- **Betreff:** `[Bug] Planer – YYYY-MM-DD`
- **Body:**
  ```
  Problem:
  <Freitext des Nutzers>

  --- Systeminfo ---
  Browser: <navigator.userAgent>
  Bildschirm: <screen.width>x<screen.height>
  App-Version: <releaseData.version>
  ```

---

## 4. Nicht im Scope

- Keine Versionsnummern (SemVer) — Datum reicht
- Kein separater Changelog-File
- Keine externe API / kein Backend
- Keine Push-Notifications
- Kein Anhang / Screenshot im Bug-Report
