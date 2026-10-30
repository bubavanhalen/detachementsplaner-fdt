// Ebene-2-Prüfung der erzeugten PDF in der Schleuse (Schritt V5-ebene2; ADR-010 §3.2 V5, §7.2; R-H-19):
// checkPdfArtefakte prüft jedes PDF unter test-results/wap/pdf/ mit den Prüfhilfen auf Mindestschriftgrösse
// 4,5 pt (R-10-38) und eingebettete Schriften (R-10-36); pdfArtefakt legt erzeugte PDF dort ab.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 (checkPdfArtefakte, pdfArtefakt); Vertrag E1-01
// §9 Nr 8 (Ursache nennt höchstens 20 Dateien). Nur selbst erzeugte, fiktive Test-PDF.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pdfArtefakt } from '../wap/support/pdf/artefakt';
import {
  aufraeumen,
  KURZ,
  neueSandbox,
  node,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import { fontkit, LIBERATION_TTF, pdfArtefakteModul, testPdf } from './support/vertrag-b';

afterEach(aufraeumen);

/** Ordner mit PDF-Artefakten unter einer Sandbox (nicht im Worktree). */
function ordner(sb: Sandbox, name = 'pdf'): string {
  return join(sb.base, name);
}

/** Meldung des Fehlers eines (auch synchron werfenden) Aufrufs; null, wenn kein Fehler. */
async function fehlerVon(f: () => Promise<unknown>): Promise<string | null> {
  return Promise.resolve()
    .then(f)
    .then(
      () => null,
      (e: unknown) => (e instanceof Error ? e.message : String(e)),
    );
}

async function pruefe(opts: { cwd: string; ordner?: string; mindestPt?: number }) {
  const { checkPdfArtefakte } = await pdfArtefakteModul();
  return checkPdfArtefakte(opts);
}

describe('checkPdfArtefakte: leer, fehlend, grün', () => {
  it('[R-H-19] Ordner fehlt bzw. ist leer → grün, geprueft 0, Schritt V5-ebene2', async () => {
    const sb = neueSandbox();
    const fehlt = await pruefe({ cwd: sb.base, ordner: join(sb.base, 'gibt-es-nicht') });
    expect(fehlt.id).toBe('V5-ebene2');
    expect(fehlt.ok).toBe(true);
    expect(fehlt.geprueft).toBe(0);
    expect(fehlt.befunde).toEqual([]);
    const leer = join(sb.base, 'leer');
    writeText(leer, 'notiz.txt', 'kein PDF\n');
    const r = await pruefe({ cwd: sb.base, ordner: leer });
    expect(r.ok).toBe(true);
    expect(r.geprueft).toBe(0);
  });

  it('[R-H-19] Schrift genau 4,5 pt, eingebettet → grün; 4,4995 pt (innerhalb 0,001) → grün', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    writeText(o, 'genau.pdf', await testPdf({ groessePt: 4.5, eingebettet: true }));
    writeText(o, 'knapp.pdf', await testPdf({ groessePt: 4.4995, eingebettet: true }));
    const r = await pruefe({ cwd: sb.base, ordner: o });
    expect(r.ok, schrittText(r)).toBe(true);
    expect(r.geprueft).toBe(2);
    expect(r.befunde).toEqual([]);
  });

  it('[R-H-19] Standardordner <cwd>/test-results/wap/pdf, rekursiv; Prüfhilfen aus dem eigenen Checkout (cwd ohne tests/)', async () => {
    const sb = neueSandbox();
    const cwd = join(sb.base, 'projekt');
    writeText(
      cwd,
      'test-results/wap/pdf/a.pdf',
      await testPdf({ groessePt: 9, eingebettet: true }),
    );
    writeText(
      cwd,
      'test-results/wap/pdf/unter/tief/b.pdf',
      await testPdf({ groessePt: 4, eingebettet: true }),
    );
    expect(existsSync(join(cwd, 'tests'))).toBe(false);
    const r = await pruefe({ cwd });
    expect(r.geprueft).toBe(2);
    expect(r.ok).toBe(false);
    expect(r.befunde.map((b) => b.art)).toEqual(['schriftgroesse']);
    expect(r.befunde[0]?.datei).toContain('b.pdf');
  });

  it('[R-H-19] mindestPt 4 → 4-pt-Schrift grün', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    writeText(o, 'vier.pdf', await testPdf({ groessePt: 4, eingebettet: true }));
    const r = await pruefe({ cwd: sb.base, ordner: o, mindestPt: 4 });
    expect(r.ok, schrittText(r)).toBe(true);
  });
});

