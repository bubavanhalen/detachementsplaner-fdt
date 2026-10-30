# Repo-Analyse für den WAP-Planer (Etappe 0, Schritt 2)

Stand 30.09.2026, Zweig `wap-planer` ab `main` (`d9c5716`). Erhoben durch einen Explore-Agent; die Kernaussagen hat der Orchestrator an den genannten Stellen stichprobenartig nachgesehen. Das hier ist eine Arbeitsgrundlage für ADRs, kein Beleg.

## Annahme «Suite basiert auf React» – bestätigt

- React 19.3, TypeScript 7.0, Vite 8.3, TanStack Router/Store/Table/Form, Vitest 5 mit jsdom, Biome 2.5, Node 24 (`package.json`, `.nvmrc`).
- **Auslieferung als eine einzige HTML-Datei** (`tools/build-offline.mjs`):
  - Vite im Lib-Modus erzeugt ein IIFE; JS und CSS werden inline in `index.html` eingefügt.
  - `dist/index.html` und `dist/offline.html` sind identisch; eine Lizenzliste liegt im `<template id="application-licenses">`.
  - `tools/verify-release.mjs` prüft das Ergebnis.
  - `tools/smoke-offline.mjs` startet die App in JSDOM mit gesperrten Netz-APIs.
- **CSP** (im Build eingefügt): `default-src 'none'`, `connect-src 'none'`, **`font-src 'none'`**, **`worker-src 'none'`**, `img-src data: blob:`, `form-action 'none'`.
- **Kein Service Worker.** Offline heisst: Die HTML-Datei wird lokal geöffnet oder die GitHub-Pages-Seite ist im Browser-Cache.
  - Neue Versionen kommen durch Neuladen der Pages-URL oder durch eine neue HTML-Datei; einen Update-Mechanismus gibt es nicht.
  - Deploy über `.github/workflows/deploy-pages.yml` nur von `main`, nach `check`, `test:oracle`, `build` und `check:release`.

## Einbindung einer neuen Seite

- Routen mit TanStack Router und Hash-History in `src/App.tsx`. Ein neues Werkzeug braucht:
  - eine Route;
  - einen Eintrag in `tools` und `titles` in `src/components/Shell.tsx`;
  - eine Alt+Ziffer-Belegung (heute `^[1-8]$`);
  - einen Eintrag in `CommandPalette.tsx`.
- Zustand in TanStack Store (`src/store.ts`). Werkzeug-Daten liegen heute als optionales Unterobjekt im Projekt (Muster `project.tb`).
- Gestaltung in `src/theme.css` mit Layern und Tokens (hell/dunkel, ein Akzent). Pro Seite eine eigene CSS-Datei mit Präfix. **Keine gebündelten Schriften**, nur Systemschriften.
- Sprache der Oberfläche: Deutsch (Schweiz), Bezeichner Englisch mit deutschen Fachbegriffen.

## Speicherung

- **Nur localStorage** (`detplaner.v2` usw.). Kein IndexedDB, kein `navigator.storage.persist()`/`estimate()`, keine File System Access API.
- Sichern als Download (Blob + `<a download>`), Öffnen über `<input type=file>`.
- Projektformat `v: 5` mit `normalizeProject`: Es migriert, lehnt höhere Versionen mit Hinweis ab und behält unbekannte Felder.
- **Undo:** eine gemeinsame Historie mit 30 Schritten aus ganzen Projekt-Schnappschüssen, **nicht persistent**. Der Beschrieb 5.6 verlangt mindestens 200 Schritte, auch nach Neuladen.

## Detachementsplaner-Daten (für Etappe 4)

- Die Person hat Grad, Name, Vorname, Funktion und das Freitextfeld **`zug`** («Zug / Element»). Weitere Felder (Telefon, Mail, Wohnort, Versichertennummer) sind Personendaten und bleiben aussen vor.
- Detachemente haben `datum`/`bisDatum` als Zeitraum; die Zuteilungen liegen in `project.assign`.

## Vorhandener WAP-Leser (Tagesbefehl-Vorhaben, `src/io/wap/`)

- **Technik:** fflate + DOMParser, kein SheetJS.
- **Wiederverwendbar:**
  - ZIP und Beziehungen, XML-Hilfen, Zellen, Merges und Spalten-/Zeilengeometrie;
  - Zeichnungsebene mit Gruppen-Transformationen, Rotation und Füllungen (auch Verlauf und Theme);
  - Zeitkalibrierung über die Stundenbeschriftungen, Erkennung von Tageskopf und Spalten, Legendenfarben, Fussnoten-Zerlegung.
- **Nicht wiederverwendbar:**
  - `assemble.ts` ist auf den Tagesbefehl zugeschnitten (Text-Einträge, Inhaltsregeln, verwirft Verbinder und Symbole).
  - Querbalken, Beso-Kästchen mit Geometrie, Marker und Blöcke mit exakter Spaltenspanne fehlen.
- **Folgerung:** Der WAP-Import baut eine eigene Assemblierung auf den gemeinsamen unteren Modulen auf (Leitplanke 7, ADR).

## PDF

- pdf-lib 1.17 nur mit den Standardschriften Helvetica und Helvetica-Bold (WinAnsi), ohne fontkit. Die Metadaten sind bereits neutral.
- Für eine eingebettete freie Schrift braucht es `@pdf-lib/fontkit` und die Schriftdatei im Bundle. Die CSP ist dafür kein Hindernis.

## Qualitätswerkzeuge

- Vorhanden: Vitest (jsdom), Biome (`noConsole: error`), `tsconfig` strict (ohne `noUncheckedIndexedAccess`) und `tests/privacy.test.ts` (verbotene Netz-APIs, `console.`, entfernte URLs).
- **Nicht vorhanden:** Playwright, Coverage-Konfiguration, Mutationstests, Git-Hooks.
- Tests mit echten Fixtures verwenden heute `describe.skipIf(!available)`. Für den WAP-Planer gilt dagegen: `test:reference` schlägt fehl, wenn eine Referenz fehlt (Prompt §5.6).

## Folgerungen für Gate 0 (Entscheide mit Auswirkungen auf die Suite)

1. **Schrift am Bildschirm:** Wegen `font-src 'none'` kann der Bildschirm die eingebettete Schrift nicht verwenden. Für Leitplanke 2 (Bildschirm = PDF) braucht es:
   - entweder `font-src data:` in der CSP der Suite,
   - oder eine Darstellung der Glyphen als Pfade (SVG/Canvas aus der Schriftdatei, ohne `@font-face`).
2. **Speicher:** Wiederherstellungspunkte (≥ 30), persistentes Undo (≥ 200) und mehrere Stände übersteigen localStorage (~5 MB). Das verlangt IndexedDB mit `navigator.storage.persist()`.
3. **Auslieferung:** Die Suite hat keinen Service Worker, und die CSP verbietet Worker. Offline nach dem ersten Öffnen (Beschrieb 11, 14.13) geht heute nur über die gesicherte HTML-Datei oder den HTTP-Cache. Die Umgebungsprobe auf dem Dienstlaptop entscheidet.
4. **Undo:** Das Suite-Undo reicht nicht (30 Schritte, flüchtig). Der WAP-Planer braucht eine eigene, persistente Historie.
