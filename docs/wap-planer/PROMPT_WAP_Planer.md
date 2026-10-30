# Auftrag an Claude Code: WAP-Planer

> **Ablage im Repo:** `docs/wap-planer/PROMPT_WAP_Planer.md` (dieser Auftrag) und `docs/wap-planer/PROJEKTBESCHRIEB_WAP_Planer.md` (Projektbeschrieb).
> **Erster Start:** «Lies `docs/wap-planer/PROMPT_WAP_Planer.md` vollständig und beginne mit Etappe 0.»
> **Jede weitere Sitzung:** «Lies `docs/wap-planer/PROMPT_WAP_Planer.md` und `docs/wap-planer/PROGRESS.md` und setze fort.»
> **Geändert durch AE-001 (04.10.2026):** `docs/wap-planer/auftragsaenderungen/AE-001.md` geht diesem Auftrag vor, wo sie ihm widerspricht.

Du baust den **WAP-Planer** gemäss Projektbeschrieb. Du arbeitest als **Orchestrator** mit spezialisierten Subagents in einem selbstgesteuerten Loop: Anforderungen erfassen, Tests schreiben und unabhängig prüfen, umsetzen, unabhängig prüfen, nachbessern, bis alles belegt ist. Zwischen den Gates arbeitest du selbständig. An den Gates legst du mir vor und wartest. Ich bin Hptm Philipp Tischhauser, Kp Kdt, Auftraggeber und einziger Nutzer.

Verweise in diesem Dokument: «Prompt §5.3» meint diesen Auftrag, «Beschrieb 5.3» den Projektbeschrieb.

---

## 1 Dokumente

| Dokument | Rolle |
| --- | --- |
| `docs/wap-planer/PROJEKTBESCHRIEB_WAP_Planer.md` | Fachliche Grundlage, **verbindlich**. Enthält bewusst keine Technik. Er regelt das *Was*, dieser Auftrag das *Wie*. |
| Dieser Auftrag | Arbeitsweise, Qualitätsanspruch, Harness |
| `reference/` (nicht versioniert) | Referenzdateien, siehe Prompt §8 |
| Im Repo vorhanden (Ort prüfen) | Detachementsplaner; `PROMPT_Tagesbefehle.md` mit Fixture-Paket (Tagesbefehl-Vorhaben, das heute den Excel-WAP liest) |

Lies den Beschrieb vollständig, bevor du irgendetwas entscheidest. Zitiere bei jedem Entscheid und Befund die Stelle («Beschrieb 4.6», «R-4.6-03»).

---

## 2 Anspruch

- **Kein Prototyp, kein Schnellschuss.** Massstab: Ich arbeite lieber mit dem WAP-Planer als mit Excel, und das PDF hält einen Seiten-Vergleich mit dem heutigen aus und ist besser lesbar.
- **Zeit und Tokens sind kein Sparziel.** Gründlichkeit, Korrektheit, Robustheit und durchdachte Bedienung gehen vor Tempo. Lieber eine Prüfrunde mehr als ein Fehler im PDF.
- **Fertig heisst belegt:** reproduzierte Testläufe, Screenshots, PDF-Vergleiche, Messwerte, Commit-Hashes. Nie «sollte funktionieren».
- **Nicht abkürzen:** keine Platzhalter, keine TODOs im ausgelieferten Code, keine übersprungenen oder abgeschwächten Tests, keine gelockerten Schwellwerte, keine stillen Vereinfachungen. Ist etwas im Beschrieb nicht sauber umsetzbar oder gibt es eine klar bessere Lösung, meldest du es (Prompt §5.4), statt es still anders zu machen.
- **Bedienung ist Kernqualität:** flüssig, vorhersehbar, vollständig tastaturbedienbar, mit sinnvollen Leer-, Lade- und Fehlerzuständen. Die Oberfläche ist ruhig, präzise und einheitlich gestaltet (Prompt §4, `ui-designer`).

---

## 3 Technischer Rahmen

Der Beschrieb enthält keine Technik; **du triffst die Architekturentscheide** und legst sie an Gate 0 vor. Jeden wesentlichen Entscheid hältst du als ADR in `docs/wap-planer/adr/NNN-titel.md` fest: Kontext, geprüfte Optionen, Entscheid, Folgen, Beleg (z.B. Spike-Ergebnis).

**Ausgangslage prüfen:** Ich gehe davon aus, dass die Suite auf React basiert. Prüfe das am Repo, ebenso, wie der Detachementsplaner gebaut und ausgeliefert wird (möglicherweise eine einzelne HTML-Datei ohne Framework). Weicht die Realität von meiner Annahme ab, ist das ein Entscheid an Gate 0. Übernimm Aufbau, Konventionen, Styling und Werkzeuge des Repos. Eingebunden wird der WAP-Planer nur dort, wo es Vorteile bringt; sonst bleibt er eigenständig (Beschrieb 9, 11).

**Leitplanken** (Abweichung nur mit meiner Zustimmung):

1. **Ein Datenmodell als einzige Quelle.** Raster, Listenansicht, PDF, Prüfungen, Import-Ergebnis und Tagesbefehl-Lieferung sind Ableitungen davon.
2. **Eine gemeinsame Layout-Schicht** berechnet Positionen, Breiten, Textumbruch und -grösse, Kollisionen und Aussparungen. Sie ist rein, deterministisch und ohne Oberfläche testbar. Die Textmessung erfolgt mit derselben Schriftdatei, unabhängig vom Browser. Bildschirm und PDF zeichnen die vorberechneten Umbrüche; der Browser bricht nie selbst um. So sehen Bildschirm und PDF identisch aus.
3. **Schrift:** eine frei lizenzierte, serifenlose Schrift als Datei im Projekt (z.B. Liberation Sans oder Arimo, metrisch ähnlich Arial). Office-Schriften dürfen nicht eingebettet werden. Die Wahl ist ein ADR und Teil der Sichtprobe (Gate S).
4. **PDF:** vektoriell, Text markier- und durchsuchbar, Schrift eingebettet, offline erzeugt, deterministisch (feste Metadaten, keine Zeitstempel; gleicher Plan und Stand ergeben dasselbe PDF).
5. **Undo/Redo** über alle Änderungen einschliesslich Import, Übernahme und Massenänderungen, persistent über Neuladen (Beschrieb 5.6).
6. **Auslieferung und Betrieb** (Pflicht-ADR mit Spike-Beleg vor Gate 0):
    - Wie das Tool zu mir kommt (z.B. gehostet mit Offline-Cache, Einzeldatei) und wie ich neue Versionen erhalte.
    - Zielumgebung: Microsoft Edge auf dem Dienstlaptop ohne Adminrechte (Version und Fähigkeiten aus der Umgebungsprobe, Prompt §5.1 Schritt 3); Lesen auf dem Tablet.
    - Speicherort, dauerhafte Speicherung, Verhalten bei vollem oder nicht dauerhaftem Speicher (Beschrieb 5.6).
    - Sichern und Laden von Plan-Dateien in der Zielumgebung.
    - Migration von Plan-Datei und lokalem Speicher bei Updates; Formatversion in jeder Datei.
    - Keine Laufzeitabhängigkeit von externen Diensten.
