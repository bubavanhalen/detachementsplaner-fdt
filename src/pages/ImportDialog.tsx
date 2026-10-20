// biome-ignore-all lint/suspicious/noArrayIndexKey: This immutable preview is keyed by physical workbook row/column coordinates, including duplicate headings.
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { ErrorBox, Modal } from '../components/Modal';
import {
  compareImport,
  findHeader,
  guessListMapping,
  guessMapping,
  IMPORT_FIELDS,
  type ImportComparison,
  type ImportMapping,
  type ImportResult,
  importMiloList,
  importRows,
  LIST_FIELDS,
  LIST_LABELS,
  type ListImportResult,
  type ListMapping,
} from '../io/import';
import { displayDate, localError } from '../io/text';
import { sheetRows, type XLSX } from '../io/workbook';
import { createMilo, FIELD_LABELS, guessEingerueckt, statusKey, today } from '../model';
import type { MiloListe } from '../model/milo';
import type { Project, Source } from '../model/types';
import { changeProject, notifyUndoable, useProject } from '../store';

export function ImportDialog({
  workbook,
  source,
  filename,
  onClose,
}: {
  workbook: XLSX.WorkBook;
  source: Source | MiloListe;
  filename: string;
  onClose: (imported: boolean) => void;
}) {
  return source === 'pisa' || source === 'milo' ? (
    <PersonImport workbook={workbook} source={source} filename={filename} onClose={onClose} />
  ) : (
    // A leave or command list changes no people, so the caller stays on the current page.
    <ListImport
      workbook={workbook}
      kind={source}
      filename={filename}
      onClose={() => onClose(false)}
    />
  );
}

/** Sheet, header row and column choice shared by both list kinds. */
function useSheet<M>(workbook: XLSX.WorkBook, guess: (headers: string[]) => M) {
  const [sheet, setSheet] = useState(workbook.SheetNames[0] || '');
  const rows = useMemo(() => sheetRows(workbook, sheet), [workbook, sheet]);
  const [header, setHeader] = useState(() => findHeader(rows));
  const [mapping, setMapping] = useState<M>(() => guess(rows[header] || []));
  const selectHeader = (next: number, currentRows = rows) => {
    setHeader(next);
    setMapping(guess(currentRows[next] || []));
  };
  const changeSheet = (next: string) => {
    setSheet(next);
    const nextRows = sheetRows(workbook, next);
    selectHeader(findHeader(nextRows), nextRows);
  };
  return { sheet, rows, header, mapping, setMapping, selectHeader, changeSheet };
}

