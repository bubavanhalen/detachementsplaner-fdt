// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»): Einbindung der Pflichtwerkzeuge in die Schleusen (R-H-10,
// R-H-11; ADR-010 §3.1 F10, §3.2 V2, V5, V8). Im Mini-Repo (Werkzeuge und Konfigurationen fehlen bewusst,
// «Fehlt ein Werkzeug oder eine Datei, ist der Schritt rot», ADR-010 §3) laufen die neuen Schritte über
// schleusenSchritte: F10-lizenzen in der schnellen Schleuse, V2-abdeckung, V5-golden und V8-mutation in der
// vollen; jeder rote Schritt hat Ursache und nächsten Schritt, IDs nach Vertrag E1-01 §9 Nr 8.
import { afterEach, describe, expect, it } from 'vitest';
import { miniRepo } from './support/mini';
import { aufraeumen, git, LANG, neueSandbox, prozessUmgebung } from './support/umgebung';
import { gate, SCHRITT_ID, type Schritt } from './support/vertrag';

afterEach(aufraeumen);

interface SchleusenModul {
  schleusenSchritte(
    modus: 'fast' | 'full',
    k: {
      root: string;
      zweig: string;
      paket: string | null;
      preCommit: boolean;
      sperre: string | undefined;
      melde: (s: Schritt) => void;
      nur?: string[];
    },
  ): Promise<void>;
}

async function schritte(root: string, modus: 'fast' | 'full', nur: string[]): Promise<Schritt[]> {
  const m = (await gate()) as unknown as SchleusenModul;
  const liste: Schritt[] = [];
  await m.schleusenSchritte(modus, {
    root,
    zweig: 'wap/x',
    paket: 'x',
    preCommit: false,
    sperre: undefined,
    melde: (s) => liste.push(s),
    nur,
  });
  return liste;
}

describe('Neue Schritte der Schleusen (F-TOOLS)', () => {
  it(
    '[R-H-10][R-H-23] schnelle Schleuse: F10-lizenzen läuft; ohne main rot mit Ursache «Merge-Basis mit main»; mit main und ohne package-lock rot «package-lock.json fehlt»',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = miniRepo(sb, 'mini', 'wap-planer');
      git(sb, root, 'checkout', '-q', '-b', 'wap/x');
      const ohneMain = await schritte(root, 'fast', ['F10']);
      expect(ohneMain.map((s) => s.id)).toEqual(['F10-lizenzen']);
      expect(ohneMain[0]?.ok).toBe(false);
      expect(ohneMain[0]?.ursache ?? '').toContain('Merge-Basis mit main');
      git(sb, root, 'branch', '-q', 'main', 'wap-planer');
      const mitMain = await schritte(root, 'fast', ['F10']);
      expect(mitMain[0]?.ok).toBe(false);
      expect(mitMain[0]?.ursache ?? '').toContain('package-lock.json fehlt');
    },
    LANG,
  );

  it(
    '[R-H-11][R-H-16][R-H-20][R-H-17] volle Schleuse: V2-abdeckung, V5-golden und V8-mutation laufen; im Mini-Repo ohne Werkzeuge rot mit Ursache und nächstem Schritt',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = miniRepo(sb, 'mini', 'wap-planer');
      git(sb, root, 'checkout', '-q', '-b', 'wap/x');
      const liste = await schritte(root, 'full', ['V2', 'V5', 'V8']);
      for (const id of ['V2-abdeckung', 'V5-golden', 'V8-mutation']) {
        const s = liste.find((x) => x.id === id);
        expect(s, `${id} fehlt`).toBeDefined();
      }
      for (const s of liste) {
        expect(s.id).toMatch(SCHRITT_ID);
        if (!s.ok) {
          expect((s.ursache ?? '').length, s.id).toBeGreaterThan(0);
          expect((s.naechsterSchritt ?? '').length, s.id).toBeGreaterThan(0);
        }
      }
      expect(liste.find((x) => x.id === 'V2-abdeckung')?.ok).toBe(false);
      expect(liste.find((x) => x.id === 'V5-golden')?.ok).toBe(false);
    },
    LANG,
  );
});
