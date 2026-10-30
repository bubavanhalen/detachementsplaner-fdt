// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17: startet Browser): E2E-Hilfen von E1-01c im Klon des Arbeitsstands.
// R-H-21: Registry der Kernzustände, Regeln beim Laden, Baseline-Befehl (nur fehlende Bilder des Pakets, ohne
// Gross/Klein), exakter Vergleich, fehlende Baseline, feste Uhr (clockAt), WAP-Schrift. R-H-22: withThrottle,
// dragFrameStats, perfHarnessUrl und messeImBrowser im Projekt perf mit wapPage (Stub-Meldung, fehlerhafte
// Eintragsdatei, Netzanfrage). R-H-25: offlinePersistent (Netz gesperrt und protokolliert, Neustart, Download,
// Prüfung des Profilordners, Aufräumen). R-H-26: Fixtures focusVisible und a11y.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.2–§2.5, §3 (e2e-support-c.selbsttest.ts); übernommen aus
// dem Entwurf e2e-support.selbsttest.entwurf.ts. Registry, Eintragsdateien und Spezifikationen entstehen nur im
// Klon (fiktive Seiten, keine Projektdaten); Edge-Prozesse und Profile unter der Sandbox werden aufgeräumt.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  LANG,
  neueSandbox,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import { perfHarness } from './support/vertrag';
import { einzeldateiModul } from './support/vertrag-b';
import {
  baselineJson,
  beendeEdgeUnter,
  drosselungJson,
  e2eC,
  e2eDetails,
  edgeProzesseNachFrist,
  erwarteGruen,
  farbfeld,
  kurz,
  kurzname,
  mitSchraegstrich,
  playwrightLauf,
  playwrightListe,
  pwErgebnisse,
  pwTest,
  redPhaseC,
  registryDatei,
  zaehlServer,
} from './support/vertrag-c';

const sandboxen: string[] = [];

afterEach(() => {
  for (const b of sandboxen.splice(0)) beendeEdgeUnter(b);
  aufraeumen();
});

function sandbox(): Sandbox {
  const sb = neueSandbox();
  sandboxen.push(sb.base);
  prozessUmgebung(sb);
  return sb;
}

const KONFIG = 'playwright.wap.config.ts';
const REGISTRY = 'tests/wap-e2e/support/kernzustaende';
const BASELINES = 'tests/wap-e2e/__screenshots__/chromium-visual';

/** Klon des Arbeitsstands ohne Registry-Dateien und Baselines anderer Pakete (nur eigene fiktive Einträge). */
function klon(sb: Sandbox): string {
  const k = arbeitsstandKlon(sb);
  rmSync(join(k.root, ...REGISTRY.split('/')), { recursive: true, force: true });
  rmSync(join(k.root, 'tests', 'wap-e2e', '__screenshots__'), { recursive: true, force: true });
  return k.root;
}

function baselines(root: string): string[] {
  const ordner = join(root, ...BASELINES.split('/'));
  return existsSync(ordner) ? readdirSync(ordner).sort() : [];
}

/**
 * Baseline-Befehl bzw. andere CLI-Aufrufe von scripts/wap-gate/e2e.mjs im Klon. Die Umgebung trägt
 * WAP_GATE_SPERRE des Selbsttest-Laufs (geschachtelte Sperre, Vertrag E1-01c §2.1 «CLI»). Ausgabe mit «/».
 */
function e2eCli(
  sb: Sandbox,
  root: string,
  args: string[],
  env: Record<string, string> = {},
): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'wap-gate', 'e2e.mjs'), ...args], {
    cwd: root,
    env: { ...sb.env, ...env },
    encoding: 'utf8',
    timeout: LANG,
    windowsHide: true,
    maxBuffer: 256 * 1024 * 1024,
  });
  expect(r.status, 'e2e.mjs: ohne Exit-Code (Zeitlimit oder Signal)').not.toBeNull();
  return { status: r.status, out: mitSchraegstrich(`${r.stdout ?? ''}${r.stderr ?? ''}`) };
}

// =========================================================================================================
// R-H-21 Kernzustände

const BESCHREIBUNG = 'Fiktiver Zustand für den Selbsttest der Bildschirm-Regression';

function registry(
  root: string,
  datei: string,
  eintraege: Parameters<typeof registryDatei>[0],
): void {
  writeText(root, `${REGISTRY}/${datei}`, registryDatei(eintraege));
}

const titel = (id: string, paket: string) => `[R-H-21] Kernzustand ${id} (${paket})`;

describe('Bildschirm-Regression: Registry und Regeln (R-H-21)', () => {
  it(
    '[R-H-21] Registry im Klon: ohne Ordner 0 Tests; mit e1-01.ts nennt --list «[R-H-21] Kernzustand e1-01-farbfeld (E1-01)» im Projekt chromium-visual',
    () => {
      const sb = sandbox();
      const root = klon(sb);
      const leer = playwrightListe(
        sb,
        root,
        ['-c', KONFIG, '--project', 'chromium-visual', '--pass-with-no-tests'],
        'liste-leer',
      );
      expect(leer.status, kurz(leer.out)).toBe(0);
      expect(leer.tests).toEqual([]);
      registry(root, 'e1-01.ts', [
        {
          id: 'e1-01-farbfeld',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          koerper: farbfeld('#2d63b5'),
        },
      ]);
      const l = playwrightListe(sb, root, ['-c', KONFIG, '--project', 'chromium-visual'], 'liste');
      expect(l.status, kurz(l.out)).toBe(0);
      expect(l.tests).toEqual([
        { titel: titel('e1-01-farbfeld', 'E1-01'), projekt: 'chromium-visual' },
      ]);
    },
    LANG,
  );

  it(
    '[R-H-21] Regeln §2.2 (doppelt in einer Datei und über Dateien, ohne Präfix, Grossbuchstaben, paket ≠ Datei, leere Beschreibung, uhr ohne Zone bzw. ungültig) → Laden rot, Meldung nennt Datei und id',
    () => {
      const sb = sandbox();
      const root = klon(sb);
      const gut = {
        id: 'e1-01-farbfeld',
        paket: 'E1-01',
        beschreibung: BESCHREIBUNG,
        koerper: farbfeld('#2d63b5'),
      };
      registry(root, 'e1-01.ts', [gut]);
      const kontrolle = playwrightListe(
        sb,
        root,
        ['-c', KONFIG, '--project', 'chromium-visual'],
        'kontrolle',
      );
      expect(kontrolle.status, kurz(kontrolle.out)).toBe(0);
      const faelle: {
        name: string;
        dateien: Record<string, Parameters<typeof registryDatei>[0]>;
        datei: string;
        id: string;
      }[] = [
        {
          name: 'doppelt in einer Datei',
          dateien: { 'e1-01.ts': [gut, gut] },
          datei: 'e1-01.ts',
          id: 'e1-01-farbfeld',
        },
        {
          name: 'doppelt über Dateien',
          dateien: {
            'e1-01.ts': [{ ...gut, id: 'e1-01-x-gleich' }],
            'e1-01-x.ts': [{ ...gut, id: 'e1-01-x-gleich', paket: 'E1-01-X' }],
          },
          datei: 'e1-01-x.ts',
          id: 'e1-01-x-gleich',
        },
        {
          name: 'ohne Präfix',
          dateien: { 'e1-01.ts': [{ ...gut, id: 'farbfeld' }] },
          datei: 'e1-01.ts',
          id: 'farbfeld',
        },
        {
          name: 'Grossbuchstaben',
          dateien: { 'e1-01.ts': [{ ...gut, id: 'e1-01-Farbfeld' }] },
          datei: 'e1-01.ts',
          id: 'e1-01-Farbfeld',
        },
        {
          name: 'paket ≠ Datei',
          dateien: { 'e1-01.ts': [{ ...gut, paket: 'E1-02' }] },
          datei: 'e1-01.ts',
          id: 'e1-01-farbfeld',
        },
        {
          name: 'leere Beschreibung',
          dateien: { 'e1-01.ts': [{ ...gut, beschreibung: '  ' }] },
          datei: 'e1-01.ts',
          id: 'e1-01-farbfeld',
        },
        {
          name: 'uhr ohne Zone',
          dateien: { 'e1-01.ts': [{ ...gut, uhr: '2026-09-28T08:00:00' }] },
          datei: 'e1-01.ts',
          id: 'e1-01-farbfeld',
        },
        {
          name: 'uhr ungültig',
          dateien: { 'e1-01.ts': [{ ...gut, uhr: '2026-13-45T08:00:00+02:00' }] },
          datei: 'e1-01.ts',
          id: 'e1-01-farbfeld',
        },
      ];
      for (const f of faelle) {
        rmSync(join(root, ...REGISTRY.split('/')), { recursive: true, force: true });
        for (const [datei, eintraege] of Object.entries(f.dateien))
          registry(root, datei, eintraege);
        const l = playwrightListe(
          sb,
          root,
          ['-c', KONFIG, '--project', 'chromium-visual'],
          `regel-${String(faelle.indexOf(f))}`,
        );
        expect(l.status, `${f.name}: Laden nicht rot`).not.toBe(0);
        expect(l.out, `${f.name}: Datei fehlt in der Meldung`).toContain(f.datei);
        expect(l.out, `${f.name}: id fehlt in der Meldung`).toContain(f.id);
      }
    },
    LANG,
  );
});

