import type { TbConflict, TbWeek } from './types';

/**
 * Conflicts that can be recomputed from the reviewed entries alone (overlaps,
 * same function in two places, unknown abbreviations). Parse-time conflicts
 * (label vs position, footnotes) are stored in TbWeek.parseConflicts.
 * STUB — implemented by the WAP parser work package.
 */
export function detectEntryConflicts(_week: TbWeek): TbConflict[] {
  return [];
}
