// Lese-Schutz der Einzeldatei (Nachtrag-Tests L1–L4, Ergänzung nach Test-Review CR1; R-H-11): Unabhängig vom
// Einbettungsweg protokolliert buildEinzeldatei während des Vite-Baus jeden Dateilesezugriff des Prozesses und
// prüft ihn mit pruefeLesezugriffe (verbotene Ordner, ausserhalb der erlaubten Wurzeln, Durchstich); die
// fertige Seite prüft pruefeDataUris auf data:-URIs unbekannter Herkunft. Meldungen ohne Inhalt, Pfade nur
// repo-relativ. Nach jedem Bau sind die fs-Funktionen wieder die Originale.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, «Ergänzung nach Test-Review CR1» Nr 2 und 3. Die neuen
// Funktionen prüft jeder Test zuerst mit typeof (Rot-Nachweis an einer Assertion). Nur fiktive Dateien.
import { createHash } from 'node:crypto';
import * as fsNs from 'node:fs';
import { mkdirSync } from 'node:fs';
import * as fspNs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  junction,
  MITTEL,
  neueSandbox,
  neuesRepo,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import {
  einzeldateiModul,
  einzeldateiRepo,
  FIKTIVE_APP_LIZENZ,
  fiktivesBuildSkript,
} from './support/vertrag-b';
import {
  erwarteRot,
  fiktiveDatei,
  pruefeDataUrisFn,
  pruefeLesezugriffeFn,
} from './support/vertrag-b-cr1';

afterEach(aufraeumen);

// Fiktive Sperrliste (WAP_REFERENCE_DIR) für jeden Test: zeigePfad liest nie die echte Liste (AGENTS.md).
beforeEach(() => {
  prozessUmgebung(neueSandbox());
});

const MARKE = 'FIKTIV-LESESCHUTZ-7Q3';
const VERBOTEN = ['reference/', '.qa/', 'fixtures-private/', 'test-results/'] as const;

/** Repo-Ordner und ein fiktives Werkzeug-node_modules ausserhalb davon (beide echte Pfade). */
function aufbau(sb: Sandbox): { cwd: string; werkzeug: string } {
  prozessUmgebung(sb);
  const cwd = join(sb.base, 'repo');
  const werkzeug = join(sb.base, 'werkzeug', 'node_modules');
  mkdirSync(cwd, { recursive: true });
  mkdirSync(werkzeug, { recursive: true });
  return { cwd, werkzeug };
}

const schraeg = (p: string) => p.replace(/\\/g, '/');

