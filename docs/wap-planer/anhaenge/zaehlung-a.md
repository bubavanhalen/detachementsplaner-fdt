# Anhang A (Kp FDT 2026) – Zählung

Stand 28.10.2026 (GB-IMPORT, Gate-B-Entscheide 11 a, 12 a, 13 a, 14 b; vorher 19.10.2026 F-IMPORT2). Nur Anzahlen, keine Inhalte (normalisierung.md Abschnitt 1 und 8). Die Dateien mit
echten Inhalten liegen nur lokal unter `reference/anhaenge/`.

| Datei (unter `reference/`) | Stand | Zeilen | Soll-Einheiten | SHA-256 |
| --- | --- | --- | --- | --- |
| `anhaenge/abgleich/anhang-a-kp.kandidat.csv` | bestätigt Gate 0 (02.10.2026, Q-011), unverändert | 412 | 412 | `f877a078d40b0d67c2f24aa843405717fdf6a46b52f187aa675d142df9dcbfaf` |
| `anhaenge/anhang-a-kp.csv` | massgebend ab 28.10.2026: Stand 19.10.2026 (Korrekturen nach Q-042, Q-043, Q-044, durchgehende Bemerkungen Wo2/Wo3; Änderungsliste bestätigt Auftraggeber Gate B 28.10.2026) und Gate-B-Entscheide 12 a, 13 a, 14 b (Änderungsliste `anhaenge/aenderungen-2026-10-19.md`, nur lokal) | 434 | 417 | `9f7bfbb101cf992240bc01f6c471135ac58c6fbe7ad50b4d85d1833d896fd466` |

Beide Dateien sind in `docs/wap-planer/reference-lock.json` gesperrt. Blätter → Woche: Blatt 1 KVK, Blatt 2 Wo1,
Blatt 3 Wo2, Blatt 4 Wo3.

## Zeilen je Woche und Typ (`anhang-a-kp.csv`)

Typ `Bericht` = erwarteter Berichtseintrag ohne Eintrag (ganz verdeckte Form, Q-043; Linie ohne Beschriftung, Gate B 13 a); keine Soll-Einheit.

| Woche | Block | Querbalken | Marker | Rapport | Beso | TagBemerkung | MehrtagBemerkung | Bericht | Zeilen | Einheiten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KVK | 63 | 0 | 9 | 8 | 24 | 2 | 13 | 3 | 122 | 119 |
| Wo1 | 66 | 0 | 11 | 7 | 14 | 2 | 11 | 2 | 113 | 111 |
| Wo2 | 75 | 1 | 10 | 8 | 11 | 2 | 11 | 4 | 122 | 118 |
| Wo3 | 38 | 0 | 8 | 4 | 8 | 0 | 11 | 8 | 77 | 69 |
| **gesamt** | 242 | 1 | 38 | 27 | 57 | 6 | 46 | 17 | 434 | 417 |

## Änderungen vom 19.10.2026 je Kategorie

| Kategorie | Zeilen | Grundlage |
| --- | --- | --- |
| ganz verdeckt → Typ `Bericht` mit `Bericht: verdeckt` | 16 (KVK 3, Wo1 1, Wo2 4, Wo3 8) | Q-043 («3: ja») |
| teilweise verdeckt → `Bericht: teilweise verdeckt`, davon Zeit auf die sichtbare Spanne gekürzt | 11, davon 5 mit neuer Zeit | Q-042 («4: ja»), Q-044 (d) |
| Block mit Teilaufgaben (Titel und Ltg der ersten fetten Gruppe) | 1 | Q-044 (a), (c) («5: ja») |
| durchgehende Bemerkungen Wo2/Wo3 ergänzt | 22 (je 11) | Beschrieb 4.2, R-4.2-07 |

## Änderungen vom 28.10.2026 (Gate B, «All as recommended»)

| Entscheid | Zeilen | Änderung |
| --- | --- | --- |
| 11 a | – | Änderungsliste vom 19.10.2026 bestätigt (Vermerk in der lokalen Änderungsliste) |
| 12 a | 1 (KVK Mo Rapport) | Spalten der Rapport-Zeile in der Rap-Spalte auf `Rap`; die Zeile desselben Rapports in der Planungsspalte bleibt (zwei Rapporte wie Import und Quellen) |
| 13 a | 1 (Wo1 Mo Marker) | Linie ohne Beschriftung: Typ `Bericht` mit `Bericht: Linie ohne Beschriftung` statt Soll-Einheit (Vergleichshilfe: Typ `Bericht` ist nie Soll-Einheit, Q-043) |
| 14 b | 2 (KVK Mi, Do Marker) | Ort bleibt Teil der Beschriftung: Titel = ganze Beschriftung wie in der Arbeitsmappe, Ort leer, Kennzeichen `unsicher: Ort` entfällt |

## Kennzeichen (`anhang-a-kp.csv`)

| Kennzeichen | Anzahl |
| --- | --- |
| `Bericht: verdeckt` | 16 |
| `Bericht: teilweise verdeckt` | 11 |
| `sichtbare Zeit (Form …)` | 5 |
| `Teilaufgaben: <n>` | 1 |
| `durchgehend: …` | 22 |
| `Bericht: Kante` | 38 |
| `Bericht: Abweichung Kästchen` | 38 |
| `Bericht: Zwischenspalte` | 12 |
| `Bericht: Kästchen ohne Termintext` | 6 |
| `Bericht: Termin ohne Zeit` | 6 |
| `Bericht: ragt in Rap-Spalte` | 5 |
| `Bericht: Reihenfolge` | 5 |
| `Bericht: Überlappung mit` | 3 |
| `Bericht: Überlappung Seitenleiste` | 2 |
| `Bericht: Kästchen in Rap-Spalte` | 2 |
| `Bericht: Termintext ohne Kästchen` | 1 |
| `Bericht: Überlappung` | 1 |
| `unsicher: …` | 145 |
