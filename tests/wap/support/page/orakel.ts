// Orakel der gezeichneten Zeitspannen (Paket E1-02e, Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» H5; setzt
// Vertrag E1-02d 2c um: Spanne je Typ, Rapport-Mindesthöhe, Mitternacht mit R2-2, R4-1 und R5-1, Zuschnitt mit
// R2-1 und C1). «Ausnahmen» eines blockartigen Elements nach E1-02d 2d Nr 2 (echte Teilmenge der Spalten, oder
// teilweise Überschneidung und später erfasst). Unabhängig von der Layout-Schicht: nur Plan, Vorlage und die
// Spaltenauswahl des Modells (E1-02a `dayColumns`, E1-03 `relativeColumns`).
import { relativeColumns } from '../../../../src/model/wap/commands/columns';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import type { LevelTemplate } from '../../../../src/model/wap/template';
import type {
  Beso,
  Column,
  ColumnSelection,
  Entry,
  Id,
  IsoDate,
  Plan,
  TimeSpec,
  Weekday,
} from '../../../../src/model/wap/types';
import type { Rect } from '../pdf/read';
import { tagDatum } from './varianten';

export interface Spanne {
  readonly from: number;
  readonly to: number;
}

const WOCHENTAGE: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function wochentag(plan: Plan, weekId: Id, date: IsoDate): Weekday {
  const w = plan.weeks.find((x) => x.id === weekId);
  if (w === undefined) throw new Error(`Woche ${weekId} fehlt`);
  for (let i = 0; i < 7; i++)
    if (tagDatum(w.startDate, i) === date) return WOCHENTAGE[i] as Weekday;
  throw new Error(`${date} liegt nicht in Woche ${weekId}`);
}

function folgetag(date: IsoDate): IsoDate {
  return tagDatum(date, 1);
}

/** Zeitbereich der zeitlichen Einträge: V0 = from + 60, V1 = to (E1-02d 2a Nr 5). */
export function zeitbereich(plan: Plan): { V0: number; V1: number } {
  return { V0: plan.displayRange.from + 60, V1: plan.displayRange.to };
}

/** Zuschnitt auf [V0, V1] nach 2c, R2-1 (unbegrenzt) und C1 (d = min(b − a, 30, V1 − V0)). */
export function zuschnitt(a: number, b: number, V0: number, V1: number): Spanne {
  const d = Math.min(b - a, 30, V1 - V0);
  if (b <= V0) return { from: V0, to: V0 + d };
  if (a >= V1) return { from: V1 - d, to: V1 };
  return { from: Math.max(a, V0), to: Math.min(b, V1) };
}

/** Leeres Tagesteil vor Mitternacht (R2-2, C1): [V1 − min(30, V1 − V0), V1]. */
function leeresTeil(V0: number, V1: number): Spanne {
  return { from: V1 - Math.min(30, V1 - V0), to: V1 };
}

/** Logische Spanne eines Blocks bzw. Rapports vor Teilung und Zuschnitt (2c «Spanne je Typ»). */
function logisch(e: Entry): Spanne | null {
  if (e.type === 'block') {
    const t = e.time;
    switch (t.form) {
      case 'range':
        return { from: t.from, to: t.to };
      case 'point':
        return { from: t.at, to: t.at + 30 };
      case 'from':
        return { from: t.from, to: t.from + 30 };
      case 'until':
        return { from: t.to - 30, to: t.to };
    }
  }
  if (e.type === 'rapport') {
    const t = e.time;
    return t.form === 'range'
      ? { from: t.from, to: Math.max(t.to, t.from + 30) }
      : { from: t.at, to: t.at + 30 };
  }
  return null;
}

/** Wird die Spanne an Mitternacht geteilt? Nur bei erfasster Zeit `range` mit to > 1440 (2c, CR-E102d-09). */
function geteilt(e: Block_or_Rapport): boolean {
  return e.time.form === 'range' && e.time.to > 1440;
}

type Block_or_Rapport = Extract<Entry, { type: 'block' } | { type: 'rapport' }>;

