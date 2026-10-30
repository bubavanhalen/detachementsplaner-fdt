// @vitest-environment node
// Paket H-LAYOUT, Befund SA-H-01 (Gate S A1; R-10-47, R-10-48, R-10-43, R-7-11): Teilaufgaben im Blocktext der
// Layout-Schicht – Zeilenfolge, Leerzeilen, Rückfallreihenfolge, P8 mit Ursache «Teilaufgabe gekürzt/entfallen».
// Fiktive Daten (Titel aus dem Gate-S-Wortlaut, Ltg als Funktionskürzel).
import { describe, expect, it } from 'vitest';
import { runChecks } from '../../../../src/model/wap/checks/run';
import { type BlockTextSpec, blockText } from '../../../../src/model/wap/layout/entries/text';
import type { DroppedLine } from '../../../../src/model/wap/layout/grid/types';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';
import type { Block, Plan } from '../../../../src/model/wap/types';
import { einTeil, lege, MO, rasterPlan, STD, texte, zeilenText } from '../../support/grid/build';
import { beso, withEntries } from '../../support/model/builders';
import {
  blockMitTeilaufgaben,
  fahrerRep,
  fsgFz,
  teilaufgabe,
} from '../../support/model/teilaufgaben';

const FS = kpTemplate().fontSizes;

function plan(b: Block): Plan {
  return rasterPlan({ entries: [b] });
}

function block(over: Partial<Block> = {}, subtasks = [fsgFz(), fahrerRep()]): Block {
  return blockMitTeilaufgaben('e1', 1, subtasks, {
    date: MO,
    time: { form: 'range', from: 480, to: 840 },
    columns: { kind: 'ids', ids: [STD.p1, STD.p2] },
    ...over,
  });
}

/** Spezifikation mit allen Zeilenarten, je Zeile ein Absatz (Ltg und Ort auf eigenen Zeilen). */
function voll(): BlockTextSpec {
  return {
    timeLine: null,
    title: [{ text: 'Block Alpha Beta', weight: 'bold' }],
    titleHyphenate: 'ifWordDoesNotFit',
    supplement: 'Zusatz',
    ltg: 'Kp Kdt',
    ort: 'Halle',
    tn: 'Zug',
    tenue: 'B',
    ltgMode: 'ownLinePrefixed',
    direction: 'horizontal',
    subtasks: [
      { title: [{ text: 'Eins', weight: 'bold' }], ltg: 'Zfhr', ort: 'Platz' },
      { title: [{ text: 'Zwei', weight: 'bold' }], ltg: 'Four', ort: 'Hof' },
    ],
  };
}

/** Entfallreihenfolge nach R-10-48 für `voll()` (je Teilaufgabe von der letzten zur ersten). */
const REIHENFOLGE: readonly DroppedLine[] = [
  'subtaskGap',
  'subtaskGap',
  'tn',
  'tenue',
  'subtaskOrt',
  'subtaskOrt',
  'subtaskLtg',
  'subtaskLtg',
  'ltg',
  'ort',
  'supplement',
  'subtaskTitle',
  'subtaskTitle',
];

describe('Teilaufgaben im Blocktext (R-10-47)', () => {
  it('[R-10-47] Zeilenfolge: Blocktitel, Block-Ltg, Leerzeile, je Teilaufgabe Titel fett und «Ltg (Ort)» normal; ohne Ltg und Ort keine zweite Zeile', () => {
    const L = lege(plan(block()));
    const zeilen = texte(L, 'e1');
    expect(zeilen.map(zeilenText)).toEqual([
      'Fsg Mat',
      'Kp Kdt',
      'Fsg Fz',
      'Zfhr (Halle 3)',
      'Fahrer Rep anschl Vs Ukft',
    ]);
    const fett = zeilen.map((z) => z.runs.every((r) => r.weight === 'bold'));
    expect(fett).toEqual([true, false, true, false, true]);
    // Leerzeile vor jeder Gruppe: Abstand der Grundlinien = Zeile + Leerzeile.
    // Oberkante = Grundlinie − Oberlänge; Leerzeile in Standardgrösse (Höhe einer Ltg-Zeile).
    const top = zeilen.map((z) => z.baselineY - ascentPt(z.sizePt));
    const lh = (i: number) => lineHeightPt(zeilen[i]?.sizePt ?? 0);
    expect((top[2] as number) - (top[1] as number)).toBeCloseTo(lh(1) + lh(1), 6);
    expect((top[3] as number) - (top[2] as number)).toBeCloseTo(lh(2), 6);
    expect((top[4] as number) - (top[3] as number)).toBeCloseTo(lh(3) + lh(3), 6);
  });

  it('[R-10-47] alle Zeilen zentriert zur Blockmitte (±0,5 pt), kein Einzug (Referenz e35, Q-041)', () => {
    const L = lege(plan(block()));
    const r = einTeil(L, 'e1', 'block').rect;
    for (const z of texte(L, 'e1')) {
      const breite = measureRuns(z.runs, z.sizePt);
      expect(Math.abs(z.x + breite / 2 - (r.x + r.w / 2))).toBeLessThanOrEqual(0.5);
    }
  });

  it('[R-10-47] Titel der Teilaufgabe immer fett, auch wenn der Rich Text normal ist (Eingabe im Seitenfeld)', () => {
    const L = lege(plan(block({}, [teilaufgabe('Normal geschrieben', 'Zfhr')])));
    const t = texte(L, 'e1').find((z) => zeilenText(z) === 'Normal geschrieben');
    expect(t?.runs.every((r) => r.weight === 'bold')).toBe(true);
  });

  it('[R-10-47] Block ohne Teilaufgaben: Text unverändert (keine Leerzeile, keine zusätzliche Zeile)', () => {
    const { subtasks: _weg, ...ohne } = block();
    const L = lege(plan(ohne));
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['Fsg Mat', 'Kp Kdt']);
  });
});

