// @vitest-environment jsdom
// Paket E1-02d: Rapporte – Kästchen in der Rap-Spalte, Rapport-Block, Text und Ausrichtung (Vertrag E1-02d
// Abschnitt 2c, 2d Nr 3, 2e; Änderungsnotizen V05, V06 d, Runde 2 V19 b/c; Beschrieb 4.6 «Rapport», 4.7).
// Fiktive Pläne; Befehle aus E1-03 nur als Vorbereitung (updateEntry, deleteEntries).
import { describe, expect, it } from 'vitest';
import type { CommandContext } from '../../../../src/model/wap/commands/command';
import { deleteEntries, updateEntry } from '../../../../src/model/wap/commands/entries';
import { abbreviationsForWeek } from '../../../../src/model/wap/derive/abbreviations';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import { ascentPt } from '../../../../src/model/wap/layout/text/metrics';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Entry, Rapport } from '../../../../src/model/wap/types';
import {
  DI,
  einTeil,
  ereignisse,
  feld,
  geo,
  itemsVon,
  LINIEN,
  lege,
  MO,
  nahe,
  rasterPlan,
  rechtecke,
  rechteckNahe,
  STD,
  type TagSpec,
  teile,
  texte,
  texteIn,
  textflaeche,
  WOCHE,
  X0,
  zeileImRahmen,
  zeilenText,
} from '../../support/grid/build';
import { CAT, rapport, WEEKDAYS } from '../../support/model/builders';

const ctx: CommandContext = { templates: builtInTemplates() };
const range = (from: number, to: number) => ({ form: 'range' as const, from, to });

function r(id: string, seq: number, over: Partial<Rapport> = {}): Rapport {
  return rapport(id, seq, { date: MO, code: 'KR', time: range(780, 840), ...over });
}

/** Standardsatz mit Tagesbreite W: Rap-Spalte = W / 9 bei x = X0 + 6 · W / 9. */
const rap = (W: number) => ({ x: X0 + (6 * W) / 9, w: W / 9 });
const lr = (
  entries: readonly Entry[],
  W = 180,
  over: Parameters<typeof rasterPlan>[0] = {},
): GridLayout => lege(rasterPlan({ entries, ...over }), { W });

