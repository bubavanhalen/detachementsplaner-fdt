# Abnahmebericht Etappe 1

**Gate B: Entscheid Auftraggeber 28.10.2026 «All as recommended for gate-b» – alle 43 Entscheide gemäss Empfehlung** (`gates/gate-B.md`, Freigabeprotokoll in `PROGRESS.md`). Bestätigt sind damit Seite an Seite (Entscheid 2 a), der Datenverlust-Schutz 5.6 (Entscheid 8 a) und die Änderungsliste von Anhang A (Entscheid 11 a); die Rückfallliste der echten Wochen (3 a) und der KVK-Fixture (4 a) ist angenommen. Übernommen aus dem Entwurf des spec-auditor (Fassung 2, 21.10.2026, Prüfstand a8e2f1d) durch GB-DOKU; Zahlen unverändert, nur die Bestätigungen nach Gate B nachgeführt.

**Status:** nach Gate B (28.10.2026) versioniert (Prompt §5.3 Punkt 5, Vertrag E1-AB §3/§4).
**Prüfstand:** `wap-codex` **a8e2f1d** (Integrations-Worktree, nur gelesen). Werte aus den Paketseiten `pakete/F-*.md`, dem Befundregister, den Prüfberichten der Härtung (Runde 2–5, lokal `.qa/haertung/`), dem Nacharbeitsbericht `.qa/e1-ab/sa34-final.md` und dem Teillauf der vollen Schleuse `.qa/schlussrunde/gate-full-a8e2f1d.log`. Kein eigener Lauf.
**Vorgehen (Wunsch Auftraggeber):** Gate B schliesst diese Iteration ab (Entscheid 1 a). Nach dem Entscheid vom 26.10.2026 («Volles Gate entfällt für Etappe 1») verlangt der Merge nach `wap-planer` für Etappe 1 die Merge-Schleuse; Selbsttest V1a, Mutation V8 und die übrigen Schritte des vollen Gates folgen ab Etappe 2. Felder «‹Schluss-Gate›» bleiben deshalb für Etappe 1 offen; der Teillauf auf 1dececb (26.10.2026) steht im Freigabeprotokoll.
**Datenschutz:** keine Namen, keine Inhalte aus `reference/`; nur Zählungen, Orte (Woche/Tag/Spalte) und Arten. Vergleiche mit den Originalen liegen nur lokal und werden verlinkt (Prompt §7).

> Hinweis: `trace.mjs --etappen-abschluss 1` liest Teil (b) als Text nach der **ersten** Überschrift mit «(b)». In diesem Bericht trägt nur die Überschrift von Teil (b) diese Zeichenfolge.

---

## Übersicht

| Kriterium (Beschrieb 13/14, Etappe 1) | Urteil | Belegt durch |
| --- | --- | --- |
| 14.1 ≥ 95 % automatisch (alle Wochen) | **erfüllt** (98,3 %); Vorbehalt TR-2-01 aufgehoben (Entscheid 11 a) | Agents (Integration-Referenz) + Auftraggeber |
| 14.1 100 % nach Nacharbeit (KVK, Wo 1) | **teilweise** – 229/231 Soll-Einheiten korrekt; Rest nach den Entscheiden 12 a, 13 a, 14 b, 15 a (Umsetzung GB-IMPORT), danach Test erneut | Agents (ux-critic, Test R-14.1-02) |
| 14.2 PDF-Checkliste B-Kp, Seiten-an-Seiten | **erfüllt** – Prüfer belegt, Seiten-an-Seiten bestätigt (Entscheid 2 a) | Agents + Auftraggeber |
| 14.3 keine Überlappung, kein verdeckter Text, Rückfallregel | **erfüllt mit Auflage** – 18 Rückfälle als bestätigte Liste (Entscheid 3 a); VQA-3-03 vor dem Merge (Entscheid 18 a, GB-LAYOUT) | Agents + Auftraggeber |
| 14.4 Beso-Nummern | **erfüllt** | Agents (Property) |
| 14.5 Importbericht Kp | **erfüllt** | Agents (Integration-Referenz) |
| 14.7 Prüfregeln P1, P8, P16, P17 positiv/negativ | **erfüllt** (F9-trace grün auf a8e2f1d) | Agents |
| 14.13 Offline | **erfüllt** (V2-e2e grün auf a8e2f1d, exklusiv) | Agents (E2E) |
| 14.14 Leistung 1000 Einträge | **erfüllt** für die Etappe-1-Ziele (ohne Filter R-11-13, Etappe 2); V7 ‹Schluss-Gate› | Agents (Leistungssuite) |
| 14.15 Datenverlust-Schutz vorgeführt | **erfüllt** – bestätigt (Entscheid 8 a) | Auftraggeber |
| 14.6, 14.8–14.12, 14.16 | nicht Gegenstand von Etappe 1 (14.6: Excel-Ausgangsmessung jetzt erbeten) | – |

