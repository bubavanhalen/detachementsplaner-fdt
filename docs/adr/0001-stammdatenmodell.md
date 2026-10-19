# ADR-0001: Stammdatenmodell der WK Util Suite (Etappe S1)

- **Status:** Entwurf, 20.10.2026. Entscheide (a) und (b) vom Owner am 20.10.2026 getroffen; (c) siehe ADR-0003 Abschnitt «Auslieferung» (Export «HTML mit Daten» entfällt zugunsten der Projektdatei).
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

```ts
interface Stamm {
  einheit: string;
  uebergeordneteEinheit: string;
  dienst: string;
  uebungsname: string;
  dateikuerzel: string;
  standort: string;
  klassifizierung: string;
  motto: string;
  nameOrder: 'nameVorname' | 'vornameName';
  kader: Array<{
    rolle: 'kdt' | 'kdtStv';
    personId: string | null; // Verweis auf Project.persons, sonst Freitext unten
    grad: string;
    name: string;
    vorname: string;
    funktion: string;
  }>;
  grafiken: { unterschrift: AssetRef | null; wappen: AssetRef | null };
}
type AssetRef = { id: string; sha256: string; mime: 'image/png' };
```

- Der Zeitraum bleibt in `service.start/end` und wird nicht verdoppelt.
- Bilder liegen in der IndexedDB der Suite (Store `assets`, Schlüssel Projekt-ID + Art), nicht im localStorage. `Project` enthält nur den Verweis. Die Projektdatei (`.json`) bettet die Bilder beim Sichern ein.
- v5-Projekte bleiben lesbar. Beim Speichern entsteht v6. Die alten Felder (`settings.eigeneEinheit`, `tb.settings.kdtName/kdtFunktion/dienstleistung`) werden eine Version lang mitgeschrieben und danach entfernt.

### Tagesbefehle auf Verweis

- `kdtName`/`kdtFunktion` werden aus `stamm.kader` (Rolle `kdt`) gebildet, `dienstleistung` aus `stamm.dateikuerzel`.
- Die Unterschrift kommt aus `stamm.grafiken.unterschrift`. Die TB-Vorlage (.xlsx) bleibt ein amtlicher Gerätewert.
- Das Wappen kann anstelle des Vorlagenlogos verwendet werden.

### WAP-Verweis (Plan-Format v2, additiv, erst nach Gate B)

- Neue Felder: `Plan.suite? { projectId, stammHash, uebernommenAm, abweichend[] }`, `Person.suiteId?`, `Column.suiteRef?`.
- Verknüpfte Felder sind nur in der Suite änderbar. Eine bewusste Abweichung im Plan wird als «hier abweichend» markiert.
- Die Plan-Datei bleibt allein lesbar (WAP-Beschrieb 8.1, 11). Bei «Sichern zur Weitergabe» entfällt `suite`; Personen werden nur mit Grad, Name, Vorname und Funktion übernommen.
- Der Excel-Import überschreibt verknüpfte Felder nicht, er schlägt nur vor. Damit entfällt das stille Überschreiben in `assemble.ts`.
- Bat-Pläne und als Referenz geöffnete Pläne werden nie verknüpft.

### Migration (lokal, nur mit Bestätigung)

1. **Projekt v5 → v6:** `stamm` wird aus `eigeneEinheit`, `name`/`service` und `tb.settings.dienstleistung` gebildet. `kdtName` wird in Grad/Name/Vorname zerlegt und vor der Übernahme angezeigt.
2. **Unterschrift:** Die gerätweite TB-Unterschrift wird nach Rückfrage dem offenen Projekt zugeordnet. Ohne Bestätigung bleibt sie unverändert erhalten.
3. **WAP v1 → v2:** Zuerst eine Sicherung im alten Format, dann der Dialog «Mit Suite verknüpfen» mit Suite-Wert und Plan-Wert je Feld. Personen werden über Grad + Nachname + Vorname zugeordnet, sonst von Hand.

## Etappen

| Etappe | Inhalt | Zweig | Aufwand (AT) |
|---|---|---|---|
| S1 | dieses ADR und ADR-0002 | `main` | ≈1 |
| S2 | Suite: Maske «Dienst und Einheit» (Kader, Bilder), Projekt v6, Bild-IndexedDB, TB auf Verweis | `main` | 4–6 |
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
