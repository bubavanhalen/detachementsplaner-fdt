// @vitest-environment node
// F-ABDECKUNG (FT-A-01): Formtext-Zerlegung (Beschrieb 8.2 Regel 2 und 12; Gate S A1; normalisierung.md 4, 5.1) und
// Terminzeilen nach dem Muster in Beschrieb 4.8 (normalisierung.md 5.5, 6) in Grenz- und Fehlerfällen: Zeitformen,
// Rundung mit Kennzeichen «unsicher», gestrichene und rote Teile, Felder, Freitext, Teilaufgaben. Fiktive Texte.
import { describe, expect, it } from 'vitest';
import {
  type FormTextContext,
  parseAgendaLine,
  parseShapeText,
} from '../../../../src/io/wap-import/index';
import type { ShapeTextRun } from '../../../../src/io/xlsx-drawing/index';

type Run = { text: string; bold?: boolean; strike?: boolean; color?: string };

/** Läufe wie readShapeRuns: Zeile = Index im Feld, leere Zeilen ohne Lauf. */
function shape(lines: readonly (readonly Run[])[]): ShapeTextRun[] {
  const out: ShapeTextRun[] = [];
  lines.forEach((l, line) => {
    for (const r of l)
      out.push({
        paragraph: line,
        line,
        text: r.text,
        bold: r.bold ?? false,
        strike: r.strike ?? false,
        color: r.color ?? null,
        sizePt: 8,
      });
  });
  return out;
}
const agenda = (...runs: Run[]): ShapeTextRun[] => shape([runs]);
const B = (text: string): Run => ({ text, bold: true });
const N = (text: string): Run => ({ text });
const ROT = 'C00000';

const ctx: FormTextContext = {
  persons: [
    { id: 'r1', grad: 'Hptm', name: 'Beispiel', vorname: 'Anna', funktion: 'Kp Kdt' },
    { id: 'r2', grad: 'Lt', name: 'Muster', vorname: 'Beat', funktion: '' },
  ],
  functionList: [
    { code: 'Einh Fw', categoryId: null, singleFunction: true },
    { code: 'Zfhr', categoryId: null, singleFunction: false },
    { code: '', categoryId: null, singleFunction: false },
  ],
  ltgInBlock: 'withOrt',
};
const ctxOwnLine: FormTextContext = { ...ctx, ltgInBlock: 'ownLinePrefixed' };
const text = (runs: readonly { text: string }[]) => runs.map((r) => r.text).join('');

describe('F-ABDECKUNG Terminzeilen: Zeiten (normalisierung.md 6)', () => {
  it('[R-8.2-34] von–bis über Mitternacht: Ende vor Beginn heisst Folgetag', () => {
    const p = parseAgendaLine(agenda(N('40 2200-0130: Nachtmarsch.')));
    expect(p.time).toEqual({ form: 'range', from: 1320, to: 1530 });
    expect(p.uncertain).toBe(false);
  });

  it('[R-8.2-34] Zeit nicht auf 5 Minuten → auf 5 Minuten gesetzt und als unsicher gekennzeichnet', () => {
    const r = parseAgendaLine(agenda(N('10 0807-0903: A.')));
    expect(r.time).toEqual({ form: 'range', from: 485, to: 545 });
    expect(r.uncertain).toBe(true);
    expect(parseAgendaLine(agenda(N('11 0812: B.')))).toMatchObject({
      time: { form: 'point', at: 490 },
      uncertain: true,
    });
    expect(parseAgendaLine(agenda(N('12 ab 1003: C.')))).toMatchObject({
      time: { form: 'from', from: 605 },
      uncertain: true,
    });
    expect(parseAgendaLine(agenda(N('13 bis 1158: D.')))).toMatchObject({
      time: { form: 'until', to: 720 },
      uncertain: true,
    });
  });

  it('[R-8.2-34] Frist mit Jahr (vier- und zweistellig) und mit Uhrzeit; Uhrzeit neben dem Raster unsicher', () => {
    expect(parseAgendaLine(agenda(N('31 bis 21.10.2026: Unterlagen.'))).deadline).toEqual({
      day: 21,
      month: 10,
      year: 2026,
    });
    expect(parseAgendaLine(agenda(N('32 bis 1.9.26: Meldung.'))).deadline).toEqual({
      day: 1,
      month: 9,
      year: 2026,
    });
    const mitZeit = parseAgendaLine(agenda(N('33 bis 21.10. 1700: Abgabe.')));
    expect(mitZeit).toMatchObject({
      time: { form: 'deadline', to: 1020 },
      deadline: { day: 21, month: 10, year: null },
      uncertain: false,
      title: 'Abgabe',
    });
    expect(parseAgendaLine(agenda(N('34 bis 21.10. 1702: Abgabe.'))).uncertain).toBe(true);
  });

  it('[R-8.2-34] Zeit ohne Doppelpunkt danach: Felder erkannt, Zerlegung aber unsicher', () => {
    const p = parseAgendaLine(agenda(N('20 0900 Antreten, Ort: Halle.')));
    expect(p).toMatchObject({ number: 20, title: 'Antreten', ort: 'Halle', uncertain: true });
  });

  it('[R-8.2-34] Grenzwert: fünfstellige Zahl «09001» ist keine Zeit → Freitext ohne Zeit', () => {
    const p = parseAgendaLine(agenda(N('21 09001 Kisten')));
    expect(p.time).toBeNull();
    expect(p.freeText).toBe('09001 Kisten');
  });
});

