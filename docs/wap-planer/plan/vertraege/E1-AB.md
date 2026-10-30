# Vertrag E1-AB – Abnahmevorbereitung und Nacharbeit 14.1

Entwurf Runde 2, 01.10.2026 (nach PL0-04). Grundlage Beschrieb 13 (Abnahme Etappe 1), 14.1, 14.2, 14.15; Prompt §5.3 Punkte 4 bis 6; `anhaenge/normalisierung.md`; Verträge E1-08 (Listen-Export, `anhang-compare`) und E1-15 (Export in der Oberfläche); `_konventionen.md`. IDs: R-1-02, R-1-06, R-14-04, R-14.1-02, R-14.2-05, R-14.15-01.

E1-AB enthält **keinen Produktcode**. Es durchläuft die Paket-Checkliste (Prompt §5.2) mit folgender Bedeutung der Schritte.

## 1 Test (Schritt 3, `test-engineer`)

```ts
// tests/wap/reference/abnahme/nacharbeit.ref.ts
// [R-14.1-02] Nach Import und Nacharbeit stimmt Anhang A für KVK und Wo1 zu 100 % mit der Listenansicht überein
//   Eingaben (über WAP_REFERENCE_DIR, nie versioniert):
//     anhaenge/anhang-a-kp.csv                          – bestätigter Anhang A (Lock gemäss R-14-01/R-14-03)
//     nacharbeit/etappe-1/liste-kvk-wo1.csv             – Export «Export …» der Listenansicht nach der Nacharbeit (Format normalisierung.md)
//   1. expect(existsSync(nacharbeitCsv)).toBe(true)     – erste Erwartung; vor der Nacharbeit fachlich rot (Assertion)
//   2. compareWithAnhang(ist, soll) auf den Zeilen der Wochen KVK und Wo1 (Hilfe E1-08)
//   3. expect(diffs).toHaveLength(0) und expect(quote).toBe(1)
//   Ausgaben nur als Zahlen und Schlüssel, nie Inhalte.
```

`nacharbeit/etappe-1/liste-kvk-wo1.csv` steht **nicht** in `tests/wap/reference/required-files.json` (sonst wäre der Rot-Nachweis ein Setup-Fehler), sondern wird im Test mit einer Erwartung geprüft.

## 2 «Umsetzung» (Schritt 7)

1. Der Orchestrator importiert in einer frischen Profil-Instanz die Kp-Referenzdatei über die Oberfläche (E1-16).
2. Ein `ux-critic` ohne Kenntnis von Anhang A arbeitet den Import nach, nur mit Importbericht, Listenansicht und Referenz-PDF (SA-34, Prompt §5.3 Punkt 4); seine Aktionen werden gezählt.
3. Er exportiert die Listenansicht («Export …», Umfang «Ganzer Plan») nach `reference/nacharbeit/etappe-1/liste-kvk-wo1.csv` (nur lokal, Prompt §8).
4. Der Test aus Abschnitt 1 wird grün; sonst zweite Nacharbeitsrunde (Abweichungen nennt der Test nur als Schlüssel).

## 3 Weitere Ergebnisse (ohne Test, im Abnahmebericht belegt)

| ID | Ergebnis |
| --- | --- |
| R-1-02, R-14.2-05 | Seiten-an-Seiten-PDF je Woche (Referenz und Tool, in `reference/`, im Bericht verlinkt); Bestätigung des Auftraggebers |
| R-1-06, R-14.15-01 | Vorführskript zu Beschrieb 5.6 Punkt für Punkt mit erwarteten Ergebnissen |
| R-14-04 | Liste der Abweichungen Excel/PDF aus dem Feld «Bemerkung» von Anhang A (nur Anzahlen und Schlüssel) |

Dazu: Bitte um Excel-Ausgangsmessung Kp Wo 1 mit Messanleitung (Prompt §5.3 Punkt 6); Migrations-Fixture nachführen, falls sich das Format seit E1-04 geändert hat; Abnahmebericht `docs/wap-planer/abnahme/etappe-1.md` mit Abweichungen und Einschränkungen (Plan §6).

## 4 Besitz

`tests/wap/reference/abnahme/**`, `docs/wap-planer/abnahme/etappe-1.md`.

## 5 Stub-Namen

Keine (kein Produktcode).
