// Last und Sperre der Schleusen (Paket E1-01-min, Befund E1-07-03, R-H-18; ADR-010 Änderungsnotiz AE-001).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md, Änderungsnotiz AE-001 §2 und §4.
// Aufruf: node scripts/wap-gate/last.mjs --freigeben --grund <text>   (nur Orchestrator)
import { randomBytes } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism, cpus } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zeigePfad } from '../wap/lib/common.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { bereinigt, starte } from './lib/prozess.mjs';
import { gemeinsamesGitVerzeichnis } from './lib/repo.mjs';

/**
 * Prozess aus der Prozessquelle; `erstellt` als ISO 8601 (UTC, mit Millisekunden).
 * @typedef {{ pid: number; ppid: number; name: string; kommandozeile: string; erstellt: string }} Proz
 */

/**
 * Einspeisung, nur als Funktionsparameter (keine Umgebungsvariable, keine CLI-Option).
 * @typedef {object} Last
 * @property {{ prozesse(): Promise<Proz[]>; cpuBelegt(ms: number): Promise<number> }} [quelle]
 * @property {(pid: number, start: string) => boolean} [lebt]
 * @property {string} [commonDir]
 * @property {number} [pruefIntervallMs] Wiederholungsprüfung in `full`; nur Tests, Standard `fremdPruefungMs`.
 */

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */

/** @typedef {{ pid: number; erstellt: string; modus: string; worktree: string; start: string; token: string }} Sperrinhalt */

const FREIGABE_BEFEHL = 'node scripts/wap-gate/last.mjs --freigeben --grund <text>';

/**
 * Feste Werte der Lastregel; grenzlastThreads = ceil(0,25 · os.availableParallelism()).
 * @returns {{ vitestWorker: 4; selbsttestWorker: 1; strykerConcurrency: 4; playwrightWorker: 2; cpuGrenze: 0.25; fremdPruefungMs: 60000; grenzlastThreads: number }}
 */
export function lastRegeln() {
  return {
    vitestWorker: 4,
    selbsttestWorker: 1,
    strykerConcurrency: 4,
    playwrightWorker: 2,
    cpuGrenze: 0.25,
    fremdPruefungMs: 60_000,
    grenzlastThreads: Math.ceil(0.25 * availableParallelism()),
  };
}

/**
 * Rein: Umgebung eines Kindprozesses (Vertrag §9 Nr 16 und Notiz AE-001 §2, §4 Nr 4).
 * @param {Record<string, string | undefined>} env
 * @param {'vitest' | 'selbsttest' | 'stryker' | 'playwright' | 'sonst'} art
 * @returns {Record<string, string>}
 */
export function testUmgebung(env, art) {
  const aus = bereinigt(env);
  const regeln = lastRegeln();
  if (art === 'vitest') aus.VITEST_MAX_WORKERS = String(regeln.vitestWorker);
  if (art === 'selbsttest') aus.VITEST_MAX_WORKERS = String(regeln.selbsttestWorker);
  return aus;
}

/**
 * Prozessliste des Systems (Windows: Win32_Process über PowerShell, ohne Shell gestartet).
 * @returns {Promise<Proz[]>}
 */
async function systemProzesse() {
  if (process.platform !== 'win32') {
    throw new Error('Prozessliste nur unter Windows verfügbar (ADR-010 §4.5)');
  }
  const ps = join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const skript = [
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8;',
    'Get-CimInstance Win32_Process | ForEach-Object {',
    "  $e = ''; if ($_.CreationDate) { $e = $_.CreationDate.ToUniversalTime().ToString('o') };",
    '  [pscustomobject]@{ p = $_.ProcessId; q = $_.ParentProcessId; n = $_.Name; k = $_.CommandLine; e = $e }',
    '} | ConvertTo-Json -Compress',
  ].join(' ');
  const r = await starte(ps, ['-NoProfile', '-NonInteractive', '-Command', skript], {
    cwd: process.cwd(),
    env: bereinigt(process.env),
    timeoutMs: 60_000,
  });
  if (r.status !== 0 || r.fehler !== null) {
    throw new Error('Prozessliste nicht lesbar (PowerShell Get-CimInstance gescheitert)');
  }
  /** @type {unknown} */
  const daten = JSON.parse(r.stdout.trim() === '' ? '[]' : r.stdout);
  const liste = Array.isArray(daten) ? daten : [daten];
  return liste.map((x) => {
    const o = /** @type {{ p?: unknown; q?: unknown; n?: unknown; k?: unknown; e?: unknown }} */ (
      x ?? {}
    );
    const erstellt = typeof o.e === 'string' && o.e !== '' ? new Date(o.e) : null;
    return {
      pid: Number(o.p),
      ppid: Number(o.q),
      name: typeof o.n === 'string' ? o.n : '',
      kommandozeile: typeof o.k === 'string' ? o.k : '',
      erstellt: erstellt === null || Number.isNaN(erstellt.getTime()) ? '' : erstellt.toISOString(),
    };
  });
}

