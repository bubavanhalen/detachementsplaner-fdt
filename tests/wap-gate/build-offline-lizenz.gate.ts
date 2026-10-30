// tools/build-offline.mjs mit gebündeltem npm-Paket ohne LICENSE*: Lizenztext über npmLizenz (Ersatzliste
// tools/wap/licenses/npm-ersatz.json); Befunde brechen vor dem Leeren von dist/ ab (R-H-11; Grundlage R-H-23, E1-01e; Prompt §7
// Lizenzprüfung, ADR-010 §9, Q-031). Fälle O1–O3 der Notiz Nr 10, O4 (Auflage TR-E101-L03). Fiktives Mini-Repo mit Kopien von
// tools/{build-offline,verify-release,smoke-offline}.mjs und tools/wap/npm-lizenz.mjs, fiktiver App-Lizenz,
// fiktiver OFL.txt, fiktivem Paket und Junctions auf vite, @vitejs/plugin-react und jsdom des Paket-Worktrees.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, «Änderungsnotiz Lizenzen ohne LICENSE-Datei» Nr 6, 10.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  eintrag,
  exportName,
  FIKTIVE_HERKUNFT,
  fiktiverText,
  fiktivesPaket,
  NPM_LIZENZ_MODUL,
  schreibeEintraege,
  schreibeText,
} from './support/npm-lizenz';
import {
  aufraeumen,
  junction,
  kopiereAusWt,
  MITTEL,
  neueSandbox,
  node,
  type Sandbox,
  WT,
  writeText,
} from './support/umgebung';
import { type JsdomKlasse, jsdomKlasse, normalisiert } from './support/vertrag-b';

afterEach(aufraeumen);

let JSDOM: JsdomKlasse;

beforeAll(async () => {
  JSDOM = await jsdomKlasse();
});

const PAKET = 'fiktiv-ohne';

/** Fiktive Vorlage mit den Platzhaltern von tools/build-offline.mjs (wie index.html der Suite). */
const VORLAGE = [
  '<!doctype html>',
  '<html lang="de-CH">',
  '  <head>',
  '    <meta charset="UTF-8" />',
  '    <title>Fiktive Probe</title>',
  '    <!--OFFLINE-CSP-->',
  '    <!--OFFLINE-STYLES-->',
  '  </head>',
  '  <body>',
  '    <div id="root"></div>',
  '    <!--BOOT-->',
  '    <script type="module" src="/src/main.tsx"></script>',
  '  </body>',
  '</html>',
  '',
].join('\n');

/**
 * Kopiert das gemeinsame Modul, sofern es im Paket-Worktree liegt. Heute fehlt es, und das unveränderte
 * Build-Skript braucht es nicht (O1 ist eine Regression); nach der Umsetzung importiert build-offline.mjs es,
 * ohne Kopie scheiterte jeder Fall am Import statt an seiner Erwartung.
 */
function kopiereModulWennVorhanden(root: string): void {
  const quelle = join(WT, ...NPM_LIZENZ_MODUL.split('/'));
  if (!existsSync(quelle)) return;
  const ziel = join(root, ...NPM_LIZENZ_MODUL.split('/'));
  mkdirSync(dirname(ziel), { recursive: true });
  copyFileSync(quelle, ziel);
}

