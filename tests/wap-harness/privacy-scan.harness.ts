// Datenschutz-Scan scripts/wap/privacy-scan.mjs – R-H-07.
// Vertrag: docs/wap-planer/pakete/H0.md, «Schnittstelle der Harness-Skripte» Punkt 5, P8, P18–P20, P22, P24, P29, P30, P32, P35, P35b, P35c, P36, P36a, P36b, P36c, P24a, P39, P39a, P39b, P39c, P39d, P39e, P39f, P39g, P40, P41, P41a.
// Verbotene Muster werden zur Laufzeit zusammengesetzt, damit dieser Testcode den Scan besteht.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorktree,
  cleanupSandboxes,
  createSandbox,
  GESPERRTE_NAMEN,
  git,
  gitRaw,
  initRepo,
  junction,
  type RunResult,
  runScript,
  type Sandbox,
  SLOW,
  SPERRLISTE,
  withoutSandboxPath,
  writeText,
} from './helpers';

afterEach(cleanupSandboxes);

const j = (...parts: string[]): string => parts.join('');
/** UTF-8-BOM als sichtbare Konstante (kein unsichtbares Zeichen im Quelltext). */
const BOM = String.fromCharCode(0xfeff);

// Fiktive, zur Laufzeit gebildete Treffer.
const AHV = j('75', '6.4821.9036.57');
const MAIL = j('vorname.nachname', '@', 'beispiel.invalid');
const ANTHROPIC = j('noreply', '@', 'anthropic.com');

const TELEFON: Array<[string, string]> = [
  ['national gegliedert mit Leerzeichen', j('07', '9 483 26 15')],
  ['national ungegliedert', j('0', '794832615')],
  ['national mit Punkten', j('07', '9.483.26.15')],
  ['national mit Strichen', j('07', '9-483-26-15')],
  ['+41 gegliedert', j('+4', '1 79 483 26 15')],
  ['+41 ungegliedert', j('+4', '1794832615')],
  ['0041 gegliedert', j('004', '1 79 483 26 15')],
  ['0041 ungegliedert', j('004', '1794832615')],
];

const KEIN_TELEFON: Array<[string, string]> = [
  ['Uhrzeitspanne', 'Dienst 0800-1200'],
  ['mehrere Uhrzeitspannen', 'Mo 0700-1200 1300-1700'],
  ['Uhrzeiten mit Leerzeichen', 'Antreten 0700 Abtreten 1630'],
  ['Datum', 'Beginn 30.09.2026, Ende 01.10.2026'],
  ['Beso-Nummern', 'Beso 52/53 am Fr Wo 3, Beso 101'],
  ['Versionsnummern', 'Node v24.15.0, Paket 2.5.14, Version 1.0.0'],
  ['nur 8 Ziffern nach der 0', j('Nummer 07', '9 123 45 6')],
  ['10 Ziffern nach der 0', j('Nummer 0', '7912345678')],
  ['Ziffernfolge in Hex-Hash', j('Hash ab', '07912', '34567', 'cdef')],
];

const KEINE_AHV: Array<[string, string]> = [
  ['falsches Präfix', j('75', '5.1234.5678.97')],
  ['zu kurz', j('75', '6.1234.5678.9')],
  ['falsche Gruppierung', j('75', '6.123.45678.97')],
];

const KEINE_MAIL: Array<[string, string]> = [
  ['CSS-Regel', '@media print { body { margin: 0; } }'],
  ['Paketname mit Scope', '"@vitejs/plugin-react": "4.3.1"'],
  ['Grad und Pseudonym', 'Hptm Muster A'],
];

function scan(sb: Sandbox, root: string, args: string[], env?: NodeJS.ProcessEnv): RunResult {
  return runScript(sb, root, 'privacy-scan.mjs', args, { cwd: root, env });
}

/**
 * P8: Treffer erscheinen nie im Klartext. Bei Nummern darf keine Zifferngruppe ab 3 Stellen aus
 * dem Treffer ausser den Präfixen 756, +41, 0041, 0 in der Ausgabe stehen.
 */
function expectMasked(sb: Sandbox, r: RunResult, secret: string): void {
  const out = withoutSandboxPath(sb, r.out);
  expect(out.toLowerCase()).not.toContain(secret.toLowerCase());
  const digits = secret.replace(/\D/g, '');
  if (digits.length < 9) return;
  let rest = digits;
  if (secret.startsWith('+41')) rest = digits.slice(2);
  else if (digits.startsWith('0041')) rest = digits.slice(4);
  else if (digits.startsWith('756')) rest = digits.slice(3);
  else if (digits.startsWith('0')) rest = digits.slice(1);
  for (let i = 0; i + 3 <= rest.length; i++) {
    expect(
      out,
      `Zifferngruppe ${rest.slice(i, i + 3)} steht unmaskiert in der Ausgabe`,
    ).not.toContain(rest.slice(i, i + 3));
  }
}

function scanText(sb: Sandbox, content: string, file = 'docs/wap-planer/notiz.md'): RunResult {
  const root = initRepo(sb, 'haupt');
  writeText(root, file, content);
  return scan(sb, root, [file]);
}

describe('privacy-scan: AHV-Nummern', () => {
  it('[R-H-07] blockiert eine AHV-Nummer, meldet Datei und Zeile und maskiert die Nummer', () => {
    const sb = createSandbox();
    const r = scanText(sb, `Zeile eins\nZeile zwei\nAHV ${AHV} Ende\n`);
    expect(r.status).toBe(1);
    expect(r.out).toContain('docs/wap-planer/notiz.md');
    expect(r.out).toMatch(/(:3\b|Zeile\s*3\b)/);
    expectMasked(sb, r, AHV);
  }, 60_000);

  it.each(KEINE_AHV)(
    '[R-H-07] lässt eine AHV-ähnliche Nummer passieren: %s',
    (_label, text) => {
      const sb = createSandbox();
      expect(scanText(sb, `Wert ${text}\n`).status).toBe(0);
    },
    60_000,
  );
});

describe('privacy-scan: Telefonnummern', () => {
  it.each(TELEFON)(
    '[R-H-07] blockiert Telefonnummer (%s) und maskiert sie',
    (_label, nummer) => {
      const sb = createSandbox();
      const r = scanText(sb, `Kontakt: ${nummer}\n`);
      expect(r.status).toBe(1);
      expect(r.out).toContain('docs/wap-planer/notiz.md');
      expectMasked(sb, r, nummer);
    },
    60_000,
  );

  it.each(KEIN_TELEFON)(
    '[R-H-07] hält keine Telefonnummer fest bei %s',
    (_label, text) => {
      const sb = createSandbox();
      expect(scanText(sb, `${text}\n`).status).toBe(0);
    },
    60_000,
  );
});

describe('privacy-scan: E-Mail-Adressen', () => {
  it('[R-H-07] blockiert eine E-Mail-Adresse und maskiert sie', () => {
    const sb = createSandbox();
    const r = scanText(sb, `Schreib an ${MAIL}.\n`);
    expect(r.status).toBe(1);
    expect(r.out).toContain('docs/wap-planer/notiz.md');
    expectMasked(sb, r, MAIL);
  }, 60_000);

  it.each(KEINE_MAIL)(
    '[R-H-07] hält keine E-Mail-Adresse fest bei %s',
    (_label, text) => {
      const sb = createSandbox();
      expect(scanText(sb, `${text}\n`).status).toBe(0);
    },
    60_000,
  );

  it('[R-H-07] erlaubt die Commit-Trailer-Adresse von Anthropic', () => {
    const sb = createSandbox();
    const r = scanText(sb, `Co-Authored-By: Claude <${ANTHROPIC}>\n`);
    expect(r.status).toBe(0);
  }, 60_000);

  it('[R-H-07] erlaubt Adressen aus scripts/wap/privacy-allow.txt, andere nicht', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    const erlaubt = j('kontakt', '@', 'beispiel.invalid');
    writeText(root, 'scripts/wap/privacy-allow.txt', `${erlaubt}\n`);
    writeText(root, 'docs/wap-planer/ok.md', `Offizielle Adresse ${erlaubt}\n`);
    writeText(root, 'docs/wap-planer/nicht-ok.md', `Private Adresse ${MAIL}\n`);
    expect(scan(sb, root, ['docs/wap-planer/ok.md']).status).toBe(0);
    const r = scan(sb, root, ['docs/wap-planer/nicht-ok.md']);
    expect(r.status).toBe(1);
    expectMasked(sb, r, MAIL);
  }, 60_000);
});

describe('privacy-scan: Sperrliste', () => {
  it('[R-H-07] blockiert Namen aus der Sperrliste (WAP_REFERENCE_DIR), Gross/Klein egal, maskiert', () => {
    const sb = createSandbox();
    const r = scanText(sb, 'Zugführer Hptm ZWIRBELMANN A\n');
    expect(r.status).toBe(1);
    expect(r.out).toContain('docs/wap-planer/notiz.md');
    expectMasked(sb, r, GESPERRTE_NAMEN[0]);
  }, 60_000);

  it('[R-H-07] blockiert Namen mit Umlaut am Wortanfang als ganzes Wort', () => {
    const sb = createSandbox();
    const r = scanText(sb, 'Lt Üngerbühl B\n');
    expect(r.status).toBe(1);
    expectMasked(sb, r, GESPERRTE_NAMEN[2]);
    const gross = scanText(createSandbox(), 'Lt ÜNGERBÜHL B\n');
    expect(gross.status).toBe(1);
  }, 60_000);

  it.each([
    ['Name als Wortteil', 'Zwirbelmannstrasse und Quendolinweg'],
    ['Name mit Endung', 'die Üngerbühler Gruppe'],
    ['auskommentierter Eintrag', 'Kommentarname steht hier'],
    ['Doppelname mit Endung', 'die Zappel-Wimmerli Gruppe'],
    ['nur ein Teil des Doppelnamens', 'Zappel und Wimmer'],
  ])(
    '[R-H-07] blockiert keinen Namen bei %s',
    (_label, text) => {
      const sb = createSandbox();
      writeText(
        sb.referenceDir,
        SPERRLISTE,
        ['# Kommentarname', '', ...GESPERRTE_NAMEN, '', '   ', ''].join('\n'),
      );
      expect(scanText(sb, `${text}\n`).status).toBe(0);
    },
    60_000,
  );

  it.each([
    ['ersten', 'Hptm Zwirbelmann A', 'Zwirbelmann'],
    ['letzten', 'Hptm Zappel-Wimmer A', 'Zappel-Wimmer'],
  ])(
    '[R-H-07] liest eine Sperrliste mit UTF-8-BOM und CRLF und findet den %s Namen',
    (_label, text, name) => {
      const sb = createSandbox();
      writeText(sb.referenceDir, SPERRLISTE, `${BOM}${[...GESPERRTE_NAMEN, ''].join('\r\n')}`);
      const r = scanText(sb, `${text}\n`);
      expect(r.status).toBe(1);
      expectMasked(sb, r, name);
    },
    60_000,
  );

  it('[R-H-07] liest eine Sperrliste mit BOM, CRLF, Kommentar und eingerückten Zeilen', () => {
    const sb = createSandbox();
    writeText(
      sb.referenceDir,
      SPERRLISTE,
      `${BOM}# Kommentar\r\n\r\n  Zwirbelmann  \r\n\tQuendolin\r\n`,
    );
    const root = initRepo(sb, 'haupt');
    writeText(root, 'docs/wap-planer/eingerueckt.md', 'Oblt Quendolin C\n');
    writeText(root, 'docs/wap-planer/kommentar.md', 'Nur ein Kommentar\n');
    expect(scan(sb, root, ['docs/wap-planer/eingerueckt.md']).status).toBe(1);
    expect(scan(sb, root, ['docs/wap-planer/kommentar.md']).status).toBe(0);
  }, 60_000);

  it('[R-H-07] findet Namen in einer gescannten Datei mit CRLF am Zeilenende', () => {
    const sb = createSandbox();
    const r = scanText(sb, 'Erste Zeile\r\nKdt Hptm Zappel-Wimmer\r\nLetzte Zeile\r\n');
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/(:2\b|Zeile\s*2\b)/);
    expectMasked(sb, r, 'Zappel-Wimmer');
    const sb2 = createSandbox();
    const r2 = scanText(sb2, `Kontakt\r\nAHV ${AHV}\r\n`);
    expect(r2.status).toBe(1);
    expectMasked(sb2, r2, AHV);
  }, 60_000);

  it('[R-H-07] gesetztes WAP_REFERENCE_DIR ohne Sperrliste scheitert, auch wenn der Haupt-Checkout eine hat (kein Rückfall)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, `reference/${SPERRLISTE}`, 'Quendolin\n');
    writeText(root, 'docs/wap-planer/notiz.md', 'Harmloser Text\n');
    const leer = join(sb.base, 'leer-ref');
    mkdirSync(leer);
    const r = scan(sb, root, ['docs/wap-planer/notiz.md'], { ...sb.env, WAP_REFERENCE_DIR: leer });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/Sperrliste/i);
  }, 60_000);

  it('[R-H-07] schlägt mit Exit 1 und Meldung fehl, wenn die Sperrliste fehlt (WAP_REFERENCE_DIR gesetzt)', () => {
    const sb = createSandbox();
    rmSync(join(sb.referenceDir, SPERRLISTE));
    const r = scanText(sb, 'Harmloser Text\n');
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/Sperrliste/i);
  }, 60_000);

  it('[R-H-07] schlägt fehl, wenn WAP_REFERENCE_DIR fehlt und der Haupt-Checkout keine Sperrliste hat', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'docs/wap-planer/notiz.md', 'Harmloser Text\n');
    const env = { ...sb.env };
    delete env.WAP_REFERENCE_DIR;
    const r = scan(sb, root, ['docs/wap-planer/notiz.md'], env);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/Sperrliste/i);
  }, 60_000);

  it(
    '[R-H-07] nutzt ohne WAP_REFERENCE_DIR die Sperrliste unter reference/ des Haupt-Checkouts, auch aus einem Worktree',
    () => {
      const sb = createSandbox();
      const main = initRepo(sb, 'haupt');
      writeText(main, `reference/${SPERRLISTE}`, 'Quendolin\n');
      const wt = addWorktree(sb, main, join(sb.base, 'wt', 'paket'), 'wap/paket');
      writeText(wt, 'docs/wap-planer/treffer.md', 'Oblt quendolin C\n');
      writeText(wt, 'docs/wap-planer/sauber.md', 'Oblt Muster C\n');
      const env = { ...sb.env };
      delete env.WAP_REFERENCE_DIR;
      const rMain = runScript(sb, main, 'privacy-scan.mjs', ['docs/wap-planer/sauber.md'], {
        cwd: wt,
        env,
      });
      expect(rMain.status).toBe(0);
      const hit = runScript(sb, main, 'privacy-scan.mjs', ['docs/wap-planer/treffer.md'], {
        cwd: wt,
        env,
      });
      expect(hit.status).toBe(1);
      expectMasked(sb, hit, 'Quendolin');
    },
    SLOW,
  );
});

