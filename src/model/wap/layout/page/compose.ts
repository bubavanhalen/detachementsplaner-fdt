// Wochenseite zusammensetzen (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt A, B, D, F, G;
// Beschrieb 10; ADR-004, Leitplanke 2). Rein und deterministisch (R-L-02).

import { requireWeek } from '../../derive/columns';
import { templateById } from '../../template';
import type { Id, Plan } from '../../types';
import { layoutGrid } from '../grid';
import type { PageItem, PageModel } from '../pageModel';
import { a3Unavailable } from './a3Stub';
import { agendaFlow, agendaPart } from './agendaParts';
import { readCoatOfArms } from './coatOfArms';
import { rectItem } from './common';
import { continuationChrome } from './continuation';
import { pageFrame, pageGeometryFor } from './geometry';
import { layoutGridChrome } from './gridChrome';
import { layoutHeader } from './header';
import { sidebarFlow } from './sidebarParts';
import type {
  LayoutWarning,
  PageContext,
  PageFallbackEvent,
  PageOptions,
  PageTextRef,
  RegionLayout,
  WeekPageLayout,
} from './types';
import { textWarnings } from './warnings';

/** Seite aus Rahmen und Bereichen in der Reihenfolge D; `grid` = GridLayout.items an Stelle 4. */
function assemble(
  ctx: PageContext,
  index: number,
  kind: PageModel['kind'],
  before: readonly RegionLayout[],
  gridItems: readonly PageItem[],
  after: readonly RegionLayout[],
  refs: PageTextRef[],
): PageModel {
  const g = ctx.geometry;
  const items: PageItem[] = [rectItem('frame', ctx.frame.frame, null, g.frameStroke)];
  const region = (r: RegionLayout): void => {
    const offset = items.length;
    items.push(...r.items);
    for (const t of r.texts) {
      refs.push({
        page: index,
        item: offset + t.item,
        kind: t.kind,
        standardSizePt: t.standardSizePt,
        date: t.date,
      });
    }
  };
  for (const r of before) region(r);
  for (const it of gridItems) {
    items.push(it);
    if (it.kind === 'text') {
      refs.push({
        page: index,
        item: items.length - 1,
        kind: 'entry',
        standardSizePt: null,
        date: null,
      });
    }
  }
  for (const r of after) region(r);
  return { widthPt: g.paper.widthPt, heightPt: g.paper.heightPt, kind, items };
}

/**
 * Wochenseite und Fortsetzungsseiten mit Raster, Bereichen, Texten, Rückfallereignissen und Warnungen.
 * Fehler in dieser Reihenfolge: ModelError 'unknownWeek'; ModelError 'unknownTemplate';
 * PageLayoutError 'unknownPageGeometry'; bei paper 'A3' Stub-Fehler layout.page.a3 bis E1-10; danach
 * die Fehler von layoutGrid unverändert (gridFrameTooSmall, invalidDisplayRange, RangeError).
 */
export function layoutWeekPage(plan: Plan, weekId: Id, options: PageOptions): WeekPageLayout {
  const week = requireWeek(plan, weekId);
  const template = templateById(plan.templateId, options.templates);
  const geometry = pageGeometryFor(template.pageGeometryId);
  // Stub-Fehler bis E1-10 (Vertrag B «Fehlerverhalten» Nr 4); E1-10 ersetzt ihn durch a3(layout).
  if (options.paper === 'A3') throw a3Unavailable();
  const frame = pageFrame(geometry, plan, weekId, template);
  const grid = layoutGrid({
    plan,
    weekId,
    template,
    frame: frame.grid,
    showStatus: options.showStatus,
    ...(options.changedEntryIds === undefined ? {} : { changedEntryIds: options.changedEntryIds }),
  });
  const ctx: PageContext = { plan, week, template, geometry, frame, options };

  const header = layoutHeader(ctx, 'week');
  const chrome = layoutGridChrome(ctx, grid);
  const agenda = agendaFlow(ctx, grid);
  // Wappen je Aufruf einmal dekodieren (CR-E102e-04): Seitenleiste und Warnung invalidImage.
  const coat = plan.coatOfArms === null ? null : readCoatOfArms(plan.coatOfArms);
  const sidebar = sidebarFlow(ctx, coat);
  const pageCount = Math.max(agenda.pages.length, sidebar.parts.length);
  const agendaParts = Array.from({ length: pageCount }, (_, i) =>
    agendaPart(ctx, agenda, i, i === 0),
  );
  const empty: RegionLayout = { items: [], texts: [], fallbacks: [] };

  const refs: PageTextRef[] = [];
  const pages: PageModel[] = [
    assemble(
      ctx,
      0,
      'week',
      [header, chrome],
      grid.items,
      [agendaParts[0] ?? empty, sidebar.parts[0] ?? empty],
      refs,
    ),
  ];
  const continuationEvents: PageFallbackEvent[] = [];
  for (let i = 1; i < pageCount; i++) {
    const head = layoutHeader(ctx, 'continuation');
    if (i === 1)
      continuationEvents.push(...head.fallbacks.filter((e) => e.field === 'continuationTitle'));
    pages.push(
      assemble(
        ctx,
        i,
        'continuation',
        [head, continuationChrome(ctx, grid)],
        [],
        [agendaParts[i] ?? empty, sidebar.parts[i] ?? empty],
        refs,
      ),
    );
  }

  // F: Kopf, Rasterkopf, GridLayout.fallbacks unverändert, Termine, Seitenleiste.
  const fallbacks: PageFallbackEvent[] = [
    ...header.fallbacks,
    ...continuationEvents,
    ...chrome.fallbacks,
    ...grid.fallbacks.map((e): PageFallbackEvent => ({ ...e, field: null, columnId: null })),
    ...agendaParts.flatMap((p) => p.fallbacks),
    ...sidebar.parts.flatMap((p) => p.fallbacks),
  ];

  // G2: Textwarnungen, danach invalidImage.
  const warnings: LayoutWarning[] = [...textWarnings(pages)];
  if (plan.coatOfArms !== null && coat === null) {
    warnings.push({
      code: 'invalidImage',
      character: null,
      codePoint: null,
      entryId: null,
      page: 0,
      item: null,
    });
  }

  return {
    pages,
    grid,
    frame,
    regions: {
      header: frame.header,
      grid: frame.grid.rect,
      sidebar: frame.sidebarUpper,
      agenda: frame.agenda,
    },
    texts: refs,
    fallbacks,
    warnings,
  };
}
