// @vitest-environment node
// F-ABDECKUNG2: Zelländerung der Listenansicht als Befehl (Vertrag E1-15 §2 «commitCell», «isEditable»; R-6-15,
// R-4.6-13, R-4.6-33, R-5.1-13, R-5.7-03). Je Eintragstyp und Spalte: welche Zellen bearbeitbar sind, welcher
// Befehl entsteht (Wirkung auf das Modell, ein Undo-Schritt) und welche Meldung ungültige Werte erhalten.
import { describe, expect, it } from 'vitest';
import {
  commitCell,
  isEditable,
  type ListColumnKey,
} from '../../../../src/components/wap/list/commit';
import { WapError } from '../../../../src/model/wap/errors';
import { type ListRow, listRows } from '../../../../src/model/wap/list/index';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { undo } from '../../support/i3/plan';
import { CTX, entryOf, fixture } from './ui';

function rowOf(plan: Plan, id: Id, windowIndex = 0): ListRow {
  const rows = listRows(plan, 'plan').filter((r) => r.entryId === id);
  const row = rows[windowIndex];
  if (row === undefined) throw new Error(`Zeile für ${id} fehlt`);
  return row;
}

function meldung(f: () => unknown): { cause: string; nextStep: string } {
  try {
    f();
  } catch (e) {
    if (e instanceof WapError) return e.userMessage;
    throw e;
  }
  throw new Error('keine Meldung');
}

const f = fixture();
const P = f.plan;

/** Zelle ändern; liefert den neuen Plan und prüft, dass Undo den alten Stand ergibt. */
function setze(id: Id, key: ListColumnKey, value: string, windowIndex = 0): Plan {
  const r = commitCell(P, rowOf(P, id, windowIndex), key, value)(P, CTX);
  expect(undo(r).entries[id]).toEqual(P.entries[id]);
  return r.plan;
}

describe('F-ABDECKUNG2 Listenansicht: bearbeitbare Zellen je Typ', () => {
  it('[R-6-15] Titel und Status immer; Zeit nur Block, Rapport, Marker, Beso; Ltg nur Block und Beso; Ort zusätzlich Rapport; Kategorie ohne Marker und Bemerkungen; Spalten nur Block und Rapport (UX-AB-F-07); Typ, Tag, Nr nie', () => {
    const tabelle: Record<string, readonly ListColumnKey[]> = {
      [f.ids.funk]: ['zeit', 'titel', 'spalten', 'ltg', 'ort', 'kategorie', 'status'],
      [f.ids.visite]: ['zeit', 'titel', 'ltg', 'ort', 'kategorie', 'status'],
      [f.ids.kr]: ['zeit', 'titel', 'spalten', 'ort', 'kategorie', 'status'],
      [f.ids.marker]: ['zeit', 'titel', 'status'],
      [f.ids.querbalken]: ['titel', 'kategorie', 'status'],
      [f.ids.tagBemerkung]: ['titel', 'status'],
      [f.ids.planBemerkung]: ['titel', 'status'],
    };
    const alle: readonly ListColumnKey[] = [
      'tag',
      'zeit',
      'typ',
      'titel',
      'spalten',
      'ltg',
      'ort',
      'nr',
      'kategorie',
      'status',
      'teilaufgaben',
    ];
    for (const [id, erlaubt] of Object.entries(tabelle)) {
      const row = rowOf(P, id);
      expect(alle.filter((k) => isEditable(row, k, P))).toEqual(erlaubt);
    }
    const weg = { ...rowOf(P, f.ids.funk), entryId: 'gibt-es-nicht' };
    expect(alle.some((k) => isEditable(weg, k, P))).toBe(false);
  });
});