describe('privacy-scan: reference/, Verzeichnisse und Binärdateien', () => {
  it('[R-H-07] blockiert einen genannten Pfad unter reference/, auch mit harmlosem Inhalt', () => {
    const sb = createSandbox();
    const r = scanText(sb, 'Harmloser Text\n', 'reference/notiz.txt');
    expect(r.status).toBe(1);
    expect(r.out).toContain('Datei aus reference/ (Name maskiert)');
    expect(r.out).not.toContain('notiz');
  }, 60_000);

  it('[R-H-07] durchsucht genannte Verzeichnisse rekursiv', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'docs/wap-planer/a/b/c/tief.md', `Tief ${AHV}\n`);
    writeText(root, 'docs/wap-planer/sauber.md', 'Sauber\n');
    const r = scan(sb, root, ['docs']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('docs/wap-planer/a/b/c/tief.md');
    expectMasked(sb, r, AHV);
  }, 60_000);

  it('[R-H-07] überspringt beim rekursiven Durchsuchen node_modules, .git, dist, coverage, spikes, .qa und reference', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    for (const dir of ['node_modules', 'dist', 'coverage', 'spikes', '.qa', 'reference']) {
      writeText(root, `${dir}/inhalt.txt`, `Treffer ${AHV} ${MAIL}\n`);
      // Muster im Dateinamen: P19 gilt für alle Pfade, der Ausschluss wird so beobachtbar (TR-H0-52).
      writeText(root, `${dir}/${AHV}.txt`, 'Harmlos\n');
    }
    writeText(root, 'docs/wap-planer/sauber.md', 'Sauber\n');
    const r = scan(sb, root, ['.']);
    expect(r.status).toBe(0);
    // Gegenprobe: derselbe Dateiname ausserhalb der ausgeschlossenen Ordner ist ein Befund.
    writeText(root, `docs/${AHV}.txt`, 'Harmlos\n');
    const treffer = scan(sb, root, ['.']);
    expect(treffer.status).toBe(1);
    expectMasked(sb, treffer, AHV);
    rmSync(join(root, 'docs', `${AHV}.txt`));
    writeText(root, 'docs/wap-planer/unsauber.md', `Treffer ${AHV}\n`);
    expect(scan(sb, root, ['.']).status).toBe(1);
  }, 60_000);

  it('[R-H-07] lässt .git beim rekursiven Durchsuchen aus', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    // .git/config enthält bereits die (fiktive) E-Mail-Adresse der Test-Identität.
    writeText(root, '.git/info/notiz.txt', `Treffer ${AHV}\n`);
    // Muster im Dateinamen unter .git (P19 gilt für alle Pfade, TR-H0-52).
    writeText(root, `.git/info/${AHV}.txt`, 'Harmlos\n');
    writeText(root, 'docs/wap-planer/sauber.md', 'Sauber\n');
    expect(scan(sb, root, ['.']).status).toBe(0);
    writeText(root, `docs/${AHV}.txt`, 'Harmlos\n');
    expect(scan(sb, root, ['.']).status).toBe(1);
  }, 60_000);

  it('[R-H-07] ein genannter, nicht existierender Pfad führt zu Exit 1', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'docs/wap-planer/sauber.md', 'Sauber\n');
    expect(scan(sb, root, ['docs/wap-planer/sauber.md']).status).toBe(0);
    expect(scan(sb, root, ['docs/wap-planer/gibt-es-nicht.md']).status).toBe(1);
    expect(scan(sb, root, ['docs/wap-planer/sauber.md', 'fehlt/ordner']).status).toBe(1);
  }, 60_000);

  it('[R-H-07] prüft bei Binärdateien nur den Pfad', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    const binary = Buffer.concat([Buffer.from([0, 1, 2, 0, 255]), Buffer.from(` ${AHV} ${MAIL}`)]);
    writeText(root, 'assets/bild.bin', binary);
    expect(scan(sb, root, ['assets/bild.bin']).status).toBe(0);
    writeText(root, 'reference/bild.bin', binary);
    expect(scan(sb, root, ['reference/bild.bin']).status).toBe(1);
  }, 60_000);

  it('[R-H-07] besteht bei sauberen Dateien mit Exit 0', () => {
    const sb = createSandbox();
    const r = scanText(sb, 'Hptm Muster A führt die Kp 1300-1600.\n');
    expect(r.status).toBe(0);
  }, 60_000);
});

describe('privacy-scan --staged', () => {
  function stagedRepo(sb: Sandbox): string {
    return initRepo(sb, 'haupt');
  }

  it('[R-H-07] prüft den gestagten Stand, nicht den Arbeitsbaum (gestagt sauber, Arbeitsbaum unsauber)', () => {
    const sb = createSandbox();
    const root = stagedRepo(sb);
    writeText(root, 'docs/wap-planer/notiz.md', 'Sauber\n');
    git(sb, root, 'add', 'docs/wap-planer/notiz.md');
    writeText(root, 'docs/wap-planer/notiz.md', `Unsauber ${AHV}\n`);
    expect(scan(sb, root, ['--staged']).status).toBe(0);
  }, 60_000);

  it('[R-H-07] prüft den gestagten Stand, nicht den Arbeitsbaum (gestagt unsauber, Arbeitsbaum sauber)', () => {
    const sb = createSandbox();
    const root = stagedRepo(sb);
    writeText(root, 'docs/wap-planer/notiz.md', `Unsauber ${AHV}\n`);
    git(sb, root, 'add', 'docs/wap-planer/notiz.md');
    writeText(root, 'docs/wap-planer/notiz.md', 'Sauber\n');
    const r = scan(sb, root, ['--staged']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('docs/wap-planer/notiz.md');
    expectMasked(sb, r, AHV);
  }, 60_000);

  it('[R-H-07] ignoriert nicht gestagte Dateien', () => {
    const sb = createSandbox();
    const root = stagedRepo(sb);
    writeText(root, 'docs/wap-planer/sauber.md', 'Sauber\n');
    git(sb, root, 'add', 'docs/wap-planer/sauber.md');
    writeText(root, 'docs/wap-planer/ungestagt.md', `Unsauber ${MAIL}\n`);
    expect(scan(sb, root, ['--staged']).status).toBe(0);
  }, 60_000);

  it('[R-H-07] ignoriert gestagte Löschungen', () => {
    const sb = createSandbox();
    const root = stagedRepo(sb);
    writeText(root, 'docs/wap-planer/alt.md', `Alt ${AHV}\n`);
    git(sb, root, 'add', 'docs/wap-planer/alt.md');
    git(sb, root, 'commit', '-q', '-m', 'Altbestand');
    git(sb, root, 'rm', '-q', 'docs/wap-planer/alt.md');
    expect(scan(sb, root, ['--staged']).status).toBe(0);
  }, 60_000);

  it('[R-H-07] blockiert gestagte Pfade unter reference/', () => {
    const sb = createSandbox();
    const root = stagedRepo(sb);
    writeText(root, 'reference/liste.txt', 'Harmloser Text\n');
    git(sb, root, 'add', '-f', 'reference/liste.txt');
    const r = scan(sb, root, ['--staged']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Datei aus reference/ (Name maskiert)');
    expect(r.out).not.toContain('liste');
  }, 60_000);

  it('[R-H-07] findet Treffer in gestagten Dateien mit Umlaut im Namen', () => {
    const sb = createSandbox();
    const root = stagedRepo(sb);
    writeText(root, 'docs/wap-planer/Übung Wo 1.md', `Kontakt ${j('07', '9 483 26 15')}\n`);
    git(sb, root, 'add', 'docs/wap-planer/Übung Wo 1.md');
    expect(scan(sb, root, ['--staged']).status).toBe(1);
  }, 60_000);

  it('[R-H-07] findet gestagte Sperrlisten-Namen und besteht bei sauberem Stand', () => {
    const sb = createSandbox();
    const root = stagedRepo(sb);
    writeText(root, 'docs/wap-planer/sauber.md', 'Hptm Muster A\n');
    git(sb, root, 'add', 'docs/wap-planer/sauber.md');
    expect(scan(sb, root, ['--staged']).status).toBe(0);
    writeText(root, 'docs/wap-planer/name.md', 'Wm Quendolin D\n');
    git(sb, root, 'add', 'docs/wap-planer/name.md');
    const r = scan(sb, root, ['--staged']);
    expect(r.status).toBe(1);
    expectMasked(sb, r, 'Quendolin');
  }, 60_000);

  it('[R-H-07] blockiert eine gestagte Umbenennung nach reference/ (git mv)', () => {
    const sb = createSandbox();
    const root = stagedRepo(sb);
    writeText(root, 'docs/wap-planer/liste.txt', 'Harmloser Text\n');
    git(sb, root, 'add', 'docs/wap-planer/liste.txt');
    git(sb, root, 'commit', '-q', '-m', 'Liste');
    mkdirSync(join(root, 'reference'));
    git(sb, root, 'mv', 'docs/wap-planer/liste.txt', 'reference/liste.txt');
    const status = git(sb, root, 'status', '--porcelain');
    expect(status).toMatch(/^R /m);
    const r = scan(sb, root, ['--staged']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Datei aus reference/ (Name maskiert)');
    expect(r.out).not.toContain('reference/liste.txt');
  }, 60_000);

  it('[R-H-07] scheitert auch mit --staged, wenn die Sperrliste fehlt', () => {
    const sb = createSandbox();
    const root = stagedRepo(sb);
    mkdirSync(join(sb.base, 'leer-ref'));
    writeText(root, 'docs/wap-planer/sauber.md', 'Sauber\n');
    git(sb, root, 'add', 'docs/wap-planer/sauber.md');
    const r = scan(sb, root, ['--staged'], {
      ...sb.env,
      WAP_REFERENCE_DIR: join(sb.base, 'leer-ref'),
    });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/Sperrliste/i);
  }, 60_000);
});

describe('privacy-scan: UTF-16 (P18, CR-H0S-06)', () => {
  function utf16(text: string, endian: 'le' | 'be'): Buffer {
    const le = Buffer.from(text, 'utf16le');
    if (endian === 'le') return Buffer.concat([Buffer.from([0xff, 0xfe]), le]);
    const be = Buffer.from(le);
    be.swap16();
    return Buffer.concat([Buffer.from([0xfe, 0xff]), be]);
  }

  it.each(['le', 'be'] as const)(
    '[R-H-07] findet eine AHV-Nummer in UTF-16-%s-Text mit BOM und maskiert sie',
    (endian) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, 'docs/wap-planer/export.csv', utf16(`Name;AHV\r\nMuster;${AHV}\r\n`, endian));
      const r = scan(sb, root, ['docs/wap-planer/export.csv']);
      expect(r.status).toBe(1);
      expect(r.out).toContain('docs/wap-planer/export.csv');
      expectMasked(sb, r, AHV);
    },
    60_000,
  );

  it.each(['le', 'be'] as const)(
    '[R-H-07] findet einen Sperrlisten-Namen in UTF-16-%s-Text',
    (endian) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, 'docs/wap-planer/export.txt', utf16('Kdt Hptm Zwirbelmann A\r\n', endian));
      const r = scan(sb, root, ['docs/wap-planer/export.txt']);
      expect(r.status).toBe(1);
      expectMasked(sb, r, 'Zwirbelmann');
    },
    60_000,
  );

  it.each(['le', 'be'] as const)(
    '[R-H-07] lässt sauberen UTF-16-%s-Text passieren',
    (endian) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(
        root,
        'docs/wap-planer/export.txt',
        utf16('Hptm Muster A;Kp;0700-1200\r\n', endian),
      );
      expect(scan(sb, root, ['docs/wap-planer/export.txt']).status).toBe(0);
    },
    60_000,
  );
});