describe('Rapport-Kästchen (2d Nr 3; R-4.6-19)', () => {
  it('[R-4.6-19] Rapport 1300-1400 → Kästchen 60 Min hoch, volle Breite der Rap-Spalte; Rahmen rapportBorder', () => {
    const L = lr([r('e1', 1)]);
    const p = einTeil(L, 'e1', 'rapportBox');
    rechteckNahe(p.rect, feld(rap(180), 780, 840));
    expect(p.span).toEqual({ from: 780, to: 840 });
    expect([p.part, p.windowId, p.textCarrier]).toEqual([0, null, true]);
    const rect = rechtecke(L, 'e1');
    expect(rect).toHaveLength(1);
    expect(rect[0]?.role).toBe('rapport');
    expect(rect[0]?.stroke).toEqual(LINIEN.rapportBorder);
    expect(rect[0]?.fill).toEqual({ r: 255, g: 255, b: 153 });
    expect(geo(L, 'e1').type).toBe('rapport');
  });

  it('[R-4.6-19] Zeitpunkt 0700 → 0700–0730; 0700-0710 → mindestens 30 Min', () => {
    const L = lr([
      r('e1', 1, { time: { form: 'point', at: 420 } }),
      r('e2', 2, { time: range(1020, 1030) }),
    ]);
    expect(einTeil(L, 'e1').span).toEqual({ from: 420, to: 450 });
    rechteckNahe(einTeil(L, 'e1').rect, feld(rap(180), 420, 450));
    expect(einTeil(L, 'e2').span).toEqual({ from: 1020, to: 1050 });
    rechteckNahe(einTeil(L, 'e2').rect, feld(rap(180), 1020, 1050));
  });

  it('[R-4.6-19] Füllung nach Kategorie (Ltg Bat)', () => {
    const L = lr([r('e1', 1, { code: 'BR 0', categoryId: CAT.bat })]);
    expect(rechtecke(L, 'e1')[0]?.fill).toEqual({ r: 204, g: 236, b: 255 });
  });

  it('[R-4.6-19] (V-02d-4) gleichzeitige Rapporte teilen die Rap-Spalte; Berührung zählt nicht', () => {
    const L = lr([
      r('e1', 1, { time: range(600, 660) }),
      r('e2', 2, { time: range(630, 660), code: 'DR' }),
      r('e3', 3, { time: range(900, 930) }),
      r('e4', 4, { time: range(930, 960) }),
    ]);
    const s = rap(180);
    rechteckNahe(einTeil(L, 'e1').rect, feld({ x: s.x, w: s.w / 2 }, 600, 660));
    rechteckNahe(einTeil(L, 'e2').rect, feld({ x: s.x + s.w / 2, w: s.w / 2 }, 630, 660));
    rechteckNahe(einTeil(L, 'e3').rect, feld(s, 900, 930));
    rechteckNahe(einTeil(L, 'e4').rect, feld(s, 930, 960));
  });

  it('[R-4.6-19] (V-02d-4, V05) Zusammenstoss nach der gezeichneten Spanne: 0400 (gezeichnet 0500–0530) und 0500 teilen sich', () => {
    const L = lr([
      r('e1', 1, { time: { form: 'point', at: 240 } }),
      r('e2', 2, { time: { form: 'point', at: 300 } }),
    ]);
    const s = rap(180);
    // E1-02l R2 (TE-E102l-01): ein Träger neben dem Kästchen (outsideLabel) ist als weiteres Teilstück zulässig.
    rechteckNahe(einTeil(L, 'e1', 'rapportBox').rect, feld({ x: s.x, w: s.w / 2 }, 300, 330));
    rechteckNahe(
      einTeil(L, 'e2', 'rapportBox').rect,
      feld({ x: s.x + s.w / 2, w: s.w / 2 }, 300, 330),
    );
    expect(einTeil(L, 'e1', 'rapportBox').openTop).toBe(true);
    expect(einTeil(L, 'e2', 'rapportBox').openTop).toBe(false);
  });

  it('[R-4.6-19] Text: Kürzel fett in rapportCode-Grösse, «(‹Ort›)» normal, oben bündig', () => {
    const L = lr([r('e1', 1, { ort: 'Kaserne' })], 360);
    const z = texte(L, 'e1');
    expect(z.map(zeilenText)).toEqual(['KR', '(Kaserne)']);
    expect(z.map((t) => t.sizePt)).toEqual([5, 5]);
    expect(z[0]?.runs.map((x) => x.weight)).toEqual(['bold']);
    expect(z[1]?.runs.map((x) => x.weight)).toEqual(['regular']);
    const f = textflaeche(feld(rap(360), 780, 840), 0.96);
    rechteckNahe(z[0]?.frame ?? f, f);
    nahe(z[0]?.baselineY ?? 0, f.y + ascentPt(5));
    for (const t of z) {
      expect(t.role).toBe('rapport');
      zeileImRahmen(t);
    }
  });

  it('[R-4.5-10] Rapport 2350-0005: Mindesthöhe vor der Teilung, Mo [1430, 1440], Di [0, 20] als Fortsetzung', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: STD.set,
      display: i < 2 ? 'full' : 'hidden',
    }));
    const L = lr([r('e1', 1, { time: range(1430, 1445) })], 360, { tage });
    const ps = teile(L, 'e1', 'rapportBox');
    expect(ps.map((p) => [p.date, p.span, p.continuation])).toEqual([
      [MO, { from: 1430, to: 1440 }, 'toNextDay'],
      [DI, { from: 0, to: 20 }, 'fromPreviousDay'],
    ]);
  });
});

describe('Rapport-Beschriftung senkrecht (2e «Ausrichtung»; R-4.6-21; V-02d-16)', () => {
  it('[R-4.6-21] Kürzel passt waagrecht auch in Mindestgrösse nicht, senkrecht schon → senkrecht, Drehung 90, kein Ereignis', () => {
    // Rap-Spalte 9 pt: Textbreite 7,04 pt < «AR2» fett 4,5 pt (9,00 pt); senkrecht 5,75 pt Zeilenhöhe passt.
    const L = lr([r('e1', 1, { code: 'AR2' })], 81);
    const p = einTeil(L, 'e1', 'rapportBox');
    expect(p.textOrientation).toBe('vertical');
    const z = texte(L, 'e1');
    expect(z.map((t) => [zeilenText(t), t.rotation, t.sizePt])).toEqual([['AR2', 90, 5]]);
    for (const t of z) zeileImRahmen(t);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.6-21] (V-02d-16; F-LAYOUT2 Punkt 13, Entscheid 19.10.2026 «13: ja») mit Ort: weder waagrecht noch senkrecht beide Zeilen → Kürzel senkrecht im Kästchen, «(‹Ort›)» waagrecht im Träger daneben, kein Ereignis', () => {
    const L = lr([r('e1', 1, { code: 'AR2', ort: 'Kaserne' })], 81);
    expect(einTeil(L, 'e1', 'rapportBox').textOrientation).toBe('vertical');
    expect(einTeil(L, 'e1', 'outsideLabel').textOrientation).toBe('horizontal');
    expect(texte(L, 'e1').map((t) => [zeilenText(t), t.rotation])).toEqual([
      ['AR2', 90],
      ['(Kaserne)', 0],
    ]);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.6-21] Kürzel passt waagrecht → waagrecht (Gegenprobe)', () => {
    const L = lr([r('e1', 1, { code: 'AR2' })], 180);
    expect(einTeil(L, 'e1', 'rapportBox').textOrientation).toBe('horizontal');
    expect(texte(L, 'e1').map((t) => t.rotation)).toEqual([0]);
  });

  it('[R-4.6-21] (V06 d) Rapport-Block in schmaler Spalte: Ausrichtung «auto» mit dem Kürzel als Titel → senkrecht', () => {
    const L = lr(
      [
        r('e1', 1, {
          code: 'AR2',
          time: range(480, 720),
          display: 'onlyInColumns',
          displayColumns: { kind: 'ids', ids: [STD.p1] },
        }),
      ],
      54,
    );
    const p = einTeil(L, 'e1', 'block');
    expect(p.textOrientation).toBe('vertical');
    expect(texte(L, 'e1').map((t) => [zeilenText(t), t.rotation])).toEqual([['AR2', 90]]);
  });
});

