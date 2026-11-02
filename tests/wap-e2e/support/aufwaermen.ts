// Globale Vorbereitung der WAP-E2E (playwright.wap.config.ts «globalSetup»; Paket F-FLAKY, Befund FL-04).
// Der Entwicklungsserver (Vite) wandelt Module erst bei der ersten Anfrage um und bündelt Abhängigkeiten dabei vor.
// Unter Rechnerlast dauerte das erste Laden einer Harness-Seite über 30 s und fiel in das Zeitlimit des ersten Tests
// (page.reload). Darum lädt diese Vorbereitung jede Harness-Seite einmal, bevor ein Test beginnt; ihre Dauer zählt
// zu keinem Test. Nur 127.0.0.1 (WAP_E2E_PORT), ohne Plan-Daten (#leer), eigener Browser ohne Profil; ohne Port
// (z.B. --list, perf) entfällt sie.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** Ordner der Harness-Seiten, die der Entwicklungsserver unter /tests/wap-e2e/harness/ ausliefert. */
const HARNESS = join(dirname(fileURLToPath(import.meta.url)), '..', 'harness');

/** Obergrenze je Seite; ein Server, der nie antwortet, macht den Lauf rot statt ihn anzuhalten. */
const SEITE_MS = 300_000;

export default async function aufwaermen(): Promise<void> {
  const port = process.env.WAP_E2E_PORT ?? '';
  if (!/^\d+$/.test(port)) return;
  const seiten = readdirSync(HARNESS)
    .filter((n) => n.endsWith('.html'))
    .sort();
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage();
    for (const seite of seiten) {
      await page.goto(`http://127.0.0.1:${port}/tests/wap-e2e/harness/${seite}#leer`, {
        waitUntil: 'load',
        timeout: SEITE_MS,
      });
    }
  } finally {
    await browser.close();
  }
}
