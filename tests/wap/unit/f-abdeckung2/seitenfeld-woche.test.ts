// @vitest-environment jsdom
// F-ABDECKUNG2: Seitenfeld für Woche, Tag(e) und Mehrfachauswahl (Beschrieb 4.2, 4.3, 5.1; UI-Richtlinie 6, 13.3;
// R-5.1-12, R-4.2-01 bis R-4.2-09, R-4.3-01, R-4.3-02, R-4.8-11, R-6-07, R-5.1-21, R-5.7-03). Jede übernommene
// Feldänderung wirkt als Befehl auf das Modell; ungültige Eingaben zeigen die Meldung am Feld. Nur fiktive Daten.
import { act, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Id, Plan, Week } from '../../../../src/model/wap/types';
import { kpPlan } from '../../support/i5/plan';
import { entries, renderPanel } from './panel';
import { DI, entryOf, fixture, hideDay, MI, MO } from './ui';

const week = (p: Plan) => {
  const w = p.weeks[0];
  if (w === undefined) throw new Error('Woche fehlt');
  return w;
};

describe('F-ABDECKUNG2 Seitenfeld: Woche', () => {
  it('[R-5.1-12] ohne Auswahl zeigt das Seitenfeld die Woche mit Bezeichnung und Zeitraum; Kopf, Schliessen und Meldung', () => {
    const f = fixture();
    const v = renderPanel(f.plan, { kind: 'week' });
    const w = week(f.plan);
    const feld = v.getByRole('complementary', { name: 'Seitenfeld' });
    expect(within(feld).getByText('Woche')).toHaveClass('wap-panel-type');
    expect(feld).toHaveTextContent(`${w.label} · 28.09.2026–04.10.2026`);
    fireEvent.click(v.getByRole('button', { name: 'Seitenfeld schliessen' }));
    expect(v.spy.closed).toBe(1);
    expect(v.queryByRole('alert')).toBeNull();
    // Hinweis zur KW und zum Enddatum beim Startdatum.
    expect(feld).toHaveTextContent(
      `Bis 04.10.2026 · KW 40 · Daten und KW werden automatisch gebildet.`,
    );
  });

  it('[R-4.2-01] Bezeichnung und Kurzname werden übernommen; leer wird abgelehnt mit Beispiel, Esc stellt her und gibt den Fokus ans Raster', () => {
    const f = fixture();
    const v = renderPanel(f.plan, { kind: 'week' });
    v.type('Bezeichnung', 'FDT Woche 1');
    expect(week(v.spy.plan).label).toBe('FDT Woche 1');
    // Kurzname einer anderen Woche: abgelehnt mit Meldung, unverändert.
    v.type('Kurzname (für Dateinamen)', v.spy.plan.weeks[1]?.shortName ?? '');
    expect(v.alert()).toMatch(/^Den Kurznamen «.+» trägt schon eine andere Woche\./);
    expect(week(v.spy.plan).shortName).toBe('KVK');
    v.type('Kurzname (für Dateinamen)', 'VK');
    expect(week(v.spy.plan).shortName).toBe('VK');
    expect(v.alert()).toBe('');
    const name = v.type('Bezeichnung', '  ');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(v.errorOf(name)).toBe('Eine Bezeichnung eingeben, zum Beispiel «FDT Woche 1».');
    expect(week(v.spy.plan).label).toBe('FDT Woche 1');
    act(() => {
      fireEvent.keyDown(name, { key: 'Escape' });
    });
    expect(name).toHaveValue('FDT Woche 1');
    expect(name).toHaveAttribute('aria-invalid', 'false');
    expect(v.spy.toGrid).toBe(1);
    const kurz = v.type('Kurzname (für Dateinamen)', '');
    expect(v.errorOf(kurz)).toBe('Einen Kurznamen eingeben, zum Beispiel «Wo1».');
  });

  it('[R-4.2-02] Startdatum: ungültige Eingabe am Feld gemeldet; ein Montag verschiebt die Woche; ein anderer Tag wird mit Meldung abgelehnt', () => {
    const f = fixture();
    const v = renderPanel(f.plan, { kind: 'week' });
    const start = v.type('Startdatum (Montag)', '31.02.2026');
    expect(v.errorOf(start)).toBe(
      '«Startdatum»: «31.02.2026» ist kein Datum. Das Datum als dd.mm.yyyy eingeben, zum Beispiel 28.09.2026.',
    );
    v.type('Startdatum (Montag)', '');
    expect(v.errorOf(start)).toBe(
      '«Startdatum» ist leer. Ein Datum eingeben, zum Beispiel 28.09.2026.',
    );
    v.type('Startdatum (Montag)', '30.09.2026');
    expect(week(v.spy.plan).startDate).toBe(MO);
    expect(v.alert()).not.toBe('');
    v.type('Startdatum (Montag)', '2026-09-21');
    expect(week(v.spy.plan).startDate).toBe('2026-09-21');
    expect(v.alert()).toBe('');
  });

  it('[R-4.2-04] Wochenziele: Enter allein übernimmt nicht, Ctrl+Enter übernimmt; Erhöhte Bereitschaft', () => {
    const v = renderPanel(fixture().plan, { kind: 'week' });
    const ziele = v.getByLabelText('Wochenziele (eine Zeile je Ziel)');
    act(() => {
      fireEvent.change(ziele, { target: { value: 'Ziel A' } });
      fireEvent.keyDown(ziele, { key: 'Enter' });
    });
    expect(week(v.spy.plan).weekGoals).toEqual([]);
    act(() => {
      fireEvent.keyDown(ziele, { key: 'Enter', ctrlKey: true });
    });
    expect(week(v.spy.plan).weekGoals.map((g) => g.text)).toEqual(['Ziel A']);
    // Nochmals Ctrl+Enter ohne Änderung: kein weiterer Befehl.
    const runs = v.spy.runs;
    act(() => {
      fireEvent.keyDown(ziele, { key: 'Enter', ctrlKey: true });
    });
    expect(v.spy.runs).toBe(runs);
    v.type('Erhöhte Bereitschaft', 'Zug 1 ab 1800');
    expect(week(v.spy.plan).heightenedReadiness).toBe('Zug 1 ab 1800');
  });

  it('[FA2-04][R-4.2-04][R-4.2-06] mehrzeilige Felder lassen Zeilenumbrüche zu (Wochenziele, Erhöhte Bereitschaft, Notiz des Tages); die Glyphen-Prüfung gilt je Zeile', () => {
    // Behoben F-UX5 (Koordinator 26.10.2026): Zeilenumbrüche sind keine Zeichen der Druckschrift.
    const v = renderPanel(fixture().plan, { kind: 'week' });
    const ziele = v.getByLabelText('Wochenziele (eine Zeile je Ziel)');
    act(() => {
      fireEvent.change(ziele, { target: { value: 'Ziel A\nZiel B' } });
      fireEvent.keyDown(ziele, { key: 'Enter', ctrlKey: true });
    });
    expect(week(v.spy.plan).weekGoals.map((g) => g.text)).toEqual(['Ziel A', 'Ziel B']);
    expect(v.errorOf(ziele)).toBe('');
    const bereit = v.type('Erhöhte Bereitschaft', 'Zug 1\nZug 2');
    expect(week(v.spy.plan).heightenedReadiness).toBe('Zug 1\nZug 2');
    expect(v.errorOf(bereit)).toBe('');
    v.select({ kind: 'days', dates: [MO] });
    v.type('Interne Notiz des Tages', 'Zeile 1\nZeile 2');
    expect(week(v.spy.plan).days[0]?.internalNote).toBe('Zeile 1\nZeile 2');
    // Ein Zeichen ohne Glyphe in einer Zeile bleibt abgelehnt.
    const v2 = renderPanel(fixture().plan, { kind: 'week' });
    const b2 = v2.type('Erhöhte Bereitschaft', 'Zug 1\nZug \u{1F600}');
    expect(v2.errorOf(b2)).toMatch(/^Ein Zeichen kann im PDF nicht dargestellt werden/);
    expect(week(v2.spy.plan).heightenedReadiness).toBe('');
  });

  it('[R-4.8-11] Sonnenzeiten von Hand: Eingabe tolerant, leer = keine Angabe, ungültig am Feld gemeldet', () => {
    const v = renderPanel(fixture().plan, { kind: 'week' });
    v.type('Sonnenaufgang', '7:15');
    expect(week(v.spy.plan).sunOverride).toMatchObject({ sunrise: 435 });
    v.type('Sonnenuntergang', '1930');
    expect(week(v.spy.plan).sunOverride).toEqual({ sunrise: 435, sunset: 1170 });
    expect(v.getByLabelText('Sonnenaufgang')).toHaveValue('0715');
    const auf = v.type('Sonnenaufgang', '2510');
    expect(v.errorOf(auf)).toBe(
      '«Sonnenaufgang»: «2510» liegt nicht zwischen 0000 und 2400. Eine Zeit wie 0830 eingeben.',
    );
    const unter = v.type('Sonnenuntergang', 'abends');
    expect(v.errorOf(unter)).toBe(
      '«Sonnenuntergang»: «abends» ist keine Zeit. Die Zeit als 0900, 900 oder 9:00 eingeben.',
    );
    act(() => {
      fireEvent.keyDown(unter, { key: 'Escape' });
    });
    v.type('Sonnenuntergang', ' ');
    expect(week(v.spy.plan).sunOverride).toEqual({ sunrise: 435, sunset: null });
  });

  it('[R-4.2-07][R-4.2-08][R-4.2-09] Plan-Bemerkungen je Woche ausblendbar, neue Plan- und Wochenbemerkungen, Text ändern und entfernen', () => {
    const f = fixture();
    const v = renderPanel(f.plan, { kind: 'week' });
    const label = week(f.plan).label;
    const zeigen = v.getByRole('checkbox', { name: `In ${label} zeigen: Gilt durchgehend` });
    expect(zeigen).toBeChecked();
    fireEvent.click(zeigen);
    expect(week(v.spy.plan).hiddenRemarkIds).toEqual([f.ids.planBemerkung]);
    expect(
      v.getByRole('checkbox', { name: `In ${label} zeigen: Gilt durchgehend` }),
    ).not.toBeChecked();
    fireEvent.click(v.getByRole('checkbox', { name: `In ${label} zeigen: Gilt durchgehend` }));
    expect(week(v.spy.plan).hiddenRemarkIds).toEqual([]);
    fireEvent.click(v.getByRole('button', { name: 'Plan-Bemerkung hinzufügen' }));
    const planweit = Object.values(v.spy.plan.entries).filter(
      (e) => e.type === 'multiDayRemark' && e.scope.kind === 'plan',
    );
    expect(planweit.map((e) => e.type === 'multiDayRemark' && e.text)).toEqual([
      'Gilt durchgehend',
      'Bemerkung für den ganzen Plan',
    ]);
    fireEvent.click(v.getByRole('button', { name: 'Bemerkung für diese Woche ergänzen' }));
    const neu = Object.values(v.spy.plan.entries).find(
      (e) => e.type === 'multiDayRemark' && e.scope.kind === 'week',
    );
    expect(neu).toMatchObject({
      text: `Bemerkung für ${label}`,
      scope: { kind: 'week', weekId: week(f.plan).id },
    });
    const feld = v.type(`Bemerkung ${label}`, 'Wache doppelt');
    expect(entryOf(v.spy.plan, neu?.id as Id)).toMatchObject({ text: 'Wache doppelt' });
    v.type(`Bemerkung ${label}`, '');
    expect(v.errorOf(feld)).toBe('Die Bemerkung braucht einen Text.');
    fireEvent.click(v.getByRole('button', { name: 'Bemerkung «Wache doppelt» entfernen' }));
    expect(v.spy.plan.entries[neu?.id as Id]).toBeUndefined();
  });

  it('[R-4.3-04] ausgeblendete Tage: Abschnitt mit Knopf je Tag zum Einblenden; ohne ausgeblendeten Tag kein Abschnitt', () => {
    const f = fixture();
    const v = renderPanel(hideDay(hideDay(f.plan, 'Sa'), 'Mi'), { kind: 'week' });
    const abschnitt = v.getByRole('region', { name: 'Ausgeblendete Tage' });
    expect(
      within(abschnitt)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Mi 30.09.2026 einblenden', 'Sa 03.10.2026 einblenden']);
    fireEvent.click(within(abschnitt).getByRole('button', { name: 'Sa 03.10.2026 einblenden' }));
    expect(week(v.spy.plan).days[5]?.display).toBe('full');
    fireEvent.click(v.getByRole('button', { name: 'Mi 30.09.2026 einblenden' }));
    expect(v.queryByRole('region', { name: 'Ausgeblendete Tage' })).toBeNull();
  });

  it('[R-4.7-15] Kürzel dieser Woche: nur verwendete Kürzel; ohne Kürzel «keine»; ohne Plan-Bemerkung ein Hinweis', () => {
    const v = renderPanel(fixture().plan, { kind: 'week' });
    expect(v.getByRole('region', { name: 'Kürzel dieser Woche' })).toHaveTextContent(/KR$/);
    v.unmount();
    const leer = renderPanel(kpPlan(1), { kind: 'week' });
    expect(leer.getByRole('region', { name: 'Kürzel dieser Woche' })).toHaveTextContent(/keine$/);
    expect(leer.getByText('Keine Plan-Bemerkungen.')).toBeInTheDocument();
  });

  it('[R-5.1-12] gesperrt (z.B. schreibgeschützter Plan): alle Felder und Knöpfe des Seitenfelds sind deaktiviert', () => {
    const v = renderPanel(fixture().plan, { kind: 'week' }, { disabled: true });
    const body = v.container.querySelector('.wap-panel-body') as HTMLElement;
    const bedienbar = [...body.querySelectorAll('input, textarea, select, button')];
    expect(bedienbar.length).toBeGreaterThanOrEqual(10);
    expect(bedienbar.every((el) => (el as HTMLInputElement).disabled)).toBe(true);
  });

  it('[R-5.1-12] unbekannte Woche: leerer Kopf ohne Felder', () => {
    const f = fixture();
    const v = renderPanel(f.plan, { kind: 'week' }, { week: 7 });
    expect(v.container.querySelector('.wap-panel-body')?.childElementCount).toBe(0);
    expect(v.container.querySelector('.wap-panel-summary')).toHaveTextContent('');
  });
});

describe('F-ABDECKUNG2 Seitenfeld: Tag und Tage', () => {
  it('[R-4.3-01][R-4.3-02][R-6-07] ein Tag: Spaltensatz mit der Maus sofort, Darstellung als Segment, interne Notiz, neu nummerieren und ganztägige Bemerkung', () => {
    const f = fixture();
    const v = renderPanel(f.plan, { kind: 'days', dates: [MO] });
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('Tag');
    expect(v.container.querySelector('.wap-panel-summary')).toHaveTextContent('Mo 28.09.2026');
    const miFr = f.plan.columnSets[1];
    v.choose('Spaltensatz', miFr?.id ?? '');
    expect(week(v.spy.plan).days[0]?.columnSetId).toBe(miFr?.id);
    const darstellung = v.getByRole('radiogroup', { name: 'Darstellung' });
    fireEvent.click(within(darstellung).getByRole('radio', { name: 'kompakt' }));
    expect(week(v.spy.plan).days[0]?.display).toBe('compact');
    // Gewählter Wert erneut: kein Befehl.
    const runs = v.spy.runs;
    fireEvent.click(within(darstellung).getByRole('radio', { name: 'kompakt' }));
    expect(v.spy.runs).toBe(runs);
    v.type('Interne Notiz des Tages', 'Nur intern');
    expect(week(v.spy.plan).days[0]?.internalNote).toBe('Nur intern');
    expect(
      v.getByText('Erscheint nie im PDF und nie in weitergegebenen Dateien.'),
    ).toBeInTheDocument();
    fireEvent.click(v.getByRole('button', { name: 'Tag neu nummerieren …' }));
    expect(v.spy.renumbered).toEqual([MO]);
    fireEvent.click(v.getByRole('button', { name: 'Ganztägige Bemerkung hinzufügen' }));
    const bem = Object.values(v.spy.plan.entries).filter(
      (e) => e.type === 'dayRemark' && e.date === MO,
    );
    expect(bem.map((e) => e.type === 'dayRemark' && e.text)).toEqual([
      'Materialfassung',
      'Bemerkung',
    ]);
  });

  it('[R-4.3-01] mehrere Tage: «verschieden» bei ungleichem Spaltensatz und ungleicher Darstellung; die Wahl gilt für alle in einem Befehl', () => {
    const f = fixture();
    const v = renderPanel(f.plan, { kind: 'days', dates: ['2026-10-03', MO, MI] });
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('3 Tage');
    expect(v.container.querySelector('.wap-panel-summary')).toHaveTextContent(
      'Sa 03.10.2026, Mo 28.09.2026, Mi 30.09.2026',
    );
    const satz = v.getByLabelText('Spaltensatz') as HTMLSelectElement;
    expect(satz).toHaveValue('mixed');
    expect(satz.options[0]?.textContent).toBe('verschieden');
    expect(v.getByText(/^Gilt für Mo, Mi, Sa \(ein Undo-Schritt\)/)).toBeInTheDocument();
    expect(v.getByRole('radiogroup', { name: 'Darstellung (verschieden)' })).toBeInTheDocument();
    expect(v.queryByLabelText('Interne Notiz des Tages')).toBeNull();
    expect(v.queryByRole('button', { name: 'Tag neu nummerieren …' })).toBeNull();
    // «verschieden» selbst ist keine Wahl.
    v.choose('Spaltensatz', 'mixed');
    expect(v.spy.runs).toBe(0);
    const stufen = f.plan.columnSets[0]?.id ?? '';
    v.choose('Spaltensatz', stufen);
    expect(v.spy.runs).toBe(1);
    expect([0, 2, 5].map((i) => week(v.spy.plan).days[i]?.columnSetId)).toEqual([
      stufen,
      stufen,
      stufen,
    ]);
    fireEvent.click(v.getByRole('radio', { name: 'ausgeblendet' }));
    expect([0, 2, 5].map((i) => week(v.spy.plan).days[i]?.display)).toEqual([
      'hidden',
      'hidden',
      'hidden',
    ]);
  });

  it('[R-4.3-01] Tag ohne Spaltensatz: Auswahl zeigt «kein Spaltensatz», das ist keine Wahl; Tage ausserhalb der Woche zählen nicht', () => {
    const f = fixture();
    const w = week(f.plan);
    const ohne: Plan = {
      ...f.plan,
      weeks: [
        {
          ...w,
          days: w.days.map((d, i) =>
            i === 1 ? { ...d, columnSetId: null } : d,
          ) as unknown as Week['days'],
        },
        ...f.plan.weeks.slice(1),
      ],
    };
    const v = renderPanel(ohne, { kind: 'days', dates: [DI, '2026-10-12'] });
    const satz = v.getByLabelText('Spaltensatz') as HTMLSelectElement;
    expect(satz).toHaveValue('');
    expect(satz.options[0]?.textContent).toBe('kein Spaltensatz');
    v.choose('Spaltensatz', '');
    expect(v.spy.runs).toBe(0);
    // Nur Di gehört zur Woche: die Felder gelten für diesen einen Tag (Notiz und Neu-Nummerieren vorhanden).
    expect(v.getByLabelText('Interne Notiz des Tages')).toBeInTheDocument();
    fireEvent.click(v.getByRole('button', { name: 'Tag neu nummerieren …' }));
    expect(v.spy.renumbered).toEqual([DI]);
  });

  it('[R-11-07] Auswahlfeld mit der Tastatur: Pfeile ändern nur den Entwurf, Enter oder Verlassen übernimmt, Esc verwirft und geht ans Raster', () => {
    const f = fixture();
    const v = renderPanel(f.plan, { kind: 'days', dates: [MO] });
    const satz = v.getByLabelText('Spaltensatz');
    const miFr = f.plan.columnSets[1]?.id ?? '';
    const we = f.plan.columnSets[2]?.id ?? '';
    act(() => {
      fireEvent.keyDown(satz, { key: 'ArrowDown' });
      fireEvent.change(satz, { target: { value: miFr } });
    });
    expect(v.spy.runs).toBe(0);
    expect(satz).toHaveValue(miFr);
    act(() => {
      fireEvent.keyDown(satz, { key: 'Escape' });
    });
    expect(satz).toHaveValue(f.plan.columnSets[0]?.id);
    expect(v.spy.toGrid).toBe(1);
    act(() => {
      fireEvent.keyDown(satz, { key: 'ArrowDown' });
      fireEvent.change(satz, { target: { value: miFr } });
      fireEvent.keyDown(satz, { key: 'Enter' });
    });
    expect(week(v.spy.plan).days[0]?.columnSetId).toBe(miFr);
    act(() => {
      fireEvent.keyDown(satz, { key: 'ArrowDown' });
      fireEvent.change(satz, { target: { value: we } });
      fireEvent.blur(satz);
    });
    expect(week(v.spy.plan).days[0]?.columnSetId).toBe(we);
    // Verlassen ohne Entwurf: kein Befehl.
    const runs = v.spy.runs;
    act(() => {
      fireEvent.blur(satz);
    });
    expect(v.spy.runs).toBe(runs);
  });

  it('[R-11-07] Segment mit Pfeilen: Pfeil rechts/unten wählt den nächsten, links/oben den vorigen (ringsum), Esc geht ans Raster', () => {
    const v = renderPanel(fixture().plan, { kind: 'days', dates: [MO] });
    const gruppe = v.getByRole('radiogroup', { name: 'Darstellung' });
    const knopf = (n: string) => within(gruppe).getByRole('radio', { name: n });
    expect(knopf('voll')).toHaveAttribute('tabindex', '0');
    expect(knopf('kompakt')).toHaveAttribute('tabindex', '-1');
    act(() => {
      fireEvent.keyDown(knopf('voll'), { key: 'ArrowRight' });
    });
    expect(week(v.spy.plan).days[0]?.display).toBe('compact');
    expect(document.activeElement).toBe(knopf('kompakt'));
    act(() => {
      fireEvent.keyDown(knopf('kompakt'), { key: 'ArrowDown' });
    });
    expect(week(v.spy.plan).days[0]?.display).toBe('hidden');
    act(() => {
      fireEvent.keyDown(knopf('ausgeblendet'), { key: 'ArrowRight' });
    });
    expect(week(v.spy.plan).days[0]?.display).toBe('full');
    act(() => {
      fireEvent.keyDown(knopf('voll'), { key: 'ArrowLeft' });
    });
    expect(week(v.spy.plan).days[0]?.display).toBe('hidden');
    act(() => {
      fireEvent.keyDown(knopf('ausgeblendet'), { key: 'ArrowUp' });
    });
    expect(week(v.spy.plan).days[0]?.display).toBe('compact');
    const runs = v.spy.runs;
    act(() => {
      fireEvent.keyDown(knopf('kompakt'), { key: 'a' });
      fireEvent.keyDown(knopf('kompakt'), { key: 'Escape' });
    });
    expect(v.spy.runs).toBe(runs);
    expect(v.spy.toGrid).toBe(1);
  });
});

describe('F-ABDECKUNG2 Seitenfeld: Mehrfachauswahl', () => {
  it('[R-5.1-21] gemeinsame Felder: Kategorie und Status «verschieden», Wahl gilt für alle; Textrichtung nur für Blöcke; gemeinsam löschen', () => {
    const f = fixture();
    const ids = [f.ids.funk, f.ids.kr, f.ids.marker, f.ids.vorbereitung, f.ids.querbalken];
    const v = renderPanel(f.plan, entries(...ids));
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('5 Einträge gewählt');
    expect(v.container.querySelector('.wap-panel-summary')).toHaveTextContent('Gemeinsame Felder');
    const kat = v.getByLabelText('Kategorie') as HTMLSelectElement;
    const zfhr = f.plan.legend[2]?.id ?? '';
    expect(kat).toHaveValue('mixed');
    v.choose('Kategorie', 'mixed');
    expect(v.spy.runs).toBe(0);
    v.choose('Kategorie', zfhr);
    for (const id of [f.ids.funk, f.ids.kr, f.ids.vorbereitung, f.ids.querbalken])
      expect(entryOf(v.spy.plan, id)).toMatchObject({ categoryId: zfhr });
    expect(v.getByLabelText('Kategorie')).toHaveValue(zfhr);
    fireEvent.click(
      within(v.getByRole('radiogroup', { name: 'Status' })).getByRole('radio', { name: 'offen' }),
    );
    for (const id of ids) expect(entryOf(v.spy.plan, id).status).toBe('open');
    const richtung = v.getByRole('radiogroup', { name: 'Textrichtung (Blöcke)' });
    fireEvent.click(within(richtung).getByRole('radio', { name: 'senkrecht' }));
    expect(entryOf(v.spy.plan, f.ids.funk)).toMatchObject({ textDirection: 'vertical' });
    expect(entryOf(v.spy.plan, f.ids.vorbereitung)).toMatchObject({ textDirection: 'vertical' });
    fireEvent.click(v.getByRole('button', { name: '5 Einträge löschen' }));
    expect(v.spy.removed).toEqual([ids]);
  });

  it('[R-5.1-21] Auswahl ohne Kategorie-Einträge und ohne Blöcke: nur Status; verschiedene Status und Textrichtungen sind markiert', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.marker, f.ids.tagBemerkung, 'weg'));
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('2 Einträge gewählt');
    expect(v.queryByLabelText('Kategorie')).toBeNull();
    expect(v.queryByRole('radiogroup', { name: /Textrichtung/ })).toBeNull();
    v.select(entries(f.ids.funk, f.ids.vorbereitung));
    fireEvent.click(
      within(v.getByRole('radiogroup', { name: 'Textrichtung (Blöcke)' })).getByRole('radio', {
        name: 'waagrecht',
      }),
    );
    v.select(entries(f.ids.funk, f.ids.vorbereitung, f.ids.schiessen));
    expect(v.getByRole('radiogroup', { name: 'Textrichtung (verschieden)' })).toBeInTheDocument();
    v.select(entries(f.ids.funk, f.ids.kr));
    fireEvent.click(
      within(v.getByRole('radiogroup', { name: 'Status' })).getByRole('radio', {
        name: 'gestrichen',
      }),
    );
    v.select(entries(f.ids.funk, f.ids.kr, f.ids.visite));
    expect(v.getByRole('radiogroup', { name: 'Status (verschieden)' })).toBeInTheDocument();
    // Nur unbekannte IDs: Woche.
    v.select(entries('weg'));
    expect(v.container.querySelector('.wap-panel-type')).toHaveTextContent('Woche');
  });
});

