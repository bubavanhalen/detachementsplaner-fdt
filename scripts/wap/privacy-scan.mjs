// Datenschutz-Scan (Paket H0, R-H-07).
// Vertrag: docs/wap-planer/pakete/H0.md, Klausel 5, P8, P18, P19, P20, P22, P24, P29, P30, P32,
// P35/P40 (WAP-Pfadmenge), P36/P41 (Positivliste <Name>@<pfad>), P39 (Wurzel je Pfad).
// Aufruf: node scripts/wap/privacy-scan.mjs (--staged | <pfad>…)
// Treffer werden nur maskiert gemeldet (Art, Datei, Zeile); nie der gefundene Wert. Enthält ein
// Pfad selbst ein Muster oder einen Namen, erscheint er nur als «(Pfad maskiert)» (P19).
// Inhaltsmuster werden in einem Worktree nur in Dateien der WAP-Pfadmenge (relativ zur Wurzel
// dieses Worktrees) geprüft; die übrigen werden als «nicht geprüft» gezählt. Dateien in keinem
// Worktree werden voll geprüft. Pfadmuster und reference/ gelten für alle Pfade (P35, P39).
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  baumEintraege,
  bereinigeGitUmgebung,
  blobGroessen,
  blobInhalte,
  fehler,
  info,
  loeseRef,
  objektWurzel,
  realPath,
  relInside,
  runGit,
  worktreeOf,
} from './lib/common.mjs';
import {
  ANTHROPIC_TRAILER,
  EMAIL,
  escapePfad,
  funde,
  istWapPfad,
  ladeSperrliste,
  namensSchluessel,
  PFAD_MASKIERT,
  zeigePfad,
} from './lib/muster.mjs';

/** Beim rekursiven Durchsuchen auf jeder Tiefe ausgelassen (P24a). */
const UEBERALL_AUSGELASSEN = new Set(['.git', 'node_modules']);
/** Nur auf der obersten Ebene der jeweiligen Worktree-Wurzel ausgelassen (P24, P24a). */
const OBEN_AUSGELASSEN = new Set(['dist', 'coverage', 'spikes', '.qa', 'reference']);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REFERENZ_ANZEIGE = 'Datei aus reference/ (Name maskiert)';
/** Blobs über dieser Grösse in der Pfadmenge gelten als nicht prüfbar (P44l, fail-closed). */
const GROESSTER_BLOB = 64 * 1024 * 1024;
/** Die Positivliste selbst (P36a). */
const POSITIVLISTE_REL = 'scripts/wap/privacy-allow.txt';

class Abbruch extends Error {}

/**
 * @typedef {import('./lib/muster.mjs').Name} Name
 * @typedef {import('./lib/muster.mjs').Optionen} Optionen
 * @typedef {{ datei: string, zeile: number, art: string, maske: string }} Treffer
 * @typedef {{ emails: Set<string>, namenProPfad: Map<string, Set<string>> }} Positivliste
 * @typedef {{ rel: string | null, pfad: string, roh: string, innenRel?: string, vorsatz?: string }} Ort
 *   vorsatz: Commit-Kürzel vor der Anzeige (--commits, P44 e);
 *   rel: Pfad relativ zur massgebenden Wurzel (null = in keinem Worktree, P39); für eine vom
 *   äusseren Repo versionierte Datei die äussere Wurzel (P39d, P39g); pfad: geprüfter Pfadtext
 *   (P19); roh: Anzeige, sofern nicht maskiert; innenRel: zusätzlich geltender Pfad relativ zur
 *   bestätigten inneren Wurzel (P39f)
 */

/**
 * Namenseintrag `<Name>@<pfad>` (P41, P41a): nach Trimmen genau ein `@`, unmittelbar davor und
 * danach kein Leerraum (Leerraum innerhalb des Namens erlaubt), der Pfad ein einziges Token ohne
 * Leerraum und ohne `@` mit mindestens einem `/`.
 */
const NAMENSEINTRAG = /^([^@\s](?:[^@]*[^@\s])?)@([^@\s]*\/[^@\s]*)$/;

/** Freigegebene E-Mail-Adresse: die ganze Zeile ist genau eine Adresse (feste Zeichenkette). */
const EMAILEINTRAG = new RegExp(`^${EMAIL.source.replace(/^\(\?<!\[[^\]]*\]\)/, '')}$`);

