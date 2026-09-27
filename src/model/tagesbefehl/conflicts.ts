import type { TbConflict, TbEntry, TbWeek, TbWeekday } from './types';

/**
 * Conflicts that can be recomputed from the reviewed entries alone (overlaps, same
 * function in two places, unknown abbreviations). Parse-time conflicts (label vs
 * position, footnotes, naming) are stored in TbWeek.parseConflicts.
 *
 * Ids are deterministic (type + day + sorted entry ids [+ token]) so dismissals
 * survive re-detection. Messages are German and meant for the local interface only.
 */

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Times.

const hm = (text: string): number => Number(text.slice(0, 2)) * 60 + Number(text.slice(2, 4));

/** Interval of an entry in minutes [start, end); points last 15 minutes. */
export function entryInterval(entry: Pick<TbEntry, 'zeit'>): [number, number] | null {
  const zeit = entry.zeit.trim();
  const range = /^(\d{4})\s*[-–]\s*(\d{4})$/.exec(zeit);
  if (range) {
    const s = hm(range[1]),
      e = hm(range[2]);
    return e > s ? [s, e] : [s, s + 15];
  }
  const point = /^(?:ab\s+|bis\s+|ca\.?\s+)?(\d{4})$/i.exec(zeit);
  if (point) {
    const t = hm(point[1]);
    return /^bis/i.test(zeit) ? [t - 15, t] : [t, t + 15];
  }
  return null;
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];
const fmt = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Functions (who) and places (where).

const FUNCTION_PATTERNS: [RegExp, string][] = [
  [/\bbat\s+kdt\b/g, 'bat kdt'],
  // Commanders of other formations are not company functions.
  [/\bkdt\s+(?:ter|inf|div|br|rgt|stabskp|vba)\b[^,;/]*/g, ''],
  [/\b(?:einh\s+)?kdt\s+stv\b/g, 'kdt stv'],
  [/\b(?:kp|einh)\s+kdt\b/g, 'kp kdt'],
  [/\beinh\s+fw\b/g, 'einh fw'],
  [/\beinh\s+four\b/g, 'einh four'],
  [/\bhoh\s+uof\b/g, 'hoh uof'],
  [/\bstabsuof\b/g, 'stabsuof'],
  [/\bwacht\s+of\b/g, 'wacht of'],
  [/\bber\s+of\b/g, 'ber of'],
  [/\b(mat|vt|mun|trsp|uem)\s+c\b/g, '$1 c'],
  [/\bs([1-6])\b/g, 's$1'],
  [/\bzfhr\b/g, 'zfhr'],
  [/\bgrfhr\b/g, 'grfhr'],
  [/\buof\b/g, 'uof'],
  [/\bof\b/g, 'of'],
  [/\bkader\b/g, 'kader'],
  [/\bqm\b/g, 'qm'],
  [/\bstv\b/g, 'kdt stv'],
  [/\bkdt\b/g, 'kp kdt'],
];

/** Group terms and the functions they include. */
const MEMBERS: Record<string, string[]> = {
  'hoh uof': ['einh fw', 'einh four', 'stabsuof'],
  of: ['kp kdt', 'kdt stv', 'zfhr', 'wacht of', 'ber of'],
  uof: ['grfhr'],
  kader: [
    'kp kdt',
    'kdt stv',
    'zfhr',
    'wacht of',
    'ber of',
    'einh fw',
    'einh four',
    'stabsuof',
    'hoh uof',
    'uof',
    'grfhr',
    'of',
  ],
};

export function functionsIn(text: string): Set<string> {
  let rest = ` ${fold(text)} `;
  const out = new Set<string>();
  for (const [re, key] of FUNCTION_PATTERNS)
    rest = rest.replace(re, (...args: string[]) => {
      if (key) out.add(key.replace('$1', args[1] ?? ''));
      return ' ';
    });
  return out;
}

const expand = (set: Set<string>): Set<string> => {
  const out = new Set(set);
  for (const f of set) for (const m of MEMBERS[f] ?? []) out.add(m);
  return out;
};