describe('Anzeige «auch in Spalten» und «nur in Spalten» (2d Nr 3; R-4.6-22, R-4.6-23)', () => {
  const auch = (): Rapport =>
    r('e1', 1, {
      time: range(600, 660),
      ort: 'Kaserne',
      display: 'alsoInColumns',
      displayColumns: { kind: 'ids', ids: [STD.p1, STD.p2] },
    });

  it('[R-4.6-22] Kästchen und Block im selben Eintrag; Block in den gewählten Spalten mit Kürzel fett und «(‹Ort›)»', () => {
    const L = lr([auch()]);
    expect(L.entries.filter((e) => e.entryId === 'e1')).toHaveLength(1);
    const box = einTeil(L, 'e1', 'rapportBox');
    const blk = einTeil(L, 'e1', 'block');
    rechteckNahe(box.rect, feld(rap(180), 600, 660));
    rechteckNahe(blk.rect, feld({ x: X0, w: 80 }, 600, 660));
    expect(texteIn(L, 'e1', blk.rect).map(zeilenText)).toEqual(['KR', '(Kaserne)']);
    expect(texteIn(L, 'e1', blk.rect)[0]?.runs.map((x) => x.weight)).toEqual(['bold']);
    const rollen = itemsVon(L, 'e1').map((i) => i.role);
    expect(rollen).toContain('block');
    expect(rollen).toContain('rapport');
    const blockRect = rechtecke(L, 'e1').find((i) => i.role === 'block');
    expect(blockRect?.stroke).toEqual(LINIEN.blockBorder);
  });

  it('[R-4.6-22] Zeitänderung (updateEntry) verschiebt Kästchen und Block; Löschen (deleteEntries) entfernt beide', () => {
    const plan = rasterPlan({ entries: [auch()] });
    const geaendert = updateEntry(plan, 'e1', 'rapport', { time: range(840, 900) }, ctx).plan;
    const L = lege(geaendert);
    rechteckNahe(einTeil(L, 'e1', 'rapportBox').rect, feld(rap(180), 840, 900));
    rechteckNahe(einTeil(L, 'e1', 'block').rect, feld({ x: X0, w: 80 }, 840, 900));
    const geloescht = deleteEntries(geaendert, ['e1'], ctx).plan;
    const L2 = lege(geloescht);
    expect(L2.entries.some((e) => e.entryId === 'e1')).toBe(false);
    expect(L2.items.some((i) => i.entryId === 'e1')).toBe(false);
  });

  it('[R-4.6-23] «nur in Spalten»: kein Kästchen in der Rap-Spalte, Block in den gewählten Spalten', () => {
    const L = lr([
      r('e1', 1, {
        time: range(600, 660),
        display: 'onlyInColumns',
        displayColumns: { kind: 'ids', ids: [STD.p3] },
      }),
    ]);
    expect(teile(L, 'e1', 'rapportBox')).toEqual([]);
    rechteckNahe(einTeil(L, 'e1', 'block').rect, feld({ x: X0 + 80, w: 40 }, 600, 660));
    expect(itemsVon(L, 'e1').some((i) => i.role === 'rapport')).toBe(false);
  });

  it('[R-4.6-23] «Rap-Spalte»: nur das Kästchen, kein Block', () => {
    const L = lr([r('e1', 1, { displayColumns: { kind: 'ids', ids: [STD.p1] } })]);
    expect(teile(L, 'e1').map((p) => p.kind)).toEqual(['rapportBox']);
  });
});