describe('F-ABDECKUNG Terminzeilen: Felder, Freitext, Zeitfenster (Beschrieb 4.8)', () => {
  it('[R-8.2-34] Alle Felder Ltg, Tn, Tpt, Ort; doppeltes Feld verbunden; Schlusspunkt entfernt', () => {
    const p = parseAgendaLine(
      agenda(N('24 1330: Kontrl Fsg, Ltg: Einh Fw, Tn: Zug 1, Tpt: Bus, Ort: Halle, Ort: Platz.')),
    );
    expect(p).toMatchObject({
      title: 'Kontrl Fsg',
      ltg: 'Einh Fw',
      tn: 'Zug 1',
      tpt: 'Bus',
      ort: 'Halle, Platz',
      freeText: null,
    });
  });

  it('[R-8.2-34] Zeit, danach nur Felder ohne Titel → Freitext mit dem Text nach der Zeit', () => {
    const p = parseAgendaLine(agenda(N('25 1400: Ltg: Zfhr.')));
    expect(p.title).toBe('');
    expect(p.ltg).toBe('Zfhr');
    expect(p.freeText).toBe('Ltg: Zfhr.');
    // Nur Nummer und Zeit: kein Freitext.
    expect(parseAgendaLine(agenda(N('26 1400'))).freeText).toBeNull();
  });

  it('[R-8.2-34] Mehrere Zeitfenster mit Rest nach dem letzten Fenster: Rest geht in die Felder', () => {
    const p = parseAgendaLine(
      agenda(N('14 Revision: 0900-1000 Zug 1, 1300-1400 Zug 2, Ort: Zeughaus.')),
    );
    expect(p.windows.map((w) => [w.time, w.supplement])).toEqual([
      [{ form: 'range', from: 540, to: 600 }, 'Zug 1'],
      [{ form: 'range', from: 780, to: 840 }, 'Zug 2'],
    ]);
    expect(p).toMatchObject({
      title: 'Revision',
      ort: 'Zeughaus',
      time: { form: 'range', from: 540, to: 600 },
    });
  });

  it('[R-8.2-34] Nur ein Zeitfenster nach dem Titel: kein Mehrfenster-Muster, Zeit im Text → Freitext, unsicher', () => {
    const p = parseAgendaLine(agenda(N('15 Revision: 0900 Zug 1')));
    expect(p).toMatchObject({
      number: 15,
      time: { form: 'point', at: 540 },
      freeText: 'Revision: 0900 Zug 1',
      timeInText: '0900',
      uncertain: true,
    });
  });

  it('[R-8.2-34] Doppelpunkt am Anfang bzw. ohne Zeit danach: kein Zeitfenster', () => {
    expect(parseAgendaLine(agenda(N('16 : 0900 X, 1000 Y'))).windows).toHaveLength(1);
    const ohne = parseAgendaLine(agenda(N('17 Material: Kisten, Säcke')));
    expect(ohne.time).toBeNull();
    expect(ohne.freeText).toBe('Material: Kisten, Säcke');
  });

  it('[R-8.2-34][R-6-16] Text ohne Nummer: ganze Zeile Titel (ohne Schlusspunkt), Felder dennoch gelesen', () => {
    const p = parseAgendaLine(agenda(N('Retablierung, Ort: Zeughaus.')));
    expect(p).toMatchObject({
      number: null,
      time: null,
      title: 'Retablierung, Ort: Zeughaus',
      ort: 'Zeughaus',
      freeText: null,
      rest: 'Retablierung, Ort: Zeughaus.',
    });
  });

  it('[R-8.2-34] Leerer und reiner Leerraum-Text: alles leer, keine Nummer', () => {
    for (const t of ['', '   ']) {
      const p = parseAgendaLine(agenda(N(t)));
      expect(p).toMatchObject({ number: null, time: null, title: '', rest: '', windows: [] });
    }
  });
});

