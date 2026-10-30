// @vitest-environment jsdom
// F-UX4 (Restpunkte der Schluss-Nacharbeit SA-34, .qa/e1-ab/sa34-final.md; Auftrag Koordinator 23.10.2026):
// - UX-AB-F-02: Termin ohne Zeit mit Kästchen – «Nummerierte Termine ohne Zeit» und «Kästchen ohne Termintext» nennen
//   denselben nächsten Schritt (kein «Termintext erfassen», der Text steht in der ganztägigen Bemerkung).
// - UX-AB-F-06: Rapport in Rap- und Planungsspalte mit verschiedener Zeit → zwei Rapporte wie bisher, jetzt mit Hinweis
//   im Importbericht (keine Zusammenführung, Gate-B-Entscheid 12 offen).
// - UX-AB-F-07: Spalten-Zelle der Liste als Auswahlzelle für Blöcke und Rapporte; Marker «alle» fest.
// - UX-AB-F-10: aufgeklappte Kantengruppe nennt je Stelle Block, Zeit und Kante.
// Fiktive Arbeitsmappen und Pläne.
import { fireEvent, render, within } from '@testing-library/react';
import { createElement } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { ImportReportDialog } from '../../../../src/components/wap/import/ExcelImport';
import { commitCell, isEditable, spaltenChoices } from '../../../../src/components/wap/list/commit';
import { ListView } from '../../../../src/components/wap/list/ListView';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import { listRows } from '../../../../src/model/wap/list/index';
import type { Block, Plan, Rapport } from '../../../../src/model/wap/types';
import { besoBox, block, bold, emptyWeek, normal } from '../../fixtures/import/kp-workbook';
import { add, CTX, kpPlan, MO } from '../../support/i5/plan';
import { importWeeks, rows } from '../import/support';

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
  };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('F-UX4 UX-AB-F-02: Termin ohne Zeit mit Kästchen – eine Empfehlung', () => {
  const o = () =>
    importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 51)],
        agenda: [{ day: 0, paragraphs: [[normal('51 Material fassen fiktiv.')]] }],
      }),
    ]);

  it('[R-8.2-27][R-8.2-28] «Kästchen ohne Termintext» rät nicht zum Erfassen eines Textes, der als Bemerkung schon besteht; beide Meldungen nennen denselben Weg', () => {
    const r = o();
    const numbered = r.report.items.find((i) => i.kind === 'numberedWithoutTime');
    const box = r.report.items.find((i) => i.kind === 'boxWithoutText');
    expect(box?.message).toEqual({
      cause:
        'Zum Kästchen Nr 51 gibt es nur einen Termintext ohne Zeit; er wurde als ganztägige Bemerkung übernommen (siehe «Nummerierte Termine ohne Zeit»), der Beso hat einen leeren Titel.',
      nextStep:
        'Keine Aktion nötig, wenn der Termin ganztägig gilt; gilt er zur Zeit des Kästchens, den Text der Bemerkung als Titel des Beso übernehmen und die Bemerkung löschen.',
    });
    const weg = 'Keine Aktion nötig, wenn der Termin ganztägig gilt';
    expect(numbered?.message.nextStep.startsWith(weg)).toBe(true);
    expect(box?.message.nextStep.startsWith(weg)).toBe(true);
    expect(box?.message.nextStep).not.toContain('erfassen');
  });

  it('[R-8.2-28] Gegenprobe: Kästchen ganz ohne Termintext → weiterhin «Termintext des Beso erfassen.»', () => {
    const r = importWeeks([emptyWeek({ shapes: [besoBox(0, 4, '0900', 21)] })]);
    expect(r.report.items.find((i) => i.kind === 'boxWithoutText')?.message).toEqual({
      cause: 'Zum Kästchen Nr 21 gibt es keinen Termintext; der Beso hat einen leeren Titel.',
      nextStep: 'Termintext des Beso erfassen.',
    });
  });
});

