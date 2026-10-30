// Gemeinsames Modul tools/wap/npm-lizenz.mjs (npmLizenz): Lizenztext eines gebündelten npm-Pakets aus seiner
// LICENSE* oder, nur ohne sie, aus einem geprüften Eintrag in tools/wap/licenses/npm-ersatz.json (Prompt §7
// Lizenzprüfung, ADR-010 §9, R-H-11, Q-031; Grundlage R-H-23, E1-01e). Fälle E1–E10 der Notiz Nr 10 und E11 (Rückfalldateien des
// Checkouts, Notiz Nr 8). Fiktive Mini-Repos unter os.tmpdir(); fiktive Pakete und Lizenztexte.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, «Änderungsnotiz Lizenzen ohne LICENSE-Datei» Nr 2–4, 8, 10.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ABSOLUTER_PFAD,
  ERSATZ_LISTE,
  type ErsatzEintrag,
  eintrag,
  FIKTIVE_HERKUNFT,
  fiktiverText,
  fiktivesPaket,
  INHALTSMARKE,
  LISTE_UNGUELTIG,
  type NpmLizenzErgebnis,
  npmLizenzModul,
  schreibeEintraege,
  schreibeListe,
  schreibeText,
} from './support/npm-lizenz';
import { aufraeumen, junction, neueSandbox, WT, writeText } from './support/umgebung';

afterEach(aufraeumen);

/** Fiktives Mini-Repo (kein Git nötig: npmLizenz liest nur Dateien). */
function miniCwd(name = 'repo'): string {
  const sb = neueSandbox();
  const cwd = join(sb.base, name);
  mkdirSync(cwd, { recursive: true });
  return cwd;
}

/** Ruft npmLizenz auf; ein Wurf ist ein Vertragsbruch («wirft nie», Notiz Nr 2) und wird als Assertion gemeldet. */
async function frage(cwd: string, paket: string, ordner: string): Promise<NpmLizenzErgebnis> {
  const { npmLizenz } = await npmLizenzModul();
  let r: NpmLizenzErgebnis | undefined;
  let wurf: unknown = null;
  try {
    r = npmLizenz({ cwd, paket, ordner });
  } catch (e) {
    wurf = e;
  }
  expect(wurf, 'npmLizenz hat geworfen').toBeNull();
  expect(r, 'npmLizenz ohne Ergebnis').toBeDefined();
  return r as NpmLizenzErgebnis;
}

/** Erwartet ok:false mit Art und (optional) genauer Meldung. */
function erwarteRot(
  r: NpmLizenzErgebnis,
  art: 'fehlt' | 'ersatz' | 'liste',
  fehler?: string,
): string {
  expect(r.ok, JSON.stringify(r)).toBe(false);
  if (r.ok) return '';
  expect(r.art).toBe(art);
  expect(typeof r.fehler).toBe('string');
  if (fehler !== undefined) expect(r.fehler).toBe(fehler);
  return r.fehler;
}

/** Gültiges Paket «fiktiv-paket» ohne LICENSE* mit gültigem Eintrag und Text; Abweichungen je Fall. */
function gueltigerFall(
  cwd: string,
  o: {
    paket?: string;
    pkg?: Record<string, unknown>;
    ohneLicenseFeld?: boolean;
    eintrag?: Partial<ErsatzEintrag>;
    text?: string | null;
    lizenzDateien?: Record<string, string>;
  } = {},
): { paket: string; ordner: string; textDatei: string | null } {
  const paket = o.paket ?? 'fiktiv-paket';
  const ordner = fiktivesPaket(cwd, paket, {
    pkg: o.pkg,
    ohneLicenseFeld: o.ohneLicenseFeld,
    lizenzDateien: o.lizenzDateien,
  });
  const e = eintrag(paket, o.eintrag);
  schreibeEintraege(cwd, [e]);
  const text = o.text === undefined ? fiktiverText(paket) : o.text;
  const textDatei =
    text === null ? null : schreibeText(cwd, `tools/wap/licenses/${paket}.txt`, text);
  return { paket, ordner, textDatei };
}

/** Pfadvergleich unter Windows (Gross/Klein, Trennzeichen). */
function gleicherPfad(a: string, b: string): boolean {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase();
}

