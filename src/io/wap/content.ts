// Text rules for WAP boxes and footnotes. Everything here is generic wording logic
// (Swiss Army abbreviations, labels such as "Ltg:"), never a lookup of box texts.

/** Case/umlaut/punctuation-insensitive form for comparisons. */
export const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const squash = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;.:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\(\s*\)/g, '')
    .replace(/(?:\s*\/\s*){2,}/g, ' / ')
    .replace(/^[\s,;/]+|[\s,;/]+$/g, '')
    .trim();

// ---------------------------------------------------------------------------
// Content rules from the Kp Kdt.

/** Kp orders must not reference Bat orders: "Bf 07-02b", "Anh 06-02b-3", "Beilage 04-05", "gem Bf …". */
export function stripBatReferences(text: string): string {
  const doc = String.raw`(?:Bf|Befehl|Anh|Anhang|Beilage|Beil)\.?\s+\d{1,2}-\d{1,2}[a-z]?(?:-\d+)?(?:\s+zu[mr]?\s+[^,;()]*)?`;
  return squash(
    text
      .replace(new RegExp(String.raw`\(\s*(?:gem(?:äss)?\.?\s+)?${doc}\s*\)`, 'gi'), '')
      .replace(new RegExp(String.raw`[,;]?\s*(?:gem(?:äss)?\.?\s+)?${doc}`, 'gi'), ''),
  );
}

// Word boundaries that respect umlauts (JS \b is ASCII only: "Einr|ücken").
const W0 = String.raw`(?<![\p{L}\d])`;
const W1 = String.raw`(?![\p{L}\d])`;
export const word = (source: string, flags = 'gu'): RegExp =>
  new RegExp(`${W0}${source}${W1}`, flags);

/** Abbreviation for Späher is "Sph", never "Späh". */
export const fixSpaeher = (text: string): string =>
  text.replace(new RegExp(`${W0}Sp[äa]h${W1}\\.?`, 'gu'), 'Sph');

export const applyContentRules = (text: string): string =>
  squash(fixSpaeher(stripBatReferences(text)));

// ---------------------------------------------------------------------------
// Abbreviations: expanded only where the reviewed reference output did.

const EXPAND_ALWAYS: [RegExp, string][] = [
  [word(String.raw`Fhr\.?\s+Fähigkeit`), 'Führungsfähigkeit'],
  // "XYZ12" → "XYZ 12": code letters glued to a number.
  [word(String.raw`([A-Z]{3,})(\d{1,3})`), '$1 $2'],
];
const EXPAND_BOX: [RegExp, string][] = [
  [word('Tagwach'), 'Tagwache'],
  [new RegExp(`${W0}Kontrl${W1}\\.?`, 'gu'), 'Kontrolle'],
  [new RegExp(`${W0}Ausgb${W1}\\.?`, 'gu'), 'Ausgabe'],
  [new RegExp(`${W0}Einr${W1}\\.?`, 'gu'), 'Einrücken'],
  [word('Fhz'), 'Fz'],
  [word('Zf'), 'Zfhr'],
  [new RegExp(`^Th${W1}\\.?`, 'u'), 'Theorie'],
  [new RegExp(`^Fsg${W1}`, 'u'), 'Fassung'],
  [word(String.raw`(Kontrolle)\s+Fsg`), '$1 Fassung'],
];

export function expandAbbreviations(text: string, mode: 'box' | 'footnote'): string {
  let out = text;
  for (const [re, to] of EXPAND_ALWAYS) out = out.replace(re, to);
  if (mode === 'box') for (const [re, to] of EXPAND_BOX) out = out.replace(re, to);
  return out;
}

/** Normalises function names from the Bat perspective to the Kp perspective. */
export function canonicalFunctions(text: string, ownUnit = ''): string {
  let out = text
    .replace(word(String.raw`Einh\s+Kdt\s+Stv`), 'Kdt Stv')
    .replace(word(String.raw`Einh\s+Kdt`), 'Kp Kdt')
    .replace(/(^|[^\p{L}])Höh\s+Uof(?![\p{L}\d])/gu, (m, pre: string) =>
      pre ? `${pre}höh Uof` : m,
    );
  if (ownUnit) {
    const unit = ownUnit.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    out = out
      .replace(new RegExp(String.raw`${W0}Kdt\s+Stv\s+${unit}(?![\d/])`, 'gu'), 'Kdt Stv')
      .replace(new RegExp(String.raw`${W0}Kdt\s+${unit}(?![\d/])`, 'gu'), 'Kp Kdt');
  }
  return out;
}

