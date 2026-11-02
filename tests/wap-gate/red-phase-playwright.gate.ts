// Rot-Phase bei Playwright-Meldungen (R-H-35, Befund E1-01-31; ADR-010 §3.3, Entscheid E5): Ein Playwright-
// expect mit eigener Meldung beginnt mit «Error: <Meldung>», die expect(…)-Zeile folgt erst nach einer Leerzeile.
// fachlichRot erkennt diese Form zusätzlich (Vertrag E1-01c §2.6): Zeile 1 beginnt mit «Error: », eine Zeile k ≥ 3
// mit leerem Vorgänger passt auf ^expect\([A-Za-z]+\)(\.not)?\.[A-Za-z]+\( und vor ihr steht kein Codeausschnitt.
// Bestandsfälle (nur [R-H-12]): Formen, die vor und nach der Umsetzung nicht fachlich rot bzw. fachlich rot sind.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.6, §3, §8 (Formate aus dem Spike mit Playwright 1.63.0,
// JSON-Bericht nur mit message und location, ANSI-Farben wie im Original). Nur fiktive Meldungen.
import { afterEach, describe, expect, it } from 'vitest';
import { aufraeumen, neueSandbox, schrittText, writeText } from './support/umgebung';
import { ESC, redPhaseC } from './support/vertrag-c';

afterEach(aufraeumen);

const PAKET = 'P9';
const ID = 'R-9-99';
const STUB = 'paket.modul.f';

const dim = (s: string) => `${ESC}[2m${s}${ESC}[22m`;
const rotF = (s: string) => `${ESC}[31m${s}${ESC}[39m`;
const gruenF = (s: string) => `${ESC}[32m${s}${ESC}[39m`;

/** expect(received).toBe(expected) bzw. .not.toBe, toEqual, toHaveText, toBeVisible in Playwright-Farben. */
const TO_BE = `${dim('expect(')}${rotF('received')}${dim(').')}toBe${dim('(')}${gruenF('expected')}${dim(') // Object.is equality')}`;
const NOT_TO_BE = `${dim('expect(')}${rotF('received')}${dim(').')}not${dim('.')}toBe${dim('(')}${gruenF('expected')}${dim(') // Object.is equality')}`;
const TO_EQUAL = `${dim('expect(')}${rotF('received')}${dim(').')}toEqual${dim('(')}${gruenF('expected')}${dim(') // deep equality')}`;
const TO_HAVE_TEXT = `${dim('expect(')}${rotF('locator')}${dim(').')}toHaveText${dim('(')}${gruenF('expected')}${dim(')')} failed`;
const TO_BE_VISIBLE = `${dim('expect(')}${rotF('locator')}${dim(').')}toBeVisible${dim('(')}${dim(')')} failed`;

const ERWARTET = `Expected: ${gruenF('2')}\nReceived: ${rotF('1')}`;

/** Codeausschnitt wie im Bericht (Zeilennummern, Markierung). */
const RAHMEN = [
  "   7 | import { expect, test } from '@playwright/test';",
  "   8 | test('fiktiv', () => {",
  ">  9 |   expect(1, 'Meldung').toBe(2);",
  '      |                        ^',
  '  10 | });',
].join('\n');

const POLL_LOG = 'Call Log:\n- Timeout 500ms exceeded while waiting on the predicate';

/** Fachlich rot nach §2.6 (je mit eigener Meldung). */
const FACHLICH_ROT: [string, string][] = [
  ['toBe mit Meldung', `Error: Meldung eins\n\n${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}`],
  [
    'toHaveText mit Wartezeit und Meldung',
    [
      'Error: Meldung drei',
      '',
      TO_HAVE_TEXT,
      '',
      "Locator:  locator('p')",
      `Expected: ${gruenF('"Welt"')}`,
      `Received: ${rotF('"Hallo"')}`,
      'Timeout:  500ms',
      '',
      'Call log:',
      dim("  - Meldung drei locator('p') with timeout 500ms"),
      dim("  - waiting for locator('p')"),
      '',
      '',
      RAHMEN,
    ].join('\n'),
  ],
  [
    'toBeVisible mit Wartezeit und Meldung',
    `Error: Meldung elf\n\n${TO_BE_VISIBLE}\n\nLocator: locator('h1')\nExpected: visible\nTimeout: 500ms\nError: element(s) not found\n\n${RAHMEN}`,
  ],
  ['expect.soft mit Meldung', `Error: Meldung fuenf\n\n${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}`],
  [
    'expect.poll mit message',
    `Error: Meldung sechs\n\nMeldung sechs\n\n${TO_BE}\n\n${ERWARTET}\n\n${POLL_LOG}\n\n${RAHMEN}`,
  ],
  ['mehrzeilige Meldung', `Error: Zeile a\nZeile b\n\n${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}`],
  [
    '.not mit Meldung',
    `Error: Meldung fuenfzehn\n\n${NOT_TO_BE}\n\nExpected: not ${gruenF('1')}\n\n${RAHMEN}`,
  ],
  [
    'toEqual mit Meldung',
    `Error: Meldung vierzehn\n\n${TO_EQUAL}\n\n${gruenF('- Expected  - 1')}\n${rotF('+ Received  + 1')}\n\n${RAHMEN}`,
  ],
  [
    'toPass mit Meldung um eine Assertion',
    `Error: Meldung neunzehn\n\n${TO_BE}\n\n${ERWARTET}\n\n${POLL_LOG}\n\n${RAHMEN}`,
  ],
];

