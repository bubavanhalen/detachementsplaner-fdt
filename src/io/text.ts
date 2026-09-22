export function searchText(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase('de-CH')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function displayDate(value?: string): string {
  if (!value) return 'Noch offen';
  const [year, month, day] = value.split('-');
  return day && month ? `${day}.${month}.${year}` : value;
}
export function identifier(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
export function localError(error: unknown): string {
  return error instanceof Error ? error.message : 'Die Aktion konnte nicht abgeschlossen werden.';
}