describe('pruefeLesezugriffe (L1)', () => {
  it.each(VERBOTEN.map((o) => [o]))(
    '[R-H-11] L1 Datei unter %s, vorhanden und fehlend → «Datei unter <ordner> beim Bau gelesen: <pfad>»',
    async (ordner) => {
      const pruefe = await pruefeLesezugriffeFn();
      const sb = neueSandbox();
      const { cwd, werkzeug } = aufbau(sb);
      const opts = { cwd, werkzeugNodeModules: werkzeug, versioniert: false };
      writeText(cwd, `${ordner}fiktiv/bild.png`, fiktiveDatei(MARKE));
      const da = pruefe([join(cwd, ordner, 'fiktiv', 'bild.png')], opts);
      expect(da.befunde).toContain(
        `Datei unter ${ordner} beim Bau gelesen: ${ordner}fiktiv/bild.png`,
      );
      expect(da.zulaessig).toEqual([]);
      const fehlt = pruefe([join(cwd, ordner, 'fiktiv', 'fehlt.png')], opts);
      expect(fehlt.befunde).toContain(
        `Datei unter ${ordner} beim Bau gelesen: ${ordner}fiktiv/fehlt.png`,
      );
      expect(fehlt.zulaessig).toEqual([]);
    },
  );

  it('[R-H-11] L1 Junction unter src/ in einen verbotenen Ordner → Befund mit dem echten Pfad unter reference/', async () => {
    const pruefe = await pruefeLesezugriffeFn();
    const sb = neueSandbox();
    const { cwd, werkzeug } = aufbau(sb);
    writeText(cwd, 'reference/fiktiv/bild.png', fiktiveDatei(MARKE));
    junction(join(cwd, 'src', 'link'), join(cwd, 'reference', 'fiktiv'));
    const r = pruefe([join(cwd, 'src', 'link', 'bild.png')], {
      cwd,
      werkzeugNodeModules: werkzeug,
      versioniert: false,
    });
    expect(r.befunde).toContain(
      'Datei unter reference/ beim Bau gelesen: reference/fiktiv/bild.png',
    );
    expect(r.zulaessig).toEqual([]);
  });

  it('[R-H-11] L1 vorhandene Datei ausserhalb der erlaubten Wurzeln → «Datei ausserhalb der erlaubten Wurzeln beim Bau gelesen», ohne Pfad', async () => {
    const pruefe = await pruefeLesezugriffeFn();
    const sb = neueSandbox();
    const { cwd, werkzeug } = aufbau(sb);
    const aussen = writeText(sb.base, 'aussen/geheim.png', fiktiveDatei(MARKE));
    const r = pruefe([aussen], { cwd, werkzeugNodeModules: werkzeug, versioniert: false });
    expect(r.befunde).toEqual(['Datei ausserhalb der erlaubten Wurzeln beim Bau gelesen']);
    expect(r.zulaessig).toEqual([]);
    const text = r.befunde.join('\n');
    expect(text).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(text).not.toContain('geheim');
  });

  it('[R-H-11] L1 Durchstich-Datei: bei versioniert → «Durchstich-Datei beim Bau gelesen: <pfad>»; sonst kein Befund und zulässig', async () => {
    const pruefe = await pruefeLesezugriffeFn();
    const sb = neueSandbox();
    const { cwd, werkzeug } = aufbau(sb);
    const plan = writeText(
      cwd,
      'tests/wap/fixtures/durchstich/plan.ts',
      "export const plan = 'Synthetischer Plan';\n",
    );
    const v = pruefe([plan], { cwd, werkzeugNodeModules: werkzeug, versioniert: true });
    expect(v.befunde).toContain(
      'Durchstich-Datei beim Bau gelesen: tests/wap/fixtures/durchstich/plan.ts',
    );
    const t = pruefe([plan], { cwd, werkzeugNodeModules: werkzeug, versioniert: false });
    expect(t.befunde).toEqual([]);
    expect(t.zulaessig).toHaveLength(1);
    expect(schraeg(t.zulaessig[0] ?? '')).toMatch(/tests\/wap\/fixtures\/durchstich\/plan\.ts$/);
  });

  it('[R-H-11] L1 grün: Datei unter cwd, unter cwd/node_modules (Junction nach aussen), unter werkzeugNodeModules; fehlende Dateien ausserhalb bzw. unter src/ zählen nicht; zulaessig = die drei vorhandenen', async () => {
    const pruefe = await pruefeLesezugriffeFn();
    const sb = neueSandbox();
    const { cwd, werkzeug } = aufbau(sb);
    const bild = writeText(cwd, 'src/probe/bild.png', fiktiveDatei('FIKTIV-ERLAUBT'));
    const extern = join(sb.base, 'extern-node-modules');
    writeText(extern, 'fiktiv-paket/index.js', "export const p = 'fiktiv';\n");
    junction(join(cwd, 'node_modules'), extern);
    const paket = join(cwd, 'node_modules', 'fiktiv-paket', 'index.js');
    const wz = writeText(werkzeug, 'vite-fiktiv/index.js', "export const v = 'fiktiv';\n");
    const r = pruefe(
      [
        bild,
        paket,
        wz,
        join(sb.base, 'aussen', 'fehlt.txt'),
        join(cwd, 'src', 'probe', 'fehlt.png'),
      ],
      { cwd, werkzeugNodeModules: werkzeug, versioniert: true },
    );
    expect(r.befunde).toEqual([]);
    const z = r.zulaessig.map(schraeg);
    expect(z).toHaveLength(3);
    for (const ende of ['src/probe/bild.png', 'fiktiv-paket/index.js', 'vite-fiktiv/index.js']) {
      expect(
        z.some((p) => p.endsWith(ende)),
        `${ende} fehlt in zulaessig`,
      ).toBe(true);
    }
  });
});

