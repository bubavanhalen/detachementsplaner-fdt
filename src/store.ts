import { createStore, useSelector } from '@tanstack/react-store';
import { readProject, saveArchive, saveProject } from './io/storage';
import { archiveSnapshot, createProject, normalizeProject, resumeProject } from './model';
import type { Project } from './model/types';

export const projectStore = createStore(createProject());
export interface ToastAction {
  label: string;
  run: () => void;
}
export interface Feedback {
  message: string;
  /** Increments per notification so a repeated message restarts the toast timer. */
  seq: number;
  tone: 'neutral' | 'success' | 'warning';
  action?: ToastAction;
  saveError: string;
  /** Epoch milliseconds of the last successful local save; 0 before the first save. */
  savedAt: number;
}
export const feedbackStore = createStore<Feedback>({
  message: '',
  seq: 0,
  tone: 'neutral',
  saveError: '',
  savedAt: 0,
});
const HISTORY_LIMIT = 30;
const historyStore = createStore<{ past: Project[]; future: Project[] }>({ past: [], future: [] });
let storageReadable = true;

export function useProject(): Project {
  return useSelector(projectStore, (value) => value);
}
export function useFeedback() {
  return useSelector(feedbackStore, (value) => value);
}
export function useHistory(): { canUndo: boolean; canRedo: boolean } {
  const history = useSelector(historyStore, (value) => value);
  return { canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
function clearHistory(): void {
  historyStore.setState(() => ({ past: [], future: [] }));
}
function assertEditable(project: Project): void {
  if (project.archive)
    throw new Error('Archivstand ist schreibgeschützt. Öffne zuerst eine Arbeitskopie.');
}
export function notify(
  message: string,
  options: { action?: ToastAction; tone?: Feedback['tone'] } = {},
): void {
  feedbackStore.setState((old) => ({
    ...old,
    message,
    seq: old.seq + 1,
    tone: options.tone ?? 'neutral',
    action: options.action,
  }));
}
/** Confirms a change and offers a one-click undo for it. */
export function notifyUndoable(message: string): void {
  notify(message, { tone: 'success', action: { label: 'Rückgängig', run: undoProject } });
}
function persist(project: Project): void {
  if (!storageReadable) return;
  try {
    saveProject(project);
    feedbackStore.setState((old) => ({
      ...old,
      saveError: '',
      savedAt: Date.now(),
    }));
  } catch {
    feedbackStore.setState((old) => ({
      ...old,
      saveError:
        'Lokal noch nicht gespeichert. Browserablage nicht verfügbar oder voll — bitte JSON herunterladen.',
    }));
  }
}
export function initializeProject(embedded?: unknown): void {
  clearHistory();
  try {
    const project = embedded === undefined ? readProject() : normalizeProject(embedded);
    if (project) projectStore.setState(() => project);
    if (embedded !== undefined) notify('Dateiprojekt geöffnet. Änderungen bleiben lokal.');
  } catch {
    storageReadable = false;
    feedbackStore.setState((old) => ({
      ...old,
      saveError:
        'Projekt konnte nicht gelesen werden. Die Originaldatei bzw. Browserablage bleibt erhalten. Automatisches Speichern ist gesperrt; sichere neue Arbeit als JSON.',
    }));
  }
}
/** All changes are atomic in memory. A failed save never discards the working copy. */
export function changeProject(mutator: (draft: Project) => void): void {
  const previous = projectStore.get();
  assertEditable(previous);
  const next = structuredClone(previous);
  mutator(next);
  // A focus/blur without an edit must neither consume a step nor discard redo.
  if (JSON.stringify(previous) === JSON.stringify(next)) return;
  historyStore.setState((history) => ({
    past: [...history.past, previous].slice(-HISTORY_LIMIT),
    future: [],
  }));
  projectStore.setState(() => next);
  persist(next);
}
/** One shared history covers edits on every page, not only board gestures. */
export function undoProject(): void {
  const current = projectStore.get();
  assertEditable(current);
  const history = historyStore.get();
  const previous = history.past.at(-1);
  if (!previous) return;
  historyStore.setState(() => ({
    past: history.past.slice(0, -1),
    future: [...history.future, current].slice(-HISTORY_LIMIT),
  }));
  projectStore.setState(() => structuredClone(previous));
  persist(projectStore.get());
}
export function redoProject(): void {
  const current = projectStore.get();
  assertEditable(current);
  const history = historyStore.get();
  const next = history.future.at(-1);
  if (!next) return;
  historyStore.setState(() => ({
    past: [...history.past, current].slice(-HISTORY_LIMIT),
    future: history.future.slice(0, -1),
  }));
  projectStore.setState(() => structuredClone(next));
  persist(projectStore.get());
}
export function replaceProject(project: Project): void {
  const next = normalizeProject(project);
  clearHistory();
  projectStore.setState(() => next);
  persist(next);
}
export function archiveCurrent(): void {
  const snapshot = archiveSnapshot(projectStore.get());
  saveArchive(snapshot); // Must succeed before changing the working copy.
  clearHistory();
  projectStore.setState(() => snapshot);
  persist(snapshot);
}
export function reopenCurrent(): void {
  const previous = projectStore.get();
  if (!previous.archive) return;
  saveArchive(previous);
  replaceProject(resumeProject(previous));
}
