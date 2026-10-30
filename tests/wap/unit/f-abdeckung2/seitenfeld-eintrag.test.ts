// @vitest-environment jsdom
// F-ABDECKUNG2: Seitenfeld «Eintrag» je Typ (Beschrieb 4.6 Tabelle, 4.8, 5.1, 5.3; UI-Richtlinie 6; R-5.1-12,
// R-5.1-13, R-5.1-23, R-5.1-25, R-4.6-01 bis R-4.6-31, R-4.7-10, R-4.7-16, R-4.1-10, R-5.3-05, R-5.3-13, R-5.7-03).
// Jede übernommene Feldänderung ist ein Befehl auf das Modell; ungültige Eingaben zeigen die Meldung am Feld mit
// Ursache und Beispiel; beim Auswahlwechsel wird eine gültige Eingabe übernommen, eine ungültige gemeldet (UX-H-01).
import { act, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setDayColumnSet } from '../../../../src/model/wap/commands/days';
import { addPersons } from '../../../../src/model/wap/commands/persons';
import type { Beso, Block, Id, Plan } from '../../../../src/model/wap/types';
import { add } from '../../support/i5/plan';
import { entries, renderPanel } from './panel';
import { CTX, column, DI, entryOf, fixture, MI, MO, MO2 } from './ui';

const GLYPHE =
  'Ein Zeichen kann im PDF nicht dargestellt werden. Das Zeichen durch Buchstaben oder Zahlen ersetzen.';

function mitPerson(plan: Plan): Plan {
  return addPersons(
    plan,
    [{ grad: 'Hptm', name: 'Muster', vorname: 'Anna', funktion: 'Kp Kdt' }],
    CTX,
  ).plan;
}

const radio = (v: ReturnType<typeof renderPanel>, group: string, name: string) =>
  within(v.getByRole('radiogroup', { name: group })).getByRole('radio', { name });

