// Typen der Schleusen-Module gemäss Vertrag E1-01 §2 (nur für die Tests; die Module sind ESM mit
// JSDoc und werden zur Laufzeit über ladeModul() geladen, nie beim Sammeln).
import { ladeModul, type Sandbox } from './umgebung';

export interface Schritt {
  id: string;
  ok: boolean;
  ms: number;
  ursache?: string;
  naechsterSchritt?: string;
  details?: unknown;
}

export interface GateErgebnis {
  modus: 'fast' | 'full';
  zweig: string;
  paket: string | null;
  schritte: Schritt[];
  ok: boolean;
}

export interface TraceMatrix {
  ids: {
    id: string;
    paket: string;
    testart: string;
    tests: string[];
    status: 'belegt' | 'offen' | 'verweis' | 'auftraggeber';
  }[];
  zahlen: Record<string, number>;
}

export interface CoverageSchwellen {
  mengen: { name: string; muster: string[]; zweige: number }[];
  jeModul: true;
  ausnahmen: string[];
}

export interface PythonWahl {
  quelle: 'WAP_PYTHON' | 'py -3' | 'python3' | 'python';
  ausfuehrbar: string;
  verzeichnis: string;
  version: string;
}

export interface PythonKandidat {
  quelle: string;
  version: string | null;
  grund: 'fehlt' | 'exit' | 'version<3' | 'ok';
}

/** Prozess aus der Prozessquelle (Vertrag E1-01, Änderungsnotiz AE-001 §2). */
export interface Proz {
  pid: number;
  ppid: number;
  name: string;
  kommandozeile: string;
  erstellt: string;
}

/** Eingespeiste Last- und Sperr-Umgebung (nur als Funktionsparameter, AE-001 §2). */
export interface Last {
  quelle?: { prozesse(): Promise<Proz[]>; cpuBelegt(ms: number): Promise<number> };
  lebt?: (pid: number, start: string) => boolean;
  commonDir?: string;
  /** Intervall der Wiederholungsprüfung auf fremde Prozesse in `full` (nur Tests, Vertrag AE-001 §4 Nr 7). */
  pruefIntervallMs?: number;
}

/** scripts/wap-gate/vitest-setup.mjs (globalSetup der Selbsttest-Konfiguration, Vertrag AE-001 §4 Nr 5). */
export interface VitestSetupModul {
  pruefeSelbsttestSetup(opts: {
    env: Record<string, string | undefined>;
    maxWorkers: number;
    nodeVersion?: string;
    eigenePid?: number;
    last?: Last;
  }): Promise<{ envWert: string; freigeben(): Promise<void> }>;
  default(project: { config: { maxWorkers?: number } }): Promise<() => Promise<void>>;
}

export type SperreErgebnis =
  | { ok: true; geschachtelt: boolean; envWert: string; freigeben(): Promise<void> }
  | { ok: false; schritt: Schritt };

export interface LastModul {
  lastRegeln(): {
    vitestWorker: number;
    selbsttestWorker: number;
    strykerConcurrency: number;
    playwrightWorker: number;
    cpuGrenze: number;
    fremdPruefungMs: number;
    grenzlastThreads: number;
  };
  testUmgebung(
    env: Record<string, string | undefined>,
    art: 'vitest' | 'selbsttest' | 'stryker' | 'playwright' | 'sonst',
  ): Record<string, string>;
  belegeSperre(opts: {
    modus: string;
    worktree: string;
    env?: Record<string, string | undefined>;
    warteMin?: number;
    last?: Last;
  }): Promise<SperreErgebnis>;
  fremdeProzesse(prozesse: Proz[], eigenePid: number): number[];
  pruefeFremdlast(opts: {
    eigenePid: number;
    messMs?: number;
    last?: Last;
  }): Promise<Schritt & { cpuBelegt: number; fremd: number[] }>;
  freigebenSperre(opts: { commonDir: string; grund: string }): Promise<Schritt>;
}

