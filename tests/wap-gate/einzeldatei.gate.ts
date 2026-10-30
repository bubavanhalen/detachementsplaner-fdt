// Build-Hilfe für datenfreie Einzeldateien (Zwischenstand I1, Projekt edge-dist; ADR-010 §3.2 V4; R-H-11):
// buildEinzeldatei baut einen Einstieg wie tools/build-offline.mjs zu einer HTML-Datei mit genau einem
// Inline-Skript, Inline-Stil, Lizenzblock und der CSP der Suite; jeder Verstoss ist rot, ohne etwas zu
// schreiben. suiteCsp liest die CSP aus tools/build-offline.mjs.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 (buildEinzeldatei, suiteCsp), Regeln von
// tools/verify-release.mjs. Synthetische Repos mit fiktiven Modulen und fiktiver Lizenz; der Vergleich mit
// dist/index.html nach npm run build steht in einzeldatei.selbsttest.ts (Vertrag E1-01 §9 Nr 17).
import { cpSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  junction,
  KURZ,
  MITTEL,
  neueSandbox,
  node,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import {
  classcatLizenz,
  einzeldateiModul,
  einzeldateiRepo,
  FIKTIVE_APP_LIZENZ,
  FIKTIVE_CSP_TEILE,
  fiktivesBuildSkript,
  type JsdomKlasse,
  jsdomKlasse,
  normalisiert,
} from './support/vertrag-b';

afterEach(aufraeumen);

let JSDOM: JsdomKlasse;

beforeAll(async () => {
  JSDOM = await jsdomKlasse();
});

const AUS = 'test-results/wap/einzeldatei/probe.html';

/** Repo mit einem Einstieg, der ein Teilmodul, CSS, classcat und ein Asset-Modul mit OFL.txt bündelt. */
function probeRepo(sb: Sandbox): string {
  const root = einzeldateiRepo(sb);
  writeText(
    root,
    'src/probe/main.tsx',
    [
      "import cc from 'classcat';",
      "import { schriftName } from '../assets/fiktiv/schrift';",
      "import './probe.css';",
      "import { gruss } from './teil';",
      '',
      "const root = document.getElementById('root');",
      "if (root !== null) root.textContent = [gruss, cc(['a', { b: true }]), schriftName, String(process.env.NODE_ENV)].join(' ');",
      'export {};',
      '',
    ].join('\n'),
  );
  writeText(root, 'src/probe/teil.ts', "export const gruss = 'Probe laeuft';\n");
  writeText(root, 'src/probe/probe.css', '.probe-farbe { color: #123456; }\n');
  writeText(root, 'src/assets/fiktiv/schrift.ts', "export const schriftName = 'Fiktivschrift';\n");
  writeText(
    root,
    'src/assets/fiktiv/OFL.txt',
    'Fiktive Schriftlizenz OFL für den Schleusen-Test\nZweite Zeile\n',
  );
  return root;
}

async function baue(root: string, entry: string, outFile: string, titel = 'Probe Zwischenstand') {
  const { buildEinzeldatei } = await einzeldateiModul();
  return buildEinzeldatei({ cwd: root, entry, outFile, titel });
}

function dokument(datei: string): Document {
  return new JSDOM(readFileSync(datei, 'utf8')).window.document;
}

describe('buildEinzeldatei: grüner Bau', () => {
  it(
    '[R-H-11] Vorlage: lang de-CH, data-offline, CSP = suiteCsp(cwd), Titel, leeres #root, Inline-Stil, genau ein Inline-Skript (IIFE, läuft)',
    async () => {
      const sb = neueSandbox();
      const root = probeRepo(sb);
      const aus = join(root, AUS);
      const r = await baue(root, join(root, 'src/probe/main.tsx'), aus);
      expect(r.ok, schrittText(r)).toBe(true);
      const html = readFileSync(aus, 'utf8');
      const doc = dokument(aus);
      expect(doc.documentElement.getAttribute('lang')).toBe('de-CH');
      expect(doc.documentElement.dataset.offline).toBe('true');
      const csp = doc
        .querySelector('meta[http-equiv="Content-Security-Policy"]')
        ?.getAttribute('content');
      expect(csp).toBe(FIKTIVE_CSP_TEILE.join('; '));
      expect(doc.title).toBe('Probe Zwischenstand');
      expect(doc.querySelector('#root')?.innerHTML).toBe('');
      const skripte = doc.querySelectorAll('script');
      expect(skripte).toHaveLength(1);
      expect(skripte[0]?.hasAttribute('src')).toBe(false);
      expect(skripte[0]?.getAttribute('type') ?? '').not.toBe('module');
      expect(html).not.toMatch(/<script[^>]*type=["']module/i);
      expect(doc.querySelectorAll('[src], link[href], iframe, object, embed')).toHaveLength(0);
      const stil = [...doc.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
      expect(stil).toContain('#123456');
      const lauf = new JSDOM(html, { runScripts: 'dangerously' });
      expect(lauf.window.document.querySelector('#root')?.textContent).toBe(
        'Probe laeuft a b Fiktivschrift production',
      );
    },
    MITTEL,
  );

  it(
    '[R-H-11] gleiche define und dropConsole wie die Suite: kein «console.» und kein process.env im Skript',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb);
      const konsole = ['con', 'sole'].join('');
      writeText(
        root,
        'src/probe/main.tsx',
        [
          "const root = document.getElementById('root');",
          `${konsole}.info('fiktiv');`,
          `Promise.resolve().catch(${konsole}.error);`,
          'if (root !== null) root.textContent = String(process.env.NODE_ENV);',
          'export {};',
          '',
        ].join('\n'),
      );
      const aus = join(root, AUS);
      const r = await baue(root, join(root, 'src/probe/main.tsx'), aus);
      expect(r.ok, schrittText(r)).toBe(true);
      const skript = dokument(aus).querySelector('script')?.textContent ?? '';
      expect(skript).not.toMatch(new RegExp(`\\b${konsole}\\s*(?:\\.|\\[)`));
      expect(skript).not.toContain('process.env');
      expect(skript).toContain('production');
    },
    MITTEL,
  );

  it(
    '[R-H-11] Lizenzblock application-licenses: App-LICENSE, Lizenz des gebündelten npm-Pakets, OFL.txt neben dem Asset-Modul',
    async () => {
      const sb = neueSandbox();
      const root = probeRepo(sb);
      const aus = join(root, AUS);
      const r = await baue(root, join(root, 'src/probe/main.tsx'), aus);
      expect(r.ok, schrittText(r)).toBe(true);
      const vorlage = dokument(aus).querySelector(
        'template#application-licenses',
      ) as HTMLTemplateElement | null;
      expect(vorlage, 'Lizenzblock fehlt').not.toBeNull();
      const text = normalisiert(vorlage?.content.textContent ?? '');
      expect(text).toContain(normalisiert(FIKTIVE_APP_LIZENZ));
      expect(text).toContain('classcat');
      expect(text).toContain(classcatLizenz(root));
      expect(text).toContain('Fiktive Schriftlizenz OFL für den Schleusen-Test\nZweite Zeile');
    },
    MITTEL,
  );

  it(
    '[R-H-11] module repo-relativ mit «/» und sortiert (Einstieg, Teilmodul, npm-Paket); bytes = Dateigrösse',
    async () => {
      const sb = neueSandbox();
      const root = probeRepo(sb);
      const aus = join(root, AUS);
      const r = await baue(root, join(root, 'src/probe/main.tsx'), aus);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(r.module).toContain('src/probe/main.tsx');
      expect(r.module).toContain('src/probe/teil.ts');
      expect(r.module).toContain('src/assets/fiktiv/schrift.ts');
      expect(r.module.some((m) => m.startsWith('node_modules/classcat/'))).toBe(true);
      expect([...r.module].sort()).toEqual(r.module);
      for (const m of r.module) {
        expect(m, m).not.toMatch(/^(?:[A-Za-z]:|\/|\.\.)|\\/);
      }
      expect(r.bytes).toBe(statSync(aus).size);
    },
    MITTEL,
  );

  it(
    '[R-H-11] versionierte Ausgabe (unter cwd, ausserhalb test-results/) ohne Durchstich-Modul → grün',
    async () => {
      const sb = neueSandbox();
      const root = probeRepo(sb);
      const aus = join(root, 'docs', 'zwischenstand', 'probe.html');
      const r = await baue(root, join(root, 'src/probe/main.tsx'), aus);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(aus)).toBe(true);
    },
    MITTEL,
  );
});

describe('buildEinzeldatei: rot, ohne etwas zu schreiben', () => {
  /** Erwartet einen roten Schritt mit Ursache; die Ausgabe fehlt bzw. bleibt unverändert. */
  async function rotOhneSchreiben(
    root: string,
    entry: string,
    outFile: string,
    vorher: string | null = null,
  ): Promise<string> {
    if (vorher !== null)
      writeText(root, outFile.slice(root.length + 1).replace(/\\/g, '/'), vorher);
    const r = await baue(root, entry, outFile);
    expect(r.ok).toBe(false);
    expect((r.ursache ?? '').length).toBeGreaterThan(0);
    expect((r.naechsterSchritt ?? '').length).toBeGreaterThan(0);
    if (vorher === null) expect(existsSync(outFile), 'Ausgabe wurde geschrieben').toBe(false);
    else expect(readFileSync(outFile, 'utf8'), 'Ausgabe wurde geändert').toBe(vorher);
    return r.ursache ?? '';
  }

  it(
    '[R-H-11] Einstieg fehlt; Einstieg ausserhalb cwd → rot',
    async () => {
      const sb = neueSandbox();
      const root = probeRepo(sb);
      await rotOhneSchreiben(root, join(root, 'src/probe/gibt-es-nicht.tsx'), join(root, AUS));
      writeText(sb.base, 'aussen/main.tsx', "document.title = 'aussen';\nexport {};\n");
      await rotOhneSchreiben(root, join(sb.base, 'aussen', 'main.tsx'), join(root, AUS));
    },
    MITTEL,
  );

  it(
    '[R-H-11] Ausgabe kein .html (.htm, .txt) bzw. unter dist/ → rot',
    async () => {
      const sb = neueSandbox();
      const root = probeRepo(sb);
      const e = join(root, 'src/probe/main.tsx');
      await rotOhneSchreiben(
        root,
        e,
        join(root, 'test-results', 'wap', 'einzeldatei', 'probe.htm'),
      );
      await rotOhneSchreiben(
        root,
        e,
        join(root, 'test-results', 'wap', 'einzeldatei', 'probe.txt'),
      );
      await rotOhneSchreiben(root, e, join(root, 'dist', 'probe.html'));
      await rotOhneSchreiben(root, e, join(root, 'dist', 'unter', 'probe.html'));
    },
    MITTEL,
  );

  it(
    '[R-H-11] Modul ausserhalb cwd → rot; eine vorhandene Ausgabe bleibt unverändert',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb);
      writeText(sb.base, 'aussen/teil.ts', "export const t = 'aussen';\n");
      writeText(
        root,
        'src/probe/main.tsx',
        "import { t } from '../../../aussen/teil';\ndocument.title = t;\nexport {};\n",
      );
      await rotOhneSchreiben(root, join(root, 'src/probe/main.tsx'), join(root, AUS), 'ALT\n');
    },
    MITTEL,
  );

  it.each([['reference/'], ['.qa/'], ['fixtures-private/'], ['test-results/']])(
    '[R-H-11] Modul unter %s → rot',
    async (ordner) => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb);
      writeText(root, `${ordner}fiktiv/teil.ts`, "export const t = 'fiktiv';\n");
      writeText(
        root,
        'src/probe/main.tsx',
        `import { t } from '../../${ordner}fiktiv/teil';\ndocument.title = t;\nexport {};\n`,
      );
      await rotOhneSchreiben(root, join(root, 'src/probe/main.tsx'), join(root, AUS));
    },
    MITTEL,
  );

  it(
    '[R-H-11] versionierte Ausgabe mit Modul aus tests/wap/fixtures/durchstich/ → rot; dieselbe Einzeldatei unter test-results/ → grün',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb);
      writeText(
        root,
        'tests/wap/fixtures/durchstich/plan.ts',
        "export const plan = 'Synthetischer Plan';\n",
      );
      writeText(
        root,
        'src/probe/main.tsx',
        "import { plan } from '../../tests/wap/fixtures/durchstich/plan';\ndocument.title = plan;\nexport {};\n",
      );
      const e = join(root, 'src/probe/main.tsx');
      await rotOhneSchreiben(root, e, join(root, 'docs', 'zwischenstand', 'durchstich.html'));
      const r = await baue(root, e, join(root, AUS));
      expect(r.ok, schrittText(r)).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-11] Lizenzdatei fehlt: npm-Paket ohne LICENSE bzw. Asset-Modul ohne OFL.txt/LICENSE* → rot',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb);
      writeText(
        root,
        'node_modules/fiktiv-ohne-lizenz/package.json',
        `${JSON.stringify({ name: 'fiktiv-ohne-lizenz', version: '1.0.0', type: 'module', main: 'index.js' })}\n`,
      );
      writeText(root, 'node_modules/fiktiv-ohne-lizenz/index.js', "export const f = 'fiktiv';\n");
      writeText(
        root,
        'src/probe/main.tsx',
        "import { f } from 'fiktiv-ohne-lizenz';\ndocument.title = f;\nexport {};\n",
      );
      const ursache = await rotOhneSchreiben(
        root,
        join(root, 'src/probe/main.tsx'),
        join(root, AUS),
      );
      expect(ursache).toContain('fiktiv-ohne-lizenz');

      const sb2 = neueSandbox();
      const root2 = einzeldateiRepo(sb2);
      writeText(root2, 'src/assets/fiktiv/schrift.ts', "export const s = 'ohne Lizenz';\n");
      writeText(
        root2,
        'src/probe/main.tsx',
        "import { s } from '../assets/fiktiv/schrift';\ndocument.title = s;\nexport {};\n",
      );
      await rotOhneSchreiben(root2, join(root2, 'src/probe/main.tsx'), join(root2, AUS));
    },
    MITTEL,
  );

  it(
    '[R-H-11] Vite scheitert (Syntaxfehler im Einstieg) → rot',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb);
      writeText(root, 'src/probe/main.tsx', 'export const = ;\n');
      await rotOhneSchreiben(root, join(root, 'src/probe/main.tsx'), join(root, AUS));
    },
    MITTEL,
  );

  it(
    '[R-H-11] Befund der Freigaberegeln über einen echten Einstieg (sourceMappingURL im Skript) verhindert das Schreiben (Notiz Runde 2 Nr 6)',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb);
      writeText(
        root,
        'src/probe/main.tsx',
        "document.title = 'Probe sourceMappingURL=fiktiv.map';\nexport {};\n",
      );
      await rotOhneSchreiben(root, join(root, 'src/probe/main.tsx'), join(root, AUS), 'ALT\n');
    },
    MITTEL,
  );
});