describe('F-ABDECKUNG2 Seitenfeld: Block', () => {
  it('[R-5.1-12] Kopf mit Typ und Tag; alle Felder des Blocks in der Reihenfolge der UI-Richtlinie', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('Block');
    expect(v.container.querySelector('.wap-panel-summary')).toHaveTextContent('Mo 28.09.2026');
    const labels = [
      ...v.container.querySelectorAll('.wap-panel-body .wap-panel-label > :first-child'),
    ].map((l) => l.textContent);
    expect(labels.slice(0, 16)).toEqual([
      'Titel',
      'Zusatz',
      'Tag',
      'Zeit',
      'Spalten',
      'bis Spalte',
      'Kategorie',
      'Gemeinsame Leitung (zweite Kategorie)',
      'Ltg',
      'Ort',
      'Tn',
      'Tpt',
      'Tenue',
      'Status',
      'Textrichtung',
      'Titel Teilaufgabe 1',
    ]);
    expect(v.getByLabelText('Zeit')).toHaveValue('0800-1000');
    expect(v.getByLabelText('Spalten')).toHaveValue(column(f.plan, 0).id);
    expect(v.getByLabelText('bis Spalte')).toHaveValue(column(f.plan, 1).id);
  });

  it('[R-5.1-13][R-5.1-23] Titel mit Fett-Knopf und Ctrl+B: die markierte Stelle wird normal bzw. fett; Vorschau zeigt die Läufe; leer und Zeichen ohne Glyphe abgelehnt', async () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    const titel = v.getByLabelText('Titel') as HTMLInputElement;
    titel.setSelectionRange(0, 4);
    await act(async () => {
      fireEvent.pointerDown(v.getByRole('button', { name: 'Fett (Ctrl+B)' }));
      fireEvent.click(v.getByRole('button', { name: 'Fett (Ctrl+B)' }));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    const vorschau = v.container.querySelector('.wap-panel-preview') as HTMLElement;
    expect(vorschau.innerHTML).toBe('<span>Funk</span><strong> Ausbildung</strong>');
    act(() => {
      fireEvent.keyDown(titel, { key: 'Enter' });
    });
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({
      title: [
        { text: 'Funk', bold: false },
        { text: ' Ausbildung', bold: true },
      ],
    });
    // Ctrl+B: « Ausbildung» ist ganz fett und wird normal.
    titel.setSelectionRange(4, 15);
    act(() => {
      fireEvent.keyDown(titel, { key: 'b', ctrlKey: true });
    });
    expect(vorschau.innerHTML).toBe('<span>Funk Ausbildung</span>');
    // Ohne Markierung ändert der Knopf nichts.
    titel.setSelectionRange(2, 2);
    act(() => {
      fireEvent.keyDown(titel, { key: 'B', metaKey: true });
    });
    expect(vorschau.innerHTML).toBe('<span>Funk Ausbildung</span>');
    // Eingabe am Ende übernimmt die Stärke des Zeichens davor.
    act(() => {
      fireEvent.change(titel, { target: { value: 'Funk Ausbildung 2' } });
      fireEvent.blur(titel);
    });
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({
      title: [{ text: 'Funk Ausbildung 2', bold: false }],
    });
    act(() => {
      fireEvent.change(titel, { target: { value: '  ' } });
      fireEvent.keyDown(titel, { key: 'Enter' });
    });
    expect(v.errorOf(titel)).toBe('«Titel» ist leer. Einen Text eingeben oder mit Esc verwerfen.');
    act(() => {
      fireEvent.change(titel, { target: { value: '' } });
    });
    expect(vorschau).toHaveTextContent('leer');
    act(() => {
      fireEvent.keyDown(titel, { key: 'Escape' });
    });
    expect(titel).toHaveValue('Funk Ausbildung 2');
    expect(v.errorOf(titel)).toBe('');
    expect(v.spy.toGrid).toBe(1);
    act(() => {
      fireEvent.change(titel, { target: { value: 'Funk 漢' } });
      fireEvent.blur(titel);
    });
    expect(v.errorOf(titel)).toBe(GLYPHE);
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({
      title: [{ text: 'Funk Ausbildung 2', bold: false }],
    });
  });

  it('[R-4.6-35] Zeit: tolerante Eingabe, alle Formen ausser Frist; Meldungen nennen Feld, Ursache und Beispiel', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    const zeit = () => v.getByLabelText('Zeit');
    const versuch = (text: string) => {
      v.type('Zeit', text);
      return v.errorOf(zeit());
    };
    const time = () => (entryOf(v.spy.plan, f.ids.funk) as Block).time;
    expect(versuch('abc')).toBe(
      '«Zeit»: «abc» ist keine Zeitangabe. Erlaubt: Zeitpunkt, von–bis, ab, bis, zum Beispiel 0900-1200.',
    );
    expect(versuch('0900-9:00')).toBe(
      '«Zeit»: Beginn und Ende sind gleich. Ein späteres Ende eingeben, zum Beispiel 0900-1200.',
    );
    expect(versuch('bis 21.10.')).toBe(
      '«Zeit»: Die Zeitform «Frist» ist hier nicht möglich. Erlaubt: Zeitpunkt, von–bis, ab, bis, zum Beispiel 0900-1200.',
    );
    expect(versuch(' ')).toBe('«Zeit» ist leer. Eine Zeit eingeben, zum Beispiel 0900-1200.');
    expect(versuch('9:7-1000')).toBe(
      '«Zeit»: «9:7» ist keine Zeit. Die Zeit als 0900, 900 oder 9:00 eingeben.',
    );
    expect(versuch('0900-2510')).toBe(
      '«Zeit»: «2510» liegt nicht zwischen 0000 und 2400. Eine Zeit wie 0830 eingeben.',
    );
    expect(versuch('ab 7:03')).toBe(
      '«Zeit»: «7:03» liegt nicht im 5-Minuten-Raster. Zeiten auf 5 Minuten eingeben, zum Beispiel 0700 oder 0705.',
    );
    expect(versuch('bis 1299')).toMatch(/^«Zeit»: «1299» liegt nicht zwischen 0000 und 2400/);
    expect(versuch('9.07')).toMatch(/^«Zeit»: «9.07» liegt nicht im 5-Minuten-Raster/);
    expect(v.spy.runs).toBe(0);
    v.type('Zeit', '9');
    expect(time()).toEqual({ form: 'point', at: 540 });
    v.type('Zeit', 'AB 19');
    expect(time()).toEqual({ form: 'from', from: 1140 });
    v.type('Zeit', 'bis 12');
    expect(time()).toEqual({ form: 'until', to: 720 });
    v.type('Zeit', '2200–0100');
    expect(time()).toEqual({ form: 'range', from: 1320, to: 1500 });
    expect(zeit()).toHaveValue('2200-0100');
  });

  it('[R-4.6-01][R-4.6-60] Spalten «von–bis»: alle Planungsspalten, Bereich, verknüpfte Teilblöcke und fehlende Spalte mit Hinweis', () => {
    const f = fixture();
    const c = (i: number) => column(f.plan, i).id;
    const v = renderPanel(f.plan, entries(f.ids.funk));
    v.choose('bis Spalte', c(3));
    expect((entryOf(v.spy.plan, f.ids.funk) as Block).columns).toEqual({
      kind: 'ids',
      ids: [c(0), c(1), c(2), c(3)],
    });
    v.choose('Spalten', c(2));
    expect((entryOf(v.spy.plan, f.ids.funk) as Block).columns).toEqual({
      kind: 'ids',
      ids: [c(2)],
    });
    // «bis Spalte» bietet nur Spalten ab der ersten.
    expect(
      [...(v.getByLabelText('bis Spalte') as HTMLSelectElement).options].map((o) => o.value),
    ).toEqual([c(2), c(3), c(4), c(5)]);
    v.choose('Spalten', 'all');
    expect((entryOf(v.spy.plan, f.ids.funk) as Block).columns).toEqual({ kind: 'all' });
    expect(v.queryByLabelText('bis Spalte')).toBeNull();
    v.unmount();
    // Verknüpfte Teilblöcke: nicht benachbarte Spalten.
    const r = add(f.plan, {
      type: 'block',
      date: MO,
      time: { form: 'range', from: 600, to: 660 },
      columns: { kind: 'ids', ids: [c(0), c(2)] },
      title: [{ text: 'Verknüpft', bold: true }],
    });
    const w = renderPanel(r.plan, entries(r.id));
    expect(w.getByText('Verknüpfte Teilblöcke (nicht benachbarte Spalten).')).toBeInTheDocument();
    w.unmount();
    // Fehlende Spalte: Spaltensatz des Tages gewechselt (Befund P1).
    const weekId = f.plan.weeks[0]?.id as Id;
    const mi = f.plan.columnSets[1]?.id as Id;
    const ohne = setDayColumnSet(f.plan, weekId, ['Mo'], mi, CTX).plan;
    const x = renderPanel(ohne, entries(f.ids.funk));
    const spalten = x.getByLabelText('Spalten') as HTMLSelectElement;
    expect(spalten).toHaveValue('');
    expect(spalten.options[1]?.textContent).toBe('fehlt am Tag');
    expect(
      x.getByText('Spalte fehlt im Spaltensatz dieses Tages (Befund P1): Spalte neu wählen.'),
    ).toBeInTheDocument();
    expect(x.queryByLabelText('bis Spalte')).toBeNull();
  });

  it('[R-4.7-02][R-4.7-10] Kategorie, gemeinsame Leitung und Vorschlag gemäss Funktionsliste (nur auf Aktion übernommen)', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    const [bat, kp, zfhr] = f.plan.legend.map((k) => k.id);
    const vorschlag = v.getByRole('group', { name: 'Vorschlag Kategorie' });
    expect(vorschlag).toHaveTextContent('Vorschlag gemäss Funktionsliste: Kategorie «Ltg Zfhr»');
    expect((entryOf(v.spy.plan, f.ids.funk) as Block).categoryId).toBe(kp);
    fireEvent.click(
      within(vorschlag).getByRole('button', { name: 'Kategorie «Ltg Zfhr» übernehmen' }),
    );
    expect((entryOf(v.spy.plan, f.ids.funk) as Block).categoryId).toBe(zfhr);
    expect(v.queryByRole('group', { name: 'Vorschlag Kategorie' })).toBeNull();
    v.choose('Kategorie', bat as Id);
    expect((entryOf(v.spy.plan, f.ids.funk) as Block).categoryId).toBe(bat);
    v.choose('Gemeinsame Leitung (zweite Kategorie)', kp as Id);
    expect((entryOf(v.spy.plan, f.ids.funk) as Block).secondCategoryId).toBe(kp);
    v.choose('Gemeinsame Leitung (zweite Kategorie)', '');
    expect((entryOf(v.spy.plan, f.ids.funk) as Block).secondCategoryId).toBeNull();
    // Ltg ohne Treffer in der Funktionsliste: kein Vorschlag.
    v.type('Ltg', 'Wm Probe');
    expect(v.queryByRole('group', { name: 'Vorschlag Kategorie' })).toBeNull();
  });

  it('[R-4.6-02] Zusatz, Ort, Tn mit «drucken», Tpt, Tenue mit «drucken», Status, Textrichtung, offenes Ende und interne Notiz', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    v.type('Zusatz', 'mit Gerät');
    v.type('Ort', 'Wald');
    v.type('Tn', 'Zug 1');
    fireEvent.click(v.getByLabelText('Tn drucken'));
    v.type('Tpt', 'Bus');
    v.type('Tenue', 'Tenue B');
    fireEvent.click(v.getByLabelText('Tenue drucken'));
    fireEvent.click(radio(v, 'Status', 'offen'));
    fireEvent.click(radio(v, 'Textrichtung', 'senkrecht'));
    fireEvent.click(v.getByLabelText('Offenes Ende'));
    v.type('Interne Notiz', 'Material prüfen');
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({
      supplement: 'mit Gerät',
      ort: 'Wald',
      tn: 'Zug 1',
      printTn: true,
      tpt: 'Bus',
      tenue: 'Tenue B',
      printTenue: true,
      status: 'open',
      textDirection: 'vertical',
      openEnd: true,
      internalNote: 'Material prüfen',
    });
    // Esc in einem Kontrollkästchen gibt den Fokus ans Raster.
    act(() => {
      fireEvent.keyDown(v.getByLabelText('Offenes Ende'), { key: 'Escape' });
    });
    expect(v.spy.toGrid).toBe(1);
  });

  it('[R-4.6-02] Tag: Wahl aus den Tagen der Woche; liegt der Eintrag in einer anderen Woche, steht sein Datum zuoberst', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    const tag = v.getByLabelText('Tag') as HTMLSelectElement;
    expect([...tag.options].map((o) => o.textContent)).toEqual([
      'Mo 28.09.2026',
      'Di 29.09.2026',
      'Mi 30.09.2026',
      'Do 01.10.2026',
      'Fr 02.10.2026',
      'Sa 03.10.2026',
      'So 04.10.2026',
    ]);
    v.choose('Tag', DI);
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ date: DI });
    v.select(entries(f.ids.wocheZwei));
    const fremd = v.getByLabelText('Tag') as HTMLSelectElement;
    expect(fremd).toHaveValue(MO2);
    expect(fremd.options[0]?.textContent).toBe('05.10.2026');
  });

  it('[R-4.1-10] Ltg mit Vorschlagsliste aus Personen- und Funktionsliste: Pfeile wählen, Enter oder Tab übernehmen, Esc schliesst zuerst die Liste', () => {
    const f = fixture();
    const v = renderPanel(mitPerson(f.plan), entries(f.ids.funk));
    const ltg = v.getByLabelText('Ltg');
    act(() => {
      fireEvent.focus(ltg);
      fireEvent.change(ltg, { target: { value: 'kp' } });
    });
    const liste = v.getByRole('listbox', { name: 'Vorschläge Ltg' });
    expect(
      within(liste)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Hptm Muster Anna (Kp Kdt)Kp Kdt', 'Kp KdtKategorie Ltg Kp']);
    expect(ltg).toHaveAttribute('aria-expanded', 'true');
    act(() => {
      fireEvent.keyDown(ltg, { key: 'ArrowDown' });
      fireEvent.keyDown(ltg, { key: 'ArrowDown' });
      fireEvent.keyDown(ltg, { key: 'ArrowDown' });
    });
    expect(ltg.getAttribute('aria-activedescendant')).toMatch(/-o0$/);
    act(() => {
      fireEvent.keyDown(ltg, { key: 'ArrowUp' });
    });
    expect(ltg.getAttribute('aria-activedescendant')).toMatch(/-o1$/);
    act(() => {
      fireEvent.keyDown(ltg, { key: 'Enter' });
    });
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ltg: 'Kp Kdt' });
    expect(v.queryByRole('listbox')).toBeNull();
    // Tab mit gewähltem Vorschlag übernimmt ihn.
    act(() => {
      fireEvent.change(ltg, { target: { value: 'muster' } });
    });
    act(() => {
      fireEvent.keyDown(ltg, { key: 'ArrowUp' });
    });
    act(() => {
      fireEvent.keyDown(ltg, { key: 'Tab' });
    });
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ltg: 'Hptm Muster' });
    // Esc: zuerst schliesst die Liste, dann stellt Esc den Wert her und gibt den Fokus ans Raster.
    act(() => {
      fireEvent.change(ltg, { target: { value: 'S' } });
    });
    act(() => {
      fireEvent.keyDown(ltg, { key: 'Escape' });
    });
    expect(v.queryByRole('listbox')).toBeNull();
    expect(v.spy.toGrid).toBe(0);
    act(() => {
      fireEvent.keyDown(ltg, { key: 'Escape' });
    });
    expect(ltg).toHaveValue('Hptm Muster');
    expect(v.spy.toGrid).toBe(1);
    // Ohne Treffer: Pfeile öffnen keine Liste.
    act(() => {
      fireEvent.change(ltg, { target: { value: 'xyz' } });
    });
    act(() => {
      fireEvent.keyDown(ltg, { key: 'ArrowDown' });
    });
    expect(v.queryByRole('listbox')).toBeNull();
    expect(ltg).toHaveAttribute('aria-expanded', 'false');
    // Mausklick auf einen Vorschlag übernimmt ihn sofort; Verlassen übernimmt getippten Text.
    act(() => {
      fireEvent.change(ltg, { target: { value: 'Four' } });
    });
    act(() => {
      fireEvent.pointerDown(within(v.getByRole('listbox')).getByRole('option'));
    });
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ltg: 'Four' });
    act(() => {
      fireEvent.change(ltg, { target: { value: 'Oblt Probe' } });
      fireEvent.blur(ltg);
    });
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ltg: 'Oblt Probe' });
    act(() => {
      fireEvent.change(ltg, { target: { value: 'Oblt 漢' } });
    });
    act(() => {
      fireEvent.keyDown(ltg, { key: 'Enter' });
    });
    expect(v.errorOf(ltg)).toBe(GLYPHE);
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ ltg: 'Oblt Probe' });
  });

  it('[R-5.1-25] Teilaufgaben: bearbeiten, verschieben, entfernen, hinzufügen (Fokus ins neue Titelfeld); leerer Titel abgelehnt', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    const subs = () => (entryOf(v.spy.plan, f.ids.funk) as Block).subtasks ?? [];
    const tabelle = v.getByRole('grid', { name: 'Teilaufgaben' });
    expect(within(tabelle).getAllByRole('row')).toHaveLength(3);
    v.type('Titel Teilaufgabe 1', 'Funkgerät prüfen');
    expect(subs()[0]?.title).toEqual([{ text: 'Funkgerät prüfen', bold: false }]);
    const leer = v.type('Titel Teilaufgabe 1', ' ');
    expect(v.errorOf(leer)).toBe('Die Teilaufgabe braucht einen Titel.');
    act(() => {
      fireEvent.keyDown(leer, { key: 'Escape' });
    });
    v.type('Ltg Teilaufgabe 2', 'Wm Probe');
    v.type('Ort Teilaufgabe 2', 'Keller');
    expect(subs()[1]).toEqual({
      title: [{ text: 'Lagebild', bold: false }],
      ltg: 'Wm Probe',
      ort: 'Keller',
    });
    expect(v.getByRole('button', { name: 'Teilaufgabe 1 nach oben' })).toBeDisabled();
    expect(v.getByRole('button', { name: 'Teilaufgabe 2 nach unten' })).toBeDisabled();
    fireEvent.click(v.getByRole('button', { name: 'Teilaufgabe 1 nach unten' }));
    expect(subs().map((s) => s.title[0]?.text)).toEqual(['Lagebild', 'Funkgerät prüfen']);
    fireEvent.click(v.getByRole('button', { name: 'Teilaufgabe 2 nach oben' }));
    expect(subs().map((s) => s.title[0]?.text)).toEqual(['Funkgerät prüfen', 'Lagebild']);
    fireEvent.click(v.getByRole('button', { name: 'Teilaufgabe 2 entfernen' }));
    expect(subs()).toHaveLength(1);
    fireEvent.click(v.getByRole('button', { name: 'Teilaufgabe hinzufügen' }));
    expect(subs().map((s) => s.title[0]?.text)).toEqual(['Funkgerät prüfen', 'Teilaufgabe 2']);
    const neu = v.getByLabelText('Titel Teilaufgabe 2') as HTMLInputElement;
    expect(document.activeElement).toBe(neu);
    expect([neu.selectionStart, neu.selectionEnd]).toEqual([0, 'Teilaufgabe 2'.length]);
    // Block ohne Teilaufgaben: keine Tabelle, nur der Knopf.
    v.select(entries(f.ids.vorbereitung));
    expect(v.queryByRole('grid', { name: 'Teilaufgaben' })).toBeNull();
    fireEvent.click(v.getByRole('button', { name: 'Teilaufgabe hinzufügen' }));
    expect((entryOf(v.spy.plan, f.ids.vorbereitung) as Block).subtasks).toEqual([
      { title: [{ text: 'Teilaufgabe 1', bold: false }], ltg: '', ort: '' },
    ]);
  });

  it('[R-5.1-12] gesperrt: Felder des Eintrags sind deaktiviert', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk), { disabled: true });
    for (const l of ['Titel', 'Zeit', 'Spalten', 'Kategorie', 'Ltg', 'Tn drucken', 'Interne Notiz'])
      expect(v.getByLabelText(l)).toBeDisabled();
    expect(v.getByRole('button', { name: 'Fett (Ctrl+B)' })).toBeDisabled();
    expect(v.getByRole('button', { name: 'Teilaufgabe hinzufügen' })).toBeDisabled();
  });
});