describe('npmLizenz: Modul (Rot-Nachweis an Existenz und Typ)', () => {
  it('[R-H-11] tools/wap/npm-lizenz.mjs existiert und exportiert die Funktion npmLizenz', async () => {
    const m = await npmLizenzModul();
    expect(typeof m.npmLizenz).toBe('function');
  });
});

describe('E1: eigene LICENSE* geht einem Eintrag vor', () => {
  it('[R-H-11] E1 LICENSE im Paket und gültiger Eintrag → quelle paket, Text der LICENSE, Datei im Paketordner', async () => {
    const cwd = miniCwd();
    const lizenz = `MIT License\n\nFiktive Paketlizenz ${INHALTSMARKE}\n`;
    const { paket, ordner } = gueltigerFall(cwd, { lizenzDateien: { LICENSE: lizenz } });
    const r = await frage(cwd, paket, ordner);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.quelle).toBe('paket');
    expect(r.text).toBe(lizenz);
    expect(gleicherPfad(resolve(cwd, r.datei), join(ordner, 'LICENSE')), r.datei).toBe(true);
  });

  it('[R-H-11] E1 mehrere LICENSE*-Dateien → die alphabetisch erste (LICENSE vor LICENSE.md)', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, 'fiktiv-zwei', {
      lizenzDateien: { 'LICENSE.md': 'Zweite fiktive Lizenz\n', LICENSE: 'Erste fiktive Lizenz\n' },
    });
    const r = await frage(cwd, 'fiktiv-zwei', ordner);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.quelle).toBe('paket');
    expect(r.text).toBe('Erste fiktive Lizenz\n');
  });

  it('[R-H-11] E1 LICENSE.md bzw. licence.txt im Paket ohne Liste → quelle paket (Muster LICENSE*, auch «licence»)', async () => {
    for (const datei of ['LICENSE.md', 'licence.txt']) {
      const cwd = miniCwd();
      const ordner = fiktivesPaket(cwd, 'fiktiv-md', {
        lizenzDateien: { [datei]: `Text ${datei}\n` },
      });
      const r = await frage(cwd, 'fiktiv-md', ordner);
      expect(r.ok, `${datei}: ${JSON.stringify(r)}`).toBe(true);
      if (!r.ok) continue;
      expect(r.quelle).toBe('paket');
      expect(r.text).toBe(`Text ${datei}\n`);
    }
  });

  it('[R-H-11] E1 eigene LICENSE und kaputte Liste → quelle paket (die Liste wird nicht gelesen)', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, 'fiktiv-eigen', {
      lizenzDateien: { LICENSE: 'Eigene fiktive Lizenz\n' },
    });
    schreibeListe(cwd, '{ kaputt');
    const r = await frage(cwd, 'fiktiv-eigen', ordner);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.quelle).toBe('paket');
  });

  it('[R-H-11] E1 eigene LICENSE und package.json mit GPL-3.0 → quelle paket (Lizenzregeln gelten nur für Ersatz)', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, 'fiktiv-gpl-eigen', {
      pkg: { license: 'GPL-3.0' },
      lizenzDateien: { LICENSE: 'Fiktive GPL-Lizenz\n' },
    });
    const r = await frage(cwd, 'fiktiv-gpl-eigen', ordner);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.quelle).toBe('paket');
  });
});

