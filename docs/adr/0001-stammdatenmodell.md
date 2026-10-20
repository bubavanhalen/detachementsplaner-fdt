# ADR-0001: Stammdatenmodell der WK Util Suite (Etappe S1)

- **Status:** S2 umgesetzt (20.10.2026); S3–S5 Entwurf. Entscheide (a) und (b) vom Owner am 20.10.2026 getroffen; (c) siehe ADR-0003 Abschnitt «Auslieferung» (Export «HTML mit Daten» entfällt zugunsten der Projektdatei).
- **Grundlage:** Bestandsaufnahme «Stammdaten-Doppelungen der WK Util Suite» vom 20.10.2026 (Stand `wap-codex` cd21877; nur Code und Doku, keine echten Daten). Auftrag des Owners: «Alles was doppelt ist von Grunddaten stört mich».
- **Abhängigkeit:** Der WAP-Planer liegt auf `wap-codex` und ist nicht in `main`. Etappen S3–S5 beginnen erst nach Gate B des WAP-Planers (WAP-Beschrieb 9.1, 12). S2 betrifft nur Suite-Dateien.

## Kontext

Suite (Detachementsplaner), WAP-Planer und Tagesbefehle (TB) pflegen heute dieselben Grunddaten getrennt: Einheit, Dienst, Zeitraum, Kommandant, Unterschrift, Wappen, Personen, Züge und Detachemente. Die schwersten Fälle:

| Grunddatum | Heute | Risiko |
|---|---|---|
| Einheit | `settings.eigeneEinheit` (Suite), `Plan.unit` (WAP); der Excel-Import überschreibt `unit` still | hoch |
| Kommandant | implizit über Funktion «Kdt» (Suite), `Plan.commander` strukturiert (WAP), `kdtName` als Freitext (TB) | hoch |
| Unterschrift | `TbAssets.signature` gerätweit (TB); `signatureImage` in jeder Plan-Datei, in jedem Stand und in jedem Wiederherstellungspunkt (WAP) | hoch |
| Personen | Suite vollständig; WAP mit 4 Feldern, von Hand oder per CSV; eine Übertragung fehlt | hoch |
| Detachemente/Züge | Suite `dets`/`Person.zug`; WAP-Spalten ohne Fremdschlüssel | hoch/mittel |

## Entscheid

### Grundsatz «Quelle + Abbild»

Jedes Grunddatum hat genau eine Quelle. Andere Teile halten höchstens ein Abbild mit Verweis und Prüfsumme. Weicht das Abbild ab, entsteht ein sichtbarer Befund. Es wird nie still überschrieben.

### Quelle je Grunddatum

| Quelle | Grunddaten |
|---|---|
| Suite (`Project.stamm`) | Einheit, übergeordnete Einheit, Dienst, Übungsname, Dateikürzel, Zeitraum, Kader (Kdt, Kdt Stv), Unterschrift, Wappen, Motto, Vorgaben Klassifizierung/Standort, Personen, Züge, Detachemente |
| WAP-Planer | Legende, Funktionsliste mit Kategorien, Kürzel, Beilage, Spaltensätze |
| Tagesbefehle | Tagesoffizier, TB-Nummer, Verteiler, LK, TB-Vorlage (amtlich, bleibt Gerätewert) |

**Entscheid (a), Owner 20.10.2026:** Tagesoffizier und TB-Nummer werden im TB-Werkzeug gepflegt. Der WAP-Plan erhält dafür kein Feld. Telefonnummern gelangen nie in einen Plan.

**Entscheid (b), Owner 20.10.2026:** Die Unterschrift gilt je Dienst (`stamm.grafiken.unterschrift`), nicht mehr gerätweit. Tagesbefehle und WAP-Planer verwenden dieselbe Unterschrift.

### Modell `Project.stamm` (Projekt-JSON v6, additiv)

Umgesetzt in `src/model/stamm.ts` (S2, 20.10.2026):

