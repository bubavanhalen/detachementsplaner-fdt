// Nachtrag-Tests E1-01c Runde 2 zu Code-Review Runde 1 (CR-E101c-02, CR-E101c-04; R-H-25, R-H-21) mit den
// Ergänzungen aus der Test-Review Runde 2 (TR-E101c-R2-01, -02, -04, -07).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.4 «Prüfung», §2.2 «Baseline-Befehl» und
// Orchestrator-Zeile «Code-Review Runde 1, CR-E101c-01..05» (07.10.2026):
// - CR-02: offlinePersistent lehnt UNC- und \\?\-Pfade (jede Schreibweise mit zwei führenden «\» bzw. «/»)
//   vor jedem Dateizugriff mit der Vertragsmeldung ab; die Suche nach dem nächsten vorhandenen Elternordner
//   bricht an der Wurzel ab (Laufwerk ohne Datenträger), statt endlos zu laufen. Geprüft im Kindprozess mit
//   umhüllten fs-Funktionen und Start-Attrappe (siehe support/vertrag-c-r2.ts): kein echter Netzzugriff,
//   keine Namensauflösung, kein Browser.
// - CR-04: Baseline-Befehl (e2e.mjs --project chromium-visual --baselines <Paket>): Exit 0 nur ohne
//   Läuferfehler (hier: Port nach dem Lauf belegt, Bericht vorhanden, alle Tests grün); --geaendert schreibt
//   die Protokollzeile nur bei Erfolg, weder bei rotem Kernzustand noch bei rotem Läuferschritt. Bestand
//   (§2.2 «Erfolg»): Scheitert der Kernzustand nur mit «A snapshot doesn't exist at …, writing actual.», endet
//   der Befehl mit Exit 0. Synthetische Repos mit fiktiven Kernzuständen ohne Browser.
// Nur fiktive Pfade, Hosts und Texte; Sperrliste fiktiv (WAP_REFERENCE_DIR über prozessUmgebung).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  KURZ,
  MITTEL,
  neueSandbox,
  prozessUmgebung,
  type Sandbox,
  writeText,
} from './support/umgebung';
import { e2eRepoC } from './support/vertrag-c';
import {
  baselineCli,
  erwarteKindBereit,
  freierLaufwerksbuchstabe,
  gehalteneHalter,
  geschachtelteSperre,
  KIND_FRIST_MS,
  kernzustandOhneBaseline,
  kernzustandProbe,
  laeufe,
  OFFLINE_MELDUNG,
  offlineImKind,
  portHalter,
  protokollZeilen,
  START_ATTRAPPE,
  stoppeHalter,
} from './support/vertrag-c-r2';

afterEach(aufraeumen);

/** Höchstdauer der Pfadprüfung in ms (wenige lokale Dateizugriffe; eine Schleife endet nie). */
const PRUEF_MS = 2_000;

function sandbox(): Sandbox {
  const sb = neueSandbox();
  prozessUmgebung(sb);
  return sb;
}

