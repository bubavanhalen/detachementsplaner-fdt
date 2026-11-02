// Zerlegung einer Terminzeile nach dem Muster in Beschrieb 4.8 (Beschrieb 8.2 Regel 1, 2, 12;
// R-8.2-04 bis -08, R-8.2-34; normalisierung.md 5.5). Rein. Zeiten werden nicht gerundet; eine Zeit
// ausserhalb des 5-Minuten-Rasters ergibt `uncertain`.

import type { TimeSpec } from '../../../model/wap/types';
import type { ShapeTextRun } from '../../xlsx-drawing/index';
import { cleanText, isRed } from '../formtext';

export interface AgendaWindow {
  readonly time: TimeSpec;
  readonly supplement: string;
}

export interface ParsedAgendaLine {
  readonly number: number | null;
  /** Erste Zeit (bei mehreren Zeitfenstern die des ersten), sonst null. */
  readonly time: TimeSpec | null;
  /** Frist: Tag und Monat aus «bis dd.mm.» (Jahr optional), sonst null. */
  readonly deadline: {
    readonly day: number;
    readonly month: number;
    readonly year: number | null;
  } | null;
  readonly windows: readonly AgendaWindow[];
  readonly title: string;
  readonly ltg: string;
  readonly tn: string;
  readonly tpt: string;
  readonly ort: string;
  /** Text ohne Nummer, wenn er nicht dem Muster folgt (Freitext), sonst null. */
  readonly freeText: string | null;
  /** Ganzer gültiger Text ohne Nummer (mit Schlusspunkt), z.B. für ganztägige Bemerkungen. */
  readonly rest: string;
  /** Zeit nur im Text, nicht am Anfang (normalisierung 5.10 «Zeit im Text»), sonst null. */
  readonly timeInText: string | null;
  readonly cancelledParts: readonly string[];
  /** Die Nummer ist rot durchgestrichen: der ganze Eintrag ist gestrichen (Regel 2). */
  readonly cancelled: boolean;
  readonly changed: boolean;
  readonly uncertain: boolean;
}

