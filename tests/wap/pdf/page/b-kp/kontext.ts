// Kontext der B-Kp-Prüfer (Paket E1-02e, Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» I «Fixture», H1). Die
// PDF-Seiten entstehen beim ersten Gebrauch im Test (nicht im Aufbau, ADR-010 §3.3) und werden je Testdatei
// gemerkt. Fixture KVK; für Elemente, die in der KVK-Fixture fehlen, die Variante KVK+; eigene Fälle für den
// senkrechten Spaltenkopf (B-Kp-07, -10, -32) und für Einstellungen (B-Kp-36, -37, -89). Alle Varianten fiktiv.
import { formatDate, isoWeek } from '../../../../../src/model/wap/calendar';
import type { WeekPageLayout } from '../../../../../src/model/wap/layout/page/types';
import type { Plan } from '../../../../../src/model/wap/types';
import { analysiere, type SeitenAnalyse } from '../../../support/page/analyse';
import type { Platzhalter } from '../../../support/page/bkp';
import type { Bereiche } from '../../../support/page/pdf-seite';
import { seitePdf } from '../../../support/page/seite';
import { KVK_WOCHE, kvk, kvkPlus, SA, tagDatum, woche } from '../../../support/page/varianten';
import type { PdfInfo } from '../../../support/pdf/read';

export interface Seite {
  readonly plan: Plan;
  readonly weekId: string;
  readonly info: PdfInfo;
  readonly layout: WeekPageLayout;
  readonly an: SeitenAnalyse;
  readonly b: Bereiche;
}

export interface Kontext {
  kvk(): Promise<Seite>;
  plus(): Promise<Seite>;
  senkrecht(): Promise<Seite>;
  variante(name: string, plan: () => Plan): Promise<Seite>;
}

/** KVK mit senkrechtem Kopf der Planungsspalte «Kdo» (Mi–Fr). */
export function senkrechtPlan(): Plan {
  const p = kvk();
  return {
    ...p,
    columnSets: p.columnSets.map((s) =>
      s.id === 's16'
        ? {
            ...s,
            columns: s.columns.map((c) =>
              c.id === 'c17' ? { ...c, labelOrientation: 'vertical' as const } : c,
            ),
          }
        : s,
    ),
  };
}

export function neuerKontext(): Kontext {
  const merk = new Map<string, Promise<Seite>>();
  const hole = (name: string, plan: () => Plan): Promise<Seite> => {
    let p = merk.get(name);
    if (p === undefined) {
      p = (async () => {
        const pl = plan();
        const r = await seitePdf(`bkp-${name}`, pl, KVK_WOCHE);
        const an = analysiere(r.info, pl, KVK_WOCHE);
        return { plan: pl, weekId: KVK_WOCHE, info: r.info, layout: r.layout, an, b: an.b };
      })();
      merk.set(name, p);
    }
    return p;
  };
  return {
    kvk: () => hole('kvk', kvk),
    plus: () => hole('kvk-plus', kvkPlus),
    senkrecht: () => hole('senkrecht', senkrechtPlan),
    variante: hole,
  };
}

/** Ersatzwerte der Platzhalter nach Abschnitt I für die KVK-Woche eines Plans. */
export function platzhalterWerte(plan: Plan): Partial<Record<Platzhalter, readonly string[]>> {
  const w = woche(plan, KVK_WOCHE);
  const c = plan.commander;
  const teile =
    c.nameOrder === 'gradVornameName' ? [c.grad, c.vorname, c.name] : [c.grad, c.name, c.vorname];
  return {
    '<Einheit>': [plan.unit],
    '<Bezeichnung>': [w.label],
    '<dd.mm.yyyy>': [formatDate(w.startDate, 'long'), formatDate(tagDatum(w.startDate, 6), 'long')],
    '<dd.mm.yy>': [formatDate(SA, 'compact')],
    '<nn>': [String(isoWeek(w.startDate))],
    '<…>': [plan.beilage],
    '<Grad Name Vorname>': [teile.filter((t) => t.trim() !== '').join(' ')],
    '<Funktion>': [c.funktion],
  };
}