/** Standalone short forms in a Verantwortlich field. */
export function canonicalResponsible(text: string, ownUnit = ''): string {
  return canonicalFunctions(text, ownUnit)
    .split(/\s*(,|\/|\bund\b|\bu\/o\b)\s*/)
    .map((part) =>
      part === 'Kdt' ? 'Kp Kdt' : part === 'Stv' ? 'Kdt Stv' : part === 'Zf' ? 'Zfhr' : part,
    )
    .join(' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Vocabulary (generic military functions, places and service keywords).

const FUNCTION_TOKENS = new Set(
  (
    'Kdt Stv Zfhr Zf Grfhr Uof Of Fw Four Qm QM Wm Kpl Lt Oblt Hptm Maj Oberstlt Oberst ' +
    'Stabsuof Stabsadj Adj Hptfw Fachof Einh Kp Bat höh Höh Wacht Ber Ausb Kader C Chef ' +
    'Mat VT Mun Trsp Uem Az San Sdt Gfr Obgfr Koord St S1 S2 S3 S4 S5 S6 Fhr ' +
    'Det Wachtchef Küchenchef Four Feldweibel'
  ).split(' '),
);
const CONNECTORS = new Set(['und', 'u/o', '/', ',', '+', '&']);

/** A line that only names functions/persons, e.g. "Einh Fw", "Mat C", "Four, Einh Fw". */
export function isResponsibleLine(line: string): boolean {
  const tokens = line.replace(/[,;]/g, ' , ').split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let functions = 0;
  for (const token of tokens) {
    if (CONNECTORS.has(token)) continue;
    if (FUNCTION_TOKENS.has(token)) functions++;
    else if (/^\d+(?:\/\d+)*$/.test(token)) continue;
    else return false;
  }
  return functions > 0 && !/^(?:Det|Mat|Mun|Kp|Bat|Einh)$/.test(tokens.join(' '));
}

const GRADES =
  'Sdt|Gfr|Obgfr|Kpl|Wm|Obwm|Fw|Four|Hptfw|Adj|Stabsadj|Hptadj|Chefadj|Lt|Oblt|Hptm|Maj|Oberstlt|Oberst|Fachof';
const GRADE_NAME = new RegExp(
  String.raw`^(?:${GRADES})\s+\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+)?$`,
  'u',
);

const PLACE_TOKENS =
  /^(?:Ukft|Spl|ThS|KP|Bat KP|Kp KP|Mag|Kas|AV Platz|Rapportraum|Stao|Kp Stao|WK Stao|Teams|gem Bat|Aussen|Halle|Turnhalle|Kantine|Küche|Fz Park|Mat Mag|Mun Mag|Schiessplatz|Ausb Pl|Ausb Platz)$/i;

/** True when every part of a parenthetical is a known place ("Ukft/Spl", "Four: Ukft"). */
export function isPlaceGroup(content: string): boolean {
  const parts = content
    .split(/\s*[/,]\s*|\s+u\s+|\s+und\s+/)
    .map((p) => p.replace(/^[^:]*:\s*/, '').trim())
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => PLACE_TOKENS.test(p));
}

/** Formats a place group: "Ukft/Spl" → "Ukft / Spl". */
const formatPlace = (content: string): string => content.replace(/\s*\/\s*/g, ' / ').trim();

const DIENST_START =
  /^(?:Tagwache|Tagwach|MoE|MiE|NaE|AV|HV|PD|ID|ABV|Zi\s?Ord|WEB|Kaderabend|Kdt\s+Stunde)(?![\p{L}\d])/iu;
const POINT_START = /^(?:Tagwache|Tagwach|AV|HV|ABV)(?![\p{L}\d])/iu;

/** General service items that belong to "1 Dienstbetrieb" regardless of the column. */
export const isDienstItem = (text: string): boolean => DIENST_START.test(text.trim());
/** Items shown as a point in time (start only). */
export const isPointItem = (text: string): boolean => POINT_START.test(text.trim());

/** Rapporte: KR, DR, AR1, AR2, ARK, BR 0–3, "…Rap", "Rapport", "Absprache". */
export const isRapport = (text: string): boolean =>
  /\b(?:KR|DR|AR\s?[12]|ARK|BR\s?[0-3])\b/.test(text) ||
  /\p{L}*\s?Rap(?![\p{L}\d])/u.test(text) ||
  /rapport(?:e|s)?(?![\p{L}])/iu.test(text) ||
  /absprache/i.test(text);

// ---------------------------------------------------------------------------
// Box text → activities.

export interface Activity {
  taetigkeit: string;
  verantwortlich: string;
  ort: string;
  /** Minutes of a time written in the text ("ABV 2330"), overriding the position. */
  labelTime?: number;
  anschl: boolean;
  point: boolean;
}

export interface BoxText {
  activities: Activity[];
  /** True when the box had to be split into several activities. */
  split: boolean;
}

const LTG = /^\s*Ltg\s*:\s*/i;

interface Logical {
  text: string;
  responsible: string[];
  places: string[];
}

function extractGroups(line: string, ownUnit: string): Logical {
  const responsible: string[] = [];
  const places: string[] = [];
  let text = line.replace(/\(([^()]*)\)/g, (whole, inner: string) => {
    const content = inner.replace(/\s+/g, ' ').trim();
    if (!content) return ' ';
    if (LTG.test(content)) {
      responsible.push(canonicalResponsible(content.replace(LTG, ''), ownUnit));
      return ' ';
    }
    if (isPlaceGroup(content)) {
      places.push(formatPlace(content));
      return ' ';
    }
    if (GRADE_NAME.test(content)) {
      responsible.push(content);
      return ' ';
    }
    return whole;
  });
  text = text.replace(/\s+/g, ' ').trim();
  if (LTG.test(text)) {
    responsible.push(canonicalResponsible(text.replace(LTG, ''), ownUnit));
    text = '';
  } else if (text && isResponsibleLine(text)) {
    responsible.push(canonicalResponsible(text, ownUnit));
    text = '';
  }
  return { text, responsible, places };
}

/** Joins physical lines into logical lines (open brackets, trailing "/" or ",", "z Vf", "anschl"). */
function logicalLines(lines: string[]): string[] {
  const out: string[] = [];
  let open = 0;
  let joinNext = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (open > 0) continue;
      out.push('');
      joinNext = false;
      continue;
    }
    const prev = out.length ? out[out.length - 1] : null;
    if (prev != null && prev !== '' && (open > 0 || joinNext || line.startsWith('('))) {
      out[out.length - 1] = `${prev} ${line}`;
    } else out.push(line);
    const current = out[out.length - 1];
    open = (current.match(/\(/g)?.length ?? 0) - (current.match(/\)/g)?.length ?? 0);
    joinNext = /[/,]$/.test(line) || /^(?:z\.?\s?Vf|anschl\.?)$/i.test(line);
  }
  return out;
}

