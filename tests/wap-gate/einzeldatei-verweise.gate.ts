// Verweise in der Einzeldatei (Nachtrag-Tests N1–N12 nach Code-Review Runde 1, CR-E101b-01/-02; R-H-11):
// Dateien, auf die ein Stil per url()/image-set() oder ein Skript per new URL(…, import.meta.url) verweist,
// bettet Vite ein, ohne dass sie als Modul erscheinen. buildEinzeldatei prüft sie wie Module (verbotene
// Ordner, ausserhalb, Durchstich, Lizenz) und ist fail closed bei nicht prüfbaren Formen (@import, composes,
// Worker, nicht relative und dynamische Verweise). Rot heisst: rot, nichts geschrieben, Ursache ohne
// Inhaltsmarke und ohne absoluten Pfad.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, Änderungsnotiz Code-Review Runde 1 Nr 1 und Nr 8 sowie
// «Ergänzung nach Test-Review CR1» Nr 1 und 3 (N1b, N3b, N4b, N5b, N5c, N9b–N9d, N10b); Notiz Runde 2 Nr 7.
// Synthetische Repos mit frei erfundenen Dateien (Inhaltsmarken statt echter Bilder).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  junction,
  MITTEL,
  neueSandbox,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { einzeldateiModul, einzeldateiRepo } from './support/vertrag-b';
import { erwarteRot, fiktiveDatei, lizenzblock } from './support/vertrag-b-cr1';

afterEach(aufraeumen);

const AUS = 'test-results/wap/einzeldatei/verweis.html';
const VERSIONIERT = 'docs/zwischenstand/verweis.html';
const EINSTIEG = 'src/probe/main.tsx';
const STIL = 'src/probe/probe.css';

/** Inhaltsmarken der fiktiven Dateien (frei erfunden). */
const MARKE = {
  ref: 'FIKTIV-VERWEIS-REF-7Q2',
  qa: 'FIKTIV-VERWEIS-QA-7Q2',
  aussen: 'FIKTIV-VERWEIS-AUSSEN-7Q2',
  bild: 'FIKTIV-VERWEIS-BILD-7Q2',
  schrift: 'FIKTIV-VERWEIS-SCHRIFT-7Q2',
  paket: 'FIKTIV-VERWEIS-PAKET-7Q2',
  durchstich: 'FIKTIV-VERWEIS-DURCHSTICH-7Q2',
};
const ALLE_MARKEN = Object.values(MARKE);

/** Synthetisches Repo (einzeldateiRepo) mit fiktiver Sperrliste für die Meldungen. */
function repo(sb: Sandbox, name = 'verweise'): string {
  prozessUmgebung(sb);
  return einzeldateiRepo(sb, name);
}

/** Einstieg, der nur den Stil src/probe/<datei> (Standard probe.css) importiert. */
function stilEinstieg(root: string, css: string, datei = 'probe.css'): void {
  writeText(
    root,
    EINSTIEG,
    [
      `import './${datei}';`,
      '',
      "const root = document.getElementById('root');",
      "if (root !== null) root.className = 'probe';",
      'export {};',
      '',
    ].join('\n'),
  );
  writeText(root, `src/probe/${datei}`, css);
}

/** Einstieg aus Skriptzeilen (ohne Stil). */
function skriptEinstieg(root: string, zeilen: string[]): void {
  writeText(root, EINSTIEG, [...zeilen, 'export {};', ''].join('\n'));
}

async function baue(root: string, aus = AUS) {
  const { buildEinzeldatei } = await einzeldateiModul();
  return buildEinzeldatei({
    cwd: root,
    entry: join(root, EINSTIEG),
    outFile: join(root, ...aus.split('/')),
    titel: 'Verweisprobe',
  });
}

const ausgabe = (root: string, aus = AUS) => join(root, ...aus.split('/'));

