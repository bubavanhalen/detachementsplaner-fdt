// Last und Sperre der Belegläufe (Befund E1-07-03; ADR-010 Änderungsnotiz AE-001 §2; Vertrag E1-01,
// Änderungsnotiz AE-001 §2): feste Workerzahlen, Testumgebung der Kindprozesse, exklusive Sperre unter
// <commonDir>/wap-gate/sperre.json, fremde Test-, Build- und Browserprozesse (F0-last), Freigabe von Hand.
// Alle Prüfungen mit eingespeister Prozessquelle und temporärem commonDir (nie das gemeinsame
// Git-Verzeichnis des Repos); WAP_GATE_SPERRE ist im Testprozess entfernt. Nur fiktive PIDs und Pfade.
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  belegeImKind,
  FREMDER_HALTER,
  fremderVitest,
  leseSperre,
  ohneFehler,
  proz,
  schreibeSperre,
  sperrPfad,
  testLast,
  totePid,
  ueberschreibe,
  wartenderProzess,
} from './support/last';
import {
  aufraeumen,
  KURZ,
  neueSandbox,
  neuesRepo,
  node,
  schrittText,
  WT,
} from './support/umgebung';
import { ENV_WERT, istIsoUtc, lastModul, type Proz, type SperreErgebnis } from './support/vertrag';

afterEach(aufraeumen);

/** Erwartete Belegung (Typ aus dem Vertrag). */
function belegt(r: SperreErgebnis): Extract<SperreErgebnis, { ok: true }> {
  expect(r.ok, r.ok ? '' : schrittText(r.schritt)).toBe(true);
  return r as Extract<SperreErgebnis, { ok: true }>;
}

function abgelehnt(r: SperreErgebnis): Extract<SperreErgebnis, { ok: false }> {
  expect(r.ok, 'Sperre wurde trotz Halter belegt').toBe(false);
  return r as Extract<SperreErgebnis, { ok: false }>;
}

describe('lastRegeln (feste Workerzahlen und Grenzen)', () => {
  it('[R-H-18] Vitest 4, Selbsttest 1, Stryker 4, Playwright 2, CPU-Grenze 25 %, Fremdprüfung alle 60 s, Grenzlast ⌈25 % der Kerne⌉', async () => {
    const { lastRegeln } = await lastModul();
    expect(lastRegeln()).toEqual({
      vitestWorker: 4,
      selbsttestWorker: 1,
      strykerConcurrency: 4,
      playwrightWorker: 2,
      cpuGrenze: 0.25,
      fremdPruefungMs: 60_000,
      grenzlastThreads: Math.ceil(availableParallelism() * 0.25),
    });
  });
});