function sharedFunctions(a: Set<string>, b: Set<string>): string[] {
  const ea = expand(a),
    eb = expand(b);
  return [...new Set([...[...a].filter((f) => eb.has(f)), ...[...b].filter((f) => ea.has(f))])];
}

/** Persons named explicitly: Tn lists, brackets, "X: place", "X z Vf …". */
function namedParticipants(entry: TbEntry): Set<string> {
  const parts: string[] = [];
  const tn = /\bTn\b\s*(?:u\.?\s?a\.?)?\s*:?\s*([^;]*)/i.exec(entry.taetigkeit);
  if (tn) parts.push(tn[1]);
  for (const m of `${entry.taetigkeit} ${entry.ort}`.matchAll(/\(([^()]*)\)/g)) parts.push(m[1]);
  const label = /^([^:]+):/.exec(entry.ort);
  if (label) parts.push(label[1]);
  // A function group as subject: "Uof z Vf …".
  const subject = /^((?:\p{L}+\s){0,4}?)z\s?Vf(?![\p{L}])/u.exec(entry.taetigkeit);
  if (subject) parts.push(subject[1]);
  return functionsIn(parts.join(' , '));
}

/** Named participants plus function columns (group entries) and the Ltg of special items. */
function participants(entry: TbEntry): Set<string> {
  const out = namedParticipants(entry);
  const extra: string[] = [];
  if (entry.section === 'dienstbetrieb' && entry.group)
    extra.push(...(entry.source?.columns ?? []));
  if (entry.section !== 'dienstbetrieb') extra.push(entry.verantwortlich);
  for (const f of functionsIn(extra.join(' , '))) out.add(f);
  return out;
}

const VIRTUAL_PLACES = /^(?:|gem bat|offen|tbd|teams|threema|tel|telefon|online|div|diverse)$/;
/** Places on the company's own site (a rapport there does not move anyone elsewhere). */
const OWN_SITE = /^(?:ukft|rapportraum|av platz|ths|kp kp|kp stao|kp)$/;

/** Place keys of an entry ("Four: Ukft" → ukft; "Ukft / Spl" → ukft, spl). */
function places(entry: TbEntry): Set<string> {
  return new Set(
    entry.ort
      .split(/[,/]| und /)
      .map((p) => fold(p.replace(/^[^:]*:/, '')))
      .map((p) => p.split(' ').slice(0, 2).join(' '))
      .filter((p) => !VIRTUAL_PLACES.test(p)),
  );
}

/** Two known places that cannot be the same site. */
function distinctSites(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size || [...a].some((p) => b.has(p))) return false;
  const own = (set: Set<string>) => [...set].every((p) => OWN_SITE.test(p));
  return !(own(a) && own(b));
}

/** All-hands items of "1 Dienstbetrieb" during which special items are a conflict. */
const ALL_HANDS = /^(?:MoE|MiE|NaE|Kaderabend|Korpsvisite|Kdt\s+Stunde|Theorie|Th)(?![\p{L}\d])/iu;

// ---------------------------------------------------------------------------
// Abbreviations.

const KNOWN = new Set(
  (
    'AV HV ABV MOE MIE NAE PD ID WPD WEB EV AVOR KR DR AR AR1 AR2 ARK BR KU KP LKW ' +
    'FDT WK RS KVK DB ERK VT VS BAT KDT STV ZFHR UOF OF ' +
    'SPH MÖ KDO TRP RAP BESO BES MAT MUN FZ ZI ORD FSG AUSB DET NR TN LTG ORT OK GZ BF ANH SAN AZ ' +
    'QM ADA WAP TB MOB PL U UKFT SPL THS EDV IT SV GR ZG SDT HQ SW FU FK SE AGA GS EKF CH ' +
    'UEM KAS STAO PW PZ WG II III IV UO AP BF PISA'
  ).split(' '),
);

/** Short all-caps tokens (2–4 letters) that are not known abbreviations. */
function unknownTokens(text: string): string[] {
  const found = [...text.matchAll(/(?<![\p{L}\d.\-/])[A-ZÄÖÜ]{2,4}(?![\p{L}\d.\-/])/gu)].map(
    (m) => m[0],
  );
  return [...new Set(found)].filter((t) => !KNOWN.has(t.toUpperCase()));
}

