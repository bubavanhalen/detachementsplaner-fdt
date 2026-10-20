import { createStore, useSelector } from '@tanstack/react-store';
import {
  DONE_DIR,
  FAILED_DIR,
  folderSupported,
  type LocalDir,
  loadFolder,
  moveIntakeFile,
  permission,
  pickFolder,
  readIntake,
  STAND_FILE,
  standText,
  storeFolder,
  writeStand,
} from '../../io/austausch';
import { download } from '../../io/exports';
import { localError } from '../../io/text';
import { applyIntakeFiles, type IntakeFileOutcome } from '../../model';
import { changeProject, notify, notifyUndoable, projectStore } from '../../store';

export interface ExchangeState {
  supported: boolean;
  folder: string;
  access: PermissionState | 'none';
  /** Epoch milliseconds; 0 = not yet. */
  writtenAt: number;
  checkedAt: number;
  waiting: number;
  error: string;
}
export const exchangeStore = createStore<ExchangeState>({
  supported: folderSupported(),
  folder: '',
  access: 'none',
  writtenAt: 0,
  checkedAt: 0,
  waiting: 0,
  error: '',
});
export function useExchange(): ExchangeState {
  return useSelector(exchangeStore, (value) => value);
}
const set = (patch: Partial<ExchangeState>) =>
  exchangeStore.setState((old) => ({ ...old, ...patch }));

let handle: LocalDir | null = null;
let started = false;
let writeTimer: number | undefined;
let busy = false;

const ready = () => handle !== null && exchangeStore.get().access === 'granted';

async function write(): Promise<void> {
  if (!handle || !ready()) return;
  try {
    await writeStand(handle, projectStore.get());
    set({ writtenAt: Date.now(), error: '' });
  } catch {
    set({ error: 'Stand konnte nicht in den Austauschordner geschrieben werden.' });
  }
}
function scheduleWrite(): void {
  window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => void write(), 600);
}

/** Summarises outcomes for the toast; never includes file contents. */
export function outcomeMessage(outcomes: IntakeFileOutcome[]): string {
  let created = 0,
    changed = 0,
    skipped = 0;
  for (const outcome of outcomes)
    if (outcome.status === 'angewendet') {
      created += outcome.result.neu;
      changed += outcome.result.geaendert;
      skipped += outcome.result.uebersprungen.length;
    }
  const invalid = outcomes.filter((outcome) => outcome.status === 'ungueltig').length;
  const other = outcomes.filter((outcome) => outcome.status === 'andereDienstleistung').length;
  const parts = [
    created && `${created} neu`,
    changed && `${changed} aktualisiert`,
    skipped && `${skipped} übersprungen`,
    invalid && `${invalid} ${invalid === 1 ? 'Datei ungültig' : 'Dateien ungültig'}`,
    other && `${other} für eine andere Dienstleistung`,
  ].filter(Boolean);
  return parts.length ? `Agent: ${parts.join(' · ')}.` : '';
}

/** Applies all intake files in one undoable step. */
function apply(files: { datei: string; text: string }[]): IntakeFileOutcome[] {
  let outcomes: IntakeFileOutcome[] = [];
  changeProject((draft) => {
    outcomes = applyIntakeFiles(draft, files);
  });
  const message = outcomeMessage(outcomes);
  const applied = outcomes.some(
    (outcome) =>
      outcome.status === 'angewendet' && outcome.result.neu + outcome.result.geaendert > 0,
  );
  if (applied) notifyUndoable(message);
  else if (message) notify(message, { tone: 'warning' });
  return outcomes;
}

export async function checkIntake(options: { quiet?: boolean } = {}): Promise<void> {
  if (!handle || !ready() || busy) return;
  if (projectStore.get().archive) {
    if (!options.quiet) notify('Archivstand: Agent-Änderungen werden nicht übernommen.');
    return;
  }
  busy = true;
  try {
    const files = await readIntake(handle);
    if (!files.length) {
      set({ checkedAt: Date.now(), waiting: 0, error: '' });
      if (!options.quiet) notify('Keine neuen Agent-Dateien im Eingang.');
      return;
    }
    const outcomes = apply(files);
    let waiting = 0;
    for (const outcome of outcomes) {
      const file = files.find((item) => item.datei === outcome.datei);
      if (!file) continue;
      if (outcome.status === 'andereDienstleistung') waiting++;
      else if (outcome.status === 'ungueltig')
        await moveIntakeFile(handle, file, FAILED_DIR, outcome.fehler);
      else await moveIntakeFile(handle, file, DONE_DIR);
    }
    set({ checkedAt: Date.now(), waiting, error: '' });
  } catch (failure) {
    set({ error: 'Eingang konnte nicht vollständig verarbeitet werden.' });
    if (!options.quiet) notify(localError(failure), { tone: 'warning' });
  } finally {
    busy = false;
  }
}

async function adopt(dir: LocalDir, access: PermissionState): Promise<void> {
  handle = dir;
  set({ folder: dir.name, access, error: '' });
  if (access === 'granted') {
    await write();
    await checkIntake({ quiet: true });
  }
}
/** Lets the user pick the exchange folder (needs a click). */
export async function connectFolder(): Promise<void> {
  try {
    const dir = await pickFolder();
    await storeFolder(dir);
    await adopt(dir, await permission(dir, true));
    notify(`Austauschordner «${dir.name}» verbunden.`, { tone: 'success' });
  } catch (failure) {
    if (failure instanceof DOMException && failure.name === 'AbortError') return;
    notify(localError(failure), { tone: 'warning' });
  }
}
/** After a reload the browser asks again before the folder can be used (needs a click). */
export async function reauthorize(): Promise<void> {
  if (!handle) return;
  try {
    await adopt(handle, await permission(handle, true));
  } catch (failure) {
    notify(localError(failure), { tone: 'warning' });
  }
}
export async function disconnectFolder(): Promise<void> {
  handle = null;
  await storeFolder(null);
  set({ folder: '', access: 'none', writtenAt: 0, checkedAt: 0, waiting: 0, error: '' });
  notify('Austauschordner getrennt. Die Dateien darin bleiben unverändert.');
}

/** Fallback without folder access: download the reference for the agent. */
export function downloadStand(): void {
  download(STAND_FILE, standText(projectStore.get()), 'application/json');
  notify('Stand für den Agent lokal heruntergeladen.', { tone: 'success' });
}
/** Fallback without folder access: read one agent file chosen on this device. */
export function pickIntakeFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0];
      if (!file) return;
      void file
        .text()
        .then((text) => {
          const [outcome] = apply([{ datei: file.name, text }]);
          if (outcome?.status === 'ungueltig') notify(outcome.fehler, { tone: 'warning' });
          else if (outcome?.status === 'bekannt')
            notify('Diese Agent-Datei wurde bereits übernommen.');
        })
        .catch((failure: unknown) => notify(localError(failure), { tone: 'warning' }));
    },
    { once: true },
  );
  input.click();
}

/** Restores a folder connected earlier and keeps the reference and intake current. */
export function startExchange(): void {
  if (started || !exchangeStore.get().supported) return;
  started = true;
  void loadFolder()
    .then(async (dir) => {
      if (dir) await adopt(dir, await permission(dir));
    })
    .catch(() => set({ error: 'Gespeicherter Austauschordner nicht lesbar.' }));
  projectStore.subscribe(() => {
    if (ready()) scheduleWrite();
  });
  window.addEventListener('focus', () => void checkIntake({ quiet: true }));
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkIntake({ quiet: true });
  }, 60_000);
}
