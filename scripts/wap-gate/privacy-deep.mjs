// F3/V11 Datenschutz für Container- und PDF-Inhalte und erzeugte Artefakte (R-H-24, ADR-010 §3.1 F3,
// §3.2 V11, §10). Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `deepPrivacyScan`, §9 Nr 14.
// .xlsx/.xlsm/.docx werden entpackt (fflate), .pdf per pdfjs-dist ausgelesen; im Pfad-Modus werden auch
// Textdateien geprüft. Muster wie H0 (AHV, Telefon, E-Mail, Sperrliste). Ausgabe nur mit Pfad und Art,
// nie mit dem Inhalt; beschädigte Container sind rot («nicht prüfbar», fail-closed).
// PDF-Seitentext (E1-01.md, Änderungsnotiz E1-01-30): Zeilen werden aus den Textstücken nach ihrer Lage
// gebildet (gleiche Laufrichtung, gleiche Grundlinie, kleine Lücke) und einzeln geprüft.
// Ausnahme E1-01-28 (E1-01.md, Änderungsnotiz E1-01-28 und Orchestrator-Zeilen «Auslegung», «Code-Review
// E1-01-28»): In HTML-Dateien unter test-results/wap/einzeldatei/ und dist/ gilt das E-Mail-Muster nicht im
// Inhalt genau eines echten Lizenzblocks <template id="application-licenses"> in Bau-Form (direktes Kind
// von head bzw. body); alle übrigen Muster gelten dort weiter.
// Aufruf: node scripts/wap-gate/privacy-deep.mjs [--root <verzeichnis>] (--staged | <pfad> …)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync } from 'fflate';
import { zeigePfad } from '../wap/lib/common.mjs';
import { ANTHROPIC_TRAILER, funde, ladeSperrliste } from '../wap/lib/muster.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';
import { git } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ schluessel: string; re: RegExp }} Name */

const ZIP = /\.(?:xlsx|xlsm|docx)$/i;
const PDF = /\.pdf$/i;

/**
 * Berichte des Suite-npm test (V10, Stabilitätslauf) gelten wie Suite-Dateien: geprüft wird nur der Pfad,
 * nicht der Inhalt (E1-01-21; wie der H0-Scan ausserhalb der WAP-Pfadmenge). Alle übrigen Dateien unter
 * den Pfaden, auch die WAP-Berichte (z.B. vitest-reference.json), werden voll geprüft (fail-closed).
 */
const SUITE_BERICHT = /^test-results\/wap\/(?:suite\.json|stabilitaet\/suite-[^/]+\.json)$/i;

/**
 * Orte, an denen der Lizenzblock vom E-Mail-Muster ausgenommen ist (Änderungsnotiz E1-01-28 und
 * Orchestrator-Zeile «Auslegung»): HTML-Dateien, repo-relativ unter test-results/wap/einzeldatei/ oder dist/.
 */
const LIZENZBLOCK_ORT = /^(?:test-results\/wap\/einzeldatei\/|dist\/).*\.html$/i;

/** Lizenzblock genau in der Form des Baus (tools/build-offline.mjs, scripts/wap-gate/einzeldatei.mjs). */
const LIZENZBLOCK_AUF = '<template id="application-licenses"><pre>';
const LIZENZBLOCK_ZU = '</pre></template>';

/** ID des Lizenzblocks (Vergleich nach Dekodierung, Gross/Klein und Rand egal: im Zweifel mehr zählen). */
const LIZENZBLOCK_ID = 'application-licenses';

/** Elemente ohne Inhalt (HTML Living Standard, «void elements»). */
const LEERE_ELEMENTE = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** Elemente mit Rohtext-Inhalt (Orchestrator-Zeile «Code-Review E1-01-28»). */
const ROHTEXT = new Set(['script', 'style', 'textarea', 'title']);

/** Name eines Start- bzw. End-Tags (sticky). */
const TAG_NAME = /[A-Za-z][A-Za-z0-9:-]*/y;

/** Ein Attribut (sticky); ein nicht geschlossener Wert passt nicht. */
const ATTRIBUT = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;

