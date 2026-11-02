// V11-deep und Zeilen aus PDF-Textstücken (Nachtrag-Test, Befund E1-01-30; R-H-24): deepPrivacyScan setzt je
// PDF-Seite Zeilen aus den Textstücken von getTextContent() nach ihrer Lage zusammen und prüft jede Zeile
// einzeln (gleiche Laufrichtung ±1°, gleiche Grundlinie ±0,25·s, Lücke −0,25·s … 0,6·s; Fortsetzung ohne
// Trennzeichen bis 0,15·s, sonst mit einem Leerzeichen). Ziffern verschiedener Zellen, Zeilen oder Spalten
// verschmelzen nicht mehr; eine in Stücke geteilte Nummer auf einer Grundlinie bleibt erkannt. Metadaten
// unverändert.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md, «Änderungsnotiz E1-01-30 (06.10.2026, Orchestrator)»,
// Fälle (a)–(g); §2 deepPrivacyScan (Pfad-Modus).
// Fiktive Inhalte: Telefonnummer, AHV-Nummer und Uhrzeiten zur Laufzeit gebildet; Sperrlisten-Namen aus der
// fiktiven Test-Sperrliste (WAP_REFERENCE_DIR). PDFs mit pdf-lib, jedes Stück ein eigener drawText-Aufruf
// mit genauen Koordinaten.
// Erzeugung: Aufeinanderfolgende Stücke wechseln zwischen Helvetica und Helvetica-Bold (gleiche
// Ziffernbreite). Bei gleicher Schrift fasst pdfjs nahe Stücke einer Grundlinie zu einem Textstück zusammen;
// der Wechsel erzwingt getrennte Stücke. Jeder Test prüft das als Vorbedingung über pdfjs.
// Auslegung zu Regel 1 (test-engineer, E1-01-30): pdfjs fügt in Lücken ab etwa 0,1·s eigene Stücke
// aus Leerraum ein (Anfang = Ende des vorigen Stücks, Breite = Lücke). Sie gelten als «leere Stücke»
// (Regel 1), sonst überbrückten sie jede Lücke und (c), (f) wären mit der Regel nicht erfüllbar.
import { join } from 'node:path';
import { degrees, PDFDocument, type PDFFont, StandardFonts } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ahvNummer,
  aufraeumen,
  FIKTIVE_NAMEN,
  FIKTIVER_NAME,
  neueSandbox,
  neuesRepo,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { privacyDeep } from './support/vertrag';

afterEach(aufraeumen);

/** Standard-Schriftgrösse s (pt); Grenzwertfälle laufen zusätzlich mit 6 und 16 pt (TR-E101-30-01). */
const S = 10;

/** Fiktive Telefonnummer in Teilen (zusammen 10 Ziffern), zur Laufzeit gebildet; nie die Ausnahme 0123456789. */
const TEILE = ['0', '31', '000', '1', '2', '34'];
const VORWAHL = `${TEILE[0]}${TEILE[1]}`;
const BLOCK = TEILE[2] ?? '';
const PAAR1 = `${TEILE[3]}${TEILE[4]}`;
const PAAR2 = TEILE[5] ?? '';
/** Dieselbe Nummer gegliedert (wie in einem Dokument gesetzt). */
const NUMMER = [VORWAHL, BLOCK, PAAR1, PAAR2].join(' ');
const ZIFFERN = NUMMER.replace(/\s/g, '');

/** Ein Textstück: Text und Grundlinienanfang (pt, PDF-Koordinaten), optional gedreht. */
interface Stueck {
  text: string;
  x: number;
  y: number;
  drehung?: number;
}

/**
 * Breite eines Stücks in seiner Schrift (Stück i: gerade Helvetica, ungerade Helvetica-Bold), als Summe der
 * Zeichenbreiten: drawText setzt ohne Unterschneidung, widthOfTextAtSize rechnet sie für ganze Texte ein.
 */
type Breite = (text: string, i: number) => number;

/** Ordnet Stücke an; erhält die Breitenfunktion der eingebetteten Schriften und die Schriftgrösse s (pt). */
type Anordnung = (breite: Breite, s: number) => Stueck[];