describe('Bildschirm-Regression: Baseline-Befehl und Vergleich (R-H-21)', () => {
  it(
    '[R-H-21] --baselines E1-01 schreibt genau das fehlende Bild des Pakets, kein fremdes (auch nicht E1-01b); zweiter Aufruf überschreibt nicht; --geaendert --grund überschreibt nur das eigene Bild mit genau einer Zeile in protokoll.log; --baselines e1-01 wählt dieselben Tests; Paket ohne Kernzustände → Exit 1 «keine Kernzustände für …», nichts geschrieben',
    () => {
      const sb = sandbox();
      const root = klon(sb);
      registry(root, 'e1-01.ts', [
        {
          id: 'e1-01-farbfeld',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          koerper: farbfeld('#2d63b5'),
        },
      ]);
      // Präfix-Kollision (TR-E101c-05 a): E1-01b darf von --baselines E1-01 nicht gewählt werden.
      registry(root, 'e1-01b.ts', [
        {
          id: 'e1-01b-farbfeld',
          paket: 'E1-01b',
          beschreibung: BESCHREIBUNG,
          koerper: farbfeld('#00aa00'),
        },
      ]);
      registry(root, 'e1-99.ts', [
        {
          id: 'e1-99-farbfeld',
          paket: 'E1-99',
          beschreibung: BESCHREIBUNG,
          koerper: farbfeld('#000000'),
        },
      ]);
      const erst = e2eCli(sb, root, ['--project', 'chromium-visual', '--baselines', 'E1-01']);
      expect(erst.status, kurz(erst.out)).toBe(0);
      expect(baselines(root)).toEqual(['e1-01-farbfeld.png']);
      expect(erst.out).toContain(`${BASELINES}/e1-01-farbfeld.png`);
      const bild = join(root, ...BASELINES.split('/'), 'e1-01-farbfeld.png');
      const vorher = readFileSync(bild);

      registry(root, 'e1-01.ts', [
        {
          id: 'e1-01-farbfeld',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          koerper: farbfeld('#ff0000'),
        },
      ]);
      const zweit = e2eCli(sb, root, ['--project', 'chromium-visual', '--baselines', 'E1-01']);
      expect(zweit.status, 'geänderter Zustand mit bestehender Baseline ist kein Erfolg').toBe(1);
      expect(readFileSync(bild).equals(vorher), 'bestehende Baseline überschrieben').toBe(true);
      expect(baselines(root)).toEqual(['e1-01-farbfeld.png']);

      // Fremdes Bild anlegen, dann absichtliche Änderung des eigenen (TR-E101c-05 b, ADR-010 §7.3).
      const fremd = e2eCli(sb, root, ['--project', 'chromium-visual', '--baselines', 'E1-99']);
      expect(fremd.status, kurz(fremd.out)).toBe(0);
      expect(baselines(root)).toEqual(['e1-01-farbfeld.png', 'e1-99-farbfeld.png']);
      const bildFremd = join(root, ...BASELINES.split('/'), 'e1-99-farbfeld.png');
      const fremdVorher = readFileSync(bildFremd);
      const protokoll = join(root, '.git', 'wap-gate', 'protokoll.log');
      const zeilen = () =>
        existsSync(protokoll)
          ? readFileSync(protokoll, 'utf8')
              .split(/\r?\n/)
              .filter((z) => z.trim() !== '')
          : [];
      const zeilenVorher = zeilen();
      const GRUND = 'fiktiver Grund Selbsttest E1-01c';
      const geaendert = e2eCli(sb, root, [
        '--project',
        'chromium-visual',
        '--baselines',
        'E1-01',
        '--geaendert',
        '--grund',
        GRUND,
      ]);
      expect(geaendert.status, kurz(geaendert.out)).toBe(0);
      expect(readFileSync(bild).equals(vorher), 'eigenes Bild nicht geändert').toBe(false);
      expect(readFileSync(bildFremd).equals(fremdVorher), 'fremdes Bild geändert').toBe(true);
      expect(baselines(root)).toEqual(['e1-01-farbfeld.png', 'e1-99-farbfeld.png']);
      const neueZeilen = zeilen().slice(zeilenVorher.length);
      expect(zeilen().slice(0, zeilenVorher.length)).toEqual(zeilenVorher);
      expect(neueZeilen.length, 'genau eine neue Zeile in protokoll.log').toBe(1);
      expect(neueZeilen[0] ?? '').toContain(GRUND);

      registry(root, 'e1-01.ts', [
        {
          id: 'e1-01-farbfeld',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          koerper: farbfeld('#2d63b5'),
        },
      ]);
      rmSync(bild);
      const klein = e2eCli(sb, root, ['--project', 'chromium-visual', '--baselines', 'e1-01']);
      expect(klein.status, kurz(klein.out)).toBe(0);
      expect(baselines(root)).toEqual(['e1-01-farbfeld.png', 'e1-99-farbfeld.png']);

      const keine = e2eCli(sb, root, ['--project', 'chromium-visual', '--baselines', 'E1-77']);
      expect(keine.status).toBe(1);
      expect(keine.out).toContain('keine Kernzustände für E1-77');
      expect(baselines(root)).toEqual(['e1-01-farbfeld.png', 'e1-99-farbfeld.png']);
    },
    LANG,
  );

  it(
    '[R-H-21] nach der Baseline: unverändert grün; ein Farbwert um 1 anders (#2d63b5 → #2d63b6) → rot mit dem Testnamen, keine fehlende Baseline',
    async () => {
      const sb = sandbox();
      const root = klon(sb);
      registry(root, 'e1-01.ts', [
        {
          id: 'e1-01-farbfeld',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          koerper: farbfeld('#2d63b5'),
        },
      ]);
      const b = e2eCli(sb, root, ['--project', 'chromium-visual', '--baselines', 'E1-01']);
      expect(b.status, kurz(b.out)).toBe(0);
      const { runE2e } = await e2eC();
      const gleich = await runE2e({ cwd: root, project: 'chromium-visual' });
      expect(gleich.ok, schrittText(gleich)).toBe(true);
      registry(root, 'e1-01.ts', [
        {
          id: 'e1-01-farbfeld',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          koerper: farbfeld('#2d63b6'),
        },
      ]);
      const anders = await runE2e({ cwd: root, project: 'chromium-visual' });
      expect(anders.ok).toBe(false);
      expect(anders.ursache ?? '').toContain('Kernzustand e1-01-farbfeld');
      expect(e2eDetails(anders).fehlendeBaselines ?? []).toEqual([]);
    },
    LANG,
  );

  it(
    '[R-H-21] Baseline fehlt → runE2e rot, details.fehlendeBaselines nennt den Test, keine Datei geschrieben',
    async () => {
      const sb = sandbox();
      const root = klon(sb);
      registry(root, 'e1-01.ts', [
        {
          id: 'e1-01-farbfeld',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          koerper: farbfeld('#2d63b5'),
        },
      ]);
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'chromium-visual' });
      expect(r.ok).toBe(false);
      const fehlend = e2eDetails(r).fehlendeBaselines;
      expect(Array.isArray(fehlend), 'details.fehlendeBaselines fehlt').toBe(true);
      expect(fehlend?.length).toBe(1);
      expect(fehlend?.[0] ?? '').toContain('Kernzustand e1-01-farbfeld (E1-01)');
      expect(baselines(root)).toEqual([]);
    },
    LANG,
  );
});