---

## Teil (a) – Kriterien Beschrieb 14 je Kriterium

Je Kriterium zuerst der durch Agents belegte Anteil, danach der Anteil, den der Auftraggeber bestätigt (Prompt §5.3 Punkt 5).

### 14.1 Import und Nacharbeit

- **Automatisch (R-14.1-01):** 411 von 418 Soll-Einheiten = **98,3 %** (Schwelle 95 %), gegen den nach den Entscheiden vom 19.10.2026 angepassten Anhang A, ohne Abzug im Nenner; `tests/wap/reference/import/kp.ref.ts` «[R-14.1-01]». Verlauf: 92,0 % (379/412, gegen den Kandidaten vor F-IMPORT2) → 97,1 % (406/418) → 97,8 % (409/418) → 98,3 % (411/418, nach FD-03 Linienanker; unverändert bis F-FIX Runde 6). Die frühere Abweichung FA-07 (abgesetzte Markerlinie) ist durch R-8.2-44 erledigt.
- **Vorbehalt (TR-2-01):** Das Orakel wurde vom Paket angepasst, das den Import änderte (50 Zeilen). Die Änderungsliste ist mit Gate B bestätigt (Entscheid 11 a); R-14.1-01 gilt ohne Vorbehalt. Beide Quoten bleiben genannt.
- **Nacharbeit (R-14.1-02, SA-34):** frischer `ux-critic` ohne Kenntnis von Anhang A, nur mit Importbericht, Listenansicht, App-PDF, Referenz-PDF und Excel-Sicht; Prüfstand `pruefstand-final.html` (Stand 78a32d3, SHA-256 1aa797a2…), Netz gesperrt (0 Anfragen).
  - Runde 1: 2 Nacharbeiten, **9 Aktionen** (8 ohne Export; Soll 6). Zeit ungültig (CPU-Fremdlast 63–76 %).
  - Runde 2 (nach Rückmeldung des Tests, nur Schlüssel und Feldnamen): 6 Nacharbeiten, **30 Aktionen** (22 ohne Klärung der Nebenwirkung bei Beso 20, Soll 18); 5 min 31 s, gültig (CPU < 30 %).
  - Export Listenansicht «Ganzer Plan» nach `reference/nacharbeit/etappe-1/liste-kvk-wo1.csv`, SHA-256 **3982aaf7…**.
  - Test `tests/wap/reference/abnahme/nacharbeit.ref.ts` (Freeze 9f19fed, Test-Review TR-AB-01/02), Lauf `.qa/e1-ab/lauf-final-2.txt`: **229/231 Soll-Einheiten korrekt (99,1 %)**, Test rot.
  - Offen: KVK|Mo|Rapport «fehlt» (= Q-IM2-02), Wo1|Mo|Marker «fehlt» (Linie ohne Beschriftung, unter einem Block, weder in Excel-Sicht noch Referenz-PDF sichtbar). Danach als Feldabweichungen: KVK Mi und Do Marker «Ort» (Marker haben kein Ort-Feld, Beschrieb 4.6; UX-AB-F-05/UX-AB-14) und KVK Di Beso 20 «Status» («geändert» statt «bestätigt», UX-AB-F-09).
  - **Unabhängigkeit, offen vermerkt:** In Runde 2 gab der Koordinator dem Bediener neben den Schlüsseln kurze Prüfhinweise ohne Soll-Inhalte. Anhang A blieb ungeöffnet (Erklärung im Bericht).
  - Alle 4 offenen Punkte sind entschieden (Gate B 28.10.2026: 12 a, 13 a, 14 b, 15 a; die Nacharbeit gilt mit Vermerk, 16 a); Anhang bzw. Produkt werden in GB-IMPORT angeglichen, danach läuft der Test erneut.

