# Paket GB-DOKU2 – Nachtrag Gate B: Bedeutung KR, Kanten nahe der 15-Min-Linie

- Etappe: 1 (Gate B, Nachtrag)
- Anforderungen: (keine eigenen; die nachgeführten gesperrten Tests tragen R-4.9-18, R-4.7-20 und R-10-53)
- Worktree: `C:\Users\phili\source\repos\wap-wt\gb-doku2` · Zweig `wap/gb-doku2` ab `wap-codex` 2355843
- Rollen: `spec-analyst` (Katalog, Fragen, Freigabeprotokoll, Etappe-2-Liste) und `test-engineer` (gesperrte Tests per lock-update); Produktdaten nur in der Vorlage Kp (Auftrag Koordinator).
- Grundlage: Auftrag GB-DOKU2 des Koordinators (29.10.2026) mit den Antworten des Auftraggebers vom 29.10.2026 (wörtlich): «1. Kompanierapport / 2. yess».

| Teil | Ergebnis |
| --- | --- |
| Entscheid 39, KR | `src/model/wap/template/kp.ts`: KR «Kompanierapport»; Katalog-Änderungsnotiz Gate B (39 a), `QUESTIONS.md` Q-045, `gates/gate-B.md` (Nachtrag), `plan/etappe-2-kandidaten.md` (39 a erledigt) |
| Gesperrte Tests | lock-update «Gate B 28.10.2026 Nr 39 (KR, 29.10.2026)»: `tests/wap/unit/model/template.test.ts`, `tests/wap/unit/model/nachtrag-gate-s-bedeutung.test.ts`, `tests/wap/pdf/page/nachtrag-rahmen.test.ts` (P12: «KR» zeigt «Kompanierapport»), `tests/wap/unit/page/nachtrag-rahmen.test.ts` (U5: drei Bedeutungen in der KVK) |
| PDF-Goldens | kvk-woche-s1 und kvk-fortsetzung-s1 (je 1200 Pixel), synth-woche-1-s1 (1207 Pixel) weichen nur in der Bedeutungsspalte der Kürzelliste ab («Kompanierapport»); kvk-fortsetzung-s2 gleich → Neuaufnahme F-TOOLS |
| Fachentscheid Kanten | `PROGRESS.md` Ergänzungszeile 29.10.2026 (gilt auch für Blockanfänge); Etappe-2-Kandidat «Import: Kanten 2–4 Min neben der 15-Min-Linie optional auf die Linie ziehen». Nacharbeits-Export und Anhang A unverändert |

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/gb-doku2 2355843`, `npm ci` Exit 0)
- [x] 3 Tests: keine neuen; vier gesperrte Tests nachgeführt (IDs unverändert)
- [x] 5 Rot-Nachweis: die alten Fassungen der vier Tests (Kopie aus HEAD) laufen gegen die neue Vorlage rot (4 von 45 Fällen), die nachgeführten grün
- [x] 6 Eigener Freeze entfällt (keine eigenen Testdateien; die vier nachgeführten Tests gehören zu registrierten Testpfaden anderer Pakete): per lock-update mit Grund «Gate B 28.10.2026 Nr 39 (KR, 29.10.2026)» neu eingefroren
- [x] 7 Umsetzung: Vorlage Kp; Vitest-Suite grün (Belege unten)
- [ ] 9 Volle Schleuse (Orchestrator; Goldens nach Neuaufnahme F-TOOLS)
- [ ] 10 Prüfung: frischer `spec-auditor`

## Belege

| Schritt | Befehl | Ergebnis |
| --- | --- | --- |
| Vitest | `npx vitest run -c vitest.wap.config.ts` | 267 Dateien, 2930 Tests grün |
| Golden | `npx vitest run -c vitest.wap-golden.config.ts` | 3 von 4 rot (nur Bedeutungsspalte), 1 grün |