describe('buildEinzeldatei: Verweise in verbotene Ordner und ausserhalb (N1–N5)', () => {
  it.each([['reference/'], ['.qa/'], ['fixtures-private/'], ['test-results/']])(
    '[R-H-11] N1 url("…") im Stil nach %s → rot «Verweis unter <ordner>», nichts geschrieben',
    async (ordner) => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, `${ordner}fiktiv/bild.png`, fiktiveDatei(MARKE.ref));
      stilEinstieg(root, `.probe { background-image: url("../../${ordner}fiktiv/bild.png"); }\n`);
      const r = await baue(root);
      erwarteRot(r, {
        sb,
        aus: ausgabe(root),
        meldungen: [`Verweis unter ${ordner}`, `${ordner}fiktiv/bild.png`],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    '[R-H-11] N2 url(…) ohne Anführungszeichen auf eine Datei ausserhalb cwd → rot «Verweis ausserhalb des Arbeitsordners: <importeur>», ohne das Ziel zu nennen',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(sb.base, 'aussen/bild.png', fiktiveDatei(MARKE.aussen));
      stilEinstieg(root, '.probe { background-image: url(../../../aussen/bild.png); }\n');
      const r = await baue(root);
      const ursache = erwarteRot(r, {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis ausserhalb des Arbeitsordners', STIL],
        marken: ALLE_MARKEN,
      });
      expect(ursache).not.toContain('aussen/bild.png');
    },
    MITTEL,
  );

  it(
    '[R-H-11] N3 url() über eine Junction unter src/, die nach reference/ zeigt → rot «Verweis unter reference/» (echter Pfad)',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'reference/bilder/bild.png', fiktiveDatei(MARKE.ref));
      junction(join(root, 'src', 'bilder'), join(root, 'reference', 'bilder'));
      stilEinstieg(root, '.probe { background-image: url("../bilder/bild.png"); }\n');
      const r = await baue(root);
      erwarteRot(r, {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis unter reference/', 'reference/bilder/bild.png'],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    '[R-H-11] N4 new URL(…, import.meta.url) nach reference/ → rot «Verweis unter reference/»; dasselbe als Vorlage mit Platzhalter → rot «Verweis dynamisch»',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'reference/fiktiv/bild.png', fiktiveDatei(MARKE.ref));
      writeText(
        root,
        EINSTIEG,
        [
          "const bild = new URL('../../reference/fiktiv/bild.png', import.meta.url);",
          "const root = document.getElementById('root');",
          'if (root !== null) root.dataset.bild = bild.href;',
          'export {};',
          '',
        ].join('\n'),
      );
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis unter reference/', 'reference/fiktiv/bild.png'],
        marken: ALLE_MARKEN,
      });

      const sb2 = neueSandbox();
      const root2 = repo(sb2, 'dynamisch');
      writeText(root2, 'reference/fiktiv/bild.png', fiktiveDatei(MARKE.ref));
      writeText(
        root2,
        EINSTIEG,
        [
          "const name = String(document.title || 'bild');",
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Vorlage mit ${} ist der geprüfte Fall (Text des Einstiegs).
          'const bild = new URL(`../../reference/fiktiv/${name}.png`, import.meta.url);',
          "const root = document.getElementById('root');",
          'if (root !== null) root.dataset.bild = bild.href;',
          'export {};',
          '',
        ].join('\n'),
      );
      erwarteRot(await baue(root2), {
        sb: sb2,
        aus: ausgabe(root2),
        meldungen: ['Verweis dynamisch', EINSTIEG],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    '[R-H-11] N5 image-set("…") nach .qa/ → rot «Verweis unter .qa/»; ein ?inline-Stil mit url() nach reference/ → rot «Verweis unter reference/»',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, '.qa/fiktiv/bild.png', fiktiveDatei(MARKE.qa));
      stilEinstieg(
        root,
        '.probe { background-image: image-set("../../.qa/fiktiv/bild.png" 1x, "data:image/png;base64,AAAA" 2x); }\n',
      );
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis unter .qa/', '.qa/fiktiv/bild.png'],
        marken: ALLE_MARKEN,
      });

      const sb2 = neueSandbox();
      const root2 = repo(sb2, 'inline');
      writeText(root2, 'reference/fiktiv/bild.png', fiktiveDatei(MARKE.ref));
      writeText(
        root2,
        'src/probe/inl.css',
        '.probe { background-image: url("../../reference/fiktiv/bild.png"); }\n',
      );
      writeText(
        root2,
        EINSTIEG,
        [
          "import stil from './inl.css?inline';",
          '',
          "const root = document.getElementById('root');",
          'if (root !== null) root.dataset.stil = String(stil.length);',
          'export {};',
          '',
        ].join('\n'),
      );
      erwarteRot(await baue(root2), {
        sb: sb2,
        aus: ausgabe(root2),
        meldungen: ['Verweis unter reference/', 'reference/fiktiv/bild.png'],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );
});

