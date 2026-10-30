// «Neuen Stand setzen», PDF-Export und modaler Fortschritt (I5 D2; Beschrieb 5.5, 7, 10; UI-Richtlinie 10, 11.2, 12;
// E1-05, E1-16; R-5.5-01 bis -08, R-7-04, R-7-05, R-L-07). F-UX1 (Entscheide des Auftraggebers vom 19.10.2026):
// «PDF dieser Woche» zeigt vorher die Befunde der Woche (TE-I5-01, «6: ja»); ein gesetzter Stand ist nicht
// rückgängig machbar, die Version eines früheren Stands wird nicht ein zweites Mal vergeben («Stand: ja»).

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { StandSummary } from '../../../io/wap-plan/standStore';
import { formatDate } from '../../../model/wap/calendar';
import { type Finding, findingsForExport } from '../../../model/wap/checks';
import type { CommandContext } from '../../../model/wap/commands/command';
import type { PageOptions } from '../../../model/wap/layout/page/types';
import { type PdfTarget, pdfFileName } from '../../../model/wap/stand/fileName';
import { applyStand, type StandInput } from '../../../model/wap/stand/stand';
import type { Beso, Id, Plan } from '../../../model/wap/types';
import { useDialogGuard } from '../i2/dialogGuard';
import { namingPlan } from '../i2/fileNames';
import { I2Dialog as Modal } from '../i2/I2Dialog';
import { parseDateInput } from '../i2/timeInput';
import { WeekPageView } from '../render/WeekPageView';
import { SeveritySymbol } from './findings';
import { todayIso } from './support';
import './flows.css';

function weekLabel(shortName: string): string {
  return shortName.replace(/^Wo(\d)/, 'Wo $1');
}

/** «Stand V1 vom 17.09.2026». */
export function standText(s: { readonly version: number; readonly date: string }): string {
  return `Stand V${String(s.version)} vom ${formatDate(s.date, 'long')}`;
}

/** Folgen des Stands für die Liste im Dialog (UI-Richtlinie 10; R-5.5-08, F-64). */
function consequences(plan: Plan, input: StandInput, ctx: CommandContext): readonly string[] {
  const out: string[] = [];
  let after: Plan | null = null;
  try {
    after = applyStand(plan, input, ctx).plan;
  } catch {
    after = null;
  }
  const version = input.version ?? (plan.stand?.version ?? 0) + 1;
  out.push(
    `Vorher entsteht ein Wiederherstellungspunkt «vor Stand V${String(version)}». Der Stand lässt sich danach nicht rückgängig machen; die Fassung davor holt «Wiederherstellungspunkte …» zurück.`,
  );
  out.push('Die Beso-Nummern werden fixiert; neue Beso erhalten danach freie Nummern.');
  const cancelled = Object.values(plan.entries).filter((e) => e.status === 'cancelled').length;
  if (cancelled > 0)
    out.push(
      `${String(cancelled)} ${cancelled === 1 ? 'gestrichener Eintrag wird' : 'gestrichene Einträge werden'} aus der Arbeitsfassung entfernt; frühere Stände behalten sie.`,
    );
  const marked = Object.values(plan.entries).filter((e) => e.changed).length;
  if (marked > 0)
    out.push(`Die Markierung «geändert» wird bei ${String(marked)} Einträgen zurückgesetzt.`);
  if (after !== null) {
    for (const [id, e] of Object.entries(plan.entries)) {
      if (e.type !== 'beso' || e.besoNumber !== null) continue;
      const n = (after.entries[id] as Beso | undefined)?.besoNumber ?? null;
      if (n !== null)
        out.push(`Nr ${String(n)} neu vergeben: ${e.title.map((r) => r.text).join('')}`);
    }
  }
  out.push(
    'Jede Woche und der ganze Plan werden als PDF gespeichert und lassen sich jederzeit unverändert ausgeben.',
  );
  return out;
}

/**
 * Nächste freie Version: über dem geltenden Stand und über jedem früheren sichtbaren Stand, auch nach dem
 * Wiederherstellen eines Punkts «vor Stand V‹n›» (F-UX1; R-5.5-03, F-47).
 */
export function nextFreeVersion(plan: Plan, stands: readonly StandSummary[]): number {
  return Math.max(plan.stand?.version ?? 0, ...stands.map((s) => s.version)) + 1;
}

