// @vitest-environment jsdom
// Paket E1-02b: gebündelte Schriftdateien (Vertrag E1-02b Abschnitt 1, 2.1; ADR-003; R-L-03).
// Braucht die Schriftdateien unter src/assets/wap-fonts/ (abgelegt vom Orchestrator bzw. E1-01).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fontBytes } from '../../../../src/assets/wap-fonts/index';
import { errorCode, FONT_SHA256, REPO_ROOT } from './helpers';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const FILES = { regular: 'Arimo-Regular.ttf', bold: 'Arimo-Bold.ttf' } as const;

describe('fontBytes', () => {
  it('[R-L-03] liefert die Arimo-Dateien mit dem SHA-256 aus Vertrag Abschnitt 1', () => {
    expect(sha256(fontBytes('regular'))).toBe(FONT_SHA256.regular);
    expect(sha256(fontBytes('bold'))).toBe(FONT_SHA256.bold);
  });

  it('[R-L-03] dieselbe Schriftdatei wie im Projekt (src/assets/wap-fonts)', () => {
    for (const weight of ['regular', 'bold'] as const) {
      const path = join(REPO_ROOT, 'src', 'assets', 'wap-fonts', FILES[weight]);
      expect(existsSync(path), `Schriftdatei fehlt: ${FILES[weight]}`).toBe(true);
      expect(sha256(readFileSync(path))).toBe(FONT_SHA256[weight]);
      expect(sha256(fontBytes(weight))).toBe(sha256(readFileSync(path)));
    }
  });

  it('[R-L-03] jeder Aufruf liefert eine neue Kopie; Änderungen an einer Kopie wirken nicht weiter', () => {
    const first = fontBytes('regular');
    const second = fontBytes('regular');
    expect(first).not.toBe(second);
    first.fill(0);
    expect(sha256(second)).toBe(FONT_SHA256.regular);
    expect(sha256(fontBytes('regular'))).toBe(FONT_SHA256.regular);
  });

  it('[R-L-03] wirft nie für gültige Schnitte', () => {
    expect(errorCode(() => fontBytes('regular'))).toBe('kein Fehler');
    expect(errorCode(() => fontBytes('bold'))).toBe('kein Fehler');
  });
});
