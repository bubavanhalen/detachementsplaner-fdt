// Shared with the model so matching rules stay identical everywhere.
export { identifier, searchText } from '../model/text';
export function displayDate(value?: string): string {
  if (!value) return 'Noch offen';
  const [year, month, day] = value.split('-');
  return day && month ? `${day}.${month}.${year}` : value;
}
export function localError(error: unknown): string {
  return error instanceof Error ? error.message : 'Die Aktion konnte nicht abgeschlossen werden.';
}
