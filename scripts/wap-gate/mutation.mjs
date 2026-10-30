// V8 Mutationstests (R-H-17, Prompt §7, ADR-010 §6.3; Paket F-TOOLS, Auftraggeber 19.10.2026 «7: ja»).
// Stryker mit Vitest-Läufer (stryker.wap.conf.mjs, Schwelle break 80). In der vollen Schleuse inkrementell über
// die im Paket geänderten Dateien der Mutations-Pfadmenge, mit --etappen-abschluss über die ganze Pfadmenge.
// Wertet den JSON-Bericht (mutation-testing-report-schema) je Bereich aus: Fachlogik, Layout-Schicht,
// Prüfregeln, Beso-Nummerierung, Formtext-Zerlegung (Prompt §7); Score = (getötet + Zeitüberschreitung) /
// (getötet + Zeitüberschreitung + überlebt + ohne Abdeckung). Bericht unter test-results/wap/stryker/.
// Messlauf (CLI) und V8 laufen je Bereich mit eigenem Bericht und eigener Inkrement-Datei unter
// test-results/wap/stryker/messung/ (V8 nutzt die Ergebnisse des Messlaufs wieder). Der Messlauf prüft vor jedem
// Bereich und alle 30 s währenddessen die Sperre der Belegläufe; wird sie von einem exklusiven Beleglauf belegt
// (volle Schleuse, Leistung, Selbsttest, Stabilität, Baselines; nicht Modus «fast»), bricht er ab; ein Neustart
// setzt mit den fehlenden Bereichen fort (--fortsetzen).
// Aufruf: node scripts/wap-gate/mutation.mjs [--root <dir>] [--bereich <name>|alle] [--concurrency <n>] [--nur-bericht]
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pruefeSperreFrei, testUmgebung } from './last.mjs';
import { fehlerMeldung, hinweis, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';
import { arbeitsbaumDateien, gemeinsamesGitVerzeichnis, git, musterRegex } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */

/** Ablage der Berichte (nicht versioniert). */
export const STRYKER_ORDNER = 'test-results/wap/stryker';

/** Ablage der Läufe je Bereich (Messlauf und V8, gemeinsame Inkrement-Dateien). */
export const MESSUNG_ORDNER = `${STRYKER_ORDNER}/messung`;

/** Schwelle (Prompt §7, ADR-010 §6.3); dieselbe wie thresholds.break in stryker.wap.conf.mjs. */
export const SCHWELLE = 80;

/** Mutations-Pfadmenge (ADR-010 §6.3, gleich «mutate» in stryker.wap.conf.mjs). */
export const PFADMENGE = [
  'src/model/wap/**',
  'src/io/wap-import/formtext/**',
  'src/io/wap-import/agenda-text/**',
];

/** Nicht mutiert: reine Typdateien und die generierte Metrik-Tabelle. */
const AUSGENOMMEN = ['**/types.ts', '**/*.d.ts', 'src/model/wap/layout/text/metrics.generated.ts'];

/** Bereiche nach Prompt §7; die erste passende Zeile gilt (Fachlogik = übriger src/model/wap). */
export const BEREICHE = /** @type {const} */ ([
  [
    'formtext',
    'Formtext-Zerlegung',
    ['src/io/wap-import/formtext/**', 'src/io/wap-import/agenda-text/**'],
  ],
  ['pruefregeln', 'Prüfregeln', ['src/model/wap/checks/**']],
  [
    'beso',
    'Beso-Nummerierung',
    ['src/model/wap/commands/numbering.ts', 'src/model/wap/commands/beso.ts'],
  ],
  ['layout', 'Layout-Schicht', ['src/model/wap/layout/**']],
  ['fachlogik', 'Fachlogik', ['src/model/wap/**']],
]);

const PFAD_RE = PFADMENGE.map((m) => musterRegex(m));
const AUS_RE = AUSGENOMMEN.map((m) => musterRegex(m));

/**
 * Gehört die Datei zur Mutations-Pfadmenge (TypeScript, keine Typdatei)?
 * @param {string} rel
 * @returns {boolean}
 */
export function inPfadmenge(rel) {
  return /\.ts$/.test(rel) && PFAD_RE.some((r) => r.test(rel)) && !AUS_RE.some((r) => r.test(rel));
}

/**
 * Bereich einer Datei der Pfadmenge.
 * @param {string} rel
 * @returns {string}
 */
export function bereichVon(rel) {
  for (const [, name, muster] of BEREICHE) {
    if (muster.some((m) => musterRegex(m).test(rel))) return name;
  }
  return 'Fachlogik';
}

/**
 * Dateien der Pfadmenge, die gegenüber basis geändert oder neu sind (inkl. Arbeitsbaum).
 * @param {string} root
 * @param {string} basis
 * @returns {string[] | null}
 */
export function geaenderteDateien(root, basis) {
  const r = git(root, ['diff', '--name-only', '-z', '--no-renames', basis, '--']);
  const neu = git(root, ['ls-files', '-z', '--others', '--exclude-standard']);
  if (r.status !== 0 || neu.status !== 0) return null;
  const alle = [...r.stdout.split('\0'), ...neu.stdout.split('\0')].filter((p) => p !== '');
  return [...new Set(alle)]
    .filter((p) => inPfadmenge(p) && existsSync(join(root, ...p.split('/'))))
    .sort();
}

/**
 * @typedef {{ getoetet: number; zeit: number; ueberlebt: number; ohneAbdeckung: number; sonst: number }} Zahlen
 */

/**
 * Zahlen eines Berichts je Bereich und je Datei (Pfade repo-relativ).
 * @param {string} root
 * @param {string[]} berichte absolute Pfade von mutation.json
 * @returns {{ bereiche: Map<string, Zahlen>; dateien: Map<string, Zahlen> }}
 */
export function zaehleBerichte(root, berichte) {
  /** @type {Map<string, Zahlen>} */
  const bereiche = new Map();
  /** @type {Map<string, Zahlen>} */
  const dateien = new Map();
  const leer = () => ({ getoetet: 0, zeit: 0, ueberlebt: 0, ohneAbdeckung: 0, sonst: 0 });
  const basis = resolve(root).replace(/\\/g, '/').toLowerCase();
  for (const b of berichte) {
    if (!existsSync(b)) continue;
    const d = /** @type {{ files?: Record<string, { mutants?: { status?: string }[] }> }} */ (
      JSON.parse(readFileSync(b, 'utf8'))
    );
    for (const [pfad, f] of Object.entries(d.files ?? {})) {
      let rel = pfad.replace(/\\/g, '/');
      if (rel.toLowerCase().startsWith(`${basis}/`)) rel = rel.slice(basis.length + 1);
      const bereich = bereichVon(rel);
      const zb = bereiche.get(bereich) ?? leer();
      const zd = leer();
      for (const m of f.mutants ?? []) {
        const k =
          m.status === 'Killed'
            ? 'getoetet'
            : m.status === 'Timeout'
              ? 'zeit'
              : m.status === 'Survived'
                ? 'ueberlebt'
                : m.status === 'NoCoverage'
                  ? 'ohneAbdeckung'
                  : 'sonst';
        zb[k] += 1;
        zd[k] += 1;
      }
      bereiche.set(bereich, zb);
      dateien.set(rel, zd);
    }
  }
  return { bereiche, dateien };
}

/**
 * Score in Prozent (eine Nachkommastelle); null ohne gültige Mutanten.
 * @param {Zahlen} z
 * @returns {number | null}
 */
export function score(z) {
  const gueltig = z.getoetet + z.zeit + z.ueberlebt + z.ohneAbdeckung;
  return gueltig === 0 ? null : Math.floor(((z.getoetet + z.zeit) * 1000) / gueltig) / 10;
}

/**
 * Bericht je Bereich mit den Dateien mit den meisten überlebenden Mutanten.
 * @param {string} root
 * @param {string[]} berichte
 * @param {string} ziel absoluter Pfad (bericht.md; bericht.json daneben)
 * @returns {{ unter: string[]; zeilen: { bereich: string; score: number | null; zahlen: Zahlen }[] }}
 */
export function schreibeBereichsBericht(root, berichte, ziel) {
  const { bereiche, dateien } = zaehleBerichte(root, berichte);
  const zeilen = BEREICHE.map(([, name]) => ({
    bereich: name,
    score: score(
      bereiche.get(name) ?? { getoetet: 0, zeit: 0, ueberlebt: 0, ohneAbdeckung: 0, sonst: 0 },
    ),
    zahlen: bereiche.get(name) ?? {
      getoetet: 0,
      zeit: 0,
      ueberlebt: 0,
      ohneAbdeckung: 0,
      sonst: 0,
    },
  }));
  const unter = zeilen
    .filter((z) => z.score !== null && z.score < SCHWELLE)
    .map((z) => `${z.bereich} (${String(z.score)} % < ${String(SCHWELLE)} %)`);
  const luecken = [...dateien.entries()]
    .map(([datei, z]) => ({ datei, offen: z.ueberlebt + z.ohneAbdeckung, z }))
    .filter((x) => x.offen > 0)
    .sort((a, b) => b.offen - a.offen || (a.datei < b.datei ? -1 : 1))
    .slice(0, 30);
  const md = [
    '# Mutationstests (V8, ADR-010 §6.3)',
    '',
    `Schwelle: ${String(SCHWELLE)} % je Bereich (Prompt §7). Berichte: ${berichte.length}`,
    '',
    '| Bereich | Score | getötet | Zeitüberschreitung | überlebt | ohne Abdeckung | übrige (Fehler, ignoriert) |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...zeilen.map(
      (z) =>
        `| ${z.bereich} | ${z.score === null ? 'nicht gemessen' : `${String(z.score)} %`} | ${String(z.zahlen.getoetet)} | ${String(z.zahlen.zeit)} | ${String(z.zahlen.ueberlebt)} | ${String(z.zahlen.ohneAbdeckung)} | ${String(z.zahlen.sonst)} |`,
    ),
    '',
    '## Grösste Lücken (überlebt + ohne Abdeckung je Datei, höchstens 30)',
    '',
    '| Datei | Bereich | überlebt | ohne Abdeckung | Score |',
    '| --- | --- | --- | --- | --- |',
    ...luecken.map(
      (x) =>
        `| ${x.datei} | ${bereichVon(x.datei)} | ${String(x.z.ueberlebt)} | ${String(x.z.ohneAbdeckung)} | ${String(score(x.z) ?? '–')} % |`,
    ),
    '',
  ];
  mkdirSync(join(ziel, '..'), { recursive: true });
  writeFileSync(ziel, md.join('\n'));
  writeFileSync(
    ziel.replace(/\.md$/, '.json'),
    `${JSON.stringify({ zeilen, luecken }, null, 2)}\n`,
  );
  return { unter, zeilen };
}