describe('privacy-scan: Muster im Pfad und maskierte Pfade (P19, CR-H0S-07, -09, -15)', () => {
  it.each([
    ['AHV-Nummer', `docs/${AHV}.txt`, AHV],
    ['Telefonnummer', `docs/Kontakt ${j('07', '9 483 26 15')}.txt`, j('07', '9 483 26 15')],
    ['E-Mail-Adresse', `docs/${MAIL}.txt`, MAIL],
  ])(
    '[R-H-07] blockiert eine %s im Dateinamen einer sauberen Datei, maskiert',
    (_label, rel, secret) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, rel, 'Harmloser Inhalt\n');
      const r = scan(sb, root, ['docs']);
      expect(r.status).toBe(1);
      // Befundart «Pfad» (P19).
      expect(r.out).toContain('Pfad');
      expectMasked(sb, r, secret);
    },
    60_000,
  );

  it('[R-H-07] blockiert eine AHV-Nummer im Dateinamen einer gestagten, sauberen Datei, maskiert (--staged)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, `docs/${AHV}.txt`, 'Harmloser Inhalt\n');
    git(sb, root, 'add', `docs/${AHV}.txt`);
    const r = scan(sb, root, ['--staged']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Pfad');
    expectMasked(sb, r, AHV);
  }, 60_000);

  it('[R-H-07] maskiert einen Sperrlisten-Namen im Pfad, auch bei Treffern im Inhalt', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'docs/wap-planer/Zwirbelmann-notiz.txt', `AHV ${AHV}\n`);
    const r = scan(sb, root, ['docs']);
    expect(r.status).toBe(1);
    expectMasked(sb, r, 'Zwirbelmann');
    expectMasked(sb, r, AHV);
  }, 60_000);

  it.each(['docs/Quendolin-notiz.txt', 'docs/wap-planer/Quendolin-notiz.txt'])(
    '[R-H-07] maskiert den Pfad auch in der Meldung zu einem nicht existierenden Pfad (%s)',
    (pfad) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      const r = scan(sb, root, [pfad]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, 'Quendolin');
    },
    60_000,
  );

  it('[R-H-07] nennt Dateien unter reference/ nur als «Datei aus reference/ (Name maskiert)»', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'reference/Geheimeinheit Liste.txt', 'Harmlos\n');
    const r = scan(sb, root, ['reference/Geheimeinheit Liste.txt']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Datei aus reference/ (Name maskiert)');
    expect(r.out).not.toContain('Geheimeinheit');
    git(sb, root, 'add', '-f', 'reference/Geheimeinheit Liste.txt');
    const staged = scan(sb, root, ['--staged']);
    expect(staged.status).toBe(1);
    expect(staged.out).toContain('Datei aus reference/ (Name maskiert)');
    expect(staged.out).not.toContain('Geheimeinheit');
  }, 60_000);

  it('[R-H-07] lässt Dateinamen mit Datum und Uhrzeit ohne Muster passieren', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'docs/wap-planer/2026-10-01 Protokoll 0700-1200 v1.2.3.md', 'Sauber\n');
    expect(scan(sb, root, ['docs']).status).toBe(0);
  }, 60_000);
});

describe('privacy-scan: erweiterte Muster und Fehlalarme (P20, CR-H0S-08)', () => {
  it.each([
    ['Telefon mit Schrägstrich', j('Tel. 07', '9/483 26 15')],
    ['Telefon +41 (0)', j('Tel. +4', '1 (0)79 483 26 15')],
    ['Telefon 0041 (0)', j('Tel. 004', '1 (0)79 483 26 15')],
    ['AHV ungegliedert', j('AHV 756', '4821903657')],
    ['Telefon in SVG-Text ausserhalb von d=', j('<text x="1">07', '9 483 26 15</text>')],
    ['Telefon in gewöhnlichem String-Literal', j("  telefon: '07", "9 483 26 15',")],
    [
      'Telefon in String-Literal, das mit M beginnt, aber kein Pfad ist',
      j("  hinweis: 'Melden unter 07", "9 483 26 15',"),
    ],
    [
      'Telefon in Literal mit M<Zahl>-Anfang und Nicht-Pfad-Buchstaben',
      j("  text: 'M1 Anruf 07", "9 483 26 15',"),
    ],
  ])(
    '[R-H-07] blockiert %s',
    (_label, text) => {
      const sb = createSandbox();
      const r = scanText(sb, `${text}\n`);
      expect(r.status).toBe(1);
    },
    60_000,
  );

  it.each([
    [
      'SVG-Pfaddaten im d-Attribut',
      j('<path d="M16 20v-1.5a3.5 3.5 0 00', '4-3.5 3.5 3.5 0 000 7z" />'),
    ],
    ['telefonähnliche Ziffern im d-Attribut', j('<path d="M1 1 07', '9 483 26 15 L2 2" />')],
    [
      'SVG-Pfad-Literal im TS-Objekt (Ergänzung Runde 4)',
      j("  pin: 'M12 21s-6.5-5.7-6.5-11 07", "9 483 26 15 6.5 6.5 0 0113 0z',"),
    ],
    [
      'SVG-Pfad-Literal in Backticks (Ergänzung Runde 4)',
      j('  icon: `m2 2 07', '9 483 26 15 l4 4z`,'),
    ],
    [
      'Ziffernalphabet in Anführungszeichen',
      j('"parameters": {"length": 2, "digits": "01234', '56789"}'),
    ],
    ['Ziffernalphabet in längerer Zeichenfolge', "const erlaubt = '0123456789ABCDEFGHabcdefgh';"],
    ['Dezimalzahl', j('Faktor 0.1234', '56789')],
    ['Datum mit Uhrzeit', j('Beginn 01.10.2026 0', '7:00')],
    ['Datum mit militärischer Zeit', j('Beginn 01.10.2026 0', '700')],
    ['Telefonnummer direkt nach einem Buchstaben', j('Code x07', '94832615')],
    ['Telefonnummer direkt vor einer weiteren Ziffer', j('Code 07', '948326155')],
    ['AHV ungegliedert in 14-stelliger Ziffernfolge', j('Referenz 756', '48219036571')],
  ])(
    '[R-H-07] kein Fehlalarm bei %s',
    (_label, text) => {
      const sb = createSandbox();
      expect(scanText(sb, `${text}\n`).status).toBe(0);
    },
    60_000,
  );
});

describe('privacy-scan: Unicode-Normalisierung (P22, CR-H0S-11)', () => {
  it('[R-H-07] findet einen Namen, wenn die Sperrliste NFD und der Text NFC verwendet', () => {
    const sb = createSandbox();
    writeText(sb.referenceDir, SPERRLISTE, `${'Üngerbühl'.normalize('NFD')}\n`);
    const r = scanText(sb, `Lt ${'Üngerbühl'.normalize('NFC')} B\n`);
    expect(r.status).toBe(1);
  }, 60_000);

  it('[R-H-07] findet einen Namen, wenn die Sperrliste NFC und der Text NFD verwendet', () => {
    const sb = createSandbox();
    writeText(sb.referenceDir, SPERRLISTE, `${'Üngerbühl'.normalize('NFC')}\n`);
    const r = scanText(sb, `Lt ${'Üngerbühl'.normalize('NFD')} B\n`);
    expect(r.status).toBe(1);
  }, 60_000);

  it('[R-H-07] NFD-Text ohne gesperrten Namen bleibt ohne Befund', () => {
    const sb = createSandbox();
    writeText(sb.referenceDir, SPERRLISTE, `${'Üngerbühl'.normalize('NFD')}\n`);
    expect(scanText(sb, `${'Übung Führung'.normalize('NFD')}\n`).status).toBe(0);
  }, 60_000);
});

describe('privacy-scan: Ausschlüsse, Verknüpfungen, leere Sperrliste, Typwechsel (P24)', () => {
  it('[R-H-07] durchsucht verschachtelte reference/-Ordner, schliesst nur reference/ auf oberster Ebene aus', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'reference/oben.txt', `Treffer ${AHV}\n`);
    writeText(root, 'docs/wap-planer/sauber.md', 'Sauber\n');
    expect(scan(sb, root, ['.']).status).toBe(0);
    writeText(root, 'docs/wap-planer/reference/tief.txt', `Treffer ${AHV}\n`);
    const r = scan(sb, root, ['.']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('docs/wap-planer/reference/tief.txt');
  }, 60_000);

  it('[R-H-07] meldet eine übersprungene Junction und endet mit Exit 1', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(sb.base, 'ausserhalb/inhalt.txt', 'Harmlos\n');
    writeText(root, 'docs/wap-planer/sauber.md', 'Sauber\n');
    junction(join(root, 'docs', 'verknuepfung'), join(sb.base, 'ausserhalb'));
    const r = scan(sb, root, ['docs']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('übersprungen: Verknüpfung');
  }, 60_000);

  it('[R-H-07] maskiert den Pfad einer übersprungenen Verknüpfung mit Sperrlisten-Namen', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(sb.base, 'ausserhalb/inhalt.txt', 'Harmlos\n');
    junction(join(root, 'docs', 'Zwirbelmann-ordner'), join(sb.base, 'ausserhalb'));
    const r = scan(sb, root, ['docs']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('übersprungen: Verknüpfung');
    expectMasked(sb, r, 'Zwirbelmann');
  }, 60_000);

  it.each([
    ['nur Kommentare', '# Kommentar\n# noch einer\n'],
    ['nur Leerzeilen', '\n   \n\r\n'],
    ['leer', ''],
  ])(
    '[R-H-07] Sperrliste ohne Namen (%s) führt zu Exit 1',
    (_label, inhalt) => {
      const sb = createSandbox();
      writeText(sb.referenceDir, SPERRLISTE, inhalt);
      const r = scanText(sb, 'Harmloser Text\n');
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/Sperrliste/i);
    },
    60_000,
  );

  it('[R-H-07] --staged prüft einen Typwechsel (Verknüpfung -> Datei mit Inhalt)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    git(sb, root, 'config', 'core.symlinks', 'true');
    const blob = spawnSync('git', ['hash-object', '-w', '--stdin'], {
      cwd: root,
      env: sb.env,
      input: 'ziel.txt',
      encoding: 'utf8',
    }).stdout.trim();
    git(sb, root, 'update-index', '--add', '--cacheinfo', `120000,${blob},docs/wap-planer/link`);
    git(sb, root, 'commit', '-q', '-m', 'Verknüpfung');
    writeText(root, 'docs/wap-planer/link', `Inhalt ${AHV}\n`);
    git(sb, root, 'add', 'docs/wap-planer/link');
    expect(git(sb, root, 'diff', '--cached', '--name-status')).toMatch(
      /^T\s+docs\/wap-planer\/link$/m,
    );
    const r = scan(sb, root, ['--staged']);
    expect(r.status).toBe(1);
    expectMasked(sb, r, AHV);
  }, 60_000);
});

describe('privacy-scan: Präzisierungen Runde 2 (P29, P30, P32; CR-H0S-20, -21, -23)', () => {
  const NBSP = String.fromCharCode(0xa0);
  const TAB = String.fromCharCode(9);

  it.each([
    ['JS-Variable d', j('const d = "07', '9 483 26 15";')],
    ['data-d-Attribut', j('<div data-d="07', '9 483 26 15">x</div>')],
    ['Literal nur mit Anfangsbefehl M', j("  pin: 'M 07", "9 483 26 15',")],
    ['d-Attribut nur mit Anfangsbefehl M', j('<path d="M 07', '9 483 26 15" />')],
    ['Literal nur mit Anfangsbefehl m', j('  icon: `m 07', '9 483 26 15`,')],
  ])(
    '[R-H-07] blockiert eine Telefonnummer in %s (keine SVG-Pfad-Ausnahme, P29)',
    (_label, text) => {
      const sb = createSandbox();
      const r = scanText(sb, `${text}\n`);
      expect(r.status).toBe(1);
      expectMasked(sb, r, j('07', '9 483 26 15'));
    },
    60_000,
  );

  it.each([
    ['d-Attribut mit weiterem Pfadbefehl L', j('<path d="M 07', '9 483 26 15 L 2 2" />')],
    [
      'Literal mit weiteren Pfadbefehlen s und z',
      j("  pin: 'M12 21s-6.5-5.7 07", "9 483 26 15 0 0113 0z',"),
    ],
  ])(
    '[R-H-07] kein Fehlalarm bei echtem SVG-Pfad (%s, P29 Gegenprobe)',
    (_label, text) => {
      const sb = createSandbox();
      expect(scanText(sb, `${text}\n`).status).toBe(0);
    },
    60_000,
  );

  it.each([
    ['AHV nach «Nr.»', j('AHV-Nr.75', '6.4821.9036.57'), j('75', '6.4821.9036.57')],
    ['Telefon nach «Tel.»', j('Tel.07', '94832615'), j('07', '94832615')],
  ])(
    '[R-H-07] blockiert %s (Punkt nach Buchstaben schliesst nicht aus, P30)',
    (_label, text, secret) => {
      const sb = createSandbox();
      const r = scanText(sb, `${text}\n`);
      expect(r.status).toBe(1);
      expectMasked(sb, r, secret);
    },
    60_000,
  );

  it('[R-H-07] kein Fehlalarm bei Dezimalzahl mit Ziffer vor dem Punkt (P30 Gegenprobe)', () => {
    const sb = createSandbox();
    expect(scanText(sb, `${j('Faktor 3.07', '94832615')}\n`).status).toBe(0);
  }, 60_000);

  it.each([
    [
      'geschütztem Leerzeichen U+00A0',
      j('Tel. 07', '9', NBSP, '483', NBSP, '26', NBSP, '15'),
      j('07', '94832615'),
    ],
    ['mehrfachen Leerzeichen', j('Tel. 07', '9  483  26  15'), j('07', '94832615')],
    ['Klammer-Vorwahl (0xx)', j('Tel. (07', '9) 483 26 15'), j('07', '94832615')],
    ['AHV mit Leerzeichen gegliedert', j('AHV 75', '6 4821 9036 57'), j('75', '64821903657')],
    [
      'Tabulator als Gliederung',
      j('Tel. 07', '9', TAB, '483', TAB, '26', TAB, '15'),
      j('07', '94832615'),
    ],
  ])(
    '[R-H-07] blockiert eine Nummer mit %s (P32)',
    (_label, text, secret) => {
      const sb = createSandbox();
      const r = scanText(sb, `${text}\n`);
      expect(r.status).toBe(1);
      expectMasked(sb, r, secret);
    },
    60_000,
  );

  it.each([
    ['ungültigem Monat 91', j('Wert 07.91.23', '45 67'), j('07.91.23', '45 67')],
    ['ungültigem Monat 13 mit Uhrzeit', j('Wert 07.13.20', '26 12:00'), j('07.13.20', '26 12')],
    ['ungültigem Monat 00 mit Uhrzeit', j('Wert 07.00.20', '26 12:00'), j('07.00.20', '26 12')],
    ['ungültigem Tag 00 mit Uhrzeit', j('Wert 00.10.20', '26 12:00'), j('00.10.20', '26 12')],
  ])(
    '[R-H-07] blockiert eine datumsähnliche Nummer mit %s (Datums-Ausnahme nur für gültige Daten, P32)',
    (_label, text, secret) => {
      const sb = createSandbox();
      const r = scanText(sb, `${text}\n`);
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/telefon/i);
      expectMasked(sb, r, secret);
    },
    60_000,
  );

  it.each([
    ['gültigem Datum 07.12.2026 mit Uhrzeit', j('Beginn 07.12.20', '26 12:00')],
    ['gültigem Datum 07.01.2026 (Monat 01) mit Uhrzeit', j('Beginn 07.01.20', '26 07:00')],
  ])(
    '[R-H-07] kein Fehlalarm bei %s (P32 Gegenprobe)',
    (_label, text) => {
      const sb = createSandbox();
      expect(scanText(sb, `${text}\n`).status).toBe(0);
    },
    60_000,
  );
});