/**
 * Anteil belegter CPU-Zeit aller Kerne über `ms` Millisekunden (0–1).
 * @param {number} ms
 * @returns {Promise<number>}
 */
async function systemCpu(ms) {
  const summe = () =>
    cpus().reduce(
      (acc, c) => {
        const t = c.times;
        acc.idle += t.idle;
        acc.total += t.user + t.nice + t.sys + t.idle + t.irq;
        return acc;
      },
      { idle: 0, total: 0 },
    );
  const a = summe();
  await new Promise((r) => setTimeout(r, ms));
  const b = summe();
  const total = b.total - a.total;
  return total > 0 ? Math.max(0, Math.min(1, 1 - (b.idle - a.idle) / total)) : 0;
}

/** Echte Prozessquelle (Standard, wenn `last.quelle` fehlt). */
export const systemQuelle = { prozesse: systemProzesse, cpuBelegt: systemCpu };

/**
 * Lebt der Prozess `pid` und ist er spätestens bei `start` entstanden (PID nicht wiederverwendet)?
 * @param {number} pid
 * @param {string} start
 * @param {{ prozesse(): Promise<Proz[]> }} quelle
 * @returns {Promise<boolean>}
 */
async function lebtStandard(pid, start, quelle) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code !== 'EPERM') return false;
  }
  const p = (await quelle.prozesse()).find((x) => x.pid === pid);
  if (p === undefined) return false;
  if (p.erstellt === '') return true;
  return Date.parse(p.erstellt) <= Date.parse(start);
}

/**
 * Lebt-Prüfung mit eingespeister Funktion bzw. Standard.
 * @param {Last} last
 * @returns {(pid: number, start: string) => Promise<boolean>}
 */
function lebtPruefung(last) {
  const quelle = last.quelle ?? systemQuelle;
  return async (pid, start) =>
    last.lebt === undefined ? lebtStandard(pid, start, quelle) : last.lebt(pid, start);
}

/**
 * Ist `halter` ein Vorfahr von `eigen` (oder derselbe Prozess)? Eine Elternbeziehung gilt nur, wenn der
 * Elternprozess nicht nach dem Kind entstanden ist (PID-Wiederverwendung).
 * @param {number} halter
 * @param {number} eigen
 * @param {Proz[]} liste
 * @returns {boolean}
 */
function istVorfahr(halter, eigen, liste) {
  if (halter === eigen) return true;
  const nachPid = new Map(liste.map((p) => [p.pid, p]));
  const gesehen = new Set();
  let aktuell = nachPid.get(eigen);
  while (aktuell !== undefined && !gesehen.has(aktuell.pid)) {
    gesehen.add(aktuell.pid);
    if (aktuell.ppid === halter) {
      const eltern = nachPid.get(halter);
      return eltern === undefined || !spaeter(eltern, aktuell);
    }
    const eltern = nachPid.get(aktuell.ppid);
    if (eltern === undefined || spaeter(eltern, aktuell)) return false;
    aktuell = eltern;
  }
  return false;
}

/**
 * Ist `a` nach `b` entstanden?
 * @param {Proz} a
 * @param {Proz} b
 * @returns {boolean}
 */
function spaeter(a, b) {
  if (a.erstellt === '' || b.erstellt === '') return false;
  return Date.parse(a.erstellt) > Date.parse(b.erstellt);
}

/**
 * Liest eine Sperrdatei; null, wenn sie fehlt oder nicht lesbar ist.
 * @param {string} pfad
 * @returns {Sperrinhalt | null}
 */