describe('E2: ohne Liste bzw. ohne Eintrag → fehlt', () => {
  it('[R-H-11] E2 Paket ohne LICENSE*, tools/wap/licenses/ fehlt ganz → fehlt', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, 'fiktiv-ohne');
    erwarteRot(await frage(cwd, 'fiktiv-ohne', ordner), 'fehlt');
  });

  it('[R-H-11] E2 tools/wap/licenses/ vorhanden (fremde .txt, auch <paket>.txt), aber ohne npm-ersatz.json → fehlt (Auflage TR-E101-L04)', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, 'fiktiv-ohne');
    schreibeText(cwd, 'tools/wap/licenses/fiktiv-fremd.txt', fiktiverText('fiktiv-fremd'));
    schreibeText(cwd, 'tools/wap/licenses/fiktiv-ohne.txt', fiktiverText('fiktiv-ohne'));
    expect(existsSync(join(cwd, ...ERSATZ_LISTE.split('/')))).toBe(false);
    erwarteRot(await frage(cwd, 'fiktiv-ohne', ordner), 'fehlt');
  });

  it('[R-H-11] E2 Liste vorhanden, aber ohne Eintrag für das Paket → fehlt', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, 'fiktiv-ohne');
    schreibeEintraege(cwd, [eintrag('fiktiv-anderes')]);
    schreibeText(cwd, 'tools/wap/licenses/fiktiv-anderes.txt', fiktiverText('fiktiv-anderes'));
    erwarteRot(await frage(cwd, 'fiktiv-ohne', ordner), 'fehlt');
  });

  it('[R-H-11] E2 leere Liste (ersatz: []) → fehlt; Text-Datei mit Paketnamen allein genügt nicht', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, 'fiktiv-ohne');
    schreibeEintraege(cwd, []);
    schreibeText(cwd, 'tools/wap/licenses/fiktiv-ohne.txt', fiktiverText('fiktiv-ohne'));
    erwarteRot(await frage(cwd, 'fiktiv-ohne', ordner), 'fehlt');
  });

  it('[R-H-11] E2 Lesefehler: Paketordner fehlt, package.json fehlt bzw. kaputt → ok false, kein Wurf', async () => {
    const cwd = miniCwd();
    schreibeEintraege(cwd, [
      eintrag('fiktiv-weg'),
      eintrag('fiktiv-ohne-pj'),
      eintrag('fiktiv-kaputt-pj'),
    ]);
    for (const p of ['fiktiv-weg', 'fiktiv-ohne-pj', 'fiktiv-kaputt-pj']) {
      schreibeText(cwd, `tools/wap/licenses/${p}.txt`, fiktiverText(p));
    }
    const weg = await frage(cwd, 'fiktiv-weg', join(cwd, 'node_modules', 'fiktiv-weg'));
    expect(weg.ok).toBe(false);
    const ohnePj = fiktivesPaket(cwd, 'fiktiv-ohne-pj', { ohnePackageJson: true });
    expect((await frage(cwd, 'fiktiv-ohne-pj', ohnePj)).ok).toBe(false);
    const kaputtPj = fiktivesPaket(cwd, 'fiktiv-kaputt-pj', { packageJsonRoh: '{ "name": ' });
    expect((await frage(cwd, 'fiktiv-kaputt-pj', kaputtPj)).ok).toBe(false);
  });
});

describe('E3: gültiger Eintrag → ersatz', () => {
  it('[R-H-11] E3 gültig → ok, quelle ersatz, text gleich der Datei, datei = Ersatztext', async () => {
    const cwd = miniCwd();
    const { paket, ordner, textDatei } = gueltigerFall(cwd);
    const r = await frage(cwd, paket, ordner);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.quelle).toBe('ersatz');
    expect(r.text).toBe(readFileSync(textDatei as string, 'utf8'));
    expect(gleicherPfad(resolve(cwd, r.datei), textDatei as string), r.datei).toBe(true);
  });

  it.each([['MIT'], ['Apache-2.0'], ['BSD-2-Clause'], ['BSD-3-Clause'], ['ISC'], ['0BSD']])(
    '[R-H-11] E3 erlaubte Lizenz %s mit passendem Eintrag → ersatz',
    async (lizenz) => {
      const cwd = miniCwd();
      const { paket, ordner } = gueltigerFall(cwd, {
        pkg: { license: lizenz },
        eintrag: { lizenz },
      });
      const r = await frage(cwd, paket, ordner);
      expect(r.ok, JSON.stringify(r)).toBe(true);
      if (r.ok) expect(r.quelle).toBe('ersatz');
    },
  );

  it('[R-H-11] E3 Dateiname mit Punkt, Unterstrich, Bindestrich und Ziffer (Muster [a-z0-9][a-z0-9._-]*.txt) → ersatz', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, 'fiktiv-name');
    const datei = 'tools/wap/licenses/0fiktiv_name-1.2.txt';
    schreibeEintraege(cwd, [eintrag('fiktiv-name', { datei })]);
    schreibeText(cwd, datei, fiktiverText('fiktiv-name'));
    const r = await frage(cwd, 'fiktiv-name', ordner);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) expect(r.quelle).toBe('ersatz');
  });

  it('[R-H-11] E3 cwd ist eine Junction auf ein gültiges Mini-Repo → ersatz (realpath der Basis tools/wap/licenses, Auflage TR-E101-L02)', async () => {
    const echt = miniCwd('echt');
    gueltigerFall(echt);
    const cwd = join(dirname(echt), 'verknuepft');
    junction(cwd, echt);
    const r = await frage(cwd, 'fiktiv-paket', join(cwd, 'node_modules', 'fiktiv-paket'));
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.quelle).toBe('ersatz');
    expect(r.text).toBe(fiktiverText('fiktiv-paket'));
  });

  it('[R-H-11] E3 Paket mit Scope (@fiktiv/teil) → ersatz', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, '@fiktiv/teil');
    schreibeEintraege(cwd, [
      eintrag('@fiktiv/teil', { datei: 'tools/wap/licenses/fiktiv-teil.txt' }),
    ]);
    schreibeText(cwd, 'tools/wap/licenses/fiktiv-teil.txt', fiktiverText('@fiktiv/teil'));
    const r = await frage(cwd, '@fiktiv/teil', ordner);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) expect(r.quelle).toBe('ersatz');
  });
});