describe('F-UX4 UX-AB-F-06: Rapport in Rap- und Planungsspalte mit verschiedener Zeit', () => {
  const RAP = 3;
  const KDO = 0;
  const imp = (cover: boolean) =>
    importWeeks([
      emptyWeek({
        shapes: [
          block(0, [RAP, RAP], '2000', '2200', [[bold('KR')]]),
          block(0, [KDO, KDO], '2000', '2200', [[bold('KR')]]),
          ...(cover ? [block(0, [KDO, KDO], '2130', '2300', [[bold('Nachtübung')]])] : []),
        ],
      }),
    ]);

  it('[R-8.2-20][R-8.2-41] zwei Rapporte wie bisher (keine Zusammenführung), dazu ein Hinweis mit Ursache, nächstem Schritt und Sprung zum Rapport in der Planungsspalte', () => {
    const o = imp(true);
    const list = rows(o.result.plan)
      .filter((r) => r.typ === 'Rapport')
      .map((r) => `${r.spalten} ${r.von}-${r.bis}`)
      .sort();
    expect(list).toEqual(['Kdo 2000-2130', 'Rap 2000-2200']);
    const hint = o.report.items.filter((i) => i.kind === 'rapportTwice');
    expect(hint.map((i) => i.message)).toEqual([
      {
        cause:
          'Ein Rapport am Mo 2000 steht in der Rap-Spalte und in einer Planungsspalte mit verschiedener Zeit; übernommen als zwei Rapporte.',
        nextStep:
          'Prüfen, ob es derselbe Rapport ist; dann einen löschen und beim anderen in der Liste die Spalten «Rap, …» wählen. Sonst keine Aktion nötig.',
      },
    ]);
    const target = rows(o.result.plan).find((r) => r.entryId === hint[0]?.target.entryId);
    expect(`${target?.typ} ${target?.spalten}`).toBe('Rapport Kdo');
  });

  it('[R-8.2-41] Gegenprobe: gleiche Zeit → ein Rapport, kein Hinweis', () => {
    expect(imp(false).report.items.filter((i) => i.kind === 'rapportTwice')).toEqual([]);
  });

  it('[R-8.2-20] der Hinweis hat eine eigene Gruppe im Importbericht', () => {
    const o = imp(true);
    const r = render(
      createElement(ImportReportDialog, {
        report: o.report,
        plan: o.result.plan,
        onClose: () => undefined,
        onJump: () => undefined,
      }),
    );
    expect(
      r.getByRole('heading', { name: 'Rapporte in Rap- und Planungsspalte (1)' }),
    ).toBeTruthy();
    r.unmount();
  });
});

describe('F-UX4 UX-AB-F-07: Spalten-Zelle der Liste als Auswahl', () => {
  function plan(): Plan {
    let p = kpPlan(1);
    p = add(p, {
      type: 'block',
      date: MO,
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'all' },
      title: [{ text: 'Alles fiktiv', bold: true }],
    }).plan;
    p = add(p, {
      type: 'rapport',
      date: MO,
      time: { form: 'point', at: 1200 },
      code: 'KR',
    }).plan;
    p = add(p, {
      type: 'marker',
      date: MO,
      at: 1320,
      kind: 'ABV',
      customKind: '',
      columns: { kind: 'all' },
    }).plan;
    return p;
  }
  const rowOf = (p: Plan, typ: string) => {
    const r = listRows(p, 'plan').find((x) => x.typ === typ);
    if (r === undefined) throw new Error(typ);
    return r;
  };
  const planningOf = (p: Plan) => {
    const w = p.weeks[0];
    if (w === undefined) throw new Error('Woche');
    return dayColumns(p, w.id, 'Mo').filter((c) => c.kind === 'planning');
  };

  it('[R-6-15] Blöcke und Rapporte: Spalten bearbeitbar; Marker nicht (immer alle Planungsspalten)', () => {
    const p = plan();
    expect(isEditable(rowOf(p, 'Block'), 'spalten', p)).toBe(true);
    expect(isEditable(rowOf(p, 'Rapport'), 'spalten', p)).toBe(true);
    expect(isEditable(rowOf(p, 'Marker'), 'spalten', p)).toBe(false);
  });

  it('[R-6-15] Block: Auswahl «alle» und zusammenhängende Spannen der Planungsspalten des Tages; Wahl ist ein Befehl', () => {
    const p = plan();
    const [a, b] = planningOf(p);
    if (a === undefined || b === undefined) throw new Error('Spalten');
    const row = rowOf(p, 'Block');
    const choices = spaltenChoices(p, row);
    const labels = choices.map((c) => c.label);
    expect(labels[0]).toBe('alle');
    expect(labels).toContain(a.name);
    expect(labels).toContain(`${a.name}, ${b.name}`);
    const pick = choices.find((c) => c.label === b.name);
    if (pick === undefined) throw new Error('Wahl');
    const r = commitCell(p, row, 'spalten', pick.value)(p, CTX);
    expect((r.plan.entries[row.entryId] as Block).columns).toEqual({ kind: 'ids', ids: [b.id] });
  });

  it('[R-6-15] Rapport: «Rap», «Rap, ‹Spalte›» (auch in Spalten) und «‹Spalte›» (nur in Spalten)', () => {
    const p = plan();
    const [a] = planningOf(p);
    if (a === undefined) throw new Error('Spalten');
    const row = rowOf(p, 'Rapport');
    const choices = spaltenChoices(p, row);
    const labels = choices.map((c) => c.label);
    expect(labels[0]).toBe('Rap');
    expect(labels).toContain(`Rap, ${a.name}`);
    expect(labels).toContain(a.name);
    const also = choices.find((c) => c.label === `Rap, ${a.name}`);
    if (also === undefined) throw new Error('Wahl');
    const r = commitCell(p, row, 'spalten', also.value)(p, CTX);
    expect(r.plan.entries[row.entryId] as Rapport).toMatchObject({
      display: 'alsoInColumns',
      displayColumns: { kind: 'ids', ids: [a.id] },
    });
    const back = choices.find((c) => c.label === 'Rap');
    if (back === undefined) throw new Error('Wahl');
    const r2 = commitCell(r.plan, rowOf(r.plan, 'Rapport'), 'spalten', back.value)(r.plan, CTX);
    expect((r2.plan.entries[row.entryId] as Rapport).display).toBe('rapColumn');
  });
});