function leseSperre(pfad) {
  try {
    const d = /** @type {Partial<Sperrinhalt>} */ (JSON.parse(readFileSync(pfad, 'utf8')));
    if (
      typeof d.pid !== 'number' ||
      typeof d.start !== 'string' ||
      typeof d.token !== 'string' ||
      typeof d.modus !== 'string'
    ) {
      return null;
    }
    return {
      pid: d.pid,
      erstellt: typeof d.erstellt === 'string' ? d.erstellt : '',
      modus: d.modus,
      worktree: typeof d.worktree === 'string' ? d.worktree : '',
      start: d.start,
      token: d.token,
    };
  } catch {
    return null;
  }
}

/**
 * Prüft, ob der Lauf unter der Sperre aus WAP_GATE_SPERRE geschachtelt ist (AE-001 §2): Datei unter dem
 * Pfad enthält das Token, der Halter lebt und ist Vorfahr von `eigen`.
 * @param {string | undefined} wert
 * @param {number} eigen
 * @param {Last} last
 * @returns {Promise<boolean>}
 */
export async function istGeschachtelt(wert, eigen, last) {
  if (wert === undefined || wert === '') return false;
  const m = /^(.+)#([0-9a-f]{32})$/.exec(wert);
  if (m === null || m[1] === undefined || !isAbsolute(m[1])) return false;
  // Nur eine echte Sperrdatei zählt, keine Kopie an anderer Stelle (CR-E101-12).
  if (!/[\\/]wap-gate[\\/]sperre\.json$/i.test(m[1])) return false;
  const inhalt = leseSperre(m[1]);
  if (inhalt === null || inhalt.token !== m[2]) return false;
  if (!(await lebtPruefung(last)(inhalt.pid, inhalt.start))) return false;
  const quelle = last.quelle ?? systemQuelle;
  const liste = await quelle.prozesse();
  // Der Halter muss ein Schleusen- bzw. Läuferprozess sein (gate, selftest, stability, vitest …).
  const halter = liste.find((p) => p.pid === inhalt.pid);
  if (halter === undefined || !istTestprozess(halter)) return false;
  return istVorfahr(inhalt.pid, eigen, liste);
}

/**
 * Text zu einem lebenden Halter.
 * @param {Sperrinhalt} h
 * @returns {string}
 */
function halterText(h) {
  const wt = h.worktree === '' ? '' : `, Worktree ${zeigePfad(h.worktree)}`;
  return `Sperre belegt durch PID ${String(h.pid)} (Modus ${h.modus}, Start ${h.start}${wt})`;
}

const NAECHSTER_BELEGT =
  'Ende des anderen Beleglaufs abwarten oder mit --warten erneut starten; hängt die Sperre, gibt ' +
  `der Orchestrator sie mit «${FREIGABE_BEFEHL}» frei`;

/**
 * Pfad der Sperrdatei.
 * @param {string} worktree
 * @param {Last} last
 * @returns {string | null}
 */
function sperrPfad(worktree, last) {
  const common = last.commonDir ?? gemeinsamesGitVerzeichnis(worktree);
  return common === null ? null : join(common, 'wap-gate', 'sperre.json');
}

/**
 * Erstellzeit des eigenen Prozesses (ISO 8601, UTC).
 * @returns {string}
 */
function eigeneErstellzeit() {
  return new Date(Date.now() - Math.ceil(process.uptime() * 1000)).toISOString();
}

/**
 * @param {string} ursache
 * @param {string} naechsterSchritt
 * @param {number} beginn
 * @returns {{ ok: false; schritt: Schritt }}
 */
function abgelehnt(ursache, naechsterSchritt, beginn) {
  return {
    ok: false,
    schritt: { id: 'F0-sperre', ok: false, ms: Date.now() - beginn, ursache, naechsterSchritt },
  };
}

/**
 * Belegt die Sperre <commonDir>/wap-gate/sperre.json (Schritt «F0-sperre»).
 * @param {{ modus: string; worktree: string; env?: Record<string, string | undefined>; warteMin?: number; last?: Last; eigenePid?: number }} opts
 * @returns {Promise<{ ok: true; geschachtelt: boolean; envWert: string; freigeben(): Promise<void> } | { ok: false; schritt: Schritt }>}
 */