### 14.2 PDF-Checkliste Anhang B-Kp

- **Agents (R-14.2-01 bis -04):** B-Kp-Prüfer (`tests/wap/pdf/page/b-kp/b-kp.test.ts`) und unabhängige PDF-Auslesung (visual-qa-3 auf 79bf4d5): kleinste Schrift 4,5 pt, Text über Text 0, verdeckter Text 0, unmaskierte Linie durch Text 0, Rahmen 0,48 / 0,375 / 0,72 pt (Titelrahmen 1×), Zeitachse Residuum ≤ 0,0051 pt, Legendenfarben gemäss 4.7; PDF der Einzeldatei = PDF des Modells (0/0 abweichend).
- **Bewusste Abweichungen von B-Kp** (mit Entscheid): B-Kp-37 Nebenspalte Gewicht 2, B-Kp-99 «offen» rot, B-Kp-31 Kopf zuerst waagrecht, B-Kp-10 Kopfzeile wächst, Rapportrahmen dünn. Ohne Entscheid: B-Kp-64 drei Bahnen (R1-08).
- **Auftraggeber (R-14.2-05):** Seiten-an-Seiten je Woche; lokal `.qa/haertung/vqa-3/seite-an-seite/` (PNG 432 dpi; Stand 79bf4d5). **Bestätigt Gate B 28.10.2026 (Entscheid 2 a).** Drei Bahnen (B-Kp-64) so belassen (19 a); B-Kp-37 zur Kenntnis (6 a).

### 14.3 Überlappung, verdeckter Text, Rückfallregel

- **Agents (R-14.3-01, -02):** keine Überlappung ausser gewollter Aussparung, kein abgeschnittener oder verdeckter Text; je Woche 1 Seite. Rest: **VQA-3-03** (Wo3 Fr, Markerfeld ragt rund 3 pt in den Folgeblock) – Entscheid 18 a: Ausweichen vor dem Merge (GB-LAYOUT).
- **Rückfallregel (R-14.3-03):** 18 P8-Ereignisse (KVK 8, Wo1 3, Wo2 5, Wo3 2; vorher 27), alle sichtbar; Arten: Beschriftung neben dem Kästchen 8, Zeile entfällt 5, «zu viele Spalten für diesen Tag» 2, Kürzel neben der Kürzelspalte 2, Titel gekürzt «…» 1. Liste `.qa/gate-b/rueckfaelle-liste.md` (gezählt auf 79bf4d5). Nach F-FIX Runde 5/6 (Zerlegung Ltg/Ort nach Regel 12) ist die Zählung auf a8e2f1d nicht nachgeprüft. R-14.3-03 hat noch keinen Test; nach der Bestätigung friert der Orchestrator die Liste ein.
- **KVK-Fixture:** bestätigte Liste nach Q-032 A, nach «12: ja» 6 → 4 (F-LAYOUT2-16); **bestätigt Gate B (Entscheid 4 a)**. Echte Wochen: Liste mit 18 Rückfällen angenommen (Entscheid 3 a); Zählung auf dem Endstand nachprüfen, danach friert ein Test die Liste ein.

### 14.4 Beso-Nummern

