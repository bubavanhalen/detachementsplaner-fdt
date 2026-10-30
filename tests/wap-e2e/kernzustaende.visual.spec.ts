// Bildschirm-Regression der Kernzustände über die Registry je Paket (R-H-21; ADR-010 §3.3, §7.3; Entscheid E4 b).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.2 (Grundlage E1-01 §9 Nr 12, E1-17 §1 mit Änderungsnotiz).
// Lädt jede Datei tests/wap-e2e/support/kernzustaende/*.ts alphabetisch (fehlt der Ordner: 0 Tests) und prüft beim
// Laden die Regeln der Registry (sonst Fehler mit Datei und id). Je Eintrag ein Test im Projekt chromium-visual:
// feste Uhr (clockAt, Vorgabe 2026-09-28T08:00:00+02:00), herstellen, Schriften bereit, WAP-Schrift geladen
// (bis 10 s), dann exakter Bildvergleich. Baselines schreibt nur der Baseline-Befehl des Orchestrators.
// Golden-Vergleich: von der Rot-Phase ausgenommen (ADR-010 §3.3).
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { FONT_FAMILY_SCREEN } from '../../src/model/wap/layout/text/types';
import { test } from './support/fixtures';
import type { Kernzustand } from './support/kernzustand';

/** Uhr ohne Angabe im Eintrag (Vertrag §2.2 Nr 3). */
const VORGABE_UHR = '2026-09-28T08:00:00+02:00';
/** Form der id (Vertrag §2.2 «Regeln»). */
const ID_MUSTER = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Zone am Ende einer Zeitangabe (Regeln von clockAt). */
const ZONE = /(?:Z|[+-]\d{2}:\d{2})$/;
/** Frist für die WAP-Schrift (CR-E101c-V12). */
const SCHRIFT_FRIST_MS = 10_000;

const ordner = join(dirname(fileURLToPath(import.meta.url)), 'support', 'kernzustaende');
const dateien = existsSync(ordner)
  ? readdirSync(ordner)
      .filter((n) => n.endsWith('.ts'))
      .sort()
  : [];

/** Fehler einer Zeitangabe nach den Regeln von clockAt (null = gültig). */
function uhrFehler(iso: string): string | null {
  if (!ZONE.test(iso)) return 'Zeitangabe ohne Zone';
  if (Number.isNaN(new Date(iso).getTime())) return 'ungültige Zeitangabe';
  return null;
}

function ungueltig(datei: string, id: string, regel: string): Error {
  return new Error(`Kernzustand ungültig in ${datei}: ${id} (${regel})`);
}

const zustaende: Kernzustand[] = [];
const herkunft = new Map<string, string>();
for (const datei of dateien) {
  const name = datei.slice(0, -'.ts'.length);
  const modul = (await import(pathToFileURL(join(ordner, datei)).href)) as {
    kernzustaende?: unknown;
  };
  if (!Array.isArray(modul.kernzustaende)) {
    throw new Error(`Kernzustand ungültig in ${datei}: Export «kernzustaende» fehlt`);
  }
  for (const k of modul.kernzustaende as Kernzustand[]) {
    const id = String(k.id);
    if (!ID_MUSTER.test(id)) throw ungueltig(datei, id, `id passt nicht auf ${ID_MUSTER.source}`);
    if (!id.startsWith(`${name}-`)) throw ungueltig(datei, id, `id beginnt nicht mit «${name}-»`);
    if (String(k.paket).toLowerCase() !== name.toLowerCase()) {
      throw ungueltig(datei, id, `paket «${String(k.paket)}» passt nicht zum Dateinamen`);
    }
    if (typeof k.beschreibung !== 'string' || k.beschreibung.trim() === '') {
      throw ungueltig(datei, id, 'beschreibung ist leer');
    }
    if (k.uhr !== undefined) {
      const f = uhrFehler(String(k.uhr));
      if (f !== null) throw ungueltig(datei, id, `uhr: ${f}`);
    }
    const frueher = herkunft.get(id);
    if (frueher !== undefined) {
      throw ungueltig(datei, id, `id doppelt, schon in ${frueher}`);
    }
    herkunft.set(id, datei);
    zustaende.push(k);
  }
}

/** Status aller Schriftflächen der WAP-Schrift (leer: der Zustand verwendet sie nicht). */
async function wapSchriftStatus(page: Page): Promise<string[]> {
  return page.evaluate((familie) => {
    const status: string[] = [];
    document.fonts.forEach((f) => {
      if (f.family.replace(/^["']|["']$/g, '') === familie) status.push(f.status);
    });
    return status;
  }, FONT_FAMILY_SCREEN);
}

/** Wartet bis 10 s, bis alle Flächen der WAP-Schrift geladen sind; «error» oder Frist → Fehler. */
async function warteAufWapSchrift(page: Page): Promise<void> {
  const ende = Date.now() + SCHRIFT_FRIST_MS;
  for (;;) {
    const status = await wapSchriftStatus(page);
    if (status.length === 0 || status.every((s) => s === 'loaded')) return;
    if (status.includes('error')) throw new Error('WAP-Schrift nicht geladen: error');
    if (Date.now() >= ende) {
      const offen = [...new Set(status.filter((s) => s !== 'loaded'))].join(', ');
      throw new Error(`WAP-Schrift nicht geladen: ${offen}`);
    }
    await page.waitForTimeout(100);
  }
}

for (const k of zustaende) {
  test(`[R-H-21] Kernzustand ${k.id} (${k.paket})`, async ({ wapPage, clockAt }) => {
    await clockAt(k.uhr ?? VORGABE_UHR);
    await k.herstellen(wapPage);
    await wapPage.evaluate(async () => {
      await document.fonts.ready;
    });
    await warteAufWapSchrift(wapPage);
    await expect(wapPage).toHaveScreenshot(`${k.id}.png`, {
      maxDiffPixels: 0,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
}
