// biome-ignore-all lint/suspicious/noArrayIndexKey: This immutable preview is keyed by physical workbook row/column coordinates, including duplicate headings.
import { useState } from 'react';
import { Modal } from '../components/Modal';
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
import { changeProject, notify } from '../store';

export function ImportDialog({
  workbook,
  source,
  filename,
  onClose,
}: {
  workbook: XLSX.WorkBook;
  source: Source;
  filename: string;
  onClose: () => void;
}) {
  const [sheet, setSheet] = useState(workbook.SheetNames[0] || '');
  const rows = sheetRows(workbook, sheet);
  const [header, setHeader] = useState(() => findHeader(rows));
  const [mapping, setMapping] = useState<ImportMapping>(() => guessMapping(rows[header] || []));
  const [allowNames, setAllowNames] = useState(false),
    [error, setError] = useState('');
  const headers = rows[header] || [];
  const selectHeader = (next: number, currentRows = rows) => {
    setHeader(next);
    setMapping(guessMapping(currentRows[next] || []));
  };
  const submit = () => {
    try {
      let count = 0;
      changeProject((draft) => {
        const result = importRows(draft, source, rows, header, mapping, filename, allowNames);
        count = result.added + result.updated;
      });
      notify(`${count} Datensätze lokal übernommen. Neue Personen können jetzt verteilt werden.`);
      onClose();
    } catch (failure) {
      setError(localError(failure));
    }
  };
  return (
    <Modal
      title={`${source === 'pisa' ? 'PISA' : 'MILOFFICE'} · Spalten zuordnen`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="button primary" onClick={submit}>
            Personen übernehmen
          </button>
        </>
      }
    >
      <p className="muted">
        Die Datei wird ausschliesslich auf diesem Gerät verarbeitet. Prüfe die Zuordnung vor dem
        Übernehmen.
      </p>
      {error && (
        <div role="alert" className="notice warning">
          {error}
        </div>
      )}
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
          Kopfzeile
          <input
            type="number"
            min="1"
            max={rows.length}
            value={header + 1}
            onChange={(event) => selectHeader(Math.max(0, Number(event.target.value) - 1))}
          />
        </label>
      </div>
      <div className="table-wrap">
        <table>
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
      <div className="form-grid">
        {IMPORT_FIELDS.map((field) => (
          <label className="field" key={field.key}>
            {field.label}
            {field.key === 'name' ? ' *' : ''}
            <select
              value={mapping[field.key] ?? -1}
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
          </label>
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={allowNames}
          onChange={(event) => setAllowNames(event.target.checked)}
        />{' '}
        Zusätzlich eindeutige Namen abgleichen; Identität anschliessend prüfen.
      </label>
      <p className="muted">
        Unterschiedliche Versicherten-Nummern werden nie aufgrund gleicher Namen zusammengeführt.
        Weitere Spalten bleiben als Rohdaten erhalten.
      </p>
    </Modal>
  );
}
