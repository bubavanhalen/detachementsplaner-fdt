// Workbook → sheet → drawing resolution via the package relationships. Only the
// XML parts the parser needs are decompressed; media and printer settings stay packed.
import { strFromU8, unzipSync } from 'fflate';
import { child, children, parseXml, WapError } from './xml';

export interface WapPackage {
  has(path: string): boolean;
  text(path: string): string | null;
  xml(path: string): Document | null;
}

const NEEDED = /\.(?:xml|rels)$/i;

export function openPackage(bytes: Uint8Array): WapPackage {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (file) => NEEDED.test(file.name) });
  } catch {
    throw new WapError('Die Datei konnte nicht als Excel-Arbeitsmappe (.xlsx) gelesen werden.');
  }
  const lookup = new Map(Object.keys(files).map((name) => [name.toLowerCase(), name]));
  const find = (path: string): Uint8Array | undefined => {
    const clean = path.replace(/^\/+/, '');
    const name = lookup.get(clean.toLowerCase());
    return name ? files[name] : undefined;
  };
  const cache = new Map<string, Document | null>();
  return {
    has: (path) => !!find(path),
    text: (path) => {
      const data = find(path);
      return data ? strFromU8(data) : null;
    },
    xml(path) {
      const key = path.toLowerCase();
      if (cache.has(key)) return cache.get(key) ?? null;
      const data = find(path);
      const doc = data ? parseXml(strFromU8(data)) : null;
      cache.set(key, doc);
      return doc;
    },
  };
}

/** Resolves a relationship target against the directory of the source part. */
export function resolveTarget(sourcePart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const base = sourcePart.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') base.pop();
    else if (segment && segment !== '.') base.push(segment);
  }
  return base.join('/');
}

export const relsPath = (part: string): string => {
  const parts = part.split('/');
  const file = parts.pop() ?? '';
  return [...parts, '_rels', `${file}.rels`].join('/');
};

export interface Relationship {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

export function relationships(pkg: WapPackage, part: string): Relationship[] {
  const doc = pkg.xml(relsPath(part));
  if (!doc) return [];
  return children(doc.documentElement, 'Relationship').map((rel) => {
    const external = rel.getAttribute('TargetMode') === 'External';
    const target = rel.getAttribute('Target') ?? '';
    return {
      id: rel.getAttribute('Id') ?? '',
      type: rel.getAttribute('Type') ?? '',
      target: external ? target : resolveTarget(part, target),
      external,
    };
  });
}

export interface WorkbookSheet {
  name: string;
  path: string;
  hidden: boolean;
}

const WORKBOOK_TYPE = /\/officeDocument$/;

export function workbookPath(pkg: WapPackage): string {
  const root = relationships(pkg, '').find((rel) => WORKBOOK_TYPE.test(rel.type));
  if (root && pkg.has(root.target)) return root.target;
  if (pkg.has('xl/workbook.xml')) return 'xl/workbook.xml';
  throw new WapError('Die Datei enthält keine Excel-Arbeitsmappe.');
}

export function workbookSheets(pkg: WapPackage): WorkbookSheet[] {
  const path = workbookPath(pkg);
  const doc = pkg.xml(path);
  if (!doc) throw new WapError('Die Datei enthält keine Excel-Arbeitsmappe.');
  const rels = relationships(pkg, path);
  const sheets = child(doc.documentElement, 'sheets');
  return children(sheets, 'sheet')
    .map((sheet) => {
      const id =
        sheet.getAttributeNS(
          'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
          'id',
        ) ??
        sheet.getAttribute('r:id') ??
        '';
      const rel = rels.find((r) => r.id === id);
      return {
        name: sheet.getAttribute('name') ?? '',
        path: rel && /\/worksheet$/.test(rel.type) ? rel.target : '',
        hidden: /hidden/i.test(sheet.getAttribute('state') ?? ''),
      };
    })
    .filter((sheet) => sheet.name && sheet.path);
}

/** True when the workbook uses the 1904 date system. */
export function uses1904(pkg: WapPackage): boolean {
  const doc = pkg.xml(workbookPath(pkg));
  const pr = doc ? child(doc.documentElement, 'workbookPr') : undefined;
  return /^(?:1|true)$/i.test(pr?.getAttribute('date1904') ?? '');
}

export interface ResolvedSheet {
  name: string;
  sheetPath: string;
  drawingPath: string | null;
  sharedStringsPath: string | null;
  stylesPath: string | null;
  themePath: string | null;
}

export function resolveSheet(pkg: WapPackage, name: string): ResolvedSheet {
  const sheet = workbookSheets(pkg).find((s) => s.name === name);
  if (!sheet) throw new WapError('Das gewählte Tabellenblatt wurde in der Datei nicht gefunden.');
  const wb = workbookPath(pkg);
  const wbRels = relationships(pkg, wb);
  const byType = (suffix: string) =>
    wbRels.find((rel) => rel.type.endsWith(suffix) && pkg.has(rel.target))?.target ?? null;
  const drawing =
    relationships(pkg, sheet.path).find(
      (rel) => rel.type.endsWith('/drawing') && !rel.external && pkg.has(rel.target),
    )?.target ?? null;
  return {
    name,
    sheetPath: sheet.path,
    drawingPath: drawing,
    sharedStringsPath: byType('/sharedStrings'),
    stylesPath: byType('/styles'),
    themePath: byType('/theme'),
  };
}