describe('Zeitzeile bei Rapporten (Notiz Runde 2 V19 b, c)', () => {
  it('[R-4.5-07] (V19 b) Kästchen 0430-0630 mit Ort, Rap-Spalte 30 pt: Kürzel, «0430-0630», «(Ort)»; gezeichnet [0500, 0630]', () => {
    const L = lr([r('e1', 1, { time: range(270, 390), ort: 'Kaserne' })], 270);
    const p = einTeil(L, 'e1', 'rapportBox');
    rechteckNahe(p.rect, feld(rap(270), 300, 390));
    expect(p.openTop).toBe(true);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['KR', '0430-0630', '(Kaserne)']);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.5-07] (V19 c) «nur in Spalten» 0430-0600: Rapport-Block beginnt mit «0430-0600»', () => {
    const L = lr([
      r('e1', 1, {
        time: range(270, 360),
        display: 'onlyInColumns',
        displayColumns: { kind: 'ids', ids: [STD.p1, STD.p2] },
      }),
    ]);
    expect(texte(L, 'e1').map(zeilenText)).toEqual(['0430-0600', 'KR']);
  });
});

describe('Kürzel in Raster und Liste gleich (R-4.7-17)', () => {
  it('[R-4.7-17] Rapport «AR2»: Text des Kästchens zeichengleich mit code und dem Eintrag der Kürzelliste', () => {
    const plan = rasterPlan({ entries: [r('e1', 1, { code: 'AR2' })] });
    const L = lege(plan);
    const z = texte(L, 'e1').map(zeilenText);
    expect(z).toEqual(['AR2']);
    const liste = abbreviationsForWeek(plan, WOCHE);
    expect(liste).toContain(z[0]);
    expect(liste.filter((k) => k.toUpperCase() === 'AR2')).toEqual(['AR2']);
  });
});