describe('Bildschirm-Regression: Uhr und WAP-Schrift (R-H-21)', () => {
  /** herstellen: zeigt die Seitenzeit und hängt Date.now() der Seite an die Datei aus `variable` an. */
  const uhrKoerper = (variable: string) =>
    [
      `      await page.setContent('<html lang="de"><head><title>Fiktiv</title></head><body style="margin:0;font-size:20px"><p id="zeit"></p></body></html>');`,
      "      const jetzt = await page.evaluate(() => { const t = Date.now(); document.getElementById('zeit')!.textContent = new Date(t).toISOString(); return t; });",
      `      writeFileSync(process.env.${variable} ?? '', String(jetzt) + '\\n', { flag: 'a' });`,
    ].join('\n');

  it(
    '[R-H-21] uhr: der Zustand zeigt die feste Zeit (eigene uhr bzw. Vorgabe 2026-09-28T08:00:00+02:00), zwei Läufe gleich (Baseline-Befehl, dann Vergleich grün)',
    async () => {
      const sb = sandbox();
      const root = klon(sb);
      const markeEigen = join(sb.base, 'uhr-eigen.txt');
      const markeVorgabe = join(sb.base, 'uhr-vorgabe.txt');
      registry(root, 'e1-01.ts', [
        {
          id: 'e1-01-uhr-eigen',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          uhr: '2026-10-05T13:45:00+02:00',
          koerper: uhrKoerper('WAP_ZZ_UHR_EIGEN'),
        },
        {
          id: 'e1-01-uhr-vorgabe',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          koerper: uhrKoerper('WAP_ZZ_UHR_VORGABE'),
        },
      ]);
      const env = { WAP_ZZ_UHR_EIGEN: markeEigen, WAP_ZZ_UHR_VORGABE: markeVorgabe };
      const b = e2eCli(sb, root, ['--project', 'chromium-visual', '--baselines', 'E1-01'], env);
      expect(b.status, kurz(b.out)).toBe(0);
      expect(baselines(root)).toEqual(['e1-01-uhr-eigen.png', 'e1-01-uhr-vorgabe.png']);
      vi.stubEnv('WAP_ZZ_UHR_EIGEN', markeEigen);
      vi.stubEnv('WAP_ZZ_UHR_VORGABE', markeVorgabe);
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'chromium-visual' });
      expect(r.ok, schrittText(r)).toBe(true);
      const zeiten = (datei: string) =>
        readFileSync(datei, 'utf8')
          .split('\n')
          .filter((z) => z !== '')
          .map(Number);
      expect(zeiten(markeEigen)).toEqual([
        Date.parse('2026-10-05T13:45:00+02:00'),
        Date.parse('2026-10-05T13:45:00+02:00'),
      ]);
      expect(zeiten(markeVorgabe)).toEqual([
        Date.parse('2026-09-28T08:00:00+02:00'),
        Date.parse('2026-09-28T08:00:00+02:00'),
      ]);
    },
    LANG,
  );

  it(
    '[R-H-21] clockAt: ohne Zone → wirft «clockAt: Zeitangabe ohne Zone: <iso>», ungültig → «clockAt: ungültige Zeitangabe: <iso>»; gilt auch für später geladene Dokumente, Timer laufen weiter',
    () => {
      const sb = sandbox();
      const root = klon(sb);
      const seite = writeText(
        sb.base,
        'seite.html',
        '<!doctype html><html lang="de"><head><title>Fiktiv</title></head><body><p>Fiktiv</p></body></html>',
      );
      writeText(
        root,
        'tests/wap-e2e/zz-selbsttest/zz-uhr.spec.ts',
        [
          "import { expect } from '@playwright/test';",
          "import { test } from '../support/fixtures';",
          '',
          "test('zz clockAt Fehler', async ({ clockAt }) => {",
          "  await expect((async () => clockAt('2026-09-28T08:00:00'))()).rejects.toThrow('clockAt: Zeitangabe ohne Zone: 2026-09-28T08:00:00');",
          "  await expect((async () => clockAt('2026-13-45T08:00:00+02:00'))()).rejects.toThrow('clockAt: ungültige Zeitangabe: 2026-13-45T08:00:00+02:00');",
          '});',
          '',
          "test('zz clockAt vor goto', async ({ page, clockAt }) => {",
          "  await clockAt('2026-09-28T06:00:00Z');",
          `  await page.goto(${JSON.stringify(pathToFileURL(seite).href)});`,
          "  expect(await page.evaluate(() => Date.now())).toBe(Date.parse('2026-09-28T06:00:00Z'));",
          "  const timer = await page.evaluate(() => new Promise<string>((res) => { setTimeout(() => res('gelaufen'), 50); }));",
          "  expect(timer).toBe('gelaufen');",
          '});',
          '',
        ].join('\n'),
      );
      const l = playwrightLauf(sb, root, ['-c', KONFIG, '--project=edge', 'zz-uhr'], {
        name: 'uhr',
      });
      const erg = pwErgebnisse(l.bericht);
      erwarteGruen(pwTest(erg, 'zz clockAt Fehler'));
      erwarteGruen(pwTest(erg, 'zz clockAt vor goto'));
    },
    LANG,
  );

  it(
    '[R-H-21] WAP-Schrift: Fläche «WAP Arimo» geladen → Baseline-Befehl gelingt, Vergleich grün; Fläche mit Status error → Test rot «WAP-Schrift nicht geladen», keine fehlende Baseline',
    async () => {
      const sb = sandbox();
      const root = klon(sb);
      const SEITE = `      await page.setContent('<html lang="de"><head><title>Fiktiv</title></head><body style="margin:0"><p style="font-family:\\'WAP Arimo\\';font-size:24px">Fiktive Übung 0700</p></body></html>');`;
      registry(root, 'e1-01.ts', [
        {
          id: 'e1-01-schrift',
          paket: 'E1-01',
          beschreibung: BESCHREIBUNG,
          koerper: [
            SEITE,
            "      const b64 = readFileSync(join(process.cwd(), 'src', 'assets', 'wap-fonts', 'Arimo-Regular.ttf')).toString('base64');",
            '      await page.evaluate(async (daten) => {',
            '        const bytes = Uint8Array.from(atob(daten), (c) => c.charCodeAt(0));',
            "        const f = new FontFace('WAP Arimo', bytes.buffer);",
            '        document.fonts.add(f);',
            '        await f.load();',
            '      }, b64);',
          ].join('\n'),
        },
      ]);
      registry(root, 'e1-98.ts', [
        {
          id: 'e1-98-schrift-fehler',
          paket: 'E1-98',
          beschreibung: BESCHREIBUNG,
          koerper: [
            SEITE,
            '      await page.evaluate(async () => {',
            "        const f = new FontFace('WAP Arimo', new Uint8Array([0, 1, 2, 3]).buffer);",
            '        document.fonts.add(f);',
            '        await f.load().catch(() => undefined);',
            '      });',
          ].join('\n'),
        },
      ]);
      const b = e2eCli(sb, root, ['--project', 'chromium-visual', '--baselines', 'E1-01']);
      expect(b.status, kurz(b.out)).toBe(0);
      expect(baselines(root)).toEqual(['e1-01-schrift.png']);
      const { runE2e } = await e2eC();
      const r = await runE2e({ cwd: root, project: 'chromium-visual' });
      expect(r.ok, 'Zustand mit Schriftfehler ist grün').toBe(false);
      expect(e2eDetails(r).fehlendeBaselines ?? []).toEqual([]);
      const erg = pwErgebnisse(join(root, 'test-results', 'wap', 'playwright-visual.json'));
      erwarteGruen(pwTest(erg, titel('e1-01-schrift', 'E1-01')));
      const fehler = pwTest(erg, titel('e1-98-schrift-fehler', 'E1-98'));
      expect(fehler.status).toBe('failed');
      expect(fehler.meldungen.join('\n')).toContain('WAP-Schrift nicht geladen: error');
    },
    LANG,
  );
});

