# Bewegung und Rückmeldung im Raster (v1, F-UX3, endgültig 21.10.2026)

Quelle: Rückmeldungen des Auftraggebers vom 21.10.2026 («fühlt sich teils unnatürlich an», «mehr Animation im
Verschieben der Blöcke», «Shift und Alt sollten deutlich aufleuchten», «ich mag nicht, dass ich einen Block zuerst
anwählen muss … auf der Kante soll ein Icon resp. Layout erscheinen»), Prototyp des ui-designers
(`.qa/f-ux3/varianten.md`, `prototyp-ziehen.html`, nur lokal) und **Entscheid des Auftraggebers vom 21.10.2026
«1: a / 2: a / 3: a / 4: a / 5: a»**. Gilt für das Raster (Bildschirm); das PDF und die Lage nach dem Loslassen
bleiben unverändert (Bildschirm = PDF, ADR-004). Diese Seite ist ab Runde 3 endgültig; wo sie von
`raster-bedienung-v2.md` abweicht, gilt sie (Liste unten).

## Entscheide 1a–5a

| Nr | Entscheid | Umsetzung |
| --- | --- | --- |
| 1a | Variante B «Outlook-ähnlich weich» mit dem Shift/Alt-Aufleuchten aus C; alle Animationen ≤ 200 ms (UI-Richtlinie 1.6), keine freie Feder, keine Neigung, kein Überschwingen | siehe «Was bewegt sich wie» und «Shift und Alt» |
| 2a | Freie Kante ohne Taste dockt am nächsten Block an; darüber nur mit Alt (parallel) | `arrangeBlocks` liefert `dock`; Plakette «dockt an «…» · Alt = darüber»; ab Runde 4 wird die Kante dort zur gemeinsamen Kante (weiter ziehen lässt den Nachbarn schrumpfen) |
| 3a | Shift beim Drücken auf leerer Fläche = Auswahlrahmen; auf einem Eintrag wählt ein Klick ohne Ziehen den Bereich, Ziehen mit Shift schiebt sofort mit (Präzisierung Runde 4) | Shift während des Ziehens = Folgende mitschieben |
| 4a | Shift schiebt alle Folgeeinträge bis Tagesende | ab Runde 4: alle darunter mit überschneidenden Spalten, transitiv (siehe unten); Plakette mit Anzahl |
| 5a | Griff: Pille mit Doppelpfeil (B) an allen vier Kanten, Hover-Zustand des Blocks, Marker-Zeitgriff | siehe «Griffe» |

## Was bewegt sich wie (Variante B)

| Moment | Bewegung | Dauer, Kurve |
| --- | --- | --- |
| Greifen | Der Block hebt sich leicht an: Skalierung 1,015, Schatten `0 8px 20px -6px rgb(16 24 20/.30), 0 2px 6px -2px rgb(16 24 20/.16)`, Leuchtrahmen `0 0 0 2px` + `0 0 12px 1px` in der Modusfarbe. Das Original bleibt als Umriss (45 % Deckkraft, gestrichelt). | 140 ms |
| Ziehen (Verschieben, Kante, Spalten) | Der angehobene Block rastet ein und gleitet von Raster zu Raster; jede Lage ist eine echte Zeit (15 Min) bzw. Spalte. Bei Kanten zeigt zusätzlich ein 2-px-Rahmen in der Modusfarbe die Ziellage. | 110 ms `cubic-bezier(.25,.8,.25,1)` |
| Nachbarn (Vorschau) | Nachbarn, die angepasst bzw. mit Shift mitgeschoben werden, gleiten an ihre Vorschaulage (FLIP aus den Ansichtsdaten, nur `transform`). | 180 ms `cubic-bezier(.2,.8,.2,1)` |
| Loslassen | Der Eintrag steht sofort an der Endlage (Bildschirm = PDF); der angehobene Block blendet dort aus (Einschwingen). | 180 ms |
| Esc beim Ziehen | Angehobener Block und Nachbarn gleiten an die Ausgangslage zurück; nichts wird gespeichert. | 200 ms `cubic-bezier(.3,.7,.2,1)` |
| Rückgängig / Wiederholen | ohne Gleiten: die Lage wechselt sofort (Abweichung vom Entwurf v1, damit jede Lage nach einem Befehl sofort gilt). | – |