describe('F-ABDECKUNG2 Seitenfeld: Auswahlwechsel mit offener Eingabe (UX-H-01)', () => {
  it('[R-5.7-04] eine gültige, nicht übernommene Eingabe wird beim Auswahlwechsel übernommen, eine ungültige sichtbar gemeldet', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    act(() => {
      fireEvent.change(v.getByLabelText('Ort'), { target: { value: 'Turnhalle' } });
      fireEvent.change(v.getByLabelText('Zeit'), { target: { value: 'morgen' } });
      fireEvent.change(v.getByLabelText('Titel'), { target: { value: '' } });
    });
    v.select(entries(f.ids.kr));
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({
      ort: 'Turnhalle',
      time: { form: 'range', from: 480, to: 600 },
    });
    expect(v.spy.notices).toEqual([
      '«Titel» von «Funk Ausbildung» nicht übernommen: «Titel» ist leer. Einen Text eingeben oder mit Esc verwerfen.',
      '«Zeit» von «Funk Ausbildung» nicht übernommen: «Zeit»: «morgen» ist keine Zeitangabe. Erlaubt: Zeitpunkt, von–bis, ab, bis, zum Beispiel 0900-1200.',
    ]);
    // Rapport: Name des Eintrags ist das Kürzel; Marker: der Typ; Bemerkung: der Text.
    act(() => {
      fireEvent.change(v.getByLabelText('Zeit'), { target: { value: 'nie' } });
    });
    v.select(entries(f.ids.marker));
    expect(v.spy.notices[2]).toMatch(/^«Zeit» von «KR» nicht übernommen: /);
    act(() => {
      fireEvent.change(v.getByLabelText('Zeitpunkt'), { target: { value: 'nie' } });
    });
    v.select(entries(f.ids.tagBemerkung));
    expect(v.spy.notices[3]).toMatch(/^«Zeitpunkt» von «Marker» nicht übernommen: /);
    act(() => {
      fireEvent.change(v.getByLabelText('Text'), { target: { value: ' ' } });
    });
    v.select({ kind: 'week' });
    expect(v.spy.notices[4]).toBe(
      '«Text» von «Materialfassung» nicht übernommen: Die Bemerkung braucht einen Text.',
    );
  });

  it('[R-5.7-04] Eintrag ohne Titel: die Meldung nennt nur das Feld; ohne Meldungsweg geht nichts schief', () => {
    const f = fixture();
    const r = add(f.plan, {
      type: 'block',
      date: MO,
      time: { form: 'range', from: 600, to: 660 },
      columns: { kind: 'ids', ids: [column(f.plan, 0).id] },
      title: [],
    });
    const v = renderPanel(r.plan, entries(r.id));
    act(() => {
      fireEvent.change(v.getByLabelText('Zeit'), { target: { value: 'nie' } });
    });
    v.select({ kind: 'week' });
    expect(v.spy.notices[0]).toMatch(
      /^«Zeit» nicht übernommen: «Zeit»: «nie» ist keine Zeitangabe/,
    );
    v.unmount();
    const ohne = renderPanel(r.plan, entries(r.id), { withNotice: false });
    act(() => {
      fireEvent.change(ohne.getByLabelText('Zeit'), { target: { value: 'nie' } });
    });
    expect(() => ohne.select({ kind: 'week' })).not.toThrow();
    expect(ohne.spy.notices).toEqual([]);
  });
});