describe('buildEinzeldatei: echte Pfade bei verknüpftem node_modules (Notiz Runde 2 Nr 7)', () => {
  it(
    '[R-H-11] node_modules als Verzeichnis-Junction auf einen Ordner ausserhalb cwd → Paket gilt als innen, grün; module nennt node_modules/classcat/…',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb, 'verknuepft');
      const extern = join(sb.base, 'extern-node-modules');
      cpSync(join(root, 'node_modules'), extern, { recursive: true });
      rmSync(join(root, 'node_modules'), { recursive: true, force: true });
      junction(join(root, 'node_modules'), extern);
      writeText(
        root,
        'src/probe/main.tsx',
        "import cc from 'classcat';\ndocument.title = cc(['a']);\nexport {};\n",
      );
      const aus = join(root, AUS);
      const r = await baue(root, join(root, 'src/probe/main.tsx'), aus);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(aus)).toBe(true);
      expect(r.module.some((m) => m.startsWith('node_modules/classcat/'))).toBe(true);
      for (const m of r.module) expect(m, m).not.toMatch(/extern-node-modules|^\.\./);
    },
    MITTEL,
  );

  it(
    '[R-H-11] Junction unter src/ auf einen Ordner ausserhalb cwd → Modul ausserhalb, rot ohne Schreiben',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb, 'src-junction');
      writeText(sb.base, 'fremd/teil.ts', "export const t = 'fremd';\n");
      junction(join(root, 'src', 'fremd'), join(sb.base, 'fremd'));
      writeText(
        root,
        'src/probe/main.tsx',
        "import { t } from '../fremd/teil';\ndocument.title = t;\nexport {};\n",
      );
      const aus = join(root, AUS);
      const r = await baue(root, join(root, 'src/probe/main.tsx'), aus);
      expect(r.ok).toBe(false);
      expect(existsSync(aus)).toBe(false);
    },
    MITTEL,
  );
});

