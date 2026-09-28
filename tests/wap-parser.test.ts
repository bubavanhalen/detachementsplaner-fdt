// Kp-WAP parser tests on a wholly fictional workbook generated in code
// (tests/fixtures/wap-synthetic.ts). No real WAP content is used here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listWapSheets, parseWap, WapError } from '../src/io/wap';
import { calibrateTime } from '../src/io/wap/calibrate';
import { parseTheme } from '../src/io/wap/colors';
import {
  applyContentRules,
  canonicalFunctions,
  fixSpaeher,
  isRapport,
  parseBoxText,
  parseFootnoteBody,
  parseFootnoteLine,
  stripBatReferences,
} from '../src/io/wap/content';
import {
  aboutCentre,
  boundingBox,
  boxToBox,
  multiply,
  readDrawing,
  type WapShape,
} from '../src/io/wap/drawing';
import { parseSharedStrings, parseSheet, parseStyles } from '../src/io/wap/sheet';
import { parseXml } from '../src/io/wap/xml';
import {
  DEFAULT_TB_RULES,
  detectEntryConflicts,
  emptyWeek,
  type TbEntry,
  type TbWeek,
  type WapParseResult,
} from '../src/model/tagesbefehl';
import { syntheticWap } from './fixtures/wap-synthetic';

const rules = DEFAULT_TB_RULES;
const bytes = syntheticWap();
const weekA = parseWap(bytes, 'Woche A', { rules });
const find = (result: WapParseResult, day: string, text: string): TbEntry => {
  const entry = result.entries.find((e) => e.day === day && e.taetigkeit.startsWith(text));
  if (!entry) throw new Error(`entry not found: ${day} ${text}`);
  return entry;
};
const weekOf = (result: WapParseResult): TbWeek => ({
  ...emptyWeek(result.sheet),
  startDate: result.startDate,
  days: result.days,
  entries: result.entries,
  groups: result.groups,
  parseConflicts: result.conflicts,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawing transforms', () => {
  it('swaps width and height around the centre for 90° and 270°', () => {
    const box = { x0: 0, y0: 40, x1: 100, y1: 60 };
    for (const deg of [90, 270]) {
      const out = boundingBox(aboutCentre(50, 50, deg), box);
      expect(out.x0).toBeCloseTo(40);
      expect(out.x1).toBeCloseTo(60);
      expect(out.y0).toBeCloseTo(0);
      expect(out.y1).toBeCloseTo(100);
    }
    const flipped = boundingBox(aboutCentre(50, 50, 0, true, true), box);
    expect(flipped).toEqual(box);
  });

  it('composes group child space onto the parent box', () => {
    const child = boxToBox(
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 100, y0: 200, x1: 200, y1: 400 },
    );
    const outer = boxToBox(
      { x0: 100, y0: 200, x1: 200, y1: 400 },
      { x0: 0, y0: 0, x1: 50, y1: 100 },
    );
    const box = boundingBox(multiply(outer, child), { x0: 5, y0: 5, x1: 10, y1: 10 });
    expect(box).toEqual({ x0: 25, y0: 50, x1: 50, y1: 100 });
  });

  it('reads nested groups, rotation, fills and text lines', () => {
    const theme = parseTheme(null);
    const sheet = parseSheet(
      parseXml(
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>',
      ),
      parseSharedStrings(null),
      parseStyles(null, theme),
    );
    const xml = `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <xdr:absoluteAnchor><xdr:pos x="1000" y="2000"/><xdr:ext cx="1000" cy="2000"/>
        <xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="1" name="G"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr>
          <xdr:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="500" cy="1000"/><a:chOff x="0" y="0"/><a:chExt cx="100" cy="100"/></a:xfrm><a:solidFill><a:srgbClr val="CCECFF"/></a:solidFill></xdr:grpSpPr>
          <xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="2" name="Inner"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr>
            <xdr:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/><a:chOff x="0" y="0"/><a:chExt cx="10" cy="10"/></a:xfrm></xdr:grpSpPr>
            <xdr:sp><xdr:nvSpPr><xdr:cNvPr id="3" name="Rot"/><xdr:cNvSpPr/></xdr:nvSpPr>
              <xdr:spPr><a:xfrm rot="5400000"><a:off x="0" y="4"/><a:ext cx="10" cy="2"/></a:xfrm><a:prstGeom prst="rect"/><a:grpFill/></xdr:spPr>
              <xdr:txBody><a:bodyPr vert="vert270"/><a:p><a:r><a:t>Zeile 1</a:t></a:r><a:br/><a:r><a:t>Zeile  2</a:t></a:r></a:p><a:p/></xdr:txBody></xdr:sp>
          </xdr:grpSp>
        </xdr:grpSp>
      </xdr:absoluteAnchor></xdr:wsDr>`;
    const [shape] = readDrawing(parseXml(xml), sheet, theme);
    // Child box (0,4)-(10,6) rotated → (4,0)-(6,10) in inner space → ×10 → ×10 → anchor.
    expect(shape.box.x0).toBeCloseTo(1000 + 400);
    expect(shape.box.x1).toBeCloseTo(1000 + 600);
    expect(shape.box.y0).toBeCloseTo(2000);
    expect(shape.box.y1).toBeCloseTo(4000);
    expect(shape.rotation).toBe(90);
    expect(shape.vertical).toBe('vert270');
    expect(shape.fill).toBe('CCECFF');
    expect(shape.lines).toEqual(['Zeile 1', 'Zeile 2', '']);
  });
});

