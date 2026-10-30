// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): übernommen aus dem Entwurf von
// E1-01d/E1-01e (Vertrag E1-01, Änderungsnotiz AE-001 §3), geprüft und an die Umsetzung angepasst.

// Lizenzprüfung (ADR-010 §9): F10 checkLicenses (Kriterium 1: neue Abhängigkeiten nur MIT, Apache-2.0,
// BSD, ISC, 0BSD; Schriften OFL) und V10-lizenztexte checkBundledLicenses (Kriterium 2: Lizenztexte aller
// gebündelten Laufzeit-Abhängigkeiten und Schriften in der Einzeldatei).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (checkLicenses, checkBundledLicenses), §6d (1)–(11).
// Fiktive Pakete und eine fiktive Schrift in temporären Ordnern; Fall (11) baut im Klon des
// Arbeitsstands (das dist/ des Paket-Worktrees bleibt unberührt).
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  commitAlles,
  git,
  neueSandbox,
  neuesRepo,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { license } from './support/vertrag';

afterEach(aufraeumen);

// ---------------------------------------------------------------------------------------------
// F10 checkLicenses
// ---------------------------------------------------------------------------------------------

interface Paket {
  version: string;
  license: string;
  dev?: boolean;
}

function lockDatei(pakete: Record<string, Paket>): string {
  const packages: Record<string, unknown> = {
    '': { name: 'lizenz-test', version: '1.0.0' },
  };
  for (const [name, p] of Object.entries(pakete)) {
    packages[`node_modules/${name}`] = {
      version: p.version,
      resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1) ?? name}-${p.version}.tgz`,
      integrity: 'sha512-AAAA',
      license: p.license,
      ...(p.dev ? { dev: true } : {}),
    };
  }
  return `${JSON.stringify({ name: 'lizenz-test', version: '1.0.0', lockfileVersion: 3, requires: true, packages }, null, 2)}\n`;
}

function setzePakete(root: string, pakete: Record<string, Paket>): void {
  writeText(root, 'package-lock.json', lockDatei(pakete));
  for (const [name, p] of Object.entries(pakete)) {
    writeText(
      root,
      `node_modules/${name}/package.json`,
      `${JSON.stringify({ name, version: p.version, license: p.license })}\n`,
    );
  }
}

const ASSETS_LEER = `${JSON.stringify({ version: 1, assets: [], ausnahmen: [] }, null, 2)}\n`;

/** Repo: main mit einem bestehenden GPL-Paket (Suite-Bestand), Zweig wap/x für die Änderungen. */
function lizenzRepo(sb: Sandbox): { root: string; basis: string } {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'lizenz', 'main');
  writeText(root, '.gitignore', 'test-results\n');
  setzePakete(root, { 'alt-gpl': { version: '1.0.0', license: 'GPL-3.0-only' } });
  writeText(root, 'scripts/wap-gate/license-assets.json', ASSETS_LEER);
  const basis = commitAlles(sb, root, 'Suite-Bestand');
  git(sb, root, 'checkout', '-q', '-b', 'wap/x');
  return { root, basis };
}

async function pruefeF10(root: string, basis: string) {
  const { checkLicenses } = await license();
  return checkLicenses({ cwd: root, basis });
}

describe('checkLicenses (F10)', () => {
  it.each([
    ['MIT'],
    ['Apache-2.0'],
    ['BSD-2-Clause'],
    ['BSD-3-Clause'],
    ['ISC'],
    ['0BSD'],
    ['(MIT OR GPL-3.0-only)'],
  ])(
    '[R-H-23] neue Abhängigkeit mit Lizenz %s → grün; bestehendes GPL-Paket der Suite nicht bewertet',
    async (lizenz) => {
      const sb = neueSandbox();
      const { root, basis } = lizenzRepo(sb);
      setzePakete(root, {
        'alt-gpl': { version: '1.0.0', license: 'GPL-3.0-only' },
        'neu-paket': { version: '2.0.0', license: lizenz, dev: true },
      });
      commitAlles(sb, root, 'Neu');
      const r = await pruefeF10(root, basis);
      expect(r.ok).toBe(true);
    },
  );

  it.each([['GPL-3.0-only'], ['MPL-2.0'], ['(GPL-3.0-only AND MIT)'], ['UNLICENSED']])(
    '[R-H-23] neue Abhängigkeit mit unzulässiger Lizenz %s → rot mit Paketnamen',
    async (lizenz) => {
      const sb = neueSandbox();
      const { root, basis } = lizenzRepo(sb);
      setzePakete(root, {
        'alt-gpl': { version: '1.0.0', license: 'GPL-3.0-only' },
        'neu-paket': { version: '2.0.0', license: lizenz, dev: true },
      });
      commitAlles(sb, root, 'Neu');
      const r = await pruefeF10(root, basis);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('neu-paket');
    },
  );

  it('[R-H-23] bestehendes Suite-Paket mit geänderter Version und unzulässiger Lizenz → rot', async () => {
    const sb = neueSandbox();
    const { root, basis } = lizenzRepo(sb);
    setzePakete(root, { 'alt-gpl': { version: '1.1.0', license: 'GPL-3.0-only' } });
    commitAlles(sb, root, 'Version');
    const r = await pruefeF10(root, basis);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('alt-gpl');
  });

  it('[R-H-23] transitive neue Abhängigkeit (Scope-Paket) mit unzulässiger Lizenz → rot', async () => {
    const sb = neueSandbox();
    const { root, basis } = lizenzRepo(sb);
    setzePakete(root, {
      'alt-gpl': { version: '1.0.0', license: 'GPL-3.0-only' },
      'neu-paket': { version: '2.0.0', license: 'MIT' },
      '@fiktiv/tief': { version: '0.1.0', license: 'AGPL-3.0-only' },
    });
    commitAlles(sb, root, 'Transitiv');
    const r = await pruefeF10(root, basis);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('@fiktiv/tief');
  });

  it('[R-H-23] Schrift in license-assets.json mit OFL-1.1 → grün, mit anderer Lizenz → rot', async () => {
    const sb = neueSandbox();
    const { root, basis } = lizenzRepo(sb);
    const asset = (lizenz: string) =>
      `${JSON.stringify({ version: 1, assets: [{ name: 'Fiktivschrift', lizenz, dateien: ['src/assets/fiktiv/Fiktiv.ttf'], lizenztext: 'src/assets/fiktiv/OFL.txt' }], ausnahmen: [] }, null, 2)}\n`;
    writeText(root, 'src/assets/fiktiv/Fiktiv.ttf', 'fiktive Schriftbytes');
    writeText(root, 'src/assets/fiktiv/OFL.txt', 'Fiktive Open-Font-Lizenz\n');
    writeText(root, 'scripts/wap-gate/license-assets.json', asset('OFL-1.1'));
    commitAlles(sb, root, 'Schrift OFL');
    expect((await pruefeF10(root, basis)).ok).toBe(true);
    writeText(root, 'scripts/wap-gate/license-assets.json', asset('LicenseRef-Proprietaer'));
    commitAlles(sb, root, 'Schrift proprietär');
    const r = await pruefeF10(root, basis);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('Fiktivschrift');
  });

  it('[R-H-23] package-lock.json fehlt → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const { root, basis } = lizenzRepo(sb);
    git(sb, root, 'rm', '-q', 'package-lock.json');
    commitAlles(sb, root, 'Ohne Lock');
    const r = await pruefeF10(root, basis);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('package-lock.json');
  });

  it('[R-H-23] license-assets.json fehlt → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const { root, basis } = lizenzRepo(sb);
    git(sb, root, 'rm', '-q', 'scripts/wap-gate/license-assets.json');
    commitAlles(sb, root, 'Ohne Assets');
    const r = await pruefeF10(root, basis);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('license-assets.json');
  });
});

// ---------------------------------------------------------------------------------------------
// V10-lizenztexte checkBundledLicenses (§6d)
// ---------------------------------------------------------------------------------------------

const APP_LIZENZ = 'Fiktive Lizenz der Anwendung\nZweite Zeile der App-Lizenz\n';
const LIZENZ_A = 'Fiktive Lizenz A\nErlaubt alles Fiktive.\nLetzte Zeile A\n';
const LIZENZ_B = 'Fiktive Lizenz B (Markdown)\n\nText B.\n';
const OFL = 'Fiktive Open Font License\nfür die Fiktivschrift\n';

interface Bundle {
  root: string;
  modulIds: string[];
}

function block(name: string, text: string): string {
  return `${name}\n${text}`;
}

function template(bloecke: string[]): string {
  const text = bloecke.join('\n\n').replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return `<template id="application-licenses"><pre>${text}</pre></template>`;
}

function html(bloecke: string[] | null): string {
  const t = bloecke === null ? '' : template(bloecke);
  return `<!doctype html><html lang="de-CH" data-offline="true"><head><title>Fiktiv</title></head><body><div id="root"></div>${t}</body></html>`;
}

function schreibeDist(root: string, index: string, offline: string | null): void {
  writeText(root, 'dist/index.html', index);
  if (offline === null) rmSync(join(root, 'dist', 'offline.html'), { force: true });
  else writeText(root, 'dist/offline.html', offline);
}

const ALLE = [
  block('WK Util Suite', APP_LIZENZ),
  block('@fiktiv/b', LIZENZ_B),
  block('Fiktivschrift', OFL),
  block('fiktiv-a', LIZENZ_A),
];

function bundleOrdner(sb: Sandbox, bloecke: string[] = ALLE): Bundle {
  prozessUmgebung(sb);
  const root = join(sb.base, 'bundle');
  writeText(root, 'LICENSE', APP_LIZENZ);
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'fiktiv-app', private: true, dependencies: { 'fiktiv-a': '1.0.0', '@fiktiv/b': '1.0.0', 'fiktiv-c': '1.0.0' } }, null, 2)}\n`,
  );
  writeText(
    root,
    'node_modules/fiktiv-a/package.json',
    '{"name":"fiktiv-a","version":"1.0.0","license":"MIT"}\n',
  );
  writeText(root, 'node_modules/fiktiv-a/LICENSE', LIZENZ_A);
  writeText(root, 'node_modules/fiktiv-a/index.js', 'export const a = 1;\n');
  writeText(
    root,
    'node_modules/@fiktiv/b/package.json',
    '{"name":"@fiktiv/b","version":"1.0.0","license":"MIT"}\n',
  );
  writeText(root, 'node_modules/@fiktiv/b/LICENSE.md', LIZENZ_B);
  writeText(root, 'node_modules/@fiktiv/b/dist/x.js', 'export const b = 1;\n');
  writeText(
    root,
    'node_modules/fiktiv-c/package.json',
    '{"name":"fiktiv-c","version":"1.0.0","license":"MIT"}\n',
  );
  writeText(root, 'node_modules/fiktiv-c/LICENSE', 'Fiktive Lizenz C\n');
  writeText(root, 'node_modules/fiktiv-c/index.js', 'export const c = 1;\n');
  writeText(root, 'src/main.tsx', 'export const main = 1;\n');
  writeText(root, 'src/assets/fiktiv/Fiktiv.ttf', 'fiktive Schriftbytes');
  writeText(root, 'src/assets/fiktiv/OFL.txt', OFL);
  writeText(
    root,
    'scripts/wap-gate/license-assets.json',
    `${JSON.stringify(
      {
        version: 1,
        assets: [
          {
            name: 'Fiktivschrift',
            lizenz: 'OFL-1.1',
            dateien: ['src/assets/fiktiv/Fiktiv.ttf'],
            lizenztext: 'src/assets/fiktiv/OFL.txt',
          },
        ],
        ausnahmen: [],
      },
      null,
      2,
    )}\n`,
  );
  schreibeDist(root, html(bloecke), html(bloecke));
  const modulIds = [
    join(root, 'src', 'main.tsx'),
    join(root, 'node_modules', 'fiktiv-a', 'index.js'),
    join(root, 'node_modules', '@fiktiv', 'b', 'dist', 'x.js'),
  ];
  return { root, modulIds };
}

