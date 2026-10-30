// Volle Schleuse als ein Befehl mit E2E und Einzeldatei-Hilfe (ADR-010 §3.2; R-H-11): package.json führt
// wap:gate:full, wap:test:e2e (E2E-Läufer, Schritt V4) und wap:einzeldatei (Build-Hilfe für Zwischenstände).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §4 «Besitz» (package.json: nur wap:test:e2e und
// wap:einzeldatei). Übernommen aus gate-full.gate.entwurf.ts, umgestellt auf diese Skripte (Vertrag E1-01b §3).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WT } from './support/umgebung';

describe('package.json: volle Schleuse, E2E-Läufer und Einzeldatei je als ein Befehl', () => {
  it('[R-H-11] wap:gate:full ruft gate.mjs full, wap:test:e2e ruft e2e.mjs, wap:einzeldatei ruft einzeldatei.mjs', () => {
    const pkg = JSON.parse(readFileSync(join(WT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['wap:gate:full']).toBe('node scripts/wap-gate/gate.mjs full');
    expect(pkg.scripts?.['wap:test:e2e']).toBe('node scripts/wap-gate/e2e.mjs');
    expect(pkg.scripts?.['wap:einzeldatei']).toBe('node scripts/wap-gate/einzeldatei.mjs');
  });
});
