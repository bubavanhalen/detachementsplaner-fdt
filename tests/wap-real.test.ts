// Local-only check against the real Kp-WAP in the git-ignored fixtures-private/
// folder (owner-granted exception). Skips when the file is absent (CI, other
// machines). Reports go to the terminal and to fixtures-private/reports/ only.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listWapSheets, parseWap } from '../src/io/wap';
import {
  DEFAULT_TB_RULES,
  detectEntryConflicts,
  emptyWeek,
  TB_SECTION_HEADINGS,
  type TbEntry,
  type TbSection,
  type TbWeek,
  type TbWeekday,
  type WapParseResult,
} from '../src/model/tagesbefehl';

const DIR = 'fixtures-private';
const WAP = `${DIR}/fixtures/01_02_WAP_FDT_2026.xlsx`;
const EXPECTED = `${DIR}/fixtures/kvk_expected.json`;
const REPORTS = `${DIR}/reports`;
const available = existsSync(WAP) && existsSync(EXPECTED);

interface ExpectedEntry {
  zeit: string;
  taetigkeit: string;
  verantwortlich: string;
  ort: string;
}
interface ExpectedSection {
  heading: string;
  level: number;
  entries: ExpectedEntry[];
}
interface ExpectedDay {
  sections?: ExpectedSection[];
  dienstbetrieb?: ExpectedEntry[];
  besonderes?: ExpectedEntry[];
}
interface Expected {
  week_start: string;
  days: Record<TbWeekday, ExpectedDay>;
  expected_conflicts: { day: TbWeekday; type: string; detail: string }[];
}

interface Want extends ExpectedEntry {
  day: TbWeekday;
  section: TbSection;
  group: string | null;
}