async function pruefeV10(b: Bundle, distDir?: string) {
  const { checkBundledLicenses } = await license();
  return checkBundledLicenses({
    cwd: b.root,
    modulIds: b.modulIds,
    ...(distDir ? { distDir } : {}),
  });
}

function normPfad(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('checkBundledLicenses (V10-lizenztexte, §6d)', () => {
  it('[R-H-23] (1) App, zwei Pakete und Schrift im Template → grün, erwartet = 4 Einträge mit Quelle und Lizenzdatei, fehlend leer', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(sb);
    const r = await pruefeV10(b);
    expect(r.ok).toBe(true);
    expect(r.fehlend).toEqual([]);
    const erwartet = [...r.erwartet].sort((x, y) => (x.name < y.name ? -1 : 1));
    expect(erwartet.map((e) => [e.name, e.quelle])).toEqual([
      ['@fiktiv/b', 'npm'],
      ['Fiktivschrift', 'asset'],
      ['WK Util Suite', 'app'],
      ['fiktiv-a', 'npm'],
    ]);
    const datei = (n: string) => normPfad(erwartet.find((e) => e.name === n)?.lizenzdatei ?? '');
    expect(datei('WK Util Suite').endsWith('LICENSE')).toBe(true);
    expect(datei('fiktiv-a').endsWith('node_modules/fiktiv-a/LICENSE')).toBe(true);
    expect(datei('@fiktiv/b').endsWith('node_modules/@fiktiv/b/LICENSE.md')).toBe(true);
    expect(datei('Fiktivschrift').endsWith('src/assets/fiktiv/OFL.txt')).toBe(true);
  });

  it('[R-H-23] (2) Block von @fiktiv/b entfernt → rot, fehlend = [@fiktiv/b], Ursache nennt den Namen und die Anzahl', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(
      sb,
      ALLE.filter((x) => !x.startsWith('@fiktiv/b')),
    );
    const r = await pruefeV10(b);
    expect(r.ok).toBe(false);
    expect(r.fehlend).toEqual(['@fiktiv/b']);
    expect(r.ursache ?? '').toContain('@fiktiv/b');
    expect(r.ursache ?? '').toMatch(/(?<![0-9])1(?![0-9])/);
    expect(r.naechsterSchritt ?? '').toContain('tools/build-offline.mjs');
  });

  it('[R-H-23] (3) OFL-Block der Schrift entfernt → rot, fehlend = [Fiktivschrift]', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(
      sb,
      ALLE.filter((x) => !x.startsWith('Fiktivschrift')),
    );
    const r = await pruefeV10(b);
    expect(r.ok).toBe(false);
    expect(r.fehlend).toEqual(['Fiktivschrift']);
  });

  it.each([
    ['eine Zeile geändert', LIZENZ_A.replace('Erlaubt alles Fiktive.', 'Erlaubt fast alles.')],
    ['letzte Zeile entfernt', LIZENZ_A.replace('Letzte Zeile A\n', '')],
  ])('[R-H-23] (4) Text von fiktiv-a: %s → rot', async (_n, text) => {
    const sb = neueSandbox();
    const b = bundleOrdner(
      sb,
      ALLE.map((x) => (x.startsWith('fiktiv-a') ? block('fiktiv-a', text) : x)),
    );
    const r = await pruefeV10(b);
    expect(r.ok).toBe(false);
    expect(r.fehlend).toEqual(['fiktiv-a']);
  });

  it('[R-H-23] (5) Template fehlt → rot; Template doppelt → rot', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(sb);
    schreibeDist(b.root, html(null), html(null));
    expect((await pruefeV10(b)).ok).toBe(false);
    const doppelt = html(ALLE).replace('</body>', `${template(ALLE)}</body>`);
    schreibeDist(b.root, doppelt, doppelt);
    expect((await pruefeV10(b)).ok).toBe(false);
  });

  it('[R-H-23] (6) offline.html mit abweichendem Template → rot; offline.html fehlt → rot «zuerst npm run build»', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(sb);
    schreibeDist(b.root, html(ALLE), html([...ALLE, block('zusatz', 'Zusatztext\n')]));
    expect((await pruefeV10(b)).ok).toBe(false);
    schreibeDist(b.root, html(ALLE), null);
    const r = await pruefeV10(b);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('zuerst npm run build');
  });

  it('[R-H-23] distDir ohne index.html → rot «zuerst npm run build»', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(sb);
    const leer = join(sb.base, 'leer-dist');
    writeText(leer, 'platzhalter.txt', 'x\n');
    const r = await pruefeV10(b, leer);
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('zuerst npm run build');
  });

  it('[R-H-23] (7) Paket im Graph ohne Lizenzdatei (nur README.md) → rot «Lizenzdatei fehlt im Paket …»', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(sb);
    writeText(
      b.root,
      'node_modules/fiktiv-ohne/package.json',
      '{"name":"fiktiv-ohne","version":"1.0.0","license":"MIT"}\n',
    );
    writeText(b.root, 'node_modules/fiktiv-ohne/README.md', 'Nur eine Beschreibung\n');
    writeText(b.root, 'node_modules/fiktiv-ohne/i.js', 'export const o = 1;\n');
    b.modulIds.push(join(b.root, 'node_modules', 'fiktiv-ohne', 'i.js'));
    const r = await pruefeV10(b);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Lizenzdatei fehlt im Paket fiktiv-ohne');
  });

  it('[R-H-23] (8) Paket in node_modules und dependencies, aber nicht im Graph → nicht erwartet, grün ohne seinen Text', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(sb);
    const r = await pruefeV10(b);
    expect(r.ok).toBe(true);
    expect(r.erwartet.map((e) => e.name)).not.toContain('fiktiv-c');
  });

  it('[R-H-23] zusätzlicher Block im Template (nicht mehr gebündeltes Paket) → kein Fehler', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(sb, [...ALLE, block('fiktiv-c', 'Fiktive Lizenz C\n')]);
    const r = await pruefeV10(b);
    expect(r.ok).toBe(true);
  });

  it('[R-H-23] (9) Schrift-Dateien weder vorhanden noch im Graph → nicht erwartet, grün; Schrift vorhanden, lizenztext fehlt → rot', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(
      sb,
      ALLE.filter((x) => !x.startsWith('Fiktivschrift')),
    );
    rmSync(join(b.root, 'src', 'assets', 'fiktiv', 'Fiktiv.ttf'));
    const gruen = await pruefeV10(b);
    expect(gruen.ok).toBe(true);
    expect(gruen.erwartet.map((e) => e.name)).not.toContain('Fiktivschrift');
    writeText(b.root, 'src/assets/fiktiv/Fiktiv.ttf', 'fiktive Schriftbytes');
    rmSync(join(b.root, 'src', 'assets', 'fiktiv', 'OFL.txt'));
    const rot = await pruefeV10(b);
    expect(rot.ok).toBe(false);
    expect(schrittText(rot)).toContain('Fiktivschrift');
  });

  it('[R-H-23] Schrift nur im Modulgraphen (Modul-ID mit ?-Zusatz) → erwartet', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(sb);
    rmSync(join(b.root, 'src', 'assets', 'fiktiv', 'Fiktiv.ttf'));
    b.modulIds.push(`${join(b.root, 'src', 'assets', 'fiktiv', 'Fiktiv.ttf')}?url`);
    const r = await pruefeV10(b);
    expect(r.erwartet.map((e) => e.name)).toContain('Fiktivschrift');
    expect(r.ok).toBe(true);
  });

  it('[R-H-23] (10) Lizenztext mit <, & und CRLF, im Template maskiert und mit LF → grün; Paketname aus Windows-Modul-ID mit verschachteltem node_modules', async () => {
    const sb = neueSandbox();
    const roh = 'Fiktive Lizenz D <frei> & offen\r\nZweite Zeile   \r\n';
    const b = bundleOrdner(sb, [
      ...ALLE,
      block('fiktiv-d', 'Fiktive Lizenz D <frei> & offen\nZweite Zeile\n'),
    ]);
    writeText(
      b.root,
      'node_modules/x/node_modules/fiktiv-d/package.json',
      '{"name":"fiktiv-d","version":"1.0.0","license":"MIT"}\n',
    );
    writeText(b.root, 'node_modules/x/node_modules/fiktiv-d/LICENSE', roh);
    writeText(
      b.root,
      'node_modules/fiktiv-d/package.json',
      '{"name":"fiktiv-d","version":"1.0.0","license":"MIT"}\n',
    );
    writeText(b.root, 'node_modules/fiktiv-d/LICENSE', roh);
    writeText(b.root, 'node_modules/x/node_modules/fiktiv-d/i.js', 'export const d = 1;\n');
    b.modulIds.push(`${b.root}\\node_modules\\x\\node_modules\\fiktiv-d\\i.js`);
    const r = await pruefeV10(b);
    expect(r.erwartet.map((e) => e.name)).toContain('fiktiv-d');
    expect(r.erwartet.map((e) => e.name)).not.toContain('x');
    expect(r.fehlend).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('[R-H-23] license-assets.json fehlt bzw. ungültig → rot', async () => {
    const sb = neueSandbox();
    const b = bundleOrdner(sb);
    writeText(b.root, 'scripts/wap-gate/license-assets.json', '{ ungültig');
    expect((await pruefeV10(b)).ok).toBe(false);
    rmSync(join(b.root, 'scripts', 'wap-gate', 'license-assets.json'));
    expect((await pruefeV10(b)).ok).toBe(false);
  });
});

