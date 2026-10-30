// @vitest-environment node
// F-UX1 «B3 b» (Entscheid des Auftraggebers vom 19.10.2026; CS-I5-B3-KONSOLE-01): Die E2E-Fixture zeichnet bei
// Konsolen- und Seitenfehlern zusätzlich Text und Stack auf – in die lokalen Testergebnisse
// (test-results/wap/konsole/<test>.json) und in die Fehlermeldung des Tests. Das Verhalten bleibt: jede Meldung
// macht den Test rot; consoleErrors enthält weiter die Art (Vertrag E1-01b §2). Nur fiktive Texte.
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type KonsolenEintrag,
  konsolenDatei,
  konsolenMeldung,
  sammleKonsole,
  schreibeKonsole,
  verbliebeneEintraege,
} from '../../../wap-e2e/support/fixtures';

/** Fiktive Konsolenmeldung mit Art, Text und Ort. */
function meldung(type: string, text: string) {
  return {
    type: () => type,
    text: () => text,
    location: () => ({ url: 'http://127.0.0.1:5173/app.js', lineNumber: 3, columnNumber: 7 }),
  };
}

function quelle(): EventEmitter & { on: EventEmitter['on'] } {
  return new EventEmitter();
}

const TEST = {
  titlePath: ['f-ux1/beispiel.spec.ts', '[R-H-11] fiktiver Test «Konsole» 1'],
  project: 'edge',
  file: 'tests/wap-e2e/f-ux1/beispiel.spec.ts',
};

describe('F-UX1 B3 b: Konsolentext in der E2E-Fixture', () => {
  it('[R-H-11] sammleKonsole: Fehler, Warnung und Seitenfehler mit Text, Ort und Stack; consoleErrors nur mit der Art; log und info zählen nicht', () => {
    const q = quelle();
    const consoleErrors: string[] = [];
    const eintraege = sammleKonsole(q, consoleErrors);
    q.emit('console', meldung('log', 'fiktive Ausgabe'));
    q.emit('console', meldung('info', 'fiktive Info'));
    q.emit('console', meldung('error', 'fiktiver Fehler F-UX1'));
    q.emit('console', meldung('warning', 'fiktive Warnung F-UX1'));
    const fehler = new Error('fiktiver Seitenfehler F-UX1');
    q.emit('pageerror', fehler);
    expect(consoleErrors).toEqual(['error', 'warning', 'pageerror']);
    expect(eintraege).toEqual<KonsolenEintrag[]>([
      {
        art: 'error',
        text: 'fiktiver Fehler F-UX1',
        ort: 'http://127.0.0.1:5173/app.js:3:7',
        stack: null,
      },
      {
        art: 'warning',
        text: 'fiktive Warnung F-UX1',
        ort: 'http://127.0.0.1:5173/app.js:3:7',
        stack: null,
      },
      {
        art: 'pageerror',
        text: 'fiktiver Seitenfehler F-UX1',
        ort: null,
        stack: fehler.stack ?? null,
      },
    ]);
  });

  it('[R-H-11] verbliebeneEintraege: entfernt der Test erwartete Meldungen (consoleErrors.splice(0)), bleiben nur die späteren', () => {
    const q = quelle();
    const consoleErrors: string[] = [];
    const eintraege = sammleKonsole(q, consoleErrors);
    q.emit('console', meldung('error', 'erwartete Netzmeldung (fiktiv)'));
    consoleErrors.splice(0);
    expect(verbliebeneEintraege(eintraege, consoleErrors)).toEqual([]);
    q.emit('console', meldung('warning', 'spätere Warnung (fiktiv)'));
    expect(verbliebeneEintraege(eintraege, consoleErrors).map((e) => e.text)).toEqual([
      'spätere Warnung (fiktiv)',
    ]);
  });

  it('[R-H-11] konsolenMeldung: beginnt wie bisher mit «Konsolenfehler oder -warnungen der Seite: <n>», nennt danach je Meldung Art, Text, Ort und Stack und den Bericht', () => {
    const fehler = new Error('fiktiver Seitenfehler F-UX1');
    const text = konsolenMeldung(
      [
        {
          art: 'error',
          text: 'fiktiver Fehler F-UX1',
          ort: 'http://127.0.0.1/a.js:1:2',
          stack: null,
        },
        { art: 'pageerror', text: fehler.message, ort: null, stack: fehler.stack ?? null },
      ],
      'test-results/wap/konsole/beispiel.json',
    );
    expect(text.startsWith('Konsolenfehler oder -warnungen der Seite: 2')).toBe(true);
    expect(text).toContain('error: fiktiver Fehler F-UX1 (http://127.0.0.1/a.js:1:2)');
    expect(text).toContain('pageerror: fiktiver Seitenfehler F-UX1');
    expect(text).toContain((fehler.stack ?? '').split('\n')[1]?.trim() ?? '');
    expect(text).toContain('test-results/wap/konsole/beispiel.json');
  });

  it('[R-H-11] konsolenDatei: je Test eine eigene JSON-Datei unter test-results/wap/konsole/ mit sicherem Namen', () => {
    const a = konsolenDatei(TEST);
    const b = konsolenDatei({
      ...TEST,
      titlePath: [...TEST.titlePath.slice(0, 1), 'anderer Test'],
    });
    const c = konsolenDatei({ ...TEST, project: 'edge-dist' });
    expect(a).toBe(konsolenDatei(TEST));
    expect(new Set([a, b, c]).size).toBe(3);
    for (const d of [a, b, c]) {
      const rel = relative(process.cwd(), d).split(sep).join('/');
      expect(rel).toMatch(/^test-results\/wap\/konsole\/[A-Za-z0-9._-]+\.json$/);
      expect(rel.length).toBeLessThan(200);
    }
  });

  it('[R-H-11] schreibeKonsole: schreibt Test, Projekt, Datei und Einträge als JSON; ohne Einträge entfernt es einen alten Bericht', () => {
    const ordner = mkdtempSync(join(tmpdir(), 'wap-fux1-konsole-'));
    const datei = join(ordner, 'konsole', 'beispiel.json');
    const eintraege: KonsolenEintrag[] = [
      { art: 'warning', text: 'fiktive Warnung F-UX1', ort: null, stack: null },
    ];
    schreibeKonsole(datei, TEST, eintraege);
    const gelesen = JSON.parse(readFileSync(datei, 'utf8')) as Record<string, unknown>;
    expect(gelesen.test).toBe(TEST.titlePath.join(' › '));
    expect(gelesen.projekt).toBe('edge');
    expect(gelesen.datei).toBe(TEST.file);
    expect(gelesen.eintraege).toEqual(eintraege);
    schreibeKonsole(datei, TEST, []);
    expect(existsSync(datei)).toBe(false);
  });
});
