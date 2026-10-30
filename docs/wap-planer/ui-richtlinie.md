# WAP-Planer – UI-Richtlinie

Stand 01.10.2026 · Etappe 0 (Prompt §5.1 Schritt 10) · erstellt durch `ui-designer` · durch Gate 0 angenommen (02.10.2026) · nachgeführt nach ADR Runde 2 (ADR-001 Tastatur, ADR-002 P.6a, ADR-003/-004 AR0-13, ADR-005 P.3, ADR-006 P.2b/2c, ADR-007 G-7) · Runde 3 (ADR-006 P.2a Sperre und `conflict`, P.2d; ADR-002 P.6a G-12; E1-04 `listDeletedPlans`, `migrationBackupFileName`) · Runde 4 (E1-05 Schritt 3, E1-11 `files.DeletedPlansSection` und fokussierbares Raster, E1-16 `BlockingProgress`) · Runde 5 (E1-04 `restoreDeletedPlan` mit `asCopy`, E1-05/E1-08 `aborted`) · Runde 6 (Nachführung Gate 0, 02.10.2026: alle Vorschläge aus 17–19 angenommen; Soll nur Tastatur SA-09, SA-16, SA-18 gemäss `standardaufgaben.md`) · Runde 7 (02.10.2026: Hinweis zum gemeinsamen Browserspeicher unter `file://` nach Gate-0-Entscheid 2 = G-9 a, Vorschlag R-L-09; 11.6)

Grundlagen: Beschrieb (v. a. 2, 3, 5, 6, 7, 10, 11), Prompt §2, §4.3, §6, `requirements.md`, `glossar.md`, `standardaufgaben.md`, `repo-analyse.md`, ADR-001 bis ADR-007, Verträge `plan/vertraege/E1-04`, `E1-05`, `E1-11`, `E1-12`, `E1-16`, Suite-Code (`src/theme.css`, `src/components/Shell.tsx`, `src/components/CommandPalette.tsx`, `src/pages/TagesbefehlePage.tsx` mit `tagesbefehle.css`).

Diese Richtlinie ist verbindlich für jede Oberfläche des WAP-Planers (Prompt §6 «Oberfläche gemäss UI-Richtlinie und Glossar»). Der `code-reviewer` prüft Diffs dagegen (Prompt §4.3), der `ux-critic` misst die Bedienwege aus Abschnitt 17. Bezeichnungen in der Oberfläche folgen `glossar.md`, Spalte «Oberfläche» (R-2-01). Jede Regel nennt ihre Quelle; «Entscheid UI» heisst: der Beschrieb lässt es offen, die Richtlinie legt es fest.

## 0 Statische Ansichten

Eigenständige HTML-Dateien in `docs/wap-planer/ui/`: eingebettetes CSS (die Suite-`theme.css` wörtlich plus die WAP-Ergänzungen aus Abschnitt 16), keine externen Ressourcen, nur fiktive Daten (Einheit «Inf Ustü Kp 99/4», «Hptm Muster A», «Lt Muster»). Dunkel: `#dunkel` an die Adresse hängen. Übersicht: `ui/index.html`. Screenshots hell und dunkel liegen nicht versioniert in `.qa/ui/` des Haupt-Checkouts.

Das Raster ist vereinfacht: Anordnung, Linien, Farben und Seitenaufbau wie das PDF (Beschrieb 10), Umbrüche und Schriftgrössen aber vom Browser gesetzt. Im Produkt zeichnet der Bildschirm nur vorberechnete Zeilen der Layout-Schicht (ADR-004).

| Datei | Zustand | Deckt ab |
| --- | --- | --- |
| `01-erststart.html` | Erststart | Beschrieb 5.7; R-5.7-01 |
| `01b-neuer-plan.html` | Neuer Plan aus Vorlage, Fehler «kein Montag» | R-5.2-01, F-15, 12 |
| `02-leere-woche.html` | Leere Woche mit nächstem Schritt | R-5.7-02 |
| `03-woche-mit-eintraegen.html` | Raster, Seitenfeld, Befundzähler, Prüfmarken, Detail beim Überfahren | Beschrieb 5, 5.1, 6, 7 |
| `04-direktbearbeitung.html` | Block nach dem Ziehen: Titel sofort, Tab-Felder, Vorschlag Ltg → Kategorie (Zoom 180 %) | R-5.1-03, -09 bis -11, R-4.7-10 |
| `04b-beso-direktbearbeitung.html` | Beso per Doppelklick: Termintext sofort, Zeitfenster-Tabelle, Vorschau der Terminzeile | R-5.1-07, R-4.8-08 |
| `04c-ziehen-tagesgrenze.html` | Verschieben mit Zeitanzeige über die Tagesgrenze, fehlende Spalte | R-5.1-14 bis -18 |
| `05-listenansicht.html` | Listenansicht mit Zelle in Bearbeitung | R-6-13 bis -16 |
| `06-befundliste.html` | Befundliste, Sprung zur Stelle, Quittiert | R-7-02, -03, -34 |
| `07-importbericht.html` | Importbericht mit nicht zugeordneter Form an der Originallage | R-8.2-20, -21 |
| `08-dialog-stand-setzen.html` | Neuen Stand setzen | R-5.5-03, -04, R-5.3-06 |
| `08b-stand-wird-gesetzt.html` | Modaler Fortschritt «Stand wird gesetzt …» (`BlockingProgress`) in Schritt 3 «Speichern»: «Abbrechen» deaktiviert mit Begründung, Bearbeitung gesperrt (gleicher Aufbau für «Import läuft …»); Meldung `conflict` in 13b | R-5.5-04; ADR-006 P.2a; E1-05, E1-16 |
| `09-dialog-pdf-export.html` | PDF-Export der Arbeitsfassung vor dem ersten Stand mit Befunden der Stufe «Fehler»; Dateiname `…_Entwurf.pdf` ohne Datum | R-5.5-01, R-7-04, -05, R-6-10; ADR-005 P.3; E1-05 |
| `09b-pdf-export-frueherer-stand.html` | PDF-Export eines gespeicherten Stands: A3 und «Status rot darstellen» gesperrt mit Hinweis (Vorgabe G-12 a) | R-5.5-06; ADR-002 P.6a, G-12; E1-16 |
| `10-dialog-datei-konflikt.html` | Plan-Datei öffnen – Behalten / Ersetzen (Wiederherstellungspunkt, rückgängig machbar) / Als Kopie öffnen | R-5.6-13; ADR-006 P.2b |
| `11-speicherwarnung.html` | Speicher voll und nicht dauerhaft | R-5.6-11, -12 |
| `11b-speicher-wiederherstellung.html` | Speicheranzeige, Datei-Sicherung fällig, Wiederherstellungspunkte mit allen acht Gründen, Verweis «Gelöschte Pläne (n)» auf den Dialog «Wiederherstellungspunkte» (Abschnitt selbst: 13b) | R-5.6-02, -03, -08, -09; ADR-006 P.1, P.2b |
| `12-tablet-lesemodus.html` | Tablet-Lesemodus (1180 × 820) – **nur bei G-7 b; entschieden Gate 0 (02.10.2026): G-7 a, Ansicht nicht verbindlich** (15) | R-11-10; ADR-007 G-7 |
| `13-zustaende.html` | Laden, Fortschritt, Fehler, Leerzustände, Erinnerung, Toast | R-5.7-03, -04, R-5.6-10, -17 |
| `13b-zustaende-daten.html` | Zeichen ohne Glyphe (Eingabe, Import), Plan löschen, Toasts nach Ersetzen und Löschen mit «Rückgängig», gelöschte Pläne (`listDeletedPlans`), Update gescheitert, Konflikt «Stand nicht gesetzt – Plan wurde geändert» | ADR-003/-004 AR0-13; ADR-006 P.2b, P.2c; E1-11, E1-12 |
| `14-tastenkuerzel.html` | Kürzelübersicht «?» | R-11-07 |
| `15-sicherung-vor-update.html` | Dialog «Sicherung vor dem Update» vor einer Schema-Migration | ADR-006 P.2c; E1-04, E1-11 |

## 1 Leitsätze

1. **Das Papier ist das PDF.** Die Hauptansicht zeigt die Woche in derselben Anordnung wie das PDF (Lage, Farben, Umbrüche) (Beschrieb 5; R-5-01). Das Papier bleibt auch im dunklen Modus weiss mit schwarzer Schrift – wie die Papiervorschau der Tagesbefehle (`tagesbefehle.css`: «The paper replica deliberately stays white»).
2. **Marken gehören nicht aufs Papier.** Auswahl, Fokus, Zellzeiger, Prüf- und Importmarken liegen in einer eigenen Ebene über dem Papier, haben feste Bildschirmgrösse und erscheinen nie im PDF (Beschrieb 5; R-5-03).
3. **Ein Klick wählt, nie mehr.** Erzeugt wird nur durch Ziehen, Doppelklick, Tastenbefehl oder Dialog (Beschrieb 5.1; R-5.1-01).
4. **Tastatur ist gleichwertig.** Jeder Befehl hat einen Tastaturweg, die häufigen ein direktes Kürzel, alle übrigen die Befehlspalette (Beschrieb 11; R-11-07).
5. **Nichts geht still verloren.** Jede Aktion ist rückgängig machbar und sofort gespeichert (Prompt §6; Beschrieb 5.6); jede Meldung nennt Ursache und nächsten Schritt (R-5.7-03, -04).
6. **Ruhig, präzise, einheitlich** (Prompt §2): Suite-Tokens und Suite-Komponenten; keine neuen Farben ausser Legende, Papier und Marken; Animationen nur in der Bedienoberfläche und höchstens 200 ms.

## 2 App-Rahmen und Einbindung in die Suite

### 2.1 Einbindung (ADR-001)

- Route `/wap` der Suite, Eintrag «WAP-Planer» unter «Nachschlagen» in `Shell.tsx` (Hinweis «WAP erfassen, prüfen, PDF»), Tastenkürzel **Alt+9**, Einträge in der Befehlspalette (Gruppe «WAP-Planer»).
- **Vollbild-Arbeitsfläche:** Auf `/wap` ist die Suite-Seitenleiste standardmässig eingeklappt (64 px). Das ist eine Vorgabe der Route, keine Änderung der gespeicherten Suite-Einstellung; Ctrl+B klappt sie wie überall aus.
- **Kopfleiste der Route statt Suite-Topbar.** Die Suite-Topbar zeigt Speicherstand und Rückgängig der Suite (`SaveState`, `HistoryButtons`); auf `/wap` wären beide falsch (eigener Speicher und eigenes Undo, ADR-001, ADR-006). Die Route zeichnet deshalb eine eigene Kopfleiste mit denselben Klassen (`.topbar`, 56 px) und denselben Knöpfen für Darstellung und Tastenkürzel.

### 2.2 Aufbau

