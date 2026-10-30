Entscheide und Steuerung (08.10.2026, Auftraggeber):

1. Q-051: Zugestimmt. Ausschliesslich den einen bestehenden perf-c-Testfall gemäss
   perf-c-kalibrierung.patch korrigieren (Faktor aus dem gemessenen lokalen Median statt fix
   1.5), mit lock-update und Grund «Q-051, Auftraggeber 08.10.2026» neu einfrieren, Eintrag in
   FINDINGS.md. Keine weiteren Änderungen an eingefrorenen Dateien.

2. Fokus auf das Produkt: Ziel ist die erste bedienbare Version (Zwischenstand I2: App-Rahmen,
   Wochen, Blöcke ziehen/betiteln/verschieben/löschen, speichern, Undo nach Neuladen).
   Keine neuen Werkzeug- oder Harness-Pakete mehr ohne meine Zustimmung (E1-01h war nicht
   bestellt). Werkzeug nur, wenn ein Produktpaket es zwingend braucht.

3. Fertig machen vor Neues anfangen: höchstens 2 Pakete gleichzeitig in Arbeit. Reihenfolge:
   E1-01c abschliessen und integrieren → E1-04b integrieren → E1-11 → E1-12 → E1-13a →
   Zwischenstand I2 ablegen. Die übrigen angefangenen Worktrees (e1-01c2, e1-01d, e1-01e,
   e1-02g, e1-02i, e1-03b, e1-06, e1-07b, e1-08, e1-09, e1-10, e1-13a, e1-14, e1-15) ruhen
   lassen: nicht committete Arbeit dort je als WIP-Commit auf dem Paketzweig sichern
   (Nachricht «WIP <paket>, nicht geprüft»), nichts löschen.

4. PROGRESS.md knapp halten: pro Paket eine Zeile Status, Abschnitt «Nächster Schritt»
   höchstens 10 Zeilen in normaler Sprache. Details nur in .qa/.

5. Melde mir kurz, wenn der Zwischenstand I2 liegt: Pfad zur HTML-Datei und Probierliste.

---

Entscheide Auftraggeber (08.10.2026):

1. Kalibrierungs-JSONs: Ausnahme erteilt, eng begrenzt.
   - Erlaubt: docs/wap-planer/perf/drosselung.json (und, falls schon vorhanden, die zur
     Kalibrierung gehörende perf-baseline.json) mit den tatsächlich gemessenen Werten neu
     einfrieren, per lock-update mit Grund «Neukalibrierung E1-01c §6 Nr.7 / ADR-010 §8,
     Auftraggeber 08.10.2026», Eintrag im lock-Protokoll in FINDINGS.md.
   - Bedingungen: Faktor nach der Regel aus ADR-010 §8 berechnet (132,7 / lokaler Median,
     aufgerundet auf die halbe Stufe, hier 2); Faktor nie unter 1,5; Herleitung, Rohwerte und
     Messbefehl im JSON und in .qa/e1-01c/ belegt. perf-baseline.json darf nur erstmals
     gesetzt werden; jede spätere Änderung, die ein Budget oder die Baseline lockert, braucht
     wieder meine Zustimmung.
   - Auf die Claude-Review-Warteschlange setzen.

2. WIP-Commits ohne Hook: nicht erteilt; --no-verify bleibt verboten (Auftrag §7).
   Meine Anweisung «WIP-Commit» ist hiermit ersetzt: Ruhende Arbeitsstände bleiben
   unverändert in ihren Worktrees liegen (nichts löschen, nichts verwerfen). Zusätzliche
   Sicherung nur als Patch, nicht als Commit:
     git -C <worktree> diff --binary HEAD > .qa/<paket>/wip-<yyyy-mm-dd>.patch
   plus Liste der nicht versionierten Dateien (git ls-files --others --exclude-standard)
   und deren Kopie nach .qa/<paket>/wip-untracked/. Wird ein Paket wieder aufgenommen, dort
   weiterarbeiten und erst committen, wenn die schnelle Schleuse grün ist.
   Falls du schon Sicherungen auf andere Weise angelegt hast: sag mir kurz, wie.

3. Danach weiter nach Steuerung 1191f09: E1-01c abschliessen und integrieren → E1-04b →
   E1-11 → E1-12 → E1-13a → Zwischenstand I2.

---

Entscheid Auftraggeber (08.10.2026): Volle Schleuse beschleunigen.
V1a-selbsttest (Selbsttest der Schleuse) läuft nur noch, wenn seit dem letzten grünen
V1a-selbsttest eine Datei unter scripts/wap-gate/, scripts/wap/, tests/wap-gate/,
tests/wap-harness/ oder eine Gate-/Vitest-/Playwright-Konfiguration geändert wurde
(per git diff --name-only gegen den Commit des letzten grünen Laufs bestimmt). Sonst wird
das letzte grüne Ergebnis übernommen, mit Status «WIEDERVERWENDET <commit>» im
Schleusenprotokoll und auf der Claude-Review-Warteschlange. An jedem Gate B immer voll.
Alle übrigen Schritte der vollen Schleuse bleiben unverändert in jedem Lauf.
Umsetzung als kleiner Werkzeugnachtrag mit Test (Stufe B), dann weiter mit E1-04b.