Technik: nur `transform` und `opacity` werden animiert. Lage per `translate3d`, Grösse per `scale` der Fläche; die
vier Kanten sind eigene Linien (oben/unten nur `scaleX`, links/rechts nur `scaleY`), damit die Strichstärke beim
Strecken gleich bleibt. Der Text ist eine eigene Ebene und wird nie gestreckt (Zusatz Runde 5, UX-FUX3-01): beim
Verschieben ein Abbild des gezeichneten Eintrags, beim Kantenzug ein Abbild der gezeichneten Zeilen in gleicher
Schrift und Lage; es steht an der Lage beim Greifen (der innere Teil gleitet gegenläufig zum Block mit gleicher Dauer
und Kurve), wird auf die neue Fläche beschnitten und wandert mit, wenn die Oberkante nach innen über ihn rückt. Das
Layout der neuen Höhe folgt nach dem Loslassen (wie bei den Nachbarn). Hülle und Abbild je Geste einmal, je
Rasterschritt nur `transform`. Erstes Bild einer Geste ohne Übergang (über zwei Bilder ein- und ausgeschaltet, ohne
erzwungenen Reflow).

## Shift und Alt (Aufleuchten aus C)

Farbcode (neue Marken-Tokens, UI-Richtlinie 16.3): Standard Blau `#2d63b5`, Shift Bernstein `#a35a00` (Glanz
`#f59e0b`), Alt Violett `#9b2fae` (bewusst nicht `#7a3db8`, das ist «geändert»).

- Rahmen mit Glanz um das Raster (2 px plus 22 px Glanz) in der Modusfarbe, solange Shift bzw. Alt beim Ziehen gilt.
- Plakette am Zeitschild: «⇧ Shift · Folgende mitschieben · 3 Blöcke» (mit Beso-Kästchen bzw. Rapporten
  «Einträge»), «Alt · parallel, ohne Anpassung», ohne Taste «dockt an «…» · Alt = darüber», ««…» schrumpft · −30 Min»,
  an der Grenze «Nachbar mind. 15 Min · Shift = mitschieben», sonst «Nachbarn passen sich an · n».
- Betroffene Nachbarn: 2-px-Rahmen in der Modusfarbe und Plakette («+1 h» mit Shift, «−30 Min» schrumpft, «rückt +1 h»
  verdrängt, «geteilt», «Teil», «dockt an»). Mit Alt der gezogene Block violett.
- **Sofort (Runde 4):** Drücken bzw. Loslassen der Taste schaltet im selben Bild um (ohne Mausbewegung): Rahmen,
  Plakette, Nachbar-Markierung und die neue Vorschau ohne Einblenden und ohne Gleiten (Nachbarn und angehobener Block
  springen an die neue Lage), nur ein Farbübergang von 50 ms. Fokuswechsel (Fenster verliert den Fokus) gilt als
  Loslassen. Ansage in der Statusregion «Ziehmodus».
- Die Modusfarbe wird nur an den Marken gesetzt (angehobener Block, gegriffener Griff, Rahmen, Plakette), nie am ganzen
  Baum.

## Griffe (5a)

- **Pille** 34 × 16 px, Radius 7 px, weiss mit 1,5-px-Rand in der Modusfarbe, Doppelpfeil (zwei Winkel, 1,5 px, runde
  Enden) und je zwei Griffpunkte links und rechts; Schatten `drop-shadow(0 2px 3px rgb(16 24 20/.25))`; seitlich um
  90° gedreht.
- **Lage:** am überfahrenen Block (nicht nur am gewählten) oben und unten, ab 80 px Blockbreite rechts (6 px vom Rand),
  damit der mittig gesetzte Titel frei bleibt, sonst mittig; unter 30 px Höhe um eine halbe Griffhöhe − 2 px nach
  aussen; seitlich in der Mitte der Kante erst ab 60 px Breite und 30 px Höhe. Rapport nur oben/unten. Marker: ein
  Zeitgriff mitten auf der Linie über den Planungsspalten.
