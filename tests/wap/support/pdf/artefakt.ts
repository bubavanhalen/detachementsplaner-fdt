// Ablage erzeugter PDF für die Ebene-2-Prüfung der Schleuse (Paket E1-01b, R-H-19, ADR-010 §7.2; Schritt
// V5-ebene2). Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 und Notiz Runde 2 Nr 5.
// Nur fiktive oder pseudonymisierte Daten; Referenztests (V3) rufen die Hilfe nie auf. Die Schleuse setzt
// WAP_PDF_ARTEFAKTE nur im ersten V1-Lauf und in V4; sonst tut die Hilfe nichts.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Zulässiger Artefaktname (ohne Endung): Kleinbuchstaben, Ziffern, Bindestrich; höchstens 80 Zeichen. */
const NAME = /^[a-z0-9][a-z0-9-]{0,79}$/;

/**
 * Schreibt `bytes` nach `<WAP_PDF_ARTEFAKTE>/<name>.pdf`; ohne die Variable geschieht nichts.
 * name: /^[a-z0-9][a-z0-9-]{0,79}$/, sonst Error «Ungültiger Artefaktname: <name>» (auch ohne Variable).
 */
export async function pdfArtefakt(name: string, bytes: Uint8Array): Promise<void> {
  if (!NAME.test(name)) throw new Error(`Ungültiger Artefaktname: ${name}`);
  const ordner = process.env.WAP_PDF_ARTEFAKTE;
  if (ordner === undefined || ordner.trim() === '') return;
  await mkdir(ordner, { recursive: true });
  await writeFile(join(ordner, `${name}.pdf`), bytes);
}
