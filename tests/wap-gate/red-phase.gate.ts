// Rot-Phase auf wap/<paket> (ADR-010 §3.3, Entscheid E5): Tests mit IDs des laufenden Pakets müssen
// fachlich rot sein (Assertion-Fehler oder Vertrags-Stub-Fehler des Pakets), alle übrigen grün;
// Import-, Syntax-, Typ-/Referenz-, Aufbau- und Zeitüberschreitungsfehler sind rot.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (classifyRedPhase).
// Je Fehlerart ein echter JSON-Bericht von Vitest bzw. Playwright aus einem temporären Projekt.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  KURZ,
  lauf,
  neueSandbox,
  nodeModules,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { redPhase } from './support/vertrag';

afterEach(aufraeumen);

const PAKET = 'p9';
const ID = 'R-9-99';
const STUB = 'paket.modul.f';
const KOPF = "import { beforeAll, expect, it } from 'vitest';\n\n";

/** Führt eine Vitest-Datei in einem temporären Projekt aus und liefert den Pfad des JSON-Berichts. */
function vitestBericht(sb: Sandbox, name: string, inhalt: string): string {
  const root = join(sb.base, `vt-${name}`);
  writeText(
    root,
    'vitest.config.mjs',
    "export default { test: { include: ['**/*.probe.ts'], retry: 0 } };\n",
  );
  writeText(root, `${name}.probe.ts`, inhalt);
  nodeModules(root);
  const bericht = join(root, 'bericht.json');
  lauf(
    process.execPath,
    [
      join(root, 'node_modules', 'vitest', 'vitest.mjs'),
      'run',
      '--root',
      root,
      '--config',
      join(root, 'vitest.config.mjs'),
      '--reporter=json',
      `--outputFile=${bericht}`,
    ],
    { cwd: root, env: { ...sb.env, VITEST_MAX_WORKERS: '4' }, timeout: 120_000 },
  );
  expect(existsSync(bericht), 'Test-Aufbau: Vitest-Bericht fehlt').toBe(true);
  return bericht;
}

async function klassifiziere(berichte: string[]) {
  const { classifyRedPhase } = await redPhase();
  return classifyRedPhase({ berichte, paket: PAKET, paketIds: [ID], stubNamen: [STUB] });
}

describe('classifyRedPhase: fachlich rot (zulässig)', () => {
  it(
    '[R-H-12] Assertion-Fehler eines Tests mit Paket-ID, übrige Tests grün → grün',
    async () => {
      const sb = neueSandbox();
      const b = vitestBericht(
        sb,
        'assertion',
        `${KOPF}it('[${ID}] rot per Assertion', () => {\n  expect(1).toBe(2);\n});\nit('[R-1-01] fremd grün', () => {\n  expect(1).toBe(1);\n});\n`,
      );
      const r = await klassifiziere([b]);
      expect(r.ok).toBe(true);
    },
    KURZ,
  );

  it(
    '[R-H-12] expect.soft-Fehler eines Tests mit Paket-ID → grün',
    async () => {
      const sb = neueSandbox();
      const b = vitestBericht(
        sb,
        'soft',
        `${KOPF}it('[${ID}] weich', () => {\n  expect.soft(1).toBe(2);\n});\n`,
      );
      expect((await klassifiziere([b])).ok).toBe(true);
    },
    KURZ,
  );

  it(
    '[R-H-12] expect.poll-Zeitüberschreitung eines Tests mit Paket-ID → grün (Assertion mit Wartezeit)',
    async () => {
      const sb = neueSandbox();
      const b = vitestBericht(
        sb,
        'poll',
        `${KOPF}it('[${ID}] abfrage', async () => {\n  await expect.poll(() => 1, { timeout: 200, interval: 50 }).toBe(2);\n});\n`,
      );
      expect((await klassifiziere([b])).ok).toBe(true);
    },
    KURZ,
  );

  it(
    '[R-H-12] Vertrags-Stub-Fehler «nicht implementiert: <name>» des laufenden Pakets → grün',
    async () => {
      const sb = neueSandbox();
      const b = vitestBericht(
        sb,
        'stub',
        `${KOPF}it('[${ID}] stub', () => {\n  throw new Error('nicht implementiert: ${STUB}');\n});\n`,
      );
      expect((await klassifiziere([b])).ok).toBe(true);
    },
    KURZ,
  );
});