/** Nicht fachlich rot (vor und nach der Umsetzung; Vertrag §2.6 «Nicht fachlich rot bleiben»). */
const NICHT_ROT: [string, string][] = [
  ['Error schlicht', `Error: Meldung acht\n\n${RAHMEN}`],
  [
    'Error mit Expected/Received ohne expect(-Zeile',
    `Error: Meldung neun\n\nExpected: 2\nReceived: 1\n\n${RAHMEN}`,
  ],
  [
    'expect(-Zeile ohne Leerzeile davor (Zeile 2)',
    `Error: Meldung zehn\n${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}`,
  ],
  [
    'expect(-Zeile ohne Leerzeile davor (Zeile 3)',
    `Error: Meldung zehn\nZeile b\n${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}`,
  ],
  [
    'expect(-Zeile erst nach einem Codeausschnitt',
    `Error: Meldung zwoelf\n\n${RAHMEN}\n\n${TO_BE}`,
  ],
  ['TypeError', `TypeError: Cannot read properties of null (reading 'x')\n\n${RAHMEN}`],
  [
    'toPass mit Meldung um TypeError',
    `Error: Meldung g1\n\nCannot read properties of null (reading 'x')\n\n${POLL_LOG}\n\n${RAHMEN}`,
  ],
  [
    'toPass ohne Meldung um TypeError',
    `Error: Cannot read properties of null (reading 'x')\n\n${POLL_LOG}\n\n${RAHMEN}`,
  ],
  [
    'toPass mit Meldung um fremden Stub',
    `Error: Meldung g3\n\nnicht implementiert: fremd.modul.g\n\n${POLL_LOG}\n\n${RAHMEN}`,
  ],
  [
    'toPass ohne Meldung um fremden Stub',
    `Error: nicht implementiert: fremd.modul.g\n\n${POLL_LOG}\n\n${RAHMEN}`,
  ],
  [
    'expect.poll mit message um TypeError',
    `TypeError: Cannot read properties of null (reading 'x')\n\n${RAHMEN}`,
  ],
  [
    'expect.poll mit message um fremden Stub',
    `Error: nicht implementiert: fremd.modul.g\n\n${RAHMEN}`,
  ],
  // Bedingung 1 und Form des Musters (TR-E101c-03; Mutanten M3, M4, M6, M7):
  [
    'Kopfzeile TypeError mit expect(-Zeile nach Leerzeile',
    `TypeError: Meldung\n\n${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}`,
  ],
  [
    'expect(-Zeile eingerückt (nicht am Zeilenanfang)',
    `Error: Meldung\n\n  ${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}`,
  ],
  ['expect( mitten in der Zeile', `Error: Meldung\n\nsiehe ${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}`],
  [
    'expect( mit Argument, das kein Bezeichner aus Buchstaben ist',
    `Error: Meldung\n\nexpect(1, 'x').toBe(2)\n\n${RAHMEN}`,
  ],
];