describe('privacy-scan: WAP-Pfadmenge (P35)', () => {
  const TELEFON = j('07', '9 483 26 15');
  /** Alle vier Inhaltsmuster in einer Datei (fiktiv, zur Laufzeit gebildet). */
  const ALLE_MUSTER = `Kontakt ${TELEFON}, AHV ${AHV}, ${MAIL}, Hptm Zwirbelmann A\n`;

  it.each([
    'docs/wap-planer/x.md',
    'scripts/wap/x.mjs',
    'scripts/wap-gate/x.mjs',
    'tests/wap-harness/x.ts',
    'tests/wap/x.ts',
    'tests/wap-e2e/x.ts',
    'tests/wap-gate/x.ts',
    'tests/wap-perf/x.ts',
    'src/components/wap/x.ts',
    'src/model/wap-board/x.ts',
    'src/wap/x.ts',
    'src/a/b/wap/x.ts',
    'src/wap-x/y.ts',
    'src/io/xlsx-drawing/x.ts',
    'src/assets/wap-fonts/x.txt',
    'tools/wap/x.mjs',
    '.claude/agents/x.md',
    'vitest.wap-zusatz.config.ts',
    'playwright.wap.config.ts',
    'AGENTS.md',
  ])(
    '[R-H-07] prüft Inhaltsmuster in %s (in der WAP-Pfadmenge)',
    (rel) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, rel, ALLE_MUSTER);
      const r = scan(sb, root, [rel]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
      expectMasked(sb, r, AHV);
      expectMasked(sb, r, MAIL);
      expectMasked(sb, r, 'Zwirbelmann');
    },
    60_000,
  );

  it.each([
    'tests/io.test.ts',
    'src/x.ts',
    'docs/notiz.md',
    'docs/wap-planer-alt/x.md',
    'src/components/wapper/x.ts',
    'tests/wap-harness-alt/x.ts',
    'README.md',
    'scripts/wapx/x.mjs',
    'tools/wapper/x.mjs',
    '.claude-alt/x.md',
    'src/io/xlsx-drawing-alt/x.ts',
    'AGENTS.md.bak',
    'src/wap-x.ts',
    'docs/AGENTS.md',
    'src/vitest.wap.ts',
    'vendor/docs/wap-planer/x.md',
    'lib/scripts/wap/x.mjs',
    'x/.claude/y.md',
    'lib/src/wap/x.ts',
    'vendor/src/x/wap-y/z.ts',
    'x/src/io/xlsx-drawing/y.ts',
  ])(
    '[R-H-07][R-H-08] prüft Inhaltsmuster in %s nicht (ausserhalb der WAP-Pfadmenge), zählt «nicht geprüft»',
    (rel) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, rel, ALLE_MUSTER);
      const r = scan(sb, root, [rel]);
      expect(r.status).toBe(0);
      expect(r.out).toContain('nicht geprüft');
    },
    60_000,
  );

  it('[R-H-07][R-H-08] Verzeichnis-Scan: Muster ausserhalb der Pfadmenge ohne Befund, in der Pfadmenge mit Befund (P35)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'tests/io.test.ts', ALLE_MUSTER);
    writeText(root, 'src/x.ts', ALLE_MUSTER);
    const sauber = scan(sb, root, ['tests', 'src']);
    expect(sauber.status).toBe(0);
    expect(sauber.out).toContain('nicht geprüft');
    writeText(root, 'tests/wap/x.ts', `Kontakt ${TELEFON}\n`);
    const treffer = scan(sb, root, ['tests', 'src']);
    expect(treffer.status).toBe(1);
    expect(treffer.out).toContain('tests/wap/x.ts');
  }, 60_000);

  it.each([
    ['AHV-Nummer', `src/${AHV}.ts`, AHV],
    ['Sperrlisten-Name', 'tests/Zwirbelmann.test.ts', 'Zwirbelmann'],
  ])(
    '[R-H-07] Muster im Pfadnamen ausserhalb der Pfadmenge bleibt ein Befund (%s, P35/P19)',
    (_label, rel, secret) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, rel, 'Harmloser Inhalt\n');
      const r = scan(sb, root, [rel]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, secret);
    },
    60_000,
  );

  it('[R-H-07] Datei unter reference/ bleibt ein Befund, auch ausserhalb der Pfadmenge (P35)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'reference/liste.txt', 'Harmloser Inhalt\n');
    git(sb, root, 'add', '-f', 'reference/liste.txt');
    expect(scan(sb, root, ['reference/liste.txt']).status).toBe(1);
    expect(scan(sb, root, ['--staged']).status).toBe(1);
  }, 60_000);

  it('[R-H-07][R-H-08] --staged: gestagte Suite-Testdatei mit fiktiver Nummer ohne Befund, «nicht geprüft» (P35, Merge-Fall)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'tests/io.test.ts', ALLE_MUSTER);
    git(sb, root, 'add', 'tests/io.test.ts');
    const r = scan(sb, root, ['--staged']);
    expect(r.status).toBe(0);
    expect(r.out).toContain('nicht geprüft');
  }, 60_000);

  it('[R-H-07] --staged: dieselben Muster in der Pfadmenge mit Befund (P35, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'tests/wap/io.test.ts', ALLE_MUSTER);
    git(sb, root, 'add', 'tests/wap/io.test.ts');
    const r = scan(sb, root, ['--staged']);
    expect(r.status).toBe(1);
    expectMasked(sb, r, TELEFON);
  }, 60_000);
});

describe('privacy-scan: Positivliste name@pfad (P36)', () => {
  const PROMPT = 'docs/wap-planer/PROMPT_WAP_Planer.md';
  const BESCHRIEB = 'docs/wap-planer/PROJEKTBESCHRIEB_WAP_Planer.md';

  function repoMitErlaubnis(sb: Sandbox, eintrag: string): string {
    const root = initRepo(sb, 'haupt');
    writeText(root, 'scripts/wap/privacy-allow.txt', `${eintrag}\n`);
    return root;
  }

  it.each([PROMPT, BESCHRIEB, 'docs/wap-planer/andere.md'])(
    '[R-H-07] erlaubt den Sperrlisten-Namen in genau der Datei aus name@pfad: %s (P36)',
    (pfad) => {
      const sb = createSandbox();
      const root = repoMitErlaubnis(sb, j('Zwirbelmann', '@', pfad));
      writeText(root, pfad, 'Auftraggeber: Hptm Zwirbelmann A\n');
      expect(scan(sb, root, [pfad]).status).toBe(0);
    },
    60_000,
  );

  it('[R-H-07] derselbe Name in einer anderen Datei bleibt ein Befund (P36)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(sb, j('Zwirbelmann', '@', PROMPT));
    writeText(root, 'docs/wap-planer/andere.md', 'Hptm Zwirbelmann A\n');
    const r = scan(sb, root, ['docs/wap-planer/andere.md']);
    expect(r.status).toBe(1);
    expectMasked(sb, r, 'Zwirbelmann');
  }, 60_000);

  it('[R-H-07] Eintrag für eine andere freigegebene Datei erlaubt den Namen nicht (P36)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(sb, j('Zwirbelmann', '@', BESCHRIEB));
    writeText(root, PROMPT, 'Hptm Zwirbelmann A\n');
    expect(scan(sb, root, [PROMPT]).status).toBe(1);
  }, 60_000);

  it('[R-H-07] ein anderer Name in der freigegebenen Datei bleibt ein Befund (P36)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(sb, j('Zwirbelmann', '@', PROMPT));
    writeText(root, PROMPT, 'Hptm Zwirbelmann A und Oblt Quendolin B\n');
    const r = scan(sb, root, [PROMPT]);
    expect(r.status).toBe(1);
    expectMasked(sb, r, 'Quendolin');
  }, 60_000);

  it.each([
    ['AHV-Nummer', `AHV ${AHV}`, AHV],
    ['Telefonnummer', j('Tel. 07', '9 483 26 15'), j('07', '9 483 26 15')],
    ['E-Mail-Adresse', `Mail ${MAIL}`, MAIL],
  ])(
    '[R-H-07] %s in der freigegebenen Datei bleibt ein Befund (P36)',
    (_label, text, secret) => {
      const sb = createSandbox();
      const root = repoMitErlaubnis(sb, j('Zwirbelmann', '@', PROMPT));
      writeText(root, PROMPT, `Hptm Zwirbelmann A\n${text}\n`);
      const r = scan(sb, root, [PROMPT]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, secret);
    },
    60_000,
  );

  it('[R-H-07] name@pfad macht den Namen nicht allgemein zur Positivliste (P36)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(sb, j('Zwirbelmann', '@', PROMPT));
    writeText(root, 'tests/wap/x.ts', "export const kdt = 'Zwirbelmann';\n");
    expect(scan(sb, root, ['tests/wap/x.ts']).status).toBe(1);
  }, 60_000);

  const ALLOW = 'scripts/wap/privacy-allow.txt';

  it('[R-H-07] Scan der Positivliste selbst: Name links in einer eigenen <Name>@<pfad>-Zeile ist erlaubt (P36a)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(sb, j('Zwirbelmann', '@', PROMPT));
    expect(scan(sb, root, [ALLOW]).status).toBe(0);
  }, 60_000);

  it.each([
    ['anderer Name in einer Kommentarzeile', '# Rückfrage zu Quendolin', 'Quendolin'],
    ['anderer Name als nackte Zeile ohne @', 'Quendolin', 'Quendolin'],
    ['AHV-Nummer', `# Beispiel ${AHV}`, AHV],
    ['derselbe Name in einer Kommentarzeile', '# Hinweis Zwirbelmann', 'Zwirbelmann'],
    ['derselbe Name als nackte Zeile ohne @', 'Zwirbelmann', 'Zwirbelmann'],
    ['Telefonnummer', j('# Tel. 07', '9 483 26 15'), j('07', '9 483 26 15')],
  ])(
    '[R-H-07] Scan der Positivliste: %s bleibt ein Befund (P36a)',
    (_label, zeile, secret) => {
      const sb = createSandbox();
      const root = repoMitErlaubnis(sb, `${j('Zwirbelmann', '@', PROMPT)}\n${zeile}`);
      const r = scan(sb, root, [ALLOW]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, secret);
    },
    60_000,
  );

  it('[R-H-07] nackter Eintrag «Zwirbelmann» ohne @pfad erlaubt den Namen in keiner anderen Datei (P36a)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(sb, 'Zwirbelmann');
    writeText(root, PROMPT, 'Hptm Zwirbelmann A\n');
    writeText(root, 'docs/wap-planer/andere.md', 'Hptm Zwirbelmann A\n');
    expect(scan(sb, root, [PROMPT]).status).toBe(1);
    expect(scan(sb, root, ['docs/wap-planer/andere.md']).status).toBe(1);
  }, 60_000);

  it.each([
    ['Text in Grossbuchstaben', 'Zwirbelmann', 'Hptm ZWIRBELMANN A'],
    ['Eintrag in Grossbuchstaben', 'ZWIRBELMANN', 'Hptm Zwirbelmann A'],
  ])(
    '[R-H-07] name@pfad ist unabhängig von Gross/Klein (%s, P36b)',
    (_label, eintragName, text) => {
      const sb = createSandbox();
      const root = repoMitErlaubnis(sb, j(eintragName, '@', PROMPT));
      writeText(root, PROMPT, `${text}\n`);
      expect(scan(sb, root, [PROMPT]).status).toBe(0);
    },
    60_000,
  );

  it('[R-H-07] eine gültige <Name>@<pfad>-Zeile in der Positivliste ist kein E-Mail-Befund (P36b)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(
      sb,
      `${j('Zwirbelmann', '@', PROMPT)}\n${j('Quendolin', '@', 'docs/wap-planer/PROJEKTBESCHRIEB_WAP_Planer.md')}`,
    );
    const r = scan(sb, root, [ALLOW]);
    expect(r.status).toBe(0);
    expect(r.out).not.toMatch(/e-?mail/i);
  }, 60_000);

  const FREIGEGEBEN = j('kontakt', '@', 'beispiel.invalid');
  const ANDERE = j('andere.person', '@', 'beispiel.invalid');

  it('[R-H-07] Scan der Positivliste: eine dort freigegebene E-Mail-Adresse ist kein Treffer (P36c)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(sb, `${j('Zwirbelmann', '@', PROMPT)}\n${FREIGEGEBEN}`);
    expect(scan(sb, root, [ALLOW]).status).toBe(0);
  }, 60_000);

  it('[R-H-07] Scan der Positivliste: eine andere E-Mail-Adresse in derselben Datei bleibt ein Befund, maskiert (P36c)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(sb, `${FREIGEGEBEN}\n# Rückfrage an ${ANDERE}`);
    const r = scan(sb, root, [ALLOW]);
    expect(r.status).toBe(1);
    expectMasked(sb, r, ANDERE);
  }, 60_000);

  // P41 (CR-H0S-28): nur «<Name>@<pfad>» (genau ein @, Pfad ein Token mit /) ist ein Eintrag.
  const P_MD = 'docs/wap-planer/P.md';

  it.each([
    ['E-Mail zusätzlich in der Eintragszeile (Angriff A2)', j('Zwirbelmann', '@', P_MD, ' ', MAIL)],
    ['E-Mail im Pfadteil (Angriff A3)', j('Zwirbelmann', '@', 'docs/wap-planer/', MAIL)],
  ])(
    '[R-H-07] Scan der Positivliste: %s ist kein Eintrag, E-Mail-Befund (P41)',
    (_label, zeile) => {
      const sb = createSandbox();
      const root = repoMitErlaubnis(sb, zeile);
      const r = scan(sb, root, [ALLOW]);
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/mail/i);
      expectMasked(sb, r, MAIL);
      // Freigabeseite (TR-H0-64 b): die Zeile gibt den Namen in P.md nicht frei.
      writeText(root, P_MD, 'Hptm Zwirbelmann A\n');
      expect(scan(sb, root, [P_MD]).status).toBe(1);
    },
    60_000,
  );

  it.each([
    ['zwei @ in der Zeile', j('Zwirbelmann', '@', '@', P_MD)],
    ['Leerraum im Pfad', j('Zwirbelmann', '@', 'docs/wap-planer/P datei.md')],
    ['Pfad ohne /', j('Zwirbelmann', '@', 'PROMPT_WAP_Planer.md')],
    ['Leerraum um das @ (P41a)', j('Zwirbelmann', ' @ ', P_MD)],
    ['Leerraum vor dem @ (P41a)', j('Zwirbelmann', ' @', P_MD)],
    ['Leerraum nach dem @ (P41a)', j('Zwirbelmann', '@ ', P_MD)],
  ])(
    '[R-H-07] Scan der Positivliste: Zeile mit %s ist kein Eintrag, wird voll geprüft und gibt nichts frei (P41)',
    (_label, zeile) => {
      const sb = createSandbox();
      const root = repoMitErlaubnis(sb, zeile);
      const r = scan(sb, root, [ALLOW]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, 'Zwirbelmann');
      // Freigabeseite (TR-H0-64 b).
      writeText(root, P_MD, 'Hptm Zwirbelmann A\n');
      expect(scan(sb, root, [P_MD]).status).toBe(1);
    },
    60_000,
  );

  it('[R-H-07] Scan der Positivliste: gültiger Eintrag mit Leerraum am Zeilenrand (getrimmt) bleibt ohne Befund (P41, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = repoMitErlaubnis(sb, `  ${j('Zwirbelmann', '@', P_MD)}  `);
    expect(scan(sb, root, [ALLOW]).status).toBe(0);
  }, 60_000);

  it('[R-H-07] Name aus mehreren Wörtern: Leerraum innerhalb des Namens ist erlaubt, Eintrag gilt für Freigabe und Selbst-Scan (P41a)', () => {
    const sb = createSandbox();
    writeText(sb.referenceDir, SPERRLISTE, 'Quax Dorfer\n');
    const root = repoMitErlaubnis(sb, j('Quax Dorfer', '@', P_MD));
    writeText(root, P_MD, 'Kdt Quax Dorfer\n');
    expect(scan(sb, root, [P_MD]).status).toBe(0);
    expect(scan(sb, root, [ALLOW]).status).toBe(0);
    // Gegenprobe: in einer anderen Datei bleibt der Name ein Befund.
    writeText(root, 'docs/wap-planer/andere.md', 'Kdt Quax Dorfer\n');
    expect(scan(sb, root, ['docs/wap-planer/andere.md']).status).toBe(1);
  }, 60_000);
});

