// Rot-Phase bei Eigenschaftstests mit fast-check (Nachtrag E1-01, Stufe B; ADR-010 §3.3, Prompt §7
// «Property-basierte Tests»): Scheitert ein Eigenschaftstest eines Pakets am Vertrags-Stub des Pakets oder an
// einer Assertion, ist er fachlich rot, auch wenn fast-check den Fehler in seinen Bericht «Property failed
// after … Counterexample … Shrunk …» einbettet. Massgebend ist der eingebettete ursprüngliche Fehler
// (erste «Got …»-Zeile nach «Shrunk …» bei includeErrorInReport); fremder Stub, Typ- oder Referenzfehler,
// ein gewöhnlicher Fehler und ein Bericht ohne eingebetteten Fehler sind nicht fachlich rot (fail-closed),
// auch wenn Gegenbeispiel oder Fehlermeldung Stub-Text oder «AssertionError» enthalten (TR-E101-301).
// Eine Eigenschaft, die false liefert («Property failed by returning false»), gilt wie eine Assertion als
// fachlich rot (Entscheid Orchestrator 04.10.2026).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (classifyRedPhase).
// Echte JSON-Berichte von Vitest mit echtem fast-check aus temporären Projekten. Die Ende-zu-Ende-Fälle mit der
// schnellen Schleuse stehen in red-phase-eigenschaft.selbsttest.ts (Vertrag §9 Nr 17). Nur fiktive Daten.
import { existsSync, readFileSync } from 'node:fs';
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
import { redPhase, type Schritt } from './support/vertrag';

afterEach(aufraeumen);

const PAKET = 'p9';
const ID = 'R-9-99';
const STUB = 'paket.modul.f';
const FREMDER_STUB = 'fremd.modul.g';
/** Fester Startwert der Eigenschaftstests (Prompt §7). */
const SEED = 20_261_004;

/** Kopf einer Probe-Datei: fast-check mit eingebettetem Fehler (wie die vorgesehene WAP-Vitest-Hilfe). */
const KOPF_MIT = [
  "import fc from 'fast-check';",
  "import { expect, it } from 'vitest';",
  '',
  'fc.configureGlobal({ includeErrorInReport: true });',
  '',
  '',
].join('\n');

/** Kopf ohne Einstellung: fast-check meldet nur «Property failed …» ohne den ursprünglichen Fehler. */
const KOPF_OHNE = [
  "import fc from 'fast-check';",
  "import { expect, it } from 'vitest';",
  '',
  '',
].join('\n');

/** Vertrags-Stub eines fiktiven Moduls (wirft wie die Stubs des Pakets). */
function stubFunktion(name: string): string {
  return `function f(_n: number): number {\n  throw new Error('nicht implementiert: ${name}');\n}\n\n`;
}

/** Eigenschaftstest mit fester Startzahl; `rumpf` ist der Prädikatsrumpf mit dem Parameter `n`. */
function eigenschaft(titel: string, rumpf: string, optionen = ''): string {
  return `it('[${ID}] ${titel}', () => {\n  fc.assert(\n    fc.property(fc.integer({ min: 0, max: 50 }), (n) => {\n      ${rumpf}\n    }),\n    { seed: ${String(SEED)}${optionen} },\n  );\n});\n`;
}