describe('buildEinzeldatei: Durchstich-Regel und Lizenz für Verweise (N6, N7)', () => {
  it(
    '[R-H-11] N6 url() nach tests/wap/fixtures/durchstich/: Ausgabe unter test-results/ → grün mit Eintrag in module; versionierte Ausgabe → rot «Durchstich-Verweis in versionierter Ausgabe»',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'tests/wap/fixtures/durchstich/bild.png', fiktiveDatei(MARKE.durchstich));
      stilEinstieg(
        root,
        '.probe { background-image: url("../../tests/wap/fixtures/durchstich/bild.png"); }\n',
      );
      const r = await baue(root);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(r.module).toContain('tests/wap/fixtures/durchstich/bild.png');
      expect(existsSync(ausgabe(root))).toBe(true);

      const v = await baue(root, VERSIONIERT);
      erwarteRot(v, {
        sb,
        aus: ausgabe(root, VERSIONIERT),
        meldungen: [
          'Durchstich-Verweis in versionierter Ausgabe',
          'tests/wap/fixtures/durchstich/bild.png',
        ],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    '[R-H-11] N7 @font-face mit url() auf eine Schrift unter src/assets/fiktiv/: ohne OFL.txt → rot «Lizenzdatei fehlt»; mit OFL.txt → grün, Schrift in module, OFL-Text im Lizenzblock',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'src/assets/fiktiv/fiktivschrift.ttf', fiktiveDatei(MARKE.schrift));
      stilEinstieg(
        root,
        [
          "@font-face { font-family: 'Fiktivschrift'; src: url('../assets/fiktiv/fiktivschrift.ttf') format('truetype'); }",
          ".probe { font-family: 'Fiktivschrift', sans-serif; }",
          '',
        ].join('\n'),
      );
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Lizenzdatei fehlt', 'src/assets/fiktiv'],
        marken: ALLE_MARKEN,
      });

      const ofl = 'Fiktive Schriftlizenz OFL der Verweisprobe\nZweite Zeile der Lizenz';
      writeText(root, 'src/assets/fiktiv/OFL.txt', `${ofl}\n`);
      const r = await baue(root);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(r.module).toContain('src/assets/fiktiv/fiktivschrift.ttf');
      expect(lizenzblock(ausgabe(root))).toContain(ofl);
    },
    MITTEL,
  );
});

