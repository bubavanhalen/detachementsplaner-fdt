// Hilfen der Abläufe (I5 D2, D4; E1-16): Stand-Renderer mit Fortschritt, Änderungen seit dem letzten Stand,
// Texte der Wiederherstellungspunkte. Ohne DOM.

import { renderPlanPdf, renderWeekPdf } from '../../../io/wap-pdf/index';
import type { StandRenderers } from '../../../io/wap-plan/standStore';
import type { RestorePointInfo } from '../../../io/wap-plan/store';
import { structurallyEqual } from '../../../model/wap/commands/command';
import type { PageOptions } from '../../../model/wap/layout/page/types';
import { builtInTemplates } from '../../../model/wap/template';
import type { Entry, Id, Plan } from '../../../model/wap/types';

/** Garantierte Stand-Variante: A4, Status rot (ADR-002 P.6a, Gate-0-Entscheid G-12 a). */
export function standPageOptions(): PageOptions {
  return { paper: 'A4', showStatus: true, statusRendering: true, templates: builtInTemplates() };
}

/** Renderer des Stand-PDF über die PDF-Ausgabe (Vertrag E1-16 §2: nur über die übergebenen Renderer). */
export function defaultStandRenderers(): StandRenderers {
  const options = standPageOptions();
  return {
    week: async (plan, weekId, title) => (await renderWeekPdf(plan, weekId, options, title)).bytes,
    plan: async (plan, title) => (await renderPlanPdf(plan, options, title)).bytes,
  };
}

/** Renderer, die vor jedem PDF den Fortschritt melden («PDF Woche 2 von 4»). */
export function withProgress(
  renderers: StandRenderers,
  onStep: (done: number, label: string) => void,
): StandRenderers {
  let done = 0;
  return {
    week: (plan, weekId, title) => {
      done += 1;
      const index = plan.weeks.findIndex((w) => w.id === weekId) + 1;
      onStep(done, `PDF Woche ${String(index)} von ${String(plan.weeks.length)}`);
      return renderers.week(plan, weekId, title);
    },
    plan: (plan, title) => {
      done += 1;
      onStep(done, 'PDF des ganzen Plans');
      return renderers.plan(plan, title);
    },
  };
}

function withoutMark(e: Entry): Entry {
  return { ...e, changed: false };
}

/** Einträge, die seit dem Stand neu sind oder sich geändert haben, und Zahl der entfernten Einträge. */
export function changesSince(
  current: Plan,
  stand: Plan,
): { readonly changed: readonly Id[]; readonly removed: number } {
  const changed: Id[] = [];
  for (const [id, e] of Object.entries(current.entries)) {
    const before = stand.entries[id];
    if (before === undefined || !structurallyEqual(withoutMark(before), withoutMark(e)))
      changed.push(id);
  }
  let removed = 0;
  for (const id of Object.keys(stand.entries)) if (current.entries[id] === undefined) removed++;
  return { changed: changed.sort(), removed };
}

/** Grund eines Wiederherstellungspunkts (Glossar «Grund (Wiederherstellungspunkt)»). */
export function restoreReasonText(p: RestorePointInfo): string {
  switch (p.reason) {
    case 'daily':
      return 'täglich';
    case 'import':
      return 'vor Import';
    case 'adoption':
      return 'vor Übernahme';
    case 'stand':
      return p.standVersion === null ? 'vor Stand' : `vor Stand V${String(p.standVersion)}`;
    case 'migration':
      return 'vor Update';
    case 'restore':
      return 'vor Wiederherstellung';
    case 'fileReplace':
      return 'vor Ersetzen';
    case 'planDelete':
      return 'vor Löschen';
  }
}

/** «14.10.2026 0932» in lokaler Zeit (Zeit militärisch, Beschrieb 11). */
export function localStamp(iso: string): string {
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(at.getDate())}.${pad(at.getMonth() + 1)}.${String(at.getFullYear())} ${pad(at.getHours())}${pad(at.getMinutes())}`;
}

/** Heutiges Datum (lokal) als yyyy-mm-dd. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