describe('time calibration', () => {
  const label = (text: string, y: number, x = 0): WapShape => ({
    index: y,
    name: '',
    kind: 'sp',
    geometry: 'rect',
    box: { x0: x, y0: y - 5, x1: x + 20, y1: y + 5 },
    lines: [text],
    fill: null,
    line: null,
    rotation: 0,
    vertical: '',
    groupDepth: 1,
  });

  it('interpolates piecewise linearly between label centres of both columns', () => {
    const shapes = [
      label('0500', 100),
      label('0600', 200),
      label('0700', 400),
      label('0500', 100, 1000),
      label('0600', 200, 1000),
      label('0700', 400, 1000),
      label('0735', 250, 500), // not a full hour: ignored
    ];
    const time = calibrateTime(shapes);
    expect(time.labels.map((l) => l.minutes)).toEqual([300, 360, 420]);
    expect(time.toMinutes(150)).toBeCloseTo(330);
    expect(time.toMinutes(300)).toBeCloseTo(390);
    expect(time.toMinutes(50)).toBeCloseTo(270); // extrapolated
    expect(time.gridLeft).toBe(20);
    expect(time.gridRight).toBe(1000);
  });

  it('fails with a generic message without hour labels', () => {
    expect(() => calibrateTime([label('Text', 10)])).toThrow(WapError);
  });
});

