// ENTWURF für E1-01b (Vertrag E1-01, Änderungsnotiz AE-001 §3: «R-H-11-Teile von gate-full.*»):
// nicht Teil von E1-01-min, ungeprüft; die Endung .entwurf.ts erfasst keine Konfiguration und keine
// Testliste. Herausgelöst aus dem Entwurf gate-full.selbsttest.ts (3d12aad). Restteile nach der Tabelle
// der Notiz: V4 mit [R-H-11] (E1-01b); V6/V7 mit [R-H-21]/[R-H-22][R-H-11] (E1-01c); V5 mit
// [R-H-20][R-H-11] (E1-01d); V2/V8 und F10 mit [R-H-16]/[R-H-17]/[R-H-23][R-H-11] (E1-01e). Der
// test-engineer des jeweiligen Teilpakets übernimmt seinen Teil und prüft ihn.
// Der Teil V6/V7 ist nach gate-full-c.selbsttest.ts übernommen (Vertrag E1-01c §3 «Entwürfe»); V6 und V7
// sind deshalb hier nicht mehr aufgeführt.
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { testLast } from './support/last';
import { miniRepo, pfadOhnePython } from './support/mini';
import { type Faelschungen, lege, uebersetzeFaelschung } from './support/python-fake';
import {
  aufraeumen,
  commitAlles,
  FIKTIVER_NAME,
  git,
  LANG,
  neueSandbox,
  prozessUmgebung,
  writeText,
} from './support/umgebung';
import { type GateErgebnis, gate, SCHRITT_ID } from './support/vertrag';

let f: Faelschungen;

beforeAll(() => {
  f = uebersetzeFaelschung();
});

afterAll(() => {
  rmSync(f.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

afterEach(aufraeumen);

const V_SCHRITTE = ['V1', 'V1a', 'V2', 'V3', 'V4', 'V5', 'V8', 'V9', 'V10', 'V11'];
const F_SCHRITTE = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'];

function schritteMit(e: GateErgebnis, nummer: string) {
  const re = new RegExp(`^${nummer}(?![0-9a-z])`, 'i');
  return e.schritte.filter((s) => re.test(s.id));
}

describe('runGate full im Mini-Repo (vollständige Schleuse nach E1-01b–e)', () => {
  it(
    '[R-H-11] jeder Schritt F1–F10 und V1–V11 wird ausgeführt; V1–V11 rot bei eingebautem Verstoss',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = miniRepo(sb, 'mini', 'wap-planer');
      git(sb, root, 'checkout', '-q', '-b', 'wap/x');
      writeText(root, 'src/components/Name.tsx', `// ${FIKTIVER_NAME}\nexport const n = 1;\n`);
      commitAlles(sb, root, 'Suite-Datei mit Namen');
      const a = join(f.dir, 'voll-a');
      mkdirSync(a, { recursive: true });
      lege(f, a, 'python', { version: '2 7 18', exe: 'C:\\Fake27\\python.exe' });
      vi.stubEnv('PATH', pfadOhnePython(sb, a));
      const t = testLast(sb);
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: t.last });
      expect(e.ok).toBe(false);
      for (const s of e.schritte)
        expect(s.id, 'Schritt-ID nach Vertrag §9 Nr 8').toMatch(SCHRITT_ID);
      for (const n of F_SCHRITTE) {
        expect(schritteMit(e, n).length, `Schritt ${n} fehlt`).toBeGreaterThan(0);
      }
      for (const n of V_SCHRITTE) {
        const s = schritteMit(e, n);
        expect(s.length, `Schritt ${n} fehlt`).toBeGreaterThan(0);
        expect(
          s.some((x) => !x.ok),
          `Schritt ${n} ist trotz Verstoss grün`,
        ).toBe(true);
      }
    },
    LANG,
  );
});