describe('Rückfallreihenfolge mit Teilaufgaben (R-10-48, R-10-43)', () => {
  it('[R-10-48] schrittweise niedrigere Fläche: entfallene Zeilen sind stets ein Anfang der Reihenfolge R-10-48, jede Stufe kommt vor, danach «…»', () => {
    const s = voll();
    const gesehen = new Set<number>();
    let letzte = -1;
    let ellipse = false;
    for (let h = 120; h > 2; h -= 0.25) {
      const o = blockText(s, { x: 0, y: 0, w: 30, h }, FS);
      if (o.event === null) {
        expect(letzte).toBe(-1);
        continue;
      }
      if (o.event.kind === 'lineDropped') {
        const d = o.event.dropped;
        expect(d).toEqual(REIHENFOLGE.slice(0, d.length));
        expect(d.length).toBeGreaterThanOrEqual(letzte);
        letzte = d.length;
        gesehen.add(d.length);
      } else {
        // Danach «…» (R-10-41); in einer Fläche ohne Platz auch für «…» entfällt der Text (textOmitted, P8).
        expect(['ellipsis', 'textOmitted']).toContain(o.event.kind);
        if (o.event.kind === 'ellipsis') ellipse = true;
      }
    }
    expect([...gesehen].sort((a, b) => a - b)).toEqual(REIHENFOLGE.map((_, i) => i + 1));
    expect(ellipse).toBe(true);
  });

  it('[R-10-48] die Teilaufgaben entfallen von der letzten zur ersten: zuerst fehlt «Zwei», «Eins» bleibt', () => {
    const s = voll();
    for (let h = 120; h > 2; h -= 0.25) {
      const o = blockText(s, { x: 0, y: 0, w: 30, h }, FS);
      const d = o.event?.dropped ?? [];
      if (o.event?.kind !== 'lineDropped' || d.filter((k) => k === 'subtaskTitle').length !== 1)
        continue;
      const text = o.lines.map((l) => l.runs.map((r) => r.text).join(''));
      expect(text).toContain('Eins');
      expect(text).not.toContain('Zwei');
      return;
    }
    expect.unreachable('Stufe mit genau einer entfallenen Teilaufgabe nicht erreicht');
  });

  it('[R-7-11][R-10-43] P8 mit Ursache «Teilaufgabe gekürzt» bzw. «Teilaufgabe entfallen» und nächstem Schritt', () => {
    const opts = { paper: 'A4' as const, showStatus: true, templates: builtInTemplates() };
    const kurz = (to: number): Plan => plan(block({ time: { form: 'range', from: 480, to } }));
    const meldung = (p: Plan): string =>
      runChecks({ plan: p, layoutFor: (id) => layoutWeekPage(p, id, opts) })
        .filter((f) => f.rule === 'P8' && f.entryId === 'e1')
        .map((f) => `${f.message.cause} | ${f.message.nextStep}`)
        .join('\n');
    const lang = meldung(kurz(840));
    expect(lang).toBe('');
    // Kleinste Höhe mit Teilaufgabe gekürzt, dann mit Teilaufgabe entfallen (Suche, da die Fläche vom Layout abhängt).
    let gekuerzt = '';
    let entfallen = '';
    for (let to = 840; to > 495 && entfallen === ''; to -= 5) {
      const m = meldung(kurz(to));
      if (gekuerzt === '' && m.includes('Teilaufgabe gekürzt.')) gekuerzt = m;
      if (m.includes('Teilaufgabe entfallen.')) entfallen = m;
    }
    expect(gekuerzt).toMatch(/Im PDF entfallen .*Teilaufgabe/);
    expect(gekuerzt).toContain('Block vergrössern');
    expect(entfallen).toMatch(/1 Teilaufgabe ganz/);
  });

  it('[R-10-43] kein Text ausserhalb des Blockrahmens, auch im Rückfall', () => {
    for (let to = 840; to > 495; to -= 15) {
      const L = lege(plan(block({ time: { form: 'range', from: 480, to } })));
      const r = einTeil(L, 'e1', 'block').rect;
      for (const z of texte(L, 'e1')) {
        expect(z.frame.x).toBeGreaterThanOrEqual(r.x - 1e-6);
        expect(z.frame.y).toBeGreaterThanOrEqual(r.y - 1e-6);
        expect(z.frame.x + z.frame.w).toBeLessThanOrEqual(r.x + r.w + 1e-6);
        expect(z.frame.y + z.frame.h).toBeLessThanOrEqual(r.y + r.h + 1e-6);
        expect(z.baselineY).toBeLessThanOrEqual(r.y + r.h);
        expect(z.sizePt).toBeGreaterThanOrEqual(FS.min);
      }
    }
  });

  it('[R-10-48] Titel der Teilaufgabe mit Beso-Verweis zeigt die aktuelle Nummer (K-5)', () => {
    const b = block({}, [
      {
        title: [
          { text: 'Nach ', bold: false },
          { text: '(1)', bold: false, besoRef: 'e9' },
        ],
        ltg: '',
        ort: '',
      },
    ]);
    const L = lege(withEntries(plan(b), [beso('e9', 2, { date: MO, besoNumber: 7 })]));
    expect(texte(L, 'e1').map(zeilenText)).toContain('Nach (7)');
  });
});
