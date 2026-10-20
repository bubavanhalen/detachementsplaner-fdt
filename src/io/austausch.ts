import agentGuide from '../../docs/pendenzen-agent.md?raw';
import { type Project, standDocument } from '../model';

/**
 * Local exchange folder for the owner's assistant agent (see AGENTS.md exception).
 * Only files in the folder the user picked are read or written; nothing leaves the device
 * through this application.
 */
export const STAND_FILE = 'wk-suite-stand.json';
export const GUIDE_FILE = 'AGENT.md';
export const INTAKE_DIR = 'eingang';
export const DONE_DIR = 'verarbeitet';
export const FAILED_DIR = 'fehler';

/** The part of the File System Access API used here (also implemented by test fakes). */
export interface LocalFile {
  kind: 'file';
  name: string;
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
export interface LocalDir {
  kind: 'directory';
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<LocalDir>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<LocalFile>;
  removeEntry(name: string): Promise<void>;
  values(): AsyncIterable<LocalFile | LocalDir>;
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
}
type PickerWindow = Window & {
  showDirectoryPicker?: (options: { id?: string; mode: 'readwrite' }) => Promise<LocalDir>;
};

export function folderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as PickerWindow).showDirectoryPicker === 'function'
  );
}
export async function pickFolder(): Promise<LocalDir> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('Dieser Browser kann keinen lokalen Ordner verbinden.');
  return picker({ id: 'wk-suite-austausch', mode: 'readwrite' });
}
export async function permission(dir: LocalDir, request = false): Promise<PermissionState> {
  const ask = request ? dir.requestPermission : dir.queryPermission;
  return ask ? ask.call(dir, { mode: 'readwrite' }) : 'granted';
}

async function writeText(dir: LocalDir, name: string, text: string): Promise<void> {
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(text);
  await writable.close();
}
export function standText(project: Project, now?: string): string {
  return `${JSON.stringify(standDocument(project, now), null, 2)}\n`;
}
/** Writes the reference for the agent, its instructions and the intake folders. */
export async function writeStand(dir: LocalDir, project: Project): Promise<void> {
  const intake = await dir.getDirectoryHandle(INTAKE_DIR, { create: true });
  await intake.getDirectoryHandle(DONE_DIR, { create: true });
  await writeText(dir, GUIDE_FILE, agentGuide);
  await writeText(dir, STAND_FILE, standText(project));
}
export async function readIntake(dir: LocalDir): Promise<{ datei: string; text: string }[]> {
  const intake = await dir.getDirectoryHandle(INTAKE_DIR, { create: true });
  const files: { datei: string; text: string }[] = [];
  for await (const entry of intake.values())
    if (entry.kind === 'file' && /\.json$/i.test(entry.name))
      files.push({ datei: entry.name, text: await (await entry.getFile()).text() });
  return files;
}
/** Moves a handled file out of the intake folder (copy, then remove). */
export async function moveIntakeFile(
  dir: LocalDir,
  file: { datei: string; text: string },
  target: typeof DONE_DIR | typeof FAILED_DIR,
  note?: string,
): Promise<void> {
  const intake = await dir.getDirectoryHandle(INTAKE_DIR, { create: true });
  const folder = await intake.getDirectoryHandle(target, { create: true });
  await writeText(folder, file.datei, file.text);
  if (note) await writeText(folder, `${file.datei}.fehler.txt`, `${note}\n`);
  await intake.removeEntry(file.datei);
}

// The folder handle is kept in this browser's IndexedDB so the connection survives a reload.
// It is a handle to a local folder, not data; the browser asks again before access.
const DB = 'wk-suite-austausch';
const STORE = 'handles';
const KEY = 'ordner';
function database(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  const db = await database();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
}
export async function loadFolder(): Promise<LocalDir | null> {
  return ((await transact('readonly', (store) => store.get(KEY))) as LocalDir | undefined) ?? null;
}
export async function storeFolder(dir: LocalDir | null): Promise<void> {
  await transact<unknown>(
    'readwrite',
    (store) => (dir ? store.put(dir, KEY) : store.delete(KEY)) as IDBRequest<unknown>,
  );
}
