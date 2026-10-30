// @vitest-environment jsdom
// Plausibilität der pseudonymisierten KVK-Fixture über die Modellfunktionen (Vertrag E1-02a Abschnitt 6;
// Plan §4.2 «Anzahlen je Typ»). Die Fixture ist ein Abbild der KVK-Woche (28.09.–04.10.2026), Stand «nur
// oberste Ebene» nach Gate-S-Auflage A2 (Vertrag E1-02j Abschnitt 1; Zeitregel Q-042, Arbeitsannahme).
import { describe, expect, it } from 'vitest';
import { isoWeek, weekDates } from '../../../../src/model/wap/calendar';
import { abbreviationsForWeek } from '../../../../src/model/wap/derive/abbreviations';
import { agendaLine, agendaLinesForDate } from '../../../../src/model/wap/derive/agenda';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import { entriesOnDate } from '../../../../src/model/wap/derive/entries';
import { markerLabel } from '../../../../src/model/wap/derive/marker';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import { compareEntries } from '../../../../src/model/wap/time';
import type { Beso, Block, Entry, Marker } from '../../../../src/model/wap/types';
import { validateColumnSet, validateEntry } from '../../../../src/model/wap/validate';
import { plain, type WEEKDAYS } from '../../support/model/builders';
import { loadKvkPlan } from '../../support/model/kvk-fixture';

const plan = loadKvkPlan();
const kvk = plan.weeks[0];
const weekId = kvk?.id ?? '';

function besoNr(nr: number): Beso {
  const b = Object.values(plan.entries).find(
    (e): e is Beso => e.type === 'beso' && e.besoNumber === nr,
  );
  if (b === undefined) throw new Error(`Beso ${nr} fehlt in der Fixture`);
  return b;
}