describe('privacy-scan: Worktree-Wurzel je Pfad (P39, CR-H0S-26)', () => {
  const TELEFON = j('07', '9 483 26 15');

  function aufbau(sb: Sandbox) {
    const repo = initRepo(sb, 'paket');
    writeText(repo, 'docs/wap-planer/p.md', `Kontakt ${TELEFON}\n`);
    const fremd = join(sb.base, 'fremd');
    mkdirSync(fremd);
    const anderes = initRepo(sb, 'anderes');
    return { repo, fremd, anderes };
  }

  function scanVon(sb: Sandbox, skripte: string, cwd: string, args: string[]): RunResult {
    return runScript(sb, skripte, 'privacy-scan.mjs', args, { cwd });
  }

  it('[R-H-07] absoluter Dateipfad, Aufruf aus einem Ordner ohne Git → Befund, maskiert (Angriff P7)', () => {
    const sb = createSandbox();
    const { repo, fremd } = aufbau(sb);
    const r = scanVon(sb, repo, fremd, [join(repo, 'docs', 'wap-planer', 'p.md')]);
    expect(r.status).toBe(1);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] absoluter Repo-Ordner, Aufruf aus einem Ordner ohne Git → Befund, maskiert (Angriff P8)', () => {
    const sb = createSandbox();
    const { repo, fremd } = aufbau(sb);
    const r = scanVon(sb, repo, fremd, [repo]);
    expect(r.status).toBe(1);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] absoluter Dateipfad, Aufruf aus einem anderen Repo mit dessen Skripten → Befund, maskiert (Angriff P9)', () => {
    const sb = createSandbox();
    const { repo, anderes } = aufbau(sb);
    const r = scanVon(sb, anderes, anderes, [join(repo, 'docs', 'wap-planer', 'p.md')]);
    expect(r.status).toBe(1);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] absoluter Repo-Ordner, Aufruf aus einem anderen Repo mit dessen Skripten → Befund, maskiert (Angriff P10)', () => {
    const sb = createSandbox();
    const { repo, anderes } = aufbau(sb);
    const r = scanVon(sb, anderes, anderes, [repo]);
    expect(r.status).toBe(1);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07][R-H-08] absoluter Pfad einer Datei ausserhalb der Pfadmenge → ohne Befund, «nicht geprüft» (P39, Gegenprobe)', () => {
    const sb = createSandbox();
    const { repo, fremd, anderes } = aufbau(sb);
    writeText(repo, 'tests/io.test.ts', `Kontakt ${TELEFON}\n`);
    const ausFremd = scanVon(sb, repo, fremd, [join(repo, 'tests', 'io.test.ts')]);
    expect(ausFremd.status).toBe(0);
    expect(ausFremd.out).toContain('nicht geprüft');
    const ausAnderem = scanVon(sb, anderes, anderes, [join(repo, 'tests', 'io.test.ts')]);
    expect(ausAnderem.status).toBe(0);
    expect(ausAnderem.out).toContain('nicht geprüft');
  }, 60_000);

  it('[R-H-07] absoluter Pfad unter reference/ des Paket-Repos → Befund, auch aus einem anderen Repo (P39)', () => {
    const sb = createSandbox();
    const { repo, fremd, anderes } = aufbau(sb);
    writeText(repo, 'reference/liste.txt', 'Harmlos\n');
    expect(scanVon(sb, repo, fremd, [join(repo, 'reference', 'liste.txt')]).status).toBe(1);
    expect(scanVon(sb, anderes, anderes, [join(repo, 'reference', 'liste.txt')]).status).toBe(1);
  }, 60_000);

  it('[R-H-07] Datei in keinem Git-Worktree wird voll geprüft → Befund, maskiert (P39)', () => {
    const sb = createSandbox();
    const { repo, fremd } = aufbau(sb);
    const lose = writeText(sb.base, 'lose/notiz.md', `Kontakt ${TELEFON}\n`);
    const r = scanVon(sb, repo, fremd, [lose]);
    expect(r.status).toBe(1);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] saubere Datei in keinem Git-Worktree → ohne Befund (P39, Gegenprobe)', () => {
    const sb = createSandbox();
    const { repo, fremd } = aufbau(sb);
    const lose = writeText(sb.base, 'lose/sauber.md', 'Hptm Muster A\n');
    expect(scanVon(sb, repo, fremd, [lose]).status).toBe(0);
  }, 60_000);

  // TR-H0-59: Verzeichnis als Argument – Pfadmenge und reference/ relativ zur Wurzel des Verzeichnisses.
  it.each(['fremd', 'anderes'] as const)(
    '[R-H-07][R-H-08] absoluter Repo-Ordner mit Muster nur ausserhalb der Pfadmenge und in reference/, Aufruf aus «%s» → Exit 0, «nicht geprüft» (P39, Gegenprobe)',
    (von) => {
      const sb = createSandbox();
      const { repo, fremd, anderes } = aufbau(sb);
      writeText(repo, 'docs/wap-planer/p.md', 'Hptm Muster A\n');
      writeText(repo, 'tests/io.test.ts', `Kontakt ${TELEFON}\n`);
      writeText(repo, 'reference/x.txt', `Kontakt ${TELEFON}\n`);
      const r =
        von === 'fremd' ? scanVon(sb, repo, fremd, [repo]) : scanVon(sb, anderes, anderes, [repo]);
      expect(r.status).toBe(0);
      expect(r.out).toContain('nicht geprüft');
    },
    60_000,
  );

  it('[R-H-07] absolutes Unterverzeichnis docs/ mit Telefonnummer in docs/wap-planer/, Aufruf aus anderem Repo → Befund, maskiert (P39, TR-H0-59)', () => {
    const sb = createSandbox();
    const { repo, anderes } = aufbau(sb);
    const r = scanVon(sb, anderes, anderes, [join(repo, 'docs')]);
    expect(r.status).toBe(1);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  // TR-H0-60: relative Pfade aus fremdem cwd, mit \ und /, sowie absolute Pfade mit /.
  type Variante = [string, 'fremd' | 'anderes', 'relativ-bs' | 'relativ-slash' | 'absolut-slash'];
  const VARIANTEN: Variante[] = [
    ['relativ mit \\ aus Nicht-Git-Ordner', 'fremd', 'relativ-bs'],
    ['relativ mit / aus Nicht-Git-Ordner', 'fremd', 'relativ-slash'],
    ['relativ mit \\ aus anderem Repo', 'anderes', 'relativ-bs'],
    ['relativ mit / aus anderem Repo', 'anderes', 'relativ-slash'],
    ['absolut mit / aus Nicht-Git-Ordner', 'fremd', 'absolut-slash'],
    ['absolut mit / aus anderem Repo', 'anderes', 'absolut-slash'],
  ];

  function argument(form: Variante[2], cwd: string, ziel: string): string {
    const BS = String.fromCharCode(92);
    if (form === 'absolut-slash') return ziel.split(BS).join('/');
    const rel = relative(cwd, ziel);
    return form === 'relativ-bs' ? rel.split('/').join(BS) : rel.split(BS).join('/');
  }

  it.each(VARIANTEN)(
    '[R-H-07] Pfad %s auf docs/wap-planer/p.md mit Telefonnummer → Befund, maskiert (P39, TR-H0-60)',
    (_label, von, form) => {
      const sb = createSandbox();
      const { repo, fremd, anderes } = aufbau(sb);
      const cwd = von === 'fremd' ? fremd : anderes;
      const skripte = von === 'fremd' ? repo : anderes;
      const arg = argument(form, cwd, join(repo, 'docs', 'wap-planer', 'p.md'));
      const r = scanVon(sb, skripte, cwd, [arg]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each(VARIANTEN)(
    '[R-H-07][R-H-08] Pfad %s auf tests/io.test.ts (ausserhalb der Pfadmenge) → Exit 0, «nicht geprüft» (P39, TR-H0-60, Gegenprobe)',
    (_label, von, form) => {
      const sb = createSandbox();
      const { repo, fremd, anderes } = aufbau(sb);
      writeText(repo, 'tests/io.test.ts', `Kontakt ${TELEFON}\n`);
      const cwd = von === 'fremd' ? fremd : anderes;
      const skripte = von === 'fremd' ? repo : anderes;
      const arg = argument(form, cwd, join(repo, 'tests', 'io.test.ts'));
      const r = scanVon(sb, skripte, cwd, [arg]);
      expect(r.status).toBe(0);
      expect(r.out).toContain('nicht geprüft');
    },
    60_000,
  );

  // TR-H0-61 a: mehrere Pfade aus verschiedenen Worktrees in einem Aufruf.
  it.each(['A zuerst', 'B zuerst'])(
    '[R-H-07] mehrere Pfade aus zwei Repos (%s): genau ein Befund aus der Pfadmenge von B, A «nicht geprüft» (P39, TR-H0-61)',
    (reihenfolge) => {
      const sb = createSandbox();
      const { repo: repoB, fremd } = aufbau(sb);
      const repoA = initRepo(sb, 'repo-a');
      writeText(repoA, 'tests/io.test.ts', `Kontakt ${TELEFON}\n`);
      const a = join(repoA, 'tests', 'io.test.ts');
      const b = join(repoB, 'docs', 'wap-planer', 'p.md');
      const args = reihenfolge === 'A zuerst' ? [a, b] : [b, a];
      const r = scanVon(sb, repoB, fremd, args);
      expect(r.status).toBe(1);
      expect(r.out).toContain('nicht geprüft');
      // Formatunabhängig (TR-H0-69): gleich viele Telefon-Meldungen wie im Referenzlauf nur mit B.
      const referenz = scanVon(sb, repoB, fremd, [b]);
      expect(referenz.status).toBe(1);
      const telefonZeilen = (out: string) =>
        out.split(/\r?\n/).filter((l) => /telefon/i.test(l)).length;
      expect(telefonZeilen(r.out)).toBe(telefonZeilen(referenz.out));
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  // TR-H0-61 b: verknüpfter Worktree desselben Repos (Schleusenfall: Skripte und cwd im Haupt-Checkout).
  it(
    '[R-H-07] verknüpfter Worktree: absoluter Dateipfad und Worktree-Ordner, Aufruf aus dem Haupt-Checkout → Befund, maskiert (P39, TR-H0-61)',
    () => {
      const sb = createSandbox();
      const haupt = initRepo(sb, 'haupt');
      const wt = addWorktree(sb, haupt, join(sb.base, 'wt', 'x'), 'wap/x');
      writeText(wt, 'docs/wap-planer/p.md', `Kontakt ${TELEFON}\n`);
      const datei = scanVon(sb, haupt, haupt, [join(wt, 'docs', 'wap-planer', 'p.md')]);
      expect(datei.status).toBe(1);
      expectMasked(sb, datei, TELEFON);
      const ordner = scanVon(sb, haupt, haupt, [wt]);
      expect(ordner.status).toBe(1);
      expectMasked(sb, ordner, TELEFON);
    },
    SLOW,
  );

  it(
    '[R-H-07][R-H-08] verknüpfter Worktree: Datei ausserhalb der Pfadmenge, Aufruf aus dem Haupt-Checkout → Exit 0, «nicht geprüft» (P39, TR-H0-61, Gegenprobe)',
    () => {
      const sb = createSandbox();
      const haupt = initRepo(sb, 'haupt');
      const wt = addWorktree(sb, haupt, join(sb.base, 'wt', 'x'), 'wap/x');
      writeText(wt, 'tests/io.test.ts', `Kontakt ${TELEFON}\n`);
      const r = scanVon(sb, haupt, haupt, [join(wt, 'tests', 'io.test.ts')]);
      expect(r.status).toBe(0);
      expect(r.out).toContain('nicht geprüft');
    },
    SLOW,
  );
});

describe('privacy-scan: erweiterte WAP-Pfadmenge (P40, CR-H0S-27)', () => {
  const TELEFON = j('07', '9 483 26 15');
  const ALLE = `Kontakt ${TELEFON}, AHV ${AHV}, ${MAIL}, Hptm Zwirbelmann A\n`;

  it.each([
    'src/pages/WapPage.tsx',
    'stryker.wap.conf.mjs',
    'tsconfig.wap.json',
    'src/io/wap/x.ts',
    'src/App.tsx',
    'src/components/Shell.tsx',
    'src/components/CommandPalette.tsx',
    'src/components/Icon.tsx',
    'tools/build-offline.mjs',
    'package.json',
    '.gitignore',
    '.gitattributes',
    'biome.json',
  ])(
    '[R-H-07] prüft Inhaltsmuster in %s (P40, in der WAP-Pfadmenge)',
    (rel) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, rel, ALLE);
      const r = scan(sb, root, [rel]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
      expectMasked(sb, r, AHV);
      expectMasked(sb, r, MAIL);
      expectMasked(sb, r, 'Zwirbelmann');
    },
    60_000,
  );

  it.each([
    'src/pages/Other.tsx',
    'src/components/Button.tsx',
    'tools/other.mjs',
    'docs/package.json',
    'src/.gitignore',
    'docs/biome.json',
    'docs/tsconfig.wap.json',
    'lib/stryker.wap.conf.mjs',
    'src/pages/sub/WapX.tsx',
    'lib/src/App.tsx',
  ])(
    '[R-H-07][R-H-08] prüft Inhaltsmuster in %s nicht (P40, ausserhalb der WAP-Pfadmenge), «nicht geprüft»',
    (rel) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, rel, ALLE);
      const r = scan(sb, root, [rel]);
      expect(r.status).toBe(0);
      expect(r.out).toContain('nicht geprüft');
    },
    60_000,
  );
});

describe('privacy-scan: unechte und echte verschachtelte Repos (P39a, CR-H0S-32)', () => {
  const TELEFON = j('07', '9 483 26 15');

  it.each(['.', 'docs/wap-planer/x'])(
    '[R-H-07] unechter leerer .git-Ordner in docs/wap-planer/x, Scan von «%s» → Befund, maskiert (Angriff N1/N1b)',
    (arg) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      mkdirSync(join(root, 'docs', 'wap-planer', 'x', '.git'), { recursive: true });
      writeText(root, 'docs/wap-planer/x/p.md', `Kontakt ${TELEFON}\n`);
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each(['.', 'docs/wap-planer/y', 'docs/wap-planer/y/p.md'])(
    '[R-H-07] unechte .git-Datei mit Unsinn in docs/wap-planer/y (git-Fehler), Scan von «%s» → Exit 1 (Angriff N2, P39a)',
    (arg) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, 'docs/wap-planer/y/.git', 'kein gültiger Verweis\n');
      writeText(root, 'docs/wap-planer/y/p.md', `Kontakt ${TELEFON}\n`);
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it('[R-H-07][R-H-08] echtes verschachteltes Repo bleibt eigene Wurzel: Datei dort ausserhalb seiner Pfadmenge → «nicht geprüft» (P39a, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    const innen = join(root, 'docs', 'wap-planer', 'z');
    mkdirSync(innen, { recursive: true });
    git(sb, innen, 'init', '-q');
    writeText(innen, 'tests/io.test.ts', `Kontakt ${TELEFON}\n`);
    const r = scan(sb, root, ['.']);
    expect(r.status).toBe(0);
    expect(r.out).toContain('nicht geprüft');
  }, 60_000);
});

describe('privacy-scan: Sperrlisten-Name im vollen Pfad ausserhalb jedes Worktrees (P39b, CR-H0S-33)', () => {
  const TELEFON = j('07', '9 483 26 15');

  function aufbau(sb: Sandbox, inhalt: string) {
    const skripte = initRepo(sb, 'skripte');
    const akte = join(sb.base, 'Akte Zwirbelmann');
    writeText(akte, 'src/y.ts', inhalt);
    const fremd = join(sb.base, 'fremd');
    mkdirSync(fremd);
    return { skripte, akte, fremd };
  }

  it.each([
    ['Datei-Argument (M1)', (akte: string) => join(akte, 'src', 'y.ts')],
    ['Ordner src (M2)', (akte: string) => join(akte, 'src')],
    ['Namensordner (M3)', (akte: string) => akte],
  ])(
    '[R-H-07] %s mit Telefonnummer: Exit 1, Name in keiner Ausgabe im Klartext (P39b)',
    (_label, arg) => {
      const sb = createSandbox();
      const { skripte, akte, fremd } = aufbau(sb, `Kontakt ${TELEFON}\n`);
      const r = runScript(sb, skripte, 'privacy-scan.mjs', [arg(akte)], { cwd: fremd });
      expect(r.status).toBe(1);
      expectMasked(sb, r, 'Zwirbelmann');
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each([
    ['Datei-Argument', (akte: string) => join(akte, 'src', 'y.ts')],
    ['Ordner src', (akte: string) => join(akte, 'src')],
  ])(
    '[R-H-07] %s mit sauberem Inhalt: der Name im vollen Pfad ist ein Befund, Exit 1, maskiert (P39b)',
    (_label, arg) => {
      const sb = createSandbox();
      const { skripte, akte, fremd } = aufbau(sb, 'Hptm Muster A\n');
      const r = runScript(sb, skripte, 'privacy-scan.mjs', [arg(akte)], { cwd: fremd });
      expect(r.status).toBe(1);
      expectMasked(sb, r, 'Zwirbelmann');
    },
    60_000,
  );

  it('[R-H-07] sauberer Ordner ohne Namen im vollen Pfad ausserhalb jedes Worktrees → Exit 0 (P39b, Gegenprobe)', () => {
    const sb = createSandbox();
    const skripte = initRepo(sb, 'skripte');
    const akte = join(sb.base, 'Akte Muster');
    writeText(akte, 'src/y.ts', 'Hptm Muster A\n');
    const fremd = join(sb.base, 'fremd');
    mkdirSync(fremd);
    expect(runScript(sb, skripte, 'privacy-scan.mjs', [akte], { cwd: fremd }).status).toBe(0);
  }, 60_000);

  it.each([
    ['Ordner src', (akte: string) => join(akte, 'src')],
    ['Namensordner', (akte: string) => akte],
  ])(
    '[R-H-07] Junction in «Akte Zwirbelmann/src/» ausserhalb jedes Worktrees, Argument %s: Exit 1, «übersprungen: Verknüpfung», Name in keiner Ausgabe im Klartext (P39b, Angriff M2)',
    (_label, arg) => {
      const sb = createSandbox();
      const { skripte, akte, fremd } = aufbau(sb, 'Hptm Muster A\n');
      writeText(sb.base, 'ziel/inhalt.txt', 'Harmlos\n');
      junction(join(akte, 'src', 'verknuepfung'), join(sb.base, 'ziel'));
      const r = runScript(sb, skripte, 'privacy-scan.mjs', [arg(akte)], { cwd: fremd });
      expect(r.status).toBe(1);
      expect(r.out).toContain('übersprungen: Verknüpfung');
      expectMasked(sb, r, 'Zwirbelmann');
    },
    60_000,
  );

  it('[R-H-07] Fehlermeldung zu einem nicht existierenden Pfad unter «Akte Zwirbelmann» ausserhalb jedes Worktrees: Exit 1, Name maskiert (P39b)', () => {
    const sb = createSandbox();
    const { skripte, akte, fremd } = aufbau(sb, 'Hptm Muster A\n');
    const r = runScript(sb, skripte, 'privacy-scan.mjs', [join(akte, 'src', 'fehlt.ts')], {
      cwd: fremd,
    });
    expect(r.status).toBe(1);
    expectMasked(sb, r, 'Zwirbelmann');
  }, 60_000);

  it('[R-H-07] git-Fehler (unechte .git-Datei) unter «Akte Zwirbelmann» ausserhalb jedes Worktrees: Exit 1, Name maskiert (P39a, P39b)', () => {
    const sb = createSandbox();
    const { skripte, akte, fremd } = aufbau(sb, 'Hptm Muster A\n');
    writeText(akte, 'src/sub/.git', 'kein gültiger Verweis\n');
    writeText(akte, 'src/sub/z.ts', 'Hptm Muster A\n');
    const r = runScript(sb, skripte, 'privacy-scan.mjs', [join(akte, 'src')], { cwd: fremd });
    expect(r.status).toBe(1);
    expectMasked(sb, r, 'Zwirbelmann');
  }, 60_000);
});

describe('privacy-scan: Ausschlüsse je Tiefe (P24a)', () => {
  const TELEFON = j('07', '9 483 26 15');

  it.each(['spikes', 'coverage', 'dist', '.qa'])(
    '[R-H-07] docs/wap-planer/%s/p.md (nicht oberste Ebene) wird durchsucht → Befund (P24a)',
    (dir) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, `docs/wap-planer/${dir}/p.md`, `Kontakt ${TELEFON}\n`);
      const r = scan(sb, root, ['.']);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each(['spikes', 'coverage', 'dist', '.qa'])(
    '[R-H-07] %s/ auf oberster Ebene wird ausgelassen (Muster im Dateinamen ohne Befund) → Exit 0 (P24a, Gegenprobe)',
    (dir) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, `${dir}/${AHV}.md`, `Kontakt ${TELEFON}\n`);
      expect(scan(sb, root, ['.']).status).toBe(0);
    },
    60_000,
  );

  it('[R-H-07] node_modules in der Pfadmenge wird auf jeder Tiefe ausgelassen → Exit 0 (P24a)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'docs/wap-planer/node_modules/p.md', `Kontakt ${TELEFON}\n`);
    writeText(root, `docs/wap-planer/node_modules/${AHV}.md`, 'Harmlos\n');
    expect(scan(sb, root, ['.']).status).toBe(0);
    // Gegenprobe: derselbe Inhalt ausserhalb von node_modules ist ein Befund.
    writeText(root, 'docs/wap-planer/p.md', `Kontakt ${TELEFON}\n`);
    expect(scan(sb, root, ['.']).status).toBe(1);
  }, 60_000);
});

describe('privacy-scan: git-Fehler und Wurzelbestätigung beim Durchsuchen (P39a, P39c; TR-H0-70 bis -72)', () => {
  const TELEFON = j('07', '9 483 26 15');

  /** Unechte `.git`-Dateien, für die git mit einem Fehler endet (P39c). */
  function gitFehlerInhalte(sb: Sandbox): Array<[string, string]> {
    const fehlt = join(sb.base, 'gibt-es-nicht').split(String.fromCharCode(92)).join('/');
    return [
      ['Unsinn (invalid gitfile)', 'kein gültiger Verweis\n'],
      ['gitdir: ins Leere', `gitdir: ${fehlt}\n`],
    ];
  }

  it.each([
    ['Unsinn (invalid gitfile)', '.'],
    ['Unsinn (invalid gitfile)', 'docs/wap-planer'],
    ['gitdir: ins Leere', '.'],
    ['gitdir: ins Leere', 'docs/wap-planer'],
  ])(
    '[R-H-07] .git-Datei mit %s in docs/wap-planer/y, sauberer Inhalt, Scan von «%s» → Exit 1 (P39a Satz 3, P39c, TR-H0-70)',
    (art, arg) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      const inhalt = gitFehlerInhalte(sb).find(([a]) => a === art)?.[1] as string;
      writeText(root, 'docs/wap-planer/y/.git', inhalt);
      writeText(root, 'docs/wap-planer/y/p.md', 'Hptm Muster A\n');
      expect(scan(sb, root, [arg]).status).toBe(1);
    },
    60_000,
  );

  it.each(['Unsinn (invalid gitfile)', 'gitdir: ins Leere'])(
    '[R-H-07][R-H-08] .git-Datei mit %s ausserhalb der Pfadmenge (lib/y), sauberer Inhalt, Scan von «.» → Exit 1 (P39c, TR-H0-70)',
    (art) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      const inhalt = gitFehlerInhalte(sb).find(([a]) => a === art)?.[1] as string;
      writeText(root, 'lib/y/.git', inhalt);
      writeText(root, 'lib/y/p.md', 'Hptm Muster A\n');
      expect(scan(sb, root, ['.']).status).toBe(1);
    },
    60_000,
  );

  it.each(['.', 'docs/wap-planer/x'])(
    '[R-H-07] nicht leerer unechter .git-Ordner (HEAD und config mit Unsinn) in docs/wap-planer/x, Scan von «%s» → Befund, maskiert (P39a Satz 1, TR-H0-71)',
    (arg) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, 'docs/wap-planer/x/.git/HEAD', 'kein Verweis\n');
      writeText(root, 'docs/wap-planer/x/.git/config', 'kein Inhalt\n');
      writeText(root, 'docs/wap-planer/x/p.md', `Kontakt ${TELEFON}\n`);
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it(
    '[R-H-07] verknüpfter Worktree (gültige .git-Datei) unterhalb des Scan-Ordners ist bestätigte eigene Wurzel: Telefonnummer in seiner Pfadmenge → Befund, maskiert (P39a, TR-H0-72)',
    () => {
      const sb = createSandbox();
      const haupt = initRepo(sb, 'haupt');
      const wt = addWorktree(sb, haupt, join(haupt, 'ausser', 'wt'), 'wap/x');
      writeText(wt, 'docs/wap-planer/p.md', `Kontakt ${TELEFON}\n`);
      const r = scan(sb, haupt, ['.']);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
    },
    SLOW,
  );

  it('[R-H-07] Inhalt eines unechten .git-Ordners in der Tiefe wird ausgelassen (P24a, TR-H0-77)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, `docs/wap-planer/x/.git/${AHV}.md`, 'Harmlos\n');
    writeText(root, 'docs/wap-planer/x/.git/notiz.md', `Kontakt ${TELEFON}\n`);
    writeText(root, 'docs/wap-planer/x/p.md', 'Hptm Muster A\n');
    expect(scan(sb, root, ['.']).status).toBe(0);
  }, 60_000);
});

