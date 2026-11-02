// Golden-Bericht Vorher/Nachher/Differenz für Gate B (R-H-20, ADR-010 §7.3; Paket F-TOOLS, Auftraggeber
// 19.10.2026 «7: ja»). Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `goldenReport`, §9 Nr 7.
// Vergleicht zwei Manifest-Stände (Bildpfade relativ zum Ordner der jeweiligen manifest.json): bericht.md mit
// einer Zeile je Bild und je geändertem Bild <name>/vorher.png, nachher.png, differenz.png (bei «neu» nur
// nachher.png, bei «entfernt» nur vorher.png, bei anderer Grösse kein Differenzbild).
// Aufruf: node scripts/wap-gate/golden-report.mjs --vorher <manifest.json> --nachher <manifest.json> --out <ordner>
//         node scripts/wap-gate/golden-report.mjs --vorher-ref <git-ref> [--root <dir>] --out <ordner>
//         (Vorher = Stand von tests/wap/golden/ im Commit <git-ref>, Nachher = Arbeitsbaum)
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ladeManifest, MANIFEST_REL, pngLesen, sha256, vergleiche } from './golden.mjs';
import { fehlerMeldung, hinweis, ok, rot } from './lib/out.mjs';
import { git } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {import('./golden.mjs').ManifestBild} ManifestBild */

/**
 * @param {string} von
 * @param {string} nach
 * @returns {string}
 */
function link(von, nach) {
  return relative(von, nach).split(sep).join('/');
}

/**
 * Erzeugt den Bericht Vorher / Nachher / Differenz aus zwei Manifest-Ständen.
 * @param {{ vorher: string; nachher: string; out: string }} opts
 * @returns {Promise<import('./lib/types.mjs').Schritt>}
 */
