// @vitest-environment jsdom
// Paket E1-02e: Interne Notizen nie im Seitenmodell (R-6-08; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» G4,
// J R-6-08 «Unit-Teil»). Kennwort in `internalNote` von Block, Marker und Tag sowie in `removedText` → kein
// TextItem enthält es. Gegenprobe: die gedruckten Felder desselben Blocks erscheinen. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import type { TextItem } from '../../../../src/model/wap/layout/pageModel';
import { block, marker, rt } from '../../support/model/builders';
import { seite } from '../../support/page/seite';
import { EINTAG, eintagPlan, KVK_WOCHE, MO, mitTagen } from '../../support/page/varianten';

const KENNWORT = 'GEHEIMWORT';

describe('Interne Notizen (R-6-08)', () => {
  it('[R-6-08] Kennwort in internalNote (Block, Marker, Tag) und removedText: kein TextItem enthält es; Titel und Ort des Blocks erscheinen', () => {
    const b = block('e20', 20, {
      date: MO,
      time: { form: 'range', from: 480, to: 720 },
      columns: { kind: 'ids', ids: [EINTAG.p1, EINTAG.p2] },
      title: rt('Sichtbarer Titel', true),
      ort: 'Kaserne',
      internalNote: `Notiz ${KENNWORT}`,
      removedText: [KENNWORT, `alt ${KENNWORT}`],
    });
    const m = marker('e21', 21, { date: MO, at: 420, internalNote: KENNWORT });
    const plan = mitTagen(eintagPlan([b, m]), KVK_WOCHE, (d, i) =>
      i === 0 ? { internalNote: `Tag ${KENNWORT}` } : d,
    );
    const L = seite(plan, KVK_WOCHE);
    const texte = L.pages.flatMap((p) =>
      p.items
        .filter((i): i is TextItem => i.kind === 'text')
        .map((t) => t.runs.map((r) => r.text).join('')),
    );
    expect(texte.filter((t) => t.includes(KENNWORT))).toEqual([]);
    expect(texte.some((t) => t.includes('Sichtbarer Titel'))).toBe(true);
    expect(texte.some((t) => t.includes('(Kaserne)'))).toBe(true);
  });
});
