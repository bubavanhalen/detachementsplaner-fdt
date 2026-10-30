// Titel mit teilweise fett (Beschrieb 5.1 «Im Titel darf ein Teil fett und ein Teil normal sein»; R-5.1-23):
// Klartext plus Fett-Maske je Zeichen. Die Maske folgt Eingaben (gemeinsamer Anfang und Ende), Ctrl+B bzw. der
// Knopf «Fett» schaltet die markierte Stelle um.

import type { RichText } from '../../../model/wap/types';

export interface BoldText {
  readonly text: string;
  /** Fett je UTF-16-Zeichen von `text`. */
  readonly mask: readonly boolean[];
}

export function boldTextOf(runs: RichText): BoldText {
  let text = '';
  const mask: boolean[] = [];
  for (const r of runs) {
    text += r.text;
    for (let i = 0; i < r.text.length; i++) mask.push(r.bold);
  }
  return { text, mask };
}

/** Läufe aus Text und Maske; benachbarte gleiche Stärke zusammengefasst, leerer Text → []. */
export function richOf(b: BoldText): RichText {
  const out: { text: string; bold: boolean }[] = [];
  for (let i = 0; i < b.text.length; i++) {
    const bold = b.mask[i] ?? false;
    const last = out[out.length - 1];
    if (last !== undefined && last.bold === bold) last.text += b.text[i];
    else out.push({ text: b.text[i] ?? '', bold });
  }
  return out;
}

/**
 * Neue Maske nach einer Eingabe: Anfang und Ende bleiben, eingefügte Zeichen erhalten die Stärke des Zeichens davor
 * (am Anfang die des folgenden, in einem leeren Titel `fallback`).
 */
export function editBold(before: BoldText, text: string, fallback: boolean): BoldText {
  const a = before.text;
  let start = 0;
  while (start < a.length && start < text.length && a[start] === text[start]) start += 1;
  let endA = a.length;
  let endB = text.length;
  while (endA > start && endB > start && a[endA - 1] === text[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const bold =
    start > 0
      ? (before.mask[start - 1] ?? fallback)
      : a.length > 0
        ? (before.mask[endA] ?? before.mask[0] ?? fallback)
        : fallback;
  const mask = [
    ...before.mask.slice(0, start),
    ...Array.from({ length: endB - start }, () => bold),
    ...before.mask.slice(endA),
  ];
  return { text, mask };
}

/** Markierte Stelle fett bzw. normal: ist alles fett, wird sie normal, sonst fett. Ohne Markierung unverändert. */
export function toggleBold(b: BoldText, start: number, end: number): BoldText {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(b.text.length, Math.max(start, end));
  if (to <= from) return b;
  const allBold = b.mask.slice(from, to).every((x) => x);
  return { text: b.text, mask: b.mask.map((m, i) => (i >= from && i < to ? !allBold : m)) };
}

export function sameBold(a: BoldText, b: BoldText): boolean {
  return (
    a.text === b.text && a.mask.length === b.mask.length && a.mask.every((m, i) => m === b.mask[i])
  );
}