describe('checkPdfArtefakte: Befunde', () => {
  it('[R-H-19] 4 pt eingebettet → rot «Schrift unter Mindestgrösse 4,5 pt» mit Dateiname und kleinster Grösse', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    writeText(o, 'vier.pdf', await testPdf({ groessePt: 4, eingebettet: true }));
    const r = await pruefe({ cwd: sb.base, ordner: o });
    expect(r.id).toBe('V5-ebene2');
    expect(r.ok).toBe(false);
    expect(r.geprueft).toBe(1);
    expect(r.befunde).toHaveLength(1);
    expect(r.befunde[0]?.art).toBe('schriftgroesse');
    expect(r.befunde[0]?.datei).toContain('vier.pdf');
    // wert = kleinste Schriftgrösse (Zahl in pt, Komma oder Punkt).
    expect(Number.parseFloat((r.befunde[0]?.wert ?? '').replace(',', '.'))).toBeCloseTo(4, 3);
    expect(r.ursache ?? '').toContain('Schrift unter Mindestgrösse 4,5 pt');
    expect(r.ursache ?? '').toContain('vier.pdf');
    expect(r.ursache ?? '').toContain('kleinste 4');
    expect((r.naechsterSchritt ?? '').length).toBeGreaterThan(0);
  });

  it('[R-H-19] 4,498 pt (mehr als 0,001 unter 4,5) → rot', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    writeText(o, 'knapp-darunter.pdf', await testPdf({ groessePt: 4.498, eingebettet: true }));
    const r = await pruefe({ cwd: sb.base, ordner: o });
    expect(r.ok).toBe(false);
    expect(r.befunde.map((b) => b.art)).toEqual(['schriftgroesse']);
  });

  it('[R-H-19] nicht eingebettete Schrift (Helvetica, 12 pt) → rot, Befund nicht-eingebettet', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    writeText(o, 'standard.pdf', await testPdf({ groessePt: 12, eingebettet: false }));
    const r = await pruefe({ cwd: sb.base, ordner: o });
    expect(r.ok).toBe(false);
    expect(r.befunde.map((b) => b.art)).toEqual(['nicht-eingebettet']);
    expect(r.befunde[0]?.datei).toContain('standard.pdf');
    // wert nennt die nicht eingebettete Schrift (Schriftname, kein Text aus dem PDF).
    expect(r.befunde[0]?.wert ?? '').toContain('Helvetica');
    expect(r.ursache ?? '').toContain('standard.pdf');
  });

  it('[R-H-19] eine Datei mit 4 pt in nicht eingebetteter Schrift → zwei Befunde (schriftgroesse und nicht-eingebettet) zur selben Datei', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    writeText(o, 'doppelt.pdf', await testPdf({ groessePt: 4, eingebettet: false }));
    const r = await pruefe({ cwd: sb.base, ordner: o });
    expect(r.ok).toBe(false);
    expect(r.geprueft).toBe(1);
    expect(r.befunde.map((b) => b.art).sort()).toEqual(['nicht-eingebettet', 'schriftgroesse']);
    for (const b of r.befunde) {
      expect(b.datei).toContain('doppelt.pdf');
      expect(b.wert.length, b.art).toBeGreaterThan(0);
    }
  });

  it('[R-H-19] Teilmengen-Schrift (Name mit Präfix «ABCDEF+», eingebettet) gilt als eingebettet → grün', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    const doc = await PDFDocument.create();
    doc.registerFontkit((await fontkit()) as unknown as Parameters<typeof doc.registerFontkit>[0]);
    const f = await doc.embedFont(readFileSync(LIBERATION_TTF), {
      subset: false,
      customName: 'ABCDEF+Fiktivschrift',
    });
    doc.addPage([200, 200]).drawText('Teilmenge', { x: 10, y: 100, size: 9, font: f });
    writeText(o, 'teilmenge.pdf', await doc.save({ useObjectStreams: false }));
    const r = await pruefe({ cwd: sb.base, ordner: o });
    expect(r.ok, schrittText(r)).toBe(true);
    expect(r.geprueft).toBe(1);
    expect(r.befunde).toEqual([]);
  });

  it('[R-H-19] beschädigtes PDF → rot, Befund nicht-lesbar, kein Wurf', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    writeText(o, 'kaputt.pdf', '%PDF-1.7\nkein gültiger Inhalt\n');
    const r = await pruefe({ cwd: sb.base, ordner: o });
    expect(r.ok).toBe(false);
    expect(r.geprueft).toBe(1);
    expect(r.befunde.map((b) => b.art)).toEqual(['nicht-lesbar']);
    expect((r.befunde[0]?.wert ?? '').length).toBeGreaterThan(0);
    expect(r.ursache ?? '').toContain('kaputt.pdf');
  });

  it('[R-H-19] nie Text aus dem PDF in Ursache, nächstem Schritt, Details oder Befunden', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    const geheim = ['Quaxelbrunn', 'Vertraulich'].join(' ');
    writeText(o, 'geheim.pdf', await testPdf({ groessePt: 4, eingebettet: false, text: geheim }));
    const r = await pruefe({ cwd: sb.base, ordner: o });
    expect(r.ok).toBe(false);
    const alles = `${schrittText(r)}\n${JSON.stringify(r.befunde)}`;
    expect(alles).not.toContain('Quaxelbrunn');
    expect(alles).not.toContain('Vertraulich');
  });

  it('[R-H-19] 25 rote Dateien → Ursache nennt höchstens 20 Dateien und «… und 5 weitere»', async () => {
    const sb = neueSandbox();
    const o = ordner(sb);
    const bytes = await testPdf({ groessePt: 4, eingebettet: true });
    for (let i = 0; i < 25; i++) writeText(o, `rot-${String(i).padStart(2, '0')}.pdf`, bytes);
    const r = await pruefe({ cwd: sb.base, ordner: o });
    expect(r.ok).toBe(false);
    expect(r.geprueft).toBe(25);
    const genannt = (r.ursache ?? '').match(/rot-\d\d\.pdf/g) ?? [];
    expect(genannt.length).toBeGreaterThan(0);
    expect(genannt.length).toBeLessThanOrEqual(20);
    expect(r.ursache ?? '').toContain('und 5 weitere');
  });
});