describe('E4: Lizenz nicht erlaubt für Ersatztext', () => {
  it.each([
    ['GPL-3.0', { license: 'GPL-3.0' }, false, 'GPL-3.0', 'GPL-3.0'],
    ['ohne license', {}, true, 'MIT', 'ohne Angabe'],
    [
      'Ausdruck MIT OR GPL-3.0',
      { license: 'MIT OR GPL-3.0' },
      false,
      'MIT OR GPL-3.0',
      'MIT OR GPL-3.0',
    ],
    ['Ausdruck (MIT)', { license: '(MIT)' }, false, '(MIT)', '(MIT)'],
    ['licenses-Array', { licenses: [{ type: 'MIT', url: 'fiktiv' }] }, true, 'MIT', 'ohne Angabe'],
    ['OFL-1.1', { license: 'OFL-1.1' }, false, 'OFL-1.1', 'OFL-1.1'],
    ['Kleinschreibung mit', { license: 'mit' }, false, 'mit', 'mit'],
  ] as const)(
    '[R-H-11] E4 %s → ersatz «Lizenz nicht erlaubt für Ersatztext»',
    async (_fall, pkg, ohneLicenseFeld, lizenz, anzeige) => {
      const cwd = miniCwd();
      const { paket, ordner } = gueltigerFall(cwd, {
        pkg: { ...pkg },
        ohneLicenseFeld,
        eintrag: { lizenz },
      });
      erwarteRot(
        await frage(cwd, paket, ordner),
        'ersatz',
        `Lizenz nicht erlaubt für Ersatztext: ${paket} (${anzeige})`,
      );
    },
  );

  it('[R-H-11] E4 license als Objekt ({ type: MIT }) → nicht erlaubt (keine Zeichenkette)', async () => {
    const cwd = miniCwd();
    const { paket, ordner } = gueltigerFall(cwd, { pkg: { license: { type: 'MIT' } } });
    const f = erwarteRot(await frage(cwd, paket, ordner), 'ersatz');
    expect(f.startsWith(`Lizenz nicht erlaubt für Ersatztext: ${paket} (`), f).toBe(true);
  });
});

describe('E5: Lizenz ungleich', () => {
  it('[R-H-11] E5 package.json MIT, Eintrag Apache-2.0 → «Ersatz-Lizenz passt nicht»', async () => {
    const cwd = miniCwd();
    const { paket, ordner } = gueltigerFall(cwd, { eintrag: { lizenz: 'Apache-2.0' } });
    erwarteRot(
      await frage(cwd, paket, ordner),
      'ersatz',
      `Ersatz-Lizenz passt nicht: ${paket} (package.json MIT, Eintrag Apache-2.0)`,
    );
  });

  it('[R-H-11] E5 package.json ISC, Eintrag MIT → «Ersatz-Lizenz passt nicht»', async () => {
    const cwd = miniCwd();
    const { paket, ordner } = gueltigerFall(cwd, { pkg: { license: 'ISC' } });
    erwarteRot(
      await frage(cwd, paket, ordner),
      'ersatz',
      `Ersatz-Lizenz passt nicht: ${paket} (package.json ISC, Eintrag MIT)`,
    );
  });
});

describe('E6: Version ungleich', () => {
  it.each([
    ['1.0.1', '1.0.0'],
    ['2.0.0', '1.0.0'],
    ['1.0.0', '^1.0.0'],
  ])(
    '[R-H-11] E6 installiert %s, Eintrag %s → «Ersatz-Lizenz für andere Version»',
    async (installiert, imEintrag) => {
      const cwd = miniCwd();
      const { paket, ordner } = gueltigerFall(cwd, {
        pkg: { version: installiert },
        eintrag: { version: imEintrag },
      });
      erwarteRot(
        await frage(cwd, paket, ordner),
        'ersatz',
        `Ersatz-Lizenz für andere Version: ${paket} (installiert ${installiert}, Eintrag ${imEintrag})`,
      );
    },
  );
});

