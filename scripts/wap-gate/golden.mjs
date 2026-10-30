// Golden-Bilder Ebene 3 (R-H-20, Prompt §7, ADR-010 §7.3; Paket F-TOOLS, Auftraggeber 19.10.2026 «7: ja»):
// Render-Kette (tests/wap/golden/render-chain.json), Manifest (tests/wap/golden/manifest.json), PNG lesen und
// schreiben (RGBA, 8 Bit, ohne Zusatzblöcke, deterministisch), Vergleich mit Toleranz und Differenzbild.
// Nur Node-Standardbibliothek; genutzt von der Golden-Konfiguration (globalSetup), den Golden-Tests
// (tests/wap/golden/support/golden.ts), golden-report.mjs und golden-aufnahme.mjs.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §3 (vitest.wap-golden.config.ts), §6 (render-chain.json,
// manifest.json), §9 Nr 6 (assertRenderChain), §9 Nr 7 (goldenReport).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

/** Kettendatei und Manifest, repo-relativ. */
export const KETTE_REL = 'tests/wap/golden/render-chain.json';
export const MANIFEST_REL = 'tests/wap/golden/manifest.json';

/** Ablage der gerenderten Ist-Bilder und Differenzen (nicht versioniert). */
export const GOLDEN_AUSGABE = 'test-results/wap/golden';

/** Präfix jeder Meldung einer Kettenabweichung (Vertrag §9 Nr 6). */
export const KETTE_GEAENDERT = 'Render-Kette geändert: ';

/** Ordner der Schriften, deren SHA-256 zur Kette gehört (ADR-010 §7.3). */
const SCHRIFT_ORDNER = 'src/assets/wap-fonts';

/**
 * @param {Uint8Array | string} daten
 * @returns {string}
 */
export function sha256(daten) {
  return createHash('sha256').update(daten).digest('hex');
}

/**
 * Version eines installierten Pakets; null, wenn es fehlt.
 * @param {string} root
 * @param {string} paket
 * @returns {string | null}
 */
