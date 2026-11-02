# Gate S – Sichtprobe Durchstich KVK (Vorlage, 06.10.2026)

Stand `wap-planer` **d028137** (Merge E1-02f), volle Schleuse grün (37 Schritte, 2865 s; `.qa/e1-02f/schleuse-voll-wap-planer/versuch-1.log`). Aufbau nach Vertrag E1-02f, Abschnitt Q. Alle Zahlen stammen aus Skripten; neben jeder Zahl stehen Befehl und Fundstelle. Die Vorlage enthält keine Inhalte aus `reference/` und keine echten Namen; Bilder und Vergleiche liegen nur lokal unter `.qa/` (Pfade im Haupt-Checkout `C:\Users\phili\source\repos\detachementsplaner-fdt\`).

## Oben (Entscheide und Überblick)

### 1 Entscheide

| | Frage | Optionen | Empfehlung (Grund) | Folge | Ohne Entscheid |
| --- | --- | --- | --- | --- | --- |
| **S-1** | Optik, Schrift Arimo Regular/Bold (frei, metrisch wie Arial; ADR-003) und Grössen 5 / 5,5 / 4,5 pt freigeben? | a) frei; b) frei mit Auflagen (Liste); c) nicht frei (Punkte) | **b)** mit Auflagen aus S-2 und D6, falls du dort etwas änderst; sonst a). Grund: alle B-Kp-Punkte im Soll, Parität ≤ 0,008 pt, kleinste Schrift 4,5 pt (D4) | Golden-Aufnahme (E1-01d), E1-10 und E1-11 starten | keine Golden-Aufnahme; E1-10/E1-11 warten |
| **S-2** | Q-032 Rückfallregel an der KVK: vorläufig **A** («"..." ist für den Anfang okey», Freigabeprotokoll 06.10.2026). Endgültig: bleibt es bei A, oder braucht es **B** und/oder **E**? | A bestätigen; B (volle Tage nach Gewicht, Zeitachse an Spannweite; KVK ≈ 3 Ereignisse, kein «…»; Abweichung Beschrieb 4.4); E (kurze Blöcke nur Titel; nur kombiniert); B+E | **A bestätigen** (7 Stellen, alle als P8 sichtbar; 2 davon wie Referenz gekürzt bzw. nur Titel). B nur, wenn dich e39, e43, e50 oder e54 im Vergleich stören | B: Neufreeze R-4.4-10, Nachtrag E1-02d/E1-02e; E: Nachtrag E1-02d | A gilt weiter |
| **S-3** | Statusrot #c00000 statt #FF0000 (UI-F-1, Q-009, B-Kp-100) | a) #c00000; b) #FF0000 wie Referenz | **a)** Kontrast; Darstellung im Raster erst mit E1-10 | E1-10 setzt die Farbe | a) |
| **S-4** | Sammelentscheid Vorschläge: Q-016, Q-017, Q-018, Q-023, Q-025 bis Q-028, Q-030, Q-033, Q-034 (V-02f-1 bis -4), Q-035, Q-036 | annehmen / einzeln ändern | **annehmen** (jeweils Empfehlung in `QUESTIONS.md`); V-02f-4 Alternative «ausgeblendete Stände mitzählen» | Arbeitsannahmen werden Regeln | Arbeitsannahmen bleiben |
| **S-5** | Einzeln: Q-020 (Laufzeit schwerer Selbsttestteil), Q-021 (Worker der Suite), Q-022 (Stufe der Kern-Oberflächenpakete), Q-024 (Lizenztext Trennmuster), Q-031 (Netzzugriff für Lizenztexte), **Q-037** (Zwischenstand-HTML mit Lizenz-E-Mails Dritter versionieren?) | je in `QUESTIONS.md` | je Empfehlung dort; Q-037: **lokal lassen** | – | Vorgabe je Frage |
| **S-6** | Nachlauf Umgebungsprobe (AE-001 §5): zweiter Lauf nach Neustart, Offline-Test, Mindestschriftgrösse des Browsers | liefern / nicht liefern | liefern (≈ 10 min) | Restrisiko D8 entfällt | «laut Auftraggeber» bzw. «nicht gemessen» |

### 2 Zahlen Soll / Ist

| Grösse | Ist | Befehl / Fundstelle |
| --- | --- | --- |
| Anforderungen I1 belegt (Verweis) | E1-01b 2; E1-02a 53 (1); E1-02b 2; E1-02c 6; E1-02d 40 (1); E1-02e 72 (6); E1-02f 2; E1-03 24 (1); E1-07 2 – zusammen **203 belegt, 9 Verweis, 0 offen** | `node scripts/wap-gate/trace.mjs --mode full --out …/m2/trace-full.md`; Zählung `…/m2/zaehlen.mjs` → `…/m2/zaehlung.json` |
| Anforderungen gesamt (Etappe 1) | 441: 217 belegt, 203 offen (spätere Pakete), 15 Verweis, 6 Auftraggeber | `trace-full.md`, Kopfzeile |
| Tests | 3693 Tests in der Matrix; Testnennungen belegter IDs nach Art: Unit 1020, PDF 575, Property 88, Integration 34, Integration-Gate 958, E2E 34 | `zaehlung.json` (eine Testnennung je ID; ein Test kann mehrere IDs belegen) |
| Anhang B-Kp | 112 Prüfpunkte, 112 Tests grün; davon B-Kp-55, -56, -100 als an E1-10 aufgeschoben gekennzeichnet | `test-results/wap/vitest.json` (`tests/wap/pdf/page/b-kp/b-kp.test.ts`), `…/m2/bkp-zaehlung.json`; `pruefer.ts` Kopf |
| Parität Bildschirm ↔ PDF (M-3) | max. 0,0077 pt entlang, 0,0056 pt quer; Grösse 0; Texte gleich (5 Zoomstufen; KVK, KVK+, Fortsetzung, 4 synthetische Wochen) | `.qa/e1-02f/visual-qa-1.md` §5; Tests X1–X10, W1–W10 grün |
| Kleinste Schrift KVK (M-1) | 4,5 pt (11 von 387 Läufen) | `visual-qa-1.md` §5 |
| Rückfälle KVK (M-2) | 7 (Mo 5, Di 2; 5 × Zeile entfällt, 2 × «…»); synthetischer Plan 723 (Belastungsplan) | `visual-qa-1.md` §3, VQ-E102f-06 |
| Befunde offen | 0 blockierend, 0 hoch, 15 mittel, 36 niedrig, 3 Info; zurückgestellt 4 blockierend (Gate 0, CR-H0S-32/38/42/43), 7 mittel, 47 niedrig | `zaehlen.mjs` über `FINDINGS.md` |
| Leistung, Abdeckung, Mutation | ab E1-02g / E1-01c / E1-01e (AE-001 §2) | – |

### 3 Abweichungen

Vom Beschrieb und von der Referenz: Tabelle D6 (19 Stellen). Zurückgestellte Befunde: siehe `FINDINGS.md` (Status «zurückgestellt»), dazu CR-E102e-07 (Fortsetzung O(n²), E1-12/E1-16), CR-E102f-02 (Schriftstand, E1-11/E1-02c), CR-E102f-03 (Mehrfachberechnung, E1-02g).

### 4 Top-5-Risiken

1. **Rückfälle in echten Wochen** (Wo 1–3 erst nach Import messbar; Näherung 3 / 9 / 2). Gegenmassnahme: Messung mit E1-08, Entscheid S-2 gilt dann je Woche.
2. **Leistung und S7 erst in I2** (E1-02g). Gegenmassnahme: Budgets R-11-11/-12/-15/-16 im Harness, Mehrfachberechnung (CR-E102f-03) dort messen.
3. **Mindestschriftgrösse des Browsers** auf dem Dienstlaptop nicht gemessen (ADR-004). Gegenmassnahme: S-6.
4. **Parität nur in Edge 155 lokal** gemessen. Gegenmassnahme: Stabilitätslauf, Edge-Version in der Schleuse festhalten.
5. **Golden erst mit E1-01d**: bis dahin schützt nur die Parität und B-Kp vor optischen Rückschritten. Gegenmassnahme: Golden-Aufnahme direkt nach S-1.

### 5 Was du prüfen sollst (Reihenfolge)

1. **Seiten-an-Seiten KVK** (≈ 15 min): `.qa/e1-02f/gate-s/d1-ganz-seiten-an-seiten-432dpi.png`, Regionen `.qa/e1-02f/gate-s/regionen/`; die 7 Rückfall-Stellen `.qa/e1-02f/gate-s/rueckfaelle/` (`eNN-vergleich.png`, Übersichten `uebersicht-mo.png`, `uebersicht-di.png`) → Entscheid S-2.
2. **PDF in Edge** (≈ 5 min): `test-results/wap/pdf/e1-02f-kvk-woche.pdf` im Arbeits-Checkout `wap-planer` öffnen, zoomen, Text markieren.
3. **Bildschirm 100 % / 200 %** (≈ 3 min): `.qa/e1-02f/gate-s/bildschirm/*-zoom100pct-*`, `*-zoom200pct-*`.
4. **Zwischenstand I1** (≤ 15 min): `docs/wap-planer/zwischenstand/i1/README.md` mit Probierliste.
5. **Entscheide** S-1 bis S-6.

## Details

### D1 Seiten-an-Seiten

KVK-Seite des PDF neben der KVK-Seite der Referenz, ganz und regionsweise (Kopf, Seitenleiste oben/unten, Mo–So, Termine, Rasterkopf, Zeitachse) bei 432 dpi; erstellt vom `visual-qa` nur lokal (`.qa/e1-02f/gate-s/`, Bericht `.qa/e1-02f/visual-qa-1.md`). Urteil je Region: «bekannte Abweichung» (keine Region mit Befund hoch oder blockierend). Anhang B-Kp: alle gemessenen Punkte im Soll; Markerfeld (B-Kp-66) bekannt abweichend.

### D2 PDF

| Artefakt | SHA-256 (Anfang) | Seiten / Schriften |
| --- | --- | --- |
| `e1-02f-kvk-woche.pdf` | `43811b829482d843` | 1 Seite; Arimo, Arimo-Bold eingebettet mit ToUnicode; 30 078 Bytes |
| `e1-02f-kvk-plus.pdf` | `54f77f861ece8122` | 1 Seite |
| `e1-02f-kvk-fortsetzung.pdf` | `8b6079491e6e9ed4` | 2 Seiten |
| `e1-02f-plan-synthetisch.pdf` | `5cc40ded622f1765` | Gesamt-PDF, 4 Wochen |

Befehl: `sha256sum test-results/wap/pdf/e1-02f-<name>.pdf` → `.qa/e1-02f/gate-s/m2/sha-feste-namen.txt`. Edge-PDF = Node-PDF (byte-gleich, Test X8). Alle PDF liegen nur lokal.

### D3 Bildschirm

Bildschirmfotos der KVK-Woche über `wapWochenHarness` bei `scale` 4/3 und 8/3 (Zoom 100 % und 200 %), lokal `.qa/e1-02f/gate-s/bildschirm/`. Versioniert nur die Fotos des Zwischenstands (synthetischer Plan) unter `docs/wap-planer/zwischenstand/i1/`. Über alle Browserläufe 0 Netzanfragen, 0 Konsolenmeldungen, kein Browser-Speicher.

### D4 Messwerte (M-1 bis M-5; `visual-qa-1.md` §5)

- **M-1** KVK: 387 Läufe, kleinste Grösse 4,5 pt (11 Läufe).
- **M-2** KVK: 7 Rückfälle (D1/S-2); Fortsetzungsvariante zusätzlich 1 × `continuationPage`.
- **M-3** Parität: siehe Teil 2.
- **M-4** Zeit bis «bereit» (Median aus 5, informativ): KVK 56 ms, KVK+ 68 ms, Fortsetzung 59 ms, synthetisch 307–334 ms.
- **M-5** KVK-PDF: 30 078 Bytes, 1 Seite, 2 Schriften eingebettet, minFontSize 4,5.

### D5 Belege S6 und V5-ebene2

- `node scripts/wap-gate/selftest.mjs --nur S6` → «S6 | V5-ebene2 | … Schrift unter Mindestgrösse 4,5 pt (kleinste 4 pt) | erkannt»; «Selbsttest: alle 1 Verstösse erkannt.» (`.qa/e1-02f/gate-s/m2/selftest-s6.log`).
- Volle Schleuse d028137: `OK V5-ebene2`; Nachlauf `checkPdfArtefakte` → `ok` true, `geprueft` 323 (Namen: e1-02c 67, e1-02e 199, e1-02f 57; `…/m2/v5-ebene2-nachlauf.json`, `v5-ebene2-namen.json`).
- P8 (S6 am Produkt-PDF) im Bericht V1 grün.
- **S7 offen** bis E1-02g (R-H-32).

### D6 Bekannte Abweichungen

| Stelle | Referenz | PDF | Grund | Quelle |
| --- | --- | --- | --- | --- |
| Markerfeld (9 Felder) | Feld 2 u × ≈ 0,25 h, teils nur Art | bis Beschriftungsbreite × 0,403 h, Art mit Zeit | 4,5 pt passt nicht in 0,25 h | V-02d-13, V-02d-18, B-Kp-66 |
| Kopf links «SCHWEIZER ARMEE» | Emblem-Schrift | Arimo fett 5 pt | keine fremde Schrift | Q-012 |
| Terminbereich Wochenende | Sa und So getrennt | zusammengefasst | Einstellung der Woche | F-10, B-Kp-89 |
| Statusrot | #FF0000 | #c00000 vorgesehen, Darstellung E1-10 | Kontrast | B-Kp-100, Q-009, S-3 |
| Einzug der Wochenziele | grösserer Abstand | fester Einzug (≈ 0,5 pt Versatz) | Vorgabe | S3-2, B-Kp-74 |
| Kürzelbedeutung | ausgefüllt | leer | Feld offen | V-02e-4 |
| Fixture gegen Referenz | Datenstand Referenz | pseudonymisierte Fixture | Datenschutz | TR-E102a-10 |
| Seitenleiste Linien | bis Rahmen, Titelzeile gerahmt | enden an xS bzw. offen | Linienstil ohne B-Kp-Vorgabe | VQ-E102e-01, V-02e-15 |
| Sonnenwerte | Innenabstand 3,8 pt | 0,69 pt | nicht geregelt | VQ-E102e-03 |
| NaE Montag | durchgehend | Teilflächen 1,5–3 pt | Fixture-Zeiten + Aussparregel | VQ-E102e-04 |
| Seitenleistenlinie im Kopf | ab Kopf-Unterlinie | ab Rahmenoberkante | Linienstil | VQ-E102f-04 |
| Zeitlage Beso-Kästchen | 16 von 24 um 30 min anders | «wahre Zeit» | Regel | Beschrieb 4.6, F-05; VQ-E102f-02 |
| Bemerkungen ohne Nummer | mit Aufzählungsstrich | ohne Trennzeichen | Nr-Spalte | V-02e-14; VQ-E102f-03 (Vorschlag «- » oder hängender Einzug) |
| Datumsformat | Schrägstrich | dd.mm.yyyy | Vorgabe | B-Kp-112 |
| Ränder | ≈ 21,5 mm seitlich | 7,0 mm | grössere Nutzfläche | B-Kp-04, B-F-01 |
| Sonne/Mond | Schriftzeichen | Vektorpfade | keine Symbolschrift | V-02e-8 |
| Wappen | vorhanden | KVK-Fixture ohne, KVK+ mit fiktivem Bild | Datenschutz | E1-02e S3-17 |
| Rückfälle | anders gesetzt | 7 Stellen (D1) | Q-032 A vorläufig | Q-032, Q-035 |
| Spaltensatz | ohne Nebenspalte Mo/Di, ohne Rap Sa/So | Fixture mit Nebenspalte und Rap | Fixture | VQ-E102e-06 |

### D7 Offene Fragen (Status in `QUESTIONS.md`)

Q-032 (vorläufig A, S-2) zuerst; dann Q-035 (Textausrichtung, Beispiele e54, e93, e111), Q-016, Q-017, Q-018, Q-020 bis Q-028, Q-030, Q-031, Q-033, Q-034, Q-036, Q-037 – alle «offen» mit Empfehlung. Q-029 gehört zu Etappe 4 (nur Hinweis).

### D8 Restrisiken

- S7 und Leistung erst in I2 (E1-02g).
- Golden erst mit E1-01d (nach S-1).
- Mindestschriftgrösse des Browsers auf dem Dienstlaptop nicht gemessen (ADR-004, S-6).
- Wo 1–3 erst nach dem Import messbar (Q-032-Näherung).
- Parität nur in Edge 155 lokal gemessen.
- Zwischenstand ist der synthetische Plan, nicht die KVK.
- Datenschutz-Scan V11-deep: Zeilen nach Lage (E1-01-30); Restrisiken CR-E101-30-01..03 (gestreckter oder unsichtbarer Text, Nummern über Zeilenumbruch) – von den WAP-Ausgaben nicht erzeugt.

### D9 Golden-Kandidaten

Noch keine erzeugt (`golden-kandidaten.mjs` gesperrt, Lauf nach S-1 mit E1-01d; VQ-E102f-07). Status: «Kandidat» erst nach diesem Lauf.

### D10 Probierliste

Siehe `docs/wap-planer/zwischenstand/i1/README.md` (9 Punkte, ≤ 15 min; Hinweis auf die 723 Rückfälle des Belastungsplans).

### Nebenbei (nicht Teil von Gate S)

- **E1-05 (Codex-Probelauf AE-002):** Auftrag bereit seit 06.10.2026 02:08; Rückmeldung «Codex fertig: E1-05» steht aus.