/**
 * Dekodiert Zeichenreferenzen eines Attributwerts (numerisch, auch ohne Semikolon, und die üblichen
 * benannten); unbekannte bleiben stehen.
 * @param {string} wert
 * @returns {string}
 */
function attributDekodiert(wert) {
  /** @type {Record<string, string>} */
  const benannt = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return wert.replace(
    /&(?:#[xX]([0-9a-fA-F]+);?|#(\d+);?|(amp|lt|gt|quot|apos);?)/g,
    (
      /** @type {string} */ m,
      /** @type {string | undefined} */ h,
      /** @type {string | undefined} */ d,
      /** @type {string | undefined} */ n,
    ) => {
      const code = h !== undefined ? Number.parseInt(h, 16) : d !== undefined ? Number(d) : null;
      if (code === null) return n === undefined ? m : (benannt[n] ?? m);
      return code <= 0x10ffff ? String.fromCodePoint(code) : m;
    },
  );
}

/**
 * Zerlegt eine HTML-Seite in den Inhalt des Lizenzblocks und den übrigen Text (Änderungsnotiz E1-01-28,
 * Orchestrator-Zeile «Code-Review E1-01-28, CR-E101-P01..P03»). Ein kleiner Tokenizer liest die Tags;
 * Kommentare, CDATA, `<!…>`/`<?…>` und der Rohtext von script, style, textarea und title werden
 * übersprungen, Attributwerte dekodiert. Ergebnis nur, wenn genau ein Element die ID application-licenses
 * trägt, dieses in der Bau-Form vorliegt (`<pre>` mit Text ohne «<») und direktes Kind von html>head bzw.
 * html>body ist; sonst null (fail closed: keine Ausnahme). End-Tags schliessen nur das oberste offene
 * Element (im Zweifel bleibt der Block verschachtelt). Laufzeit linear in der Länge der Seite.
 * @param {string} html
 * @returns {{ block: string; rest: string } | null}
 */
function lizenzblockTeilen(html) {
  /** @type {string[]} */
  const stapel = [];
  let anzahl = 0;
  /** @type {{ anfang: number; ende: number; block: string } | null} */
  let fund = null;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) {
      if (html.startsWith('<!-->', lt)) i = lt + 5;
      else if (html.startsWith('<!--->', lt)) i = lt + 6;
      else {
        const ende = html.indexOf('-->', lt + 4);
        i = ende < 0 ? html.length : ende + 3;
      }
      continue;
    }
    if (html.startsWith('<![CDATA[', lt)) {
      const ende = html.indexOf(']]>', lt + 9);
      i = ende < 0 ? html.length : ende + 3;
      continue;
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const ende = html.indexOf('>', lt + 2);
      i = ende < 0 ? html.length : ende + 1;
      continue;
    }
    if (html.startsWith('</', lt)) {
      TAG_NAME.lastIndex = lt + 2;
      const n = TAG_NAME.exec(html);
      const ende = html.indexOf('>', lt + 2);
      if (ende < 0) break;
      if (n !== null && stapel.at(-1) === n[0].toLowerCase()) stapel.pop();
      i = ende + 1;
      continue;
    }
    TAG_NAME.lastIndex = lt + 1;
    const kopf = TAG_NAME.exec(html);
    if (kopf === null) {
      i = lt + 1;
      continue;
    }
    const name = kopf[0].toLowerCase();
    /** @type {Map<string, string>} */
    const attribute = new Map();
    let idTreffer = false;
    let j = TAG_NAME.lastIndex;
    for (;;) {
      while (j < html.length && /[\s/]/.test(html[j] ?? '')) j += 1;
      if (j >= html.length) return null;
      if (html[j] === '>') break;
      ATTRIBUT.lastIndex = j;
      const a = ATTRIBUT.exec(html);
      if (a === null) return null;
      const schluessel = (a[1] ?? '').toLowerCase();
      const wert = attributDekodiert(a[2] ?? a[3] ?? a[4] ?? '');
      if (schluessel === 'id' && wert.trim().toLowerCase() === LIZENZBLOCK_ID) idTreffer = true;
      if (!attribute.has(schluessel)) attribute.set(schluessel, wert);
      j = ATTRIBUT.lastIndex;
    }
    const nachTag = j + 1;
    if (idTreffer) {
      anzahl += 1;
      if (anzahl > 1) return null;
    }
    if (
      idTreffer &&
      name === 'template' &&
      html.startsWith(LIZENZBLOCK_AUF, lt) &&
      nachTag === lt + LIZENZBLOCK_AUF.length - '<pre>'.length
    ) {
      const textAnfang = lt + LIZENZBLOCK_AUF.length;
      const zu = html.indexOf(LIZENZBLOCK_ZU, textAnfang);
      const naechstesLt = html.indexOf('<', textAnfang);
      if (zu >= 0 && naechstesLt === zu) {
        const ende = zu + LIZENZBLOCK_ZU.length;
        const lage = stapel.join('>');
        if (lage === 'html>head' || lage === 'html>body') {
          fund = { anfang: lt, ende, block: html.slice(textAnfang, zu) };
        }
        i = ende;
        continue;
      }
    }
    if (ROHTEXT.has(name)) {
      const schluss = new RegExp(`</${name}(?=[\\s/>])`, 'gi');
      schluss.lastIndex = nachTag;
      const s = schluss.exec(html);
      if (s === null) break;
      const ende = html.indexOf('>', s.index);
      if (ende < 0) break;
      i = ende + 1;
      continue;
    }
    if (!LEERE_ELEMENTE.has(name)) stapel.push(name);
    i = nachTag;
  }
  if (anzahl !== 1 || fund === null) return null;
  return {
    block: fund.block,
    rest: `${html.slice(0, fund.anfang)}\n${html.slice(fund.ende)}`,
  };
}