function paketVersion(root, paket) {
  const pj = join(root, 'node_modules', ...paket.split('/'), 'package.json');
  if (!existsSync(pj)) return null;
  try {
    const v = /** @type {{ version?: unknown }} */ (JSON.parse(readFileSync(pj, 'utf8'))).version;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Ist-Stand des Teils «pdf» der Render-Kette: Versionen von pdfjs-dist und @napi-rs/canvas, SHA-256 der
 * Schriftdateien (*.ttf) unter src/assets/wap-fonts/.
 * @param {string} root
 * @returns {{ pdfjsDist: string | null; napiRsCanvas: string | null; dpi: number; schriften: Record<string, string> }}
 */
export function istKette(root) {
  /** @type {Record<string, string>} */
  const schriften = {};
  const ordner = join(root, ...SCHRIFT_ORDNER.split('/'));
  if (existsSync(ordner)) {
    for (const n of readdirSync(ordner).sort()) {
      if (n.toLowerCase().endsWith('.ttf')) {
        schriften[`${SCHRIFT_ORDNER}/${n}`] = sha256(readFileSync(join(ordner, n)));
      }
    }
  }
  return {
    pdfjsDist: paketVersion(root, 'pdfjs-dist'),
    napiRsCanvas: paketVersion(root, '@napi-rs/canvas'),
    dpi: 300,
    schriften,
  };
}

/**
 * Vergleicht die installierte Render-Kette (Teil «pdf») mit der Kettendatei. Liefert die Abweichungen als
 * Text «Feld (Soll …, Ist …)»; leer = gleich. Fehlt oder ist die Datei ungültig, ist das eine Abweichung.
 * @param {{ root: string; kette?: string }} opts
 * @returns {string[]}
 */
export function kettenAbweichungen(opts) {
  const datei = opts.kette ?? join(opts.root, ...KETTE_REL.split('/'));
  if (!existsSync(datei)) return [`Kettendatei fehlt (${KETTE_REL})`];
  /** @type {Record<string, unknown>} */
  let soll;
  try {
    const d = JSON.parse(readFileSync(datei, 'utf8'));
    soll = /** @type {Record<string, unknown>} */ (d?.pdf ?? null);
    if (soll === null || typeof soll !== 'object') return ['Kettendatei ohne Teil «pdf»'];
  } catch {
    return ['Kettendatei ist kein gültiges JSON'];
  }
  const ist = istKette(opts.root);
  /** @type {string[]} */
  const ab = [];
  for (const feld of /** @type {const} */ (['pdfjsDist', 'napiRsCanvas', 'dpi'])) {
    if (soll[feld] !== ist[feld]) {
      ab.push(
        `${feld} (Soll ${String(soll[feld] ?? 'fehlt')}, Ist ${String(ist[feld] ?? 'fehlt')})`,
      );
    }
  }
  const sollSchriften = /** @type {Record<string, unknown>} */ (soll.schriften ?? {});
  if (
    typeof sollSchriften !== 'object' ||
    Array.isArray(sollSchriften) ||
    Object.keys(sollSchriften).length === 0
  ) {
    ab.push('schriften (Soll fehlt)');
  } else {
    for (const [pfad, sha] of Object.entries(sollSchriften)) {
      const i = ist.schriften[pfad];
      if (i !== sha)
        ab.push(
          `schriften ${pfad} (Soll ${String(sha).slice(0, 12)}, Ist ${(i ?? 'fehlt').slice(0, 12)})`,
        );
    }
    for (const pfad of Object.keys(ist.schriften)) {
      if (!(pfad in sollSchriften))
        ab.push(`schriften ${pfad} (Soll fehlt, Ist ${ist.schriften[pfad]?.slice(0, 12) ?? ''})`);
    }
  }
  return ab;
}

/**
 * @typedef {{ datei: string; sha256: string; status: 'vorläufig' | 'freigegeben'; anforderungen: string[]; grund: string; commit: string }} ManifestBild
 * @typedef {{ version: 1; toleranz: { pixel: number }; bilder: ManifestBild[] }} Manifest
 */

/**
 * Liest ein Manifest (auch ein älterer Stand ohne «toleranz»: dann 0).
 * @param {string} datei
 * @returns {{ ok: true; manifest: Manifest } | { ok: false; grund: string }}
 */
export function ladeManifest(datei) {
  if (!existsSync(datei)) return { ok: false, grund: 'Manifest fehlt' };
  /** @type {Record<string, unknown>} */
  let d;
  try {
    d = JSON.parse(readFileSync(datei, 'utf8'));
  } catch {
    return { ok: false, grund: 'Manifest ist kein gültiges JSON' };
  }
  if (d === null || typeof d !== 'object' || d.version !== 1 || !Array.isArray(d.bilder)) {
    return { ok: false, grund: 'Manifest ungültig (version 1, bilder)' };
  }
  /** @type {ManifestBild[]} */
  const bilder = [];
  for (const b of d.bilder) {
    const e = /** @type {Record<string, unknown>} */ (b ?? {});
    if (
      typeof e.datei !== 'string' ||
      !/^[a-z0-9][a-z0-9/._-]*\.png$/i.test(e.datei) ||
      e.datei.split('/').includes('..') ||
      typeof e.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(e.sha256) ||
      (e.status !== 'vorläufig' && e.status !== 'freigegeben') ||
      !Array.isArray(e.anforderungen) ||
      typeof e.grund !== 'string' ||
      typeof e.commit !== 'string'
    ) {
      return { ok: false, grund: 'Manifest mit ungültigem Bildeintrag' };
    }
    bilder.push(/** @type {ManifestBild} */ (/** @type {unknown} */ (e)));
  }
  const t = /** @type {Record<string, unknown>} */ (d.toleranz ?? { pixel: 0 });
  const pixel =
    typeof t.pixel === 'number' && Number.isInteger(t.pixel) && t.pixel >= 0 ? t.pixel : null;
  if (pixel === null) return { ok: false, grund: 'Manifest mit ungültiger Toleranz' };
  return { ok: true, manifest: { version: 1, toleranz: { pixel }, bilder } };
}

/**
 * Manifest als Text (zwei Leerzeichen Einzug, LF, Bilder nach Datei sortiert).
 * @param {Manifest} m
 * @returns {string}
 */
export function manifestText(m) {
  const bilder = [...m.bilder].sort((a, b) => (a.datei < b.datei ? -1 : a.datei > b.datei ? 1 : 0));
  return `${JSON.stringify({ version: 1, toleranz: m.toleranz, bilder }, null, 2)}\n`;
}

/** @typedef {{ width: number; height: number; rgba: Uint8Array }} RgbaBild */

const PNG_SIGNATUR = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * @param {string} typ
 * @param {Uint8Array} daten
 * @returns {Buffer}
 */
function block(typ, daten) {
  const kopf = Buffer.alloc(8);
  kopf.writeUInt32BE(daten.length, 0);
  kopf.write(typ, 4, 'latin1');
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(Buffer.concat([kopf.subarray(4), daten])), 0);
  return Buffer.concat([kopf, daten, pruef]);
}

/**
 * PNG (RGBA, 8 Bit, Filter 0) aus Rohdaten; deterministisch (gleich zu tests/wap/support/golden/render.ts).
 * @param {RgbaBild} bild
 * @returns {Uint8Array}
 */
export function pngSchreiben(bild) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bild.width, 0);
  ihdr.writeUInt32BE(bild.height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const zeile = bild.width * 4;
  const roh = Buffer.alloc((zeile + 1) * bild.height);
  for (let y = 0; y < bild.height; y++) {
    roh[y * (zeile + 1)] = 0;
    roh.set(bild.rgba.subarray(y * zeile, (y + 1) * zeile), y * (zeile + 1) + 1);
  }
  return new Uint8Array(
    Buffer.concat([
      PNG_SIGNATUR,
      block('IHDR', ihdr),
      block('IDAT', deflateSync(roh, { level: 9 })),
      block('IEND', new Uint8Array(0)),
    ]),
  );
}