export async function goldenReport(opts) {
  const beginn = Date.now();
  /**
   * @param {string} ursache
   * @returns {Schritt}
   */
  const rotSchritt = (ursache) => ({
    id: 'V5-golden-bericht',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt:
      'Manifest und Baselines wiederherstellen (gesperrt) bzw. Aufnahme wiederholen',
  });
  const vorherDatei = resolve(opts.vorher);
  const nachherDatei = resolve(opts.nachher);
  const v = ladeManifest(vorherDatei);
  if (!v.ok) return rotSchritt(`Vorher-Stand: ${v.grund}`);
  const n = ladeManifest(nachherDatei);
  if (!n.ok) return rotSchritt(`Nachher-Stand: ${n.grund}`);

  /**
   * Liest das Bild eines Eintrags und prüft den SHA-256.
   * @param {string} manifest
   * @param {ManifestBild} e
   * @returns {{ ok: true; bytes: Uint8Array; pfad: string } | { ok: false; grund: string }}
   */
  const lies = (manifest, e) => {
    const pfad = join(dirname(manifest), ...e.datei.split('/'));
    if (!existsSync(pfad)) return { ok: false, grund: `Bild fehlt: ${e.datei}` };
    const bytes = new Uint8Array(readFileSync(pfad));
    if (sha256(bytes) !== e.sha256)
      return { ok: false, grund: `SHA-256 passt nicht zum Manifest: ${e.datei}` };
    return { ok: true, bytes, pfad };
  };

  const out = resolve(opts.out);
  rmSync(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  mkdirSync(out, { recursive: true });
  const dateien = [
    ...new Set([...v.manifest.bilder, ...n.manifest.bilder].map((b) => b.datei)),
  ].sort();
  const zaehler = { geaendert: 0, neu: 0, entfernt: 0, unveraendert: 0 };
  /** @type {string[]} */
  const zeilen = [
    '# Golden-Bilder: Vorher / Nachher / Differenz (ADR-010 §7.3, Gate B)',
    '',
    `Vorher: ${vorherDatei.split(sep).join('/')}`,
    `Nachher: ${nachherDatei.split(sep).join('/')}`,
    `Toleranz vorher ${String(v.manifest.toleranz.pixel)} Pixel, nachher ${String(n.manifest.toleranz.pixel)} Pixel`,
    '',
    '| Datei | Art | Status vorher | Status nachher | SHA-256 vorher | SHA-256 nachher | Abweichende Pixel | Anforderungen | Grund | Commit | Bilder |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const datei of dateien) {
    const a = v.manifest.bilder.find((b) => b.datei === datei);
    const b = n.manifest.bilder.find((x) => x.datei === datei);
    const name = (datei.split('/').at(-1) ?? datei).replace(/\.png$/i, '');
    const ordner = join(out, name);
    /** @type {string[]} */
    const links = [];
    let art = 'unverändert';
    let pixel = '–';
    const la = a === undefined ? null : lies(vorherDatei, a);
    const lb = b === undefined ? null : lies(nachherDatei, b);
    if (la !== null && !la.ok) return rotSchritt(`Vorher-Stand: ${la.grund}`);
    if (lb !== null && !lb.ok) return rotSchritt(`Nachher-Stand: ${lb.grund}`);
    if (la === null && lb?.ok) {
      art = 'neu';
      zaehler.neu += 1;
      mkdirSync(ordner, { recursive: true });
      copyFileSync(lb.pfad, join(ordner, 'nachher.png'));
      links.push(`[nachher](${link(out, join(ordner, 'nachher.png'))})`);
    } else if (lb === null && la?.ok) {
      art = 'entfernt';
      zaehler.entfernt += 1;
      mkdirSync(ordner, { recursive: true });
      copyFileSync(la.pfad, join(ordner, 'vorher.png'));
      links.push(`[vorher](${link(out, join(ordner, 'vorher.png'))})`);
    } else if (la?.ok && lb?.ok) {
      if (a?.sha256 === b?.sha256) {
        zaehler.unveraendert += 1;
      } else {
        zaehler.geaendert += 1;
        mkdirSync(ordner, { recursive: true });
        copyFileSync(la.pfad, join(ordner, 'vorher.png'));
        copyFileSync(lb.pfad, join(ordner, 'nachher.png'));
        links.push(
          `[vorher](${link(out, join(ordner, 'vorher.png'))})`,
          `[nachher](${link(out, join(ordner, 'nachher.png'))})`,
        );
        const c = vergleiche(pngLesen(la.bytes), pngLesen(lb.bytes));
        if (c.groesse) {
          art = 'geändert';
          pixel = String(c.diffPixels);
          writeFileSync(join(ordner, 'differenz.png'), c.diffPng);
          links.push(`[differenz](${link(out, join(ordner, 'differenz.png'))})`);
        } else {
          art = 'geändert (Grösse)';
        }
      }
    }
    const e = b ?? a;
    zeilen.push(
      `| ${datei} | ${art} | ${a?.status ?? '–'} | ${b?.status ?? '–'} | ${a?.sha256.slice(0, 12) ?? '–'} | ${b?.sha256.slice(0, 12) ?? '–'} | ${pixel} | ${(e?.anforderungen ?? []).join(', ')} | ${(e?.grund ?? '').replace(/\|/g, '\\|')} | ${e?.commit ?? ''} | ${links.join(' ') || '–'} |`,
    );
  }
  zeilen.push(
    '',
    `Zusammenfassung: geändert ${String(zaehler.geaendert)}, neu ${String(zaehler.neu)}, entfernt ${String(zaehler.entfernt)}, unverändert ${String(zaehler.unveraendert)}`,
    '',
  );
  writeFileSync(join(out, 'bericht.md'), zeilen.join('\n'));
  return { id: 'V5-golden-bericht', ok: true, ms: Date.now() - beginn, details: zaehler };
}

/**
 * Legt den Stand von tests/wap/golden/ (Manifest und Baselines) aus einem Commit in einem temporären Ordner ab.
 * Fehlt das Manifest im Commit, entsteht ein leeres Manifest (alle Bilder «neu»).
 * @param {string} root
 * @param {string} ref
 * @returns {{ ordner: string; manifest: string } | null}
 */
export function standAusCommit(root, ref) {
  const ordner = mkdtempSync(join(tmpdir(), 'wap-golden-vorher-'));
  const manifest = join(ordner, 'manifest.json');
  const m = git(root, ['show', `${ref}:${MANIFEST_REL}`]);
  if (m.status !== 0) {
    if (git(root, ['cat-file', '-e', `${ref}^{commit}`]).status !== 0) return null;
    writeFileSync(
      manifest,
      `${JSON.stringify({ version: 1, toleranz: { pixel: 0 }, bilder: [] }, null, 2)}\n`,
    );
    return { ordner, manifest };
  }
  writeFileSync(manifest, m.stdout);
  const geladen = ladeManifest(manifest);
  if (geladen.ok) {
    for (const b of geladen.manifest.bilder) {
      const blob = git(root, ['show', `${ref}:tests/wap/golden/${b.datei}`]);
      if (blob.status !== 0) continue;
      const ziel = join(ordner, ...b.datei.split('/'));
      mkdirSync(dirname(ziel), { recursive: true });
      writeFileSync(ziel, blob.raw);
    }
  }
  return { ordner, manifest };
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const wert = (/** @type {string} */ n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = resolve(wert('--root') ?? '.');
  const out = wert('--out');
  const ref = wert('--vorher-ref');
  /** @type {string | undefined} */
  let vorher = wert('--vorher');
  /** @type {string | null} */
  let temp = null;
  if (ref !== undefined) {
    const s = standAusCommit(root, ref);
    if (s !== null) {
      vorher = s.manifest;
      temp = s.ordner;
    }
  }
  const nachher = wert('--nachher') ?? join(root, ...MANIFEST_REL.split('/'));
  if (out === undefined || vorher === undefined) {
    fehlerMeldung(
      'Aufruf: node scripts/wap-gate/golden-report.mjs (--vorher <manifest.json> | --vorher-ref <ref>) [--nachher <manifest.json>] [--root <dir>] --out <ordner>',
    );
    process.exitCode = 1;
  } else {
    const s = await goldenReport({ vorher, nachher, out });
    if (temp !== null) rmSync(temp, { recursive: true, force: true });
    if (s.ok) {
      ok(s.id, s.ms);
      hinweis(`Bericht: ${join(resolve(out), 'bericht.md')}`);
    } else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}
