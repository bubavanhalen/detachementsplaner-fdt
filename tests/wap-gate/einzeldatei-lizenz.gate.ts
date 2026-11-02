// buildEinzeldatei mit gebündelten npm-Paketen ohne LICENSE*: Lizenztext über npmLizenz (Ersatzliste
// tools/wap/licenses/npm-ersatz.json); jeder Befund ist rot, ohne zu schreiben (R-H-11, Prompt §7
// Lizenzprüfung, ADR-010 §9, Q-031). Fälle B1–B5 der Notiz Nr 10 (B4b: ungültige Liste höchstens einmal,
// Notiz Nr 4). Fiktive Mini-Repos; B5 bündelt pdf-lib und fontkit aus node_modules des Paket-Worktrees
// (Verzeichnis-Junction, keine Installation), Liste und Rückfalltexte aus dem Checkout kopiert.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 (buildEinzeldatei) und «Änderungsnotiz Lizenzen ohne
// LICENSE-Datei» Nr 4, 5, 8, 10.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  eintrag,
  exportName,
  FIKTIVE_HERKUNFT,
  fiktiverText,
  fiktivesPaket,
  LISTE_UNGUELTIG,
  NAECHSTER_SCHRITT_ERSATZ,
  schreibeEintraege,
  schreibeListe,
  schreibeText,
  wtText,
} from './support/npm-lizenz';
import {
  aufraeumen,
  kopiereAusWt,
  MITTEL,
  neueSandbox,
  neuesRepo,
  nodeModules,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import {
  einzeldateiModul,
  einzeldateiRepo,
  FIKTIVE_APP_LIZENZ,
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

const AUS = 'test-results/wap/einzeldatei/lizenz.html';
const EINSTIEG = 'src/probe/main.tsx';

/** Einstieg, der die Exporte der fiktiven Pakete in #root schreibt (alle Pakete werden gebündelt). */
function einstieg(root: string, pakete: string[]): string {
  writeText(
    root,
    EINSTIEG,
    [
      ...pakete.map((p) => `import { ${exportName(p)} } from '${p}';`),
      "const root = document.getElementById('root');",
      `if (root !== null) root.textContent = [${pakete.map(exportName).join(', ')}].join(' ');`,
      'export {};',
      '',
    ].join('\n'),
  );
  return join(root, EINSTIEG);
}

async function baue(root: string, entry: string, outFile: string) {
  const { buildEinzeldatei } = await einzeldateiModul();
  return buildEinzeldatei({ cwd: root, entry, outFile, titel: 'Probe Lizenz' });
}

/** Text des Lizenzblocks (template#application-licenses), normalisiert. */
function lizenzblock(datei: string): string {
  const doc = new JSDOM(readFileSync(datei, 'utf8')).window.document;
  const vorlage = doc.querySelector('template#application-licenses') as HTMLTemplateElement | null;
  expect(vorlage, 'Lizenzblock fehlt').not.toBeNull();
  return normalisiert(vorlage?.content.textContent ?? '');
}

/** Erwartet rot mit Ursache und nächstem Schritt; eine vorhandene Ausgabe bleibt unverändert. */
async function rotOhneSchreiben(
  root: string,
  entry: string,
): Promise<{ ursache: string; naechsterSchritt: string }> {
  const aus = join(root, AUS);
  writeText(root, AUS, 'ALT\n');
  const r = await baue(root, entry, aus);
  expect(r.ok, schrittText(r)).toBe(false);
  expect(readFileSync(aus, 'utf8'), 'Ausgabe wurde geändert').toBe('ALT\n');
  return { ursache: r.ursache ?? '', naechsterSchritt: r.naechsterSchritt ?? '' };
}

describe('buildEinzeldatei: Ersatztext für npm-Pakete ohne LICENSE*', () => {
  it(
    '[R-H-11] B1 fiktives Paket ohne LICENSE mit gültigem Eintrag → grün; Lizenzblock enthält «<paket>\\n<text>» (normalisiert), App-Lizenz bleibt',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb, 'b1');
      const paket = 'fiktiv-ersatz';
      fiktivesPaket(root, paket);
      schreibeEintraege(root, [eintrag(paket)]);
      const text = fiktiverText(paket);
      schreibeText(root, `tools/wap/licenses/${paket}.txt`, text);
      const aus = join(root, AUS);
      const r = await baue(root, einstieg(root, [paket]), aus);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(r.module).toContain(`node_modules/${paket}/index.js`);
      const block = lizenzblock(aus);
      expect(block).toContain(normalisiert(`${paket}\n${text}`));
      expect(block).toContain(normalisiert(FIKTIVE_APP_LIZENZ));
      expect(block).toContain(FIKTIVE_HERKUNFT);
    },
    MITTEL,
  );

  it(
    '[R-H-11] B1 Gegenprobe: Paket mit eigener LICENSE und Eintrag → Block mit der Paketdatei, nicht mit dem Ersatztext',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb, 'b1-eigen');
      const paket = 'fiktiv-eigen';
      fiktivesPaket(root, paket, { lizenzDateien: { LICENSE: 'Eigene fiktive Paketlizenz B1\n' } });
      schreibeEintraege(root, [eintrag(paket)]);
      schreibeText(root, `tools/wap/licenses/${paket}.txt`, fiktiverText(paket));
      const aus = join(root, AUS);
      const r = await baue(root, einstieg(root, [paket]), aus);
      expect(r.ok, schrittText(r)).toBe(true);
      const block = lizenzblock(aus);
      expect(block).toContain(normalisiert(`${paket}\nEigene fiktive Paketlizenz B1`));
      expect(block).not.toContain(FIKTIVE_HERKUNFT);
    },
    MITTEL,
  );

  it(
    '[R-H-11] B2 (Regression, heute grün) Liste ohne Eintrag für das Paket → rot «Lizenzdatei fehlt: <paket>», nichts geschrieben',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb, 'b2');
      fiktivesPaket(root, 'fiktiv-ohne');
      schreibeEintraege(root, [eintrag('fiktiv-anderes')]);
      schreibeText(root, 'tools/wap/licenses/fiktiv-anderes.txt', fiktiverText('fiktiv-anderes'));
      const { ursache } = await rotOhneSchreiben(root, einstieg(root, ['fiktiv-ohne']));
      expect(ursache).toBe('Lizenzdatei fehlt: fiktiv-ohne');
    },
    MITTEL,
  );

  it(
    '[R-H-11] B3 GPL-3.0 mit Eintrag → rot «Lizenz nicht erlaubt für Ersatztext», nächster Schritt nennt die Ersatzliste, nichts geschrieben',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb, 'b3');
      const paket = 'fiktiv-gpl';
      fiktivesPaket(root, paket, { pkg: { license: 'GPL-3.0' } });
      schreibeEintraege(root, [eintrag(paket, { lizenz: 'GPL-3.0' })]);
      schreibeText(root, `tools/wap/licenses/${paket}.txt`, fiktiverText(paket));
      const { ursache, naechsterSchritt } = await rotOhneSchreiben(root, einstieg(root, [paket]));
      expect(ursache).toBe('Lizenz nicht erlaubt für Ersatztext: fiktiv-gpl (GPL-3.0)');
      expect(naechsterSchritt).toContain(NAECHSTER_SCHRITT_ERSATZ);
    },
    MITTEL,
  );

  it(
    '[R-H-11] B4 zwei Pakete (eines ohne Eintrag, eines mit falscher Version) → beide Meldungen in einer ursache, «Lizenzdatei fehlt» zuerst',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb, 'b4');
      // Der Paketname mit Versionsfehler sortiert vor dem fehlenden: «Lizenzdatei fehlt» steht trotzdem vorn.
      fiktivesPaket(root, 'fiktiv-a-version');
      fiktivesPaket(root, 'fiktiv-b-fehlt');
      schreibeEintraege(root, [eintrag('fiktiv-a-version', { version: '2.0.0' })]);
      schreibeText(
        root,
        'tools/wap/licenses/fiktiv-a-version.txt',
        fiktiverText('fiktiv-a-version'),
      );
      const { ursache, naechsterSchritt } = await rotOhneSchreiben(
        root,
        einstieg(root, ['fiktiv-a-version', 'fiktiv-b-fehlt']),
      );
      expect(ursache).toBe(
        'Lizenzdatei fehlt: fiktiv-b-fehlt; Ersatz-Lizenz für andere Version: fiktiv-a-version (installiert 1.0.0, Eintrag 2.0.0)',
      );
      expect(naechsterSchritt).toContain(NAECHSTER_SCHRITT_ERSATZ);
    },
    MITTEL,
  );

  it(
    '[R-H-11] B4 drei Befunde: übrige Meldungen nach «Lizenzdatei fehlt» in Paketreihenfolge, getrennt durch «; »',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb, 'b4-drei');
      fiktivesPaket(root, 'fiktiv-a-lizenz', { pkg: { license: 'ISC' } });
      fiktivesPaket(root, 'fiktiv-b-fehlt');
      fiktivesPaket(root, 'fiktiv-c-text');
      schreibeEintraege(root, [eintrag('fiktiv-a-lizenz'), eintrag('fiktiv-c-text')]);
      schreibeText(root, 'tools/wap/licenses/fiktiv-a-lizenz.txt', fiktiverText('fiktiv-a-lizenz'));
      schreibeText(
        root,
        'tools/wap/licenses/fiktiv-c-text.txt',
        fiktiverText('fiktiv-c-text', null),
      );
      const { ursache } = await rotOhneSchreiben(
        root,
        einstieg(root, ['fiktiv-c-text', 'fiktiv-b-fehlt', 'fiktiv-a-lizenz']),
      );
      expect(ursache).toBe(
        [
          'Lizenzdatei fehlt: fiktiv-b-fehlt',
          'Ersatz-Lizenz passt nicht: fiktiv-a-lizenz (package.json ISC, Eintrag MIT)',
          'Ersatz-Lizenztext ohne Herkunftsvermerk: fiktiv-c-text',
        ].join('; '),
      );
    },
    MITTEL,
  );

  it(
    '[R-H-11] B4b ungültige Liste bei zwei Paketen ohne LICENSE → rot, «Ersatz-Lizenzliste ungültig» genau einmal, nichts geschrieben',
    async () => {
      const sb = neueSandbox();
      const root = einzeldateiRepo(sb, 'b4b');
      fiktivesPaket(root, 'fiktiv-eins');
      fiktivesPaket(root, 'fiktiv-zwei');
      schreibeListe(root, { version: 2, ersatz: [eintrag('fiktiv-eins'), eintrag('fiktiv-zwei')] });
      schreibeText(root, 'tools/wap/licenses/fiktiv-eins.txt', fiktiverText('fiktiv-eins'));
      schreibeText(root, 'tools/wap/licenses/fiktiv-zwei.txt', fiktiverText('fiktiv-zwei'));
      const { ursache } = await rotOhneSchreiben(
        root,
        einstieg(root, ['fiktiv-eins', 'fiktiv-zwei']),
      );
      expect(ursache.split(LISTE_UNGUELTIG).length - 1, ursache).toBe(1);
    },
    MITTEL,
  );
});