describe('buildEinzeldatei: fail closed für nicht prüfbare Formen (N8–N10)', () => {
  it.each([
    ['@import "…"', 'probe.css', '@import "./teil.css";\n.probe { color: #102030; }\n'],
    ['@import url(…)', 'probe.css', '@import url(./teil.css);\n.probe { color: #102030; }\n'],
    [
      'composes … from',
      'probe.module.css',
      ".probe { composes: teil from './teil.module.css'; color: #102030; }\n",
    ],
  ])(
    '[R-H-11] N8 %s im Stil → rot «@import oder composes in Stil nicht erlaubt: <importeur>»',
    async (_form, datei, css) => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, '.qa/fiktiv/bild.png', fiktiveDatei(MARKE.qa));
      const teil = '.teil { background-image: url("../../.qa/fiktiv/bild.png"); }\n';
      writeText(root, 'src/probe/teil.css', teil);
      writeText(root, 'src/probe/teil.module.css', teil);
      writeText(root, `src/probe/${datei}`, css);
      writeText(
        root,
        EINSTIEG,
        [
          datei === 'probe.module.css'
            ? "import k from './probe.module.css';"
            : "import './probe.css';",
          '',
          "const root = document.getElementById('root');",
          datei === 'probe.module.css'
            ? 'if (root !== null) root.className = String(k.probe);'
            : "if (root !== null) root.className = 'probe';",
          'export {};',
          '',
        ].join('\n'),
      );
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['@import oder composes in Stil nicht erlaubt', `src/probe/${datei}`],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it.each([
    ['/x (Wurzel)', 'url(/bild.png)'],
    ['nackter Name', 'url(bild.png)'],
    ['file:', 'url("file:///fiktiv/bild.png")'],
    ['//h/x (ohne Schema)', 'url(//fiktiv.invalid/bild.png)'],
  ])(
    '[R-H-11] N9 Verweis nicht relativ: %s → rot «Verweis nicht relativ: <importeur>»',
    async (_form, verweis) => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'bild.png', fiktiveDatei(MARKE.bild));
      writeText(root, 'src/probe/bild.png', fiktiveDatei(MARKE.bild));
      stilEinstieg(root, `.probe { background-image: ${verweis}; }\n`);
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis nicht relativ', STIL],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  /** Einstieg mit Worker über eine Abfrage (?worker bzw. ?sharedworker) auf src/probe/arbeiter.ts. */
  const abfrage = (q: string) => [
    `import Arbeiter from './arbeiter.ts?${q}&inline';`,
    '',
    "const root = document.getElementById('root');",
    'if (root !== null) root.dataset.arbeiter = typeof Arbeiter;',
    'export {};',
    '',
  ];
  /** Einstieg mit new Worker bzw. new SharedWorker(new URL('./arbeiter.ts', import.meta.url)). */
  const aufruf = (klasse: string) => [
    "const root = document.getElementById('root');",
    'if (root !== null && document.title === "fiktiv") {',
    `  const w = new ${klasse}(new URL('./arbeiter.ts', import.meta.url), { type: 'module' });`,
    '  root.dataset.arbeiter = String(w !== null);',
    '}',
    'export {};',
    '',
  ];

  /** Gemeinsamer Ablauf von N10 und N10b: die Meldung nennt die Datei mit der Abfrage bzw. dem Aufruf. */
  async function workerRot(zeilen: string[], datei: string): Promise<void> {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(
      root,
      'src/probe/arbeiter.ts',
      "self.postMessage('fiktiver Arbeiter');\nexport {};\n",
    );
    writeText(root, EINSTIEG, zeilen.join('\n'));
    erwarteRot(await baue(root), {
      sb,
      aus: ausgabe(root),
      meldungen: [
        'Worker in Einzeldatei nicht erlaubt: src/probe/',
        `Worker in Einzeldatei nicht erlaubt: ${datei}`,
      ],
      marken: ALLE_MARKEN,
    });
  }

  it.each([
    ['?worker&inline', 'src/probe/arbeiter.ts', abfrage('worker')],
    ['new Worker(new URL(…))', EINSTIEG, aufruf('Worker')],
  ])(
    '[R-H-11] N10 Worker %s → rot «Worker in Einzeldatei nicht erlaubt: %s»',
    async (_form, datei, zeilen) => {
      await workerRot(zeilen, datei);
    },
    MITTEL,
  );

  it.each([
    ['?sharedworker&inline', 'src/probe/arbeiter.ts', abfrage('sharedworker')],
    ['new SharedWorker(new URL(…))', EINSTIEG, aufruf('SharedWorker')],
  ])(
    '[R-H-11] N10b SharedWorker %s → rot «Worker in Einzeldatei nicht erlaubt: %s»',
    async (_form, datei, zeilen) => {
      await workerRot(zeilen, datei);
    },
    MITTEL,
  );
});

