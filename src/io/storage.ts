import { normalizeProject } from '../model';
import type { Project } from '../model/types';

export const PROJECT_KEY = 'detplaner.v2';
export const ARCHIVE_KEY = 'detplaner.archives.v1';

export function readProject(storage: Storage = localStorage): Project | null {
  try {
    const raw = storage.getItem(PROJECT_KEY);
    if (!raw) return null;
    return normalizeProject(JSON.parse(raw));
  } catch {
    throw new Error('Der lokale Projektstand ist nicht lesbar. Er wurde nicht überschrieben.');
  }
}
export function saveProject(project: Project, storage: Storage = localStorage): void {
  try {
    storage.setItem(PROJECT_KEY, JSON.stringify(project));
  } catch {
    throw new Error(
      'Browserablage nicht verfügbar oder voll. Bitte den aktuellen Stand als JSON sichern.',
    );
  }
}
export function readArchives(storage: Storage = localStorage): Project[] {
  try {
    const raw: unknown = JSON.parse(storage.getItem(ARCHIVE_KEY) || '[]');
    if (!Array.isArray(raw)) throw new Error();
    return raw.map((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        !item.archive ||
        typeof item.archive.id !== 'string' ||
        !item.archive.id ||
        typeof item.archive.at !== 'string' ||
        !item.archive.at
      )
        throw new Error();
      const project = normalizeProject(item);
      if (!project.archive?.id || !project.archive.at) throw new Error();
      return project;
    });
  } catch {
    throw new Error('Die lokale Archivablage ist nicht lesbar. Sie wurde nicht überschrieben.');
  }
}
export function saveArchive(snapshot: Project, storage: Storage = localStorage): void {
  if (!snapshot.archive) throw new Error('Kein Archivstand.');
  const archives = readArchives(storage);
  if (archives.some((item) => item.archive?.id === snapshot.archive?.id)) return;
  try {
    storage.setItem(ARCHIVE_KEY, JSON.stringify([snapshot, ...archives]));
  } catch {
    throw new Error(
      'Archivieren fehlgeschlagen: Browserablage nicht verfügbar oder voll. Das aktive Projekt bleibt erhalten.',
    );
  }
}
