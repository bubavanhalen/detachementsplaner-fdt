// Playwright-Fixtures der WAP-E2E-Tests (Paket E1-01b, R-H-11; ADR-010 §3.2 V4, §10).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §4, §9 Nr 1 und E1-01b.md §2 «Fixtures».
// port kommt aus WAP_E2E_PORT (gesetzt von scripts/wap-gate/e2e.mjs). wapPage sammelt Konsolenfehler,
// -warnungen, Seitenfehler und alle Anfragen; bleiben nach dem Test Einträge in consoleErrors oder ist eine
// Anfrage nicht erlaubt, ist der Test rot. Erlaubt sind
// 127.0.0.1:<port> (http, ws), file: unter test-results/wap/einzeldatei/ oder perf-harness/, data: und blob:.
// F-UX1 «B3 b» (Entscheid des Auftraggebers vom 19.10.2026; CS-I5-B3-KONSOLE-01): Zu jeder verbliebenen
// Konsolen- oder Seitenfehlermeldung stehen Text, Ort und Stack (die E2E laden nur fiktive Testdaten) in der
// Fehlermeldung des Tests und in test-results/wap/konsole/<test>.json; consoleErrors enthält weiter die Art.
// Nicht erlaubte
// Anfragen bricht wapPage zusätzlich ab (route bzw. routeWebSocket, Notiz Code-Review Runde 1 Nr 5).
// E1-01c ergänzt clockAt, a11y und focusVisible (§2.5) sowie offlinePersistent (§2.4) für neue lokale
// Profile mit gesperrtem Netz. UNC- und Gerätepfade werden vor einem Dateizugriff abgelehnt.
// FT-A-02 (F-TOOLS, Koordinator 20.10.2026; R-H-16, ADR-010 §6.1 b): Ist WAP_E2E_COVERAGE gesetzt (Ordner,
// gesetzt von scripts/wap-gate/coverage-e2e.mjs), sammelt wapPage in Chromium/Edge die V8-Abdeckung der vom
// Entwicklungsserver geladenen Quellen (/src/…) und legt sie je Test als JSON in diesem Ordner ab.
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  type BrowserContext,
  test as base,
  type ConsoleMessage,
  chromium,
  type Locator,
  type Page,
} from '@playwright/test';

/** Wurzel des Checkouts, aus dem diese Datei geladen ist. */
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Ordner der von runE2e gebauten Einzeldateien (Projekt edge-dist). */
const EINZELDATEI_ORDNER = join(WURZEL, 'test-results', 'wap', 'einzeldatei');

/** Ablage der V8-Abdeckung je Test (FT-A-02); nur gesetzt im Messlauf der Abdeckung. */
const ABDECKUNG_ORDNER = process.env.WAP_E2E_COVERAGE ?? '';

/** Ordner der Konsolenberichte je Test (F-UX1 «B3 b»); lokal, nicht versioniert (test-results/). */
const KONSOLE_ORDNER = join(WURZEL, 'test-results', 'wap', 'konsole');

/** Höchstlänge von Text und Stack je Meldung in Fehlermeldung und Bericht. */
const KONSOLE_MAX_ZEICHEN = 4000;

/** Eine Konsolen- oder Seitenfehlermeldung mit Text (F-UX1 «B3 b»). */
export interface KonsolenEintrag {
  readonly art: 'error' | 'warning' | 'pageerror';
  readonly text: string;
  /** «url:zeile:spalte» der Konsolenmeldung; null bei Seitenfehlern und ohne Ort. */
  readonly ort: string | null;
  /** Stack des Seitenfehlers; Konsolenmeldungen liefern keinen (Playwright), dann null. */
  readonly stack: string | null;
}

/** Was sammleKonsole von der Seite braucht (Page von Playwright erfüllt es). */
export interface KonsolenQuelle {
  on(
    event: 'console',
    listener: (m: Pick<ConsoleMessage, 'type' | 'text' | 'location'>) => void,
  ): unknown;
  on(event: 'pageerror', listener: (e: Error) => void): unknown;
}

/** Test, zu dem ein Konsolenbericht gehört (Teil von TestInfo). */
export interface KonsolenTest {
  readonly titlePath: readonly string[];
  readonly project: string;
  readonly file: string;
}

