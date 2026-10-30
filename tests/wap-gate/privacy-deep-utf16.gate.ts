// Paket F-TOOLS Runde 2 (Koordinator 20.10.2026, SA-2-04): CR-E101-P07 – ein NUL-Byte schaltet den Inhaltsscan
// von privacy-deep.mjs nicht mehr ab (R-H-24). UTF-16 mit und ohne BOM (LE, BE) wird dekodiert, andere Dateien mit
// NUL werden mit NUL als Leerzeichen geprüft; nur bekannte Binärformate nach Endung bleiben aussen vor.
// Fiktive Daten (AHV-Nummer aus support/umgebung, fiktiver Sperrlisten-Name) in temporären Ordnern.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ahvNummer,
  aufraeumen,
  FIKTIVER_NAME,
  neueSandbox,
  neuesRepo,
  prozessUmgebung,
  schrittText,
  writeText,
} from './support/umgebung';
import { privacyDeep } from './support/vertrag';

afterEach(aufraeumen);

function utf16le(text: string, bom = false): Buffer {
  const b = Buffer.from(text, 'utf16le');
  return bom ? Buffer.concat([Buffer.from([0xff, 0xfe]), b]) : b;
}

function utf16be(text: string, bom = false): Buffer {
  const b = Buffer.from(text, 'utf16le');
  b.swap16();
  return bom ? Buffer.concat([Buffer.from([0xfe, 0xff]), b]) : b;
}

async function scanDatei(rel: string, inhalt: Uint8Array) {
  const sb = neueSandbox();
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'utf16');
  writeText(root, rel, inhalt);
  const { deepPrivacyScan } = await privacyDeep();
  return deepPrivacyScan({ cwd: root, pfade: [join(root, 'test-results', 'wap')] });
}

describe('deepPrivacyScan: Textdateien mit NUL-Byte (CR-E101-P07)', () => {
  it.each([
    ['UTF-16 LE ohne BOM', utf16le(`Kontakt ${ahvNummer()}\n`)],
    ['UTF-16 LE mit BOM', utf16le(`Kontakt ${ahvNummer()}\n`, true)],
    ['UTF-16 BE ohne BOM', utf16be(`Kontakt ${ahvNummer()}\n`)],
    ['UTF-16 BE mit BOM', utf16be(`Kontakt ${ahvNummer()}\n`, true)],
    [
      'Text mit einzelnem NUL-Byte',
      Buffer.concat([Buffer.from('Kopf'), Buffer.from([0]), Buffer.from(` ${ahvNummer()}\n`)]),
    ],
  ])(
    '[R-H-24] %s mit fiktiver AHV-Nummer unter test-results/wap → rot, Datei genannt, Nummer maskiert',
    async (_fall, inhalt) => {
      const r = await scanDatei('test-results/wap/export/notiz.txt', inhalt);
      expect(r.ok).toBe(false);
      const text = schrittText(r);
      expect(text).toContain('test-results/wap/export/notiz.txt');
      expect(text).toContain('AHV');
      expect(text).not.toContain(ahvNummer());
    },
  );

  it('[R-H-24] UTF-16 LE ohne BOM mit fiktivem Sperrlisten-Namen → rot', async () => {
    const r = await scanDatei(
      'test-results/wap/export/liste.csv',
      utf16le(`Name;${FIKTIVER_NAME}\n`),
    );
    expect(r.ok).toBe(false);
    expect(schrittText(r).toLowerCase()).not.toContain(FIKTIVER_NAME.toLowerCase());
  });

  it('[R-H-24] UTF-16 ohne Personendaten → grün; bekanntes Binärformat (.png) mit NUL bleibt ungeprüft', async () => {
    expect(
      (await scanDatei('test-results/wap/export/leer.txt', utf16le('Nur fiktiver Text\n'))).ok,
    ).toBe(true);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]),
      utf16le('ohne Befund'),
    ]);
    expect((await scanDatei('test-results/wap/golden/bild.png', png)).ok).toBe(true);
  });
});
