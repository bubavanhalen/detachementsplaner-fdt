// Arbitraries für die Eigenschaftstests des Raster-Layouts (Paket E1-02d; ADR-010 §5: fester Startwert).
// Erzeugt zufällige, fiktive Wochen mit Spaltensätzen, Darstellung je Tag, Anzeigebereich und Einträgen aller
// Rastertypen; ohne Produktcode (Literale über tests/wap/support/grid/build.ts und model/builders.ts).
import fc from 'fast-check';
import type {
  Beso,
  BesoTimeWindow,
  Block,
  Column,
  ColumnKind,
  ColumnSelection,
  ColumnSet,
  ColumnWeight,
  DayDisplay,
  Entry,
  Id,
  Marker,
  MilTime,
  Plan,
  Querbalken,
  Rapport,
  TimeSpec,
} from '../../../../src/model/wap/types';
import { DI, DO, FR, MI, MO, rasterPlan, SA, SO, type TagSpec } from '../grid/build';
import { beso, block, col, marker, querbalken, rapport, rt, win } from '../model/builders';

/** Fester Startwert aller Eigenschaftstests des Rasters. */
export const GRID_SEED = 20261005;
/** Läufe je Eigenschaft (begrenzt, ADR-010 §4.5 Punkt 2). */
export const GRID_RUNS = 80;

export const TAGE_DER_WOCHE = [MO, DI, MI, DO, FR, SA, SO] as const;

const milTime = (min: number, max: number): fc.Arbitrary<MilTime> =>
  fc.integer({ min: Math.ceil(min / 5), max: Math.floor(max / 5) }).map((n) => n * 5);

const gewicht: fc.Arbitrary<ColumnWeight> = fc.constantFrom('narrow', 'normal', 'wide');

/** Spaltensatz `s<k>`: 1–6 Planungsspalten, optional eine Nebenspalte, Rap, Beso (R-2-02). */
export function spaltensatz(k: number): fc.Arbitrary<ColumnSet> {
  return fc
    .record({
      planung: fc.array(gewicht, { minLength: 1, maxLength: 6 }),
      neben: fc.boolean(),
      fremdGewicht: gewicht,
    })
    .map(({ planung, neben, fremdGewicht }) => {
      const spalten: Column[] = planung.map((weight, i) =>
        col(`c${k}x${i}`, `Spalte ${k}.${i}`, 'planning', { weight }),
      );
      const weitere: [string, ColumnKind][] = [
        ...(neben ? ([[`c${k}n`, 'secondary']] as [string, ColumnKind][]) : []),
        [`c${k}r`, 'rap'],
        [`c${k}b`, 'beso'],
      ];
      for (const [id, kind] of weitere) {
        spalten.push(col(id, `Spalte ${id}`, kind, { weight: fremdGewicht }));
      }
      return { id: `s${k}`, name: `Satz ${k}`, columns: spalten };
    });
}

export interface ZufallsRaster {
  readonly sets: readonly ColumnSet[];
  readonly tage: readonly TagSpec[];
  readonly range: { readonly from: MilTime; readonly to: MilTime };
  /** Breite der Tagesfläche in pt. */
  readonly W: number;
  /** pt je Minute. */
  readonly ppm: number;
}

const darstellung: fc.Arbitrary<DayDisplay> = fc.constantFrom('full', 'full', 'compact', 'hidden');

/** Woche aus 1–3 Sätzen, Darstellung je Tag, Anzeigebereich und Rahmen (mindestens ein Tag sichtbar, wenn `sichtbar`). */
export function raster(sichtbar = true): fc.Arbitrary<ZufallsRaster> {
  return fc
    .integer({ min: 1, max: 3 })
    .chain((n) => fc.tuple(...Array.from({ length: n }, (_, k) => spaltensatz(k + 1))))
    .chain((sets) =>
      fc.record({
        sets: fc.constant(sets),
        tage: fc
          .array(
            fc.record({
              set: fc.oneof(
                { weight: 9, arbitrary: fc.constantFrom(...sets.map((s) => s.id)) },
                { weight: 1, arbitrary: fc.constant(null) },
              ),
              display: darstellung,
            }),
            { minLength: 7, maxLength: 7 },
          )
          .filter((t) => !sichtbar || t.some((d) => d.display !== 'hidden')),
        range: milTime(0, 360).chain((from) =>
          milTime(Math.max(from + 600, 1080), 1440).map((to) => ({ from, to })),
        ),
        W: fc.integer({ min: 200, max: 900 }),
        ppm: fc.constantFrom(0.25, 0.3, 0.45),
      }),
    );
}