// ---------------------------------------------------------------------------

type Info = {
  entry: TbEntry;
  interval: [number, number] | null;
  who: Set<string>;
  named: Set<string>;
  where: Set<string>;
};

export function detectEntryConflicts(week: TbWeek): TbConflict[] {
  const conflicts: TbConflict[] = [];
  const seen = new Set<string>();
  const add = (
    type: TbConflict['type'],
    day: TbWeekday,
    ids: string[],
    message: string,
    key = '',
  ) => {
    const entryIds = [...new Set(ids)].sort();
    const id = `${type}_${day}_${entryIds.join('+')}${key ? `_${key}` : ''}`;
    if (seen.has(id)) return;
    seen.add(id);
    conflicts.push({ id, day, type, message, entryIds });
  };
  const special = (x: Info) => x.entry.section !== 'dienstbetrieb';
  const allHands = (x: Info) =>
    x.entry.section === 'dienstbetrieb' &&
    !x.entry.group &&
    ALL_HANDS.test(x.entry.taetigkeit.trim()) &&
    x.interval != null &&
    x.interval[1] - x.interval[0] >= 30;
  const title = (f: string) => f.replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

  const days = [...new Set(week.entries.map((e) => e.day))];
  for (const day of days) {
    const info: Info[] = week.entries
      .filter((e) => e.day === day)
      .map((entry) => ({
        entry,
        interval: entryInterval(entry),
        who: participants(entry),
        named: namedParticipants(entry),
        where: places(entry),
      }));
    for (let i = 0; i < info.length; i++)
      for (let j = i + 1; j < info.length; j++) {
        const a = info[i],
          b = info[j];
        if (!a.interval || !b.interval || !overlaps(a.interval, b.interval)) continue;
        // The same WAP box listed under two headings is not a conflict.
        if (
          a.entry.source?.rawText &&
          a.entry.source.rawText === b.entry.source?.rawText &&
          a.entry.zeit === b.entry.zeit
        )
          continue;
        const ids = [a.entry.id, b.entry.id];
        // 1. A special item with named participants during an all-hands item.
        const pair = allHands(a) && special(b) ? [a, b] : allHands(b) && special(a) ? [b, a] : null;
        if (pair) {
          const [event, item] = pair;
          if (item.named.size)
            add(
              'overlap',
              day,
              ids,
              `«${item.entry.taetigkeit}» (${item.entry.zeit}) fällt in «${event.entry.taetigkeit}» (${event.entry.zeit}).`,
            );
          continue;
        }
        // 2. The same function in two entries at the same time.
        const shared = sharedFunctions(a.who, b.who);
        if (!shared.length) continue;
        const who = shared.map(title).join(', ');
        const at = fmt(Math.max(a.interval[0], b.interval[0]));
        if (distinctSites(a.where, b.where))
          add(
            'location_overlap',
            day,
            ids,
            `${who}: um ${at} gleichzeitig an zwei Orten («${a.entry.ort}» und «${b.entry.ort}»).`,
          );
        else if (special(a) && special(b))
          add(
            'overlap',
            day,
            ids,
            `${who}: «${a.entry.taetigkeit}» und «${b.entry.taetigkeit}» überschneiden sich (${at}).`,
          );
      }
  }
  // Unknown abbreviations: flagged once per week, on the first entry using the token.
  const uses = new Map<string, TbEntry[]>();
  for (const entry of week.entries)
    for (const token of unknownTokens(entry.taetigkeit))
      uses.set(token, [...(uses.get(token) ?? []), entry]);
  for (const [token, entries] of uses) {
    const first = entries[0];
    const more = entries.length > 1 ? ` (${entries.length}× in dieser Woche)` : '';
    add(
      'unknown_abbreviation',
      first.day,
      [first.id],
      `Unbekannte Abkürzung «${token}»${more} – bitte prüfen.`,
      fold(token),
    );
  }
  return conflicts;
}
