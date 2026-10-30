// @vitest-environment jsdom
// F-ABDECKUNG2: Listenansicht (Beschrieb 6 «Listenansicht»; UI-Richtlinie 7; Vertrag E1-15 §1, §2; R-6-13 bis R-6-16,
// R-5.7-02, R-5.7-03). Geprüft wird das sichtbare Verhalten in jsdom: Zellinhalte je Eintragstyp und Zeitform,
// Umfang, Filter, Sortierung, Zellzeiger, Bearbeiten wie Excel (jede Zelländerung ein Befehl auf das Modell), Leeren,
// Löschen, Schreibschutz, Meldungen mit Ursache und nächstem Schritt, Spaltenmenü und Export. Nur fiktive Daten.
import { act, fireEvent, render, within } from '@testing-library/react';
import { createElement, useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  focusListFilter,
  ListView,
  listFileName,
} from '../../../../src/components/wap/list/ListView';
import { WapError } from '../../../../src/model/wap/errors';
import { LIST_CSV_HEADER } from '../../../../src/model/wap/list/index';
import type { Beso, Id, Plan } from '../../../../src/model/wap/types';
import { kpPlan } from '../../support/i5/plan';
import { apply, entryOf, fixture, type Live, markChanged, type Run } from './ui';

interface Spy extends Live {
  readonly shown: [Id, Id][];
  readonly selected: Id[];
  readonly deleted: string[];
  readonly exported: [string, string][];
  fail: unknown;
}

function renderList(
  initial: Plan,
  opts: { readonly readOnly?: boolean; readonly week?: number } = {},
) {
  const spy: Spy = {
    plan: initial,
    runs: 0,
    shown: [],
    selected: [],
    deleted: [],
    exported: [],
    fail: null,
  };
  function Harness() {
    const [plan, setPlan] = useState(initial);
    spy.plan = plan;
    return createElement(ListView, {
      plan,
      weekId: plan.weeks[opts.week ?? 0]?.id ?? '',
      readOnly: opts.readOnly ?? false,
      onCommand: async (run: Run) => {
        if (spy.fail !== null) throw spy.fail;
        setPlan(apply(spy, run));
      },
      onShowInGrid: (w: Id, e: Id) => spy.shown.push([w, e]),
      onSelectEntry: (_: Id, e: Id) => spy.selected.push(e),
      onDeleted: (t: string) => spy.deleted.push(t),
      onExport: (csv: string, name: string) => spy.exported.push([csv, name]),
    });
  }
  const r = render(createElement(Harness));
  const grid = () => r.getByRole('grid');
  const cell = (row: number, col: number): HTMLElement => {
    const el = r.container.querySelector<HTMLElement>(
      `[data-cell="${String(row)}:${String(col)}"]`,
    );
    if (el === null) throw new Error(`Zelle ${String(row)}:${String(col)} fehlt`);
    return el;
  };
  const rows = (): string[][] =>
    [...r.container.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent ?? ''),
    );
  const titles = (): string[] => rows().map((x) => x[3] ?? '');
  const focused = (): string | null =>
    (document.activeElement as HTMLElement | null)?.getAttribute('data-cell') ?? null;
  const key = async (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) => {
    await act(async () => {
      fireEvent.keyDown(el, { key: k, ...mods });
    });
  };
  const editor = (): HTMLInputElement | HTMLSelectElement => {
    const el = r.container.querySelector<HTMLInputElement | HTMLSelectElement>(
      'td input, td select',
    );
    if (el === null) throw new Error('kein Eingabefeld');
    return el;
  };
  const alert = (): string => r.queryByRole('alert')?.textContent ?? '';
  return { ...r, spy, grid, cell, rows, titles, focused, key, editor, alert };
}

// Spalten: 0 Tag, 1 Zeit, 2 Typ, 3 Titel, 4 Spalten, 5 Ltg, 6 Ort, 7 Nr, 8 Kategorie, 9 Status.
const TITEL_WOCHE_1 = [
  'Übungsphase',
  'AV',
  'Funk Ausbildung',
  'KR',
  'Visite',
  'Visite',
  'Materialfassung',
  'Vorbereitung',
  'Schiessen',
  'Meldung abgeben',
  'Gilt durchgehend',
];

