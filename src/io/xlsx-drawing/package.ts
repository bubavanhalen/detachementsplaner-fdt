// Internes, begrenztes ZIP-Paket für readWorkbook (Vertrag E1-07, Änderungsnotiz Code-Review
// Runde 1, Punkt 1). Verhalten wie openPackage in zip.ts, aber: Zuerst werden nur die Metadaten des
// Zentralverzeichnisses gelesen; ein Teil wird erst entpackt, wenn text oder xml ihn anfordert, und
// nur nach der Grössenprüfung G2/G3. Nicht über index.ts exportiert.
import { strFromU8, unzipSync } from 'fflate';
import { XlsxError } from './errors';
import { XLSX_LIMITS } from './limits';
import { parseXml } from './xml';
import type { WapPackage } from './zip';

interface PartInfo {
  /** Position im Zentralverzeichnis (bei gleichen Namen gilt der spätere Eintrag). */
  readonly index: number;
  /** max(size, originalSize) aus dem Zentralverzeichnis: obere Schranke für den Speicher. */
  readonly size: number;
}

/** Sichtbar sind wie bei openPackage nur XML- und Beziehungsteile. */
const NEEDED = /\.(?:xml|rels)$/i;

/** Pfade ohne führendes «/» und ohne Gross-/Kleinschreibung. */
export const keyOf = (path: string): string => path.replace(/^\/+/, '').toLowerCase();

/**
 * Liest das Zentralverzeichnis von `bytes` ohne zu entpacken.
 * Fehler: XlsxError 'corrupt' (Verzeichnis nicht lesbar), 'tooLarge' (G1, sofort beim
 * 10 001. Eintrag, ohne das übrige Verzeichnis zu lesen; CR-E107-11).
 * Beim Lesen der Teile: 'tooLarge' (G2 für text, G3 für xml), 'corrupt' (nicht entpackbar,
 * ungültiges XML). Nach einem 'tooLarge' wird nichts mehr entpackt.
 */
export function openLimitedPackage(bytes: Uint8Array): WapPackage {
  const parts = new Map<string, PartInfo>();
  let entries = 0;
  try {
    unzipSync(bytes, {
      filter: (file) => {
        if (NEEDED.test(file.name))
          parts.set(file.name.toLowerCase(), {
            index: entries,
            size: Math.max(file.size, file.originalSize),
          });
        entries += 1;
        if (entries > XLSX_LIMITS.maxEntries) throw new XlsxError('tooLarge');
        return false;
      },
    });
  } catch (error) {
    if (error instanceof XlsxError) throw error;
    throw new XlsxError('corrupt', { cause: error });
  }

  let stopped = false;
  let xmlBytes = 0;
  const tooLarge = (): never => {
    stopped = true;
    throw new XlsxError('tooLarge');
  };

  /** Entpackt genau den Eintrag an Position `index`. */
  const extract = (index: number): Uint8Array => {
    if (stopped) throw new XlsxError('tooLarge');
    let position = 0;
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes, { filter: () => position++ === index });
    } catch (error) {
      throw new XlsxError('corrupt', { cause: error });
    }
    const [data] = Object.values(files);
    if (!data) throw new XlsxError('corrupt');
    return data;
  };

  const cache = new Map<string, Document | null>();
  return {
    has: (path) => parts.has(keyOf(path)),
    /** Nur für den Formatvorlagen-Teil (G2). */
    text(path) {
      const part = parts.get(keyOf(path));
      if (!part) return null;
      if (part.size > XLSX_LIMITS.maxStylesBytes) return tooLarge();
      return strFromU8(extract(part.index));
    },
    xml(path) {
      const key = keyOf(path);
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const part = parts.get(key);
      if (!part) {
        cache.set(key, null);
        return null;
      }
      xmlBytes += part.size;
      if (xmlBytes > XLSX_LIMITS.maxXmlBytes) return tooLarge();
      const text = strFromU8(extract(part.index));
      let doc: Document;
      try {
        doc = parseXml(text);
      } catch (error) {
        throw new XlsxError('corrupt', { cause: error });
      }
      cache.set(key, doc);
      return doc;
    },
  };
}