describe('buildEinzeldatei: zulässige Verweise (N11, N12)', () => {
  it(
    '[R-H-11] N11 url(data:…), url(#a), ein Kommentar mit url(…reference/…) und url(./bild.png) unter src/probe/ → grün; module enthält die PNG, kein Eintrag unter reference/',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'reference/fiktiv/bild.png', fiktiveDatei(MARKE.ref));
      writeText(root, 'src/probe/bild.png', fiktiveDatei(MARKE.bild));
      stilEinstieg(
        root,
        [
          '/* Hinweis: früher url("../../reference/fiktiv/bild.png") */',
          '.probe { background-image: url(./bild.png); }',
          '.punkt { background-image: url(data:image/png;base64,iVBORw0KGgo=); }',
          '.filter { filter: url(#a); }',
          '',
        ].join('\n'),
      );
      const r = await baue(root);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(r.module).toContain('src/probe/bild.png');
      expect(r.module.filter((m) => m.startsWith('reference/'))).toEqual([]);
      expect(readFileSync(ausgabe(root), 'utf8')).not.toContain(
        Buffer.from(fiktiveDatei(MARKE.ref)).toString('base64'),
      );
    },
    MITTEL,
  );

  it(
    '[R-H-11] N12 Stil eines npm-Pakets mit url(./files/p.png) → grün; module enthält node_modules/<paket>/files/p.png; Paketlizenz im Lizenzblock',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      const paket = 'node_modules/fiktiv-stilpaket';
      writeText(
        root,
        `${paket}/package.json`,
        `${JSON.stringify({ name: 'fiktiv-stilpaket', version: '1.0.0', license: 'MIT' })}\n`,
      );
      const lizenz = 'Fiktive Paketlizenz fiktiv-stilpaket\nMIT, frei erfunden';
      writeText(root, `${paket}/LICENSE`, `${lizenz}\n`);
      writeText(root, `${paket}/files/p.png`, fiktiveDatei(MARKE.paket));
      writeText(root, `${paket}/stil.css`, '.paket { background-image: url(./files/p.png); }\n');
      writeText(
        root,
        EINSTIEG,
        [
          "import 'fiktiv-stilpaket/stil.css';",
          '',
          "const root = document.getElementById('root');",
          "if (root !== null) root.className = 'paket';",
          'export {};',
          '',
        ].join('\n'),
      );
      const r = await baue(root);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(r.module).toContain('node_modules/fiktiv-stilpaket/files/p.png');
      expect(lizenzblock(ausgabe(root))).toContain(lizenz);
    },
    MITTEL,
  );
});

