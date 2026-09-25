import { useNavigate } from '@tanstack/react-router';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { exportJson } from '../io/exports';
import { searchText } from '../io/text';
import { redoProject, undoProject, useProject } from '../store';
import { openOverlay, preferencesStore, setPreference } from '../ui';
import { Icon, type IconName } from './Icon';

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: IconName;
  keywords?: string;
  run: () => void;
}

/** Keyboard-first navigation and actions. Everything is searched in memory on this device. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const project = useProject();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const archived = Boolean(project.archive);
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
  const commands = useMemo<Command[]>(() => {
    const go = (to: '/' | '/sources' | '/pisa' | '/finish' | '/persons' | '/contacts') => () =>
      void navigate({ to });
    const list: Command[] = [
      {
        id: 'n1',
        group: 'Ablauf',
        label: 'Personen laden',
        icon: 'upload',
        run: go('/sources'),
        hint: 'Alt 1',
      },
      { id: 'n2', group: 'Ablauf', label: 'Planen', icon: 'board', run: go('/'), hint: 'Alt 2' },
      {
        id: 'n3',
        group: 'Ablauf',
        label: 'In PISA übertragen',
        icon: 'send',
        run: go('/pisa'),
        hint: 'Alt 3',
      },
      {
        id: 'n4',
        group: 'Ablauf',
        label: 'Sichern & archivieren',
        icon: 'archive',
        run: go('/finish'),
        hint: 'Alt 4',
      },
      {
        id: 'n5',
        group: 'Ablauf',
        label: 'Personen nachschlagen',
        icon: 'users',
        run: go('/persons'),
        hint: 'Alt 5',
      },
      {
        id: 'n6',
        group: 'Ablauf',
        label: 'Kontakte exportieren',
        icon: 'contact',
        run: go('/contacts'),
        hint: 'Alt 6',
      },
    ];
    if (!archived)
      list.push(
        {
          id: 'add',
          group: 'Aktionen',
          label: 'Neues Detachement',
          icon: 'plus',
          hint: 'N',
          keywords: 'gruppe karte erstellen',
          run: () => {
            openOverlay({ planningIntent: { kind: 'add' } });
            void navigate({ to: '/' });
          },
        },
        {
          id: 'service',
          group: 'Aktionen',
          label: 'Dienstleistung bearbeiten',
          icon: 'edit',
          keywords: 'name einheit datum projekt',
          run: () => openOverlay({ service: true }),
        },
        { id: 'undo', group: 'Aktionen', label: 'Rückgängig', icon: 'undo', run: undoProject },
        { id: 'redo', group: 'Aktionen', label: 'Wiederholen', icon: 'redo', run: redoProject },
      );
    list.push(
      {
        id: 'json',
        group: 'Aktionen',
        label: 'Projekt als JSON sichern',
        icon: 'download',
        hint: 'Ctrl S',
        keywords: 'speichern backup export',
        run: () => exportJson(project),
      },
      {
        id: 'theme',
        group: 'Ansicht',
        label: 'Hell / Dunkel umschalten',
        icon: 'moon',
        keywords: 'theme darstellung farbe',
        run: () => {
          const current = preferencesStore.get().theme;
          const dark =
            current === 'dark' ||
            (current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          setPreference('theme', dark ? 'light' : 'dark');
        },
      },
      {
        id: 'sidebar',
        group: 'Ansicht',
        label: 'Seitenleiste ein-/ausklappen',
        icon: 'sidebar',
        hint: 'Ctrl B',
        run: () =>
          setPreference(
            'sidebar',
            preferencesStore.get().sidebar === 'collapsed' ? 'expanded' : 'collapsed',
          ),
      },
      {
        id: 'keys',
        group: 'Ansicht',
        label: 'Tastenkürzel anzeigen',
        icon: 'keyboard',
        hint: '?',
        run: () => openOverlay({ shortcuts: true }),
      },
    );
    for (const group of project.dets)
      list.push({
        id: `det-${group.id}`,
        group: 'Detachemente',
        label: group.name,
        hint: group.ec || undefined,
        icon: 'board',
        keywords: `${group.ec} ${group.ort}`,
        run: () => {
          openOverlay({ planningIntent: { kind: 'focus', id: group.id } });
          void navigate({ to: '/' });
        },
      });
    for (const person of project.persons)
      list.push({
        id: `person-${person.id}`,
        group: 'Personen',
        label: [person.grad, person.name].filter(Boolean).join(' '),
        hint: person.funktion || undefined,
        icon: 'user',
        keywords: `${person.pnr ?? ''} ${person.funktion} ${person.zug ?? ''}`,
        run: () => {
          openOverlay({ peopleIntent: { personId: person.id } });
          void navigate({ to: '/persons' });
        },
      });
    return list;
  }, [project, archived, navigate]);
  const results = useMemo(() => {
    const words = searchText(query).split(' ').filter(Boolean);
    const matches = commands.filter((command) => {
      const text = searchText(`${command.label} ${command.keywords ?? ''} ${command.hint ?? ''}`);
      return words.every((word) => text.includes(word));
    });
    // Without a query, keep the list short: navigation, actions and view commands only.
    return words.length
      ? matches.slice(0, 40)
      : matches.filter((command) => !['Personen', 'Detachemente'].includes(command.group));
  }, [commands, query]);
  const run = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    // Let the dialog close before a command opens another one.
    window.setTimeout(command.run, 0);
  };
  let lastGroup = '';
  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Befehle und Suche"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="palette-input">
        <Icon name="search" />
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
          aria-label="Befehl, Person oder Detachement suchen"
          placeholder="Wohin oder was? Person, Detachement, Aktion …"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(results.length - 1, index + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(0, index - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              run(results[active]);
            }
          }}
        />
        <span className="kbd">Esc</span>
      </div>
      <div className="palette-list" id={listId} role="listbox" aria-label="Treffer">
        {results.map((command, index) => {
          const header = command.group !== lastGroup;
          lastGroup = command.group;
          return (
            <div key={command.id}>
              {header && <div className="palette-group">{command.group}</div>}
              <div
                id={`${listId}-${command.id}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === active}
                className="palette-item"
                onMouseMove={() => setActive(index)}
                onClick={() => run(command)}
                onKeyDown={() => {}}
              >
                <Icon name={command.icon} size={16} />
                <span className="truncate">{command.label}</span>
                {command.hint && <small>{command.hint}</small>}
              </div>
            </div>
          );
        })}
        {!results.length && <div className="palette-empty">Nichts gefunden.</div>}
      </div>
      <div className="palette-foot">
        <span>
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> auswählen
        </span>
        <span>
          <span className="kbd">↵</span> öffnen
        </span>
        <span>Suche nur lokal auf diesem Gerät</span>
      </div>
    </dialog>
  );
}
