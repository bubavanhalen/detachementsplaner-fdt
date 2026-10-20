import { identifier, searchText } from './text';
import type { Person } from './types';

export const NAME_ONLY_REVIEW = 'Nur über den Namen zugeordnet. Identität prüfen.';

export interface MatchQuery {
  name: string;
  pnr?: string;
}
export interface MatchResult {
  person?: Person;
  /** Set when the person was found by name only; the caller stores it as identityReview. */
  review?: string;
  /** Several people carry this number; nothing is matched until the data is corrected. */
  ambiguous?: boolean;
}

/**
 * The one rule for recognising a person in every list (PISA, MILO roster, leave,
 * commands): a unique number joins records; different numbers are never joined
 * over equal names; a name-only match is optional and always marked for review.
 */
export function matchPerson(
  persons: Person[],
  query: MatchQuery,
  allowNames: boolean,
): MatchResult {
  const number = identifier(query.pnr);
  const byNumber = number ? persons.filter((person) => identifier(person.pnr) === number) : [];
  if (byNumber.length === 1) return { person: byNumber[0] };
  if (byNumber.length > 1) return { ambiguous: true };
  if (!allowNames) return {};
  const name = searchText(query.name);
  if (!name) return {};
  const candidates = persons.filter(
    (person) =>
      searchText(person.name) === name &&
      (!number || !identifier(person.pnr) || identifier(person.pnr) === number),
  );
  return candidates.length === 1 ? { person: candidates[0], review: NAME_ONLY_REVIEW } : {};
}
