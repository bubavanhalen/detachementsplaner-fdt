# MILO-Abgleich, Personaldaten und Standardlisten

Status: umgesetzt (20.10.2026) auf Branch `claude/personaldaten-milo-sync-c94509`,
mit fiktiven Daten geprüft, noch nicht gemergt. Der Branch enthält auch den Commit
des Pendenz-Modells (413216c), auf dem die Wache-Nachführung aufbaut. Offen sind die
echten MILO-Spaltenüberschriften und die NZL-Zählregel (unten).

Die harte Offline-Grenze in [AGENTS.md](../AGENTS.md) gilt uneingeschränkt:
MILO-Daten werden nur als lokale Datei im Browser gelesen, nie hochgeladen, nie
automatisch an MILO oder einen anderen Dienst übermittelt. Tests und Reviews
verwenden ausschliesslich fiktive Daten.

## Grundsatz

MILO ist die führende Quelle für Personaldaten. Die WK Suite ist eine Arbeitskopie,
die während des Dienstes möglichst täglich mit einem frischen MILO-Export
abgeglichen wird. Listen entstehen nur aus diesem Stand.

- Jedes Projekt kennt den **Stand MILO** (`Project.milo.stand`, Tag des Exports,
  im Import-Dialog wählbar). Er steht auf jeder ausgegebenen Liste.
- Liegt der Stand während der Dienstzeit vor heute, zeigt die Seite «Personal»
  «MILO-Stand von … – n Tage out of date».
- Der Abgleich zeigt **vor** der Übernahme: neu, geänderte Angaben je Feld, nicht
  mehr in MILO, wieder in MILO, abweichende Werte der nicht führenden Quelle.
  Übernommen wird erst nach Bestätigung, als ein rückgängig machbarer Schritt.
- Wer in einer neuen MILO-Bestandesliste fehlt, wird nur markiert
  (`Person.nichtInMilo`), nie gelöscht. Verweise bleiben, bis der User entscheidet.

Datenweg: MILO-Export (Excel/CSV) → lokale Datei → WK Suite liest sie im Browser.
Die WK Suite läuft auf jedem Gerät (Owner-Entscheid); sie trifft keine Annahme
über das Gerät.

## Umgesetzt

| Teil | Ort |
|---|---|
| Gemeinsames Personen-Matching für alle Listen | `src/model/personMatch.ts` |
| Feldhoheit je Personenfeld | `src/model/feldhoheit.ts` |
| Alle Personenverweise finden/umhängen | `src/model/personRefs.ts` |
| NZL, Dienstvollender, Verfügbarkeit, Listen, Wache-Nachführung | `src/model/milo.ts` |
| Personal-, Urlaubs-, Kommandierungsimport, Abgleich | `src/io/import.ts`, `src/pages/ImportDialog.tsx` |
| Seite «Personal» mit Standardlisten (Druck, Excel, Text) | `src/pages/PersonalPage.tsx` |
| MILO-Abschnitt im Personendossier | `src/pages/PeoplePage.tsx` |

### Personen-Matching (eine Regel für alle Listen)

Unverändert aus dem README: Eine eindeutige Versicherten-Nr. führt zusammen.
Verschiedene Nummern werden nie über gleiche Namen zusammengeführt. Ein
Namensabgleich ist optional und setzt `identityReview`. Urlaubs- und
Kommandierungslisten legen nie Personen an; Zeilen ohne Person werden nur im
lokalen Dialog genannt.

### Feldhoheit

| Feld | Führt |
|---|---|
| Name, Grad, Versicherten-Nr., Funktion, Führerausweise, Einheit, Zug, Tel., Mail, Wohnort | PISA (wie bisher) |
| NZL (`dt`), Geburtsdatum, Status Bestandesliste (`miloStatus`) | MILO |
| Urlaube, Kommandierungen | MILO (Liste ersetzt die bisherige) |

Die führende Quelle überschreibt; die andere füllt nur leere Felder. Ein
abweichender Wert der anderen Quelle wird im Abgleich angezeigt und nie still
übernommen. `rawSources` bleibt je Quelle erhalten.

### Datenmodell (Projekt v6, optionale Felder ohne Versionssprung)

- `Person.geburtsdatum?`, `Person.miloStatus?`, `Person.dtStand?` (Tag, an dem
  die NZL galt), `Person.nichtInMilo?` (ISO-Datum).
- `Detachment.miloKommandierung?: true` für Wachdetachemente.
- `Project.milo?: { stand, listen: { urlaub?, kommandierung? } ({datei, zeit, anz}),
  absences[{id, personId, art, von, bis}], commands[{id, personId, text, von, bis}],
  statusEingerueckt: Record<Statustext, boolean> }`.
- Tolerant normalisiert (`normalizeMilo`): kaputte Teile fallen weg, das Projekt
  wird deswegen nie abgelehnt. Nicht Teil der PISA-Übergabe, keine PISA-Signatur.

**Nur Host (ADR-0002), nie im WAP:** `geburtsdatum`, `miloStatus`, `dtStand`,
`nichtInMilo`, `Project.milo` (Urlaube, Kommandierungen, Statuszuordnung).

## 1. Diensttage und Dienstvollender

