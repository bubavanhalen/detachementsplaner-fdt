// Small DOM helpers for SpreadsheetML / DrawingML. Elements are matched by local
// name only; the WAP parts use stable prefixes and no conflicting local names.

/** Generic, data-free error for the local interface. Never carries file content. */
export class WapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WapError';
  }
}

export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length)
    throw new WapError('Die Datei enthält ungültige XML-Daten und kann nicht gelesen werden.');
  return doc;
}

export const children = (el: Element | null | undefined, local?: string): Element[] =>
  el ? [...el.children].filter((child) => !local || child.localName === local) : [];

export const child = (el: Element | null | undefined, local: string): Element | undefined =>
  el ? [...el.children].find((c) => c.localName === local) : undefined;

/** First descendant with this local name (depth first). */
export function descendant(el: Element | null | undefined, local: string): Element | undefined {
  if (!el) return undefined;
  return el.getElementsByTagNameNS('*', local)[0] ?? undefined;
}

export const descendants = (el: Element | null | undefined, local: string): Element[] =>
  el ? [...el.getElementsByTagNameNS('*', local)] : [];

export function num(el: Element | null | undefined, attr: string, fallback = 0): number {
  const raw = el?.getAttribute(attr);
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const numText = (el: Element | null | undefined, fallback = 0): number => {
  const value = Number(el?.textContent ?? '');
  return el && Number.isFinite(value) ? value : fallback;
};

/** Decodes the five XML entities (for small regex-parsed fragments). */
export const unescapeXml = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

/** Attributes of the first tag in a small XML fragment (regex, no DOM). */
export function tagAttributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:]+)="([^"]*)"/g)) out[match[1]] = unescapeXml(match[2]);
  return out;
}
