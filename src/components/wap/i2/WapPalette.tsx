// Befehlspalette des WAP-Planers (H-UI2, UX-H-08, SA-H-11; UI-Richtlinie 1 Leitsatz 4, 11.6, 13.1): Ctrl+K öffnet
// sie in der Einzeldatei und in den eigenständigen Einstiegen; in der Suite liefert die Route dieselben Befehle an
// die Suite-Palette (Gruppe «WAP-Planer», `setRouteCommands`). Aufbau wie die Suite-Palette: Suchfeld (`combobox`),
// Treffer als `listbox` mit `option`, ↑/↓ wählen, Enter führt aus, Esc schliesst; der Fokus kehrt zum Auslöser zurück.
// Gesucht wird nur im Speicher dieses Geräts.

import { useEffect, useId, useMemo, useRef, useState } from 'react';

/** Ein Befehl der Route (Kopfleiste, Werkzeugleiste, Raster), auch für die Suite-Palette. */
export interface WapCommand {
  readonly id: string;
  readonly label: string;
  /** Kürzel, rechts angezeigt (z.B. «Ctrl+S»). */
  readonly hint?: string;
  readonly keywords?: string;
  readonly disabled?: boolean;
  readonly run: () => void;
}

/** Klein, ohne Akzente und Satzzeichen, für die Suche. */
function searchable(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}+]+/gu, ' ')
    .trim();
}

export function WapPalette({
  commands,
  onClose,
}: {
  readonly commands: readonly WapCommand[];
  readonly onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    node?.showModal();
    input.current?.focus();
    return () => {
      node?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  const results = useMemo(() => {
    const words = searchable(query).split(' ').filter(Boolean);
    return commands.filter((c) => {
      if (c.disabled === true) return false;
      const text = searchable(`${c.label} ${c.keywords ?? ''} ${c.hint ?? ''}`);
      return words.every((w) => text.includes(w));
    });
  }, [commands, query]);
  const run = (command: WapCommand | undefined) => {
    if (command === undefined) return;
    onClose();
    // Erst schliessen, dann ausführen: der Befehl kann einen Dialog öffnen.
    window.setTimeout(command.run, 0);
  };
  const current = results[Math.min(active, results.length - 1)];
  return (
    <dialog
      ref={dialog}
      className="wap-palette"
      aria-label="Befehle des WAP-Planers"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="wap-palette-input">
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={current === undefined ? undefined : `${listId}-${current.id}`}
          aria-label="Befehl suchen"
          placeholder="Befehl suchen, z.B. «sichern», «Stand», «Woche» …"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((i) => Math.min(results.length - 1, i + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              run(current);
            }
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <div className="wap-palette-list" id={listId} role="listbox" aria-label="Befehle">
        {results.map((c, index) => (
          <div
            key={c.id}
            id={`${listId}-${c.id}`}
            role="option"
            tabIndex={-1}
            aria-selected={c === current}
            className="wap-palette-item"
            onMouseMove={() => setActive(index)}
            onClick={() => run(c)}
            onKeyDown={() => {}}
          >
            <span>{c.label}</span>
            {c.hint !== undefined && <kbd>{c.hint}</kbd>}
          </div>
        ))}
        {results.length === 0 && (
          <p className="wap-palette-empty">
            Kein Befehl gefunden. Einen anderen Suchbegriff eingeben, z.B. «sichern».
          </p>
        )}
      </div>
      <p className="wap-palette-foot">↑ ↓ wählen · Enter ausführen · Suche nur auf diesem Gerät</p>
    </dialog>
  );
}
