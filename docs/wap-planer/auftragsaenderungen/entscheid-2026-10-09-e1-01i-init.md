Entscheid Auftraggeber (09.10.2026) zu CR-E101i-E2E-INIT-01:
Zurückgestellt (bleibt blockierend und offen, nicht verifiziert). E1-01i darf integriert
werden; danach weiter mit E1-04b, E1-11, E1-12, E1-13a.

Auflagen:
1. Diagnose parallel und ohne die Schleuse zu lockern: den betroffenen pdf-edge-Fall
   wiederholt laufen lassen (mindestens 20 Läufe, auch unter Last parallel zu einem
   Vitest-Lauf) und dabei Console-, Pageerror- und Netzereignisse vollständig aufzeichnen.
   Ergebnis in .qa/e1-01i/flatter-diagnose/.
2. Keine Retries, keine längeren Timeouts, keine Ausnahmen als Lösung. Ursache finden und
   beheben, mit einem Test, der den Fehler vorher rot zeigt.
3. Tritt der Fehler erneut auf, gilt er als reproduziert: dann zuerst beheben, bevor der
   nächste Merge nach wap-codex erfolgt.
4. Spätestens vor dem Zwischenstand I2 muss der Befund behoben oder mit Diagnose als nicht
   reproduzierbar belegt sein (mindestens 50 grüne Läufe in Folge). Auf die
   Claude-Review-Warteschlange setzen.