describe('E7: Ersatz-Lizenztext fehlt (Ort und Inhalt der Datei)', () => {
  const FEHLT = 'Ersatz-Lizenztext fehlt: fiktiv-paket';

  it('[R-H-11] E7 Datei fehlt → «Ersatz-Lizenztext fehlt»', async () => {
    const cwd = miniCwd();
    const { paket, ordner } = gueltigerFall(cwd, { text: null });
    erwarteRot(await frage(cwd, paket, ordner), 'ersatz', FEHLT);
  });

  it('[R-H-11] E7 Datei leer (0 Bytes) → «Ersatz-Lizenztext fehlt»', async () => {
    const cwd = miniCwd();
    const { paket, ordner } = gueltigerFall(cwd, { text: '' });
    erwarteRot(await frage(cwd, paket, ordner), 'ersatz', FEHLT);
  });

  it('[R-H-11] E7 Datei unter reference/ (mit Herkunftsvermerk) → «Ersatz-Lizenztext fehlt»', async () => {
    const cwd = miniCwd();
    const { paket, ordner } = gueltigerFall(cwd, {
      eintrag: { datei: 'reference/fiktiv-paket.txt' },
    });
    writeText(cwd, 'reference/fiktiv-paket.txt', fiktiverText(paket));
    erwarteRot(await frage(cwd, paket, ordner), 'ersatz', FEHLT);
  });

  it('[R-H-11] E7 tools/wap/licenses/../x.txt (Datei vorhanden) → «Ersatz-Lizenztext fehlt»', async () => {
    const cwd = miniCwd();
    const { paket, ordner } = gueltigerFall(cwd, {
      eintrag: { datei: 'tools/wap/licenses/../fiktiv-x.txt' },
    });
    writeText(cwd, 'tools/wap/fiktiv-x.txt', fiktiverText(paket));
    erwarteRot(await frage(cwd, paket, ordner), 'ersatz', FEHLT);
  });

  it('[R-H-11] E7 Unterordner, Grossbuchstabe, andere Endung, Backslash, absoluter Pfad (Dateien vorhanden) → «Ersatz-Lizenztext fehlt»', async () => {
    const cwd = miniCwd();
    const faelle: [string, string][] = [
      ['tools/wap/licenses/unter/fiktiv.txt', 'tools/wap/licenses/unter/fiktiv.txt'],
      ['tools/wap/licenses/Fiktiv.txt', 'tools/wap/licenses/Fiktiv.txt'],
      ['tools/wap/licenses/fiktiv.md', 'tools/wap/licenses/fiktiv.md'],
      ['tools\\wap\\licenses\\fiktiv-bs.txt', 'tools/wap/licenses/fiktiv-bs.txt'],
      [
        join(cwd, 'tools', 'wap', 'licenses', 'fiktiv-abs.txt'),
        'tools/wap/licenses/fiktiv-abs.txt',
      ],
    ];
    const ordner = fiktivesPaket(cwd, 'fiktiv-paket');
    for (const [datei, ort] of faelle) {
      schreibeEintraege(cwd, [eintrag('fiktiv-paket', { datei })]);
      writeText(cwd, ort, fiktiverText('fiktiv-paket'));
      erwarteRot(await frage(cwd, 'fiktiv-paket', ordner), 'ersatz', FEHLT);
    }
  });

  it('[R-H-11] E7 Junction aus licenses/ nach reference/ (Ordner und als *.txt benannt) → «Ersatz-Lizenztext fehlt»', async () => {
    const cwd = miniCwd();
    const ordner = fiktivesPaket(cwd, 'fiktiv-paket');
    writeText(cwd, 'reference/fiktiv-paket.txt', fiktiverText('fiktiv-paket'));
    mkdirSync(join(cwd, 'tools', 'wap', 'licenses'), { recursive: true });
    junction(join(cwd, 'tools', 'wap', 'licenses', 'fremd'), join(cwd, 'reference'));
    junction(join(cwd, 'tools', 'wap', 'licenses', 'fremd.txt'), join(cwd, 'reference'));
    expect(existsSync(join(cwd, 'tools', 'wap', 'licenses', 'fremd', 'fiktiv-paket.txt'))).toBe(
      true,
    );
    for (const datei of [
      'tools/wap/licenses/fremd/fiktiv-paket.txt',
      'tools/wap/licenses/fremd.txt',
    ]) {
      schreibeEintraege(cwd, [eintrag('fiktiv-paket', { datei })]);
      erwarteRot(await frage(cwd, 'fiktiv-paket', ordner), 'ersatz', FEHLT);
    }
  });
});

