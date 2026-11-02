// Listenansicht (Paket E1-15, I4; Beschrieb 6 «Listenansicht»; Vertrag E1-15 §1, §2; R-6-13 bis R-6-15,
// R-6-42, R-4-01). Alle Einträge als Tabelle aus dem einen Datenmodell, sortier- und filterbar, direkt
// editierbar wie in Excel; jede Zelländerung ist ein Befehl (Undo) und das Raster folgt ohne weitere Aktion.

import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { formatDate, weekdayOf } from '../../../model/wap/calendar';
import type { CommandContext, CommandResult } from '../../../model/wap/commands/command';
import { deleteEntries } from '../../../model/wap/commands/entries';
import { WapError } from '../../../model/wap/errors';
import { type ListRow, listCsv, listRows } from '../../../model/wap/list/index';
import { fileNamePrefix } from '../../../model/wap/stand/fileName';
import type { Id, Plan } from '../../../model/wap/types';
import { commitCell, isEditable, type ListColumnKey, spaltenChoices } from './commit';
import './list.css';

type RunCommand = (plan: Plan, ctx: CommandContext) => CommandResult;

interface ColumnDef {
  readonly key: ListColumnKey;
  readonly label: string;
  readonly optional?: boolean;
}

const COLUMNS: readonly ColumnDef[] = [
  { key: 'tag', label: 'Tag' },
  { key: 'zeit', label: 'Zeit' },
  { key: 'typ', label: 'Typ' },
  { key: 'titel', label: 'Titel' },
  { key: 'spalten', label: 'Spalten' },
  { key: 'ltg', label: 'Ltg' },
  { key: 'ort', label: 'Ort' },
  { key: 'nr', label: 'Nr' },
  { key: 'kategorie', label: 'Kategorie' },
  { key: 'status', label: 'Status' },
  { key: 'teilaufgaben', label: 'Teilaufgaben', optional: true },
];

const TYPE_LABEL: Readonly<Record<ListRow['typ'], string>> = {
  Block: 'Block',
  Querbalken: 'Querbalken',
  Marker: 'Marker',
  Rapport: 'Rapport',
  Beso: 'Beso',
  TagBemerkung: 'Ganztägige Bemerkung',
  MehrtagBemerkung: 'Bemerkung',
};

/**
 * Auswahlzellen (Liste mit Tippsuche, UI-Richtlinie 7): Kategorie und Status. Spalten ist ein Textfeld mit Vorschlägen
 * (mehrere Spalten wie «Rap, Kp Kdt»; UX-AB-G-01).
 */
function isChoice(key: ListColumnKey): boolean {
  return key === 'kategorie' || key === 'status';
}

/** Wählbare Status; «geändert» ist eine Markierung bis zum nächsten Stand, nicht wählbar (UX-AB-05). */
const STATUS_VALUES = ['bestätigt', 'offen', 'gestrichen'] as const;

function zeitText(row: ListRow): string {
  switch (row.zeitform) {
    case 'von-bis':
      return `${row.von}-${row.bis}`;
    case 'ab':
      return `ab ${row.von}`;
    case 'bis':
      return `bis ${row.bis}`;
    case 'Zeitpunkt':
      return row.von;
    case 'Frist':
      return `bis ${row.bis}`;
    case 'Datum':
      return `${row.von}–${row.bis}`;
    case 'ganztags':
      return 'ganztags';
    default:
      return '';
  }
}