```
┌──┬──────────────────────────────────────────────────────────────────────────────────────┐
│S │ KOPFLEISTE 56 px: «WAP-Planer» · [Plan ▾] ········· [Speicheranzeige][Datei sichern] ↶ ↷ ◐ ⌨ │
│u ├──────────────────────────────────────────────────────────────────────────────────────┤
│i │ (Banner: Speicher, Import, schreibgeschützt – nur bei Bedarf)                         │
│t ├──────────────────────────────────────────────────────────────────────────────────────┤
│e │ WERKZEUGLEISTE 44 px: Wochen-Tabs ⋯ │ Raster|Liste │ − 101 % + Einpassen ··· Befunde │ Stand … │ PDF … │
│  ├─────────────────────────────────────────────────────────────┬────────────────────────┤
│64│ ARBEITSFLÄCHE (--sunken)                                    │ SEITENBEREICH 344 px   │
│px│   Papier A4 quer: Kopf · Raster · Seitenleiste · Termine    │ Tabs: Seitenfeld |     │
│  │   + Markenebene (nur Bildschirm)                            │ Befunde n | Importber. │
│  ├─────────────────────────────────────────────────────────────┴────────────────────────┤
│  │ STATUSZEILE 26 px: Ort des Zellzeigers / Auswahl ··········· Kurzhilfe der Kürzel      │
└──┴──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Kopfleiste:** Titel «WAP-Planer»; Plan-Knopf mit Plan-Name, Stufe und Einheit, öffnet das **Planmenü**: Plan-Einstellungen …, Plan-Datei sichern (Ctrl+S), Plan-Datei öffnen … (Ctrl+O), Excel-WAP importieren …, Importbericht anzeigen, Wiederherstellungspunkte …, Gelöschte Wochen …, Anderen Plan öffnen ▸, Neuer Plan aus Vorlage …, Plan löschen …. Rechts Speicheranzeige (11.3), «Datei sichern», Rückgängig/Wiederholen (Beschriftung nennt die Aktion: «Rückgängig: Block «Mö Sch» verschoben»), Darstellung, Knopf «Tastenkürzel» (`button`, Name «Tastenkürzel», öffnet die Übersicht «?», 11.6).
- **Werkzeugleiste** (`role="toolbar"`): Wochen-Tabs (3), Ansicht Raster/Liste (Suite-`segmented`), Zoom (4.1), Befundzähler (8.1), Stand-Anzeige «Stand 17.09.2026 · V1» mit «Neuen Stand setzen …», «PDF …» (Primärknopf).
- **Seitenbereich:** 344 px (300–480 px, Trenner ziehbar und per Tastatur ←/→ als `role="separator"`), ein- und ausblendbar (Befehl «Seitenbereich ein/aus»). Tabs «Seitenfeld», «Befunde n», «Importbericht» (nur nach einem Import). Sprünge aus Befundliste oder Importbericht lassen den Tab offen (SA-08, SA-20).
- **Statuszeile:** links Ort und Auswahl in Worten («Wo 1 · Mo 05.10.2026 · COBRA 10 · 0800»), während des Ziehens die Zeiten, rechts die fünf wichtigsten Kürzel. `role="status"`, Ansagen gedrosselt (13.6).
- **Mindestgrösse** 1366 × 768 px (Dienstlaptop, Skalierung 100–150 %). Darunter wird der Seitenbereich zur Überlagerung von rechts. Unter 900 px Breite gilt der Lesemodus (15) nur bei G-7 b; bei G-7 a (entschieden Gate 0, 02.10.2026) bleibt die Route auch dort bedienbar (Seitenbereich als Überlagerung, Papier scrollt).

## 3 Wochennavigation

- Wochen-Tabs in Planreihenfolge: Kurzname und KW («Wo 1 KW 41»); `role="tablist"`, ←/→ wechseln, Enter/Leertaste öffnen (Beschrieb 4.2; R-6-05). Die Tab-Beschriftung nutzt den Kurznamen, der Tooltip Bezeichnung und Zeitraum («FDT Woche 1 · 05.10.–11.10.2026»).
- **Alt+Bild↑ / Alt+Bild↓** wechseln zur vorherigen/nächsten Woche, überall in der Route ausser in Eingabefeldern. Ctrl+Bild↑/↓ gehört dem Browser (Tabwechsel) und wird nicht verwendet.
- Beim Wechsel bleiben Zoom, Ansicht und der Zellzeiger auf gleichem Wochentag, gleicher Zeit und gleichnamiger Spalte. Die Auswahl wird aufgehoben. Ziel ≤ 300 ms bis zur fertigen Darstellung (R-11-12).
- **Wochenmenü «⋯»** neben den Tabs: Woche danach einfügen …, Woche duplizieren, Umbenennen …, Löschen. Einfügen mit Vorschau der verschobenen Folgewochen (F-16). Löschen ohne Rückfrage, aber mit Toast «Wo 2 gelöscht · Rückgängig» und Eintrag in «Gelöschte Wochen» (R-5.2-05, -06; F-17).
- Querbalken, die über die Wochengrenze reichen, erscheinen auf jeder betroffenen Woche mit vollem Titel (R-4.6-10); ein kleines Pfeilsymbol am Rand (Marke, nur Bildschirm) zeigt «geht in Wo 2 weiter».

## 4 Wochenraster: Darstellung und Marken

### 4.1 Papier und Zoom

- Das Papier ist die A4-Seite der Woche: Kopf, Raster, Seitenleiste, Termine (Beschrieb 10). Texte sind vorberechnete Zeilen der Layout-Schicht in Arimo (ADR-003, ADR-004); der Browser bricht nie um.
- **Zoom** (R-5-02): 100 % = Originalgrösse (1 pt = 1,333 CSS-px). Stufen 50, 75, 100, 125, 150, 175, 200, 250, 300, 400 %; «Einpassen» passt die Seite in die Arbeitsfläche (auf 1600 × 1000 px ≈ 101 %).
  - Bedienung: − / + in der Werkzeugleiste, Tasten **−**, **+**, **0** (Einpassen) im Raster, **Ctrl+Mausrad** über dem Papier zoomt um den Mauszeiger. **Ctrl+Plus / Ctrl+Minus / Ctrl+0** zoomen das Papier nur, solange der Fokus oder der Mauszeiger im Raster liegt (umgesetzt H-UI2, Befund SA-H-22); überall sonst bleiben sie der Seitenzoom des Browsers (Barrierefreiheit).
  - Abwägung (nachgeführt F-DOKU 20.10.2026, Befund SA-2-12; bisher stand hier «Ctrl+Plus/Minus bleibt der Seitenzoom des Browsers»): Im Raster ist der Seitenzoom des Browsers per Tastatur damit nur erreichbar, wenn der Fokus das Raster verlässt (Tab, Esc in die Werkzeugleiste) oder über das Browsermenü; die Oberfläche ausserhalb des Rasters (Kopf-, Werkzeugleiste, Seitenfeld, Dialoge) bleibt mit Ctrl+Plus vergrösserbar. Alternative ohne diese Einschränkung: nur −/+/0 ohne Ctrl im Raster. Entscheid an Gate B (Vorgabe bis dahin: wie umgesetzt).
  - Zoom skaliert nur Koordinaten; Umbrüche ändern sich nie (ADR-004 Messung: textgleich bei 1 / 1,333 / 2 / 3 px pro pt).
  - **Lesbarkeit:** Bei «Einpassen» wird 5 pt zu ≈ 6,7 px und ist am Bildschirm nicht lesbar. Zum Erfassen ist 175–200 % gedacht (5 pt ≈ 12–13 px), mit Scrollen. Details sind zusätzlich immer im Seitenfeld und im Detail beim Überfahren in Oberflächenschrift lesbar (6, 4.3). Der Zoom wird pro Plan und Gerät gemerkt.
  - Zellzeiger und Auswahl bleiben beim Zoomen und Scrollen sichtbar (WCAG 2.4.11).

### 4.2 Bedien- und Prüfmarken (nur Bildschirm, R-5-03)

Feste Grösse in Bildschirm-Pixeln, unabhängig vom Zoom; Farben aus den Papier-Tokens (16.3), weil das Papier in beiden Modi weiss ist.

| Marke | Darstellung | Farbe, Kontrast |
| --- | --- | --- |
| Auswahl | 2 px Rahmen, 1 px Abstand, weisser Hof; Griffe oben und unten (9 × 9 px), bei Blöcken auch links und rechts | `--wap-mark-select` #2d63b5: 5,89:1 auf Weiss, 3,20:1 auf «Extern» #bfbfbf |
| Mehrfachauswahl | wie Auswahl, ohne Griffe; Zahl in der Statuszeile | wie oben |
| Tastaturfokus auf Eintrag | 2 px gestrichelt, 2 px Abstand (zusätzlich zur Auswahl) | wie oben |
| Zellzeiger | 15-Min-Zelle mit 2 px Rahmen und 12 % Füllung | wie oben |
| Befund Fehler / Warnung / Hinweis | Kreis «!» / Raute «!» / Kreis «i», 15 px, oben rechts am Eintrag; Form und Farbe tragen die Stufe (nicht nur Farbe) | #c23a2f 5,33:1 · #b86e00 3,99:1 · #4a554e 7,78:1 (Nicht-Text, Schwelle 3:1) |
| P1 (fehlende Spalte) | zusätzlich rot gestrichelter Rahmen und Schraffur über dem Eintrag an der relativen Lage | #c23a2f |
| «geändert» (Import, bis zum nächsten Stand) | Punkt 7 px oben links; Tooltip «geändert seit letztem Stand» (F-29: in Etappe 1 nur am Bildschirm) | `--wap-mark-changed` #7a3db8, 6,59:1 |
| Nicht zugeordnete Form (Importbericht) | gestrichelter Rahmen an der Originallage mit Beschriftung «Form 47 · nicht zugeordnet · «Text»» | #7a3db8 |
| Sprungziel (Befund, Bericht) | 3 px Rahmen mit Hof, 1,5 s stärker, dann wie Auswahl | `--wap-mark-select` |
| Ziehen | Geisterrechteck 2 px, Einrastlinien, dunkles Zeitschild am Zeiger | Schild #17201b mit weisser Schrift, 16,68:1 |
| Kein Spaltensatz | schraffierte Fläche «Kein Spaltensatz» im Spaltenkopf | – |
| Fortsetzung über Mitternacht | Pfeil ↧ am unteren bzw. ↥ am oberen Rand; Tooltip «Fortsetzung vom Vortag» (R-4.5-10, Glossar) | Papier-Tinte |

### 4.3 Detail beim Überfahren (Beschrieb 6; R-6-06)

- Nach 400 ms Verweilen auf einem Eintrag erscheint eine Karte in Oberflächenschrift: Typ und Nummer, Titel, Tag und Zeit, Spalten, Ltg, Tn, Tpt, Ort, Kategorie, Status, Terminzeile (Beso), interne Notiz, offene Befunde (Ansicht 03).
- Bei Tastaturfokus nach 800 ms dieselbe Karte. Sie verdeckt den fokussierten Eintrag nicht, bleibt beim Überfahren der Karte stehen und schliesst mit Esc (WCAG 1.4.13). Inhalt identisch mit `aria-describedby` des Eintrags.

## 5 Raster-Interaktion

### 5.1 Auswählen

- **Klick** auf einen Eintrag wählt ihn; Klick auf leere Fläche setzt den Zellzeiger und hebt die Auswahl auf. Nie entsteht ein Eintrag (R-5.1-01). Ab 4 px Bewegung bei gedrückter Taste gilt die Geste als Ziehen.
- **Ctrl+Klick** nimmt einen Eintrag in die Auswahl auf oder heraus. **Shift+Klick** wählt alle Einträge im Rechteck zwischen dem zuletzt gewählten und dem angeklickten (R-5.1-20).
- **Shift+Ziehen** zieht einen Auswahlrahmen, auch wenn es auf einem Eintrag beginnt (Entscheid UI, siehe 19 K-1).
- Klick auf einen Tageskopf wählt den Tag, Shift-Klick einen Bereich von Tagen, Ctrl-Klick einzelne Tage (SA-02, R-5.2-07).
- Klick auf eine Terminzeile wählt den Beso; Kästchen und Terminzeile werden gemeinsam markiert (ein Objekt, Beschrieb 5.3).

### 5.2 Ziehen erzeugt

| Wo gezogen | Ergebnis | Quelle |
| --- | --- | --- |
| Leere Fläche in Planungs- oder Nebenspalten | Block über die überstrichene Zeit (auf 15 Min eingerastet) und die überstrichenen Spalten; Titel sofort eintippen | R-5.1-02, -03, R-4.5-08 |
| Rap-Spalte | Rapport von–bis | Entscheid UI (Beschrieb 5.1 nennt nur Doppelklick) |
| Beso-Spalte | Beso mit einem Zeitfenster von–bis in der Beso-Spalte; Termintext sofort | Entscheid UI |
| Band über 0500 | Querbalken über die überstrichenen Tage, alle Spalten; Titel sofort | Entscheid UI; SA-07; R-4.6-04 |
| Über Planungs- und Rap/Beso-Spalten hinweg | Block, auf die Planungs- und Nebenspalten gekürzt | Beschrieb 4.4 |

- Mindestgrösse 15 Min. Die Kategorie des neuen Blocks: Standard-Leitungskategorie der (linken) Spalte, sonst die zuletzt verwendete (Beschrieb 4.7; F-08).
- Während des Ziehens: Geisterrechteck, Einrastlinien und Zeitschild «0800-1200 · Mo · COBRA 10–COBRA 20» (R-5.1-15). Esc bricht ab, ohne Spur.
- **Alt+Ziehen** erzeugt auch über bestehenden Blöcken; das Zeitschild sagt vorab «Ausnahme in «Ausb Gef S»» oder «parallel zu «…»» (Beschrieb 4.6; R-5.1-04). Ohne Alt beginnt Ziehen auf einem Block immer das Verschieben.
- Loslassen öffnet die Direktbearbeitung (5.4).

### 5.3 Doppelklick

| Ziel | Ergebnis | Quelle |
| --- | --- | --- |
| Leere Fläche der Rap-Spalte | Rapport (Zeitpunkt der Zelle, Höhe 30 Min), Direktbearbeitung mit Feld «Kürzel» | R-5.1-06 |
| Leere Fläche der Beso-Spalte | Beso mit Zeitfenster zur Zelle, Direktbearbeitung mit Feld «Titel» für den Termintext | R-5.1-07 |
| Eintrag | Titel direkt im Raster bearbeiten | R-5.1-08 |
| Terminbereich eines Tages (leer) | Ganztägige Bemerkung, Feld «Text» | Entscheid UI; SA-15; R-4.6-29 |
| Terminzeile | Beso-Direktbearbeitung (Titel) | Beschrieb 5.3 |
| Leere Fläche der Planungsspalten | nichts (nur Zellzeiger); Hinweis in der Statuszeile «Ziehen erzeugt einen Block» | R-5.1-01 |
| Seitenleiste (Wochenziele, Erhöhte Bereitschaft, Bemerkungen), Kopf (Beilage, Titel) | Seitenfeld «Woche» bzw. Plan-Einstellungen mit Fokus auf dem Feld; berechnete Kopfdaten (Datum, KW) zeigen «wird automatisch gebildet» | R-6-05 |

### 5.4 Direktbearbeitung (Inline)

Ein Textfeld liegt genau über dem Titel des Eintrags; darunter oder daneben eine kleine Karte «Direktbearbeitung» mit den nächsten Feldern (Ansichten 04, 04b). Seitenfeld und Raster folgen live.

- **Tab / Shift+Tab** springt zum nächsten/vorherigen Feld (R-5.1-09). **Enter** übernimmt alles und schliesst (R-5.1-10); der Fokus kehrt zum Eintrag im Raster zurück. **Esc** verwirft alle Änderungen dieser Bearbeitung (R-5.1-11); bei einem soeben erzeugten Eintrag verschwindet er ohne Undo-Schritt.
- **Klick ausserhalb** übernimmt wie Enter (wie Excel) und führt den Klick aus. So geht SA-07 in 5 Aktionen.
- **Ctrl+B** schaltet im Titel die markierte Textstelle fett/normal (Beschrieb 5.1 «**AVOR** Fahne»; R-5.1-13). Neue Titel sind ganz fett (Blocktitel fett, Beschrieb 10). **Shift+Enter** fügt einen festen Zeilenumbruch ein (Import: «fette Zeile(n) = Titel», Beschrieb 8.2 Regel 12).
- Beim Tippen von Ltg erscheint die Vorschlagsliste aus Funktions- und Personenliste mit der Kategorie («Zfhr – Kategorie Ltg Zfhr»); ↓/↑ wählen, Tab oder Enter übernimmt und setzt die Kategorie gemäss Funktionsliste (R-4.7-10).
- Fehlerhafte Eingaben (Zeit ausserhalb des 5-Min-Rasters, F-18) werden nicht übernommen: Feld rot, Meldung unter dem Feld, Fokus bleibt.
- **Zeichen ohne Glyphe in der Druckschrift** (z.B. «✓», Emoji; ADR-003 und ADR-004 AR0-13): Jedes Textfeld mit Plan-Inhalt (Direktbearbeitung, Seitenfeld, Listenansicht, Dialoge) prüft die Eingabe mit `isRenderable` (E1-02b, Feldbausteine E1-12). Enthält sie ein solches Zeichen, wird der Wert **nicht übernommen**: Feld rot (`aria-invalid`), Meldung unter dem Feld (12 «Zeichen»), Fokus bleibt, die Eingabe bleibt zur Korrektur stehen; Enter und Klick ausserhalb übernehmen nicht, Esc verwirft. Eingefügter Text (Ctrl+V) wird gleich geprüft. So bleiben Bildschirm und PDF gleich (Leitplanke 2). Ansicht 13b.
- Ein Beso trägt ab dem Anlegen seine laufende Nummer; die Vorschau zeigt die entstehende Terminzeile (R-4.8-08).

**Felder der Direktbearbeitung** – Grundsatz: Nach Maus-Geste steht die Lage fest, es beginnt der Text; nach Tastaturbefehl beginnen die Lagefelder, vorbelegt aus dem Zellzeiger und markiert (Tippen ersetzt, Tab übernimmt). Ausnahme Beso: Titel zuerst, weil die Lage in den Zeitfenstern liegt, die in der Terminzeile nach dem Titel stehen.

| Typ | nach Maus | nach Tastatur (Befehl) |
| --- | --- | --- |
| Block | Titel → Zusatz → Ltg → Ort | (N) Zeit → Spalten → Titel → Zusatz → Ltg → Ort |
| Rapport | Kürzel → Zeit → Ort | (R) Zeit → Kürzel → Ort |
| Beso | Titel → Zeitfenster-Tabelle (Zeit → Spalte → Zusatz je Zeile) | (B) gleich; Zeit des 1. Zeitfensters aus dem Zellzeiger |
| Querbalken | Titel → von → bis | (Q) von → bis → Titel |
| Marker | Art → Zeitpunkt | (M) gleich |
| Ganztägige Bemerkung | Text | (G) Tag → Text |

- **Zeitfenster-Tabelle (Beso):** Nach dem Zusatz der letzten Zeile folgt per Tab immer eine leere Zeile «Zeit · Beso-Spalte · Zusatz»; Tippen legt das nächste Zeitfenster an, leere Zeilen werden beim Übernehmen ignoriert (SA-05: 6 statt 7 Aktionen je Zeitfenster). Spalte leer = Beso-Spalte (Beschrieb 4.6 «ohne Spalte in der Beso-Spalte»).

### 5.5 Verschieben und Grösse ändern

- Ziehen am Eintrag verschiebt, an den Griffen oben/unten ändert es Beginn/Ende, links/rechts die Spaltenspanne. Einrasten auf 15 Min und Spaltengrenzen (R-5.1-14); genaue Zeiten auf 5 Min nur per Eingabe (R-4.5-09).
- Zeitschild während des Ziehens mit neuer Zeit, Tag und Spalten (R-5.1-15); Original bleibt blass an alter Stelle, bis losgelassen wird. Esc bricht ab.
- **Ctrl beim Loslassen** legt eine Kopie ab (Windows-Konvention); das Zeitschild zeigt «Kopie».
- Beso-Kästchen verschieben ihr Zeitfenster; vor dem ersten Stand nummeriert das Tool den Tag neu, das Zeitschild sagt es an («Nr 12 → 10»), die Statuszeile nach dem Loslassen auch (R-5.3-03, -04).
- Marker verschieben nur ihren Zeitpunkt; Querbalken im Band nur ihre Tage.
- Mehrere gewählte Einträge verschieben sich gemeinsam (R-5.1-21), ein Undo-Schritt.

### 5.6 Tagesgrenze (R-5.1-16 bis -19)

- Ziehen über die Tagesgrenze verschiebt auf den Zieltag. Spalten gleichen Namens bleiben; fehlen sie, gilt die gleiche relative Lage (F-48), und das Zeitschild warnt vor dem Loslassen: «HAWK gibt es am Di nicht: nur FALCON (gleiche relative Lage) · Befund P1» (Ansicht 04c). Blöcke über alle Spalten bleiben über alle Spalten.
- Nach dem Loslassen trägt der Eintrag die P1-Marke; der Befund steht im Zähler.

### 5.7 Mehrfachauswahl, Kopieren, Einfügen, Duplizieren (R-5.1-20 bis -22)

- Gemeinsam: verschieben, Kategorie, Status, Textrichtung, löschen (Seitenfeld zeigt nur gemeinsame Felder und «3 Einträge gewählt»).
- **Ctrl+C / Ctrl+X** kopieren/ausschneiden die Auswahl mit ihren relativen Lagen. **Ctrl+V** fügt am Zellzeiger ein: frühester Eintrag beginnt an Tag und Zeit des Zellzeigers, Spalten gleichen Namens, sonst relative Lage mit P1. Ohne Zellzeiger (Fokus auf Eintrag) fügt es am gleichen Wochentag und zur gleichen Zeit der aktuellen Woche ein – so geht «zwischen Wochen» mit Ctrl+C, Alt+Bild↓, Ctrl+V.
- **Ctrl+D** dupliziert unmittelbar anschliessend (Beginn = Ende des Originals, gleiche Spalten) und wählt das Duplikat (Entscheid UI; R-6-25).
- Toast nach Sammelaktionen: «4 Einträge an Di–Fr erstellt · Rückgängig».

### 5.8 «Auch an anderen Tagen» (Beschrieb 6; R-6-01)

Befehl im Kontextmenü, im Seitenfeld und per **A**. Kleiner Dialog: Tage Mo–So der Woche als Kontrollkästchen (Ausgangstag gesperrt), Schnellwahl «Mo–Fr» und «ganze Woche», Ziffern **1–7** schalten die Tage. «Übernehmen» (Enter) legt unabhängige Kopien an (F-22), ein Undo-Schritt.

### 5.9 Tagesköpfe

Gewählte Tage zeigen im Seitenfeld «Tag»: Spaltensatz (Auswahl, auch für mehrere Tage, R-5.2-07), Darstellung als Segmentschalter «voll | kompakt | ausgeblendet» (R-5.2-10), interne Notiz des Tages (R-6-07). Tastatur: **S** öffnet die Spaltensatz-Auswahl, **D** die Darstellung (Menü mit Tippsuche: «k» = kompakt). Kontextmenü des Tageskopfs zusätzlich: «Tag neu nummerieren …» (ab dem ersten Stand, R-5.3-08).

### 5.10 Kontextmenü

Rechtsklick, Menütaste oder **Shift+F10** (Windows-Konvention) – Suite-`.menu`, mit Kürzeln rechts:

- **Eintrag:** Titel bearbeiten (F2) · Seitenfeld (E) · Auch an anderen Tagen … (A) · Kopieren · Ausschneiden · Einfügen · Duplizieren (Ctrl+D) · Status ▸ · Kategorie ▸ · Textrichtung ▸ · Streichen (X) · Löschen (Entf).
- **Leere Fläche:** Neuer Block (N) · Beso (B) · Rapport (R) · Querbalken (Q) · Marker (M) · Ganztägige Bemerkung (G) · Einfügen (Ctrl+V).
- **Tageskopf:** Spaltensatz (S) · Darstellung (D) · Tag neu nummerieren … · Interne Notiz des Tages.

## 6 Seitenfeld (Beschrieb 5.1; R-5.1-12)

- Zeigt immer die aktuelle Auswahl: nichts → **Woche**; Tag(e) → **Tag**; ein Eintrag → **Eintrag** mit allen Angaben seines Typs (Beschrieb 4.6); mehrere → gemeinsame Felder.
- Kopf: Typ-Abzeichen, Titel, Kurzbeschreibung «Mo 05.10.2026 · 0800-1200 · COBRA 10–COBRA 20». Darunter die **offenen Befunde dieses Eintrags** als Suite-Callout mit Ursache, nächstem Schritt und «Quittieren …».
- Feldreihenfolge Block (Ansicht 03): Titel (mit Fett-Knopf) · Zusatz · Tag · Zeit · Spalten · Kategorie · Gemeinsame Leitung · Ltg · Ort · Tn (+ «drucken») · Tpt · Tenue (+ «drucken») · Status (Segment «bestätigt | offen | gestrichen») · Darstellung (Textrichtung «automatisch | waagrecht | senkrecht», Offenes Ende) · Interne Notiz («Erscheint nie im PDF und nie in weitergegebenen Dateien», R-6-08). Beso zusätzlich: Nr mit Zustand «laufend | fixiert» und Knopf «Nummer fixieren», Zeitfenster-Tabelle, Terminzeile mit Umschalter «aus den Feldern | Freitext» (Beschrieb 4.8). Rapport: Kürzel, Zeit, Ort, Tn, Kategorie, Anzeige «nur Rap-Spalte | auch in Spalten | nur in Spalten».
- Die Feldsprung-Kürzel (13.3) stehen als kleine Tastenzeichen rechts neben der Beschriftung (Z, T, S, K, L, O, X).
- **Übernahme:** Textfelder beim Verlassen oder mit Enter; Auswahlfelder und Schalter sofort. Esc im Feld stellt den Wert vor der Bearbeitung wieder her und gibt den Fokus ans Raster zurück. Jede übernommene Feldänderung ist ein Undo-Schritt und sofort gespeichert (Prompt §6).
- Dichte Variante: Felder 30 px hoch (Dialoge: Suite-Standard 34 px), Beschriftung 0,84 rem, Abschnitte mit Überschrift in Grossbuchstaben wie `.menu-label`.

## 7 Listenansicht (Beschrieb 6; R-6-13 bis -16)

- Umschalten mit dem Segment «Raster | Liste» oder **Ctrl+L**. Die Auswahl wandert mit: die Zeile des gewählten Eintrags ist fokussiert, und zurück im Raster ist er gewählt.
- Spalten: (Befundmarke) · Tag · Zeit · Typ · Titel · Spalten · Ltg · Ort · Nr · Kategorie · Status; weitere (Zusatz, Tn, Tpt, Tenue, Notiz) einblendbar (F-25). Suite-`DataTable` (TanStack Table), Kopf wie `.data-table th`.
- Filter: Textfeld (Ctrl+F) über alle Spalten; Chips Typ, «Mit Befund», «geändert»; Umfang «Diese Woche | Ganzer Plan». Sortieren per Klick oder Enter auf den Spaltenkopf (`aria-sort`). Enter im Filterfeld setzt den Fokus auf die erste Zelle, die den Suchtext enthält.
- **Bearbeiten wie Excel:** Pfeile bewegen den Zellzeiger; Enter auf der Zelle geht eine Zeile tiefer, Shift+Enter eine höher (Entscheid Auftraggeber 29.10.2026, F-UX6); Tippen ersetzt den Zellinhalt (auch AltGr-Zeichen), F2 oder Doppelklick bearbeitet ihn; im Editor übernimmt Enter und geht eine Zeile tiefer, Shift+Enter übernimmt und geht eine höher, Tab nach rechts, Esc verwirft. Ein abgelehnter Wert lässt den Editor mit Meldung offen und behält den Fokus. Auswahlzellen (Kategorie, Status) öffnen eine Liste mit Tippsuche; Spalten ist ein Textfeld mit Vorschlägen für mehrere Spalten («Rap, Kp Kdt»), ein unbekannter Name wird mit Meldung abgelehnt (UX-AB-G-01). Typ und Tag sind nur lesbar (`aria-readonly`); einen Eintrag auf einen anderen Tag legt man im Seitenfeld oder per Ziehen um. Mehrfach-Zeitfenster eines Beso öffnen beim Bearbeiten von Zeit oder Spalten die Zeitfenster-Tabelle.
- Das Raster folgt sofort (R-6-15); jede Zelländerung ist ein Undo-Schritt.
- Export «Export …» im Format der Soll-Listen (R-6-16; `anhaenge/normalisierung.md`).
- Leerzustand bei Filter ohne Treffer: «Kein Eintrag passt zu «Säntis»» mit «Im ganzen Plan suchen» und «Filter löschen» (Ansicht 13).

## 8 Befunde

### 8.1 Befundzähler (Beschrieb 7; R-7-02)

- In der Werkzeugleiste: «Befunde» mit drei Zählern Fehler (Kreis), Warnungen (Raute), Hinweise (Kreis «i»). Quittierte zählen nicht (R-7-34). Ohne offene Befunde: «Keine Befunde» mit Häkchen in Erfolgsfarbe.
- `aria-label` in Worten: «2 offene Befunde: 2 Fehler, 0 Warnungen, 0 Hinweise. Befundliste öffnen (Ctrl+.)». Steigt die Zahl der Fehler, sagt eine höfliche Live-Region es einmal an («Neuer Fehler P1: «Ausb Mö»»).
- Klick oder **Ctrl+.** öffnet den Tab «Befunde»; **F8 / Shift+F8** springen von überall zum nächsten/vorherigen Befund und fokussieren den Eintrag (SA-20).
- Ziel: Aktualisierung ≤ 500 ms nach einer Änderung (R-11-14).

### 8.2 Befundliste (R-7-03, R-7-34)

- Gruppiert nach Stufe (Fehler, Warnungen, Hinweise), darin nach Tag und Sortierzeit; Umfang «Wo n | Ganzer Plan»; Filter Stufe; unten eingeklappt «Quittiert (n)».
- Eintrag der Liste: Symbol · Regel («P1») · Kurztitel · Ort («Di 0800») · Ursache und nächster Schritt (12) · Knöpfe «Zur Stelle» und «Quittieren …».
- `role="listbox"`: ↑/↓ wählen, **Leertaste** springt zur Stelle und lässt den Fokus in der Liste, **Enter** springt und setzt den Fokus auf den Eintrag im Raster. Der Sprung wechselt bei Bedarf die Woche, scrollt, hebt die Stelle hervor (4.2) und wählt den Eintrag.
- **Quittieren …**: kleiner Dialog mit optionalem Grund (eine Zeile), «Quittieren» (Enter). Quittierte Befunde zeigen Datum und Grund und lassen sich mit «Quittierung aufheben» zurückholen; beides ist rückgängig machbar. Vorschlag zur Lebensdauer siehe 19 F-5.
- Leerzustand: «Keine offenen Befunde in Wo 1 · Die Prüfungen laufen bei jeder Änderung. 1 Befund ist quittiert.» (Ansicht 13).

## 9 Importbericht (Beschrieb 8.2 Regel 8, 11; R-8.2-20, -21)

- Ablauf: «Excel-WAP importieren» → Dateiauswahl → Import-Dialog (Datei, erkannte Blätter → Wochen, Stufe, Hinweis «Die Originaldatei bleibt unverändert; vorher entsteht ein Wiederherstellungspunkt», R-8.2-22, R-5.6-05) → «Importieren» → modaler Fortschritt «Import läuft …» mit «Blatt 2 von 4 (Wo 1) · 212 Formen gelesen» und «Abbrechen» (schreibt nichts); die Bearbeitung ist bis zum Ende gesperrt (11.2, ADR-006 P.2a) → Banner «Import abgeschlossen … · Rückgängig» und Tab «Importbericht» mit Fokus auf der ersten Meldung.
- Kopf: Dateiname, Zeitpunkt, Blatt-Umschalter (ein Segment je Blatt), darunter pro Blatt die drei Zahlen **gelesen = zugeordnet + nicht zugeordnet** (R-8.2-20).
- Meldungen gruppiert: Nicht zugeordnete Formen · Beso und Termintext (Abweichung > 15 Min, ohne Zeit → Bemerkung, Kästchen ohne Text und umgekehrt, gestrichen/geändert übernommen, Nummernfolge) · Überlagerungen (auch Seitenleiste) · Rap-/Beso-Spalte · Farben · Zerlegung unsicher · Kanten neben der 15-Min-Linie (gruppiert, einzeln aufklappbar; Q-006) · **Zeichen ersetzt**: Zeichen ohne Glyphe in der Druckschrift stehen im Plan als «?»; die Meldung (Stufe Warnung) nennt Originalzeichen, Eintrag und nächsten Schritt (12 «Zeichen (Import)»; ADR-003 AR0-13; Code `missingGlyph`, E1-08). Ansicht 13b.
- Bedienung wie Befundliste (Leertaste/Enter), jede Meldung mit Sprung zur Stelle (R-8.2-21). Angesprungene Meldungen werden als «angesehen» abgehakt (nur Anzeige, dient der Nacharbeit 14.1).
- **Nicht zugeordnete Form:** Sprung zeigt sie als gestrichelten Geist an der Originallage mit Beschriftung (Ansicht 07); das Seitenfeld zeigt Rohtext und Füllfarbe mit «Als Block anlegen» (Werte vorbelegt) und «Verwerfen».
- Der Bericht bleibt beim Plan (Planmenü «Importbericht anzeigen») bis zum nächsten Import.

## 10 Dialoge

Suite-`Modal` (`<dialog>`, `aria-labelledby`, Fokusfalle, Esc schliesst, Fokus kehrt zum Auslöser zurück). Primärknopf rechts; **Ctrl+Enter** bestätigt in jedem Dialog, **Enter** in einfachen Formularen. Bei gefährlichen Aktionen liegt der Anfangsfokus auf der sicheren Wahl. Einzige Ausnahme vom Esc-Verhalten: «Sicherung vor dem Update» (unten, 19 F-10).

| Dialog | Inhalt | Quelle |
| --- | --- | --- |
| Neuer Plan aus Vorlage (01b) | Vorlage Kp/Bat (Bat ab Etappe 3 aktiv), Startdatum KVK-Montag (Anfangsfokus), Anzahl Wochen (4), Vorschau der Wochen mit KW; kein Montag → Meldung mit Knopf «Montag, 28.09.2026 übernehmen» | R-5.2-01; F-15 |
| Neuen Stand setzen (08) | Datum (heute, Anfangsfokus), Version (+1, nur aufsteigend); Liste der Folgen (Nummern fixiert, n gestrichene Einträge entfernt, «geändert» zurückgesetzt, Wiederherstellungspunkt, identisches PDF jederzeit); Hinweis auf offene Fehler ohne Sperre. «Stand setzen» startet den modalen Fortschritt «Stand wird gesetzt …» (11.2, Ansicht 08b) | R-5.5-03, -04, -06; R-5.6-07; F-28, F-47 |
| PDF-Export (09, 09b) | Umfang «Diese Woche | Ganzer Plan»; Fassung als `radiogroup` «Arbeitsfassung | Stand V‹n› vom ‹dd.mm.yyyy›» (ohne Stand nur «Arbeitsfassung», als Text); «Status rot darstellen», «A3»; Hinweis bei Änderungen seit dem Stand (12 «Stand veraltet»); Befunde der betroffenen Woche(n); Dateiname nach Konvention; «Vorschau». Mit Fehlern: Knopf «Trotzdem exportieren», Anfangsfokus «Abbrechen». Einzelheiten unten | R-5.5-01, -02, -06; R-7-04, -05; R-6-10 bis -12; R-10 Status; ADR-002 P.6a; ADR-005 P.3 |
| Plan-Datei öffnen – Konflikt (10) | `alertdialog` «Plan-Datei öffnen»: Vergleich lokal/Datei (zuletzt geändert, Stand, Wochen · Einträge), Optionskarten (`radio`) «Behalten» (Vorauswahl, wenn lokal neuer), «Ersetzen», «Als Kopie öffnen»; fragt auch, wenn lokal älter (dann Vorauswahl «Ersetzen»); Knöpfe «Übernehmen», «Abbrechen». «Ersetzen» siehe unten | R-5.6-13; F-21; ADR-006 P.2b; E1-11 |
| Datei einer neueren Version | Fehlermeldung, Datei unverändert, nächster Schritt | R-5.6-17 |
| Wiederherstellungspunkte (Liste wie im Popover 11b; Abschnitt «Gelöschte Pläne» in 13b) | `dialog` «Wiederherstellungspunkte» (E1-16): Liste mit Zeitpunkt, Grund, Umfang. Gründe mit Oberflächentext gemäss Glossar «Grund (Wiederherstellungspunkt)»: «täglich», «vor Import», «vor Übernahme», «vor Stand V‹n›», «vor Update», «vor Wiederherstellung», «vor Ersetzen», «vor Löschen». «Wiederherstellen» ohne zweite Rückfrage, weil rückgängig machbar (Toast mit «Rückgängig»); vorher entsteht ein Punkt «vor Wiederherstellung»; «Ältere löschen …». Darunter eingebettet der Abschnitt `region` «Gelöschte Pläne» – Komponente `files.DeletedPlansSection` (Besitz E1-11, eingebettet von E1-16), dieselbe wie im Erststart; nur wenn `listDeletedPlans` Einträge liefert: je Plan `name`, «gelöscht am ‹deletedAt›», «wiederherstellbar bis ‹expiresAt›» (dd.mm.yyyy), Knopf «Wiederherstellen» (`restoreDeletedPlan(restorePointId)`) | R-5.6-08, -09; ADR-006 P.1, P.2b |
| Tag neu nummerieren | Vorschau-Tabelle «alt → neu» je Beso, Verweise in Titeln | R-5.3-08, -12 |
| Auch an anderen Tagen | 5.8 | R-6-01 |
| Gehe zu (Ctrl+G) | eine Zeile: «Mo 0800 COBRA 10», «Di», «21» (Beso-Nr), Titelanfang; Vorschlagsliste; Enter springt | Entscheid UI |
| Quittieren | 8.2 | R-7-34 |
| Plan löschen (13b) | `dialog` «Plan löschen»: Name zur Bestätigung eintippen («Plan löschen» erst dann aktiv), Knopf «Vorher Plan-Datei sichern», Anfangsfokus im Namensfeld, Esc bricht ab. Danach Toast mit «Rückgängig», siehe unten | Beschrieb 5.6; ADR-006 P.2b; E1-11 |
| Sicherung vor dem Update (15) | `alertdialog` «Sicherung vor dem Update» vor einer Schema-Migration; siehe unten | ADR-006 P.2c; E1-04, E1-11 |
| Erinnerung beim Verlassen | 11.4 | R-5.6-10 |

**PDF-Export: Fassung, Varianten, Dateiname** (ADR-002 P.6a, ADR-005 P.3 und P.4, E1-05, E1-16)

- **Arbeitsfassung:** alle Optionen frei («Status rot darstellen», «A3»). Dateiname nach Konvention mit dem Datum des geltenden Stands (`…_Wo1_Stand_2026-09-17.pdf`, R-6-10 bis -12). **Vor dem ersten Stand** endet er auf `…_<Kurzname>_Entwurf.pdf` **ohne Datum** (z.B. `01_02_WAP_FDT_2026_Wo1_Entwurf.pdf`), damit derselbe Plan an jedem Tag dasselbe PDF ergibt; ein Hinweis im Dialog sagt es und bietet «Neuen Stand setzen …» (Ansicht 09; Frage V-05-1 in Q-010).
- **Gespeicherter Stand** («Stand V‹n› vom …», auch der geltende): Ausgegeben werden die beim Setzen gespeicherten Bytes. Welche Varianten gespeichert sind, regelt **G-12** (ADR-002 P.6a; entschieden Gate 0 (02.10.2026): **G-12 a**); der Dialog bietet genau die gespeicherten an:
  - **G-12 a (entschieden Gate 0, 02.10.2026):** nur A4 mit Status rot. Es gilt der Rest dieses Punkts (Ansicht 09b).
  - **G-12 b:** A4 und A3, je mit Status rot. «A3» ist wählbar; nur «Status rot darstellen» ist gesperrt, Hinweis: «Für frühere Stände gibt es nur die gespeicherten Fassungen (A4 oder A3, Status rot). Ohne rote Status-Darstellung «Arbeitsfassung» wählen.»
  - **G-12 c:** alle vier Kombinationen. Nichts ist gesperrt, kein Hinweis.

  Bei G-12 a sind «A3» und «Status rot darstellen» deaktiviert (`disabled`, Wert sichtbar: rot an, A3 aus) und tragen per `aria-describedby` den Hinweis unter den Kästchen: «Für frühere Stände gibt es nur die gespeicherte Fassung (A4, Status rot). Für A3 oder ohne rote Status-Darstellung «Arbeitsfassung» wählen.» Dazu ein Info-Callout: «Die gespeicherte Fassung vom 17.09.2026 wird unverändert ausgegeben. Die 12 Änderungen seit dem Stand sind nicht enthalten.» Wechselt die Fassung zurück auf «Arbeitsfassung», gelten die zuletzt gewählten Optionen wieder (Ansicht 09b).
- Befunde beim gespeicherten Stand: 19 F-9.

**Ersetzen und Plan löschen** (ADR-006 P.2b, E1-04 `replaceFromFile`, `deletePlan`, `restoreDeletedPlan`)

- **Ersetzen:** Vor dem Ersetzen entsteht ein Wiederherstellungspunkt «vor Ersetzen»; das Ersetzen ist ein Historienschritt. Danach Toast «Plan durch «‹Datei›» ersetzt. Der vorherige Stand ist als Wiederherstellungspunkt gesichert.» mit «Rückgängig» (= Ctrl+Z; Beschriftung des Rückgängig-Knopfs «Rückgängig: Plan durch Datei ersetzt»). Die Optionskarte sagt es vorab: «Vorher entsteht ein Wiederherstellungspunkt. Rückgängig machbar (Ctrl+Z).»
- **Plan löschen:** Vor dem Löschen entsteht ein Wiederherstellungspunkt «vor Löschen». Danach öffnet die Route den zuletzt benutzten anderen Plan bzw. den Erststart, und ein Toast sagt «Plan «‹Name›» gelöscht. 30 Tage über «Wiederherstellungspunkte» wiederherstellbar.» mit «Rückgängig» (stellt den Plan aus dem Punkt wieder her und öffnet ihn). Der Toast folgt dem Suite-Verhalten (7 s mit Aktion, beim Überfahren angehalten, 11.5). Das Löschen ist kein Schritt der Plan-Historie (der Plan ist weg); der Weg zurück ist der Toast oder der Abschnitt «Gelöschte Pläne» (`files.DeletedPlansSection`, E1-11). Er ist im Dialog «Wiederherstellungspunkte» eingebettet und erscheint im Erststart hinter dem Link «Gelöschte Pläne (n) …» (11.1); das Speicher-Popover zeigt nur die Zahl mit Knopf «Wiederherstellungspunkte …» (11b). Es gibt keinen eigenen Dialog «Gelöschte Pläne». Daten des Abschnitts: `listDeletedPlans()` (E1-04) mit `name`, `deletedAt`, `expiresAt`, `restorePointId`; angezeigt werden Name, «gelöscht am», «wiederherstellbar bis»; «Wiederherstellen» ruft `restoreDeletedPlan(restorePointId)` auf und öffnet den Plan. Gibt es den Plan inzwischen wieder auf diesem Gerät (z.B. aus der Plan-Datei geöffnet), entsteht eine **Kopie** mit neuer Plan-ID (`asCopy: true`, AR0-51); der vorhandene Plan bleibt unverändert, die Route öffnet die Kopie (Name wie bei «Als Kopie öffnen»: «‹Name› (Kopie dd.mm.yyyy)») und zeigt den Toast 12 «Gelöschter Plan als Kopie wiederhergestellt». Ohne Kopie: Toast «Plan «‹Name›» wiederhergestellt.»

**Sicherung vor dem Update** (ADR-006 P.2c, E1-04 `pendingMigration`, E1-11; Ansicht 15)

- Erscheint beim Öffnen der Route, **bevor** ein Plan geladen wird, wenn die Datenbank ein älteres Schema hat. Hintergrund: Kopfleiste ohne Plan, Arbeitsfläche mit Ladeskelett.
- Inhalt: Titel «Sicherung vor dem Update»; Text «Diese Version speichert Pläne in einem neuen Format. Vorher je Plan eine Plan-Datei im bisherigen Format sichern.»; Tabelle der Pläne (Plan, Stand, zuletzt geändert, Dateiname der Sicherung). Der Dateiname kommt aus `migrationBackupFileName(plan, fromVersion, date)` (E1-04): `<Beilage mit _>_WAP_<Dienst>_Plan_vor-Update_Format<n>_<yyyy-mm-dd>.wap.json`, z.B. `01_02_WAP_FDT_2026_Plan_vor-Update_Format1_2026-10-01.wap.json`; Callout «Geht beim Update etwas schief, arbeitet die vorherige Version des WAP-Planers mit diesen Dateien weiter. Zusätzlich entsteht je Plan ein Wiederherstellungspunkt «vor Update».»; Hinweis «Edge fragt eventuell, ob diese Seite mehrere Dateien herunterladen darf: «Zulassen» wählen.»; aufklappbar «Details» mit «Format 1 → 2».
- Knöpfe: «Plan-Dateien sichern» (Primärknopf, Anfangsfokus, Enter) lädt je Plan eine Datei im bisherigen Format herunter und stellt danach um; «Ohne Sicherung fortfahren» stellt sofort um (nur Wiederherstellungspunkte). Esc schliesst nicht: ohne Entscheid öffnet der WAP-Planer keinen Plan (Abweichung vom Suite-`Modal`, begründet). Neuladen zeigt den Dialog erneut, solange nicht umgestellt ist.
- Während der Umstellung Fortschritt «Pläne werden umgestellt … (1 von 2)»; danach Toast «2 Pläne ins neue Format umgestellt. 2 Plan-Dateien gesichert.» Scheitert die Umstellung, bleibt die Datenbank unverändert (IndexedDB rollt zurück) und die Meldung 12 «Update gescheitert» erscheint (Ansicht 13b).

## 11 Leer-, Lade-, Fehlerzustände und Speicher

### 11.1 Leerzustände (Beschrieb 5.7; R-5.7-01, -02)

- **Erststart** (01): nur wenn kein Plan lokal liegt; sonst öffnet `/wap` den zuletzt benutzten Plan. Drei Karten mit Kürzeln **N**, **O**, **I**, Anfangsfokus auf der ersten; Hinweis «Alles bleibt auf diesem Gerät»; ist der WAP-Planer als lokale Datei geöffnet (`file://`), folgt in derselben Zeile der Knopf «Hinweis zum gemeinsamen Speicher …» (11.6). Gibt es gelöschte Pläne mit Wiederherstellungspunkt (30 Tage, ADR-006 P.2b), steht darunter der Link «Gelöschte Pläne (n) …» (öffnet den Abschnitt «Gelöschte Pläne», 10).
- **Leere Woche ohne Spaltensatz** (02): Spaltenköpfe «Kein Spaltensatz», Karte «Wo 1 ist noch leer – Nächster Schritt: für die Tage einen Spaltensatz wählen …» mit den Maus- und Tastaturwegen und «Spaltensatz für Mo–Fr wählen …».
- **Woche mit Spaltensatz, ohne Einträge:** Karte klein unten links: «Einträge ins Raster ziehen oder N drücken»; ab Etappe 2 zusätzlich «Tagesablauf anwenden».
- Leere Befundliste, Liste ohne Treffer, kein Importbericht: Suite-`.empty` mit Ursache und Aktion.