describe('testUmgebung (Kindprozesse der Schleuse, Vertrag §9 Nr 16 und AE-001 §2)', () => {
  const EIN: Record<string, string | undefined> = {
    PATH: 'C:\\fiktiv\\bin',
    NODE_ENV: 'test',
    VITEST: 'true',
    VITEST_POOL_ID: '3',
    VITEST_MAX_WORKERS: '19',
    __VITEST_INTERN: '1',
    GIT_INDEX_FILE: 'C:\\fiktiv\\index',
    GIT_DIR: 'C:\\fiktiv\\.git',
    WAP_REFERENCE_DIR: 'C:\\fiktiv\\referenz',
    WAP_PYTHON: 'C:\\fiktiv\\python.exe',
    WAP_E2E_PORT: '5199',
    LEER: undefined,
  };

  it.each([
    ['vitest', '4'],
    ['selbsttest', '1'],
  ] as const)(
    '[R-H-18] art %s: VITEST_MAX_WORKERS = %s; NODE_ENV, VITEST*, __VITEST* und GIT_* entfernt; WAP_* bleiben; Eingabe unverändert',
    async (art, worker) => {
      const { testUmgebung } = await lastModul();
      const vorher = JSON.stringify(EIN);
      const aus = testUmgebung(EIN, art);
      expect(JSON.stringify(EIN)).toBe(vorher);
      expect(aus.VITEST_MAX_WORKERS).toBe(worker);
      for (const k of Object.keys(aus)) {
        expect(k, `${k} nicht entfernt`).not.toMatch(/^(NODE_ENV$|GIT_)/);
        if (k !== 'VITEST_MAX_WORKERS') expect(k, `${k} nicht entfernt`).not.toMatch(/^_*VITEST/);
      }
      expect(aus.PATH).toBe('C:\\fiktiv\\bin');
      expect(aus.WAP_REFERENCE_DIR).toBe('C:\\fiktiv\\referenz');
      expect(aus.WAP_PYTHON).toBe('C:\\fiktiv\\python.exe');
      expect(aus.WAP_E2E_PORT).toBe('5199');
      expect(Object.values(aus).every((v) => typeof v === 'string')).toBe(true);
    },
  );

  it('[R-H-18] art stryker: VITEST_MAX_WORKERS entfernt (der Läufer setzt maxWorkers 1), übrige Regeln wie bei vitest', async () => {
    const { testUmgebung } = await lastModul();
    const aus = testUmgebung(EIN, 'stryker');
    expect('VITEST_MAX_WORKERS' in aus).toBe(false);
    expect(Object.keys(aus).filter((k) => /^(NODE_ENV$|GIT_|_*VITEST)/.test(k))).toEqual([]);
    expect(aus.WAP_REFERENCE_DIR).toBe('C:\\fiktiv\\referenz');
  });

  it.each([['playwright'], ['sonst']] as const)(
    '[R-H-18] art %s: nur bereinigt (NODE_ENV, VITEST* inkl. VITEST_MAX_WORKERS, __VITEST*, GIT_* entfernt), kein VITEST_MAX_WORKERS gesetzt (Vertrag AE-001 §4 Nr 4)',
    async (art) => {
      const { testUmgebung } = await lastModul();
      const vorher = JSON.stringify(EIN);
      const aus = testUmgebung(EIN, art);
      expect(JSON.stringify(EIN)).toBe(vorher);
      expect(Object.keys(aus).filter((k) => /^(NODE_ENV$|GIT_|_*VITEST)/.test(k))).toEqual([]);
      expect('VITEST_MAX_WORKERS' in aus).toBe(false);
      expect(aus.PATH).toBe('C:\\fiktiv\\bin');
      expect(aus.WAP_E2E_PORT).toBe('5199');
    },
  );
});