export interface GateModul {
  runGate(
    modus: 'fast' | 'full',
    opts: {
      cwd: string;
      preCommit?: boolean;
      etappenAbschluss?: number;
      warten?: boolean;
      last?: Last;
    },
  ): Promise<GateErgebnis>;
}
export interface NodeCheckModul {
  checkNode(opts: { packageJson: string; nvmrc: string; version?: string }): Schritt;
}
export interface ForbiddenModul {
  scanForbidden(opts: { cwd: string; dateien?: string[] }): Promise<Schritt>;
}
export interface BoundariesModul {
  checkModuleBoundaries(opts: { cwd: string }): Promise<Schritt>;
}
export interface SuiteBoundaryModul {
  checkSuiteBoundary(opts: { cwd: string; basis: string }): Promise<Schritt>;
}
export interface LockCoverageModul {
  checkLockCoverage(opts: { cwd: string }): Promise<Schritt>;
}
export interface LicenseModul {
  checkLicenses(opts: { cwd: string; basis: string }): Promise<Schritt>;
  checkBundledLicenses(opts: { cwd: string; distDir?: string; modulIds?: string[] }): Promise<
    Schritt & {
      erwartet: { name: string; quelle: 'app' | 'npm' | 'asset'; lizenzdatei: string }[];
      fehlend: string[];
    }
  >;
}
export interface RedPhaseModul {
  classifyRedPhase(opts: {
    berichte: string[];
    paket: string;
    paketIds: string[];
    stubNamen: string[];
  }): Schritt;
}
export interface TraceModul {
  trace(opts: {
    cwd: string;
    modus: 'fast' | 'full';
    etappenAbschluss?: number;
    out?: string;
    berichte?: string[];
  }): Promise<Schritt & { matrix: TraceMatrix }>;
}
export interface CoverageModul {
  checkCoverage(opts: {
    cwd: string;
    istanbulDateien: string[];
    schwellen: CoverageSchwellen;
    legacyListe?: string;
  }): Schritt;
}
export interface TypecheckModul {
  checkTypes(opts: {
    cwd: string;
  }): Promise<Schritt & { verworfen: { datei: string; anzahl: number }[] }>;
}
export interface LegacyModul {
  legacyUnchanged(opts: {
    cwd: string;
    liste?: string;
  }): Promise<{ pfad: string; unveraendert: boolean }[]>;
}
export interface PerfCompareModul {
  comparePerf(opts: {
    messungen: string;
    baseline: string;
    drosselung: string;
    regel: 'prozent10' | 'prozent10oder2ms';
  }): Schritt;
}
export interface GoldenReportModul {
  goldenReport(opts: { vorher: string; nachher: string; out: string }): Promise<Schritt>;
}
export interface PrivacyDeepModul {
  deepPrivacyScan(opts: { cwd: string; staged?: boolean; pfade?: string[] }): Promise<Schritt>;
}
export interface PrivacyNamesModul {
  scanNames(opts: { root: string; baum?: string; commits?: string }): Promise<
    Schritt & {
      geprueft: number;
      nichtText: number;
      treffer: { commit: string | null; pfad: string; anzahl: number }[];
    }
  >;
}
export interface PythonCheckModul {
  pythonProbe(): string;
  checkPython(opts: {
    cwd: string;
    env?: Record<string, string | undefined>;
  }): Promise<Schritt & { wahl: PythonWahl | null; geprueft: PythonKandidat[] }>;
  oracleUmgebung(
    env: Record<string, string | undefined>,
    verzeichnis: string,
  ): Record<string, string>;
}
export interface ReferenceLockModul {
  checkReferenceLock(opts: { cwd: string; referenceDir: string }): Promise<Schritt>;
}
export interface PerfHarnessModul {
  buildPerfHarness(opts: { cwd: string; outDir: string }): Promise<Schritt>;
}
export interface SelftestModul {
  runSelftest(opts: {
    cwd: string;
    nur?: string[];
    last?: Last;
  }): Promise<{ verstoss: string; erwartet: string; erkannt: string | null; ok: boolean }[]>;
}
export interface StabilityModul {
  runStability(opts: {
    cwd: string;
    last?: Last;
    profile?: ('normal' | 'grenzlast')[];
  }): Promise<Schritt>;
}
export interface E2eModul {
  runE2e(opts: { cwd: string; project?: string }): Promise<Schritt & { port: number }>;
}