- **Zustände:** Hover = eingeblendet (aus 80 % und Deckkraft 0, 140 ms); Kante überfahren = gefüllt in der Modusfarbe,
  Symbol weiss, 114 %, dazu der 3-px-Kantenbalken (80 % Blau, abgerundet); Greifen = 120 %, der Griff gleitet innen an
  die Kante des gezogenen Blocks und folgt ihr (110 ms), damit er den Nachbarn an der Kante samt Plakette nicht
  verdeckt (Zusatz Runde 5, UX-FUX3-05; bei kleinem Block höchstens mittig).
- **Plaketten der Nachbarn** mindestens 11 px; an kurzen Blöcken (< 30 px) mittig.
- **Direktbearbeitung (UX-FUX3-04):** Während der Bearbeitung wirken die Kantenzonen nicht; ein Klick in den Block
  setzt die Schreibmarke.
- **Trefferfläche:** Griff plus 3 px ringsum; ausserhalb des Blocks nur über leerer Fläche (ein anderer Eintrag oder
  Marker am Punkt geht vor, R-5.1-26), innerhalb nur bis zum Kantenband (die Mitte bleibt zum Verschieben,
  CR-U-2-04). Die Griffe gelten, solange der Zeiger den Block überfährt; nach Zoom oder Planänderung unter dem ruhenden
  Zeiger zählt allein der Eintrag.
- **Hover des Blocks:** 1-px-Rahmen (`rgb(45 99 181/.6)`) und weicher Schatten `0 6px 14px -6px rgb(16 24 20/.32)`.
  **Marker beim Überfahren:** 8 px hellblaues Band (30 %) auf der Linie. Zeitschild beim Ziehen eines Markers:
  «ABV 2245 · Di 20.10. · alle Planungsspalten».
- Ereignis «über» je Eintrag und Zone (`data-hover`, `i2-hover`) bleibt der Haken für weitere Griff-Elemente.

## Nachbarn (Runde 4, Rückmeldung Auftraggeber 21.10.2026 zu e1598a3)

- **Shift = alle darunter:** An einer Kante rücken alle Einträge unter (bzw. über) dem Block um die Differenz, deren
  Spalten sich mit ihm überschneiden – nicht nur gleich breite; transitiv rückt mit, was ein rückender Eintrag
  überdecken würde (z.B. ein breiter Block nimmt Einträge seiner zweiten Spalte mit); bis Tagesende. Beim Verschieben
  rückt Folgendes so weit nötig nach (Lücken bleiben). Mit rücken Blöcke, Rapporte, die in Planungsspalten angezeigt
  werden, und Beso-Kästchen in Planungs- bzw. Nebenspalten; Marker nie (ihr Zeitpunkt bleibt), Rapporte in der
  Rap-Spalte und Beso-Kästchen in der Beso-Spalte nicht (keine gemeinsame Spalte).
- **Ohne Taste nie überlappen:** Eine gemeinsame Kante wandert zusammen (der eine wächst, der verbundene Nachbar
  schrumpft, mindestens 15 Min, sonst hält die Kante an mit Hinweis «Shift = mitschieben»); eine freie Kante dockt
  am nächsten Block an und wird dort zur gemeinsamen Kante; nach aussen zählt jeder Block mit überschneidenden
  Spalten. Verschieben kürzt bzw. spart Überdecktes gleicher Spalten aus (wie bisher); ganz Überdecktes bzw. ein
  Rest unter 15 Min rückt direkt unter das Ziel, Folgendes gleicher Spalten mit («rückt …»). Anders breite Blöcke
  bleiben beim Verschieben Ausnahmen (Beschrieb 4.6 «Überdeckung und Ausnahmen»). Nur Alt überlappt (parallel).
- **Rapporte und Beso-Kästchen ohne Taste (Runde 5, Entscheid Koordinator 23.10.2026):** Rapporte, die in
  Planungsspalten angezeigt werden, gelten wie Blöcke – beim Verschieben rücken sie direkt unter das Ziel (feste
  Dauer, nie gekürzt), eine Kante dockt an ihnen an. Beso-Kästchen liegen bewusst über Blöcken (R-4.6-54) und
  bleiben ohne Taste; mit Shift rücken sie mit.