7. **Excel-Import** als klar abgegrenztes Modul mit eigenem Bericht. Prüfe, ob er mit dem Tagesbefehl-Vorhaben geteilt werden soll, statt doppelt gebaut zu werden.

---

## 4 Organisation: Orchestrator und Subagents

Du bist der Orchestrator. Du planst, verteilst, integrierst, entscheidest und dokumentierst. Die eigentliche Arbeit machen Subagents.

### 4.1 Grundsätze

- **Niemand prüft seine eigene Arbeit.** Prüfende Agents erhalten Beschrieb, Anforderungen, Schnittstellenvertrag und Ergebnis, nicht die Überlegungen des Umsetzenden.
- **Tests entstehen aus den Anforderungen,** vor der Umsetzung, und werden vor der Umsetzung unabhängig geprüft und eingefroren (Prompt §5.2).
- **Du schreibst selbst keinen Produkt- oder Testcode**, auch nicht, wenn es schneller ginge. Auch Merge-Konflikte löst ein `implementer`, und die Lösung geht durch den `code-reviewer`.
- **Beleg ist nur, was du selbst reproduziert hast:** Befehl, Ausgabe, Commit-Hash. Die Schleuse führst du nach jedem Paket selbst aus. Berichte von Subagents sind Hinweise, keine Belege.
- **Du stufst keinen Befund herab.** Prüferberichte hängst du unverändert an; du darfst zusammenfassen, aber nicht umbewerten.
- **Halte deinen Kontext schlank:** Agents berichten Ergebnis, Belege und offene Punkte, nicht ganze Dateien.
- **Parallelisiere,** was unabhängig ist (Prompt §5.6).
- **Nur du startest Agents.** Subagents dürfen standardmässig weitere Agents starten; das sperrst du in jeder Agent-Datei.

### 4.2 Befundregister und «blockierend»

`docs/wap-planer/FINDINGS.md` führt jeden Befund mit: ID, Quelle (Agent, Paket), Stufe, Anforderungs-ID bzw. Beschrieb-Stelle, Fundstelle, Status (offen · behoben · verifiziert · zurückgestellt · abgelehnt), Begründung, «verifiziert durch». «Verifiziert» setzt nur eine frische Instanz des Prüfertyps, der den Befund erhoben hat.

**Blockierend** ist ein Befund, wenn er eine Anforderung, Leitplanke oder Definition of Done verletzt, eine Anforderung ohne Test lässt, oder Datenverlust, Datenschutz, Barrierefreiheit oder eine Regression betrifft. Einen blockierenden Befund lehne nur ich ab. Nicht blockierende Befunde erhalten einen Entscheid (jetzt · Etappe N · nie, mit Grund) und erscheinen an Gate B.

### 4.3 Die Agents

Lege sie in Etappe 0 in `.claude/agents/` an. Prüfe vorher in der aktuellen Claude-Code-Dokumentation (Subagents, Hooks, Settings) die genauen Frontmatter-Felder. Jede Datei enthält mindestens `name`, `description`, `model: inherit` und `tools` als **Positivliste ohne das Agent-Werkzeug**, damit Subagents keine weiteren Agents starten. Keine automatische Worktree-Isolation im Frontmatter; Worktrees verwaltest du selbst (Prompt §5.6). Darunter steht ein präziser Systemprompt mit Rolle, Eingaben, Prüfkriterien, Ausgabeformat und Verboten.

**Prüfende Agents** erhalten kein Edit oder Write. Sie geben ihren Bericht als Schlussmeldung zurück; Bilder und Messdaten schreiben sie per Befehl nach `.qa/<paket>/` (nicht versioniert). Du legst jeden Bericht unverändert als `.qa/<paket>/<agent>-<runde>.md` im Haupt-Checkout ab, überträgst die Befunde mit Verweis nach `FINDINGS.md` und pseudonymisierte Ergebnisdokumente nach `docs/`. `.qa/` wird bis nach Gate B nicht gelöscht und liegt immer im Haupt-Checkout; Prüfer erhalten dafür den absoluten Pfad, nie einen Pfad im Worktree. Nach jedem Prüferlauf muss `git status` im Repo sauber sein.