export async function belegeSperre(opts) {
  const beginn = Date.now();
  const last = opts.last ?? {};
  const env = opts.env ?? process.env;
  const wert = env.WAP_GATE_SPERRE;
  if (await istGeschachtelt(wert, opts.eigenePid ?? process.pid, last)) {
    return {
      ok: true,
      geschachtelt: true,
      envWert: /** @type {string} */ (wert),
      freigeben: async () => {},
    };
  }
  const pfad = sperrPfad(opts.worktree, last);
  if (pfad === null) {
    return abgelehnt(
      'gemeinsames Git-Verzeichnis nicht bestimmbar (kein git-Worktree)',
      'Schleuse im Worktree starten',
      beginn,
    );
  }
  const lebt = lebtPruefung(last);
  const frist = opts.warteMin === undefined ? 0 : Date.now() + opts.warteMin * 60_000;
  for (;;) {
    const r = await versuche(pfad, opts, lebt, beginn);
    if (r.ok || opts.warteMin === undefined || Date.now() >= frist) return r;
    await new Promise((weiter) => setTimeout(weiter, 5_000));
  }
}

/**
 * Ein Versuch, die Sperre zu belegen (mit Übernahme einer verwaisten Sperre).
 * @param {string} pfad
 * @param {{ modus: string; worktree: string }} opts
 * @param {(pid: number, start: string) => Promise<boolean>} lebt
 * @param {number} beginn
 * @returns {Promise<{ ok: true; geschachtelt: boolean; envWert: string; freigeben(): Promise<void> } | { ok: false; schritt: Schritt }>}
 */
async function versuche(pfad, opts, lebt, beginn) {
  for (let runde = 0; runde < 3; runde++) {
    mkdirSync(dirname(pfad), { recursive: true });
    const token = randomBytes(16).toString('hex');
    /** @type {Sperrinhalt} */
    const inhalt = {
      pid: process.pid,
      erstellt: eigeneErstellzeit(),
      modus: opts.modus,
      worktree: opts.worktree,
      start: new Date().toISOString(),
      token,
    };
    try {
      writeFileSync(pfad, `${JSON.stringify(inhalt, null, 2)}\n`, { flag: 'wx' });
      return {
        ok: true,
        geschachtelt: false,
        envWert: `${pfad}#${token}`,
        freigeben: async () => {
          const jetzt = leseSperre(pfad);
          if (jetzt !== null && jetzt.token === token) unlinkSync(pfad);
        },
      };
    } catch (e) {
      if (/** @type {NodeJS.ErrnoException} */ (e).code !== 'EEXIST') {
        return abgelehnt(
          'Sperrdatei nicht anlegbar (Schreibrechte im Git-Verzeichnis prüfen)',
          'Zugriff auf das gemeinsame Git-Verzeichnis prüfen und erneut starten',
          beginn,
        );
      }
    }
    const halter = leseSperre(pfad);
    if (halter === null) {
      return abgelehnt(
        'Sperrdatei vorhanden, aber nicht lesbar',
        `Sperre prüfen und von Hand freigeben: «${FREIGABE_BEFEHL}»`,
        beginn,
      );
    }
    if (await lebt(halter.pid, halter.start)) {
      return abgelehnt(halterText(halter), NAECHSTER_BELEGT, beginn);
    }
    try {
      renameSync(pfad, join(dirname(pfad), `sperre.${halter.token}.verwaist`));
    } catch {
      // Ein anderer Lauf hat die verwaiste Sperre zuerst übernommen; neu prüfen.
    }
  }
  return abgelehnt(
    'Sperre konnte nach Übernahme einer verwaisten Sperre nicht belegt werden',
    NAECHSTER_BELEGT,
    beginn,
  );
}

/**
 * Prüft nur, ob die Sperre frei ist (Pre-commit, Vertrag AE-001 §2): rot, wenn ein lebender Lauf sie
 * hält und der eigene Prozess nicht unter ihm geschachtelt ist. Legt keine Datei an.
 * @param {{ worktree: string; env?: Record<string, string | undefined>; last?: Last }} opts
 * @returns {Promise<Schritt>}
 */
