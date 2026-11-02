// Datenschutz-Scan über Inhalte von Containern und erzeugten Artefakten (ADR-010 §10, F3/V11):
// .xlsx/.docx entpackt, .pdf per pdfjs-dist ausgelesen; Ausgabe maskiert.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (deepPrivacyScan).
// Fiktive Inhalte: AHV-Nummer zur Laufzeit gebildet, fiktiver Sperrlisten-Name aus der Test-Sperrliste.
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ahvNummer,
  aufraeumen,
  commitAlles,
  FIKTIVER_NAME,
  git,
  neueSandbox,
  neuesRepo,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { privacyDeep } from './support/vertrag';

afterEach(aufraeumen);

function xlsx(text: string): Uint8Array {
  const shared = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>${text}</t></si></sst>`;
  const sheet =
    '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>';
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    ),
    'xl/sharedStrings.xml': strToU8(shared),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  });
}

function docx(text: string): Uint8Array {
  const dokument = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    ),
    'word/document.xml': strToU8(dokument),
  });
}

async function pdf(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([300, 200]).drawText(text, { x: 20, y: 100, size: 10, font });
  return doc.save();
}

function repo(sb: Sandbox): string {
  prozessUmgebung(sb);
  return neuesRepo(sb, 'tief');
}

async function scan(opts: { cwd: string; staged?: boolean; pfade?: string[] }) {
  const { deepPrivacyScan } = await privacyDeep();
  return deepPrivacyScan(opts);
}

function maskiert(text: string): void {
  expect(text).not.toContain(ahvNummer());
  expect(text).not.toContain(ahvNummer().slice(4));
  expect(text.toLowerCase()).not.toContain(FIKTIVER_NAME.toLowerCase());
}

describe('deepPrivacyScan --staged (F3)', () => {
  it('[R-H-24] gestagte .xlsx-Fixture ohne Personendaten → grün', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'tests/wap/fixtures/sauber.xlsx', xlsx('Hptm Muster A'));
    git(sb, root, 'add', 'tests/wap/fixtures/sauber.xlsx');
    const r = await scan({ cwd: root, staged: true });
    expect(r.ok).toBe(true);
  });

  it('[R-H-24] AHV-Nummer in einer gestagten .xlsx-Fixture (sharedStrings) → rot, Pfad genannt, Nummer maskiert', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'tests/wap/fixtures/personen.xlsx', xlsx(`Nummer ${ahvNummer()}`));
    git(sb, root, 'add', 'tests/wap/fixtures/personen.xlsx');
    const r = await scan({ cwd: root, staged: true });
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('tests/wap/fixtures/personen.xlsx');
    maskiert(schrittText(r));
  });

  it('[R-H-24] fiktiver Sperrlisten-Name in einer gestagten .docx → rot, Name nicht in der Ausgabe', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'tests/wap/fixtures/brief.docx', docx(`Ansprechperson ${FIKTIVER_NAME}`));
    git(sb, root, 'add', 'tests/wap/fixtures/brief.docx');
    const r = await scan({ cwd: root, staged: true });
    expect(r.ok).toBe(false);
    maskiert(schrittText(r));
  });

  it('[R-H-24] AHV-Nummer in einer gestagten .pdf (komprimierter Inhaltsstrom) → rot, maskiert', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'tests/wap/fixtures/plan.pdf', await pdf(`AHV ${ahvNummer()}`));
    git(sb, root, 'add', 'tests/wap/fixtures/plan.pdf');
    const r = await scan({ cwd: root, staged: true });
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('tests/wap/fixtures/plan.pdf');
    maskiert(schrittText(r));
  });

  it('[R-H-24] Container mit Treffer nur im Arbeitsbaum (nicht gestagt) → staged grün; committeter sauberer Stand → grün', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'tests/wap/fixtures/sauber.xlsx', xlsx('sauber'));
    commitAlles(sb, root, 'Sauber');
    writeText(root, 'tests/wap/fixtures/neu.xlsx', xlsx(`Nummer ${ahvNummer()}`));
    const r = await scan({ cwd: root, staged: true });
    expect(r.ok).toBe(true);
  });
});

describe('deepPrivacyScan über Pfade (V11, erzeugte Artefakte)', () => {
  it('[R-H-24] AHV-Nummer in einem erzeugten PDF unter test-results/wap → rot, maskiert', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'test-results/wap/pdf/woche-1.pdf', await pdf(`Kontakt ${ahvNummer()}`));
    writeText(root, 'test-results/wap/pdf/woche-2.pdf', await pdf('Hptm Muster A'));
    const r = await scan({ cwd: root, pfade: [join(root, 'test-results', 'wap')] });
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('woche-1.pdf');
    expect(schrittText(r)).not.toContain('woche-2.pdf');
    maskiert(schrittText(r));
  });

  it('[R-H-24] fiktiver Sperrlisten-Name in einer erzeugten Plan-Datei (.xlsx) → rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'test-results/wap/export/liste.xlsx', xlsx(FIKTIVER_NAME));
    const r = await scan({ cwd: root, pfade: [join(root, 'test-results', 'wap')] });
    expect(r.ok).toBe(false);
    maskiert(schrittText(r));
  });

  it('[R-H-24] erzeugte Artefakte ohne Personendaten → grün', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'test-results/wap/pdf/woche-1.pdf', await pdf('Hptm Muster A, 0700-1200'));
    writeText(root, 'test-results/wap/export/liste.xlsx', xlsx('Oblt Beispiel B'));
    const r = await scan({ cwd: root, pfade: [join(root, 'test-results', 'wap')] });
    expect(r.ok).toBe(true);
  });

  it('[R-H-24] genannter Pfad existiert nicht → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const r = await scan({ cwd: root, pfade: [join(root, 'test-results', 'gibt-es-nicht')] });
    expect(r.ok).toBe(false);
    expect((r.ursache ?? '').length).toBeGreaterThan(0);
  });

  it('[R-H-24] beschädigtes PDF → rot (nicht prüfbar), nie still grün', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'test-results/wap/pdf/kaputt.pdf', '%PDF-1.7\nkein gültiges PDF');
    const r = await scan({ cwd: root, pfade: [join(root, 'test-results', 'wap')] });
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('nicht prüfbar');
  });

  it.each([['xlsx'], ['docx']])(
    '[R-H-24] beschädigte .%s (kein gültiges ZIP) → rot «nicht prüfbar» (Vertrag §9 Nr 14)',
    async (endung) => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, `test-results/wap/export/kaputt.${endung}`, 'PK kein gültiges Archiv');
      const r = await scan({ cwd: root, pfade: [join(root, 'test-results', 'wap')] });
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('nicht prüfbar');
    },
  );
});
