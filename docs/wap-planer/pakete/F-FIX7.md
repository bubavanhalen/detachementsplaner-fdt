# Paket F-FIX7 – F-FIX Runde 7: Befunde FA2-01 und FA2-02 (Personenliste)

- Etappe: 1 (Schlussrunde vor Gate B)
- Anforderungen: (keine eigenen; die umgestellten Tests tragen IDs eingefrorener Pakete und die Befund-IDs FA2-01, FA2-02, z.B. R-4.1-09, R-5.7-04)
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-fix7` · Zweig `wap/f-fix7` ab `wap-codex` bfeb621
- Grundlage: Folgeauftrag F-FIX Runde 7 des Koordinators (26.10.2026); Befunde FA2-01, FA2-02 aus F-ABDECKUNG2 (`FINDINGS.md`, Abschnitt «F-ABDECKUNG2»).

Je Befund wird der `[FA2-nn]`-Test in `tests/wap/unit/f-abdeckung2/personen-datei.test.ts` auf das Soll umgestellt (Rot-Nachweis `.qa/f-fix7/rot-FA2.txt` im Haupt-Checkout), dann `src/io/wap-persons/index.ts` behoben und der Test per lock-update neu eingefroren.

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-fix7 bfeb621`, `npm ci`)
- [x] 6 Eigener Freeze entfällt (keine eigenen Testdateien; die umgestellten Tests gehören zum registrierten Testpfad von F-ABDECKUNG2): Test per lock-update neu eingefroren
- [x] 7 Umsetzung: FA2-01 und FA2-02 behoben, alle Tests grün
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `code-reviewer`

## Belege

| Befund | Ursache | Änderung | Rot / Grün |
| --- | --- | --- | --- |
| FA2-01 (R-4.1-09) | `readCsv` bestimmte das Trennzeichen aus der ersten Dateizeile; eine Leerzeile davor ergab «;» und «fehlende Spalten» | Trennzeichen aus der ersten Zeile mit Inhalt | rot «promise rejected … instead of resolving» → grün |
| FA2-02 (R-5.7-04) | `unescapeXml` rief `String.fromCodePoint` mit einem Wert ausserhalb von Unicode auf → `RangeError` | Wert über U+10FFFF: eigener Fehler, `readPersonFile` meldet «invalidFile» («konnte nicht als Excel-Arbeitsmappe (.xlsx) gelesen werden» mit nächstem Schritt); Gegenprobe gültiger Verweis | rot «expected RangeError … to be an instance of PersonFileError» → grün |

Gezielter Lauf: Personenlisten-Tests (h-tests, i3, h-daten, f-abdeckung2) 170/170 grün.