describe('Spannen um 2400 (Notiz test-engineer Runde 1 T2; V-02d-20)', () => {
  it('[R-4.5-07] (V-02d-20) Rapport Zeitpunkt 2400: Kästchen [2330, 2400], unten offen, Spanne unbegrenzt', () => {
    const L = lr([r('e1', 1, { time: { form: 'point', at: 1440 } })]);
    const p = einTeil(L, 'e1', 'rapportBox');
    expect(p.span).toEqual({ from: 1440, to: 1470 });
    rechteckNahe(p.rect, feld(rap(180), 1410, 1440));
    expect([p.openTop, p.openBottom, p.continuation]).toEqual([false, true, 'none']);
    expect(p.date).toBe(MO);
  });

  it('[R-4.6-19] (V-02d-20) Zeitpunkt 2400 mit Ort, 0,7 pt/Min, Rap-Spalte 30 pt: [2330, 2400] unten offen; KR, «2400», «(Kaserne)» in 5 pt, oben bündig', () => {
    const L = lege(
      rasterPlan({ entries: [r('e1', 1, { time: { form: 'point', at: 1440 }, ort: 'Kaserne' })] }),
      {
        W: 270,
        ppm: 0.7,
      },
    );
    const p = einTeil(L, 'e1', 'rapportBox');
    const flaeche = feld(rap(270), 1410, 1440, 240, 0.7);
    rechteckNahe(p.rect, flaeche);
    expect(p.openBottom).toBe(true);
    const z = texte(L, 'e1');
    expect(z.map((t) => [zeilenText(t), t.sizePt, t.rotation])).toEqual([
      ['KR', 5, 0],
      ['2400', 5, 0],
      ['(Kaserne)', 5, 0],
    ]);
    expect(z[0]?.runs.map((x) => x.weight)).toEqual(['bold']);
    const f = textflaeche(flaeche, 0.96);
    nahe(z[0]?.baselineY ?? 0, f.y + ascentPt(5));
    for (const t of z) zeileImRahmen(t);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.6-19] (V-02d-20; E1-02l R2) Mindesthöhe ist kein Zuschnitt: 2350-2400 und 2345-2350 bis y(2400), unten geschlossen, ohne Zeitzeile, Kürzel im Träger daneben (labelOutside)', () => {
    for (const [id, von, bis] of [
      ['e1', 1430, 1440],
      ['e2', 1425, 1430],
    ] as const) {
      // Je eigener Plan: volle Rap-Spalte 30 pt; Fläche [von, 2400] nach Mindesthöhe und Zuschnitt.
      const L = lr([r(id, 1, { time: range(von, bis) })], 270);
      const p = einTeil(L, id, 'rapportBox');
      rechteckNahe(p.rect, feld(rap(270), von, 1440));
      expect([p.openTop, p.openBottom], id).toEqual([false, false]);
      // E1-02l R2 (TE-E102l-01): Kürzel nie weggelassen, vollständig im Träger neben dem Kästchen.
      expect(texte(L, id).map(zeilenText), id).toEqual(['KR']);
      expect(ereignisse(L, id), id).toEqual([
        {
          kind: 'labelOutside',
          region: 'block',
          weekId: WOCHE,
          date: MO,
          entryId: id,
          piece: 1,
          dropped: [],
        },
      ]);
    }
  });

  it('[R-4.5-10] (V-02d-20) Rapport 2300-0100, 0,7 pt/Min: Teil Mo [2300, 2400] unten offen ohne Zeitzeile; Teil Di [0500, 0530] oben offen mit «2300-0100»', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: STD.set,
      display: i < 2 ? 'full' : 'hidden',
    }));
    const L = lege(rasterPlan({ tage, entries: [r('e1', 1, { time: range(1380, 1500) })] }), {
      W: 540,
      ppm: 0.7,
    });
    const ps = teile(L, 'e1', 'rapportBox');
    expect(ps.map((p) => p.date)).toEqual([MO, DI]);
    const [mo, di] = ps;
    expect(mo?.span).toEqual({ from: 1380, to: 1440 });
    expect([mo?.openTop, mo?.openBottom, mo?.continuation]).toEqual([false, true, 'toNextDay']);
    rechteckNahe(mo?.rect ?? feld(rap(270), 0, 0), feld(rap(270), 1380, 1440, 240, 0.7));
    expect(di?.span).toEqual({ from: 0, to: 60 });
    expect([di?.openTop, di?.openBottom, di?.continuation]).toEqual([
      true,
      false,
      'fromPreviousDay',
    ]);
    const rapDi = { x: rap(270).x + 270, w: rap(270).w };
    rechteckNahe(di?.rect ?? feld(rapDi, 0, 0), feld(rapDi, 300, 330, 240, 0.7));
    expect(texteIn(L, 'e1', mo?.rect ?? feld(rapDi, 0, 0)).map(zeilenText)).toEqual(['KR']);
    expect(texteIn(L, 'e1', di?.rect ?? feld(rapDi, 0, 0)).map(zeilenText)).toEqual([
      'KR',
      '2300-0100',
    ]);
    expect(ereignisse(L, 'e1')).toEqual([]);
  });

  it('[R-4.5-10] (V-02d-20) Rapport 2400-0010, 0,7 pt/Min: leeres Teil Mo [2330, 2400] und Teil Di [0500, 0530] tragen je «KR», «2400-0010»', () => {
    const tage: TagSpec[] = WEEKDAYS.map((_, i) => ({
      set: STD.set,
      display: i < 2 ? 'full' : 'hidden',
    }));
    const L = lege(rasterPlan({ tage, entries: [r('e1', 1, { time: range(1440, 1450) })] }), {
      W: 540,
      ppm: 0.7,
    });
    const ps = teile(L, 'e1', 'rapportBox');
    expect(ps.map((p) => p.date)).toEqual([MO, DI]);
    const [mo, di] = ps;
    const rapMo = rap(270);
    const rapDi = { x: rapMo.x + 270, w: rapMo.w };
    expect(mo?.span).toEqual({ from: 1440, to: 1440 });
    expect([mo?.openTop, mo?.openBottom, mo?.continuation]).toEqual([false, true, 'toNextDay']);
    rechteckNahe(mo?.rect ?? feld(rapMo, 0, 0), feld(rapMo, 1410, 1440, 240, 0.7));
    expect(di?.span).toEqual({ from: 0, to: 30 });
    expect([di?.openTop, di?.openBottom, di?.continuation]).toEqual([
      true,
      false,
      'fromPreviousDay',
    ]);
    rechteckNahe(di?.rect ?? feld(rapDi, 0, 0), feld(rapDi, 300, 330, 240, 0.7));
    for (const teil of [mo, di]) {
      const z = texteIn(L, 'e1', teil?.rect ?? feld(rapDi, 0, 0));
      expect(z.map((t) => [zeilenText(t), t.sizePt, t.rotation])).toEqual([
        ['KR', 5, 0],
        ['2400-0010', 5, 0],
      ]);
      const f = textflaeche(teil?.rect ?? feld(rapDi, 0, 0), 0.96);
      nahe(z[0]?.baselineY ?? 0, f.y + ascentPt(5));
    }
    expect(ereignisse(L, 'e1')).toEqual([]);
  });
});