/**
 * Zerlegt eine Zeile der Positivliste (P36, P36a–c, P41, P41a). Nur die exakte Form
 * `<Name>@<pfad>` gibt einen Sperrlisten-Namen für genau diese Datei frei; nur eine Zeile, die
 * genau eine E-Mail-Adresse ist, gibt diese Adresse frei. Jede andere Zeile gibt nichts frei und
 * wird beim Selbst-Scan voll geprüft.
 * @param {string} zeile
 * @returns {{ art: 'name', name: string, pfad: string } | { art: 'email', adresse: string } | null}
 */
function positivEintrag(zeile) {
  const z = zeile.trim();
  if (z === '' || z.startsWith('#')) return null;
  const name = NAMENSEINTRAG.exec(z);
  if (name !== null) return { art: 'name', name: name[1], pfad: name[2] };
  if (EMAILEINTRAG.test(z)) return { art: 'email', adresse: z.toLowerCase() };
  return null;
}

/**
 * Positivliste `scripts/wap/privacy-allow.txt` neben diesem Skript (Klausel 5, P36).
 * @returns {Positivliste}
 */
function ladePositivliste() {
  const emails = new Set([ANTHROPIC_TRAILER]);
  /** @type {Map<string, Set<string>>} */
  const namenProPfad = new Map();
  const datei = join(SCRIPT_DIR, 'privacy-allow.txt');
  if (existsSync(datei)) {
    const text = readFileSync(datei, 'utf8').replace(/^\uFEFF/, '');
    for (const zeile of text.split(/\r?\n/)) {
      const e = positivEintrag(zeile);
      if (e === null) continue;
      if (e.art === 'email') {
        emails.add(e.adresse);
        continue;
      }
      const pfad = e.pfad.toLowerCase();
      const set = namenProPfad.get(pfad) ?? new Set();
      set.add(namensSchluessel(e.name));
      namenProPfad.set(pfad, set);
    }
  }
  return { emails, namenProPfad };
}

/**
 * Text einer Datei: UTF-16 mit BOM (P18), sonst UTF-8; null bei Binärdateien.
 * @param {Buffer} bytes
 * @returns {string | null}
 */
function dekodiere(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le');
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const le = Buffer.from(bytes.subarray(2, 2 + ((bytes.length - 2) & ~1)));
    le.swap16();
    return le.toString('utf16le');
  }
  if (bytes.subarray(0, 8000).includes(0)) return null;
  const text = bytes.toString('utf8');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Prüft Pfade und Inhalte und sammelt Treffer. */
class Scanner {
  /**
   * @param {Name[]} namen
   * @param {Positivliste} positiv
   */
  constructor(namen, positiv) {
    this.namen = namen;
    this.positiv = positiv;
    /** @type {Treffer[]} */
    this.treffer = [];
    this.dateien = 0;
    this.nichtGeprueft = 0;
  }

  /**
   * Funde in einem Pfad (für alle Pfade, P19/P35).
   * @param {Ort} ort
   */
  pfadFunde(ort) {
    return funde(ort.pfad.normalize('NFC'), this.namen, this.positiv.emails);
  }

  /**
   * Anzeige eines Pfads: reference/ und Pfade mit Mustern oder Namen nur maskiert (P19).
   * @param {Ort} ort
   */
  anzeige(ort) {
    let text = ort.roh;
    if (istReferenz(ort)) text = REFERENZ_ANZEIGE;
    else if (this.pfadFunde(ort).length > 0) text = PFAD_MASKIERT;
    // P44 e: bei --commits steht das Commit-Kürzel vor dem (maskierten) Pfad.
    return ort.vorsatz === undefined ? text : `${ort.vorsatz}:${text}`;
  }

  /**
   * Prüft den Pfad; liefert false, wenn der Inhalt nicht mehr gescannt werden muss (reference/).
   * @param {Ort} ort
   */
  pruefePfad(ort) {
    const vorsatz = ort.vorsatz === undefined ? '' : `${ort.vorsatz}:`;
    if (istReferenz(ort)) {
      this.treffer.push({
        datei: `${vorsatz}${REFERENZ_ANZEIGE}`,
        zeile: 0,
        art: 'gesperrter Ordner',
        maske: '',
      });
      return false;
    }
    for (const f of this.pfadFunde(ort)) {
      this.treffer.push({
        datei: `${vorsatz}${PFAD_MASKIERT}`,
        zeile: 0,
        art: `Pfad enthält ${f.art}`,
        maske: f.maske,
      });
    }
    return true;
  }