describe('privacy-scan: P19-Muster im vollen Pfad ausserhalb jedes Worktrees (P39b, TR-H0-73)', () => {
  const TELEFON = j('07', '9 483 26 15');

  it.each([
    ['Telefonnummer', 'Datei', TELEFON],
    ['Telefonnummer', 'Ordner src', TELEFON],
    ['AHV-Nummer', 'Datei', AHV],
    ['AHV-Nummer', 'Ordner src', AHV],
    ['E-Mail-Adresse', 'Datei', MAIL],
    ['E-Mail-Adresse', 'Ordner src', MAIL],
  ])(
    '[R-H-07] %s im Elternordner, sauberer Inhalt, Argument %s → Exit 1, maskiert (P39b)',
    (_label, form, muster) => {
      const sb = createSandbox();
      const skripte = initRepo(sb, 'skripte');
      const akte = join(sb.base, `Akte ${muster}`);
      writeText(akte, 'src/y.ts', 'Hptm Muster A\n');
      const fremd = join(sb.base, 'fremd');
      mkdirSync(fremd);
      const arg = form === 'Datei' ? join(akte, 'src', 'y.ts') : join(akte, 'src');
      const r = runScript(sb, skripte, 'privacy-scan.mjs', [arg], { cwd: fremd });
      expect(r.status).toBe(1);
      expectMasked(sb, r, muster);
    },
    60_000,
  );
});

