// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): Auswertung der Mutationstests V8
// (R-H-17, Prompt §7, ADR-010 §6.3) in scripts/wap-gate/mutation.mjs: Pfadmenge, Bereiche nach Prompt §7, Score
// (getötet + Zeitüberschreitung) / (getötet + Zeitüberschreitung + überlebt + ohne Abdeckung), Bericht je Bereich
// mit den grössten Lücken, geänderte Dateien gegenüber dem Vergleichsstand. Fiktive Berichte im Schema
// mutation-testing-report-schema; der echte Stryker-Lauf steht in mutation.selbsttest.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  commitAlles,
  neueSandbox,
  neuesRepo,
  prozessUmgebung,
  writeText,
} from './support/umgebung';
import { mutationModul } from './support/vertrag-f-tools';

const {
  bereichVon,
  geaenderteDateien,
  inPfadmenge,
  runMutation,
  schreibeBereichsBericht,
  score,
  zaehleBerichte,
} = await mutationModul();

afterEach(aufraeumen);

type Status = 'Killed' | 'Survived' | 'NoCoverage' | 'Timeout' | 'CompileError' | 'Ignored';

function bericht(root: string, name: string, dateien: Record<string, Status[]>): string {
  const files: Record<string, unknown> = {};
  for (const [pfad, status] of Object.entries(dateien)) {
    files[join(root, ...pfad.split('/'))] = {
      language: 'typescript',
      source: '',
      mutants: status.map((s, i) => ({
        id: String(i),
        mutatorName: 'ConditionalExpression',
        status: s,
        location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
      })),
    };
  }
  return writeText(
    root,
    `test-results/wap/stryker/${name}.json`,
    `${JSON.stringify({ schemaVersion: '2', thresholds: { high: 90, low: 80 }, files })}\n`,
  );
}

const viele = (s: Status, n: number): Status[] => Array.from({ length: n }, () => s);

describe('Pfadmenge und Bereiche (Prompt §7)', () => {
  it('[R-H-17] Pfadmenge: Fachlogik und Formtext-Zerlegung, ohne Typdateien und generierte Metrik-Tabelle', () => {
    expect(inPfadmenge('src/model/wap/time.ts')).toBe(true);
    expect(inPfadmenge('src/model/wap/layout/text/break.ts')).toBe(true);
    expect(inPfadmenge('src/io/wap-import/formtext/index.ts')).toBe(true);
    expect(inPfadmenge('src/io/wap-import/agenda-text/index.ts')).toBe(true);
    expect(inPfadmenge('src/model/wap/types.ts')).toBe(false);
    expect(inPfadmenge('src/model/wap/layout/text/hyphen.d.ts')).toBe(false);
    expect(inPfadmenge('src/model/wap/layout/text/metrics.generated.ts')).toBe(false);
    expect(inPfadmenge('src/io/wap-import/sheet.ts')).toBe(false);
    expect(inPfadmenge('src/components/wap/App.tsx')).toBe(false);
  });

  it('[R-H-17] Bereiche: Prüfregeln, Layout-Schicht, Beso-Nummerierung, Formtext-Zerlegung, übrige Fachlogik', () => {
    expect(bereichVon('src/model/wap/checks/rules.ts')).toBe('Prüfregeln');
    expect(bereichVon('src/model/wap/layout/entries/text.ts')).toBe('Layout-Schicht');
    expect(bereichVon('src/model/wap/commands/numbering.ts')).toBe('Beso-Nummerierung');
    expect(bereichVon('src/model/wap/commands/beso.ts')).toBe('Beso-Nummerierung');
    expect(bereichVon('src/io/wap-import/formtext/index.ts')).toBe('Formtext-Zerlegung');
    expect(bereichVon('src/model/wap/commands/entries.ts')).toBe('Fachlogik');
    expect(bereichVon('src/model/wap/time.ts')).toBe('Fachlogik');
  });
});

describe('Score und Bericht', () => {
  it('[R-H-17] Score = (getötet + Zeitüberschreitung) / gültige Mutanten; Fehler und Ignorierte zählen nicht; 80 % genau → nicht unter der Schwelle', () => {
    expect(score({ getoetet: 7, zeit: 1, ueberlebt: 1, ohneAbdeckung: 1, sonst: 5 })).toBe(80);
    expect(score({ getoetet: 0, zeit: 0, ueberlebt: 0, ohneAbdeckung: 0, sonst: 3 })).toBeNull();
    const sb = neueSandbox();
    const b = bericht(sb.base, 'm', {
      'src/model/wap/checks/rules.ts': [...viele('Killed', 8), ...viele('Survived', 2)],
      'src/model/wap/layout/entries/text.ts': [
        ...viele('Killed', 7),
        'Survived',
        'NoCoverage',
        'NoCoverage',
      ],
      'src/io/wap-import/formtext/index.ts': [...viele('Killed', 9), 'Timeout', 'CompileError'],
    });
    const z = zaehleBerichte(sb.base, [b]);
    expect(z.bereiche.get('Prüfregeln')).toEqual({
      getoetet: 8,
      zeit: 0,
      ueberlebt: 2,
      ohneAbdeckung: 0,
      sonst: 0,
    });
    expect(z.dateien.has('src/model/wap/layout/entries/text.ts')).toBe(true);
    const ziel = join(sb.base, 'test-results', 'wap', 'stryker', 'bericht.md');
    const r = schreibeBereichsBericht(sb.base, [b], ziel);
    expect(r.unter).toEqual(['Layout-Schicht (70 % < 80 %)']);
    const md = readFileSync(ziel, 'utf8');
    expect(md).toContain('| Prüfregeln | 80 % |');
    expect(md).toContain('| Formtext-Zerlegung | 100 % |');
    expect(md).toContain('| Fachlogik | nicht gemessen |');
    expect(md).toContain(
      '| src/model/wap/layout/entries/text.ts | Layout-Schicht | 1 | 2 | 70 % |',
    );
  });
});

describe('V8 inkrementell (runMutation)', () => {
  it('[R-H-17] keine geänderte Datei der Pfadmenge gegenüber dem Vergleichsstand → grün ohne Stryker-Lauf; geänderte Datei wird erkannt, Typdatei nicht', async () => {
    const sb = neueSandbox();
    prozessUmgebung(sb);
    const root = neuesRepo(sb, 'mut');
    writeText(root, 'src/model/wap/a.ts', 'export const a = 1;\n');
    writeText(root, 'src/components/wap/b.tsx', 'export const b = 1;\n');
    const basis = commitAlles(sb, root, 'Basis');
    writeText(root, 'src/components/wap/b.tsx', 'export const b = 2;\n');
    writeText(root, 'src/model/wap/types.ts', 'export type T = number;\n');
    const r = await runMutation({ cwd: root, basis });
    expect(r.ok).toBe(true);
    expect((r.details as { dateien: number }).dateien).toBe(0);
    writeText(root, 'src/model/wap/a.ts', 'export const a = 2;\n');
    writeText(root, 'src/model/wap/neu/c.ts', 'export const c = 3;\n');
    expect(geaenderteDateien(root, basis)).toEqual([
      'src/model/wap/a.ts',
      'src/model/wap/neu/c.ts',
    ]);
  });

  it('[R-H-17] Vergleichsstand nicht bestimmbar → rot mit Ursache', async () => {
    const sb = neueSandbox();
    const r = await runMutation({ cwd: sb.base, basis: null });
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Vergleichsstand');
  });
});