  /**
   * Prüft eine Datei. Liegt sie in einem Worktree, gilt die WAP-Pfadmenge relativ zu dessen Wurzel
   * (P35, P39); liegt sie in keinem Worktree, wird sie voll geprüft (P39).
   * @param {Ort} ort
   * @param {Buffer} bytes
   */
  pruefeDatei(ort, bytes) {
    this.dateien++;
    if (!this.pruefePfad(ort)) return;
    const rel = ort.rel;
    const inPfadmenge =
      rel === null || istWapPfad(rel) || (ort.innenRel !== undefined && istWapPfad(ort.innenRel));
    if (!inPfadmenge) {
      // P35: ausserhalb der WAP-Pfadmenge (in keinem der Kontexte, P39f) nur Pfad geprüft.
      this.nichtGeprueft++;
      return;
    }
    const text = dekodiere(bytes);
    if (text === null) return;
    const anzeige = this.anzeige(ort);
    const zeilen = text.split(/\r?\n/);
    const istPositivliste = rel !== null && rel.toLowerCase() === POSITIVLISTE_REL;
    /** @type {Set<string>} */
    const eigeneNamen = new Set();
    const emails = new Set(this.positiv.emails);
    if (istPositivliste) {
      // P36a, P36c: die Positivliste nutzt beim eigenen Scan ihre eigenen Einträge.
      for (const zeile of zeilen) {
        const e = positivEintrag(zeile.normalize('NFC'));
        if (e?.art === 'name') eigeneNamen.add(namensSchluessel(e.name));
        if (e?.art === 'email') emails.add(e.adresse);
      }
    }
    const fuerDatei = rel === null ? undefined : this.positiv.namenProPfad.get(rel.toLowerCase());
    zeilen.forEach((roh, i) => {
      const zeile = roh.normalize('NFC');
      /** @type {Optionen} */
      let optionen = { erlaubteNamen: fuerDatei };
      if (istPositivliste) {
        // Namen nur innerhalb einer gültigen <Name>@<pfad>-Zeile erlaubt, und nur die linken Teile
        // der eigenen Einträge; diese Zeilen sind kein E-Mail-Befund (P36a, P36b).
        optionen =
          positivEintrag(zeile)?.art === 'name'
            ? { erlaubteNamen: eigeneNamen, ohneEmail: true }
            : {};
      }
      for (const f of funde(zeile, this.namen, emails, optionen)) {
        this.treffer.push({ datei: anzeige, zeile: i + 1, art: f.art, maske: f.maske });
      }
    });
  }

  /**
   * P39a, P39c: git endet für einen Ordner mit einem Fehler – Befund, nie still (je Ordner einmal).
   * @param {Ort} ort
   */
  gitFehler(ort) {
    const datei = this.anzeige(ort);
    const art = 'git-Fehler: Worktree-Wurzel nicht bestimmbar (.git prüfen)';
    if (this.treffer.some((t) => t.datei === datei && t.art === art && t.zeile === 0)) return;
    this.treffer.push({ datei, zeile: 0, art, maske: '' });
  }

  /** @param {Ort} ort */
  verknuepfung(ort) {
    this.treffer.push({
      datei: this.anzeige(ort),
      zeile: 0,
      art: 'übersprungen: Verknüpfung (Symlink oder Junction wird nicht verfolgt)',
      maske: '',
    });
  }
}

/**
 * `reference/` auf oberster Ebene des eigenen Worktrees (Klausel 5, P24, P39).
 * @param {Ort} ort
 */
function istReferenz(ort) {
  // P39h: oberste Ebene relativ zu einer der bestimmten Wurzeln (auch der inneren).
  const oben = /^reference(\/|$)/i;
  return (
    (ort.rel !== null && oben.test(ort.rel)) ||
    (ort.innenRel !== undefined && oben.test(ort.innenRel))
  );
}

/**
 * Ort einer Datei relativ zu ihrem Worktree.
 * @param {string} rel
 * @returns {Ort}
 */
function imWorktree(rel) {
  return { rel, pfad: rel, roh: escapePfad(rel) };
}