describe('privacy-scan: oberste Ebene relativ zur Worktree-Wurzel (P24a, TR-H0-74)', () => {
  const TELEFON = j('07', '9 483 26 15');

  const FAELLE: Array<[string, string]> = [];
  for (const arg of ['docs', 'docs/wap-planer']) {
    for (const dir of ['spikes', 'coverage', 'dist', '.qa']) FAELLE.push([dir, arg]);
  }

  it.each(FAELLE)(
    '[R-H-07] docs/wap-planer/%s/p.md mit Telefonnummer, Scan von «%s» → Befund, maskiert (P24a)',
    (dir, arg) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, `docs/wap-planer/${dir}/p.md`, `Kontakt ${TELEFON}\n`);
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it('[R-H-07] echtes verschachteltes Repo: spikes/ auf seiner obersten Ebene wird ausgelassen → Exit 0; ein anderer Ordner dort ist ein Pfad-Befund (P24a)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    const innen = join(root, 'docs', 'wap-planer', 'z');
    mkdirSync(innen, { recursive: true });
    git(sb, innen, 'init', '-q');
    writeText(innen, `spikes/${AHV}.md`, 'Harmlos\n');
    expect(scan(sb, root, ['.']).status).toBe(0);
    writeText(innen, `sonst/${AHV}.md`, 'Harmlos\n');
    const r = scan(sb, root, ['.']);
    expect(r.status).toBe(1);
    expectMasked(sb, r, AHV);
  }, 60_000);
});

describe('privacy-scan: echter .git-Ordner mit git-Fehler, bestätigte und nicht bestätigte Wurzeln (P39a, P39c; TR-H0-78 bis -80)', () => {
  const TELEFON = j('07', '9 483 26 15');

  /** Echtes Repo (`git init`) in `rel`, danach so beschädigt, dass git mit einem Fehler endet. */
  function kaputtesRepo(sb: Sandbox, root: string, rel: string, variante: string): string {
    const dir = join(root, ...rel.split('/'));
    mkdirSync(dir, { recursive: true });
    git(sb, dir, 'init', '-q');
    if (variante === 'repositoryformatversion 99') {
      git(sb, dir, 'config', 'core.repositoryformatversion', '99');
    } else {
      const config = join(dir, '.git', 'config');
      writeFileSync(config, `${readFileSync(config, 'utf8')}[core\n`);
    }
    // Vorbedingung: git endet in diesem Ordner tatsächlich mit einem Fehler.
    const r = gitRaw(sb, dir, 'rev-parse', '--show-toplevel');
    expect(r.status, `git endet in ${rel} nicht mit Fehler`).not.toBe(0);
    return dir;
  }

  const FAELLE: Array<[string, string, string, string]> = [];
  for (const variante of ['repositoryformatversion 99', 'kaputte config-Zeile']) {
    for (const [rel, arg] of [
      ['docs/wap-planer/w', '.'],
      ['docs/wap-planer/w', 'docs/wap-planer'],
      ['lib/w', '.'],
    ]) {
      for (const inhalt of ['sauber', 'mit Telefonnummer'])
        FAELLE.push([variante, rel, arg, inhalt]);
    }
  }

  it.each(FAELLE)(
    '[R-H-07] echter .git-Ordner mit git-Fehler (%s) in %s, Scan von «%s», Inhalt %s → Exit 1 (P39a Satz 3, P39c, TR-H0-78)',
    (variante, rel, arg, inhalt) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      const dir = kaputtesRepo(sb, root, rel, variante);
      writeFileSync(
        join(dir, 'p.md'),
        inhalt === 'sauber' ? 'Hptm Muster A\n' : `Kontakt ${TELEFON}\n`,
      );
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      if (inhalt !== 'sauber') expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it(
    '[R-H-07][R-H-08] verknüpfter Worktree in docs/wap-planer/wt ist bestätigte Wurzel: Telefonnummer in wt/lib/p.md (ausserhalb seiner Pfadmenge) → Exit 0, «nicht geprüft» (P39a, P39c, TR-H0-79)',
    () => {
      const sb = createSandbox();
      const haupt = initRepo(sb, 'haupt');
      const wt = addWorktree(sb, haupt, join(haupt, 'docs', 'wap-planer', 'wt'), 'wap/x');
      writeText(wt, 'lib/p.md', `Kontakt ${TELEFON}\n`);
      const r = scan(sb, haupt, ['.']);
      expect(r.status).toBe(0);
      expect(r.out).toContain('nicht geprüft');
    },
    SLOW,
  );

  it.each(['docs/wap-planer/x', 'lib/x'])(
    '[R-H-07] unechter .git-Ordner (HEAD und config mit Unsinn) in %s, sauberer Inhalt, git antwortet ohne Fehler mit der äusseren Wurzel → Exit 0 (P39c, nicht bestätigt, TR-H0-80)',
    (rel) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, `${rel}/.git/HEAD`, 'kein Verweis\n');
      writeText(root, `${rel}/.git/config`, 'kein Inhalt\n');
      writeText(root, `${rel}/p.md`, 'Hptm Muster A\n');
      // Vorbedingung: git endet ohne Fehler und nennt die äussere Wurzel.
      const r0 = gitRaw(sb, join(root, ...rel.split('/')), 'rev-parse', '--show-toplevel');
      expect(r0.status).toBe(0);
      expect(scan(sb, root, ['.']).status).toBe(0);
    },
    60_000,
  );
});