// A time at the end of the activity, optionally followed by one bracket group ("ABV 2330 (…)").
const TRAILING_TIME = /(?:^|\s)((?:[01]\d|2[0-3])[0-5]\d|2400)(?=\s*(?:\([^()]*\))?\s*$)/;

function finishActivity(
  parts: string[],
  responsible: string[],
  places: string[],
  ownUnit: string,
): Activity {
  let text = parts.join(' / ');
  let labelTime: number | undefined;
  const time = TRAILING_TIME.exec(text);
  if (time && text.length > time[0].length) {
    labelTime = Number(time[1].slice(0, 2)) * 60 + Number(time[1].slice(2));
    text = `${text.slice(0, time.index)} ${text.slice(time.index + time[0].length)}`.trim();
  }
  text = text.replace(/(\p{L}{2,})\/(\p{L}{2,})/gu, (m, a: string, b: string) =>
    `${a}/${b}` === 'u/o' ? m : `${a} / ${b}`,
  );
  text = canonicalFunctions(expandAbbreviations(text, 'box'), ownUnit);
  const taetigkeit = applyContentRules(text);
  return {
    taetigkeit,
    verantwortlich: applyContentRules([...new Set(responsible)].join(' / ')),
    ort: applyContentRules([...new Set(places)].join(', ')),
    ...(labelTime != null ? { labelTime } : {}),
    anschl: /^anschl\b/i.test(taetigkeit),
    point: isPointItem(taetigkeit) || labelTime != null,
  };
}