describe('E8: Herkunftsvermerk', () => {
  it('[R-H-11] E8 Text ohne den herkunft des Eintrags → «Ersatz-Lizenztext ohne Herkunftsvermerk»', async () => {
    const cwd = miniCwd();
    const { paket, ordner } = gueltigerFall(cwd, { text: fiktiverText('fiktiv-paket', null) });
    erwarteRot(
      await frage(cwd, paket, ordner),
      'ersatz',
      `Ersatz-Lizenztext ohne Herkunftsvermerk: ${paket}`,
    );
  });

  it('[R-H-11] E8 Vermerk nur in anderer Gross-/Kleinschreibung → ohne Herkunftsvermerk (wörtlich)', async () => {
    const cwd = miniCwd();
    const { paket, ordner } = gueltigerFall(cwd, {
      text: fiktiverText('fiktiv-paket', FIKTIVE_HERKUNFT.toUpperCase()),
    });
    erwarteRot(
      await frage(cwd, paket, ordner),
      'ersatz',
      `Ersatz-Lizenztext ohne Herkunftsvermerk: ${paket}`,
    );
  });

  it('[R-H-11] E8 Gegenprobe: eigener herkunft des Eintrags im Text (nicht der Vermerk der Rückfalldateien) → ersatz', async () => {
    const cwd = miniCwd();
    const herkunft = 'fiktive Herkunft 0700 Variante B';
    const { paket, ordner } = gueltigerFall(cwd, {
      eintrag: { herkunft },
      text: fiktiverText('fiktiv-paket', herkunft),
    });
    const r = await frage(cwd, paket, ordner);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });
});

describe('E9: Liste ungültig', () => {
  /** Gültiger Eintrag des gefragten Pakets plus Mangel; der Text liegt vor. */
  function listenFall(cwd: string, liste: unknown): { ordner: string } {
    const ordner = fiktivesPaket(cwd, 'fiktiv-paket');
    schreibeText(cwd, 'tools/wap/licenses/fiktiv-paket.txt', fiktiverText('fiktiv-paket'));
    schreibeText(cwd, 'tools/wap/licenses/fiktiv-b.txt', fiktiverText('fiktiv-b'));
    schreibeListe(cwd, liste);
    return { ordner };
  }
  const gut = eintrag('fiktiv-paket');
  const b = eintrag('fiktiv-b');
  const ohne = (feld: keyof ErsatzEintrag) => {
    const kopie: Record<string, string> = { ...b };
    delete kopie[feld];
    return kopie;
  };

  it.each([
    ['kaputtes JSON', '{ "version": 1, "ersatz": [ '],
    ['leere Datei', ''],
    ['version 2', { version: 2, ersatz: [gut] }],
    ['version "1" als Zeichenkette', { version: '1', ersatz: [gut] }],
    ['ohne version', { ersatz: [gut] }],
    ['ersatz kein Array', { version: 1, ersatz: { 'fiktiv-paket': gut } }],
    ['Wurzel ist ein Array', [gut]],
    [
      'Feld leer im anderen Eintrag (entscheid "")',
      { version: 1, ersatz: [gut, { ...b, entscheid: '' }] },
    ],
    [
      'Feld leer im gefragten Eintrag (herkunft "")',
      { version: 1, ersatz: [{ ...gut, herkunft: '' }] },
    ],
    ['Feld fehlt im anderen Eintrag (herkunft)', { version: 1, ersatz: [gut, ohne('herkunft')] }],
    ['Feld fehlt im anderen Eintrag (entscheid)', { version: 1, ersatz: [gut, ohne('entscheid')] }],
    [
      'Feld falsch typisiert (version als Zahl)',
      { version: 1, ersatz: [gut, { ...b, version: 1 }] },
    ],
    ['Feld falsch typisiert (datei null)', { version: 1, ersatz: [gut, { ...b, datei: null }] }],
    ['Eintrag kein Objekt', { version: 1, ersatz: [gut, 'fiktiv-b'] }],
    ['Paket doppelt (anderes Paket)', { version: 1, ersatz: [gut, b, { ...b }] }],
    ['Paket doppelt (gefragtes Paket)', { version: 1, ersatz: [gut, { ...gut }] }],
  ] as const)('[R-H-11] E9 %s → liste «Ersatz-Lizenzliste ungültig»', async (_fall, liste) => {
    const cwd = miniCwd();
    const { ordner } = listenFall(cwd, liste);
    erwarteRot(await frage(cwd, 'fiktiv-paket', ordner), 'liste', LISTE_UNGUELTIG);
  });

  it('[R-H-11] E9 Gegenprobe: zwei gültige Einträge verschiedener Pakete → ersatz für das gefragte', async () => {
    const cwd = miniCwd();
    const { ordner } = listenFall(cwd, { version: 1, ersatz: [b, gut] });
    const r = await frage(cwd, 'fiktiv-paket', ordner);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) expect(r.quelle).toBe('ersatz');
  });
});