### 11.2 Laden und Fortschritt

- Route-Start: Skelett erst nach 300 ms; das Raster erscheint erst, wenn die Druckschrift geladen ist (ADR-004 Punkt 4).
- Import, PDF (> 1 s), Wiederherstellen: Fortschritt mit Schritt («Woche 3 von 4»).
- **Gewöhnlicher PDF-Export** (Arbeitsfassung oder gespeicherter Stand): nicht modal (Fortschritt im Toast-Bereich); die Bearbeitung bleibt möglich, der Export verwendet den Zustand beim Start (E1-16).
- **«Neuen Stand setzen» und Import sperren die Bearbeitung** (ADR-006 P.2a, AR0-25; E1-05, E1-08, E1-16): modaler Fortschritt (`dialog`, Fokusfalle) «Stand wird gesetzt …» bzw. «Import läuft …» mit Schritt («PDF Woche 3 von 4» bzw. «Blatt 2 von 4 (Wo 1) · 212 Formen gelesen») und Knopf «Abbrechen» (Anfangsfokus). Komponente `flows.BlockingProgress` (E1-16); sie fängt alle Tastatur- und Zeigereingaben der Route ab. **Ab dem Schreiben (Schritt 3 in E1-05 bzw. E1-08) ist «Abbrechen» deaktiviert** (`disabled`, sichtbar ausgegraut, keine Esc-Wirkung) und der Schritt lautet «Stand wird gespeichert (Schritt 3 von 3)» bzw. «Import wird gespeichert (Schritt 3 von 3)»; ein Text unter dem Fortschritt nennt den Grund, per `aria-describedby` am Knopf: «Das Speichern hat begonnen: «Abbrechen» ist nicht mehr möglich, der Stand wird vollständig gesetzt.» (beim Import: «… der Import wird vollständig übernommen.»). Der Fokus wechselt dabei vom Knopf auf den Dialog (`tabindex=-1`), und eine höfliche Ansage liest den Text vor (Entscheid UI; Abbruchgrenze nach AR0-40, E1-05). **Vor Schritt 3 (Schritte 1–2: Lesen, PDF erzeugen bzw. Excel lesen) wirkt «Abbrechen» sofort**, auch wenn das Rendern noch läuft oder hängt: Der Dialog schliesst ohne Warten auf den Renderer, der Ablauf endet mit `StandError 'aborted'` bzw. `ImportError 'aborted'`, nichts wird geschrieben, und ein später fertiges Render-Ergebnis wird verworfen (E1-05, E1-08, AR0-49). Die Sperre endet mit dem Schliessen; der Fokus kehrt zum Auslöser zurück. Meldung als Toast «Stand nicht gesetzt: abgebrochen.» bzw. «Import abgebrochen. Der Plan ist unverändert.» (`aborted` ist kein Fehler, darum keine Fehlermeldung). Esc wirkt bis Schritt 3 wie «Abbrechen». Es gibt keinen Zwischenzustand «wird abgebrochen …». Raster, Seitenfeld, Liste, Rückgängig/Wiederholen, Tastenbefehle und Befehlspalette sind in dieser Zeit inaktiv (unter dem Dialog, `inert`). Scheitert das Schreiben, weil sich der Plan trotzdem geändert hat (`StorageError 'conflict'`), erscheint die Meldung 12 «Stand nicht gesetzt – Plan wurde geändert» bzw. «Import nicht übernommen – Plan wurde geändert». Ansicht 08b.

