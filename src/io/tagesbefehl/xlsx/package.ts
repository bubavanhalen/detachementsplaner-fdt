// OPC package helpers: parts, relationships and content types of an unzipped xlsx.
import { strFromU8, strToU8 } from 'fflate';
import { escapeXml, getAttr } from './sheet';

export type PackageFiles = Record<string, Uint8Array>;

export const CONTENT_TYPES = '[Content_Types].xml';

export function readPart(files: PackageFiles, path: string): string | undefined {
  const data = files[path];
  return data ? strFromU8(data).replace(/^﻿/, '') : undefined;
}
export function writePart(files: PackageFiles, path: string, xml: string): void {
  files[path] = strToU8(xml);
}

export function relsPathFor(part: string): string {
  const slash = part.lastIndexOf('/');
  return `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`;
}

/** Resolves a relationship target relative to its source part. */
export function resolveTarget(sourcePart: string, target: string): string {
  const decoded = target.replace(/\\/g, '/');
  const segments = decoded.startsWith('/')
    ? []
    : sourcePart.split('/').slice(0, -1).filter(Boolean);
  for (const segment of decoded.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return segments.join('/');
}

export interface Relationship {
  id: string;
  type: string;
  target: string;
  external: boolean;
  xml: string;
}

export function parseRels(xml: string | undefined): Relationship[] {
  if (!xml) return [];
  return [...xml.matchAll(/<Relationship\b([^>]*?)\/?>(?:<\/Relationship>)?/g)].map((m) => ({
    id: getAttr(m[1], 'Id') ?? '',
    type: getAttr(m[1], 'Type') ?? '',
    target: getAttr(m[1], 'Target') ?? '',
    external: getAttr(m[1], 'TargetMode') === 'External',
    xml: m[0],
  }));
}

/** Relationships of a part with their resolved package paths. */
export function partRels(
  files: PackageFiles,
  part: string,
): (Relationship & { path: string | undefined })[] {
  return parseRels(readPart(files, relsPathFor(part))).map((rel) => ({
    ...rel,
    path: rel.external ? undefined : resolveTarget(part, rel.target),
  }));
}

export const relTypeIs = (rel: Pick<Relationship, 'type'>, name: string): boolean =>
  rel.type.endsWith(`/${name}`);

/** Removes relationships matching `drop` from the part's .rels file. */
export function dropRels(
  files: PackageFiles,
  part: string,
  drop: (rel: Relationship) => boolean,
): Relationship[] {
  const path = relsPathFor(part);
  const xml = readPart(files, path);
  if (!xml) return [];
  const removed = parseRels(xml).filter(drop);
  if (!removed.length) return [];
  let next = xml;
  for (const rel of removed) next = next.replace(rel.xml, '');
  writePart(files, path, next);
  return removed;
}

/** Deletes a part, its own .rels and its content-type override. */
export function removePart(files: PackageFiles, part: string): void {
  delete files[part];
  delete files[relsPathFor(part)];
  const ct = readPart(files, CONTENT_TYPES);
  if (!ct) return;
  const escaped = `/${part}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  writePart(
    files,
    CONTENT_TYPES,
    ct.replace(
      new RegExp(`<Override\\b[^>]*PartName="${escaped}"[^>]*?(?:/>|></Override>)`, 'g'),
      '',
    ),
  );
}

/** Makes sure a Default content type exists for an extension (e.g. png). */
export function ensureDefaultContentType(
  files: PackageFiles,
  extension: string,
  contentType: string,
): void {
  const ct = readPart(files, CONTENT_TYPES);
  if (!ct || new RegExp(`<Default\\b[^>]*Extension="${extension}"`, 'i').test(ct)) return;
  writePart(
    files,
    CONTENT_TYPES,
    ct.replace(
      /<Types\b[^>]*>/,
      (open) =>
        `${open}<Default Extension="${escapeXml(extension)}" ContentType="${escapeXml(contentType)}"/>`,
    ),
  );
}

/** Override part names (without leading slash) and default extensions. */
export function contentTypeIndex(files: PackageFiles): {
  overrides: Set<string>;
  defaults: Set<string>;
} {
  const ct = readPart(files, CONTENT_TYPES) ?? '';
  return {
    overrides: new Set(
      [...ct.matchAll(/<Override\b[^>]*PartName="\/?([^"]+)"/g)].map((m) => decodeURI(m[1])),
    ),
    defaults: new Set(
      [...ct.matchAll(/<Default\b[^>]*Extension="([^"]+)"/g)].map((m) => m[1].toLowerCase()),
    ),
  };
}
