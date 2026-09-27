import { type ChangeEvent, useId, useState } from 'react';
import { readFileBytes } from '../../io/tagesbefehl/bytes';
import { displayDate } from '../../io/text';
import { listWapSheets, parseWap } from '../../io/wap';
import {
  dayDate,
  orderNumber,
  TB_WEEKDAY_NAMES,
  TB_WEEKDAYS,
  type TbWeek,
  type WapParseResult,
} from '../../model/tagesbefehl';
import { notify } from '../../store';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { InlineNumber } from './fields';
import { changeTb, changeWeek, type TbStepProps } from './tbStore';
import {
  isMonday,
  lastNumber,
  orderedWeeks,
  suggestFirstNumber,
  suggestStartDate,
  weekFromParse,
} from './weekTools';

interface LoadedFile {
  name: string;
  bytes: Uint8Array;
  sheets: string[];
}

export function WapStep({
  project,
  tb,
  archived,
  run,
  activeSheet,
  onSelectWeek,
  onReview,
}: TbStepProps & {
  activeSheet: string;
  onSelectWeek: (sheet: string) => void;
  onReview: () => void;
}) {
  const [file, setFile] = useState<LoadedFile | null>(null),
    [sheet, setSheet] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [removing, setRemoving] = useState(''),
    [report, setReport] = useState<{
      sheet: string;
      diagnostics: string[];
      entries: number;
      days: number;
    } | null>(null);
  const weeks = orderedWeeks(tb);
  const week = tb.wochen[activeSheet];

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget,
      selected = input.files?.[0];
    if (!selected) return;
    void run(async () => {
      const bytes = await readFileBytes(selected);
      let sheets: string[];
      try {
        sheets = await listWapSheets(bytes);
      } catch {
        throw new Error('Die Datei konnte nicht als Kp-WAP (.xlsx) gelesen werden.');
      }
      if (!sheets.length)
        throw new Error('In der Datei wurde kein Tabellenblatt gefunden. Bitte den Kp-WAP wählen.');
      setFile({ name: selected.name, bytes, sheets });
      setSheet(sheets.find((name) => !tb.wochen[name]) ?? sheets[0]);
      setReport(null);
    }).finally(() => {
      input.value = '';
    });
  };

  const parse = async () => {
    if (!file || !sheet) return;
    setConfirm(false);
    setBusy(true);
    const ok = await run(async () => {
      let result: WapParseResult;
      try {
        result = await parseWap(file.bytes, sheet, { rules: tb.regeln });
      } catch {
        throw new Error(
          'Das Tabellenblatt konnte nicht ausgewertet werden. Bitte das Blatt und die Datei prüfen.',
        );
      }
      changeTb((draft) => {
        draft.wochen[sheet] = weekFromParse(
          draft,
          { ...result, sheet },
          file.name,
          draft.wochen[sheet],
        );
      });
      setReport({
        sheet,
        diagnostics: result.diagnostics,
        entries: result.entries.length,
        days: result.days.length,
      });
      onSelectWeek(sheet);
      notify(`«${sheet}» eingelesen. Bitte die Einträge prüfen.`);
    });
    setBusy(false);
    return ok;
  };

  return (
    <div className="tb-step-grid">
      <div className="tb-column">
        <section className="card" aria-labelledby="tb-wap-title">
          <header className="card-head">
            <h2 id="tb-wap-title">
              <Icon name="upload" /> WAP laden
            </h2>
            <span className="muted tb-head-note">Kp-WAP einlesen</span>
          </header>
          <div className="card-body tb-card-stack">
            <p className="muted">
              Die Datei wird nur lokal gelesen. Pro Tabellenblatt entsteht eine Woche; geprüfte
              Wochen bleiben im Projekt gespeichert.
            </p>
            <div className="toolbar">
              <label className={`btn tb-file-button ${file || weeks.length ? '' : 'btn-primary'}`}>
                <Icon name="upload" size={16} />
                {file ? 'Andere Datei wählen' : 'Kp-WAP (.xlsx) wählen'}
                <input
                  className="tb-file-input"
                  type="file"
                  aria-label="Kp-WAP (.xlsx) wählen"
                  accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={archived}
                  onChange={pick}
                />
              </label>
              {file && (
                <span className="tb-file-name">
                  <Icon name="sheet" size={16} />
                  <span className="truncate">{file.name}</span>
                </span>
              )}
            </div>
            {file && (
              <div className="toolbar tb-parse-bar">
                <label className="field">
                  Tabellenblatt
                  <select value={sheet} onChange={(event) => setSheet(event.target.value)}>
                    {file.sheets.map((name) => (
                      <option key={name} value={name}>
                        {tb.wochen[name] ? `${name} (bereits geladen)` : name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={archived || busy || !sheet}
                  onClick={() => (tb.wochen[sheet] ? setConfirm(true) : void parse())}
                >
                  {busy ? 'Wird eingelesen …' : 'Einlesen'}
                </button>
              </div>
            )}
            {report && (
              <div
                className={`callout ${report.entries ? 'callout-success' : 'callout-warning'}`}
                role={report.entries ? 'status' : 'alert'}
              >
                <Icon name={report.entries ? 'checkCircle' : 'alert'} />
                <div className="callout-body">
                  <strong>
                    {report.entries
                      ? `${report.sheet}: ${report.entries} Einträge an ${report.days} Tagen erkannt.`
                      : `${report.sheet}: Keine Einträge erkannt. Tage und Einträge können manuell ergänzt werden.`}
                  </strong>
                  {report.diagnostics.length > 0 && (
                    <details className="tb-details">
                      <summary>Details zur Auswertung ({report.diagnostics.length})</summary>
                      <ul className="tb-diagnostics">
                        {report.diagnostics.map((line, index) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: static diagnostic list
                          <li key={index}>{line}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                {report.entries > 0 && (
                  <div className="callout-actions">
                    <button type="button" className="btn btn-sm btn-primary" onClick={onReview}>
                      Weiter zum Prüfen <Icon name="arrowRight" size={15} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {weeks.length > 0 && (
          <section className="card tb-table-card" aria-labelledby="tb-weeks-title">
            <header className="card-head">
              <h2 id="tb-weeks-title">
                <Icon name="calendar" /> Geladene Wochen
              </h2>
              <span className="badge">{weeks.length}</span>
            </header>
            <div className="data-table">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Woche</th>
                      <th>Montag</th>
                      <th>Nummern</th>
                      <th>Quelle</th>
                      <th>
                        <span className="visually-hidden">Aktionen</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((item) => (
                      <tr
                        key={item.sheet}
                        className={item.sheet === activeSheet ? 'is-selected' : ''}
                      >
                        <td>
                          <strong>{item.sheet}</strong>
                        </td>
                        <td className="num">{displayDate(item.startDate)}</td>
                        <td className="num">
                          {item.days.length
                            ? `Nr ${orderNumber(item, item.days[0])}–${lastNumber(item)}`
                            : '—'}
                        </td>
                        <td className="tb-source-cell">
                          {item.sourceFile || '—'}
                          <small>
                            {item.parsedAt
                              ? `eingelesen ${new Date(item.parsedAt).toLocaleDateString('de-CH')}`
                              : ''}
                          </small>
                        </td>
                        <td className="tb-row-actions">
                          <button
                            type="button"
                            className={`btn btn-sm ${item.sheet === activeSheet ? 'btn-ghost' : ''}`}
                            aria-pressed={item.sheet === activeSheet}
                            onClick={() => onSelectWeek(item.sheet)}
                          >
                            {item.sheet === activeSheet && <Icon name="check" size={15} />}
                            {item.sheet === activeSheet ? 'Ausgewählt' : 'Auswählen'}
                          </button>
                          {!archived && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-sm tb-remove"
                              aria-label={`Woche ${item.sheet} entfernen`}
                              title="Entfernen"
                              onClick={() => setRemoving(item.sheet)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      {week && <WeekSettings week={week} {...{ project, tb, archived, run }} />}

      {confirm && (
        <Modal
          title="Woche neu einlesen?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Abbrechen
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void parse()}>
                Überschreiben
              </button>
            </>
          }
        >
          <p>
            «{sheet}» ist bereits geladen. Neu einlesen ersetzt alle geprüften Einträge, Hinweise
            und Prüfvermerke dieser Woche.
          </p>
          <p className="muted">
            Startdatum, erste Nummer, Tagesoffiziere und Wacht Of bleiben erhalten. Rückgängig
            machen ist danach möglich.
          </p>
        </Modal>
      )}
      {removing && (
        <Modal
          title={`Woche «${removing}» entfernen?`}
          onClose={() => setRemoving('')}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setRemoving('')}>
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  const target = removing;
                  setRemoving('');
                  void run(() =>
                    changeTb((draft) => {
                      delete draft.wochen[target];
                    }),
                  );
                }}
              >
                Entfernen
              </button>
            </>
          }
        >
          <p>Die geprüften Einträge dieser Woche werden aus dem Projekt entfernt.</p>
        </Modal>
      )}
    </div>
  );
}

function WeekSettings({ tb, week, archived, run }: TbStepProps & { week: TbWeek }) {
  const numberId = useId();
  const suggestedNumber = suggestFirstNumber(tb, week.sheet, week.startDate);
  const suggestedDate = suggestStartDate(tb, week.sheet);
  const edit = (mutator: (draft: TbWeek) => void) =>
    void run(() => changeWeek(week.sheet, (draft) => mutator(draft)));
  return (
    <section className="card" aria-labelledby="tb-week-title">
      <header className="card-head">
        <h2 id="tb-week-title">
          <Icon name="calendar" /> Datum & Nummerierung
        </h2>
        <span className="badge badge-accent">Woche {week.sheet}</span>
      </header>
      <div className="card-body tb-card-stack">
        <div className="form-grid">
          <div className="tb-field-stack">
            <label className="field">
              Startdatum (Montag)
              <input
                type="date"
                value={week.startDate}
                disabled={archived}
                onChange={(event) =>
                  edit((draft) => {
                    draft.startDate = event.target.value;
                  })
                }
              />
            </label>
            {week.startDate && !isMonday(week.startDate) && (
              <small className="tb-warning-text">
                <Icon name="alert" size={14} /> Das Datum ist kein Montag.
              </small>
            )}
            {!week.startDate && suggestedDate && !archived && (
              <button
                type="button"
                className="btn-link tb-suggestion"
                onClick={() =>
                  edit((draft) => {
                    draft.startDate = suggestedDate;
                  })
                }
              >
                Vorschlag übernehmen: {displayDate(suggestedDate)}
              </button>
            )}
          </div>
          <div className="tb-field-stack">
            <label className="field" htmlFor={numberId}>
              Erste Tagesbefehl-Nummer (Montag)
              <InlineNumber
                id={numberId}
                value={week.firstNumber}
                disabled={archived}
                onCommit={(value) =>
                  edit((draft) => {
                    draft.firstNumber = value;
                  })
                }
              />
            </label>
            {suggestedNumber !== week.firstNumber && !archived && (
              <button
                type="button"
                className="btn-link tb-suggestion"
                onClick={() =>
                  edit((draft) => {
                    draft.firstNumber = suggestedNumber;
                  })
                }
              >
                Vorschlag übernehmen: Nr {suggestedNumber} (nach der Vorwoche)
              </button>
            )}
          </div>
        </div>
        <fieldset className="field-group tb-days" disabled={archived}>
          <legend>Tage mit Tagesbefehl</legend>
          {TB_WEEKDAYS.map((day) => (
            <label key={day} className="check tb-day-check">
              <input
                type="checkbox"
                checked={week.days.includes(day)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  edit((draft) => {
                    draft.days = TB_WEEKDAYS.filter((item) =>
                      item === day ? checked : draft.days.includes(item),
                    );
                  });
                }}
              />
              <span>
                {TB_WEEKDAY_NAMES[day]}
                <small>
                  Nr {orderNumber(week, day)}
                  {week.startDate ? ` · ${displayDate(dayDate(week, day))}` : ''}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </section>
  );
}