/**
 * Wandelt XML-Text in prüfbaren Text: Tags entfernt (einmal mit, einmal ohne Leerraum, damit auch über
 * Formatierungsgrenzen getrennte Namen gefunden werden), Entitäten aufgelöst.
 * @param {string} xml
 * @returns {string[]}
 */
function xmlTexte(xml) {
  const entitaeten = (/** @type {string} */ t) =>
    t
      .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(Number.parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  return [entitaeten(xml.replace(/<[^>]*>/g, ' ')), entitaeten(xml.replace(/<[^>]*>/g, ''))];
}

/** @typedef {{ a: number; b: number; e: number; f: number; s: number; breite: number }} Lage */

/**
 * Lage eines PDF-Textstücks (Matrix [a, b, c, d, e, f] und Breite in Laufrichtung); `null` ohne
 * gültige Lagedaten (Änderungsnotiz E1-01-30, Regel 4).
 * @param {unknown} transform
 * @param {unknown} width
 * @returns {Lage | null}
 */
function lageVon(transform, width) {
  if (!Array.isArray(transform) || transform.length < 6) return null;
  if (typeof width !== 'number' || !Number.isFinite(width)) return null;
  /** @type {number[]} */
  const m = [];
  for (let k = 0; k < 6; k++) {
    const wert = transform[k];
    if (typeof wert !== 'number' || !Number.isFinite(wert)) return null;
    m.push(wert);
  }
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = m;
  if (Math.hypot(a, b) === 0) return null;
  return { a, b, e, f, s: Math.max(1, Math.hypot(c, d)), breite: width };
}

/**
 * Lücke in Laufrichtung, wenn `jetzt` die Zeile von `vorher` fortsetzt (gleiche Laufrichtung ±1°,
 * gleiche Grundlinie ±0,25·s, −0,25·s ≤ Lücke ≤ 0,6·s), sonst `null` (Änderungsnotiz E1-01-30, Regel 2).
 * @param {Lage} vorher
 * @param {Lage} jetzt
 * @returns {number | null}
 */
function fortsetzung(vorher, jetzt) {
  const winkel = Math.abs(Math.atan2(jetzt.b, jetzt.a) - Math.atan2(vorher.b, vorher.a));
  const differenz = Math.min(winkel, 2 * Math.PI - winkel);
  if (differenz > Math.PI / 180) return null;
  const laenge = Math.hypot(vorher.a, vorher.b);
  const ux = vorher.a / laenge;
  const uy = vorher.b / laenge;
  const dx = jetzt.e - vorher.e;
  const dy = jetzt.f - vorher.f;
  if (Math.abs(dy * ux - dx * uy) > 0.25 * vorher.s) return null;
  const luecke = dx * ux + dy * uy - vorher.breite;
  if (luecke < -0.25 * vorher.s || luecke > 0.6 * vorher.s) return null;
  return luecke;
}

/**
 * Zeilen einer PDF-Seite aus den Textstücken von getTextContent() nach ihrer Lage (Änderungsnotiz
 * E1-01-30): Leerraum-Stücke übersprungen (Regel 1), Fortsetzung ohne Trennzeichen bis 0,15·s, sonst mit
 * einem Leerzeichen (Regel 2), sonst neue Zeile (Regel 3); Stücke ohne Lagedaten bilden eine eigene
 * Zeile (Regel 4).
 * @param {ReadonlyArray<object>} stuecke
 * @returns {string[]}
 */
function pdfZeilen(stuecke) {
  /** @type {string[]} */
  const zeilen = [];
  /** @type {string | null} */
  let zeile = null;
  /** @type {Lage | null} */
  let vorher = null;
  for (const stueck of stuecke) {
    if (!('str' in stueck) || typeof stueck.str !== 'string') continue;
    const text = stueck.str;
    if (text.trim() === '') continue;
    const lage = lageVon(
      'transform' in stueck ? stueck.transform : undefined,
      'width' in stueck ? stueck.width : undefined,
    );
    if (lage === null) {
      if (zeile !== null) zeilen.push(zeile);
      zeilen.push(text);
      zeile = null;
      vorher = null;
      continue;
    }
    const luecke = zeile !== null && vorher !== null ? fortsetzung(vorher, lage) : null;
    if (zeile !== null && vorher !== null && luecke !== null) {
      zeile += luecke <= 0.15 * vorher.s ? text : ` ${text}`;
    } else {
      if (zeile !== null) zeilen.push(zeile);
      zeile = text;
    }
    vorher = lage;
  }
  if (zeile !== null) zeilen.push(zeile);
  return zeilen;
}

/**
 * Texte eines Containers bzw. einer Datei; wirft bei beschädigtem Container.
 * @param {string} name
 * @param {Uint8Array} bytes
 * @param {boolean} auchText Textdateien prüfen (Pfad-Modus)
 * @returns {Promise<string[]>}
 */
async function texte(name, bytes, auchText) {
  if (ZIP.test(name)) {
    const dateien = unzipSync(bytes);
    /** @type {string[]} */
    const out = [];
    for (const [eintrag, inhalt] of Object.entries(dateien)) {
      if (!/\.(?:xml|rels|txt)$/i.test(eintrag)) continue;
      out.push(...xmlTexte(Buffer.from(inhalt).toString('utf8')));
    }
    return out;
  }
  if (PDF.test(name)) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const aufgabe = getDocument({
      data: new Uint8Array(bytes),
      verbosity: 0,
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: true,
    });
    try {
      const pdf = await aufgabe.promise;
      /** @type {string[]} */
      const out = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const seite = await pdf.getPage(n);
        const inhalt = await seite.getTextContent();
        out.push(pdfZeilen(inhalt.items).join('\n'));
      }
      const meta = await pdf.getMetadata();
      out.push(JSON.stringify(meta.info ?? {}));
      return out;
    } finally {
      await aufgabe.destroy();
    }
  }
  if (!auchText) return [];
  return textDekodiert(name, Buffer.from(bytes));
}

