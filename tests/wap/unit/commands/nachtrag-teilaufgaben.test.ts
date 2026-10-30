// @vitest-environment jsdom
// Befehle für Teilaufgaben und Teilaufgaben in createEntry, updateEntry, copyEntries, copyEntryToDates
// (Vertrag E1-02h Abschnitt 1c K-1, K-2, K-5, 4a, 4b, 6, 9; Gate S A1; Beschrieb 5.1, 5.3, 5.6 Punkt 6;
// R-4.6-63 bis R-4.6-66, R-5.3-11; Vorschlag V-02h-4). Alle Inhalte fiktiv.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { command } from '../../../../src/model/wap/commands/command';
import {
  copyEntries,
  copyEntryToDates,
  createEntry,
  type EntryChanges,
  moveEntries,
  updateEntry,
} from '../../../../src/model/wap/commands/entries';
import {
  addSubtask,
  moveSubtask,
  removeSubtask,
  type SubtaskChanges,
  type SubtaskDraft,
  updateSubtask,
} from '../../../../src/model/wap/commands/subtasks';
import { agendaLine, resolveTitle } from '../../../../src/model/wap/derive/agenda';
import type { Beso, Plan, RichText, Subtask } from '../../../../src/model/wap/types';
import { validateEntry } from '../../../../src/model/wap/validate';
import {
  besoUm,
  besoVon,
  ctx,
  DI,
  DI2,
  DO,
  eintrag,
  expectCommandError,
  expectKeineWirkung,
  expectProgrammfehler,
  FR,
  MI,
  MO,
  MO2,
  planMit,
  run,
} from '../../support/commands/helpers';
import { block, rapport, roundTrip, rt } from '../../support/model/builders';
import {
  blockMitTeilaufgaben,
  fahrerRep,
  fsgFz,
  hatTeilaufgabenFeld,
  mitFeld,
  schluessel,
  teilaufgabe,
  teilaufgabenVon,
  zweiTeilaufgaben,
} from '../../support/model/teilaufgaben';

/** Text eines Titels nach Auflösung der Verweise (R-5.3-12). */
function text(plan: Plan, title: RichText | undefined): string {
  return resolveTitle(plan, title ?? [])
    .map((r) => r.text)
    .join('');
}

/** Plan: e1 Block Mo mit zwei Teilaufgaben, e2 Rapport Di, e3 Block Di ohne Teilaufgaben. */
function grundplan(): Plan {
  return planMit([
    blockMitTeilaufgaben('e1', 1, zweiTeilaufgaben(), { date: MO }),
    rapport('e2', 2, { date: DI }),
    block('e3', 3, { date: DI, title: rt('Ausb Thema', true) }),
  ]);
}

const A = teilaufgabe('Fsg Fz', 'Zfhr', 'Halle 3');
const B = teilaufgabe([
  { text: 'Fahrer Rep', bold: true },
  { text: ' anschl Vs Ukft', bold: false },
]);
const C = teilaufgabe('Wache Ablösung', 'Hptm Muster A');

/** Plan mit Block e1 (Mo) und den Teilaufgaben; ohne Liste fehlt das Feld. */
function planMitTeilaufgaben(subtasks: readonly Subtask[] | null): Plan {
  const b =
    subtasks === null
      ? block('e1', 1, { date: MO, title: rt('Fsg Mat', true) })
      : blockMitTeilaufgaben('e1', 1, subtasks, { date: MO });
  return planMit([b, rapport('e2', 2, { date: DI })]);
}

const leer: Subtask = { title: [], ltg: '', ort: '' };