describe('buildEinzeldatei: weitere Einbettungswege (Ergänzung nach Test-Review CR1)', () => {
  const REF = '../../reference/fiktiv/bild.png';

  /** Repo mit der fiktiven Datei reference/fiktiv/bild.png. */
  function mitReferenz(sb: Sandbox, name = 'verweise'): string {
    const root = repo(sb, name);
    writeText(root, 'reference/fiktiv/bild.png', fiktiveDatei(MARKE.ref));
    return root;
  }

  it.each([['probe.pcss'], ['probe.postcss']])(
    '[R-H-11] N1b Stil %s (CSS_LANGS_RE) mit url() nach reference/ → rot «Verweis unter reference/»',
    async (datei) => {
      const sb = neueSandbox();
      const root = mitReferenz(sb);
      stilEinstieg(root, `.probe { background-image: url("${REF}"); }\n`, datei);
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis unter reference/', 'reference/fiktiv/bild.png'],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    '[R-H-11] N3b url() über eine Junction unter src/, die ausserhalb cwd zeigt → rot «Verweis ausserhalb des Arbeitsordners», ohne das Ziel zu nennen',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(sb.base, 'fremd-bilder/bild.png', fiktiveDatei(MARKE.aussen));
      junction(join(root, 'src', 'fremd'), join(sb.base, 'fremd-bilder'));
      stilEinstieg(root, '.probe { background-image: url("../fremd/bild.png"); }\n');
      const ursache = erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis ausserhalb des Arbeitsordners', STIL],
        marken: ALLE_MARKEN,
      });
      expect(ursache).not.toContain('fremd-bilder');
    },
    MITTEL,
  );

  it.each([
    ['doppelte Anführungszeichen', `new URL("${REF}", import.meta.url)`],
    ['Backtick-Vorlage ohne Platzhalter', `new URL(\`${REF}\`, import.meta.url)`],
  ])(
    '[R-H-11] N4b new URL mit %s nach reference/ → rot «Verweis unter reference/»',
    async (_form, ausdruck) => {
      const sb = neueSandbox();
      const root = mitReferenz(sb);
      skriptEinstieg(root, [
        `const bild = ${ausdruck};`,
        "const root = document.getElementById('root');",
        'if (root !== null) root.dataset.bild = bild.href;',
      ]);
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis unter reference/', 'reference/fiktiv/bild.png'],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    "[R-H-11] N5b Stil über ?url (import u from './s.css?url') mit url() nach reference/ → rot «Verweis unter reference/»",
    async () => {
      const sb = neueSandbox();
      const root = mitReferenz(sb);
      writeText(root, 'src/probe/s.css', `.probe { background-image: url("${REF}"); }\n`);
      skriptEinstieg(root, [
        "import u from './s.css?url';",
        '',
        "const root = document.getElementById('root');",
        'if (root !== null) root.dataset.stil = u;',
      ]);
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis unter reference/', 'reference/fiktiv/bild.png'],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    '[R-H-11] N5c -webkit-image-set("…" 1x) nach reference/ → rot «Verweis unter reference/»',
    async () => {
      const sb = neueSandbox();
      const root = mitReferenz(sb);
      stilEinstieg(root, `.probe { background-image: -webkit-image-set("${REF}" 1x); }\n`);
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis unter reference/', 'reference/fiktiv/bild.png'],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it.each([['/reference/fiktiv/bild.png'], ['fiktiv/../../../reference/fiktiv/bild.png']])(
    "[R-H-11] N9b new URL('%s', import.meta.url) → rot «Verweis nicht relativ: src/probe/main.tsx»",
    async (ziel) => {
      const sb = neueSandbox();
      const root = mitReferenz(sb);
      skriptEinstieg(root, [
        `const bild = new URL(${JSON.stringify(ziel)}, import.meta.url);`,
        "const root = document.getElementById('root');",
        'if (root !== null) root.dataset.bild = bild.href;',
      ]);
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: [`Verweis nicht relativ: ${EINSTIEG}`],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    '[R-H-11] N9c url(./fehlt.png) → rot «Verweis nicht auffindbar: src/probe/probe.css»',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      stilEinstieg(root, '.probe { background-image: url(./fehlt.png); }\n');
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: [`Verweis nicht auffindbar: ${STIL}`],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    '[R-H-11] N9c url("../../%72eference/fiktiv/bild.png") (nach decodeURI unter reference/) → rot «Verweis unter reference/: reference/fiktiv/bild.png»',
    async () => {
      const sb = neueSandbox();
      const root = mitReferenz(sb);
      stilEinstieg(
        root,
        '.probe { background-image: url("../../%72eference/fiktiv/bild.png"); }\n',
      );
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: ['Verweis unter reference/: reference/fiktiv/bild.png'],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );

  it(
    '[R-H-11] N9d url(~/reference/fiktiv/bild.png) → rot «Verweis nicht relativ: src/probe/probe.css»',
    async () => {
      const sb = neueSandbox();
      const root = mitReferenz(sb);
      stilEinstieg(root, '.probe { background-image: url(~/reference/fiktiv/bild.png); }\n');
      erwarteRot(await baue(root), {
        sb,
        aus: ausgabe(root),
        meldungen: [`Verweis nicht relativ: ${STIL}`],
        marken: ALLE_MARKEN,
      });
    },
    MITTEL,
  );
});

describe('buildEinzeldatei: zulässige SVG (N11b, Orchestrator-Zeile TR-E101b-19)', () => {
  /** Fiktive SVG mit doppelten Anführungszeichen und Leerraum (Vite bettet sie in Normalform ein). */
  const SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 4 4">',
    '  <rect width="4" height="4" fill="#123456" />',
    '</svg>',
    '',
  ].join('\n');

  it(
    '[R-H-11] N11b url(./icon.svg) im Stil und Import von ./icon.svg unter src/probe/ → je grün ohne Befund (auch keine data:-URI unbekannter Herkunft), icon.svg in module',
    async () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'src/probe/icon.svg', SVG);
      stilEinstieg(root, '.probe { background-image: url(./icon.svg); }\n');
      const stil = await baue(root);
      expect(stil.ok, schrittText(stil)).toBe(true);
      expect(stil.module).toContain('src/probe/icon.svg');
      expect(existsSync(ausgabe(root))).toBe(true);

      const sb2 = neueSandbox();
      const root2 = repo(sb2, 'svg-import');
      writeText(root2, 'src/probe/icon.svg', SVG);
      skriptEinstieg(root2, [
        "import icon from './icon.svg';",
        '',
        "const root = document.getElementById('root');",
        'if (root !== null) root.dataset.icon = icon;',
      ]);
      const imp = await baue(root2);
      expect(imp.ok, schrittText(imp)).toBe(true);
      expect(imp.module).toContain('src/probe/icon.svg');
      expect(existsSync(ausgabe(root2))).toBe(true);
    },
    MITTEL,
  );
});