function SheetControls({
  workbook,
  sheet,
  rows,
  header,
  onSheet,
  onHeader,
  children,
}: {
  workbook: XLSX.WorkBook;
  sheet: string;
  rows: string[][];
  header: number;
  onSheet: (next: string) => void;
  onHeader: (next: number) => void;
  children?: React.ReactNode;
}) {
  const headers = rows[header] || [];
  return (
    <>
      <div className="form-grid">
        <label className="field">
          Tabellenblatt
          <select value={sheet} onChange={(event) => onSheet(event.target.value)}>
            {workbook.SheetNames.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Kopfzeile <span className="hint">Zeile mit den Spaltennamen</span>
          <input
            type="number"
            min="1"
            max={rows.length}
            value={header + 1}
            onChange={(event) => onHeader(Math.max(0, Number(event.target.value) - 1))}
          />
        </label>
        {children}
      </div>
      <div className="import-preview card">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {headers.map((name, i) => (
                  <th key={`${i}-${name}`}>{name || `Spalte ${i + 1}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(header + 1, header + 4).map((row, i) => (
                <tr key={`preview-${header + i}`}>
                  {headers.map((name, j) => (
                    <td key={`${j}-${name}`}>{String(row[j] ?? '').slice(0, 60)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function MappingRows<K extends string>({
  fields,
  required,
  mapping,
  rows,
  header,
  onChange,
}: {
  fields: readonly { key: K; label: string }[];
  required: K[];
  mapping: Partial<Record<K, number>>;
  rows: string[][];
  header: number;
  onChange: (next: Partial<Record<K, number>>) => void;
}) {
  const headers = rows[header] || [];
  const sample = (index: number | undefined) =>
    index === undefined
      ? ''
      : (rows.slice(header + 1).find((row) => String(row[index] ?? '').trim())?.[index] ?? '');
  return (
    <div>
      <h3 className="import-heading">Spalten zuordnen</h3>
      <div className="import-mapping">
        {fields.map((field) => {
          const value = mapping[field.key];
          return (
            <label
              className={`import-row ${value === undefined ? '' : 'is-mapped'}`}
              key={field.key}
            >
              <span className="import-label">
                {field.label}
                {required.includes(field.key) ? ' *' : ''}
              </span>
              <select
                value={value ?? -1}
                onChange={(event) => {
                  const next = { ...mapping };
                  const index = Number(event.target.value);
                  if (index < 0) delete next[field.key];
                  else next[field.key] = index;
                  onChange(next);
                }}
              >
                <option value={-1}>Nicht zuordnen</option>
                {headers.map((name, i) => (
                  <option key={`${i}-${name}`} value={i}>
                    {name || `Spalte ${i + 1}`}
                  </option>
                ))}
              </select>
              <span className="import-sample truncate">{String(sample(value)).slice(0, 40)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function names(project: Project, ids: string[]): string {
  const byId = new Map(project.persons.map((person) => [person.id, person]));
  const listed = ids.slice(0, 12).map((id) => {
    const person = byId.get(id);
    return person ? [person.grad, person.name].filter(Boolean).join(' ') : '—';
  });
  return ids.length > 12 ? `${listed.join(', ')} … (+${ids.length - 12})` : listed.join(', ');
}

/** What the list would change, shown before anything is kept. */
function ComparisonView({
  draft,
  comparison,
  result,
  source,
}: {
  draft: Project;
  comparison: ImportComparison;
  result: ImportResult;
  source: Source;
}) {
  const changed = new Set(comparison.geaendert.map((change) => change.personId));
  const other = source === 'pisa' ? 'MILO' : 'PISA';
  return (
    <section className="import-compare" aria-label="Abgleich">
      <h3 className="import-heading">Abgleich mit dem Projekt</h3>
      <ul className="import-compare-list">
        <li>
          <strong>{comparison.neu.length}</strong> neu
          {comparison.neu.length > 0 && (
            <span className="muted"> · {names(draft, comparison.neu)}</span>
          )}
        </li>
        <li>
          <strong>{changed.size}</strong> mit geänderten Angaben
          {changed.size > 0 && (
            <details className="disclosure">
              <summary>
                <Icon name="chevronRight" size={15} className="chev" /> Änderungen anzeigen
              </summary>
              <ul className="disclosure-body">
                {comparison.geaendert.slice(0, 60).map((change) => (
                  <li key={`${change.personId}-${change.feld}`}>
                    {names(draft, [change.personId])} · {FIELD_LABELS[change.feld]}:{' '}
                    {change.alt || '—'} → {change.neu || '—'}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </li>
        {source === 'milo' && (
          <li>
            <strong>{comparison.nichtMehr.length}</strong> nicht mehr in MILO (werden nur markiert,
            nicht gelöscht)
            {comparison.nichtMehr.length > 0 && (
              <span className="muted"> · {names(draft, comparison.nichtMehr)}</span>
            )}
          </li>
        )}
        {comparison.wiederInMilo.length > 0 && (
          <li>
            <strong>{comparison.wiederInMilo.length}</strong> wieder in MILO ·{' '}
            <span className="muted">{names(draft, comparison.wiederInMilo)}</span>
          </li>
        )}
        {result.abweichungen.length > 0 && (
          <li>
            <strong>{result.abweichungen.length}</strong> abweichende Werte, die {other} führt
            (nicht übernommen)
            <details className="disclosure">
              <summary>
                <Icon name="chevronRight" size={15} className="chev" /> Abweichungen anzeigen
              </summary>
              <ul className="disclosure-body">
                {result.abweichungen.slice(0, 60).map((item) => (
                  <li key={`${item.personId}-${item.feld}`}>
                    {names(draft, [item.personId])} · {FIELD_LABELS[item.feld]}: bleibt {item.wert},
                    Liste {item.liste}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        )}
      </ul>
    </section>
  );
}

type Decision = 'ja' | 'nein' | 'offen';

function PersonImport({
  workbook,
  source,
  filename,
  onClose,
}: {
  workbook: XLSX.WorkBook;
  source: Source;
  filename: string;
  onClose: (imported: boolean) => void;
}) {
  const project = useProject();
  const sheet = useSheet<ImportMapping>(workbook, guessMapping);
  const { rows, header, mapping } = sheet;
  const [allowNames, setAllowNames] = useState(false),
    [stand, setStand] = useState(today()),
    [decisions, setDecisions] = useState<Record<string, Decision>>({}),
    [error, setError] = useState('');
  const dataRows = rows.slice(header + 1).filter((row) => row.some(Boolean)).length;
  const mapped = Object.keys(mapping).length;
  const listStand = source === 'milo' ? stand : undefined;
  const preview = useMemo(() => {
    if (mapping.name === undefined) return null;
    try {
      const draft = structuredClone(project);
      const result = importRows(draft, source, rows, header, mapping, filename, allowNames, {
        stand: listStand,
      });
      return { draft, result, comparison: compareImport(project, draft) };
    } catch {
      return null;
    }
  }, [project, source, rows, header, mapping, filename, allowNames, listStand]);
  // Every distinct roster status is classified once; the user's choice is kept for later lists.
  const statuses = useMemo(() => {
    const column = mapping.miloStatus;
    if (source !== 'milo' || column === undefined) return [];
    const values = new Map<string, string>();
    for (const row of rows.slice(header + 1)) {
      const value = String(row[column] ?? '').trim();
      if (value) values.set(statusKey(value), value);
    }
    return [...values].map(([key, label]) => {
      const known = project.milo?.statusEingerueckt[key];
      const guess = known ?? guessEingerueckt(label);
      return {
        key,
        label,
        initial: (guess === undefined ? 'offen' : guess ? 'ja' : 'nein') as Decision,
      };
    });
  }, [source, rows, header, mapping.miloStatus, project.milo]);
  const decision = (key: string, initial: Decision) => decisions[key] ?? initial;
  const submit = () => {
    try {
      let count = 0;
      changeProject((draft) => {
        const result = importRows(draft, source, rows, header, mapping, filename, allowNames, {
          stand: listStand,
        });
        count = result.added + result.updated;
        if (statuses.length) {
          draft.milo ??= createMilo();
          for (const status of statuses) {
            const value = decision(status.key, status.initial);
            if (value === 'offen') delete draft.milo.statusEingerueckt[status.key];
            else draft.milo.statusEingerueckt[status.key] = value === 'ja';
          }
        }
      });
      notifyUndoable(
        source === 'milo'
          ? `${count} Datensätze lokal abgeglichen. Stand MILO: ${displayDate(stand)}.`
          : `${count} Datensätze lokal übernommen. Jetzt Personen verteilen.`,
      );
      onClose(true);
    } catch (failure) {
      setError(localError(failure));
    }
  };
  return (
    <Modal
      title={`${source === 'pisa' ? 'PISA' : 'MILO'}-Liste ${source === 'milo' ? 'abgleichen' : 'übernehmen'}`}
      description={
        <>
          <Icon name="file" size={14} className="inline-icon" /> {filename} · wird nur auf diesem
          Gerät gelesen
        </>
      }
      onClose={() => onClose(false)}
      wide
      footer={
        <>
          <span className="spacer muted">
            {dataRows} Zeilen · {mapped} von {IMPORT_FIELDS.length} Feldern zugeordnet
          </span>
          <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={mapping.name === undefined}
            onClick={submit}
          >
            <Icon name="check" size={16} />{' '}
            {source === 'milo' ? 'Abgleich übernehmen' : 'Personen übernehmen'}
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <SheetControls
        workbook={workbook}
        sheet={sheet.sheet}
        rows={rows}
        header={header}
        onSheet={sheet.changeSheet}
        onHeader={(next) => sheet.selectHeader(next)}
      >
        {source === 'milo' && (
          <label className="field">
            Stand der Liste <span className="hint">Tag des MILO-Exports</span>
            <input type="date" value={stand} onChange={(event) => setStand(event.target.value)} />
          </label>
        )}
      </SheetControls>
      <MappingRows
        fields={IMPORT_FIELDS}
        required={['name']}
        mapping={mapping}
        rows={rows}
        header={header}
        onChange={sheet.setMapping}
      />
      {statuses.length > 0 && (
        <section aria-label="Status der Bestandesliste">
          <h3 className="import-heading">Status der Bestandesliste</h3>
          <p className="muted">
            Gilt der Status als eingerückt? Die Wahl bleibt für spätere Listen gespeichert.
          </p>
          <div className="import-mapping">
            {statuses.map((status) => (
              <label className="import-row is-mapped" key={status.key}>
                <span className="import-label">{status.label}</span>
                <select
                  value={decision(status.key, status.initial)}
                  onChange={(event) =>
                    setDecisions({ ...decisions, [status.key]: event.target.value as Decision })
                  }
                >
                  <option value="ja">eingerückt</option>
                  <option value="nein">nicht eingerückt</option>
                  <option value="offen">offen</option>
                </select>
                <span />
              </label>
            ))}
          </div>
        </section>
      )}
      {preview && (
        <ComparisonView
          draft={preview.draft}
          comparison={preview.comparison}
          result={preview.result}
          source={source}
        />
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={allowNames}
          onChange={(event) => setAllowNames(event.target.checked)}
        />
        Zusätzlich eindeutige Namen abgleichen; Identität anschliessend prüfen.
      </label>
      <p className="muted">
        Unterschiedliche Versicherten-Nummern werden nie aufgrund gleicher Namen zusammengeführt.
        Weitere Spalten bleiben als Rohdaten erhalten.
        {source === 'milo' &&
          ' NZL, Geburtsdatum und Status führt MILO; Grad, Funktion und Einteilung führt PISA.'}
      </p>
    </Modal>
  );
}

function ListImport({
  workbook,
  kind,
  filename,
  onClose,
}: {
  workbook: XLSX.WorkBook;
  kind: MiloListe;
  filename: string;
  onClose: () => void;
}) {
  const project = useProject();
  const sheet = useSheet<ListMapping>(workbook, guessListMapping);
  const { rows, header, mapping } = sheet;
  const [allowNames, setAllowNames] = useState(false),
    [error, setError] = useState('');
  const ready =
    (mapping.name !== undefined || mapping.pnr !== undefined) && mapping.von !== undefined;
  const preview = useMemo((): { result: ListImportResult; comparison: ImportComparison } | null => {
    if (!ready) return null;
    try {
      const draft = structuredClone(project);
      const result = importMiloList(draft, kind, rows, header, mapping, filename, allowNames);
      return { result, comparison: compareImport(project, draft) };
    } catch {
      return null;
    }
  }, [project, kind, rows, header, mapping, filename, allowNames, ready]);
  const submit = () => {
    try {
      let count = 0;
      changeProject((draft) => {
        count = importMiloList(draft, kind, rows, header, mapping, filename, allowNames).count;
      });
      notifyUndoable(`${LIST_LABELS[kind]} lokal übernommen: ${count} Einträge.`);
      onClose();
    } catch (failure) {
      setError(localError(failure));
    }
  };
  return (
    <Modal
      title={`MILO-${LIST_LABELS[kind]} abgleichen`}
      description={
        <>
          <Icon name="file" size={14} className="inline-icon" /> {filename} · wird nur auf diesem
          Gerät gelesen
        </>
      }
      onClose={onClose}
      wide
      footer={
        <>
          <span className="spacer muted">
            {preview ? `${preview.result.count} Einträge erkannt` : 'Spalten zuordnen'}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={submit}>
            <Icon name="check" size={16} /> Liste übernehmen
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <SheetControls
        workbook={workbook}
        sheet={sheet.sheet}
        rows={rows}
        header={header}
        onSheet={sheet.changeSheet}
        onHeader={(next) => sheet.selectHeader(next)}
      />
      <MappingRows
        fields={LIST_FIELDS}
        required={['von']}
        mapping={mapping}
        rows={rows}
        header={header}
        onChange={sheet.setMapping}
      />
      {preview && (
        <section className="import-compare" aria-label="Abgleich">
          <h3 className="import-heading">Abgleich mit dem Projekt</h3>
          <ul className="import-compare-list">
            <li>
              <strong>{preview.comparison.eintraegeNeu}</strong> neue Einträge ·{' '}
              <strong>{preview.comparison.eintraegeEntfallen}</strong> entfallen (die MILO-Liste
              ersetzt die bisherige)
            </li>
            {preview.result.ohnePerson.length > 0 && (
              <li>
                <strong>{preview.result.ohnePerson.length}</strong> Zeilen ohne passende Person ·{' '}
                <span className="muted">{preview.result.ohnePerson.slice(0, 12).join(', ')}</span>
              </li>
            )}
            {preview.result.ohneDatum > 0 && (
              <li>
                <strong>{preview.result.ohneDatum}</strong> Zeilen ohne lesbares Datum
              </li>
            )}
          </ul>
        </section>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={allowNames}
          onChange={(event) => setAllowNames(event.target.checked)}
        />
        Zeilen ohne Versicherten-Nr. über eindeutige Namen zuordnen.
      </label>
      <p className="muted">
        Personen werden aus dieser Liste nie neu angelegt. Die Liste ersetzt die bisherige
        {kind === 'urlaub' ? ' Urlaubsliste' : ' Kommandierungsliste'}, da MILO die Quelle ist.
      </p>
    </Modal>
  );
}