describe('E10: Meldungen ohne absolute Pfade und ohne Textinhalt', () => {
  it('[R-H-11] E10 alle roten Fälle: fehler ohne absoluten Pfad, ohne Sandbox-Pfad und ohne Inhaltsmarke; Pfade nur repo-relativ', async () => {
    const meldungen: { fall: string; cwd: string; fehler: string }[] = [];
    const sammle = async (fall: string, cwd: string, paket: string, ordner: string) => {
      const r = await frage(cwd, paket, ordner);
      expect(r.ok, `${fall}: ${JSON.stringify(r)}`).toBe(false);
      if (!r.ok) meldungen.push({ fall, cwd, fehler: r.fehler });
    };
    {
      const cwd = miniCwd();
      await sammle('fehlt', cwd, 'fiktiv-ohne', fiktivesPaket(cwd, 'fiktiv-ohne'));
    }
    {
      const cwd = miniCwd();
      const f = gueltigerFall(cwd, { pkg: { license: 'GPL-3.0' }, eintrag: { lizenz: 'GPL-3.0' } });
      await sammle('nicht erlaubt', cwd, f.paket, f.ordner);
    }
    {
      const cwd = miniCwd();
      const f = gueltigerFall(cwd, { eintrag: { lizenz: 'ISC' } });
      await sammle('passt nicht', cwd, f.paket, f.ordner);
    }
    {
      const cwd = miniCwd();
      const f = gueltigerFall(cwd, { eintrag: { version: '9.9.9' } });
      await sammle('Version', cwd, f.paket, f.ordner);
    }
    {
      const cwd = miniCwd();
      const f = gueltigerFall(cwd, { eintrag: { datei: 'reference/fiktiv-paket.txt' } });
      writeText(cwd, 'reference/fiktiv-paket.txt', fiktiverText('fiktiv-paket'));
      await sammle('Text fehlt', cwd, f.paket, f.ordner);
    }
    {
      const cwd = miniCwd();
      const f = gueltigerFall(cwd, { text: fiktiverText('fiktiv-paket', null) });
      await sammle('ohne Herkunft', cwd, f.paket, f.ordner);
    }
    {
      const cwd = miniCwd();
      const ordner = fiktivesPaket(cwd, 'fiktiv-paket');
      schreibeListe(cwd, `{ "version": 1, "ersatz": "${INHALTSMARKE}`);
      await sammle('Liste', cwd, 'fiktiv-paket', ordner);
    }
    {
      const cwd = miniCwd();
      await sammle('Lesefehler', cwd, 'fiktiv-weg', join(cwd, 'node_modules', 'fiktiv-weg'));
    }
    expect(meldungen).toHaveLength(8);
    for (const { fall, cwd, fehler } of meldungen) {
      expect(fehler.trim().length, fall).toBeGreaterThan(0);
      expect(fehler, fall).not.toContain(INHALTSMARKE);
      expect(fehler, fall).not.toMatch(ABSOLUTER_PFAD);
      expect(fehler.toLowerCase(), fall).not.toContain(cwd.toLowerCase());
      expect(fehler.toLowerCase(), fall).not.toContain(cwd.replace(/\\/g, '/').toLowerCase());
      expect(fehler, fall).not.toContain('\\');
    }
    const liste = meldungen.find((m) => m.fall === 'Liste');
    expect(liste?.fehler).toBe(LISTE_UNGUELTIG);
    expect(LISTE_UNGUELTIG).toContain(ERSATZ_LISTE);
  });
});