/** Mini-Repo für node tools/build-offline.mjs; das fiktive Paket hat keine LICENSE*. */
function offlineRepo(sb: Sandbox, pkg: Record<string, unknown> = {}): string {
  const root = join(sb.base, 'offline');
  mkdirSync(root, { recursive: true });
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'fiktiv-offline', private: true, type: 'module' }, null, 2)}\n`,
  );
  for (const rel of [
    'tools/build-offline.mjs',
    'tools/verify-release.mjs',
    'tools/smoke-offline.mjs',
  ]) {
    kopiereAusWt(root, rel);
  }
  kopiereModulWennVorhanden(root);
  writeText(root, 'index.html', VORLAGE);
  writeText(
    root,
    'LICENSE',
    'MIT License\n\nFiktive App-Lizenz für Schleusen-Test build-offline.\n',
  );
  writeText(
    root,
    'src/assets/wap-fonts/OFL.txt',
    'Fiktive Schriftlizenz OFL für den Schleusen-Test\n',
  );
  for (const p of ['vite', '@vitejs/plugin-react', 'jsdom']) {
    junction(
      join(root, 'node_modules', ...p.split('/')),
      join(WT, 'node_modules', ...p.split('/')),
    );
  }
  fiktivesPaket(root, PAKET, { pkg });
  writeText(
    root,
    'src/main.tsx',
    [
      `import { ${exportName(PAKET)} } from '${PAKET}';`,
      "const root = document.getElementById('root');",
      `if (root !== null) root.textContent = ${exportName(PAKET)};`,
      'export {};',
      '',
    ].join('\n'),
  );
  return root;
}

function baue(sb: Sandbox, root: string) {
  return node(join(root, 'tools', 'build-offline.mjs'), [], {
    cwd: root,
    env: sb.env,
    timeout: MITTEL,
  });
}

/** Lizenzblock einer gebauten Datei, normalisiert. */
function lizenzblock(datei: string): string {
  const doc = new JSDOM(readFileSync(datei, 'utf8')).window.document;
  const vorlage = doc.querySelector('template#application-licenses') as HTMLTemplateElement | null;
  expect(vorlage, 'Lizenzblock fehlt').not.toBeNull();
  return normalisiert(vorlage?.content.textContent ?? '');
}

describe('tools/build-offline.mjs: npm-Paket ohne LICENSE*', () => {
  it(
    '[R-H-11] O1 (Regression, heute grün) ohne Eintrag → Exit ≠ 0, «Bundled dependency licence missing: <paket>», kein dist/',
    () => {
      const sb = neueSandbox();
      const root = offlineRepo(sb);
      const r = baue(sb, root);
      expect(r.status, r.out).not.toBe(0);
      expect(r.out).toContain(`Bundled dependency licence missing: ${PAKET}`);
      expect(existsSync(join(root, 'dist')), 'dist/ wurde angelegt').toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-11] O2 GPL-3.0 mit Eintrag → Exit ≠ 0, «Bundled dependency licence fallback invalid: Lizenz nicht erlaubt …», vorhandenes dist/ bleibt',
    () => {
      const sb = neueSandbox();
      const root = offlineRepo(sb, { license: 'GPL-3.0' });
      schreibeEintraege(root, [eintrag(PAKET, { lizenz: 'GPL-3.0' })]);
      schreibeText(root, `tools/wap/licenses/${PAKET}.txt`, fiktiverText(PAKET));
      writeText(root, 'dist/alt.txt', 'ALT\n');
      const r = baue(sb, root);
      expect(r.status, r.out).not.toBe(0);
      expect(r.out).toContain(
        `Bundled dependency licence fallback invalid: Lizenz nicht erlaubt für Ersatztext: ${PAKET} (GPL-3.0)`,
      );
      expect(r.out).not.toContain('Bundled dependency licence missing');
      expect(readFileSync(join(root, 'dist', 'alt.txt'), 'utf8'), 'dist/ wurde geleert').toBe(
        'ALT\n',
      );
      expect(existsSync(join(root, 'dist', 'index.html'))).toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-11] O2 ohne dist/ vorher: GPL-3.0 → kein dist/',
    () => {
      const sb = neueSandbox();
      const root = offlineRepo(sb, { license: 'GPL-3.0' });
      schreibeEintraege(root, [eintrag(PAKET, { lizenz: 'GPL-3.0' })]);
      schreibeText(root, `tools/wap/licenses/${PAKET}.txt`, fiktiverText(PAKET));
      const r = baue(sb, root);
      expect(r.status, r.out).not.toBe(0);
      expect(r.out).toContain('Bundled dependency licence fallback invalid: ');
      expect(existsSync(join(root, 'dist')), 'dist/ wurde angelegt').toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-11] O3 gültiger Eintrag → Exit 0; Block «<paket>\\n<text>» in dist/index.html und dist/offline.html',
    () => {
      const sb = neueSandbox();
      const root = offlineRepo(sb);
      schreibeEintraege(root, [eintrag(PAKET)]);
      const text = fiktiverText(PAKET);
      schreibeText(root, `tools/wap/licenses/${PAKET}.txt`, text);
      const r = baue(sb, root);
      expect(r.status, r.out).toBe(0);
      for (const datei of ['index.html', 'offline.html']) {
        const block = lizenzblock(join(root, 'dist', datei));
        expect(block, datei).toContain(normalisiert(`${PAKET}\n${text}`));
        expect(block, datei).toContain('Fiktive App-Lizenz für Schleusen-Test build-offline.');
        expect(block, datei).toContain('Fiktive Schriftlizenz OFL für den Schleusen-Test');
      }
    },
    MITTEL,
  );

  it(
    '[R-H-11] O4 (Regression, heute grün) eigene LICENSE und gültiger Eintrag → Exit 0; Block mit dem LICENSE-Text, ohne Ersatztext (Auflage TR-E101-L03)',
    () => {
      const sb = neueSandbox();
      const root = offlineRepo(sb);
      const lizenz = 'MIT License\n\nEigene fiktive Paketlizenz O4.\n';
      writeText(root, `node_modules/${PAKET}/LICENSE`, lizenz);
      schreibeEintraege(root, [eintrag(PAKET)]);
      schreibeText(root, `tools/wap/licenses/${PAKET}.txt`, fiktiverText(PAKET));
      const r = baue(sb, root);
      expect(r.status, r.out).toBe(0);
      for (const datei of ['index.html', 'offline.html']) {
        const block = lizenzblock(join(root, 'dist', datei));
        expect(block, datei).toContain(normalisiert(`${PAKET}\n${lizenz}`));
        expect(block, datei).not.toContain(FIKTIVE_HERKUNFT);
      }
    },
    MITTEL,
  );
});