/** Bekannte Binärformate (Bilder, Schriften, Kompression); ihr Inhalt ist kein Text. */
const BINAER = /\.(?:png|jpe?g|gif|webp|ico|bmp|ttf|otf|woff2?|wasm|gz|br|zst|7z)$/i;

/**
 * Text einer Datei für die Musterprüfung (CR-E101-P07, F-TOOLS Runde 2): UTF-16 mit BOM (LE, BE) und ohne BOM
 * (Anteil der NUL-Bytes an geraden bzw. ungeraden Stellen ≥ 30 %) wird dekodiert; eine andere Datei mit NUL-Byte
 * wird nicht mehr übergangen, sondern mit NUL als Leerzeichen geprüft (fail-closed). Nur bekannte Binärformate
 * nach Endung bleiben aussen vor.
 * @param {string} name
 * @param {Buffer} buf
 * @returns {string[]}
 */
export function textDekodiert(name, buf) {
  /** @param {Buffer} b */
  const be = (b) => {
    const k = Buffer.from(b.subarray(0, b.length - (b.length % 2)));
    k.swap16();
    return k.toString('utf16le');
  };
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe)
    return [buf.subarray(2).toString('utf16le')];
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return [be(buf.subarray(2))];
  if (!buf.includes(0)) return [buf.toString('utf8')];
  if (BINAER.test(name)) return [];
  let gerade = 0;
  let ungerade = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0) {
      if (i % 2 === 0) gerade++;
      else ungerade++;
    }
  }
  const haelfte = Math.max(1, Math.floor(buf.length / 2));
  if (ungerade / haelfte >= 0.3 && ungerade >= gerade) return [buf.toString('utf16le')];
  if (gerade / haelfte >= 0.3) return [be(buf)];
  return [buf.toString('utf8').replaceAll('\0', ' ')];
}