/** Planungs- und Nebenspalten eines Tages (Index im Wochenarray). */
function belegbar(r: ZufallsRaster, tag: number): readonly Column[] {
  const id = r.tage[tag]?.set ?? null;
  const s = r.sets.find((x) => x.id === id);
  return (s?.columns ?? []).filter((c) => c.kind === 'planning' || c.kind === 'secondary');
}

function auswahl(spalten: readonly Column[]): fc.Arbitrary<ColumnSelection> {
  if (spalten.length === 0) return fc.constant({ kind: 'all' });
  return fc.oneof(
    { weight: 1, arbitrary: fc.constant<ColumnSelection>({ kind: 'all' }) },
    {
      weight: 4,
      arbitrary: fc
        .subarray(
          spalten.map((c) => c.id),
          { minLength: 1 },
        )
        .map<ColumnSelection>((ids) => ({ kind: 'ids', ids })),
    },
  );
}

const TITEL = [
  'Ausb',
  'Zugsschule',
  'Gefechtsausbildung im Zug',
  'Mö Sch',
  'Sport',
  'Schiessausbildung',
];
const tag = fc.integer({ min: 0, max: 6 });

function zufallsBlock(r: ZufallsRaster, id: Id, seq: number): fc.Arbitrary<Block> {
  return tag.chain((t) =>
    fc
      .record({
        columns: auswahl(belegbar(r, t)),
        // 0000 bis 2400 (V-02d-20: «bis 0000», Zeitpunkt und «ab» 2400, 2400-… am Rand des Zeitbereichs).
        from: milTime(r.range.from, 1440),
        dauer: milTime(5, 600),
        form: fc.constantFrom('range', 'range', 'point', 'from', 'until'),
        title: fc.constantFrom(...TITEL),
        textDirection: fc.constantFrom('auto', 'auto', 'horizontal', 'vertical'),
        zusatz: fc.boolean(),
      })
      .map(({ columns, from, dauer, form, title, textDirection, zusatz }) => {
        const time: Block['time'] =
          form === 'range'
            ? { form, from, to: from + dauer }
            : form === 'point'
              ? { form, at: from }
              : form === 'from'
                ? { form, from }
                : { form, to: from };
        return block(id, seq, {
          date: TAGE_DER_WOCHE[t] ?? MO,
          columns,
          time,
          title: rt(title, seq % 2 === 0),
          textDirection,
          ...(zusatz
            ? {
                supplement: 'Gefechtsdienst',
                ltg: 'Lt Muster B',
                ort: 'Kaserne',
                tn: 'Zug 1',
                tenue: 'Tarnanzug',
                printTn: true,
                printTenue: true,
              }
            : {}),
        });
      }),
  );
}

function zufallsRapport(r: ZufallsRaster, id: Id, seq: number): fc.Arbitrary<Rapport> {
  return tag.chain((t) =>
    fc
      .record({
        from: milTime(r.range.from, 1440),
        dauer: milTime(5, 180),
        punkt: fc.boolean(),
        code: fc.constantFrom('KR', 'DR', 'AR2', 'BR 0'),
        ort: fc.constantFrom('', 'Kaserne'),
        display: fc.constantFrom('rapColumn', 'rapColumn', 'alsoInColumns', 'onlyInColumns'),
        displayColumns: auswahl(belegbar(r, t)),
      })
      .map(({ from, dauer, punkt, code, ort, display, displayColumns }) =>
        rapport(id, seq, {
          date: TAGE_DER_WOCHE[t] ?? MO,
          time: punkt ? { form: 'point', at: from } : { form: 'range', from, to: from + dauer },
          code,
          ort,
          display,
          displayColumns,
        }),
      ),
  );
}

/** Zeitform eines Beso-Zeitfensters (alle Formen, Frist mit und ohne Uhrzeit). */
export function fensterZeit(from: MilTime): fc.Arbitrary<TimeSpec> {
  return fc.oneof(
    fc.constant<TimeSpec>({ form: 'point', at: from }),
    milTime(from + 5, from + 600).map<TimeSpec>((to) => ({
      form: 'range',
      from,
      to,
    })),
    fc.constant<TimeSpec>({ form: 'from', from }),
    fc.constant<TimeSpec>({ form: 'until', to: from }),
    fc.constant<TimeSpec>({ form: 'deadline', to: from }),
    fc.constant<TimeSpec>({ form: 'deadline' }),
  );
}

