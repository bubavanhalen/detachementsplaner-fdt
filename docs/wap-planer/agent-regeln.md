# Gemeinsame Regeln für alle WAP-Planer-Agents

Jeder Agent in `.claude/agents/` liest diese Datei zu Beginn jedes Auftrags. Sie gilt zusätzlich zu seinem eigenen Systemprompt.

1. **Grundlagen.** Verbindlich sind `docs/wap-planer/PROJEKTBESCHRIEB_WAP_Planer.md` («Beschrieb», das Was) und `docs/wap-planer/PROMPT_WAP_Planer.md` («Prompt», das Wie). Zitiere bei jedem Entscheid und Befund die Stelle («Beschrieb 4.6», «R-4.6-03», «Prompt §5.2», «ADR-003»).
2. **Keine weiteren Agents.** Du startest nie Agents und delegierst nichts.
3. **Datenschutz (harte Regel aus `AGENTS.md`).**
   - Echte Dateien liegen nur in `C:\Users\phili\source\repos\detachementsplaner-fdt\reference\`. Daraus Abgeleitetes liegt nur dort oder in `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\`. Beide Ordner sind nicht versioniert.
   - Du liest sie nur, wenn dein Auftrag es ausdrücklich verlangt (lokale Ausnahme des Auftraggebers vom 30.09.2026, festgehalten in `AGENTS.md`).
   - Nie etwas daraus committen, in versionierte Dateien übernehmen, ins Netz senden oder in Testnamen, Logs oder Konsolenausgaben schreiben.
   - Versionierte Fixtures, Tests, Dokumente und Golden-Bilder sind fiktiv oder pseudonymisiert: gleicher Name → gleiches Pseudonym, der Grad bleibt (z.B. «Hptm Muster A»). Die Zuordnungstabelle liegt nur in `reference/`.
   - Prüfungen und Abgleiche gegen `reference/` (z.B. Zuordnungstabelle, Sperrliste) geben in Werkzeug- und Konsolenausgaben nur Anzahlen und Treffer aus, nie Namen oder Zellinhalte (Befund E1-02a-06).
   - Keine AHV-Nummern, Telefonnummern, E-Mail-Adressen oder Adressen. Personallisten und Detachementsplaner-Sicherungen öffnest du nie.
   - Deine Schlussmeldung enthält keine echten Personennamen.
4. **Netz.** Kein Netzzugriff ausser Paketinstallation, und diese nur, wenn dein Auftrag sie verlangt. Die Anwendung selbst macht nie Netzanfragen.
5. **Arbeitsort und Git.** Du arbeitest ausschliesslich im absoluten Pfad, den dir der Orchestrator nennt (Haupt-Checkout oder Paket-Worktree). Verboten sind `git push`, `git reset --hard`, `git clean`, `git checkout -- .`, `git stash` ohne Auftrag, `--no-verify`, das Umgehen von Hooks oder Sperren und Änderungen an Dateien aus `docs/wap-planer/test-lock.json`.
   - **Testläufe** (ADR-010, Änderungsnotiz AE-001; Befund E1-07-03):
     - Vitest startest du nur mit `VITEST_MAX_WORKERS=4`, auch das Suite-`npm test`; für `vitest.wap-selbsttest.config.ts` mit `VITEST_MAX_WORKERS=1`. Playwright nur mit `--workers=2`.
     - `wap:gate:fast` von Hand und jeden Lauf von `vitest.wap-selbsttest.config.ts` (beides Belegläufe) startest du nur nach Vorgabe des Orchestrators.
     - Es laufen höchstens zwei Testläufe von Agents gleichzeitig, nach Vorgabe des Orchestrators.
     - Während eines Beleglaufs des Orchestrators (volle Schleuse, Selbsttest, Stabilitätslauf, `wap:gate:fast` von Hand) startest du weder Test-, Build- noch Browserläufe und committest nicht; der Pre-commit ist dann rot.
     - **Tippen in Playwright** (F-UX6, UX-AB-G-16): `keyboard.type` fügt Zeichen ausserhalb der US-Tastatur (Umlaute, Akzente wie «Ü», «é») ohne Tastendruck als Text ein. Auf einer Listenzelle oder einem anderen nicht bearbeitbaren Element kommt dieser Text nie an, das Zeichen «fehlt». Umlaute deshalb als Tastendruck senden (CDP `Input.dispatchKeyEvent` mit `key` und `text`, Hilfe `taste()` in `tests/wap-e2e/f-ux6/liste.spec.ts`) oder erst tippen, wenn das Eingabefeld den Fokus hat. AltGr-Zeichen (Windows: Ctrl+Alt) sind Tastendrücke und kommen an.
6. **Sprache.** Dokumente und Oberfläche in Deutsch (Schweiz, «ss»); Zeiten militärisch (0700, 1300-1600), Datum dd.mm.yyyy. Code-Bezeichner gemäss `docs/wap-planer/glossar.md`, sobald vorhanden.
7. **Belege.** «Fertig» heisst belegt: Befehl mit Ausgabeauszug, Pfad, Commit-Hash. Nie «sollte funktionieren». Keine Platzhalter, keine TODOs, keine übersprungenen oder abgeschwächten Tests, keine gelockerten Schwellwerte.
8. **Schlussmeldung.** Knapp und strukturiert: **Ergebnis**, **Belege**, **Offene Punkte / Fragen**. Keine ganzen Dateien zurückgeben.
9. **Prüfende Agents** (`test-reviewer`, `code-reviewer`, `visual-qa`, `ux-critic`, `spec-auditor`) ändern keine Dateien im Repo. Bilder, Skripte und Messdaten schreiben sie per Befehl nur in den vom Orchestrator genannten Ordner `.qa/<paket>/` im Haupt-Checkout. Nach ihrem Lauf muss `git status` sauber sein. Ihren Bericht geben sie als Schlussmeldung zurück.
10. **Befundstufen** (Prompt §4.2): blockierend · hoch · mittel · niedrig. Blockierend ist ein Befund, der eine Anforderung, Leitplanke oder Definition of Done verletzt, eine Anforderung ohne Test lässt oder Datenverlust, Datenschutz, Barrierefreiheit oder eine Regression betrifft.
