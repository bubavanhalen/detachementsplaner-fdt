import { createStore, useSelector } from '@tanstack/react-store';
import type { XLSX } from './io/workbook';
import type { Participation, Project, Source } from './model/types';

/**
 * Interface preferences only (theme, collapsed areas). They never contain project
 * or personal data and stay in this browser's local storage.
 */
export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  sidebar: 'expanded' | 'collapsed';
  tray: boolean;
  minimap: boolean;
}
const PREFERENCES_KEY = 'detplaner.ui.v1';
const defaults: Preferences = { theme: 'system', sidebar: 'expanded', tray: true, minimap: false };

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}');
    return {
      theme: ['system', 'light', 'dark'].includes(stored.theme) ? stored.theme : defaults.theme,
      sidebar: stored.sidebar === 'collapsed' ? 'collapsed' : 'expanded',
      tray: typeof stored.tray === 'boolean' ? stored.tray : defaults.tray,
      minimap: typeof stored.minimap === 'boolean' ? stored.minimap : defaults.minimap,
    };
  } catch {
    return defaults;
  }
}
export const preferencesStore = createStore<Preferences>(readPreferences());
export function usePreferences(): Preferences {
  return useSelector(preferencesStore, (value) => value);
}
export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  preferencesStore.setState((old) => ({ ...old, [key]: value }));
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferencesStore.get()));
  } catch {
    /* Preferences are a convenience; unavailable storage must not interrupt work. */
  }
}

/** Transient, in-memory interface state shared between the shell and the pages. */
export interface Overlays {
  palette: boolean;
  shortcuts: boolean;
  service: boolean;
  incoming: Project | null;
  workbook: { value: XLSX.WorkBook; source: Source; filename: string } | null;
  /** A one-shot request for the planning page, e.g. from the command palette. */
  planningIntent: { kind: 'add' } | { kind: 'focus'; id: string } | null;
  /** A one-shot preset for the people page. Never placed in the URL. */
  peopleIntent: { personId?: string; filter?: Participation | 'issues' | 'review' } | null;
}
export const overlayStore = createStore<Overlays>({
  palette: false,
  shortcuts: false,
  service: false,
  incoming: null,
  workbook: null,
  planningIntent: null,
  peopleIntent: null,
});
export function useOverlays(): Overlays {
  return useSelector(overlayStore, (value) => value);
}
export function openOverlay(patch: Partial<Overlays>): void {
  overlayStore.setState((old) => ({ ...old, ...patch }));
}

/** True when a keyboard shortcut should defer to the focused text control. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return (
    target instanceof HTMLInputElement &&
    !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'].includes(
      target.type,
    )
  );
}

export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
export const modKey = isMac ? '⌘' : 'Ctrl';