/** @param {Scanner} scanner */
function scanStaged(scanner) {
  const wt = worktreeOf(process.cwd());
  if (wt.kind !== 'ok') {
    throw new Abbruch('--staged verlangt ein git-Worktree als aktuelles Verzeichnis.');
  }
  const root = wt.root;
  // P44g: Gitlinks nie ausblenden (.gitmodules «ignore», diff.ignoreSubmodules, submodule.*.ignore).
  const liste = runGit(
    [
      'diff',
      '--cached',
      '--raw',
      '-z',
      '--no-abbrev',
      '--no-renames',
      '--ignore-submodules=none',
      '--diff-filter=ACMRT',
    ],
    { cwd: root },
  );
  if (liste.status !== 0) {
    throw new Abbruch('Gestagte Dateien nicht lesbar (git diff --cached scheiterte).');
  }
  pruefeObjekte(scanner, root, rohEintraege(liste.stdout));
}

/**
 * Einträge aus dem Rohformat `-z` von diff/diff-tree («:<mode alt> <mode neu> <oid alt> <oid neu>
 * <status>», danach der Pfad).
 * @param {string} ausgabe
 * @returns {Array<{ mode: string, oid: string, pfad: string }>}
 */
function rohEintraege(ausgabe) {
  /** @type {Array<{ mode: string, oid: string, pfad: string }>} */
  const out = [];
  const teile = ausgabe.split('\0');
  for (let i = 0; i + 1 < teile.length; i += 2) {
    const meta = teile[i];
    if (!meta.startsWith(':')) break;
    const [, mode, , oid] = meta.slice(1).split(' ');
    out.push({ mode, oid, pfad: teile[i + 1] });
  }
  return out;
}

/**
 * Pfad-Modus (P39, P39a–g, P24a): Für jeden übergebenen Pfad wird die Wurzel seines eigenen
 * Worktrees bestimmt; Pfadmenge, reference/-Regel und Ausschlüsse gelten relativ zu dieser Wurzel.
 * Ein Unterordner mit `.git` ist beim Durchsuchen nur dann eine eigene Wurzel, wenn git genau diesen
 * Ordner als Wurzel bestätigt; endet git mit einem Fehler, ist das ein Befund (Exit 1).
 * Versioniert das äussere Repo (bestimmt über die Eltern der inneren Wurzel) eine Datei unter
 * einer bestätigten inneren Wurzel, gilt für sie der äussere Kontext vollständig und vorrangig
 * (P19, Ausschlüsse, Anzeige); die innere Pfadmenge wirkt nur zusätzlich (P39d, P39f, P39g).
 * Ein Pfad in keinem Worktree wird voll geprüft; P19 gilt dann für den vollen absoluten Pfad (P39b).
 * @param {Scanner} scanner
 * @param {string[]} args
 */