describe('content rules', () => {
  it('strips references to Bat orders but keeps Kp wording', () => {
    expect(stripBatReferences('Packliste (Anh 06-02b-3) vor Abmarsch')).toBe(
      'Packliste vor Abmarsch',
    );
    expect(stripBatReferences('Pflichtig sind alle Zfhr (Bf 07-02b).')).toBe(
      'Pflichtig sind alle Zfhr.',
    );
    expect(stripBatReferences('Ausrüstung gem Bf 07-02b')).toBe('Ausrüstung');
    expect(stripBatReferences('Beilage 04-05 zum Ausbildungsbefehl')).toBe('');
    expect(stripBatReferences('Abmarsch gem Bf Ausgabe Abmarsch')).toBe(
      'Abmarsch gem Bf Ausgabe Abmarsch',
    );
  });

  it('writes Sph instead of Späh', () => {
    expect(fixSpaeher('Späh Ausb / Späh.')).toBe('Sph Ausb / Sph');
    expect(fixSpaeher('Späher')).toBe('Späher');
    expect(applyContentRules('Späh Det (Bf 08-04)')).toBe('Sph Det');
  });

  it('extracts Verantwortlich, Ort and label times from box text', () => {
    const [a] = parseBoxText(['Reinigung Lager/Garage', 'Einh Fw', '(Ukft/Spl)']).activities;
    expect(a).toMatchObject({
      taetigkeit: 'Reinigung Lager / Garage',
      verantwortlich: 'Einh Fw',
      ort: 'Ukft / Spl',
    });
    const [b] = parseBoxText(['Holzlieferung', 'Ltg: Mat C', 'NORDHAUSEN']).activities;
    expect(b).toMatchObject({ taetigkeit: 'Holzlieferung / NORDHAUSEN', verantwortlich: 'Mat C' });
    const [c] = parseBoxText(['Ausb. Funk (Lt Muster)']).activities;
    expect(c).toMatchObject({ taetigkeit: 'Ausb. Funk', verantwortlich: 'Lt Muster' });
    const [d] = parseBoxText(['ABV 2330', '(Trp)']).activities;
    expect(d).toMatchObject({ taetigkeit: 'ABV (Trp)', labelTime: 23 * 60 + 30, point: true });
    const [e] = parseBoxText(['z Vf', 'Zf (Fhz Kontrolle)']).activities;
    expect(e.taetigkeit).toBe('z Vf Zfhr (Fz Kontrolle)');
    const [f] = parseBoxText(['Kdt Stunde /', 'Ausgb Material', '(ThS)']).activities;
    expect(f).toMatchObject({ taetigkeit: 'Kdt Stunde / Ausgabe Material', ort: 'ThS' });
    const [g] = parseBoxText(['MiE (Ltg: Qm)']).activities;
    expect(g).toMatchObject({ taetigkeit: 'MiE', verantwortlich: 'Qm' });
  });

  it('splits a point item combined with other service items', () => {
    const { activities } = parseBoxText(['Tagwach / MoE', '(Ukft/Kantine)']);
    expect(activities.map((a) => [a.taetigkeit, a.point, a.ort])).toEqual([
      ['Tagwache', true, 'Ukft / Kantine'],
      ['MoE', false, 'Ukft / Kantine'],
    ]);
    expect(parseBoxText(['PD / WEB']).activities).toHaveLength(1);
  });

  it('splits boxes with several activities and responsibles', () => {
    const box = parseBoxText([
      'Fsg Zelte',
      'Einh Fw',
      '',
      'Aufbau Küche, Herd',
      'Four',
      '',
      'anschl',
      'Rückschub',
    ]);
    expect(box.split).toBe(true);
    expect(box.activities.map((a) => [a.taetigkeit, a.verantwortlich])).toEqual([
      ['Fassung Zelte', 'Einh Fw'],
      ['Aufbau Küche, Herd, anschl Rückschub', 'Four'],
    ]);
  });

  it('parses footnote lines in all WAP notations', () => {
    expect(parseFootnoteLine('31 0915-1045: Begehung')).toMatchObject({
      nr: 31,
      time: { kind: 'range', start: 555, end: 645 },
      body: 'Begehung',
    });
    expect(parseFootnoteLine('32 bis 0830: Meldung')?.time).toEqual({ kind: 'bis', start: 510 });
    expect(parseFootnoteLine('35 ab 0930: Abgabe')?.time).toEqual({ kind: 'ab', start: 570 });
    expect(parseFootnoteLine('33 — 1415: Appell')).toMatchObject({
      time: { kind: 'point', start: 855 },
      body: 'Appell',
    });
    expect(parseFootnoteLine('36 — 1745–1830: Sport')?.time).toEqual({
      kind: 'range',
      start: 1065,
      end: 1110,
    });
    expect(parseFootnoteLine('34 Anhänger waschen.')).toMatchObject({
      nr: 34,
      time: null,
      body: 'Anhänger waschen.',
    });
  });

  it('splits footnote bodies into Tätigkeit, Verantwortlich and Ort', () => {
    expect(
      parseFootnoteBody('Start Rap, Ltg: S9, Tn: Einh Kdt Stv, Four, Ort: Halle Nord.'),
    ).toEqual({
      taetigkeit: 'Start Rap, Tn: Kdt Stv, Four',
      verantwortlich: 'S9',
      ort: 'Halle Nord',
    });
    expect(parseFootnoteBody('Absprache Material via Teams, Ltg: S1, Tn: Four.')).toEqual({
      taetigkeit: 'Absprache Material, Tn: Four',
      verantwortlich: 'S1',
      ort: 'Teams',
    });
    expect(
      parseFootnoteBody(
        'Abgabe Zelte, Lager OSTDORF in WESTHAUSEN, Ltg: Kdt Log Kp 9; Transport durch die Einh.',
      ),
    ).toEqual({
      taetigkeit: 'Abgabe Zelte, Lager OSTDORF; Transport durch die Einh',
      verantwortlich: 'Kdt Log Kp 9',
      ort: 'WESTHAUSEN',
    });
    expect(parseFootnoteBody('Fassung Mun, Ltg: Kdt 99/9.', '99/9').verantwortlich).toBe('Kp Kdt');
  });

  it('normalises functions to the company perspective', () => {
    expect(canonicalFunctions('Tn: Einh Kdt Stv, Einh Kdt', '')).toBe('Tn: Kdt Stv, Kp Kdt');
    expect(canonicalFunctions('Ltg Kdt Stv 99/9', '99/9')).toBe('Ltg Kdt Stv');
    expect(canonicalFunctions('Einrücken')).toBe('Einrücken');
  });

  it('recognises rapport items', () => {
    for (const text of [
      'KR',
      'DR',
      'AR1',
      'AR 2',
      'ARK',
      'BR 0',
      'Material Rap',
      'Dienstrapport',
      'Absprache Transport',
    ])
      expect(isRapport(text), text).toBe(true);
    for (const text of ['Rapportraum putzen', 'AVOR', 'Kontrolle'])
      expect(isRapport(text), text).toBe(false);
  });
});

