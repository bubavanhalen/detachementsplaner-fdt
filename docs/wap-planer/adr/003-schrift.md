# ADR-003: Schrift

- **Status:** Entwurf Runde 2 (01.10.2026, nach AR0-22); Sichtprobe an Gate S (Prompt §5.3). **Entschieden an Gate 0 (02.10.2026):** G-3 ja (Arimo im Bundle); E2 ja (Arimo als Laufzeit-Datei, OFL-1.1); Q-012: `_SwissArmy` im Kopf wird durch «SCHWEIZER ARMEE» in Arimo fett ersetzt, keine fremde Schrift oder Grafik (Abschnitt «Folgen», AR0-22; Paket E1-02e).
- **Leitplanken:** 3 (frei lizenzierte Schrift als Datei im Projekt), 2, 4; Beschrieb 10 «Schrift», 15 (Schriftgrössen 5 / 5,5 / 4,5 pt)
- **Gate-0-Entscheid des Auftraggebers:** G-3, ja (neue gebündelte Datei in der Suite, Lizenzliste im Build, Bundle-Grösse)

## Kontext

- Leitplanke 3: «eine frei lizenzierte, serifenlose Schrift als Datei im Projekt (z.B. Liberation Sans oder Arimo, metrisch ähnlich Arial). Office-Schriften dürfen nicht eingebettet werden.»
- Die Referenz-WAP sind in Arial gesetzt. Die Suite bündelt heute keine Schriften (`repo-analyse.md`).
- Prompt §7: Lizenzen der Abhängigkeiten MIT, Apache-2.0, BSD, ISC; Schriften OFL oder gleichwertig. Keine Downloads ausser Paketinstallation.

## Geprüfte Optionen

| | Option | Quelle (npm) | Lizenz | Befund |
| --- | --- | --- | --- | --- |
| A | **Arimo** Regular + Bold, Version 1.341, 3241 Glyphen | `@expo-google-fonts/arimo@0.4.3` (echte `.ttf`-Dateien, Paket MIT, Schrift in `LICENSE_FONT`) | OFL-1.1 **ohne** Reserved Font Name | Breiten identisch zu Arial; Teilmenge/Umbenennung frei |
| B | **Liberation Sans** 2.1.5 | `@formepdf/fonts-standard@0.25.0` (TTF-Bytes Base64 in JS, keine `.ttf`-Datei; Paket vom 19.09.2026, ein Maintainer) | OFL-1.1 **mit** Reserved Font Name «Liberation» (Copyright-Kopf nennt zusätzlich RFN «Arimo, Tinos, Cousine» für die Digitalisierungsdaten) | Breiten identisch zu Arial; eine Build-Teilmenge müsste umbenannt werden |
| C | PDF-Standardschrift Helvetica (wie heute im Tagesbefehl-PDF) | – | – | Nicht eingebettet (verletzt Leitplanke 4), am Bildschirm nicht verfügbar (Leitplanke 2); verworfen |
| – | Liberation Sans als eigenes npm-Paket mit `.ttf` | nicht vorhanden (`npm view liberation-fonts` / `fonts-liberation` / `@fontsource/liberation-sans` → 404) | – | – |
| – | `@fontsource/arimo` | nur WOFF/WOFF2, nach Unicode-Bereichen aufgeteilt | OFL-1.1 | für pdf-lib-Teilmengen ungeeignet |

## Messung (Spike 1)

- **Metrische Kompatibilität** zu Arial (lokale Windows-Datei `arial.ttf`/`arialbd.ttf` nur zum Messen, nie gebündelt): über alle Zeilen der 50 Referenztexte und 108 Einzelzeichen (ASCII, Umlaute, Anführungszeichen, Gedankenstrich) bei 5 pt:
  - Arimo Regular/Bold vs. Arial: max. Abweichung **0 %** (0,00000 pt).
  - Liberation Sans Regular/Bold vs. Arial: **0 %**.
  - Zeilenhöhe (hhea, ascent − descent + lineGap) je pt: Arial 1,1499 · Arimo 1,1499 · Liberation 1,1499.
  - Umbrüche der 50 Texte: Arial = Arimo = Liberation in **50/50** Fällen (bei Originalbreite und bei 45 % Breite).
- **Zeichenabdeckung:** Alle Formtexte aller Blätter beider Referenzdateien enthalten 85 verschiedene Zeichen (davon nicht-ASCII: ä ö ü Ä Ü à é ’ – —); fehlend in Arimo: **0**, in Liberation: **0**.
- **Kerning:** Arimo enthält GPOS-Kerning. Mit Kerning ändern sich Breiten um bis zu 8 % je Zeile; die Umbrüche der 50 Texte bleiben gleich (50/50). Im Kp-Referenz-WAP ist Kerning in den Formtexten entweder ausdrücklich aus (`kern="0"`, 57 Läufe) oder nicht gesetzt; die Formtexte sind in Arial gesetzt (daneben nur `+mn-lt` und eine Sonderschrift `_SwissArmy`, deren Verwendung im Kopf in Etappe 1 zu klären ist; Office-Schriften werden nicht eingebettet), die Grössen liegen bei 5,5–14 pt, überwiegend 9 pt (705 Läufe). pdf-lib zeichnet ohne Kerning (ADR-005). → **ohne Kerning** in Layout, Bildschirm und PDF.
- **Grösse:** Arimo Regular 318 320 Byte, Bold 318 844 Byte; Base64 zusammen ≈ 0,85 MB. Teilmenge im PDF: 3,2 bzw. 3,9 KB (komprimiert).

