# Detachementsplaner FDT

Der Detachementsplaner ist eine eigenständige Browser-Anwendung. Es gibt keinen Server und keine Datenbank: Import, Planung, Prüfung, Export und lokale Speicherung laufen vollständig im Browser.

## Start

`index.html` im Browser öffnen. Über **Projekt laden** kann eine bestehende Projektdatei im JSON-Format geladen werden. Der aktuelle Datenstand `FDT_2026_Inf_Ustü_Kp_614_2026-08-08.json` bleibt kompatibel.

## Übersicht

Unter **5 · Übersicht** stehen zwei dichte Arbeitsansichten zur Verfügung:

- **Gesamtliste** mit Sofortsuche über Name, Funktion, Grad, Detachement und EC
- **Personenansicht** mit Detachementen, Einsatzcodes, Führerscheinen sowie sämtlichen Stamm- und Quelldaten

Detachemente besitzen ein optionales Feld **EC**. Es wird beim JSON-Export gespeichert und in Excel-Exporten ausgegeben.

## Datenschutz

Personen- und Projektdateien werden nicht in dieses Repository aufgenommen. Sie werden vom Benutzer lokal ausgewählt und nur im Browser verarbeitet. Die `.gitignore` verhindert, dass typische FDT-Projektdateien versehentlich eingecheckt werden.
