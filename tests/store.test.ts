import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARCHIVE_KEY, PROJECT_KEY } from '../src/io/storage';
import { createProject, type Project } from '../src/model';

function fictionalProject(name: string): Project {
  return { ...createProject(), name };
}

// Reset module-private startup state for every wholly fictional device session.
async function session() {
  vi.resetModules();
  return import('../src/store');
}

beforeEach(() => localStorage.clear());

describe('local project state and persistence', () => {
  it('does not commit or save a partially failed mutation', async () => {
    const store = await session();
    const project = fictionalProject('Fiktiver Ausgangsstand');
    store.replaceProject(project);
    const before = localStorage.getItem(PROJECT_KEY);
    expect(() =>
      store.changeProject((draft) => {
        draft.name = 'Unvollständige Änderung';
        throw new Error('Fiktive ungültige Änderung');
      }),
    ).toThrow();
    expect(store.projectStore.get().name).toBe('Fiktiver Ausgangsstand');
    expect(localStorage.getItem(PROJECT_KEY)).toBe(before);
  });

  it('retains the working copy and warns when local saving fails', async () => {
    const store = await session();
    store.replaceProject(fictionalProject('Fiktiver Ausgangsstand'));
    const saved = localStorage.getItem(PROJECT_KEY);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
    });
    store.changeProject((draft) => {
      draft.name = 'Fiktive neue Arbeit';
    });
    expect(store.projectStore.get().name).toBe('Fiktive neue Arbeit');
    expect(store.feedbackStore.get().saveError).toContain('JSON herunterladen');
    expect(localStorage.getItem(PROJECT_KEY)).toBe(saved);
  });

  it('does not lock or replace the active project when archiving runs out of space', async () => {
    const store = await session();
    store.replaceProject(fictionalProject('Fiktives aktives Projekt'));
    const active = store.projectStore.get();
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === ARCHIVE_KEY)
        throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      write.call(this, key, value);
    });
    expect(() => store.archiveCurrent()).toThrow('Archivieren fehlgeschlagen');
    expect(store.projectStore.get()).toBe(active);
    expect(store.projectStore.get().archive).toBeNull();
    expect(localStorage.getItem(ARCHIVE_KEY)).toBeNull();
  });

  it('opens embedded data without overwriting an existing browser project on startup', async () => {
    const existing = fictionalProject('Fiktives Browserprojekt');
    const serialized = JSON.stringify(existing);
    localStorage.setItem(PROJECT_KEY, serialized);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const store = await session();
    store.initializeProject(fictionalProject('Fiktives Dateiprojekt'));
    expect(store.projectStore.get().name).toBe('Fiktives Dateiprojekt');
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(PROJECT_KEY)).toBe(serialized);
  });

  it('preserves unreadable storage rather than silently replacing it', async () => {
    const unreadable = '{fictional broken JSON';
    localStorage.setItem(PROJECT_KEY, unreadable);
    const store = await session();
    store.initializeProject();
    store.changeProject((draft) => {
      draft.name = 'Fiktive neue Arbeit';
    });
    expect(localStorage.getItem(PROJECT_KEY)).toBe(unreadable);
    expect(store.feedbackStore.get().saveError).toContain('Automatisches Speichern ist gesperrt');
    expect(store.projectStore.get().name).toBe('Fiktive neue Arbeit');
  });
});