- **Agents (R-14.4-01, -02):** `tests/wap/property/commands/beso-nummern.test.ts`; Mutation `numbering.ts` 88,1 % (Teilmessung). Erfüllt.

### 14.5 Importbericht Kp

- **Agents (R-14.5-01 bis -09):** `kp.ref.ts` grün (letzte Einzelläufe 18/18 bzw. 19/19; im Teillauf der Schleuse ist V3 nur wegen R-14.1-02 rot). Erfüllt.

### 14.7 Prüfregeln der Etappe

- **Agents (R-14.7-01):** P1, P8, P16, P17 je «(positiv)» und «(negativ)»; F9-trace auf a8e2f1d grün. Erfüllt.

### 14.13 Offline

- **Agents (R-14.13-01):** `tests/wap-e2e/i5/ablauf.dist.spec.ts` (I5 D4); V2-e2e im exklusiven Lauf auf a8e2f1d grün (650 s). In allen Prüfläufen 0 Netzanfragen. Unter künstlicher Last nicht aussagekräftig (FL-07). Erfüllt.

### 14.14 Leistung

- **Agents (R-14.14-01 → R-11-11 bis R-11-17):** Werte in Teil (c), alle Budgets bei ruhigem Rechner erfüllt. Einschränkung: Filter R-11-13 erst Etappe 2. Messarten R-11-11 (HT-08) und R-11-17 (SA-2-11) bestätigt (Entscheid 32 a). V7 mit Baseline-Vergleich im Teillauf 26.10.2026 grün (Freigabeprotokoll).

### 14.15 Datenverlust-Schutz

- **Vorbereitet (R-14.15-01, R-1-06):** Vorführskript `.qa/haertung/ux/vorfuehrung-5-6-v2.md` (Fassung 2; nachgespielt auf 79bf4d5 bei 1366 und 1600 px, alle Punkte «OK»). Die Schritte gelten unverändert für `pruefstand-final.html`. Nur mit simulierter Uhr: 1.4, 3.2; nur simuliert: 4.2; nicht vorführbar: «vor Übernahme» (Etappe 3).
- **Auftraggeber:** **bestätigt Gate B 28.10.2026 (Entscheid 8 a).**

### Nicht Gegenstand von Etappe 1

- 14.6 Tempo (Etappe 2): Excel-Ausgangsmessung Kp Wo 1 jetzt (R-15-07), Messanleitung `.qa/gate-b/messanleitung-14-6-entwurf.md`.
- 14.8–14.10, 14.16 (Etappe 3), 14.11, 14.12 (Etappe 4).

---

## Teil (b) – Rückverfolgbarkeit und Kriterien durch den Auftraggeber

