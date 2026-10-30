// Zerlegung des Formtexts (Beschrieb 8.2 Regel 2 und 12; Gate S A1; R-8.2-05 bis -07, R-8.2-29 bis
// R-8.2-38; normalisierung.md 5.1, 13 N-17/N-18; Q-044 (a)–(c), Q-045 (g)). Rein.

import type { FunctionEntry, Person, RichText, Subtask, TextRun } from '../../../model/wap/types';
import type { ShapeTextRun } from '../../xlsx-drawing/index';

export interface FormTextContext {
  readonly persons: readonly Person[];
  readonly functionList: readonly FunctionEntry[];
  readonly ltgInBlock: 'withOrt' | 'ownLinePrefixed';
}

export interface ParsedShapeText {
  readonly title: RichText;
  readonly ltg: string;
  readonly ort: string;
  readonly tenue: string;
  readonly supplement: string;
  /** Unsichere Zerlegung (R-8.2-35): Gründe in `uncertainReasons`. */
  readonly uncertain: boolean;
  readonly uncertainReasons: readonly string[];
  /** Teilaufgaben nach Gate S A1 (R-8.2-37, R-8.2-38); [] = keine. */
  readonly subtasks: readonly Subtask[];
  /** Führende Zeitangabe im Text (z.B. «0830-0900»), sonst null (normalisierung.md 5.1). */
  readonly timeInText: string | null;
  /** Rot durchgestrichen (Regel 2): ganzer Text gestrichen. */
  readonly cancelled: boolean;
  /** Roter, nicht gestrichener Text (Regel 2): «geändert». */
  readonly changed: boolean;
  /** Rot durchgestrichene Teile, nie gültiger Text (F-30). */
  readonly removedText: readonly string[];
  /** Gültiger Text aller Zeilen, mit Leerzeichen verbunden (für Vergleiche und Rapportkürzel). */
  readonly plain: string;
}

/** Rot im Sinn von Regel 2: kräftiger Rotanteil, wenig Grün und Blau. */
export function isRed(hex: string | null): boolean {
  if (hex === null || !/^[0-9a-f]{6}$/i.test(hex)) return false;
  const n = Number.parseInt(hex, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r >= 0xa0 && g <= 0x60 && b <= 0x60;
}

/** Zusammengefasster Leerraum, Striche als «-» (normalisierung.md Abschnitt 4). */
export function cleanText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u00A0\u2007\u202F\t]/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ');
}

interface Seg {
  readonly text: string;
  readonly bold: boolean;
}
interface Line {
  readonly segs: readonly Seg[];
}