/**
 * Beendet einen Prozessbaum (Windows: taskkill /T).
 * @param {number | undefined} pid
 */
function beende(pid) {
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // bereits beendet
    }
  }
}

/**
 * Startet Stryker mit stryker.wap.conf.mjs über die angegebenen Dateien; eigene Konfiguration je Teil (Basis plus
 * eigener Bericht, eigene Inkrement-Datei, ohne break: die Schwelle wertet runMutation je Bereich).
 * @param {{ root: string; dateien: string[]; env: Record<string, string>; concurrency?: number; teil?: string; ordner?: string; abbrechen?: () => Promise<boolean> }} o
 * @returns {Promise<{ status: number | null; abgebrochen: boolean; fehler: string | null; bericht: string } | null>}
 */
async function stryker(o) {
  const cli = join(o.root, 'node_modules', '@stryker-mutator', 'core', 'bin', 'stryker.js');
  const teil = o.teil ?? 'schleuse';
  const ordnerRel = o.ordner ?? STRYKER_ORDNER;
  const ordner = join(o.root, ...ordnerRel.split('/'));
  const bericht = join(ordner, `mutation-${teil}.json`);
  if (!existsSync(cli) || !existsSync(join(o.root, 'stryker.wap.conf.mjs'))) return null;
  mkdirSync(ordner, { recursive: true });
  rmSync(bericht, { force: true });
  const konfig = join(ordner, `stryker-${teil}.conf.mjs`);
  const basis = pathToFileURL(join(o.root, 'stryker.wap.conf.mjs')).href;
  writeFileSync(
    konfig,
    [
      `import basis from ${JSON.stringify(basis)};`,
      'export default {',
      '  ...basis,',
      `  incrementalFile: ${JSON.stringify(`${ordnerRel}/incremental-${teil}.json`)},`,
      `  jsonReporter: { fileName: ${JSON.stringify(`${ordnerRel}/mutation-${teil}.json`)} },`,
      `  htmlReporter: { fileName: ${JSON.stringify(`${ordnerRel}/mutation-${teil}.html`)} },`,
      `  tempDirName: ${JSON.stringify(`test-results/stryker-tmp/${teil}`)},`,
      '  thresholds: { ...basis.thresholds, break: null },',
      '};',
      '',
    ].join('\n'),
  );
  const args = [
    cli,
    'run',
    konfig,
    '--mutate',
    o.dateien.join(','),
    ...(o.concurrency === undefined ? [] : ['--concurrency', String(o.concurrency)]),
  ];
  // Ausgabe von Stryker in eine Protokolldatei neben dem Bericht (nur Pfade und Zahlen, keine Daten).
  const log = openSync(join(ordner, `stryker-${teil}.log`), 'w');
  return new Promise((fertig) => {
    let abgebrochen = false;
    /** @type {string | null} */
    let fehler = null;
    const kind = spawn(process.execPath, args, {
      cwd: o.root,
      env: o.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', log, log],
      detached: process.platform !== 'win32',
    });
    const frist = setTimeout(() => {
      fehler = 'Zeitlimit von 24 h überschritten';
      beende(kind.pid);
    }, 24 * 3_600_000);
    const pruefung =
      o.abbrechen === undefined
        ? null
        : setInterval(() => {
            void o.abbrechen?.().then((ja) => {
              if (ja && !abgebrochen) {
                abgebrochen = true;
                beende(kind.pid);
              }
            });
          }, 30_000);
    kind.on('error', (e) => {
      fehler = e.message;
    });
    kind.on('close', (status) => {
      clearTimeout(frist);
      if (pruefung !== null) clearInterval(pruefung);
      closeSync(log);
      fertig({ status, abgebrochen, fehler, bericht });
    });
  });
}