describe('F-UX4 UX-AB-F-07: Spalten-Zelle in der Listenansicht', () => {
  it('[R-6-15] Block-Zeile: Spalten-Zelle nicht schreibgeschützt, Doppelklick öffnet eine Auswahl, Enter übernimmt als Befehl; Marker-Zeile schreibgeschützt', async () => {
    let p = kpPlan(1);
    p = add(p, {
      type: 'block',
      date: MO,
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'all' },
      title: [{ text: 'Alles fiktiv', bold: true }],
    }).plan;
    p = add(p, {
      type: 'marker',
      date: MO,
      at: 1320,
      kind: 'ABV',
      customKind: '',
      columns: { kind: 'all' },
    }).plan;
    const week = p.weeks[0];
    if (week === undefined) throw new Error('Woche');
    const runs: Plan[] = [];
    const r = render(
      createElement(ListView, {
        plan: p,
        weekId: week.id,
        readOnly: false,
        onCommand: async (run) => {
          runs.push(run(p, CTX).plan);
        },
        onShowInGrid: () => undefined,
        onExport: () => undefined,
      }),
    );
    const head = r.getAllByRole('columnheader').map((h) => h.textContent ?? '');
    const col = head.findIndex((t) => t.startsWith('Spalten'));
    const rowOf = (title: string) => {
      const row = r.getAllByRole('row').find((x) => (x.textContent ?? '').includes(title));
      if (row === undefined) throw new Error(title);
      return within(row).getAllByRole('gridcell')[col] as HTMLElement;
    };
    const cell = rowOf('Alles fiktiv');
    expect(cell.getAttribute('aria-readonly')).toBe('false');
    expect(rowOf('ABV').getAttribute('aria-readonly')).toBe('true');
    fireEvent.doubleClick(cell);
    // Textfeld mit Vorschlägen (F-UX6, UX-AB-G-01): mehrere Spalten als Text, die Wahlen als Liste.
    const feld = within(cell).getByRole('combobox', { name: 'Spalten' }) as HTMLInputElement;
    const list = document.getElementById(feld.getAttribute('list') ?? '') as HTMLDataListElement;
    const options = [...list.options].map((o) => o.value);
    expect(options[0]).toBe('alle');
    const second = options[1];
    if (second === undefined) throw new Error('Wahl');
    fireEvent.change(feld, { target: { value: second } });
    fireEvent.keyDown(feld, { key: 'Enter' });
    await new Promise((res) => setTimeout(res, 0));
    expect(runs).toHaveLength(1);
    const b = Object.values(runs[0]?.entries ?? {}).find((e) => e.type === 'block') as Block;
    expect(b.columns.kind).toBe('ids');
    r.unmount();
  });
});

describe('F-UX4 UX-AB-F-10: Kantengruppe nennt Block, Zeit und Kante', () => {
  it('[R-8.2-11][R-8.2-21] aufgeklappte Gruppe: je Stelle «Zur Stelle n: «Titel» hhmm-hhmm · Beginn/Ende hhmm»', () => {
    const at = (day: number, from: number, title: string) => ({
      day,
      cols: [0, 0] as const,
      from,
      to: from + 60,
      paragraphs: [[bold(title)]],
    });
    // 0803–0903 → 0805–0905 (beide Kanten neben der Linie), 1000–1103 → nur das Ende.
    const o = importWeeks([
      emptyWeek({
        shapes: [at(0, 483, 'Kante eins'), { ...at(0, 600, 'Kante zwei'), to: 663 }],
      }),
    ]);
    const r = render(
      createElement(ImportReportDialog, {
        report: o.report,
        plan: o.result.plan,
        onClose: () => undefined,
        onJump: () => undefined,
      }),
    );
    const group = r.getByText(/^Betroffene Blöcke/).closest('details');
    if (group === null) throw new Error('Gruppe');
    const names = within(group as HTMLElement)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .sort();
    expect(names).toEqual([
      'Zur Stelle 1: «Kante eins» 0805-0905 · Beginn 0805, Ende 0905',
      'Zur Stelle 2: «Kante zwei» 1000-1105 · Ende 1105',
    ]);
    r.unmount();
  });
});