| Agent | Auftrag | Darf nicht | Liefert |
| --- | --- | --- | --- |
| `spec-analyst` | Anforderungskatalog mit IDs, Glossar, Standardaufgaben für die UX-Prüfung, Soll-Listen Anhang A–C (Prompt §5.1) | Import-Code schreiben oder verwenden | `requirements.md`, `glossar.md`, `standardaufgaben.md`, Anhänge, Fragen |
| `architect` | Architektur, ADRs, Spikes, Etappenpläne mit Arbeitspaketen, Schnittstellenverträgen und Vertrags-Stubs; Drift-Prüfung bei Paketen, die Modulgrenzen, Datenmodell oder Layout-Schicht ändern, und an jedem Etappenende | Produktcode schreiben, ausser Vertrags-Stubs | Pläne, ADRs, Verträge, Stubs, Drift-Befunde |
| `ui-designer` | Bedien- und Gestaltungskonzept: App-Rahmen, Wochennavigation, Raster-Interaktion, Seitenfeld, Listenansicht, Befundliste, Import-Bericht, Dialoge, Leer-, Lade- und Fehlerzustände, Tastaturkonzept, Gestaltungsgrundlagen passend zur Suite | Produktcode schreiben | `ui-richtlinie.md`, statische Ansichten der Kernzustände |
| `test-engineer` | Tests aus Anforderungen und Schnittstellenvertrag: Unit, Property-basiert, Integration, End-to-End, PDF | Produktcode schreiben; Tests an Code anpassen | Tests, Rot-Nachweis |
| `test-reviewer` | Prüft Tests nur gegen Beschrieb, Anforderungen und Vertrag: jede ID abgedeckt, positive und negative Fälle, Grenzwerte, keine tautologischen oder implementierungsgebundenen Asserts; entscheidet über Test-Einwände | Code oder Tests ändern | Befunde, Freigabe für den Test-Freeze |
| `implementer` | Setzt genau ein Arbeitspaket um, bis alle eingefrorenen Tests grün sind | eingefrorene Dateien ändern (Prompt §5.2) | Code, Commit, kurzer Bericht |
| `code-reviewer` | Prüft den Diff: Beschrieb-Treue, Korrektheit, Fehlerfälle, Lesbarkeit, Performance, Datenschutz, Einhaltung von ADRs, Verträgen, Glossar und UI-Richtlinie | Code ändern | Befunde mit Stufe |
| `visual-qa` | Vergleicht PDF und Bildschirm regionsweise (Kopf, Seitenleiste, je Tag, Terminbereich) bei mindestens 400 dpi mit der Referenz daneben; prüft Anhang B-Kp bzw. B-Bat; prüft Kandidaten für Golden-Bilder | Code ändern | Vergleichsbericht mit Bildausschnitten |
| `ux-critic` | Führt die Standardaufgaben im Browser über Playwright aus, auch rein per Tastatur; zählt Aktionen und führt sie als Messreihe über alle Etappen in `standardaufgaben.md`; findet Reibung, Unklarheiten, fehlende Rückmeldungen; macht die Nacharbeit für 14.1 (Prompt §5.3) | Code ändern; Anhang A einsehen | Befunde, Aktionszahlen, Screenshots |
| `spec-auditor` | Unabhängige Katalog- und Planprüfung (Prompt §5.1, §5.3) und Etappen-Audit: jede Anforderung der Etappe gegen laufende App, Tests und Belege | Code ändern; frühere eigene Berichte als Beleg verwenden | Satz-Zuordnung, Abdeckungsmatrix |

Weitere Agents legst du an, wenn sie die Qualität erhöhen (z.B. `perf-analyst`, `import-specialist`), und begründest sie im Plan.

---

## 5 Der Loop

### 5.1 Etappe 0 – Fundament (einmalig)

0. **Zweig:** `wap-planer` von `main` anlegen; alle Commits ab Etappe 0 dort.
1. **Lesen:** Beschrieb, diesen Auftrag und die Referenzen.
2. **Repo erkunden:** Struktur, Build, Tests, Lint, Styling, Suite-Mechanismen, Detachementsplaner (Datenstruktur: Personenmerkmal «Zug / Element», Detachemente mit Zeitraum), `PROMPT_Tagesbefehle.md` mit Fixtures. Dabei die React-Annahme prüfen (Prompt §3).
3. **Umgebungsprobe:** Direkt danach lässt du eine eigenständige Prüfseite ohne Echtdaten bauen (Teil von Paket H0, Schritt 5) und bittest mich sofort, nicht erst an Gate 0, sie auf dem Dienstlaptop in Edge und auf dem Tablet zu öffnen und dir die Ausgabe zu senden. Sie meldet: Browser und Version, dauerhafte Speicherung und Kontingent, lokale Datenbank, Offline-Fähigkeit in den erwogenen Auslieferungsarten, Datei sichern und öffnen, Schriftdarstellung sowie einen festen Rechen-Benchmark, der auch bei dir läuft. Daraus leitest du den Drosselungsfaktor für die Leistungsmessung ab (Prompt §7). Bis zur Antwort laufen die übrigen Schritte weiter.
4. **Verankern:** Ergänze auf dem Zweig `wap-planer` die bestehende `CLAUDE.md` (nicht überschreiben) um einen kurzen Abschnitt: «Arbeit am WAP-Planer: zuerst `docs/wap-planer/PROMPT_WAP_Planer.md` und `PROGRESS.md` vollständig lesen; die dortigen Regeln gelten. Kein Produktcode durch den Orchestrator. Eingefrorene Dateien gemäss `test-lock.json` nicht ändern.» Änderungen an `CLAUDE.md` und `.claude/settings.json` erfolgen nur auf `wap-planer`; Hooks und Sperren greifen nur für Pfade des WAP-Planers. Die Auswirkungen auf die übrige Suite legst du an Gate 0 vor.
5. **Harness einrichten:**
    - `docs/wap-planer/PROGRESS.md`, `QUESTIONS.md`, `FINDINGS.md`, `adr/`, `gates/`, `pakete/`, `zwischenstand/` anlegen; `.qa/`, `spikes/` und `reference/` in `.gitignore`.
    - `.claude/settings.json` mit Erlaubnisliste (Paketskripte, Test, Lint, Build, Rendern, `git add/commit/worktree/merge` auf Zweigen des WAP-Planers) und Sperrliste (`git push`, destruktive Git-Befehle, Löschen ausserhalb des Repos, Netz ausser Paketinstallation).
    - Hook gemäss aktueller Doku: Edit und Write auf Pfade aus `test-lock.json` sind für alle gesperrt. `test-lock.json`, `scripts/wap/` und die Hook-Konfiguration gehören selbst zu den gesperrten Pfaden. Entsperren geht nur über `scripts/wap/lock-update` mit Grund und Eintrag in `FINDINGS.md`; `lock-update` führst nur du aus. Massgebend ist der Hash-Abgleich in jeder Schleuse; er erkennt auch Änderungen per Befehl.
    - Bis die Schleusen eingerichtet sind (Prompt §5.3), laufen vor jedem Commit nur Datenschutz-Scan und Lock-Prüfung.
    - Agents anlegen (Prompt §4.3).
    - **Paket H0 «Harness»:** Hook, Lock-Prüfung, `scripts/wap/lock-update`, Datenschutz-Scan und die Prüfseite der Umgebungsprobe gelten nicht als Produktcode. Ein `implementer` schreibt sie nach Prompt §5.2, jedoch ohne die Schritte 2, 5, 6 und 8; ein frischer `code-reviewer` prüft sie. Die Prüfseite liegt in `spikes/`. Harness-Anforderungen erhalten IDs `R-H-nn` mit Quelle «Prompt §…», damit die Rückverfolgbarkeit auch für die Werkzeugkette greift. Reihenfolge: Agents anlegen → H0 (Prüfseite zuerst, sofort an mich) → Harness-Selbsttest.
    - **Harness-Selbsttest:** (1) Jeder Agent wird mit einem Kurzauftrag aufgerufen und meldet Namen und verfügbare Werkzeuge. (2) Ein Prüfer-Agent versucht, eine Datei per Edit oder Write zu ändern und einen Agent zu starten; beides muss scheitern. (3) Ein Schreibversuch auf eine gesperrte Datei wird per Edit vom Hook blockiert und per Befehl von der Lock-Prüfung erkannt, im Haupt-Checkout und in einem Paket-Worktree. Schlägt (1) fehl, bittest du mich, `/agents` auszuführen oder die Sitzung neu zu starten. Das Ergebnis kommt ins Harness-ADR und in die Gate-0-Vorlage.
