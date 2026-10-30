// @vitest-environment jsdom
// F-ABDECKUNG2: Plan-Einstellungen (Beschrieb 4.1, 4.4, 4.6, 4.7; UI-Richtlinie 2.2, 10; R-4.1-02 bis R-4.1-13,
// R-4.4-01 bis R-4.4-05, R-4.4-09, R-4.6-14, R-4.7-01, R-4.7-08, R-4.7-14, R-5.7-03, R-11-07). Jede Änderung ist ein
// Befehl auf das Modell; abgelehnte Befehle erscheinen als Meldung mit Ursache und nächstem Schritt. Bilder und
// Personenlisten sind lokale, erfundene Dateien. Nur fiktive Daten.
import { act, fireEvent, render, within } from '@testing-library/react';
import { createElement, useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { PlanSettings } from '../../../../src/components/wap/settings/PlanSettings';
import { setDayColumnSet } from '../../../../src/model/wap/commands/days';
import { WapError } from '../../../../src/model/wap/errors';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { apply, CTX, fixture, installDialog, type Live, type Run } from './ui';

beforeAll(installDialog);

type Tab = 'plan' | 'commander' | 'legend' | 'functions' | 'persons' | 'sets' | 'codes' | 'markers';

interface Spy extends Live {
  closed: number;
  fail: unknown;
}

function renderSettings(
  initial: Plan,
  opts: { readonly tab?: Tab; readonly disabled?: boolean } = {},
) {
  const spy: Spy = { plan: initial, runs: 0, closed: 0, fail: null };
  function Harness() {
    const [plan, setPlan] = useState(initial);
    spy.plan = plan;
    return createElement(PlanSettings, {
      plan,
      disabled: opts.disabled ?? false,
      run: async (cmd: Run) => {
        if (spy.fail !== null) throw spy.fail;
        setPlan(apply(spy, cmd));
      },
      onClose: () => {
        spy.closed += 1;
      },
      ...(opts.tab === undefined ? {} : { initialTab: opts.tab }),
    });
  }
  const r = render(createElement(Harness));
  const flush = async () => {
    await act(async () => {
      await new Promise((res) => setTimeout(res, 0));
    });
  };
  const type = async (label: string, value: string) => {
    const el = r.getByLabelText(label);
    await act(async () => {
      fireEvent.change(el, { target: { value } });
      fireEvent.blur(el);
    });
    return el;
  };
  const choose = async (label: string, value: string) => {
    const el = r.getByLabelText(label);
    await act(async () => {
      fireEvent.pointerDown(el);
      fireEvent.change(el, { target: { value } });
    });
  };
  const click = async (name: string | RegExp) => {
    await act(async () => {
      fireEvent.click(r.getByRole('button', { name }));
    });
  };
  const check = async (name: string) => {
    await act(async () => {
      fireEvent.click(r.getByRole('checkbox', { name }));
    });
  };
  const tab = (name: string) => fireEvent.click(r.getByRole('tab', { name }));
  const alert = (): string => r.queryByRole('alert')?.textContent ?? '';
  const notice = (): string => r.queryByRole('status', { name: 'Ergebnis' })?.textContent ?? '';
  const upload = async (label: string, file: File | null) => {
    const el = r.getByLabelText(label) as HTMLInputElement;
    await act(async () => {
      Object.defineProperty(el, 'files', {
        configurable: true,
        value: file === null ? [] : [file],
      });
      fireEvent.change(el);
    });
    await flush();
  };
  return { ...r, spy, type, choose, click, check, tab, alert, notice, upload, flush };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('F-ABDECKUNG2 Plan-Einstellungen: Dialog und Bereiche', () => {
  it('[R-11-07] Dialog mit Bereichen als Registerkarten: Klick und Pfeile wechseln (ringsum), Schliessen und Esc beenden', () => {
    const v = renderSettings(fixture().plan);
    const dialog = v.getByRole('dialog', { name: 'Plan-Einstellungen' });
    expect(dialog).toHaveAttribute('open');
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Plan',
      'Kommandant und Bilder',
      'Legende',
      'Funktionsliste',
      'Personenliste',
      'Spaltensätze',
      'Kürzelliste',
      'Marker',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(v.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[0]?.id);
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: 'ArrowLeft' });
    expect(v.getByRole('tab', { name: 'Marker' })).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(v.getByRole('tab', { name: 'Marker' }));
    fireEvent.keyDown(v.getByRole('tab', { name: 'Marker' }), { key: 'ArrowRight' });
    expect(v.getByRole('tab', { name: 'Plan' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(v.getByRole('tab', { name: 'Plan' }), { key: 'Enter' });
    expect(v.getByRole('tab', { name: 'Plan' })).toHaveAttribute('aria-selected', 'true');
    v.tab('Legende');
    expect(v.getByRole('table', { name: 'Legende (Leitungskategorien)' })).toBeInTheDocument();
    fireEvent.click(v.getByRole('button', { name: 'Dialog schliessen' }));
    expect(v.spy.closed).toBe(1);
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(v.spy.closed).toBe(2);
  });

  it('[R-5.7-03] scheitert ein Befehl, erscheint seine Meldung bzw. eine allgemeine mit nächstem Schritt; die nächste Änderung entfernt sie', async () => {
    const v = renderSettings(fixture().plan);
    v.spy.fail = new WapError('voll', {
      cause: 'Der Speicher ist voll.',
      nextStep: 'Platz schaffen.',
    });
    await v.type('Einheit', 'Inf Kp 1');
    expect(v.alert()).toBe('Der Speicher ist voll. Platz schaffen.');
    v.spy.fail = new Error('intern');
    await v.type('Motto', 'Vorwärts');
    expect(v.alert()).toBe(
      'Die Änderung konnte nicht übernommen werden. Eingaben prüfen und erneut versuchen.',
    );
    v.spy.fail = null;
    await v.type('Motto', 'Immer bereit');
    expect(v.alert()).toBe('');
    expect(v.spy.plan.motto).toBe('Immer bereit');
  });
});

describe('F-ABDECKUNG2 Plan-Einstellungen: Plan, Kommandant und Bilder', () => {
  it('[R-4.1-02][R-4.1-03][R-4.1-04][R-4.1-05][R-4.1-13] Plan: Einheit, übergeordnete Einheit, Dienst, Übungsname, Beilage, Klassifizierung, Standort, Motto', async () => {
    const v = renderSettings(fixture().plan);
    const werte: readonly (readonly [string, keyof Plan, string])[] = [
      ['Einheit', 'unit', 'Inf Ustü Kp 99/4'],
      ['Übergeordnete Einheit', 'parentUnit', 'Inf Bat 99'],
      ['Dienst', 'service', 'FDT 2026'],
      ['Übungsname', 'exerciseName', 'Übung Beispiel 2'],
      ['Beilage', 'beilage', 'Beilage 01-02'],
      ['Klassifizierung', 'classification', 'INTERN'],
      ['Standort (Sonnenzeiten)', 'sunLocation', 'Thun'],
      ['Motto', 'motto', 'Bereit'],
    ];
    for (const [label, key, wert] of werte) {
      await v.type(label, wert);
      expect(v.spy.plan[key]).toBe(wert);
    }
    expect(v.getByText('Vorlage: Kp (fest für diesen Plan).')).toBeInTheDocument();
    expect(v.getByText('Leer = keine Klassifizierung (Vorgabe).')).toBeInTheDocument();
  });

  it('[R-4.1-13] Wappen aus einer lokalen PNG-Datei mit Vorschau, entfernen; anderes Format wird mit Meldung abgelehnt', async () => {
    const v = renderSettings(fixture().plan);
    await v.upload(
      'Wappen (PNG oder JPEG von diesem Gerät)',
      new File([PNG], 'wappen.png', { type: 'image/png' }),
    );
    expect(v.spy.plan.coatOfArms).toEqual({
      mime: 'image/png',
      dataBase64: btoa(String.fromCharCode(...PNG)),
    });
    expect(v.getByRole('img', { name: 'Wappen, Vorschau' })).toHaveAttribute(
      'src',
      `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`,
    );
    await v.click('Wappen entfernen');
    expect(v.spy.plan.coatOfArms).toBeNull();
    expect(v.queryByRole('img', { name: 'Wappen, Vorschau' })).toBeNull();
    await v.upload(
      'Wappen (PNG oder JPEG von diesem Gerät)',
      new File(['GIF89a'], 'wappen.gif', { type: 'image/gif' }),
    );
    expect(v.alert()).toBe(
      '«wappen.gif» ist kein PNG- oder JPEG-Bild. Ein Bild als PNG oder JPEG wählen.',
    );
    expect(v.spy.plan.coatOfArms).toBeNull();
    const runs = v.spy.runs;
    await v.upload('Wappen (PNG oder JPEG von diesem Gerät)', null);
    expect(v.spy.runs).toBe(runs);
  });

  it('[R-4.1-06][R-4.1-07][R-4.1-08] Kommandant mit Grad, Name, Vorname, Funktion und Reihenfolge; Unterschrift als JPEG, erst dann einschaltbar', async () => {
    const v = renderSettings(fixture().plan, { tab: 'commander' });
    await v.type('Grad', 'Hptm');
    await v.type('Name', 'Muster');
    await v.type('Vorname', 'Anna');
    await v.type('Funktion', 'Kp Kdt');
    await v.choose('Reihenfolge im Unterschriftblock', 'gradNameVorname');
    expect(v.spy.plan.commander).toMatchObject({
      grad: 'Hptm',
      name: 'Muster',
      vorname: 'Anna',
      funktion: 'Kp Kdt',
      nameOrder: 'gradNameVorname',
    });
    const schalter = v.getByRole('checkbox', {
      name: 'Unterschrift als Bild im PDF zeigen (Vorgabe: aus)',
    });
    expect(schalter).toBeDisabled();
    await v.upload(
      'Unterschrift (PNG oder JPEG von diesem Gerät)',
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'u.jpg', { type: 'image/jpeg' }),
    );
    expect(v.spy.plan.signatureImage).toEqual({ mime: 'image/jpeg', dataBase64: '/9j/' });
    expect(schalter).toBeEnabled();
    await v.check('Unterschrift als Bild im PDF zeigen (Vorgabe: aus)');
    expect(v.spy.plan.signatureEnabled).toBe(true);
  });
});

describe('F-ABDECKUNG2 Plan-Einstellungen: Legende und Funktionsliste', () => {
  it('[R-4.7-01] Legende: Farbe, Name, Beschriftung, neutral, in der Legende, Reihenfolge; neue Kategorie mit freiem Namen', async () => {
    const f = fixture();
    const v = renderSettings(f.plan, { tab: 'legend' });
    const kp = () => v.spy.plan.legend.find((c) => c.id === f.plan.legend[1]?.id);
    await act(async () => {
      fireEvent.change(v.getByLabelText('Farbe Ltg Kp'), { target: { value: '#ffee00' } });
    });
    expect(kp()?.color).toEqual({ r: 255, g: 238, b: 0 });
    expect(v.getByLabelText('Farbe Ltg Kp')).toHaveValue('#ffee00');
    await v.type('Beschriftung Ltg Kp', 'Leitung Kompanie');
    await v.type('Name Ltg Kp', 'Ltg Kompanie');
    expect(kp()).toMatchObject({ name: 'Ltg Kompanie', legendLabel: 'Leitung Kompanie' });
    await v.check('Ltg Kompanie neutral');
    await v.check('Ltg Kompanie in der Legende');
    expect(kp()).toMatchObject({ neutral: true, inLegend: false });
    expect(v.getByRole('button', { name: 'Ltg Bat nach oben' })).toBeDisabled();
    expect(v.getByRole('button', { name: 'neutral nach unten' })).toBeDisabled();
    await v.click('Ltg Kompanie nach oben');
    expect(v.spy.plan.legend.map((c) => c.name).slice(0, 2)).toEqual(['Ltg Kompanie', 'Ltg Bat']);
    await v.click('Ltg Kompanie nach unten');
    expect(v.spy.plan.legend.map((c) => c.name).slice(0, 2)).toEqual(['Ltg Bat', 'Ltg Kompanie']);
    await v.click('Neue Kategorie');
    await v.click('Neue Kategorie');
    expect(v.spy.plan.legend.slice(-2).map((c) => c.name)).toEqual(['Kategorie 7', 'Kategorie 8']);
    expect(v.spy.plan.legend.at(-1)).toMatchObject({
      color: { r: 220, g: 220, b: 220 },
      neutral: false,
      inLegend: true,
    });
  });

  it('[R-4.7-01] Kategorie löschen: unbenutzt sofort; benutzt nur mit Ersatzkategorie (Rückfrage mit Anzahl, Abbrechen möglich)', async () => {
    const f = fixture();
    const v = renderSettings(f.plan, { tab: 'legend' });
    await v.click('Kategorie Extern löschen');
    expect(v.spy.plan.legend.some((c) => c.name === 'Extern')).toBe(false);
    expect(v.queryByRole('group', { name: 'Kategorie mit Ersatz löschen' })).toBeNull();
    await v.click('Kategorie Ltg Kp löschen');
    const frage = v.getByRole('group', { name: 'Kategorie mit Ersatz löschen' });
    expect(frage).toHaveTextContent(
      /^«Ltg Kp» wird \d+-mal verwendet\. Eine Ersatzkategorie für alle betroffenen Einträge wählen\./,
    );
    await act(async () => {
      fireEvent.click(within(frage).getByRole('button', { name: 'Abbrechen' }));
    });
    expect(v.queryByRole('group', { name: 'Kategorie mit Ersatz löschen' })).toBeNull();
    await v.click('Kategorie Ltg Kp löschen');
    expect(v.getByLabelText('Ersatzkategorie')).toHaveValue(f.plan.legend[0]?.id);
    const zfhr = f.plan.legend[2]?.id as Id;
    await v.choose('Ersatzkategorie', zfhr);
    await v.click('Löschen und ersetzen');
    expect(v.spy.plan.legend.some((c) => c.name === 'Ltg Kp')).toBe(false);
    expect(v.spy.plan.entries[f.ids.funk]).toMatchObject({ categoryId: zfhr });
    expect(v.notice()).toBe('Kategorie gelöscht, Einträge umgeteilt.');
  });

  it('[R-4.7-08] Funktionsliste: Kürzel, Kategorie (auch keine), Einzelfunktion, entfernen und hinzufügen', async () => {
    const f = fixture();
    const v = renderSettings(f.plan, { tab: 'functions' });
    const list = () => v.spy.plan.functionList;
    await v.type('Kürzel Zfhr', 'Zfhr 1');
    expect(list()[0]?.code).toBe('Zfhr 1');
    await v.choose('Kategorie Zfhr 1', '');
    expect(list()[0]?.categoryId).toBeNull();
    const bat = f.plan.legend[0]?.id as Id;
    await v.choose('Kategorie S2', bat);
    expect(list()[1]?.categoryId).toBe(bat);
    await v.check('S2 Einzelfunktion');
    expect(list()[1]?.singleFunction).toBe(true);
    await v.click('Funktion Four entfernen');
    expect(list().some((x) => x.code === 'Four')).toBe(false);
    const n = list().length;
    await v.click('Funktion hinzufügen');
    expect(list().at(-1)).toEqual({
      code: `Funktion ${String(n + 1)}`,
      categoryId: null,
      singleFunction: false,
    });
  });
});

describe('F-ABDECKUNG2 Plan-Einstellungen: Personenliste', () => {
  const datei = (text: string, name = 'liste.csv') => new File([text], name, { type: 'text/csv' });

  it('[R-4.1-11] aus Datei ergänzen: Zusammenfassung nennt gelesene Personen, übersprungene Zeilen und nicht übernommene Spalten', async () => {
    const v = renderSettings(fixture().plan, { tab: 'persons' });
    await v.upload(
      'Personenliste aus Datei einlesen',
      datei(
        'Grad;Name;Vorname;Funktion;Telefon\nHptm;Muster;Anna;Kp Kdt;PRUEFWERT\nLt;;Ohne;Zfhr;x\nWm;Probe;Beat;Four;y\n',
      ),
    );
    expect(v.notice()).toBe(
      '«liste.csv»: 2 Personen gelesen, 1 Zeile ohne Name übersprungen; 1 weitere Spalte nicht übernommen.',
    );
    expect(v.spy.plan.persons.map((p) => p.name)).toEqual(['Muster', 'Probe']);
    expect(JSON.stringify(v.spy.plan).includes('PRUEFWERT')).toBe(false);
    expect(v.getByRole('region', { name: 'Personen (2)' })).toBeInTheDocument();
    await v.upload(
      'Personenliste aus Datei einlesen',
      datei(
        'Grad;Name;Vorname;Funktion;Telefon;Adresse\nOblt;Neu;Carla;Zfhr;a;b\n;;;;;\n;;Ohne;;;\n',
        'zwei.csv',
      ),
    );
    expect(v.notice()).toBe(
      '«zwei.csv»: 1 Person gelesen, 2 Zeilen ohne Name übersprungen; 2 weitere Spalten nicht übernommen.',
    );
    expect(v.spy.plan.persons.map((p) => p.name)).toEqual(['Muster', 'Probe', 'Neu']);
  });

  it('[R-4.1-11] aus Datei ersetzen; fehlerhafte Datei: Meldung mit Ursache und nächstem Schritt, Liste unverändert', async () => {
    const v = renderSettings(fixture().plan, { tab: 'persons' });
    await v.upload(
      'Personenliste aus Datei einlesen',
      datei('Grad;Name;Vorname;Funktion\nHptm;Muster;Anna;Kp Kdt\n'),
    );
    await v.choose('Beim Einlesen', 'replace');
    await v.upload(
      'Personenliste aus Datei einlesen',
      datei('Grad;Name;Vorname;Funktion\nWm;Probe;Beat;Four\n'),
    );
    expect(v.notice()).toBe('«liste.csv»: 1 Person gelesen; 0 weitere Spalten nicht übernommen.');
    expect(v.spy.plan.persons.map((p) => p.name)).toEqual(['Probe']);
    await v.upload('Personenliste aus Datei einlesen', datei('Name;Telefon\nx;y\n', 'kaputt.csv'));
    expect(v.alert()).toBe(
      'In «kaputt.csv» fehlt in der ersten Zeile die Spalten «Grad», «Vorname», «Funktion». Eine Kopfzeile mit Grad, Name, Vorname und Funktion ergänzen und die Datei erneut wählen. Weitere Spalten werden nicht übernommen.',
    );
    expect(v.notice()).toBe('');
    expect(v.spy.plan.persons.map((p) => p.name)).toEqual(['Probe']);
    await v.choose('Beim Einlesen', 'add');
    const runs = v.spy.runs;
    await v.upload('Personenliste aus Datei einlesen', null);
    expect(v.spy.runs).toBe(runs);
  });

  it('[R-4.1-09][R-4.1-11] Personen von Hand: erfassen (Name Pflicht), Felder ändern, entfernen', async () => {
    const v = renderSettings(fixture().plan, { tab: 'persons' });
    const neu = (label: string, value: string) =>
      fireEvent.change(v.getByLabelText(`${label} (neu)`), { target: { value } });
    neu('Grad', 'Hptm');
    await v.click('Person hinzufügen');
    expect(v.alert()).toBe(
      'Die neue Person hat keinen Namen. Den Namen eingeben und erneut hinzufügen.',
    );
    neu('Name', 'Muster');
    neu('Vorname', 'Anna');
    neu('Funktion', 'Kp Kdt');
    await v.click('Person hinzufügen');
    expect(v.spy.plan.persons).toMatchObject([
      { grad: 'Hptm', name: 'Muster', vorname: 'Anna', funktion: 'Kp Kdt' },
    ]);
    expect(v.getByLabelText('Name (neu)')).toHaveValue('');
    neu('Name', 'Probe');
    await v.click('Person hinzufügen');
    await v.type('Funktion Person 2', 'Four');
    expect(v.spy.plan.persons[1]).toMatchObject({ name: 'Probe', funktion: 'Four' });
    const name = await v.type('Name Person 1', ' ');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(v.getByText('Der Name ist Pflicht.')).toBeInTheDocument();
    await v.click('Person 1 entfernen');
    expect(v.spy.plan.persons.map((p) => p.name)).toEqual(['Probe']);
  });
});

describe('F-ABDECKUNG2 Plan-Einstellungen: Spaltensätze', () => {
  it('[R-4.4-01][R-4.4-02][R-4.4-03] Spalten: Name, Breite, Beschriftung, Standard-Kategorie, Reihenfolge, entfernen; Rap und Beso fest', async () => {
    const f = fixture();
    const v = renderSettings(f.plan, { tab: 'sets' });
    const set = () => v.spy.plan.columnSets[0];
    const col = (name: string) => set()?.columns.find((c) => c.name === name);
    expect(v.getByText(/^An 4 Tagen zugewiesen\./)).toBeInTheDocument();
    const tabelle = v.getByRole('table', { name: 'Spalten von «KVK Stufen»' });
    expect(
      within(tabelle)
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.querySelectorAll('td')[1]?.textContent),
    ).toEqual([
      'Planungsspalte',
      'Planungsspalte',
      'Planungsspalte',
      'Planungsspalte',
      'Planungsspalte',
      'Planungsspalte',
      'Rap-Spalte',
      'Beso-Spalte',
    ]);
    expect(v.getByLabelText('Breite Rap')).toBeDisabled();
    expect(v.getByRole('button', { name: 'Spalte Beso entfernen' })).toBeDisabled();
    expect(v.getByRole('button', { name: 'Spalte Kp Kdt nach links' })).toBeDisabled();
    expect(v.getByRole('button', { name: 'Spalte Trp nach rechts' })).toBeDisabled();
    await v.type('Spaltenname Stv', 'Kdt Stv');
    await v.choose('Breite Kdt Stv', 'wide');
    await v.choose('Beschriftung Kdt Stv', 'vertical');
    const zfhr = f.plan.legend[2]?.id as Id;
    await v.choose('Standard-Kategorie Kdt Stv', zfhr);
    expect(col('Kdt Stv')).toMatchObject({
      weight: 'wide',
      labelOrientation: 'vertical',
      defaultCategoryId: zfhr,
    });
    await v.choose('Standard-Kategorie Kdt Stv', '');
    expect(col('Kdt Stv')?.defaultCategoryId).toBeNull();
    await v.click('Spalte Kdt Stv nach links');
    expect(
      set()
        ?.columns.map((c) => c.name)
        .slice(0, 2),
    ).toEqual(['Kdt Stv', 'Kp Kdt']);
    await v.click('Spalte Kdt Stv nach rechts');
    expect(
      set()
        ?.columns.map((c) => c.name)
        .slice(0, 2),
    ).toEqual(['Kp Kdt', 'Kdt Stv']);
    await v.click('Spalte Trp entfernen');
    expect(col('Trp')).toBeUndefined();
  });

  it('[R-4.4-05][R-4.9-13] Planungsspalte und Nebenspalte «Det» hinzufügen; danach keine zweite Nebenspalte', async () => {
    const v = renderSettings(fixture().plan, { tab: 'sets' });
    const set = () => v.spy.plan.columnSets[0];
    await v.click('Planungsspalte hinzufügen');
    expect(set()?.columns[6]).toMatchObject({ name: 'Spalte 7', kind: 'planning' });
    await v.click('Nebenspalte hinzufügen');
    expect(set()?.columns[7]).toMatchObject({ name: 'Det', kind: 'secondary', weight: 'narrow' });
    expect(v.queryByRole('button', { name: 'Nebenspalte hinzufügen' })).toBeNull();
    expect(v.getByLabelText('Breite Det')).toBeEnabled();
  });

  it('[R-4.4-09] Spaltensätze: wählen, neu anlegen, kopieren (freier Name), umbenennen, löschen; zugewiesene Sätze werden mit Meldung abgelehnt', async () => {
    const f = fixture();
    const v = renderSettings(f.plan, { tab: 'sets' });
    const names = () => v.spy.plan.columnSets.map((s) => s.name);
    await v.click('Neuer Spaltensatz');
    expect(names()).toEqual(['KVK Stufen', 'KVK Mi–Fr', 'Wochenende kompakt', 'Spaltensatz 4']);
    await v.click('Kopie anlegen');
    await v.click('Kopie anlegen');
    expect(names().slice(4)).toEqual(['KVK Stufen (Kopie)', 'KVK Stufen (Kopie 2)']);
    const neu = v.spy.plan.columnSets[3]?.id as Id;
    await v.choose('Spaltensatz', neu);
    expect(v.getByText(/^An 0 Tagen zugewiesen\./)).toBeInTheDocument();
    await v.type('Name des Spaltensatzes', 'Zug Spalten');
    expect(names()[3]).toBe('Zug Spalten');
    await v.click('Spaltensatz löschen');
    expect(names()).not.toContain('Zug Spalten');
    expect(v.getByRole('table', { name: 'Spalten von «KVK Stufen»' })).toBeInTheDocument();
    // Der Satz «KVK Stufen» ist zugewiesen und Einträge verweisen auf seine Spalten: Rückfrage, dann Meldung.
    await v.click('Spaltensatz löschen');
    const frage = v.getByRole('dialog', { name: 'Spaltensatz «KVK Stufen» löschen' });
    expect(frage).toHaveTextContent(
      /\d+ Einträge verweisen auf Spalten dieses Satzes und verlieren ihre Lage/,
    );
    await v.flush();
    expect(document.activeElement).toBe(within(frage).getByRole('button', { name: 'Behalten' }));
    await act(async () => {
      fireEvent.click(within(frage).getByRole('button', { name: 'Behalten' }));
    });
    expect(v.queryByRole('dialog', { name: 'Spaltensatz «KVK Stufen» löschen' })).toBeNull();
    await v.click('Spaltensatz löschen');
    await act(async () => {
      fireEvent.click(v.getByRole('button', { name: 'Trotzdem löschen' }));
    });
    expect(v.alert()).toBe(
      '«KVK Stufen» ist an 4 Tagen zugewiesen. Diesen Tagen zuerst einen anderen Spaltensatz zuweisen.',
    );
    expect(names()).toContain('KVK Stufen');
  });

  it('[R-4.4-09] Satz ohne Tage, aber mit Verweisen: nach Rückfrage gelöscht; ein Verweis heisst «Eintrag verweist»', async () => {
    const f = fixture();
    let plan = f.plan;
    const [stufen, mifr] = plan.columnSets;
    for (const w of plan.weeks)
      plan = setDayColumnSet(plan, w.id, ['Mo', 'Di'], mifr?.id as Id, CTX).plan;
    // Nur ein Eintrag verweist noch auf eine Spalte von «KVK Stufen».
    const behalten = new Set([f.ids.vorbereitung]);
    plan = {
      ...plan,
      entries: Object.fromEntries(
        Object.entries(plan.entries).filter(
          ([id, e]) => behalten.has(id) || !(e.type === 'block' && e.columns.kind === 'ids'),
        ),
      ),
    };
    const v = renderSettings(plan, { tab: 'sets' });
    await v.click('Spaltensatz löschen');
    expect(
      v.getByRole('dialog', { name: `Spaltensatz «${stufen?.name}» löschen` }),
    ).toHaveTextContent(/^.*1 Eintrag verweist auf Spalten dieses Satzes und verliert seine Lage/);
    await act(async () => {
      fireEvent.click(v.getByRole('button', { name: 'Trotzdem löschen' }));
    });
    expect(v.spy.plan.columnSets.map((s) => s.name)).toEqual(['KVK Mi–Fr', 'Wochenende kompakt']);
    expect(v.alert()).toBe('');
  });
});

describe('F-ABDECKUNG2 Plan-Einstellungen: Kürzel und Marker', () => {
  it('[R-4.7-14] Rapportkürzel: Kürzel, Kategorie, Bedeutung, entfernen; weitere Kürzel aufnehmen (leer nicht), Bedeutung, entfernen', async () => {
    const f = fixture();
    const v = renderSettings(f.plan, { tab: 'codes' });
    await v.type('Rapportkürzel KR', 'KR1');
    expect(v.spy.plan.rapportCodes[0]?.code).toBe('KR1');
    const bat = f.plan.legend[0]?.id as Id;
    await v.choose('Kategorie KR1', bat);
    expect(v.spy.plan.rapportCodes[0]?.categoryId).toBe(bat);
    const bedeutung = within(v.getByRole('table', { name: 'Rapportkürzel' })).getByLabelText(
      'Bedeutung KR1',
    );
    await act(async () => {
      fireEvent.change(bedeutung, { target: { value: 'Kaderrapport' } });
      fireEvent.blur(bedeutung);
    });
    expect(v.spy.plan.abbreviationMeanings?.KR1).toBe('Kaderrapport');
    await v.click('Rapportkürzel ARK entfernen');
    expect(v.spy.plan.rapportCodes.some((r) => r.code === 'ARK')).toBe(false);
    const runs = v.spy.runs;
    await v.click('Kürzel aufnehmen');
    expect(v.spy.runs).toBe(runs);
    fireEvent.change(v.getByLabelText('Neues Kürzel'), { target: { value: ' WK ' } });
    await v.click('Kürzel aufnehmen');
    expect(v.spy.plan.abbreviationsSelected).toContain('WK');
    expect(v.getByLabelText('Neues Kürzel')).toHaveValue('');
    const weitere = v.getByRole('table', { name: 'Weitere Kürzel' });
    const wk = within(weitere).getByLabelText('Bedeutung WK');
    await act(async () => {
      fireEvent.change(wk, { target: { value: 'Wiederholungskurs' } });
      fireEvent.blur(wk);
    });
    expect(v.spy.plan.abbreviationMeanings?.WK).toBe('Wiederholungskurs');
    expect(v.spy.plan.abbreviationMeanings?.KR1).toBe('Kaderrapport');
    await v.click('Kürzel WK entfernen');
    expect(v.spy.plan.abbreviationsSelected).not.toContain('WK');
  });

  it('[R-4.6-14] Marker: Beschriftung mit oder ohne Zeit je Art (Vorgabe nur ABV)', async () => {
    const v = renderSettings(fixture().plan, { tab: 'markers' });
    const boxen = v.getAllByRole('checkbox');
    expect(boxen.map((b) => (b as HTMLInputElement).checked)).toEqual([false, true, false, false]);
    expect(
      v.getByRole('checkbox', { name: 'frei mit Zeit (z.B. «Appell 2330»)' }),
    ).not.toBeChecked();
    await v.check('AV mit Zeit (z.B. «AV 2330»)');
    await v.check('ABV mit Zeit (z.B. «ABV 2330»)');
    await v.check('frei mit Zeit (z.B. «Appell 2330»)');
    const label = (k: string) => v.spy.plan.markerLabels.find((l) => l.kind === k)?.withTime;
    expect([label('AV'), label('ABV'), label('HV'), label('custom')]).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });

  it('[R-5.1-12] gesperrt: Felder und Knöpfe der Bereiche sind deaktiviert (Registerkarten und Schliessen bleiben bedienbar)', () => {
    const v = renderSettings(fixture().plan, { tab: 'legend', disabled: true });
    const panel = v.getByRole('tabpanel');
    const bedienbar = [...panel.querySelectorAll('input, select, textarea, button')];
    expect(bedienbar.length).toBeGreaterThan(20);
    expect(bedienbar.every((el) => (el as HTMLInputElement).disabled)).toBe(true);
    expect(v.getByRole('button', { name: 'Dialog schliessen' })).toBeEnabled();
    v.tab('Spaltensätze');
    expect(v.getByRole('button', { name: 'Neuer Spaltensatz' })).toBeDisabled();
    expect(v.getByLabelText('Spaltensatz')).toBeEnabled();
  });
});