describe('F-ABDECKUNG2 Seitenfeld: Beso', () => {
  it('[R-5.3-05] Nummer: laufend oder fixiert, fixieren und lösen, fixieren als bestimmte Nummer; Tag neu nummerieren', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.visite));
    const nr = () => (entryOf(v.spy.plan, f.ids.visite) as Beso).besoNumber;
    const anzeige = v.container.querySelector('.wap-panel-number') as HTMLElement;
    expect(anzeige).toHaveTextContent(`${String(nr())} · laufend`);
    fireEvent.click(v.getByRole('button', { name: 'Nummer fixieren' }));
    expect(entryOf(v.spy.plan, f.ids.visite)).toMatchObject({ numberFixed: true });
    expect(anzeige).toHaveTextContent('· fixiert');
    fireEvent.click(v.getByRole('button', { name: 'Fixierung lösen' }));
    expect(entryOf(v.spy.plan, f.ids.visite)).toMatchObject({ numberFixed: false });
    const als = v.type('Nummer fixieren als', '1a');
    expect(v.errorOf(als)).toBe('Eine Nummer wie 12 eingeben.');
    v.type('Nummer fixieren als', ' 15 ');
    expect(entryOf(v.spy.plan, f.ids.visite)).toMatchObject({ besoNumber: 15, numberFixed: true });
    fireEvent.click(v.getByRole('button', { name: 'Tag neu nummerieren …' }));
    expect(v.spy.renumbered).toEqual([MO]);
  });

  it('[R-4.6-41] Zeitfenster: Zeit (auch Frist), Spalte, Zusatz je Fenster; hinzufügen nach dem letzten; entfernen; das letzte erst nach Rückfrage', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.visite));
    const fenster = () => (entryOf(v.spy.plan, f.ids.visite) as Beso).windows;
    expect(v.getByLabelText('Zeit 1')).toHaveValue('1400');
    expect(v.getByLabelText('Zeit 2')).toHaveValue('1500-1600');
    const z2 = v.type('Zeit 2', 'xyz');
    expect(v.errorOf(z2)).toBe(
      '«Zeit»: «xyz» ist keine Zeitangabe. Erlaubt: Zeitpunkt, von–bis, ab, bis, Frist, zum Beispiel 0900-1200.',
    );
    v.type('Zeit 2', 'bis 28.09. 1700');
    expect(fenster()[1]?.time).toEqual({ form: 'deadline', to: 1020 });
    const c0 = column(f.plan, 0);
    expect(
      [...(v.getByLabelText('Spalte 1') as HTMLSelectElement).options].map((o) => o.textContent)[0],
    ).toBe('Beso-Spalte');
    v.choose('Spalte 1', c0.id);
    expect(fenster()[0]?.columnId).toBe(c0.id);
    v.choose('Spalte 1', '');
    expect(fenster()[0]?.columnId).toBeNull();
    v.type('Zusatz 1', 'mit Kdt');
    expect(fenster()[0]?.supplement).toBe('mit Kdt');
    // Hinzufügen: nach einem Fenster «von–bis» beginnt das neue am Ende, nach einem Zeitpunkt eine Stunde später.
    v.type('Zeit 2', '1500-1600');
    fireEvent.click(v.getByRole('button', { name: 'Zeitfenster hinzufügen' }));
    expect(fenster()[2]?.time).toEqual({ form: 'point', at: 960 });
    expect(document.activeElement).toBe(v.getByLabelText('Zeit 3'));
    fireEvent.click(v.getByRole('button', { name: 'Zeitfenster hinzufügen' }));
    expect(fenster()[3]?.time).toEqual({ form: 'point', at: 1020 });
    v.type('Zeit 4', 'ab 1800');
    fireEvent.click(v.getByRole('button', { name: 'Zeitfenster hinzufügen' }));
    expect(fenster()[4]?.time).toEqual({ form: 'point', at: 600 });
    for (const n of [5, 4, 3, 2])
      fireEvent.click(v.getByRole('button', { name: `Zeitfenster ${String(n)} entfernen` }));
    expect(fenster()).toHaveLength(1);
    fireEvent.click(v.getByRole('button', { name: 'Zeitfenster 1 entfernen' }));
    const frage = v.getByRole('group', { name: 'Letztes Zeitfenster' });
    expect(frage).toHaveTextContent(
      'Das ist das letzte Zeitfenster. Den ganzen Beso samt Terminzeile löschen?',
    );
    fireEvent.click(within(frage).getByRole('button', { name: 'Abbrechen' }));
    expect(v.queryByRole('group', { name: 'Letztes Zeitfenster' })).toBeNull();
    expect(v.spy.removed).toEqual([]);
    fireEvent.click(v.getByRole('button', { name: 'Zeitfenster 1 entfernen' }));
    fireEvent.click(v.getByRole('button', { name: 'Beso löschen' }));
    expect(v.spy.removed).toEqual([[f.ids.visite]]);
  });

  it('[FA2-03][R-4.6-35][R-5.7-04] Zeitfenster mit Frist an einem anderen Tag: der Beso rückt auf den Frist-Tag, das Feld zeigt die eingegebene Frist', () => {
    // Behoben F-UX5 (Koordinator 26.10.2026): eine Frist gilt am Tag des Eintrags; nie still eine andere Frist.
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.frist));
    const zeit = v.type('Zeit 1', 'bis 02.10. 1200');
    expect(v.errorOf(zeit)).toBe('');
    expect(entryOf(v.spy.plan, f.ids.frist)).toMatchObject({
      date: '2026-10-02',
      windows: [{ time: { form: 'deadline', to: 720 } }],
    });
    expect(v.getByLabelText('Zeit 1')).toHaveValue('bis 02.10. 1200');
  });

  it('[FA2-03][R-5.7-04] Beso mit mehreren Zeitfenstern: Frist an einem anderen Tag wird am Feld mit Ursache und nächstem Schritt abgelehnt', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.visite));
    const zeit = v.type('Zeit 1', 'bis 02.10.');
    expect(v.errorOf(zeit)).toBe(
      'Die Frist bis 02.10. liegt an einem anderen Tag als der Beso (Mo 28.09.); ein Beso mit mehreren Zeitfenstern bleibt an seinem Tag. Eine Frist am 28.09. eingeben oder das Zeitfenster als eigenen Beso anlegen.',
    );
    expect(entryOf(v.spy.plan, f.ids.visite)).toEqual(f.plan.entries[f.ids.visite]);
  });

  it('[R-5.3-13] «Ohne Zeit (wird Bemerkung)» nur bei einem Zeitfenster; der Beso wird zur ganztägigen Bemerkung ohne Nummer', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.visite));
    expect(v.queryByRole('button', { name: 'Ohne Zeit (wird Bemerkung)' })).toBeNull();
    v.select(entries(f.ids.frist));
    fireEvent.click(v.getByRole('button', { name: 'Ohne Zeit (wird Bemerkung)' }));
    // Gleicher Eintrag, Text aus der Terminzeile, keine Nummer mehr.
    expect(entryOf(v.spy.plan, f.ids.frist)).toMatchObject({
      type: 'dayRemark',
      date: MI,
      text: 'Meldung abgeben.',
    });
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('Ganztägige Bemerkung');
  });

  it('[R-4.6-26][R-4.6-28] Ltg mit Vorschlag, Tn, Tpt, Ort, Kategorie «keine», Status; Terminzeile aus den Feldern oder als Freitext mit Vorschau', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.visite));
    const s2 = f.plan.legend[4]?.id as Id;
    v.type('Ltg', 'S2');
    fireEvent.click(v.getByRole('button', { name: 'Kategorie «Ltg S2» übernehmen' }));
    v.type('Tn', 'Kader');
    v.type('Tpt', 'Pw');
    v.type('Ort', 'KP');
    fireEvent.click(radio(v, 'Status', 'gestrichen'));
    expect(entryOf(v.spy.plan, f.ids.visite)).toMatchObject({
      ltg: 'S2',
      categoryId: s2,
      tn: 'Kader',
      tpt: 'Pw',
      ort: 'KP',
      status: 'cancelled',
    });
    v.choose('Kategorie', '');
    expect(entryOf(v.spy.plan, f.ids.visite)).toMatchObject({ categoryId: null });
    const vorschau = () => v.container.querySelectorAll('.wap-panel-preview');
    const terminzeile = () => [...vorschau()].at(-1)?.textContent ?? '';
    expect(terminzeile()).toMatch(/^Vorschau Terminzeile: \d+ Visite: 1400, 1500-1600 Teil zwei/);
    expect(terminzeile()).toContain('Ltg: S2');
    fireEvent.click(radio(v, 'Terminzeile', 'Freitext'));
    expect(entryOf(v.spy.plan, f.ids.visite)).toMatchObject({ agendaOverride: 'Visite' });
    v.type('Freitext der Terminzeile', 'Visite des Kdt');
    expect(terminzeile()).toMatch(/^Vorschau Terminzeile: \d+ Visite des Kdt$/);
    v.type('Freitext der Terminzeile', '  ');
    expect(entryOf(v.spy.plan, f.ids.visite)).toMatchObject({ agendaOverride: null });
    expect(v.queryByLabelText('Freitext der Terminzeile')).toBeNull();
    // Ohne Titel heisst der Freitext zunächst «Freitext».
    v.type('Titel', 'x');
    const ohneTitel = add(v.spy.plan, {
      type: 'beso',
      date: MO,
      title: [],
      windows: [{ time: { form: 'point', at: 1200 } }],
    });
    v.unmount();
    const w = renderPanel(ohneTitel.plan, entries(ohneTitel.id));
    fireEvent.click(radio(w, 'Terminzeile', 'Freitext'));
    expect(entryOf(w.spy.plan, ohneTitel.id)).toMatchObject({ agendaOverride: 'Freitext' });
    fireEvent.click(radio(w, 'Terminzeile', 'aus den Feldern'));
    expect(entryOf(w.spy.plan, ohneTitel.id)).toMatchObject({ agendaOverride: null });
  });

  it('[R-5.3-10] Beso ohne Nummer (Nummernkreis voll): Hinweis P17, «Nummer fixieren» gesperrt', () => {
    const f = fixture();
    let plan = f.plan;
    const ids: Id[] = [];
    for (let i = 0; i < 10; i++) {
      const r = add(plan, {
        type: 'beso',
        date: MO,
        title: [{ text: `Zusatz ${String(i)}`, bold: false }],
        windows: [{ time: { form: 'point', at: 600 + i * 5 } }],
      });
      plan = r.plan;
      ids.push(r.id);
    }
    const ohneNummer = Object.values(plan.entries).find(
      (e) => e.type === 'beso' && e.besoNumber === null,
    );
    expect(ohneNummer).toBeDefined();
    const v = renderPanel(plan, entries(ohneNummer?.id as Id));
    expect(v.container.querySelector('.wap-panel-number')).toHaveTextContent(
      '– · laufend (Nummernkreis voll, Befund P17)',
    );
    expect(v.getByRole('button', { name: 'Nummer fixieren' })).toBeDisabled();
    expect(v.getByLabelText('Nummer fixieren als')).toHaveValue('');
  });
});

