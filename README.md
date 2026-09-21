# Detachementsplaner FDT

Der Detachementsplaner ist eine eigenständige Browser-Anwendung. Es gibt keinen Server und keine Datenbank: Import, Planung, Prüfung, Export und lokale Speicherung laufen vollständig im Browser.

## Start

`index.html` im Browser öffnen. Über **Projekt laden** kann eine bestehende Projektdatei im JSON-Format geladen werden. Der aktuelle Datenstand `FDT_2026_Inf_Ustü_Kp_614_2026-08-08.json` bleibt kompatibel.

## Veröffentlichung

Ein GitHub-Actions-Workflow veröffentlicht die Anwendung nach jedem Push auf `main` über GitHub Pages: <https://bubavanhalen.github.io/detachementsplaner-fdt/>. GitHub Pages ist für dieses Repository auf **GitHub Actions** konfiguriert; die Seite ist nach dem ersten Push mit dem Workflow verfügbar.

Der Workflow stellt ausschließlich `index.html` und `.nojekyll` bereit. Projektdateien und lokale Browserdaten bleiben unveröffentlicht.

## Übersicht

Unter **5 · Übersicht** stehen zwei dichte Arbeitsansichten zur Verfügung:

- **Gesamtliste** mit Sofortsuche über Name, Funktion, Grad, Detachement und EC
- **Personenansicht** mit Detachementen, Einsatzcodes, Führerscheinen sowie sämtlichen Stamm- und Quelldaten

Detachemente besitzen ein optionales Feld **EC**. Es wird beim JSON-Export gespeichert und in Excel-Exporten ausgegeben.

## Datenschutz

Personen- und Projektdateien werden nicht in dieses Repository aufgenommen. Sie werden vom Benutzer lokal ausgewählt und nur im Browser verarbeitet. Die `.gitignore` verhindert, dass typische FDT-Projektdateien versehentlich eingecheckt werden.