6. **`spec-analyst`:**
    - **Anforderungskatalog** `requirements.md`: je Anforderung ID (`R-4.6-03`), Beschrieb-Stelle, Wortlaut, Etappe, Prüfart (Unit / Property / Integration / E2E / PDF / durch mich), Abnahmekriterium, Beispiel aus FDT 2026.
    - **Glossar** `glossar.md`: jeder Begriff aus Beschrieb 2 → fester Bezeichner im Code → Text in der Oberfläche.
    - **Standardaufgaben** `standardaufgaben.md` aus Beschrieb 5, 6 und 14.6, je mit Ausgangszustand, Ziel und Soll-Aktionszahl. Beispiele: Woche mit Spaltensatz anlegen; Block ziehen und betiteln; «auch an anderen Tagen» Di–Fr; Beso mit drei Zeitfenstern; Beso verschieben und Nummern prüfen; Querbalken über eine Wochengrenze; Import-Bericht durchgehen; Stand setzen; PDF erzeugen; Undo nach Neuladen.
    - **Anhänge A–C** (Beschrieb 14): Erlaubt ist ein Rohinventar der Formen (Text, Füllung, Rohkoordinaten, Gruppierung) ohne Deutung als Zeit oder Spalte. Zeit, Spalte, Typ und Kategorie werden am gerenderten PDF abgelesen und mit dem Inventar abgeglichen. Import und Tests verwenden das Inventar-Skript nie. Zwei unabhängige Instanzen erstellen A und C getrennt; Abweichungen werden geklärt oder mir vorgelegt. Format CSV oder JSON mit festen Feldern: Woche, Tag, Typ, Titel, Zeitform, von, bis, Spalten, Kategorie, Ltg, Ort, Nr, Status. Dazu dokumentierte Normalisierungsregeln. «Korrekt erkannt» heisst: Typ, Tag, Zeit (nach Rundung gemäss Beschrieb 8.2), Spalten, Kategorie, Titel und bei Beso die Nummer stimmen. Anhang B wird getrennt als B-Kp und B-Bat geführt; B-Kp enthält zusätzlich die aus dem Referenz-PDF vermessenen Sollwerte mit Toleranz (Ränder, Breitenverhältnisse, Zeit → Position, Linien, Farben).
    - **Zeitpunkt:** Anhang A und B-Kp in Etappe 0 (Vorlage an Gate 0). Anhang C und B-Bat erst vor Gate A der Etappe 3, auf Basis des offiziellen Bat-PDF.
7. **Katalogprüfung:** Ein frischer `spec-auditor` ordnet den Beschrieb Satz für Satz zu, ohne `requirements.md` zu kennen. Jeder Satz, jede Tabellenzeile und jedes Beispiel erhält Anforderungs-IDs oder die begründete Markierung «Kontext, nicht prüfbar». Danach Abgleich mit dem Katalog; Lücken, Doppelungen und abweichende Auslegungen werden bereinigt oder kommen als Frage an Gate 0. Ergebnis: `trace-beschrieb.md`.
8. **Spikes** (Wegwerf-Experimente in `spikes/`, nicht versioniert, danach gelöscht, Ergebnis im ADR):
    1. Textmessung und Umbruch mit derselben Schriftdatei ohne DOM; identische Umbrüche am Bildschirm und im PDF an 50 Texten aus dem Referenz-WAP.
    2. PDF mit eingebetteter Schrift, bei zweimaliger Erzeugung identisch.
    3. Dauerhafte Speicherung, Kontingent und Datei-Sichern, lokal und mit den Ergebnissen der Umgebungsprobe (Schritt 3).
    4. Eine Kp-Woche aus dem Excel lesen, inkl. Gruppen-Transformation und Rotation.
9. **`architect`:** Architektur mit ADRs (inkl. Auslieferung und Betrieb, Schrift, Harness), Qualitätsinstrumente (Prompt §7), Plan Etappe 1 mit Arbeitspaketen und Schnittstellenverträgen (Prompt §5.2).
10. **`ui-designer`:** UI-Richtlinie und statische Ansichten der Kernzustände.
11. **Unabhängige Prüfungen:** ein frischer `code-reviewer` prüft Architektur und ADRs (Risiken, Testbarkeit, Einhaltung der Leitplanken 1–7 aus Prompt §3); ein frischer `spec-auditor` prüft den Plan Etappe 1 (jede ID der Etappe genau einem Paket und einem Testplan zugeordnet).
12. **Gate 0** (Vorlage gemäss Prompt §10): ADRs mit Spike-Ergebnissen, Ergebnis der Umgebungsprobe, Harness-Konfiguration mit Selbsttest und Auswirkungen auf die Suite, Katalog mit Satz-Zuordnung, Anhang A und B-Kp mit Prüfhilfe (Anzahlen je Woche, Tag und Typ; unsichere Einträge markiert; Abweichungen der zwei Zählungen), Glossar, Standardaufgaben, UI-Richtlinie, Qualitätsinstrumente, Plan Etappe 1, Vorschlag für das Dateiformat der Personenliste, Fragen. **Gate 0 gilt zugleich als Gate A der Etappe 1.** Vor Gate 0 kein Produktcode ausser den Spikes und dem Harness (Paket H0).

### 5.2 Das Arbeitspaket

**Paket-Checkliste:** Für jedes Paket erzeugst du aus einer Vorlage `docs/wap-planer/pakete/<id>.md` mit den folgenden Schritten als Kästchen. Ein Kästchen gilt erst mit Beleg als erledigt: Befehl, Ausgabeauszug, Commit-Hash, Befund-IDs. Der nächste Schritt ist immer das erste offene Kästchen. Lock-Aktualisierung, Rückverfolgbarkeits-Matrix und die Zahlen für die Gate-Vorlagen erzeugen Skripte, nicht du von Hand.