// =========================================================================================================
// R-H-22 Leistungs-Hilfen im Browser (Projekt perf, Playwright-Chromium, sichtbares Fenster)

/** Eintragsdatei des Klons mit fiktiven Messungen (Budgets nach der Budgettabelle). */
const EINTRAEGE = [
  "import { registerPerfEntries } from '../harness';",
  '',
  'registerPerfEntries([',
  "  { name: 'zzSelbsttestMessung', anforderung: 'R-11-12', budgetMs: 300, prepare: async (seed: number) => seed, run: async () => { await new Promise((r) => setTimeout(r, 5)); } },",
  "  { name: 'zzStubMessung', anforderung: 'R-11-14', budgetMs: 500, prepare: async (seed: number) => seed, run: async () => { throw new Error('nicht implementiert: produkt.x'); } },",
  "  { name: 'zzNetzMessung', anforderung: 'R-11-15', budgetMs: 3000, prepare: async (seed: number) => seed, run: async () => { await fetch('http://127.0.0.1:9/zz-netz').catch(() => undefined); } },",
  ']);',
  '',
].join('\n');

/** Klon mit Eintragsdatei, Harness nach test-results/wap/perf-harness gebaut. */
async function perfKlon(sb: Sandbox, eintraege: Record<string, string>): Promise<string> {
  const root = klon(sb);
  for (const [datei, inhalt] of Object.entries(eintraege)) {
    writeText(root, `tests/wap-perf/harness/entries/${datei}`, inhalt);
  }
  const { buildPerfHarness } = await perfHarness();
  const r = await buildPerfHarness({
    cwd: root,
    outDir: join(root, 'test-results', 'wap', 'perf-harness'),
  });
  expect(r.ok, schrittText(r)).toBe(true);
  return root;
}

function perfLauf(sb: Sandbox, root: string, filter: string, name: string) {
  return playwrightLauf(sb, root, ['-c', KONFIG, '--project=perf', '--workers=1', filter], {
    name,
  });
}