const norm = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const head = (text: string) => norm(text.split(/\s\/\s|[,;(:]/)[0] ?? text);
const startOf = (zeit: string): number | null => {
  const m = /(\d{2})(\d{2})/.exec(zeit);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const prefix = (a: string, b: string) =>
  !!a && !!b && (a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `));

/** 0 exact, 1 prefix, 2 head prefix, 3 token containment (same first word), -1 none. */
function textTier(want: string, got: string): number {
  const a = norm(want),
    b = norm(got);
  if (a === b) return 0;
  if (prefix(a, b)) return 1;
  if (prefix(head(want), head(got))) return 2;
  const ta = norm(want.split(';')[0]).split(' '),
    tb = norm(got.split(';')[0]).split(' ');
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short[0] === long[0] && short.length >= 2 && short.every((t) => long.includes(t))) return 3;
  return -1;
}

const SECTION_BY_HEADING = Object.fromEntries(
  Object.entries(TB_SECTION_HEADINGS).map(([k, v]) => [v, k as TbSection]),
) as Record<string, TbSection>;

function wanted(expected: Expected): Want[] {
  const out: Want[] = [];
  for (const [day, value] of Object.entries(expected.days) as [TbWeekday, ExpectedDay][]) {
    for (const section of value.sections ?? [])
      for (const e of section.entries)
        out.push({
          ...e,
          day,
          section: section.level === 1 ? SECTION_BY_HEADING[section.heading] : 'dienstbetrieb',
          group: section.level === 1 ? null : section.heading,
        });
    for (const e of value.dienstbetrieb ?? [])
      out.push({ ...e, day, section: 'dienstbetrieb', group: null });
    for (const e of value.besonderes ?? [])
      out.push({ ...e, day, section: 'besonderes', group: null });
  }
  return out;
}

interface Match {
  want: Want;
  got: TbEntry;
  tier: number;
}

function compare(result: WapParseResult, wants: Want[]) {
  const pairs: { w: number; g: number; tier: number; dt: number }[] = [];
  wants.forEach((want, w) => {
    result.entries.forEach((got, g) => {
      if (got.day !== want.day || got.section !== want.section) return;
      if (want.group != null && norm(got.group) !== norm(want.group)) return;
      const ws = startOf(want.zeit),
        gs = got.zeit === 'anschl' ? (got.source?.rawStart ?? null) : startOf(got.zeit);
      const dt = ws == null ? 0 : gs == null ? 999 : Math.abs(ws - gs);
      if (dt > 15) return;
      const tier = textTier(want.taetigkeit, got.taetigkeit);
      if (tier < 0) return;
      pairs.push({ w, g, tier, dt });
    });
  });
  pairs.sort((a, b) => a.tier - b.tier || a.dt - b.dt);
  const usedW = new Set<number>(),
    usedG = new Set<number>();
  const matches: Match[] = [];
  for (const p of pairs) {
    if (usedW.has(p.w) || usedG.has(p.g)) continue;
    usedW.add(p.w);
    usedG.add(p.g);
    matches.push({ want: wants[p.w], got: result.entries[p.g], tier: p.tier });
  }
  return {
    matches,
    misses: wants.filter((_, i) => !usedW.has(i)),
    extras: result.entries.filter((_, i) => !usedG.has(i)),
  };
}

function weekOf(result: WapParseResult): TbWeek {
  return {
    ...emptyWeek(result.sheet),
    startDate: result.startDate,
    days: result.days,
    entries: result.entries,
    groups: result.groups,
    parseConflicts: result.conflicts,
    notes: result.notes,
  };
}

const line = (e: Pick<TbEntry, 'zeit' | 'taetigkeit' | 'verantwortlich' | 'ort'>) =>
  `${e.zeit.padEnd(11)} | ${e.taetigkeit} | ${e.verantwortlich} | ${e.ort}`;
const where = (e: { day: string; section: string; group?: string | null }) =>
  `${e.day} ${e.section}${e.group ? ` [${e.group}]` : ''}`;

/** Heading aliases (user configuration) derived by pairing detected and reviewed headings. */
function deriveAliases(result: WapParseResult, expected: Expected): Record<string, string> {
  const aliases: Record<string, string> = {};
  const conflicting = new Set<string>();
  for (const [day, value] of Object.entries(expected.days) as [TbWeekday, ExpectedDay][]) {
    const want = (value.sections ?? []).filter((s) => s.level === 2).map((s) => s.heading);
    const got = result.groups[day] ?? [];
    if (want.length !== got.length) continue;
    got.forEach((heading, i) => {
      const parts = heading.split(' / '),
        target = want[i].split(' / ');
      const pairs: [string, string][] =
        parts.length === 1
          ? [[heading, want[i]]]
          : parts.length === target.length
            ? parts.map((p, k) => [p, target[k]])
            : [];
      for (const [from, to] of pairs) {
        if (from === to) continue;
        if (aliases[from] && aliases[from] !== to) conflicting.add(from);
        aliases[from] = to;
      }
    });
  }
  for (const key of conflicting) delete aliases[key];
  return aliases;
}

describe.skipIf(!available)('Kp-WAP parser on the real (private) WAP', () => {
  const bytes = available ? new Uint8Array(readFileSync(WAP)) : new Uint8Array();
  const expected: Expected = available ? JSON.parse(readFileSync(EXPECTED, 'utf8')) : null;
  const rules = DEFAULT_TB_RULES;

  it('lists the sheets', () => {
    expect(listWapSheets(bytes)).toEqual(expect.arrayContaining(['KVK']));
  });

  it('matches the reviewed KVK week (≥ 90 %) and finds all expected conflicts', () => {
    const plain = parseWap(bytes, 'KVK', { rules });
    const aliases = deriveAliases(plain, expected);
    const result = parseWap(bytes, 'KVK', { rules, groupAliases: aliases });
    const wants = wanted(expected);
    const { matches, misses, extras } = compare(result, wants);
    const plainCompare = compare(plain, wants);
    const rate = matches.length / wants.length;
    const tiers = [0, 1, 2, 3].map((t) => matches.filter((m) => m.tier === t).length);
    const conflicts = [...result.conflicts, ...detectEntryConflicts(weekOf(result))];
    const missingConflicts = expected.expected_conflicts.filter(
      (c) => !conflicts.some((f) => f.day === c.day && f.type === c.type),
    );

    const out: string[] = [];
    out.push(`KVK: ${matches.length}/${wants.length} = ${(rate * 100).toFixed(1)} %`);
    out.push(`  tiers exact/prefix/head/tokens: ${tiers.join('/')}`);
    out.push(
      `  without heading aliases: ${plainCompare.matches.length}/${wants.length}; aliases used: ${JSON.stringify(aliases)}`,
    );
    out.push(`  start date: ${result.startDate} (expected ${expected.week_start})`);
    out.push(`  diagnostics: ${result.diagnostics.join(' · ')}`);
    out.push(`  groups: ${JSON.stringify(result.groups)}`);
    out.push('', `MISSES (${misses.length}):`);
    for (const m of misses) {
      out.push(`  - ${where(m)} | ${line(m)}`);
      const near = result.entries.filter(
        (e) => e.day === m.day && textTier(m.taetigkeit, e.taetigkeit) >= 0,
      );
      for (const n of near) out.push(`      ~ ${where(n)} | ${line(n)}`);
    }
    out.push('', `EXTRAS (${extras.length}):`);
    for (const e of extras)
      out.push(`  + ${where(e)} | ${line(e)} | raw: ${e.source?.rawText ?? ''}`);
    out.push('', 'HEURISTIC MATCHES (tier ≥ 2):');
    for (const m of matches.filter((x) => x.tier >= 2))
      out.push(
        `  = ${where(m.want)} | «${m.want.taetigkeit}» ≈ «${m.got.taetigkeit}» (tier ${m.tier})`,
      );
    out.push('', `CONFLICTS (${conflicts.length}):`);
    for (const c of conflicts)
      out.push(`  ! ${c.day} ${c.type}: ${c.message} [${c.entryIds.join(', ')}]`);
    out.push('', `EXPECTED CONFLICTS MISSING (${missingConflicts.length}):`);
    for (const c of missingConflicts) out.push(`  ? ${c.day} ${c.type}: ${c.detail}`);
    out.push('', 'ALL ENTRIES:');
    for (const e of result.entries)
      out.push(
        `  ${e.id.padEnd(10)} ${where(e)} | ${line(e)} | ${(e.source?.flags ?? []).join('; ')}`,
      );
    mkdirSync(REPORTS, { recursive: true });
    writeFileSync(`${REPORTS}/wap-kvk-report.txt`, out.join('\n'));
    // Local terminal output only (real data never leaves this machine).
    process.stdout.write(`${out.slice(0, out.indexOf('ALL ENTRIES:')).join('\n')}\n`);

    expect(rate).toBeGreaterThanOrEqual(0.9);
    expect(missingConflicts).toEqual([]);
    expect(result.startDate).toBe(expected.week_start);
  });

  it('parses Wo 1–3 plausibly and writes the local plausibility report', () => {
    const md: string[] = ['# WAP plausibility report (local only, never commit)', ''];
    for (const sheet of listWapSheets(bytes).filter((s) => s !== 'KVK')) {
      const result = parseWap(bytes, sheet, { rules });
      const conflicts = [...result.conflicts, ...detectEntryConflicts(weekOf(result))];
      md.push(`## ${sheet}`, '');
      md.push(`- Start date: ${result.startDate || '—'}; days: ${result.days.join(', ')}`);
      md.push(`- Diagnostics: ${result.diagnostics.join(' · ')}`);
      md.push(`- Sub-columns: ${JSON.stringify(result.columns)}`);
      md.push(
        `- Notes: ${result.notes.wochenziele.length} Wochenziele, ${result.notes.bemerkungen.length} Bemerkungen`,
      );
      md.push(
        '',
        '| Day | Dienstbetrieb (allg.) | Gruppen | Besonderes | Rapporte | Konflikte |',
        '|---|---|---|---|---|---|',
      );
      for (const day of result.days) {
        const of = (section: TbSection, grouped?: boolean) =>
          result.entries.filter(
            (e) =>
              e.day === day &&
              e.section === section &&
              (grouped == null || (grouped ? !!e.group : !e.group)),
          ).length;
        md.push(
          `| ${day} | ${of('dienstbetrieb', false)} | ${of('dienstbetrieb', true)} (${(result.groups[day] ?? []).join(' · ')}) | ${of('besonderes')} | ${of('rapporte')} | ${conflicts.filter((c) => c.day === day).length} |`,
        );
      }
      md.push('', '### Conflicts', '');
      for (const c of conflicts) md.push(`- ${c.day} \`${c.type}\`: ${c.message}`);
      const suspicious = result.entries.filter(
        (e) =>
          !e.zeit ||
          e.taetigkeit.length < 2 ||
          /\d{4}$/.test(e.taetigkeit) ||
          (e.section === 'dienstbetrieb' && e.group && !result.groups[e.day]?.includes(e.group)),
      );
      md.push('', '### Suspicious entries', '');
      for (const e of suspicious) md.push(`- ${where(e)} | ${line(e)}`);
      md.push('', '### Entries', '');
      for (const e of result.entries)
        md.push(`- ${where(e)} | ${line(e)} | ${(e.source?.flags ?? []).join('; ')}`);
      md.push('');
      expect(result.days.length).toBeGreaterThanOrEqual(5);
      expect(result.entries.length).toBeGreaterThan(20);
    }
    mkdirSync(REPORTS, { recursive: true });
    writeFileSync(`${REPORTS}/wap-plausibility.md`, md.join('\n'));
  });
});