describe('Teilaufgaben über createEntry und Rundreise (R-4.6-63)', () => {
  it('[R-4.6-63] createEntry mit BlockDraft.subtasks → Block mit genau diesen Teilaufgaben in Reihenfolge, Fettläufe gleich; subtasks [] → Feld fehlt (V-02h-4)', () => {
    const plan = planMit([]);
    // G: ohne Teilaufgaben fehlt das Feld.
    const ohne = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'block',
          date: MO,
          time: { form: 'range', from: 480, to: 600 },
          columns: { kind: 'ids', ids: ['c8'] },
        },
        ctx,
      ),
    );
    expect(hatTeilaufgabenFeld(ohne.plan, ohne.entryId)).toBe(false);
    const leerListe = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'block',
          date: MO,
          time: { form: 'range', from: 480, to: 600 },
          columns: { kind: 'ids', ids: ['c8'] },
          subtasks: [],
        },
        ctx,
      ),
    );
    expect(hatTeilaufgabenFeld(leerListe.plan, leerListe.entryId)).toBe(false);
    // R:
    const r = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'block',
          date: MO,
          time: { form: 'range', from: 480, to: 600 },
          columns: { kind: 'ids', ids: ['c8'] },
          title: rt('Fsg Mat', true),
          subtasks: zweiTeilaufgaben(),
        },
        ctx,
      ),
    );
    expect(teilaufgabenVon(r.plan, r.entryId)).toEqual(zweiTeilaufgaben());
    expect(validateEntry(r.plan, eintrag(r.plan, r.entryId))).toEqual([]);
    expect(roundTrip(r.plan)).toStrictEqual(r.plan);
  });

  it('[R-4.6-63] Block ohne Teilaufgaben: addSubtask und danach removeSubtask → Feld fehlt, JSON gleich wie vorher (nextId, nextSeq unverändert), schemaVersion 1', () => {
    const plan = planMitTeilaufgaben(null);
    const vorher = JSON.stringify(plan);
    const r1 = run(plan, (p) => addSubtask(p, 'e1', { title: rt('Fsg Fz') }, ctx));
    expect(teilaufgabenVon(r1.plan, 'e1')).toEqual([teilaufgabe('Fsg Fz')]);
    expect(r1.plan.nextId).toBe(plan.nextId);
    expect(r1.plan.nextSeq).toBe(plan.nextSeq);
    const r2 = run(r1.plan, (p) => removeSubtask(p, 'e1', 0, ctx));
    expect(hatTeilaufgabenFeld(r2.plan, 'e1')).toBe(false);
    expect(JSON.stringify(r2.plan)).toBe(vorher);
    expect(r2.plan.schemaVersion).toBe(1);
  });

  it('[R-4.6-63] Schreibregel K-2: createEntry mit einer Teilaufgabe, die zusätzlich «stufe» trägt → gespeichert genau title, ltg, ort', () => {
    const plan = planMit([]);
    const mitStufe = { ...fsgFz(), stufe: 2 } as Subtask;
    const r = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'block',
          date: MO,
          time: { form: 'range', from: 480, to: 600 },
          columns: { kind: 'ids', ids: ['c8'] },
          subtasks: [mitStufe, fahrerRep()],
        },
        ctx,
      ),
    );
    expect(teilaufgabenVon(r.plan, r.entryId)?.map(schluessel)).toEqual([
      ['ltg', 'ort', 'title'],
      ['ltg', 'ort', 'title'],
    ]);
    expect(teilaufgabenVon(r.plan, r.entryId)).toEqual(zweiTeilaufgaben());
  });

  it('[R-4.6-63][R-5.3-11] Teilaufgaben-Titel mit «(21)» über addSubtask, createEntry und updateSubtask → Lauf mit besoRef; nach Umnummerierung zeigt resolveTitle die neue Nummer; Kopie behält den Verweis', () => {
    // Di: Beso e5 (Nr 20, 0800) und e6 (Nr 21, 1300); Block e1 am Di.
    const plan = planMit([
      block('e1', 1, { date: DI, title: rt('Fsg Mat', true) }),
      besoUm('e5', 5, DI, 480, 20),
      besoUm('e6', 6, DI, 780, 21),
      blockMitTeilaufgaben('e7', 7, [teilaufgabe('Nachbereitung')], { date: DI }),
    ]);
    // addSubtask
    const r = run(plan, (p) => addSubtask(p, 'e1', { title: rt('Vorbereitung (21)', true) }, ctx));
    expect(r.label).toBe('Teilaufgabe «Vorbereitung (21)» hinzugefügt');
    const titelA = teilaufgabenVon(r.plan, 'e1')?.[0]?.title;
    expect(titelA).toContainEqual(expect.objectContaining({ besoRef: 'e6' }));
    expect(text(r.plan, titelA)).toBe('Vorbereitung (21)');
    // createEntry
    const c = run(plan, (p) =>
      createEntry(
        p,
        {
          type: 'block',
          date: DI,
          time: { form: 'range', from: 900, to: 960 },
          columns: { kind: 'ids', ids: ['c9'] },
          subtasks: [teilaufgabe('Vorbereitung (21)', 'Zfhr')],
        },
        ctx,
      ),
    );
    const titelC = teilaufgabenVon(c.plan, c.entryId)?.[0]?.title;
    expect(titelC).toContainEqual(expect.objectContaining({ besoRef: 'e6' }));
    // updateSubtask
    const u = run(plan, (p) => updateSubtask(p, 'e7', 0, { title: rt('Nachbereitung (21)') }, ctx));
    const titelU = teilaufgabenVon(u.plan, 'e7')?.[0]?.title;
    expect(titelU).toContainEqual(expect.objectContaining({ besoRef: 'e6' }));
    // Umnummerierung: neuer Beso am Di 0900 → e6 erhält Nr 22 (vor dem ersten Stand, R-5.3-04).
    const n = run(r.plan, (p) =>
      createEntry(
        p,
        { type: 'beso', date: DI, windows: [{ time: { form: 'point', at: 540 } }] },
        ctx,
      ),
    );
    expect(besoVon(n.plan, 'e6').besoNumber).toBe(22);
    expect(text(n.plan, teilaufgabenVon(n.plan, 'e1')?.[0]?.title)).toBe('Vorbereitung (22)');
    // Kopie über copyEntries behält denselben Verweis.
    const k = run(r.plan, (p) => copyEntries(p, ['e1'], { deltaMinutes: 60 }, ctx));
    const kopie = k.newIds[0] ?? '';
    expect(teilaufgabenVon(k.plan, kopie)?.[0]?.title).toEqual(titelA);
  });

  it('[R-4.6-63][R-5.3-11] (TR-E102h-01) updateEntry mit subtasks «Nachbereitung (21)» → besoRef auf den Beso Nr 21 desselben Tages; mit Datumswechsel in eine Woche mit einem anderen Beso Nr 21 → dessen ID (Datum nach dem Befehl)', () => {
    // Di (w26): e5 Nr 20, e6 Nr 21; Di der w27: e9 Nr 20, e8 Nr 21; Block e7 am Di (w26).
    const plan = planMit([
      besoUm('e5', 5, DI, 480, 20),
      besoUm('e6', 6, DI, 780, 21),
      besoUm('e9', 9, DI2, 480, 20),
      besoUm('e8', 8, DI2, 780, 21),
      blockMitTeilaufgaben('e7', 7, [teilaufgabe('Nachbereitung')], { date: DI }),
    ]);
    // Gleicher Tag → e6.
    const gleich = run(plan, (p) =>
      updateEntry(
        p,
        'e7',
        'block',
        { subtasks: [teilaufgabe('Nachbereitung (21)', 'Zfhr'), fsgFz()] },
        ctx,
      ),
    );
    const titelGleich = teilaufgabenVon(gleich.plan, 'e7')?.[0]?.title;
    expect(titelGleich).toContainEqual(expect.objectContaining({ besoRef: 'e6' }));
    expect(text(gleich.plan, titelGleich)).toBe('Nachbereitung (21)');
    expect(teilaufgabenVon(gleich.plan, 'e7')?.[1]).toEqual(fsgFz());
    // Datumswechsel nach DI2 (w27) → e8, nicht e6.
    const anders = run(plan, (p) =>
      updateEntry(
        p,
        'e7',
        'block',
        { date: DI2, subtasks: [teilaufgabe('Nachbereitung (21)', 'Zfhr')] },
        ctx,
      ),
    );
    expect(eintrag(anders.plan, 'e7')).toMatchObject({ date: DI2 });
    const titelAnders = teilaufgabenVon(anders.plan, 'e7')?.[0]?.title;
    expect(titelAnders).toContainEqual(expect.objectContaining({ besoRef: 'e8' }));
    expect(titelAnders).not.toContainEqual(expect.objectContaining({ besoRef: 'e6' }));
    expect(text(anders.plan, titelAnders)).toBe('Nachbereitung (21)');
  });
});