export function parseBoxText(lines: readonly string[], ownUnit = ''): BoxText {
  const logical = logicalLines([...lines]).map((line) =>
    line ? extractGroups(line, ownUnit) : { text: '', responsible: [], places: [] },
  );
  const places = logical.flatMap((l) => l.places);
  // Sequence segmentation: a new activity starts when text follows a responsible line.
  type Seg = { parts: string[]; responsible: string[] };
  const segments: Seg[] = [];
  let current: Seg = { parts: [], responsible: [] };
  for (const l of logical) {
    if (l.text && current.responsible.length && current.parts.length) {
      segments.push(current);
      current = { parts: [], responsible: [] };
    }
    if (l.text) current.parts.push(l.text);
    current.responsible.push(...l.responsible);
  }
  if (current.parts.length || current.responsible.length) segments.push(current);
  // Trailing text without its own responsible belongs to the previous activity.
  const merged: Seg[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && !seg.responsible.length && seg.parts.length) {
      const tail = seg.parts.join(' ');
      prev.parts[prev.parts.length - 1] += `${/^anschl\b/i.test(tail) ? ', ' : ' / '}${tail}`;
    } else if (prev && !seg.parts.length) prev.responsible.push(...seg.responsible);
    else merged.push({ parts: [...seg.parts], responsible: [...seg.responsible] });
  }
  const withText = merged.filter((s) => s.parts.length);
  if (!withText.length) return { activities: [], split: false };
  // Leading responsible-only segment (e.g. "Ltg: X" first) applies to the first activity.
  const orphan = merged.filter((s) => !s.parts.length).flatMap((s) => s.responsible);
  if (orphan.length) withText[0].responsible.unshift(...orphan);

  let activities = withText.map((s) => finishActivity(s.parts, s.responsible, places, ownUnit));
  // "Tagwache / MoE": split a point item combined with other service items.
  activities = activities.flatMap((activity) => {
    const parts = activity.taetigkeit.split(/\s+\/\s+/);
    if (parts.length < 2 || !parts.every(isDienstItem) || !parts.some(isPointItem))
      return [activity];
    return parts.map((part) => ({ ...activity, taetigkeit: part, point: isPointItem(part) }));
  });
  return { activities, split: withText.length > 1 };
}

// ---------------------------------------------------------------------------
// Footnotes.

export interface FootnoteTime {
  kind: 'range' | 'point' | 'ab' | 'bis';
  start: number;
  end?: number;
}

export interface FootnoteLine {
  nr: number;
  time: FootnoteTime | null;
  body: string;
}

const hhmm = (text: string): number => Number(text.slice(0, 2)) * 60 + Number(text.slice(2, 4));
const validTime = (text: string) => /^(?:[01]\d|2[0-3])[0-5]\d$|^2400$/.test(text);

/** "31 0915-1045: Begehung …" → { nr: 31, time: range, body }. */
export function parseFootnoteLine(line: string): FootnoteLine | null {
  // "31 0915-1045: …", "32 bis 0830: …", "33 — 1415: …" (dash after the number), "34 …".
  const match =
    /^\s*(\d{2})(?:\s*[-–—]\s*|\s+)(?:(\d{4})\s*[-–—]\s*(\d{4})|(ab|bis)\s+(\d{4})|(\d{4}))?(?![\d.])\s*:?\s*(.*)$/i.exec(
      line,
    );
  if (!match) return null;
  const [, nr, from, to, word, wordTime, single, body] = match;
  let time: FootnoteTime | null = null;
  if (from && to && validTime(from) && validTime(to))
    time = { kind: 'range', start: hhmm(from), end: hhmm(to) };
  else if (word && wordTime && validTime(wordTime))
    time = { kind: word.toLowerCase() === 'ab' ? 'ab' : 'bis', start: hhmm(wordTime) };
  else if (single && validTime(single)) time = { kind: 'point', start: hhmm(single) };
  else if (from || single || wordTime)
    return { nr: Number(nr), time: null, body: line.replace(/^\s*\d{2}\s*[-–—]?\s*/, '').trim() };
  return { nr: Number(nr), time, body: body.replace(/^[-–—:]\s*/, '').trim() };
}

export interface FootnoteFields {
  taetigkeit: string;
  verantwortlich: string;
  ort: string;
}