describe('F-ABDECKUNG Terminzeilen: Regel 2 rot und gestrichen', () => {
  it('[R-8.2-05] Gestrichene Nummer mit Text im selben Lauf: Eintrag gestrichen, Nummer bleibt, Text als gestrichen vermerkt', () => {
    const p = parseAgendaLine(
      agenda({ text: '13 0800: Alt', strike: true, color: ROT }, N(' neu')),
    );
    expect(p).toMatchObject({ number: 13, cancelled: true, cancelledParts: ['0800: Alt'] });
  });

  it('[R-8.2-06] Gestrichener Teil nach der Nummer: nie gültiger Text; Nummer nicht gestrichen', () => {
    const p = parseAgendaLine(
      agenda(N('14 0900: Besuch '), { text: 'Werkstatt', strike: true, color: ROT }, N('Halle.')),
    );
    expect(p).toMatchObject({
      number: 14,
      cancelled: false,
      cancelledParts: ['Werkstatt'],
      title: 'Besuch Halle',
    });
  });

  it('[R-8.2-06] Gestrichene Ziffern ohne Nummernform (z.B. «0800») zählen nicht als Nummer', () => {
    const p = parseAgendaLine(
      agenda({ text: '0800', strike: true, color: ROT }, N(' 15 0900: Neu.')),
    );
    expect(p.cancelled).toBe(false);
    expect(p.cancelledParts).toEqual(['0800']);
    expect(p.number).toBe(15);
  });

  it('[R-8.2-06] Rot durchgestrichener Leerraum: kein gestrichener Teil, Eintrag nicht gestrichen', () => {
    const p = parseAgendaLine(
      agenda(N('14 0900: Besuch '), { text: '  ', strike: true, color: ROT }, N('Halle.')),
    );
    expect(p).toMatchObject({ cancelled: false, cancelledParts: [], title: 'Besuch Halle' });
  });

  it('[R-8.2-07] Roter Text → geändert; schwarz durchgestrichen bzw. dunkelrot ist kein Regel-2-Fall', () => {
    expect(parseAgendaLine(agenda(N('16 0900: '), { text: 'Neu', color: ROT })).changed).toBe(true);
    const schwarz = parseAgendaLine(
      agenda({ text: '17 0900: Alt.', strike: true, color: '000000' }),
    );
    expect(schwarz).toMatchObject({ cancelled: false, cancelledParts: [], title: 'Alt' });
    expect(parseAgendaLine(agenda({ text: '18 0900: X.', color: '800000' })).changed).toBe(false);
    expect(parseAgendaLine(agenda({ text: '19 0900: X.', color: 'rot' })).changed).toBe(false);
    // Roter Leerraum allein ändert nichts.
    expect(parseAgendaLine(agenda(N('20 0900: X.'), { text: ' ', color: ROT })).changed).toBe(
      false,
    );
  });
});