function scanPfade(scanner, args) {
  const cwd = process.cwd();

  /**
   * @typedef {{ root: string, versioniert: Set<string> }} Aussen
   *   root: äussere Wurzel; versioniert: von ihr versionierte Pfade (relativ, klein)
   * @typedef {{ root: string | null, aussen: Aussen | null, nurVersioniert: boolean }} Kontext
   *   root: Worktree-Wurzel oder null (in keinem Worktree); aussen: äusseres Repo einer bestätigten
   *   inneren Wurzel; nurVersioniert: Ordner, der nur wegen äusserer Versionierung durchsucht wird
   */

  /**
   * @param {string} abs
   * @param {Kontext} k
   * @returns {Ort}
   */
  const ortVon = (abs, k) => {
    const voll = abs.split('\\').join('/');
    if (k.aussen !== null) {
      const relA = relInside(k.aussen.root, abs);
      if (relA !== null && k.aussen.versioniert.has(relA.toLowerCase())) {
        // P39d, P39g: äusserer Kontext vorrangig; innere Pfadmenge nur zusätzlich (P39f).
        const innen = k.root === null ? null : relInside(k.root, abs);
        return { rel: relA, pfad: relA, roh: escapePfad(relA), innenRel: innen ?? undefined };
      }
    }
    if (k.root !== null) {
      const rel = relInside(k.root, abs);
      if (rel !== null) return imWorktree(rel);
    }
    // P39b: ausserhalb jedes Worktrees gilt P19 für den vollen absoluten Pfad.
    return { rel: null, pfad: voll, roh: escapePfad(voll) };
  };

  /**
   * Vom Repo `aussenRoot` versionierte Pfade unterhalb von `abs` (P39d), relativ, klein.
   * @param {string} aussenRoot
   * @param {string} abs
   * @param {Kontext} k Kontext für die Anzeige eines git-Fehlers
   */
  const versioniertUnter = (aussenRoot, abs, k) => {
    /** @type {Set<string>} */
    const out = new Set();
    const rel = relInside(aussenRoot, abs);
    if (rel === null) return out;
    const r = runGit(['-C', aussenRoot, 'ls-files', '-z', '--', `:(literal)${rel}`], {
      eigeneWurzel: true,
    });
    if (r.status !== 0) {
      scanner.gitFehler(ortVon(abs, k));
      return out;
    }
    for (const p of r.stdout.split('\0')) if (p !== '') out.add(p.toLowerCase());
    return out;
  };

  /**
   * Kontext einer bestätigten inneren Wurzel mit ihrem äusseren Repo (P39d, P39g).
   * @param {string} innenRoot
   * @param {string | null} aussenRoot
   * @param {Kontext} k
   * @returns {Kontext}
   */
  const innererKontext = (innenRoot, aussenRoot, k) => {
    if (aussenRoot === null) return { root: innenRoot, aussen: null, nurVersioniert: false };
    const versioniert = versioniertUnter(aussenRoot, innenRoot, k);
    return {
      root: innenRoot,
      aussen: versioniert.size > 0 ? { root: aussenRoot, versioniert } : null,
      nurVersioniert: false,
    };
  };

  /**
   * P39a, P39c: Kontext für einen Unterordner mit `.git`.
   * @param {string} abs
   * @param {Kontext} k
   * @returns {Kontext}
   */
  const kontextFuer = (abs, k) => {
    if (k.root !== null && gleicherPfad(abs, k.root)) return k;
    if (!existsSync(join(abs, '.git'))) return k;
    const wt = worktreeOf(abs);
    if (wt.kind === 'ok') {
      if (!gleicherPfad(wt.root, abs)) return k;
      // Das äussere Repo ist das des umgebenden Kontexts (Eltern der inneren Wurzel, P39g).
      return innererKontext(wt.root, k.aussen?.root ?? k.root, k);
    }
    if (wt.kind === 'fehler') {
      scanner.gitFehler(ortVon(abs, k));
    }
    // Nicht bestätigt (oder Fehler): Dateien bleiben im äusseren Kontext.
    return k;
  };

  /**
   * Liegt unter `kind` eine vom äusseren Repo versionierte Datei?
   * @param {Aussen} aussen
   * @param {string} kind
   */
  const hatVersionierte = (aussen, kind) => {
    const relA = relInside(aussen.root, kind);
    if (relA === null) return false;
    const praefix = `${relA.toLowerCase()}/`;
    for (const p of aussen.versioniert) if (p.startsWith(praefix)) return true;
    return false;
  };

  /**
   * @param {string} abs nativ aufgelöster Pfad
   * @param {Kontext} k
   */
  const besuche = (abs, k) => {
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) {
      scanner.verknuepfung(ortVon(abs, k));
      return;
    }
    if (st.isDirectory()) {
      const kontext = kontextFuer(abs, k);
      for (const name of readdirSync(abs)) {
        if (UEBERALL_AUSGELASSEN.has(name)) continue;
        const kind = join(abs, name);
        if (
          kontext.root !== null &&
          OBEN_AUSGELASSEN.has(name.toLowerCase()) &&
          relInside(kontext.root, kind)?.toLowerCase() === name.toLowerCase()
        ) {
          // P39g: oberste Ebene nur der inneren Wurzel – versionierte Dateien darunter prüfen.
          if (kontext.aussen !== null && hatVersionierte(kontext.aussen, kind)) {
            besuche(kind, { ...kontext, nurVersioniert: true });
          }
          continue;
        }
        besuche(kind, kontext);
      }
      return;
    }
    if (st.isFile()) {
      const ort = ortVon(abs, k);
      // In einem nur für versionierte Dateien durchsuchten Ordner bleiben die übrigen ausgelassen.
      if (k.nurVersioniert && ort.innenRel === undefined && k.aussen !== null) {
        const relA = relInside(k.aussen.root, abs);
        if (relA === null || !k.aussen.versioniert.has(relA.toLowerCase())) return;
      }
      scanner.pruefeDatei(ort, readFileSync(abs));
    }
  };

  for (const arg of args) {
    const roh = resolve(cwd, arg);
    if (!existsSync(roh) && !isLink(roh)) {
      const voll = roh.split('\\').join('/');
      const ort = { rel: null, pfad: voll, roh: escapePfad(arg.split('\\').join('/')) };
      throw new Abbruch(`Pfad ${scanner.anzeige(ort)} existiert nicht; Pfad prüfen.`);
    }
    const istOrdner = !isLink(roh) && lstatSync(roh).isDirectory();
    const abs = isLink(roh) ? join(realPath(dirname(roh)), basename(roh)) : realPath(roh);
    const startDir = istOrdner ? abs : dirname(abs);
    const wt = worktreeOf(startDir);
    /** @type {Kontext} */
    let k = { root: wt.kind === 'ok' ? wt.root : null, aussen: null, nurVersioniert: false };
    if (wt.kind === 'fehler') {
      // P39a/P39c: git kann die Wurzel nicht bestimmen → Befund; Inhalt wird voll geprüft.
      scanner.gitFehler(ortVon(startDir, k));
    }
    if (wt.kind === 'ok') {
      // P39g: äusseres Repo über die Eltern der Wurzel (nicht über das Arbeitsverzeichnis).
      const eltern = dirname(wt.root);
      if (!gleicherPfad(eltern, wt.root)) {
        const aw = worktreeOf(eltern);
        if (aw.kind === 'ok') k = innererKontext(wt.root, aw.root, k);
        else if (aw.kind === 'fehler') scanner.gitFehler(ortVon(eltern, k));
      }
    }
    const ort = ortVon(abs, k);
    if (istReferenz(ort)) {
      scanner.pruefePfad(ort);
      continue;
    }
    besuche(abs, k);
  }
}