/**
 * Stücke hintereinander in Laufrichtung (0° oder 90°): Lücke und Querversatz in Vielfachen von s,
 * gemessen vom Ende des vorigen Stücks bzw. von seiner Grundlinie (Querversatz nach unten bzw. links).
 */
function reihe(
  texte: string[],
  o: { luecke?: number; quer?: number; drehung?: number; x?: number; y?: number } = {},
): Anordnung {
  return (breite, s) => {
    const gedreht = o.drehung === 90;
    const [rx, ry] = gedreht ? [0, 1] : [1, 0];
    const [nx, ny] = gedreht ? [-1, 0] : [0, -1];
    let lauf = 0;
    return texte.map((text, i) => {
      const quer = i * (o.quer ?? 0) * s;
      const st: Stueck = {
        text,
        x: (o.x ?? 40) + rx * lauf + nx * quer,
        y: (o.y ?? 150) + ry * lauf + ny * quer,
        ...(gedreht ? { drehung: 90 } : {}),
      };
      lauf += breite(text, i) + (o.luecke ?? 0) * s;
      return st;
    });
  };
}

/** Feste Anordnung (Stücke mit eigenen Koordinaten). */
function fest(stuecke: Stueck[]): Anordnung {
  return () => stuecke;
}

/** Optionen eines Probe-PDFs: Titel in den Metadaten, Schriftgrösse s (Standard S). */
interface Probe {
  titel?: string;
  s?: number;
}

/** PDF mit den Stücken einer Anordnung (je ein drawText-Aufruf) in der Schriftgrösse s. */
async function pdfMit(anordnung: Anordnung, o: Probe = {}): Promise<Uint8Array> {
  const s = o.s ?? S;
  const doc = await PDFDocument.create();
  const schriften: PDFFont[] = [
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
  ];
  const schrift = (i: number): PDFFont => schriften[i % 2] as PDFFont;
  if (o.titel !== undefined) doc.setTitle(o.titel);
  const seite = doc.addPage([400, 300]);
  const stuecke = anordnung(
    (text, i) =>
      [...text].reduce((summe, zeichen) => summe + schrift(i).widthOfTextAtSize(zeichen, s), 0),
    s,
  );
  stuecke.forEach((st, i) => {
    seite.drawText(st.text, {
      x: st.x,
      y: st.y,
      size: s,
      font: schrift(i),
      ...(st.drehung === undefined ? {} : { rotate: degrees(st.drehung) }),
    });
  });
  return doc.save();
}

/** Nicht leere Textstücke der ersten Seite laut pdfjs (Vorbedingung: Stücke kommen getrennt an). */
async function stueckeLautPdfjs(bytes: Uint8Array): Promise<string[]> {
  const aufgabe = getDocument({
    data: bytes.slice(),
    verbosity: 0,
    disableFontFace: true,
    useSystemFonts: false,
  });
  try {
    const doc = await aufgabe.promise;
    const inhalt = await (await doc.getPage(1)).getTextContent();
    return inhalt.items.flatMap((i) => ('str' in i && i.str.trim() !== '' ? [i.str] : []));
  } finally {
    await aufgabe.destroy();
  }
}

function repo(sb: Sandbox): string {
  prozessUmgebung(sb);
  return neuesRepo(sb, 'pdfzeilen');
}

const DATEI = 'test-results/wap/pdf/probe.pdf';

/** Legt das PDF als erzeugtes Artefakt ab (nach geprüfter Vorbedingung) und scannt test-results/wap. */
async function scanneStuecke(anordnung: Anordnung, erwarteteStuecke: string[], o: Probe = {}) {
  const bytes = await pdfMit(anordnung, o);
  expect(
    await stueckeLautPdfjs(bytes),
    'Vorbedingung: pdfjs liefert jedes Stück als eigenes Textstück',
  ).toEqual(erwarteteStuecke);
  const sb = neueSandbox();
  const root = repo(sb);
  writeText(root, DATEI, bytes);
  const { deepPrivacyScan } = await privacyDeep();
  return deepPrivacyScan({ cwd: root, pfade: [join(root, 'test-results', 'wap')] });
}