function dayText(row: ListRow, plan: Plan): string {
  if (row.tag === '') return '';
  const week = plan.weeks.find((w) => w.id === row.weekId);
  if (week === undefined) return row.tag;
  const i = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].indexOf(row.tag);
  const d = new Date(`${week.startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  const iso = d.toISOString().slice(0, 10);
  return `${weekdayOf(iso)} ${formatDate(iso, 'long').slice(0, 6)}`;
}

function subtasksText(row: ListRow, plan: Plan): string {
  const e = plan.entries[row.entryId];
  if (e?.type !== 'block' || e.subtasks === undefined) return '';
  return e.subtasks
    .map((s) => {
      const title = s.title.map((r) => r.text).join('');
      const extra = [s.ltg, s.ort === '' ? '' : `(${s.ort})`].filter((x) => x !== '').join(' ');
      return extra === '' ? title : `${title} – ${extra}`;
    })
    .join('; ');
}

function cellText(row: ListRow, key: ListColumnKey, plan: Plan): string {
  switch (key) {
    case 'tag':
      return dayText(row, plan);
    case 'zeit':
      return zeitText(row);
    case 'typ':
      return TYPE_LABEL[row.typ];
    case 'titel':
      return row.titel;
    case 'spalten':
      return row.spalten.replaceAll('|', ', ');
    case 'ltg':
      return row.ltg;
    case 'ort':
      return row.ort;
    case 'nr':
      return row.nr;
    case 'kategorie':
      return row.kategorie;
    case 'status':
      return row.status;
    case 'teilaufgaben':
      return subtasksText(row, plan);
  }
}

/** Wert für das Eingabefeld beim Bearbeiten (Kategorie: ID). */
function editValue(row: ListRow, key: ListColumnKey, plan: Plan): string {
  if (key === 'spalten') return row.spalten.replaceAll('|', ', ');
  if (key === 'kategorie') {
    const e = plan.entries[row.entryId];
    return e !== undefined && 'categoryId' in e ? (e.categoryId ?? '') : '';
  }
  // Markierung «geändert» ist kein Status: bearbeitet wird der Status darunter (bestätigt).
  if (key === 'status') {
    const text = cellText(row, key, plan);
    return text === 'geändert' ? 'bestätigt' : text;
  }
  return cellText(row, key, plan);
}

function localIsoDate(at: Date): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}

export function listFileName(plan: Plan, at: Date): string {
  const prefix = fileNamePrefix(plan) || 'WAP';
  return `${prefix}_Liste_${localIsoDate(at)}.csv`;
}

interface Cursor {
  readonly row: number;
  readonly col: number;
}
interface Editing extends Cursor {
  readonly value: string;
}

export interface ListViewProps {
  readonly plan: Plan;
  readonly weekId: Id;
  readonly readOnly: boolean;
  readonly onCommand: (run: RunCommand) => Promise<void>;
  readonly onShowInGrid: (weekId: Id, entryId: Id) => void;
  /** Zeile gewählt: das Raster wählt den Eintrag mit (ohne Fokuswechsel; UI-Richtlinie 7, UX-AB-02). */
  readonly onSelectEntry?: (weekId: Id, entryId: Id) => void;
  /** Eintrag aus der Liste gelöscht: Meldung mit «Rückgängig» (UX-AB-02). */
  readonly onDeleted?: (text: string) => void;
  readonly onExport: (csv: string, fileName: string) => void;
}

export function ListView({
  plan,
  weekId,
  readOnly,
  onCommand,
  onShowInGrid,
  onSelectEntry,
  onDeleted,
  onExport,
}: ListViewProps) {
  const [scope, setScope] = useState<'week' | 'plan'>('week');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ key: ListColumnKey; dir: 'ascending' | 'descending' } | null>(
    null,
  );
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [columnMenu, setColumnMenu] = useState(false);
  const [cursor, setCursor] = useState<Cursor>({ row: 0, col: 3 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<{ cause: string; nextStep: string } | null>(null);
  const grid = useRef<HTMLTableElement>(null);
  const filterInput = useRef<HTMLInputElement>(null);
  const columnMenuButton = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const focusAfter = useRef(false);
  const ids = useId();
  const week = plan.weeks.find((w) => w.id === weekId);
  const columns = COLUMNS.filter((c) => !c.optional || showSubtasks);

  const allRows = useMemo(
    () => listRows(plan, scope === 'plan' ? 'plan' : { weekId }),
    [plan, scope, weekId],
  );
  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered =
      needle === ''
        ? [...allRows]
        : allRows.filter((r) =>
            COLUMNS.some((c) => cellText(r, c.key, plan).toLowerCase().includes(needle)),
          );
    if (sort === null) return filtered;
    const order = new Map(allRows.map((r, i) => [r, i]));
    const factor = sort.dir === 'ascending' ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sort.key === 'tag' || sort.key === 'zeit')
        return factor * ((order.get(a) ?? 0) - (order.get(b) ?? 0));
      const x = cellText(a, sort.key, plan);
      const y = cellText(b, sort.key, plan);
      return (
        factor * x.localeCompare(y, 'de-CH', { numeric: true }) ||
        (order.get(a) ?? 0) - (order.get(b) ?? 0)
      );
    });
  }, [allRows, filter, sort, plan]);

  const rowCount = rows.length;
  const safe = {
    row: Math.min(cursor.row, Math.max(0, rowCount - 1)),
    col: Math.min(cursor.col, columns.length - 1),
  };

  useEffect(() => {
    if (!focusAfter.current) return;
    focusAfter.current = false;
    const cell = grid.current?.querySelector<HTMLElement>(`[data-cell="${safe.row}:${safe.col}"]`);
    cell?.focus();
  });
  // Fokus ins Eingabefeld nur beim Beginn einer Bearbeitung: F2/Enter markiert den Wert, Tippen setzt den
  // Cursor hinter das erste Zeichen.
  const editKey = editing === null ? null : `${editing.row}:${editing.col}`;
  const typedStart = useRef(false);
  // Synchron nach dem Übernehmen (UX-AB-G-16): der Fokus steht im Eingabefeld, bevor die nächste Taste ankommt.
  useLayoutEffect(() => {
    if (editKey === null) return;
    const node = editor.current;
    node?.focus();
    if (node instanceof HTMLInputElement) {
      if (typedStart.current) node.setSelectionRange(node.value.length, node.value.length);
      else node.select();
    }
  }, [editKey]);

  /** Zellzeiger zum Zeitpunkt der Antwort eines Befehls (ein späterer Klick behält Vorrang). */
  const cursorNow = useRef(cursor);
  cursorNow.current = cursor;
  const stillAt = (at: Cursor) =>
    cursorNow.current.row === at.row && cursorNow.current.col === at.col;
  /** Die Auswahl wandert mit: Zeilenwechsel wählt den Eintrag auch im Raster (UI-Richtlinie 7; UX-AB-02). */
  const selectRow = (row: number) => {
    const r = rows[row];
    if (r !== undefined && rows[safe.row]?.entryId !== r.entryId)
      onSelectEntry?.(r.weekId, r.entryId);
  };
  const move = (row: number, col: number) => {
    focusAfter.current = true;
    const next = Math.max(0, Math.min(rowCount - 1, row));
    selectRow(next);
    setCursor({
      row: next,
      col: Math.max(0, Math.min(columns.length - 1, col)),
    });
  };

  /** Eintrag der Zeile löschen (Ctrl+Entf; Entf in Typ/Tag): ein Befehl, Meldung mit «Rückgängig» (UX-AB-02). */
  const removeRow = async (at: Cursor): Promise<void> => {
    const row = rows[at.row];
    if (readOnly || row === undefined) return;
    const text = cellText(row, 'titel', plan);
    try {
      await onCommand((p, ctx) => deleteEntries(p, [row.entryId], ctx));
    } catch (e) {
      setError(
        e instanceof WapError
          ? e.userMessage
          : { cause: 'Der Eintrag konnte nicht gelöscht werden.', nextStep: 'Erneut versuchen.' },
      );
      return;
    }
    setError(null);
    onDeleted?.(text === '' ? `${cellText(row, 'typ', plan)} gelöscht` : `«${text}» gelöscht`);
    if (stillAt(at)) move(at.row, at.col);
  };

  /** Entf/Rücktaste leeren die Zelle (Bearbeiten wie Excel; UX-AB-03). */
  const clearCell = async (at: Cursor): Promise<void> => {
    const row = rows[at.row];
    const column = columns[at.col];
    if (readOnly || row === undefined || column === undefined) return;
    if (!isEditable(row, column.key, plan) || isChoice(column.key)) {
      setError({
        cause: `Die Zelle «${column.label}» lässt sich nicht leeren.`,
        nextStep: isChoice(column.key)
          ? 'Mit F2 einen anderen Wert wählen.'
          : 'Ctrl+Entf löscht den Eintrag.',
      });
      return;
    }
    if (editValue(row, column.key, plan) === '') return;
    try {
      await onCommand(commitCell(plan, row, column.key, ''));
    } catch (e) {
      setError(
        e instanceof WapError
          ? e.userMessage
          : { cause: 'Die Zelle konnte nicht geleert werden.', nextStep: 'Mit F2 bearbeiten.' },
      );
      return;
    }
    setError(null);
    if (stillAt(at)) move(at.row, at.col);
  };

  const startEdit = (at: Cursor, initial?: string) => {
    const row = rows[at.row];
    const column = columns[at.col];
    if (readOnly || row === undefined || column === undefined || !isEditable(row, column.key, plan))
      return;
    setError(null);
    typedStart.current = initial !== undefined;
    setEditing({ ...at, value: initial ?? editValue(row, column.key, plan) });
  };

  /**
   * Tippen auf der Zelle beginnt die Bearbeitung synchron (UX-AB-G-16): Editor gezeichnet und fokussiert, bevor die
   * nächste Taste ankommt; Schreibmarke hinter dem getippten Text.
   */
  const startTyping = (at: Cursor, text: string): void => {
    flushSync(() => startEdit(at, text));
    const node = editor.current;
    if (node instanceof HTMLInputElement) {
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }
  };

  const commit = async (then: 'down' | 'up' | 'right' | 'stay'): Promise<void> => {
    if (editing === null) return;
    const row = rows[editing.row];
    const column = columns[editing.col];
    if (row === undefined || column === undefined) {
      setEditing(null);
      return;
    }
    const original = editValue(row, column.key, plan);
    const at = { row: editing.row, col: editing.col };
    if (editing.value !== original) {
      try {
        const run = commitCell(plan, row, column.key, editing.value);
        await onCommand(run);
      } catch (e) {
        setError(
          e instanceof WapError
            ? e.userMessage
            : {
                cause: 'Die Änderung konnte nicht übernommen werden.',
                nextStep: 'Den Wert prüfen und erneut eingeben.',
              },
        );
        // Der Editor bleibt mit der Meldung offen und behält den Fokus (auch nach einem Klick auf eine andere Zelle):
        // weitere Tasten gehen nicht still verloren (UX-AB-G-16); Esc verwirft.
        window.requestAnimationFrame(() => editor.current?.focus());
        return;
      }
    }
    setEditing(null);
    setError(null);
    if (then === 'down') move(at.row + 1, at.col);
    else if (then === 'up') move(at.row - 1, at.col);
    else if (then === 'right') move(at.row, at.col + 1);
    else move(at.row, at.col);
  };

  const onGridKey = (event: KeyboardEvent<HTMLTableElement>) => {
    // Nur Tasten auf einer Zelle; Spaltenköpfe (Sortieren) und Eingabefelder behandeln ihre Tasten selbst.
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'gridcell')
      return;
    // Bearbeitung noch offen (z.B. ungültiger Wert mit Meldung), Fokus aber auf einer Zelle: die Taste gehört dem
    // Editor, nie still verworfen (UX-AB-G-16).
    if (editing !== null) {
      editor.current?.focus();
      return;
    }
    const { row, col } = safe;
    const ctrl = event.ctrlKey || event.metaKey;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(row + 1, col);
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(row - 1, col);
        return;
      case 'ArrowRight':
        event.preventDefault();
        move(row, col + 1);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        move(row, col - 1);
        return;
      case 'Home':
        event.preventDefault();
        move(ctrl ? 0 : row, 0);
        return;
      case 'End':
        event.preventDefault();
        move(ctrl ? rowCount - 1 : row, columns.length - 1);
        return;
      case 'PageDown':
        event.preventDefault();
        move(row + 10, col);
        return;
      case 'PageUp':
        event.preventDefault();
        move(row - 10, col);
        return;
      case 'Tab':
        if (event.shiftKey ? col > 0 : col < columns.length - 1) {
          event.preventDefault();
          move(row, col + (event.shiftKey ? -1 : 1));
        }
        return;
      case 'Enter':
        event.preventDefault();
        if (ctrl) {
          const r = rows[row];
          if (r !== undefined) onShowInGrid(r.weekId, r.entryId);
          return;
        }
        // Wie Excel (Entscheid Auftraggeber 29.10.2026): Enter geht eine Zeile tiefer, Shift+Enter eine höher; F2 oder
        // Tippen bearbeitet.
        move(row + (event.shiftKey ? -1 : 1), col);
        return;
      case 'F2':
        event.preventDefault();
        startEdit(safe);
        return;
      case 'Delete':
      case 'Backspace': {
        event.preventDefault();
        // Eintrag löschen nur mit Ctrl+Entf (bzw. Knopf); Entf/Rücktaste leeren nur Zellen, in Typ/Tag ein Hinweis
        // (CR-5-05).
        if (event.key === 'Delete' && ctrl) void removeRow(safe);
        else if (!ctrl) void clearCell(safe);
        return;
      }
      default: {
        // Tottaste bzw. Komposition (CH-Tastatur ´ ^ ¨, IME): Bearbeitung sofort öffnen und das Eingabefeld fokussieren,
        // damit das zusammengesetzte Zeichen im Feld ankommt (UX-AB-10).
        if (
          !ctrl &&
          !event.altKey &&
          (event.key === 'Dead' || event.key === 'Process' || event.key === 'Unidentified')
        ) {
          const column = columns[col];
          if (column !== undefined && !isChoice(column.key)) {
            flushSync(() => startEdit(safe, ''));
            editor.current?.focus();
          }
          return;
        }
        // Druckbares Zeichen, auch über AltGr (Windows meldet Ctrl+Alt; z.B. «@» auf der CH-Tastatur).
        const altGr = event.getModifierState('AltGraph') || (event.ctrlKey && event.altKey);
        if ((altGr || (!ctrl && !event.altKey)) && event.key.length === 1) {
          const column = columns[col];
          if (column !== undefined && !isChoice(column.key)) {
            event.preventDefault();
            startTyping(safe, event.key);
          }
          return;
        }
      }
    }
  };

  const toggleSort = (key: ListColumnKey) => {
    setSort((s) =>
      s === null || s.key !== key
        ? { key, dir: 'ascending' }
        : s.dir === 'ascending'
          ? { key, dir: 'descending' }
          : null,
    );
  };

  const label = scope === 'plan' ? 'Einträge ganzer Plan' : `Einträge ${week?.shortName ?? ''}`;
  const current = rows[safe.row];

  return (
    <section className="wap-list" aria-label="Listenansicht">
      <div className="wap-list-toolbar">
        <label>
          Filter
          <input
            ref={filterInput}
            type="search"
            aria-label="Filter"
            placeholder="Text in allen Spalten"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCursor({ row: 0, col: safe.col });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                move(0, 3);
              } else if (e.key === 'Escape' && filter !== '') {
                e.preventDefault();
                setFilter('');
              }
            }}
          />
        </label>
        <div role="radiogroup" aria-label="Umfang" className="wap-list-scope">
          {(
            [
              ['week', 'Diese Woche'],
              ['plan', 'Ganzer Plan'],
            ] as const
          ).map(([value, text]) => (
            <label key={value}>
              <input
                type="radio"
                name={`${ids}-scope`}
                checked={scope === value}
                onChange={() => {
                  setScope(value);
                  setCursor({ row: 0, col: safe.col });
                }}
              />
              {text}
            </label>
          ))}
        </div>
        <div className="wap-list-menu">
          <button
            ref={columnMenuButton}
            type="button"
            className="btn"
            aria-haspopup="true"
            aria-expanded={columnMenu}
            onClick={() => setColumnMenu((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && columnMenu) {
                e.preventDefault();
                e.stopPropagation();
                setColumnMenu(false);
              }
            }}
          >
            Spalten …
          </button>
          {columnMenu && (
            // biome-ignore lint/a11y/noStaticElementInteractions: Esc schliesst das Aufklappfeld (UX-AB-F-04)
            <div
              className="wap-list-menu-panel"
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                e.preventDefault();
                e.stopPropagation();
                setColumnMenu(false);
                columnMenuButton.current?.focus();
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={showSubtasks}
                  onChange={(e) => setShowSubtasks(e.target.checked)}
                />
                Teilaufgaben
              </label>
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn"
          disabled={current === undefined}
          title="Gewählten Eintrag im Raster zeigen (Ctrl+Enter)"
          onClick={() => current !== undefined && onShowInGrid(current.weekId, current.entryId)}
        >
          Im Raster zeigen
        </button>
        <button
          type="button"
          className="btn"
          disabled={current === undefined || readOnly}
          title="Gewählten Eintrag löschen (Ctrl+Entf)"
          onClick={() => void removeRow(safe)}
        >
          Eintrag löschen
        </button>
        <button
          type="button"
          className="btn"
          title="Liste im Format der Soll-Listen als CSV auf diesem Gerät speichern; interne Notizen sind nie enthalten"
          onClick={() =>
            onExport(
              listCsv(plan, scope === 'plan' ? 'plan' : { weekId }),
              listFileName(plan, new Date()),
            )
          }
        >
          Export …
        </button>
        <span className="wap-list-count" role="status">
          {rowCount} von {allRows.length} Einträgen
        </span>
      </div>
      {error !== null && (
        <div role="alert" className="wap-list-error">
          <strong>{error.cause}</strong> {error.nextStep}
        </div>
      )}
      {rowCount === 0 ? (
        <section aria-label="Keine Einträge" className="wap-list-empty">
          {filter.trim() === '' ? (
            <p>
              In dieser Woche gibt es noch keine Einträge. Im Raster ziehen oder einen Excel-WAP
              importieren.
            </p>
          ) : (
            <>
              <p>Kein Eintrag passt zu «{filter.trim()}».</p>
              {scope === 'week' && (
                <button type="button" className="btn" onClick={() => setScope('plan')}>
                  Im ganzen Plan suchen
                </button>
              )}
              <button type="button" className="btn" onClick={() => setFilter('')}>
                Filter löschen
              </button>
            </>
          )}
        </section>
      ) : (
        <div className="wap-list-scroll">
          <table
            ref={grid}
            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: Datentabelle als ARIA-Grid mit Zellzeiger (Vertrag E1-15 §1)
            role="grid"
            aria-label={label}
            aria-rowcount={rowCount + 1}
            aria-colcount={columns.length}
            className="wap-list-grid"
            onKeyDown={onGridKey}
          >
            <thead>
              <tr aria-rowindex={1}>
                {columns.map((c, ci) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-colindex={ci + 1}
                    aria-sort={sort?.key === c.key ? sort.dir : 'none'}
                  >
                    <button
                      type="button"
                      className="wap-list-sort"
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr
                  key={`${r.entryId}~${r.windowId ?? ''}~${r.weekId}`}
                  aria-rowindex={ri + 2}
                  aria-selected={ri === safe.row}
                >
                  {columns.map((c, ci) => {
                    const active = ri === safe.row && ci === safe.col;
                    const isEditing = editing !== null && editing.row === ri && editing.col === ci;
                    const editable = isEditable(r, c.key, plan);
                    return (
                      // biome-ignore lint/a11y/useKeyWithClickEvents: Tastatur über den Zellzeiger der Tabelle (onKeyDown am Grid)
                      <td
                        key={c.key}
                        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: Zelle des ARIA-Grids (Vertrag E1-15 §1)
                        role="gridcell"
                        aria-colindex={ci + 1}
                        aria-readonly={!editable || readOnly}
                        data-cell={`${ri}:${ci}`}
                        {...(c.key === 'spalten' && r.typ === 'Marker'
                          ? {
                              title:
                                'Marker gelten immer über alle Planungsspalten (nicht änderbar).',
                            }
                          : {})}
                        tabIndex={active && !isEditing ? 0 : -1}
                        className={active ? 'is-cursor' : undefined}
                        onClick={() => {
                          selectRow(ri);
                          setCursor({ row: ri, col: ci });
                        }}
                        onDoubleClick={() => {
                          if (c.key === 'typ' || c.key === 'tag') onShowInGrid(r.weekId, r.entryId);
                          else startEdit({ row: ri, col: ci });
                        }}
                      >
                        {isEditing ? (
                          isChoice(c.key) ? (
                            <select
                              ref={editor}
                              aria-label={c.label}
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void commit(e.shiftKey ? 'up' : 'down');
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setEditing(null);
                                  move(ri, ci);
                                } else if (e.key === 'Tab') {
                                  e.preventDefault();
                                  void commit('right');
                                }
                              }}
                            >
                              {c.key === 'kategorie'
                                ? [
                                    ...(plan.entries[r.entryId]?.type === 'beso'
                                      ? [
                                          <option key="" value="">
                                            keine
                                          </option>,
                                        ]
                                      : []),
                                    ...plan.legend.map((k) => (
                                      <option key={k.id} value={k.id}>
                                        {k.neutral ? 'neutral' : k.legendLabel}
                                      </option>
                                    )),
                                  ]
                                : STATUS_VALUES.map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                            </select>
                          ) : (
                            <input
                              ref={editor}
                              aria-label={c.label}
                              {...(c.key === 'spalten' ? { list: `${ids}-spalten` } : {})}
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onBlur={() => {
                                if (editing !== null) void commit('stay');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void commit(e.shiftKey ? 'up' : 'down');
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setEditing(null);
                                  setError(null);
                                  move(ri, ci);
                                } else if (e.key === 'Tab') {
                                  e.preventDefault();
                                  void commit('right');
                                }
                              }}
                            />
                          )
                        ) : (
                          cellText(r, c.key, plan)
                        )}
                        {isEditing && c.key === 'spalten' && (
                          <datalist id={`${ids}-spalten`}>
                            {spaltenChoices(plan, r).map((o) => (
                              <option key={o.value} value={o.label} />
                            ))}
                          </datalist>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function focusListFilter(root: ParentNode = document): void {
  root.querySelector<HTMLInputElement>('.wap-list input[type="search"]')?.focus();
}
