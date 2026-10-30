// Interne Zwischenablage des Rasters (I2b-B B3; Beschrieb 5.1 «Kopieren, Einfügen und Duplizieren, auch zwischen
// Wochen»). Nur in diesem Tab und im Speicher der Seite: Planinhalte gehen nie in die Zwischenablage des
// Betriebssystems (AGENTS.md: Daten bleiben lokal). Ausschneiden markiert nur; erst Einfügen verschiebt (wie Excel).

import type { Id } from '../../../model/wap/types';

export interface ClipboardContent {
  readonly planId: Id;
  readonly ids: readonly Id[];
  /** true nach Ctrl+X: Einfügen verschiebt die Einträge, danach ist die Ablage leer. */
  readonly cut: boolean;
}

type Listener = () => void;

class GridClipboard {
  private content: ClipboardContent | null = null;
  private listeners = new Set<Listener>();
  get(): ClipboardContent | null {
    return this.content;
  }
  set(content: ClipboardContent | null): void {
    this.content = content;
    for (const l of this.listeners) l();
  }
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const clipboard = new GridClipboard();