describe('buildEinzeldatei: echtes Bündel pdf-lib und fontkit (B5)', () => {
  /** Repo mit node_modules als Junction auf den Paket-Worktree; Liste und Rückfalltexte aus dem Checkout. */
  function pdfRepo(sb: Sandbox): string {
    const root = neuesRepo(sb, 'b5');
    writeText(
      root,
      'package.json',
      `${JSON.stringify({ name: 'fiktiv-einzeldatei-pdf', private: true, type: 'module' }, null, 2)}\n`,
    );
    writeText(root, 'LICENSE', FIKTIVE_APP_LIZENZ);
    writeText(root, 'tools/build-offline.mjs', fiktivesBuildSkript());
    nodeModules(root);
    for (const rel of [
      'tools/wap/licenses/npm-ersatz.json',
      'tools/wap/licenses/brotli.txt',
      'tools/wap/licenses/dfa.txt',
      'tools/wap/licenses/fontkit.txt',
    ]) {
      kopiereAusWt(root, rel);
    }
    writeText(
      root,
      EINSTIEG,
      [
        "import { PDFDocument } from 'pdf-lib';",
        "import * as fontkit from 'fontkit';",
        'void PDFDocument.create().then((d) => {',
        '  d.registerFontkit(fontkit as never);',
        "  const root = document.getElementById('root');",
        '  if (root !== null) root.textContent = String(d.getPageCount());',
        '});',
        'export {};',
        '',
      ].join('\n'),
    );
    return root;
  }

  it(
    '[R-H-11] B5 Einstieg mit pdf-lib und fontkit → grün; Lizenzblock enthält brotli, dfa und fontkit je mit Rückfalltext und Herkunftsvermerk',
    async () => {
      const sb = neueSandbox();
      const root = pdfRepo(sb);
      const aus = join(root, AUS);
      const r = await baue(root, join(root, EINSTIEG), aus);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(aus)).toBe(true);
      for (const p of ['brotli', 'dfa', 'fontkit']) {
        expect(
          r.module.some((m) => m.startsWith(`node_modules/${p}/`)),
          p,
        ).toBe(true);
      }
      const liste = JSON.parse(wtText('tools/wap/licenses/npm-ersatz.json')) as {
        ersatz: { paket: string; herkunft: string }[];
      };
      const block = lizenzblock(aus);
      for (const p of ['brotli', 'dfa', 'fontkit']) {
        const herkunft = liste.ersatz.find((e) => e.paket === p)?.herkunft ?? '';
        expect(herkunft.length, `herkunft ${p}`).toBeGreaterThan(0);
        const text = wtText(`tools/wap/licenses/${p}.txt`);
        expect(text).toContain(herkunft);
        expect(block, p).toContain(normalisiert(`${p}\n${text}`));
      }
      expect(block).toContain('pdf-lib');
    },
    MITTEL,
  );
});