type Ergebnis = Awaited<ReturnType<typeof scanneStuecke>>;

/** Rot mit Datei und Muster, ohne Treffertext in der Meldung. */
function erwarteTreffer(r: Ergebnis, muster: string, treffer: string[]): void {
  expect(r.ok, 'Scan grün statt rot').toBe(false);
  const text = schrittText(r);
  expect(text).toContain('probe.pdf');
  expect(text).toContain(muster);
  const kompakt = text.replace(/\s/g, '').toLowerCase();
  for (const t of treffer) {
    expect(kompakt.includes(t.replace(/\s/g, '').toLowerCase()), 'Treffer in der Meldung').toBe(
      false,
    );
  }
}

/** Kein Treffer: weder «Telefonnummer» gemeldet noch sonst rot. */
function erwarteKeinTreffer(r: Ergebnis): void {
  expect(schrittText(r), 'Treffer über Stückgrenzen hinweg').not.toContain('Telefonnummer');
  expect(r.ok, schrittText(r)).toBe(true);
}

describe('deepPrivacyScan: Zeilen aus PDF-Textstücken (E1-01-30)', () => {
  it('[R-H-24] (a) Telefonnummer in einem Textstück → rot «Telefonnummer», Datei genannt, Nummer maskiert', async () => {
    const r = await scanneStuecke(reihe([NUMMER]), [NUMMER]);
    erwarteTreffer(r, 'Telefonnummer', [ZIFFERN]);
  });

  it.each([
    ['2 Stücke, lückenlos', [`${VORWAHL}${BLOCK}`, `${PAAR1}${PAAR2}`], 0],
    ['3 Stücke, lückenlos', [VORWAHL, `${BLOCK}${TEILE[3]}`, `${TEILE[4]}${PAAR2}`], 0],
    ['4 Stücke, lückenlos', [VORWAHL, BLOCK, PAAR1, PAAR2], 0],
    ['2 Stücke, Wortabstand 0,25·s', [`${VORWAHL} ${BLOCK}`, `${PAAR1} ${PAAR2}`], 0.25],
    ['4 Stücke, Wortabstand 0,25·s', [VORWAHL, BLOCK, PAAR1, PAAR2], 0.25],
  ] as const)(
    '[R-H-24] (b) Telefonnummer geteilt in %s auf einer Grundlinie → rot «Telefonnummer», maskiert',
    async (_name, texte, luecke) => {
      const r = await scanneStuecke(reihe([...texte], { luecke }), [...texte]);
      erwarteTreffer(r, 'Telefonnummer', [ZIFFERN]);
    },
  );

  it.each([
    ['4 Stücke, Lücke 2·s', [VORWAHL, BLOCK, PAAR1, PAAR2], 2],
    ['2 Stücke, Lücke 2·s', [`${VORWAHL} ${BLOCK}`, `${PAAR1} ${PAAR2}`], 2],
  ] as const)(
    '[R-H-24] (c) gleiche Ziffernteile, %s, auf einer Grundlinie → kein Treffer, grün',
    async (_name, texte, luecke) => {
      const r = await scanneStuecke(reihe([...texte], { luecke }), [...texte]);
      erwarteKeinTreffer(r);
    },
  );

  it.each([
    [
      'Zeilenumbruch (zweite Zeile am Zeilenanfang)',
      fest([
        { text: `${VORWAHL} ${BLOCK}`, x: 40, y: 150 },
        { text: `${PAAR1} ${PAAR2}`, x: 40, y: 150 - 1.2 * S },
      ]),
    ],
    [
      'zweite Zeile ab dem Ende der ersten',
      reihe([`${VORWAHL} ${BLOCK}`, `${PAAR1} ${PAAR2}`], { quer: 1.2 }),
    ],
  ] as const)(
    '[R-H-24] (d) Ziffernteile auf zwei Zeilen (Grundlinienabstand 1,2·s), %s → kein Treffer, grün',
    async (_name, anordnung) => {
      const r = await scanneStuecke(anordnung, [`${VORWAHL} ${BLOCK}`, `${PAAR1} ${PAAR2}`]);
      erwarteKeinTreffer(r);
    },
  );

  it.each([
    ['2 Stücke', [`${VORWAHL}${BLOCK}`, `${PAAR1}${PAAR2}`]],
    ['4 Stücke', [VORWAHL, BLOCK, PAAR1, PAAR2]],
  ] as const)(
    '[R-H-24] (e) Telefonnummer in %s, um 90° gedreht, lückenlos in Laufrichtung → rot «Telefonnummer», maskiert',
    async (_name, texte) => {
      const r = await scanneStuecke(reihe([...texte], { drehung: 90, x: 200, y: 40 }), [...texte]);
      erwarteTreffer(r, 'Telefonnummer', [ZIFFERN]);
    },
  );

  it('[R-H-24] Regel 2 (gleiche Laufrichtung): waagrechtes Stück, danach ein um 90° gedrehtes Stück mit Anfang am Ende des ersten → kein Treffer, grün (TR-E101-30-02)', async () => {
    const erstes = `${VORWAHL}${BLOCK}`;
    const zweites = `${PAAR1}${PAAR2}`;
    const r = await scanneStuecke(
      (breite) => [
        { text: erstes, x: 40, y: 150 },
        { text: zweites, x: 40 + breite(erstes, 0), y: 150, drehung: 90 },
      ],
      [erstes, zweites],
    );
    erwarteKeinTreffer(r);
  });

  // (f) Befundform Stundenachse: zweistellige Stunden im Abstand ≥ 2·s auf einer Grundlinie; heute ergeben
  // fünf aufeinanderfolgende Stunden ab 07 in beiden Seitenverkettungen eine Nummer.
  const STUNDEN = [7, 8, 9, 10, 11, 12].map((h) => String(h).padStart(2, '0'));
  it.each([
    ['Abstand 2·s', 2],
    ['Abstand 3·s', 3],
  ] as const)(
    '[R-H-24] (f) Nachbildung Stundenachse (zweistellige Stunden, %s, eine Grundlinie) → kein Treffer, grün',
    async (_name, luecke) => {
      const r = await scanneStuecke(reihe(STUNDEN, { luecke }), STUNDEN);
      erwarteKeinTreffer(r);
    },
  );

  // (f) Befundform Sonnenwerte: Uhrzeiten (Sonnenauf- und -untergang) in getrennten Zellen, daneben eine
  // Nummernspalte mit 1 und 2; heute ergibt die Verkettung zehn Ziffern mit führender 0.
  const AUFGANG = ['06', '45'].join('');
  const UNTERGANG = ['18', '30'].join('');
  const ZELLEN = [AUFGANG, UNTERGANG, '1', '2'];
  it.each([
    [
      'Zellen übereinander (Zeilenhöhe 1,5·s), Nummern in eigener Spalte',
      fest([
        { text: AUFGANG, x: 200, y: 150 },
        { text: UNTERGANG, x: 200, y: 150 - 1.5 * S },
        { text: '1', x: 300, y: 150 },
        { text: '2', x: 300, y: 150 - 1.5 * S },
      ]),
    ],
    ['Zellen nebeneinander (Abstand 2·s, eine Grundlinie)', reihe(ZELLEN, { luecke: 2 })],
  ] as const)(
    '[R-H-24] (f) Nachbildung Sonnenwerte: %s → kein Treffer, grün',
    async (_name, anordnung) => {
      const r = await scanneStuecke(anordnung, ZELLEN);
      erwarteKeinTreffer(r);
    },
  );

  it('[R-H-24] (g) Telefonnummer nur in den Metadaten (Title), Seitentext ohne Nummer → rot «Telefonnummer», maskiert', async () => {
    const r = await scanneStuecke(reihe(['Wochenplan', 'Kp']), ['Wochenplan', 'Kp'], {
      titel: NUMMER,
    });
    erwarteTreffer(r, 'Telefonnummer', [ZIFFERN]);
  });

  it('[R-H-24] Regel 5: AHV-Nummer in zwei Stücken, lückenlos → rot «AHV-Nummer», maskiert', async () => {
    const ahv = ahvNummer();
    const texte = [ahv.slice(0, 9), ahv.slice(9)];
    const r = await scanneStuecke(reihe(texte), texte);
    erwarteTreffer(r, 'AHV-Nummer', [ahv, ahv.slice(4)]);
  });

  it('[R-H-24] Regel 5: E-Mail-Adresse in zwei Stücken, lückenlos → rot «E-Mail-Adresse», Adresse nicht in der Ausgabe (TR-E101-30-04)', async () => {
    const adresse = ['fiktiv.person', 'beispiel.invalid'].join('@');
    const teil = adresse.indexOf('@') + 1;
    const texte = [adresse.slice(0, teil), adresse.slice(teil)];
    const r = await scanneStuecke(reihe(texte), texte);
    erwarteTreffer(r, 'E-Mail-Adresse', [adresse]);
  });
});