export async function pruefeSperreFrei(opts) {
  const beginn = Date.now();
  const last = opts.last ?? {};
  const env = opts.env ?? process.env;
  if (await istGeschachtelt(env.WAP_GATE_SPERRE, process.pid, last)) {
    return { id: 'F0-sperre', ok: true, ms: Date.now() - beginn, details: { geschachtelt: true } };
  }
  const pfad = sperrPfad(opts.worktree, last);
  if (pfad === null) {
    return abgelehnt('gemeinsames Git-Verzeichnis nicht bestimmbar', 'im Worktree starten', beginn)
      .schritt;
  }
  if (!existsSync(pfad)) return { id: 'F0-sperre', ok: true, ms: Date.now() - beginn };
  const halter = leseSperre(pfad);
  if (halter === null) {
    return abgelehnt(
      'Sperrdatei vorhanden, aber nicht lesbar',
      `Sperre prüfen und von Hand freigeben: «${FREIGABE_BEFEHL}»`,
      beginn,
    ).schritt;
  }
  if (await lebtPruefung(last)(halter.pid, halter.start)) {
    return abgelehnt(halterText(halter), NAECHSTER_BELEGT, beginn).schritt;
  }
  return { id: 'F0-sperre', ok: true, ms: Date.now() - beginn, details: { verwaist: true } };
}