describe('Teilaufgaben nur bei Blöcken – Befehle (R-4.6-64)', () => {
  it('[R-4.6-64] createEntry (Beso mit subtasks), updateEntry (Beso, subtasks) und ein command-Rezept, das einen Rapport mit subtasks schreibt → invalidEntry (subtasks), Plan unverändert; Terminzeile des Beso unverändert; Block mit Teilaufgaben gültig', () => {
    const plan = planMit([
      besoUm('e5', 5, MO, 600, 10),
      rapport('e2', 2, { date: DI }),
      blockMitTeilaufgaben('e1', 1, zweiTeilaufgaben(), { date: MO }),
    ]);
    // G: Terminzeile eines Beso unabhängig von einem (ungültigen) Feld subtasks (R-4.8-04); Block gültig.
    const b = besoVon(plan, 'e5');
    expect(agendaLine(mitFeld<Beso>(b, 'subtasks', [fsgFz()]), plan)).toEqual(agendaLine(b, plan));
    expect(validateEntry(plan, eintrag(plan, 'e1'))).toEqual([]);
    // R:
    expectCommandError(
      plan,
      (p) =>
        createEntry(
          p,
          {
            type: 'beso',
            date: MO,
            title: rt('Kontrl Fsg'),
            windows: [{ time: { form: 'point', at: 840 } }],
            subtasks: [fsgFz()],
          } as Parameters<typeof createEntry>[1],
          ctx,
        ),
      { code: 'invalidEntry', field: 'subtasks', entryId: 'e100' },
    );
    expectCommandError(
      plan,
      (p) => updateEntry(p, 'e5', 'beso', { subtasks: [fsgFz()] } as EntryChanges<'beso'>, ctx),
      { code: 'invalidEntry', field: 'subtasks', entryId: 'e5' },
    );
    expectCommandError(
      plan,
      (p) =>
        command(
          p,
          'Rapport geändert',
          (d) => {
            const r = d.entries.e2 as unknown as Record<string, unknown>;
            r.subtasks = [teilaufgabe('Fsg Fz')];
          },
          ctx,
        ),
      { code: 'invalidEntry', field: 'subtasks', entryId: 'e2' },
    );
  });
});

