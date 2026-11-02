// @vitest-environment jsdom
// Kp-Vorlage als Daten (Vertrag E1-02a Abschnitt 2, 8 P-8; Beschrieb 4.7, 4.9, 5.4).
import { describe, expect, it } from 'vitest';
import {
  builtInTemplates,
  kpTemplate,
  type LevelTemplate,
  templateById,
} from '../../../../src/model/wap/template';
import { expectModelError } from '../../support/model/builders';

describe('Kp-Vorlage', () => {
  it('[R-4.1-01] (Vertrag §2/P-8 Kp-Legende; PDF-Abnahme in E1-02e) Kp-Vorlage: fünf Kategorien in Reihenfolge mit Namen, Legendenbeschriftung und Farben', () => {
    const legend = kpTemplate().legend.filter((c) => !c.neutral);
    expect(legend).toEqual([
      {
        name: 'Ltg Bat',
        legendLabel: 'Leitung Bat',
        color: { r: 204, g: 236, b: 255 },
        neutral: false,
        inLegend: true,
      },
      {
        name: 'Ltg Kp',
        legendLabel: 'Leitung Kp',
        color: { r: 255, g: 255, b: 153 },
        neutral: false,
        inLegend: true,
      },
      {
        name: 'Ltg Zfhr',
        legendLabel: 'Leitung Zfhr',
        color: { r: 253, g: 234, b: 218 },
        neutral: false,
        inLegend: true,
      },
      {
        name: 'Extern',
        legendLabel: 'Extern',
        color: { r: 191, g: 191, b: 191 },
        neutral: false,
        inLegend: true,
      },
      {
        name: 'Ltg S2',
        legendLabel: 'Ltg S2',
        color: { r: 255, g: 204, b: 153 },
        neutral: false,
        inLegend: true,
      },
    ]);
  });

  it('[R-4.7-07] neutrale Kategorie als sechste: weiss, neutral, nicht in der Legende', () => {
    const legend = kpTemplate().legend;
    expect(legend).toHaveLength(6);
    expect(legend[5]).toEqual({
      name: 'neutral',
      legendLabel: 'neutral',
      color: { r: 255, g: 255, b: 255 },
      neutral: true,
      inLegend: false,
    });
  });

  it('[R-4.7-09] Funktionsliste: genau diese Zuordnungen und Einzelfunktions-Kennzeichen', () => {
    const list = [...kpTemplate().functionList].sort((a, b) => a.code.localeCompare(b.code));
    expect(list).toEqual(
      [
        { code: 'Zfhr', categoryName: 'Ltg Zfhr', singleFunction: false },
        { code: 'S2', categoryName: 'Ltg S2', singleFunction: false },
        { code: 'Bat Kdt', categoryName: 'Ltg Bat', singleFunction: false },
        { code: 'S3', categoryName: 'Ltg Bat', singleFunction: false },
        { code: 'S4', categoryName: 'Ltg Bat', singleFunction: false },
        { code: 'Kp Kdt', categoryName: 'Ltg Kp', singleFunction: true },
        { code: 'Kdt Stv', categoryName: 'Ltg Kp', singleFunction: true },
        { code: 'Einh Fw', categoryName: 'Ltg Kp', singleFunction: true },
        { code: 'Four', categoryName: 'Ltg Kp', singleFunction: true },
      ].sort((a, b) => a.code.localeCompare(b.code)),
    );
  });

  it('[R-4.7-08] jede Funktion der Vorlage verweist auf eine Kategorie der Vorlagen-Legende', () => {
    const t = kpTemplate();
    const names = new Set(t.legend.map((c) => c.name));
    expect(t.functionList.length).toBeGreaterThan(0);
    for (const f of t.functionList) {
      expect(f.categoryName === null || names.has(f.categoryName)).toBe(true);
    }
  });

  it('[R-4.9-18][R-4.7-20] (F-09) Rapportkürzel KR, DR, AR1, AR2, ARK → Ltg Kp, BR 0–3 → Ltg Bat in dieser Reihenfolge, mit Bedeutung für alle (DR, AR1, AR2; KR, ARK, BR 0–3 nach Gate B 28.10.2026 Nr 39, KR 29.10.2026)', () => {
    expect(kpTemplate().rapportCodes).toEqual([
      { code: 'KR', categoryName: 'Ltg Kp', meaning: 'Kompanierapport' },
      { code: 'DR', categoryName: 'Ltg Kp', meaning: 'Dienstrapport' },
      { code: 'AR1', categoryName: 'Ltg Kp', meaning: 'Arbeitsrapport 1' },
      { code: 'AR2', categoryName: 'Ltg Kp', meaning: 'Arbeitsrapport 2' },
      { code: 'ARK', categoryName: 'Ltg Kp', meaning: 'Ausbildungsrapport Kompanie' },
      { code: 'BR 0', categoryName: 'Ltg Bat', meaning: 'Bataillonsrapport KVK' },
      { code: 'BR 1', categoryName: 'Ltg Bat', meaning: 'Bataillonsrapport Wo 1' },
      { code: 'BR 2', categoryName: 'Ltg Bat', meaning: 'Bataillonsrapport Wo 2' },
      { code: 'BR 3', categoryName: 'Ltg Bat', meaning: 'Bataillonsrapport Wo 3' },
    ]);
  });

  it('[R-4.9-19] (F-53) genau drei Spaltensätze mit diesen Planungsspalten in dieser Reihenfolge, je mit Rap und Beso', () => {
    const sets = kpTemplate().columnSets;
    expect(sets.map((s) => s.name)).toEqual(['KVK Stufen', 'KVK Mi–Fr', 'Wochenende kompakt']);
    const names = (i: number) => sets[i]?.columns.map((c) => `${c.kind}:${c.name}`);
    expect(names(0)).toEqual([
      'planning:Kp Kdt',
      'planning:Stv',
      'planning:Zfhr',
      'planning:Uof',
      'planning:höh Uof',
      'planning:Trp',
      'rap:Rap',
      'beso:Beso',
    ]);
    expect(names(1)).toEqual([
      'planning:Kdo',
      'planning:Mö',
      'planning:Sph',
      'rap:Rap',
      'beso:Beso',
    ]);
    expect(names(2)).toEqual(['planning:Kp', 'rap:Rap', 'beso:Beso']);
  });

  it('[R-4.9-19] (F-53) keine Zug-Spaltensätze: keine Spalte mit «Zug» im Namen', () => {
    for (const s of kpTemplate().columnSets) {
      for (const c of s.columns) expect(c.name).not.toMatch(/Zug/);
    }
  });

  it('[R-4.4-01] Planungsspalten der Vorlage: Gewicht normal, Beschriftung waagrecht', () => {
    const planning = kpTemplate()
      .columnSets.flatMap((s) => s.columns)
      .filter((c) => c.kind === 'planning');
    expect(planning).toHaveLength(10);
    for (const c of planning) {
      expect(c.weight).toBe('normal');
      expect(c.labelOrientation).toBe('horizontal');
    }
  });

  it('[R-4.4-04] alle Spalten der Vorlage haben die Herkunft «frei» (manual)', () => {
    for (const c of kpTemplate().columnSets.flatMap((s) => s.columns)) {
      expect(c.origin).toBe('manual');
    }
  });

  it('[R-4.9-13] Nebenspalte der Kp-Vorlage heisst «Det»', () => {
    expect(kpTemplate().secondaryColumnName).toBe('Det');
  });

  it('[R-4.6-14] (F-55) Marker-Beschriftung der Vorlage: nur ABV mit Zeit', () => {
    expect(kpTemplate().markerLabels).toEqual([
      { kind: 'AV', withTime: false },
      { kind: 'ABV', withTime: true },
      { kind: 'HV', withTime: false },
      { kind: 'custom', withTime: false },
    ]);
  });

  it('[R-4.1-01] (Vertrag §2/P-8; PDF-Abnahme in E1-02e) Kp-Vorlage: Kennung, Stufe, Titelform, Ltg im Block, Beso-Kästchen, Stand-Farbe, Überschriften', () => {
    const t = kpTemplate();
    expect(t.id).toBe('kp');
    expect(t.level).toBe('kp');
    expect(t.label).toBe('Kp');
    expect(t.titlePattern).toBe('{unit} Arbeitsplan {weekLabel}');
    expect(t.ltgInBlock).toBe('withOrt');
    expect(t.besoBox).toEqual({ height: 'fixed30', numberBold: false });
    expect(t.standColor).toEqual({ r: 0, g: 0, b: 0 });
    expect(t.abbreviationHeading).toBe('Legende');
    expect(t.agendaHeading).toBe('Termine');
    expect(t.rapportAsMarker).toEqual([]);
  });

  it('[R-4.1-01] (Vertrag §2/P-8) Kp-Vorlage: Schriftgrössen 5 / 5,5 / 5 / 5 / 4,5 pt und Seitengeometrie «kp»', () => {
    const t = kpTemplate();
    expect(t.fontSizes).toEqual({
      standard: 5,
      blockTitle: 5.5,
      besoNumber: 5,
      rapportCode: 5,
      min: 4.5,
    });
    expect(t.pageGeometryId).toBe('kp');
  });

  it('[R-4.1-01] eingebaute Vorlagen enthalten die Kp-Vorlage unter ihrer Kennung', () => {
    const set = builtInTemplates();
    expect(set.get('kp')).toEqual(kpTemplate());
    expect(templateById('kp', set)).toEqual(kpTemplate());
  });

  it('[R-4.1-01] unbekannte Vorlage → unknownTemplate', () => {
    expectModelError(() => templateById('stab', builtInTemplates()), { code: 'unknownTemplate' });
    expectModelError(() => templateById('kp', new Map()), { code: 'unknownTemplate' });
  });

  it('[R-4.1-01] (Vertrag §2 templateById, AR0-18; PDF-Abnahme weiterer Vorlagen in E1-02e) weitere Vorlage als Daten: templateById findet eine übergebene fiktive Vorlage ohne Registrierung', () => {
    const stab: LevelTemplate = {
      ...kpTemplate(),
      id: 'stab',
      label: 'Stab',
      titlePattern: 'Arbeitsplan {weekLabel} – {unit}',
      legend: [
        {
          name: 'Ltg Stab',
          legendLabel: 'Leitung Stab',
          color: { r: 200, g: 230, b: 200 },
          neutral: false,
          inLegend: true,
        },
      ],
    };
    const set = new Map(builtInTemplates());
    set.set('stab', stab);
    expect(templateById('stab', set)).toBe(stab);
    expect(templateById('kp', set).id).toBe('kp');
    expectModelError(() => templateById('stab', builtInTemplates()), { code: 'unknownTemplate' });
  });
});
