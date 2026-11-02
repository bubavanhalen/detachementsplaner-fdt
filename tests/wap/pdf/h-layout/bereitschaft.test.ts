// @vitest-environment jsdom
// Paket H-LAYOUT, Zusatzbefund visual-qa (e) (R-10-22; B-Kp-75; Referenz): Der Kasten «Erhöhte Bereitschaft» trägt
// die Titelzeile «Erhöhte Bereitschaft:» fett und zentriert über dem Text. Ohne erfassten Text kein Kasten. Variante
// der pseudonymisierten KVK-Fixture mit fiktivem Text.
import { describe, expect, it } from 'vitest';
import { laeufe, zeilen } from '../../support/page/pdf-seite';
import { seitePdf } from '../../support/page/seite';
import { KVK_WOCHE, kvk, mitWoche } from '../../support/page/varianten';

const TEXT = 'Ganzer Zug innert 12h bereit';

describe('Titelzeile der erhöhten Bereitschaft (R-10-22)', () => {
  it('[R-10-22] erfasster Text: «Erhöhte Bereitschaft:» fett, zentriert wie der Text, direkt darüber', async () => {
    const plan = mitWoche(kvk(), KVK_WOCHE, { heightenedReadiness: TEXT });
    const { info } = await seitePdf('h-layout-bereitschaft', plan, KVK_WOCHE);
    const z = zeilen(laeufe(info));
    const titel = z.filter((x) => x.text === 'Erhöhte Bereitschaft:');
    const text = z.find((x) => x.text === TEXT);
    expect(titel).toHaveLength(1);
    expect(text).toBeDefined();
    const t = titel[0];
    if (t === undefined || text === undefined) return;
    expect(t.laeufe.every((l) => l.bold)).toBe(true);
    expect(Math.abs(t.x + t.breite / 2 - (text.x + text.breite / 2))).toBeLessThanOrEqual(0.01);
    expect(t.baselineY).toBeLessThan(text.baselineY);
    expect(text.baselineY - t.baselineY).toBeLessThan(2 * t.sizePt);
  });

  it('[R-10-22] ohne erfassten Text: keine Titelzeile (B-Kp-75 «Nur wenn erfasst»)', async () => {
    const { info } = await seitePdf('h-layout-bereitschaft-leer', kvk(), KVK_WOCHE);
    expect(zeilen(laeufe(info)).filter((x) => x.text === 'Erhöhte Bereitschaft:')).toEqual([]);
  });
});