describe('CR-E101c-02: Pfadprüfung von offlinePersistent (§2.4)', () => {
  const BS = '\\';
  it.each([
    [
      'UNC-Pfad \\\\fiktiv-host\\freigabe\\x',
      (_sb: Sandbox) => `${BS}${BS}fiktiv-host${BS}freigabe${BS}x`,
    ],
    [
      'UNC-Pfad mit Schrägstrichen //fiktiv-host/freigabe/x',
      (_sb: Sandbox) => '//fiktiv-host/freigabe/x',
    ],
    [
      'UNC-Pfad gemischt \\/fiktiv-host/freigabe/x',
      (_sb: Sandbox) => `${BS}/fiktiv-host/freigabe/x`,
    ],
    [
      'UNC-Pfad gemischt /\\fiktiv-host\\freigabe\\x',
      (_sb: Sandbox) => `/${BS}fiktiv-host${BS}freigabe${BS}x`,
    ],
    [
      'Langpfad \\\\?\\<Temp-Sandbox>\\profil',
      (sb: Sandbox) => `${BS}${BS}?${BS}${join(sb.base, 'profil')}`,
    ],
    [
      'Langpfad-UNC \\\\?\\UNC\\fiktiv-host\\freigabe\\x',
      (_sb: Sandbox) => `${BS}${BS}?${BS}UNC${BS}fiktiv-host${BS}freigabe${BS}x`,
    ],
    [
      'Gerätepfad-UNC \\\\.\\UNC\\fiktiv-host\\freigabe\\x',
      (_sb: Sandbox) => `${BS}${BS}.${BS}UNC${BS}fiktiv-host${BS}freigabe${BS}x`,
    ],
  ])(
    '[R-H-25] (CR-E101c-02) %s → Vertragsmeldung ohne Dateizugriff auf den Pfad, ohne Namensauflösung und ohne Start',
    (_fall, pfad) => {
      const sb = sandbox();
      const e = offlineImKind(sb, pfad(sb));
      erwarteKindBereit(e);
      expect(
        e.zugriffe,
        'Dateizugriff mit dem Netz- bzw. Langpfad vor der Ablehnung (SMB-Zugriff bzw. Namensauflösung)',
      ).toEqual([]);
      expect(e.ende, `Pfadprüfung endet nicht innert ${String(KIND_FRIST_MS / 1000)} s`).toBe(true);
      expect(e.meldung).toBe(OFFLINE_MELDUNG);
      expect(e.starts, 'Browser gestartet').toBe(0);
    },
    KURZ,
  );

  it(
    '[R-H-25] (CR-E101c-02) Pfad auf einem Laufwerk ohne Datenträger (freier Buchstabe zur Laufzeit) → Vertragsmeldung innert kurzer Zeit, keine Endlosschleife, ohne Start; Gegenprobe: neuer Ordner unter Temp besteht die Prüfung',
    () => {
      const sb = sandbox();
      // Gegenprobe: Die Prüfung lässt einen gültigen Pfad durch, erst die Start-Attrappe wirft.
      const gut = offlineImKind(sb, join(sb.base, 'profil-neu'));
      erwarteKindBereit(gut);
      expect(gut.ende, 'Gegenprobe: Aufruf nicht beendet').toBe(true);
      expect(gut.starts, 'Gegenprobe: Start-Attrappe nicht erreicht').toBe(1);
      expect(gut.meldung).toBe(`offlinePersistent: Start gescheitert: ${START_ATTRAPPE}`);
      const b = freierLaufwerksbuchstabe();
      expect(b, 'Test-Aufbau: kein freier Laufwerksbuchstabe (D bis Z)').not.toBeNull();
      const e = offlineImKind(sb, `${b as string}:\\wap-fiktiv\\a\\profil`);
      erwarteKindBereit(e);
      expect(
        e.ende,
        `Pfadprüfung endet nicht innert ${String(KIND_FRIST_MS / 1000)} s (Suche nach dem Elternordner hält an der Wurzel nicht an)`,
      ).toBe(true);
      expect(e.meldung).toBe(OFFLINE_MELDUNG);
      expect(e.ms ?? Number.POSITIVE_INFINITY).toBeLessThan(PRUEF_MS);
      expect(e.starts, 'Browser gestartet').toBe(0);
    },
    KURZ,
  );
});

const KERNZUSTAND = '[R-H-21] Kernzustand e1-01-fiktiv (E1-01)';

/**
 * Synthetisches Repo mit genau einem fiktiven Kernzustand des Pakets E1-01 (Projekt chromium-visual).
 * Ohne `koerper`: Kernzustand grün, rot solange `rotSchalter` besteht (kernzustandProbe).
 */
function baselineRepo(
  sb: Sandbox,
  name: string,
  viteKonfig: string | null,
  koerper?: (titel: string, marke: string) => string,
) {
  const { root } = e2eRepoC(sb, {
    name,
    projekte: ['chromium-visual'],
    proben: [],
    perfEinstieg: null,
    ...(viteKonfig === null ? {} : { viteKonfig: true }),
  });
  if (viteKonfig !== null) writeText(root, 'tests/wap-e2e/support/vite-e2e.config.ts', viteKonfig);
  const marke = join(sb.base, `${name}-kernzustand.txt`);
  const rotSchalter = join(sb.base, `${name}-rot`);
  writeText(
    root,
    'tests/wap-e2e/kernzustand-fiktiv.visual.spec.ts',
    koerper === undefined
      ? kernzustandProbe(KERNZUSTAND, marke, rotSchalter)
      : koerper(KERNZUSTAND, marke),
  );
  return { root, marke, rotSchalter, sperre: geschachtelteSperre(root) };
}