const lineText = (l: Line): string =>
  l.segs
    .map((s) => s.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
const isEmpty = (l: Line): boolean => lineText(l) === '';
const isBold = (l: Line): boolean => l.segs.some((s) => s.bold && s.text.trim() !== '');

/** Grade der Armee (für die Erkennung eines Personennamens in Klammern, Regel 12). */
const GRADES =
  /^(?:Rekr|Sdt|Gfr|Obgfr|Kpl|Wm|Obwm|Fw|Four|Hptfw|Adj\s?Uof|Stabsadj|Hptadj|Chefadj|Lt|Oblt|Hptm|Maj|Oberstlt|Oberst|Br|Div|KKdt|Fachof|Fachspez)\b\.?\s+\S/;

function normName(s: string): string {
  return cleanText(s).trim().toLowerCase();
}

/** Grad allein (z.B. «Hptfw», «Four»): bezeichnet den Inhaber der Funktion (Regel 12; UX-AB-01). */
const GRADE_ALONE =
  /^(?:Rekr|Sdt|Gfr|Obgfr|Kpl|Wm|Obwm|Fw|Four|Hptfw|Adj\s?Uof|Stabsadj|Hptadj|Chefadj|Lt|Oblt|Hptm|Maj|Oberstlt|Oberst|Fachof|Fachspez)\.?$/;

/**
 * Wie sicher ist der Text ein Name bzw. eine Funktion (Regel 12)? `list`: Funktion oder Person der Listen bzw. Grad
 * allein; `grade`: Grad mit weiterem Text, ohne Personenliste nicht prüfbar; `functionPart`: Funktionsbezeichnung
 * ohne Einheit (letztes Wort einer Funktion, z.B. «Kdt» aus «Kp Kdt»); null: kein Name.
 */
type NameMatch = 'list' | 'grade' | 'functionPart' | null;

function nameMatch(text: string, ctx: FormTextContext): NameMatch {
  const t = normName(text).replace(/[.,;:]+$/, '');
  if (t === '') return null;
  for (const f of ctx.functionList) {
    const code = normName(f.code);
    if (code !== '' && (t === code || t.startsWith(`${code} `) || t.startsWith(`${code},`)))
      return 'list';
  }
  for (const p of ctx.persons) {
    const names = [
      `${p.grad} ${p.name}`,
      `${p.grad} ${p.name} ${p.vorname}`,
      `${p.grad} ${p.vorname} ${p.name}`,
      p.name,
      p.funktion,
    ].map(normName);
    if (names.some((n) => n !== '' && (t === n || t.startsWith(`${n} `)))) return 'list';
  }
  const clean = cleanText(text).trim();
  if (GRADE_ALONE.test(clean)) return 'list';
  if (GRADES.test(clean)) return 'grade';
  const parts = ctx.functionList
    .map((f) => normName(f.code).split(' '))
    .filter((w) => w.length > 1);
  return parts.some((w) => w.at(-1) === t) ? 'functionPart' : null;
}

/** Ist der Text ein Name aus Personen- oder Funktionsliste (Regel 12)? */
export function isPersonOrFunction(text: string, ctx: FormTextContext): boolean {
  return nameMatch(text, ctx) !== null;
}

const FUNCTION_PART = 'Klammer mit Teil einer Funktion als Ltg übernommen';

/** Klammerausdruck nach Regel 12: «Ltg: …» bzw. Name/Funktion → Ltg, «Ort: …» bzw. übriger Text → Ort. */
function classifyParen(
  inner: string,
  ctx: FormTextContext,
): { ltg: string; ort: string; uncertain: string | null } {
  if (/^Ltg\s*:/i.test(inner))
    return { ltg: inner.replace(/^Ltg\s*:\s*/i, '').trim(), ort: '', uncertain: null };
  if (/^Ort\s*:/i.test(inner))
    return { ltg: '', ort: inner.replace(/^Ort\s*:\s*/i, '').trim(), uncertain: null };
  const m = nameMatch(inner, ctx);
  if (m === null) return { ltg: '', ort: inner, uncertain: null };
  return { ltg: inner, ort: '', uncertain: m === 'functionPart' ? FUNCTION_PART : null };
}

/** Zeilen einer über mehrere Zeilen offenen Klammer zu einem Ausdruck verbinden (UX-AB-01). */
function joinOpenParens(texts: readonly string[]): string[] {
  const out: string[] = [];
  let acc: string | null = null;
  for (const t of texts) {
    const cur: string = acc === null ? t : `${acc} ${t}`;
    if (cur.split('(').length > cur.split(')').length) acc = cur;
    else {
      out.push(cur);
      acc = null;
    }
  }
  if (acc !== null) out.push(acc);
  return out;
}

function linesOf(runs: readonly ShapeTextRun[]): {
  lines: Line[];
  removed: string[];
  changed: boolean;
  cancelled: boolean;
} {
  const max = runs.reduce((m, r) => Math.max(m, r.line), -1);
  const lines: { segs: Seg[] }[] = Array.from({ length: max + 1 }, () => ({ segs: [] }));
  const removed: string[] = [];
  let changed = false;
  let validChars = 0;
  let removedChars = 0;
  for (const r of runs) {
    const text = cleanText(r.text);
    const red = isRed(r.color);
    if (r.strike && red) {
      if (text.trim() !== '') removed.push(text.trim());
      removedChars += text.trim().length;
      continue;
    }
    if (red && text.trim() !== '') changed = true;
    validChars += text.trim().length;
    lines[r.line]?.segs.push({ text, bold: r.bold });
  }
  return { lines, removed, changed, cancelled: removedChars > 0 && validChars === 0 };
}

// Führende Zeit, beendet durch Leerraum, «:» oder Zeilenende (normalisierung 5.1; Befund FA-01).
const TIME_LEAD = /^(\d{4}(?:\s*-\s*\d{4})?)(?=\s|:|$)\s*:?\s*/;

/** Entfernt eine führende Zeitangabe aus der ersten nicht leeren Zeile. */
function stripLeadingTime(lines: Line[]): string | null {
  const first = lines.find((l) => !isEmpty(l));
  if (first === undefined) return null;
  const raw = first.segs.map((s) => s.text).join('');
  const lead = raw.length - raw.trimStart().length;
  const m = TIME_LEAD.exec(raw.trimStart());
  if (m === null) return null;
  let cut = lead + m[0].length;
  const segs: Seg[] = [];
  for (const s of first.segs) {
    if (cut >= s.text.length) {
      cut -= s.text.length;
      continue;
    }
    segs.push({ text: s.text.slice(cut), bold: s.bold });
    cut = 0;
  }
  lines[lines.indexOf(first)] = { segs };
  return (m[1] ?? '').replace(/\s+/g, '');
}

interface Extracted {
  readonly rest: string;
  readonly parens: readonly string[];
  readonly ltg: string | null;
}

/** Klammerausdrücke und «Ltg: …» aus einem Text herauslösen. */
function extract(text: string): Extracted {
  const parens: string[] = [];
  let rest = text.replace(/\(([^()]*)\)/g, (_, inner: string) => {
    if (inner.trim() !== '') parens.push(inner.trim());
    return ' ';
  });
  let ltg: string | null = null;
  rest = rest.replace(/(?:^|[,;]\s*|\s)Ltg\s*:\s*(.*)$/i, (_, value: string) => {
    ltg = value.trim();
    return '';
  });
  return { rest: rest.replace(/\s+/g, ' ').trim(), parens, ltg };
}

/** Teilt die Segmente einer Titelzeile so, dass Klammern und «Ltg:» nicht im Titel bleiben. */
function titleRuns(line: Line): { runs: TextRun[]; parens: string[]; ltg: string | null } {
  const parens: string[] = [];
  let ltg: string | null = null;
  const runs: TextRun[] = [];
  let depth = 0;
  let inLtg = false;
  let ltgText = '';
  // Eine Klammer kann über mehrere Läufe gehen (z.B. Fett-Wechsel in der Klammer; UX-AB-01).
  let parenText = '';
  for (const seg of line.segs) {
    let buffer = '';
    for (let i = 0; i < seg.text.length; i++) {
      const ch = seg.text[i] ?? '';
      if (inLtg) {
        ltgText += ch;
        continue;
      }
      if (depth === 0 && /^Ltg\s*:/i.test(seg.text.slice(i)) && /(^|[\s,;])$/.test(buffer || ' ')) {
        inLtg = true;
        const m = /^Ltg\s*:\s*/i.exec(seg.text.slice(i));
        i += (m?.[0].length ?? 1) - 1;
        continue;
      }
      if (ch === '(') {
        depth++;
        if (depth === 1) {
          parenText = '';
          continue;
        }
      }
      if (ch === ')' && depth > 0) {
        depth--;
        if (depth === 0) {
          if (parenText.trim() !== '') parens.push(parenText.trim());
          buffer += ' ';
          continue;
        }
      }
      if (depth > 0) parenText += ch;
      else buffer += ch;
    }
    if (buffer !== '') runs.push({ text: buffer, bold: seg.bold });
  }
  if (inLtg) ltg = ltgText.trim();
  return { runs, parens, ltg };
}

/** Läufe säubern: Leerraum zusammenfassen, Rand trimmen, gleiche Schnitte verbinden, Satzzeichen am Rand. */
function tidyRuns(runs: readonly TextRun[]): TextRun[] {
  const merged: TextRun[] = [];
  for (const r of runs) {
    const text = r.text.replace(/\s+/g, ' ');
    if (text === '') continue;
    const last = merged.at(-1);
    if (last !== undefined && last.bold === r.bold)
      merged[merged.length - 1] = { text: last.text + text, bold: r.bold };
    else merged.push({ text, bold: r.bold });
  }
  // Rand und Leerraum vor Satzzeichen (normalisierung.md Abschnitt 4 Punkt 6).
  const out = merged.map((r) => ({ ...r, text: r.text.replace(/\s+([,.:])/g, '$1') }));
  if (out[0]) out[0] = { ...out[0], text: out[0].text.trimStart() };
  const lastIndex = out.length - 1;
  const lastRun = out[lastIndex];
  if (lastRun)
    out[lastIndex] = { ...lastRun, text: lastRun.text.replace(/[\s,;:-]+$/, '').trimEnd() };
  const nonEmpty = out.filter((r) => r.text.trim() !== '');
  // Ein reines Leerzeichen zwischen zwei Läufen bleibt; ein Lauf nur aus Leerraum am Rand entfällt, und der
  // letzte verbleibende Lauf endet ohne Leerraum (z.B. vor einer entfernten Klammer).
  const end = nonEmpty.length - 1;
  const tail = nonEmpty[end];
  if (tail) nonEmpty[end] = { ...tail, text: tail.text.trimEnd() };
  return nonEmpty;
}

function joinRuns(lines: readonly TextRun[][]): TextRun[] {
  const out: TextRun[] = [];
  for (const runs of lines) {
    if (runs.length === 0) continue;
    if (out.length > 0) {
      const last = out[out.length - 1];
      if (last !== undefined) out[out.length - 1] = { ...last, text: `${last.text} ` };
    }
    out.push(...runs);
  }
  return tidyRuns(out);
}

const plainOf = (runs: readonly TextRun[]): string =>
  runs
    .map((r) => r.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

/** Kp: Text vor der Ortsklammer = Ltg, Klammer = Ort, ausser Name → Ltg (Regel 12). */
function ltgOrtOfLine(
  text: string,
  ctx: FormTextContext,
): { ltg: string; ort: string; uncertain: string | null; supplement: string } | null {
  const m = /^(.*?)\s*\(([^()]*)\)\s*([.,;]?)\s*$/.exec(text);
  if (m === null) return null;
  const before = (m[1] ?? '').trim().replace(/[,;:]+$/, '');
  const inner = (m[2] ?? '').trim();
  const c = classifyParen(inner, ctx);
  // Leere Klammer bzw. «(Ltg:)» ohne Wert: die Zeile bleibt als Ganzes erhalten (Regel 8; CR-5-01).
  if (c.ltg === '' && c.ort === '') return null;
  if (c.ltg !== '') {
    // Ltg aus der Klammer; der Text davor bleibt Zusatz (CR-5-01). Unsicher ist nur ein Name ohne «Ltg:».
    const named = before !== '' && !/^Ltg\s*:/i.test(inner);
    return {
      ltg: c.ltg,
      ort: '',
      uncertain: c.uncertain ?? (named ? 'Klammer mit Name und weiterer Text' : null),
      supplement: before,
    };
  }
  if (ctx.ltgInBlock === 'withOrt')
    return { ltg: before, ort: c.ort, uncertain: null, supplement: '' };
  return before === '' ? { ...c, supplement: '' } : null;
}

interface Group {
  readonly lines: readonly Line[];
}

function groupsOf(lines: readonly Line[]): Group[] {
  const groups: Group[] = [];
  let current: Line[] = [];
  for (const l of lines) {
    if (isEmpty(l)) {
      if (current.length > 0) groups.push({ lines: current });
      current = [];
    } else current.push(l);
  }
  if (current.length > 0) groups.push({ lines: current });
  return groups;
}

/** Gruppe fette Zeile(n), direkt gefolgt von normalen Zeile(n) (R-8.2-37). */
function groupShape(g: Group): { bold: Line[]; normal: Line[] } | null {
  const bold: Line[] = [];
  const normal: Line[] = [];
  for (const l of g.lines) {
    if (isBold(l)) {
      if (normal.length > 0) return null;
      bold.push(l);
    } else normal.push(l);
  }
  return bold.length === 0 ? null : { bold, normal };
}

/** Titel, Ltg und Ort einer Gruppe im Block mit Teilaufgaben (R-8.2-38). */
function subtaskOf(
  shape: { bold: Line[]; normal: Line[] },
  ctx: FormTextContext,
): Subtask & { uncertain: string | null } {
  const t = shape.bold.map(titleRuns);
  const title = joinRuns(t.map((x) => x.runs));
  const parens = t.flatMap((x) => x.parens).map((inner) => classifyParen(inner, ctx));
  let ort = parens
    .map((c) => c.ort)
    .filter((x) => x !== '')
    .join(', ');
  let ltg = [t.map((x) => x.ltg).find((x) => x !== null) ?? '', ...parens.map((c) => c.ltg)]
    .filter((x) => x !== '')
    .join(', ');
  let uncertain: string | null = parens.find((c) => c.uncertain !== null)?.uncertain ?? null;
  for (const text of joinOpenParens(shape.normal.map(lineText))) {
    const parsed = ltgOrtOfLine(text, ctx);
    if (parsed !== null) {
      // Teilaufgaben haben keinen Zusatz: der Text vor einer Ltg-Klammer bleibt wie übrige Zeilen bei Ltg (CR-5-01).
      for (const part of [parsed.supplement, parsed.ltg])
        if (part !== '') ltg = ltg === '' ? part : `${ltg}, ${part}`;
      if (parsed.ort !== '') ort = ort === '' ? parsed.ort : `${ort}, ${parsed.ort}`;
      uncertain ??= parsed.uncertain;
    } else ltg = ltg === '' ? text : `${ltg}, ${text}`;
  }
  return { title, ltg, ort, uncertain };
}

/**
 * Zerlegt die Läufe einer Form nach Regel 12: fette Zeile(n) = Titel; Klammer = Ort, ausser Name → Ltg;
 * «Ltg: …» bzw. (Kp) Text vor der Ortsklammer = Ltg; «Tenue …» = Tenue; übrige Zeilen = Zusatz.
 * Gruppen nach Gate S A1 ergeben Teilaufgaben. Rot durchgestrichen = entfernt, rot = geändert (Regel 2).
 */
export function parseShapeText(
  runs: readonly ShapeTextRun[],
  ctx: FormTextContext,
): ParsedShapeText {
  const { lines, removed, changed, cancelled } = linesOf(runs);
  const timeInText = stripLeadingTime(lines);
  const reasons: string[] = [];
  const plain = lines
    .map(lineText)
    .filter((t) => t !== '')
    .join(' ');
  const base = { timeInText, cancelled, changed, removedText: removed, plain };

  // Gate S A1: Block mit Teilaufgaben.
  const groups = groupsOf(lines);
  const shapes = groups.map(groupShape);
  if (
    groups.length >= 2 &&
    shapes.every((s) => s !== null) &&
    shapes.filter((s) => s !== null && s.normal.length > 0).length >= 2
  ) {
    const parts = shapes.map((s) => subtaskOf(s as { bold: Line[]; normal: Line[] }, ctx));
    const [head, ...rest] = parts;
    if (head !== undefined && rest.every((p) => p.title.length > 0)) {
      for (const p of parts) if (p.uncertain !== null) reasons.push(p.uncertain);
      return {
        ...base,
        title: head.title,
        ltg: head.ltg,
        ort: head.ort,
        tenue: '',
        supplement: '',
        uncertain: reasons.length > 0,
        uncertainReasons: reasons,
        subtasks: rest.map((p) => ({ title: p.title, ltg: p.ltg, ort: p.ort })),
      };
    }
  }

  const content = lines.filter((l) => !isEmpty(l));
  const boldLines = content.filter(isBold);
  const titleLines = boldLines.length > 0 ? boldLines : content.slice(0, 1);
  const titleParts = titleLines.map(titleRuns);
  const title = joinRuns(titleParts.map((p) => p.runs));
  const ltgs: string[] = [];
  const orts: string[] = [];
  const supplements: string[] = [];
  let tenue = '';
  for (const p of titleParts) {
    if (p.ltg !== null && p.ltg !== '') ltgs.push(p.ltg);
    for (const inner of p.parens) {
      const c = classifyParen(inner, ctx);
      if (c.ltg !== '') ltgs.push(c.ltg);
      if (c.ort !== '') orts.push(c.ort);
      if (c.uncertain !== null) reasons.push(c.uncertain);
    }
  }
  const restLines = joinOpenParens(
    content.filter((l) => !titleLines.includes(l)).map((l) => lineText(l)),
  );
  for (const line of restLines) {
    const text = line.replace(/[.]$/, '');
    const ltgMatch = /^Ltg\s*:\s*(.+)$/i.exec(text);
    const tenueMatch = /^Tenue\b\s*:?\s*(.+)$/i.exec(text);
    if (ltgMatch !== null) {
      ltgs.push((ltgMatch[1] ?? '').trim());
      continue;
    }
    if (tenueMatch !== null) {
      tenue =
        tenue === '' ? (tenueMatch[1] ?? '').trim() : `${tenue}, ${(tenueMatch[1] ?? '').trim()}`;
      continue;
    }
    const parsed = ltgOrtOfLine(text, ctx);
    if (parsed !== null) {
      if (parsed.ltg !== '') ltgs.push(parsed.ltg);
      if (parsed.ort !== '') orts.push(parsed.ort);
      if (parsed.supplement !== '') supplements.push(parsed.supplement);
      if (parsed.uncertain !== null) reasons.push(parsed.uncertain);
      continue;
    }
    const ex = extract(text);
    const named = ex.parens.length === 0 && ex.ltg === null ? nameMatch(text, ctx) : null;
    if (named !== null) {
      ltgs.push(text);
      // Unsicher nur, wenn die Listen den Namen nicht bestätigen (Grad mit Name, Teil einer Funktion; UX-AB-01).
      if (named !== 'list') reasons.push('Zeile nur mit Funktion oder Name als Ltg übernommen');
      continue;
    }
    supplements.push(text);
  }
  if (orts.length > 1) reasons.push('mehrere Klammern als Ort');
  if (title.length === 0 && content.length > 0) reasons.push('kein Titel erkannt');
  return {
    ...base,
    title,
    ltg: ltgs.join(', '),
    ort: orts.join(', '),
    tenue,
    supplement: supplements.join(' '),
    uncertain: reasons.length > 0,
    uncertainReasons: reasons,
    subtasks: [],
  };
}

export { plainOf as plainTextOfRuns };
