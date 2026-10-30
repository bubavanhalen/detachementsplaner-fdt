// Testhilfen I3: Optionen der Wochenseite (mit Status-Darstellung wie die App) und Seitentexte aus der
// Layout-Schicht (dieselben Zeilen wie im PDF). Nur für Vitest (lädt die Layout-Schicht).
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { PageOptions } from '../../../../src/model/wap/layout/page/types';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Id, Plan } from '../../../../src/model/wap/types';

export function pageOptions(over: Partial<PageOptions> = {}): PageOptions {
  return {
    paper: 'A4',
    showStatus: true,
    statusRendering: true,
    templates: builtInTemplates(),
    ...over,
  };
}

/** Alle Textzeilen der Wochenseite (Layout-Schicht, dieselben Zeilen wie im PDF). */
export function pageTexts(
  plan: Plan,
  id: Id,
  opts: PageOptions = pageOptions(),
): readonly string[] {
  const layout = layoutWeekPage(plan, id, opts);
  const out: string[] = [];
  for (const page of layout.pages)
    for (const item of page.items)
      if (item.kind === 'text') out.push(item.runs.map((r) => r.text).join(''));
  return out;
}
