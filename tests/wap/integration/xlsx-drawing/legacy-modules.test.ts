// @vitest-environment jsdom
// Altmodul-Test (Vertrag E1-07 §3, §1a, §1b; Orchestrator-Entscheid 02.10.2026 zu P1).
// Liest nur Dateien der Arbeitskopie (kein git show, keine Abhängigkeit von
// scripts/wap-gate/legacy-modules.json). Die Soll-Hashes aus §1a stehen hier als Konstanten.
// Je Datei: (a) Kopie unter src/io/xlsx-drawing/ byteweise unverändert (SHA-256 nach CRLF→LF),
// (b) src/io/wap/<datei>.ts ist genau die Weiterleitung `export * from '../xlsx-drawing/<datei>';` + LF.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Pfad als Zeichenkette: In jsdom ist das globale URL nicht die URL-Klasse von Node.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const FROZEN_SHA256 = {
  zip: 'f8906e84721c1f793416341b8749da66e5970dc2f6f5b71ab4c270c9f0c58a39',
  xml: '06cf025c611580e36ea6a5a9a92db87a97250ba1a9d5f4c5e7707dd054c5e9de',
  sheet: '8becea68bc561ed297c3e38bb1cd88269fb6f2726962bb3af5bf020c08de3e84',
  colors: 'b99e23b3811f5dde35f99923dac80217981fdf8d3aee3bb158228d159dbb459e',
  drawing: '4090d1c6cd38bc7f60cd9af73152e19e67fd26e4e2c2b4118fae06ceee97bd48',
} as const;

/** Dateiinhalt als Text, CRLF → LF (BOM bleibt erhalten und fällt in (b) auf). */
const readLf = (relative: string): string =>
  readFileSync(resolve(ROOT, relative), 'utf8').replace(/\r\n/g, '\n');

describe('xlsx-drawing Altmodule (Vertrag E1-07 §3)', () => {
  it.each(Object.entries(FROZEN_SHA256))(
    '[R-L-11] (§3 Altmodul) %s.ts: (a) Kopie unverändert, (b) src/io/wap ist reine Weiterleitung',
    (file, sha) => {
      // (a) SHA-256 der Kopie unter src/io/xlsx-drawing/ gleich dem eingefrorenen Wert.
      const copy = readLf(`src/io/xlsx-drawing/${file}.ts`);
      expect(createHash('sha256').update(copy, 'utf8').digest('hex')).toBe(sha);
      // (b) Genau eine Zeile Weiterleitung mit abschliessendem LF; kein Kommentar, kein BOM.
      expect(readLf(`src/io/wap/${file}.ts`)).toBe(`export * from '../xlsx-drawing/${file}';\n`);
    },
  );
});