/**
 * Gleicher Pfad ohne Beachtung von Gross/Klein und Trennzeichen (Windows).
 * @param {string} a
 * @param {string} b
 */
function gleicherPfad(a, b) {
  return relative(a, b) === '';
}

/** @param {string} abs */
function isLink(abs) {
  try {
    return lstatSync(abs).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Kürzel eines Commits in der Ausgabe von --commits (P44 e). */
const KUERZEL_LAENGE = 12;

/**
 * Prüft Paare aus Pfad und Blob aus git-Objekten (P44 b, c). Gitlinks (160000) sind ein Befund
 * «Untermodul nicht prüfbar»; Symlinks (120000) werden als Text ihres Ziels geprüft.
 * @param {Scanner} scanner
 * @param {string} root
 * @param {Array<{ mode: string, oid: string, pfad: string, commit?: string }>} paare
 */
function pruefeObjekte(scanner, root, paare) {
  // P44l: Inhalte nur für Dateien der Pfadmenge laden; ausserhalb genügen Pfad und Zählung.
  const innen = paare.filter((p) => p.mode !== '160000' && istWapPfad(p.pfad));
  const groessen = blobGroessen(
    root,
    innen.map((p) => p.oid),
  );
  if (groessen === null) throw new Abbruch('Objekte nicht lesbar (git cat-file --batch-check).');
  const ladbar = innen.filter((p) => (groessen.get(p.oid) ?? 0) <= GROESSTER_BLOB);
  const inhalte = blobInhalte(
    root,
    ladbar.map((p) => p.oid),
  );
  if (inhalte === null) throw new Abbruch('Objekte nicht lesbar (git cat-file scheiterte).');
  for (const p of paare) {
    /** @type {Ort} */
    const ort = { rel: p.pfad, pfad: p.pfad, roh: escapePfad(p.pfad) };
    if (p.commit !== undefined) ort.vorsatz = p.commit.slice(0, KUERZEL_LAENGE);
    if (p.mode === '160000') {
      // P44 c, P44g: Gitlink nicht prüfbar; P19 gilt trotzdem für seinen Pfad.
      nichtPruefbar(scanner, ort, 'Untermodul nicht prüfbar (Gitlink 160000)');
      continue;
    }
    if (!istWapPfad(p.pfad)) {
      // P35, P44l: ausserhalb der Pfadmenge nur Pfad (P19, reference/) und Zählung.
      scanner.dateien++;
      if (scanner.pruefePfad(ort)) scanner.nichtGeprueft++;
      continue;
    }
    if ((groessen.get(p.oid) ?? 0) > GROESSTER_BLOB) {
      // P44l: in der Pfadmenge nie still bestehen; zu grosse Blobs sind nicht prüfbar.
      nichtPruefbar(scanner, ort, 'Blob zu gross, nicht prüfbar (über 64 MiB)');
      continue;
    }
    const bytes = inhalte.get(p.oid);
    if (bytes === undefined) throw new Abbruch('Objekt fehlt in der Objektdatenbank.');
    if (istLfsZeiger(bytes)) {
      // P44k: Inhalt liegt nicht in git-Objekten – nicht prüfbar.
      nichtPruefbar(scanner, ort, 'Git-LFS-Zeiger nicht prüfbar (Inhalt nicht in git-Objekten)');
      continue;
    }
    scanner.pruefeDatei(ort, bytes);
  }
}

/**
 * Befund «nicht prüfbar»; P19 gilt trotzdem für den Pfad.
 * @param {Scanner} scanner
 * @param {Ort} ort
 * @param {string} art
 */
function nichtPruefbar(scanner, ort, art) {
  scanner.dateien++;
  scanner.pruefePfad(ort);
  scanner.treffer.push({ datei: scanner.anzeige(ort), zeile: 0, art, maske: '' });
}

/**
 * Git-LFS-Zeiger (P44k, präzisiert): erste Zeile `version https://git-lfs.github.com/spec/v1` oder
 * eine der Alias-Kopfzeilen `version https://hawser.github.com/spec/v1`, `version http://git-media.io/v/2`.
 * @param {Buffer} bytes
 */
function istLfsZeiger(bytes) {
  const kopf = bytes.subarray(0, 200).toString('utf8');
  return /^version (?:https:\/\/git-lfs\.github\.com\/spec\/v1|https:\/\/hawser\.github\.com\/spec\/v1|http:\/\/git-media\.io\/v\/2)\r?\n/.test(
    kopf,
  );
}

/**
 * P44 b: --baum <ref> – alle Einträge von `ls-tree -r -z <ref>`.
 * @param {Scanner} scanner
 * @param {string} root
 * @param {string} ref
 */
function scanBaum(scanner, root, ref) {
  // P44h, P44i: eindeutig aufgelöster Commit; danach nur noch mit der Objekt-ID arbeiten.
  const aufgeloest = loeseRef(root, ref);
  if (!aufgeloest.ok) throw new Abbruch(`${aufgeloest.grund}.`);
  const eintraege = baumEintraege(root, aufgeloest.id);
  if (eintraege === null) {
    // CR-H0S-59, P47f b: das Aufrufargument nur über zeigePfad ausgeben.
    throw new Abbruch(`Baum von ${zeigePfad(ref)} nicht lesbar (git ls-tree).`);
  }
  pruefeObjekte(scanner, root, eintraege);
}

/**
 * P44 b, P44f: --commits <basis>..<ref> – jeder Commit aus `rev-list` einzeln, alle Einträge, die er
 * gegenüber jedem Elternteil hinzufügt oder ändert; jedes Paar Pfad/Blob einmal (frühester Commit).
 * @param {Scanner} scanner
 * @param {string} root
 * @param {string} bereich
 */
function scanCommits(scanner, root, bereich) {
  const trenner = bereich.indexOf('..');
  const basis = trenner < 0 ? '' : bereich.slice(0, trenner);
  const ende = trenner < 0 ? '' : bereich.slice(trenner + 2);
  if (basis === '' || ende === '' || ende.startsWith('.')) {
    throw new Abbruch('Bereich muss die Form <basis>..<ref> haben.');
  }
  // P44h: beide Enden eindeutig auflösen; danach nur noch Objekt-IDs.
  const basisRef = loeseRef(root, basis);
  if (!basisRef.ok) throw new Abbruch(`Basis: ${basisRef.grund}.`);
  const endeRef = loeseRef(root, ende);
  if (!endeRef.ok) throw new Abbruch(`Ende: ${endeRef.grund}.`);
  const liste = runGit(['-C', root, 'rev-list', '--reverse', `${basisRef.id}..${endeRef.id}`]);
  if (liste.status !== 0) throw new Abbruch('Commit-Liste nicht lesbar (git rev-list).');
  /** @type {Array<{ mode: string, oid: string, pfad: string, commit: string }>} */
  const paare = [];
  const gesehen = new Set();
  for (const commit of liste.stdout.split('\n').filter((c) => c !== '')) {
    const diff = runGit([
      '-C',
      root,
      'diff-tree',
      '-r',
      '-z',
      '-m',
      '--root',
      '--no-renames',
      '--no-abbrev',
      '--no-commit-id',
      // P44g: Gitlinks nie ausblenden.
      '--ignore-submodules=none',
      '--diff-filter=ACMRT',
      commit,
    ]);
    if (diff.status !== 0) {
      throw new Abbruch('Änderungen eines Commits nicht lesbar (git diff-tree).');
    }
    for (const e of rohEintraege(diff.stdout)) {
      const schluessel = `${e.pfad}\0${e.oid}`;
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      paare.push({ ...e, commit });
    }
  }
  pruefeObjekte(scanner, root, paare);
}

/**
 * Objekt-Modi (P44): `--root <verz> (--baum <ref> | --commits <basis>..<ref>)`.
 * @param {string[]} args
 * @returns {{ root: string, baum?: string, commits?: string } | null}
 */
function objektArgumente(args) {
  /** @type {Record<string, string>} */
  const werte = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    const wert = args[i + 1];
    if (!['--root', '--baum', '--commits'].includes(name) || wert === undefined || name in werte) {
      return null;
    }
    werte[name] = wert;
  }
  if (werte['--root'] === undefined) return null;
  if ((werte['--baum'] === undefined) === (werte['--commits'] === undefined)) return null;
  return { root: werte['--root'], baum: werte['--baum'], commits: werte['--commits'] };
}

function main() {
  const args = process.argv.slice(2);
  const objektModus = args.some((a) => a === '--root' || a === '--baum' || a === '--commits');
  if (
    args.length === 0 ||
    (args.includes('--staged') && args.length !== 1) ||
    (objektModus && args.includes('--staged'))
  ) {
    fehler(
      'Aufruf: node scripts/wap/privacy-scan.mjs (--staged | <pfad>… | ' +
        '--root <verz> (--baum <ref> | --commits <basis>..<ref>))',
    );
    return 1;
  }
  /** @type {{ root: string, baum?: string, commits?: string } | null} */
  let objekt = null;
  if (objektModus) {
    objekt = objektArgumente(args);
    if (objekt === null) {
      fehler(
        'Aufruf: node scripts/wap/privacy-scan.mjs --root <verz> (--baum <ref> | --commits ' +
          '<basis>..<ref>); --root ist Pflicht.',
      );
      return 1;
    }
    // P44 d: keine GIT_*-Variable des Aufrufers.
    bereinigeGitUmgebung();
  }
  const liste = ladeSperrliste();
  if (!liste.ok) throw new Abbruch(liste.grund);
  const scanner = new Scanner(liste.namen, ladePositivliste());
  if (objekt !== null) {
    const wurzel = objektWurzel(objekt.root);
    if (!wurzel.ok) throw new Abbruch(`${wurzel.grund}; Nachweis nicht möglich.`);
    if (objekt.baum !== undefined) scanBaum(scanner, wurzel.root, objekt.baum);
    else scanCommits(scanner, wurzel.root, /** @type {string} */ (objekt.commits));
  } else if (args[0] === '--staged') scanStaged(scanner);
  else scanPfade(scanner, args);
  const ausserhalb =
    scanner.nichtGeprueft > 0
      ? ` ${scanner.nichtGeprueft} ${scanner.nichtGeprueft === 1 ? 'Datei' : 'Dateien'} nicht geprüft ` +
        '(ausserhalb WAP-Pfadmenge; nur Pfad und reference/ geprüft).'
      : '';
  if (scanner.treffer.length > 0) {
    for (const t of scanner.treffer) {
      const ort = t.zeile > 0 ? `${t.datei}:${t.zeile}` : t.datei;
      fehler(`Datenschutz-Scan: ${ort}: ${t.art}${t.maske ? ` (${t.maske})` : ''}`);
    }
    fehler(
      `Datenschutz-Scan gescheitert: ${scanner.treffer.length} Befund(e). Echtdaten entfernen oder ` +
        'durch fiktive bzw. pseudonymisierte Werte ersetzen; Testmuster zur Laufzeit zusammensetzen.' +
        ausserhalb,
    );
    return 1;
  }
  const n = scanner.dateien - scanner.nichtGeprueft;
  info(`Datenschutz-Scan: ${n} ${n === 1 ? 'Datei' : 'Dateien'} ohne Befund.${ausserhalb}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  fehler(
    e instanceof Abbruch
      ? `Datenschutz-Scan abgebrochen: ${e.message}`
      : 'Datenschutz-Scan abgebrochen: unerwarteter Fehler beim Lesen. Pfade und Rechte prüfen.',
  );
  process.exitCode = 1;
}
