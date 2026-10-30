// Kleiner ZIP-Leser für die Personenliste (.xlsx): liest das Inhaltsverzeichnis und entpackt nur die genannten Teile
// mit der Web-Schnittstelle DecompressionStream («deflate-raw»). Ohne Bibliothek mit Worker-Code, damit die Einzeldatei
// offline und ohne Worker bleibt (Prüfung der Einzeldatei, E1-01b). Andere Teile der Datei werden nie entpackt.

export class ZipReadError extends Error {
  constructor() {
    super('ZIP nicht lesbar');
    this.name = 'ZipReadError';
  }
}

interface Entry {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly localOffset: number;
}

function u16(b: Uint8Array, i: number): number {
  if (i + 2 > b.length) throw new ZipReadError();
  return (b[i] as number) | ((b[i + 1] as number) << 8);
}

function u32(b: Uint8Array, i: number): number {
  if (i + 4 > b.length) throw new ZipReadError();
  return (
    ((b[i] as number) | ((b[i + 1] as number) << 8) | ((b[i + 2] as number) << 16)) +
    (b[i + 3] as number) * 0x1000000
  );
}

/** Einträge aus dem zentralen Verzeichnis (Ende der Datei, ohne ZIP64). */
function entries(b: Uint8Array): Entry[] {
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (u32(b, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipReadError();
  const count = u16(b, end + 10);
  let p = u32(b, end + 16);
  const names = new TextDecoder('utf-8');
  const out: Entry[] = [];
  for (let k = 0; k < count; k++) {
    if (u32(b, p) !== 0x02014b50) throw new ZipReadError();
    const method = u16(b, p + 10);
    const compressedSize = u32(b, p + 20);
    const nameLength = u16(b, p + 28);
    const extraLength = u16(b, p + 30);
    const commentLength = u16(b, p + 32);
    const localOffset = u32(b, p + 42);
    const name = names.decode(b.subarray(p + 46, p + 46 + nameLength));
    out.push({ name, method, compressedSize, localOffset });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

/** Obergrenze der entpackten Grösse aller gelesenen Teile (CR-H-D-08): Schutz vor Entpack-Bomben. */
export const MAX_UNPACKED_BYTES = 50 * 1024 * 1024;

async function inflate(data: Uint8Array, budget: number): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  // Ein Fehler des Stroms erscheint beim Schreiben und beim Lesen; das Schreiben wird hier aufgefangen und
  // erst nach dem Lesen ausgewertet, damit keine Ablehnung unbehandelt bleibt (CR-H-D-08).
  const written = writer
    .write(new Uint8Array(data))
    .then(() => writer.close())
    .then(
      () => true,
      () => false,
    );
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > budget) {
        await reader.cancel().catch(() => undefined);
        throw new ZipReadError();
      }
      chunks.push(value);
    }
  } catch {
    await written;
    throw new ZipReadError();
  }
  if (!(await written)) throw new ZipReadError();
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export interface ZipParts {
  /** Text eines entpackten Teils (Gross/Klein egal) oder null. */
  text(path: string): string | null;
}

/** Entpackt nur die Teile, deren Pfad `wanted` bejaht (gespeichert oder Deflate). */
export async function openZipParts(
  bytes: Uint8Array,
  wanted: (path: string) => boolean,
): Promise<ZipParts> {
  const texts = new Map<string, string>();
  const decoder = new TextDecoder('utf-8');
  let budget = MAX_UNPACKED_BYTES;
  for (const e of entries(bytes)) {
    if (!wanted(e.name)) continue;
    const p = e.localOffset;
    if (u32(bytes, p) !== 0x04034b50) throw new ZipReadError();
    const start = p + 30 + u16(bytes, p + 26) + u16(bytes, p + 28);
    const raw = bytes.subarray(start, start + e.compressedSize);
    if (raw.length !== e.compressedSize) throw new ZipReadError();
    let data: Uint8Array;
    if (e.method === 0) data = raw;
    else if (e.method === 8) {
      try {
        data = await inflate(raw, budget);
      } catch {
        throw new ZipReadError();
      }
    } else throw new ZipReadError();
    budget -= data.length;
    if (budget < 0) throw new ZipReadError();
    texts.set(e.name.toLowerCase(), decoder.decode(data));
  }
  return {
    text: (path) => texts.get(path.replace(/^\/+/, '').toLowerCase()) ?? null,
  };
}