```ts
interface Stamm {
  einheit: string;
  uebergeordneteEinheit: string;
  uebungsname: string;
  dateikuerzel: string;
  standort: string;
  klassifizierung: string;
  motto: string;
  nameOrder: 'vornameName' | 'nameVorname';
  kader: KaderEintrag[]; // höchstens ein Eintrag je Rolle
  grafiken: { unterschrift?: StammBild; wappen?: StammBild };
}
interface KaderEintrag {
  rolle: 'kdt' | 'kdtStv';
  personId: string; // Verweis auf Project.persons, '' = von Hand erfasst
  grad: string;
  vorname: string;
  name: string;
  funktion: string;
  pruefen?: boolean; // aus dem früheren Freitext übernommen, bis zum Speichern der Maske
}
type StammBild = { name: string; base64: string; savedAt: string }; // PNG
```

- **Dienst = `Project.name`, Zeitraum = `service.start/end`.** Beides gibt es schon; `stamm` verdoppelt es nicht (ein Feld `dienst` hätte die nächste Doppelung erzeugt).
- **Bilder im Projekt (Abweichung vom Entwurf):** Unterschrift und Wappen liegen als PNG im Projekt, höchstens 512 KB je Bild. Damit reisen sie ohne Zusatzmechanik mit Projektdatei, Archiv und Offline-HTML, und es gibt keinen zweiten Speicher, der auseinanderlaufen kann. Der Wechsel in IndexedDB erfolgt zusammen mit dem Projekt selbst (ADR-0003, lokale Betriebsart), nicht vorher getrennt.
- **Unterschrift und Wappen im Agent-Austausch (Owner-Entscheid 20.10.2026, gegen die Empfehlung):** Der Stand für den Pendenzen-Agenten enthält das ganze Projekt inklusive `stamm.grafiken`. Unterschrift und Wappen erreichen damit auch den Modellanbieter des Agenten (Anthropic). Der Agent darf die Bilder nie verwenden, weitergeben oder einbetten (Pendenzen-Ausnahme in AGENTS.md). Ändert sich der Austausch oder der Anbieter, ist dieser Entscheid neu zu prüfen.
- **Keine mitgeschriebenen Altfelder (Abweichung vom Entwurf):** Ältere Versionen lehnen v6 ohnehin ab («benötigt eine neuere Anwendung»). Altfelder mitzuschreiben würde nur eine neue Doppelung schaffen. v5-Projekte werden beim Lesen migriert; die Altfelder (`settings.eigeneEinheit`, `tb.settings.kdtName/kdtFunktion/dienstleistung`) entfallen danach.
- Ein Kader-Eintrag mit `personId` ist eine Kopie mit Verweis. Weicht die Personenliste ab, zeigt die Maske einen Hinweis und übernimmt die Werte nur auf Klick («Quelle + Abbild», nie still).

### Tagesbefehle auf Verweis

- Name und Funktion der Unterschrift werden aus `stamm.kader` (Rolle `kdt`) gebildet (`commanderSignature`), der Dateiname aus `stamm.dateikuerzel`, die Einheit aus `stamm.einheit`. Schritt 1 der Tagesbefehle zeigt diese Werte nur an und verweist auf «Dienst und Einheit».
- Die Unterschrift kommt aus `stamm.grafiken.unterschrift`. Sie kann in «Dienst und Einheit» oder in Schritt 1 der Tagesbefehle gewählt werden; beides schreibt dasselbe Feld. Die TB-Vorlage (.xlsx) bleibt ein amtlicher Gerätewert; das Offline-HTML bettet nur noch die Vorlage ein.
- **Wappen statt Vorlagenlogo (umgesetzt):** Pro Dienst wählbar in Schritt 1 der Tagesbefehle; die Wahl liegt im Projekt (`tb.settings.wappenAlsLogo`), nicht auf dem Gerät. Ist sie gesetzt und `stamm.grafiken.wappen` vorhanden, ersetzt das Wappen das rechte Kopflogo der Vorlage in Druckansicht, Tages-PDFs und .xlsx (alle Tagesblätter). Es behält sein Seitenverhältnis und sitzt oben rechts in der Box des Vorlagenlogos; im .xlsx erhält es ein eigenes Bild, das Vorlagenbild bleibt unverändert im Paket. Ohne Wahl, ohne Wappen oder ohne rechtes Logo in der Vorlage bleibt das Vorlagenlogo (Standard).

### WAP-Verweis (Plan-Format v2, additiv, erst nach Gate B)