/**
 * V8: Mutationstests der geänderten (bzw. mit alle: aller) Dateien der Pfadmenge; Score je Bereich ≥ 80 %.
 * @param {{ cwd: string; basis: string | null; alle?: boolean; env?: Record<string, string>; concurrency?: number }} opts
 * @returns {Promise<Schritt>}
 */
export async function runMutation(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  /** @param {string} ursache @param {string} naechster @returns {Schritt} */
  const rotSchritt = (ursache, naechster) => ({
    id: 'V8-mutation',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt: naechster,
  });
  /** @type {string[]} */
  let dateien;
  if (opts.alle) {
    const liste = arbeitsbaumDateien(root);
    if (liste === null) return rotSchritt('Dateiliste nicht lesbar', 'git-Zustand prüfen');
    dateien = liste.filter(inPfadmenge).sort();
  } else {
    if (opts.basis === null) {
      return rotSchritt(
        'Vergleichsstand nicht bestimmbar',
        'Zweig wap-planer bereitstellen und erneut starten',
      );
    }
    const g = geaenderteDateien(root, opts.basis);
    if (g === null)
      return rotSchritt('geänderte Dateien nicht bestimmbar (git diff)', 'git-Zustand prüfen');
    dateien = g;
  }
  if (dateien.length === 0) {
    return {
      id: 'V8-mutation',
      ok: true,
      ms: Date.now() - beginn,
      details: { dateien: 0, hinweis: 'keine geänderte Datei der Mutations-Pfadmenge' },
    };
  }
  const env = opts.env ?? testUmgebung(process.env, 'stryker');
  // Je Bereich ein Lauf mit derselben Inkrement-Datei wie der Messlauf der CLI (Ergebnisse wiederverwendet).
  /** @type {string[]} */
  const berichte = [];
  for (const [teil, name] of BEREICHE) {
    const eigene = dateien.filter((d) => bereichVon(d) === name);
    if (eigene.length === 0) continue;
    const r = await stryker({
      root,
      dateien: eigene,
      env,
      teil,
      ordner: MESSUNG_ORDNER,
      ...(opts.concurrency === undefined ? {} : { concurrency: opts.concurrency }),
    });
    if (r === null)
      return rotSchritt('Stryker oder stryker.wap.conf.mjs fehlt', '«npm ci» ausführen');
    if (r.fehler !== null || r.status !== 0 || !existsSync(r.bericht)) {
      return rotSchritt(
        `Stryker-Lauf ${name} gescheitert (Exit ${String(r.status)}${r.fehler === null ? '' : `, ${r.fehler}`})`,
        'Ausgabe von Stryker prüfen (test-results/wap/stryker/)',
      );
    }
    berichte.push(r.bericht);
  }
  const b = schreibeBereichsBericht(
    root,
    berichte,
    join(root, ...STRYKER_ORDNER.split('/'), 'bericht.md'),
  );
  const details = { dateien: dateien.length, bereiche: b.zeilen };
  if (b.unter.length === 0)
    return { id: 'V8-mutation', ok: true, ms: Date.now() - beginn, details };
  return {
    ...rotSchritt(
      `Mutationsscore unter ${String(SCHWELLE)} %: ${kurzeListe(b.unter)}`,
      'überlebende Mutanten durch Tests töten oder begründen (// Stryker disable next-line <Mutator>: <Begründung>), Bericht test-results/wap/stryker/bericht.md',
    ),
    details,
  };
}

