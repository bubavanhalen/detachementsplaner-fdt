// Rohprüfungen an PDF-Bytes (Paket E1-02c; Vertrag E1-02c §2.3 Nr 1, 6, 7, 8 und Vertragsprüfung V03, V17,
// V19). Ergänzt readPdf (E1-01b) um Angaben, die pdfjs nicht liefert: Info-Wörterbuch, Trailer, Boxen,
// Schriftnamen mit Präfix und den Inhalt entpackter Ströme. Nur Node (node:zlib).
import { inflateSync } from 'node:zlib';

/** PDF-Bytes als Latin-1-Text (ein Zeichen je Byte). */
export function latin1(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
}

/** Rohdaten aller Ströme (zwischen «stream» und «endstream»). */
export function stroeme(bytes: Uint8Array): Uint8Array[] {
  const text = latin1(bytes);
  const aus: Uint8Array[] = [];
  const muster = /stream\r?\n/g;
  for (let m = muster.exec(text); m !== null; m = muster.exec(text)) {
    const beginn = m.index + m[0].length;
    const ende = text.indexOf('endstream', beginn);
    if (ende < 0) break;
    let schluss = ende;
    if (text[schluss - 1] === '\n') schluss -= 1;
    if (text[schluss - 1] === '\r') schluss -= 1;
    aus.push(bytes.slice(beginn, schluss));
    muster.lastIndex = ende + 'endstream'.length;
  }
  return aus;
}

/** Entpackte Inhalte aller Ströme, die sich mit zlib entpacken lassen (FlateDecode). */
export function entpackteStroeme(bytes: Uint8Array): Uint8Array[] {
  const aus: Uint8Array[] = [];
  for (const s of stroeme(bytes)) {
    try {
      aus.push(new Uint8Array(inflateSync(s)));
    } catch {
      // kein zlib-Strom (z.B. DCTDecode): bleibt nur in den Rohbytes
    }
  }
  return aus;
}

function hex(s: string): string {
  return Buffer.from(s, 'latin1').toString('hex');
}

/**
 * Kommt die Markierung (ASCII) in den PDF-Bytes oder in einem entpackten Strom vor, als Text, als
 * UTF-16BE oder hexadezimal (Gross/Klein egal)?
 */
export function enthaeltMarke(bytes: Uint8Array, marke: string): boolean {
  const formen = [marke, Buffer.from(marke, 'utf16le').swap16().toString('latin1')];
  const hexFormen = formen.map(hex);
  const quellen = [bytes, ...entpackteStroeme(bytes)];
  return quellen.some((q) => {
    const t = latin1(q);
    const klein = t.toLowerCase();
    return (
      formen.some((f) => t.includes(f)) || hexFormen.some((h) => klein.includes(h.toLowerCase()))
    );
  });
}

/** Text des Objekts `<n> 0 obj … endobj`. */
function objekt(text: string, nummer: number): string | null {
  const m = new RegExp(`(?:^|[\\r\\n\\s])${String(nummer)}\\s+0\\s+obj([\\s\\S]*?)endobj`).exec(
    text,
  );
  return m === null ? null : (m[1] ?? '');
}

/** Trailer-Wörterbuch(e) als Text. */
export function trailer(bytes: Uint8Array): string {
  const text = latin1(bytes);
  return [...text.matchAll(/trailer\s*<<([\s\S]*?)>>\s*startxref/g)].map((m) => m[1]).join('\n');
}

/**
 * Schlüssel des Info-Wörterbuchs (aus `/Info n 0 R` im Trailer). Wirft, wenn ein Wert keine Zeichenkette
 * ist oder der Inhalt nicht vollständig aus Schlüssel-Zeichenketten-Paaren besteht.
 */
export function infoSchluessel(bytes: Uint8Array): string[] {
  const text = latin1(bytes);
  const verweis = /\/Info\s+(\d+)\s+0\s+R/.exec(trailer(bytes));
  if (verweis === null) return [];
  const roh = objekt(text, Number(verweis[1]));
  if (roh === null) throw new Error('Info-Objekt fehlt');
  const inhalt = /<<([\s\S]*)>>/.exec(roh)?.[1] ?? '';
  const paar = /\s*\/([A-Za-z0-9]+)\s*(\((?:\\[\s\S]|[^\\)])*\)|<[0-9A-Fa-f\s]*>)/y;
  const schluessel: string[] = [];
  let stelle = 0;
  while (stelle < inhalt.length) {
    if (/^\s*$/.test(inhalt.slice(stelle))) break;
    paar.lastIndex = stelle;
    const m = paar.exec(inhalt);
    if (m === null) throw new Error('Info-Wörterbuch enthält andere Werte als Zeichenketten');
    schluessel.push(m[1] ?? '');
    stelle = paar.lastIndex;
  }
  return schluessel.sort();
}

/** Alle Werte von `/BaseFont /<name>`. */
export function baseFonts(bytes: Uint8Array): string[] {
  return [...latin1(bytes).matchAll(/\/BaseFont\s*\/([^\s/<>[\]()]+)/g)].map((m) => m[1] ?? '');
}

/** Alle Werte von `/FontName /<name>` (Schriftbeschreibungen). */
export function fontNames(bytes: Uint8Array): string[] {
  return [...latin1(bytes).matchAll(/\/FontName\s*\/([^\s/<>[\]()]+)/g)].map((m) => m[1] ?? '');
}

/** Anzahl der Vorkommen eines Namens wie `/FontFile2` (als ganzer Name). */
export function anzahlName(bytes: Uint8Array, name: string): number {
  const re = new RegExp(`/${name}(?![A-Za-z0-9])`, 'g');
  return [...latin1(bytes).matchAll(re)].length;
}

/** Zahlen aller `/MediaBox [ … ]` in Dateireihenfolge. */
export function mediaBoxes(bytes: Uint8Array): number[][] {
  return [...latin1(bytes).matchAll(/\/MediaBox\s*\[([^\]]*)\]/g)].map((m) =>
    (m[1] ?? '')
      .trim()
      .split(/\s+/)
      .map((z) => Number(z)),
  );
}

/** SHA-256 als Hexadezimaltext. */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(bytes).digest('hex');
}