describe('Leistungs-Hilfen im Browser (R-H-22)', () => {
  it(
    '[R-H-22] withThrottle: Faktor 4 aus drosselung.json im cwd → Arbeitslast mindestens 2× langsamer, danach wieder unter 1,5×, Ergebnis von fn; Faktor null → wirft «Drosselungsfaktor nicht festgelegt (Umgebungsprobe ausstehend)»',
    () => {
      const sb = sandbox();
      const root = klon(sb);
      const drosselung = join(root, 'docs', 'wap-planer', 'perf', 'drosselung.json');
      writeFileSync(drosselung, drosselungJson(4, 'festgelegt'));
      const kopf = [
        "import { expect, test } from '@playwright/test';",
        "import { withThrottle } from '../support/perf';",
        '',
      ];
      writeText(
        root,
        'tests/wap-perf/zz-selbsttest/zz-drossel-vier.perf.ts',
        [
          ...kopf,
          'async function arbeit(page: import("@playwright/test").Page): Promise<number> {',
          '  return page.evaluate(() => { const t0 = performance.now(); let s = 0; for (let i = 0; i < 20_000_000; i++) s += Math.sqrt(i); return s > 0 ? performance.now() - t0 : -1; });',
          '}',
          'async function median(page: import("@playwright/test").Page): Promise<number> {',
          '  const w: number[] = [];',
          '  for (let i = 0; i < 7; i++) w.push(await arbeit(page));',
          '  return w.sort((a, b) => a - b)[3] ?? Number.NaN;',
          '}',
          "test('zz drossel vier', async ({ page }) => {",
          '  await page.setContent(\'<html lang="de"><head><title>Fiktiv</title></head><body></body></html>\');',
          '  await median(page);',
          '  const vorher = await median(page);',
          '  const gedrosselt = await withThrottle(page, () => median(page));',
          '  const nachher = await median(page);',
          '  expect(gedrosselt).toBeGreaterThanOrEqual(2 * vorher);',
          '  expect(nachher).toBeLessThan(1.5 * vorher);',
          '  expect(await withThrottle(page, async () => 42)).toBe(42);',
          '});',
          '',
        ].join('\n'),
      );
      writeText(
        root,
        'tests/wap-perf/zz-selbsttest/zz-drossel-null.perf.ts',
        [
          ...kopf,
          "test('zz drossel null', async ({ page }) => {",
          "  await expect((async () => withThrottle(page, async () => 1))()).rejects.toThrow('Drosselungsfaktor nicht festgelegt (Umgebungsprobe ausstehend)');",
          '});',
          '',
        ].join('\n'),
      );
      const vier = perfLauf(sb, root, 'zz-drossel-vier', 'drossel-vier');
      erwarteGruen(pwTest(pwErgebnisse(vier.bericht), 'zz drossel vier'));
      writeFileSync(drosselung, drosselungJson(null, 'festgelegt'));
      const nichts = perfLauf(sb, root, 'zz-drossel-null', 'drossel-null');
      erwarteGruen(pwTest(pwErgebnisse(nichts.bericht), 'zz drossel null'));
    },
    LANG,
  );

  it(
    '[R-H-22] dragFrameStats: ruhiges Ziehen p95FrameMs > 0; 150-ms-Block → laengsteAufgabeMs ≥ 100; Aufruf dauert ≥ 2000 ms',
    () => {
      const sb = sandbox();
      const root = klon(sb);
      writeText(
        root,
        'tests/wap-perf/zz-selbsttest/zz-drag.perf.ts',
        [
          "import { expect, test } from '@playwright/test';",
          "import { dragFrameStats } from '../support/perf';",
          '',
          "test('zz drag', async ({ page }) => {",
          '  await page.setContent(\'<html lang="de"><head><title>Fiktiv</title></head><body><div style="width:400px;height:300px"></div></body></html>\');',
          '  const t0 = Date.now();',
          '  const ruhig = await dragFrameStats(page, async () => {',
          '    await page.mouse.move(10, 10);',
          '    await page.mouse.down();',
          '    for (let i = 0; i < 20; i++) await page.mouse.move(10 + i * 5, 10);',
          '    await page.mouse.up();',
          '  }, 2000);',
          '  expect(Date.now() - t0).toBeGreaterThanOrEqual(2000);',
          '  expect(ruhig.p95FrameMs).toBeGreaterThan(0);',
          '  const lang = await dragFrameStats(page, async () => {',
          '    await page.evaluate(() => new Promise<void>((res) => { setTimeout(() => { const t = performance.now(); while (performance.now() - t < 150) { /* belegt */ } res(); }, 0); }));',
          '  }, 2000);',
          '  expect(lang.laengsteAufgabeMs).toBeGreaterThanOrEqual(100);',
          '});',
          '',
        ].join('\n'),
      );
      const l = perfLauf(sb, root, 'zz-drag', 'drag');
      erwarteGruen(pwTest(pwErgebnisse(l.bericht), 'zz drag'));
    },
    LANG,
  );

  it(
    '[R-H-22] e2e.mjs --project perf (geschachtelt, ohne Fremdlast) vergleicht nach dem Lauf mit comparePerf: Baseline mit einer Messgrösse, kein Leistungstest dazu → Exit 1 «Messgrösse fehlt: <name>» (TR-E101c-08 a)',
    () => {
      const sb = sandbox();
      const root = klon(sb);
      const drosselung = JSON.parse(
        readFileSync(join(root, 'docs', 'wap-planer', 'perf', 'drosselung.json'), 'utf8'),
      ) as { faktor: number };
      writeText(
        root,
        'docs/wap-planer/perf/perf-baseline.json',
        baselineJson(
          { zzNurInBaseline: { medianMs: 20, budgetMs: 300, anforderung: 'R-11-12' } },
          drosselung.faktor,
        ),
      );
      const r = e2eCli(sb, root, ['--project', 'perf']);
      expect(r.status).toBe(1);
      expect(r.out).toContain('Messgrösse fehlt: zzNurInBaseline');
    },
    LANG,
  );

  const MESSEN_SPEC = [
    "import { expect } from '@playwright/test';",
    "import { test } from '../../wap-e2e/support/fixtures';",
    "import { messeImBrowser, perfHarnessUrl } from '../support/perf';",
    '',
    "test('zz messen', async ({ wapPage }) => {",
    '  await wapPage.goto(perfHarnessUrl());',
    "  const ms = await messeImBrowser(wapPage, 'zzSelbsttestMessung');",
    '  expect(Number.isFinite(ms)).toBe(true);',
    '  expect(ms).toBeGreaterThanOrEqual(0);',
    '});',
    '',
    "test('zz stub', async ({ wapPage }) => {",
    '  await wapPage.goto(perfHarnessUrl());',
    "  await messeImBrowser(wapPage, 'zzStubMessung');",
    '});',
    '',
    "test('zz netz', async ({ wapPage }) => {",
    '  await wapPage.goto(perfHarnessUrl());',
    "  await messeImBrowser(wapPage, 'zzNetzMessung');",
    '});',
    '',
  ].join('\n');

  it(
    '[R-H-22] perfHarnessUrl und messeImBrowser im Projekt perf mit wapPage (ohne WAP_E2E_PORT): Zahl ≥ 0; Harness fehlt → «Leistungs-Harness fehlt: test-results/wap/perf-harness/index.html. Nächster Schritt: npm run wap:test:perf»',
    async () => {
      const sb = sandbox();
      const root = await perfKlon(sb, { 'zz-selbsttest.ts': EINTRAEGE });
      writeText(root, 'tests/wap-perf/zz-selbsttest/zz-messen.perf.ts', MESSEN_SPEC);
      const l = perfLauf(sb, root, 'zz-messen', 'messen');
      erwarteGruen(pwTest(pwErgebnisse(l.bericht), 'zz messen'));
      rmSync(join(root, 'test-results', 'wap', 'perf-harness'), { recursive: true, force: true });
      writeText(
        root,
        'tests/wap-perf/zz-selbsttest/zz-fehlt.perf.ts',
        [
          "import { expect, test } from '@playwright/test';",
          "import { perfHarnessUrl } from '../support/perf';",
          '',
          "test('zz fehlt', () => {",
          "  expect(() => perfHarnessUrl()).toThrow('Leistungs-Harness fehlt: test-results/wap/perf-harness/index.html. Nächster Schritt: npm run wap:test:perf');",
          '});',
          '',
        ].join('\n'),
      );
      const f = perfLauf(sb, root, 'zz-fehlt', 'fehlt');
      erwarteGruen(pwTest(pwErgebnisse(f.bericht), 'zz fehlt'));
    },
    LANG,
  );

  it(
    '[R-H-22] Eintrag, dessen run «nicht implementiert: produkt.x» wirft → messeImBrowser wirft genau diese Meldung (ohne «page.evaluate: »), fachlichRot mit Stub-Liste [produkt.x] ist wahr (V05)',
    async () => {
      const sb = sandbox();
      const root = await perfKlon(sb, { 'zz-selbsttest.ts': EINTRAEGE });
      writeText(root, 'tests/wap-perf/zz-selbsttest/zz-messen.perf.ts', MESSEN_SPEC);
      const l = perfLauf(sb, root, 'zz-messen', 'stub');
      const t = pwTest(pwErgebnisse(l.bericht), 'zz stub');
      expect(t.status).toBe('failed');
      expect(t.meldungen.length).toBeGreaterThan(0);
      const erste = t.meldungen[0] ?? '';
      expect(kurz(erste).split('\n')[0]).toBe('Error: nicht implementiert: produkt.x');
      const { fachlichRot } = await redPhaseC();
      expect(fachlichRot(`${erste}\n`, ['produkt.x'])).toBe(true);
      expect(fachlichRot(`${erste}\n`, [])).toBe(false);
    },
    LANG,
  );

  it(
    '[R-H-22] fetch aus einer Eintragsdatei → der Leistungstest mit wapPage ist rot (Konsolenfehler oder Netzanfrage, V11)',
    async () => {
      const sb = sandbox();
      const root = await perfKlon(sb, { 'zz-selbsttest.ts': EINTRAEGE });
      writeText(root, 'tests/wap-perf/zz-selbsttest/zz-messen.perf.ts', MESSEN_SPEC);
      const l = perfLauf(sb, root, 'zz-messen', 'netz');
      const erg = pwErgebnisse(l.bericht);
      erwarteGruen(pwTest(erg, 'zz messen'));
      const t = pwTest(erg, 'zz netz');
      expect(t.status).toBe('failed');
      expect(t.meldungen.join('\n')).toMatch(/Netzanfrage ausserhalb der App|Konsolenfehler/);
    },
    LANG,
  );

  it(
    '[R-H-22] werfende Eintragsdatei → messeImBrowser wirft «Leistungs-Harness: Eintragsdatei fehlerhaft»; Seite ohne data-wap-perf → «Leistungs-Harness nicht bereit» (V13)',
    async () => {
      const sb = sandbox();
      const root = await perfKlon(sb, {
        'zz-selbsttest.ts': EINTRAEGE,
        'zz-wirft.ts': "throw new Error('fiktiver Fehler der Eintragsdatei');\nexport {};\n",
      });
      writeText(
        root,
        'tests/wap-perf/zz-selbsttest/zz-fehlerhaft.perf.ts',
        [
          "import { expect, test } from '@playwright/test';",
          "import { messeImBrowser, perfHarnessUrl } from '../support/perf';",
          '',
          "test('zz fehlerhaft', async ({ page }) => {",
          '  await page.goto(perfHarnessUrl());',
          "  await expect((async () => messeImBrowser(page, 'zzSelbsttestMessung'))()).rejects.toThrow('Leistungs-Harness: Eintragsdatei fehlerhaft');",
          '});',
          '',
          "test('zz nicht bereit', async ({ page }) => {",
          '  await page.setContent(\'<html lang="de"><head><title>Fiktiv</title></head><body><p>leer</p></body></html>\');',
          "  await expect((async () => messeImBrowser(page, 'zzSelbsttestMessung'))()).rejects.toThrow('Leistungs-Harness nicht bereit');",
          '});',
          '',
        ].join('\n'),
      );
      const l = perfLauf(sb, root, 'zz-fehlerhaft', 'fehlerhaft');
      const erg = pwErgebnisse(l.bericht);
      erwarteGruen(pwTest(erg, 'zz fehlerhaft'));
      erwarteGruen(pwTest(erg, 'zz nicht bereit'));
    },
    LANG,
  );
});