export const gate = () => ladeModul<GateModul>('scripts/wap-gate/gate.mjs');
export const nodeCheck = () => ladeModul<NodeCheckModul>('scripts/wap-gate/node-check.mjs');
export const forbidden = () => ladeModul<ForbiddenModul>('scripts/wap-gate/forbidden.mjs');
export const boundaries = () =>
  ladeModul<BoundariesModul>('scripts/wap-gate/module-boundaries.mjs');
export const suiteBoundary = () =>
  ladeModul<SuiteBoundaryModul>('scripts/wap-gate/suite-boundary.mjs');
export const lockCoverage = () =>
  ladeModul<LockCoverageModul>('scripts/wap-gate/lock-coverage.mjs');
export const license = () => ladeModul<LicenseModul>('scripts/wap-gate/license-check.mjs');
export const redPhase = () => ladeModul<RedPhaseModul>('scripts/wap-gate/red-phase.mjs');
export const traceModul = () => ladeModul<TraceModul>('scripts/wap-gate/trace.mjs');
export const coverage = () => ladeModul<CoverageModul>('scripts/wap-gate/coverage-check.mjs');
export const typecheck = () => ladeModul<TypecheckModul>('scripts/wap-gate/typecheck.mjs');
export const legacy = () => ladeModul<LegacyModul>('scripts/wap-gate/lib/legacy.mjs');
export const perfCompare = () => ladeModul<PerfCompareModul>('scripts/wap-gate/perf-compare.mjs');
export const goldenReportModul = () =>
  ladeModul<GoldenReportModul>('scripts/wap-gate/golden-report.mjs');
export const privacyDeep = () => ladeModul<PrivacyDeepModul>('scripts/wap-gate/privacy-deep.mjs');
export const privacyNames = () =>
  ladeModul<PrivacyNamesModul>('scripts/wap-gate/privacy-names.mjs');
export const pythonCheck = () => ladeModul<PythonCheckModul>('scripts/wap-gate/python-check.mjs');
export const referenceLock = () =>
  ladeModul<ReferenceLockModul>('scripts/wap-gate/reference-lock.mjs');
export const perfHarness = () => ladeModul<PerfHarnessModul>('scripts/wap-gate/perf-harness.mjs');
export const selftest = () => ladeModul<SelftestModul>('scripts/wap-gate/selftest.mjs');
export const stability = () => ladeModul<StabilityModul>('scripts/wap-gate/stability.mjs');
export const e2e = () => ladeModul<E2eModul>('scripts/wap-gate/e2e.mjs');
export const lastModul = () => ladeModul<LastModul>('scripts/wap-gate/last.mjs');
export const vitestSetup = () => ladeModul<VitestSetupModul>('scripts/wap-gate/vitest-setup.mjs');

/** Form von envWert bzw. WAP_GATE_SPERRE: <absoluter Pfad von sperre.json>#<32 Hex-Zeichen> (AE-001 §4 Nr 3). */
export const ENV_WERT = /^(?<pfad>(?:[A-Za-z]:[\\/]|\\\\).*sperre\.json)#(?<token>[0-9a-f]{32})$/;

/** ISO 8601 in UTC mit Millisekunden (toISOString), AE-001 §4 Nr 3. */
export function istIsoUtc(wert: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(wert) &&
    new Date(wert).toISOString() === wert
  );
}

/** Schritt mit der ADR-Nummer (z.B. «F4», «V10-python») am Anfang der ID. */
export function schrittMit(ergebnis: GateErgebnis, nummer: string): Schritt | undefined {
  const re = new RegExp(`^${nummer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9a-z])`, 'i');
  return ergebnis.schritte.find((s) => re.test(s.id));
}

/** Sandbox-Typ hier wiederverwendet (Bequemlichkeit für Testdateien). */
export type { Sandbox };

/** Form einer Schritt-ID (Vertrag §9 Nr 8): <Nr> oder <Nr>-<name>. */
export const SCHRITT_ID = /^(F10|F[0-9]|V1a|V1[01]|V[1-9])(-[a-z0-9-]+)?$/;