1. **Paket-Worktree:** Du legst `git worktree add <repo>/../wap-wt/<paket> -b wap/<paket> wap-planer` an (ausserhalb des Repos) und installierst dort. Alle Agents des Pakets erhalten diesen absoluten Pfad. Der Hook ermittelt zu jeder Datei ihren Worktree (`git -C <verzeichnis> rev-parse --show-toplevel`) und prüft gegen das `test-lock.json` dieses Worktrees.
2. **Schnittstellenvertrag und Stubs** (vom `architect` gemäss Etappenplan): öffentliche Typen und Signaturen, Fehlerverhalten; für die Oberfläche ARIA-Rollen und -Namen, sichtbare Texte und nur wo nötig `data-testid`. Dazu Stubs: Signaturen, deren Rümpfe einen «nicht implementiert»-Fehler werfen, und leere Komponenten mit den vertraglichen Rollen und Namen. Tests greifen nur über den Vertrag zu, End-to-End-Tests bevorzugt über Rolle und Name.
3. **Tests:** Der `test-engineer` schreibt die Tests; jeder Test nennt seine Anforderungs-IDs im Namen (z.B. `[R-4.6-03]`).
4. **Test-Review:** Ein frischer `test-reviewer` prüft die Tests gegen Beschrieb, Anforderungen und Vertrag.
5. **Rot-Nachweis:** Jeder neue Test schlägt mit einem Assertion-Fehler fehl, nicht mit einem Import-, Syntax- oder Timeout-Fehler. Bei End-to-End-Tests gilt das Scheitern der ersten fachlichen Erwartung, nicht eines Setup-Schritts. Ausgenommen sind Golden-Vergleiche; sie werden in Schritt 8 scharf geschaltet.
6. **Test-Freeze:** Du committest Tests, Stubs, Vertrag und `docs/wap-planer/test-lock.json` als Freeze-Commit. `test-lock.json` enthält die SHA-256 aller Testdateien, Fixtures, Schwellwerte, Vertrags-Signaturen, freigegebenen Golden-Bilder und der bestätigten Anhänge. Die Schleuse bricht bei jeder Abweichung ab.
    - Hält der `implementer` einen Test für falsch, erhebt er einen **Test-Einwand** mit Beschrieb-Zitat; darüber entscheidet ein frischer `test-reviewer`. Einwände gegen den Vertrag entscheiden ein frischer `architect` und ein frischer `test-reviewer` gemeinsam. Bei Auslegungsfragen entscheide ich.
    - Jede Änderung an `test-lock.json` wird mit Grund protokolliert und an Gate B aufgelistet. Die Anhänge ändern sich nach meiner Bestätigung nur mit meiner Einzelbestätigung.
7. **Umsetzung:** Der `implementer` ersetzt die Stub-Rümpfe und setzt um, bis alle Tests grün sind; er committet auf `wap/<paket>`. Danach prüfst du `git diff --name-only <freeze-commit>..HEAD` gegen die gesperrten Pfade und verwirfst Verstösse.
8. **Golden-Bilder** (nur bei Layout/PDF): Der `implementer` erzeugt Kandidaten aus pseudonymisierten Fixtures; ein frischer `visual-qa` prüft sie gegen Referenz und Anhang B-Kp bzw. B-Bat. Erst dann nimmst du sie mit Status «vorläufig» in `test-lock.json` auf.
9. **Schleuse:** volle Schleuse im Paket-Worktree, von dir selbst ausgeführt (Prompt §7).
10. **Prüfung:** `code-reviewer` prüft `git diff <freeze-commit>..HEAD`; bei Layout oder PDF zusätzlich `visual-qa`; `ux-critic`, sobald ein im Plan markierter Teilablauf der Standardaufgaben durchgängig bedienbar ist.
11. **Nachprüfung:** Befunde gehen an den `implementer`. Eine frische Instanz desselben Prüfertyps erhält die offenen Befunde aus `FINDINGS.md` und den Nachbesserungs-Diff, verifiziert jeden Befund einzeln und prüft den neuen Diff vollständig. Neue Befunde zu unverändertem Code sind nur zulässig, wenn sie blockierend sind.
12. **Eskalation** nach 4 Prüfrunden ohne Freigabe, bei widersprüchlichen Befunden zweier Prüfer oder wenn der `implementer` einen Befund bestreitet: Der `architect` analysiert, du entscheidest mit Begründung in `FINDINGS.md`; bei Auslegungsfragen fragst du mich.
13. **Integration:** Merge von `wap/<paket>` nach `wap-planer`, danach erneut die volle Schleuse auf `wap-planer`. Ist sie rot, nimmst du den Merge zurück. Dann `PROGRESS.md` nachführen, Worktree entfernen.

### 5.3 Pro Etappe

1. **Plan:** Der `architect` erstellt `docs/wap-planer/plan/etappe-N.md`: Arbeitspakete mit Anforderungs-IDs, Dateimengen, Abhängigkeiten, Schnittstellenverträgen, Testplan, Risiken, Reihenfolge, Parallelität und Meilensteinen. Ein frischer `spec-auditor` prüft die Zuordnung aller IDs der Etappe. Vor Gate A der Etappe 3 legst du zusätzlich Anhang C und B-Bat vor. **Gate A:** meine Freigabe (für Etappe 1 in Gate 0 enthalten).
2. **Nur Etappe 1 – Werkzeugkette, Durchstich und Sichtprobe:**
    - **Paket 1 «Werkzeugkette und Schleusen»** enthält keine Fachlogik und wird per Selbsttest abgenommen: Je ein absichtlich eingebauter Verstoss muss die Schleuse rot machen, nämlich ein übersprungener Test, ein `TODO`, eine gesperrte Datei geändert per Edit und per Befehl, eine AHV-Nummer und ein Test ohne ID. Die Verstösse «Schrift unter der Mindestgrösse im PDF» und «Leistungsregression» prüfst du am Ende von Paket 2 nach, vor Gate S. Der Selbsttest läuft an jedem Gate B erneut.
    - **Paket 2 «Durchstich»:** Datenmodell → Layout-Schicht → PDF und Bildschirm für die KVK-Woche. Die Daten sind von Hand als pseudonymisiertes Fixture erfasst; Schrift, Linien, Farben, Seitenleiste und Terminbereich sind echt.
    - **Gate S:** Du legst mir das PDF neben der Referenzseite vor, dazu einen Screenshot und die bekannten Abweichungen. Ich gebe Optik und Schriftgrössen frei. Bis dahin laufen nur Pakete, die nicht von der Optik abhängen.
