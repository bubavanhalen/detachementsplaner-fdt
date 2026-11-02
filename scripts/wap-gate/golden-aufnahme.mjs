// Aufnahme der Golden-Kandidaten Ebene 3 (R-H-20, Prompt §5.2 Schritt 8, §7, ADR-010 §7.3; Paket F-TOOLS,
// Auftraggeber 19.10.2026 «7: ja»). Belegt die Sperre, führt die Golden-Tests aus (vitest.wap-golden.config.ts;
// erwartet rot nur wegen fehlender bzw. abweichender Baselines, nie wegen der Render-Kette), übernimmt die
// gerenderten Ist-Bilder aus test-results/wap/golden/ist/ nach tests/wap/golden/baselines/ und trägt sie mit
// Status «vorläufig», SHA-256, Anforderungen, Grund und Commit ins Manifest ein. Unveränderte Bilder behalten
// ihren Eintrag (auch «freigegeben»). Danach Bericht Vorher/Nachher/Differenz gegen den Stand von HEAD unter
// test-results/wap/golden/bericht/. Sperren (lock-update) und Commit macht der Aufrufer.
// Aufruf: node scripts/wap-gate/golden-aufnahme.mjs --grund "<Text>" [--nur <name,…>] [--root <dir>]
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  GOLDEN_AUSGABE,
  KETTE_GEAENDERT,
  ladeManifest,
  MANIFEST_REL,
  manifestText,
  sha256,
} from './golden.mjs';
import { goldenReport, standAusCommit } from './golden-report.mjs';
import { belegeSperre, testUmgebung } from './last.mjs';
import { fehlerMeldung, hinweis } from './lib/out.mjs';
import { starte, werkzeug } from './lib/prozess.mjs';
import { commitVon } from './lib/repo.mjs';

/**
 * @param {{ cwd: string; grund: string; nur?: string[] }} opts
 * @returns {Promise<{ ok: boolean; meldung: string; aufgenommen: string[] }>}
 */
export async function goldenAufnahme(opts) {
  const root = resolve(opts.cwd);
  if (opts.grund.trim() === '') return { ok: false, meldung: '--grund fehlt', aufgenommen: [] };
  const vitest = werkzeug(root, 'vitest');
  if (vitest === null)
    return { ok: false, meldung: 'vitest fehlt in node_modules («npm ci»)', aufgenommen: [] };
  const sperre = await belegeSperre({ modus: 'golden-aufnahme', worktree: root, env: process.env });
  if (!sperre.ok) {
    return {
      ok: false,
      meldung: `Sperre belegt: ${sperre.schritt.ursache ?? ''}`,
      aufgenommen: [],
    };
  }
  try {
    const ist = join(root, ...GOLDEN_AUSGABE.split('/'), 'ist');
    rmSync(ist, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    const env = testUmgebung(process.env, 'vitest');
    if (sperre.envWert !== undefined) env.WAP_GATE_SPERRE = sperre.envWert;
    const lauf = await starte(
      process.execPath,
      [vitest, 'run', '-c', 'vitest.wap-golden.config.ts'],
      {
        cwd: root,
        env,
        timeoutMs: 3_600_000,
      },
    );
    const ausgabe = `${lauf.stdout}\n${lauf.stderr}`;
    if (ausgabe.includes(KETTE_GEAENDERT)) {
      return {
        ok: false,
        meldung: 'Render-Kette geändert: zuerst die Kette klären (keine Aufnahme)',
        aufgenommen: [],
      };
    }
    if (!existsSync(ist))
      return {
        ok: false,
        meldung: 'keine Ist-Bilder erzeugt (Golden-Lauf gescheitert)',
        aufgenommen: [],
      };
    const manifestDatei = join(root, ...MANIFEST_REL.split('/'));
    const m = ladeManifest(manifestDatei);
    if (!m.ok) return { ok: false, meldung: `Manifest: ${m.grund}`, aufgenommen: [] };
    const commit = (commitVon(root, 'HEAD') ?? '').slice(0, 7);
    const nur = opts.nur?.map((n) => n.trim()).filter((n) => n !== '');
    /** @type {string[]} */
    const aufgenommen = [];
    const bilder = [...m.manifest.bilder];
    for (const datei of readdirSync(ist)
      .filter((d) => d.endsWith('.json'))
      .sort()) {
      const info = /** @type {{ name: string; anforderungen: string[] }} */ (
        JSON.parse(readFileSync(join(ist, datei), 'utf8'))
      );
      if (nur !== undefined && nur.length > 0 && !nur.includes(info.name)) continue;
      const png = join(ist, `${info.name}.png`);
      if (!existsSync(png)) continue;
      const bytes = readFileSync(png);
      const sha = sha256(bytes);
      const rel = `baselines/${info.name}.png`;
      const i = bilder.findIndex((b) => b.datei === rel);
      if (i >= 0 && bilder[i]?.sha256 === sha) continue;
      const ziel = join(root, 'tests', 'wap', 'golden', 'baselines');
      mkdirSync(ziel, { recursive: true });
      copyFileSync(png, join(ziel, `${info.name}.png`));
      const eintrag = /** @type {import('./golden.mjs').ManifestBild} */ ({
        datei: rel,
        sha256: sha,
        status: 'vorläufig',
        anforderungen: info.anforderungen,
        grund: opts.grund,
        commit,
      });
      if (i >= 0) bilder[i] = eintrag;
      else bilder.push(eintrag);
      aufgenommen.push(info.name);
    }
    writeFileSync(manifestDatei, manifestText({ ...m.manifest, bilder }));
    const vorher = standAusCommit(root, 'HEAD');
    if (vorher !== null) {
      await goldenReport({
        vorher: vorher.manifest,
        nachher: manifestDatei,
        out: join(root, ...GOLDEN_AUSGABE.split('/'), 'bericht'),
      });
      rmSync(vorher.ordner, { recursive: true, force: true });
    }
    return {
      ok: true,
      meldung:
        aufgenommen.length === 0
          ? 'keine neuen oder geänderten Bilder'
          : `${String(aufgenommen.length)} Bild(er) aufgenommen (vorläufig)`,
      aufgenommen,
    };
  } finally {
    await sperre.freigeben();
  }
}

// CLI
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const wert = (/** @type {string} */ n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const grund = wert('--grund');
  if (grund === undefined) {
    fehlerMeldung(
      'Aufruf: node scripts/wap-gate/golden-aufnahme.mjs --grund "<Text>" [--nur <name,…>] [--root <dir>]',
    );
    process.exitCode = 1;
  } else {
    const r = await goldenAufnahme({
      cwd: wert('--root') ?? process.cwd(),
      grund,
      ...(wert('--nur') === undefined ? {} : { nur: (wert('--nur') ?? '').split(',') }),
    });
    hinweis(`Golden-Aufnahme: ${r.meldung}`);
    for (const n of r.aufgenommen) hinweis(`  baselines/${n}.png`);
    if (r.ok && r.aufgenommen.length > 0) {
      hinweis(`Bericht: ${GOLDEN_AUSGABE}/bericht/bericht.md`);
      hinweis(
        'Nächster Schritt: visual-qa prüft die Bilder; dann lock-update --add für neue Baselines bzw. --refresh für geänderte und tests/wap/golden/manifest.json (eigener Commit).',
      );
    }
    process.exitCode = r.ok ? 0 : 1;
  }
}