describe('Kopien mit Teilaufgaben (R-4.6-65)', () => {
  it('[R-4.6-65] Duplizieren, Kopie in andere Woche und «Auch an anderen Tagen» Di–Fr übernehmen die Teilaufgaben; Änderung an einer Kopie lässt Original und übrige Kopien unverändert; je Aktion ein Undo-Schritt', () => {
    const plan = grundplan();
    const original = teilaufgabenVon(plan, 'e1');
    // G: Kopien haben dieselben Teilaufgaben (Titel, Ltg, Ort, Reihenfolge); je Aktion ein CommandResult,
    // applyPatches(result.plan, inversePatches) = Plan vorher (run).
    const dup = run(plan, (p) => copyEntries(p, ['e1'], { deltaMinutes: 240 }, ctx));
    const woche = run(plan, (p) => copyEntries(p, ['e1'], { dayOffset: 7 }, ctx));
    const tage = run(plan, (p) => copyEntryToDates(p, 'e1', [DI, MI, DO, FR], ctx));
    expect(dup.newIds).toHaveLength(1);
    expect(woche.newIds).toHaveLength(1);
    expect(tage.newIds).toHaveLength(4);
    const dupId = dup.newIds[0] ?? '';
    expect(teilaufgabenVon(dup.plan, dupId)).toEqual(zweiTeilaufgaben());
    expect(teilaufgabenVon(woche.plan, woche.newIds[0] ?? '')).toEqual(zweiTeilaufgaben());
    expect(eintrag(woche.plan, woche.newIds[0] ?? '')).toMatchObject({ date: MO2 });
    for (const id of tage.newIds)
      expect(teilaufgabenVon(tage.plan, id)).toEqual(zweiTeilaufgaben());
    // G: Teilaufgaben-Arrays von Original und Kopie sind nicht dasselbe Objekt.
    expect(teilaufgabenVon(dup.plan, dupId)).not.toBe(teilaufgabenVon(dup.plan, 'e1'));
    expect(teilaufgabenVon(dup.plan, dupId)?.[0]).not.toBe(teilaufgabenVon(dup.plan, 'e1')?.[0]);
    // G: moveEntries lässt die Teilaufgaben unverändert.
    const verschoben = run(plan, (p) =>
      moveEntries(p, ['e1'], { deltaMinutes: 60, dayOffset: 1 }, ctx),
    );
    expect(teilaufgabenVon(verschoben.plan, 'e1')).toEqual(zweiTeilaufgaben());
    // R: Änderung an einer Kopie.
    const kopie2 = tage.newIds[1] ?? '';
    const u = run(tage.plan, (p) =>
      updateSubtask(p, kopie2, 1, { ltg: 'Four', ort: 'Rayon Nord' }, ctx),
    );
    expect(teilaufgabenVon(u.plan, kopie2)?.[1]).toEqual({
      ...fahrerRep(),
      ltg: 'Four',
      ort: 'Rayon Nord',
    });
    expect(teilaufgabenVon(u.plan, 'e1')).toEqual(original);
    for (const id of tage.newIds.filter((x) => x !== kopie2)) {
      expect(teilaufgabenVon(u.plan, id)).toEqual(zweiTeilaufgaben());
    }
    expect(u.affectedEntryIds).toEqual([kopie2]);
    const d = run(dup.plan, (p) => removeSubtask(p, dupId, 0, ctx));
    expect(teilaufgabenVon(d.plan, dupId)).toEqual([fahrerRep()]);
    expect(teilaufgabenVon(d.plan, 'e1')).toEqual(zweiTeilaufgaben());
  });

  it('[R-4.6-65] Schreibregel K-2: Original mit Teilaufgabe samt «stufe» → copyEntries und copyEntryToDates schreiben genau title, ltg, ort; Original unverändert', () => {
    const mitStufe = { ...fsgFz(), stufe: 1 } as Subtask;
    const plan = planMit([blockMitTeilaufgaben('e1', 1, [mitStufe, fahrerRep()], { date: MO })]);
    const k = run(plan, (p) => copyEntries(p, ['e1'], { deltaMinutes: 240 }, ctx));
    const t = run(plan, (p) => copyEntryToDates(p, 'e1', [DI, MI], ctx));
    for (const [p, id] of [
      [k.plan, k.newIds[0] ?? ''],
      [t.plan, t.newIds[0] ?? ''],
      [t.plan, t.newIds[1] ?? ''],
    ] as const) {
      expect(teilaufgabenVon(p, id)?.map(schluessel)).toEqual([
        ['ltg', 'ort', 'title'],
        ['ltg', 'ort', 'title'],
      ]);
      expect(teilaufgabenVon(p, id)).toEqual(zweiTeilaufgaben());
    }
    expect(teilaufgabenVon(k.plan, 'e1')?.[0]).toEqual(mitStufe);
    expect(teilaufgabenVon(t.plan, 'e1')?.[0]).toEqual(mitStufe);
  });
});

