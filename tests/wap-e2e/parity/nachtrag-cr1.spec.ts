// Paket E1-02f: Nachtrag Code-Review Runde 1 (R-5-01, Leitplanke 2; Vertrag E1-02f «Änderungsnotiz Code-Review
// Runde 1 (Orchestrator)» Nr 1 und 2, CR-E102f-01; CR-03 Nr 3; D2). Solange die Prüfung eines neuen Wappens
// aussteht, bleiben die zuletzt gezeichneten Seiten samt Namen und Overlay ihrer damaligen Eingabe stehen; Name,
// Overlay und Inhalt wechseln nur gemeinsam. Ein MutationObserver hält jeden Zustand der Container fest.
// Projekt edge (Vite). Pseudonymisierte KVK-Fixture, KVK+ (E1-02e) mit fiktivem PNG (leeres IDAT) und fiktiver
// Bezeichnung «Neu»; die Pläne liefert die Node-Seite.
import { expect } from '@playwright/test';
import { type Konsolenmeldung, konsoleMitschneiden } from '../render/support/messen';
import { test } from '../support/fixtures';
import { edgePdf, keineKonsole, pruefeParitaet } from './support/ablauf';
import { nodeDaten } from './support/kindprozess';
import {
  container,
  harnessBereit,
  messeWoche,
  setzePlan,
  warteBereit,
  ZOOM_100,
  zeigeWoche,
} from './support/messen-woche';

/** Fiktive Bezeichnung der neuen Woche. */
const NEU = 'Neu';

let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  keineKonsole(konsole);
});

/** Zustand eines Containers, wie ihn der Beobachter festhält. */
interface ContainerZustand {
  readonly name: string;
  readonly zeilen: number;
  readonly alt: boolean;
  readonly neu: boolean;
  readonly overlay: boolean;
}

