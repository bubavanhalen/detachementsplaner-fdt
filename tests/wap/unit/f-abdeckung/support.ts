// F-ABDECKUNG: fiktive Kp-Arbeitsmappen aus dem Baukasten von I4 mit gezielten Änderungen am Blatt (zusätzliche
// Zellen, Spaltenbreiten, 1904-Datumssystem, ausgeblendetes Blatt) für Grenzfälle des Imports. Keine Inhalte aus
// reference/.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { type ImportOutcome, importKpWorkbook } from '../../../../src/io/wap-import/index';
import { readWorkbook } from '../../../../src/io/xlsx-drawing/index';
import { kpTemplate, type LevelTemplate } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { buildKpWorkbook, type WeekDef } from '../../fixtures/import/kp-workbook';
import { ctx, freshPlan } from '../import/support';
import { esc } from '../xlsx-drawing/fixture';

/** Zusätzliche Zelle (0-basierte Zeile und Spalte) im Blatt `sheet` (0-basiert). */
export interface ExtraCell {
  readonly sheet?: number;
  readonly row: number;
  readonly col: number;
  readonly text?: string;
  readonly value?: number;
}

export interface WorkbookEdits {
  readonly cells?: readonly ExtraCell[];
  /** Spaltenbreiten in Zeichen je 0-basierter Spalte (ersetzt <cols>), übrige Spalten 12. */
  readonly widths?: Readonly<Record<number, number>>;
  readonly date1904?: boolean;
  /** 0-basierte Indizes ausgeblendeter Blätter. */
  readonly hiddenSheets?: readonly number[];
  /** Verbundene Zellen im ersten Blatt, z.B. «A88:C88». */
  readonly merges?: readonly string[];
  /** Textersetzungen im XML des ersten Blatts (z.B. eine Kopfzelle entfernen). */
  readonly replace?: readonly (readonly [string, string])[];
}

export function colName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellXml(c: ExtraCell): string {
  const ref = `${colName(c.col)}${String(c.row + 1)}`;
  if (c.value !== undefined) return `<c r="${ref}"><v>${String(c.value)}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(c.text ?? '')}</t></is></c>`;
}

/** Fügt Zellen in vorhandene bzw. neue Zeilen ein (Zeilen bleiben aufsteigend). */
function withCells(xml: string, cells: readonly ExtraCell[]): string {
  let out = xml;
  const byRow = new Map<number, ExtraCell[]>();
  for (const c of cells) byRow.set(c.row + 1, [...(byRow.get(c.row + 1) ?? []), c]);
  for (const [r, cs] of byRow) {
    const add = cs.map(cellXml).join('');
    const re = new RegExp(`<row r="${String(r)}"([^>]*)>(.*?)</row>`);
    if (re.test(out))
      out = out.replace(
        re,
        (_, attrs: string, inner: string) => `<row r="${String(r)}"${attrs}>${inner}${add}</row>`,
      );
    else {
      // Neue Zeile vor der ersten Zeile mit grösserer Nummer.
      const rows = [...out.matchAll(/<row r="(\d+)"/g)].map((m) => ({
        n: Number(m[1]),
        i: m.index,
      }));
      const next = rows.find((x) => x.n > r);
      const row = `<row r="${String(r)}">${add}</row>`;
      out =
        next === undefined
          ? out.replace('</sheetData>', `${row}</sheetData>`)
          : `${out.slice(0, next.i)}${row}${out.slice(next.i)}`;
    }
  }
  return out;
}

/** Arbeitsmappe aus `weeks` mit den Änderungen `edits`. */
export function editedWorkbook(weeks: readonly WeekDef[], edits: WorkbookEdits): Uint8Array {
  const files = unzipSync(buildKpWorkbook(weeks));
  weeks.forEach((_, i) => {
    const path = `xl/worksheets/sheet${String(i + 1)}.xml`;
    let xml = strFromU8(files[path] ?? new Uint8Array());
    const cells = (edits.cells ?? []).filter((c) => (c.sheet ?? 0) === i);
    if (cells.length > 0) xml = withCells(xml, cells);
    if (edits.widths !== undefined && i === 0) {
      const max = Math.max(40, ...Object.keys(edits.widths).map(Number)) + 1;
      const cols = Array.from({ length: max }, (_, c) => {
        const w = edits.widths?.[c] ?? 12;
        return `<col min="${String(c + 1)}" max="${String(c + 1)}" width="${String(w)}" customWidth="1"/>`;
      }).join('');
      xml = xml.replace(/<cols>.*?<\/cols>/, `<cols>${cols}</cols>`);
    }
    if (i === 0) {
      for (const [from, to] of edits.replace ?? []) xml = xml.split(from).join(to);
      if (edits.merges !== undefined && edits.merges.length > 0) {
        const m = edits.merges.map((r) => `<mergeCell ref="${r}"/>`).join('');
        xml = xml.replace(
          '</sheetData>',
          `</sheetData><mergeCells count="${String(edits.merges.length)}">${m}</mergeCells>`,
        );
      }
    }
    files[path] = strToU8(xml);
  });
  let wb = strFromU8(files['xl/workbook.xml'] ?? new Uint8Array());
  if (edits.date1904) wb = wb.replace('<sheets>', '<workbookPr date1904="1"/><sheets>');
  for (const h of edits.hiddenSheets ?? []) {
    let k = -1;
    wb = wb.replace(/<sheet /g, (m) => {
      k += 1;
      return k === h ? '<sheet state="hidden" ' : m;
    });
  }
  files['xl/workbook.xml'] = strToU8(wb);
  return zipSync(files, { level: 6, mtime: new Date(Date.UTC(2030, 0, 7, 12)) });
}

/** Import der geänderten Mappe in einen frischen Kp-Plan (Montag der ersten Woche). */
export function importEdited(
  weeks: readonly WeekDef[],
  edits: WorkbookEdits,
  over: { readonly target?: (p: Plan) => Plan; readonly template?: LevelTemplate } = {},
): ImportOutcome {
  const fresh = freshPlan(weeks[0]?.monday);
  const target = over.target === undefined ? fresh : over.target(fresh);
  return importKpWorkbook(
    target,
    readWorkbook(editedWorkbook(weeks, edits)),
    'fiktiv.xlsx',
    { template: over.template ?? kpTemplate(), persons: [], functionList: target.functionList },
    ctx,
  );
}
