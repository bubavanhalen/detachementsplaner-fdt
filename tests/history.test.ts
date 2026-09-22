import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARCHIVE_KEY, PROJECT_KEY } from '../src/io/storage';
import { createDetachment, createProject } from '../src/model';

async function session() {
  vi.resetModules();
  const store = await import('../src/store');
  const project = createProject();
  project.name = 'Fiktiver Anfang';
  store.replaceProject(project);
  return store;
}

beforeEach(() => localStorage.clear());

describe('shared local project history', () => {
  it('reverses an entire transaction and restores it with redo', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.dets.push(createDetachment({ name: 'Fiktives DET' }));
      draft.name = 'Fiktive Planung';
    });
    const changed = structuredClone(store.projectStore.get());
    store.undoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Anfang');
    expect(store.projectStore.get().dets).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(PROJECT_KEY) ?? '{}').name).toBe('Fiktiver Anfang');
    store.redoProject();
    expect(store.projectStore.get()).toEqual(changed);
  });

  it('keeps edits from other pages in the same chronology', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.dets.push(createDetachment({ name: 'Fiktives DET' }));
    });
    store.changeProject((draft) => {
      draft.settings.eigeneEinheit = 'Fiktive Einheit';
    });
    store.changeProject((draft) => {
      draft.dets[0].name = 'Fiktives DET verschoben';
    });
    store.undoProject();
    expect(store.projectStore.get().settings.eigeneEinheit).toBe('Fiktive Einheit');
    expect(store.projectStore.get().dets[0].name).toBe('Fiktives DET');
    store.undoProject();
    expect(store.projectStore.get().settings.eigeneEinheit).toBe('');
    expect(store.projectStore.get().dets).toHaveLength(1);
  });

  it('discards the redo branch after a new successful edit', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktive Variante A';
    });
    store.undoProject();
    store.changeProject((draft) => {
      draft.name = 'Fiktive Variante B';
    });
    store.redoProject();
    expect(store.projectStore.get().name).toBe('Fiktive Variante B');
  });

  it('retains redo after a no-op or failed edit, without adding a history step', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktiver Folgestand';
    });
    store.undoProject();
    store.changeProject((draft) => {
      draft.name = 'Fiktiver Anfang';
    });
    expect(() =>
      store.changeProject((draft) => {
        draft.name = 'Fiktiver ungültiger Stand';
        throw new Error('Synthetic mutation failure');
      }),
    ).toThrow('Synthetic mutation failure');
    store.redoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Folgestand');
    store.undoProject();
    store.undoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Anfang');
  });

  it('bounds undo to the latest thirty transactions', async () => {
    const store = await session();
    for (let step = 1; step <= 35; step++) {
      store.changeProject((draft) => {
        draft.name = `Fiktiver Schritt ${step}`;
      });
    }
    for (let step = 0; step < 40; step++) store.undoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Schritt 5');
    for (let step = 0; step < 40; step++) store.redoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Schritt 35');
  });

  it('retains in-memory edits and history when persistence fails', async () => {
    const store = await session();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
    });
    store.changeProject((draft) => {
      draft.name = 'Fiktive ungespeicherte Arbeit';
    });
    store.undoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Anfang');
    store.redoProject();
    expect(store.projectStore.get().name).toBe('Fiktive ungespeicherte Arbeit');
    expect(store.feedbackStore.get().saveError).toContain('JSON herunterladen');
  });

  it('clears both history branches when replacing or initializing a project', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktiver alter Stand';
    });
    store.undoProject();
    const replacement = createProject();
    replacement.name = 'Fiktiver Ersatz';
    store.replaceProject(replacement);
    store.undoProject();
    store.redoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Ersatz');
    store.changeProject((draft) => {
      draft.name = 'Fiktive Änderung';
    });
    store.initializeProject(replacement);
    store.undoProject();
    store.redoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Ersatz');
  });

  it('does not retain reversible edits across an archive or its working copy', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktiver Archivstand';
    });
    store.archiveCurrent();
    expect(() => store.undoProject()).toThrow('schreibgeschützt');
    expect(() => store.redoProject()).toThrow('schreibgeschützt');
    store.reopenCurrent();
    const reopened = store.projectStore.get();
    store.undoProject();
    store.redoProject();
    expect(store.projectStore.get()).toBe(reopened);
  });

  it('preserves undo when saving the archive fails', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktiv bereit zum Archivieren';
    });
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === ARCHIVE_KEY) throw new Error('Synthetic archive failure');
      original.call(this, key, value);
    });
    expect(() => store.archiveCurrent()).toThrow('Archivieren fehlgeschlagen');
    store.undoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Anfang');
  });
});