// CLI: Messlauf je Bereich (unterbrechbar, fortsetzbar) bzw. nur Bericht aus vorhandenen Teilberichten.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const wert = (/** @type {string} */ n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = resolve(wert('--root') ?? '.');
  const gewaehlt = wert('--bereich') ?? 'alle';
  const concurrency = Number(wert('--concurrency') ?? '2');
  const teile = BEREICHE.filter(([k]) => gewaehlt === 'alle' || k === gewaehlt);
  if (teile.length === 0 || !Number.isInteger(concurrency) || concurrency < 1) {
    fehlerMeldung(
      `Aufruf: node scripts/wap-gate/mutation.mjs [--root <dir>] [--bereich ${BEREICHE.map(([k]) => k).join('|')}|alle] [--concurrency <n>] [--fortsetzen] [--nur-bericht]`,
    );
    process.exitCode = 1;
  } else {
    const liste = (arbeitsbaumDateien(root) ?? []).filter(inPfadmenge);
    const ordner = join(root, ...MESSUNG_ORDNER.split('/'));
    let unvollstaendig = false;
    // Der Messlauf weicht exklusiven Belegläufen (volle Schleuse, Selbsttest, Stabilität, Leistung, Baselines);
    // die schnelle Schleuse paralleler Pakete (Modus «fast», auch vor jedem Commit) unterbricht ihn nicht.
    const sperrDatei = join(
      gemeinsamesGitVerzeichnis(root) ?? join(root, '.git'),
      'wap-gate',
      'sperre.json',
    );
    const belegt = async () => {
      if ((await pruefeSperreFrei({ worktree: root })).ok) return false;
      try {
        const s = /** @type {{ modus?: unknown }} */ (JSON.parse(readFileSync(sperrDatei, 'utf8')));
        return s.modus !== 'fast';
      } catch {
        return true;
      }
    };
    if (!args.includes('--nur-bericht')) {
      for (const [k, name] of teile) {
        const dateien = liste.filter((d) => bereichVon(d) === name);
        if (dateien.length === 0) continue;
        const bericht = join(ordner, `mutation-${k}.json`);
        if (args.includes('--fortsetzen') && existsSync(bericht)) {
          const stand = statSync(bericht).mtimeMs;
          if (dateien.every((d) => statSync(join(root, ...d.split('/'))).mtimeMs < stand)) continue;
        }
        if (await belegt()) {
          hinweis(`Sperre belegt: Messung vor ${name} angehalten (später mit --fortsetzen)`);
          unvollstaendig = true;
          break;
        }
        hinweis(`${name}: ${String(dateien.length)} Dateien, concurrency ${String(concurrency)}`);
        const r = await stryker({
          root,
          dateien,
          env: testUmgebung(process.env, 'stryker'),
          concurrency,
          teil: k,
          ordner: MESSUNG_ORDNER,
          abbrechen: belegt,
        });
        if (r === null || r.abgebrochen || r.status !== 0) {
          hinweis(
            r?.abgebrochen
              ? `Sperre belegt: Lauf ${name} abgebrochen (später mit --fortsetzen)`
              : `Stryker gescheitert für ${name} (Exit ${String(r?.status ?? null)}, Protokoll ${MESSUNG_ORDNER}/stryker-${k}.log)`,
          );
          unvollstaendig = true;
          if (r?.abgebrochen) break;
        }
      }
    }
    const berichte = BEREICHE.map(([k]) => join(ordner, `mutation-${k}.json`)).filter((b) =>
      existsSync(b),
    );
    const b = schreibeBereichsBericht(
      root,
      berichte,
      join(root, ...STRYKER_ORDNER.split('/'), 'bericht.md'),
    );
    for (const z of b.zeilen) {
      hinweis(
        `${z.bereich}: ${z.score === null ? 'nicht gemessen' : `${String(z.score)} %`} (überlebt ${String(z.zahlen.ueberlebt)}, ohne Abdeckung ${String(z.zahlen.ohneAbdeckung)})`,
      );
    }
    const s = b.unter.length === 0 && !unvollstaendig;
    if (s) ok('V8-mutation', 0);
    else
      rot(
        'V8-mutation',
        b.unter.length > 0
          ? `unter ${String(SCHWELLE)} %: ${b.unter.join(', ')}`
          : 'Messlauf unvollständig',
        `Bericht ${STRYKER_ORDNER}/bericht.md`,
      );
    process.exitCode = s ? 0 : 1;
  }
}