### 11.3 Speicheranzeige (Beschrieb 5.6 Pkt 1; R-5.6-02, -03)

- Kopfleiste: «gespeichert 14:32 | Datei-Sicherung vor 2 Tagen» und Knopf «Datei sichern». «hh:mm» ist die einzige Uhrzeit mit Doppelpunkt (Glossar, Zeitangabe). Die Anzeige wechselt erst nach erfolgreicher Transaktion (ADR-006 Punkt 2); dauert Speichern länger als 300 ms: «wird gespeichert …».
- «Datei-Sicherung» ist «noch nie», «heute», «gestern», «vor n Tagen». Älter als 24 h mit ungesicherten Änderungen (F-19): Warnfarbe mit Dreieck, «Datei sichern» wird Primärknopf.
- Klick auf die Anzeige öffnet das **Speicher-Popover** (11b): zuletzt gespeichert, Datei-Sicherung, dauerhaft ja/nein, Belegung, Wiederherstellungspunkte mit «Wiederherstellen»; bei gelöschten Plänen eine Zeile «Gelöschte Pläne (n)» mit Knopf «Wiederherstellungspunkte …», der den Dialog mit dem eingebetteten Abschnitt öffnet.

### 11.4 Speicherwarnungen und Erinnerung (Beschrieb 5.6 Pkt 3, 4; R-5.6-10 bis -12)