| ID | Testart | Inhalt (gekürzt) | Vorbereitung / Beleg | Bestätigung |
| --- | --- | --- | --- | --- |
| R-1-02 | Auftraggeber | PDF entspricht der Referenz und ist besser lesbar | Verweis R-14.2-01 bis -05, R-14.3-01 bis -03; Schrift ≥ 4,5 pt (Referenz rund 3 pt); Seiten-an-Seiten KVK, Wo1–Wo3 | **bestätigt** Gate B 28.10.2026 (Entscheid 2 a) |
| R-1-06 | Auftraggeber | Kein Datenverlust; Wechsel über die Plan-Datei | Verweis R-5.6-01 bis -17, R-14.15-01; Vorführskript 5.6 | **bestätigt** Gate B 28.10.2026 (Entscheid 8 a) |
| R-14-01 | Auftraggeber | Anhang A und B-Kp liegen vor, A unabhängig vom Import, bestätigt | Gate 0 (02.10.2026, Entscheid 10, Q-011); Hash in `test-lock.json`/`reference-lock.json`; Nachträge 19.10.2026 mit Änderungsliste (50 Zeilen, TR-2-01); weitere Einzelkorrekturen nach Entscheiden 12–13 der Vorlage | **bestätigt** Gate B 28.10.2026 (Entscheid 11 a; Einzelkorrekturen 12 a, 13 a, 14 b) |
| R-14-04 | Auftraggeber | Bei Abweichung Excel/PDF gilt das neuere Excel | 26 Zeilen mit «Excel≠PDF» (KVK 1, Wo1 7, Wo2 2, Wo3 16; Block 12, Beso 6, Marker 5, Rapport 3), gleich wie im Kandidaten; die Nacharbeit fand 2 weitere Stellen (Wo1 Mi, Fr: Beso nur in der Mappe) und 1 Darstellungsunterschied (KVK Fr) | **zur Kenntnis genommen** Gate B 28.10.2026 |
| R-14.2-05 | Auftraggeber | Seiten-an-Seiten-Vergleich je Woche | Bilder KVK, Wo1, Wo2, Wo3 (lokal) | **bestätigt** je Woche, Gate B 28.10.2026 (Entscheid 2 a) |
| R-14.15-01 | Auftraggeber | Datenverlust-Schutz 5.6 vorgeführt | Vorführskript mit erwarteten Ergebnissen | **bestätigt** Gate B 28.10.2026 (Entscheid 8 a) |
| R-14.1-02 | Integration-Referenz | 100 % nach Nacharbeit KVK und Wo 1 | **Test vorhanden** (`nacharbeit.ref.ts`, Freeze 9f19fed), **rot**: 229/231, offen 2 Einheiten und 2 Felder (Teil a) | – |
| R-14.3-03 | PDF (Integration-Referenz) | Rückfallregel greift nicht; bestätigte Liste | **ohne Test**: Liste 18, danach Test mit der bestätigten Liste | Liste **bestätigt** Gate B 28.10.2026 (Entscheid 3 a) |
| R-H-01 bis R-H-09 | Integration (H0, Etappe 0) | Harness | Tests unter `tests/wap-harness/**`; vom Skript ohne Wertung «offen» (bekannt, niedrig) | – |

Seit Runde 2 belegt: R-4.6-67, R-5.6-18, R-6-39, R-L-09, R-L-10, R-11-11 (F-DOKU); R-4.6-61, R-8.2-44 (F-FIX Runde 2); R-5.1-26 bis -29, R-5.2-11, -12 (F-UX2/F-DOKU); R-H-16, -17, -20, -23, -32, -36, -37 (F-TOOLS); R-11-17 (F-IMPORT2).

**Abdeckungsmatrix:** F9-trace (statisch) auf a8e2f1d grün. Die Matrix mit `--mode full --etappen-abschluss 1` ‹Schluss-Gate›, verlinkt.

---

## Teil (c) – Messwerte

### Teilergebnis volle Schleuse auf a8e2f1d (21.10.2026, abgebrochen nach V3)

| Schritt | Ergebnis |
| --- | --- |
| F1 bis F10 (Node, Sperre, Last, Lock inkl. F2-gegen/F2-ref nach FT-F2-01, Datenschutz-Scan, Muster, Lint, Typen, Module, Suite, Worker, Vitest, Trace, Lizenzen) | grün |
| V1-vitest, V1-zeitzonen, V1a-gate, V1a-harness | grün |
| V2-e2e | grün (650 s) |
| **V1a-selbsttest** | **rot**: Zeitlimit 7200 s überschritten (Testlauf nicht beendet) – auf den Schluss zurückgestellt |
| **V2-abdeckung** | **rot**: list 65,3 %, panel 61,6 %, settings 59 %, wap-persons 71,1 %, pages 0 % (Messlücke: WapPage nur in der Einzeldatei geladen), tools/wap 14,7 % (Bau-Skripte); Schwelle 75 % |
| **V3-referenz** | **rot**: nur R-14.1-02 (an Entscheide gebunden) |
| V5-golden, V6-visual, V7-perf/-vergleich, V8-mutation | **nicht gelaufen** – ‹Schluss-Gate› |

### Import (Beschrieb 8.2, 14.1, R-11-17)

