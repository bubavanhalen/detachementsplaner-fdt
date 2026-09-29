import type { Person, Project } from './types';

// Short forms of MILO long texts for lists and cards, taken over from the earlier planner.
// Overrides in project.maps.fkt / project.maps.lic (kept from earlier versions) win; an
// empty override hides the entry, e.g. «97 Sehhilfe», which is no vehicle category.

/** Confirmed function names. Combined functions are split at «/» and shortened per part. */
const FUNCTIONS: Record<string, string> = {
  kommandant: 'Kdt',
  'kommandant stellvertreter': 'Kdt Stv',
  einheitfeldweibel: 'Einh Fw',
  einheitsfeldweibel: 'Einh Fw',
  einheitfourier: 'Einh Four',
  einheitsfourier: 'Einh Four',
  infanterieoffizier: 'Inf Of',
  infanterieunteroffizier: 'Inf Uof',
  infanteriesoldat: 'Inf Sdt',
  späheroffizier: 'Späher Of',
  späherunteroffizier: 'Späher Uof',
  späher: 'Späher',
  mörseroffizier: 'Mö Of',
  mörserunteroffizier: 'Mö Uof',
  'mörser kanonier': 'Mö Kan',
  mörserkanonier: 'Mö Kan',
  minenwerferoffizier: 'Mw Of',
  minenwerferunteroffizier: 'Mw Uof',
  'minenwerfer kanonier': 'Mw Kan',
  minenwerferkanonier: 'Mw Kan',
  aufklärungsoffizier: 'Aufkl Of',
  aufklärungsunteroffizier: 'Aufkl Uof',
  aufklärer: 'Aufkl',
  führungsstaffelsoldat: 'Fhr St Sdt',
  führungsstaffelunteroffizier: 'Fhr St Uof',
  infanterieeinheitssanitäter: 'Inf Einh San',
  nachschubsoldat: 'Ns Sdt',
  nachschubunteroffizier: 'Ns Uof',
  transportunteroffizier: 'Trsp Uof',
  transportsoldat: 'Trsp Sdt',
  truppenbuchhalter: 'Trp Buchh',
  truppenkoch: 'Trp Koch',
  küchenchef: 'Kü Chef',
  'küchenlogistik soldat': 'Kü Log Sdt',
  küchenlogistiksoldat: 'Kü Log Sdt',
  büroordonnanz: 'Büro Ord',
  motorfahrer: 'Motf',
  'abc spürer': 'ABC Spür',
  'abc spür': 'ABC Spür',
  'fahrer b': 'Fahr B',
  'fahrer c': 'Fahr C',
  'fahrer c1': 'Fahr C1',
  'fahrer d1': 'Fahr D1',
  übermittlungssoldat: 'Uem Sdt',
  nachrichtensoldat: 'Na Sdt',
};
/** Otherwise the first matching prefix and every matching suffix are shortened. */
const PREFIXES: [RegExp, string][] = [
  [/^führungsstaffel/i, 'Fhr St '],
  [/^infanterieeinheits/i, 'Inf Einh '],
  [/^infanterie/i, 'Inf '],
  [/^minenwerfer\s*/i, 'Mw '],
  [/^mörser\s*/i, 'Mö '],
  [/^aufklärungs/i, 'Aufkl '],
  [/^aufklärer/i, 'Aufkl'],
  [/^späher/i, 'Späher '],
  [/^nachschub/i, 'Ns '],
  [/^transport/i, 'Trsp '],
  [/^küchen?\s*/i, 'Kü '],
  [/^truppen?\s*/i, 'Trp '],
  [/^einheits?\s*/i, 'Einh '],
  [/^übermittlungs/i, 'Uem '],
];
const SUFFIXES: [RegExp, string][] = [
  [/unteroffizier/i, ' Uof'],
  [/offizier/i, ' Of'],
  [/soldat/i, ' Sdt'],
  [/kanonier/i, ' Kan'],
  [/feldweibel/i, ' Fw'],
  [/fourier/i, ' Four'],
  [/sanitäter/i, ' San'],
  [/spürer/i, ' Spür'],
  [/buchhalter/i, ' Buchh'],
  [/logistik/i, ' Log'],
  [/ordonnanz/i, ' Ord'],
  [/fahrer/i, ' Fahr'],
];
function shortPart(part: string): string {
  const text = part.trim();
  if (!text) return '';
  const known = FUNCTIONS[text.toLocaleLowerCase('de-CH')];
  if (known) return known;
  let result = text;
  const prefix = PREFIXES.find(([pattern]) => pattern.test(result));
  if (prefix) result = result.replace(prefix[0], prefix[1]);
  for (const [pattern, replacement] of SUFFIXES) result = result.replace(pattern, replacement);
  return result.replace(/\s+/g, ' ').trim();
}
function override(project: Project, kind: 'fkt' | 'lic', text: string): string | undefined {
  const map = project.maps?.[kind];
  return map && Object.hasOwn(map, text) ? map[text] : undefined;
}

/** «Späheroffizier» → «Späher Of», «Aufklärer/Fahrer B» → «Aufkl/Fahr B». */
export function shortFunction(project: Project, value: string): string {
  const text = value.trim();
  if (!text) return '';
  return override(project, 'fkt', text) ?? text.split('/').map(shortPart).filter(Boolean).join('/');
}

/** Military driving licences by code; «97 Sehhilfe» is a condition, not a category. */
const LICENSES: Record<string, string> = {
  '21': 'G-Klasse',
  '22': 'PW',
  '23': 'G-Klasse mit Anh',
  '24': 'PW mit Anh',
  '30': 'Lastwagen',
  '31': 'Duro',
  '32': 'Lastwagen mit Anh',
  '33': 'Duro mit Anh',
  '44': 'Gabelstapler',
  '45': 'FUG',
  '62': 'Piranha 6x6',
  '63': 'Piranha 8x8',
  '97': '',
};
/** The trailer variant includes its base category, which is then not listed again. */
const WITH_TRAILER: Record<string, string> = { '21': '23', '22': '24', '30': '32', '31': '33' };
const licenseCode = (value: string): string => /^(\d{2,3})\b/.exec(value.trim())?.[1] ?? '';

/** «21 L Motorwagen geländegängig» → «G-Klasse»; unknown codes lose only the number. */
export function shortLicense(project: Project, value: string): string {
  const text = value.trim();
  if (!text) return '';
  const code = licenseCode(text);
  return (
    override(project, 'lic', text) ??
    (code && Object.hasOwn(LICENSES, code) ? LICENSES[code] : text.replace(/^\d{2,3}\s*/, ''))
  );
}

/** Short vehicle categories of a person, each once, without hidden entries. */
export function licenseCategories(project: Project, person: Person): string[] {
  const codes = person.lics.map(licenseCode);
  const result: string[] = [];
  person.lics.forEach((license, index) => {
    const trailer = WITH_TRAILER[codes[index]];
    if (trailer && codes.includes(trailer)) return;
    const short = shortLicense(project, license);
    if (short && !result.includes(short)) result.push(short);
  });
  return result;
}