describe('F-ABDECKUNG Formtext: Regel 12 Grenzfälle', () => {
  it('[R-8.2-29] Ohne fette Zeile: erste Zeile Titel; führende Zeit «0830-0900» und «0830 :» nicht im Titel', () => {
    const p = parseShapeText(shape([[N('0830-0900 Antreten')], [N('Zusatz Material')]]), ctx);
    expect(text(p.title)).toBe('Antreten');
    expect(p.timeInText).toBe('0830-0900');
    expect(p.supplement).toBe('Zusatz Material');
    const q = parseShapeText(shape([[B('0830 : Antreten')]]), ctx);
    expect(text(q.title)).toBe('Antreten');
    expect(q.timeInText).toBe('0830');
  });

  it('[R-8.2-29][FA-01] Zeit mit direkt folgendem Doppelpunkt «0830-0900: …» bzw. «0830: …» nicht im Titel', () => {
    // Soll nach normalisierung.md 5.1: Titel «Antreten», Zeit im Text «0830-0900» (wie bei «0830-0900 Antreten»).
    // Bis F-FIX verhinderte die Vorausschau auf Leerraum in TIME_LEAD das optionale «:» (Befund FA-01).
    const p = parseShapeText(shape([[N('0830-0900: Antreten')]]), ctx);
    expect(text(p.title)).toBe('Antreten');
    expect(p.timeInText).toBe('0830-0900');
    const q = parseShapeText(shape([[B('0830: Antreten')]]), ctx);
    expect(text(q.title)).toBe('Antreten');
    expect(q.timeInText).toBe('0830');
  });

  it('[R-8.2-29][FA-01] Vier Ziffern mit weiteren Ziffern bzw. Buchstaben direkt danach sind keine führende Zeit', () => {
    // Grenze der Behebung: nur Leerraum, «:» oder Zeilenende beenden die Zeit (normalisierung 5.1).
    const p = parseShapeText(shape([[N('08300 Antreten')]]), ctx);
    expect(text(p.title)).toBe('08300 Antreten');
    expect(p.timeInText).toBeNull();
    const q = parseShapeText(shape([[N('0830h Antreten')]]), ctx);
    expect(text(q.title)).toBe('0830h Antreten');
  });

  it('[R-8.2-29] Führende Zeit über mehrere Läufe: Rest des Laufs bleibt mit seiner Formatierung', () => {
    const p = parseShapeText(
      shape([[N('  0830 '), N('- 0900 '), B('Antreten'), N(' Halle')]]),
      ctx,
    );
    expect(p.timeInText).toBe('0830-0900');
    expect(p.title).toEqual([
      { text: 'Antreten', bold: true },
      { text: ' Halle', bold: false },
    ]);
  });

  it('[R-8.2-29] Leerer Formtext: kein Titel, keine Unsicherheit; nur Leerraum ebenso', () => {
    for (const lines of [[], [[N('  ')]]]) {
      const p = parseShapeText(shape(lines), ctx);
      expect(p).toMatchObject({
        title: [],
        ltg: '',
        ort: '',
        uncertain: false,
        plain: '',
        timeInText: null,
      });
    }
  });

  it('[R-8.2-35] Text nur in Klammern: kein Titel → unsicher «kein Titel erkannt», Klammer wird Ort', () => {
    const p = parseShapeText(shape([[N('(Halle)')]]), ctx);
    expect(p.title).toEqual([]);
    expect(p.ort).toBe('Halle');
    expect(p.uncertainReasons).toEqual(['kein Titel erkannt']);
  });

  it('[R-8.2-29] Nur eine Zeitangabe: kein Titel, Zeit im Text, keine weitere Zeile', () => {
    const p = parseShapeText(shape([[N('0800')]]), ctx);
    expect(p).toMatchObject({ title: [], timeInText: '0800', supplement: '' });
  });

  it('[R-8.2-31] «Ltg:» im fetten Titel: Rest der Zeile Ltg, nicht Titel; Klammer im Titel → Ort', () => {
    const p = parseShapeText(shape([[B('Ausb Fahrer (Halle) Ltg: Einh Fw')]]), ctx);
    expect(text(p.title)).toBe('Ausb Fahrer');
    expect(p.ltg).toBe('Einh Fw');
    expect(p.ort).toBe('Halle');
  });

  it('[R-8.2-31] «Ltg:» mitten im Wort ist kein Feld (z.B. «Altg:»)', () => {
    const p = parseShapeText(shape([[B('Altg: Test')]]), ctx);
    expect(text(p.title)).toBe('Altg: Test');
    expect(p.ltg).toBe('');
  });

  it('[R-8.2-30] Verschachtelte Klammern im Titel: äussere Klammer ganz als Ort; leere Klammer entfällt', () => {
    const p = parseShapeText(shape([[B('Übung (Raum (Nord)) ()')]]), ctx);
    expect(text(p.title)).toBe('Übung');
    expect(p.ort).toBe('Raum (Nord)');
    expect(p.uncertain).toBe(false);
  });

  it('[R-8.2-30][R-8.2-35] Zwei Klammern als Ort → unsicher «mehrere Klammern als Ort»', () => {
    const p = parseShapeText(shape([[B('Übung (Halle) (Platz)')]]), ctx);
    expect(p.ort).toBe('Halle, Platz');
    expect(p.uncertainReasons).toEqual(['mehrere Klammern als Ort']);
  });

  it('[R-8.2-30] Klammer mit Grad und Name (nicht in der Liste) → Ltg; Person mit Vorname und Name; Funktion einer Person', () => {
    const grad = parseShapeText(shape([[B('Kontrolle (Oblt Neu)')]]), ctx);
    expect(grad).toMatchObject({ ltg: 'Oblt Neu', ort: '' });
    const voll = parseShapeText(shape([[B('Kontrolle (Hptm Anna Beispiel)')]]), ctx);
    expect(voll.ltg).toBe('Hptm Anna Beispiel');
    const fkt = parseShapeText(shape([[B('Kontrolle (Kp Kdt)')]]), ctx);
    expect(fkt.ltg).toBe('Kp Kdt');
    const nicht = parseShapeText(shape([[B('Kontrolle (Hptmann)')]]), ctx);
    expect(nicht).toMatchObject({ ltg: '', ort: 'Hptmann' });
  });

  it('[R-8.2-31] Zeile «Funktion (Ort).» mit Schlusspunkt; «Zfhr, (Halle)» ohne Komma in Ltg', () => {
    const p = parseShapeText(shape([[B('Ausb')], [N('Zfhr, (Halle).')]]), ctx);
    expect(p).toMatchObject({ ltg: 'Zfhr', ort: 'Halle' });
  });

  it('[R-8.2-30][R-8.2-35] Zeile «Text (Name)»: Name wird Ltg, weiterer Text unsicher', () => {
    const p = parseShapeText(shape([[B('Ausb')], [N('Fahrschule (Lt Muster)')]]), ctx);
    expect(p.ltg).toBe('Lt Muster');
    expect(p.uncertainReasons).toEqual(['Klammer mit Name und weiterer Text']);
    const nurName = parseShapeText(shape([[B('Ausb')], [N('(Lt Muster)')]]), ctx);
    expect(nurName).toMatchObject({ ltg: 'Lt Muster', uncertain: false });
  });

  it('[R-8.2-31] Vorlage «Ltg auf eigener Zeile»: «(Ort)» allein → Ort; «Text (Ort)» → Zusatz statt Ltg', () => {
    const nurOrt = parseShapeText(shape([[B('Ausb')], [N('(Halle)')]]), ctxOwnLine);
    expect(nurOrt).toMatchObject({ ltg: '', ort: 'Halle' });
    const mitText = parseShapeText(shape([[B('Ausb')], [N('Fahrschule (Halle)')]]), ctxOwnLine);
    expect(mitText).toMatchObject({ ltg: '', ort: '', supplement: 'Fahrschule (Halle)' });
  });

  it('[R-8.2-33][R-8.2-35] Zeile nur mit Funktion der Funktionsliste → Ltg, sicher; Funktion mit Komma ebenso', () => {
    // F-FIX Runde 5 (UX-AB-01): Eine Funktion der Funktionsliste ist kein Zweifelsfall; unsicher bleibt nur, was die
    // Listen nicht bestätigen (Grad mit Name ohne Personenliste, Teil einer Funktion).
    const p = parseShapeText(shape([[B('Ausb')], [N('Einh Fw, Four')]]), ctx);
    expect(p.ltg).toBe('Einh Fw, Four');
    expect(p.uncertainReasons).toEqual([]);
  });

  it('[R-8.2-32] Mehrere Tenue-Zeilen verbunden; «Tenue:» mit Doppelpunkt; «Ltg:»-Zeile', () => {
    const p = parseShapeText(
      shape([[B('Ausb')], [N('Tenue B')], [N('Tenue: Helm.')], [N('Ltg: Lt Muster')]]),
      ctx,
    );
    expect(p).toMatchObject({ tenue: 'B, Helm', ltg: 'Lt Muster', supplement: '' });
  });

  it('[R-8.2-29] Mehrere fette Zeilen: Titel verbunden mit Leerzeichen; Satzzeichen am Ende entfernt', () => {
    const p = parseShapeText(shape([[B('Ausb ,')], [B('Fahrer -')], [N('Zusatz')]]), ctx);
    expect(p.title).toEqual([{ text: 'Ausb, Fahrer', bold: true }]);
  });

  it('[R-8.2-07] Rot im Formtext → geändert; ganz rot durchgestrichen → gestrichen, Text entfernt', () => {
    const rot = parseShapeText(shape([[B('Ausb'), { text: ' neu', color: ROT }]]), ctx);
    expect(rot).toMatchObject({ changed: true, cancelled: false });
    const weg = parseShapeText(
      shape([[{ text: 'Ausb', bold: true, strike: true, color: ROT }]]),
      ctx,
    );
    expect(weg).toMatchObject({ cancelled: true, removedText: ['Ausb'], title: [], plain: '' });
  });

  it('[R-8.2-29] Normalisierung: weiches Trennzeichen entfernt, geschützte Leerzeichen und Gedankenstrich ersetzt', () => {
    const p = parseShapeText(shape([[B('Aus­bildung Nord–Süd')]]), ctx);
    expect(text(p.title)).toBe('Ausbildung Nord-Süd');
  });
});