describe('E11: Rückfalldateien des Checkouts (Notiz Nr 8)', () => {
  it('[R-H-11] E11 brotli, dfa und fontkit aus node_modules dieses Checkouts → ersatz; Texte LF, ohne BOM, ohne E-Mail-Adresse, mit Herkunftsvermerk', async () => {
    const { npmLizenz } = await npmLizenzModul();
    const liste = JSON.parse(readFileSync(join(WT, ...ERSATZ_LISTE.split('/')), 'utf8')) as {
      version: number;
      ersatz: ErsatzEintrag[];
    };
    expect(liste.version).toBe(1);
    const at = ['@'].join('');
    const mail = new RegExp(`[A-Za-z0-9._%+-]+${at}[A-Za-z0-9.-]+\\.[A-Za-z]{2,}`);
    // MIT-Standardtext: Zeilen 5–21 von node_modules/restructure/LICENSE (Notiz Nr 8), Leerraum normalisiert.
    const restructure = readFileSync(join(WT, 'node_modules', 'restructure', 'LICENSE'), 'utf8')
      .replace(/\r\n/g, '\n')
      .split('\n');
    const mitStandard = leerraumNormalisiert(restructure.slice(4, 21).join('\n'));
    expect(mitStandard.startsWith('Permission is hereby granted')).toBe(true);
    for (const paket of ['brotli', 'dfa', 'fontkit']) {
      const ordner = join(WT, 'node_modules', paket);
      const pkg = JSON.parse(readFileSync(join(ordner, 'package.json'), 'utf8')) as {
        version: string;
        license: string;
        author?: unknown;
      };
      const e = liste.ersatz.find((x) => x.paket === paket);
      expect(e, `Eintrag fehlt: ${paket}`).toBeDefined();
      expect(e?.version).toBe(pkg.version);
      expect(e?.lizenz).toBe(pkg.license);
      expect(e?.datei).toBe(`tools/wap/licenses/${paket}.txt`);
      const r = npmLizenz({ cwd: WT, paket, ordner });
      expect(r.ok, `${paket}: ${JSON.stringify(r.ok ? r.quelle : r.fehler)}`).toBe(true);
      if (!r.ok) continue;
      expect(r.quelle).toBe('ersatz');
      const roh = readFileSync(join(WT, 'tools', 'wap', 'licenses', `${paket}.txt`));
      expect(roh.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), `${paket}: BOM`).toBe(
        false,
      );
      const text = roh.toString('utf8');
      expect(text.includes('\r'), `${paket}: CR`).toBe(false);
      expect(mail.test(text), `${paket}: E-Mail-Adresse im Text`).toBe(false);
      expect(text).toContain(e?.herkunft ?? '');
      // Auflage TR-E101-L01: Lizenzüberschrift, Copyright-Zeile mit dem Autor aus package.json (Name vor «<»
      // bzw. author.name, getrimmt; kein Name im Testcode) und vollständiger MIT-Standardtext.
      expect(text, `${paket}: «MIT License»`).toContain('MIT License');
      const autor = autorName(pkg.author);
      expect(autor.length, `${paket}: author in package.json`).toBeGreaterThan(0);
      expect(
        new RegExp(`^Copyright \\(c\\) .*${regexText(autor)}\\s*$`, 'm').test(text),
        `${paket}: Copyright-Zeile mit Autor aus package.json`,
      ).toBe(true);
      expect(leerraumNormalisiert(text), `${paket}: MIT-Standardtext`).toContain(mitStandard);
    }
  });
});

/** Autor aus package.json: Zeichenkette (Teil vor «<», getrimmt) oder Objekt mit name. */
function autorName(author: unknown): string {
  if (typeof author === 'string') return (author.split('<')[0] ?? '').trim();
  if (author !== null && typeof author === 'object') {
    const name = (author as { name?: unknown }).name;
    if (typeof name === 'string') return name.trim();
  }
  return '';
}

/** Text als wörtliches Regex-Muster. */
function regexText(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Jeder Leerraum (auch Zeilenumbrüche) als ein Leerzeichen, Rand entfernt. */
function leerraumNormalisiert(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