describe('CR-E101c-04: Baseline-Befehl (§2.2)', () => {
  it(
    '[R-H-21][R-H-11] (CR-E101c-04) --baselines E1-01: roter Läuferschritt mit Bericht (Port nach dem Lauf belegt, Test grün) → Exit ≠ 0 mit Ursache',
    async () => {
      const sb = sandbox();
      const halter = portHalter(sb);
      const { root, marke, sperre } = baselineRepo(sb, 'cr04-port', halter.konfig);
      try {
        // Gegenprobe des Aufbaus: Ohne --baselines meldet derselbe Aufbau den Läuferschritt rot.
        const ohne = baselineCli(sb, root, ['--project', 'chromium-visual'], sperre);
        expect(laeufe(marke), `Test-Aufbau: Kernzustand nicht gelaufen\n${ohne.out}`).toBe(1);
        expect(
          gehalteneHalter(halter),
          'Test-Aufbau: Hilfsprozess hält den Port nicht',
        ).toHaveLength(1);
        expect(ohne.out, 'Gegenprobe: runE2e meldet den belegten Port nicht').toMatch(
          /Port \d+ nach dem Lauf belegt/,
        );
        expect(ohne.status, 'Gegenprobe: Exit').toBe(1);
        const r = baselineCli(
          sb,
          root,
          ['--project', 'chromium-visual', '--baselines', 'E1-01'],
          sperre,
        );
        expect(laeufe(marke), `Test-Aufbau: Kernzustand nicht gelaufen\n${r.out}`).toBe(2);
        expect(
          gehalteneHalter(halter),
          'Test-Aufbau: Hilfsprozess hält den Port nicht',
        ).toHaveLength(2);
        expect(
          existsSync(join(root, 'test-results', 'wap', 'playwright-visual.json')),
          'Test-Aufbau: Bericht fehlt',
        ).toBe(true);
        expect(r.status, `Exit 0 trotz rotem Läuferschritt (Port belegt)\n${r.out}`).not.toBe(0);
        expect(r.out).toMatch(/Port \d+ nach dem Lauf belegt/);
      } finally {
        await stoppeHalter(sb, halter);
      }
    },
    MITTEL,
  );

  it(
    '[R-H-21][R-H-11] (CR-E101c-04) --baselines E1-01 --geaendert: roter Läuferschritt (Port belegt, Test grün) → Exit ≠ 0 und keine Protokollzeile',
    async () => {
      const sb = sandbox();
      const halter = portHalter(sb);
      const { root, marke, sperre } = baselineRepo(sb, 'cr04-port-geaendert', halter.konfig);
      const grund = 'fiktiver Grund Läuferfehler Runde 2';
      try {
        const r = baselineCli(
          sb,
          root,
          ['--project', 'chromium-visual', '--baselines', 'E1-01', '--geaendert', '--grund', grund],
          sperre,
        );
        expect(laeufe(marke), `Test-Aufbau: Kernzustand nicht gelaufen\n${r.out}`).toBe(1);
        expect(
          gehalteneHalter(halter),
          'Test-Aufbau: Hilfsprozess hält den Port nicht',
        ).toHaveLength(1);
        expect(r.status, `Exit 0 trotz rotem Läuferschritt (Port belegt)\n${r.out}`).not.toBe(0);
        const log = join(root, '.git', 'wap-gate', 'protokoll.log');
        expect(
          protokollZeilen(root, grund),
          `Protokollzeile trotz rotem Läuferschritt\n${existsSync(log) ? readFileSync(log, 'utf8') : ''}`,
        ).toHaveLength(0);
      } finally {
        await stoppeHalter(sb, halter);
      }
    },
    MITTEL,
  );

  it(
    '[R-H-21][R-H-11] (CR-E101c-04) --baselines E1-01 --geaendert: gescheiterter Lauf → Exit ≠ 0 und keine Protokollzeile; Gegenprobe: erfolgreicher Lauf schreibt genau eine',
    () => {
      const sb = sandbox();
      const { root, marke, rotSchalter, sperre } = baselineRepo(sb, 'cr04-geaendert', null);
      const grund = 'fiktive Farbänderung Runde 2';
      const args = [
        '--project',
        'chromium-visual',
        '--baselines',
        'E1-01',
        '--geaendert',
        '--grund',
        grund,
      ];
      const gut = baselineCli(sb, root, args, sperre);
      expect(laeufe(marke), `Test-Aufbau: Kernzustand nicht gelaufen\n${gut.out}`).toBe(1);
      expect(gut.status, `Gegenprobe: erfolgreicher Lauf endet nicht mit Exit 0\n${gut.out}`).toBe(
        0,
      );
      expect(protokollZeilen(root, grund), 'Gegenprobe: Protokollzeile').toHaveLength(1);
      writeFileSync(rotSchalter, '');
      const rot = baselineCli(sb, root, args, sperre);
      expect(laeufe(marke), `Test-Aufbau: Kernzustand nicht erneut gelaufen\n${rot.out}`).toBe(2);
      expect(rot.status, 'Exit 0 trotz rotem Kernzustand').not.toBe(0);
      const log = join(root, '.git', 'wap-gate', 'protokoll.log');
      expect(
        protokollZeilen(root, grund),
        `Protokollzeile trotz gescheitertem Lauf\n${existsSync(log) ? readFileSync(log, 'utf8') : ''}`,
      ).toHaveLength(1);
    },
    MITTEL,
  );

  it(
    "[R-H-11] (CR-E101c-04, Bestand §2.2 «Erfolg») --baselines E1-01: Kernzustand scheitert nur mit «A snapshot doesn't exist at …, writing actual.» → Exit 0",
    () => {
      const sb = sandbox();
      const { root, marke, sperre } = baselineRepo(
        sb,
        'cr04-ohne-baseline',
        null,
        kernzustandOhneBaseline,
      );
      const r = baselineCli(
        sb,
        root,
        ['--project', 'chromium-visual', '--baselines', 'E1-01'],
        sperre,
      );
      expect(laeufe(marke), `Test-Aufbau: Kernzustand nicht gelaufen\n${r.out}`).toBe(1);
      expect(r.status, `Schreiblauf fehlender Baselines nicht erfolgreich\n${r.out}`).toBe(0);
    },
    MITTEL,
  );
});