## Entscheid (Empfehlung)

**Option A: Arimo Regular und Bold**, als Dateien im Projekt (z.B. `src/assets/fonts/Arimo-Regular.ttf`, `Arimo-Bold.ttf`) mit `OFL.txt`; bezogen aus `@expo-google-fonts/arimo@0.4.3`, festgehalten mit SHA-256:

- `Arimo_400Regular.ttf` `88cc899855d30f9c779b73c3319d0e077b098f927187aafce11ca029add707a6`
- `Arimo_700Bold.ttf` `ec96ac9fdd94766f66f6140c1375bf011577558f88d43f76b3b59307d2a6bca3`

Gründe: identische Metrik zu Arial (Umbrüche wie im heutigen Excel), echte TTF-Dateien aus einem etablierten Paket, OFL ohne Reserved Font Name (Build-Teilmenge zulässig), vollständige Abdeckung der Referenztexte. Kursiv wird nicht gebraucht (Beschrieb 10 nennt nur fett/normal).

Schriftgrössen gemäss Beschrieb 15 als Vorgabe (5 / 5,5 fett / Mindestgrösse 4,5 pt); Freigabe an Gate S.

## Folgen

- `tools/build-offline.mjs` nimmt heute je Paket die **erste** Datei `^licen[sc]e` in die Lizenzliste; für die Schrift braucht es einen expliziten Eintrag mit `OFL.txt` (sonst stünde die MIT-Lizenz des Expo-Pakets statt der Schriftlizenz im Release). Änderung am Build der Suite → Gate 0.
- Bundle: +≈ 0,85 MB (Base64). Option für später: Build-Teilmenge auf Latin-1 plus benötigte Satzzeichen (Werkzeug nötig, z.B. harfbuzz-basiert; Lizenz prüfen). `@pdf-lib/fontkit` erzeugt Teilmengen **ohne** `cmap` (nur für PDF brauchbar, nicht für den Browser).
- Arimo setzt das OS/2-Flag `USE_TYPO_METRICS`; Browser verwenden damit Typo-Metriken für die Zeilenbox. Da jede Zeile einzeln an ihrer Grundlinie positioniert wird (ADR-004), ist das ohne Einfluss; im Test wurde die Grundlinie direkt gemessen.
- Lizenzprüfung der Schleuse (Prompt §7) muss OFL-1.1 für Schriftdateien zulassen.
- **Sonderschrift `_SwissArmy` im Kopf (AR0-22):** zugeordnet an Paket E1-02e zusammen mit Anhang B-Kp. Vorgehen: am Referenz-PDF feststellen, welche Zeichen sie trägt (vermutlich das Emblem oder «SCHWEIZER ARMEE»). Ein Schriftzug wird in Arimo fett gesetzt (Abweichung im Seitenvergleich an Gate S vorgelegt); ein Emblem wird nur als Vektorgrafik übernommen, wenn seine Nutzung zulässig ist (Frage an den Auftraggeber), sonst entfällt es. Die Schriftdatei selbst wird nie gebündelt oder eingebettet (Leitplanke 3).
- **Fehlende Glyphen (AR0-13):** Arimo enthält u.a. U+2713 und Emoji nicht. Die Oberfläche lehnt beim Eingeben Zeichen ohne Glyphe ab (Meldung mit Ursache und nächstem Schritt), der Import ersetzt sie durch «?» und meldet sie im Bericht; so bleiben Bildschirm und PDF gleich (ADR-004).

## Beleg

- Befehle (Arbeitsverzeichnis `spikes/font-layout/`, nicht versioniert):
  - `npm install fontkit pdf-lib@1.17.1 @pdf-lib/fontkit pdfjs-dist playwright-core esbuild @expo-google-fonts/arimo @formepdf/fonts-standard`
  - `node extract-texts.mjs` → `{ n: 50, vertikal: 22, breiteMinPt: '9.8', breiteMedianPt: '74.8', breiteMaxPt: '117.6', zeichenTotal: 693 }`
  - `node dist/spike1.mjs` → `compat.arial_vs_arimo_regular = {maxRelProzent: 0, maxAbsPt5pt: 0}` (ebenso bold und Liberation), `zeilenhoehe_faktor 1.1499`, `gleicheUmbruecheArialVsArimo: 50`, `kerningMaxBreitenAbweichungProzent: 8`, `gleicheUmbruecheMitKerningVsOhne: 50`
  - Abdeckung: `verschiedeneZeichen 85 fehlend 0` (Arimo und Liberation)
- Die 50 Texte stammen aus dem Kp-Referenz-WAP (KVK, dann Wo 1); sie liegen nur in `.qa/etappe0-spikes/` (nicht versioniert).