describe('pruefeDataUris (L2)', () => {
  const LEER = { sha256: new Set<string>(), quelltexte: [] as string[] };
  const inhalt = fiktiveDatei(MARKE);
  const b64 = Buffer.from(inhalt).toString('base64');

  it('[R-H-11] L2 unbekannte data:-URI → «data:-URI unbekannter Herkunft: <medientyp|ohne>, <n> Bytes», ohne Inhalt', async () => {
    const pruefe = await pruefeDataUrisFn();
    const mitTyp = pruefe(`.a{background:url(data:image/png;base64,${b64})}`, LEER);
    expect(mitTyp).toEqual([
      `data:-URI unbekannter Herkunft: image/png, ${String(inhalt.length)} Bytes`,
    ]);
    const ohneTyp = pruefe('var x="data:,FIKTIVTEXT";', LEER);
    expect(ohneTyp).toEqual(['data:-URI unbekannter Herkunft: ohne, 10 Bytes']);
    for (const b of [...mitTyp, ...ohneTyp]) {
      expect(b).not.toContain(b64);
      expect(b).not.toContain(MARKE);
      expect(b).not.toContain('FIKTIVTEXT');
    }
  });

  it('[R-H-11] L2 grün: bekannter SHA-256 des Inhalts, wörtlich im Quelltext, leerer Inhalt, {data:e,method:x}; dieselbe URI ohne Herkunft ist rot', async () => {
    const pruefe = await pruefeDataUrisFn();
    const text = `.a{background:url(data:image/png;base64,${b64})}`;
    expect(pruefe(text, LEER)).toHaveLength(1);
    const hash = createHash('sha256').update(inhalt).digest('hex');
    expect(pruefe(text, { sha256: new Set([hash]), quelltexte: [] })).toEqual([]);
    const literal = 'data:text/plain;base64,RklLVElWLVFVRUxMRQ==';
    expect(pruefe(`var s="${literal}";`, LEER)).toHaveLength(1);
    expect(
      pruefe(`var s="${literal}";`, {
        sha256: new Set<string>(),
        quelltexte: [`export const s = '${literal}';\n`],
      }),
    ).toEqual([]);
    expect(pruefe("var u='data:application/pdf;base64,'+x;", LEER)).toEqual([]);
    expect(pruefe('var o={data:e,method:x};', LEER)).toEqual([]);
  });
});

