// Vergleich Listen-Export ↔ Soll-Liste (Anhang A) nach anhaenge/normalisierung.md Abschnitt 4 und 10
// (Vertrag E1-08 §4; R-14.1-01, R-6-16). Testhilfe, unabhängig vom Import: liest nur zwei CSV-Texte.
// F-IMPORT2 (Q-043, Auftraggeber 19.10.2026): Zeilen vom Typ «Bericht» sind erwartete Berichtseinträge (z.B. ganz
// verdeckte Formen) und keine Soll-Einheiten (normalisierung.md Abschnitt 3 und Änderungsnotiz 19.10.2026).
// Ausgaben nur als Zahlen und Schlüssel (Woche, Tag, Typ, Nr), nie Titel oder andere Inhalte (Prompt §8).

export const CSV_FIELDS = [
  'Woche',
  'Tag',
  'Typ',
  'Titel',
  'Zeitform',
  'von',
  'bis',
  'Spalten',
  'Kategorie',
  'Ltg',
  'Ort',
  'Nr',
  'Status',
  'Bemerkung',
] as const;
export type CsvField = (typeof CSV_FIELDS)[number];
export type CsvRow = Readonly<Record<CsvField, string>>;

/** Typ der Zeilen, die nur einen erwarteten Berichtseintrag tragen (Q-043); nie eine Soll- oder Ist-Einheit. */
export const REPORT_ROW_TYPE = 'Bericht';

/** Felder, die zu «korrekt erkannt» gehören (Abschnitt 10). */
export type CompareField =
  | 'fehlt'
  | 'Typ'
  | 'Tag'
  | 'von'
  | 'bis'
  | 'Spalten'
  | 'Kategorie'
  | 'Titel'
  | 'Nr'
  | 'Zeitfenster';

export interface CompareDiff {
  /** Woche|Tag|Typ|Nr (ohne Inhalte). */
  readonly key: string;
  readonly woche: string;
  readonly typ: string;
  readonly feld: CompareField;
}

export interface CompareResult {
  readonly total: number;
  readonly correct: number;
  readonly quote: number;
  readonly diffs: readonly CompareDiff[];
  /** Überzählige Ist-Einheiten (senken die Quote nicht). */
  readonly extra: number;
  /** Soll-Einheiten mit allen 13 Pflichtfeldern gleich (für 100 %, R-14.1-02). */
  readonly exact: number;
  /** Je Woche: Soll, korrekt. */
  readonly byWeek: Readonly<Record<string, { readonly total: number; readonly correct: number }>>;
  /** Je Woche und Typ: Soll, korrekt. */
  readonly byWeekType: Readonly<
    Record<string, { readonly total: number; readonly correct: number }>
  >;
}

// ---------------------------------------------------------------------------------------------------------
// CSV lesen (UTF-8, «;», RFC 4180)

export function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] ?? '';
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      records.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  const [head, ...body] = records.filter((r) => !(r.length === 1 && r[0] === ''));
  if (head === undefined) return [];
  const index = new Map(head.map((h, i) => [h.trim(), i]));
  return body.map((r) => {
    const out: Record<string, string> = {};
    for (const f of CSV_FIELDS) {
      const i = index.get(f);
      out[f] = i === undefined ? '' : (r[i] ?? '');
    }
    return out as CsvRow;
  });
}

// ---------------------------------------------------------------------------------------------------------
// Normalisierung (Abschnitt 4)

export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u00A0\u2007\u202F\t]/g, ' ')
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+([,.:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/ {2,}/g, ' ')
    .trim();
}

const SPECIAL_COLUMNS = new Set(['Rap', 'Beso', 'Det', 'Stab 2']);