describe('fremdeProzesse (Familie und Testwerkzeuge, AE-001 §2 «Fremdlast»)', () => {
  // Eigene Familie: äusserster node.exe-Vorfahr mit Testwerkzeug-Kommandozeile ist 100 (gate.mjs full).
  const EIGENE: Proz[] = [
    proz(10, 1, 'explorer.exe', 'C:\\Windows\\explorer.exe'),
    proz(100, 10, 'node.exe', 'node C:\\fiktiv\\wt\\scripts\\wap-gate\\gate.mjs full'),
    proz(110, 100, 'node.exe', 'node C:\\fiktiv\\wt\\node_modules\\vitest\\vitest.mjs run'),
    proz(111, 110, 'node.exe', 'node C:\\fiktiv\\wt\\node_modules\\vitest\\dist\\worker.js'),
    proz(120, 100, 'node.exe', 'node C:\\fiktiv\\wt\\node_modules\\typescript\\bin\\tsc --noEmit'),
    proz(130, 100, 'biome.exe', 'C:\\fiktiv\\wt\\node_modules\\@biomejs\\biome.exe check .'),
  ];

  it('[R-H-18] nur eigene Familie (Nachkommen des äussersten Testwerkzeug-Vorfahren) → keine fremden', async () => {
    const { fremdeProzesse } = await lastModul();
    expect(fremdeProzesse(EIGENE, 111)).toEqual([]);
  });

  it.each([
    [
      'node mit vitest',
      proz(201, 2, 'node.exe', 'node C:\\x\\node_modules\\vitest\\vitest.mjs run'),
    ],
    [
      'node mit playwright',
      proz(202, 2, 'node.exe', 'node C:\\x\\node_modules\\@playwright\\test\\cli.js test'),
    ],
    [
      'node mit stryker',
      proz(
        203,
        2,
        'node.exe',
        'node C:\\x\\node_modules\\@stryker-mutator\\core\\bin\\stryker.js run',
      ),
    ],
    ['node mit gate', proz(204, 2, 'node.exe', 'node C:\\x\\scripts\\wap-gate\\gate.mjs fast')],
    ['node mit selftest', proz(205, 2, 'node.exe', 'node C:\\x\\scripts\\wap-gate\\selftest.mjs')],
    [
      'node mit stability',
      proz(206, 2, 'node.exe', 'node C:\\x\\scripts\\wap-gate\\stability.mjs'),
    ],
    [
      'node mit vite build',
      proz(207, 2, 'node.exe', 'node C:\\x\\node_modules\\vite\\bin\\vite.js build'),
    ],
    [
      'node mit tsc',
      proz(208, 2, 'node.exe', 'node C:\\x\\node_modules\\typescript\\bin\\tsc --noEmit'),
    ],
    [
      'node mit biome',
      proz(209, 2, 'node.exe', 'node C:\\x\\node_modules\\@biomejs\\biome\\bin\\biome check .'),
    ],
    ['biome.exe', proz(210, 2, 'biome.exe', 'C:\\x\\biome.exe check .')],
    ['python mit unittest', proz(211, 2, 'python.exe', 'python -m unittest discover -s tests')],
    ['py mit unittest', proz(212, 2, 'py.exe', 'py -3 -m unittest discover')],
    [
      'msedge mit --remote-debugging',
      proz(213, 2, 'msedge.exe', 'msedge.exe --remote-debugging-pipe --headless'),
    ],
    [
      'chrome mit --remote-debugging',
      proz(214, 2, 'chrome.exe', 'chrome.exe --remote-debugging-port=0'),
    ],
  ])('[R-H-18] fremder Prozess (%s) ausserhalb der Familie → genannt', async (_name, p) => {
    const { fremdeProzesse } = await lastModul();
    expect(fremdeProzesse([...EIGENE, p], 111)).toEqual([p.pid]);
  });

  it.each([
    ['node ohne Testwerkzeug', proz(301, 2, 'node.exe', 'node C:\\x\\server.mjs')],
    [
      'Vite-Entwicklungsserver',
      proz(302, 2, 'node.exe', 'node C:\\x\\node_modules\\vite\\bin\\vite.js --host 127.0.0.1'),
    ],
    [
      'msedge ohne Fernsteuerung',
      proz(303, 2, 'msedge.exe', 'msedge.exe --profile-directory=Default'),
    ],
    ['python ohne unittest', proz(304, 2, 'python.exe', 'python C:\\x\\skript.py')],
    ['Editor', proz(305, 2, 'Code.exe', 'Code.exe C:\\x')],
  ])('[R-H-18] kein Test-, Build- oder Browserprozess (%s) → nicht genannt', async (_name, p) => {
    const { fremdeProzesse } = await lastModul();
    expect(fremdeProzesse([...EIGENE, p], 111)).toEqual([]);
  });

  it('[R-H-18] Geschwister in der eigenen Familie (tsc, biome unter demselben gate-Vorfahren) → nicht fremd; ein zweiter gate-Baum daneben → fremd mit allen Testprozessen', async () => {
    const { fremdeProzesse } = await lastModul();
    const zweiter: Proz[] = [
      proz(500, 10, 'node.exe', 'node C:\\fiktiv\\wt2\\scripts\\wap-gate\\gate.mjs fast'),
      proz(510, 500, 'node.exe', 'node C:\\fiktiv\\wt2\\node_modules\\vitest\\vitest.mjs run'),
    ];
    expect(fremdeProzesse([...EIGENE, ...zweiter], 111).sort((a, b) => a - b)).toEqual([500, 510]);
  });
});