const HHMM = '([01]\\d|2[0-4])([0-5]\\d)';
const RANGE_RE = new RegExp(`^${HHMM}\\s*-\\s*${HHMM}(?![\\d.])`);
const WORD_RE = new RegExp(`^(ab|bis)\\s+${HHMM}(?![\\d.])`, 'i');
const DEADLINE_RE =
  /^bis\s+(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?(?:\s+([01]\d|2[0-4])([0-5]\d))?(?![\d])/i;
const POINT_RE = new RegExp(`^${HHMM}(?![\\d.])`);

const minutes = (h: string | undefined, m: string | undefined): number =>
  Number(h) * 60 + Number(m);
const onGrid = (t: number): boolean => t % 5 === 0;
const to5 = (t: number): number => Math.round(t / 5) * 5;

interface TimeMatch {
  readonly time: TimeSpec;
  readonly deadline: ParsedAgendaLine['deadline'];
  readonly length: number;
  readonly uncertain: boolean;
}

/** Zeitangabe am Anfang von `text`, sonst null. */
export function leadingTime(text: string): TimeMatch | null {
  const range = RANGE_RE.exec(text);
  if (range !== null) {
    const from = minutes(range[1], range[2]);
    let to = minutes(range[3], range[4]);
    if (to <= from) to += 1440;
    const uncertain = from % 5 !== 0 || to % 5 !== 0;
    return {
      time: { form: 'range', from: to5(from), to: to5(to) },
      deadline: null,
      length: range[0].length,
      uncertain,
    };
  }
  const deadline = DEADLINE_RE.exec(text);
  if (deadline !== null) {
    const yearText = deadline[3];
    const year =
      yearText === undefined
        ? null
        : yearText.length === 2
          ? 2000 + Number(yearText)
          : Number(yearText);
    const at = deadline[4] === undefined ? undefined : minutes(deadline[4], deadline[5]);
    return {
      time: at === undefined ? { form: 'deadline' } : { form: 'deadline', to: to5(at) },
      deadline: { day: Number(deadline[1]), month: Number(deadline[2]), year },
      length: deadline[0].length,
      uncertain: at !== undefined && !onGrid(at),
    };
  }
  const word = WORD_RE.exec(text);
  if (word !== null) {
    const t = minutes(word[2], word[3]);
    const time: TimeSpec = /^ab/i.test(word[0])
      ? { form: 'from', from: to5(t) }
      : { form: 'until', to: to5(t) };
    return { time, deadline: null, length: word[0].length, uncertain: !onGrid(t) };
  }
  const point = POINT_RE.exec(text);
  if (point !== null) {
    const t = minutes(point[1], point[2]);
    return {
      time: { form: 'point', at: to5(t) },
      deadline: null,
      length: point[0].length,
      uncertain: !onGrid(t),
    };
  }
  return null;
}

type FieldLabel = 'ltg' | 'tn' | 'tpt' | 'ort';

interface Fields extends Readonly<Record<FieldLabel, string>> {
  readonly title: string;
}

/** «Titel, Ltg: …, Tn: …, Tpt: …, Ort: ….» (Beschrieb 4.8); leere Felder entfallen. */
export function splitFields(body: string): Fields {
  const text = body.replace(/\s+/g, ' ').trim().replace(/\.$/, '').trim();
  const labels = /(?:^|[,;]\s*)(Ltg|Tn|Tpt|Ort)\s*:\s*/gi;
  const found: { label: FieldLabel; start: number; end: number }[] = [];
  for (const m of text.matchAll(labels)) {
    // Die Buchstaben des Treffers sind genau eine der vier Feldbezeichnungen (Muster `labels`).
    const label = m[0].replace(/[^a-z]/gi, '').toLowerCase() as FieldLabel;
    found.push({ label, start: m.index, end: m.index + m[0].length });
  }
  const values: Record<FieldLabel, string> = { ltg: '', tn: '', tpt: '', ort: '' };
  found.forEach((f, i) => {
    const next = found[i + 1];
    const value = text
      .slice(f.end, next === undefined ? text.length : next.start)
      .trim()
      .replace(/[,;.]$/, '');
    values[f.label] = values[f.label] === '' ? value : `${values[f.label]}, ${value}`;
  });
  const title = (found[0] === undefined ? text : text.slice(0, found[0].start))
    .trim()
    .replace(/[,;:]$/, '')
    .trim();
  return { title, ...values };
}

/** Mehrere Zeitfenster «‹Titel›: ‹Zeit 1› ‹Zusatz 1›, ‹Zeit 2› ‹Zusatz 2› …» (Beschrieb 4.8). */
function windowsAfterTitle(
  body: string,
): { title: string; first: TimeSpec; windows: AgendaWindow[]; rest: string } | null {
  const colon = body.indexOf(':');
  if (colon <= 0) return null;
  const head = body.slice(0, colon).trim();
  const tail = body.slice(colon + 1).trim();
  const lead = leadingTime(tail);
  if (lead === null) return null;
  const windows: AgendaWindow[] = [];
  const parts = tail.split(/,\s*/);
  let rest = '';
  for (const [i, part] of parts.entries()) {
    const t = leadingTime(part.trim());
    if (t === null) {
      rest = parts.slice(i).join(', ');
      break;
    }
    windows.push({
      time: t.time,
      supplement: part.trim().slice(t.length).trim().replace(/\.$/, ''),
    });
  }
  // Die Zeit am Anfang von `tail` ist die des ersten Zeitfensters (die Muster enthalten kein Komma).
  return windows.length >= 2 ? { title: head, first: lead.time, windows, rest } : null;
}

/**
 * Zerlegt eine Terminzeile (Läufe einer Zeile) nach dem Muster in 4.8; nicht passender Text bleibt
 * Freitext. Rot durchgestrichene Teile sind nie gültiger Text; ist die Nummer gestrichen, gilt der
 * ganze Eintrag als gestrichen (Regel 2).
 */
export function parseAgendaLine(runs: readonly ShapeTextRun[]): ParsedAgendaLine {
  const cancelledParts: string[] = [];
  let changed = false;
  let text = '';
  let numberCancelled = false;
  let seenDigits = false;
  // Nach einer gestrichenen Nummer: gestrichene Läufe und Länge des gültigen Texts bis und mit der Nummer.
  const struckAfterNumber: string[] = [];
  let textAtNumber = 0;
  for (const r of runs) {
    const t = cleanText(r.text);
    const red = isRed(r.color);
    if (r.strike && red) {
      const lead = !seenDigits ? /^\s*(\d{2})(?!\d)/.exec(t) : null;
      if (lead !== null) {
        // Gestrichene Nummer: der ganze Eintrag ist gestrichen; die Nummer bleibt für die Zuordnung (Regel 2).
        numberCancelled = true;
        seenDigits = true;
        text += lead[0];
        textAtNumber = text.length;
        struckAfterNumber.push(t.slice(lead[0].length));
        continue;
      }
      if (numberCancelled) struckAfterNumber.push(t);
      else if (t.trim() !== '') cancelledParts.push(t.trim());
      if (/\d/.test(t)) seenDigits = true;
      continue;
    }
    if (/\d/.test(t)) seenDigits = true;
    if (red && t.trim() !== '') changed = true;
    text += t;
  }
  // Ganze Zeile samt Nummer gestrichen: der gestrichene Text ist der Inhalt des gestrichenen Eintrags
  // (Regel 2, normalisierung 5.9 «Nummer bzw. ganzer Text rot durchgestrichen»; Befund FA-04).
  if (numberCancelled && text.slice(textAtNumber).trim() === '') text += struckAfterNumber.join('');
  else cancelledParts.push(...struckAfterNumber.map((x) => x.trim()).filter((x) => x !== ''));
  text = text.replace(/\s+/g, ' ').trim();
  const numbered = /^(\d{2})(?!\d)\s*(?:-\s*)?/.exec(text);
  const empty: { -readonly [K in keyof ParsedAgendaLine]: ParsedAgendaLine[K] } = {
    number: null,
    time: null,
    deadline: null,
    windows: [],
    title: '',
    ltg: '',
    tn: '',
    tpt: '',
    ort: '',
    freeText: null,
    rest: text,
    timeInText: null,
    cancelledParts,
    cancelled: numberCancelled,
    changed,
    uncertain: false,
  };
  if (numbered === null) {
    const f = splitFields(text);
    return { ...empty, ...f, title: text.replace(/\.$/, '').trim(), freeText: null };
  }
  const number = Number(numbered[1]);
  const after = text.slice(numbered[0].length).trim();
  empty.rest = after;
  const t = leadingTime(after);
  if (t !== null) {
    const remainder = after.slice(t.length);
    const colon = /^\s*[:-]/.test(remainder);
    const body = remainder.replace(/^\s*[:-]?\s*/, '');
    const f = splitFields(body);
    const plainTitle = f.title !== '' || body === '';
    return {
      ...empty,
      number,
      time: t.time,
      deadline: t.deadline,
      windows: [{ time: t.time, supplement: '' }],
      ...f,
      freeText: plainTitle ? null : body,
      uncertain: t.uncertain || !colon,
    };
  }
  const multi = windowsAfterTitle(after);
  if (multi !== null) {
    const f = splitFields(multi.rest === '' ? multi.title : `${multi.title}, ${multi.rest}`);
    return {
      ...empty,
      number,
      time: multi.first,
      windows: multi.windows,
      ...f,
      title: multi.title,
    };
  }
  // Ohne Zeit am Anfang: eine Zeit im Text ergibt einen Beso mit Freitext (normalisierung 5.5 «Freitext»).
  const inner = /(?:^|[\s(])([01]\d|2[0-4])([0-5]\d)(?=[\s;,.)]|$)/.exec(after);
  const free = after.replace(/\.$/, '').trim();
  if (inner !== null) {
    const at = to5(minutes(inner[1], inner[2]));
    return {
      ...empty,
      number,
      time: { form: 'point', at },
      windows: [{ time: { form: 'point', at }, supplement: '' }],
      title: free,
      freeText: free,
      timeInText: inner[0].slice(-4),
      uncertain: true,
    };
  }
  const f = splitFields(after);
  return { ...empty, number, ...f, freeText: free };
}
