// biome-ignore-all lint/suspicious/noArrayIndexKey: This immutable preview is keyed by physical workbook row/column coordinates, including duplicate headings.
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ErrorBox, Modal } from '../components/Modal';
import {
  findHeader,
  guessMapping,
  IMPORT_FIELDS,
  type ImportMapping,
  importRows,
} from '../io/import';
import { localError } from '../io/text';
import { sheetRows, type XLSX } from '../io/workbook';
import type { Source } from '../model/types';
import { changeProject, notifyUndoable } from '../store';

export function ImportDialog({
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
  const [sheet, setSheet] = useState(workbook.SheetNames[0] || '');
  const rows = sheetRows(workbook, sheet);
  const [header, setHeader] = useState(() => findHeader(rows));
  const [mapping, setMapping] = useState<ImportMapping>(() => guessMapping(rows[header] || []));
  const [allowNames, setAllowNames] = useState(false),
    [error, setError] = useState('');
  const headers = rows[header] || [];
  const dataRows = rows.slice(header + 1).filter((row) => row.some(Boolean)).length;
  const mapped = Object.keys(mapping).length;
  const selectHeader = (next: number, currentRows = rows) => {
    setHeader(next);
    setMapping(guessMapping(currentRows[next] || []));
  };
  const sample = (index: number | undefined) =>
    index === undefined
      ? ''
      : (rows.slice(header + 1).find((row) => String(row[index] ?? '').trim())?.[index] ?? '');
  const submit = () => {
    try {
      let count = 0;
      changeProject((draft) => {
        const result = importRows(draft, source, rows, header, mapping, filename, allowNames);
        count = result.added + result.updated;
      });
      notifyUndoable(`${count} Datensätze lokal übernommen. Jetzt Personen verteilen.`);
      onClose(true);
    } catch (failure) {
      setError(localError(failure));
    }
  };
  return (
    <Modal
      title={`${source === 'pisa' ? 'PISA' : 'MILOFFICE'}-Liste übernehmen`}
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
            <Icon name="check" size={16} /> Personen übernehmen
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="form-grid">
        <label className="field">
          Tabellenblatt
          <select
            value={sheet}
            onChange={(event) => {
              const next = event.target.value;
              setSheet(next);
              const nextRows = sheetRows(workbook, next);
              selectHeader(findHeader(nextRows), nextRows);
            }}
          >
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
            onChange={(event) => selectHeader(Math.max(0, Number(event.target.value) - 1))}
          />
        </label>
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
      <div>
        <h3 className="import-heading">Spalten zuordnen</h3>
        <div className="import-mapping">
          {IMPORT_FIELDS.map((field) => {
            const value = mapping[field.key];
            return (
              <label
                className={`import-row ${value === undefined ? '' : 'is-mapped'}`}
                key={field.key}
              >
                <span className="import-label">
                  {field.label}
                  {field.key === 'name' ? ' *' : ''}
                </span>
                <select
                  value={value ?? -1}
                  onChange={(event) => {
                    const next = { ...mapping };
                    const index = Number(event.target.value);
                    if (index < 0) delete next[field.key];
                    else next[field.key] = index;
                    setMapping(next);
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
      </p>
    </Modal>
  );
}