describe('pruefeFremdlast (F0-last)', () => {
  it('[R-H-18] keine fremden Prozesse und CPU-Last 0 → grün; Schritt F0-last; Messdauer an cpuBelegt weitergereicht', async () => {
    const sb = neueSandbox();
    const t = testLast(sb, { prozesse: [proz(process.pid, 1, 'node.exe', 'node vitest')] });
    const { pruefeFremdlast } = await lastModul();
    const r = await pruefeFremdlast({ eigenePid: process.pid, messMs: 250, last: t.last });
    expect(r.id).toBe('F0-last');
    expect(r.ok).toBe(true);
    expect(r.fremd).toEqual([]);
    expect(r.cpuBelegt).toBe(0);
    expect(t.aufrufe.cpuMs).toEqual([250]);
  });

  it('[R-H-18] fremder Vitest-Lauf → rot; fremd nennt die PID; Ausgabe nur PIDs und Anzahlen (keine Kommandozeile)', async () => {
    const sb = neueSandbox();
    const fremd = fremderVitest(990_123);
    fremd.kommandozeile = 'node C:\\fiktiv\\Geheimordner-Zwirbel\\vitest.mjs run';
    const t = testLast(sb, { prozesse: [fremd] });
    const { pruefeFremdlast } = await lastModul();
    const r = await pruefeFremdlast({ eigenePid: process.pid, last: t.last });
    expect(r.ok).toBe(false);
    expect(r.fremd).toEqual([990_123]);
    const text = schrittText(r);
    expect(text).toContain('990123');
    expect(text).not.toContain('Geheimordner-Zwirbel');
    expect(text).not.toContain('vitest.mjs');
    expect((r.naechsterSchritt ?? '').length).toBeGreaterThan(0);
  });

  it.each([
    [0.25, true],
    [0.26, false],
    [0.9, false],
  ])('[R-H-18] CPU-Last %s beim Start (Grenze 25 %, «über» ist rot) → ok %s', async (cpu, ok) => {
    const sb = neueSandbox();
    const t = testLast(sb, { cpu });
    const { pruefeFremdlast } = await lastModul();
    const r = await pruefeFremdlast({ eigenePid: process.pid, last: t.last });
    expect(r.ok).toBe(ok);
    expect(r.cpuBelegt).toBe(cpu);
    if (!ok) expect((r.ursache ?? '').length).toBeGreaterThan(0);
  });
});