3. **Arbeitspakete** gemäss Prompt §5.2. An jedem Meilenstein legst du einen nicht blockierenden Zwischenstand in `docs/wap-planer/zwischenstand/` ab (neu, Screenshots, Fragen) und arbeitest weiter.
4. **Etappen-Abschluss:** `spec-auditor`, `visual-qa` (alle Seiten) und `ux-critic` (alle Standardaufgaben der Etappe) prüfen unabhängig; der `architect` prüft auf Drift. Befunde abarbeiten, erneut prüfen, bis alles grün ist. Die **Nacharbeit für 14.1** macht ein `ux-critic` über die Oberfläche, nur mit Importbericht, Listenansicht und Referenz-PDF und ohne Kenntnis von Anhang A; seine Aktionen werden gezählt und ausgewiesen. Danach vergleicht das Skript mit Anhang A.
5. **Abnahmebericht** `docs/wap-planer/abnahme/etappe-N.md` mit Belegen: Abdeckungsmatrix, PDF- und Bildschirmvergleiche, Messwerte, Testübersicht, Änderungen an `test-lock.json`, bekannte Einschränkungen. Er trennt:
    - (a) durch Agents belegte Kriterien;
    - (b) Kriterien, die ich bestätige: 14.2, 14.6, 14.15, 14.16 und die Freigabe der Golden-Bilder. Dafür bereitest du vor: Seiten-an-Seiten-PDF je Woche, ein Vorführskript zu Beschrieb 5.6 mit erwarteten Ergebnissen, die Tempo-Aufgabe mit Messanleitung.
6. **Gate B:** meine Abnahme. Erst danach beginnt die nächste Etappe. Gate B der Etappe 1 enthält die Bitte um meine Excel-Ausgangsmessung für Kp Wo 1 (Beschrieb 14.6), mit Messanleitung: Start, Ende, was zählt.

### 5.4 Wann du mich fragst

- An den Gates 0, A, S und B.
- Wenn der Beschrieb unklar oder widersprüchlich ist und die Vorgaben in Beschrieb 15 nicht helfen.
- Wenn eine Abweichung vom Beschrieb nötig oder deutlich besser wäre.
- Bei irreversiblen Entscheiden, Auswirkungen auf andere Werkzeuge der Suite oder neuen Abhängigkeiten mit Lizenz- oder Datenschutzfragen.
- **Offene Punkte aus Beschrieb 15:** Du arbeitest mit der Vorgabe und legst den Punkt am nächsten Gate vor. Du hältst nur an, wenn die Vorgabe nachweislich nicht funktioniert (z.B. wenn mit 5 / 5,5 / 4,5 pt die Rückfallregel in den Referenzwochen greift und 14.3 verletzt), dann mit Messwerten und Optionen.
- **Planänderungen nach Gate A:** Schnitt und Reihenfolge der Pakete änderst du selbst und protokollierst es. Wegfall, Verschiebung in eine andere Etappe oder eine andere Auslegung einer Anforderung legst du mir vor.

Sonst entscheidest du selbst, dokumentierst den Entscheid und arbeitest weiter. Fragen sammelst du in `QUESTIONS.md`, statt für jede einzeln anzuhalten; Arbeit, die nicht von der Antwort abhängt, läuft weiter. Zwischen den Gates hältst du nicht für Statusmeldungen an.

### 5.5 Zustand und Wiedereinstieg

**`PROGRESS.md`** hat feste Abschnitte:

1. Stand: Etappe, Paket, Schritt.
2. Freigabeprotokoll: Gate, Datum, meine Antwort wörtlich, Auflagen.
3. Pakettabelle mit Status und Commit-Hash.
4. Verweis auf offene Fragen und offene blockierende Befunde.
5. Nächster Schritt, so konkret, dass eine frische Sitzung ihn ohne Rückfrage ausführen kann.

Du aktualisierst `PROGRESS.md` nach jedem Schritt und committest es, bevor eine Sitzung endet oder der Kontext knapp wird.

**Wiedereinstieg** in jeder neuen Sitzung:

1. Diesen Auftrag, `PROGRESS.md`, `QUESTIONS.md` und `FINDINGS.md` lesen.
2. `git status`, `git worktree list`, `git log -20`.
3. Die volle Schleuse ausführen, sobald sie eingerichtet ist; ist sie rot, zuerst das klären.
4. Unterbrochene Pakete nicht in alten Worktrees fortsetzen, sondern ab dem letzten belegten Kästchen der Paket-Checkliste neu aufsetzen.

### 5.6 Git und Parallelität

- Gearbeitet wird auf dem Zweig `wap-planer`. Nach `main` wird erst nach Gate B gemergt; gepusht wird nur nach meiner Freigabe.
- Parallel laufen nur Pakete mit laut Plan getrennten Dateimengen, jedes in seinem Paket-Worktree gemäss Prompt §5.2 (Zweig `wap/<paket>` ab `wap-planer`, eigene Installation). Integration ist der Merge nach `wap-planer`.
- Worktrees erreichen die Referenzen über die Umgebungsvariable `WAP_REFERENCE_DIR` (absoluter Pfad); parallele End-to-End-Läufe nutzen freie Ports.
- Referenzbasierte Tests bilden die Suite `test:reference`. Fehlt eine Datei, schlägt sie fehl, nie «skip».
- Dateien anderer Suite-Werkzeuge änderst du nur nach meiner Freigabe.
- Kleine, aussagekräftige Commits; jede Änderung an Golden-Bildern ist ein eigener Commit mit Grund und Anforderungs-ID.

---

## 6 Definition of Done

**Pro Arbeitspaket**

- Jede Anforderung des Pakets ist durch mindestens einen Test belegt; alle Tests grün; keine Typ-, Lint- oder Konsolenfehler.
- Test-Freeze eingehalten; keine offenen Test-Einwände.
- `code-reviewer` ohne blockierende Befunde; bei Layout/PDF `visual-qa`, bei durchgängigen Abläufen `ux-critic` ebenso; alle Befunde in `FINDINGS.md` verifiziert oder entschieden.
- Oberfläche gemäss UI-Richtlinie und Glossar: tastaturbedienbar, sichtbarer Fokus, Texte in Deutsch (Schweiz, «ss»), Meldungen mit Ursache und nächstem Schritt, Leerzustände vorhanden.
- Jede neue Aktion ist rückgängig machbar und wird sofort gespeichert.
- Keine Verschlechterung der Leistungswerte (Prompt §7).
- `PROGRESS.md`, ADRs und Verträge nachgeführt.

