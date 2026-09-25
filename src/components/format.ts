import type { Person } from '../model/types';

/** Two-letter initials for avatars, derived locally from the display name. */
export function personInitials(person: Pick<Person, 'name'>): string {
  const parts = person.name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : ''}`.toUpperCase();
}