describe('F-ABDECKUNG2 Seitenfeld: Fokus und Feldsprung', () => {
  it('[R-11-07] Fokusauftrag: genanntes Feld oder das erste bedienbare Feld erhält den Fokus und wird markiert', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    v.focusField('time');
    const zeit = v.getByLabelText('Zeit') as HTMLInputElement;
    expect(document.activeElement).toBe(zeit);
    expect([zeit.selectionStart, zeit.selectionEnd]).toEqual([0, zeit.value.length]);
    v.focusField(null);
    expect(document.activeElement).toBe(v.getByLabelText('Titel'));
    v.focusField('gibt-es-nicht');
    expect(document.activeElement).toBe(v.getByLabelText('Titel'));
    v.select({ kind: 'days', dates: [MO] });
    v.focusField('columnSet');
    expect(document.activeElement).toBe(v.getByLabelText('Spaltensatz'));
  });

  it('[R-11-07] Alt+Buchstabe springt zu Zeit, Tag, Spalten, Kategorie, Ltg, Ort; andere Tasten und Kombinationen tun nichts', () => {
    const f = fixture();
    const v = renderPanel(f.plan, entries(f.ids.funk));
    const feld = v.getByRole('complementary', { name: 'Seitenfeld' });
    const sprung = (k: string, mods: Partial<KeyboardEventInit> = {}) => {
      const ev = new KeyboardEvent('keydown', {
        key: k,
        altKey: true,
        bubbles: true,
        cancelable: true,
        ...mods,
      });
      act(() => {
        feld.dispatchEvent(ev);
      });
      return ev.defaultPrevented;
    };
    expect(sprung('z')).toBe(true);
    expect(document.activeElement).toBe(v.getByLabelText('Zeit'));
    expect(sprung('T')).toBe(true);
    expect(document.activeElement).toBe(v.getByLabelText('Tag'));
    expect(sprung('s')).toBe(true);
    expect(document.activeElement).toBe(v.getByLabelText('Spalten'));
    expect(sprung('k')).toBe(true);
    expect(document.activeElement).toBe(v.getByLabelText('Kategorie'));
    expect(sprung('l')).toBe(true);
    expect(document.activeElement).toBe(v.getByLabelText('Ltg'));
    expect(sprung('o')).toBe(true);
    expect(document.activeElement).toBe(v.getByLabelText('Ort'));
    expect(sprung('q')).toBe(false);
    expect(sprung('z', { ctrlKey: true })).toBe(false);
    expect(sprung('z', { shiftKey: true })).toBe(false);
    expect(sprung('z', { altKey: false })).toBe(false);
    expect(feld).toBeInTheDocument();
    // Marker haben keine Ltg: Alt+L tut nichts.
    v.select(entries(f.ids.marker));
    expect(sprung('l')).toBe(false);
  });
});