describe('belegeSperre (exklusive Belegläufe)', () => {
  it(
    '[R-H-18] freie Sperre → belegt mit wx-Datei {pid, erstellt, modus, worktree, start, token}, nicht geschachtelt; freigeben() entfernt sie',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb);
      const { belegeSperre } = await lastModul();
      const r = belegt(await belegeSperre({ modus: 'full', worktree: WT, last: t.last }));
      expect(r.geschachtelt).toBe(false);
      const inhalt = leseSperre(t.commonDir);
      expect(Object.keys(inhalt).sort()).toEqual(
        ['erstellt', 'modus', 'pid', 'start', 'token', 'worktree'].sort(),
      );
      expect(inhalt.pid).toBe(process.pid);
      expect(inhalt.modus).toBe('full');
      expect(inhalt.worktree).toBe(WT);
      // Formate (Vertrag AE-001 §4 Nr 3): Token 32 Hex, Zeiten ISO 8601 UTC, envWert = <Pfad>#<Token>.
      expect(inhalt.token).toMatch(/^[0-9a-f]{32}$/);
      expect(istIsoUtc(inhalt.start), 'start nicht ISO 8601 UTC').toBe(true);
      expect(istIsoUtc(inhalt.erstellt), 'erstellt nicht ISO 8601 UTC').toBe(true);
      expect(Date.parse(inhalt.erstellt)).toBeLessThanOrEqual(Date.parse(inhalt.start));
      const m = ENV_WERT.exec(r.envWert);
      expect(m, 'envWert nicht in der Form <Pfad>#<Token>').not.toBeNull();
      expect(m?.groups?.pfad?.toLowerCase()).toBe(sperrPfad(t.commonDir).toLowerCase());
      expect(m?.groups?.token).toBe(inhalt.token);
      await r.freigeben();
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    KURZ,
  );

  it(
    '[R-H-18] belegte Sperre mit lebendem Halter → sofort rot, Ursache nennt Halter und Start; Datei unverändert',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb, { lebt: () => true });
      schreibeSperre(t.commonDir, FREMDER_HALTER);
      const vorher = readFileSync(sperrPfad(t.commonDir), 'utf8');
      const { belegeSperre } = await lastModul();
      const beginn = Date.now();
      const r = abgelehnt(await belegeSperre({ modus: 'fast', worktree: WT, last: t.last }));
      expect(Date.now() - beginn).toBeLessThan(5_000);
      expect(r.schritt.id).toBe('F0-sperre');
      expect(r.schritt.ok).toBe(false);
      const text = schrittText(r.schritt);
      expect(text).toContain('424242');
      expect(text).toMatch(/2026-10-04|04\.10\.2026/);
      expect((r.schritt.naechsterSchritt ?? '').length).toBeGreaterThan(0);
      expect(readFileSync(sperrPfad(t.commonDir), 'utf8')).toBe(vorher);
    },
    KURZ,
  );

  it(
    '[R-H-18] Halter lebt nicht mehr (PID beendet) → Sperre übernommen: alte Datei als sperre.<token>.verwaist, neue Sperre des eigenen Prozesses',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb);
      schreibeSperre(t.commonDir, { ...FREMDER_HALTER, pid: totePid() });
      const { belegeSperre } = await lastModul();
      const r = belegt(await belegeSperre({ modus: 'fast', worktree: WT, last: t.last }));
      expect(r.geschachtelt).toBe(false);
      expect(
        existsSync(join(t.commonDir, 'wap-gate', `sperre.${FREMDER_HALTER.token}.verwaist`)),
      ).toBe(true);
      expect(leseSperre(t.commonDir).pid).toBe(process.pid);
      await r.freigeben();
    },
    KURZ,
  );

  it(
    '[R-H-18] lebender Prozess mit Erstellzeit nach dem Sperr-Start (PID wiederverwendet) → gilt als nicht lebend, Sperre übernommen',
    async () => {
      const sb = neueSandbox();
      const kind = wartenderProzess();
      try {
        expect(kind.pid).toBeGreaterThan(0);
        const t = testLast(sb);
        schreibeSperre(t.commonDir, {
          ...FREMDER_HALTER,
          pid: kind.pid as number,
          erstellt: '2000-01-01T00:00:00.000Z',
          start: '2000-01-01T00:00:00.000Z',
        });
        const { belegeSperre } = await lastModul();
        // Echte Prozessquelle: die Erstellzeit des Halters kommt aus dem System, nicht aus der Datei.
        const r = belegt(
          await belegeSperre({ modus: 'fast', worktree: WT, last: { commonDir: t.commonDir } }),
        );
        expect(leseSperre(t.commonDir).pid).toBe(process.pid);
        await r.freigeben();
      } finally {
        kind.kill();
      }
    },
    KURZ,
  );

  it(
    '[R-H-18] belegte Sperre, warteMin gesetzt: neuer Versuch alle 5 s, nach Freigabe durch den Halter belegt',
    async () => {
      const sb = neueSandbox();
      // Erste Prüfung: Halter lebt (belegt); jede weitere: Halter tot (TR-E101-02, ohne Zeitgeber).
      let n = 0;
      const t = testLast(sb, { lebt: () => n++ === 0 });
      schreibeSperre(t.commonDir, FREMDER_HALTER);
      const { belegeSperre } = await lastModul();
      const beginn = Date.now();
      const r = belegt(
        await belegeSperre({ modus: 'fast', worktree: WT, warteMin: 1, last: t.last }),
      );
      const dauer = Date.now() - beginn;
      expect(dauer).toBeGreaterThanOrEqual(4_500);
      expect(dauer).toBeLessThan(30_000);
      expect(leseSperre(t.commonDir).pid).toBe(process.pid);
      await r.freigeben();
    },
    KURZ,
  );

  it(
    '[R-H-18] geschachtelt nur mit Token in der Datei aus WAP_GATE_SPERRE, lebendem Halter und Halter als Vorfahr: Kindprozess des Halters → geschachtelt, Datei des Halters bleibt',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb);
      const { belegeSperre } = await lastModul();
      const halter = belegt(await belegeSperre({ modus: 'full', worktree: WT, last: t.last }));
      try {
        const vorher = readFileSync(sperrPfad(t.commonDir), 'utf8');
        const kind = ohneFehler(belegeImKind(sb, t.commonDir, halter.envWert));
        expect(kind.ok).toBe(true);
        expect(kind.geschachtelt).toBe(true);
        expect(readFileSync(sperrPfad(t.commonDir), 'utf8')).toBe(vorher);
      } finally {
        await halter.freigeben();
      }
    },
    KURZ,
  );

  it(
    '[R-H-18] WAP_GATE_SPERRE mit falschem Token in der Datei → nicht geschachtelt, Sperre belegt → rot',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb);
      const { belegeSperre } = await lastModul();
      const halter = belegt(await belegeSperre({ modus: 'full', worktree: WT, last: t.last }));
      const original = readFileSync(sperrPfad(t.commonDir), 'utf8');
      try {
        const inhalt = leseSperre(t.commonDir);
        ueberschreibe(
          sperrPfad(t.commonDir),
          `${JSON.stringify({ ...inhalt, token: `${inhalt.token}-anders` }, null, 2)}\n`,
        );
        const kind = ohneFehler(belegeImKind(sb, t.commonDir, halter.envWert));
        expect(kind.ok).toBe(false);
        expect(kind.ursache ?? '').toContain(String(process.pid));
      } finally {
        // Original zurückschreiben, damit freigeben() die eigene Sperre erkennt (TR-E101-03).
        ueberschreibe(sperrPfad(t.commonDir), original);
        await halter.freigeben();
      }
      expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    },
    KURZ,
  );

  it(
    '[R-H-18] WAP_GATE_SPERRE gültig, aber Halter ist kein Vorfahr (lebender Geschwisterprozess) → nicht geschachtelt, rot',
    async () => {
      const sb = neueSandbox();
      const geschwister = wartenderProzess();
      try {
        expect(geschwister.pid).toBeGreaterThan(0);
        // Der Geschwisterprozess entsteht sicher vor dem Sperr-Start (Erstellzeit ≤ start).
        await new Promise((r) => setTimeout(r, 1_500));
        const t = testLast(sb);
        const { belegeSperre } = await lastModul();
        const halter = belegt(await belegeSperre({ modus: 'full', worktree: WT, last: t.last }));
        const original = readFileSync(sperrPfad(t.commonDir), 'utf8');
        const inhalt = leseSperre(t.commonDir);
        ueberschreibe(
          sperrPfad(t.commonDir),
          `${JSON.stringify({ ...inhalt, pid: geschwister.pid }, null, 2)}\n`,
        );
        try {
          const kind = ohneFehler(belegeImKind(sb, t.commonDir, halter.envWert));
          expect(kind.ok).toBe(false);
          expect(kind.ursache ?? '').toContain(String(geschwister.pid));
        } finally {
          // Original zurückschreiben und eigene Sperre freigeben (TR-E101-03).
          ueberschreibe(sperrPfad(t.commonDir), original);
          await halter.freigeben();
        }
        expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
      } finally {
        geschwister.kill();
      }
    },
    KURZ,
  );

  it(
    '[R-H-18] ohne WAP_GATE_SPERRE im Kindprozess des Halters → nicht geschachtelt, rot',
    async () => {
      const sb = neueSandbox();
      const t = testLast(sb);
      const { belegeSperre } = await lastModul();
      const halter = belegt(await belegeSperre({ modus: 'full', worktree: WT, last: t.last }));
      try {
        const kind = ohneFehler(belegeImKind(sb, t.commonDir, undefined));
        expect(kind.ok).toBe(false);
      } finally {
        await halter.freigeben();
      }
    },
    KURZ,
  );
});