describe('KVK-Fixture', () => {
  it('[R-4.2-03] KVK-Woche 28.09.–04.10.2026, KW 40', () => {
    expect(kvk?.startDate).toBe('2026-09-28');
    expect(isoWeek(kvk?.startDate ?? '')).toBe(40);
    expect(weekDates(kvk?.startDate ?? '')[6]).toBe('2026-10-04');
  });

  it('[R-4.2-03] Anzahlen je Typ über die Einträge der sieben Tage aus dem Startdatum: 63 Blöcke, 24 Beso, 7 Rapporte, 9 Marker, keine Querbalken, 2 ganztägige Bemerkungen', () => {
    const seen = new Map<string, Entry>();
    for (const d of weekDates('2026-09-28'))
      for (const e of entriesOnDate(plan, d)) seen.set(e.id, e);
    const count = (t: Entry['type']) => [...seen.values()].filter((e) => e.type === t).length;
    expect([
      count('block'),
      count('beso'),
      count('rapport'),
      count('marker'),
      count('querbalken'),
      count('dayRemark'),
    ]).toEqual([63, 24, 7, 9, 0, 2]);
    expect(Object.keys(plan.entries)).toHaveLength(118);
  });

  it('[R-4.2-03] (Gate S A2, Q-042) nur oberste Ebene: e40, e56, e82 fehlen; e54 0945-1200, e73 0830-1200', () => {
    const tage = weekDates('2026-09-28');
    expect(tage.slice(0, 3), 'Mo, Di, Mi aus dem Startdatum').toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]);
    // IDs werden nicht neu vergeben, die Zähler bleiben (Vertrag E1-02j Abschnitt 1b; TR-E102j-01).
    expect([plan.nextId, plan.nextSeq], 'Zähler').toEqual([177, 122]);
    const idsAm = (i: number) => entriesOnDate(plan, tage[i] ?? '').map((e) => e.id);
    // Ganz verdeckt (Vertrag E1-02j Abschnitt 1a, Nr 1–3): Schlüssel und Tagesliste ohne den Eintrag.
    for (const [id, i, tag] of [
      ['e40', 0, 'Mo'],
      ['e56', 1, 'Di'],
      ['e82', 2, 'Mi'],
    ] as const) {
      expect(Object.hasOwn(plan.entries, id), `${id} ${tag}: in plan.entries`).toBe(false);
      expect(idsAm(i), `${id} ${tag}: in entriesOnDate`).not.toContain(id);
    }
    // Teilweise verdeckt (Nr 4–5): auf die sichtbare Spanne gekürzt.
    const blockAm = (id: string, i: number, tag: string): Block => {
      const e = entriesOnDate(plan, tage[i] ?? '').find((x) => x.id === id);
      expect(e?.type, `${id} ${tag}: Block in entriesOnDate`).toBe('block');
      return e as Block;
    };
    expect(blockAm('e54', 1, 'Di').time, 'e54 Di').toEqual({ form: 'range', from: 585, to: 720 });
    expect(blockAm('e73', 2, 'Mi').time, 'e73 Mi').toEqual({ form: 'range', from: 510, to: 720 });
  });

  it('[R-4.2-07] (F-38) 13 Bemerkungen «gelten durchgehend» als Plan-Bemerkungen in der Reihenfolge der Seitenleiste', () => {
    const remarks = remarksForWeek(plan, weekId);
    expect(remarks).toHaveLength(13);
    for (const r of remarks) expect(r.scope).toEqual({ kind: 'plan' });
    expect(remarks[0]?.text.startsWith('Sport:')).toBe(true);
    expect(remarks[12]?.text.startsWith('Höh Kader')).toBe(true);
  });

  it('[R-4.6-01] alle Einträge der Fixture sind strukturell gültig', () => {
    for (const e of Object.values(plan.entries)) expect(validateEntry(plan, e), e.id).toEqual([]);
  });

  it('[R-4.4-09] alle Spaltensätze der Fixture sind gültig; Mo–Di, Mi–Fr und Sa–So teilen je einen Satz', () => {
    for (const s of plan.columnSets) expect(validateColumnSet(s), s.name).toEqual([]);
    const names = (d: (typeof WEEKDAYS)[number]) => dayColumns(plan, weekId, d).map((c) => c.name);
    expect(names('Mo')).toEqual([
      'Kp Kdt',
      'Stv',
      'Zfhr',
      'Uof',
      'höh Uof',
      'Trp',
      'Det',
      'Rap',
      'Beso',
    ]);
    expect(names('Di')).toEqual(names('Mo'));
    expect(names('Mi')).toEqual(['Kdo', 'Mö', 'Sph', 'Rap', 'Beso']);
    expect(names('Fr')).toEqual(names('Mi'));
    expect(names('So')).toEqual(['Kp', 'Rap', 'Beso']);
  });

  it('[R-4.8-09] Terminzeilen je Tag nach Nummer: Mo 10–16, Di 20–25, Fr 50–52 und Bemerkung, Sa keine, So 70 und Bemerkung', () => {
    const nums = (d: string) => agendaLinesForDate(plan, d).map((l) => l.number);
    expect(nums('2026-09-28')).toEqual([10, 11, 12, 13, 14, 15, 16]);
    expect(nums('2026-09-29')).toEqual([20, 21, 22, 23, 24, 25]);
    expect(nums('2026-09-30')).toEqual([30, 31, 32]);
    expect(nums('2026-10-01')).toEqual([40, 41, 42, 43]);
    expect(nums('2026-10-02')).toEqual([50, 51, 52, null]);
    expect(nums('2026-10-03')).toEqual([]);
    expect(nums('2026-10-04')).toEqual([70, null]);
  });

  it('[R-4.6-37] Terminzeile Nr 13 in der erfassten Form «13 bis 1200: …»', () => {
    expect(plain(agendaLine(besoNr(13), plan)).startsWith('13 bis 1200: SEM;')).toBe(true);
  });

  it('[R-4.8-04] Terminzeilen aus den Feldern: Nr 10 mit Ltg, Tn und Ort; Nr 52 nur Titel', () => {
    expect(plain(agendaLine(besoNr(10), plan))).toBe(
      '10 0830-0900: Kick-off Rap, Ltg: LBA, Tn: Einh Kdt Stv u/o Einh Fw, Mat C, VT C, Ort: ALC-O Truppengebäude Nr 5.',
    );
    expect(plain(agendaLine(besoNr(52), plan))).toBe(
      '52 2200: Planungsfähigkeit erstellt (Ber Auflage).',
    );
  });

  it('[R-4.6-29] (F-12) Termine ohne Zeit Fr und So als ganztägige Bemerkung nach den Beso-Zeilen, ohne Nummer', () => {
    const fr = agendaLinesForDate(plan, '2026-10-02');
    const so = agendaLinesForDate(plan, '2026-10-04');
    expect(fr[3]?.number).toBeNull();
    expect(plain(fr[3]?.text ?? []).startsWith('LKW inkl Anh')).toBe(true);
    expect(so[1]?.number).toBeNull();
    expect(plain(so[1]?.text ?? [])).toBe('Übernahme FDT-Wache; Ltg: Wacht Of.');
    expect(plain(agendaLine(besoNr(51), plan))).toBe('51 1330-1400.');
    expect(plain(agendaLine(besoNr(70), plan))).toBe('70 0930-1000.');
    expect(besoNr(51).agendaOverride).toBeNull();
    expect(besoNr(70).agendaOverride).toBeNull();
  });

  it('[R-4.6-39] KVK Mo: Nr 13 «bis 1200» wird nach Nr 14 «1130» einsortiert', () => {
    const w13 = besoNr(13).windows[0];
    const w14 = besoNr(14).windows[0];
    expect(w13 && w14).toBeTruthy();
    const a = { time: w13?.time ?? { form: 'deadline' }, createdSeq: besoNr(13).createdSeq };
    const b = { time: w14?.time ?? { form: 'deadline' }, createdSeq: besoNr(14).createdSeq };
    expect(compareEntries(a, b)).toBeGreaterThan(0);
  });

  it('[R-4.7-14] Kürzelliste der KVK-Woche: nur die Rapportkürzel BR 0, DR, KR', () => {
    expect(abbreviationsForWeek(plan, weekId)).toEqual(['BR 0', 'DR', 'KR']);
  });

  it('[R-4.6-14] Marker der KVK-Woche: ABV mit Zeit, AV und HV ohne Zeit', () => {
    const labels = Object.values(plan.entries)
      .filter((e): e is Marker => e.type === 'marker')
      .sort((x, y) => x.createdSeq - y.createdSeq)
      .map((m) => markerLabel(m, plan));
    expect(labels).toEqual([
      'ABV 2230',
      'AV',
      'ABV 2300',
      'AV',
      'ABV 2300',
      'AV',
      'ABV 2400',
      'AV',
      'HV',
    ]);
  });
});