describe('F-ABDECKUNG2 Listenansicht: Befehle je Zelle', () => {
  it('[R-5.1-13] Titel: Block und Querbalken behalten den Fettdruck des ersten Laufs, Beso bleibt normal; leerer Titel ergibt keine Läufe', () => {
    expect(entryOf(setze(f.ids.funk, 'titel', ' Funk neu '), f.ids.funk)).toMatchObject({
      title: [{ text: 'Funk neu', bold: true }],
    });
    expect(entryOf(setze(f.ids.visite, 'titel', 'Besuch'), f.ids.visite)).toMatchObject({
      title: [{ text: 'Besuch', bold: false }],
    });
    expect(entryOf(setze(f.ids.querbalken, 'titel', 'Phase 2'), f.ids.querbalken)).toMatchObject({
      title: [{ text: 'Phase 2', bold: true }],
    });
    expect(entryOf(setze(f.ids.funk, 'titel', '   '), f.ids.funk)).toMatchObject({ title: [] });
    // Ohne früheren Titel: Block fett (Vorgabe für neue Titel).
    const leer = commitCell(P, rowOf(P, f.ids.funk), 'titel', '')(P, CTX).plan;
    const neu = commitCell(leer, rowOf(leer, f.ids.funk), 'titel', 'Wieder')(leer, CTX).plan;
    expect(entryOf(neu, f.ids.funk)).toMatchObject({ title: [{ text: 'Wieder', bold: true }] });
  });

  it('[R-4.6-13] Marker: AV, ABV, HV werden erkannt (Gross/Klein egal), jeder andere Text wird eine freie Art', () => {
    expect(entryOf(setze(f.ids.marker, 'titel', ' hv '), f.ids.marker)).toMatchObject({
      kind: 'HV',
      customKind: '',
    });
    expect(entryOf(setze(f.ids.marker, 'titel', 'Abv'), f.ids.marker)).toMatchObject({
      kind: 'ABV',
    });
    expect(entryOf(setze(f.ids.marker, 'titel', ' Appell '), f.ids.marker)).toMatchObject({
      kind: 'custom',
      customKind: 'Appell',
    });
  });

  it('[R-6-15] Bemerkungen, Rapportkürzel, Ltg und Ort: Text übernommen (Ltg und Ort ohne Rand-Leerraum)', () => {
    expect(
      entryOf(setze(f.ids.tagBemerkung, 'titel', 'Fassung Mat'), f.ids.tagBemerkung),
    ).toMatchObject({
      text: 'Fassung Mat',
    });
    expect(entryOf(setze(f.ids.planBemerkung, 'titel', 'Neu'), f.ids.planBemerkung)).toMatchObject({
      text: 'Neu',
    });
    expect(entryOf(setze(f.ids.kr, 'titel', 'AR1'), f.ids.kr)).toMatchObject({ code: 'AR1' });
    expect(entryOf(setze(f.ids.visite, 'ltg', ' Oblt Probe '), f.ids.visite)).toMatchObject({
      ltg: 'Oblt Probe',
    });
    expect(entryOf(setze(f.ids.visite, 'ort', ' Platz '), f.ids.visite)).toMatchObject({
      ort: 'Platz',
    });
    expect(entryOf(setze(f.ids.kr, 'ort', ' KP '), f.ids.kr)).toMatchObject({ ort: 'KP' });
    expect(entryOf(setze(f.ids.funk, 'ort', ' Wald '), f.ids.funk)).toMatchObject({ ort: 'Wald' });
  });

  it('[R-6-15] Zeit: Block alle Formen ausser Frist, Rapport Zeitpunkt oder von–bis, Beso je Zeitfenster', () => {
    expect(entryOf(setze(f.ids.funk, 'zeit', 'ab 0900'), f.ids.funk)).toMatchObject({
      time: { form: 'from', from: 540 },
    });
    expect(entryOf(setze(f.ids.kr, 'zeit', '0700-0730'), f.ids.kr)).toMatchObject({
      time: { form: 'range', from: 420, to: 450 },
    });
    const p = setze(f.ids.visite, 'zeit', 'bis 1700', 1);
    const v = entryOf(p, f.ids.visite);
    expect(v.type === 'beso' && v.windows.map((w) => w.time)).toEqual([
      { form: 'point', at: 840 },
      { form: 'until', to: 1020 },
    ]);
    // Zeile ohne Zeitfenster-Kennung: das erste Zeitfenster.
    const row = { ...rowOf(P, f.ids.visite), windowId: null };
    const q = commitCell(P, row, 'zeit', '1300')(P, CTX).plan;
    const w = entryOf(q, f.ids.visite);
    expect(w.type === 'beso' && w.windows[0]?.time).toEqual({ form: 'point', at: 780 });
    // Frist beim Beso erlaubt (Frist-Tag = Tag des Eintrags).
    expect(entryOf(setze(f.ids.frist, 'zeit', 'bis 30.09. 1200'), f.ids.frist)).toMatchObject({
      windows: [{ time: { form: 'deadline', to: 720 } }],
    });
  });

  it('[FA2-03][R-4.6-35][R-5.7-04] Frist mit anderem Datum als dem Tag des Eintrags: der Beso (ein Zeitfenster) rückt auf den Frist-Tag; mit mehreren Zeitfenstern Ablehnung mit Ursache und nächstem Schritt', () => {
    // Behoben F-UX5 (Koordinator 26.10.2026): eine Frist gilt am Tag des Eintrags (types.ts, R-4.6-36); das Datum der
    // Eingabe geht nie still verloren.
    const p = setze(f.ids.frist, 'zeit', 'bis 02.10.');
    const e = entryOf(p, f.ids.frist);
    expect(e).toMatchObject({ date: '2026-10-02', windows: [{ time: { form: 'deadline' } }] });
    const zeile = listRows(p, 'plan').find((r) => r.entryId === f.ids.frist);
    expect(zeile?.bis).toBe('02.10.2026');
    expect(
      meldung(() => commitCell(P, rowOf(P, f.ids.visite), 'zeit', 'bis 02.10.')(P, CTX)),
    ).toEqual({
      cause:
        'Die Frist bis 02.10. liegt an einem anderen Tag als der Beso (Mo 28.09.); ein Beso mit mehreren Zeitfenstern bleibt an seinem Tag.',
      nextStep: 'Eine Frist am 28.09. eingeben oder das Zeitfenster als eigenen Beso anlegen.',
    });
  });

  it('[R-6-15] Kategorie: Block, Beso, Rapport, Querbalken aus der Legende; Beso auch «keine»', () => {
    const bat = P.legend[0]?.id as Id;
    for (const id of [f.ids.funk, f.ids.visite, f.ids.kr, f.ids.querbalken])
      expect(entryOf(setze(id, 'kategorie', bat), id)).toMatchObject({ categoryId: bat });
    expect(entryOf(setze(f.ids.visite, 'kategorie', ''), f.ids.visite)).toMatchObject({
      categoryId: null,
    });
  });

  it('[R-4.6-33] Status: bestätigt, offen, gestrichen; «geändert» ist eine Markierung und nicht wählbar', () => {
    expect(entryOf(setze(f.ids.kr, 'status', 'gestrichen'), f.ids.kr)).toMatchObject({
      status: 'cancelled',
    });
    expect(
      entryOf(setze(f.ids.planBemerkung, 'status', 'offen'), f.ids.planBemerkung),
    ).toMatchObject({
      status: 'open',
    });
    const offen = setze(f.ids.funk, 'status', 'offen');
    const wieder = commitCell(
      offen,
      rowOf(offen, f.ids.funk),
      'status',
      'bestätigt',
    )(offen, CTX).plan;
    expect(entryOf(wieder, f.ids.funk)).toMatchObject({ status: 'confirmed' });
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.funk), 'status', 'geändert'))).toEqual({
      cause: '«geändert» ist eine Markierung, kein Status; sie gilt bis zum nächsten Stand.',
      nextStep: 'Bestätigt, offen oder gestrichen wählen.',
    });
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.funk), 'status', 'erledigt'))).toEqual({
      cause: 'Der Status ist unbekannt.',
      nextStep: 'Bestätigt, offen oder gestrichen wählen.',
    });
  });
});