| Grösse | Wert | Quelle |
| --- | --- | --- |
| Quote Anhang A automatisch (alle Wochen) | **411/418 = 98,3 %** | F-FIX Runde 2–6 |
| Quote gegen Kandidat (vor 19.10.2026) | 379/412 = 92,0 % | F-IMPORT2, TR-2-01 |
| Nach Nacharbeit KVK + Wo 1 | **229/231 = 99,1 %** (dazu 2 Feldabweichungen) | `.qa/e1-ab/lauf-final-2.txt` |
| Nacharbeit Aktionen | Runde 1: 9 (Soll 6); Runde 2: 30 (22 ohne Klärung, Soll 18) | `.qa/e1-ab/sa34-final.md` |
| Nacharbeit Dauer | Runde 2: 5 min 31 s (gültig); Runde 1 ungültig (Fremdlast) | ebenda |
| Anhang A | 434 Zeilen, 418 Soll-Einheiten; 50 Änderungen am 19.10.2026 | `anhaenge/zaehlung-a.md` |
| Importdauer R-11-17 | **Median 6,0 s** gedrosselt ×2 (6,0 / 5,7 / 7,6 / 5,3 / 6,8 s), Budget 15 s | F-IMPORT2 |
| Importbericht KVK / Wo 1 (Formen gelesen = zugeordnet + nicht zugeordnet) | 169 = 164 + 5 / 165 = 161 + 4 | sa34-final |

### Leistung (Beschrieb 11, Prompt §7; 4 Wochen / 1000 Einträge, Drosselung 1,5)

| ID | Budget | Wert | Bedingung / Quelle |
| --- | --- | --- | --- |
| R-5.1-14 (Ziehen, I2b A3, p95 Bildzeit) | ≤ 16,7 ms | 7,1 ms ohne Last; 11,6 ms unter Last | PERF; unter starker Fremdlast rot (FL-05) |
| R-11-11 (Hauptthread-Zeit je Bild, 2 s Ziehen) | p95 ≤ 16,7 ms; keine Aufgabe > 50 ms | **p95 12,99 ms; längste Aufgabe 15,85 ms** | ruhig, F-DOKU; unter Fremdlast 17,58 ms (FD-07) |
| R-11-12 Wochenwechsel | ≤ 300 ms | 80,8 / 82,8 ms | `test-results/wap/perf.json` 20.10.2026 |
| R-11-14 Prüfungen | ≤ 500 ms | 18,5 / 20,3 ms | ebenda |
| R-11-15 PDF einer Woche | ≤ 3 s | 70,8 / 74,5 ms | ebenda |
| R-11-16 PDF ganzer Plan | ≤ 10 s | 204,5 / 182 ms | ebenda |
| R-11-13 Filter | ≤ 300 ms | Etappe 2 | Plan §6 |
| Wochenwechsel echte Mappe am Bildschirm | – | CPU×2 Median 96 ms, p95 128 ms | ux-critic-3 |
| Eingabe → Bild (echte Mappe) | – | CPU×1 Loslassen ≤ 104 ms, Klick ≤ 64 ms; CPU×2 Loslassen ≤ 192 ms | ux-critic-3 |
| V7 gegen `perf-baseline.json` | > 10 % blockierend | ‹Schluss-Gate› | – |

### Rückfälle, Bildschirm = PDF, Fehlklicks

| Grösse | Wert | Quelle |
| --- | --- | --- |
| Rückfälle echte Wochen | 18 (KVK 8, Wo1 3, Wo2 5, Wo3 2), vorher 27; KVK-Fixture 4 | F-LAYOUT2, visual-qa-3 |
| Blockzeilen / Kopfzeilen / Terminzeilen Bildschirm = PDF | 642/642, 256/256, 154/158 (Rest VQA-3-04/-05 in F-UX2 Runde 4 behoben, Verifikation visual-qa ausstehend) | visual-qa-3 |
| Bündig | 0 von 4356 Kantenmessungen > 0,5 px; Blockrand 0/2178 neben Gerätepixeln | ux-critic-3 |
| Fehlklicks echte Mappe, Klick | 100 %: 0/1190 (vorher 0,4 %); 50 %: 0/3120 (0,6 %); Einpassen 3/3120 = 0,1 % (0,7 %), davon 2 gewollt | ux-critic-2, -3 |
| Kante ziehen | 0 gegen das Sichtbare (vorher 1,9 %) | ux-critic-3 |
| Dichte fiktive Woche (F-UX2 P4) | Klicks 5/160 → 0/160, Züge 1/40 → 0/40 | F-UX2 |