// =========================================================================================================
// R-H-25 Offline-Hilfe (dauerhaftes Profil in Edge, Netz gesperrt)

const SICHERN_SEITE =
  '<!doctype html><html lang="de"><head><title>Fiktiv</title></head><body>' +
  '<button id="s">Datei sichern</button><script>' +
  'document.getElementById("s").onclick = () => { const a = document.createElement("a");' +
  'a.href = URL.createObjectURL(new Blob(["Planinhalt fiktiv"], { type: "application/json" }));' +
  'a.download = "plan.wap.json"; a.click(); };</script></body></html>';

const OFFLINE_KOPF = [
  "import { existsSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';",
  "import { join, sep } from 'node:path';",
  "import { pathToFileURL } from 'node:url';",
  "import { expect, type Page, test } from '@playwright/test';",
  "import { offlinePersistent } from '../support/fixtures';",
  '',
  '// Zwei bzw. vier Starts von Edge mit dauerhaftem Profil (kalter Start je etwa 5–10 s) plus Download: das',
  '// Vorgabelimit von 30 s ist dafür knapp (TR-E101c-10 d). 120 s je Test; ein Hängen bleibt rot.',
  'test.setTimeout(120_000);',
  '',
  'function env(n: string): string {',
  '  const v = process.env[n];',
  "  if (v === undefined || v === '') throw new Error('Test-Aufbau: ' + n + ' fehlt');",
  '  return v;',
  '}',
  '',
  '/** Proben gegen den lokalen Zähl-Server (WAP_ZZ_PORT); er muss 0 Verbindungen sehen (TR-E101c-01). */',
  'async function proben(page: Page, n: number): Promise<string[]> {',
  "  const port = env('WAP_ZZ_PORT');",
  "  const f = await page.evaluate(async (u) => { try { await fetch(u); return 'erreicht'; } catch { return 'gesperrt'; } }, 'http://127.0.0.1:' + port + '/zz-' + String(n));",
  "  const w = await page.evaluate((u) => new Promise<string>((res) => { const s = new WebSocket(u); s.onopen = () => res('offen'); s.onclose = () => res('zu'); setTimeout(() => res('zeit'), 5000); }), 'ws://127.0.0.1:' + port + '/zz-ws-' + String(n));",
  '  return [f, w];',
  '}',
  '',
  'function weg(profil: string): void {',
  '  rmSync(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });',
  "  rmSync(profil + '.downloads', { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });",
  '}',
  '',
  'void existsSync; void readdirSync; void readFileSync; void realpathSync; void join; void sep;',
  '',
].join('\n');

const OFFLINE_ABLAUF = [
  OFFLINE_KOPF,
  "test('zz offline ablauf', async () => {",
  "  const profil = env('WAP_ZZ_PROFIL');",
  "  const port = env('WAP_ZZ_PORT');",
  "  const url = pathToFileURL(env('WAP_ZZ_SEITE')).href;",
  '  const hilfe = await offlinePersistent({ userDataDir: profil });',
  '  try {',
  '    const alt = hilfe.context;',
  '    let zu = false;',
  "    alt.on('close', () => { zu = true; });",
  '    let page = alt.pages()[0] ?? (await alt.newPage());',
  '    await page.goto(url);',
  '    expect(await page.evaluate(() => navigator.onLine)).toBe(false);',
  "    expect(await proben(page, 1)).toEqual(['gesperrt', 'zu']);",
  "    await page.evaluate(() => localStorage.setItem('wap-probe', 'erhalten'));",
  '    const neu = await hilfe.restart();',
  '    expect(neu).not.toBe(alt);',
  '    expect(hilfe.context).toBe(neu);',
  '    expect(zu).toBe(true);',
  '    page = neu.pages()[0] ?? (await neu.newPage());',
  '    await page.goto(url);',
  '    expect(await page.evaluate(() => navigator.onLine)).toBe(false);',
  "    expect(await page.evaluate(() => localStorage.getItem('wap-probe'))).toBe('erhalten');",
  "    expect(await proben(page, 2)).toEqual(['gesperrt', 'zu']);",
  "    const h = 'http://127.0.0.1:' + port;",
  "    const w = 'ws://127.0.0.1:' + port;",
  "    expect(hilfe.abgebrochen.filter((u) => u.includes('/zz-'))).toEqual([h + '/zz-1', w + '/zz-ws-1', h + '/zz-2', w + '/zz-ws-2']);",
  '    const [download] = await Promise.all([',
  "      page.waitForEvent('download'),",
  "      page.getByRole('button', { name: 'Datei sichern' }).click(),",
  '    ]);',
  '    expect(await download.failure()).toBeNull();',
  '    // Downloads liegen unter <userDataDir>.downloads (TR-E101c-02).',
  '    const roh = await download.path();',
  "    const ablage = realpathSync.native(profil + '.downloads').toLowerCase();",
  '    expect(realpathSync.native(roh).toLowerCase().startsWith(ablage + sep)).toBe(true);',
  "    const ziel = join(env('WAP_ZZ_ABLAGE'), 'gesichert.wap.json');",
  '    await download.saveAs(ziel);',
  "    expect(download.suggestedFilename()).toBe('plan.wap.json');",
  "    expect(readFileSync(ziel, 'utf8')).toBe('Planinhalt fiktiv');",
  '    // Das übergebene Profil wird benutzt: es enthält vor close() Dateien (TR-E101c-02).',
  '    expect(readdirSync(profil).length).toBeGreaterThan(0);',
  '  } finally {',
  '    await hilfe.close();',
  '    weg(profil);',
  '  }',
  '});',
  '',
].join('\n');

