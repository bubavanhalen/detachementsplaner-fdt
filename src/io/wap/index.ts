import type { TbRule, WapParseResult } from '../../model/tagesbefehl/types';

/** Sheet names of a Kp-WAP workbook in workbook order. STUB — WAP parser work package. */
export function listWapSheets(_bytes: Uint8Array): string[] {
  return [];
}

export interface WapParseOptions {
  rules: readonly TbRule[];
}

/** Parses one WAP sheet (DrawingML layer) locally. STUB — WAP parser work package. */
export function parseWap(
  _bytes: Uint8Array,
  sheet: string,
  _options: WapParseOptions,
): WapParseResult {
  return {
    sheet,
    startDate: '',
    days: [],
    entries: [],
    groups: {},
    conflicts: [],
    notes: { wochenziele: [], bemerkungen: [] },
    diagnostics: [],
  };
}
