import createHyphenator from 'hyphen';
import patternsDe1996 from 'hyphen/patterns/de-1996';

const SOFT_HYPHEN = '\u00AD';

/** Trenner mit Mustern de-1996 und Standardoptionen, aber ohne HTML-Lesart (CR-E102b-06). */
const hyphenateDe1996 = createHyphenator(patternsDe1996, { html: false });

/**
 * Stellen, an denen `word` getrennt werden darf: aufsteigende, eindeutige UTF-16-Indizes i mit
 * 0 < i < word.length (Trennung zwischen word.slice(0, i) und word.slice(i)).
 * Quelle: Paket `hyphen` 1.14.1, Muster de-1996, Standardoptionen ausser `html: false`. Leerer Text ergibt [].
 * Wirft nie.
 */
export function hyphenationPoints(word: string): readonly number[] {
  if (word === '') return [];
  const hyphenated = hyphenateDe1996(word);
  // Abgleich mit dem Wort: Zeichen des Wortes zuerst zuordnen (auch ein weicher Trennstrich der Eingabe);
  // jeder übrige weiche Trennstrich ist eine eingefügte Trennstelle vor word[index].
  const points: number[] = [];
  let index = 0;
  for (const unit of hyphenated.split('')) {
    if (index < word.length && unit === word[index]) index++;
    else if (unit === SOFT_HYPHEN && index > 0 && index < word.length && points.at(-1) !== index) {
      points.push(index);
    }
  }
  return points;
}