### Aktionszahlen (nur Tastatur)

SA-03 13 (Soll 16) · SA-06 7 (7) · SA-09 4 (5) · SA-10 2 + Speichern (4) · SA-18 5 (6) · SA-20 7 (11) · Spalte einfügen mit Namen 4 bzw. 5 · SA-34 Nacharbeit 9 + 30 (Soll 6 + 18).

### Qualität (Prompt §7)

| Grösse | Soll | Ist |
| --- | --- | --- |
| Zweigabdeckung Fachlogik, Layout, Prüfregeln, Import | ≥ 90 % | 92,6 % (alle Fachlogik-Module ≥ 90 %, F-FIX) |
| Zweigabdeckung übriger WAP-Code | ≥ 75 % je Modul | rot in 6 Modulen (Teilergebnis oben) |
| Mutationsscore | ≥ 80 % | Teilmessungen 88,1 % (Beso-Nummerierung), 55,5 % (Formtext 37–130); voll ‹Schluss-Gate› |
| Selbsttest (an jedem Gate B) | jeder Verstoss rot | Zeitlimit überschritten; ‹Schluss-Gate› |
| Golden-Bilder | freigegeben | 4 PDF + 2 Bildschirm «vorläufig»; V5/V6 ‹Schluss-Gate› |
| Lizenzen, Datenschutz-Scan | grün | F10, F3 grün auf a8e2f1d |
| Netzanfragen / Konsolenfehler in Prüfläufen | 0 / 0 | 0 / 0 |
| Offene Befunde nach Stufe | 0 blockierend | ‹Zählskript über FINDINGS.md› |

### Änderungen an `test-lock.json`

Protokoll `FINDINGS.md` «Protokoll test-lock.json»; Liste der in der Schlussrunde (20.10.2026) geänderten gesperrten Tests mit Grund: Gate-B-Vorlage, Anhang 2. Nach a941ef7 hinzugekommen (ebenfalls in Anhang 2): E1-AB-Freeze und zwei Nachführungen des Nacharbeitstests (9f19fed, e9e8484), FT-F2-01 (2c94173, zwei Dateien bytegleich wieder gesperrt), Nachführungen F-FIX Runde 5/6 (UX-AB-01, UX-AB-16, CR-5-01, CR-5-04) und F-UX2 Runde 8 (CR-5-05).

---

## Teil (d) – Offene Punkte und Restrisiken

### Vor dem Merge nach `wap-planer` (Schluss)