/** Führt eine Vitest-Datei in einem temporären Projekt aus und liefert den Pfad des JSON-Berichts. */
function vitestBericht(sb: Sandbox, name: string, inhalt: string): string {
  const root = join(sb.base, `fc-${name}`);
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

/** Erwarteter Aufbau des fast-check-Berichts des Paket-Tests (sonst wäre der Fall ohne Aussage). */
interface Aufbau {
  /** Erste «Got …»-Zeile nach «Shrunk …» (null: kein eingebetteter Fehler). */
  got: RegExp | null;
  /** Zeilen, die die Meldung zusätzlich genau so enthalten muss (z.B. Gegenbeispiel, unechte «Got»-Zeile). */
  zeilen?: string[];
}

/** Regex-Sonderzeichen maskieren. */
function genau(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Aufbau bei eingebettetem Vertrags-Stub des Pakets. */
const STUB_GOT: Aufbau = { got: new RegExp(`^Got error: nicht implementiert: ${genau(STUB)}$`) };

/** Zeilen der ersten Fehlermeldung des Paket-Tests im Vitest-Bericht. */
function paketMeldung(bericht: string): string[] {
  const daten = JSON.parse(readFileSync(bericht, 'utf8')) as {
    testResults?: { assertionResults?: { title?: string; failureMessages?: string[] }[] }[];
  };
  const tests = (daten.testResults ?? []).flatMap((d) => d.assertionResults ?? []);
  const eigen = tests.find((a) => (a.title ?? '').includes(`[${ID}]`));
  const meldung = eigen?.failureMessages?.[0];
  expect(meldung, 'Test-Aufbau: Paket-Test ohne Fehlermeldung').toBeDefined();
  return (meldung as string).split(/\r?\n/);
}

/** Prüft, dass der Paket-Test mit einem fast-check-Bericht des erwarteten Aufbaus scheiterte. */
function fastCheckBericht(bericht: string, aufbau: Aufbau): void {
  const zeilen = paketMeldung(bericht);
  expect(zeilen[0], 'Test-Aufbau: kein fast-check-Bericht').toMatch(
    /^Error: Property failed after \d+ tests$/,
  );
  const shrunk = zeilen.findIndex((z) => /^Shrunk \d+ time\(s\)$/.test(z));
  expect(shrunk, 'Test-Aufbau: Zeile «Shrunk …» fehlt').toBeGreaterThan(0);
  const got = zeilen.slice(shrunk + 1).find((z) => z.startsWith('Got ')) ?? null;
  if (aufbau.got === null) {
    expect(got, 'Test-Aufbau: unerwarteter eingebetteter Fehler').toBeNull();
  } else {
    expect(got, 'Test-Aufbau: eingebetteter Fehler («Got …»)').toMatch(aufbau.got);
  }
  for (const z of aufbau.zeilen ?? []) {
    expect(zeilen, `Test-Aufbau: Zeile «${z}» fehlt`).toContain(z);
  }
}

async function klassifiziere(berichte: string[]): Promise<Schritt> {
  const { classifyRedPhase } = await redPhase();
  return classifyRedPhase({ berichte, paket: PAKET, paketIds: [ID], stubNamen: [STUB] });
}

describe('classifyRedPhase: fast-check-Bericht mit eingebettetem fachlichem Fehler → fachlich rot', () => {
  it.each<[string, string, string, Aufbau]>([
    [
      '(a) synchroner Eigenschaftstest am Vertrags-Stub des Pakets',
      'stub',
      `${KOPF_MIT}${stubFunktion(STUB)}${eigenschaft('stub', 'expect(f(n)).toBe(n);')}`,
      STUB_GOT,
    ],
    [
      '(a) asynchroner Eigenschaftstest am Vertrags-Stub des Pakets',
      'stubasync',
      `${KOPF_MIT}${stubFunktion(STUB)}it('[${ID}] stub async', async () => {\n  await fc.assert(\n    fc.asyncProperty(fc.integer({ min: 0, max: 50 }), async (n) => {\n      await Promise.resolve();\n      expect(f(n)).toBe(n);\n    }),\n    { seed: ${String(SEED)} },\n  );\n});\n`,
      STUB_GOT,
    ],
    [
      '(a) Vertrags-Stub des Pakets, ausführlicher Bericht (verbose: 1, Liste der Fehlschläge nach dem Fehler)',
      'stubverbose',
      `${KOPF_MIT}${stubFunktion(STUB)}${eigenschaft('stub verbose', 'expect(f(n)).toBe(n);', ', verbose: 1')}`,
      { ...STUB_GOT, zeilen: ['Encountered failures were:'] },
    ],
    [
      '(b) eingebettete AssertionError (expect)',
      'assertion',
      `${KOPF_MIT}${eigenschaft('assertion', 'expect(n).toBe(n + 1);')}`,
      { got: /^Got AssertionError: expected / },
    ],
    [
      '(b) eingebettete AssertionError mit mehrzeiligem Vergleich (toStrictEqual)',
      'assertiondiff',
      `${KOPF_MIT}${eigenschaft('assertion diff', 'expect({ wert: [n, 1] }).toStrictEqual({ wert: [n, 2] });')}`,
      { got: /^Got AssertionError: expected / },
    ],
    [
      '(b) Eigenschaft liefert false («Property failed by returning false», Entscheid Orchestrator 04.10.2026)',
      'falsch',
      `${KOPF_MIT}${eigenschaft('liefert false', 'return n < 0;')}`,
      { got: /^Got error: Property failed by returning false$/ },
    ],
  ])(
    '[R-H-12] %s, übrige Tests grün → Rot-Phase eingehalten',
    async (_name, datei, inhalt, aufbau) => {
      const sb = neueSandbox();
      const b = vitestBericht(
        sb,
        datei,
        `${inhalt}it('[R-1-01] fremd grün', () => {\n  fc.assert(fc.property(fc.integer(), (n) => n === n), { seed: ${String(SEED)} });\n});\n`,
      );
      fastCheckBericht(b, aufbau);
      const r = await klassifiziere([b]);
      expect(r.ok, schrittText(r)).toBe(true);
    },
    KURZ,
  );
});

describe('classifyRedPhase: fast-check-Bericht ohne fachlichen Fehler → nicht fachlich rot', () => {
  it.each<[string, string, string, string, Aufbau]>([
    [
      '(c) eingebetteter Stub eines fremden Pakets',
      'fremdstub',
      `${KOPF_MIT}${stubFunktion(FREMDER_STUB)}${eigenschaft('fremder stub', 'expect(f(n)).toBe(n);')}`,
      'fremder stub',
      { got: new RegExp(`^Got error: nicht implementiert: ${genau(FREMDER_STUB)}$`) },
    ],
    [
      '(c) eingebetteter Stub, dessen Name den Stub-Namen des Pakets nur als Präfix enthält',
      'praefix',
      `${KOPF_MIT}${stubFunktion(`${STUB}x`)}${eigenschaft('praefix', 'expect(f(n)).toBe(n);')}`,
      'praefix',
      { got: new RegExp(`^Got error: nicht implementiert: ${genau(STUB)}x$`) },
    ],
    [
      '(c) eingebetteter TypeError',
      'typ',
      `${KOPF_MIT}${eigenschaft('typ', 'const o = undefined as unknown as { x: { y: number } };\n      expect(o.x.y).toBe(n);')}`,
      'typ',
      { got: /^Got TypeError: / },
    ],
    [
      '(c) eingebetteter ReferenceError',
      'referenz',
      `${KOPF_MIT}declare function gibtEsNicht(n: number): number;\n\n${eigenschaft('referenz', 'expect(gibtEsNicht(n)).toBe(n);')}`,
      'referenz',
      { got: /^Got ReferenceError: gibtEsNicht is not defined$/ },
    ],
    [
      '(c) eingebetteter gewöhnlicher Fehler (kein Stub, keine Assertion)',
      'gewoehnlich',
      `${KOPF_MIT}${eigenschaft('gewöhnlich', "if (n >= 0) throw new Error('Aufbau der Testdaten gescheitert');")}`,
      'gewöhnlich',
      { got: /^Got error: Aufbau der Testdaten gescheitert$/ },
    ],
    [
      '(c) Gegenbeispiel enthält den Stub-Text des Pakets und «AssertionError», eingebettet ist aber ein TypeError',
      'gegenbeispiel',
      `${KOPF_MIT}it('[${ID}] gegenbeispiel', () => {\n  fc.assert(\n    fc.property(fc.constant('nicht implementiert: ${STUB} AssertionError: x'), (s) => {\n      const o = undefined as unknown as { x: string };\n      expect(o.x).toBe(s);\n    }),\n    { seed: ${String(SEED)} },\n  );\n});\n`,
      'gegenbeispiel',
      {
        got: /^Got TypeError: /,
        zeilen: [`Counterexample: ["nicht implementiert: ${STUB} AssertionError: x"]`],
      },
    ],
    [
      '(c) gewöhnlicher Fehler, dessen Meldung eine zweite Zeile «Got error: nicht implementiert: <Stub des Pakets>» enthält',
      'unechtgot',
      `${KOPF_MIT}${eigenschaft('unecht got', `if (n >= 0) throw new Error('Aufbau\\nGot error: nicht implementiert: ${STUB}');`)}`,
      'unecht got',
      { got: /^Got error: Aufbau$/, zeilen: [`Got error: nicht implementiert: ${STUB}`] },
    ],
    [
      '(c) gewöhnlicher Fehler, dessen Meldung eine zweite Zeile «AssertionError: …» enthält',
      'unechtassert',
      `${KOPF_MIT}${eigenschaft('unecht assertion', "if (n >= 0) throw new Error('Aufbau\\nAssertionError: x');")}`,
      'unecht assertion',
      { got: /^Got error: Aufbau$/, zeilen: ['AssertionError: x'] },
    ],
    [
      '(d) Vertrags-Stub des Pakets, aber fast-check ohne eingebetteten Fehler (Standardeinstellung)',
      'ohne',
      `${KOPF_OHNE}${stubFunktion(STUB)}${eigenschaft('ohne eingebettet', 'expect(f(n)).toBe(n);')}`,
      'ohne eingebettet',
      { got: null },
    ],
  ])(
    '[R-H-12] %s → Rot-Phase verletzt, Test genannt',
    async (_name, datei, inhalt, titel, aufbau) => {
      const sb = neueSandbox();
      const b = vitestBericht(sb, datei, inhalt);
      fastCheckBericht(b, aufbau);
      const r = await klassifiziere([b]);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(`[${ID}] ${titel}`);
    },
    KURZ,
  );

  it(
    '[R-H-12] (d) fast-check scheitert an zu vielen verworfenen Vorbedingungen (fc.pre), kein eingebetteter Fehler → Rot-Phase verletzt',
    async () => {
      const sb = neueSandbox();
      const b = vitestBericht(
        sb,
        'vorbedingung',
        `${KOPF_MIT}it('[${ID}] vorbedingung', () => {\n  fc.assert(\n    fc.property(fc.integer(), (n) => {\n      fc.pre(n !== n);\n    }),\n    { seed: ${String(SEED)} },\n  );\n});\n`,
      );
      const zeilen = paketMeldung(b);
      expect(zeilen[0], 'Test-Aufbau: kein fast-check-Bericht').toBe(
        'Error: Failed to run property, too many pre-condition failures encountered',
      );
      expect(
        zeilen.some((z) => z.startsWith('Got ')),
        'Test-Aufbau: unerwarteter eingebetteter Fehler',
      ).toBe(false);
      const r = await klassifiziere([b]);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain(`[${ID}] vorbedingung`);
    },
    KURZ,
  );
});