const OFFLINE_PFADE = [
  OFFLINE_KOPF,
  'async function startUndSchluss(profil: string): Promise<void> {',
  '  const hilfe = await offlinePersistent({ userDataDir: profil });',
  '  try {',
  '    const page = hilfe.context.pages()[0] ?? (await hilfe.context.newPage());',
  "    await page.goto(pathToFileURL(env('WAP_ZZ_SEITE')).href);",
  "    await page.evaluate(() => localStorage.setItem('wap-probe', 'gefuellt'));",
  '    const neu = await hilfe.restart();',
  '    const p2 = neu.pages()[0] ?? (await neu.newPage());',
  "    await p2.goto(pathToFileURL(env('WAP_ZZ_SEITE')).href);",
  "    expect(await p2.evaluate(() => localStorage.getItem('wap-probe'))).toBe('gefuellt');",
  '  } finally {',
  '    await hilfe.close();',
  '    weg(profil);',
  '  }',
  '}',
  '',
  "test('zz offline kurzname', async () => {",
  "  await startUndSchluss(env('WAP_ZZ_KURZ'));",
  '});',
  '',
  "test('zz offline test-results', async () => {",
  "  await startUndSchluss(join(process.cwd(), 'test-results', 'zz-offline', 'profil'));",
  '});',
  '',
  "test('zz offline abgelehnt', async () => {",
  "  const meldung = 'offlinePersistent: userDataDir muss neu und unter dem Temp-Ordner oder test-results liegen';",
  "  const voll = env('WAP_ZZ_VOLL');",
  "  for (const p of ['zz-relativ-profil', env('WAP_ZZ_AUSSERHALB'), voll]) {",
  '    await expect((async () => offlinePersistent({ userDataDir: p }))()).rejects.toThrow(meldung);',
  '  }',
  "  expect(existsSync(join(process.cwd(), 'zz-relativ-profil'))).toBe(false);",
  "  expect(existsSync(env('WAP_ZZ_AUSSERHALB'))).toBe(false);",
  "  expect(readdirSync(voll)).toEqual(['fiktiv.txt']);",
  '});',
  '',
].join('\n');

interface OfflinePfade {
  temp: string;
  profil: string;
  ablage: string;
  seite: string;
  kurzProfil: string;
  ausserhalb: string;
  voll: string;
}

/** Eigener Temp-Ordner für den Playwright-Lauf (TEMP/TMP) und die Profilpfade der Fälle. */
function offlinePfade(sb: Sandbox): OfflinePfade {
  const temp = join(sb.base, 'temp-eigen');
  mkdirSync(join(temp, 'ablauf'), { recursive: true });
  const langerOrdner = join(temp, 'kurzname-ordner-lang');
  mkdirSync(langerOrdner, { recursive: true });
  const voll = join(temp, 'voll');
  writeText(voll, 'fiktiv.txt', 'fiktiver Inhalt\n');
  mkdirSync(join(sb.base, 'ausserhalb'), { recursive: true });
  const ablage = join(sb.base, 'ablage');
  mkdirSync(ablage, { recursive: true });
  return {
    temp,
    profil: join(temp, 'ablauf', 'profil'),
    ablage,
    seite: writeText(sb.base, 'seite.html', SICHERN_SEITE),
    kurzProfil: join(kurzname(langerOrdner), 'profil-k'),
    ausserhalb: join(sb.base, 'ausserhalb', 'profil'),
    voll,
  };
}

function offlineEnv(p: OfflinePfade): Record<string, string> {
  return {
    TEMP: p.temp,
    TMP: p.temp,
    WAP_ZZ_PROFIL: p.profil,
    WAP_ZZ_ABLAGE: p.ablage,
    WAP_ZZ_SEITE: p.seite,
    WAP_ZZ_KURZ: p.kurzProfil,
    WAP_ZZ_AUSSERHALB: p.ausserhalb,
    WAP_ZZ_VOLL: p.voll,
  };
}

/**
 * Nach dem Test: kein Profil, kein Download-Ordner, kein Edge-Prozess mit diesen Profilen (Edge-Prozesse bis 5 s
 * nachgeprüft, TR-E101c-10 a).
 */
function erwarteAufgeraeumt(profile: string[]): void {
  for (const p of profile) {
    expect(existsSync(p), `Profil blieb liegen: ${p}`).toBe(false);
    expect(existsSync(`${p}.downloads`), `Download-Ordner blieb liegen: ${p}`).toBe(false);
  }
  expect(edgeProzesseNachFrist(profile), 'Edge-Prozess mit diesem userDataDir läuft noch').toEqual(
    [],
  );
}

describe('Offline-Hilfe offlinePersistent (R-H-25)', () => {
  it(
    '[R-H-25] Entwurfsfall und Netzprotokoll: navigator.onLine false, fetch und WebSocket an einen lokalen Zähl-Server in beiden Starts gesperrt (0 Verbindungen, 0 Anfragen, 0 Upgrades) und in abgebrochen aufgeführt; Profil benutzt; restart() liefert neuen Kontext, alter geschlossen; localStorage erhalten; «Datei sichern» per Download unter <userDataDir>.downloads; danach aufgeräumt',
    async () => {
      const sb = sandbox();
      const root = klon(sb);
      const p = offlinePfade(sb);
      writeText(root, 'tests/wap-e2e/zz-selbsttest/zz-offline-ablauf.spec.ts', OFFLINE_ABLAUF);
      const server = await zaehlServer(sb);
      try {
        const l = playwrightLauf(sb, root, ['-c', KONFIG, '--project=edge', 'zz-offline-ablauf'], {
          name: 'offline-ablauf',
          env: { ...offlineEnv(p), WAP_ZZ_PORT: String(server.port) },
          // 120 s je erzeugtem Test; das Vorgabelimit des Kindlaufs (300 s) wäre zu knapp (TR-E101c-13).
          timeout: LANG,
        });
        erwarteGruen(pwTest(pwErgebnisse(l.bericht), 'zz offline ablauf'));
        expect(server.zaehlung(), 'Anfragen am lokalen Zähl-Server').toEqual({
          verbindungen: 0,
          anfragen: 0,
          upgrades: 0,
        });
      } finally {
        server.beenden();
      }
      expect(readFileSync(join(p.ablage, 'gesichert.wap.json'), 'utf8')).toBe('Planinhalt fiktiv');
      erwarteAufgeraeumt([p.profil]);
    },
    LANG,
  );

  it(
    '[R-H-25] Profilordner: 8.3-Kurzname des Temp-Ordners und Ordner unter test-results angenommen, restart() mit gefülltem Profil gelingt; relativer Pfad, Ordner ausserhalb von Temp/test-results und nicht leerer Ordner → je wirft ohne Start; danach aufgeräumt',
    () => {
      const sb = sandbox();
      const root = klon(sb);
      const p = offlinePfade(sb);
      mkdirSync(join(root, 'test-results', 'zz-offline'), { recursive: true });
      writeText(root, 'tests/wap-e2e/zz-selbsttest/zz-offline-pfade.spec.ts', OFFLINE_PFADE);
      const l = playwrightLauf(sb, root, ['-c', KONFIG, '--project=edge', 'zz-offline-pfade'], {
        name: 'offline-pfade',
        env: offlineEnv(p),
        // Drei erzeugte Tests mit je 120 s; das Vorgabelimit des Kindlaufs (300 s) wäre zu knapp (TR-E101c-13).
        timeout: LANG,
      });
      const erg = pwErgebnisse(l.bericht);
      erwarteGruen(pwTest(erg, 'zz offline kurzname'));
      erwarteGruen(pwTest(erg, 'zz offline test-results'));
      erwarteGruen(pwTest(erg, 'zz offline abgelehnt'));
      erwarteAufgeraeumt([
        p.kurzProfil,
        join(p.temp, 'kurzname-ordner-lang', 'profil-k'),
        join(root, 'test-results', 'zz-offline', 'profil'),
        p.ausserhalb,
      ]);
    },
    LANG,
  );
});

// =========================================================================================================
// R-H-26 Barrierefreiheit (nur Fixtures)

