// Terminzeilen und Titel mit Beso-Verweisen (Vertrag E1-02a Abschnitt 3 und 8 P-11, P-12, P-15; Beschrieb 4.8).

import { compareEntries, formatTimeSpec, sortTime } from '../time';
import type {
  Beso,
  BesoTimeWindow,
  Id,
  IsoDate,
  Plan,
  RichText,
  TextRun,
  TimeSpec,
} from '../types';

function run(text: string, bold = false): TextRun {
  return { text, bold };
}

/** Läufe ohne leeren Text, benachbarte Läufe gleicher Stärke zusammengefasst (P-12). */
function merge(runs: readonly TextRun[]): RichText {
  const out: TextRun[] = [];
  for (const r of runs.filter((x) => x.text !== '')) {
    const last = out[out.length - 1];
    if (last !== undefined && last.bold === r.bold) {
      out[out.length - 1] = run(last.text + r.text, r.bold);
    } else {
      out.push(run(r.text, r.bold));
    }
  }
  return out;
}

function plainText(r: RichText): string {
  return r.map((x) => x.text).join('');
}

/** Teile durch «, » verbinden. */
function joinParts(parts: readonly RichText[]): TextRun[] {
  return parts.flatMap((p, i) => (i === 0 ? [...p] : [run(', '), ...p]));
}

function windowText(w: BesoTimeWindow, date: IsoDate): string {
  const time = formatTimeSpec(w.time, date);
  const supplement = w.supplement.trim();
  return supplement === '' ? time : `${time} ${supplement}`;
}

/**
 * Entfernt Leerraum (auch U+00A0) am Anfang und Ende des Gesamttexts über Läufe hinweg; Fettstärke
 * bleibt, Leerraum im Innern bleibt (Änderungsnotiz N-3).
 */
function trimRuns(runs: RichText): RichText {
  const out = [...runs];
  while (out.length > 0) {
    const first = out[0] as TextRun;
    const text = first.text.trimStart();
    if (text !== '') {
      out[0] = run(text, first.bold);
      break;
    }
    out.shift();
  }
  while (out.length > 0) {
    const last = out[out.length - 1] as TextRun;
    const text = last.text.trimEnd();
    if (text !== '') {
      out[out.length - 1] = run(text, last.bold);
      break;
    }
    out.pop();
  }
  return out;
}

/** besoRef → «(‹Nr›)» bzw. «(–)»; bold bleibt (R-5.3-11). */
export function resolveTitle(plan: Plan, title: RichText): RichText {
  return title.map((r) => {
    if (r.besoRef === undefined) return run(r.text, r.bold);
    const target = plan.entries[r.besoRef];
    const number = target?.type === 'beso' ? target.besoNumber : null;
    return run(number === null ? '(–)' : `(${number})`, r.bold);
  });
}

/** Terminzeile eines Beso (R-4.8-04, R-4.8-05, R-4.8-08, R-4.6-28; F-11, F-14, F-57; P-12, P-15). */
export function agendaLine(b: Beso, plan: Plan): RichText {
  const nr = b.besoNumber === null ? '–' : String(b.besoNumber);
  // Freitext leer oder nur Leerraum gilt wie null; sonst am Rand getrimmt (N-2, TR-E102a-28).
  const override = (b.agendaOverride ?? '').trim();
  if (override !== '') return merge([run(`${nr} ${override}`)]);

  const title = trimRuns(resolveTitle(plan, b.title));
  const hasTitle = title.length > 0;
  const parts: RichText[] = (
    [
      ['Ltg', b.ltg],
      ['Tn', b.tn],
      ['Tpt', b.tpt],
      ['Ort', b.ort],
    ] as const
  )
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value !== '')
    .map(([label, value]) => [run(`${label}: ${value}`)]);

  const titles: RichText[] = hasTitle ? [title] : [];
  const only = b.windows.length === 1 ? b.windows[0] : undefined;
  const single = only !== undefined && only.supplement.trim() === '';
  // Ein Zeitfenster ohne Zusatz: «‹Nr› ‹Zeit›: ‹Titel›, ‹Teile›.»
  // Sonst: «‹Nr› ‹Titel›: ‹Zeit 1› ‹Zusatz 1›, ‹Zeit 2› ‹Zusatz 2›, ‹Teile›.» (F-11, V-02a-2, P-15)
  const head: RichText[] = single
    ? [[run(`${nr} ${windowText(only, b.date)}`)]]
    : [[run(nr)], ...titles];
  const rest: RichText[] = single
    ? [...titles, ...parts]
    : [...b.windows.map((w) => [run(windowText(w, b.date))]), ...parts];
  const runs: TextRun[] = head.flatMap((h, i) => (i === 0 ? [...h] : [run(' '), ...h]));
  // Der Doppelpunkt steht nur nach Zeit oder Titel und nur, wenn ihm etwas folgt (P-15).
  if (rest.length > 0) runs.push(run(single || hasTitle ? ': ' : ' '), ...joinParts(rest));
  if (!plainText(runs).endsWith('.')) runs.push(run('.'));
  return merge(runs);
}

export interface AgendaLine {
  readonly entryId: Id;
  readonly number: number | null;
  readonly text: RichText;
}

/** Zeit des frühesten Zeitfensters nach Sortierzeit (bei Gleichstand das erste; stabile Sortierung). */
function earliestTime(b: Beso): TimeSpec {
  const sorted = [...b.windows].sort((x, y) => sortTime(x.time) - sortTime(y.time));
  return sorted[0]?.time ?? { form: 'deadline' };
}

function compareBeso(a: Beso, b: Beso): number {
  if (a.besoNumber !== b.besoNumber) {
    if (a.besoNumber === null) return 1;
    if (b.besoNumber === null) return -1;
    return a.besoNumber - b.besoNumber;
  }
  return compareEntries(
    { time: earliestTime(a), createdSeq: a.createdSeq },
    { time: earliestTime(b), createdSeq: b.createdSeq },
  );
}

/** Beso nach Nummer (null zuletzt), danach ganztägige Bemerkungen nach createdSeq (R-4.8-09, F-12). */
export function agendaLinesForDate(plan: Plan, date: IsoDate): readonly AgendaLine[] {
  const entries = Object.values(plan.entries);
  const besoLines = entries
    .filter((e): e is Beso => e.type === 'beso' && e.date === date)
    .sort(compareBeso)
    .map((b): AgendaLine => ({ entryId: b.id, number: b.besoNumber, text: agendaLine(b, plan) }));
  const remarkLines = entries
    .flatMap((e) => (e.type === 'dayRemark' && e.date === date ? [e] : []))
    .sort((a, b) => a.createdSeq - b.createdSeq)
    .map((r): AgendaLine => ({ entryId: r.id, number: null, text: [run(r.text)] }));
  return [...besoLines, ...remarkLines];
}