/** Kommandozeilen-Merkmale der Test-, Build- und Schleusenwerkzeuge (node). */
const NODE_WERKZEUG =
  /vitest|playwright|stryker|gate|selftest|stability|\bvite(?:\.m?js)?["']?\s+build\b|\btsc\b|biome/i;

/**
 * Ist der Prozess ein Test-, Build- oder Browserprozess (AE-001 §2 «Fremdlast»)?
 * @param {Proz} p
 * @returns {boolean}
 */
function istTestprozess(p) {
  const name = p.name.toLowerCase().replace(/\.exe$/, '');
  const k = p.kommandozeile;
  if (name === 'node') return NODE_WERKZEUG.test(k);
  if (name === 'biome') return true;
  if (name === 'python' || name === 'python3' || name === 'py') return /\bunittest\b/.test(k);
  if (name === 'msedge' || name === 'chrome') return /--remote-debugging/.test(k);
  return false;
}

/**
 * Rein: PIDs fremder Test-, Build- und Browserprozesse ausserhalb der eigenen Familie. Familie = der
 * äusserste node-Vorfahr (oder der eigene Prozess) mit Testwerkzeug-Kommandozeile und alle seine
 * Nachkommen.
 * @param {Proz[]} prozesse
 * @param {number} eigenePid
 * @returns {number[]}
 */
export function fremdeProzesse(prozesse, eigenePid) {
  const nachPid = new Map(prozesse.map((p) => [p.pid, p]));
  let wurzel = eigenePid;
  const gesehen = new Set();
  let aktuell = nachPid.get(eigenePid);
  while (aktuell !== undefined && !gesehen.has(aktuell.pid)) {
    gesehen.add(aktuell.pid);
    const name = aktuell.name.toLowerCase().replace(/\.exe$/, '');
    if (name === 'node' && istTestprozess(aktuell)) wurzel = aktuell.pid;
    const eltern = nachPid.get(aktuell.ppid);
    if (eltern === undefined || spaeter(eltern, aktuell)) break;
    aktuell = eltern;
  }
  /** @type {Map<number, Proz[]>} */
  const kinder = new Map();
  for (const p of prozesse) {
    const liste = kinder.get(p.ppid) ?? [];
    liste.push(p);
    kinder.set(p.ppid, liste);
  }
  const familie = new Set([wurzel]);
  const offen = [wurzel];
  while (offen.length > 0) {
    const pid = /** @type {number} */ (offen.pop());
    for (const k of kinder.get(pid) ?? []) {
      const eltern = nachPid.get(pid);
      if (k.pid === pid || familie.has(k.pid) || (eltern !== undefined && spaeter(eltern, k))) {
        continue;
      }
      familie.add(k.pid);
      offen.push(k.pid);
    }
  }
  return prozesse.filter((p) => !familie.has(p.pid) && istTestprozess(p)).map((p) => p.pid);
}

/**
 * Schritt «F0-last»: fremde Prozesse und CPU-Belegung über messMs (Standard 5000).
 * @param {{ eigenePid: number; messMs?: number; last?: Last }} opts
 * @returns {Promise<Schritt & { cpuBelegt: number; fremd: number[] }>}
 */
export async function pruefeFremdlast(opts) {
  const beginn = Date.now();
  const quelle = opts.last?.quelle ?? systemQuelle;
  const regeln = lastRegeln();
  /** @type {number[]} */
  let fremd;
  /** @type {number} */
  let cpu;
  try {
    fremd = fremdeProzesse(await quelle.prozesse(), opts.eigenePid);
    cpu = await quelle.cpuBelegt(opts.messMs ?? 5_000);
  } catch (e) {
    return {
      id: 'F0-last',
      ok: false,
      ms: Date.now() - beginn,
      ursache: `Last nicht prüfbar: ${e instanceof Error ? e.message : String(e)}`,
      naechsterSchritt: 'Prozessliste (PowerShell, Get-CimInstance) prüfen und erneut starten',
      cpuBelegt: 0,
      fremd: [],
    };
  }
  /** @type {string[]} */
  const gruende = [];
  if (fremd.length > 0) {
    gruende.push(
      `${String(fremd.length)} fremde Test-, Build- oder Browserprozesse (PID ${fremd.join(', ')})`,
    );
  }
  if (cpu > regeln.cpuGrenze) {
    gruende.push(
      `CPU-Last beim Start ${String(Math.round(cpu * 100))} % über der Grenze von ${String(regeln.cpuGrenze * 100)} %`,
    );
  }
  const schritt = {
    id: 'F0-last',
    ok: gruende.length === 0,
    ms: Date.now() - beginn,
    cpuBelegt: cpu,
    fremd,
    details: { fremd, anzahl: fremd.length, cpuBelegt: cpu },
  };
  if (gruende.length === 0) return schritt;
  return {
    ...schritt,
    ursache: gruende.join('; '),
    naechsterSchritt:
      'fremde Läufe abwarten (höchstens zwei Testläufe gleichzeitig, keiner während eines ' +
      'Beleglaufs; agent-regeln 5), dann erneut starten',
  };
}

/**
 * Freigabe einer hängenden Sperre von Hand, nur durch den Orchestrator; Zeile in <commonDir>/wap-gate/protokoll.log.
 * @param {{ commonDir: string; grund: string }} opts
 * @returns {Promise<Schritt>}
 */
export async function freigebenSperre(opts) {
  const beginn = Date.now();
  const grund = opts.grund.trim();
  if (grund === '') {
    return {
      id: 'F0-sperre',
      ok: false,
      ms: Date.now() - beginn,
      ursache: 'Grund fehlt',
      naechsterSchritt: `mit Grund aufrufen: «${FREIGABE_BEFEHL}»`,
    };
  }
  const pfad = join(opts.commonDir, 'wap-gate', 'sperre.json');
  if (!existsSync(pfad)) {
    return { id: 'F0-sperre', ok: true, ms: Date.now() - beginn, details: { vorhanden: false } };
  }
  const halter = leseSperre(pfad);
  unlinkSync(pfad);
  const wer =
    halter === null
      ? 'unlesbare Sperre'
      : `PID ${String(halter.pid)}, Modus ${halter.modus}, Start ${halter.start}`;
  appendFileSync(
    join(opts.commonDir, 'wap-gate', 'protokoll.log'),
    `${new Date().toISOString()} Sperre von Hand freigegeben (${wer}); Grund: ${grund.replace(/\r?\n/g, ' ')}\n`,
  );
  return { id: 'F0-sperre', ok: true, ms: Date.now() - beginn, details: { vorhanden: true } };
}

// CLI: `node scripts/wap-gate/last.mjs --freigeben --grund <text>` (Vertrag AE-001 §4 Nr 10).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const g = args.indexOf('--grund');
  const grund = g >= 0 ? args[g + 1] : undefined;
  if (!args.includes('--freigeben') || grund === undefined || grund.trim() === '') {
    fehlerMeldung(`Aufruf: ${FREIGABE_BEFEHL} (Grund ist Pflicht)`);
    process.exitCode = 1;
  } else {
    const common = gemeinsamesGitVerzeichnis(resolve('.'));
    if (common === null) {
      rot('F0-sperre', 'kein git-Repo im Aufrufverzeichnis', 'im Worktree aufrufen');
      process.exitCode = 1;
    } else {
      const s = await freigebenSperre({ commonDir: common, grund });
      if (s.ok) ok('F0-sperre-freigabe', s.ms);
      else rot('F0-sperre', s.ursache ?? '', s.naechsterSchritt ?? '');
      process.exitCode = s.ok ? 0 : 1;
    }
  }
}