/**
 * Liest ein PNG mit 8 Bit je Kanal (RGBA oder RGB, ohne Zeilensprung, alle fünf Filter) als RGBA.
 * @param {Uint8Array} bytes
 * @returns {RgbaBild}
 */
export function pngLesen(bytes) {
  const b = Buffer.from(bytes);
  if (b.length < 8 || !b.subarray(0, 8).equals(Buffer.from(PNG_SIGNATUR)))
    throw new Error('kein PNG');
  let pos = 8;
  let breite = 0;
  let hoehe = 0;
  let farbtyp = -1;
  /** @type {Buffer[]} */
  const idat = [];
  while (pos + 8 <= b.length) {
    const laenge = b.readUInt32BE(pos);
    const typ = b.toString('latin1', pos + 4, pos + 8);
    const daten = b.subarray(pos + 8, pos + 8 + laenge);
    if (typ === 'IHDR') {
      breite = daten.readUInt32BE(0);
      hoehe = daten.readUInt32BE(4);
      if (daten[8] !== 8 || daten[12] !== 0)
        throw new Error('PNG-Form nicht unterstützt (8 Bit, ohne Zeilensprung)');
      farbtyp = daten[9] ?? -1;
      if (farbtyp !== 6 && farbtyp !== 2)
        throw new Error('PNG-Farbtyp nicht unterstützt (RGB oder RGBA)');
    } else if (typ === 'IDAT') idat.push(daten);
    else if (typ === 'IEND') break;
    pos += 12 + laenge;
  }
  if (breite === 0 || hoehe === 0) throw new Error('PNG ohne Kopf');
  const bpp = farbtyp === 6 ? 4 : 3;
  const roh = inflateSync(Buffer.concat(idat));
  const zeile = breite * bpp;
  if (roh.length < (zeile + 1) * hoehe) throw new Error('PNG unvollständig');
  const aus = new Uint8Array(zeile * hoehe);
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)];
    const q = y * (zeile + 1) + 1;
    const z = y * zeile;
    for (let x = 0; x < zeile; x++) {
      const r = roh[q + x] ?? 0;
      const a = x >= bpp ? (aus[z + x - bpp] ?? 0) : 0;
      const o = y > 0 ? (aus[z - zeile + x] ?? 0) : 0;
      const c = x >= bpp && y > 0 ? (aus[z - zeile + x - bpp] ?? 0) : 0;
      let w;
      if (filter === 0) w = r;
      else if (filter === 1) w = r + a;
      else if (filter === 2) w = r + o;
      else if (filter === 3) w = r + Math.floor((a + o) / 2);
      else if (filter === 4) {
        const p = a + o - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - o);
        const pc = Math.abs(p - c);
        w = r + (pa <= pb && pa <= pc ? a : pb <= pc ? o : c);
      } else throw new Error('PNG mit unbekanntem Filter');
      aus[z + x] = w & 0xff;
    }
  }
  if (bpp === 4) return { width: breite, height: hoehe, rgba: aus };
  const rgba = new Uint8Array(breite * hoehe * 4);
  for (let i = 0, j = 0; i < aus.length; i += 3, j += 4) {
    rgba[j] = aus[i] ?? 0;
    rgba[j + 1] = aus[i + 1] ?? 0;
    rgba[j + 2] = aus[i + 2] ?? 0;
    rgba[j + 3] = 255;
  }
  return { width: breite, height: hoehe, rgba };
}

/**
 * Vergleicht zwei Bilder pixelgenau (ein Pixel zählt, wenn ein Kanal abweicht, auch Alpha) und erzeugt das
 * Differenzbild (rot = abweichend, weiss = gleich). Verschiedene Grösse: groesse = false, kein Differenzbild.
 * @param {RgbaBild} vorher
 * @param {RgbaBild} nachher
 * @returns {{ groesse: true; diffPixels: number; diffPng: Uint8Array } | { groesse: false }}
 */
export function vergleiche(vorher, nachher) {
  if (vorher.width !== nachher.width || vorher.height !== nachher.height) return { groesse: false };
  const pixel = vorher.width * vorher.height;
  const diff = new Uint8Array(pixel * 4);
  let diffPixels = 0;
  for (let p = 0; p < pixel; p++) {
    const i = p * 4;
    const anders =
      vorher.rgba[i] !== nachher.rgba[i] ||
      vorher.rgba[i + 1] !== nachher.rgba[i + 1] ||
      vorher.rgba[i + 2] !== nachher.rgba[i + 2] ||
      vorher.rgba[i + 3] !== nachher.rgba[i + 3];
    if (anders) diffPixels += 1;
    diff[i] = 255;
    diff[i + 1] = anders ? 0 : 255;
    diff[i + 2] = anders ? 0 : 255;
    diff[i + 3] = 255;
  }
  return {
    groesse: true,
    diffPixels,
    diffPng: pngSchreiben({ width: vorher.width, height: vorher.height, rgba: diff }),
  };
}