describe('F-ABDECKUNG2 Listenansicht: Inhalt, Umfang, Filter, Sortierung', () => {
  it('[R-6-13] zeigt alle Einträge der Woche mit Tag, Zeit in der erfassten Form, Typ, Titel, Spalten, Ltg, Ort, Nr, Kategorie und Status', () => {
    const f = fixture();
    const v = renderList(f.plan);
    const heads = within(v.grid())
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(heads).toEqual([
      'Tag',
      'Zeit',
      'Typ',
      'Titel',
      'Spalten',
      'Ltg',
      'Ort',
      'Nr',
      'Kategorie',
      'Status',
    ]);
    expect(v.grid()).toHaveAttribute('aria-label', 'Einträge KVK');
    expect(v.getByRole('status')).toHaveTextContent('11 von 11 Einträgen');
    const rows = v.rows();
    expect(v.titles()).toEqual(TITEL_WOCHE_1);
    expect(rows.map((r) => r[1])).toEqual([
      '28.09.2026–29.09.2026',
      '2200',
      '0800-1000',
      '0700',
      '1400',
      '1500-1600',
      'ganztags',
      'bis 1200',
      'ab 1900',
      'bis 30.09.2026',
      '',
    ]);
    expect(rows.map((r) => r[2])).toEqual([
      'Querbalken',
      'Marker',
      'Block',
      'Rapport',
      'Beso',
      'Beso',
      'Ganztägige Bemerkung',
      'Block',
      'Block',
      'Beso',
      'Bemerkung',
    ]);
    expect(rows[0]?.[0]).toBe('Mo 28.09.');
    expect(rows[7]?.[0]).toBe('Di 29.09.');
    expect(rows[10]?.[0]).toBe('');
    // Funk Ausbildung: Spalten mit Komma, Ltg, Ort, Kategorie aus der Legende.
    expect(rows[2]?.slice(4, 10)).toEqual([
      'Kp Kdt, Stv',
      'Zfhr',
      'Halle',
      '',
      'Leitung Kp',
      'bestätigt',
    ]);
    const visite = entryOf(v.spy.plan, f.ids.visite) as Beso;
    expect(rows[4]?.[7]).toBe(String(visite.besoNumber).padStart(2, '0'));
    expect(rows[4]?.[4]).toBe('Beso');
    // Marker gelten über alle Planungsspalten; die Zelle sagt es beim Überfahren.
    expect(v.cell(1, 4)).toHaveAttribute(
      'title',
      'Marker gelten immer über alle Planungsspalten (nicht änderbar).',
    );
    expect(v.cell(1, 4)).toHaveTextContent('alle');
    // Typ und Tag sind nur lesbar, Titel bearbeitbar.
    expect(v.cell(2, 2)).toHaveAttribute('aria-readonly', 'true');
    expect(v.cell(2, 0)).toHaveAttribute('aria-readonly', 'true');
    expect(v.cell(2, 3)).toHaveAttribute('aria-readonly', 'false');
  });

  it('[R-6-14] Umfang «Ganzer Plan» zeigt auch die zweite Woche; Zähler und Tabellenname folgen; zurück auf «Diese Woche»', () => {
    const v = renderList(fixture().plan);
    fireEvent.click(v.getByRole('radio', { name: 'Ganzer Plan' }));
    expect(v.grid()).toHaveAttribute('aria-label', 'Einträge ganzer Plan');
    expect(v.getByRole('status')).toHaveTextContent('13 von 13 Einträgen');
    expect(v.titles()).toContain('Woche zwei');
    fireEvent.click(v.getByRole('radio', { name: 'Diese Woche' }));
    expect(v.titles()).not.toContain('Woche zwei');
    expect(v.getByRole('status')).toHaveTextContent('11 von 11 Einträgen');
  });

  it('[R-6-14] Filter über alle Spalten ohne Gross/Klein; ohne Treffer Leerzustand mit «Im ganzen Plan suchen» und «Filter löschen»; Esc leert, Enter springt in die erste Titelzelle', async () => {
    const v = renderList(fixture().plan);
    const filter = v.getByRole('searchbox', { name: 'Filter' });
    fireEvent.change(filter, { target: { value: 'HALLE' } });
    expect(v.titles()).toEqual(['Funk Ausbildung']);
    expect(v.getByRole('status')).toHaveTextContent('1 von 11 Einträgen');
    await v.key(filter, 'Enter');
    expect(v.focused()).toBe('0:3');
    fireEvent.change(filter, { target: { value: '  woche zwei ' } });
    const leer = v.getByRole('region', { name: 'Keine Einträge' });
    expect(leer).toHaveTextContent('Kein Eintrag passt zu «woche zwei».');
    fireEvent.click(within(leer).getByRole('button', { name: 'Im ganzen Plan suchen' }));
    expect(v.titles()).toEqual(['Woche zwei']);
    expect(v.getByRole('radio', { name: 'Ganzer Plan' })).toBeChecked();
    fireEvent.change(filter, { target: { value: 'Säntis' } });
    const leer2 = v.getByRole('region', { name: 'Keine Einträge' });
    expect(within(leer2).queryByRole('button', { name: 'Im ganzen Plan suchen' })).toBeNull();
    fireEvent.click(within(leer2).getByRole('button', { name: 'Filter löschen' }));
    expect(filter).toHaveValue('');
    expect(v.rows()).toHaveLength(13);
    fireEvent.change(filter, { target: { value: 'Visite' } });
    await v.key(filter, 'Escape');
    expect(filter).toHaveValue('');
    // Esc in einem leeren Filter tut nichts (kein Fehler, Liste unverändert).
    await v.key(filter, 'Escape');
    expect(v.rows()).toHaveLength(13);
  });

  it('[R-6-14] Sortieren per Spaltenkopf: aufsteigend, absteigend, aus; Tag und Zeit sortieren nach der Planreihenfolge', () => {
    const v = renderList(fixture().plan);
    const kopf = (name: string) => within(v.grid()).getByRole('button', { name });
    const th = (name: string) => kopf(name).closest('th') as HTMLElement;
    fireEvent.click(kopf('Titel'));
    expect(th('Titel')).toHaveAttribute('aria-sort', 'ascending');
    expect(v.titles()).toEqual([...TITEL_WOCHE_1].sort((a, b) => a.localeCompare(b, 'de-CH')));
    fireEvent.click(kopf('Titel'));
    expect(th('Titel')).toHaveAttribute('aria-sort', 'descending');
    expect(v.titles()).toEqual([...TITEL_WOCHE_1].sort((a, b) => b.localeCompare(a, 'de-CH')));
    fireEvent.click(kopf('Titel'));
    expect(th('Titel')).toHaveAttribute('aria-sort', 'none');
    expect(v.titles()).toEqual(TITEL_WOCHE_1);
    fireEvent.click(kopf('Zeit'));
    expect(v.titles()).toEqual(TITEL_WOCHE_1);
    fireEvent.click(kopf('Zeit'));
    expect(v.titles()).toEqual([...TITEL_WOCHE_1].reverse());
    // Wechsel auf eine andere Spalte beginnt wieder aufsteigend; gleiche Werte behalten die Planreihenfolge.
    fireEvent.click(kopf('Typ'));
    expect(th('Zeit')).toHaveAttribute('aria-sort', 'none');
    expect(th('Typ')).toHaveAttribute('aria-sort', 'ascending');
    expect(v.rows().map((r) => r[2])).toEqual([
      'Bemerkung',
      'Beso',
      'Beso',
      'Beso',
      'Block',
      'Block',
      'Block',
      'Ganztägige Bemerkung',
      'Marker',
      'Querbalken',
      'Rapport',
    ]);
    expect(v.titles().slice(1, 4)).toEqual(['Visite', 'Visite', 'Meldung abgeben']);
  });

  it('[R-5.7-02] eine leere Woche zeigt den nächsten sinnvollen Schritt statt einer leeren Tabelle', () => {
    const v = renderList(kpPlan(1));
    expect(v.queryByRole('grid')).toBeNull();
    expect(v.getByRole('region', { name: 'Keine Einträge' })).toHaveTextContent(
      'In dieser Woche gibt es noch keine Einträge. Im Raster ziehen oder einen Excel-WAP importieren.',
    );
    expect(v.getByRole('button', { name: 'Im Raster zeigen' })).toBeDisabled();
    expect(v.getByRole('button', { name: 'Eintrag löschen' })).toBeDisabled();
  });
});

