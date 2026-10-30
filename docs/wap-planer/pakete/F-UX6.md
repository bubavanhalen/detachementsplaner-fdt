# F-UX6 – Paketzweig `wap/f-ux6` (Listenansicht aus der Nacharbeit Gate B)

- Etappe: 1 (Gate B).
- Anforderungen:
- Hinweis: Die Tests tragen nur IDs bereits eingefrorener Pakete (R-6-15, R-11-07, R-5.7-04); keine Neuzuordnung im
  Etappenplan.
- Bezug: `.qa/e1-ab/sa34-gateb.md` (lokal), Auftrag Koordinator 29.10.2026.
- Zweig ab `wap-codex` 29f497e, Worktree `C:\Users\phili\source\repos\wap-wt\f-ux6` (npm ci).

## Nachstellen

- Testaufbau (fiktive Mappe) und Suite mit der echten Kp-Mappe (lokal, Ausnahme `reference/`; ausgegeben nur Ja/Nein und
  Längen): zügiges Tippen (0–15 ms, CPU-Drosselung bis 6) verlor kein Zeichen, solange jedes Zeichen einen Tastendruck
  mit druckbarem `key` hat. Verloren gingen (1) AltGr-Zeichen (Windows meldet Ctrl+Alt; die Zelle startete die
  Bearbeitung nicht), (2) jede Taste nach einem abgelehnten Wert, wenn danach eine andere Zelle angeklickt wurde (Editor
  mit Meldung offen, Tasten auf Zellen wurden bei offenem Editor verworfen; in der Suite mit der echten Mappe: «Zeit
  ungültig → Klick auf eine andere Woche → Eingabe verloren»), und (3) im Werkzeug: Playwright `keyboard.type` fügt
  Zeichen ausserhalb der US-Tastatur («Ü», «é») ohne Tastendruck als Text ein; auf einer nicht bearbeitbaren Zelle kommt
  das nie an. Echte CH-Tastaturen senden für Umlaute einen Tastendruck (im Test über CDP nachgebildet, grün). Ein
  Abfangen solchen Texts an der Zelle (bearbeitbare Zelle) hätte Suite-Kürzel (Alt+1–9) auf Listenzellen abgeschaltet
  und `src/ui.ts` geändert (ausserhalb der Freigabe); verworfen. Die Überschrift des Importberichts erhielt den Fokus in
  keinem Nachstellen.

## Änderungen

| Befund | Änderung |
| --- | --- |
| UX-AB-G-16 | Bearbeitung beginnt synchron (Editor gezeichnet und fokussiert vor der nächsten Taste, `flushSync`, `useLayoutEffect`); AltGr-Zeichen beginnen die Bearbeitung; Tasten auf einer Zelle bei offenem Editor gehen in den Editor; nach einem abgelehnten Wert behält der Editor den Fokus (Esc verwirft). |
| UX-AB-G-12 | Der Importbericht nimmt beim Neuzeichnen nach einem Wochenwechsel den Fokus nicht, wenn die Liste offen ist und der Fokus nirgends steht. |
| UX-AB-G-01 | Spalten-Zelle als Textfeld mit Vorschlägen (Wahlen aus F-UX4): mehrere Spalten «Rap, Kdo», «Kp Kdt, Stv», «alle»; unbekannte Spalte: «Die Spalte «Xyz» gibt es an diesem Tag nicht.» – «Spaltennamen des Tages mit Komma eingeben, z.B. «Rap, …» (Vorschläge mit Alt+↓), oder die Spalten im Seitenfeld wählen.» |

## Enter wie Excel (Entscheid Auftraggeber 29.10.2026, Auftrag Koordinator)

Enter auf einer nicht bearbeiteten Zelle geht eine Zeile tiefer, Shift+Enter eine höher; F2, Doppelklick oder Tippen
bearbeitet; im Editor übernimmt Enter und geht tiefer, Shift+Enter übernimmt und geht höher. UI-Richtlinie 7
nachgeführt. Hinweis zum Tippen in Playwright (Umlaute als Tastendruck) in `agent-regeln.md` §5 «Testläufe».

## Tests

- `tests/wap-e2e/f-ux6/liste.spec.ts` (eingefroren, Grund «F-UX6 Liste (UX-AB-G-16, UX-AB-G-12, UX-AB-G-01)»): 4 Tests;
  rot gegen 29f497e: G-16 Tippen («Raum» statt «@Raum» über AltGr), G-16 offener Editor («xyz» ohne «Q»), G-01
  («Kdo» statt «Rap, Kdo»); G-12 dort schon grün (nicht nachgestellt, Regressionstest).
- Nachgeführt (Grund «F-UX6: UX-AB-G-01 behoben (Koordinator 29.10.2026)»): `tests/wap/unit/f-ux4/schluss.test.ts`,
  `tests/wap/unit/f-abdeckung2/liste-zelle.test.ts`. Nachgeführt (Grund «F-UX6: Entscheid Auftraggeber 29.10.2026, Enter
  auf der Listenzelle eine Zeile tiefer»): `tests/wap/unit/f-abdeckung2/liste-ansicht.test.ts` (rot gegen 601f64b).
- Enter wie Excel: neuer Test in `liste.spec.ts` (rot gegen 601f64b, Zellzeiger blieb, Editor öffnete).
- Zuvor `wap-codex` 601f64b eingeführt (Vorspulen; eigene Änderungen danach wieder angewendet, Konflikt in FINDINGS
  gelöst: Zeilen des Zielzweigs zuerst).
- Unit 2930 grün; Suite-Unit 299 grün (Suite-Code unverändert); E2E edge Liste, Importbericht, H-UI, H-UI2, F-UX3 Bedienung, F-UX6 grün (H-UI2
  UX-H-03 einmal unter Last rot, einzeln grün).