- **Nicht dauerhaft** (`persisted()` false, ADR-006): gelbes Banner beim ersten Öffnen eines Plans in der Sitzung, schliessbar für die Sitzung; danach bleibt ein Warnpunkt in der Speicheranzeige. **Sitzung** heisst hier: bis zum Schliessen des Tabs (`sessionStorage`). Neuladen gehört zur selben Sitzung, ein neuer Tab beginnt eine neue (Unterpunkt «Wiederholung»). Text: «Speicher nicht dauerhaft: Der Browser darf die Pläne bei Platzmangel löschen. Plan-Datei regelmässig sichern.»
  - **Gestaltung als Dauerzustand.** Auf dem Dienstlaptop gewährt Edge `persist()` unter `file://` nicht (Umgebungsprobe 01.10.2026; ADR-006 «Folgen» und «Abschluss mit der Umgebungsprobe»). Die Warnung ist dort der Normalfall und steht bei jedem Arbeiten an. Sie bleibt deutlich im Sinn von Beschrieb 5.6 Pkt 4 (R-5.6-11), ist aber ruhig gestaltet, stört die Arbeit nicht und bleibt erkennbar (Entscheid UI):
    - **Ton:** gelbes Banner (`.banner-warning`, Dreieck, Kontrast ≥ 4,5:1) mit dem sachlichen Text oben, ohne Ausrufezeichen und ohne Wörter wie «Achtung» oder «Gefahr». `role="status"` mit dem zugänglichen Namen «Speicherhinweis» (`aria-label`), nie `role="alert"`. Keine Animation, kein Blinken, kein Ton. Das Banner nimmt nie den Fokus; Anfangsfokus und Tastaturwege der Route bleiben unverändert.
    - **Platz:** eine Zeile in der Bannerzone zwischen Kopfleiste und Werkzeugleiste. Die Knöpfe sind «Mehr erfahren» (öffnet das Speicher-Popover, 11.3) und «Hinweis schliessen» (`btn-ghost btn-icon`, Kreuz, per Tab erreichbar). Kein Primärknopf, denn «Datei sichern» steht schon in der Kopfleiste. Das Banner erscheint nur beim Öffnen des Plans, nie mitten in der Arbeit, damit das Raster unter der Hand nicht springt. Steht gleichzeitig ein rotes Banner (voll, Schreibfehler), liegt das rote oben; das gelbe bleibt darunter und kann weiterhin geschlossen werden.
    - **Wiederholung:** einmal je Sitzung (bis zum Schliessen des Tabs, `sessionStorage`) beim ersten Öffnen eines Plans. Bis zum Schliessen bleibt es stehen, auch beim Wechsel des Plans. Nach dem Schliessen kommt es in derselben Sitzung nicht wieder, auch nicht beim Neuladen oder beim Wechsel des Plans. Der Text ist genau der oben genannte, ohne Zusätze; den Verweis auf die Speicheranzeige übernimmt der Warnpunkt. Sichtbar bleibt dauerhaft der Warnpunkt an der Speicheranzeige: kleines gelbes Dreieck, also Form und nicht nur Farbe, mit `title` und verborgenem Text «Speicher nicht dauerhaft», der Teil des Namens des Knopfs der Speicheranzeige ist (E1-11). Im Speicher-Popover steht die Zeile «Dauerhaft: nein» mit dem Warntext: «Der Browser darf die Pläne bei Platzmangel löschen. Plan-Datei regelmässig sichern.» Das ist der Bannertext ohne den Vorspann «Speicher nicht dauerhaft:». Die Warnung selbst eskaliert nicht. Wachsam hält die Erinnerung zur Datei-Sicherung (11.3 Warnfarbe nach F-19, Erinnerung beim Verlassen; Beschrieb 5.6 Pkt 3), denn sie ist bei nicht dauerhaftem Speicher der eigentliche Schutz (ADR-006 «Folgen»).
    - **Ende:** Meldet `persisted()` später true, entfallen Banner und Warnpunkt ohne eigene Meldung.
- **Voll oder > 80 %:** ab 80 % gelbes Banner mit «Speicher verwalten …»; bei Schreibfehler (`QuotaExceededError`) rotes Banner `role="alert"`, nicht schliessbar bis gelöst, Speicheranzeige «Nicht gespeichert», Primärknopf «Datei sichern» (Ansicht 11). Die Änderung bleibt im Fenster (ADR-006 Punkt 3); zusätzlich hält `beforeunload` das Schliessen auf.
- **Erinnerung beim Verlassen:** Beim Verlassen der Route innerhalb der Suite eigener Dialog «Letzte Datei-Sicherung vor 3 Tagen … Jetzt sichern | Später». Beim Schliessen des Tabs nur der Standarddialog des Browsers (Text nicht beeinflussbar), ausgelöst nach F-19.
- **Zweiter Tab:** Hinweis «Nur lesen – der Plan ist in einem anderen Tab geöffnet …» mit «Bearbeitung hierher holen» (ADR-006 Punkt 4).

### 11.5 Rückmeldungen

- Suite-Toast (`role="status"`) für Sammelaktionen, Löschen, Wiederherstellen, Import, Datei sichern, Ersetzen aus der Plan-Datei, Plan löschen, Update; mit «Rückgängig», wo sinnvoll (immer bei Ersetzen und Plan löschen, 10; nicht nach dem Wiederherstellen eines gelöschten Plans, 12); 4,5 s bzw. 7 s mit Aktion, beim Überfahren angehalten (Suite-Verhalten).
- Rückgängig/Wiederholen sagen an, was geschah («Rückgängig: 4 Einträge an Di–Fr entfernt»), wechseln bei Bedarf die Woche und wählen das Betroffene.

### 11.6 Hinweis zum gemeinsamen Browserspeicher unter `file://` (Gate-0-Entscheid 2 = G-9 a; R-L-09)

Quelle: Gate-0-Vorlage `gates/gate-0.md` Entscheid 2 («Ein Hinweis erscheint in der Hilfe»), ADR-006 «Folgen» G-9, R-L-09, im Katalog übernommen (Runde 6b, `requirements.md`; Herkunft `plan/katalog-ergaenzung-e1.md`, Paket E1-11). Unter `file://` teilen alle lokal geöffneten HTML-Dateien desselben Edge-Profils einen Speicher; der Auftraggeber nimmt das hin. Der Hinweis informiert, er warnt nicht (Entscheid UI): Es gibt nichts zu beheben, nur eine Empfehlung fürs Verhalten.

- **Ort (verbindlich): Hilfe der Route.** Die Hilfe des WAP-Planers ist die WAP-Übersicht hinter «?» (Ansicht 14, 13.2, 18 S-4), `dialog` «Tastenkürzel – WAP-Planer». Sie erhält als **letzten Abschnitt** nach den Kürzelgruppen den Abschnitt «Gemeinsamer Browserspeicher». Er ist statischer Hilfetext: Suite-`.callout` in neutraler Info-Gestaltung (Info-Symbol, nicht gelb, nicht rot), Kontrast ≥ 4,5:1 (14.1).
- **Zugänge** (Maus und Tastatur, R-L-09):
  1. «?» bei Fokus ausserhalb eines Eingabefelds (route-weit, 13.2) oder der Kopfleisten-Knopf **«Tastenkürzel»** (Rolle `button`, zugänglicher Name «Tastenkürzel», Ikonenknopf mit Tooltip «Tastenkürzel (?)», `aria-haspopup="dialog"`; rechts in der Kopfleiste, 2.2): öffnet die Übersicht; der Abschnitt ist mit Tab bzw. Bild↓ erreichbar.
  2. **Erststart:** Knopf «Hinweis zum gemeinsamen Speicher …» (`btn-link`, in der Zeile «Alles bleibt auf diesem Gerät», 11.1). Er öffnet dieselbe Übersicht, rollt zum Abschnitt und setzt den Fokus auf dessen Überschrift (`tabindex="-1"`). Er ist ein Tab-Stopp nach den drei Karten und vor «Gelöschte Pläne (n) …»; der Anfangsfokus bleibt auf der ersten Karte (13.4).
  3. **Befehlspalette** (Ctrl+K, Gruppe «WAP-Planer»): Befehl «Hinweis zum gemeinsamen Speicher», Wirkung wie 2. So ist der Hinweis auch bei geöffnetem Plan direkt erreichbar, ohne die Übersicht zu durchblättern; in der Palette wird der Befehl wie jeder andere über deren Sucheingabe gewählt.

  Esc schliesst die Übersicht; der Fokus kehrt zum Auslöser zurück (10, Suite-`Modal`).
- **Auslöser:** nur wenn die Seite als lokale Datei geöffnet ist (`location.protocol === "file:"`). Dann stehen Abschnitt, Erststart-Knopf und Palettenbefehl immer da, unabhängig von Sitzung, Plan und Speicherzustand. Unter einer anderen Adresse (Entwicklungsserver, später gehostet) fehlen alle drei, weil die Aussage dort nicht zutrifft. Kein Banner, kein Toast, keine Ansage, keine Wiederholung: Der Hinweis erscheint nie von selbst und nimmt nie den Fokus. Das gelbe Banner «Speicher nicht dauerhaft» (11.4) bleibt davon getrennt und wird nicht erweitert.
- **Text** (verbindlich; Aufbau nach 12 Regel 1: Ursache, Folge, nächster Schritt; Begriffe nach Glossar):
  - Überschrift (h3): **Gemeinsamer Browserspeicher**
  - Absatz: «Der WAP-Planer ist als lokale Datei geöffnet. Der Browser legt die Pläne deshalb in einem Speicher ab, den alle lokal geöffneten HTML-Dateien in diesem Edge-Profil gemeinsam nutzen. Eine solche Datei kann die Pläne lesen. Im selben Edge-Profil deshalb keine fremden HTML-Dateien öffnen, sondern nur die Suite und den WAP-Planer aus bekannter Quelle.»
  - Aufklappbar «Details» (12 Regel 4): «Bei Adressen, die mit «file://» beginnen, behandelt der Browser alle lokalen Dateien als dieselbe Herkunft. Das ist eine Eigenschaft des Browsers und kein Fehler des Plans.»
- **Rolle und zugänglicher Name** (für Vertrag E1-11; Tests greifen darüber zu, 14.2):
  - Abschnitt: `region` (`<section aria-labelledby>` → Überschrift), zugänglicher Name **«Gemeinsamer Browserspeicher»**, innerhalb des `dialog` «Tastenkürzel – WAP-Planer». Kein `status`, kein `alert`, kein `aria-live`.
  - Erststart-Knopf: `button` mit Namen **«Hinweis zum gemeinsamen Speicher …»**, `aria-haspopup="dialog"`.
  - Palettenbefehl: Eintrag (`option` der Suite-Befehlspalette) **«Hinweis zum gemeinsamen Speicher»**.
- **Statische Ansichten:** 01 und 14 zeigen den Hinweis noch nicht; massgeblich ist dieser Abschnitt.

## 12 Meldungstexte (Beschrieb 5.7, 11; R-5.7-03, R-11-06)

**Regeln**

1. Aufbau: **Was ist passiert** (konkret, mit Objekt in «»), **Folge** (was geschah nicht, sind die Daten sicher), **nächster Schritt** als Satz im Infinitiv und, wo möglich, als Knopf. Kein Abbruch ohne Meldung (R-5.7-04).
2. Unpersönlich wie die Suite («Zum Weiterplanen eine Arbeitskopie öffnen.»); keine Anrede, kein Ausrufezeichen, keine Schuldzuweisung.
3. Schweizer Schreibweise: «ss», Anführungszeichen «», Zeiten 0700 und 1300-1600, Daten dd.mm.yyyy, kompakt «Sa 10.10.26» nur im Tageskopf, Armeeabkürzungen unverändert (Beschrieb 10 Daten, 11). Begriffe nach Glossar («Befund», nie «Fehler» für alle Stufen; «Plan-Datei», nie «Backup»).
4. Technische Angaben (Fehlername, Formatnummer) nur in einem aufklappbaren «Details».
5. Knöpfe sind Verben mit Objekt: «Datei sichern», «Stand setzen», «Trotzdem exportieren»; nie «OK».

**Katalog (verbindliche Beispiele)**

