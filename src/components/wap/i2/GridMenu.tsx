// Kontextmenü des Rasters (UI-Richtlinie 5.10): Rechtsklick, Menütaste oder Shift+F10. Pfeile wählen, Enter führt
// aus, Buchstaben (Kürzel rechts) führen direkt aus, Esc schliesst; der Fokus kehrt zum Auslöser zurück.

import { type KeyboardEvent, useEffect, useRef } from 'react';

export interface MenuItem {
  readonly label: string;
  /** Kürzel, rechts angezeigt; ein Buchstabe führt im offenen Menü direkt aus. */
  readonly key?: string;
  readonly disabled?: boolean;
  readonly separatorBefore?: boolean;
  /** Umschalter (Rolle menuitemcheckbox), z.B. «Status rot darstellen». */
  readonly checked?: boolean;
  readonly run: () => void;
}

export function GridMenu({
  label,
  items,
  x,
  y,
  onClose,
}: {
  label: string;
  items: readonly MenuItem[];
  x: number;
  y: number;
  onClose: (refocus: boolean) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const first = refs.current.find((b, i) => b !== null && items[i]?.disabled !== true);
    first?.focus();
  }, [items]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.wap-menu') !== null) return;
      onClose(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [onClose]);
  const run = (item: MenuItem) => {
    if (item.disabled === true) return;
    onClose(false);
    item.run();
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = refs.current.indexOf(document.activeElement as HTMLButtonElement);
    const enabled = items.map((it, i) => (it.disabled === true ? -1 : i)).filter((i) => i >= 0);
    event.stopPropagation();
    if (event.key === 'Escape' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const pos = enabled.indexOf(current);
      const next =
        event.key === 'ArrowDown'
          ? enabled[(pos + 1) % enabled.length]
          : enabled[(pos - 1 + enabled.length) % enabled.length];
      if (next !== undefined) refs.current[next]?.focus();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1];
      if (next !== undefined) refs.current[next]?.focus();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const item = items.find(
        (it) =>
          it.key !== undefined &&
          it.key.length === 1 &&
          it.key.toLowerCase() === event.key.toLowerCase(),
      );
      if (item !== undefined) {
        event.preventDefault();
        run(item);
      }
    }
  };
  const left = Math.max(4, Math.min(x, window.innerWidth - 260));
  const top = Math.max(4, Math.min(y, window.innerHeight - 30 - items.length * 30));
  return (
    <div role="menu" aria-label={label} className="wap-menu" style={{ left, top }} onKeyDown={key}>
      {items.map((item, i) => (
        <div key={item.label} role="none">
          {item.separatorBefore === true && <hr />}
          <button
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            {...(item.checked === undefined ? {} : { 'aria-checked': item.checked })}
            tabIndex={-1}
            aria-disabled={item.disabled === true}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onClick={() => run(item)}
          >
            <span>
              {item.checked === undefined ? null : (
                <span aria-hidden="true" className="wap-menu-check">
                  {item.checked ? '✓' : ''}
                </span>
              )}
              {item.label}
            </span>
            {item.key !== undefined && <kbd>{item.key}</kbd>}
          </button>
        </div>
      ))}
    </div>
  );
}