/** Spanne eines Beso-Kästchens, Vorlage `fixed30` (2c `besoBoxSpan`, Kp). */
function besoSpanne(t: TimeSpec, plan: Plan): Spanne {
  const { V0 } = zeitbereich(plan);
  switch (t.form) {
    case 'point':
      return { from: t.at, to: t.at + 30 };
    case 'range':
    case 'from':
      return { from: t.from, to: t.from + 30 };
    case 'until':
      return { from: t.to - 30, to: t.to };
    case 'deadline':
      return t.to === undefined ? { from: V0, to: V0 + 30 } : { from: t.to - 30, to: t.to };
  }
}

/**
 * Gezeichnete Spanne(n) eines Eintrags an einem Tag (Minuten des Tages): Block und Rapport je Tagesteil höchstens
 * eine, Beso-Kästchen je Zeitfenster eine (in Fensterreihenfolge), Marker [y-Zeit, y-Zeit]; Querbalken und
 * Bemerkungen keine. Vorlage `fixed30` (Kp); `duration` (Bat) folgt in Etappe 3.
 */
export function gezeichneteSpanne(
  entry: Entry,
  date: IsoDate,
  plan: Plan,
  template: LevelTemplate,
): Spanne[] {
  const { V0, V1 } = zeitbereich(plan);
  if (template.besoBox.height !== 'fixed30') throw new Error('Orakel nur für die Vorlage fixed30');
  switch (entry.type) {
    case 'block':
    case 'rapport': {
      const s = logisch(entry);
      if (s === null) return [];
      if (geteilt(entry)) {
        if (entry.date === date) {
          return [s.from >= 1440 ? leeresTeil(V0, V1) : zuschnitt(s.from, 1440, V0, V1)];
        }
        if (folgetag(entry.date) === date) return [zuschnitt(0, s.to - 1440, V0, V1)];
        return [];
      }
      return entry.date === date ? [zuschnitt(s.from, s.to, V0, V1)] : [];
    }
    case 'beso':
      if (entry.date !== date) return [];
      return entry.windows.map((w) => {
        const s = besoSpanne(w.time, plan);
        return zuschnitt(s.from, s.to, V0, V1);
      });
    case 'marker': {
      if (entry.date !== date) return [];
      const t = Math.min(Math.max(entry.at, V0), V1);
      return [{ from: t, to: t }];
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------------------------------------
// Spalten und Ausnahmen (E1-02d 2b, 2d Nr 2)
// ---------------------------------------------------------------------------------------------------------

/** Spalten C eines Auswahl-Felds an einem Tag (2b): leer trotz IDs → alle Planungsspalten. */
export function spaltenAm(
  plan: Plan,
  weekId: Id,
  date: IsoDate,
  sel: ColumnSelection,
): readonly Column[] {
  const tag = dayColumns(plan, weekId, wochentag(plan, weekId, date));
  const c = relativeColumns(plan, sel, tag);
  if (c.length === 0 && sel.kind === 'ids' && sel.ids.length > 0) {
    return tag.filter((x) => x.kind === 'planning');
  }
  return c;
}

export interface Element {
  readonly entryId: Id;
  readonly date: IsoDate;
  readonly spalten: readonly Id[];
  readonly spanne: Spanne;
  readonly createdSeq: number;
}

/** Blockartige Elemente (Block, Rapport-Block) eines Tages mit Spalten und gezeichneter Spanne. */
export function blockartige(
  plan: Plan,
  weekId: Id,
  date: IsoDate,
  template: LevelTemplate,
): Element[] {
  const aus: Element[] = [];
  for (const e of Object.values(plan.entries)) {
    if (e.type !== 'block' && !(e.type === 'rapport' && e.display !== 'rapColumn')) continue;
    const sp = gezeichneteSpanne(e, date, plan, template);
    const s = sp[0];
    if (s === undefined) continue;
    const sel = e.type === 'block' ? e.columns : e.displayColumns;
    const c = spaltenAm(plan, weekId, date, sel);
    if (c.length === 0) continue;
    aus.push({
      entryId: e.id,
      date,
      spalten: c.map((x) => x.id),
      spanne: s,
      createdSeq: e.createdSeq,
    });
  }
  return aus;
}

function spaeter(x: Element, e: Element): boolean {
  if (x.createdSeq !== e.createdSeq) return x.createdSeq > e.createdSeq;
  return x.entryId > e.entryId;
}

function teilmenge(a: readonly Id[], b: readonly Id[]): boolean {
  return a.every((x) => b.includes(x));
}

function gleich(a: readonly Id[], b: readonly Id[]): boolean {
  return a.length === b.length && teilmenge(a, b);
}

/** Ausnahmen eines Elements (2d Nr 2): C_X ⊊ C_E, oder teilweise gemeinsam und X später erfasst. */
export function ausnahmen(e: Element, alle: readonly Element[]): Element[] {
  return alle.filter((x) => {
    if (x.entryId === e.entryId) return false;
    if (!(x.spanne.from < e.spanne.to && e.spanne.from < x.spanne.to)) return false;
    if (!x.spalten.some((c) => e.spalten.includes(c))) return false;
    if (gleich(x.spalten, e.spalten)) return false;
    if (teilmenge(x.spalten, e.spalten)) return true;
    if (teilmenge(e.spalten, x.spalten)) return false;
    return spaeter(x, e);
  });
}

/**
 * Stelle k und Zahl n der Stellen jedes Elements in seiner Gruppe «Nebeneinander» (2d Nr 2): Elemente mit gleichem C,
 * über Zeitüberschneidung zusammenhängend; Reihenfolge (a, createdSeq, id); kleinste Stelle ohne Überschneidung.
 */
export function stellen(els: readonly Element[]): Map<Id, { k: number; n: number }> {
  const aus = new Map<Id, { k: number; n: number }>();
  const nachC = new Map<string, Element[]>();
  for (const e of els) {
    const key = [...e.spalten].sort().join('|');
    nachC.set(key, [...(nachC.get(key) ?? []), e]);
  }
  for (const gruppe of nachC.values()) {
    const offen = [...gruppe];
    while (offen.length > 0) {
      const komp: Element[] = [offen.shift() as Element];
      for (let i = 0; i < komp.length; i++) {
        const x = komp[i] as Element;
        for (let j = offen.length - 1; j >= 0; j--) {
          const y = offen[j] as Element;
          if (y.spanne.from < x.spanne.to && x.spanne.from < y.spanne.to) {
            komp.push(y);
            offen.splice(j, 1);
          }
        }
      }
      komp.sort(
        (p, q) =>
          p.spanne.from - q.spanne.from ||
          p.createdSeq - q.createdSeq ||
          (p.entryId < q.entryId ? -1 : p.entryId > q.entryId ? 1 : 0),
      );
      const platz: Element[][] = [];
      const stelle = new Map<Id, number>();
      for (const e of komp) {
        let k = 0;
        while (
          (platz[k] ?? []).some((x) => x.spanne.from < e.spanne.to && e.spanne.from < x.spanne.to)
        )
          k++;
        platz[k] = [...(platz[k] ?? []), e];
        stelle.set(e.entryId, k);
      }
      for (const e of komp) aus.set(e.entryId, { k: stelle.get(e.entryId) ?? 0, n: platz.length });
    }
  }
  return aus;
}

// ---------------------------------------------------------------------------------------------------------
// Prüfung R-7-06 / R-4.6-51 (H5 a bis e)
// ---------------------------------------------------------------------------------------------------------

export interface ZeitFlaeche {
  readonly entryId: Id;
  readonly date: IsoDate;
  readonly rect: Rect;
  readonly art: 'block' | 'rapportBox' | 'besoBox';
}

export interface TagSpalten {
  readonly date: IsoDate;
  readonly spalten: readonly {
    readonly id: Id;
    readonly kind: Column['kind'];
    readonly x: number;
    readonly w: number;
  }[];
}

export interface MarkerAchse {
  readonly date: IsoDate;
  readonly y: number;
}

export interface Skalierung {
  readonly yTop: number;
  readonly ptPerMinute: number;
  readonly fromMin: number;
}

function y(s: Skalierung, t: number): number {
  return s.yTop + (t - s.fromMin) * s.ptPerMinute;
}

function xSchnitt(r: Rect, c: { x: number; w: number }): number {
  return Math.min(r.x + r.w, c.x + c.w) - Math.max(r.x, c.x);
}

/** Deckt die Vereinigung der Intervalle [a, b] ab (Lücken ≤ tol)? */
function deckt(iv: readonly [number, number][], a: number, b: number, tol: number): boolean {
  const s = iv
    .map(([p, q]): [number, number] => [Math.max(p, a), Math.min(q, b)])
    .filter(([p, q]) => q > p)
    .sort((p, q) => p[0] - q[0]);
  let bis = a;
  for (const [p, q] of s) {
    if (p > bis + tol) return false;
    bis = Math.max(bis, q);
  }
  return bis >= b - tol;
}

function fensterSpalteVorhanden(
  plan: Plan,
  weekId: Id,
  b: Beso,
  i: number,
  tag: TagSpalten,
): boolean {
  const w = b.windows[i];
  if (w === undefined) return false;
  const besoDa = tag.spalten.some((c) => c.kind === 'beso');
  if (w.columnId === null || (w.time.form === 'deadline' && w.time.to === undefined)) return besoDa;
  const c = spaltenAm(plan, weekId, tag.date, { kind: 'ids', ids: [w.columnId] }).filter(
    (x) => x.kind === 'planning' || x.kind === 'secondary',
  );
  return c.length > 0 || besoDa;
}

/**
 * Verstösse gegen H5 (a) bis (d), Toleranz `tol` (0,1 pt). `tage` nennt je sichtbarem Tag die Spalten mit
 * x-Bereich (aus dem PDF bzw. aus `GridLayout.days`), `flaechen` die Flächen je Eintrag und Tag, `achsen` die
 * Achsen der Markerlinien. Querbalken sind ausgenommen (e).
 */
export function zeitlageVerstoesse(
  plan: Plan,
  weekId: Id,
  template: LevelTemplate,
  skala: Skalierung,
  tage: readonly TagSpalten[],
  flaechen: readonly ZeitFlaeche[],
  achsen: readonly MarkerAchse[],
  tol = 0.1,
): string[] {
  const aus: string[] = [];
  for (const tag of tage) {
    const d = tag.date;
    const els = blockartige(plan, weekId, d, template);
    for (const e of els) {
      const eigene = flaechen.filter(
        (f) => f.art === 'block' && f.entryId === e.entryId && f.date === d,
      );
      const yA = y(skala, e.spanne.from);
      const yB = y(skala, e.spanne.to);
      const aus2 = ausnahmen(e, els);
      const kanten = [
        yA,
        yB,
        ...aus2.flatMap((x) => [y(skala, x.spanne.from), y(skala, x.spanne.to)]),
      ];
      for (const f of eigene) {
        if (f.rect.y < yA - tol || f.rect.y + f.rect.h > yB + tol) {
          aus.push(`(a) ${e.entryId} ${d}: Fläche ausserhalb [y(a), y(b)]`);
        }
        for (const k of [f.rect.y, f.rect.y + f.rect.h]) {
          if (!kanten.some((z) => Math.abs(z - k) <= tol)) {
            aus.push(
              `(b) ${e.entryId} ${d}: Kante ${k.toFixed(2)} nicht auf y(a), y(b) oder Ausnahmegrenze`,
            );
          }
        }
      }
      // Stelle im «Nebeneinander»: Das Element belegt in jedem Lauf nur sein Band (Lauf-x + k·Laufbreite/n).
      const st = stellen(els).get(e.entryId) ?? { k: 0, n: 1 };
      const reihe = tag.spalten.filter((c) => e.spalten.includes(c.id));
      const laeufe: (typeof reihe)[] = [];
      for (const c of reihe) {
        const i = tag.spalten.indexOf(c);
        const letzter = laeufe[laeufe.length - 1];
        const vorher = letzter?.[letzter.length - 1];
        if (letzter !== undefined && vorher !== undefined && tag.spalten.indexOf(vorher) === i - 1)
          letzter.push(c);
        else laeufe.push([c]);
      }
      for (const lauf of laeufe) {
        const lx = (lauf[0] as { x: number }).x;
        const ende = lauf[lauf.length - 1] as { x: number; w: number };
        const lw = ende.x + ende.w - lx;
        const band = { x: lx + (st.k * lw) / st.n, w: lw / st.n };
        for (const sp of lauf) {
          const bx0 = Math.max(sp.x, band.x);
          const bx1 = Math.min(sp.x + sp.w, band.x + band.w);
          if (bx1 - bx0 <= 0.1) continue;
          const teil = { x: bx0, w: bx1 - bx0 };
          const iv: [number, number][] = [];
          for (const f of eigene)
            if (xSchnitt(f.rect, teil) > 0.1) iv.push([f.rect.y, f.rect.y + f.rect.h]);
          for (const x of aus2) {
            if (x.spalten.includes(sp.id))
              iv.push([y(skala, x.spanne.from), y(skala, x.spanne.to)]);
          }
          if (!deckt(iv, yA, yB, tol)) {
            aus.push(
              `(a) ${e.entryId} ${d}: Spalte ${sp.id} nicht durchgehend von y(a) bis y(b) belegt`,
            );
          }
        }
      }
    }
    for (const e of Object.values(plan.entries)) {
      if (e.type === 'rapport' && e.display !== 'onlyInColumns') {
        const s = gezeichneteSpanne(e, d, plan, template)[0];
        const boxen = flaechen.filter(
          (f) => f.art === 'rapportBox' && f.entryId === e.id && f.date === d,
        );
        if (s === undefined) {
          if (boxen.length > 0) aus.push(`(c) Rapport ${e.id} ${d}: Kästchen ohne Spanne`);
          continue;
        }
        if (tag.spalten.some((c) => c.kind === 'rap') && boxen.length === 0) {
          aus.push(`(c) Rapport ${e.id} ${d}: kein Kästchen`);
        }
        for (const f of boxen) {
          if (!pruefeKanten(f.rect, y(skala, s.from), y(skala, s.to), tol)) {
            aus.push(`(c) Rapport ${e.id} ${d}: Kanten nicht auf der Spanne`);
          }
        }
      }
      if (e.type === 'beso') {
        const sp = gezeichneteSpanne(e, d, plan, template);
        const boxen = flaechen.filter(
          (f) => f.art === 'besoBox' && f.entryId === e.id && f.date === d,
        );
        const erwartet = sp.filter((_, i) =>
          fensterSpalteVorhanden(plan, weekId, e, i, tag),
        ).length;
        if (e.date === d && boxen.length !== erwartet) {
          aus.push(`(c) Beso ${e.id} ${d}: ${boxen.length} Kästchen statt ${erwartet}`);
        }
        for (const f of boxen) {
          if (!sp.some((s) => pruefeKanten(f.rect, y(skala, s.from), y(skala, s.to), tol))) {
            aus.push(`(c) Beso ${e.id} ${d}: Kanten auf keinem Zeitfenster`);
          }
        }
      }
    }
    const erwarteteAchsen = Object.values(plan.entries)
      .filter((e): e is Extract<Entry, { type: 'marker' }> => e.type === 'marker' && e.date === d)
      .filter((m) => spaltenAm(plan, weekId, d, m.columns).length > 0)
      .map((m) => y(skala, (gezeichneteSpanne(m, d, plan, template)[0] as Spanne).from));
    const ist = achsen.filter((a) => a.date === d);
    for (const a of ist) {
      if (!erwarteteAchsen.some((z) => Math.abs(z - a.y) <= tol)) {
        aus.push(`(d) ${d}: Markerlinie bei ${a.y.toFixed(2)} ohne Marker`);
      }
    }
    for (const z of erwarteteAchsen) {
      if (!ist.some((a) => Math.abs(z - a.y) <= tol)) aus.push(`(d) ${d}: Marker ohne Linie`);
    }
  }
  return aus;
}

function pruefeKanten(r: Rect, yA: number, yB: number, tol: number): boolean {
  return Math.abs(r.y - yA) <= tol && Math.abs(r.y + r.h - yB) <= tol;
}