- MILO führt die NZL täglich nach (Owner). Massgebend ist die NZL des letzten
  Imports mit ihrem Stand (`dtStand`).
- Fehlt ein neuerer Stand, rechnet die App selbst weiter (`NZL − Diensttage seit
  Stand`) und zeigt **«n Tag(e) out of date»**.
- **Annahme, vom Owner zu bestätigen:** Die NZL gilt zu Beginn des Exporttags,
  und jeder Kalendertag der Dienstzeit zählt als Diensttag. Ein Stand vor
  Dienstbeginn zählt ab dem ersten Diensttag.
- Standardliste «Dienstvollender» (Prognose letzter Diensttag, dienstvollend ab)
  und Markierung im Dossier. Nichts wird automatisch ausgeschlossen.

## 2. Geburtstagsliste

Geburtstage in einem wählbaren Zeitraum (Vorgabe: Dienstzeit) mit dem Alter, das
erreicht wird; 29. Februar → 28. Februar.

## 3. Fahrerliste

Pro Stichtag nur verfügbare Fahrer (Führerausweis vorhanden, nicht ausgeschlossen,
eingerückt, NZL nicht erreicht, nicht im Urlaub, nicht kommandiert). Nicht
verfügbare lassen sich mit Grund einblenden. Fahrer ohne Status aus der
Bestandesliste gelten als verfügbar und werden gezählt.

## 4. Urlaube und Verfügbarkeit

- Die MILO-Urlaubsliste ersetzt die bisherige. Ein Zeitraum in einer Zelle
  («03.11.2026 – 05.11.2026») oder zwei Spalten werden gelesen.
- `verfuegbarkeit(project, person, tag)` in `src/model/milo.ts` ist die eine Regel
  (dienstvollend → nicht eingerückt → Urlaub → kommandiert). Die Seite zeigt
  zusätzlich Zuteilungen während einer Abwesenheit.
- Status der Bestandesliste: Jeder Statustext wird im Import einmal als
  «eingerückt / nicht eingerückt / offen» eingeordnet (Vorschlag aus dem Text);
  die Wahl bleibt für spätere Listen gespeichert.

## 5. Kommandierungen und MILO-Nachführung

- Kommandierungen aus MILO dienen als Kontext und für die Verfügbarkeit.
- Nachführung nur für Wache (Owner): Wachdetachemente werden auf der Seite
  «Personal» markiert. Die Nachführungsliste wird bei jeder Ansicht aus Planung und
  Kommandierungsliste **abgeleitet** (offen / in MILO erfasst / nur in MILO) und nicht
  als zweite Liste gespeichert. Jeder Eintrag hat einen stabilen Schlüssel
  `wache:<detId>:<personId>` für eine spätere Pendenz.
- Jede Nachführung ist eine **Pendenz** (`quellen.kanal = 'milo'`, Upsert über
  `ref`, Verlauf-Autor `agent: 'MILO-Abgleich'`, `src/model/miloPendenzen.ts`) und wird
  in der Pendenzenliste abgehakt. Abgeglichen wird beim Markieren eines
  Wachdetachements, beim Import der Kommandierungsliste und per «Pendenzen
  aktualisieren»:
  - in MILO gefunden → erledigt;
  - abgehakt, aber in einer **neueren** Kommandierungsliste nicht gefunden → wieder offen;
  - Zuteilung oder Markierung entfernt → verworfen, nie gelöscht;
  - Titel und Fälligkeit folgen der Planung, solange der User den Titel nicht umformuliert hat.
  Der Abgleich öffnet und schliesst immer mit dem zuletzt gesehenen Status (`vorher`);
  hat der User etwas anderes gesetzt, entsteht ein Vorschlag statt einer Überschreibung.
- Keine automatische Übermittlung: MILO hat keine Schnittstelle, und die
  Offline-Grenze verbietet sie.

## Koordination

- **Stammdaten-Doppelungen** (PR #20, auf main): Projekt v6 mit `stamm` ist Basis.
  Diese Session besitzt Personen-Matching, Merge/Umhängen, `io/import.ts`,
  `ImportDialog`, `PeoplePage`, `PersonEditor`, `store.ts`. `types.ts` und
  `project.ts` werden nur additiv geändert. `verfuegbarkeit` soll später auch die
  Tagesoffizier-Rotation (`eligibleOfficers`) nutzen.
- **Pendenzen-Konsolidierung:** Die Wache-Nachführung nutzt deren Pendenz-Modell
  (`upsertPendenz`, Kanal `milo`); Pendenzen mit Kanal `milo` legt nur die App an,
  nicht der externe Agent. `replacePersonId` hängt `pendenzen[*].personIds` und
  `pendenzen[*].vorschlag.felder.personIds` um.

## Offen

1. Spaltenüberschriften und je eine **fiktive** Beispielzeile für Bestandes-,
   Urlaubs- und Kommandierungsliste (Owner liefert nach); danach Muster der
   Spaltenerkennung anpassen.
2. NZL-Zählregel bestätigen (siehe Annahme oben).
3. Später: Verfügbarkeit in der Personenauswahl und als Warnung auf den
   Planungskarten; eine Oberfläche zum Zusammenführen von Duplikaten auf Basis von
   `replacePersonId`.