| Anlass | Text |
| --- | --- |
| P1 | «Ausb Mö» liegt in einer Spalte, die es nicht mehr gibt. Spalte HAWK fehlt im Spaltensatz vom Di 06.10.2026. Nächster Schritt: Spalte wählen (S) oder den Spaltensatz des Tages anpassen. |
| P8 | Text von «Einrichten Ukft/Mag …» passt auch mit 4,5 pt nicht. Im PDF gekürzt auf «Einrichten Ukft/…». Titel kürzen, Block vergrössern oder Zusatzzeilen entfernen. |
| P16 | 2 Einträge liegen am So 11.10.2026, der ausgeblendet ist. Tag wieder einblenden oder die Einträge verschieben. |
| P17 | Am Fr 09.10.2026 sind 11 Beso erfasst; der Nummernkreis 50–59 ist voll. Der 11. Beso hat keine Nummer («–»). Beso zusammenlegen oder als Block erfassen. |
| Zeit | «0833» liegt nicht im 5-Minuten-Raster. Zeiten auf 5 Minuten eingeben, z.B. 0830 oder 0835. (F-18) |
| Startdatum | Der 30.09.2026 ist ein Mittwoch. Wochen beginnen am Montag. [Montag, 28.09.2026 übernehmen] (F-15) |
| Datei neuer | «FDT_2026_Kp.wap.json» wurde nicht geöffnet. Die Datei stammt aus einer neueren Version des WAP-Planers. Die Datei bleibt unverändert. Nächster Schritt: die neueste Version des WAP-Planers öffnen und die Datei dort laden. (R-5.6-17) |
| Keine Plan-Datei | «Liste.json» ist keine Plan-Datei des WAP-Planers. Nichts wurde geändert. Eine mit «Datei sichern» erstellte Datei wählen. |
| Excel alt | Import nicht möglich. «WAP.xls» ist im alten Excel-Format (.xls). Die Datei in Excel öffnen, als «Excel-Arbeitsmappe (.xlsx)» speichern und erneut importieren. |
| Schrift | Das Raster kann nicht gezeichnet werden. Die Druckschrift (Arimo) liess sich nicht laden; mit einer Ersatzschrift würden Texte anders umbrechen als im PDF. Seite neu laden (F5). Hilft das nicht: Plan-Datei sichern und den WAP-Planer in Microsoft Edge öffnen. (ADR-004) |
| Speicher voll | Änderungen werden nicht mehr gespeichert: Der lokale Speicher ist voll (98 %). Die letzten 3 Änderungen sind nur in diesem Fenster vorhanden. Jetzt die Plan-Datei sichern, danach alte Wiederherstellungspunkte löschen. |
| PDF mit Fehlern | 2 Fehler in Wo 1: Das PDF würde Regelverstösse enthalten. [Abbrechen] [Trotzdem exportieren] (R-7-05) |
| Stand veraltet | Seit Stand V1 wurden 12 Einträge geändert. Das PDF trägt trotzdem «Stand 17.09.2026». Für eine neue gültige Fassung zuerst den Stand setzen. |
| Noch kein Stand | Noch kein Stand gesetzt. Das PDF ist eine Arbeitsfassung; der Dateiname endet auf «_Entwurf» und enthält kein Datum. Für eine gültige Fassung zuerst den Stand setzen. [Neuen Stand setzen …] (ADR-005 P.3, E1-05) |
| Früherer Stand: Optionen gesperrt | Bei G-12 a (Vorgabe): Für frühere Stände gibt es nur die gespeicherte Fassung (A4, Status rot). Für A3 oder ohne rote Status-Darstellung «Arbeitsfassung» wählen. Bei G-12 b: Für frühere Stände gibt es nur die gespeicherten Fassungen (A4 oder A3, Status rot). Ohne rote Status-Darstellung «Arbeitsfassung» wählen. Bei G-12 c: kein Hinweis. (ADR-002 P.6a, E1-16) |
| Stand nicht gesetzt – Plan wurde geändert (`conflict`) | Titel (Glossar): **Stand nicht gesetzt – Plan wurde geändert**. Text (Vertrag E1-05): Der Plan wurde während des Stand-Setzens geändert. Kein Stand gesetzt; die Änderung ist gespeichert. Stand erneut setzen. [Neuen Stand setzen …] (`alertdialog`; ADR-006 P.2a) |
| Import nicht übernommen – Plan wurde geändert (`conflict`) | Titel (sinngemäss nach Glossar): **Import nicht übernommen – Plan wurde geändert**. Text: Der Plan wurde während des Imports geändert. Nichts wurde importiert; die Änderung ist gespeichert. Import erneut starten. [Excel-WAP importieren …] (`alertdialog`; E1-08, ADR-006 P.2a) |
| Abgebrochen (Stand, Import) | Stand nicht gesetzt: abgebrochen. / Import abgebrochen. Der Plan ist unverändert. (Toast, ADR-006 P.2a) |
| Früherer Stand: Inhalt | Die gespeicherte Fassung vom 17.09.2026 wird unverändert ausgegeben. Die 12 Änderungen seit dem Stand sind nicht enthalten. |
| Zeichen (Eingabe) | Das Zeichen «✓» gibt es in der Druckschrift nicht; es würde im PDF anders erscheinen. Ein anderes Zeichen verwenden. (Wortlaut E1-12; Wert nicht übernommen) |
| Zeichen (Import) | Zeichen ersetzt: In «Ausb ? Gef S» (Mi 0800) stand «✓». Die Druckschrift kennt dieses Zeichen nicht; im Plan steht dafür «?». Titel prüfen und das «?» durch Text ersetzen. (ADR-003 AR0-13) |
| Ersetzt | Plan durch «FDT_2026_Kp.wap.json» ersetzt. Der vorherige Stand ist als Wiederherstellungspunkt gesichert. [Rückgängig] (ADR-006 P.2b) |
| Plan gelöscht | Plan «FDT 2026 «BEISPIEL»» gelöscht. 30 Tage über «Wiederherstellungspunkte» wiederherstellbar. [Rückgängig] (ADR-006 P.2b) |
| Gelöschter Plan als Kopie wiederhergestellt | «FDT 2026 «BEISPIEL»» ist auf diesem Gerät wieder vorhanden. Der gelöschte Stand wurde als Kopie wiederhergestellt. (Toast `role="status"`, ohne «Rückgängig»; nach `restoreDeletedPlan` mit `asCopy: true`, E1-04, AR0-51) |
| Sicherung vor dem Update | Diese Version speichert Pläne in einem neuen Format. Vorher je Plan eine Plan-Datei im bisherigen Format sichern. [Plan-Dateien sichern] [Ohne Sicherung fortfahren] (ADR-006 P.2c, Wortlaut E1-11) |
| Update gescheitert | Die Pläne wurden nicht ins neue Format umgestellt. Die Umstellung brach bei «FDT 2026 «BEISPIEL»» ab; alle Pläne sind unverändert im bisherigen Format. Seite neu laden (F5). Hilft das nicht: mit der vorherigen Version des WAP-Planers weiterarbeiten und die gesicherte Plan-Datei öffnen. [Neu laden] (ADR-006 P.2c) |

## 13 Tastaturkonzept (Beschrieb 5.1, 6 «Tastatur», 11; R-11-07, -08, R-6-23 bis -27)

### 13.1 Grundsätze