describe('F-ABDECKUNG2 Seitenfeld: Rapport, Marker, Querbalken, Bemerkungen', () => {
  it('[R-4.6-16][R-4.7-16] Rapport: Kürzel aus der Liste setzt dessen Kategorie; unbekanntes Kürzel wird zur Aufnahme vorgeschlagen', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.kr));
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('Rapport');
    const bat = f.plan.legend[0]?.id as Id;
    v.type('Kürzel', 'BR 1');
    expect(entryOf(v.spy.plan, f.ids.kr)).toMatchObject({ code: 'BR 1', categoryId: bat });
    v.type('Kürzel', 'BR 2');
    expect(entryOf(v.spy.plan, f.ids.kr)).toMatchObject({ code: 'BR 2', categoryId: bat });
    expect(v.queryByRole('group', { name: 'Unbekanntes Kürzel' })).toBeNull();
    v.type('Kürzel', 'WR');
    const frage = v.getByRole('group', { name: 'Unbekanntes Kürzel' });
    expect(frage).toHaveTextContent('«WR» steht nicht in der Abkürzungsliste.');
    fireEvent.click(
      within(frage).getByRole('button', { name: '«WR» in Abkürzungsliste aufnehmen' }),
    );
    expect(v.spy.plan.rapportCodes.some((r) => r.code === 'WR' && r.categoryId === bat)).toBe(true);
    expect(v.queryByRole('group', { name: 'Unbekanntes Kürzel' })).toBeNull();
  });

  it('[R-4.6-16][R-4.6-22][R-4.6-23] Rapport: Zeitpunkt oder von–bis; Anzeige «auch in Spalten» beginnt mit allen Spalten, Spalten wählbar; Ort, Tn, Kategorie', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.kr));
    const zeit = v.type('Zeit', 'ab 0700');
    expect(v.errorOf(zeit)).toBe(
      '«Zeit»: Die Zeitform «ab» ist hier nicht möglich. Erlaubt: Zeitpunkt, von–bis, zum Beispiel 0900-1200.',
    );
    v.type('Zeit', '0700-0730');
    expect(entryOf(v.spy.plan, f.ids.kr)).toMatchObject({
      time: { form: 'range', from: 420, to: 450 },
    });
    expect(v.queryByLabelText('Anzeige in Spalten')).toBeNull();
    fireEvent.click(radio(v, 'Anzeige', 'auch in Spalten'));
    expect(entryOf(v.spy.plan, f.ids.kr)).toMatchObject({
      display: 'alsoInColumns',
      displayColumns: { kind: 'all' },
    });
    expect(v.getByLabelText('Anzeige in Spalten')).toHaveValue('all');
    const c1 = column(f.plan, 1).id;
    v.choose('Anzeige in Spalten', c1);
    fireEvent.click(radio(v, 'Anzeige', 'nur in Spalten'));
    expect(entryOf(v.spy.plan, f.ids.kr)).toMatchObject({
      display: 'onlyInColumns',
      displayColumns: { kind: 'ids', ids: [c1] },
    });
    fireEvent.click(radio(v, 'Anzeige', 'nur Rap-Spalte'));
    expect(entryOf(v.spy.plan, f.ids.kr)).toMatchObject({ display: 'rapColumn' });
    v.type('Ort', 'KP');
    v.type('Tn', 'Zfhr');
    const ext = f.plan.legend[3]?.id as Id;
    v.choose('Kategorie', ext);
    fireEvent.click(radio(v, 'Status', 'offen'));
    v.type('Interne Notiz', 'kurz');
    expect(entryOf(v.spy.plan, f.ids.kr)).toMatchObject({
      ort: 'KP',
      tn: 'Zfhr',
      categoryId: ext,
      status: 'open',
      internalNote: 'kurz',
    });
    v.choose('Tag', DI);
    expect(entryOf(v.spy.plan, f.ids.kr)).toMatchObject({ date: DI });
  });

  it('[R-4.6-11][R-4.6-13][R-4.6-15] Marker: Art mit freier Bezeichnung, Beschriftung nur aus der Art gebildet, Zeitpunkt, flacher Block', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.marker));
    expect(v.container.querySelector('.wap-panel-summary')).toHaveTextContent(
      'Mo 28.09.2026 · 2200',
    );
    const beschriftung = v.getByRole('status', { name: 'Beschriftung des Markers' });
    expect(beschriftung).toHaveTextContent('AV');
    fireEvent.click(radio(v, 'Art', 'ABV'));
    expect(beschriftung).toHaveTextContent('ABV 2200');
    fireEvent.click(radio(v, 'Art', 'frei'));
    expect(entryOf(v.spy.plan, f.ids.marker)).toMatchObject({
      kind: 'custom',
      customKind: 'Marker',
    });
    const frei = v.type('Freie Art', ' ');
    expect(v.errorOf(frei)).toBe('Die freie Art braucht eine Bezeichnung.');
    v.type('Freie Art', 'Appell');
    expect(beschriftung).toHaveTextContent('Appell');
    // Zurück auf HV und wieder «frei»: die freie Bezeichnung bleibt.
    fireEvent.click(radio(v, 'Art', 'HV'));
    expect(v.queryByLabelText('Freie Art')).toBeNull();
    fireEvent.click(radio(v, 'Art', 'frei'));
    expect(entryOf(v.spy.plan, f.ids.marker)).toMatchObject({
      kind: 'custom',
      customKind: 'Appell',
    });
    const zeit = v.type('Zeitpunkt', '2200-2300');
    expect(v.errorOf(zeit)).toBe(
      '«Zeitpunkt»: Die Zeitform «von–bis» ist hier nicht möglich. Erlaubt: Zeitpunkt, zum Beispiel 0900.',
    );
    v.type('Zeitpunkt', '2330');
    fireEvent.click(v.getByLabelText('Als flacher Block'));
    expect(entryOf(v.spy.plan, f.ids.marker)).toMatchObject({ at: 1410, asFlatBlock: true });
    expect(
      v.getByText('Spalten: alle Planungsspalten (Marker gelten immer über den ganzen Tag).'),
    ).toBeInTheDocument();
  });

  it('[R-4.6-04][R-4.6-05] Querbalken: Datum von–bis auch über die Woche; vertauschte Daten werden nachgezogen; Kategorie «keine (weiss)»', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.querbalken));
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('Querbalken');
    expect(v.container.querySelector('.wap-panel-summary')).toHaveTextContent(
      '28.09.2026–29.09.2026',
    );
    const qb = () => entryOf(v.spy.plan, f.ids.querbalken);
    v.type('Datum bis', '06.10.2026');
    expect(qb()).toMatchObject({ fromDate: MO, toDate: '2026-10-06' });
    v.type('Datum von', '08.10.2026');
    expect(qb()).toMatchObject({ fromDate: '2026-10-08', toDate: '2026-10-08' });
    v.type('Datum bis', '2026-10-01');
    expect(qb()).toMatchObject({ fromDate: '2026-10-01', toDate: '2026-10-01' });
    v.type('Datum von', '30.09.2026');
    expect(qb()).toMatchObject({ fromDate: '2026-09-30', toDate: '2026-10-01' });
    const falsch = v.type('Datum von', '1.10.');
    expect(v.errorOf(falsch)).toBe(
      '«Datum von»: «1.10.» ist kein Datum. Das Datum als dd.mm.yyyy eingeben, zum Beispiel 28.09.2026.',
    );
    const kat = v.getByLabelText('Kategorie') as HTMLSelectElement;
    expect(kat.options[0]?.textContent).toBe('keine (weiss)');
    const kp = f.plan.legend[1]?.id as Id;
    v.choose('Kategorie', kp);
    expect(qb()).toMatchObject({ categoryId: kp });
    v.choose('Kategorie', '');
    expect(qb()).toMatchObject({ categoryId: null });
    v.type('Titel', 'Übungsphase 2');
    v.choose('Spalten', column(f.plan, 0).id);
    expect(qb()).toMatchObject({ title: [{ text: 'Übungsphase 2', bold: true }] });
  });

  it('[R-4.6-29] ganztägige Bemerkung: Text Pflicht, Tag, Status', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.tagBemerkung));
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('Ganztägige Bemerkung');
    const text = v.type('Text', '');
    expect(v.errorOf(text)).toBe('Die Bemerkung braucht einen Text.');
    v.type('Text', 'Fassung Mat');
    v.choose('Tag', DI);
    fireEvent.click(radio(v, 'Status', 'offen'));
    expect(entryOf(v.spy.plan, f.ids.tagBemerkung)).toMatchObject({
      text: 'Fassung Mat',
      date: DI,
      status: 'open',
    });
  });

  it('[R-4.2-10][R-4.6-31] mehrtägige Bemerkung: Zeitraum ganzer Plan, Woche oder von–bis; Nummer; Verweis-Kästchen in einer Spalte', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.planBemerkung));
    const label = f.plan.weeks[0]?.label;
    const summary = () => v.container.querySelector('.wap-panel-summary')?.textContent;
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('Bemerkung');
    expect(summary()).toBe('gilt für den ganzen Plan');
    fireEvent.click(radio(v, 'Zeitraum', 'diese Woche'));
    expect(summary()).toBe(`gilt für ${label}`);
    fireEvent.click(radio(v, 'Zeitraum', 'von–bis'));
    expect(summary()).toBe('28.09.2026–04.10.2026');
    v.type('Datum bis', '30.09.2026');
    v.type('Datum von', '29.09.2026');
    expect(entryOf(v.spy.plan, f.ids.planBemerkung)).toMatchObject({
      scope: { kind: 'range', fromDate: DI, toDate: '2026-09-30' },
    });
    const nummer = v.type('Nummer', '12a');
    expect(v.errorOf(nummer)).toBe('Eine Nummer wie 3 eingeben oder leer lassen.');
    v.type('Nummer', '3');
    expect(entryOf(v.spy.plan, f.ids.planBemerkung)).toMatchObject({ number: 3 });
    v.type('Nummer', '');
    expect(entryOf(v.spy.plan, f.ids.planBemerkung)).toMatchObject({ number: null });
    const kasten = v.getByLabelText('Verweis-Kästchen in Spalte') as HTMLSelectElement;
    expect([...kasten.options].map((o) => o.textContent)).toEqual([
      'keines',
      'Kp Kdt',
      'Stv',
      'Zfhr',
      'Uof',
      'höh Uof',
      'Trp',
    ]);
    const c0 = column(f.plan, 0).id;
    v.choose('Verweis-Kästchen in Spalte', c0);
    expect(entryOf(v.spy.plan, f.ids.planBemerkung)).toMatchObject({ refBoxColumnId: c0 });
    v.choose('Verweis-Kästchen in Spalte', '');
    v.type('Text', 'Bereitschaft');
    fireEvent.click(radio(v, 'Zeitraum', 'ganzer Plan'));
    expect(entryOf(v.spy.plan, f.ids.planBemerkung)).toMatchObject({
      refBoxColumnId: null,
      text: 'Bereitschaft',
      scope: { kind: 'plan' },
    });
  });

  it('[R-4.6-31] mehrtägige Bemerkung bei unbekannter Woche: Zeitraum unverändert, Verweis-Kästchen nur «keines»', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.planBemerkung), { week: 5 });
    fireEvent.click(radio(v, 'Zeitraum', 'diese Woche'));
    expect(v.spy.runs).toBe(0);
    expect(
      [...(v.getByLabelText('Verweis-Kästchen in Spalte') as HTMLSelectElement).options].map(
        (o) => o.textContent,
      ),
    ).toEqual(['keines']);
  });
});
