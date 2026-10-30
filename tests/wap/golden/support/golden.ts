// Hilfen der Golden-Tests Ebene 3 (R-H-20, Prompt §7, ADR-010 §7.3; Paket F-TOOLS, Auftraggeber 19.10.2026
// «7: ja»). assertRenderChain nach Vertrag E1-01 §9 Nr 6 (Teil «pdf» der Kette), Vergleich eines gerenderten
// Bildes mit der Baseline aus tests/wap/golden/manifest.json mit der dort festgelegten Toleranz (Vorgabe 0 Pixel,
// ADR-010 §7.3). Jedes gerenderte Bild wird als Ist-Bild unter test-results/wap/golden/ist/ abgelegt (Grundlage
// der Aufnahme, scripts/wap-gate/golden-aufnahme.mjs); bei Abweichung zusätzlich Vorher/Nachher/Differenz unter
// test-results/wap/golden/diff/<name>/. Golden-Vergleiche sind von der Rot-Phase ausgenommen (ADR-010 §3.3).
import { AssertionError } from 'node:assert';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Wurzel des Checkouts, aus dem diese Datei geladen ist. */
export const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

interface RgbaBild {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/** Schnittstelle von scripts/wap-gate/golden.mjs (zur Laufzeit geladen; die Suite-Typprüfung kennt kein allowJs). */
interface GoldenModul {
  GOLDEN_AUSGABE: string;
  KETTE_GEAENDERT: string;
  MANIFEST_REL: string;
  sha256(daten: Uint8Array): string;
  kettenAbweichungen(opts: { root: string; kette?: string }): string[];
  ladeManifest(datei: string):
    | {
        ok: true;
        manifest: { toleranz: { pixel: number }; bilder: { datei: string; sha256: string }[] };
      }
    | { ok: false; grund: string };
  pngLesen(bytes: Uint8Array): RgbaBild;
  vergleiche(
    vorher: RgbaBild,
    nachher: RgbaBild,
  ): { groesse: true; diffPixels: number; diffPng: Uint8Array } | { groesse: false };
}

function golden(root: string): Promise<GoldenModul> {
  return import(
    pathToFileURL(join(root, 'scripts', 'wap-gate', 'golden.mjs')).href
  ) as Promise<GoldenModul>;
}

/**
 * Vergleicht die installierte Render-Kette (Teil «pdf») mit render-chain.json; wirft AssertionError
 * «Render-Kette geändert: …» mit Feld, Soll und Ist (Vertrag E1-01 §9 Nr 6).
 */
export async function assertRenderChain(
  opts: { root?: string; kette?: string } = {},
): Promise<void> {
  const root = opts.root ?? WURZEL;
  const { KETTE_GEAENDERT, kettenAbweichungen } = await golden(WURZEL);
  const ab = kettenAbweichungen({
    root,
    ...(opts.kette === undefined ? {} : { kette: opts.kette }),
  });
  if (ab.length > 0) {
    throw new AssertionError({ message: `${KETTE_GEAENDERT}${ab.join('; ')}` });
  }
}

/** Ein Golden-Kandidat: Name (Datei baselines/<name>.png), Beschreibung und Anforderungen für das Manifest. */
export interface GoldenBildInfo {
  readonly name: string;
  readonly beschreibung: string;
  readonly anforderungen: readonly string[];
}

/**
 * Legt das Ist-Bild ab und vergleicht es mit der Baseline des Manifests. Wirft AssertionError bei fehlender
 * Baseline, veränderter Baseline (SHA-256 ≠ Manifest), anderer Bildgrösse oder mehr abweichenden Pixeln als
 * die Toleranz des Manifests.
 */
export async function vergleicheMitGolden(
  info: GoldenBildInfo,
  png: Uint8Array,
  opts: { root?: string } = {},
): Promise<void> {
  const root = opts.root ?? WURZEL;
  const { GOLDEN_AUSGABE, MANIFEST_REL, ladeManifest, pngLesen, sha256, vergleiche } =
    await golden(WURZEL);
  const aus = join(root, ...GOLDEN_AUSGABE.split('/'));
  const ist = join(aus, 'ist');
  mkdirSync(ist, { recursive: true });
  writeFileSync(join(ist, `${info.name}.png`), png);
  writeFileSync(
    join(ist, `${info.name}.json`),
    `${JSON.stringify({ name: info.name, beschreibung: info.beschreibung, anforderungen: info.anforderungen, sha256: sha256(png) }, null, 2)}\n`,
  );
  const diffOrdner = join(aus, 'diff', info.name);
  rmSync(diffOrdner, { recursive: true, force: true });
  const m = ladeManifest(join(root, ...MANIFEST_REL.split('/')));
  if (!m.ok) throw new AssertionError({ message: `Golden-Manifest: ${m.grund} (${MANIFEST_REL})` });
  const datei = `baselines/${info.name}.png`;
  const eintrag = m.manifest.bilder.find((b) => b.datei === datei);
  if (eintrag === undefined) {
    throw new AssertionError({
      message: `Baseline fehlt: ${info.name} (Aufnahme ausstehend: npm run wap:golden:aufnahme)`,
    });
  }
  const pfad = join(root, 'tests', 'wap', 'golden', ...datei.split('/'));
  if (!existsSync(pfad)) {
    throw new AssertionError({ message: `Baseline-Datei fehlt: ${info.name} (${datei})` });
  }
  const vorher = new Uint8Array(readFileSync(pfad));
  if (sha256(vorher) !== eintrag.sha256) {
    throw new AssertionError({
      message: `Baseline verändert: ${info.name} (SHA-256 ungleich Manifest)`,
    });
  }
  const v = vergleiche(pngLesen(vorher), pngLesen(png));
  if (!v.groesse) {
    mkdirSync(diffOrdner, { recursive: true });
    writeFileSync(join(diffOrdner, 'vorher.png'), vorher);
    writeFileSync(join(diffOrdner, 'nachher.png'), png);
    throw new AssertionError({ message: `Golden-Bild ${info.name}: Bildgrösse geändert` });
  }
  if (v.diffPixels > m.manifest.toleranz.pixel) {
    mkdirSync(diffOrdner, { recursive: true });
    writeFileSync(join(diffOrdner, 'vorher.png'), vorher);
    writeFileSync(join(diffOrdner, 'nachher.png'), png);
    writeFileSync(join(diffOrdner, 'differenz.png'), v.diffPng);
    throw new AssertionError({
      message: `Golden-Bild ${info.name}: ${String(v.diffPixels)} Pixel abweichend (Toleranz ${String(m.manifest.toleranz.pixel)}); Vorher/Nachher/Differenz unter ${GOLDEN_AUSGABE}/diff/${info.name}/`,
    });
  }
}