/**
 * Arten der Funde in den Texten (ohne Inhalt). `ohneEmail` nur für den Inhalt des Lizenzblocks
 * (Änderungsnotiz E1-01-28); alle übrigen Muster gelten immer.
 * @param {string[]} liste
 * @param {Name[]} namen
 * @param {boolean} [ohneEmail]
 * @returns {string[]}
 */
function artenIn(liste, namen, ohneEmail = false) {
  const emails = new Set([ANTHROPIC_TRAILER]);
  /** @type {Set<string>} */
  const arten = new Set();
  for (const t of liste) {
    for (const zeile of t.normalize('NFC').split(/\r?\n/)) {
      for (const f of funde(zeile, namen, emails, { ohneEmail })) arten.add(f.art);
    }
  }
  return [...arten].sort();
}

/**
 * Alle Dateien unter einem Pfad (rekursiv).
 * @param {string} abs
 * @returns {string[]}
 */
function dateienUnter(abs) {
  if (statSync(abs).isFile()) return [abs];
  /** @type {string[]} */
  const out = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const p = join(abs, e.name);
    if (e.isDirectory()) out.push(...dateienUnter(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/**
 * Prüft Inhalte von .xlsx, .pdf, .docx (gestagt oder unter pfade); Ausgabe maskiert.
 * @param {{ cwd: string; staged?: boolean; pfade?: string[] }} opts
 * @returns {Promise<Schritt>}
 */
export async function deepPrivacyScan(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  const id = opts.staged ? 'F3-deep' : 'V11-deep';
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @param {unknown} [details]
   * @returns {Schritt}
   */
  const rotSchritt = (ursache, naechsterSchritt, details) => ({
    id,
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
    ...(details === undefined ? {} : { details }),
  });
  const liste = ladeSperrliste();
  if (!liste.ok)
    return rotSchritt(liste.grund, 'Sperrliste lokal bereitstellen (WAP_REFERENCE_DIR)');
  /** @type {{ anzeige: string; lade: () => Uint8Array; nurPfad?: boolean; lizenzblock?: boolean }[]} */
  const kandidaten = [];
  if (opts.staged) {
    const r = git(root, ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMRT'], {
      mitIndex: true,
    });
    if (r.status !== 0)
      return rotSchritt('gestagter Stand nicht lesbar (git diff --cached)', 'im Worktree starten');
    for (const rel of r.stdout.split('\0').filter((p) => p !== '')) {
      if (!ZIP.test(rel) && !PDF.test(rel)) continue;
      kandidaten.push({
        anzeige: rel,
        lade: () => {
          const b = git(root, ['show', `:${rel}`], { mitIndex: true });
          if (b.status !== 0) throw new Error('Index-Eintrag nicht lesbar');
          return b.raw;
        },
      });
    }
  } else {
    /** @type {string[]} */
    const fehlend = [];
    for (const p of opts.pfade ?? []) {
      const abs = isAbsolute(p) ? p : resolve(root, p);
      if (!existsSync(abs)) {
        fehlend.push(p);
        continue;
      }
      for (const datei of dateienUnter(abs)) {
        const rel = relative(root, datei).split(sep).join('/');
        kandidaten.push({
          anzeige: rel.startsWith('..') ? datei : rel,
          lade: () => readFileSync(datei),
          nurPfad: SUITE_BERICHT.test(rel),
          lizenzblock: !rel.startsWith('..') && !isAbsolute(rel) && LIZENZBLOCK_ORT.test(rel),
        });
      }
    }
    if (fehlend.length > 0 || (opts.pfade ?? []).length === 0) {
      return rotSchritt(
        fehlend.length > 0
          ? `Pfad fehlt: ${kurzeListe(fehlend.map((p) => zeigePfad(p)))}`
          : 'kein Pfad angegeben',
        'Pfad prüfen (z.B. test-results/wap nach einem Testlauf)',
      );
    }
  }
  /** @type {{ pfad: string; arten: string[] }[]} */
  const treffer = [];
  /** @type {string[]} */
  const nichtPruefbar = [];
  for (const k of kandidaten) {
    try {
      const zuPruefen = k.nurPfad ? [k.anzeige] : await texte(k.anzeige, k.lade(), !opts.staged);
      const geteilt =
        k.lizenzblock === true && zuPruefen.length === 1
          ? lizenzblockTeilen(zuPruefen[0] ?? '')
          : null;
      const arten =
        geteilt === null
          ? artenIn(zuPruefen, liste.namen)
          : [
              ...new Set([
                ...artenIn([geteilt.rest], liste.namen),
                ...artenIn([geteilt.block], liste.namen, true),
              ]),
            ].sort();
      if (arten.length > 0) treffer.push({ pfad: k.anzeige, arten });
    } catch {
      nichtPruefbar.push(k.anzeige);
    }
  }
  if (treffer.length === 0 && nichtPruefbar.length === 0) {
    return { id, ok: true, ms: Date.now() - beginn, details: { geprueft: kandidaten.length } };
  }
  const teile = [];
  if (treffer.length > 0) {
    teile.push(
      `Personendaten in ${String(treffer.length)} Dateien: ${kurzeListe(
        treffer.map((t) => `${zeigePfad(t.pfad)} (${t.arten.join(', ')})`),
      )}`,
    );
  }
  if (nichtPruefbar.length > 0) {
    teile.push(`nicht prüfbar: ${kurzeListe(nichtPruefbar.map((p) => zeigePfad(p)))}`);
  }
  return rotSchritt(
    teile.join('; '),
    'Personendaten entfernen bzw. pseudonymisieren, beschädigte Dateien ersetzen; nie echte Daten in Fixtures oder Artefakten',
    {
      treffer: treffer.map((t) => ({ pfad: zeigePfad(t.pfad), arten: t.arten })),
      nichtPruefbar: nichtPruefbar.length,
    },
  );
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  const root = resolve(i >= 0 ? (args[i + 1] ?? '.') : '.');
  const rest = args.filter((_a, k) => i < 0 || (k !== i && k !== i + 1));
  const staged = rest.includes('--staged');
  const pfade = rest.filter((a) => a !== '--staged');
  if (
    (i >= 0 && args[i + 1] === undefined) ||
    (staged && pfade.length > 0) ||
    (!staged && pfade.length === 0)
  ) {
    fehlerMeldung(
      'Aufruf: node scripts/wap-gate/privacy-deep.mjs [--root <verzeichnis>] (--staged | <pfad> …)',
    );
    process.exitCode = 1;
  } else {
    const s = await deepPrivacyScan({ cwd: root, ...(staged ? { staged: true } : { pfade }) });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}
