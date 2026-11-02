// Vorschau beim Ziehen (Paket PERF, R-5.1-14, R-11-11; I2b-A A7; Beschrieb 11 «Ziehen folgt der Maus ohne sichtbare
// Verzögerung»): Während des Ziehens bleibt das Raster aus der Layout-Schicht unverändert. Nur die Nachbarn, deren
// Zeiten sich anpassen, und die Teilstücke ausgesparter Blöcke werden neu gesetzt: an ihrer neuen Lage mit der
// Zeichnung aus der Layout-Schicht, auf die neue Fläche zugeschnitten (der Browser bricht nie selbst um, ADR-004).
// Das volle Layout folgt nach dem Loslassen aus dem neuen Planstand.

import type { Id, IsoDate } from '../../../model/wap/types';
import type { EntryView } from './entryViews';
import type { DayBox } from './geometry';

/** Kennung des Eintrags einer Vorschau-Ansicht (Teilstücke tragen «<ID>~<Nr>»). */
function sourceOf(id: Id): Id {
  const i = id.indexOf('~');
  return i < 0 ? id : id.slice(0, i);
}

/**
 * Vorschau-Ansicht: Lage und Zeiten aus `raw`, Zeichnung aus der bisherigen Ansicht desselben Eintrags. Ohne bisherige
 * Zeichnung (Eintrag war nicht sichtbar) entfällt die Vorschau; nach dem Loslassen zeichnet das volle Layout.
 */
function previewOf(raw: EntryView, laid: readonly EntryView[]): EntryView | null {
  const id = sourceOf(raw.id);
  const before = laid.find(
    (v) => v.id === id && v.kind === raw.kind && v.windowId === raw.windowId,
  );
  if (before?.render === undefined) return null;
  return { ...raw, pieces: [], textPiece: 0, z: before.z, render: before.render };
}

/**
 * Ansichten beim Ziehen: `laid` (Layout des Planstands) mit der Vorschau an den Tagen `dates`. `rawOf` liefert die
 * Ansichten eines Tages ohne Layout aus den Einträgen mit Vorschau; gerufen nur für diese Tage. Ohne Vorschau ist das
 * Ergebnis `laid` selbst.
 */
export function withPreview(
  laid: ReadonlyMap<IsoDate, readonly EntryView[]>,
  days: readonly DayBox[],
  rawOf: (day: DayBox) => readonly EntryView[],
  changed: ReadonlySet<Id>,
  dates: ReadonlySet<IsoDate>,
): ReadonlyMap<IsoDate, readonly EntryView[]> {
  if (changed.size === 0 && dates.size === 0) return laid;
  const out = new Map(laid);
  for (const day of days) {
    const list = laid.get(day.date) ?? [];
    const stale = list.some((v) => changed.has(v.id));
    if (!stale && !dates.has(day.date)) continue;
    const previews = dates.has(day.date)
      ? rawOf(day)
          .filter((v) => changed.has(v.id) || v.id.includes('~'))
          .map((v) => previewOf(v, list))
          .filter((v): v is EntryView => v !== null)
      : [];
    out.set(day.date, [...list.filter((v) => !changed.has(v.id)), ...previews]);
  }
  return out;
}
