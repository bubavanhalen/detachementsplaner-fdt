// @vitest-environment jsdom
// Paket E1-02e: Rückfallereignisse der Seite (Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» F «Reihenfolge von
// fallbacks», «Fortsetzungsseite genau dann, wenn continuationPage»; E2/E6 Spaltenkopf mit columnId, V13, V-02e-9;
// J R-10-02, R-10-42, R-10-39). Seitenmodell; pseudonymisierte KVK-Fixture und fiktive Varianten.
import { describe, expect, it } from 'vitest';
import type { PageFallbackEvent, PageRegion } from '../../../../src/model/wap/layout/page/types';
import type { PageModel, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { dayRemark, multiDayRemark } from '../../support/model/builders';
import { seite } from '../../support/page/seite';
import {
  KVK_TAGE,
  KVK_WOCHE,
  kvk,
  MI,
  MO,
  mitEintraegen,
  mitWoche,
} from '../../support/page/varianten';

const RANG: Readonly<Record<PageRegion, number>> = {
  header: 0,
  gridHead: 1,
  block: 2,
  band: 2,
  agenda: 3,
  sidebar: 4,
};

/** KVK mit überlanger Einheit, 40 Tagesbemerkungen am Mo und 40 Wochenbemerkungen (fiktiv). */
function vollerPlan(): Plan {
  const p = { ...kvk(), unit: 'Einheit '.repeat(25).slice(0, 200) };
  const tag = Array.from({ length: 40 }, (_, i) =>
    dayRemark(`e${600 + i}`, 600 + i, {
      date: MO,
      text: `Bemerkung ${String(i + 1).padStart(2, '0')}`,
    }),
  );
  const woche = Array.from({ length: 40 }, (_, i) =>
    multiDayRemark(`e${700 + i}`, 700 + i, {
      text: `Notiz ${String(i + 1).padStart(2, '0')}`,
      scope: { kind: 'week', weekId: KVK_WOCHE },
    }),
  );
  return mitEintraegen(p, [...tag, ...woche]);
}

describe('Reihenfolge der Rückfallereignisse (F)', () => {
  it('[R-10-42] (F) Reihenfolge: Kopf, Rasterkopf, GridLayout.fallbacks unverändert (field und columnId null), Termine (je Spalte continuationPage vor ellipsis), Seitenleiste', () => {
    const L = seite(vollerPlan(), KVK_WOCHE);
    const f = L.fallbacks;
    const raenge = f.map((e) => RANG[e.region]);
    expect(raenge.every((r, i) => i === 0 || r >= (raenge[i - 1] as number))).toBe(true);
    expect(f.some((e) => e.region === 'header')).toBe(true);
    expect(f.some((e) => e.region === 'agenda' && e.kind === 'continuationPage')).toBe(true);
    expect(f.some((e) => e.region === 'sidebar' && e.kind === 'continuationPage')).toBe(true);
    const ausRaster = f.filter((e) => e.region === 'block' || e.region === 'band');
    expect(ausRaster).toEqual(L.grid.fallbacks.map((e) => ({ ...e, field: null, columnId: null })));
    for (const d of KVK_TAGE) {
      const termine = f.filter((e) => e.region === 'agenda' && e.date === d).map((e) => e.kind);
      const c = termine.indexOf('continuationPage');
      const e = termine.indexOf('ellipsis');
      if (c >= 0 && e >= 0) expect(c).toBeLessThan(e);
    }
    for (const e of f.filter((x) => x.region !== 'gridHead')) expect(e.columnId).toBeNull();
  });

  it('[R-10-02] (F) Fortsetzungsseite genau dann, wenn ein Ereignis continuationPage vorliegt: KVK 1 Seite ohne, volle Variante mehr als 1 Seite mit', () => {
    const ohne = seite(kvk(), KVK_WOCHE);
    expect(ohne.pages.length).toBe(1);
    expect(ohne.fallbacks.filter((e) => e.kind === 'continuationPage')).toEqual([]);
    const mit = seite(vollerPlan(), KVK_WOCHE);
    expect(mit.pages.length).toBeGreaterThan(1);
    expect(mit.fallbacks.some((e) => e.kind === 'continuationPage')).toBe(true);
    expect(mit.pages.slice(1).every((p) => p.kind === 'continuation')).toBe(true);
    // Nur verkleinert (V-02e-3): KVK-Mo braucht 15 Zeilen, Kapazität 22 Zeilen in Standardgrösse (Notiz zu
    // R-10-37); 8 einzeilige Tagesbemerkungen mehr ergeben 23 Zeilen, die in Mindestgrösse passen (≥ 24 Zeilen).
    const kurz = Array.from({ length: 8 }, (_, i) =>
      dayRemark(`e${650 + i}`, 650 + i, { date: MO, text: `Hinweis ${i + 1}` }),
    );
    const nurVerkleinert = seite(mitEintraegen(kvk(), kurz), KVK_WOCHE);
    expect(nurVerkleinert.pages.length).toBe(1);
    expect(nurVerkleinert.fallbacks.some((e) => e.kind === 'continuationPage')).toBe(false);
    const mo = nurVerkleinert.texts.filter((r) => r.kind === 'agendaLine' && r.date === MO);
    expect(mo.length).toBeGreaterThanOrEqual(23);
    for (const r of mo) {
      const t = (nurVerkleinert.pages[r.page] as PageModel).items[r.item] as TextItem;
      expect(t.sizePt, 'Terminzeile am Mo verkleinert').toBeLessThan(r.standardSizePt as number);
      expect(t.sizePt).toBeGreaterThanOrEqual(kpTemplate().fontSizes.min);
    }
  });

  it('[R-10-42] (F) Termine-Ereignisse in Spaltenreihenfolge: Überlauf am Mi (zuerst erfasst) und am Mo ergibt continuationPage erst für Mo, dann für Mi', () => {
    const mi = Array.from({ length: 40 }, (_, i) =>
      dayRemark(`e${600 + i}`, 600 + i, {
        date: MI,
        text: `Mittwoch ${String(i + 1).padStart(2, '0')}`,
      }),
    );
    const mo = Array.from({ length: 40 }, (_, i) =>
      dayRemark(`e${700 + i}`, 700 + i, {
        date: MO,
        text: `Montag ${String(i + 1).padStart(2, '0')}`,
      }),
    );
    const L = seite(mitEintraegen(kvk(), [...mi, ...mo]), KVK_WOCHE);
    const termine = L.fallbacks.filter((e) => e.region === 'agenda');
    expect(termine.filter((e) => e.kind === 'continuationPage').map((e) => e.date)).toEqual([
      MO,
      MI,
    ]);
    const daten = termine.map((e) => e.date ?? '');
    expect(daten.every((d, i) => i === 0 || d >= (daten[i - 1] as string))).toBe(true);
    for (const e of termine) expect(e.field).toBe('agendaLine');
  });

  it('[R-10-42] (F) Seitenleisten-Ereignisse in der Reihenfolge B-Kp-72: Überlauf von Zielen, Bemerkungen und Kürzeln ergibt continuationPage für goal, dann remark, dann abbreviation', () => {
    const kuerzel = Array.from({ length: 60 }, (_, i) => `QA${String(i + 1).padStart(2, '0')}`);
    const ziele = Array.from({ length: 100 }, (_, i) => ({
      id: `g${i + 1}`,
      text: `Ziel ${String(i + 1).padStart(3, '0')}`,
      group: null,
    }));
    const bem = Array.from({ length: 40 }, (_, i) =>
      multiDayRemark(`e${800 + i}`, 800 + i, {
        text: i === 0 ? kuerzel.join(', ') : `Notiz ${String(i + 1).padStart(2, '0')}`,
        scope: { kind: 'week', weekId: KVK_WOCHE },
      }),
    );
    const p = mitWoche({ ...kvk(), abbreviationsSelected: kuerzel }, KVK_WOCHE, {
      weekGoals: ziele,
    });
    const L = seite(mitEintraegen(p, bem), KVK_WOCHE);
    const leiste = L.fallbacks.filter((e) => e.region === 'sidebar');
    const RANG_LEISTE: Readonly<Record<string, number>> = {
      goal: 0,
      readiness: 1,
      remark: 2,
      abbreviation: 3,
      legendLabel: 4,
    };
    const raenge = leiste.map((e) => RANG_LEISTE[e.field ?? ''] ?? -1);
    expect(raenge.every((r) => r >= 0)).toBe(true);
    expect(raenge.every((r, i) => i === 0 || r >= (raenge[i - 1] as number))).toBe(true);
    expect(
      leiste
        .filter(
          (e) =>
            e.kind === 'continuationPage' && e.field !== 'readiness' && e.field !== 'legendLabel',
        )
        .map((e) => e.field),
    ).toEqual(['goal', 'remark', 'abbreviation']);
  });
});

describe('Spaltenkopf mit Ereignis (E2, E6, V13, V-02e-9)', () => {
  function mitKopf(setId: string, colId: string, name: string, senkrecht: boolean): Plan {
    const p = kvk();
    return {
      ...p,
      columnSets: p.columnSets.map((s) =>
        s.id === setId
          ? {
              ...s,
              columns: s.columns.map((c) =>
                c.id === colId
                  ? { ...c, name, ...(senkrecht ? { labelOrientation: 'vertical' as const } : {}) }
                  : c,
              ),
            }
          : s,
      ),
    };
  }

  const kopfEreignisse = (f: readonly PageFallbackEvent[], colId: string) =>
    f.filter((e) => e.region === 'gridHead' && e.columnId === colId);

  it('[R-10-39] waagrechter Spaltenkopf, der auch in Mindestgrösse nicht passt: je Tag des Satzes ein Ereignis tooManyColumns (E1-02l R1, statt ellipsis bzw. textOmitted) mit region gridHead, field columnHead, date, columnId und Spaltensatz', () => {
    const L = seite(mitKopf('s7', 'c9', 'Ausbildungsverantwortlichkeitsbereich', false), KVK_WOCHE);
    const e = kopfEreignisse(L.fallbacks, 'c9');
    expect(e.map((x) => x.date)).toEqual([KVK_TAGE[0], KVK_TAGE[1]]);
    for (const x of e) {
      // E1-02l R1 (TE-E102l-01): nie gekürzt, Befund «zu viele Spalten für diesen Tag» am Spaltensatz.
      expect(x.kind).toBe('tooManyColumns');
      expect(x).toMatchObject({
        columnSetId: 's7',
        region: 'gridHead',
        field: 'columnHead',
        entryId: null,
        piece: null,
        dropped: [],
      });
    }
    expect(seite(kvk(), KVK_WOCHE).fallbacks.filter((x) => x.region === 'gridHead')).toEqual([]);
  });

  it('[R-10-39] langer senkrechter Spaltenkopf (V-02e-9; E1-02l R1): an jedem Tag des Satzes vollständig (umbrochen), nie gekürzt; ein Ereignis nur als tooManyColumns mit Spaltensatz', () => {
    const lang = 'Kommandoposten und Übermittlung im Gebirge';
    const L = seite(mitKopf('s16', 'c17', lang, true), KVK_WOCHE);
    const e = kopfEreignisse(L.fallbacks, 'c17');
    // E1-02l R1 (TE-E102l-01): Der Kopf steht an Mi–Fr vollständig (senkrecht umbrochen statt gekürzt).
    const soll = lang.replace(/\s/g, '');
    for (const date of [KVK_TAGE[2], KVK_TAGE[3], KVK_TAGE[4]]) {
      const zeilen = L.texts
        .filter((r) => r.kind === 'columnHead' && r.date === date)
        .map((r) => (L.pages[r.page] as PageModel).items[r.item] as TextItem)
        .map((t) => t.runs.map((x) => x.text).join(''));
      expect(zeilen.join('').replace(/-/g, '').replace(/\s/g, ''), `Kopf am ${date}`).toContain(
        soll,
      );
      for (const z of zeilen) expect(z).not.toContain('…');
    }
    for (const x of e) {
      // E1-02l R1 (TE-E102l-01): nie gekürzt, Befund «zu viele Spalten für diesen Tag» am Spaltensatz.
      expect(x.kind).toBe('tooManyColumns');
      expect(x).toMatchObject({
        columnSetId: 's16',
        region: 'gridHead',
        field: 'columnHead',
        entryId: null,
        piece: null,
        dropped: [],
      });
    }
  });
});