describe('privacy-scan: vom äusseren Repo versionierte Dateien bleiben im äusseren Kontext (P39d, P39f, CR-H0S-38)', () => {
  const TELEFON = j('07', '9 483 26 15');
  const telefonZeilen = (out: string) =>
    out.split(/\r?\n/).filter((l) => /telefon/i.test(l)).length;

  /** Äusseres Repo versioniert `rel` mit dem gegebenen Inhalt (ohne Hook committet). */
  function aeusseresRepo(sb: Sandbox, inhalt: string, rel = 'docs/wap-planer/x/p.md'): string {
    const root = initRepo(sb, 'haupt');
    writeText(root, rel, inhalt);
    git(sb, root, 'add', rel);
    git(sb, root, 'commit', '-q', '-m', 'Datei versioniert');
    return root;
  }

  function innereGit(innen: string): Array<[string, (sb: Sandbox, root: string) => void]> {
    return [
      [
        'R1: .git-Datei mit gitdir auf das äussere .git',
        (_sb, root) => {
          const ziel = join(root, '.git').split(String.fromCharCode(92)).join('/');
          writeText(root, `${innen}/.git`, `gitdir: ${ziel}\n`);
        },
      ],
      [
        'R3: Junction .git auf das äussere .git',
        (_sb, root) => junction(join(root, ...innen.split('/'), '.git'), join(root, '.git')),
      ],
      ['R4: git init in x', (sb, root) => git(sb, join(root, ...innen.split('/')), 'init', '-q')],
    ];
  }

  const INNERE_GIT = innereGit('docs/wap-planer/x');
  const FAELLE: Array<[string, string]> = [];
  for (const [label] of INNERE_GIT) {
    for (const arg of ['.', 'docs/wap-planer', 'docs/wap-planer/x', 'docs/wap-planer/x/p.md']) {
      FAELLE.push([label, arg]);
    }
  }

  it.each(FAELLE)(
    '[R-H-07] %s, versionierte Datei mit Telefonnummer, Scan von «%s» → Befund mit Pfad relativ zur äusseren Wurzel, genau einmal, maskiert (P39d, P39f, TR-H0-81/82)',
    (label, arg) => {
      const sb = createSandbox();
      const root = aeusseresRepo(sb, `Kontakt ${TELEFON}\n`);
      // Referenzlauf ohne inneren .git: so viele Telefon-Meldungen wie für genau einen Befund.
      const referenz = scan(sb, root, [arg]);
      expect(referenz.status).toBe(1);
      const anlegen = INNERE_GIT.find(([l]) => l === label)?.[1] as (s: Sandbox, r: string) => void;
      anlegen(sb, root);
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      expect(r.out).toContain('docs/wap-planer/x/p.md');
      expect(r.out).toMatch(/telefon/i);
      expect(telefonZeilen(r.out)).toBe(telefonZeilen(referenz.out));
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each(FAELLE)(
    '[R-H-07] %s, versionierte Datei mit sauberem Inhalt, Scan von «%s» → Exit 0 (P39d, Gegenprobe, TR-H0-82 b)',
    (label, arg) => {
      const sb = createSandbox();
      const root = aeusseresRepo(sb, 'Hptm Muster A\n');
      const anlegen = INNERE_GIT.find(([l]) => l === label)?.[1] as (s: Sandbox, r: string) => void;
      anlegen(sb, root);
      expect(scan(sb, root, [arg]).status).toBe(0);
    },
    60_000,
  );

  it('[R-H-07] versionierte Datei nur im inneren Kontext in der Pfadmenge (lib/x/docs/wap-planer/p.md, git init in lib/x) → Exit 1, Befund genau einmal mit Pfad relativ zur äusseren Wurzel (P39f, TR-H0-83)', () => {
    const sb = createSandbox();
    // Referenz: ein Befund in einer einfachen Datei der Pfadmenge.
    const ref = initRepo(sb, 'referenz');
    writeText(ref, 'docs/wap-planer/p.md', `Kontakt ${TELEFON}\n`);
    const referenz = scan(sb, ref, ['.']);
    expect(referenz.status).toBe(1);
    const root = aeusseresRepo(sb, `Kontakt ${TELEFON}\n`, 'lib/x/docs/wap-planer/p.md');
    git(sb, join(root, 'lib', 'x'), 'init', '-q');
    const r = scan(sb, root, ['.']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('lib/x/docs/wap-planer/p.md');
    expect(telefonZeilen(r.out)).toBe(telefonZeilen(referenz.out));
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  /** Referenz: Anzahl Telefon-Meldungen für genau einen Befund in einer einfachen Datei der Pfadmenge. */
  function referenzEinBefund(sb: Sandbox): number {
    const ref = initRepo(sb, 'referenz');
    writeText(ref, 'docs/wap-planer/p.md', `Kontakt ${TELEFON}\n`);
    const r = scan(sb, ref, ['.']);
    expect(r.status).toBe(1);
    return telefonZeilen(r.out);
  }

  // TR-H0-92: nur im inneren Kontext in der Pfadmenge, R1/R3/R4 × Argumente.
  const INNEN_LIB = innereGit('lib/x');
  const FAELLE_LIB: Array<[string, string]> = [];
  for (const [label] of INNEN_LIB) {
    for (const arg of ['.', 'lib/x', 'lib/x/docs/wap-planer/p.md']) FAELLE_LIB.push([label, arg]);
  }

  it.each(FAELLE_LIB)(
    '[R-H-07] %s in lib/x, versionierte Datei lib/x/docs/wap-planer/p.md (nur innen in der Pfadmenge) mit Telefonnummer, Scan von «%s» → Exit 1, äusserer Pfad, genau ein Befund (P39f, TR-H0-92)',
    (label, arg) => {
      const sb = createSandbox();
      const einBefund = referenzEinBefund(sb);
      const root = aeusseresRepo(sb, `Kontakt ${TELEFON}\n`, 'lib/x/docs/wap-planer/p.md');
      const anlegen = INNEN_LIB.find(([l]) => l === label)?.[1] as (s: Sandbox, r: string) => void;
      anlegen(sb, root);
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      expect(r.out).toContain('lib/x/docs/wap-planer/p.md');
      expect(telefonZeilen(r.out)).toBe(einBefund);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each(FAELLE_LIB)(
    '[R-H-07] %s in lib/x, versionierte Datei lib/x/docs/wap-planer/p.md sauber, Scan von «%s» → Exit 0 (P39f, Gegenprobe, TR-H0-92)',
    (label, arg) => {
      const sb = createSandbox();
      const root = aeusseresRepo(sb, 'Hptm Muster A\n', 'lib/x/docs/wap-planer/p.md');
      const anlegen = INNEN_LIB.find(([l]) => l === label)?.[1] as (s: Sandbox, r: string) => void;
      anlegen(sb, root);
      expect(scan(sb, root, [arg]).status).toBe(0);
    },
    60_000,
  );

  // TR-H0-90: in beiden Kontexten in der Pfadmenge (Doppelmeldung möglich).
  const BEIDE = 'docs/wap-planer/x/docs/wap-planer/p.md';
  const FAELLE_BEIDE: Array<[string, string]> = [];
  for (const [label] of INNERE_GIT) {
    for (const arg of ['.', 'docs/wap-planer', 'docs/wap-planer/x', BEIDE])
      FAELLE_BEIDE.push([label, arg]);
  }

  it.each(FAELLE_BEIDE)(
    '[R-H-07] %s, versionierte Datei docs/wap-planer/x/docs/wap-planer/p.md (in beiden Kontexten in der Pfadmenge) mit Telefonnummer, Scan von «%s» → Exit 1, äusserer Pfad, genau ein Befund (P39f, TR-H0-90)',
    (label, arg) => {
      const sb = createSandbox();
      const root = aeusseresRepo(sb, `Kontakt ${TELEFON}\n`, BEIDE);
      // Referenzlauf ohne inneren .git: genau ein Befund im äusseren Kontext.
      const referenz = scan(sb, root, [arg]);
      expect(referenz.status).toBe(1);
      const anlegen = INNERE_GIT.find(([l]) => l === label)?.[1] as (s: Sandbox, r: string) => void;
      anlegen(sb, root);
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      expect(r.out).toContain(BEIDE);
      expect(telefonZeilen(r.out)).toBe(telefonZeilen(referenz.out));
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it('[R-H-07][R-H-08] bestätigte innere Wurzel (git init): nicht vom äusseren Repo versionierte Datei bleibt im inneren Kontext → Exit 0, «nicht geprüft» (P39d, Gegenprobe)', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'docs/wap-planer/x/p.md', 'Hptm Muster A\n');
    git(sb, root, 'add', 'docs/wap-planer/x/p.md');
    git(sb, root, 'commit', '-q', '-m', 'saubere Datei versioniert');
    git(sb, join(root, 'docs', 'wap-planer', 'x'), 'init', '-q');
    writeText(root, 'docs/wap-planer/x/tests/io.test.ts', `Kontakt ${TELEFON}\n`);
    const r = scan(sb, root, ['.']);
    expect(r.status).toBe(0);
    // TR-H0-89: auf die betroffene Datei bezogen.
    expect(r.out).not.toMatch(/telefon/i);
    expect(r.out).not.toContain('io.test.ts:');
  }, 60_000);

  /** Legt eine Variante des inneren .git an (R1/R3/R4) für den inneren Ordner `innen`. */
  function anlegenIn(sb: Sandbox, root: string, innen: string, label: string): void {
    const f = innereGit(innen).find(([l]) => l.startsWith(label.slice(0, 2)))?.[1] as (
      s: Sandbox,
      r: string,
    ) => void;
    f(sb, root);
  }
  const VARIANTEN = ['R1', 'R3', 'R4'];

  // TR-H0-93 / P39g: Ordner, die nur auf oberster Ebene der INNEREN Wurzel ausgelassen würden.
  const FAELLE_93: Array<[string, string, string]> = [];
  for (const ordner of ['dist', 'spikes', 'coverage', '.qa']) {
    for (const v of VARIANTEN) {
      for (const arg of [
        '.',
        'docs/wap-planer/x',
        `docs/wap-planer/x/${ordner}`,
        `docs/wap-planer/x/${ordner}/p.md`,
      ]) {
        FAELLE_93.push([ordner, v, arg]);
      }
    }
  }

  it.each(FAELLE_93)(
    '[R-H-07] versionierte Datei docs/wap-planer/x/%s/p.md mit Telefonnummer, innerer .git (%s) in docs/wap-planer/x, Scan von «%s» → Exit 1, äusserer Pfad, genau ein Befund (P39g, P24a, TR-H0-93)',
    (ordner, v, arg) => {
      const sb = createSandbox();
      const rel = `docs/wap-planer/x/${ordner}/p.md`;
      const root = aeusseresRepo(sb, `Kontakt ${TELEFON}\n`, rel);
      const referenz = scan(sb, root, [arg]);
      expect(referenz.status).toBe(1);
      anlegenIn(sb, root, 'docs/wap-planer/x', v);
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      expect(r.out).toContain(rel);
      expect(telefonZeilen(r.out)).toBe(telefonZeilen(referenz.out));
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  // Selbstprüfung (P24a): reference/ auf oberster Ebene der inneren Wurzel ist relativ zur äusseren
  // Wurzel nicht oberste Ebene → durchsucht. Nur Exit 1 und Maskierung, weil die Meldungsform bei
  // reference/ (P19 «Datei aus reference/») vom Kontext abhängen könnte.
  it.each(VARIANTEN)(
    '[R-H-07] versionierte Datei docs/wap-planer/x/reference/p.md mit Telefonnummer, innerer .git (%s), Scan von «.» → Exit 1, maskiert (P39g, P24a)',
    (v) => {
      const sb = createSandbox();
      const root = aeusseresRepo(sb, `Kontakt ${TELEFON}\n`, 'docs/wap-planer/x/reference/p.md');
      anlegenIn(sb, root, 'docs/wap-planer/x', v);
      const r = scan(sb, root, ['.']);
      expect(r.status).toBe(1);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  // Selbstprüfung (P24a): node_modules wird auf jeder Tiefe ausgelassen, auch für versionierte Dateien.
  it.each(VARIANTEN)(
    '[R-H-07] versionierte Datei docs/wap-planer/x/node_modules/p.md mit Telefonnummer, innerer .git (%s), Scan von «.» → ausgelassen, Exit 0 (P39g, P24a, Gegenprobe)',
    (v) => {
      const sb = createSandbox();
      const root = aeusseresRepo(sb, `Kontakt ${TELEFON}\n`, 'docs/wap-planer/x/node_modules/p.md');
      anlegenIn(sb, root, 'docs/wap-planer/x', v);
      expect(scan(sb, root, ['.']).status).toBe(0);
    },
    60_000,
  );

  // TR-H0-94 / P39g: P19-Muster im Namen der inneren Wurzel (am äusseren Pfad geprüft).
  // TR-H0-98: Testnamen enthalten nur den Platzhalter «<Tel>»; die Nummer entsteht im Testkörper.
  const PLATZHALTER = '<Tel>';
  const FAELLE_94: Array<[string, string, string]> = [];
  for (const v of VARIANTEN) {
    const innen = `docs/wap-planer/Kontakt ${PLATZHALTER}`;
    for (const arg of ['.', innen, `${innen}/p.md`]) FAELLE_94.push([v, innen, arg]);
    FAELLE_94.push([v, `lib/Kontakt ${PLATZHALTER}`, '.']);
  }

  it.each(FAELLE_94)(
    '[R-H-07] innerer .git (%s) in «%s» (Telefonnummer im Ordnernamen), versionierte saubere p.md, Scan von «%s» → Exit 1, Pfadbefund, maskiert (P39g, P19, TR-H0-94)',
    (v, innenPlatzhalter, argPlatzhalter) => {
      const innen = innenPlatzhalter.replace(PLATZHALTER, TELEFON);
      const arg = argPlatzhalter.replace(PLATZHALTER, TELEFON);
      const sb = createSandbox();
      const root = aeusseresRepo(sb, 'Hptm Muster A\n', `${innen}/p.md`);
      anlegenIn(sb, root, innen, v);
      const r = scan(sb, root, [arg]);
      expect(r.status).toBe(1);
      expect(r.out).toContain('Pfad');
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each(VARIANTEN)(
    '[R-H-07] innerer .git (%s) in «docs/wap-planer/Akte Muster» ohne Muster im Namen, versionierte saubere p.md, Scan von «.» → Exit 0 (P39g, Gegenprobe, TR-H0-94)',
    (v) => {
      const sb = createSandbox();
      const innen = 'docs/wap-planer/Akte Muster';
      const root = aeusseresRepo(sb, 'Hptm Muster A\n', `${innen}/p.md`);
      anlegenIn(sb, root, innen, v);
      expect(scan(sb, root, ['.']).status).toBe(0);
    },
    60_000,
  );

  // Selbstprüfung (P19 mit Sperrliste): Sperrlisten-Name im Namen der inneren Wurzel.
  it.each(VARIANTEN)(
    '[R-H-07] innerer .git (%s) in «lib/Akte Zwirbelmann», versionierte saubere p.md, Scan von «.» → Exit 1, Name maskiert (P39g, P19)',
    (v) => {
      const sb = createSandbox();
      const innen = 'lib/Akte Zwirbelmann';
      const root = aeusseresRepo(sb, 'Hptm Muster A\n', `${innen}/p.md`);
      anlegenIn(sb, root, innen, v);
      const r = scan(sb, root, ['.']);
      expect(r.status).toBe(1);
      expectMasked(sb, r, 'Zwirbelmann');
    },
    60_000,
  );

  // TR-H0-95 / P39g: äusseres Repo über die Eltern der inneren Wurzel, nicht über das Arbeitsverzeichnis.
  const FAELLE_95: Array<[string, string, string, string]> = [];
  for (const v of VARIANTEN) {
    for (const trenner of ['\\', '/']) {
      FAELLE_95.push([v, 'lib/x', 'lib/x', trenner]);
      FAELLE_95.push([v, 'lib/x', 'lib/x/docs/wap-planer/p.md', trenner]);
      FAELLE_95.push([v, 'docs/wap-planer/x', 'docs/wap-planer/x', trenner]);
      FAELLE_95.push([v, 'docs/wap-planer/x', 'docs/wap-planer/x/p.md', trenner]);
    }
  }

  it.each(FAELLE_95)(
    '[R-H-07] innerer .git (%s) in %s, Aufruf aus Nicht-Git-Ordner mit absolutem Argument %s (Trenner %s) → Exit 1, äusserer Pfad, genau ein Befund (P39g, TR-H0-95)',
    (v, innen, arg, trenner) => {
      const sb = createSandbox();
      const einBefund = referenzEinBefund(sb);
      const rel = innen === 'lib/x' ? 'lib/x/docs/wap-planer/p.md' : 'docs/wap-planer/x/p.md';
      const root = aeusseresRepo(sb, `Kontakt ${TELEFON}\n`, rel);
      anlegenIn(sb, root, innen, v);
      const fremd = join(sb.base, 'fremd');
      mkdirSync(fremd);
      const BS = String.fromCharCode(92);
      const absolut = join(root, ...arg.split('/'));
      const argument = trenner === '/' ? absolut.split(BS).join('/') : absolut.split('/').join(BS);
      const r = runScript(sb, root, 'privacy-scan.mjs', [argument], { cwd: fremd });
      expect(r.status).toBe(1);
      expect(r.out).toContain(rel);
      expect(telefonZeilen(r.out)).toBe(einBefund);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );
});

describe('privacy-scan: Wurzelsuche ohne GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR des Aufrufers (P39e, CR-H0S-39)', () => {
  const TELEFON = j('07', '9 483 26 15');

  const VARIABLEN: Array<[string, (root: string, anderes: string) => NodeJS.ProcessEnv]> = [
    ['GIT_DIR=<Repo>/.git', (root) => ({ GIT_DIR: join(root, '.git') })],
    [
      'GIT_WORK_TREE=<Repo>/docs/wap-planer',
      (root) => ({ GIT_WORK_TREE: join(root, 'docs', 'wap-planer') }),
    ],
    [
      'GIT_COMMON_DIR=<anderes Repo>/.git',
      (_root, anderes) => ({ GIT_COMMON_DIR: join(anderes, '.git') }),
    ],
  ];

  const FAELLE: Array<[string, string, string]> = [];
  for (const [variable] of VARIABLEN) {
    FAELLE.push([variable, 'Ordner docs/wap-planer (R6a)', 'docs/wap-planer']);
    FAELLE.push([variable, 'Datei docs/wap-planer/p.md (R6b)', 'docs/wap-planer/p.md']);
  }

  function env(sb: Sandbox, variable: string, root: string, anderes: string): NodeJS.ProcessEnv {
    const zusatz = VARIABLEN.find(([v]) => v === variable)?.[1] as (
      r: string,
      a: string,
    ) => NodeJS.ProcessEnv;
    return { ...sb.env, ...zusatz(root, anderes) };
  }

  it.each(FAELLE)(
    '[R-H-07] %s gesetzt, Scan %s mit Telefonnummer → Exit 1 und Befund wie ohne Variable (P39e, TR-H0-84 a)',
    (variable, _label, arg) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      const anderes = initRepo(sb, 'anderes');
      writeText(root, 'docs/wap-planer/p.md', `Kontakt ${TELEFON}\n`);
      const ohne = scan(sb, root, [arg]);
      expect(ohne.status).toBe(1);
      const mit = scan(sb, root, [arg], env(sb, variable, root, anderes));
      expect(mit.status).toBe(1);
      expect(mit.out).toContain('docs/wap-planer/p.md');
      expect(mit.out).toMatch(/telefon/i);
      expectMasked(sb, mit, TELEFON);
    },
    60_000,
  );

  it.each(FAELLE)(
    '[R-H-07] %s gesetzt, Scan %s mit sauberem Inhalt → Exit 0 wie ohne Variable (P39e, Gegenprobe, TR-H0-84 b)',
    (variable, _label, arg) => {
      const sb = createSandbox();
      const root = initRepo(sb, 'haupt');
      const anderes = initRepo(sb, 'anderes');
      writeText(root, 'docs/wap-planer/p.md', 'Hptm Muster A\n');
      expect(scan(sb, root, [arg]).status).toBe(0);
      expect(scan(sb, root, [arg], env(sb, variable, root, anderes)).status).toBe(0);
    },
    60_000,
  );
});
