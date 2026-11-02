// Zerlegung von JS/TS-Quelltext in Code, Kommentare, Zeichenketten, Vorlagen und reguläre Ausdrücke
// (Paket E1-01, ADR-010 §4.1, §4.4). Kein vollständiger Parser: genug, damit die Musterprüfung (F4)
// Kommentare, Zeichenketten und Code getrennt bewerten und die Grenzprüfung (F7) Importe finden kann.

/**
 * @typedef {'code' | 'kommentar' | 'zeichenkette' | 'vorlage' | 'regex'} Art
 * @typedef {{ art: Art; text: string; start: number }} Teil
 */

/** Schlüsselwörter, nach denen ein «/» einen regulären Ausdruck beginnt. */
const VOR_REGEX = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);

/**
 * Zerlegt einen Quelltext.
 * @param {string} text
 * @returns {Teil[]}
 */
export function zerlege(text) {
  /** @type {Teil[]} */
  const teile = [];
  let i = 0;
  let codeStart = 0;
  /** Letztes bedeutsames Code-Zeichen bzw. Wort vor der aktuellen Stelle (für «/»). */
  let letztes = '';
  /** Klammertiefe innerhalb von Vorlagen-Ausdrücken. */
  /** @type {number[]} */
  const vorlagen = [];

  const schliesseCode = (/** @type {number} */ bis) => {
    if (bis > codeStart)
      teile.push({ art: 'code', text: text.slice(codeStart, bis), start: codeStart });
  };

  /**
   * Liest eine Vorlage ab dem öffnenden Backtick (i zeigt darauf) bis zum Ende oder bis «${».
   * @returns {boolean} true, wenn ein Ausdruck «${» beginnt
   */
  const leseVorlage = () => {
    const start = i;
    i += 1;
    while (i < text.length) {
      const c = text[i];
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '`') {
        i += 1;
        teile.push({ art: 'vorlage', text: text.slice(start, i), start });
        return false;
      }
      if (c === '$' && text[i + 1] === '{') {
        i += 2;
        teile.push({ art: 'vorlage', text: text.slice(start, i), start });
        return true;
      }
      i += 1;
    }
    teile.push({ art: 'vorlage', text: text.slice(start), start });
    return false;
  };

  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '/' && n === '/') {
      schliesseCode(i);
      const ende = text.indexOf('\n', i);
      const bis = ende < 0 ? text.length : ende;
      teile.push({ art: 'kommentar', text: text.slice(i, bis), start: i });
      i = bis;
      codeStart = i;
      continue;
    }
    if (c === '/' && n === '*') {
      schliesseCode(i);
      const ende = text.indexOf('*/', i + 2);
      const bis = ende < 0 ? text.length : ende + 2;
      teile.push({ art: 'kommentar', text: text.slice(i, bis), start: i });
      i = bis;
      codeStart = i;
      continue;
    }
    if (c === "'" || c === '"') {
      schliesseCode(i);
      const start = i;
      i += 1;
      while (i < text.length && text[i] !== c && text[i] !== '\n') {
        i += text[i] === '\\' ? 2 : 1;
      }
      i = Math.min(i + 1, text.length);
      teile.push({ art: 'zeichenkette', text: text.slice(start, i), start });
      codeStart = i;
      letztes = 'a';
      continue;
    }
    if (c === '`') {
      schliesseCode(i);
      if (leseVorlage()) vorlagen.push(0);
      codeStart = i;
      letztes = 'a';
      continue;
    }
    if (c === '}' && vorlagen.length > 0 && vorlagen[vorlagen.length - 1] === 0) {
      // Ende eines Vorlagen-Ausdrucks: die Vorlage geht weiter.
      schliesseCode(i);
      vorlagen.pop();
      const start = i;
      i += 1;
      // Fortsetzung der Vorlage ab «}» bis zum nächsten «${» oder Backtick.
      let weiter = false;
      while (i < text.length) {
        const d = text[i];
        if (d === '\\') {
          i += 2;
          continue;
        }
        if (d === '`') {
          i += 1;
          break;
        }
        if (d === '$' && text[i + 1] === '{') {
          i += 2;
          weiter = true;
          break;
        }
        i += 1;
      }
      teile.push({ art: 'vorlage', text: text.slice(start, i), start });
      if (weiter) vorlagen.push(0);
      codeStart = i;
      letztes = 'a';
      continue;
    }
    if (c === '{' && vorlagen.length > 0) {
      vorlagen[vorlagen.length - 1] = (vorlagen[vorlagen.length - 1] ?? 0) + 1;
    } else if (c === '}' && vorlagen.length > 0) {
      vorlagen[vorlagen.length - 1] = (vorlagen[vorlagen.length - 1] ?? 1) - 1;
    }
    if (c === '/') {
      const regexMoeglich =
        letztes === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(letztes) || VOR_REGEX.has(letztes);
      if (regexMoeglich) {
        schliesseCode(i);
        const start = i;
        i += 1;
        let klasse = false;
        while (i < text.length && text[i] !== '\n') {
          const d = text[i];
          if (d === '\\') {
            i += 2;
            continue;
          }
          if (d === '[') klasse = true;
          else if (d === ']') klasse = false;
          else if (d === '/' && !klasse) break;
          i += 1;
        }
        i += 1;
        while (i < text.length && /[a-z]/i.test(text[i] ?? '')) i += 1;
        teile.push({ art: 'regex', text: text.slice(start, i), start });
        codeStart = i;
        letztes = 'a';
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(c ?? '')) {
      let j = i;
      while (j < text.length && /[\w$]/.test(text[j] ?? '')) j += 1;
      letztes = text.slice(i, j);
      i = j;
      continue;
    }
    if (!/\s/.test(c ?? '')) letztes = c === ')' || c === ']' ? 'a' : (c ?? '');
    i += 1;
  }
  schliesseCode(text.length);
  return teile;
}

/**
 * Zeilennummer (1-basiert) einer Stelle.
 * @param {string} text
 * @param {number} stelle
 * @returns {number}
 */
export function zeileVon(text, stelle) {
  let n = 1;
  for (let k = 0; k < stelle && k < text.length; k++) if (text.charCodeAt(k) === 10) n += 1;
  return n;
}

/**
 * Inhalt einer Zeichenkette ohne Anführungszeichen (Escape-Folgen bleiben roh).
 * @param {string} roh
 * @returns {string}
 */
export function zeichenketteInhalt(roh) {
  return roh.length >= 2 ? roh.slice(1, -1) : '';
}