**Pro Etappe**

- Alle Abnahmekriterien der Etappe (Beschrieb 13/14) belegt oder als «durch mich zu bestätigen» vorbereitet; 14.13–14.15 erneut geprüft.
- Abdeckungsmatrix des `spec-auditor` ohne Lücken für die Etappe und alle früheren.
- Mutationsscore und Abdeckung gemäss Prompt §7 erreicht.
- Keine offenen blockierenden Befunde.

---

## 7 Qualitätsinstrumente

In Etappe 0 planen, in Paket 1 der Etappe 1 («Werkzeugkette und Schleusen») einrichten und per Selbsttest belegen.

**Schleusen**

- *Schnelle Schleuse* vor jedem Commit: Lint, Typprüfung, Unit-Tests, Test-Lock, Datenschutz-Scan. Auf `wap/<paket>` gilt bis zum Abschluss von Prompt §5.2 Schritt 7: Die Tests mit den Anforderungs-IDs des laufenden Pakets (aus `pakete/<id>.md`) müssen ausführbar sein und mit Assertion-Fehler scheitern; alle übrigen Tests müssen grün sein.
- *Volle Schleuse* im Paket-Worktree vor dem Merge und erneut auf `wap-planer` danach: alles, inkl. End-to-End, PDF-Prüfungen, Bildschirm-Regression, Leistung, `test:reference`. Ein Merge nach `wap-planer` ist nur mit ausnahmslos grünen Tests zulässig.
- Verboten: `--no-verify` und das Deaktivieren von Hooks.
- **Schwellwerte lockern** (Budget, Baseline, Toleranz, Abdeckung, Mutationsscore) darfst du nur mit meiner Zustimmung am nächsten Gate. Bis dahin gilt der alte Wert, und der Verstoss ist blockierend.
- Der **Datenschutz-Scan** blockiert Dateien aus `reference/`, AHV-Nummern (`756\.\d{4}\.\d{4}\.\d{2}`), Telefonnummern, E-Mail-Adressen und Namen aus einer lokalen, nicht versionierten Sperrliste.

**Tests und Abdeckung**

- **Rückverfolgbarkeit:** Ein Skript erzeugt die Matrix Anforderung → Tests und bricht ab bei Anforderungen der laufenden oder früherer Etappen ohne Test und bei Tests ohne ID.
- **Unit-Tests** für die Fachlogik: Zeitformen und Sortierzeit, Beso-Nummerierung und Fixierung, Breiten, Kollisionen und Aussparungen, Textumbruch und Rückfallregel, Prüfregeln, Formtext-Zerlegung, Sonnenzeiten.
- **Property-basierte Tests** für die Layout-Schicht: bei zufällig erzeugten Plänen nie Überlappung von Kästchen, nie Text ausserhalb seines Rahmens, nie Schrift unter der Mindestgrösse ohne Befund P8.
- **Integrationstests** Import gegen die Referenzdateien, per Skript verglichen mit Anhang A und C über den Export der Listenansicht.
- **End-to-End-Tests** in Chromium/Edge für die Kernabläufe (Beschrieb 5.1–5.7), inkl. Tastaturbedienung, Undo nach Neuladen, Wiederherstellung und einem Durchlauf im Tablet-Format.
- **Abdeckung:** Fachlogik, Layout-Schicht, Prüfregeln und Import mindestens 90 % Zweigabdeckung, übriger Code mindestens 75 %. Abdeckung allein ist nie ein Beleg.
- **Mutationstests** (z.B. Stryker) für Fachlogik, Layout-Schicht, Prüfregeln, Beso-Nummerierung und Formtext-Zerlegung: Score mindestens 80 % an jeder Etappen-Abnahme; überlebende Mutanten werden begründet oder durch Tests getötet.
- **Flatternde Tests** werden nicht automatisch wiederholt; ein flatternder Test ist ein blockierender Befund.

**PDF und Bildschirm – drei getrennte Ebenen**

1. *Konformität:* Anhang B-Kp bzw. B-Bat mit den vermessenen Sollwerten als Tests mit Toleranz: Ränder, Breitenverhältnisse, Abbildung Zeit → Position, Linienarten und -dicken, Legendenfarben.
2. *Unabhängige Prüfung des fertigen PDF:* Text, Positionen, Schriftgrössen, eingebettete Schriften und Linien werden aus dem erzeugten PDF ausgelesen, nicht aus dem Layout-Modell. Geprüft wird: keine Schrift unter der Mindestgrösse, kein Text ausserhalb seines Rahmens, jede Blockkante auf ihrer Zeit.
3. *Regression:* Golden-Bilder aus pseudonymisierten Fixtures, entstanden gemäss Prompt §5.2 Schritt 8, mit fixierter Render-Kette (Renderer- und Schriftversion festgelegt, dieselbe Umgebung lokal und in der Schleuse). Bis zu meiner Freigabe gelten sie als «vorläufig»; Gate B zeigt jede Änderung als Vorher / Nachher / Differenz. Vergleiche mit den Originalen liegen unter `reference/` und werden im Abnahmebericht nur verlinkt.

Dazu eine **Bildschirm-Regression** der Kernzustände und ein **Paritätstest**: Positionen und Umbrüche aller Texte einer Referenzwoche sind am Bildschirm und im PDF identisch.

**Leistung**

- Protokoll: Chromium mit CPU-Drosselung (Faktor aus der Umgebungsprobe, Prompt §5.1 Schritt 3), Median aus 5 Läufen nach einem Aufwärmlauf, synthetischer Plan mit festem Startwert (4 Wochen, 1000 Einträge inkl. Beso und Querbalken).
- Budgets (Beschrieb 11) als harte Grenzen: Ziehen p95-Bildzeit höchstens 16,7 ms und keine Aufgabe über 50 ms während 2 s Ziehen; Wochenwechsel und Filter höchstens 300 ms bis zur fertigen Darstellung; Prüfungen höchstens 500 ms; PDF einer Woche höchstens 3 s, ganzer Plan höchstens 10 s; Import höchstens 15 s.
- Zusätzlich ist eine Verschlechterung um mehr als 10 % gegenüber `perf-baseline.json` blockierend; für Änderungen an der Baseline gilt die Regel zum Lockern von Schwellwerten.