describe('F-ABDECKUNG2 Listenansicht: Zellzeiger und Bearbeiten wie Excel', () => {
  it('[R-6-15] Pfeile, Pos1/Ende (mit Ctrl), Bild ab/auf, Tab/Shift+Tab bewegen den Zellzeiger; ein Zeilenwechsel wählt den Eintrag im Raster mit', async () => {
    const f = fixture();
    const v = renderList(f.plan);
    const start = v.cell(0, 3);
    expect(start).toHaveAttribute('tabindex', '0');
    expect(start).toHaveClass('is-cursor');
    await v.key(start, 'ArrowDown');
    expect(v.focused()).toBe('1:3');
    expect(v.spy.selected).toEqual([f.ids.marker]);
    await v.key(v.cell(1, 3), 'ArrowRight');
    expect(v.focused()).toBe('1:4');
    await v.key(v.cell(1, 4), 'ArrowLeft');
    await v.key(v.cell(1, 3), 'ArrowUp');
    expect(v.focused()).toBe('0:3');
    await v.key(v.cell(0, 3), 'ArrowUp');
    expect(v.focused()).toBe('0:3');
    await v.key(v.cell(0, 3), 'End');
    expect(v.focused()).toBe('0:9');
    await v.key(v.cell(0, 9), 'ArrowRight');
    expect(v.focused()).toBe('0:9');
    await v.key(v.cell(0, 9), 'Home');
    expect(v.focused()).toBe('0:0');
    await v.key(v.cell(0, 0), 'End', { ctrlKey: true });
    expect(v.focused()).toBe('10:9');
    await v.key(v.cell(10, 9), 'Home', { ctrlKey: true });
    expect(v.focused()).toBe('0:0');
    await v.key(v.cell(0, 0), 'PageDown');
    expect(v.focused()).toBe('10:0');
    await v.key(v.cell(10, 0), 'PageUp');
    expect(v.focused()).toBe('0:0');
    await v.key(v.cell(0, 0), 'Tab');
    expect(v.focused()).toBe('0:1');
    await v.key(v.cell(0, 1), 'Tab', { shiftKey: true });
    expect(v.focused()).toBe('0:0');
    // Shift+Tab am linken Rand verlässt die Tabelle (Standardverhalten, kein preventDefault).
    const links = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    v.cell(0, 0).dispatchEvent(links);
    expect(links.defaultPrevented).toBe(false);
    // Klick wählt die Zelle und den Eintrag; eine Zeile desselben Beso wählt nicht erneut.
    fireEvent.click(v.cell(4, 5));
    fireEvent.click(v.cell(5, 5));
    expect(v.spy.selected.filter((id) => id === f.ids.visite)).toHaveLength(1);
    expect(v.cell(5, 5)).toHaveClass('is-cursor');
  });

  it('[R-6-15] Enter auf der Zelle geht eine Zeile tiefer, Shift+Enter höher (wie Excel; Entscheid Auftraggeber 29.10.2026); F2 öffnet die Bearbeitung mit dem Wert, Enter übernimmt als ein Befehl und geht eine Zeile tiefer; das Modell trägt den neuen Titel', async () => {
    const f = fixture();
    const v = renderList(f.plan);
    fireEvent.click(v.cell(2, 3));
    await v.key(v.cell(2, 3), 'Enter');
    expect(v.container.querySelector('td input')).toBeNull();
    expect(v.focused()).toBe('3:3');
    await v.key(v.cell(3, 3), 'Enter', { shiftKey: true });
    expect(v.focused()).toBe('2:3');
    await v.key(v.cell(2, 3), 'F2');
    const input = v.editor() as HTMLInputElement;
    expect(input).toHaveAccessibleName('Titel');
    expect(input).toHaveValue('Funk Ausbildung');
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '  Funk Repetition ' } });
    await v.key(input, 'Enter');
    expect(v.spy.runs).toBe(1);
    const funk = entryOf(v.spy.plan, f.ids.funk);
    expect(funk.type === 'block' && funk.title).toEqual([{ text: 'Funk Repetition', bold: true }]);
    expect(v.titles()[2]).toBe('Funk Repetition');
    expect(v.focused()).toBe('3:3');
    // Unveränderter Wert: kein Befehl.
    await v.key(v.cell(3, 3), 'F2');
    await v.key(v.editor(), 'Enter');
    expect(v.spy.runs).toBe(1);
    expect(v.focused()).toBe('4:3');
  });

  it('[R-6-15] Tippen ersetzt den Inhalt, Tab übernimmt und geht nach rechts, Verlassen übernimmt, Esc verwirft ohne Befehl', async () => {
    const f = fixture();
    const v = renderList(f.plan);
    fireEvent.click(v.cell(2, 5));
    await v.key(v.cell(2, 5), 'K');
    const ltg = v.editor() as HTMLInputElement;
    expect(ltg).toHaveValue('K');
    expect(ltg.selectionStart).toBe(1);
    fireEvent.change(ltg, { target: { value: 'Kp Kdt' } });
    await v.key(ltg, 'Tab');
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ltg: 'Kp Kdt' });
    expect(v.focused()).toBe('2:6');
    await v.key(v.cell(2, 6), 'F2');
    const ort = v.editor() as HTMLInputElement;
    fireEvent.change(ort, { target: { value: 'Turnhalle' } });
    await act(async () => {
      fireEvent.blur(ort);
    });
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ort: 'Turnhalle' });
    expect(v.spy.runs).toBe(2);
    await v.key(v.cell(2, 6), 'x');
    await v.key(v.editor(), 'Escape');
    expect(v.container.querySelector('td input')).toBeNull();
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ort: 'Turnhalle' });
    expect(v.spy.runs).toBe(2);
    expect(v.focused()).toBe('2:6');
    // Typ und Tag sind nicht bearbeitbar: Tippen öffnet nichts.
    fireEvent.click(v.cell(2, 2));
    await v.key(v.cell(2, 2), 'a');
    expect(v.container.querySelector('td input')).toBeNull();
    // Tasten mit Ctrl oder Alt öffnen keine Bearbeitung.
    fireEvent.click(v.cell(2, 3));
    await v.key(v.cell(2, 3), 'a', { altKey: true });
    await v.key(v.cell(2, 3), 'Shift');
    expect(v.container.querySelector('td input')).toBeNull();
  });

  it('[R-6-15] Doppelklick bearbeitet; Doppelklick auf Typ oder Tag und Ctrl+Enter zeigen den Eintrag im Raster', async () => {
    const f = fixture();
    const v = renderList(f.plan);
    const woche = v.spy.plan.weeks[0]?.id;
    fireEvent.doubleClick(v.cell(3, 2));
    fireEvent.doubleClick(v.cell(6, 0));
    expect(v.spy.shown).toEqual([
      [woche, f.ids.kr],
      [woche, f.ids.tagBemerkung],
    ]);
    fireEvent.click(v.cell(8, 3));
    await v.key(v.cell(8, 3), 'Enter', { ctrlKey: true });
    expect(v.spy.shown[2]).toEqual([woche, f.ids.schiessen]);
    fireEvent.click(v.getByRole('button', { name: 'Im Raster zeigen' }));
    expect(v.spy.shown[3]).toEqual([woche, f.ids.schiessen]);
    fireEvent.doubleClick(v.cell(3, 6));
    expect(v.editor()).toHaveAccessibleName('Ort');
  });

  it('[R-6-15] Zeit einer Beso-Zeile ändert genau dieses Zeitfenster; Zeit eines Markers und Kürzel eines Rapports', async () => {
    const f = fixture();
    const v = renderList(f.plan);
    fireEvent.doubleClick(v.cell(5, 1));
    const zeit = v.editor() as HTMLInputElement;
    expect(zeit).toHaveValue('1500-1600');
    fireEvent.change(zeit, { target: { value: '1530-1630' } });
    await v.key(zeit, 'Enter');
    const visite = entryOf(v.spy.plan, f.ids.visite) as Beso;
    expect(visite.windows.map((w) => w.time)).toEqual([
      { form: 'point', at: 840 },
      { form: 'range', from: 930, to: 990 },
    ]);
    fireEvent.doubleClick(v.cell(1, 1));
    fireEvent.change(v.editor(), { target: { value: '2300' } });
    await v.key(v.editor(), 'Enter');
    expect(entryOf(v.spy.plan, f.ids.marker)).toMatchObject({ at: 1380 });
    fireEvent.doubleClick(v.cell(3, 3));
    fireEvent.change(v.editor(), { target: { value: 'DR' } });
    await v.key(v.editor(), 'Enter');
    expect(entryOf(v.spy.plan, f.ids.kr)).toMatchObject({ code: 'DR' });
  });

  it('[R-5.7-03] ungültige Eingaben zeigen Ursache und nächsten Schritt, die Bearbeitung bleibt offen; Esc verwirft und entfernt die Meldung', async () => {
    const v = renderList(fixture().plan);
    const versuch = async (row: number, col: number, value: string) => {
      fireEvent.doubleClick(v.cell(row, col));
      fireEvent.change(v.editor(), { target: { value } });
      await v.key(v.editor(), 'Enter');
      return v.alert();
    };
    expect(await versuch(2, 1, 'xyz')).toBe(
      'Die Zeit ist ungültig. Zeit wie «0800-1200», «0800», «ab 1900» oder «bis 1200» eingeben.',
    );
    expect(v.editor()).toHaveValue('xyz');
    await v.key(v.editor(), 'Escape');
    expect(v.queryByRole('alert')).toBeNull();
    expect(await versuch(2, 1, 'bis 01.10.')).toBe(
      'Ein Block kann keine Frist haben. Zeit wie «0800-1200» eingeben.',
    );
    await v.key(v.editor(), 'Escape');
    expect(await versuch(3, 1, 'ab 0700')).toBe(
      'Ein Rapport hat einen Zeitpunkt oder eine Zeit von–bis. Zeit wie «0700» oder «0700-0730» eingeben.',
    );
    await v.key(v.editor(), 'Escape');
    expect(await versuch(1, 1, '2200-2300')).toBe(
      'Ein Marker hat einen Zeitpunkt. Zeit wie «2330» eingeben.',
    );
    await v.key(v.editor(), 'Escape');
    expect(await versuch(3, 3, '   ')).toBe(
      'Das Kürzel des Rapports fehlt. Ein Kürzel wie «KR» eingeben.',
    );
    await v.key(v.editor(), 'Escape');
    expect(v.spy.runs).toBe(0);
  });

  it('[R-6-15] Kategorie und Status als Auswahl: Beso mit «keine», Block nur Legende; «geändert» wird als «bestätigt» bearbeitet; Tab übernimmt, Esc schliesst', async () => {
    const f = fixture();
    const v = renderList(markChanged(f.plan, f.ids.funk));
    expect(v.cell(2, 9)).toHaveTextContent('geändert');
    fireEvent.click(v.cell(2, 9));
    await v.key(v.cell(2, 9), 'F2');
    const status = v.editor() as HTMLSelectElement;
    expect(status.tagName).toBe('SELECT');
    expect(status).toHaveValue('bestätigt');
    expect([...status.options].map((o) => o.value)).toEqual(['bestätigt', 'offen', 'gestrichen']);
    fireEvent.change(status, { target: { value: 'offen' } });
    await v.key(status, 'Enter');
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ status: 'open' });
    expect(v.cell(2, 9)).toHaveTextContent('offen');
    // Block: nur Kategorien der Legende, die neutrale heisst «neutral».
    fireEvent.doubleClick(v.cell(2, 8));
    const kat = v.editor() as HTMLSelectElement;
    expect([...kat.options].map((o) => o.textContent)).toEqual([
      'Leitung Bat',
      'Leitung Kp',
      'Leitung Zfhr',
      'Extern',
      'Ltg S2',
      'neutral',
    ]);
    const zfhr = v.spy.plan.legend[2]?.id as Id;
    fireEvent.change(kat, { target: { value: zfhr } });
    await v.key(kat, 'Tab');
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ categoryId: zfhr });
    expect(v.focused()).toBe('2:9');
    // Beso: «keine» entfernt die Leitungskategorie.
    fireEvent.doubleClick(v.cell(4, 8));
    const besoKat = v.editor() as HTMLSelectElement;
    expect(besoKat.options[0]?.textContent).toBe('keine');
    fireEvent.change(besoKat, { target: { value: '' } });
    await v.key(besoKat, 'Enter');
    expect(entryOf(v.spy.plan, f.ids.visite)).toMatchObject({ categoryId: null });
    // Esc schliesst ohne Befehl.
    const vorher = v.spy.runs;
    fireEvent.doubleClick(v.cell(4, 9));
    fireEvent.change(v.editor(), { target: { value: 'gestrichen' } });
    await v.key(v.editor(), 'Escape');
    expect(v.container.querySelector('td select')).toBeNull();
    expect(v.spy.runs).toBe(vorher);
    expect(v.focused()).toBe('4:9');
    // In Kategorie und Status öffnet Tippen keine Bearbeitung.
    await v.key(v.cell(4, 9), 'o');
    expect(v.container.querySelector('td select')).toBeNull();
  });

  it('[R-6-15] Entf und Rücktaste leeren eine Zelle als ein Befehl; leere Zelle bleibt; Typ, Kategorie und Status melden, wie es weitergeht', async () => {
    const f = fixture();
    const v = renderList(f.plan);
    fireEvent.click(v.cell(2, 5));
    await v.key(v.cell(2, 5), 'Delete');
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ltg: '' });
    expect(v.spy.runs).toBe(1);
    await v.key(v.cell(2, 5), 'Backspace');
    expect(v.spy.runs).toBe(1);
    fireEvent.click(v.cell(2, 6));
    await v.key(v.cell(2, 6), 'Backspace');
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ort: '' });
    fireEvent.click(v.cell(2, 2));
    await v.key(v.cell(2, 2), 'Delete');
    expect(v.alert()).toBe(
      'Die Zelle «Typ» lässt sich nicht leeren. Ctrl+Entf löscht den Eintrag.',
    );
    fireEvent.click(v.cell(2, 8));
    await v.key(v.cell(2, 8), 'Backspace');
    expect(v.alert()).toBe(
      'Die Zelle «Kategorie» lässt sich nicht leeren. Mit F2 einen anderen Wert wählen.',
    );
    fireEvent.click(v.cell(2, 9));
    await v.key(v.cell(2, 9), 'Delete');
    expect(v.alert()).toBe(
      'Die Zelle «Status» lässt sich nicht leeren. Mit F2 einen anderen Wert wählen.',
    );
    // Ctrl+Rücktaste tut nichts; Ctrl+Entf auf einer anderen Zelle löscht (nächster Test).
    await v.key(v.cell(2, 9), 'Backspace', { ctrlKey: true });
    expect(v.spy.runs).toBe(2);
    expect(v.rows()).toHaveLength(11);
  });

  it('[R-6-15] Ctrl+Entf und «Eintrag löschen» löschen den Eintrag mit Meldung zum Rückgängig-Machen; ohne Titel nennt die Meldung den Typ', async () => {
    const f = fixture();
    const v = renderList(f.plan);
    fireEvent.click(v.cell(8, 3));
    await v.key(v.cell(8, 3), 'Delete', { ctrlKey: true });
    expect(v.spy.plan.entries[f.ids.schiessen]).toBeUndefined();
    expect(v.spy.deleted).toEqual(['«Schiessen» gelöscht']);
    expect(v.rows()).toHaveLength(10);
    expect(v.focused()).toBe('8:3');
    // Titel leeren, dann über den Knopf löschen: die Meldung nennt den Typ.
    fireEvent.click(v.cell(2, 3));
    await v.key(v.cell(2, 3), 'Delete');
    expect(v.titles()[2]).toBe('');
    await act(async () => {
      fireEvent.click(v.getByRole('button', { name: 'Eintrag löschen' }));
    });
    expect(v.spy.plan.entries[f.ids.funk]).toBeUndefined();
    expect(v.spy.deleted[1]).toBe('Block gelöscht');
  });

  it('[R-6-15] schreibgeschützt: keine Bearbeitung, kein Leeren, kein Löschen; alle Zellen aria-readonly', async () => {
    const v = renderList(fixture().plan, { readOnly: true });
    expect(v.cell(2, 3)).toHaveAttribute('aria-readonly', 'true');
    expect(v.getByRole('button', { name: 'Eintrag löschen' })).toBeDisabled();
    fireEvent.click(v.cell(2, 3));
    await v.key(v.cell(2, 3), 'Enter');
    await v.key(v.cell(2, 3), 'x');
    fireEvent.doubleClick(v.cell(2, 3));
    expect(v.container.querySelector('td input')).toBeNull();
    await v.key(v.cell(2, 3), 'Delete');
    await v.key(v.cell(2, 3), 'Delete', { ctrlKey: true });
    expect(v.spy.runs).toBe(0);
    expect(v.rows()).toHaveLength(11);
    expect(v.queryByRole('alert')).toBeNull();
  });

  it('[R-5.7-03] scheitert der Befehl, erscheint die Meldung des Fehlers oder eine allgemeine mit nächstem Schritt; nichts ändert sich', async () => {
    const f = fixture();
    const v = renderList(f.plan);
    v.spy.fail = new WapError('speicherVoll', {
      cause: 'Der Speicher ist voll.',
      nextStep: 'Platz schaffen.',
    });
    fireEvent.click(v.cell(2, 5));
    await v.key(v.cell(2, 5), 'Delete');
    expect(v.alert()).toBe('Der Speicher ist voll. Platz schaffen.');
    v.spy.fail = new Error('intern');
    await v.key(v.cell(2, 5), 'Delete');
    expect(v.alert()).toBe('Die Zelle konnte nicht geleert werden. Mit F2 bearbeiten.');
    await v.key(v.cell(2, 5), 'Delete', { ctrlKey: true });
    expect(v.alert()).toBe('Der Eintrag konnte nicht gelöscht werden. Erneut versuchen.');
    await v.key(v.cell(2, 5), 'F2');
    fireEvent.change(v.editor(), { target: { value: 'Neu' } });
    await v.key(v.editor(), 'Enter');
    expect(v.alert()).toBe(
      'Die Änderung konnte nicht übernommen werden. Den Wert prüfen und erneut eingeben.',
    );
    v.spy.fail = new WapError('speicherVoll', {
      cause: 'Der Speicher ist voll.',
      nextStep: 'Platz schaffen.',
    });
    await v.key(v.editor(), 'Enter');
    expect(v.alert()).toBe('Der Speicher ist voll. Platz schaffen.');
    await v.key(v.editor(), 'Escape');
    await v.key(v.cell(2, 5), 'Delete', { ctrlKey: true });
    expect(v.alert()).toBe('Der Speicher ist voll. Platz schaffen.');
    expect(v.spy.runs).toBe(0);
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ltg: 'Zfhr' });
    expect(v.spy.deleted).toEqual([]);
  });

  it('[R-6-15] eine Tottaste (CH-Tastatur) öffnet die Bearbeitung leer, damit das zusammengesetzte Zeichen ankommt; in Kategorie nicht', async () => {
    const v = renderList(fixture().plan);
    fireEvent.click(v.cell(2, 6));
    await v.key(v.cell(2, 6), 'Dead');
    const ort = v.editor() as HTMLInputElement;
    expect(ort).toHaveValue('');
    expect(document.activeElement).toBe(ort);
    await v.key(ort, 'Escape');
    fireEvent.click(v.cell(2, 8));
    await v.key(v.cell(2, 8), 'Process');
    expect(v.container.querySelector('td select, td input')).toBeNull();
  });
});

