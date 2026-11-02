// @vitest-environment jsdom
// Paket E1-02c: PDF deterministisch (R-L-01; Leitplanke 4; Vertrag E1-02c §2.3 Nr 6–7, §5; Präzisierungen P-6,
// P-8; Änderungsnotiz Vertragsprüfung V12). Gleiche Eingabe → gleiche Bytes: zweimal im Prozess, unter anderer
// Uhrzeit und anderem Zufall, in anderen Zeitzonen im Prozess und in zwei Kindprozessen (America/New_York,
// Asia/Tokyo). Feste Metadaten: nur Title, Producer, Creator; kein Datum, keine /ID, kein XMP, keine
// Objektströme. Der Edge-Teil steht in tests/wap-e2e/render/pdf-edge.spec.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writePdf } from '../../../../src/io/wap-pdf/writer';
import { BEISPIEL_TITEL, beispielSeiten } from '../../pdf/writer/support/beispiel';
import { codepunkteVon, erwarteterPraefix } from '../../pdf/writer/support/praefix';
import {
  anzahlName,
  baseFonts,
  infoSchluessel,
  latin1,
  sha256,
  trailer,
} from '../../pdf/writer/support/roh';
import { pdfMitArtefakt } from '../../pdf/writer/support/schreiben';
import { zuJson } from '../../pdf/writer/support/seite-json';
import { lauf, seite, zeile } from '../../pdf/writer/support/seiten';
import { readPdf } from '../../support/pdf/read';
import { pdfImKindprozess } from './support/kindprozess';

const ZEITZONE_VORHER = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (ZEITZONE_VORHER === undefined) delete process.env.TZ;
  else process.env.TZ = ZEITZONE_VORHER;
});

/** Versatz am 15.01.2026 1200 UTC in Minuten (America/New_York 300, Asia/Tokyo −540). */
function versatzJanuar(): number {
  return new Date(Date.UTC(2026, 0, 15, 12)).getTimezoneOffset();
}

async function beispielPdf(): Promise<Uint8Array> {
  return writePdf({ pages: beispielSeiten(), title: BEISPIEL_TITEL });
}

describe('writePdf: gleiche Eingabe, gleiche Bytes (Vertrag §2.3 Nr 7)', () => {
  it('[R-L-01] zweimal im selben Prozess: SHA-256 gleich, auch mit neu gebauten Objekten gleichen Inhalts', async () => {
    const a = await pdfMitArtefakt('det-beispiel', beispielSeiten(), BEISPIEL_TITEL);
    const b = await beispielPdf();
    const c = await writePdf({ pages: structuredClone(beispielSeiten()), title: BEISPIEL_TITEL });
    expect(await sha256(b)).toBe(await sha256(a));
    expect(await sha256(c)).toBe(await sha256(a));
    expect(b).toEqual(a);
  });

  it('[R-L-01] keine Uhr, kein Zufall: andere Systemzeit und anderes Math.random ergeben dieselben Bytes', async () => {
    const basis = await sha256(await beispielPdf());
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 5, 7, 0, 0)));
    const morgen = await sha256(await beispielPdf());
    vi.setSystemTime(new Date(Date.UTC(1999, 11, 31, 23, 59, 59)));
    const frueher = await sha256(await beispielPdf());
    vi.useRealTimers();
    const zufall = vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    const z1 = await sha256(await beispielPdf());
    zufall.mockReturnValue(0.987654);
    const z2 = await sha256(await beispielPdf());
    expect([morgen, frueher, z1, z2]).toEqual([basis, basis, basis, basis]);
  });

  it('[R-L-01] Zeitzonen im Prozess: America/New_York und Asia/Tokyo ergeben dieselben Bytes', async () => {
    process.env.TZ = 'America/New_York';
    expect(versatzJanuar()).toBe(300);
    const ny = await sha256(await beispielPdf());
    process.env.TZ = 'Asia/Tokyo';
    expect(versatzJanuar()).toBe(-540);
    const tokio = await sha256(await beispielPdf());
    process.env.TZ = 'UTC';
    const utc = await sha256(await beispielPdf());
    expect(tokio).toBe(ny);
    expect(utc).toBe(ny);
  });

  it('[R-L-01] zwei Prozesse in America/New_York und Asia/Tokyo: SHA-256 gleich wie im Testprozess', async () => {
    const hier = await sha256(await beispielPdf());
    const seiten = beispielSeiten().map(zuJson);
    const [ny, tokio] = await Promise.all([
      pdfImKindprozess(seiten, BEISPIEL_TITEL, 'America/New_York'),
      pdfImKindprozess(seiten, BEISPIEL_TITEL, 'Asia/Tokyo'),
    ]);
    expect(ny).toMatchObject({ ok: true, zeitzone: 'America/New_York', versatzJanuar: 300 });
    expect(tokio).toMatchObject({ ok: true, zeitzone: 'Asia/Tokyo', versatzJanuar: -540 });
    expect(ny.ok && ny.sha256).toBe(hier);
    expect(tokio.ok && tokio.sha256).toBe(hier);
  }, 180_000);
});