- Neue Felder: `Plan.suite? { projectId, stammHash, uebernommenAm, abweichend[] }`, `Person.suiteId?`, `Column.suiteRef?`.
- Verknüpfte Felder sind nur in der Suite änderbar. Eine bewusste Abweichung im Plan wird als «hier abweichend» markiert.
- Die Plan-Datei bleibt allein lesbar (WAP-Beschrieb 8.1, 11). Bei «Sichern zur Weitergabe» entfällt `suite`; Personen werden nur mit Grad, Name, Vorname und Funktion übernommen.
- Der Excel-Import überschreibt verknüpfte Felder nicht, er schlägt nur vor. Damit entfällt das stille Überschreiben in `assemble.ts`.
- Bat-Pläne und als Referenz geöffnete Pläne werden nie verknüpft.

### Migration (lokal, nur mit Bestätigung)

1. **Projekt v5 → v6 (umgesetzt):** `stamm` wird aus `settings.eigeneEinheit` und `tb.settings.kdtName/kdtFunktion/dienstleistung` gebildet. Ein v5-TB-Zustand ohne gespeichertes Kürzel erhält wie bisher `FDT_2026`.
   - `kdtName` wird verlustfrei in Grad/Vorname/Name zerlegt: In der Reihenfolge «Grad Vorname Name» zusammengesetzt ergibt sich derselbe Text. Bestehende Tagesbefehle ändern sich also nicht.
   - Statt einer Vorschau vor der Übernahme markiert `pruefen` den Eintrag. Die Maske bittet um Prüfung, bis sie einmal gespeichert wurde.
2. **Unterschrift (umgesetzt):** Eine gerätweit gespeicherte TB-Unterschrift wird nie still verwendet. Schritt 1 der Tagesbefehle bietet «Diesem Dienst zuordnen» und «Vom Gerät entfernen» an.
3. **WAP v1 → v2:** Zuerst eine Sicherung im alten Format, dann der Dialog «Mit Suite verknüpfen» mit Suite-Wert und Plan-Wert je Feld. Personen werden über Grad + Nachname + Vorname zugeordnet, sonst von Hand.

## Etappen

| Etappe | Inhalt | Zweig | Aufwand (AT) |
|---|---|---|---|
| S1 | dieses ADR und ADR-0002 | `main` | ≈1 |
| S2 | Suite: Maske «Dienst und Einheit» (Kader, Bilder), Projekt v6, TB auf Verweis (umgesetzt 20.10.2026) | `main` | 4–6 |
| S3 | WAP: Format v2, Verknüpfung/Abgleich, Befunde, Weitergabe ohne Verknüpfung | nach Gate B | 5–7 |
| S4 | Personen, Züge, Detachemente aus der Suite (R-9.1-01..06) | nach Gate B | 6–9 |
| S5 | Übergabe WAP → TB (9.2), TB-Excel-Pfad und Enum `TbLeitung` ablösen | nach Gate B | 6–10 |

Das Teilen (ADR-0002) baut auf S2 auf: Synchronisiert wird ein Projekt mit einer Quelle je Grunddatum, nicht drei Kopien.

## Folgen und Risiken

- Personendaten im WAP bleiben auf 4 Felder beschränkt; Tel./Mail gelangen nie in einen Plan. Ein Test mit einer synthetischen Fixture inkl. Tel./Mail belegt das.
- Ältere WAP-Versionen lehnen Plan-Format v2 ab (strenge Plan-Datei). Das muss in der Versionsanzeige erklärt werden.
- Ein Suite-Projekt kann mehrere WAP-Pläne speisen (Bat/Kp); die Verknüpfung ist je Plan wählbar.
- Archive bleiben schreibgeschützt und werden nicht migriert, sondern beim Öffnen gelesen.
- Eingefrorene WAP-Tests am Schema brauchen eine geordnete Entsperrung (WAP-Lock-Protokoll).

## Bis Gate B im WAP-Planer vermeiden

Keine neuen Grunddatenfelder im Plan; kein Formatwechsel der Plan-Datei; Personenfelder und `commander` getrennt und IDs stabil; Einheit/Dienst/Beilage beim Ausgeben einsetzen statt als fertige Texte speichern; kein weiteres stilles Überschreiben aus dem Excel-Import; keine Suite-Dateien ändern; Oberflächentexte so halten, dass später «in der Suite pflegen» passt.