describe('F-ABDECKUNG2 Listenansicht: Spaltenmenü und Export', () => {
  it('[R-6-13] Spaltenmenü: «Teilaufgaben» blendet eine Spalte «Titel – Ltg (Ort)» ein; Esc schliesst das Menü und gibt den Fokus an den Knopf', async () => {
    const v = renderList(fixture().plan);
    const knopf = v.getByRole('button', { name: 'Spalten …' });
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(knopf);
    expect(knopf).toHaveAttribute('aria-expanded', 'true');
    const box = v.getByRole('checkbox', { name: 'Teilaufgaben' });
    fireEvent.click(box);
    expect(
      within(v.grid())
        .getAllByRole('columnheader')
        .map((h) => h.textContent)
        .at(-1),
    ).toBe('Teilaufgaben');
    expect(v.grid()).toHaveAttribute('aria-colcount', '11');
    expect(v.rows()[2]?.[10]).toBe('Funkgerät – Wm Probe (Halle); Lagebild');
    expect(v.rows()[3]?.[10]).toBe('');
    expect(v.rows()[7]?.[10]).toBe('');
    await v.key(box, 'a');
    expect(knopf).toHaveAttribute('aria-expanded', 'true');
    await v.key(box, 'Escape');
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(knopf);
    fireEvent.click(knopf);
    await v.key(knopf, 'Escape');
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    // Esc am geschlossenen Knopf tut nichts.
    await v.key(knopf, 'Escape');
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
  });

  it('[R-6-16] «Export …» liefert die Liste im Format der Soll-Listen mit Dateiname nach Konvention; Umfang wie gewählt', () => {
    const v = renderList(fixture().plan);
    fireEvent.click(v.getByRole('button', { name: 'Export …' }));
    const [csv, name] = v.spy.exported[0] ?? ['', ''];
    expect(csv.split(/\r?\n/)[0]).toBe(LIST_CSV_HEADER);
    expect(csv).toContain('Funk Ausbildung');
    expect(csv).not.toContain('Woche zwei');
    expect(name).toMatch(/^WAP_Liste_\d{4}-\d{2}-\d{2}\.csv$/);
    fireEvent.click(v.getByRole('radio', { name: 'Ganzer Plan' }));
    fireEvent.click(v.getByRole('button', { name: 'Export …' }));
    expect(v.spy.exported[1]?.[0]).toContain('Woche zwei');
  });

  it('[R-6-16] Dateiname: Beilage und Dienst aus dem Plan, Datum des Geräts; ohne Angaben «WAP»', () => {
    const plan = { ...kpPlan(1), beilage: 'Beilage 01-02', service: 'FDT 2026' };
    expect(listFileName(plan, new Date(2026, 9, 5, 23, 30))).toBe(
      '01_02_WAP_FDT_2026_Liste_2026-10-05.csv',
    );
    expect(listFileName({ ...plan, beilage: '', service: '' }, new Date(2026, 0, 9))).toBe(
      'WAP_Liste_2026-01-09.csv',
    );
  });

  it('[R-6-14] focusListFilter setzt den Fokus ins Filterfeld der Liste', () => {
    const v = renderList(fixture().plan);
    focusListFilter(v.container);
    expect(document.activeElement).toBe(v.getByRole('searchbox', { name: 'Filter' }));
    // Ohne Liste geschieht nichts.
    const leer = document.createElement('div');
    expect(() => focusListFilter(leer)).not.toThrow();
  });
});
