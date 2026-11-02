// Einzeldatei immer im Produktionsmodus (Nachtrag-Test W4; R-H-11): Erbt buildEinzeldatei NODE_ENV=test (z.B.
// aus Vitest), darf Vite nicht den JSX-Entwicklungspfad (jsxDEV) mit der Produktions-React-Bibliothek bündeln;
// sonst bricht die Einzeldatei im Browser ab («jsxDEV is not a function»). Nach dem Bau ist process.env.NODE_ENV
// wieder der geerbte Wert, auch nach einem roten Bau.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, Orchestrator-Zeile vom 05.10.2026 (V1a-selbsttest rot,
// zusammen mit dem Workspace-Nachtrag). Geprüft wird der Bündelinhalt. Fiktive TSX-Harness; node_modules als
// Junction auf den Paket-Worktree (React); Sperrliste fiktiv (WAP_REFERENCE_DIR).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aufraeumen,
  MITTEL,
  neueSandbox,
  neuesRepo,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { einzeldateiModul, FIKTIVE_APP_LIZENZ, fiktivesBuildSkript } from './support/vertrag-b';

afterEach(aufraeumen);

// Fiktive Sperrliste (WAP_REFERENCE_DIR) für jeden Test: zeigePfad liest nie die echte Liste (AGENTS.md).
beforeEach(() => {
  prozessUmgebung(neueSandbox());
});

const AUS = 'test-results/wap/einzeldatei/produktion.html';
const EINSTIEG = 'tests/wap-e2e/harness/zz-produktion.tsx';

/** Fiktive TSX-Harness mit React (JSX), hängt sich in #root ein. */
const HARNESS = [
  "import { useState } from 'react';",
  "import { createRoot } from 'react-dom/client';",
  '',
  'function Probe() {',
  '  const [n] = useState(1);',
  '  return <p>Fiktive Produktionsprobe {n}</p>;',
  '}',
  '',
  "const el = document.getElementById('root');",
  'if (el !== null) createRoot(el).render(<Probe />);',
  '',
].join('\n');

/** Mini-Repo wie für die Harness-Bauten von runE2e: LICENSE, fiktive CSP, node_modules als Junction. */
function reactRepo(sb: Sandbox): string {
  prozessUmgebung(sb);
  const root = neuesRepo(sb, 'produktion');
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'fiktiv-produktion', private: true, type: 'module' }, null, 2)}\n`,
  );
  writeText(root, 'LICENSE', FIKTIVE_APP_LIZENZ);
  writeText(root, 'tools/build-offline.mjs', fiktivesBuildSkript());
  nodeModules(root);
  return root;
}

async function baue(root: string) {
  const { buildEinzeldatei } = await einzeldateiModul();
  return buildEinzeldatei({
    cwd: root,
    entry: join(root, ...EINSTIEG.split('/')),
    outFile: join(root, ...AUS.split('/')),
    titel: 'Produktionsprobe',
  });
}

describe('buildEinzeldatei im Produktionsmodus (W4)', () => {
  it(
    '[R-H-11] W4 TSX-Harness mit geerbtem NODE_ENV=test → grün, Bündel ohne jsxDEV und ohne jsx-dev-runtime; danach ist process.env.NODE_ENV wieder test',
    async () => {
      const sb = neueSandbox();
      const root = reactRepo(sb);
      writeText(root, EINSTIEG, HARNESS);
      vi.stubEnv('NODE_ENV', 'test');
      const r = await baue(root);
      expect(process.env.NODE_ENV, 'NODE_ENV nach dem Bau').toBe('test');
      expect(r.ok, schrittText(r)).toBe(true);
      const html = readFileSync(join(root, ...AUS.split('/')), 'utf8');
      expect(html).toContain('Fiktive Produktionsprobe');
      expect(html, 'JSX-Entwicklungspfad gebündelt').not.toContain('jsxDEV');
      expect(html, 'JSX-Entwicklungs-Laufzeit gebündelt').not.toContain('jsx-dev-runtime');
    },
    MITTEL,
  );

  it(
    '[R-H-11] W4 roter Bau (Syntaxfehler) mit NODE_ENV=test → danach ist process.env.NODE_ENV wieder test; ein folgender Bau derselben Harness ist ohne jsxDEV',
    async () => {
      const sb = neueSandbox();
      const root = reactRepo(sb);
      writeText(root, EINSTIEG, 'export const = ;\n');
      vi.stubEnv('NODE_ENV', 'test');
      const rot = await baue(root);
      expect(rot.ok).toBe(false);
      expect(process.env.NODE_ENV, 'NODE_ENV nach dem roten Bau').toBe('test');
      writeText(root, EINSTIEG, HARNESS);
      const r = await baue(root);
      expect(r.ok, schrittText(r)).toBe(true);
      expect(process.env.NODE_ENV, 'NODE_ENV nach dem grünen Bau').toBe('test');
      const html = readFileSync(join(root, ...AUS.split('/')), 'utf8');
      expect(html, 'JSX-Entwicklungspfad gebündelt').not.toContain('jsxDEV');
    },
    MITTEL,
  );

  /** Ist NODE_ENV im Prozess gar nicht gesetzt (auch nicht als Zeichenkette «undefined»)? */
  const nodeEnvFehlt = () =>
    process.env.NODE_ENV === undefined &&
    !Object.keys(process.env).some((k) => k.toUpperCase() === 'NODE_ENV');

  it(
    '[R-H-11] W4 ohne NODE_ENV: grüner Bau → Bündel ohne jsxDEV, danach ist NODE_ENV weiter nicht gesetzt; roter Bau → ebenso nicht gesetzt (Orchestrator-Zeile c)',
    async () => {
      const sb = neueSandbox();
      const root = reactRepo(sb);
      writeText(root, EINSTIEG, HARNESS);
      vi.stubEnv('NODE_ENV', undefined);
      expect(nodeEnvFehlt(), 'Test-Aufbau: NODE_ENV vor dem Bau gesetzt').toBe(true);
      const r = await baue(root);
      expect(nodeEnvFehlt(), `NODE_ENV nach dem grünen Bau: ${String(process.env.NODE_ENV)}`).toBe(
        true,
      );
      expect(r.ok, schrittText(r)).toBe(true);
      const html = readFileSync(join(root, ...AUS.split('/')), 'utf8');
      expect(html, 'JSX-Entwicklungspfad gebündelt').not.toContain('jsxDEV');
      writeText(root, EINSTIEG, 'export const = ;\n');
      const rot = await baue(root);
      expect(rot.ok).toBe(false);
      expect(nodeEnvFehlt(), `NODE_ENV nach dem roten Bau: ${String(process.env.NODE_ENV)}`).toBe(
        true,
      );
    },
    MITTEL,
  );
});
