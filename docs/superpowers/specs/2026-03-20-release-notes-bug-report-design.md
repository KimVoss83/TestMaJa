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

- Trigger: `push` auf `main` (außer Commits mit `[skip ci]` im Message)
- Liest alle Commits seit dem letzten Push
- Überspringt: Merge-Commits, Commits mit `[skip ci]`
- Clustert Commit-Messages nach Kategorie (Keyword-Matching, deutsch + englisch):

| Kategorie | Schlüsselwörter |
|---|---|
| Neu | `add`, `neu`, `hinzugefügt`, `erstellt`, `feature` |
| Behoben | `fix`, `bug`, `fehler`, `behoben`, `korrigiert` |
| Geändert | alles andere |

- Schreibt Ergebnis als JSON in einen Platzhalter-Kommentar in `index-1.html`:

```html
<!-- RELEASE_NOTES_DATA:{"version":"2026-03-20","entries":[{"cat":"Geändert","msg":"Canvas-Hintergrundfarbe auf Mintgrün geändert"}]} -->
```

- Committet die geänderte `index-1.html` mit Message `chore: update release notes [skip ci]` zurück auf `main`

### App-seitige Logik

- Beim Start: Regex liest `RELEASE_NOTES_DATA`-Block aus `document.documentElement.innerHTML`
- Vergleicht `version` mit `localStorage.getItem('lastSeenVersion')`
- Neu → roter 6px-Punkt am Button sichtbar
- Nach Öffnen des Panels: `localStorage.setItem('lastSeenVersion', version)`

---

## 2. UI

### Platzierung

Beide Buttons ganz rechts im `#header`, im Stil der bestehenden Header-Buttons:
- Gleiche Schriftgröße, Höhe, border-radius
- Schwarz/weiß, kein Farb-Akzent im Ruhezustand

### "Neu"-Button

- Label: `Neu` (Text)
- Roter 6px-Kreis als `position: absolute` oben rechts, nur sichtbar wenn neue Version vorhanden
- Klick öffnet ein Popover (Stil wie bestehendes `#help-popover`) mit:
  - Datum der Version
  - Gruppierte Einträge nach Kategorie: Neu / Behoben / Geändert

### Bug-Button

- Label: `⚠` (Unicode, kein Emoji-Rendering) oder Text `Bug`
- Klick öffnet ein schlichtes Modal mit:
  - Freitextfeld: "Problem beschreiben"
  - "Senden"-Button → öffnet `mailto:` mit:
    - **An:** konfigurierbare Adresse (Konstante im HTML)
    - **Betreff:** `[Bug] Planer – YYYY-MM-DD`
    - **Body:** Freitext + Browser, Bildschirmgröße, App-Version (aus Release Notes)

---

## 3. GitHub Action Workflow-Datei

Pfad: `.github/workflows/release-notes.yml`

```yaml
name: Update Release Notes
on:
  push:
    branches: [main]
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - name: Generate and inject release notes
        run: python3 .github/scripts/inject_release_notes.py
      - name: Commit if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git diff --quiet || git commit -am "chore: update release notes [skip ci]"
          git push
```

Ein Python-Hilfsskript unter `.github/scripts/inject_release_notes.py` übernimmt das Clustering und die JSON-Injektion.

---

## 4. Nicht im Scope

- Keine Versionsnummern (SemVer) — Datum reicht
- Kein separater Changelog-File
- Keine externe API / kein Backend
- Keine Push-Notifications