describe('pdf-artefakte.mjs als CLI', () => {
  it(
    '[R-H-19] --root mit rotem PDF unter test-results/wap/pdf → Exit 1, Ausgabe nennt V5-ebene2; ohne PDF → Exit 0',
    async () => {
      const sb = neueSandbox();
      const cli = join(WT, 'scripts', 'wap-gate', 'pdf-artefakte.mjs');
      const leer = join(sb.base, 'leer');
      writeText(leer, 'README.md', '# leer\n');
      const gruen = node(cli, ['--root', leer], { cwd: leer, env: sb.env, timeout: KURZ });
      expect(gruen.status, gruen.out).toBe(0);
      const rotRoot = join(sb.base, 'rot');
      writeText(
        rotRoot,
        'test-results/wap/pdf/vier.pdf',
        await testPdf({ groessePt: 4, eingebettet: true }),
      );
      const rot = node(cli, ['--root', rotRoot], { cwd: sb.base, env: sb.env, timeout: KURZ });
      expect(rot.status).toBe(1);
      expect(rot.out).toContain('V5-ebene2');
      expect(rot.out).toContain('vier.pdf');
    },
    KURZ,
  );
});

describe('pdfArtefakt (Ablage erzeugter PDF für V5-ebene2)', () => {
  it('[R-H-19] mit WAP_PDF_ARTEFAKTE → schreibt <ordner>/<name>.pdf byte-gleich; derselbe Name ersetzt die Datei', async () => {
    const sb = neueSandbox();
    const o = ordner(sb, 'artefakte');
    writeText(o, '.platzhalter', '');
    vi.stubEnv('WAP_PDF_ARTEFAKTE', o);
    const a = await testPdf({ groessePt: 9, eingebettet: true });
    await pdfArtefakt('kvk-woche-1', a);
    expect(new Uint8Array(readFileSync(join(o, 'kvk-woche-1.pdf')))).toEqual(a);
    const b = await testPdf({ groessePt: 10, eingebettet: true });
    await pdfArtefakt('kvk-woche-1', b);
    expect(new Uint8Array(readFileSync(join(o, 'kvk-woche-1.pdf')))).toEqual(b);
    expect(readdirSync(o).sort()).toEqual(['.platzhalter', 'kvk-woche-1.pdf']);
  });

  it('[R-H-19] ohne WAP_PDF_ARTEFAKTE → tut nichts (auch nicht im Worktree)', async () => {
    vi.stubEnv('WAP_PDF_ARTEFAKTE', undefined);
    const name = `zz-ohne-variable-${String(process.pid)}`;
    await expect(pdfArtefakt(name, new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
    expect(existsSync(join(WT, 'test-results', 'wap', 'pdf', `${name}.pdf`))).toBe(false);
    expect(existsSync(join(process.cwd(), `${name}.pdf`))).toBe(false);
  });

  it('[R-H-19] ungültiger Name auch ohne WAP_PDF_ARTEFAKTE → «Ungültiger Artefaktname: <name>» (Notiz Runde 2 Nr 5)', async () => {
    vi.stubEnv('WAP_PDF_ARTEFAKTE', undefined);
    for (const name of ['Woche', '../ausserhalb', `a${'b'.repeat(80)}`]) {
      expect(await fehlerVon(() => pdfArtefakt(name, new Uint8Array([1]))), name).toBe(
        `Ungültiger Artefaktname: ${name}`,
      );
    }
  });

  it('[R-H-19] Name nach /^[a-z0-9][a-z0-9-]{0,79}$/: 80 Zeichen erlaubt; 81 Zeichen, Grossbuchstabe, Pfad oder führender Bindestrich → «Ungültiger Artefaktname: <name>»', async () => {
    const sb = neueSandbox();
    const o = ordner(sb, 'artefakte');
    writeText(o, '.platzhalter', '');
    vi.stubEnv('WAP_PDF_ARTEFAKTE', o);
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const achtzig = `a${'b'.repeat(79)}`;
    await pdfArtefakt(achtzig, bytes);
    expect(existsSync(join(o, `${achtzig}.pdf`))).toBe(true);
    for (const name of [`${achtzig}c`, 'Woche', '../ausserhalb', 'a/b', '-woche', '']) {
      expect(await fehlerVon(() => pdfArtefakt(name, bytes)), name).toBe(
        `Ungültiger Artefaktname: ${name}`,
      );
    }
    expect(readdirSync(o).sort()).toEqual(['.platzhalter', `${achtzig}.pdf`]);
    expect(existsSync(join(sb.base, 'ausserhalb.pdf'))).toBe(false);
  });
});