describe('freigebenSperre (von Hand, nur Orchestrator)', () => {
  it('[R-H-18] entfernt die Sperre und schreibt eine Zeile mit dem Grund nach <commonDir>/wap-gate/protokoll.log', async () => {
    const sb = neueSandbox();
    const t = testLast(sb);
    schreibeSperre(t.commonDir, FREMDER_HALTER);
    const { freigebenSperre } = await lastModul();
    const r = await freigebenSperre({ commonDir: t.commonDir, grund: 'Halter abgestürzt (Test)' });
    expect(r.ok).toBe(true);
    expect(existsSync(sperrPfad(t.commonDir))).toBe(false);
    const log = readFileSync(join(t.commonDir, 'wap-gate', 'protokoll.log'), 'utf8');
    const zeilen = log.split(/\r?\n/).filter((z) => z !== '');
    expect(zeilen.length).toBe(1);
    expect(zeilen[0]).toContain('Halter abgestürzt (Test)');
    expect(readdirSync(join(t.commonDir, 'wap-gate'))).not.toContain('sperre.json');
  });
});

describe('CLI last.mjs --freigeben --grund (Vertrag AE-001 §4 Nr 10, temporäres Repo)', () => {
  const CLI = join(WT, 'scripts', 'wap-gate', 'last.mjs');

  it(
    '[R-H-18] im temporären Repo: commonDir = git rev-parse --git-common-dir des Aufrufverzeichnisses → Sperre entfernt, Protokollzeile mit Grund, Exit 0',
    () => {
      const sb = neueSandbox();
      const root = neuesRepo(sb, 'cli-freigabe');
      const common = join(root, '.git');
      schreibeSperre(common, FREMDER_HALTER);
      const r = node(CLI, ['--freigeben', '--grund', 'Halter abgestürzt (CLI-Test)'], {
        cwd: join(root, 'docs'),
        env: sb.env,
      });
      expect(r.status).toBe(0);
      expect(existsSync(sperrPfad(common))).toBe(false);
      const log = readFileSync(join(common, 'wap-gate', 'protokoll.log'), 'utf8');
      expect(log).toContain('Halter abgestürzt (CLI-Test)');
    },
    KURZ,
  );

  it(
    '[R-H-18] ohne --grund → Exit 1, Sperre bleibt; ausserhalb eines Repos → Exit 1',
    () => {
      const sb = neueSandbox();
      const root = neuesRepo(sb, 'cli-ohne-grund');
      const common = join(root, '.git');
      schreibeSperre(common, FREMDER_HALTER);
      const ohneGrund = node(CLI, ['--freigeben'], { cwd: root, env: sb.env });
      expect(ohneGrund.status).toBe(1);
      expect(existsSync(sperrPfad(common))).toBe(true);
      const draussen = join(sb.base, 'kein-repo');
      mkdirSync(draussen, { recursive: true });
      const ausserhalb = node(CLI, ['--freigeben', '--grund', 'Test'], {
        cwd: draussen,
        env: { ...sb.env, GIT_CEILING_DIRECTORIES: sb.base },
      });
      expect(ausserhalb.status).toBe(1);
    },
    KURZ,
  );
});
