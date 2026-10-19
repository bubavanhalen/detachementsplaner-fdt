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
/** Rapid edits are written once after this pause of inactivity … */
const SAVE_DELAY_MS = 400;
/** … but continuous editing still writes at least this often. */
const SAVE_MAX_WAIT_MS = 2000;
let pendingSave: Project | null = null;
let pendingSince = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Returns false only when the browser rejected the write; the working copy stays in memory. */
function writeProject(project: Project): boolean {
  if (!storageReadable) return true;
  try {
    saveProject(project);
    feedbackStore.setState((old) => ({
      ...old,
      saveError: '',
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    feedbackStore.setState((old) => ({
      ...old,
      saveError:
        'Lokal noch nicht gespeichert. Browserablage nicht verfügbar oder voll — bitte JSON herunterladen.',
    }));
    return false;
  }
}
function cancelPendingSave(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = undefined;
  pendingSave = null;
}
/** Coalesces rapid edits: serialising a large project on every keystroke made editing lag. */
function persistSoon(project: Project): void {
  if (!storageReadable) return;
  const now = Date.now();
  if (!pendingSave) pendingSince = now;
  pendingSave = project;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  const delay = Math.min(SAVE_DELAY_MS, Math.max(0, pendingSince + SAVE_MAX_WAIT_MS - now));
  saveTimer = setTimeout(flushProjectSave, delay);
}
/** Discrete actions (open, import, archive) are written at once and supersede pending edits. */
function persistNow(project: Project): void {
  cancelPendingSave();
  writeProject(project);
}
/** Writes pending edits immediately. Returns false when the browser rejected the write. */
export function flushProjectSave(): boolean {
  const project = pendingSave;
  cancelPendingSave();
  return project ? writeProject(project) : true;
}
if (typeof window !== 'undefined') {
  // Leaving or hiding the page must not lose the last pause-pending edits.
  window.addEventListener('pagehide', () => flushProjectSave());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushProjectSave();
  });
  window.addEventListener('beforeunload', (event) => {
    if (!flushProjectSave()) event.preventDefault();
  });
}
/**
 * Equality as JSON would serialise it (omitted undefined/function values, toJSON,
 * non-finite numbers as null), but without building strings and stopping at the
 * first difference. Key order is ignored: reordering alone carries no edit.
 */
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!isPlainJsonObject(left) || !isPlainJsonObject(right)) return sameJsonLeaf(left, right);
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) {
      const item = left[index];
      const other = right[index];
      if (item === other) continue;
      // JSON writes omitted array items as null.
      if (!sameJson(omittedInJson(item) ? null : item, omittedInJson(other) ? null : other))
        return false;
    }
    return true;
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  let keys = 0;
  for (const key in a) {
    if (!Object.hasOwn(a, key) || omittedInJson(a[key])) continue;
    keys++;
    if (a[key] === b[key]) continue;
    if (!Object.hasOwn(b, key) || omittedInJson(b[key]) || !sameJson(a[key], b[key])) return false;
  }
  for (const key in b) if (Object.hasOwn(b, key) && !omittedInJson(b[key])) keys--;
  return keys === 0;
}
function isPlainJsonObject(value: unknown): value is object {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toJSON?: unknown }).toJSON !== 'function'
  );
}
/** Primitives and toJSON objects; reached only after a cheap identity check failed. */
function sameJsonLeaf(left: unknown, right: unknown): boolean {
  const a = jsonValue(left);
  const b = jsonValue(right);
  if (a === b) return true;
  if (isPlainJsonObject(a) && isPlainJsonObject(b)) return sameJson(a, b);
  return false;
}
function jsonValue(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toJSON?: unknown }).toJSON === 'function'
  )
    return (value as { toJSON: () => unknown }).toJSON();
  return value;
}
function omittedInJson(value: unknown): boolean {
  return value === undefined || typeof value === 'function' || typeof value === 'symbol';
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
  if (sameJson(previous, next)) return;
  historyStore.setState((history) => ({
    past: [...history.past, previous].slice(-HISTORY_LIMIT),
    future: [],
  }));
  projectStore.setState(() => next);
  persistSoon(next);
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
  persistSoon(projectStore.get());
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
  persistSoon(projectStore.get());
}
export function replaceProject(project: Project): void {
  const next = normalizeProject(project);
  clearHistory();
  projectStore.setState(() => next);
  persistNow(next);
}
export function archiveCurrent(): void {
  const snapshot = archiveSnapshot(projectStore.get());
  saveArchive(snapshot); // Must succeed before changing the working copy.
  clearHistory();
  projectStore.setState(() => snapshot);
  persistNow(snapshot);
}
export function reopenCurrent(): void {
  const previous = projectStore.get();
  if (!previous.archive) return;
  saveArchive(previous);
  replaceProject(resumeProject(previous));
}