- **Tagesende (Runde 5):** Nichts rückt über 2400 (ein Block über Mitternacht bis Beginn 2400). Reicht der Platz
  nicht, hält die Vorschau an (Kante: Differenz begrenzt; Verschieben: Ziel so weit früher wie nötig) mit dem Hinweis
  «Folgende reichen über Tagesende · Alt = parallel»; passt auch dann nichts, ändert das Ablegen nichts (Hinweis in
  der Statuszeile). Pfeiltasten melden Ursache und nächsten Schritt.
- **Kante am Tagesende (Zusatz Runde 5, UX-FUX3-02):** Eine gezogene Kante hält in jeder Betriebsart bei 2400 bzw.
  0000 an, Plakette «Tagesende 2400 · über Mitternacht: Zeit eingeben (Z)» (mit «⇧ Shift · » bzw. «Alt · » davor).
  Über Mitternacht nur per Eingabe; die Tagesgrenze der UI-Richtlinie 5.6 gilt für das Verschieben. Ein Block, der
  schon über Mitternacht reicht, behält seine Grenze von 24 h.
- **Kante relativ zur Greiflage (UX-FUX3-06):** Die Kante folgt dem Zeigerweg ab der Greiflage (Kante plus Weg, dann
  aufs Raster); wo innerhalb der Kantenzone gegriffen wurde, verschiebt das Ergebnis nicht.

## Abweichungen von raster-bedienung-v2 §2 (bewusst, Entscheid 21.10.2026)

| v2 §2 | jetzt | Grund |
| --- | --- | --- |
| Kanten und Griffe nur am gewählten Block | an jedem Block beim Überfahren; die Auswahl ändert keine Zone | Rückmeldung «nicht zuerst anwählen» (Stufe 3) |
| Kantenband 8 px ab 24 px Höhe, am gewählten mind. ⅓ der Höhe | ab 24 px Höhe ⅓ der Höhe, 8 bis 12 px; 4 px von 12 bis 23 px; darunter ⅓ der Höhe | «Bandbreite ≤ 12 px»: grosse Blöcke greifbar, ohne dass bei einem 4-h-Block das obere Drittel Kante wird |
| seitliche Kanten 6 px nur gewählt, ab 24 px | Zone 6 px innen an jedem Block ab 24 px, schmale Blöcke 4 px aussen; **Griff** seitlich erst ab 60 × 30 px | in der 40-px-Det-Spalte überdeckten sich die Seitengriffe; die Zone bleibt für schmale Spalten erhalten |
| Trefferfläche = Band | Band plus Griff (+ 3 px), auch über die Kante hinaus | Griff als sichtbares Ziel (5a) |
| Hover: 1-px-Rahmen | 1-px-Rahmen plus Schatten unter dem Block; Marker mit Band | Variante B |

## Reduzierte Bewegung

`prefers-reduced-motion: reduce`: keine Übergänge und keine Animationen (angehobener Block, Griffe, Plakette,
Nachbarn, Esc); Lage und Anzeigen wechseln sofort. Die Hervorhebung von Shift/Alt bleibt (Farbe statt Bewegung).

## Leistung

Ziel (Auftrag Koordinator 21.10.2026): Herstellungszeit je Bild p95 ≤ 8 ms ungedrosselt, ≤ 16,7 ms gedrosselt, keine
Aufgabe > 50 ms, Eingabe-zu-Bild ≤ 1 Bild – auch beim Überfahren. Umsetzung: Zeigerereignisse nur merken, je Bild eine
Berechnung (beim Loslassen sofort mit Lage und Tasten des Loslassens); Rechtecke beim Drücken gemerkt, Rolllage
während der Geste selbst geführt (keine Layout-Lesung, kein erzwungener Reflow); nur der gezogene Block hat eine
eigene Ebene (`will-change`), nie alle Blöcke auf Vorrat; Marken je einmal vorhanden und nur verschoben; Modusfarbe
nur an den Marken. Messung ohne Bildratenbegrenzung (die Sitzung läuft über eine Remotedesktop-Anzeige mit 32 Hz):
`tests/wap-perf/f-ux3/bewegung-frei.perf.ts` (Entwurf).
