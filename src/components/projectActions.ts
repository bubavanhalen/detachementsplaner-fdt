import { localError } from '../io/text';
import { readWorkbook } from '../io/workbook';
import { normalizeProject } from '../model';
import type { Source } from '../model/types';
import { notify } from '../store';
import { openOverlay } from '../ui';

export type LocalFileKind = Source | 'json';

/** Reads a file chosen on this device. Nothing is uploaded; the file stays local. */
export async function receiveLocalFile(file: File, kind: LocalFileKind): Promise<void> {
  try {
    if (kind === 'json') {
      let value: unknown;
      try {
        value = JSON.parse(await file.text());
      } catch {
        throw new Error('Die Datei enthält kein lesbares JSON-Projekt.');
      }
      openOverlay({ incoming: normalizeProject(value) });
    } else
      openOverlay({
        workbook: { value: await readWorkbook(file), source: kind, filename: file.name },
      });
  } catch (failure) {
    notify(localError(failure), { tone: 'warning' });
  }
}

export function pickLocalFile(kind: LocalFileKind): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = kind === 'json' ? '.json,application/json' : '.xlsx,.xls,.csv';
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0];
      if (file) void receiveLocalFile(file, kind);
    },
    { once: true },
  );
  input.click();
}

/** Guess the source for a dropped file; project files are recognised by extension. */
export function kindForFile(file: File, fallback: Source): LocalFileKind {
  return /\.json$/i.test(file.name) ? 'json' : fallback;
}