describe('F-ABDECKUNG2 Listenansicht: Spalten-Zelle (UX-AB-F-07)', () => {
  it('[R-6-15] Block: «alle» oder eine Spanne von Planungsspalten; Rapport: nur Rap, Rap und Spalten, nur Spalten; unbekannter Wert mit Meldung', () => {
    const c = (i: number) => P.columnSets[0]?.columns[i]?.id ?? '';
    expect(entryOf(setze(f.ids.funk, 'spalten', 'all'), f.ids.funk)).toMatchObject({
      columns: { kind: 'all' },
    });
    expect(entryOf(setze(f.ids.funk, 'spalten', `ids:${c(2)},${c(3)}`), f.ids.funk)).toMatchObject({
      columns: { kind: 'ids', ids: [c(2), c(3)] },
    });
    expect(entryOf(setze(f.ids.kr, 'spalten', 'rap+all'), f.ids.kr)).toMatchObject({
      display: 'alsoInColumns',
      displayColumns: { kind: 'all' },
    });
    expect(entryOf(setze(f.ids.kr, 'spalten', `only:ids:${c(0)}`), f.ids.kr)).toMatchObject({
      display: 'onlyInColumns',
      displayColumns: { kind: 'ids', ids: [c(0)] },
    });
    const auch = setze(f.ids.kr, 'spalten', 'rap+all');
    const zurueck = commitCell(auch, rowOf(auch, f.ids.kr), 'spalten', 'rap')(auch, CTX).plan;
    expect(entryOf(zurueck, f.ids.kr)).toMatchObject({
      display: 'rapColumn',
      displayColumns: { kind: 'ids', ids: [] },
    });
    // Spalten auch als Text wie in der Liste (F-UX6, UX-AB-G-01): mehrere Spalten; ein unbekannter Name wird mit Ursache
    // und nächstem Schritt abgelehnt, nie still durch eine andere Spalte ersetzt.
    const name = (i: number) => P.columnSets[0]?.columns[i]?.name ?? '';
    expect(entryOf(setze(f.ids.kr, 'spalten', `Rap, ${name(0)}`), f.ids.kr)).toMatchObject({
      display: 'alsoInColumns',
      displayColumns: { kind: 'ids', ids: [c(0)] },
    });
    expect(
      entryOf(setze(f.ids.funk, 'spalten', `${name(3)}, ${name(2)}`), f.ids.funk),
    ).toMatchObject({ columns: { kind: 'ids', ids: [c(2), c(3)] } });
    const unbekannt = (s: string) => ({
      cause: `Die Spalte «${s}» gibt es an diesem Tag nicht.`,
      nextStep:
        'Spaltennamen des Tages mit Komma eingeben, z.B. «Rap, …» (Vorschläge mit Alt+↓), oder die Spalten im Seitenfeld wählen.',
    });
    for (const [id, value, bad] of [
      [f.ids.funk, 'ids:', 'ids:'],
      [f.ids.funk, `${name(0)}, Xyz`, 'Xyz'],
      [f.ids.kr, 'rap+ids:', 'ids:'],
    ] as const)
      expect(
        meldung(() => commitCell(P, rowOf(P, id), 'spalten', value)),
        value,
      ).toEqual(unbekannt(bad));
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.funk), 'spalten', 'Rap'))).toEqual({
      cause: 'Ein Block liegt nicht in der Rap-Spalte.',
      nextStep: 'Planungsspalten des Tages eingeben, z.B. «alle» oder Spaltennamen mit Komma.',
    });
  });
});