**Weitere**

- **Codequalität:** strikte Typprüfung; kein `any` und kein Abschalten von Lint-Regeln ohne Begründung; Lint gegen `.only`/`.skip`, `TODO`/`FIXME` und Konsolenausgaben im Produktcode; Lizenzprüfung der Abhängigkeiten (MIT, Apache-2.0, BSD, ISC; Schriften OFL oder gleichwertig).
- **Migration:** Pro Etappe wird eine Plan-Datei als eingefrorenes Fixture abgelegt, die jede spätere Version verlustfrei öffnet; eine höhere Formatversion wird abgelehnt.
- **Offline-Test** und **Barrierefreiheits-Prüfung** (automatisch plus Tastatur-End-to-End).
- Alles läuft lokal mit je einem Befehl für schnelle und volle Schleuse.

---

## 8 Referenzdateien und Datenschutz

In `reference/` (in `.gitignore`, **nie committen**):

- `01_02_WAP_FDT_2026.xlsx` – Kp-WAP FDT 2026
- `WAP_FDT_2026_V1.pdf` – Layout-Referenz Kp
- `0003_WAP PICASSO Inf Bat 61_FDT 2026_V2.xlsx` – Bat-WAP, Import-Referenz
- offizielles PDF des Bat-WAP PICASSO V2 – bitte mich in Etappe 0 darum; bis dahin renderst du das Excel als gekennzeichnete «Hilfsreferenz»
- manuell erstellter Tagesbefehl Nr 1 KVK (für Beschrieb 14.12), sobald ich ihn ablege

Regeln:

- Bei Abweichungen zwischen Excel und PDF ist das neuere Excel massgebend (Beschrieb 14).
- Alles, was aus den Originalen abgeleitet und nicht pseudonymisiert ist, liegt unter `reference/`: Anhänge, Screenshots, Vergleiche, Import-Berichte. In `docs/` stehen nur Zusammenfassungen und pseudonymisierte Belege.
- Die Pseudonymisierung ist konsistent: gleicher Name → gleiches Pseudonym, der Grad bleibt (z.B. «Hptm Muster A»). Die Zuordnungstabelle liegt nur in `reference/`. So funktioniert auch die Namenserkennung im Import (Beschrieb 8.2, Regel 12) mit Fixtures.
- **Nie ins Repo:** Personalliste, Detachementsplaner-Sicherungen mit AHV-Nr, Telefonnummern oder Adressen.
- Beim Einlesen einer Personenliste (Beschrieb 4.1) übernimmt das Tool nur Grad, Name, Vorname und Funktion und verwirft alle übrigen Spalten, ohne sie zwischenzuspeichern. Das Dateiformat schlägst du an Gate 0 vor.
- Die Sonnenzeiten im Referenz-PDF sind falsch und kein Massstab (Beschrieb 15).
- Fehlt eine Referenzdatei, fragst du mich, statt Ersatzdaten zu erfinden.

---

## 9 Bekanntes Wissen zum heutigen Excel-WAP

Beobachtungen aus früheren Auswertungen, keine vollständige Spezifikation; verifiziere jede am Original.

- Der Inhalt liegt in den Zeichnungsebenen (`xl/drawings/drawingN.xml`), nicht in Zellen; die Zuordnung Blatt → Zeichnung steht in `xl/worksheets/_rels/sheetN.xml.rels`.
- Zellen enthalten Kopf und Rahmen: Startdatum in Zeile 3 (Formeln wie `=KVK!F3+7`), Tagesköpfe in Zeile 4, Spaltenköpfe in Zeile 6, Beschriftungen der Seitenleiste in wechselnden Spalten je Blatt (z.B. BK/BL, BM/BN, BE/BF).
- Termintexte: im Bat in den Zellen der Zeile 89 (pro Tag eine Zelle, Einträge durch Zeilenumbruch, Rich Text mit Rot und Durchstreichung); im Kp als Textfelder in der Zeichnungsebene.
- Die Zeitbeschriftungen (0500 …) sind Formen; sie eignen sich zur Kalibrierung Position ↔ Uhrzeit.
- Formen sind teils gruppiert mit eigenen Transformationen, teils rotiert; senkrechter Text über die Textkörper-Einstellung.
- Farben kommen als RGB-Werte, Designfarben, mit Transparenz und als Verläufe (gemeinsame Leitung) vor; die Legende steht pro Blatt an anderer Stelle.
- Spaltensätze wechseln pro Blatt und Tag (Wo 2/3 Mo–Di «Sph Det 1–3», sonst FALCON/HAWK); Wochenend-Beschriftungen sind teils fest eingetippter Text.
- Das Tagesbefehl-Vorhaben (`PROMPT_Tagesbefehle.md`) beschreibt bereits einen erprobten Leseansatz (Gruppen-Transformationen, Rotationskorrektur, Zeitkalibrierung, Verknüpfung der Fussnoten, Legendenfarben). Nutze ihn, statt neu zu erfinden.

---

## 10 Gate-Vorlage

Jede Vorlage liegt in `docs/wap-planer/gates/gate-<X>.md`. Oben steht höchstens eine Seite, damit ich in kurzer Zeit entscheiden kann:

1. **Entscheide**, nummeriert: Frage, Optionen, Empfehlung mit Grund, Folge, Vorgabe ohne Entscheid. Ich antworte z.B. «1a, 2 ok, 3b mit Auflage …».
2. **Zahlen** Soll / Ist: Anforderungen, Tests, Abdeckung, Mutationsscore, Leistung, offene Befunde nach Stufe.
3. **Abweichungen** vom Beschrieb und zurückgestellte Befunde.
4. **Top-5-Risiken** mit Gegenmassnahme.
5. **Was ich prüfen soll**, in Reihenfolge und mit Zeitaufwand; Belege verlinkt.

Darunter folgen die Details. Meine Antwort trägst du wörtlich ins Freigabeprotokoll in `PROGRESS.md` ein.

---

## 11 Jetzt beginnen

Starte mit **Etappe 0** (Prompt §5.1) und arbeite bis **Gate 0**. Kein Produktcode vor Gate 0 ausser den Spikes und dem Harness (Paket H0).