describe('parseWap on the synthetic week', () => {
  it('lists sheets and rejects invalid input with generic errors', () => {
    expect(listWapSheets(bytes)).toEqual(['Woche A', 'Woche B', 'Leer']);
    expect(() => listWapSheets(new Uint8Array([1, 2, 3]))).toThrow(WapError);
    expect(() => parseWap(bytes, 'Leer', { rules })).toThrow(WapError);
    expect(() => parseWap(bytes, 'Fehlt', { rules })).toThrow(WapError);
  });

  it('detects dates, visible days, sub-columns and legend colours from the sheet', () => {
    expect(weekA.startDate).toBe('2030-01-07');
    expect(weekA.days).toEqual(['Mo', 'Di', 'Sa', 'So']); // hidden Wednesday dropped
    expect(weekA.columns?.Mo).toEqual(['Stab', 'ALPHA 1', 'ALPHA 2', 'BRAVO', 'Rap', 'Beso']);
    expect(weekA.columns?.Sa).toEqual(['Kp', 'Bes']);
    // The legend uses a non-standard Kp colour: only the sheet's own legend maps it.
    expect(find(weekA, 'Mo', 'AVOR Übung').source?.leitung).toBe('kp');
    expect(find(weekA, 'Mo', 'Schiessen').source?.leitung).toBe('zfhr');
    expect(find(weekA, 'Mo', 'BR 2').source?.leitung).toBe('bat');
    expect(weekA.diagnostics.join(' ')).toMatch(/Stundenmarken: 19/);
  });

  it('maps full-width boxes to Dienstbetrieb and splits Tagwache / MoE', () => {
    expect(find(weekA, 'Mo', 'Tagwache')).toMatchObject({
      section: 'dienstbetrieb',
      group: '',
      zeit: '0600',
      ort: 'Ukft / Kantine',
    });
    expect(find(weekA, 'Mo', 'MoE')).toMatchObject({
      zeit: '0600 - 0645',
      verantwortlich: 'Einh Four',
    });
    // Stale top-level xfrm and zero xfrm: anchors are authoritative.
    expect(find(weekA, 'Mo', 'AV')).toMatchObject({
      zeit: '0700',
      verantwortlich: 'Kp Kdt',
      ort: 'AV Platz',
    });
    expect(find(weekA, 'Mo', 'NaE').zeit).toBe('1800 - 1845');
  });

  it('keeps positions of rotated boxes inside scaled groups', () => {
    const fahrschule = find(weekA, 'Mo', 'Fahrschule');
    expect(fahrschule).toMatchObject({ zeit: '0900 - 1100', group: 'BRAVO', ort: 'Ukft' });
    expect(fahrschule.source?.rawStart).toBe(540);
    expect(fahrschule.source?.rawEnd).toBe(660);
  });

  it('builds group headings from the sheet headers', () => {
    expect(weekA.groups.Mo).toEqual(['Stab', 'ALPHA 1', 'ALPHA 2', 'BRAVO']);
    // Identical sibling columns on Tuesday are merged into one heading, listed once.
    expect(weekA.groups.Di).toEqual(['Stab', 'ALPHA 1 / ALPHA 2', 'BRAVO']);
    expect(weekA.entries.filter((e) => e.taetigkeit === 'Gefechtsschiessen')).toHaveLength(1);
    expect(find(weekA, 'Mo', 'Schiessen')).toMatchObject({
      group: 'ALPHA 1',
      verantwortlich: 'Grfhr',
      ort: 'Spl',
    });
    expect(find(weekA, 'Sa', 'Urlaub')).toMatchObject({ section: 'dienstbetrieb', group: '' });
  });

  it('applies the content rules and the rule table', () => {
    expect(find(weekA, 'Mo', 'Sph Ausb').taetigkeit).toBe('Sph Ausb');
    expect(find(weekA, 'Mo', 'Kp Rap')).toMatchObject({
      section: 'rapporte',
      zeit: '0600 - 0630',
      verantwortlich: 'Kp Kdt',
      ort: 'Rapportraum',
    });
    expect(find(weekA, 'Di', 'Dienstrapport')).toMatchObject({
      section: 'rapporte',
      zeit: '1100 - 1200',
    });
    expect(find(weekA, 'Mo', 'BR 2')).toMatchObject({
      section: 'rapporte',
      verantwortlich: 'Bat',
      ort: 'Bat KP',
    });
    expect(weekA.entries.some((e) => /Geheim/.test(e.taetigkeit))).toBe(false); // covered box
    expect(weekA.entries.every((e) => !/Späh|Anh 0|Bf 0/.test(e.taetigkeit))).toBe(true);
  });

  it('uses written times over the position and flags the difference', () => {
    const abv = find(weekA, 'Mo', 'ABV');
    expect(abv.zeit).toBe('2330');
    expect(abv.source?.flags).toContain('Label-Zeit ≠ Position');
    expect(weekA.conflicts.find((c) => c.type === 'label_vs_position')?.entryIds).toEqual([abv.id]);
  });

  it('handles footnotes: markers, times, merges and missing parts', () => {
    const fn11 = find(weekA, 'Mo', 'Materialkontrolle');
    expect(fn11).toMatchObject({
      section: 'besonderes',
      zeit: '1330 - 1400',
      verantwortlich: 'Einh Fw',
      ort: 'Mag',
      taetigkeit: 'Materialkontrolle, Tn: alle Zfhr',
    });
    expect(fn11.source).toMatchObject({ kind: 'footnote', footnote: '11' });
    expect(fn11.source?.flags).toContain('Zeit aus Fussnote');
    const fn12 = find(weekA, 'Mo', 'Wachtablösung');
    expect(fn12.zeit).toBe('1515');
    expect(fn12.source?.flags).toContain('Zeit aus Position, Fussnote ohne Zeit');
    // Footnote 14 repeats the Beso box → one merged entry.
    const merged = find(weekA, 'Mo', 'Holzlieferung');
    expect(merged.taetigkeit).toBe('Holzlieferung / NORDHAUSEN; Tn: Mat C');
    expect(merged.source?.footnote).toBe('14');
    expect(weekA.entries.filter((e) => /NORDHAUSEN/.test(e.taetigkeit))).toHaveLength(1);
    expect(find(weekA, 'Mo', 'Info')).toMatchObject({ ort: 'Teams', zeit: '1600' });
    expect(find(weekA, 'Di', 'Planungsrapport')).toMatchObject({
      section: 'rapporte',
      zeit: '2000',
    });
    expect(find(weekA, 'So', 'Rückkehr')).toMatchObject({
      section: 'besonderes',
      verantwortlich: 'Four',
    });
    const types = weekA.conflicts.map((c) => `${c.day}:${c.type}`);
    expect(types).toEqual(
      expect.arrayContaining([
        'Mo:footnote_vs_box',
        'Mo:footnote_without_time',
        'Mo:footnote_missing_marker',
        'Mo:footnote_missing_text',
        'Mo:label_vs_position',
        'Di:ambiguous',
        'Di:naming',
        'So:footnote_without_time',
      ]),
    );
  });

  it('parses side notes and applies the content rules to them', () => {
    expect(weekA.notes.wochenziele).toEqual(['Ziel eins ist erreicht.', 'Ziel zwei ist erreicht.']);
    expect(weekA.notes.bemerkungen).toEqual(['Sph melden sich beim Kdt.', 'Ausgang bis 2300.']);
  });

  it('produces stable, unique entry ids and deterministic conflict ids', () => {
    const again = parseWap(bytes, 'Woche A', { rules });
    expect(again.entries.map((e) => e.id)).toEqual(weekA.entries.map((e) => e.id));
    expect(again.conflicts.map((c) => c.id)).toEqual(weekA.conflicts.map((c) => c.id));
    expect(new Set(weekA.entries.map((e) => e.id)).size).toBe(weekA.entries.length);
    expect(weekA.entries[0].id).toBe('woche_a_Mo_1');
    const ids = new Set(weekA.entries.map((e) => e.id));
    for (const c of weekA.conflicts) for (const id of c.entryIds) expect(ids.has(id)).toBe(true);
  });

  it('groups function columns into Stufen and applies heading aliases', () => {
    const plain = parseWap(bytes, 'Woche B', { rules });
    expect(plain.groups).toEqual({
      Mo: ['Kdt / Stv', 'Wm / Trp'],
      Di: ['Kdt / Stv / Zfhr'],
    });
    const aliased = parseWap(bytes, 'Woche B', {
      rules,
      groupAliases: { stv: 'Kdt Stv', Trp: 'Trp Det' },
    });
    expect(aliased.groups).toEqual({
      Mo: ['Kdt / Kdt Stv', 'Wm / Trp Det'],
      Di: ['Kdt / Kdt Stv / Zfhr'],
    });
    expect(find(aliased, 'Di', 'MiE').group).toBe('');
  });

  it('does not use the network', () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    parseWap(bytes, 'Woche A', { rules });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('detectEntryConflicts', () => {
  const entry = (id: string, patch: Partial<TbEntry>): TbEntry => ({
    id,
    day: 'Mo',
    section: 'besonderes',
    group: '',
    zeit: '',
    taetigkeit: '',
    verantwortlich: '',
    ort: '',
    ...patch,
  });
  const week = (entries: TbEntry[]): TbWeek => ({ ...emptyWeek('Test'), entries });

  it('finds items during all-hands activities and unknown abbreviations in the synthetic week', () => {
    const conflicts = detectEntryConflicts(weekOf(weekA));
    const during = conflicts.find((c) => c.type === 'overlap' && c.day === 'Di');
    expect(during?.entryIds).toEqual(
      [find(weekA, 'Di', 'Planungsrapport').id, find(weekA, 'Di', 'Kaderabend').id].sort(),
    );
    const unknown = conflicts.filter((c) => c.type === 'unknown_abbreviation');
    expect(unknown.map((c) => c.message).join(' ')).toMatch(/QXZ/);
    expect(unknown.filter((c) => /QXZ/.test(c.message))).toHaveLength(1);
  });

  it('flags the same function at two places at the same time', () => {
    const conflicts = detectEntryConflicts(
      week([
        entry('a', {
          zeit: '0800 - 0900',
          taetigkeit: 'Kontrolle Lager',
          verantwortlich: 'Einh Fw',
          ort: 'Mag Nord',
        }),
        entry('b', {
          section: 'rapporte',
          zeit: '0830',
          taetigkeit: 'Start Rap, Tn: Einh Fw',
          ort: 'Halle West',
        }),
        entry('c', {
          zeit: '1000 - 1100',
          taetigkeit: 'Kontrolle Küche',
          verantwortlich: 'Einh Fw',
          ort: 'Küche',
        }),
      ]),
    );
    expect(conflicts).toEqual([
      expect.objectContaining({
        id: 'location_overlap_Mo_a+b',
        type: 'location_overlap',
        entryIds: ['a', 'b'],
      }),
    ]);
  });

  it('ignores the same box listed twice and rapports on the own site', () => {
    const conflicts = detectEntryConflicts(
      week([
        entry('a', {
          section: 'dienstbetrieb',
          group: 'X 1',
          zeit: '0800 - 1000',
          taetigkeit: 'EV',
          source: { kind: 'box', rawText: 'EV', columns: ['Zfhr'] },
        }),
        entry('b', {
          section: 'dienstbetrieb',
          group: 'Y 1',
          zeit: '0800 - 1000',
          taetigkeit: 'EV',
          source: { kind: 'box', rawText: 'EV', columns: ['Zfhr'] },
        }),
        entry('c', {
          section: 'dienstbetrieb',
          group: 'Kp Kdt',
          zeit: '0800 - 1000',
          taetigkeit: 'Planung',
          ort: 'Ukft',
          source: { kind: 'box', rawText: 'Planung', columns: ['Kp Kdt'] },
        }),
        entry('d', {
          section: 'rapporte',
          zeit: '0830 - 0900',
          taetigkeit: 'Kp Rap',
          verantwortlich: 'Kp Kdt',
          ort: 'Rapportraum',
        }),
      ]),
    );
    expect(conflicts).toEqual([]);
  });
});