/** Synthetischer Playwright-JSON-Bericht (Format des json-Reporters, nur message und location). */
function pwBericht(
  tests: { titel: string; status: 'passed' | 'failed'; meldung?: string }[],
): string {
  return `${JSON.stringify(
    {
      config: { rootDir: 'C:\\fiktiv\\repo\\tests\\wap-e2e' },
      suites: [
        {
          title: 'fiktiv.spec.ts',
          file: 'fiktiv.spec.ts',
          specs: tests.map((t, i) => ({
            title: t.titel,
            file: 'fiktiv.spec.ts',
            tests: [
              {
                projectName: 'edge',
                results: [
                  {
                    status: t.status,
                    errors:
                      t.meldung === undefined
                        ? []
                        : [
                            {
                              message: t.meldung,
                              location: {
                                file: 'C:\\fiktiv\\fiktiv.spec.ts',
                                line: i + 3,
                                column: 5,
                              },
                            },
                          ],
                  },
                ],
              },
            ],
          })),
        },
      ],
      errors: [],
    },
    null,
    2,
  )}\n`;
}

describe('fachlichRot: Playwright-expect mit eigener Meldung (§2.6, E1-01-31)', () => {
  it.each(FACHLICH_ROT)(
    '[R-H-35][R-H-12] %s (mit ANSI-Farben) → fachlich rot',
    async (_f, meldung) => {
      const { fachlichRot } = await redPhaseC();
      expect(fachlichRot(`${meldung}\n`, [STUB])).toBe(true);
    },
  );

  it('[R-H-35][R-H-12] classifyRedPhase: Playwright-Bericht mit Tests des Pakets je mit eigener Meldung und einem grünen fremden Test → F8-rotphase grün', async () => {
    const sb = neueSandbox();
    const bericht = writeText(
      sb.base,
      'playwright.json',
      pwBericht([
        ...FACHLICH_ROT.map(([f, meldung]) => ({
          titel: `[${ID}] ${f}`,
          status: 'failed' as const,
          meldung,
        })),
        { titel: '[R-1-01] fremd grün', status: 'passed' },
      ]),
    );
    const { classifyRedPhase } = await redPhaseC();
    const r = classifyRedPhase({
      berichte: [bericht],
      paket: PAKET,
      paketIds: [ID],
      stubNamen: [STUB],
    });
    expect(r.ok, schrittText(r)).toBe(true);
    expect(r.id).toBe('F8-rotphase');
  });
});

describe('fachlichRot: Bestand, nicht fachlich rot (§2.6, CR-E101c-V14)', () => {
  it.each(NICHT_ROT)('[R-H-12] %s → nicht fachlich rot', async (_f, meldung) => {
    const { fachlichRot } = await redPhaseC();
    expect(fachlichRot(`${meldung}\n`, [STUB])).toBe(false);
  });

  it('[R-H-12] classifyRedPhase: Test des Pakets mit toPass um TypeError → F8-rotphase rot «nicht fachlich rot» mit Testnamen', async () => {
    const sb = neueSandbox();
    const g1 = NICHT_ROT.find(([f]) => f === 'toPass mit Meldung um TypeError')?.[1] ?? '';
    const bericht = writeText(
      sb.base,
      'playwright.json',
      pwBericht([{ titel: `[${ID}] toPass um TypeError`, status: 'failed', meldung: g1 }]),
    );
    const { classifyRedPhase } = await redPhaseC();
    const r = classifyRedPhase({
      berichte: [bericht],
      paket: PAKET,
      paketIds: [ID],
      stubNamen: [STUB],
    });
    expect(r.ok).toBe(false);
    expect(schrittText(r)).toContain('nicht fachlich rot');
    expect(schrittText(r)).toContain('toPass um TypeError');
  });
});

describe('fachlichRot: Bestand, fachlich rot', () => {
  it('[R-H-12] Meldung beginnt selbst mit «expect(» → bleibt fachlich rot (bestehende Regel ^Error: expect\\()', async () => {
    const { fachlichRot } = await redPhaseC();
    expect(
      fachlichRot(`Error: expect(x) Meldung\n\n${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}\n`, [STUB]),
    ).toBe(true);
  });

  it('[R-H-12] Playwright-expect ohne eigene Meldung und Vertrags-Stub des Pakets bleiben fachlich rot; fremder Stub nicht', async () => {
    const { fachlichRot } = await redPhaseC();
    expect(fachlichRot(`Error: ${TO_BE}\n\n${ERWARTET}\n\n${RAHMEN}\n`, [STUB])).toBe(true);
    expect(fachlichRot(`Error: nicht implementiert: ${STUB}\n\n${RAHMEN}\n`, [STUB])).toBe(true);
    expect(fachlichRot(`Error: nicht implementiert: ${STUB}\n\n${RAHMEN}\n`, [])).toBe(false);
  });
});