describe('classifyRedPhase: nicht fachlich rot → Schleuse rot', () => {
  it.each([
    [
      'Stub-Fehler eines fremden Pakets',
      'fremdstub',
      `${KOPF}it('[${ID}] fremder stub', () => {\n  throw new Error('nicht implementiert: fremd.modul.g');\n});\n`,
      'fremder stub',
    ],
    [
      'Importfehler',
      'import',
      `${KOPF}import { x } from './gibt-es-nicht';\n\nit('[${ID}] import', () => {\n  expect(x).toBe(1);\n});\n`,
      'import.probe.ts',
    ],
    [
      'Syntaxfehler',
      'syntax',
      `${KOPF}it('[${ID}] syntax', () => {\n  const = ;\n});\n`,
      'syntax.probe.ts',
    ],
    [
      'Referenzfehler',
      'referenz',
      `${KOPF}it('[${ID}] referenz', () => {\n  gibtEsNicht();\n});\n`,
      'referenz',
    ],
    [
      'Typfehler zur Laufzeit',
      'typ',
      `${KOPF}it('[${ID}] typ', () => {\n  const o = undefined as unknown as { x: { y: number } };\n  expect(o.x.y).toBe(1);\n});\n`,
      'typ',
    ],
    [
      'Zeitüberschreitung des ganzen Tests',
      'zeit',
      `${KOPF}it('[${ID}] zeit', async () => {\n  await new Promise((r) => setTimeout(r, 3000));\n}, 200);\n`,
      'zeit',
    ],
    [
      'Fehler in beforeAll',
      'aufbau',
      `${KOPF}beforeAll(() => {\n  throw new Error('Aufbau');\n});\nit('[${ID}] aufbau', () => {\n  expect(1).toBe(2);\n});\n`,
      'aufbau',
    ],
    [
      'Test mit Paket-ID grün',
      'gruen',
      `${KOPF}it('[${ID}] schon grün', () => {\n  expect(1).toBe(1);\n});\n`,
      'schon grün',
    ],
    [
      'fremder Test rot',
      'fremdrot',
      `${KOPF}it('[${ID}] rot', () => {\n  expect(1).toBe(2);\n});\nit('[R-1-01] fremd rot', () => {\n  expect(1).toBe(2);\n});\n`,
      'fremd rot',
    ],
  ])(
    '[R-H-12] %s → rot mit Nennung',
    async (_name, datei, inhalt, nennung) => {
      const sb = neueSandbox();
      const b = vitestBericht(sb, datei, inhalt);
      const r = await klassifiziere([b]);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(nennung);
    },
    KURZ,
  );

  it('[R-H-12] fehlender Bericht → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const r = await klassifiziere([join(sb.base, 'gibt-es-nicht.json')]);
    expect(r.ok).toBe(false);
    expect((r.ursache ?? '').length).toBeGreaterThan(0);
  });

  it(
    '[R-H-12] mehrere Berichte: ein zulässiger und einer mit Importfehler → rot',
    async () => {
      const sb = neueSandbox();
      const gut = vitestBericht(
        sb,
        'gut',
        `${KOPF}it('[${ID}] a', () => {\n  expect(1).toBe(2);\n});\n`,
      );
      const schlecht = vitestBericht(
        sb,
        'schlecht',
        `${KOPF}import { x } from './fehlt';\n\nit('[${ID}] b', () => {\n  expect(x).toBe(1);\n});\n`,
      );
      expect((await klassifiziere([gut])).ok).toBe(true);
      expect((await klassifiziere([gut, schlecht])).ok).toBe(false);
    },
    KURZ,
  );
});