1. **Drei Ebenen:** (a) Route-weite Kürzel mit Ctrl (wirken auch bei Fokus auf `body`); (b) Einzeltasten nur bei Fokus im Raster und ausserhalb von Eingabefeldern – wie die Suite-Planung (`N`, `F`, `T` in `PlanningPage.tsx`); (c) alles Übrige über die Befehlspalette Ctrl+K (3 Aktionen).
2. **Keine Ctrl+Alt-Kombinationen:** Auf der Schweizer Tastatur ist AltGr = Ctrl+Alt (@ = AltGr+2, # = AltGr+3, € = AltGr+E); jede Ctrl+Alt-Belegung würde Zeichen der Schnelleingabe verschlucken.
3. **Keine Alt+Buchstabe und kein Alt+Shift:** Alt+D, Alt+E, Alt+F gehören Edge; Alt+Shift schaltet unter Windows das Tastaturlayout. Alt+←/→ ist Browser-Verlauf.
4. **Nicht belegbar** (Browser behält sie): Ctrl+N, Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+Bild↑/↓, Ctrl+1–9, Ctrl+Shift+N/T/W, F5, F6, F11, F12. Sie werden nicht verwendet.
5. Tasten werden über `event.key` erkannt (layoutunabhängig; «+» ist auf CH-Tastaturen Shift+1).
6. Kürzel erscheinen in Tooltips, Menüs, Seitenfeld-Beschriftungen, Statuszeile und in der Übersicht «?» (Ansicht 14).

### 13.2 Route-weite Kürzel

| Kürzel | Befehl | Konflikt und Auflösung |
| --- | --- | --- |
| Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z | Rückgängig, Wiederholen (WAP-Historie) | Suite belegt dieselben Tasten global für ihr Undo → auf `/wap` delegiert die Shell an den WAP-Planer (18 S-3). In Textfeldern bleibt das native Rückgängig des Felds |
| Ctrl+S | Plan-Datei sichern | Suite: «JSON sichern» → auf `/wap` Plan-Datei (18 S-3) |
| Ctrl+O | Plan-Datei öffnen … | Browser «Datei öffnen» wird in der Route übersteuert |
| Ctrl+P | PDF-Export … | Browser-Druck würde nur den Bildschirm drucken; übersteuert |
| Ctrl+L | Raster ↔ Liste | Browser: Adressleiste (bleibt über Alt+D und F6 erreichbar) |
| Ctrl+F | Suchen/Filtern (Liste ab Etappe 1, Raster ab Etappe 2) | Browsersuche wird in der Route übersteuert (Beschrieb 6 verlangt Ctrl+F) |
| Ctrl+G | Gehe zu … | Browser «Weitersuchen» nur bei offener Suchleiste |
| Ctrl+. | Befundliste | frei |
| F8 / Shift+F8 | Nächster / vorheriger Befund | frei (Konvention aus Entwicklungsumgebungen) |
| Alt+Bild↑ / Alt+Bild↓ | Vorherige / nächste Woche | frei |
| Ctrl+K, Ctrl+B, ?, Alt+1–9 | Suite: Befehle, Seitenleiste, Kürzelübersicht, Werkzeuge | unverändert; «?» zeigt auf `/wap` die WAP-Übersicht (18 S-4), Ctrl+B nicht während Titelbearbeitung (18 S-3) |

### 13.3 Im Raster (Fokus im Raster, keine Bearbeitung)

| Taste | Zellzeiger (leere Zelle) | Eintrag fokussiert |
| --- | --- | --- |
| ← ↑ → ↓ | 1 Spalte / 15 Min; über die Tagesgrenze weiter; ↑ aus der ersten Zeitzeile (0500–0515) → Band (0400–0500, erste Stunde des Anzeigebereichs, kein eigener Streifen; B-F-06, Glossar `querbalkenBand`) → Spaltenkopf → Tageskopf; ↓ aus dem Band → 0500–0515; ↓ unter 2400 → Terminbereich. Ein zeitlicher Eintrag, der vor 0500 beginnt, liegt nicht im Band: Er wird ab Bandende gezeichnet (oberer Rand offen, wahre Zeit im Text) und ist ab 0500–0515 bzw. per Tab erreichbar (F-63 b / Q-013, Arbeitsannahme bis Gate S; Vertrag E1-02d). Bei anderem Anzeigebereich gilt dasselbe für dessen erste Stunde (F-63 a) | Verschieben um 15 Min / 1 Spalte (R-6-23), schon in Etappe 1 (Gate B 28.10.2026 Nr 24 a; früher «ab Etappe 2», 19 F-3) |
| Shift+Pfeile | Zellbereich erweitern (für N) | Grösse ändern (R-6-24), schon in Etappe 1 (Gate B Nr 24 a) |
| Ctrl+Pfeile | Ctrl+←/→: vorheriger bzw. nächster Tag (Gate B 28.10.2026 Nr 24 a, HT-03); Ctrl+↑/↓ ohne Wirkung | Fokus zum Nachbarn, **Auswahl bleibt** |
| Bild↑ / Bild↓ | ± 1 Stunde | – |
| Home / End | Anfang / Ende des Anzeigebereichs | – |
| Ctrl+Home | Tageskopf des ersten Tags | Tageskopf des ersten Tags |
| Tab / Shift+Tab | Nächster / vorheriger Eintrag nach dem Zeiger (Leserichtung: Tag, Sortierzeit, Spalte) | Nächster / vorheriger Eintrag, Auswahl folgt; nach dem letzten Eintrag verlässt Tab das Raster (R-6-27; keine Fokusfalle) |
| Leertaste | – | Nur diesen wählen |
| Ctrl+Leertaste | – | In die Auswahl aufnehmen / entfernen |
| Ctrl+A | Alle Einträge der Woche | dito |
| Enter / F2 | Liegt ein Eintrag auf der Zelle: ihn wählen; sonst Hinweis | Direktbearbeitung (Titel), wie Doppelklick |
| E | – | Seitenfeld, erstes Feld |
| N, B, R, Q, M, G | Neuer Block, Beso, Rapport, Querbalken, Marker, ganztägige Bemerkung am Zellzeiger | – (Tippen ersetzt, siehe nächste Zeile) |
| Tippen (Buchstaben und Ziffern ohne eigene Zeile hier, auch N, B, R, Q, M, G) | – (Einzeltasten wie vorige Zeile) | Startet die Direktbearbeitung im Block und **ersetzt den Text** (wie Excel; R-5.1-29); Gate B 28.10.2026 Nr 23 a (TE-FUX2-03, UX-AB-17; früher «dito, am Ort des Eintrags») |
| Z, T, S, K, L, O | – | Seitenfeld: Zeit, Tag, Spalten, Kategorie, Ltg, Ort (wirkt auf die ganze Auswahl, wo sinnvoll) |
| X | – | Streichen / Streichung aufheben (Status «gestrichen» ↔ «bestätigt») |
| A | – | Auch an anderen Tagen … |
| Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D | Einfügen | Kopieren, Ausschneiden, Einfügen, Duplizieren |
| Entf | – | Löschen (Toast mit Rückgängig) |
| + / − / 0 | Zoom / Einpassen | dito |
| Shift+F10, Menütaste | Kontextmenü | Kontextmenü |
| Esc | – | Auswahl aufheben, Zellzeiger an die Stelle des Eintrags |

Tageskopf fokussiert: ←/→ nächster Tag, Shift+←/→ Bereich, **S** Spaltensatz, **D** Darstellung, Enter Seitenfeld «Tag».

**Reserviert ab Etappe 2:** `/` Schnelleingabe (R-6-17), `V` Tagesablauf anwenden (R-5.4-03), Bausteine über das Kontextmenü und die Palette.

### 13.4 Fokusführung

- Route öffnen: Fokus auf dem Raster (Zellzeiger an der letzten Stelle, sonst Mo, erste Planungsspalte, 0800); Erststart: erste Karte.
- Nach Ziehen oder Tastaturbefehl: erstes Feld der Direktbearbeitung (R-5.1-03). Nach Enter/Esc/Klick ausserhalb: zurück zum Eintrag (bzw. Zellzeiger, wenn verworfen).
- Seitenfeld: Esc oder Enter im letzten Feld gibt den Fokus ans Raster zurück. Feldsprung-Tasten öffnen den Tab «Seitenfeld», wenn ein anderer offen ist.
- Nach Löschen: nächster Eintrag in Leserichtung, sonst Zellzeiger an der Stelle.
- Nach Rückgängig/Wiederholen: betroffener Eintrag, falls nötig in seiner Woche.
- Befundliste/Importbericht: Leertaste lässt den Fokus in der Liste, Enter setzt ihn auf den Eintrag.
- Dialoge: Anfangsfokus gemäss 10; Schliessen gibt den Fokus an den Auslöser zurück (Suite-`Modal`, `CommandPalette`).
- Tab-Reihenfolge der Route: Kopfleiste → Banner → Werkzeugleiste → Raster (ein Tab-Stopp, darin Tab = Einträge) → Seitenbereich → Statuszeile.

### 13.5 Sichtbarer Fokus (R-11-08)

- Bedienoberfläche: Suite-`:focus-visible` (2 px `--accent`, 2 px Abstand; hell 14,84:1, dunkel 14,66:1).
- Papier: `--accent` wäre im dunklen Modus auf Weiss 1,19:1 und verschwindet. Auf dem Papier gilt deshalb die Fokusmarke aus 4.2 (#2d63b5 mit weissem Hof, ≥ 3:1 gegen alle Legendenfarben).
- Listenansicht: Zellzeiger 2 px `--accent` innen.
- **Rohzustand des Rasters vor E1-12** (Vertrag E1-11 §4, PL0-35): Schon der Stub `GridArea` ist ein Container `role="grid"` «Wochenraster ‹Kurzname›, ‹dd.mm.yyyy› bis ‹dd.mm.yyyy›» mit `tabindex="0"` – ein Tab-Stopp in der Reihenfolge aus 13.4 und mit sichtbarem Fokusring. Weil der Container auf der Arbeitsfläche (`--sunken`) und nicht auf dem Papier liegt, gilt der Suite-Fokus (2 px `--accent`, 2 px Abstand, innen gesetzt, damit er nicht abgeschnitten wird). So prüft `[R-L-06]` den Fall «Fokus im Raster» bereits in E1-11. Ab E1-12 kommen Zellzeiger und Eintragsfokus auf dem Papier hinzu (4.2); der Containerring bleibt.
- Fokus ist nie vollständig verdeckt (Direktbearbeitung, Detail-Karte, Toast weichen aus; WCAG 2.4.11).

### 13.6 Ansagen

- Einträge: `aria-label` in Worten (14.2). Zellzeiger: «Montag 05.10.2026, COBRA 10, 0800 bis 0815, leer», gedrosselt auf eine Ansage 300 ms nach der letzten Bewegung.
- Ziehen: Zeitschild-Text als höfliche Ansage beim Einrasten auf eine neue Zeit.
- Neue Fehler, Import- und PDF-Ende, Speicherfehler: Live-Region (Fehler `assertive`, Rest `polite`).

## 14 Barrierefreiheit (Beschrieb 11; R-11-07 bis -09)

### 14.1 Kontrast ≥ 4,5:1 (R-11-09)

Gemessen mit WCAG-2-Formel (Skript im Arbeitsverzeichnis, nicht versioniert):

| Paar | Kontrast | Folge |
| --- | ---: | --- |
| Suite `--text-3` #78827b auf `--surface` / `--bg` (hell) | 3,98 / 3,67 | **ungenügend** → in der Route `--text-3: #5f6962` (5,70 / 5,26) |
| Suite `--text-3` #7c877f auf `--surface` / `--surface-2` (dunkel) | 4,69 / 4,45 | **auf `--surface-2` ungenügend** → in der Route #939e96 (6,30 / 5,99) |
| `--text-2` hell / dunkel | 7,78 / 8,57 | ok |
| Callouts danger / warning / info (hell) | 6,39 / 6,45 / 7,11 | ok |
| Callouts danger / warning / info (dunkel) | 6,88 / 8,20 / 7,59 | ok |
| Suite `.btn-danger` dunkel: Weiss auf #ef6f64 | 2,95 | **ungenügend** → in der Route dunkle Schrift #111612 (6,21) |
| Papier: Schwarz auf «Extern» #bfbfbf / «Ltg S2» #f8cbad | 11,42 / 14,14 | ok |
| Papier: Druckrot #ff0000 auf Weiss / Gelb / Grau | 4,00 / 3,58 / 2,17 | **unter 4,5** → Frage 19 F-1 |

Der Befund zu `--text-3` und `.btn-danger` betrifft die ganze Suite; der WAP-Planer überschreibt nur in seiner Route (18 S-6).

### 14.2 Rollen und Namen

| Element | Rolle / Attribute | Name (Beispiel) |
| --- | --- | --- |
| Arbeitsfläche Raster | `grid`, `aria-multiselectable="true"`, `aria-rowcount`, `aria-colcount`, `aria-describedby` → Kurzhilfe | «Wochenraster Wo 1, 05.10.2026 bis 11.10.2026» |
| Tageskopf | `columnheader`, `aria-selected` | «Montag 05.10.2026, Spaltensatz Woche mit FALCON/HAWK, voll» |
| Spaltenkopf | `columnheader` | «COBRA 10» |
| Zeitbeschriftung | `rowheader` | «0800» |
| Eintrag | `gridcell`, `aria-roledescription` = Typ, `aria-selected`, `aria-rowindex`/`aria-colindex`/`aria-colspan`, `aria-describedby` → Detail | «Block Mö Sch, Montag 0800 bis 1200, COBRA 10 bis COBRA 20, Ltg Zfhr, Ort Spl, Ltg Zfhr, bestätigt» · «Beso 21 Arztvisite, Dienstag 0930, … 1 Befund: P1» |
| Zellzeiger | `gridcell` | «Montag 05.10.2026, COBRA 10, 0800 bis 0815, leer» |
| Terminbereich eines Tages | `list` | «Termine Montag» |
| Seitenleiste des Papiers | `region` | «Seitenleiste: Wochenziele, Bemerkungen, Legende» |
| Werkzeugleiste / Wochen | `toolbar` / `tablist` + `tab` | «Woche und Ansicht» / «Wochen» |
| Befundzähler | `button` | «2 offene Befunde: 2 Fehler, 0 Warnungen, 0 Hinweise. Befundliste öffnen (Ctrl+.)» |
| Seitenbereich | `tablist` + `tabpanel`; Seitenfeld `complementary` | «Seitenfeld» |
| Befundliste / Importbericht | `listbox` + `option` | «Offene Befunde Wo 1» / «Meldungen Blatt Wo1» |
| Direktbearbeitung | `group` | «Direktbearbeitung Block» |
| Listenansicht | `grid` (TanStack Table), `aria-sort`, `aria-readonly` je Spalte | «Einträge Wo 1» |
| Statuszeile | `status` | – |
| Speicherbanner voll | `alert` | – |
| Kopfleisten-Knopf Kürzelübersicht (2.2, 11.6) | `button`, `aria-haspopup="dialog"`, öffnet `dialog` «Tastenkürzel – WAP-Planer» | «Tastenkürzel» |
| Hinweis gemeinsamer Speicher (nur `file://`, 11.6) | `region` in `dialog` «Tastenkürzel – WAP-Planer»; Erststart-`button` mit `aria-haspopup="dialog"`; Palettenbefehl | «Gemeinsamer Browserspeicher» / «Hinweis zum gemeinsamen Speicher …» / «Hinweis zum gemeinsamen Speicher» |

Die genaue Struktur (`aria-rowindex` bei mehreren Einträgen gleicher Startzeit, Einträge in eigenen `row`-Elementen) legt der `architect` im Schnittstellenvertrag fest (Prompt §5.2 Schritt 2); End-to-End-Tests greifen über Rolle und Name zu. `data-testid` nur, wo Rolle und Name nicht eindeutig sind.

### 14.3 Weiteres

- Status und Stufe nie nur über Farbe: Befundmarken mit Form, gestrichen mit Durchstreichung, offen mit Wort «offen» in Seitenfeld und Liste.
- Zielgrössen: Knöpfe der Bedienoberfläche ≥ 28 px (Suite `btn-sm`), Griffe 9 px mit 6 px Trefferzone darum; Lesemodus (nur bei G-7 b, 15) ≥ 44 px.
- Bewegung: Suite-`prefers-reduced-motion` gilt; das Papier animiert nie.
- Seitenzoom des Browsers bis 200 % ohne Verlust: Seitenbereich wird zur Überlagerung (2.2).
- Automatische Prüfung (axe) und Tastatur-E2E laut Prompt §7 «Barrierefreiheits-Prüfung».

## 15 Tablet-Lesemodus (Beschrieb 3, 11; R-11-10) – bedingt durch Gate-0-Entscheid G-7 (entschieden 02.10.2026: G-7 a, Lesemodus entfällt)

Ob es den Lesemodus gibt, regelt G-7 «Lesen auf dem Tablet» (ADR-007, AR0-06; R-11-10); entschieden Gate 0 (02.10.2026): **G-7 a**:

- **G-7 a «Lesen = PDF» (entschieden Gate 0, 02.10.2026):** Der Lesemodus **entfällt**. Das Tablet liest das PDF; R-11-10 wird am PDF geprüft (Seite im Tablet-Format lesbar, zoombar, Text durchsuchbar). Die App kennt dann keinen Zustand `readingMode`, keine Touch-Erkennung und keine Tablet-Masse; Ansicht 12 ist nicht verbindlich. Für die Lesbarkeit auf dem Tablet sorgt allein das PDF (Beschrieb 10); die UI-Richtlinie stellt dafür keine weiteren Anforderungen.
- **G-7 b «Lesen = App auf dem Tablet»:** Es gilt der Rest dieses Abschnitts (Ansicht 12). Voraussetzung ist eine Auslieferung, die das Tablet öffnen kann (ADR-007 Option C oder ein Tablet, das lokale HTML-Dateien mit Skripten öffnet); Nachweis zusätzlich auf dem echten Gerät.

Nur bei G-7 b:

- Aktiv, wenn `(hover: none) and (pointer: coarse)` oder die Breite unter 900 px liegt; manuell über «Lesemodus beenden …» mit dem Hinweis «Änderungen auf diesem Gerät gelten nur hier. Zurück zum Laptop nur per Plan-Datei.» (Ansicht 12).
- Nur lesen: keine Direktbearbeitung, kein Ziehen, kein Seitenfeld. Erlaubt: Wochenwechsel, Zoom, Details, PDF-Export, Befundliste (lesend).
- Kopfleiste zeigt «Lesemodus» und die Herkunft «Plan-Datei vom 29.09.2026 · nur lesen».
- Gesten: Tippen auf einen Eintrag öffnet unten ein Blatt mit allen Angaben (≥ 16 px Schrift); zwei Finger zoomen um den Mittelpunkt; ein Finger verschiebt; Doppeltippen wechselt zwischen «Seite einpassen» und «Tag füllt die Breite». Keine Wisch-Geste für den Wochenwechsel (Konflikt mit Verschieben); dafür die Tabs.
- Ziele ≥ 44 px, Werkzeugleiste 52 px, Tabs 40 px.

## 16 Gestaltungsgrundlagen

### 16.1 Grundlage Suite

- Alle Farben, Schatten, Radien, Schrift und Komponenten stammen aus `src/theme.css` (Layer `tokens`, `components`, `shell`): `.btn`, `.segmented`, `.chip`, `.badge`, `.callout`, `.banner`, `.modal`, `.menu`, `.kbd`, `.field`, `.form-grid`, `.option-card`, `.data-table`, `.empty`, `.toast`, `.progress`.
- Eigene Klassen in `src/components/wap/wap.css` (bzw. `src/pages/wap.css`), unlayered wie die übrigen Seiten-CSS, **Präfix `wap-`** (Muster `tb-` in `tagesbefehle.css`).
- Hell/dunkel folgt `data-theme` und `prefers-color-scheme` der Suite. Akzent ist der Suite-Akzent (fast schwarz / fast weiss); für Marken auf dem Papier gilt 16.3.
- Ikonen: Suite-`Icon.tsx`. Neu nötig: `minus`, `eye`, `lock`, `history`, `crosshair`, `bold`, `table`, `grid`, `loader` (18 S-5).

### 16.2 Abstände, Masse, Typografie der Oberfläche

- Abstandsstufen der Suite: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24 px. Innenabstand Seitenbereich 12/14 px, Feldabstand 10–12 px, Werkzeugleiste Lücke 10 px.
- Höhen: Kopfleiste 56 px (`--topbar-h`), Werkzeugleiste 44 px, Statuszeile 26 px, Felder 30 px (Seitenfeld) bzw. 34 px (Dialoge), Knöpfe 28/34 px.
- Schrift der Oberfläche: `--font` (Segoe UI Variable), Basis 14 px; Überschriften wie Suite (h1 1,2 rem · 650). Seitenfeld-Beschriftung 0,84 rem · 560; Statuszeile 0,8 rem. Zeiten und Zahlen `font-variant-numeric: tabular-nums`; militärische Zeiten ohne Doppelpunkt.
- Dichte: kompakt, aber nie unter 12,5 px Schrift für lesbaren Text (Statuszeile 11,2 px nur für Wiederholungen von Kürzeln).

### 16.3 Papier und Marken (neue Tokens, nur in der Route)

| Token | Wert | Zweck |
| --- | --- | --- |
| `--wap-paper` / `--wap-ink` | #ffffff / #000000 | Papier in beiden Modi |
| `--wap-grid`, `--wap-grid-soft` | Platzhalter bis Anhang B-Kp | Linien (Stunde gestrichelt, Halbstunde fein, Beschrieb 4.5) |
| `--wap-print-red` | #ff0000 (Vorschlag #c00000, 19 F-1) | Status offen/gestrichen (Beschrieb 10) |
| `--wap-mark-select` | #2d63b5 (= Suite `--info` hell) | Auswahl, Fokus, Zellzeiger, Ziehen |
| `--wap-mark-error` / `-warn` / `-hint` | #c23a2f / #b86e00 / #4a554e (= Suite `--danger`, `--warning`, `--text-2` hell) | Befundmarken |
| `--wap-mark-changed` | #7a3db8 | «geändert», Importgeister |
| `--wap-print-font` | Arimo (FontFace aus ArrayBuffer, ADR-004) | Druckschrift |

Die **Legendenfarben** sind Daten der Vorlage (Beschrieb 4.7), keine Tokens. Die Werte in den Ansichten (#cfe2f3, #fff59d, #fce4d6, #bfbfbf, #f8cbad) sind Platzhalter bis zur Vermessung in Anhang B-Kp.

### 16.4 Druckschrift vs. Oberflächenschrift

- Auf dem Papier nur Arimo in den Grössen der Layout-Schicht (Standard 5 pt, Blocktitel 5,5 pt fett, Mindestgrösse 4,5 pt; Beschrieb 10, 15), gezeichnet als vorberechnete Zeilen (`white-space: pre; font-kerning: none`).
- Alles, was nicht aufs PDF gehört (Seitenfeld, Detail-Karte, Zeitschild, Marken-Beschriftungen, Direktbearbeitungs-Karte), in `--font`. Ausnahme: das Titelfeld der Direktbearbeitung liegt genau über dem Titel und nutzt Arimo in Papiergrösse × Zoom, damit der Übergang nicht springt.

## 17 Bedienwege der Standardaufgaben Etappe 1

Zählregeln aus `standardaufgaben.md`. M = Maus und Tastatur, T = nur Tastatur. «Ist» ist der Bedienweg dieser Richtlinie, noch nicht gemessen.

| SA | Weg M | Ist M / Soll | Weg T | Ist T / Soll |
| --- | --- | ---: | --- | ---: |
| 01 | Karte «Neuer Plan» 1 · Datum (Fokus) 1 · «Anlegen» 1 | 3 / 7 | Enter 1 · Datum 1 · Enter 1 | 3 / 8 |
| 02 | Mo 1 · Shift-Klick Fr 1 · Spaltensatz öffnen/wählen 2 · Sa 1 · Spaltensatz 2 · «kompakt» 1 · So 1 · «ausgeblendet» 1 | 10 / 12 | Ctrl+Home 1 · Shift+→ ×4 · S 1 · Wahl ≤ 2 · Enter 1 · → 1 · S, Wahl, Enter ≤ 4 · D, k, Enter 3 · → 1 · D, a, Enter 3 | ≤ 21 / 23 |
| 03 | Ziehen 1 · Titel 1 · Tab ×2 · Ltg 1 · Tab 1 · Ort 1 · Enter 1 | 8 / 8 | Ctrl+G, «Mo 0800 COBRA 10», Enter 3 · N 1 · Zeit 1 · Tab · Spalten 1 · Tab · Titel 1 · Tab ×2 · Ltg 1 · Tab · Ort 1 · Enter 1 | 15 / 15 |
| 04 | Wählen 1 · Rechtsklick 1 · «Auch an anderen Tagen» 1 · «Mo–Fr» 1 · «Übernehmen» 1 | 5 / 8 | Fokus ≤ 2 · A 1 · 2, 3, 4, 5 · Enter 1 | ≤ 8 / 10 |
| 05 | Doppelklick 1 · Titel 1 · 3 × (Tab, Zeit, Tab, Spalte, Tab, Zusatz) 18 · Enter 1 | 21 / 23 | Ctrl+G «Mo 0900» Enter 3 · B 1 · Titel 1 · 18 · Enter 1 | 24 / 25 |
| 06 | Kästchen auf 0700 ziehen 1 | 1 / 1 | Ctrl+G «12» Enter 3 · Z 1 · «0700» 1 · Enter 1 | 6 / 7 |
| 07 | Ziehen im Band 1 · Titel 1 · Klick «bis» im Seitenfeld 1 · Eingabe 1 · Enter 1 | 5 / 5 | Q 1 · von 1 · Tab · bis 1 · Tab · Titel 1 · Enter 1 | 7 / 8 |
| 08 | Karte «Excel-WAP importieren» 1 · Dateidialog 2 · «Importieren» 1 · je Meldung 1 | 4 + n / 4 + n | I 1 · Dateidialog 2 · Enter 1 · erste Leertaste 1, danach ↓ + Leertaste | 4 + 2n − 1 / 4 + 2n |
| 09 | «Neuen Stand setzen …» 1 · (Datum 2) · «Stand setzen» 1 | 2–4 / 4 | Palette 3 · (Datum 1) · Enter 1 | 4–5 / 5 |
| 10 | «PDF …» 1 · «Trotzdem exportieren» 1 · Speichern 1 | 3 / 3 | Ctrl+P 1 · Tab 1 · Enter 1 · Speichern 1 | 4 / 4 |
| 11 | F5 1 · Ctrl+Z 1 | 2 / 2 | gleich | 2 / 2 |
| 12 | Doppelklick 1 · Kürzel 1 · Enter 1 · unteren Rand ziehen 1 · Ort im Seitenfeld 2 | 6 / 6 | Fokus ≤ 3 · R 1 · Zeit 1 · Tab · Kürzel 1 · Tab · Ort 1 · Enter 1 | ≤ 10 / 10 |
| 13 | Shift+Rahmen 1 · Kategorie öffnen/wählen 2 | 3 / 3 | Fokus ≤ 2 · (Ctrl+↓, Ctrl+Leertaste) ×2 · K 1 · Wahl ≤ 2 · Enter 1 | ≤ 10 / 10 |
| 14 | Ziehen über die Tagesgrenze 1 | 1 / 1 | Ctrl+G «Ausb» Enter 3 · T 1 · «Mi» 1 · Enter 1 | 6 / 7 |
| 15 | Doppelklick Terminbereich 1 · Text 1 · Enter 1 | 3 / 3 | G 1 · «Fr» 1 · Tab 1 · Text 1 · Enter 1 | 5 / 5 |
| 16 | «Liste» 1 · Doppelklick Ort 1 · Eingabe 1 · Enter 1 | 4 / 4 | Ctrl+L 1 · Ctrl+F 1 · Suchtext 1 · Enter 1 · (→ ×3 bei Suche nach Titel) · Eingabe 1 · Enter 1 | 6–9 / 9 |
| 17 | «Datei sichern» 1 · Speichern 1 · «Plan-Datei öffnen» 1 · Dateidialog 2 | 5 / 5 | Ctrl+S 1 · Speichern 1 · O 1 · Dateidialog 2 | 5 / 7 |
| 18 | Speicheranzeige 1 · Punkt 1 · «Wiederherstellen» 1 | 3 / 3 | Palette 3 · ↓ ≤ 2 · Enter 1 | ≤ 6 / 6 |
| 19 | Kästchen 1 · «gestrichen» im Seitenfeld 1 | 2 / 3 | Ctrl+G «21» Enter 3 · X 1 | 4 / 5 |
| 20 | Zähler 1 · Befund 1 · ziehen 1 · Befund 1 · ziehen 1 | 5 / 5 | (F8 1 · S 1 · «FALCON» 1 · Enter 1) ×2 | 8 / 11 |
| 34 | Meldung 1 · Feld wählen 1 · Eingabe 1 | 3 / 3 je Abw. | ↓ 1 · Enter 1 · Feldtaste 1 · Eingabe 1 · Enter 1 | 5 / 5 je Abw. |

**Soll nur Tastatur angehoben** – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen* (`standardaufgaben.md`, Q-009 UI-F-4):

- **SA-09 T:** 4 nur, wenn das Stand-Datum heute ist (Vorgabe); bei anderem Datum 5. Ein eigenes Kürzel für «Neuen Stand setzen» vergebe ich bewusst nicht (selten, folgenreich). Soll T 4 → 5.
- **SA-16 T:** 6 bei Suche nach dem Ortswert («Spl»), 9 bei Suche nach dem Titel (drei Spalten nach rechts). Soll T 8 → 9.
- **SA-18 T:** 6 über die Palette; 5 ginge nur mit eigenem Kürzel. Soll T 5 → 6.

Voraussetzungen, die diese Wege tragen und darum verbindlich sind: Anfangsfokus der Dialoge (10), Klick ausserhalb übernimmt (5.4), leere Folgezeile der Zeitfenster (5.4), Ctrl+G «Gehe zu», Feldsprung-Tasten, «Mo–Fr»/Ziffern im Dialog «Auch an anderen Tagen», Speicheranzeige öffnet die Wiederherstellungspunkte, Tab durch Einträge schon in Etappe 1 (19 F-3).

## 18 Entscheide mit Auswirkung auf die Suite (Gate 0, Prompt §5.4, §5.6)

| Nr | Entscheid | Geänderte Suite-Datei | Auswirkung |
| --- | --- | --- | --- |
| S-1 | Route `/wap`, Werkzeug «WAP-Planer», **Alt+9**, Palette-Gruppe «WAP-Planer» (ADR-001) | `App.tsx`, `Shell.tsx` (`tools`, `titles`, Alt-Regex `^[1-9]$`, Zielliste), `CommandPalette.tsx`, `ShortcutSheet` | neue Navigation; Hilfetext «Personen / Kontakte / Tagesbefehle / Vor Ort / WAP-Planer – Alt 5–9» – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.* |
| S-2 | Auf `/wap` eigene Kopfleiste statt Suite-Topbar; Suite-Seitenleiste standardmässig eingeklappt | `Shell.tsx` (Topbar je Route ausblendbar, Route-Vorgabe für die Seitenleiste ohne Änderung der Einstellung) | andere Werkzeuge unverändert – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.* |
| S-3 | Globale Kürzel der Shell delegieren auf `/wap` über die Schnittstelle **`setRouteKeyDelegate(delegate \| null)`** mit `RouteKeyDelegate { handles(e), handle(e) }` (ADR-001 Abschnitt «Tastatur», Vertrag E1-11 §3): Solange die Route einen Delegaten gesetzt hat, fragt `onKey` zuerst `handles(e)` und führt bei `true` nur `handle(e)` aus. Auf `/wap` übernimmt der WAP-Planer Ctrl+S (Plan-Datei statt JSON), Ctrl+Z/Y/Shift+Z (WAP-Historie) und «?»; Ctrl+B wird während einer WAP-Textbearbeitung nicht ausgewertet; Ctrl+K und Alt+1–9 bleiben Suite-Kürzel. Beim Verlassen der Route setzt sie `null` | `Shell.tsx` (`onKey`, neue Funktion `setRouteKeyDelegate`) | Die Shell-Behandlung läuft auf `window` und sieht auch Tasten bei Fokus auf `body`; `stopPropagation` in der Route reicht nicht. Verbindlicher E2E (E1-11): Suite-Undo, -Redo und -JSON-Sicherung lösen auf `/wap` nie aus – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.* |
| S-4 | «?» öffnet auf `/wap` die WAP-Kürzelübersicht (bzw. die Suite-Übersicht mit WAP-Gruppen) | `Shell.tsx` (`ShortcutSheet`) | – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.* |
| S-5 | Neue Ikonen in `Icon.tsx` (9 Stück, 16.1) | `Icon.tsx` | Bundle minimal grösser – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.* |
| S-6 | Kontrast: `--text-3` (hell überall, dunkel auf `--surface-2`) und `.btn-danger` dunkel verfehlen 4,5:1; die Route überschreibt lokal | keine (nur `wap.css`) | **Hinweis an den Auftraggeber:** derselbe Mangel besteht in der ganzen Suite (14.1); Korrektur dort wäre eine eigene Freigabe – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.* |
| S-7 | Befehlspalette braucht eine Erweiterung, über die die Route ihre Befehle (mit Kürzel-Hinweis) einträgt, nur solange `/wap` aktiv ist | `CommandPalette.tsx` | Nebenbefund: die Palette führt heute keinen Eintrag «Tagesbefehle» (Alt 7) – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.* |

## 19 Konflikte, Abweichungen und Fragen

### Konflikte mit dem Beschrieb bzw. den ADRs

- **K-1 Ziehen vs. Auswahlrahmen (Beschrieb 5.1):** «Ziehen auf leerer Fläche erzeugt einen Block» und «Mehrfachauswahl (Rahmen ziehen …)» beschreiben dieselbe Geste. Entscheid UI: Rahmen nur mit **Shift+Ziehen**; SA-13 bleibt bei 3 Aktionen (Zählregel: Ziehen mit gehaltener Taste = 1). Vorlage an Gate 0 als Auslegung. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **K-2 Suite-Tastenbehandlung (ADR-001):** `stopPropagation` in der Route genügt nicht (S-3). Erledigt in Runde 2: ADR-001 Abschnitt «Tastatur» legt die Delegation `setRouteKeyDelegate` fest (G-1 entschieden Gate 0 (02.10.2026): angenommen). – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **K-3 Druckrot und Kontrast (Beschrieb 10 vs. 11):** Leitplanke 2 verlangt Bildschirm = PDF; #ff0000 erreicht auf den Legendenfarben nur 2,17–4,00:1. Siehe F-1. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **K-4 Lesbarkeit bei «Einpassen»:** Beschrieb 5 verlangt die PDF-Anordnung am Bildschirm; bei ganzer Seite ist 5 pt ≈ 6,7 px unlesbar. Keine Abweichung, aber eine Folge: Erfassen geschieht bei 175–200 % mit Scrollen; Seitenfeld und Detail-Karte gleichen aus (4.1). Für den `ux-critic` relevant (SA-24 Tempo). – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **K-5 Alt-Ziehen unter Windows/Edge:** Loslassen von Alt kann den Fokus ins Edge-Menü setzen. Die Route verhindert `keyup` von Alt während und direkt nach dem Ziehen; ein E2E-Test muss zeigen, dass der Fokus im Raster bleibt. Risiko, falls Edge das nicht zulässt: Ersatz Ctrl+Shift+Ziehen – das wäre eine Abweichung vom Beschrieb 5.1. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*

### Fragen mit Vorschlag

- **F-1 Druckrot (Gate S):** Status «offen»/«gestrichen» in #c00000 statt #ff0000 (5,80:1 auf Gelb, 6,48:1 auf Weiss; auf Grau 3,52:1)? Vorschlag: #c00000 in PDF und Bildschirm; Gate S prüft es im Seitenvergleich. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen, Sichtprüfung an Gate S.*
- **F-2 PDF der Arbeitsfassung mit Änderungen seit dem Stand:** Das PDF trägt das alte Stand-Datum, obwohl der Inhalt abweicht. Vorschlag: Hinweis im Export-Dialog (Text 12 «Stand veraltet»), keine Sperre; ab Etappe 2 optional «Änderungen markieren». Vor dem ersten Stand stellt sich die Frage nicht: Dateiname und Titel enden auf «_Entwurf» ohne Datum (ADR-005 P.3, Ansicht 09). – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **F-3 Pfeiltasten und Tab auf Einträgen schon in Etappe 1:** R-6-23, -24 und -27 sind Etappe 2. Ohne Tab durch Einträge ist das Raster in Etappe 1 nur über Zellzeiger und Ctrl+G bedienbar. Vorschlag: Tab/Shift+Tab und Ctrl+Pfeile (Fokus) in Etappe 1; Pfeile/Shift+Pfeile zum Verschieben/Vergrössern in Etappe 2 wie geplant – bis dahin tun sie auf Einträgen nichts. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **F-4 Soll-Zahlen SA-09, SA-16, SA-18 (nur Tastatur):** Vorschläge in 17 (5, 9, 6). – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **F-5 Lebensdauer einer Quittierung:** Vorschlag: gilt, solange Regel, Eintrag und Ursache gleich bleiben; ändert sich die Ursache (z.B. eine andere Spalte fehlt), erscheint der Befund wieder. Sind Fehler quittierbar? Vorschlag ja; quittierte Fehler erscheinen im PDF-Export eingeklappt, ohne Bestätigungszwang (Beschrieb 7: «bewusst quittieren»). – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **F-6 Ctrl+D:** Vorschlag «unmittelbar anschliessend duplizieren» (5.7). Alternative: gleiche Zeit am Folgetag. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **F-7 Ctrl+L, Ctrl+O, Ctrl+P, Ctrl+G übersteuern Browser-Tasten** in der Route (13.2). Vorschlag annehmen; Adressleiste bleibt über Alt+D/F6 erreichbar. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **F-8 Ziehen in Rap-/Beso-Spalte und im Band** erzeugt Rapport, Beso bzw. Querbalken (5.2) – Erweiterung gegenüber Beschrieb 5.1, von SA-07 bereits angenommen. Vorschlag annehmen. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **F-9 Befunde beim Export eines gespeicherten Stands (R-7-04, R-7-05, ADR-002 P.6a):** Das gespeicherte PDF lässt sich nicht mehr ändern; die Befunde des aktuellen Plans betreffen die Arbeitsfassung. Vorschlag: Bei «Stand V‹n›» zeigt der Dialog keine Befundliste und verlangt keine Bestätigung; Knopf «Exportieren» (Ansicht 09b). R-7-04/-05 gelten für die Arbeitsfassung. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*
- **F-10 Esc im Dialog «Sicherung vor dem Update»:** Vorschlag: Esc schliesst nicht, weil ohne Entscheid kein Plan geöffnet werden kann (10). Alternative: Esc = «Ohne Sicherung fortfahren» – abgelehnt, weil die sichere Wahl nicht mit einer Fluchttaste übergangen werden soll. – *entschieden Gate 0 (02.10.2026): Vorschlag angenommen.*

## Anhang: Zuordnung Anforderungen → Abschnitte

| Anforderungen | Abschnitt |
| --- | --- |
| R-2-01 | Einleitung, 12 |
| R-4.5-08, -09, -10 | 5.2, 5.5, 4.2 |
| R-4.6-04, -10, -29 | 5.2, 3, 5.3 |
| R-4.7-10 | 5.4 |
| R-5-01, -02, -03 | 1, 4.1, 4.2 |
| R-5.1-01 bis -22 | 5 |
| R-5.2-01, -05 bis -07, -10 | 10, 3, 5.9 |
| R-5.3-03, -04, -06, -08, -12 | 5.5, 10 |
| R-5.5-01 bis -07 | 10, 2.2 |
| R-5.6-02, -03, -05, -07 bis -13, -16, -17 | 11, 10 |
| R-5.7-01 bis -04 | 11, 12 |
| R-6-01, -05 bis -08, -10 bis -16, -23 bis -27 | 5.8, 3, 4.3, 6, 10, 7, 13 |
| R-7-02 bis -05, -34 | 8, 10 |
| R-8.2-20 bis -22 | 9 |
| R-11-06 bis -12, -14 | 12, 13, 14, 15, 3, 8.1 |
| ADR-002 P.6a, ADR-005 P.3 (Stand-Varianten, Dateiname «_Entwurf») | 10, 12, 19 F-9 |
| ADR-003/-004 AR0-13 (Zeichen ohne Glyphe) | 5.4, 9, 12 |
| ADR-006 P.2a (Sperre bei Stand und Import, `conflict`) | 9, 11.2, 12 |
| ADR-006 P.2b, P.2c (Ersetzen, Plan löschen, Sicherung vor dem Update); R-5.6-18 (Esc schliesst nicht, keine Planöffnung ohne Entscheid); R-L-10 (Angebot der Sicherungen, Wiederherstellungspunkt `migration`, Umstellung) | 10, 11.1, 11.5, 12, 19 F-10 |
| ADR-007 G-7 (Lesen auf dem Tablet) | 2.2, 14.3, 15 |
| R-L-09 (im Katalog, Runde 6b), ADR-006 G-9 a (gemeinsamer Speicher unter `file://`) | 11.1, 11.6, 14.2 |