function columnTokens(value: string): string[] {
  return normalizeText(value)
    .split('|')
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

// ---------------------------------------------------------------------------------------------------------
// Einheiten (Abschnitt 10)

interface Unit {
  readonly rows: readonly CsvRow[];
  readonly woche: string;
  readonly tag: string;
  readonly typ: string;
  readonly nr: string;
}

function units(rows: readonly CsvRow[]): Unit[] {
  const out: Unit[] = [];
  const beso = new Map<string, CsvRow[]>();
  for (const r of rows) {
    if (r.Typ === REPORT_ROW_TYPE) continue;
    if (r.Typ === 'Beso') {
      const key =
        r.Nr.trim() !== ''
          ? `${r.Woche}|${r.Nr.trim()}`
          : `${r.Woche}|${r.Tag}|${normalizeText(r.Titel)}|-`;
      const list = beso.get(key);
      if (list === undefined) beso.set(key, [r]);
      else list.push(r);
    } else out.push({ rows: [r], woche: r.Woche, tag: r.Tag, typ: r.Typ, nr: r.Nr.trim() });
  }
  for (const list of beso.values()) {
    const first = list[0];
    if (first !== undefined)
      out.push({
        rows: list,
        woche: first.Woche,
        tag: first.Tag,
        typ: 'Beso',
        nr: first.Nr.trim(),
      });
  }
  return out;
}

/** Planungsspalten eines Tages (Woche|Tag), aus beiden Listen gesammelt, für «alle aufgelöst». */
function dayUniverse(all: readonly CsvRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const r of all) {
    const key = `${r.Woche}|${r.Tag}`;
    const set = out.get(key) ?? new Set<string>();
    for (const t of columnTokens(r.Spalten))
      if (t !== 'alle' && !SPECIAL_COLUMNS.has(t)) set.add(t);
    out.set(key, set);
  }
  return out;
}

function columnSet(r: CsvRow, universe: Map<string, Set<string>>): string {
  const tokens = new Set<string>();
  for (const t of columnTokens(r.Spalten)) {
    if (t === 'alle') {
      tokens.add('alle');
      for (const u of universe.get(`${r.Woche}|${r.Tag}`) ?? []) tokens.add(u);
    } else tokens.add(t);
  }
  // «alle» allein und die vollständige Aufzählung gelten gleich (Abschnitt 10 «als Menge, alle aufgelöst»).
  const universeOfDay = universe.get(`${r.Woche}|${r.Tag}`) ?? new Set<string>();
  const covers = [...universeOfDay].every((u) => tokens.has(u)) && universeOfDay.size > 0;
  if (covers) tokens.add('alle');
  return [...tokens].sort().join('|');
}

function windowKey(r: CsvRow, universe: Map<string, Set<string>>): string {
  return `${r.von.trim()}~${r.bis.trim()}~${columnSet(r, universe)}`;
}

function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
}

/** Erstes abweichendes Feld von «korrekt erkannt», null = korrekt. */
function firstDiff(soll: Unit, ist: Unit, universe: Map<string, Set<string>>): CompareField | null {
  const s = soll.rows[0];
  const i = ist.rows[0];
  if (s === undefined || i === undefined) return 'fehlt';
  if (s.Typ !== i.Typ) return 'Typ';
  if (s.Tag !== i.Tag) return 'Tag';
  if (soll.typ === 'Beso') {
    if (soll.nr !== ist.nr) return 'Nr';
    if (normalizeText(s.Kategorie) !== normalizeText(i.Kategorie)) return 'Kategorie';
    if (normalizeText(s.Titel) !== normalizeText(i.Titel)) return 'Titel';
    const ws = soll.rows.map((r) => windowKey(r, universe));
    const wi = ist.rows.map((r) => windowKey(r, universe));
    return sameMultiset(ws, wi) ? null : 'Zeitfenster';
  }
  if (s.von.trim() !== i.von.trim()) return 'von';
  if (s.bis.trim() !== i.bis.trim()) return 'bis';
  if (columnSet(s, universe) !== columnSet(i, universe)) return 'Spalten';
  if (normalizeText(s.Kategorie) !== normalizeText(i.Kategorie)) return 'Kategorie';
  if (normalizeText(s.Titel) !== normalizeText(i.Titel)) return 'Titel';
  return null;
}

const EXACT_FIELDS: readonly CsvField[] = CSV_FIELDS.filter((f) => f !== 'Bemerkung');

function exactEqual(soll: Unit, ist: Unit): boolean {
  if (soll.rows.length !== ist.rows.length) return false;
  const key = (r: CsvRow) => EXACT_FIELDS.map((f) => normalizeText(r[f])).join('\u0001');
  return sameMultiset(soll.rows.map(key), ist.rows.map(key));
}

/** Nähe für die Zuordnung (Abschnitt 10): Zeit und Spalten, dann Titel. */
function closeness(soll: Unit, ist: Unit, universe: Map<string, Set<string>>): number {
  const s = soll.rows[0];
  const i = ist.rows[0];
  if (s === undefined || i === undefined) return 0;
  let score = 0;
  if (s.von.trim() === i.von.trim()) score += 4;
  if (s.bis.trim() === i.bis.trim()) score += 4;
  if (columnSet(s, universe) === columnSet(i, universe)) score += 3;
  if (normalizeText(s.Titel) === normalizeText(i.Titel)) score += 2;
  if (normalizeText(s.Kategorie) === normalizeText(i.Kategorie)) score += 1;
  return score;
}