describe('writePdf: feste Metadaten und Speicherform (Vertrag §2.3 Nr 7, P-8)', () => {
  it('[R-L-01] Info-Wörterbuch nur Title, Producer, Creator; Title = input.title, Producer und Creator «WAP-Planer»', async () => {
    const bytes = await pdfMitArtefakt('det-metadaten', beispielSeiten(), BEISPIEL_TITEL);
    expect(infoSchluessel(bytes)).toEqual(['Creator', 'Producer', 'Title']);
    const info = await readPdf(bytes);
    expect(info.metadata.Title).toBe(BEISPIEL_TITEL);
    expect(info.metadata.Producer).toBe('WAP-Planer');
    expect(info.metadata.Creator).toBe('WAP-Planer');
  });

  it('[R-L-01] kein CreationDate, kein ModDate, keine /ID, kein XMP, keine Objektströme; klassische xref-Tabelle', async () => {
    const bytes = await beispielPdf();
    const text = latin1(bytes);
    expect(anzahlName(bytes, 'CreationDate')).toBe(0);
    expect(anzahlName(bytes, 'ModDate')).toBe(0);
    expect(trailer(bytes)).not.toMatch(/\/ID\b/);
    expect(anzahlName(bytes, 'ID')).toBe(0);
    expect(anzahlName(bytes, 'Metadata')).toBe(0);
    expect(text.includes('xmpmeta')).toBe(false);
    expect(text.includes('xpacket')).toBe(false);
    expect(anzahlName(bytes, 'ObjStm')).toBe(0);
    expect(anzahlName(bytes, 'XRefStm')).toBe(0);
    expect(anzahlName(bytes, 'XRef')).toBe(0);
    expect(/\nxref\r?\n/.test(text)).toBe(true);
    expect(trailer(bytes)).toMatch(/\/Info\s+\d+\s+0\s+R/);
  });
});

describe('writePdf: Schriftname hängt nur von der Zeichenmenge ab (Vertrag §2.3 Nr 6, P-6, V12)', () => {
  function name(bytes: Uint8Array, schnitt: 'Arimo' | 'Arimo-Bold'): string[] {
    return [...new Set(baseFonts(bytes).filter((n) => n.slice(7) === schnitt))];
  }

  it('[R-L-01] gleiche Zeichenmenge in anderer Reihenfolge und Anzahl → gleicher Name; andere Menge → anderer Name', async () => {
    const a = await pdfMitArtefakt('det-name-a', [
      seite([zeile({ x: 50, baselineY: 50, runs: [lauf('Abc abc')] })]),
    ]);
    const b = await pdfMitArtefakt('det-name-b', [
      seite([
        zeile({ x: 50, baselineY: 50, runs: [lauf('cba')] }),
        zeile({ x: 50, baselineY: 70, runs: [lauf(' AAbbcc')] }),
      ]),
    ]);
    const c = await pdfMitArtefakt('det-name-c', [
      seite([zeile({ x: 50, baselineY: 50, runs: [lauf('Abd abd')] })]),
    ]);
    expect(name(a, 'Arimo')).toHaveLength(1);
    expect(name(b, 'Arimo')).toEqual(name(a, 'Arimo'));
    expect(name(c, 'Arimo')).toHaveLength(1);
    expect(name(c, 'Arimo')).not.toEqual(name(a, 'Arimo'));
    expect(name(a, 'Arimo')).toEqual([`${erwarteterPraefix(codepunkteVon(['Abc abc']))}+Arimo`]);
    expect(name(c, 'Arimo')).toEqual([`${erwarteterPraefix(codepunkteVon(['Abd abd']))}+Arimo`]);
  });

  it('[R-L-01] der Name eines Schnitts hängt nicht vom anderen Schnitt ab', async () => {
    const nurFett = await pdfMitArtefakt('det-name-fett', [
      seite([zeile({ x: 50, baselineY: 50, runs: [lauf('KVK', { weight: 'bold' })] })]),
    ]);
    const gemischt = await pdfMitArtefakt('det-name-gemischt', [
      seite([
        zeile({ x: 50, baselineY: 50, runs: [lauf('Übung '), lauf('KVK', { weight: 'bold' })] }),
      ]),
    ]);
    expect(name(gemischt, 'Arimo-Bold')).toEqual(name(nurFett, 'Arimo-Bold'));
    expect(name(nurFett, 'Arimo-Bold')).toEqual([
      `${erwarteterPraefix(codepunkteVon(['KVK']))}+Arimo-Bold`,
    ]);
  });
});