const FOKUS_SPEC = [
  "import { expect } from '@playwright/test';",
  "import { test } from '../support/fixtures';",
  '',
  "const seite = (stil: string, inhalt: string) => '<html lang=\"de\"><head><title>T</title><style>body{background:#fff;margin:40px}button{border:0;background:#fff;font-size:16px}' + stil + '</style></head><body><main>' + inhalt + '</main></body></html>';",
  '',
  "test('zz ohne Rahmen', async ({ page, focusVisible }) => {",
  "  await page.setContent(seite('button:focus,button:focus-visible{outline:none;box-shadow:none}', '<button>Ohne Rahmen</button>'));",
  "  const r = await focusVisible(page.getByRole('button', { name: 'Ohne Rahmen' }));",
  '  expect(r).toEqual({ sichtbar: false, kontrast: 1 });',
  '});',
  '',
  "test('zz Rahmen schwarz', async ({ page, focusVisible }) => {",
  "  await page.setContent(seite('button:focus,button:focus-visible{outline:3px solid #000;outline-offset:2px}', '<button>Mit Rahmen</button>'));",
  "  const r = await focusVisible(page.getByRole('button', { name: 'Mit Rahmen' }));",
  '  expect(r).toEqual({ sichtbar: true, kontrast: 21 });',
  '});',
  '',
  "test('zz Rahmen schwach', async ({ page, focusVisible }) => {",
  "  await page.setContent(seite('button:focus,button:focus-visible{outline:3px solid #eeeeee;outline-offset:2px}', '<button>Schwach</button>'));",
  "  const r = await focusVisible(page.getByRole('button', { name: 'Schwach' }));",
  '  expect(r.sichtbar).toBe(true);',
  '  expect(r.kontrast).toBe(1.16);',
  '});',
  '',
  "test('zz nach Mausklick', async ({ page, focusVisible }) => {",
  "  await page.setContent(seite('button:focus{outline:none}button:focus-visible{outline:3px solid #000;outline-offset:2px}', '<button>Geklickt</button>'));",
  "  const knopf = page.getByRole('button', { name: 'Geklickt' });",
  '  await knopf.click();',
  "  expect(await knopf.evaluate((e) => e.matches(':focus-visible'))).toBe(false);",
  '  const r = await focusVisible(knopf);',
  '  expect(r).toEqual({ sichtbar: true, kontrast: 21 });',
  '});',
  '',
  "test('zz nicht fokussierbar', async ({ page, focusVisible }) => {",
  "  await page.setContent(seite('', '<p>Nur Text</p>'));",
  "  await expect((async () => focusVisible(page.getByText('Nur Text')))()).rejects.toThrow('focusVisible: Element nicht fokussierbar');",
  '});',
  '',
].join('\n');

const A11Y_SPEC = [
  "import AxeBuilder from '@axe-core/playwright';",
  "import { expect } from '@playwright/test';",
  "import { test } from '../support/fixtures';",
  '',
  "test('zz Knopf ohne Namen', async ({ page, a11y }) => {",
  '  await page.setContent(\'<html lang="de"><head><title>T</title></head><body><main><h1>Titel</h1><button></button></main></body></html>\');',
  "  const r = await a11y(page.locator('body'));",
  "  expect(r.verstoesse.map((v) => v.id)).toContain('button-name');",
  "  const v = r.verstoesse.find((x) => x.id === 'button-name');",
  '  expect(v?.ziele.length).toBeGreaterThan(0);',
  '});',
  '',
  "test('zz sauber', async ({ page, a11y }) => {",
  '  await page.setContent(\'<html lang="de"><head><title>T</title></head><body><main><h1>Titel</h1><button>Knopf</button></main></body></html>\');',
  '  expect((await a11y()).verstoesse).toEqual([]);',
  '});',
  '',
  '// Nur best-practice verletzt (TR-E101c-09): ohne Tag-Filter meldet axe region bzw. landmark-one-main (Kontrolle),',
  '// mit den wcag-Tags (Vertrag E1-01 §9 Nr 11) nichts.',
  "test('zz nur best-practice', async ({ page, a11y }) => {",
  '  await page.setContent(\'<html lang="de"><head><title>T</title></head><body><h1>Titel</h1><p>Fiktiver Text</p></body></html>\');',
  '  const alle = (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id);',
  "  expect(alle.some((id) => id === 'region' || id === 'landmark-one-main')).toBe(true);",
  '  expect((await a11y()).verstoesse).toEqual([]);',
  '});',
  '',
  "test('zz scope', async ({ page, a11y }) => {",
  '  await page.setContent(\'<html lang="de"><head><title>T</title></head><body><main><h1>Titel</h1><button></button></main><aside><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></aside></body></html>\');',
  '  const ganz = (await a11y()).verstoesse.map((v) => v.id);',
  "  expect(ganz).toEqual(expect.arrayContaining(['button-name', 'image-alt']));",
  "  const nurMain = (await a11y(page.locator('main'))).verstoesse.map((v) => v.id);",
  "  expect(nurMain).toContain('button-name');",
  "  expect(nurMain).not.toContain('image-alt');",
  '});',
  '',
  "test('zz suiteCsp', async ({ page, a11y }) => {",
  "  const csp = process.env.WAP_ZZ_CSP ?? '';",
  '  expect(csp.length).toBeGreaterThan(0);',
  '  await page.setContent(\'<html lang="de"><head><meta http-equiv="Content-Security-Policy" content="\' + csp + \'"><title>T</title></head><body><main><h1>Titel</h1><button></button></main></body></html>\');',
  "  expect((await a11y()).verstoesse.map((v) => v.id)).toContain('button-name');",
  '});',
  '',
].join('\n');

describe('Barrierefreiheit: Fixtures focusVisible und a11y (R-H-26)', () => {
  it(
    '[R-H-26] focusVisible: ohne Rahmen nicht sichtbar (Kontrast 1); schwarzer Rahmen sichtbar mit Kontrast 21; #eeeeee auf Weiss Kontrast 1,16; nach Mausklick (Rahmen nur bei :focus-visible) sichtbar; nicht fokussierbares Element → wirft',
    () => {
      const sb = sandbox();
      const root = klon(sb);
      writeText(root, 'tests/wap-e2e/zz-selbsttest/zz-fokus.spec.ts', FOKUS_SPEC);
      const l = playwrightLauf(sb, root, ['-c', KONFIG, '--project=edge', 'zz-fokus'], {
        name: 'fokus',
      });
      const erg = pwErgebnisse(l.bericht);
      for (const t of [
        'zz ohne Rahmen',
        'zz Rahmen schwarz',
        'zz Rahmen schwach',
        'zz nach Mausklick',
        'zz nicht fokussierbar',
      ]) {
        erwarteGruen(pwTest(erg, t));
      }
    },
    LANG,
  );

  it(
    '[R-H-26] a11y: Knopf ohne Namen → button-name mit Zielen; saubere Seite und Seite nur mit best-practice-Verstössen → keine Verstösse (nur wcag-Tags); scope grenzt ein; Seite mit suiteCsp liefert button-name',
    async () => {
      const sb = sandbox();
      const root = klon(sb);
      const { suiteCsp } = await einzeldateiModul();
      writeText(root, 'tests/wap-e2e/zz-selbsttest/zz-a11y.spec.ts', A11Y_SPEC);
      const l = playwrightLauf(sb, root, ['-c', KONFIG, '--project=edge', 'zz-a11y'], {
        name: 'a11y',
        env: { WAP_ZZ_CSP: suiteCsp(WT) },
      });
      const erg = pwErgebnisse(l.bericht);
      for (const t of [
        'zz Knopf ohne Namen',
        'zz sauber',
        'zz nur best-practice',
        'zz scope',
        'zz suiteCsp',
      ]) {
        erwarteGruen(pwTest(erg, t));
      }
    },
    LANG,
  );
});