/** Dialog «Neuen Stand setzen» (UI-Richtlinie 10, Ansicht 08): Datum, Version, Folgen, frühere Stände. */
export function StandDialog({
  plan,
  stands,
  openErrors,
  ctx,
  onClose,
  onConfirm,
}: {
  readonly plan: Plan;
  readonly stands: readonly StandSummary[];
  readonly openErrors: number;
  readonly ctx: CommandContext;
  readonly onClose: () => void;
  readonly onConfirm: (input: StandInput) => void;
}) {
  const [date, setDate] = useState(() => formatDate(todayIso(), 'long'));
  const nextVersion = nextFreeVersion(plan, stands);
  const [version, setVersion] = useState(String(nextVersion));
  const [error, setError] = useState('');
  const dateInput = useRef<HTMLInputElement>(null);
  const errorId = useId();
  useEffect(() => {
    dateInput.current?.focus();
    dateInput.current?.select();
  }, []);
  const parsed = parseDateInput(date, 'Datum');
  const input: StandInput | null = parsed.ok
    ? { date: parsed.value, version: Number(version) }
    : null;
  const list = input === null ? [] : consequences(plan, input, ctx);
  return (
    <Modal
      title="Neuen Stand setzen"
      onClose={onClose}
      description={
        plan.stand === null
          ? 'Noch kein Stand gesetzt. Der Stand friert die Fassung ein; alle Wochen-PDF tragen dasselbe Datum.'
          : `Geltender Stand: ${standText(plan.stand)}. Der neue Stand friert die aktuelle Fassung ein.`
      }
    >
      <form
        className="wap-i2-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsed.ok) {
            setError(parsed.message);
            dateInput.current?.focus();
            return;
          }
          const v = Number(version);
          if (!Number.isInteger(v) || v < nextVersion) {
            setError(
              `Die Version muss eine ganze Zahl ab ${String(nextVersion)} sein. Version ${String(nextVersion)} oder höher eingeben.`,
            );
            return;
          }
          onConfirm({ date: parsed.value, version: v });
        }}
      >
        <label>
          Datum
          <input
            ref={dateInput}
            value={date}
            placeholder="dd.mm.yyyy"
            aria-invalid={error !== '' && !parsed.ok}
            aria-describedby={error === '' ? undefined : errorId}
            onChange={(event) => {
              setDate(event.target.value);
              setError('');
            }}
          />
        </label>
        <label>
          Version
          <input
            type="number"
            min={nextVersion}
            value={version}
            onChange={(event) => {
              setVersion(event.target.value);
              setError('');
            }}
          />
        </label>
        <section aria-labelledby="wap-stand-folgen">
          <h3 id="wap-stand-folgen" className="wap-flow-subhead">
            Folgen
          </h3>
          <ul className="wap-flow-list" aria-label="Folgen des Stands">
            {list.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        {openErrors > 0 && (
          <p className="wap-flow-callout is-warning">
            {String(openErrors)} {openErrors === 1 ? 'offener Fehler' : 'offene Fehler'}: Das PDF
            des Stands enthält {openErrors === 1 ? 'ihn' : 'sie'}. Vorher die Befundliste prüfen
            (Ctrl+.) oder den Stand trotzdem setzen.
          </p>
        )}
        {stands.length > 0 && (
          <section aria-labelledby="wap-stand-frueher">
            <h3 id="wap-stand-frueher" className="wap-flow-subhead">
              Frühere Stände
            </h3>
            <ul className="wap-flow-list" aria-label="Frühere Stände">
              {stands.map((s) => (
                <li key={s.recordId}>{standText(s)} (im PDF-Export als Fassung wählbar)</li>
              ))}
            </ul>
          </section>
        )}
        {error !== '' && (
          <p role="alert" id={errorId} className="wap-i2-field-error">
            {error}
          </p>
        )}
        <div className="wap-flow-buttons">
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary">
            Stand setzen
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Befunde der betroffenen Woche(n) vor dem Export der Arbeitsfassung (Beschrieb 7; R-7-04, R-7-05): offene als
 * Liste, quittierte eingeklappt; offene Fehler verlangen die Bestätigung (Hinweis als Alarm).
 */
function ExportFindings({
  findings,
  weekIds,
  where,
}: {
  readonly findings: readonly Finding[];
  readonly weekIds: readonly Id[];
  readonly where: string;
}) {
  const { list, hasErrors } = findingsForExport(findings, weekIds);
  const open = list.filter((f) => !f.acknowledged);
  const acked = list.filter((f) => f.acknowledged);
  const errors = open.filter((f) => f.severity === 'error').length;
  return (
    <section aria-labelledby="wap-pdf-befunde" className="wap-pdf-findings">
      <h3 id="wap-pdf-befunde" className="wap-flow-subhead">
        Befunde in {where}
      </h3>
      {open.length === 0 ? (
        <p>Keine offenen Befunde.</p>
      ) : (
        <ul className="wap-flow-list" aria-label={`Offene Befunde in ${where}`}>
          {open.map((f) => (
            <li key={f.key}>
              <SeveritySymbol severity={f.severity} /> <strong>{f.rule}</strong> {f.title} {f.place}
              : {f.message.cause}
            </li>
          ))}
        </ul>
      )}
      {acked.length > 0 && (
        <details>
          <summary>Quittiert ({acked.length})</summary>
          <ul className="wap-flow-list" aria-label="Quittierte Befunde">
            {acked.map((f) => (
              <li key={f.key}>
                <strong>{f.rule}</strong> {f.title} {f.place}
              </li>
            ))}
          </ul>
        </details>
      )}
      {hasErrors && (
        <p role="alert" className="wap-flow-callout is-danger">
          {String(errors)} Fehler in {where}: Das PDF würde Regelverstösse enthalten. Abbrechen und
          die Befunde beheben oder trotzdem exportieren.
        </p>
      )}
    </section>
  );
}

/**
 * Dialog «PDF dieser Woche» (Knopf, Ctrl+P, Befehlspalette; TE-I5-01 entschieden «6: ja»): zeigt vor dem Export
 * der Arbeitsfassung die Befunde der Woche. Offene Fehler verlangen «Trotzdem exportieren» mit Anfangsfokus auf
 * «Abbrechen»; sonst hat «Exportieren» den Fokus und Enter startet den Export (Beschrieb 7; R-7-04, R-7-05).
 */
export function WeekPdfDialog({
  plan,
  weekId,
  findings,
  showStatus,
  onClose,
  onExport,
}: {
  readonly plan: Plan;
  readonly weekId: Id;
  readonly findings: readonly Finding[];
  /** Einstellung «Status rot darstellen» der Werkzeugleiste. */
  readonly showStatus: boolean;
  readonly onClose: () => void;
  readonly onExport: () => void;
}) {
  const safe = useRef<HTMLButtonElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const week = plan.weeks.find((w) => w.id === weekId);
  const where = week === undefined ? 'dieser Woche' : weekLabel(week.shortName);
  const needsConfirm = findingsForExport(findings, [weekId]).hasErrors;
  useEffect(() => {
    (needsConfirm ? safe : primary).current?.focus();
    // Nur beim Öffnen und bei Wechsel der Bestätigungspflicht (UI-Richtlinie 10 «Anfangsfokus»).
  }, [needsConfirm]);
  return (
    <Modal
      title="PDF dieser Woche"
      onClose={onClose}
      description={`${where} als PDF der Arbeitsfassung (A4${showStatus ? ', Status rot' : ''}). Für A3, den ganzen Plan oder einen früheren Stand «PDF …» wählen.`}
    >
      <div className="wap-i2-form wap-pdf-dialog">
        <ExportFindings findings={findings} weekIds={[weekId]} where={where} />
        <div className="wap-flow-buttons">
          <button ref={safe} type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            ref={primary}
            type="button"
            className={`btn${needsConfirm ? ' btn-danger' : ' btn-primary'}`}
            onClick={onExport}
          >
            {needsConfirm ? 'Trotzdem exportieren' : 'Exportieren'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Auftrag des PDF-Exports. */
export type PdfRequest =
  | {
      readonly kind: 'working';
      readonly target: PdfTarget;
      readonly paper: 'A4' | 'A3';
      readonly showStatus: boolean;
      readonly markChanges: boolean;
    }
  | { readonly kind: 'stand'; readonly standId: string; readonly target: PdfTarget };

/**
 * Dialog «PDF-Export» (UI-Richtlinie 10, Ansichten 09, 09b): Umfang, Fassung, Optionen, Befunde der betroffenen
 * Woche(n), Dateiname, Vorschau. Offene Fehler verlangen «Trotzdem exportieren» (R-7-05); Anfangsfokus dann auf
 * «Abbrechen». Ein gespeicherter Stand wird unverändert ausgegeben, ohne Befundliste (F-9, G-12 a).
 */
export function PdfExportDialog({
  plan,
  weekId,
  stands,
  findings,
  changedSinceStand,
  previewOptions,
  onClose,
  onExport,
}: {
  readonly plan: Plan;
  readonly weekId: Id;
  readonly stands: readonly StandSummary[];
  readonly findings: readonly Finding[];
  /** Einträge seit dem letzten Stand neu oder geändert, entfernte; null ohne Stand. */
  readonly changedSinceStand: { readonly changed: readonly Id[]; readonly removed: number } | null;
  readonly previewOptions: PageOptions;
  readonly onClose: () => void;
  readonly onExport: (request: PdfRequest) => void;
}) {
  const [scope, setScope] = useState<'week' | 'plan'>('week');
  const [version, setVersion] = useState<string>('working');
  const [showStatus, setShowStatus] = useState(true);
  const [paper, setPaper] = useState<'A4' | 'A3'>('A4');
  const [markChanges, setMarkChanges] = useState(false);
  const [preview, setPreview] = useState(false);
  const safe = useRef<HTMLButtonElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const week = plan.weeks.find((w) => w.id === weekId);
  const stand = stands.find((s) => s.standId === version) ?? null;
  const working = stand === null;
  const target: PdfTarget = scope === 'week' ? { kind: 'week', weekId } : { kind: 'plan' };
  const weekIds = scope === 'week' ? [weekId] : plan.weeks.map((w) => w.id);
  // Ein gespeicherter Stand wird ohne Befundliste und ohne Bestätigung ausgegeben (R-7-04, R-7-05 Auslegung).
  const needsConfirm = working && findingsForExport(findings, weekIds).hasErrors;
  useEffect(() => {
    (needsConfirm ? safe : primary).current?.focus();
    // Nur beim Öffnen und bei Wechsel der Bestätigungspflicht (UI-Richtlinie 10 «Anfangsfokus»).
  }, [needsConfirm]);
  const changed =
    changedSinceStand === null ? 0 : changedSinceStand.changed.length + changedSinceStand.removed;
  const fileName = (() => {
    try {
      return pdfFileName(namingPlan(plan), target, 1);
    } catch {
      return '';
    }
  })();
  const where =
    scope === 'week'
      ? week === undefined
        ? 'dieser Woche'
        : weekLabel(week.shortName)
      : 'dem ganzen Plan';
  const exportNow = () =>
    onExport(
      working
        ? { kind: 'working', target, paper, showStatus, markChanges: markChanges && changed > 0 }
        : { kind: 'stand', standId: stand.standId, target },
    );
  const options: PageOptions = useMemo(
    () => ({
      ...previewOptions,
      paper: 'A4',
      showStatus,
      ...(markChanges && changedSinceStand !== null
        ? { changedEntryIds: changedSinceStand.changed }
        : {}),
    }),
    [previewOptions, showStatus, markChanges, changedSinceStand],
  );
  return (
    <Modal title="PDF-Export" onClose={onClose}>
      <div className="wap-i2-form wap-pdf-dialog">
        <fieldset className="wap-flow-choice">
          <legend>Umfang</legend>
          <label>
            <input
              type="radio"
              name="wap-pdf-scope"
              checked={scope === 'week'}
              onChange={() => setScope('week')}
            />
            Diese Woche{week === undefined ? '' : ` (${weekLabel(week.shortName)})`}
          </label>
          <label>
            <input
              type="radio"
              name="wap-pdf-scope"
              checked={scope === 'plan'}
              onChange={() => setScope('plan')}
            />
            Ganzer Plan
          </label>
        </fieldset>
        <fieldset className="wap-flow-choice">
          <legend>Fassung</legend>
          <label>
            <input
              type="radio"
              name="wap-pdf-version"
              checked={working}
              onChange={() => setVersion('working')}
            />
            Arbeitsfassung
          </label>
          {stands.map((s) => (
            <label key={s.recordId}>
              <input
                type="radio"
                name="wap-pdf-version"
                checked={version === s.standId}
                onChange={() => setVersion(s.standId)}
              />
              {standText(s)}
            </label>
          ))}
        </fieldset>
        <fieldset className="wap-flow-choice">
          <legend>Optionen</legend>
          <label>
            <input
              type="checkbox"
              checked={working ? showStatus : true}
              disabled={!working}
              aria-describedby={working ? undefined : hintId}
              onChange={(event) => setShowStatus(event.target.checked)}
            />
            Status rot darstellen
          </label>
          <label>
            <input
              type="checkbox"
              checked={working ? paper === 'A3' : false}
              disabled={!working}
              aria-describedby={working ? undefined : hintId}
              onChange={(event) => setPaper(event.target.checked ? 'A3' : 'A4')}
            />
            A3
          </label>
          <label>
            <input
              type="checkbox"
              checked={working && markChanges}
              disabled={!working || changedSinceStand === null}
              onChange={(event) => setMarkChanges(event.target.checked)}
            />
            Änderungen markieren (seit{' '}
            {plan.stand === null ? 'dem letzten Stand' : standText(plan.stand)})
          </label>
          {!working && (
            <p id={hintId} className="wap-flow-hint">
              Für frühere Stände gibt es nur die gespeicherte Fassung (A4, Status rot). Für A3 oder
              ohne rote Status-Darstellung «Arbeitsfassung» wählen.
            </p>
          )}
        </fieldset>
        {working && plan.stand === null && (
          <p className="wap-flow-callout is-info">
            Noch kein Stand gesetzt. Das PDF ist eine Arbeitsfassung; der Dateiname endet auf
            «_Entwurf» und enthält kein Datum. Für eine gültige Fassung zuerst den Stand setzen.
          </p>
        )}
        {working && plan.stand !== null && changed > 0 && (
          <p className="wap-flow-callout is-info">
            Seit {`Stand V${String(plan.stand.version)}`} wurden {String(changed)}{' '}
            {changed === 1 ? 'Eintrag' : 'Einträge'} geändert. Das PDF trägt trotzdem «Stand{' '}
            {formatDate(plan.stand.date, 'long')}». Für eine neue gültige Fassung zuerst den Stand
            setzen.
          </p>
        )}
        {stand !== null && (
          <p className="wap-flow-callout is-info">
            Die gespeicherte Fassung vom {formatDate(stand.date, 'long')} wird unverändert
            ausgegeben.
            {changed > 0 &&
              ` Die ${String(changed)} Änderungen seit dem Stand sind nicht enthalten.`}
          </p>
        )}
        {working && <ExportFindings findings={findings} weekIds={weekIds} where={where} />}
        <p className="wap-flow-hint">
          Dateiname:{' '}
          <span className="wap-flow-file">
            {stand === null ? fileName : 'wie beim Setzen des Stands'}
          </span>
        </p>
        {preview && week !== undefined && (
          <section className="wap-pdf-preview" aria-label={`Vorschau ${weekLabel(week.shortName)}`}>
            <WeekPageView plan={plan} weekId={week.id} options={options} scale={0.62} />
          </section>
        )}
        <div className="wap-flow-buttons">
          <button
            type="button"
            className="btn"
            onClick={() => setPreview((v) => !v)}
            aria-pressed={preview}
          >
            Vorschau
          </button>
          <button ref={safe} type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            ref={primary}
            type="button"
            className={`btn${needsConfirm ? ' btn-danger' : ' btn-primary'}`}
            onClick={exportNow}
          >
            {needsConfirm ? 'Trotzdem exportieren' : 'Exportieren'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Modaler Fortschritt (`flows.BlockingProgress`, UI-Richtlinie 11.2, Ansicht 08b): sperrt die Route (modaler
 * Dialog, Rest inert); «Abbrechen» bis zum Schreiben, danach deaktiviert mit Begründung; Esc wie «Abbrechen».
 */
export function BlockingProgress({
  title,
  step,
  writing,
  writingNote,
  onAbort,
}: {
  readonly title: string;
  readonly step: string;
  readonly writing: boolean;
  readonly writingNote: string;
  readonly onAbort: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const abort = useRef<HTMLButtonElement>(null);
  const heading = useId();
  const note = useId();
  // Der Fortschritt schliesst nie durch Esc oder den Browser (H-UI2, SA-H-19; UI-Richtlinie 11.2): Esc wirkt vor dem
  // Schreiben wie «Abbrechen», danach gar nicht.
  const state = useRef({ writing, onAbort });
  state.current = { writing, onAbort };
  const { closing } = useDialogGuard(dialog, {
    locked: true,
    onEscape: () => {
      if (!state.current.writing) state.current.onAbort();
    },
  });
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    closing.current = false;
    node?.showModal();
    abort.current?.focus();
    return () => {
      closing.current = true;
      node?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [closing]);
  useEffect(() => {
    if (writing) dialog.current?.focus();
  }, [writing]);
  return (
    <dialog
      ref={dialog}
      className="wap-i2-dialog wap-progress"
      aria-labelledby={heading}
      aria-describedby={note}
      tabIndex={-1}
      onCancel={(event) => event.preventDefault()}
    >
      <div className="wap-i2-dialog-body">
        <h2 id={heading}>{title}</h2>
        <p role="status" aria-live="polite">
          {step}
        </p>
        <progress aria-label={title} />
        <p id={note} className="wap-flow-hint" aria-live="polite">
          {writing
            ? writingNote
            : 'Die Bearbeitung ist bis zum Ende gesperrt. «Abbrechen» schreibt nichts.'}
        </p>
        <div className="wap-flow-buttons">
          <button
            ref={abort}
            type="button"
            className="btn"
            disabled={writing}
            aria-describedby={note}
            onClick={onAbort}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </dialog>
  );
}
