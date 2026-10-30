# F-TOOLS4 – Paketzweig `wap/f-tools4` (E2E der echten Suite-Seite #/wap mit WapPage und Excel-Import)

- Etappe: 1 (vor Gate B).
- Anforderungen:
- Hinweis: Die Tests tragen nur die ID R-5.7-01 des eingefrorenen Pakets I5 (Erststart mit «Excel-WAP
  importieren»); keine Neuzuordnung im Etappenplan.
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-tools4` · Zweig `wap/f-tools4` ab `wap-codex` bfeb621
- Bezug: Folgeauftrag des Koordinators vom 26.10.2026 zu FT3-02 (kein WAP-Test lud die echte
  `src/pages/WapPage.tsx` samt Excel-Import).

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-tools4 bfeb621`, `npm ci`)
- [x] 6 Test-Freeze: 3 neue Testdateien per lock-update mit Grund «F-TOOLS4» eingefroren; Testpfad
  `tests/wap-e2e/f-tools4/**` in `scripts/wap-gate/testpfade.json` additiv registriert
- [ ] 9 Volle Schleuse (Orchestrator)

## Tests

| Datei | Projekt | Inhalt |
| --- | --- | --- |
| `tests/wap-e2e/f-tools4/support/suite-import.ts` | – | Ablauf: echte Suite unter `#/wap` (src/App.tsx → WapPage), Erststart «Excel-WAP importieren», fiktive Arbeitsmappe aus `tests/wap/fixtures/import/kp-workbook.ts` über die Dateiauswahl, Importbericht mit Formenbilanz, Block «Ausbildung Suite» im Raster, «PDF dieser Woche» als Datei mit PDF-Kopf; keine Anfrage ausserhalb der App (Vorrichtung wapPage und eigene Prüfung), keine Konsolenfehler |
| `tests/wap-e2e/f-tools4/suite-import.spec.ts` | edge | Entwicklungsserver (`index.html` → `src/main.tsx`); misst src/pages in V2-e2e |
| `tests/wap-e2e/f-tools4/suite-import.dist.spec.ts` | edge-dist | gebaute Suite-Einzeldatei: `tools/build-offline.mjs` (wie `npm run build`, ohne Typprüfung) baut `dist/offline.html`, Kopie nach `test-results/wap/einzeldatei/suite-app.html` (einziger file://-Ort der Vorrichtung), Aufruf unter `#/wap`; Excel-Import in der Suite-Datei damit automatisch geprüft |

## Belege (26.10.2026)

- Beide Tests grün (Entwicklungsserver 6,8 s, Einzeldatei 4,5 s; Bau der Einzeldatei rund 6 s im `beforeAll`).
- Abdeckung `src/pages/WapPage.tsx` aus diesem E2E-Lauf: **4 von 7 Zweigorten (57,1 %)**, vorher 0 von 7. Die Suite
  übergibt der Route immer alle Eigenschaften; die Zweige «ohne Eigenschaft» und der Vorgabewert `= {}` bleiben
  ungedeckt. 7 von 7 erreicht nur ein Unit-Test, der WapPage auch ohne Eigenschaften rendert (Vorschlag FT3-02,
  test-engineer bzw. F-ABDECKUNG2). Schwelle 75 % unverändert.
