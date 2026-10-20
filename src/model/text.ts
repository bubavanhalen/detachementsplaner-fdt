// Normalisation for comparing names and numbers. Pure; used by model and local I/O.

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
export function identifier(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