// Grenzwerte der Regel 2 in Vielfachen von s, je mit s = 6, 10 und 16 pt (TR-E101-30-01): Eine Umsetzung mit
// festen Schwellen in pt fällt bei mindestens einer Grösse durch.
describe.each([[6], [10], [16]] as const)(
  'deepPrivacyScan: Grenzwerte der Zeilenbildung bei s = %s pt (E1-01-30)',
  (s) => {
    it('[R-H-24] (b) Telefonnummer in 4 Stücken, Lücke 0,5·s (Grenzwert 0,6·s, innen) → rot «Telefonnummer», maskiert', async () => {
      const texte = [VORWAHL, BLOCK, PAAR1, PAAR2];
      const r = await scanneStuecke(reihe(texte, { luecke: 0.5 }), texte, { s });
      erwarteTreffer(r, 'Telefonnummer', [ZIFFERN]);
    });

    it('[R-H-24] (c) gleiche Ziffernteile in 4 Stücken, Lücke 0,7·s (Grenzwert 0,6·s, aussen) → kein Treffer, grün', async () => {
      const texte = [VORWAHL, BLOCK, PAAR1, PAAR2];
      const r = await scanneStuecke(reihe(texte, { luecke: 0.7 }), texte, { s });
      erwarteKeinTreffer(r);
    });

    it.each([
      ['0,15·s (Grenzwert 0,25·s, innen) → rot «Telefonnummer», maskiert', 0.15, true],
      ['0,35·s (Grenzwert 0,25·s, aussen) → kein Treffer, grün', 0.35, false],
    ] as const)(
      '[R-H-24] (b)/(d) Grundlinie: zwei Stücke, lückenlos, Querversatz %s',
      async (_name, quer, treffer) => {
        const texte = [`${VORWAHL}${BLOCK}`, `${PAAR1}${PAAR2}`];
        const r = await scanneStuecke(reihe(texte, { quer }), texte, { s });
        if (treffer) erwarteTreffer(r, 'Telefonnummer', [ZIFFERN]);
        else erwarteKeinTreffer(r);
      },
    );

    it.each([
      [
        'ohne Trennzeichen (Lücke 0,1·s ≤ 0,15·s)',
        [FIKTIVER_NAME.slice(0, 7), FIKTIVER_NAME.slice(7)],
        0.1,
      ],
      [
        'mit einem Leerzeichen (Wortabstand 0,25·s > 0,15·s)',
        (FIKTIVE_NAMEN[1] ?? '').split(' '),
        0.25,
      ],
    ] as const)(
      '[R-H-24] Regel 2/5: Name aus der Sperrliste in zwei Stücken, Fortsetzung %s → rot «Name aus der Sperrliste», Name nicht in der Ausgabe',
      async (_name, texte, luecke) => {
        const r = await scanneStuecke(reihe([...texte], { luecke }), [...texte], { s });
        erwarteTreffer(r, 'Name aus der Sperrliste', [texte.join('')]);
      },
    );
  },
);