1. **Selbsttest und volles Gate** einmal vollständig: V1a-selbsttest (Zeitlimit 2 h überschritten – Ursache klären), V2-abdeckung, V3-referenz, V5-golden, V6-visual, V7-perf/-vergleich, V8-mutation.
2. **R-14.1-02 grün:** nach den Entscheiden 12–15 Anhang A bzw. Produkt angleichen, Test erneut.
3. **Abdeckung:** Tests für list, panel, settings, wap-persons; Messlücke pages und Bau-Skripte tools/wap nach Entscheid 34.
4. **R-14.3-03-Test** mit der bestätigten Liste; Rückfall-Zählung auf dem Endstand nachprüfen (nach F-FIX Runde 5/6).
5. **Katalog nachführen:** R-5.1-06/-07 (Doppelklick), R-6-27 (Pfeiltasten), R-10-54 («2 a»), R-4.6-15 (falls flacher Marker endet), UI-Richtlinie 13.3 (TE-FUX2-03).
6. **Verifikation durch frische Prüfer ausstehend:** F-UX2 Runde 4–8 (visual-qa für VQA-3-04/-05; code-reviewer für Runde 8: CR-5-03, CR-5-05), F-FIX Runde 6 (CR-5-01, -02, -04), F-FLAKY und F-ABDECKUNG (test-reviewer), F-DOKU (test-reviewer, spec-auditor).
7. **Prüfstand:** `pruefstand-final.html` beruht auf 78a32d3; F-UX2 Runde 8 und F-FIX Runde 6 (a8e2f1d) fehlen darin. Seiten-an-Seiten-Bilder und Vorführung beruhen auf 79bf4d5.
8. **Befundregister:** Die Befunde UX-AB-F-01 bis -F-10 aus `sa34-final.md` haben noch keine Zeile in `FINDINGS.md`.
9. **Migrations-Fixture** (Vertrag E1-AB §3): Format 1 hat seit E1-04 neue Felder bzw. Werte (Teilaufgaben, `Beso.categoryId` darf null sein); prüfen und nachführen.
10. **CS-I5-B3-KONSOLE-01** offen bis 50 grüne Läufe.

### Restrisiken

| Risiko | Wirkung | Gegenmassnahme |
| --- | --- | --- |
| Gate B vor dem vollen Gate | Rote Schritte (Selbsttest, Abdeckung, Golden, Leistung, Mutation) erst am Schluss sichtbar | Merge nach `wap-planer` nur mit grünem Schluss-Gate (Entscheid 1) |
| Orakel Anhang A vom Umsetzer angepasst (TR-2-01); Nacharbeit Runde 2 mit Prüfhinweisen | Quoten nicht völlig unabhängig belegt | Einzelbestätigung (Entscheid 11), Vermerk (Entscheid 16) |
| Lastempfindliche E2E in Edge (FL-07, FL-05) | rote Läufe ohne Produktfehler | Belegläufe exklusiv |
| Datenschutz-Scan Sonderformen (CR-E101-P08) | präparierte Datei an einem Bau-Ausgabeort könnte eine E-Mail-Adresse verbergen | fail-closed; Ersatz Etappe 2 |
| Ausgeblendeter Stand nach «Ersetzen» nur über den Punkt «vor Ersetzen» | nach Verdrängen des Punkts (mindestens 30 bleiben) weg | Entscheid 28; Datei-Sicherung vor «Ersetzen» |
| Fokus springt in der Liste bei Einträgen anderer Wochen, Eingabe geht ohne Rückmeldung verloren (UX-AB-F-01) | Nacharbeit über die Liste unzuverlässig | Entscheid 42 (nächste Iteration) |

### Bekannte Einschränkungen (nicht blockierend, Vorschlag Etappe 2)

- Listenansicht ohne Spalten Zusatz, Tn, Tpt, Tenue, Notiz (UX-AB-06/-F-03); kein Befehl «Bemerkung und Beso zusammenführen» (UX-AB-08); Import ohne Import-Dialog (UX-AB-09/-F-08); Meldungen «Kästchen > 15 Min» einzeln (UX-AB-12); Kantengruppen ohne Block und Zeit (UX-AB-F-10).
- Flacher Marker: Dauer nur aus dem Import (F-LAYOUT2-A3).
- Import übernimmt keine senkrechte Textrichtung (R1-13); Unterschriftblock und Wappen nach Import leer (R1-16, Plan-Einstellungen; Stammdaten Etappe 4).
- Aufbewahrte Spaltensätze werden nach dem Neuladen nicht mehr automatisch aufgeräumt (Folge CR-5-03; Entfernen in den Plan-Einstellungen mit Rückfrage).
- `statusRendering` noch im Typ (F-LAYOUT2-A4); CSS-Lokatoren (TR-H-14); Render-Kette «bildschirm» ungeprüft (FT-G-03); UX-H-N2 Rest.