describe('Lese-Schutz über buildEinzeldatei (L3–L5)', () => {
  const AUS = 'test-results/wap/einzeldatei/leseschutz.html';
  const EINSTIEG = 'src/probe/main.tsx';

  async function baue(root: string) {
    const { buildEinzeldatei } = await einzeldateiModul();
    return buildEinzeldatei({
      cwd: root,
      entry: join(root, EINSTIEG),
      outFile: join(root, ...AUS.split('/')),
      titel: 'Leseschutz',
    });
  }

  it.each([
    [
      '@import "./b.css" (b.css mit url() nach .qa/; dazu data:-URI unbekannter Herkunft)',
      // TR-E101b-20: der Befund von pruefeDataUris gehört in die Ursache des Baus (nur Präfix, ohne Bytes).
      ['data:-URI unbekannter Herkunft: image/png'],
      (root: string) => {
        writeText(
          root,
          'src/probe/b.css',
          '.b { background: url("../../.qa/fiktiv/bild.png"); }\n',
        );
        writeText(root, 'src/probe/probe.css', '@import "./b.css";\n.probe { color: #102030; }\n');
        writeText(root, EINSTIEG, "import './probe.css';\nexport {};\n");
      },
    ],
    [
      '?worker&inline mit new URL nach .qa/ im Worker',
      [] as string[],
      (root: string) => {
        writeText(
          root,
          'src/probe/arbeiter.ts',
          "self.postMessage(new URL('../../.qa/fiktiv/bild.png', import.meta.url).href);\nexport {};\n",
        );
        writeText(
          root,
          EINSTIEG,
          "import A from './arbeiter.ts?worker&inline';\ndocument.title = typeof A;\nexport {};\n",
        );
      },
    ],
  ])(
    '[R-H-11] L3 %s → rot, Ursache enthält «Datei unter .qa/ beim Bau gelesen: .qa/fiktiv/bild.png»',
    async (_fall, zusatz, anlegen) => {
      await pruefeLesezugriffeFn();
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = einzeldateiRepo(sb, 'leseschutz');
      writeText(root, '.qa/fiktiv/bild.png', fiktiveDatei(MARKE));
      anlegen(root);
      erwarteRot(await baue(root), {
        sb,
        aus: join(root, ...AUS.split('/')),
        meldungen: ['Datei unter .qa/ beim Bau gelesen: .qa/fiktiv/bild.png', ...zusatz],
        marken: [MARKE],
      });
    },
    MITTEL,
  );

  it.each([
    ['Asset-Import', "import u from '../../reference/fiktiv/bild.png';"],
    ['?inline', "import u from '../../reference/fiktiv/bild.png?inline';"],
    ['?raw', "import u from '../../reference/fiktiv/bild.png?raw';"],
    ['?url', "import u from '../../reference/fiktiv/bild.png?url';"],
    [
      'import.meta.glob (eager, ?inline)',
      "const u = String(Object.values(import.meta.glob('../../reference/fiktiv/*.png', { eager: true, query: '?inline', import: 'default' }))[0]);",
    ],
  ])(
    '[R-H-11] L5 %s nach reference/ → rot mit «Modul unter reference/: …» und «Datei unter reference/ beim Bau gelesen: …»',
    async (_form, zeile) => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = einzeldateiRepo(sb, 'asset-import');
      writeText(root, 'reference/fiktiv/bild.png', fiktiveDatei(MARKE));
      writeText(
        root,
        EINSTIEG,
        [
          zeile,
          '',
          "const root = document.getElementById('root');",
          'if (root !== null) root.dataset.wert = String(u).slice(0, 8);',
          'export {};',
          '',
        ].join('\n'),
      );
      erwarteRot(await baue(root), {
        sb,
        aus: join(root, ...AUS.split('/')),
        meldungen: [
          'Modul unter reference/: reference/fiktiv/bild.png',
          'Datei unter reference/ beim Bau gelesen: reference/fiktiv/bild.png',
        ],
        marken: [MARKE],
      });
    },
    MITTEL,
  );

  /** Originale der Funktionen, die der Lese-Schutz während des Baus ersetzt (vor jedem Bau erfasst). */
  const FS_NAMEN = [
    'readFile',
    'readFileSync',
    'createReadStream',
    'open',
    'openSync',
    'openAsBlob',
    'copyFile',
    'copyFileSync',
    'cp',
    'cpSync',
  ];
  const FSP_NAMEN = ['readFile', 'open', 'copyFile', 'cp'];
  const fsCjs = createRequire(import.meta.url)('node:fs') as Record<string, unknown>;
  const fsEsm = fsNs as unknown as Record<string, unknown>;
  const fspEsm = fspNs as unknown as Record<string, unknown>;
  const fspCjs = fsCjs.promises as Record<string, unknown>;
  const originale = {
    cjs: FS_NAMEN.map((n) => fsCjs[n]),
    esm: FS_NAMEN.map((n) => fsEsm[n]),
    fspCjs: FSP_NAMEN.map((n) => fspCjs[n]),
    fspEsm: FSP_NAMEN.map((n) => fspEsm[n]),
  };

  function erwarteOriginale(nach: string): void {
    FS_NAMEN.forEach((n, i) => {
      expect(fsCjs[n] === originale.cjs[i], `${nach}: fs.${n} (CommonJS)`).toBe(true);
      expect(fsEsm[n] === originale.esm[i], `${nach}: fs.${n} (ESM)`).toBe(true);
    });
    FSP_NAMEN.forEach((n, i) => {
      expect(fspCjs[n] === originale.fspCjs[i], `${nach}: fs.promises.${n}`).toBe(true);
      expect(fspEsm[n] === originale.fspEsm[i], `${nach}: fs/promises.${n} (ESM)`).toBe(true);
    });
  }

  it(
    '[R-H-11] L4 kein Fehlalarm: React-Einstieg (react-dom/client, node_modules als Junction) ist grün; nach dem grünen und nach einem roten Bau sind die fs-Funktionen wieder die Originale',
    async () => {
      await pruefeLesezugriffeFn();
      await pruefeDataUrisFn();
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = neuesRepo(sb, 'react');
      writeText(
        root,
        'package.json',
        `${JSON.stringify({ name: 'fiktiv-react', private: true, type: 'module' }, null, 2)}\n`,
      );
      writeText(root, 'LICENSE', FIKTIVE_APP_LIZENZ);
      writeText(root, 'tools/build-offline.mjs', fiktivesBuildSkript());
      nodeModules(root);
      writeText(
        root,
        EINSTIEG,
        [
          "import { useState } from 'react';",
          "import { createRoot } from 'react-dom/client';",
          '',
          'function Probe() {',
          '  const [n] = useState(1);',
          '  return <p>Fiktive Probe {n}</p>;',
          '}',
          '',
          "const el = document.getElementById('root');",
          'if (el !== null) createRoot(el).render(<Probe />);',
          '',
        ].join('\n'),
      );
      const gruen = await baue(root);
      expect(gruen.ok, schrittText(gruen)).toBe(true);
      erwarteOriginale('nach grünem Bau');

      writeText(root, 'reference/fiktiv/bild.png', fiktiveDatei(MARKE));
      writeText(
        root,
        'src/probe/probe.css',
        '.probe { background: url("../../reference/fiktiv/bild.png"); }\n',
      );
      writeText(root, EINSTIEG, "import './probe.css';\nexport {};\n");
      const rot = await baue(root);
      expect(rot.ok).toBe(false);
      erwarteOriginale('nach rotem Bau');
    },
    MITTEL,
  );
});
