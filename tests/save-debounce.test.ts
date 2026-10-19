import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_KEY } from '../src/io/storage';
import { createDetachment, createProject } from '../src/model';

// Reset module-private save state for every wholly fictional device session.
async function session() {
  vi.resetModules();
  const store = await import('../src/store');
  const project = createProject();
  project.name = 'Fiktiver Anfang';
  project.dets.push(createDetachment({ name: 'Fiktives DET' }));
  store.replaceProject(project);
  return store;
}
function projectWrites(spy: { mock: { calls: unknown[][] } }): number {
  return spy.mock.calls.filter(([key]) => key === PROJECT_KEY).length;
}
function storedName(): string {
  return JSON.parse(localStorage.getItem(PROJECT_KEY) ?? '{}').name;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('cheap no-op detection', () => {
  it('ignores focus/blur commits without consuming undo, discarding redo or saving', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktiver Folgestand';
    });
    store.undoProject();
    store.flushProjectSave();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const current = store.projectStore.get();
    store.changeProject(() => {});
    store.changeProject((draft) => {
      draft.name = 'Fiktiver Anfang';
      draft.dets[0].name = 'Fiktives DET';
    });
    // JSON drops undefined values, so adding one is no edit either.
    store.changeProject((draft) => {
      draft.dets[0].bem = '';
      draft.fictionalUnset = undefined;
    });
    expect(store.projectStore.get()).toBe(current);
    vi.advanceTimersByTime(5000);
    expect(projectWrites(writes)).toBe(0);
    store.redoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Folgestand');
    store.undoProject();
    store.undoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Anfang');
  });

  it('still records nested, array and type changes as edits', async () => {
    const store = await session();
    const edits: Array<(draft: ReturnType<typeof store.projectStore.get>) => void> = [
      (draft) => {
        draft.dets[0].zusatzIds.push('fiction-extra');
      },
      (draft) => {
        draft.settings.puffer = draft.settings.puffer + 1;
      },
      (draft) => {
        draft.archiveHint = null;
      },
      (draft) => {
        draft.archiveHint = 0;
      },
      (draft) => {
        draft.dets.reverse();
        draft.dets.push(createDetachment({ name: 'Fiktives zweites DET' }));
      },
      (draft) => {
        draft.dets.reverse();
      },
    ];
    for (const edit of edits) {
      const before = store.projectStore.get();
      store.changeProject(edit);
      expect(store.projectStore.get()).not.toBe(before);
    }
    for (let step = 0; step < edits.length; step++) store.undoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Anfang');
    expect(store.projectStore.get().dets).toHaveLength(1);
    expect(store.projectStore.get().archiveHint).toBeUndefined();
  });
});

describe('debounced local saving', () => {
  it('writes a burst of rapid edits once, after a short pause', async () => {
    const store = await session();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    for (let step = 1; step <= 10; step++) {
      store.changeProject((draft) => {
        draft.name = `Fiktiver Tippschritt ${step}`;
      });
      vi.advanceTimersByTime(50);
    }
    expect(projectWrites(writes)).toBe(0);
    expect(storedName()).toBe('Fiktiver Anfang');
    vi.advanceTimersByTime(1000);
    expect(projectWrites(writes)).toBe(1);
    expect(storedName()).toBe('Fiktiver Tippschritt 10');
    expect(store.feedbackStore.get().savedAt).toBeGreaterThan(0);
  });

  it('keeps saving during continuous editing without a pause', async () => {
    const store = await session();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    for (let step = 1; step <= 50; step++) {
      store.changeProject((draft) => {
        draft.name = `Fiktiver Dauerschritt ${step}`;
      });
      vi.advanceTimersByTime(100);
    }
    // 5 s of edits every 100 ms: bounded by the maximum wait, not postponed forever.
    expect(projectWrites(writes)).toBeGreaterThanOrEqual(2);
    expect(projectWrites(writes)).toBeLessThan(10);
  });

  it('debounces undo and redo and stores the state they produce', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktive Planung';
    });
    store.flushProjectSave();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    store.undoProject();
    store.redoProject();
    store.undoProject();
    expect(projectWrites(writes)).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(projectWrites(writes)).toBe(1);
    expect(storedName()).toBe('Fiktiver Anfang');
  });

  it('writes discrete project replacements at once and drops superseded pending edits', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktive verworfene Zwischenarbeit';
    });
    const replacement = createProject();
    replacement.name = 'Fiktives Importprojekt';
    store.replaceProject(replacement);
    expect(storedName()).toBe('Fiktives Importprojekt');
    vi.advanceTimersByTime(5000);
    expect(storedName()).toBe('Fiktives Importprojekt');
  });

  it.each([
    ['pagehide', () => window.dispatchEvent(new Event('pagehide'))],
    ['beforeunload', () => window.dispatchEvent(new Event('beforeunload', { cancelable: true }))],
    [
      'visibilitychange to hidden',
      () => {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
      },
    ],
  ])('flushes pending edits on %s', async (_name, leave) => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktive letzte Eingabe';
    });
    expect(storedName()).toBe('Fiktiver Anfang');
    leave();
    expect(storedName()).toBe('Fiktive letzte Eingabe');
  });

  it('does not flush when the page merely becomes visible', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktive sichtbare Eingabe';
    });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(storedName()).toBe('Fiktiver Anfang');
    vi.advanceTimersByTime(1000);
    expect(storedName()).toBe('Fiktive sichtbare Eingabe');
  });
});

describe('failed debounced saves', () => {
  it('keeps the working copy, shows the persistent warning and retries on the next edit', async () => {
    const store = await session();
    const saved = localStorage.getItem(PROJECT_KEY);
    const write = Storage.prototype.setItem;
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
    });
    store.changeProject((draft) => {
      draft.name = 'Fiktive ungespeicherte Arbeit';
    });
    vi.advanceTimersByTime(1000);
    expect(store.projectStore.get().name).toBe('Fiktive ungespeicherte Arbeit');
    expect(store.feedbackStore.get().saveError).toContain('JSON herunterladen');
    expect(localStorage.getItem(PROJECT_KEY)).toBe(saved);
    // The warning stays until a later save actually succeeds.
    vi.advanceTimersByTime(60_000);
    expect(store.feedbackStore.get().saveError).toContain('JSON herunterladen');
    store.undoProject();
    expect(store.projectStore.get().name).toBe('Fiktiver Anfang');
    store.redoProject();
    writes.mockImplementation(function (this: Storage, key, value) {
      write.call(this, key, value);
    });
    store.changeProject((draft) => {
      draft.name = 'Fiktive gerettete Arbeit';
    });
    vi.advanceTimersByTime(1000);
    expect(store.feedbackStore.get().saveError).toBe('');
    expect(storedName()).toBe('Fiktive gerettete Arbeit');
  });

  it('asks before unloading when the final flush fails', async () => {
    const store = await session();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
    });
    store.changeProject((draft) => {
      draft.name = 'Fiktive letzte ungespeicherte Arbeit';
    });
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    expect(store.feedbackStore.get().saveError).toContain('JSON herunterladen');
    expect(store.projectStore.get().name).toBe('Fiktive letzte ungespeicherte Arbeit');
  });

  it('lets the page unload without a prompt once everything is stored', async () => {
    const store = await session();
    store.changeProject((draft) => {
      draft.name = 'Fiktive gespeicherte Arbeit';
    });
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(false);
    expect(storedName()).toBe('Fiktive gespeicherte Arbeit');
  });
});