describe('F-ABDECKUNG Formtext: Teilaufgaben (R-8.2-37, R-8.2-38)', () => {
  it('[R-8.2-37] Zwei Gruppen, nur eine mit normaler Zeile → keine Teilaufgaben, gewöhnliche Zerlegung', () => {
    const p = parseShapeText(shape([[B('Haupt')], [N('Zfhr')], [], [B('Teil')]]), ctx);
    expect(p.subtasks).toEqual([]);
    expect(text(p.title)).toBe('Haupt Teil');
  });

  it('[R-8.2-37] Gruppe mit normaler Zeile vor der fetten → keine Teilaufgaben', () => {
    const p = parseShapeText(
      shape([[B('Haupt')], [N('Zfhr')], [], [N('vorher')], [B('Teil')], [N('Lt Muster')]]),
      ctx,
    );
    expect(p.subtasks).toEqual([]);
  });

  it('[R-8.2-38] Gruppe: mehrere normale Zeilen → Ltg verbunden, Klammern als Ort verbunden; Name in Klammer mit Text unsicher', () => {
    const p = parseShapeText(
      shape([
        [B('Haupt (Halle)')],
        [N('Zfhr (Platz)')],
        [N('Einh Fw (Hof)')],
        [],
        [B('Teil 1 Ltg: Four')],
        [N('Fahrt (Lt Muster)')],
        [N('weiter')],
      ]),
      ctx,
    );
    expect(text(p.title)).toBe('Haupt');
    expect(p.ltg).toBe('Zfhr, Einh Fw');
    expect(p.ort).toBe('Halle, Platz, Hof');
    expect(p.subtasks).toEqual([
      // Seit F-FIX Runde 6 (CR-5-01) geht der Text vor der Namensklammer («Fahrt») nicht mehr verloren.
      { title: [{ text: 'Teil 1', bold: true }], ltg: 'Four, Fahrt, Lt Muster, weiter', ort: '' },
    ]);
    expect(p.uncertainReasons).toEqual(['Klammer mit Name und weiterer Text']);
  });

  it('[R-8.2-37] Teilaufgabe ohne Titeltext (nur Klammer) → keine Teilaufgaben', () => {
    const p = parseShapeText(
      shape([[B('Haupt')], [N('Zfhr')], [], [B('(Halle)')], [N('Lt Muster')]]),
      ctx,
    );
    expect(p.subtasks).toEqual([]);
  });
});