test.describe('Name, Overlay und Inhalt wechseln gemeinsam (R-5-01; Notiz Code-Review Runde 1 Nr 1, 2, W10)', () => {
  test('[R-5-01] KVK bereit; Wechsel auf eine Woche mit anderer Bezeichnung und ungeprüftem Wappen: zu keinem Zeitpunkt ein Container mit dem Namen der neuen Woche über dem Inhalt der alten (und umgekehrt), kein Overlay vor dem neuen Inhalt; am Ende Name und Zeilen der neuen Woche, vergleicheSeiten = []', async ({
    wapPage,
  }) => {
    test.setTimeout(180_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const kvk = d.wochen.kvk[0];
    await setzePlan(wapPage, d.plaene.kvk);
    expect(await zeigeWoche(wapPage, { weekId: kvk?.weekId ?? '', scale: ZOOM_100 })).toEqual({
      ok: true,
    });
    await warteBereit(wapPage, kvk?.seiten ?? [], ZOOM_100);

    // Neue Woche: KVK+ mit PNG (leeres IDAT, Notiz Test-Review Runde 1 Nr 1), Bezeichnung «Neu».
    expect(d.variantenFehler.x10).toBeUndefined();
    const basis = d.varianten.x10?.plan;
    expect(basis).toBeDefined();
    if (basis === undefined || kvk === undefined) return;
    const plan = { ...basis, weeks: basis.weeks.map((w) => ({ ...w, label: NEU })) };
    const weekId = plan.weeks[0]?.id ?? '';
    const altTitel = `${d.plaene.kvk.unit} Arbeitsplan ${kvk.label}`;
    const neuTitel = `${plan.unit} Arbeitsplan ${NEU}`;
    expect(kvk.seiten[0]?.zeilen).toContain(altTitel);
    const altZeilen = kvk.seiten.map((s) => s.textItems);

    await wapPage.evaluate(
      ([alt, neu, altLabel, neuLabel]) => {
        const zustaende: ContainerZustand[][] = [];
        const wurzel = document.getElementById('root');
        const altTexte = new Set([alt, `Fortsetzung – ${altLabel}`]);
        const neuTexte = new Set([neu, `Fortsetzung – ${neuLabel}`]);
        const halte = () => {
          if (wurzel === null) return;
          zustaende.push(
            [...wurzel.querySelectorAll('[role="document"]')].map((c) => {
              const t = [...c.querySelectorAll('[data-wap-item]')].map((e) => e.textContent ?? '');
              return {
                name: c.getAttribute('aria-label') ?? '',
                zeilen: t.length,
                alt: t.some((x) => altTexte.has(x)),
                neu: t.some((x) => neuTexte.has(x)),
                overlay: c.querySelector('button') !== null,
              };
            }),
          );
        };
        const beobachter = new MutationObserver(halte);
        if (wurzel !== null) {
          beobachter.observe(wurzel, { subtree: true, childList: true, attributes: true });
        }
        halte();
        (
          window as unknown as {
            wapW10: { zustaende: ContainerZustand[][]; ende: () => void };
          }
        ).wapW10 = { zustaende, ende: () => beobachter.disconnect() };
      },
      [altTitel, neuTitel, kvk.label, NEU] as const,
    );
    await setzePlan(wapPage, plan);
    expect(await zeigeWoche(wapPage, { weekId, scale: ZOOM_100, overlay: true })).toEqual({
      ok: true,
    });
    await expect
      .poll(
        () =>
          wapPage.evaluate((t) => {
            const c = document.querySelector('#root [role="document"]');
            return (
              c !== null &&
              c.getAttribute('aria-busy') !== 'true' &&
              [...c.querySelectorAll('[data-wap-item]')].some((e) => e.textContent === t)
            );
          }, neuTitel),
        { timeout: 30_000 },
      )
      .toBe(true);
    const zustaende = await wapPage.evaluate(() => {
      const w = (
        window as unknown as { wapW10: { zustaende: ContainerZustand[][]; ende: () => void } }
      ).wapW10;
      w.ende();
      return w.zustaende;
    });
    // Jeder festgehaltene Zustand: Name, Zeilen und Overlay passen zu derselben Woche.
    const verstoesse = zustaende.flatMap((z, i) =>
      z.flatMap((c, k) => {
        const nameAlt = c.name.endsWith(` ${kvk.label}`);
        const nameNeu = c.name.endsWith(` ${NEU}`);
        const fehler: string[] = [];
        if (nameNeu && c.alt) fehler.push('Name der neuen Woche über dem Inhalt der alten');
        if (nameAlt && c.neu) fehler.push('Name der alten Woche über dem Inhalt der neuen');
        if (nameAlt && c.zeilen > 0 && c.zeilen !== altZeilen[k]) {
          fehler.push(`Name der alten Woche, Zeilen ${String(c.zeilen)}`);
        }
        if (c.overlay && c.alt) fehler.push('Overlay der neuen Eingabe über dem Inhalt der alten');
        return fehler.map((f) => `Zustand ${String(i)}, Container ${String(k + 1)}: ${f}`);
      }),
    );
    expect(verstoesse).toEqual([]);
    expect(zustaende.length).toBeGreaterThan(1);

    // Ende: Name, Zeilen und Overlay der neuen Woche; Parität mit dem PDF derselben Eingabe.
    await expect(wapPage.getByRole('document', { name: `Wochenseite ${NEU}` })).toHaveCount(1);
    await expect(wapPage.getByRole('document', { name: `Wochenseite ${kvk.label}` })).toHaveCount(
      0,
    );
    await expect(container(wapPage).nth(0).getByRole('button', { name: 'Prüfmarke' })).toHaveCount(
      1,
    );
    await expect(container(wapPage).locator('svg image')).toHaveCount(0);
    const m = await messeWoche(wapPage, ZOOM_100);
    expect(m[0]?.zeilen.some((z) => z.laeufe.map((l) => l.text).join('') === neuTitel)).toBe(true);
    const pdf = await edgePdf(wapPage, plan, weekId, 'w10-neue-woche');
    expect(pdf.info.images).toBe(0);
    pruefeParitaet(m, pdf, 'neue Woche mit ungeprüftem Wappen');
  });
});