describe('Befehle für Teilaufgaben (R-4.6-66)', () => {
  it('[R-4.6-66] addSubtask am Ende, am Anfang, in der Mitte und am Block ohne Feld: Patches hin und zurück, Feld fehlt nach Undo, betroffene Einträge und Tage, Bezeichnung, index', () => {
    const plan = planMitTeilaufgaben([A, B]);
    const neu: SubtaskDraft = { title: rt('Fsg Mat Rest', true), ltg: 'Kp Kdt' };
    const neuGespeichert = teilaufgabe(rt('Fsg Mat Rest', true), 'Kp Kdt', '');
    const ende = run(plan, (p) => addSubtask(p, 'e1', neu, ctx));
    expect(ende.index).toBe(2);
    expect(teilaufgabenVon(ende.plan, 'e1')).toEqual([A, B, neuGespeichert]);
    expect(ende.label).toBe('Teilaufgabe «Fsg Mat Rest» hinzugefügt');
    expect(ende.affectedEntryIds).toEqual(['e1']);
    expect(ende.affectedDates).toEqual([MO]);
    const anfang = run(plan, (p) => addSubtask(p, 'e1', neu, ctx, 0));
    expect(anfang.index).toBe(0);
    expect(teilaufgabenVon(anfang.plan, 'e1')).toEqual([neuGespeichert, A, B]);
    const mitte = run(plan, (p) => addSubtask(p, 'e1', neu, ctx, 1));
    expect(mitte.index).toBe(1);
    expect(teilaufgabenVon(mitte.plan, 'e1')).toEqual([A, neuGespeichert, B]);
    const amEnde = run(plan, (p) => addSubtask(p, 'e1', neu, ctx, 2));
    expect(amEnde.index).toBe(2);
    expect(teilaufgabenVon(amEnde.plan, 'e1')).toEqual([A, B, neuGespeichert]);
    // Block ohne Feld: Feld wird angelegt; Undo stellt «Feld fehlt» her.
    const ohne = planMitTeilaufgaben(null);
    const erste = run(ohne, (p) => addSubtask(p, 'e1', { title: rt('Fsg Fz') }, ctx));
    expect(erste.index).toBe(0);
    expect(teilaufgabenVon(erste.plan, 'e1')).toEqual([teilaufgabe('Fsg Fz')]);
    const zurueck = applyPatches(erste.plan, erste.inversePatches);
    expect(Object.hasOwn(zurueck.entries.e1 ?? {}, 'subtasks')).toBe(false);
    expect(JSON.stringify(zurueck)).toBe(JSON.stringify(ohne));
    // Titel und Texte werden nicht getrimmt; die Bezeichnung trimmt K am Rand.
    const rand = run(plan, (p) =>
      addSubtask(p, 'e1', { title: rt('  Fsg Fz  '), ltg: ' Zfhr ', ort: '' }, ctx),
    );
    expect(teilaufgabenVon(rand.plan, 'e1')?.[2]).toEqual(teilaufgabe('  Fsg Fz  ', ' Zfhr ', ''));
    expect(rand.label).toBe('Teilaufgabe «Fsg Fz» hinzugefügt');
  });

  it('[R-4.6-66] updateSubtask (Titel, Ltg, Ort), moveSubtask (vor, zurück), removeSubtask (mittlere, letzte): Patches hin und zurück, Bezeichnung (K nach bzw. vor dem Befehl), betroffene Einträge und Tage', () => {
    const plan = planMitTeilaufgaben([A, B, C]);
    const titel = run(plan, (p) =>
      updateSubtask(p, 'e1', 1, { title: rt('Fahrer Rep', true) }, ctx),
    );
    expect(teilaufgabenVon(titel.plan, 'e1')).toEqual([
      A,
      { ...B, title: rt('Fahrer Rep', true) },
      C,
    ]);
    expect(titel.label).toBe('Teilaufgabe «Fahrer Rep» geändert');
    expect(titel.affectedEntryIds).toEqual(['e1']);
    expect(titel.affectedDates).toEqual([MO]);
    const ltg = run(plan, (p) => updateSubtask(p, 'e1', 0, { ltg: 'Four' }, ctx));
    expect(teilaufgabenVon(ltg.plan, 'e1')).toEqual([{ ...A, ltg: 'Four' }, B, C]);
    expect(ltg.label).toBe('Teilaufgabe «Fsg Fz» geändert');
    const ort = run(plan, (p) => updateSubtask(p, 'e1', 2, { ort: 'Tor Nord', ltg: '' }, ctx));
    expect(teilaufgabenVon(ort.plan, 'e1')).toEqual([A, B, { ...C, ort: 'Tor Nord', ltg: '' }]);
    expect(ort.label).toBe('Teilaufgabe «Wache Ablösung» geändert');
    const vor = run(plan, (p) => moveSubtask(p, 'e1', 0, 2, ctx));
    expect(teilaufgabenVon(vor.plan, 'e1')).toEqual([B, C, A]);
    expect(vor.label).toBe('Teilaufgabe «Fsg Fz» verschoben');
    expect(vor.affectedEntryIds).toEqual(['e1']);
    const zurueck = run(plan, (p) => moveSubtask(p, 'e1', 2, 0, ctx));
    expect(teilaufgabenVon(zurueck.plan, 'e1')).toEqual([C, A, B]);
    expect(zurueck.label).toBe('Teilaufgabe «Wache Ablösung» verschoben');
    const nachbar = run(plan, (p) => moveSubtask(p, 'e1', 1, 2, ctx));
    expect(teilaufgabenVon(nachbar.plan, 'e1')).toEqual([A, C, B]);
    const mitte = run(plan, (p) => removeSubtask(p, 'e1', 1, ctx));
    expect(teilaufgabenVon(mitte.plan, 'e1')).toEqual([A, C]);
    expect(mitte.label).toBe('Teilaufgabe «Fahrer Rep anschl Vs Ukft» entfernt');
    expect(mitte.affectedEntryIds).toEqual(['e1']);
    expect(mitte.affectedDates).toEqual([MO]);
    // Letzte Teilaufgabe entfernen: Feld fehlt; Undo stellt die Liste her.
    const eine = planMitTeilaufgaben([C]);
    const letzte = run(eine, (p) => removeSubtask(p, 'e1', 0, ctx));
    expect(hatTeilaufgabenFeld(letzte.plan, 'e1')).toBe(false);
    expect(letzte.label).toBe('Teilaufgabe «Wache Ablösung» entfernt');
    expect(teilaufgabenVon(applyPatches(letzte.plan, letzte.inversePatches), 'e1')).toEqual([C]);
  });

  it('[R-4.6-66] Bezeichnung: K über 40 Codepunkte gekürzt mit «…», genau 40 ungekürzt; leeres K → «Teilaufgabe entfernt»; betroffene Tage über Mitternacht mit Folgetag', () => {
    const vierzig = 'Fsg Mat und Fz Rep anschl Vs Ukft Nord A';
    expect([...vierzig]).toHaveLength(40);
    const plan = planMitTeilaufgaben([A]);
    const genau = run(plan, (p) => addSubtask(p, 'e1', { title: rt(vierzig) }, ctx));
    expect(genau.label).toBe(`Teilaufgabe «${vierzig}» hinzugefügt`);
    const lang = run(plan, (p) => addSubtask(p, 'e1', { title: rt(`${vierzig}BC`) }, ctx));
    expect(lang.label).toBe(`Teilaufgabe «${vierzig}…» hinzugefügt`);
    // Codepunkte, nicht UTF-16-Einheiten: 39 Zeichen + ein Zeichen ausserhalb der BMP + «xy».
    const neununddreissig = vierzig.slice(0, 39);
    const astral = run(plan, (p) =>
      addSubtask(p, 'e1', { title: rt(`${neununddreissig}\u{1D11E}xy`) }, ctx),
    );
    expect(astral.label).toBe(`Teilaufgabe «${neununddreissig}\u{1D11E}…» hinzugefügt`);
    // Titel aus mehreren Läufen: K = Läufe verbunden.
    const laeufe = run(plan, (p) =>
      updateSubtask(
        p,
        'e1',
        0,
        {
          title: [
            { text: 'Fsg', bold: true },
            { text: ' Fz neu', bold: false },
          ],
        },
        ctx,
      ),
    );
    expect(laeufe.label).toBe('Teilaufgabe «Fsg Fz neu» geändert');
    // Leeres K (Literal mit ungültiger leerer Teilaufgabe, die entfernt wird).
    const mitLeerer = planMitTeilaufgaben([A, { ...leer, title: rt('  ') }]);
    const weg = run(mitLeerer, (p) => removeSubtask(p, 'e1', 1, ctx));
    expect(weg.label).toBe('Teilaufgabe entfernt');
    expect(teilaufgabenVon(weg.plan, 'e1')).toEqual([A]);
    // Block 2200–0100 am Mo: betroffen Mo und Di.
    const nacht = planMit([
      blockMitTeilaufgaben('e1', 1, [A], {
        date: MO,
        time: { form: 'range', from: 1320, to: 1500 },
      }),
    ]);
    const n = run(nacht, (p) => updateSubtask(p, 'e1', 0, { ort: 'Tor Nord' }, ctx));
    expect(n.affectedDates).toEqual([MO, DI]);
    expect(n.affectedEntryIds).toEqual(['e1']);
  });

  it('[R-4.6-66] Fehler: unbekannte ID notFound, Rapport wrongEntryType, Index −1, n bzw. n + 1, 1,5 → RangeError, leerer Titel → invalidEntry (subtasks[i].title); Plan jeweils unverändert', () => {
    const plan = planMitTeilaufgaben([A, B]);
    const titel = { title: rt('Fsg Fz') };
    // Unbekannte ID, falscher Typ.
    expectCommandError(plan, (p) => addSubtask(p, 'e999', titel, ctx), {
      code: 'notFound',
      entryId: 'e999',
    });
    expectCommandError(plan, (p) => updateSubtask(p, 'e999', 0, titel, ctx), {
      code: 'notFound',
      entryId: 'e999',
    });
    expectCommandError(plan, (p) => moveSubtask(p, 'e999', 0, 1, ctx), {
      code: 'notFound',
      entryId: 'e999',
    });
    expectCommandError(plan, (p) => removeSubtask(p, 'e999', 0, ctx), {
      code: 'notFound',
      entryId: 'e999',
    });
    expectCommandError(plan, (p) => addSubtask(p, 'e2', titel, ctx), {
      code: 'wrongEntryType',
      entryId: 'e2',
    });
    expectCommandError(plan, (p) => updateSubtask(p, 'e2', 0, titel, ctx), {
      code: 'wrongEntryType',
      entryId: 'e2',
    });
    expectCommandError(plan, (p) => moveSubtask(p, 'e2', 0, 1, ctx), {
      code: 'wrongEntryType',
      entryId: 'e2',
    });
    expectCommandError(plan, (p) => removeSubtask(p, 'e2', 0, ctx), {
      code: 'wrongEntryType',
      entryId: 'e2',
    });
    // Unbekannte ID vor ungültigem Index (Prüfreihenfolge).
    expectCommandError(plan, (p) => removeSubtask(p, 'e999', -1, ctx), { code: 'notFound' });
    expectCommandError(plan, (p) => removeSubtask(p, 'e2', 7, ctx), { code: 'wrongEntryType' });
    // Indizes (n = 2).
    const vorher = roundTrip(plan);
    for (const i of [-1, 3, 1.5, Number.NaN]) {
      expectProgrammfehler(plan, (p) => addSubtask(p, 'e1', titel, ctx, i), RangeError);
    }
    for (const i of [-1, 2, 1.5]) {
      expectProgrammfehler(plan, (p) => updateSubtask(p, 'e1', i, titel, ctx), RangeError);
      expectProgrammfehler(plan, (p) => removeSubtask(p, 'e1', i, ctx), RangeError);
      expectProgrammfehler(plan, (p) => moveSubtask(p, 'e1', i, 0, ctx), RangeError);
      expectProgrammfehler(plan, (p) => moveSubtask(p, 'e1', 0, i, ctx), RangeError);
    }
    // Block ohne Feld: n = 0.
    const ohne = planMitTeilaufgaben(null);
    expectProgrammfehler(ohne, (p) => removeSubtask(p, 'e1', 0, ctx), RangeError);
    expectProgrammfehler(ohne, (p) => updateSubtask(p, 'e1', 0, titel, ctx), RangeError);
    expectProgrammfehler(ohne, (p) => addSubtask(p, 'e1', titel, ctx, 1), RangeError);
    expect(plan).toEqual(vorher);
    // Leerer Titel.
    expectCommandError(plan, (p) => addSubtask(p, 'e1', { title: rt(' \u00a0') }, ctx), {
      code: 'invalidEntry',
      field: 'subtasks[2].title',
      entryId: 'e1',
    });
    expectCommandError(plan, (p) => addSubtask(p, 'e1', { title: [] }, ctx, 0), {
      code: 'invalidEntry',
      field: 'subtasks[0].title',
      entryId: 'e1',
    });
    expectCommandError(plan, (p) => updateSubtask(p, 'e1', 1, { title: rt('   ') }, ctx), {
      code: 'invalidEntry',
      field: 'subtasks[1].title',
      entryId: 'e1',
    });
  });

  it('[R-4.6-66] ohne Wirkung: moveSubtask mit from = to, updateSubtask mit gleichen Werten bzw. {} → gleicher Plan, leere Patches, nichts betroffen', () => {
    const plan = planMitTeilaufgaben([A, B]);
    expectKeineWirkung(plan, moveSubtask(plan, 'e1', 1, 1, ctx));
    expectKeineWirkung(plan, moveSubtask(plan, 'e1', 0, 0, ctx));
    expectKeineWirkung(plan, updateSubtask(plan, 'e1', 0, {}, ctx));
    expectKeineWirkung(plan, updateSubtask(plan, 'e1', 0, { ...A }, ctx));
    expectKeineWirkung(plan, updateSubtask(plan, 'e1', 1, { ltg: '', ort: '' }, ctx));
    const nurUndefiniert = { title: undefined, ltg: undefined } as unknown as SubtaskChanges;
    expectKeineWirkung(plan, updateSubtask(plan, 'e1', 1, nurUndefiniert, ctx));
  });

  it('[R-4.6-66] updateEntry Block mit { subtasks: [] } → Feld entfernt, ein Undo-Schritt stellt die Liste her; mit neuer Liste → ersetzt', () => {
    const plan = planMitTeilaufgaben([A, B]);
    const r = run(plan, (p) => updateEntry(p, 'e1', 'block', { subtasks: [] }, ctx));
    expect(hatTeilaufgabenFeld(r.plan, 'e1')).toBe(false);
    expect(r.label).toBe('Block «Fsg Mat» geändert');
    expect(teilaufgabenVon(applyPatches(r.plan, r.inversePatches), 'e1')).toEqual([A, B]);
    const ersetzt = run(plan, (p) => updateEntry(p, 'e1', 'block', { subtasks: [C, A] }, ctx));
    expect(teilaufgabenVon(ersetzt.plan, 'e1')).toEqual([C, A]);
    expect(ersetzt.affectedEntryIds).toEqual(['e1']);
    // Block ohne Feld mit [] → ohne Wirkung.
    const ohne = planMitTeilaufgaben(null);
    expectKeineWirkung(ohne, updateEntry(ohne, 'e1', 'block', { subtasks: [] }, ctx));
  });

  it('[R-4.6-66] Schreibregel K-2: addSubtask-Entwurf, updateSubtask-Änderung und updateEntry-Liste mit zusätzlichem Schlüssel «stufe» → gespeichert genau title, ltg, ort', () => {
    const plan = planMitTeilaufgaben([A, B]);
    const entwurf = { title: rt('Fsg Fz'), ltg: 'Zfhr', stufe: 2 } as SubtaskDraft;
    const a = run(plan, (p) => addSubtask(p, 'e1', entwurf, ctx));
    expect(teilaufgabenVon(a.plan, 'e1')?.map(schluessel)).toEqual([
      ['ltg', 'ort', 'title'],
      ['ltg', 'ort', 'title'],
      ['ltg', 'ort', 'title'],
    ]);
    expect(teilaufgabenVon(a.plan, 'e1')?.[2]).toEqual(teilaufgabe('Fsg Fz', 'Zfhr', ''));
    const aenderung = { ort: 'Halle 4', stufe: 1 } as SubtaskChanges;
    const u = run(plan, (p) => updateSubtask(p, 'e1', 0, aenderung, ctx));
    expect(teilaufgabenVon(u.plan, 'e1')?.map(schluessel)).toEqual([
      ['ltg', 'ort', 'title'],
      ['ltg', 'ort', 'title'],
    ]);
    expect(teilaufgabenVon(u.plan, 'e1')?.[0]).toEqual({ ...A, ort: 'Halle 4' });
    const liste = [{ ...C, stufe: 1 } as Subtask, B];
    const e = run(plan, (p) => updateEntry(p, 'e1', 'block', { subtasks: liste }, ctx));
    expect(teilaufgabenVon(e.plan, 'e1')?.map(schluessel)).toEqual([
      ['ltg', 'ort', 'title'],
      ['ltg', 'ort', 'title'],
    ]);
    expect(teilaufgabenVon(e.plan, 'e1')).toEqual([C, B]);
    // Eingabeobjekte werden nicht geteilt.
    expect(teilaufgabenVon(e.plan, 'e1')?.[1]).not.toBe(B);
  });
});
