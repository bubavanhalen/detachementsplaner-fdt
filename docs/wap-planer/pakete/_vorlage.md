# Paket <ID> – <Titel>

- Etappe: <N>
- Anforderungen: <R-…>
- Worktree: `C:\Users\phili\source\repos\wap-wt\<paket>` · Zweig `wap/<paket>` ab `wap-planer`
- Prüfberichte: `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\<paket>\`

Ein Kästchen gilt erst mit Beleg als erledigt (Befehl, Ausgabeauszug, Commit-Hash, Befund-IDs). Der nächste Schritt ist immer das erste offene Kästchen (Prompt §5.2).

- [ ] 1 Paket-Worktree angelegt und installiert
- [ ] 2 Schnittstellenvertrag und Stubs (`architect`)
- [ ] 3 Tests (`test-engineer`), jeder Test mit Anforderungs-ID im Namen
- [ ] 4 Test-Review (frischer `test-reviewer`), Freigabe
- [ ] 5 Rot-Nachweis (Assertion-Fehler, kein Import-/Syntax-/Timeout-Fehler)
- [ ] 6 Test-Freeze: Commit mit Tests, Stubs, Vertrag, `test-lock.json`
- [ ] 7 Umsetzung (`implementer`) bis alle Tests grün; `git diff --name-only <freeze>..HEAD` gegen gesperrte Pfade geprüft
- [ ] 8 Golden-Bilder (nur Layout/PDF): Kandidaten, `visual-qa`, Aufnahme «vorläufig»
- [ ] 9 Volle Schleuse im Paket-Worktree (Orchestrator)
- [ ] 10 Prüfung: `code-reviewer` (+ `visual-qa` / `ux-critic` falls zutreffend)
- [ ] 11 Nachprüfung durch frische Instanz, alle Befunde verifiziert oder entschieden
- [ ] 12 Eskalation (nur falls nötig)
- [ ] 13 Integration: Merge nach `wap-planer`, volle Schleuse auf `wap-planer`, `PROGRESS.md`, Worktree entfernt

## Belege

| Schritt | Befehl / Commit | Auszug |
| --- | --- | --- |
