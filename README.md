# TestMaJa

Web-Werkzeuge zum Vermessen und Planen auf Basis von Luftbildern (Fabric.js,
Canvas). Reine Client-Anwendung, deployt über GitHub Pages – kein Backend.

## Repository-Layout

Das Repo enthält **drei** ausgelieferte HTML-Dateien plus die modularisierte
Quelle der Haupt-App:

| Pfad | Rolle |
|------|-------|
| `index-1.html` | **Ausgelieferte Haupt-App** (Single-File-Build). In diese Datei injiziert die CI die Release-Notes. |
| `feldaufnahme.html` | Eigenständige Feldaufnahme-App (Element-/Referenz-Workflow). |
| `wohnflaeche.html` | Wohnflächen-App: Messen in Wohnungsgrundrissen, WoFlV-Berechnung (Single-File-Build). |
| `planer/` | Quellcode der Haupt-App (Vite + ES-Module). |
| `planer/dist/` | Vite-Build-Ausgabe der Haupt-App. |
| `wohnflaeche/` | Quellcode der Wohnflächen-App (Vite + ES-Module). |

> Hinweis: `index-1.html` und `planer/dist/index.html` sind beide Build-Ergebnisse
> desselben Quellcodes unter `planer/src/`. Änderungen immer in `planer/src/`
> vornehmen und neu bauen.

## Entwicklung

```bash
cd planer
npm install
npm run dev        # Vite Dev-Server auf http://localhost:5173
npm run build      # Produktions-Build nach planer/dist/
```

## Tests

```bash
cd planer
npx playwright install chromium   # einmalig
npm test                          # Playwright: PDF-Export + XSS-Escaping
```

Zusätzlich für das CI-Skript:

```bash
python3 .github/scripts/test_inject_release_notes.py
```

Wohnflächen-App:
```bash
cd wohnflaeche
npm test
```

## Sicherheit

Werte aus geladenen Dateien (Projekt-JSON, Transfer-Dateien, EXIF-Metadaten,
Dateinamen) werden vor dem Einfügen in `innerHTML` mit `escHtml()`
(`planer/src/utils/helpers.js`) escaped. Importierte SVGs werden zusätzlich über
`sanitizeSVG()` (`planer/src/io/library.js`) bereinigt. Externe CDN-Skripte sind
mit Subresource-Integrity-Hashes (`integrity`/`crossorigin`) abgesichert.