/** Splits "…, Ltg: X, Tn: …, Ort: Y." into fields; Tn stays part of the text. */
export function parseFootnoteBody(body: string, ownUnit = ''): FootnoteFields {
  const text = body
    .replace(/\s+/g, ' ')
    .replace(/\.\s*$/, '')
    .trim();
  // Clauses separated by "," or ";" (keeping the separator), labels start clauses.
  const clauses: { sep: string; text: string }[] = [];
  let buffer = '',
    sep = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === ',' || ch === ';') && !/\d/.test(text[i + 1] ?? '')) {
      clauses.push({ sep, text: buffer.trim() });
      buffer = '';
      sep = ch;
    } else buffer += ch;
  }
  clauses.push({ sep, text: buffer.trim() });

  let verantwortlich = '',
    ort = '';
  const keep: { sep: string; text: string }[] = [];
  let mode: 'text' | 'tn' | 'ltg' | 'ort' = 'text';
  for (const clause of clauses) {
    const label = /^(Ltg|Tn|Ort)\s*:\s*(.*)$/i.exec(clause.text);
    if (clause.sep === ';') mode = 'text';
    if (label) {
      const kind = label[1].toLowerCase();
      if (kind === 'ltg') {
        verantwortlich = verantwortlich ? `${verantwortlich} / ${label[2]}` : label[2];
        mode = 'ltg';
      } else if (kind === 'ort') {
        ort = ort ? `${ort}, ${label[2]}` : label[2];
        mode = 'ort';
      } else {
        keep.push({ sep: clause.sep, text: `Tn: ${label[2]}` });
        mode = 'tn';
      }
      continue;
    }
    if (mode === 'ort' && clause.sep === ',') {
      ort = `${ort}, ${clause.text}`;
      continue;
    }
    if (mode === 'ltg' && clause.sep === ',' && isResponsibleLine(clause.text)) {
      verantwortlich = `${verantwortlich}, ${clause.text}`;
      continue;
    }
    if (mode === 'ltg' || mode === 'ort') mode = 'text';
    keep.push(clause);
  }
  let taetigkeit = keep
    .map((c, i) => (i === 0 ? c.text : `${c.sep} ${c.text}`))
    .join('')
    .trim();
  // "via Teams" → Ort; "in WESTHAUSEN" (place in capitals) → Ort.
  const via = /\s+via\s+(\p{Lu}[\p{L}\d]+)/u.exec(taetigkeit);
  if (via) {
    if (!ort) ort = via[1];
    taetigkeit = taetigkeit.replace(via[0], '');
  }
  const inPlace = /\s+in\s+(\p{Lu}{3,}(?:[ -]\p{Lu}{3,})*)(?=$|[,;])/u.exec(taetigkeit);
  if (inPlace) {
    if (!ort) ort = inPlace[1];
    taetigkeit = taetigkeit.replace(inPlace[0], '');
  }
  taetigkeit = canonicalFunctions(expandAbbreviations(taetigkeit, 'footnote'), ownUnit);
  return {
    taetigkeit: applyContentRules(taetigkeit),
    verantwortlich: applyContentRules(canonicalResponsible(verantwortlich, ownUnit)),
    ort: applyContentRules(ort),
  };
}

/** Significant tokens for similarity checks (folded; no stop words, numbers, function names). */
const STOP = new Set(
  (
    'und oder mit fur fuer der die das den dem des ein eine inkl bis ab via ltg tn ort alle auf ' +
    'an im in am zum zur von vor nach sowie gem durch kdt stv einh zfhr uof fw four hoh'
  ).split(' '),
);
export const significantTokens = (text: string): string[] => [
  ...new Set(
    fold(text)
      .split(' ')
      .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t)),
  ),
];

const sameToken = (x: string, y: string) =>
  x === y || (x.length >= 5 && y.length >= 5 && (x.startsWith(y) || y.startsWith(x)));

/** Tokens of `a` that also occur in `b` (equal, or a common prefix of ≥ 5 letters). */
export function sharedTokens(a: string, b: string): string[] {
  const tb = significantTokens(b);
  return significantTokens(a).filter((x) => tb.some((y) => sameToken(x, y)));
}

/** Inverse document frequency over a set of texts (for weighting shared tokens). */
export function tokenWeights(texts: readonly string[]): (token: string) => number {
  const docs = texts.map((t) => significantTokens(t));
  const n = Math.max(1, docs.length);
  return (token) => {
    const df = docs.filter((d) => d.some((t) => sameToken(t, token))).length;
    return Math.log((n + 1) / (df + 0.5));
  };
}