/** Freigegebene, von Hand präparierte Einzeldatei (Regeln der Notiz Runde 2 Nr 6). */
const CSP_PROBE = FIKTIVE_CSP_TEILE.join('; ');

function probeHtml(
  o: {
    csp?: string | null;
    offline?: string | null;
    skripte?: string[];
    kopf?: string;
    koerper?: string;
    stil?: string;
    lizenz?: boolean;
  } = {},
): string {
  const csp = o.csp === undefined ? CSP_PROBE : o.csp;
  const offline = o.offline === undefined ? 'true' : o.offline;
  const skripte = o.skripte ?? ["(function(){document.title='Probe';})();"];
  return [
    '<!doctype html>',
    `<html lang="de-CH"${offline === null ? '' : ` data-offline="${offline}"`}>`,
    '<head>',
    '<meta charset="UTF-8" />',
    csp === null ? '' : `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
    '<title>Probe</title>',
    `<style>${o.stil ?? '.a{color:#010203}'}</style>`,
    o.kopf ?? '',
    '</head>',
    '<body>',
    '<div id="root"></div>',
    o.koerper ?? '',
    ...skripte.map((s) => (s.startsWith('<script') ? s : `<script>${s}</script>`)),
    o.lizenz === false
      ? ''
      : '<template id="application-licenses"><pre>Fiktive Lizenz</pre></template>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

describe('pruefeEinzeldatei (Freigaberegeln, rein; Notiz Runde 2 Nr 6)', () => {
  async function pruefe(html: string, csp = CSP_PROBE): Promise<string[]> {
    const { pruefeEinzeldatei } = await einzeldateiModul();
    return pruefeEinzeldatei(html, csp);
  }

  it('[R-H-11] freigegebene Einzeldatei (auch url(data:…) im Stil) → keine Befunde; gleiche Eingabe → gleiches Ergebnis', async () => {
    expect(await pruefe(probeHtml())).toEqual([]);
    const mitData = probeHtml({ stil: '.a{background:url(data:image/png;base64,AAAA)}' });
    expect(await pruefe(mitData)).toEqual([]);
    const falsch = probeHtml({ offline: 'false', lizenz: false });
    expect(await pruefe(falsch)).toEqual(await pruefe(falsch));
  });

  const konsole = ['con', 'sole'].join('');
  it.each([
    ['CSP-Meta fehlt', probeHtml({ csp: null })],
    ['CSP weicht ab', probeHtml({ csp: `${CSP_PROBE}; img-src *` })],
    ['data-offline fehlt', probeHtml({ offline: null })],
    ['data-offline nicht true', probeHtml({ offline: 'false' })],
    ['kein Skript', probeHtml({ skripte: [] })],
    ['zwei Skripte', probeHtml({ skripte: ['var a=1;', 'var b=2;'] })],
    ['Skript mit src', probeHtml({ skripte: ['<script src="./fiktiv.js"></script>'] })],
    ['[src] an einem Bild', probeHtml({ koerper: '<img alt="x" src="./fiktiv.png" />' })],
    ['link[href]', probeHtml({ kopf: '<link rel="stylesheet" href="./fiktiv.css" />' })],
    ['iframe', probeHtml({ koerper: '<iframe title="x"></iframe>' })],
    ['object', probeHtml({ koerper: '<object title="x"></object>' })],
    ['embed', probeHtml({ koerper: '<embed title="x" />' })],
    ['type="module"', probeHtml({ skripte: ['<script type="module">var a=1;</script>'] })],
    ['sourceMappingURL', probeHtml({ skripte: ['var a=1;\n//# sourceMappingURL=fiktiv.map'] })],
    ['console.', probeHtml({ skripte: [`${konsole}.info(1);`] })],
    ['console[', probeHtml({ skripte: [`${konsole}['info'](1);`] })],
    ['@import im Stil', probeHtml({ stil: '@import "fiktiv.css";.a{color:#010203}' })],
    [
      'url(http…) im Stil',
      probeHtml({ stil: '.a{background:url(https://beispiel.invalid/x.png)}' }),
    ],
    [
      'url( http…) mit Anführung im Stil',
      probeHtml({ stil: ".a{background:url( 'http://beispiel.invalid/x.png')}" }),
    ],
    ['Lizenzblock fehlt', probeHtml({ lizenz: false })],
  ])('[R-H-11] %s → mindestens ein Befund', async (_regel, html) => {
    const befunde = await pruefe(html);
    expect(befunde.length).toBeGreaterThan(0);
    for (const b of befunde) expect(b.trim().length).toBeGreaterThan(0);
  });

  it('[R-H-11] zwei unabhängige Verstösse (Lizenzblock fehlt und iframe) → mindestens zwei Befunde', async () => {
    const html = probeHtml({ lizenz: false, koerper: '<iframe title="x"></iframe>' });
    expect((await pruefe(html)).length).toBeGreaterThanOrEqual(2);
  });

  it('[R-H-11] die erwartete CSP ist der zweite Parameter: dieselbe Datei gegen eine andere CSP → Befund', async () => {
    expect(await pruefe(probeHtml(), CSP_PROBE)).toEqual([]);
    expect((await pruefe(probeHtml(), "default-src 'none'")).length).toBeGreaterThan(0);
  });
});

describe('suiteCsp', () => {
  it("[R-H-11] verbindet die Zeichenketten zwischen «const csp = [» und «].join('; ')» mit «; »", async () => {
    const sb = neueSandbox();
    const teile = ["default-src 'none'", 'img-src data: blob:', "frame-src 'none'"];
    writeText(sb.base, 'tools/build-offline.mjs', fiktivesBuildSkript(teile));
    const { suiteCsp } = await einzeldateiModul();
    expect(suiteCsp(sb.base)).toBe("default-src 'none'; img-src data: blob:; frame-src 'none'");
  });

  it('[R-H-11] CSP der Suite (tools/build-offline.mjs dieses Checkouts) enthält die Pflichtregeln der Freigabeprüfung', async () => {
    const { suiteCsp } = await einzeldateiModul();
    const csp = suiteCsp(WT);
    for (const d of [
      "default-src 'none'",
      "connect-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
    ]) {
      expect(csp.split('; '), d).toContain(d);
    }
  });

  it('[R-H-11] ohne CSP-Abschnitt bzw. ohne tools/build-offline.mjs → wirft «CSP der Suite nicht gefunden»', async () => {
    const sb = neueSandbox();
    const { suiteCsp } = await einzeldateiModul();
    expect(() => suiteCsp(sb.base)).toThrow('CSP der Suite nicht gefunden');
    writeText(
      sb.base,
      'tools/build-offline.mjs',
      "const policy = ['x'].join(', ');\nexport { policy };\n",
    );
    expect(() => suiteCsp(sb.base)).toThrow('CSP der Suite nicht gefunden');
  });
});

describe('einzeldatei.mjs als CLI', () => {
  it(
    '[R-H-11] --entry --out --titel (relativ zum Aufrufverzeichnis) → Exit 0 und Datei; fehlende Angaben → Exit ≠ 0',
    () => {
      const sb = neueSandbox();
      const root = probeRepo(sb);
      const cli = join(WT, 'scripts', 'wap-gate', 'einzeldatei.mjs');
      const r = node(
        cli,
        [
          '--entry',
          'src/probe/main.tsx',
          '--out',
          'test-results/wap/einzeldatei/cli.html',
          '--titel',
          'Probe CLI',
        ],
        { cwd: root, env: sb.env, timeout: MITTEL },
      );
      expect(r.status, r.out).toBe(0);
      const datei = join(root, 'test-results', 'wap', 'einzeldatei', 'cli.html');
      expect(dokument(datei).title).toBe('Probe CLI');
      const ohne = node(cli, ['--entry', 'src/probe/main.tsx'], {
        cwd: root,
        env: sb.env,
        timeout: KURZ,
      });
      expect(ohne.status).not.toBe(0);
    },
    MITTEL,
  );
});
