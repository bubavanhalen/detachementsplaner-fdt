// H-DATEN: Zellen im Terminbereich einer fiktiven Kp-Arbeitsmappe (CR-H-D-02). Die Mappe entsteht mit dem
// Baukasten aus I4; danach werden Zellen unter dem Raster in das Blatt eingefügt. Keine Inhalte aus reference/.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { type ImportOutcome, importKpWorkbook } from '../../../../src/io/wap-import/index';
import { readWorkbook } from '../../../../src/io/xlsx-drawing/index';
import { kpTemplate } from '../../../../src/model/wap/template';
import { buildKpWorkbook, geometryOf, type WeekDef } from '../../fixtures/import/kp-workbook';
import { ctx, freshPlan } from '../import/support';
import { esc } from '../xlsx-drawing/fixture';

/** Lauf einer Zelle mit Rich Text. */
export interface CellRun {
  readonly text: string;
  readonly strike?: boolean;
  readonly bold?: boolean;
  /** «RRGGBB» */
  readonly color?: string;
}

export interface AgendaCell {
  /** Tag 0 = Mo. */
  readonly day: number;
  /** Spalte im Tag (Standard 0). */
  readonly col?: number;
  /** Zeile unter dem Raster, 0 = erste Zeile nach 2400 (Standard 1). */
  readonly row?: number;
  /** Klartext (Zeilenumbruch mit «\n») oder Läufe. */
  readonly text: string | readonly CellRun[];
}

/** Erste Zeile (1-basiert) nach dem Raster: Kopf 6 Zeilen + 80 Rasterzeilen. */
const FIRST_AGENDA_ROW = 87;

function colName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellXml(ref: string, text: string | readonly CellRun[]): string {
  if (typeof text === 'string')
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
  const runs = text
    .map((r) => {
      const pr = [
        r.bold ? '<b/>' : '',
        r.strike ? '<strike/>' : '',
        r.color ? `<color rgb="FF${r.color}"/>` : '',
      ].join('');
      return `<r>${pr === '' ? '' : `<rPr>${pr}</rPr>`}<t xml:space="preserve">${esc(r.text)}</t></r>`;
    })
    .join('');
  return `<c r="${ref}" t="inlineStr"><is>${runs}</is></c>`;
}

/** Mappe aus `weeks`, im ersten Blatt ergänzt um Zellen im Terminbereich. */
export function workbookWithAgendaCells(
  weeks: readonly WeekDef[],
  cells: readonly AgendaCell[],
): Uint8Array {
  const week = weeks[0];
  if (week === undefined) throw new Error('mindestens eine Woche');
  const g = geometryOf(week);
  const files = unzipSync(buildKpWorkbook(weeks));
  const path = 'xl/worksheets/sheet1.xml';
  const xml = strFromU8(files[path] ?? new Uint8Array());
  const rows = new Map<number, string[]>();
  for (const c of cells) {
    const r = FIRST_AGENDA_ROW + (c.row ?? 1);
    const ref = `${colName((g.dayStart[c.day] ?? 0) + (c.col ?? 0))}${String(r)}`;
    rows.set(r, [...(rows.get(r) ?? []), cellXml(ref, c.text)]);
  }
  const added = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([r, cs]) => `<row r="${String(r)}">${cs.join('')}</row>`)
    .join('');
  files[path] = strToU8(xml.replace('</sheetData>', `${added}</sheetData>`));
  return zipSync(files, { level: 6, mtime: new Date(Date.UTC(2030, 0, 7, 12)) });
}

export function importWithAgendaCells(
  weeks: readonly WeekDef[],
  cells: readonly AgendaCell[],
): ImportOutcome {
  const target = freshPlan(weeks[0]?.monday);
  return importKpWorkbook(
    target,
    readWorkbook(workbookWithAgendaCells(weeks, cells)),
    'fiktiv.xlsx',
    { template: kpTemplate(), persons: [], functionList: target.functionList },
    ctx,
  );
}