function gekuerzt(text: string): string {
  return text.length > KONSOLE_MAX_ZEICHEN ? `${text.slice(0, KONSOLE_MAX_ZEICHEN)} …` : text;
}

/**
 * Hängt die Sammler an: consoleErrors erhält wie bisher je Meldung die Art (`error`, `warning`, `pageerror`;
 * Vertrag E1-01b §2), die Rückgabe dazu Text, Ort und Stack in derselben Reihenfolge.
 */
export function sammleKonsole(quelle: KonsolenQuelle, consoleErrors: string[]): KonsolenEintrag[] {
  const eintraege: KonsolenEintrag[] = [];
  quelle.on('console', (m) => {
    const art = m.type();
    if (art !== 'error' && art !== 'warning') return;
    const l = m.location();
    consoleErrors.push(art);
    eintraege.push({
      art,
      text: gekuerzt(m.text()),
      ort: l.url === '' ? null : `${l.url}:${String(l.lineNumber)}:${String(l.columnNumber)}`,
      stack: null,
    });
  });
  quelle.on('pageerror', (e) => {
    consoleErrors.push('pageerror');
    eintraege.push({
      art: 'pageerror',
      text: gekuerzt(e.message),
      ort: null,
      stack: e.stack === undefined ? null : gekuerzt(e.stack),
    });
  });
  return eintraege;
}

/**
 * Einträge zu den verbliebenen consoleErrors: Tests entfernen erwartete Meldungen von vorne
 * (consoleErrors.splice(0), Vertrag E1-01b §2), also gehören die letzten consoleErrors.length Einträge dazu.
 */
export function verbliebeneEintraege(
  eintraege: readonly KonsolenEintrag[],
  consoleErrors: readonly string[],
): KonsolenEintrag[] {
  return consoleErrors.length === 0 ? [] : eintraege.slice(-consoleErrors.length);
}

/** Fehlermeldung: wie bisher «Konsolenfehler oder -warnungen der Seite: <n>», danach je Meldung Art, Text, Ort, Stack. */
export function konsolenMeldung(
  eintraege: readonly KonsolenEintrag[],
  datei: string | null,
): string {
  const zeilen = [`Konsolenfehler oder -warnungen der Seite: ${String(eintraege.length)}`];
  for (const e of eintraege) {
    zeilen.push(`- ${e.art}: ${e.text}${e.ort === null ? '' : ` (${e.ort})`}`);
    if (e.stack !== null) zeilen.push(...e.stack.split('\n').map((z) => `    ${z.trim()}`));
  }
  if (datei !== null) zeilen.push(`Bericht: ${datei}`);
  return zeilen.join('\n');
}

/** Bericht test-results/wap/konsole/<test>.json: lesbarer, sicherer Name plus Kurzhash (eindeutig je Projekt und Test). */
export function konsolenDatei(test: KonsolenTest, ordner: string = KONSOLE_ORDNER): string {
  const schluessel = [test.project, test.file, ...test.titlePath].join('\u0000');
  const hash = createHash('sha256').update(schluessel).digest('hex').slice(0, 12);
  const lesbar = `${test.project}_${test.titlePath.at(-1) ?? 'test'}`
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return join(ordner, `${lesbar}_${hash}.json`);
}