function zufallsBeso(r: ZufallsRaster, id: Id, seq: number): fc.Arbitrary<Beso> {
  return tag.chain((t) => {
    const spalten = belegbar(r, t).map((c) => c.id);
    return fc
      .array(
        fc.record({
          from: milTime(r.range.from, 1440),
          spalte: spalten.length === 0 ? fc.constant(null) : fc.option(fc.constantFrom(...spalten)),
        }),
        { minLength: 1, maxLength: 4 },
      )
      .chain((fenster) =>
        fc.tuple(...fenster.map((f) => fensterZeit(f.from))).map((zeiten) =>
          beso(id, seq, {
            date: TAGE_DER_WOCHE[t] ?? MO,
            windows: fenster.map(
              (f, i): BesoTimeWindow =>
                win(`t${id}w${i}`, { time: zeiten[i] as TimeSpec, columnId: f.spalte }),
            ),
            besoNumber: 10 + (seq % 10),
          }),
        ),
      );
  });
}

function zufallsMarker(r: ZufallsRaster, id: Id, seq: number): fc.Arbitrary<Marker> {
  return tag.chain((t) =>
    fc
      .record({
        // Bis zum Anzeigeende (Notiz test-engineer Runde 1 T1, V-02d-19: Feld abgeschnitten oder ohne Feld).
        at: milTime(r.range.from, r.range.to),
        kind: fc.constantFrom('AV', 'ABV', 'HV', 'custom'),
        columns: auswahl(belegbar(r, t)),
      })
      .map(({ at, kind, columns }) =>
        marker(id, seq, {
          date: TAGE_DER_WOCHE[t] ?? MO,
          at,
          kind,
          customKind: kind === 'custom' ? 'Wachtablösung' : '',
          columns,
        }),
      ),
  );
}

function zufallsQuerbalken(r: ZufallsRaster, id: Id, seq: number): fc.Arbitrary<Querbalken> {
  return fc
    .record({ a: fc.integer({ min: -2, max: 6 }), lang: fc.integer({ min: 0, max: 9 }) })
    .chain(({ a, lang }) => {
      const von = Math.max(0, a);
      const spalten = belegbar(r, von);
      return auswahl(spalten).map((columns) =>
        querbalken(id, seq, {
          fromDate: a < 0 ? '2026-09-26' : (TAGE_DER_WOCHE[von] ?? MO),
          toDate: a + lang > 6 ? '2026-10-06' : (TAGE_DER_WOCHE[Math.max(0, a + lang)] ?? MO),
          columns,
          title: rt(lang % 2 === 0 ? 'Messe' : 'Wachtdienst Stao'),
        }),
      );
    });
}

export interface ZufallsWoche {
  readonly raster: ZufallsRaster;
  readonly plan: Plan;
}

/** Zufällige Woche w26 mit 0–30 Einträgen aller Rastertypen (Erfassungsnummer = Index + 1). */
export function zufallsWoche(maxEintraege = 30): fc.Arbitrary<ZufallsWoche> {
  return raster().chain((r) =>
    fc
      .array(
        fc.constantFrom(
          'block',
          'block',
          'block',
          'rapport',
          'beso',
          'beso',
          'marker',
          'querbalken',
        ),
        {
          maxLength: maxEintraege,
        },
      )
      .chain((arten) =>
        fc.tuple(
          ...arten.map((art, i): fc.Arbitrary<Entry> => {
            const id = `e${i + 1}`;
            const seq = i + 1;
            switch (art) {
              case 'block':
                return zufallsBlock(r, id, seq);
              case 'rapport':
                return zufallsRapport(r, id, seq);
              case 'beso':
                return zufallsBeso(r, id, seq);
              case 'marker':
                return zufallsMarker(r, id, seq);
              default:
                return zufallsQuerbalken(r, id, seq);
            }
          }),
        ),
      )
      .map((entries) => ({
        raster: r,
        plan: rasterPlan({ sets: r.sets, tage: r.tage, range: r.range, entries }),
      })),
  );
}