describe('F-ABDECKUNG2 Listenansicht: Meldungen bei ungültigen Zelländerungen', () => {
  const NICHT = {
    cause: 'Diese Zelle lässt sich in der Liste nicht ändern.',
    nextStep: 'Den Eintrag im Raster bearbeiten.',
  };

  it('[R-5.7-03] nicht änderbare Zellen: Tag, Spalten beim Marker und Beso, Ltg beim Rapport, Ort beim Marker, Kategorie beim Marker, Zeit bei der ganztägigen Bemerkung', () => {
    const faelle: readonly (readonly [Id, ListColumnKey, string])[] = [
      [f.ids.funk, 'tag', 'Di'],
      [f.ids.marker, 'spalten', 'all'],
      [f.ids.visite, 'spalten', 'all'],
      [f.ids.kr, 'ltg', 'Kp Kdt'],
      [f.ids.marker, 'ort', 'Halle'],
      [f.ids.marker, 'kategorie', P.legend[0]?.id ?? ''],
      [f.ids.tagBemerkung, 'zeit', '0800'],
    ];
    for (const [id, key, value] of faelle)
      expect(
        meldung(() => commitCell(P, rowOf(P, id), key, value)),
        `${id} ${key}`,
      ).toEqual(NICHT);
  });

  it('[R-5.7-03] Eintrag nicht mehr vorhanden, unbekannte Kategorie, ungültige Zeit, Frist beim Block, Rapport ab, Marker von–bis', () => {
    const weg = { ...rowOf(P, f.ids.funk), entryId: 'gibt-es-nicht' };
    expect(meldung(() => commitCell(P, weg, 'titel', 'x'))).toEqual({
      cause: 'Der Eintrag ist nicht mehr vorhanden.',
      nextStep: 'Die Liste neu sortieren oder filtern.',
    });
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.funk), 'kategorie', 'k999'))).toEqual({
      cause: 'Die Kategorie ist in der Legende nicht vorhanden.',
      nextStep: 'Eine Kategorie aus der Liste wählen.',
    });
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.funk), 'kategorie', ''))).toEqual({
      cause: 'Die Kategorie ist in der Legende nicht vorhanden.',
      nextStep: 'Eine Kategorie aus der Liste wählen.',
    });
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.funk), 'zeit', '0803'))).toEqual({
      cause: 'Zeiten sind auf 5 Minuten genau, z.B. 0830 oder 0835.',
      nextStep: 'Zeit wie «0800-1200», «0800», «ab 1900» oder «bis 1200» eingeben.',
    });
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.funk), 'zeit', 'bis 01.10.'))).toEqual({
      cause: 'Ein Block kann keine Frist haben.',
      nextStep: 'Zeit wie «0800-1200» eingeben.',
    });
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.kr), 'zeit', 'bis 0800')).cause).toBe(
      'Ein Rapport hat einen Zeitpunkt oder eine Zeit von–bis.',
    );
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.marker), 'zeit', 'ab 2200'))).toEqual({
      cause: 'Ein Marker hat einen Zeitpunkt.',
      nextStep: 'Zeit wie «2330» eingeben.',
    });
    expect(meldung(() => commitCell(P, rowOf(P, f.ids.kr), 'titel', ''))).toEqual({
      cause: 'Das Kürzel des Rapports fehlt.',
      nextStep: 'Ein Kürzel wie «KR» eingeben.',
    });
  });
});