/** Schreibt den Bericht; ohne Einträge entfernt es einen Bericht eines früheren Laufs desselben Tests. */
export function schreibeKonsole(
  datei: string,
  test: KonsolenTest,
  eintraege: readonly KonsolenEintrag[],
): void {
  if (eintraege.length === 0) {
    rmSync(datei, { force: true });
    return;
  }
  mkdirSync(dirname(datei), { recursive: true });
  writeFileSync(
    datei,
    `${JSON.stringify(
      {
        test: test.titlePath.join(' › '),
        projekt: test.project,
        datei: test.file,
        zeit: new Date().toISOString(),
        eintraege,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

/** Ergebnis der automatischen Barrierefreiheitsprüfung (axe-core, Entscheid E3). */
export interface A11yResult {
  verstoesse: { id: string; impact: string | null; ziele: string[] }[];
}

export interface WapTestFixtures {
  wapPage: Page;
  consoleErrors: string[];
  requests: string[];
  clockAt: (iso: string) => Promise<void>;
  a11y: (scope?: Locator) => Promise<A11yResult>;
  focusVisible: (locator: Locator) => Promise<{ sichtbar: boolean; kontrast: number }>;
}

export interface WapWorkerFixtures {
  port: number;
}

/** Liegt `datei` im Ordner `ordner` (ohne Beachtung von Gross/Klein unter Windows)? */
function liegtUnter(datei: string, ordner: string): boolean {
  const rel = relative(ordner.toLowerCase(), datei.toLowerCase());
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Ist die Anfrage erlaubt (App auf 127.0.0.1:<port>, Einzeldatei, data:, blob:)? */
function erlaubt(url: string, port: number): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === 'data:' || u.protocol === 'blob:') return true;
  if (u.protocol === 'http:' || u.protocol === 'ws:') {
    return u.hostname === '127.0.0.1' && u.port === String(port);
  }
  if (u.protocol === 'file:') {
    try {
      return (
        liegtUnter(fileURLToPath(u), EINZELDATEI_ORDNER) ||
        liegtUnter(fileURLToPath(u), join(WURZEL, 'test-results/wap/perf-harness'))
      );
    } catch {
      return false;
    }
  }
  return false;
}

export const test = base.extend<WapTestFixtures, WapWorkerFixtures>({
  port: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright verlangt Objekt-Destrukturierung im ersten Fixture-Parameter
    async ({}, use, workerInfo) => {
      const wert = process.env.WAP_E2E_PORT ?? '';
      if (wert === '' && workerInfo.project.name === 'perf') {
        await use(0);
        return;
      }
      const port = Number(wert);
      if (!/^\d+$/.test(wert) || port <= 0 || port > 65_535) {
        throw new Error('WAP_E2E_PORT fehlt: E2E nur über npm run wap:test:e2e');
      }
      await use(port);
    },
    { scope: 'worker' },
  ],
  // biome-ignore lint/correctness/noEmptyPattern: Playwright verlangt Objekt-Destrukturierung im ersten Fixture-Parameter
  consoleErrors: async ({}, use) => {
    await use([]);
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright verlangt Objekt-Destrukturierung im ersten Fixture-Parameter
  requests: async ({}, use) => {
    await use([]);
  },
  wapPage: async ({ page, consoleErrors, requests, port }, use, testInfo) => {
    const konsole = sammleKonsole(page, consoleErrors);
    page.on('request', (r) => {
      requests.push(r.url());
    });
    page.on('websocket', (w) => {
      requests.push(w.url());
    });
    // Nicht erlaubte Anfragen verlassen das Gerät nicht (CR-E101b-06; Vertrag E1-01b, Notiz Code-Review
    // Runde 1 Nr 5): HTTP wird abgebrochen (das request-Ereignis zählt sie genau einmal), ein WebSocket
    // geschlossen; ein abgefangener Socket löst kein websocket-Ereignis aus, daher trägt ihn der Handler ein.
    // Auf dem Kontext, damit auch Popups erfasst sind.
    const kontext = page.context();
    await kontext.route(
      (u) => !erlaubt(u.href, port),
      (r) => r.abort('blockedbyclient'),
    );
    await kontext.routeWebSocket(
      (u) => !erlaubt(u.href, port),
      (ws) => {
        requests.push(ws.url());
        void ws.close();
      },
    );
    const abdeckung =
      ABDECKUNG_ORDNER !== '' && testInfo.project.use.browserName !== 'firefox' && port > 0;
    if (abdeckung) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    if (abdeckung) {
      const quelle = `http://127.0.0.1:${String(port)}/src/`;
      const eintraege = (await page.coverage.stopJSCoverage()).filter((e) =>
        e.url.startsWith(quelle),
      );
      mkdirSync(ABDECKUNG_ORDNER, { recursive: true });
      const name = createHash('sha256')
        .update(
          `${testInfo.project.name}|${testInfo.titlePath.join('|')}|${String(testInfo.retry)}`,
        )
        .digest('hex')
        .slice(0, 16);
      writeFileSync(join(ABDECKUNG_ORDNER, `${name}.json`), JSON.stringify(eintraege));
    }
    const meldungen: string[] = [];
    const test: KonsolenTest = {
      titlePath: testInfo.titlePath,
      project: testInfo.project.name,
      file: relative(WURZEL, testInfo.file).split(sep).join('/'),
    };
    const bericht = konsolenDatei(test);
    const verblieben = verbliebeneEintraege(konsole, consoleErrors);
    schreibeKonsole(bericht, test, verblieben);
    if (consoleErrors.length > 0) {
      meldungen.push(konsolenMeldung(verblieben, relative(WURZEL, bericht).split(sep).join('/')));
    }
    const fremd = requests.filter((u) => !erlaubt(u, port));
    if (fremd.length > 0) {
      meldungen.push(`Netzanfrage ausserhalb der App: ${String(fremd.length)}`);
    }
    if (meldungen.length > 0) throw new Error(meldungen.join('; '));
  },
  clockAt: async ({ page }, use) => {
    await use(async (iso) => {
      if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(iso))
        throw new Error(`clockAt: Zeitangabe ohne Zone: ${iso}`);
      const date = new Date(iso);
      if (!Number.isFinite(date.getTime()))
        throw new Error(`clockAt: ungültige Zeitangabe: ${iso}`);
      await page.clock.setFixedTime(date);
    });
  },
  a11y: async ({ page }, use) => {
    await use(async (scope) => {
      let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
      const marker = 'data-wap-axe-scope';
      const vorher = scope ? await scope.getAttribute(marker) : null;
      if (scope) {
        await scope.evaluate((e, m) => e.setAttribute(m, 'pruefung'), marker);
        axe = axe.include(`[${marker}="pruefung"]`);
      }
      const result = await (async () => {
        try {
          return await axe.analyze();
        } finally {
          if (scope)
            await scope.evaluate(
              (e, opts) => {
                if (opts.vorher === null) e.removeAttribute(opts.marker);
                else e.setAttribute(opts.marker, opts.vorher);
              },
              { marker, vorher },
            );
        }
      })();
      return {
        verstoesse: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact ?? null,
          ziele: v.nodes.flatMap((n) =>
            n.target.map((t) => (typeof t === 'string' ? t : t.join(' '))),
          ),
        })),
      };
    });
  },
  focusVisible: async ({ page }, use) => {
    await use(async (locator) => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (!box) throw new Error('focusVisible: Element nicht fokussierbar');
      const viewport =
        page.viewportSize() ??
        (await page.evaluate(() => ({ width: innerWidth, height: innerHeight })));
      const x = Math.max(0, box.x - 8),
        y = Math.max(0, box.y - 8);
      const clip = {
        x,
        y,
        width: Math.min(viewport.width, box.x + box.width + 8) - x,
        height: Math.min(viewport.height, box.y + box.height + 8) - y,
      };
      await locator.evaluate((e) => {
        if (e instanceof HTMLElement) e.blur();
      });
      const a = await page.screenshot({
        clip,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
      await page.keyboard.press('Shift');
      await locator.focus();
      if (!(await locator.evaluate((e) => document.activeElement === e)))
        throw new Error('focusVisible: Element nicht fokussierbar');
      const b = await page.screenshot({
        clip,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
      const decode = async (png: Buffer) => {
        const image = await loadImage(png);
        const canvas = createCanvas(image.width, image.height);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const vorher = await decode(a),
        nachher = await decode(b);
      const luminanz = (p: Uint8ClampedArray, i: number) =>
        [0.2126, 0.7152, 0.0722].reduce((sum, gewicht, c) => {
          const s = (p[i + c] ?? 0) / 255;
          return sum + gewicht * (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
        }, 0);
      const kontraste: number[] = [];
      for (let i = 0; i < vorher.length; i += 4) {
        if (
          vorher[i] === nachher[i] &&
          vorher[i + 1] === nachher[i + 1] &&
          vorher[i + 2] === nachher[i + 2]
        )
          continue;
        const l1 = luminanz(vorher, i),
          l2 = luminanz(nachher, i);
        kontraste.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
      }
      const p = Math.round(2 * (box.width + box.height));
      kontraste.sort((a, b) => b - a);
      return {
        sichtbar: kontraste.length >= p,
        kontrast: kontraste.length < p ? 1 : Math.floor((kontraste[p - 1] ?? 1) * 100) / 100,
      };
    });
  },
});

/**
 * file://-URL der von runE2e gebauten Einzeldatei `test-results/wap/einzeldatei/<name>.html` (Projekt
 * edge-dist, Vertrag E1-01b §2); wirft «Einzeldatei fehlt: <name>.html …», wenn sie nicht gebaut ist.
 */
export function einzeldateiUrl(name: string): string {
  const datei = join(EINZELDATEI_ORDNER, `${name}.html`);
  if (!existsSync(datei)) {
    throw new Error(
      `Einzeldatei fehlt: ${name}.html. Nächster Schritt: tests/wap-e2e/harness/${name}.tsx anlegen und E2E über npm run wap:test:e2e starten (baut die Einzeldateien)`,
    );
  }
  return pathToFileURL(datei).href;
}

/** Dauerhaftes Profil, Netz gesperrt (ausser file://), Downloads erlaubt; restart() schliesst und startet neu. */
export interface OfflineHilfe {
  readonly context: BrowserContext;
  readonly abgebrochen: readonly string[];
  restart(): Promise<BrowserContext>;
  close(): Promise<void>;
}

export async function offlinePersistent(opts: { userDataDir: string }): Promise<OfflineHilfe> {
  const meldung =
    'offlinePersistent: userDataDir muss neu und unter dem Temp-Ordner oder test-results liegen';
  const pruefe = (pfad: string) => {
    if (/^[\\/]{2}/.test(pfad) || !isAbsolute(pfad)) throw new Error(meldung);
    let eltern = dirname(pfad);
    while (!existsSync(eltern)) {
      const naechster = dirname(eltern);
      if (naechster === eltern) throw new Error(meldung);
      eltern = naechster;
    }
    const echt = realpathSync.native(eltern);
    const erlaubt = [tmpdir(), join(process.cwd(), 'test-results')]
      .filter((p) => !/^[\\/]{2}/.test(p))
      .filter(existsSync)
      .map((p) => realpathSync.native(p));
    if (!erlaubt.some((p) => echt.toLowerCase() === p.toLowerCase() || liegtUnter(echt, p)))
      throw new Error(meldung);
    if (existsSync(pfad)) {
      const ziel = realpathSync.native(pfad);
      if (!erlaubt.some((p) => liegtUnter(ziel, p))) throw new Error(meldung);
      if (!statSync(pfad).isDirectory() || readdirSync(pfad).length > 0) throw new Error(meldung);
    }
  };
  try {
    pruefe(opts.userDataDir);
    pruefe(`${opts.userDataDir}.downloads`);
  } catch {
    throw new Error(meldung);
  }
  const abgebrochen: string[] = [];
  let context: BrowserContext;
  const starten = async () => {
    let gestartet: BrowserContext | undefined;
    try {
      gestartet = await chromium.launchPersistentContext(opts.userDataDir, {
        channel: 'msedge',
        headless: true,
        acceptDownloads: true,
        downloadsPath: `${opts.userDataDir}.downloads`,
        viewport: { width: 1600, height: 1000 },
        deviceScaleFactor: 1,
        locale: 'de-CH',
        timezoneId: 'Europe/Zurich',
      });
      await gestartet.setOffline(true);
      await gestartet.route(
        (u) => !['file:', 'data:', 'blob:'].includes(u.protocol),
        (r) => {
          abgebrochen.push(r.request().url());
          return r.abort('internetdisconnected');
        },
      );
      await gestartet.routeWebSocket(
        () => true,
        (ws) => {
          abgebrochen.push(ws.url());
          void ws.close();
        },
      );
      context = gestartet;
      return context;
    } catch (e) {
      await gestartet?.close().catch(() => undefined);
      throw new Error(
        `offlinePersistent: Start gescheitert: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };
  await starten();
  return {
    get context() {
      return context;
    },
    abgebrochen,
    async restart() {
      await context.close();
      return starten();
    },
    async close() {
      await context.close();
    },
  };
}