function candidateKey(u: Unit): string {
  return u.typ === 'Beso' && u.nr !== ''
    ? `${u.woche}|Beso|${u.nr}`
    : `${u.woche}|${u.typ}|${u.tag}|${u.typ === 'MehrtagBemerkung' ? '' : u.nr}`;
}

/** Zuordnung Soll ↔ Ist (Abschnitt 10) für Auswertungen; liefert die Zeilen der Paare. */
export function matchUnits(
  csvIst: string,
  csvSoll: string,
): {
  readonly soll: readonly CsvRow[];
  readonly ist: readonly CsvRow[] | null;
  readonly feld: CompareField | null;
}[] {
  const istRows = parseCsv(csvIst);
  const sollRows = parseCsv(csvSoll);
  const universe = dayUniverse([...sollRows, ...istRows]);
  const { soll, matched } = pair(units(sollRows), units(istRows), universe);
  return soll.map((s) => {
    const i = matched.get(s);
    return {
      soll: s.rows,
      ist: i?.rows ?? null,
      feld: i === undefined ? 'fehlt' : firstDiff(s, i, universe),
    };
  });
}

function pair(
  soll: readonly Unit[],
  ist: readonly Unit[],
  universe: Map<string, Set<string>>,
): { soll: readonly Unit[]; matched: Map<Unit, Unit>; used: Set<Unit> } {
  const byKey = new Map<string, Unit[]>();
  for (const u of ist) {
    const k = candidateKey(u);
    const list = byKey.get(k);
    if (list === undefined) byKey.set(k, [u]);
    else list.push(u);
  }
  const used = new Set<Unit>();
  const matched = new Map<Unit, Unit>();
  for (const s of soll) {
    const hit = (byKey.get(candidateKey(s)) ?? []).find(
      (i) => !used.has(i) && firstDiff(s, i, universe) === null,
    );
    if (hit !== undefined) {
      used.add(hit);
      matched.set(s, hit);
    }
  }
  for (const s of soll) {
    if (matched.has(s)) continue;
    let best: Unit | undefined;
    let bestScore = -1;
    for (const i of byKey.get(candidateKey(s)) ?? []) {
      if (used.has(i)) continue;
      const score = closeness(s, i, universe);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    if (best !== undefined) {
      used.add(best);
      matched.set(s, best);
    }
  }
  return { soll, matched, used };
}

/** Vergleich nach «korrekt erkannt» (Abschnitt 10); csvIst = Export der Listenansicht, csvSoll = Anhang A. */
export function compareWithAnhang(csvIst: string, csvSoll: string): CompareResult {
  const istRows = parseCsv(csvIst);
  const sollRows = parseCsv(csvSoll);
  const universe = dayUniverse([...sollRows, ...istRows]);
  const soll = units(sollRows);
  const ist = units(istRows);
  const { matched, used } = pair(soll, ist, universe);
  const diffs: CompareDiff[] = [];
  const byWeek: Record<string, { total: number; correct: number }> = {};
  const byWeekType: Record<string, { total: number; correct: number }> = {};
  let correct = 0;
  let exact = 0;
  for (const s of soll) {
    const i = matched.get(s);
    const diff = i === undefined ? 'fehlt' : firstDiff(s, i, universe);
    const w = byWeek[s.woche] ?? { total: 0, correct: 0 };
    byWeek[s.woche] = w;
    const wt = byWeekType[`${s.woche}|${s.typ}`] ?? { total: 0, correct: 0 };
    byWeekType[`${s.woche}|${s.typ}`] = wt;
    w.total++;
    wt.total++;
    if (diff === null) {
      correct++;
      w.correct++;
      wt.correct++;
      if (i !== undefined && exactEqual(s, i)) exact++;
    } else {
      diffs.push({
        key: `${s.woche}|${s.tag}|${s.typ}|${s.nr}`,
        woche: s.woche,
        typ: s.typ,
        feld: diff,
      });
    }
  }
  return {
    total: soll.length,
    correct,
    quote: soll.length === 0 ? 1 : correct / soll.length,
    diffs,
    extra: ist.filter((u) => !used.has(u)).length,
    exact,
    byWeek,
    byWeekType,
  };
}