describe('checkLicenses: Ausnahmen mit Gate-Entscheid (Vertrag §9 Nr 9)', () => {
  function mitAusnahme(root: string, version: string, nurEntwicklung = true): void {
    writeText(
      root,
      'scripts/wap-gate/license-assets.json',
      `${JSON.stringify(
        {
          version: 1,
          assets: [],
          ausnahmen: [
            {
              paket: 'fiktiv-mpl',
              version,
              lizenz: 'MPL-2.0',
              nurEntwicklung,
              datum: '02.10.2026',
              entscheid: 'Gate 0, fiktiver Testentscheid',
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
  }

  it('[R-H-23] neues Entwicklungs-Paket mit MPL-2.0 und passender Ausnahme → grün', async () => {
    const sb = neueSandbox();
    const { root, basis } = lizenzRepo(sb);
    setzePakete(root, {
      'alt-gpl': { version: '1.0.0', license: 'GPL-3.0-only' },
      'fiktiv-mpl': { version: '4.13.0', license: 'MPL-2.0', dev: true },
    });
    mitAusnahme(root, '4.13.0');
    commitAlles(sb, root, 'Ausnahme');
    expect((await pruefeF10(root, basis)).ok).toBe(true);
  });

  it('[R-H-23] Ausnahme für eine andere Version → rot mit name@version', async () => {
    const sb = neueSandbox();
    const { root, basis } = lizenzRepo(sb);
    setzePakete(root, {
      'alt-gpl': { version: '1.0.0', license: 'GPL-3.0-only' },
      'fiktiv-mpl': { version: '4.14.0', license: 'MPL-2.0', dev: true },
    });
    mitAusnahme(root, '4.13.0');
    commitAlles(sb, root, 'Ausnahme andere Version');
    const r = await pruefeF10(root, basis);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('fiktiv-mpl@4.14.0');
  });

  it('[R-H-23] Ausnahme «nur Entwicklung», Paket ist Laufzeit-Abhängigkeit → rot', async () => {
    const sb = neueSandbox();
    const { root, basis } = lizenzRepo(sb);
    setzePakete(root, {
      'alt-gpl': { version: '1.0.0', license: 'GPL-3.0-only' },
      'fiktiv-mpl': { version: '4.13.0', license: 'MPL-2.0' },
    });
    mitAusnahme(root, '4.13.0');
    commitAlles(sb, root, 'Ausnahme Laufzeit');
    const r = await pruefeF10(root, basis);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain(
      'Ausnahme nur für Entwicklung, Paket ist Laufzeit-Abhängigkeit',
    );
  });

  it('[R-H-23] Ausnahme ohne Pflichtfeld (entscheid fehlt) → ungültig, rot', async () => {
    const sb = neueSandbox();
    const { root, basis } = lizenzRepo(sb);
    setzePakete(root, {
      'alt-gpl': { version: '1.0.0', license: 'GPL-3.0-only' },
      'fiktiv-mpl': { version: '4.13.0', license: 'MPL-2.0', dev: true },
    });
    writeText(
      root,
      'scripts/wap-gate/license-assets.json',
      `${JSON.stringify({ version: 1, assets: [], ausnahmen: [{ paket: 'fiktiv-mpl', version: '4.13.0', lizenz: 'MPL-2.0', nurEntwicklung: true, datum: '02.10.2026' }] }, null, 2)}\n`,
    );
    commitAlles(sb, root, 'Ausnahme unvollständig');
    expect((await pruefeF10(root, basis)).ok).toBe(false);
  });
});
