// Schutz modaler Dialoge vor dem Schliessen durch den Browser (H-UI2, SA-H-06, SA-H-19; R-5.6-18, R-L-07,
// UI-Richtlinie 10 und 11.2): Chromium schliesst einen `<dialog>` auf Esc auch dann, wenn `cancel` abgewiesen wird –
// ohne Nutzeraktivierung ist `cancel` nicht abweisbar, und ein zweites Esc kurz danach schliesst ohne `cancel`.
// Sperrdialoge («Sicherung vor dem Update», Fortschritt beim Speichern, Import) dürfen nie so schliessen. Der Schutz
// fängt Esc auf Dokumentebene ab (vor dem Browser), weist `cancel` ab und öffnet einen trotzdem geschlossenen
// Sperrdialog sofort wieder. Ein gewöhnlicher Dialog, den der Browser schliesst, meldet das an die Anwendung
// (`onNativeClose`), damit ihr Zustand stimmt.

import { type RefObject, useEffect, useRef } from 'react';

export interface DialogGuard {
  /** Gesperrt: Esc und Browser schliessen nie. */
  readonly locked: boolean;
  /** Esc bei gesperrtem Dialog (z.B. «Abbrechen» vor dem Schreiben); ohne: Esc wirkt nicht. */
  readonly onEscape?: () => void;
  /** Der Browser hat einen nicht gesperrten Dialog geschlossen (ohne Zutun der Anwendung). */
  readonly onNativeClose?: () => void;
}

/**
 * Hängt den Schutz an `dialog`. `closing` setzt die Anwendung, bevor sie den Dialog selbst schliesst (Aufräumen beim
 * Aushängen), damit das folgende `close` nicht als Schliessen durch den Browser gilt.
 */
export function useDialogGuard(
  dialog: RefObject<HTMLDialogElement | null>,
  guard: DialogGuard,
): { readonly closing: { current: boolean } } {
  const current = useRef(guard);
  current.current = guard;
  const closing = useRef(false);
  useEffect(() => {
    const node = dialog.current;
    if (node === null) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !node.open || !current.current.locked) return;
      // Nur der oberste offene Dialog reagiert (z.B. ein Menü im Dialog schliesst zuerst selbst).
      const open = [...document.querySelectorAll('dialog[open]')];
      if (open[open.length - 1] !== node) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      current.current.onEscape?.();
    };
    const cancel = (event: Event) => {
      if (current.current.locked) event.preventDefault();
    };
    const close = () => {
      if (closing.current || !node.isConnected) return;
      if (current.current.locked) node.showModal();
      else current.current.onNativeClose?.();
    };
    document.addEventListener('keydown', key, true);
    node.addEventListener('cancel', cancel);
    node.addEventListener('close', close);
    return () => {
      document.removeEventListener('keydown', key, true);
      node.removeEventListener('cancel', cancel);
      node.removeEventListener('close', close);
    };
  }, [dialog]);
  return { closing };
}
