// Paket F-TOOLS: Typen der neuen Werkzeugmodule für die Tests (wie support/vertrag.ts). Die Module werden zur
// Laufzeit geladen (ladeModul), damit die Suite-Typprüfung ohne allowJs keine .mjs-Deklarationen braucht.
import { ladeModul } from './umgebung';
import type { Schritt } from './vertrag';

export interface RgbaBild {
  width: number;
  height: number;
  rgba: Uint8Array;
}

export interface ManifestBild {
  datei: string;
  sha256: string;
  status: 'vorläufig' | 'freigegeben';
  anforderungen: string[];
  grund: string;
  commit: string;
}

export interface Manifest {
  version: 1;
  toleranz: { pixel: number };
  bilder: ManifestBild[];
}

export interface GoldenModul {
  GOLDEN_AUSGABE: string;
  KETTE_GEAENDERT: string;
  KETTE_REL: string;
  MANIFEST_REL: string;
  sha256(daten: Uint8Array | string): string;
  kettenAbweichungen(opts: { root: string; kette?: string }): string[];
  ladeManifest(datei: string): { ok: true; manifest: Manifest } | { ok: false; grund: string };
  manifestText(m: Manifest): string;
  pngLesen(bytes: Uint8Array): RgbaBild;
  pngSchreiben(bild: RgbaBild): Uint8Array;
  vergleiche(
    vorher: RgbaBild,
    nachher: RgbaBild,
  ): { groesse: true; diffPixels: number; diffPng: Uint8Array } | { groesse: false };
}

export interface Zahlen {
  getoetet: number;
  zeit: number;
  ueberlebt: number;
  ohneAbdeckung: number;
  sonst: number;
}

export interface MutationModul {
  inPfadmenge(rel: string): boolean;
  bereichVon(rel: string): string;
  geaenderteDateien(root: string, basis: string): string[] | null;
  zaehleBerichte(
    root: string,
    berichte: string[],
  ): { bereiche: Map<string, Zahlen>; dateien: Map<string, Zahlen> };
  score(z: Zahlen): number | null;
  schreibeBereichsBericht(
    root: string,
    berichte: string[],
    ziel: string,
  ): { unter: string[]; zeilen: { bereich: string; score: number | null; zahlen: Zahlen }[] };
  runMutation(opts: {
    cwd: string;
    basis: string | null;
    alle?: boolean;
    env?: Record<string, string>;
    concurrency?: number;
  }): Promise<Schritt>;
}

export const goldenModul = () => ladeModul<GoldenModul>('scripts/wap-gate/golden.mjs');
export const mutationModul = () => ladeModul<MutationModul>('scripts/wap-gate/mutation.mjs');
