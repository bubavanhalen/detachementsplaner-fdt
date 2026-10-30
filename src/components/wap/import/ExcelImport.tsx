// «Excel-WAP importieren» mit Fortschritt und Importbericht (I4; Beschrieb 5.7, 8.2 Regel 8, 9; Vertrag
// E1-08 §1, §1a; UI-Richtlinie 9). Die Datei wird nur lokal gelesen, nie übertragen.

import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import type {
  ImportProgress,
  ImportReport,
  ImportReportItem,
  ImportReportKind,
} from '../../../io/wap-import/index';
import { formatDate } from '../../../model/wap/calendar';
import { entryTitle } from '../../../model/wap/checks/entryFacts';
import { type UserMessage, WapError } from '../../../model/wap/errors';
import { formatMilTime } from '../../../model/wap/time';
import type { Id, Plan } from '../../../model/wap/types';
import { I2Dialog as Modal } from '../i2/I2Dialog';
import type { ExcelImportEngine } from './engine';
import './import.css';

export interface ExcelImportSession {
  importExcel(
    engine: ExcelImportEngine,
    bytes: Uint8Array,
    fileName: string,
    run: {
      readonly onProgress?: (p: ImportProgress) => void;
      readonly signal?: AbortSignal;
      readonly onWriting?: () => void;
    },
  ): Promise<ImportReport>;
}

const STEP_TEXT: Readonly<Record<ImportProgress['step'], string>> = {
  read: 'Datei wird gelesen …',
  import: 'Formen werden zugeordnet …',
  render: 'PDF des ersten Stands werden erzeugt …',
  write: 'Plan wird gespeichert …',
};

function messageOf(error: unknown): UserMessage {
  return error instanceof WapError
    ? error.userMessage
    : {
        cause: 'Der Import konnte nicht abgeschlossen werden.',
        nextStep: 'Die Datei prüfen und den Import erneut starten.',
      };
}

/**
 * Dateiauswahl, Fortschritt und «Abbrechen» bis zum Schreiben des Excel-Imports, ohne eigenen Knopf (H-UI2, UX-H-03):
 * Den Import starten der Knopf «Excel-WAP importieren» der Kopfleiste, das Planmenü, die Befehlspalette und der
 * Erststart über `inputRef`. Bleibt immer eingehängt, auch wenn der Knopf ins Planmenü ausweicht.
 */
export function ExcelImportControl({
  session,
  engine,
  disabled,
  inputRef,
  onBusy,
  onDone,
  onError,
}: {
  session: ExcelImportSession;
  engine: ExcelImportEngine;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Import läuft (Knöpfe gesperrt). */
  onBusy: (busy: boolean) => void;
  onDone: (report: ImportReport) => void;
  onError?: (message: UserMessage) => void;
}) {
  const input = inputRef;
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [writing, setWriting] = useState(false);
  const [failure, setFailure] = useState<UserMessage | null>(null);
  const abort = useRef<AbortController | null>(null);
  const start = async (file: File) => {
    const controller = new AbortController();
    abort.current = controller;
    setWriting(false);
    setFailure(null);
    setProgress({ step: 'read', done: 0, total: 1 });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const report = await session.importExcel(engine, bytes, file.name, {
        onProgress: setProgress,
        signal: controller.signal,
        onWriting: () => setWriting(true),
      });
      setProgress(null);
      onDone(report);
    } catch (error) {
      setProgress(null);
      const m = messageOf(error);
      if (onError) onError(m);
      else setFailure(m);
    } finally {
      abort.current = null;
    }
  };
  const percent =
    progress === null
      ? 0
      : progress.step === 'read'
        ? 5
        : progress.step === 'import'
          ? 20
          : progress.step === 'render'
            ? 20 + Math.round((70 * progress.done) / Math.max(1, progress.total))
            : 95;
  const busy = progress !== null;
  useEffect(() => {
    onBusy(busy);
  }, [busy, onBusy]);
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        aria-label="Excel-WAP importieren"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={disabled || progress !== null}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void start(file);
        }}
      />
      {progress !== null && (
        <Modal
          title="Excel-WAP wird importiert"
          dismissible={false}
          onClose={() => {}}
          description="Die Datei wird nur auf diesem Gerät gelesen; die Originaldatei bleibt unverändert."
        >
          <p role="status" aria-live="polite">
            {STEP_TEXT[progress.step]}
          </p>
          <progress
            className="wap-import-progress"
            aria-label="Fortschritt des Imports"
            max={100}
            value={percent}
          />
          <div className="wap-import-actions">
            <button
              type="button"
              className="btn"
              disabled={writing}
              title={writing ? 'Der Plan wird bereits gespeichert.' : undefined}
              onClick={() => abort.current?.abort()}
            >
              Abbrechen
            </button>
          </div>
        </Modal>
      )}
      {failure !== null && (
        <Modal title="Import nicht möglich" onClose={() => setFailure(null)}>
          <div role="alert">
            <p>
              <strong>{failure.cause}</strong>
            </p>
            <p>{failure.nextStep}</p>
          </div>
          <div className="wap-import-actions">
            <button type="button" className="btn btn-primary" onClick={() => setFailure(null)}>
              OK
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Importbericht (Beschrieb 8.2 Regel 8, 11; R-8.2-20, R-8.2-21; Vertrag E1-08 §1a)

const KIND_LABEL: Readonly<Record<ImportReportKind, string>> = {
  hidden: 'Verdeckte Formen (nicht übernommen)',
  unassignedShape: 'Nicht zugeordnete Formen',
  partlyHidden: 'Teilweise verdeckte Formen',
  notVisible: 'Nicht sichtbarer Text (nicht übernommen)',
  overlappingShapes: 'Sich überlagernde Formen',
  besoInRapColumn: 'Kästchen in der Rap-Spalte',
  besoInPlanningColumn: 'Kästchen in Planungsspalten',
  rapportTwice: 'Rapporte in Rap- und Planungsspalte',
  numberOrder: 'Nummern nicht nach Sortierzeit',
  boxTimeDeviation: 'Kästchen mehr als 15 Min neben dem Termintext',
  numberedWithoutTime: 'Nummerierte Termine ohne Zeit',
  boxWithoutText: 'Kästchen ohne Termintext',
  textWithoutBox: 'Termintexte ohne Kästchen',
  edgeOffGrid: 'Kanten neben der 15-Min-Linie',
  edgeOffGridGrouped: 'Kanten neben der 15-Min-Linie',
  unclearColor: 'Unklare Farben',
  uncertainParse: 'Unsichere Zerlegungen',
  secondaryColumnCreated: 'Nebenspalte angelegt',
  truncatedToPlanning: 'Auf Planungsspalten gekürzt',
  gapColumnMerged: 'Zwischenspalten zugeschlagen',
  partlyCancelled: 'Gestrichene Textteile',
  cancelled: 'Gestrichene Einträge',
  changed: 'Geänderte Einträge (rot)',
  missingGlyph: 'Ersetzte Zeichen',
  missingHeader: 'Fehlende Kopfangaben',
};

const KIND_ORDER: readonly ImportReportKind[] = [
  'missingHeader',
  'hidden',
  'unassignedShape',
  'partlyHidden',
  'notVisible',
  'overlappingShapes',
  'boxTimeDeviation',
  'besoInRapColumn',
  'besoInPlanningColumn',
  'rapportTwice',
  'numberOrder',
  'numberedWithoutTime',
  'boxWithoutText',
  'textWithoutBox',
  'edgeOffGrid',
  'unclearColor',
  'uncertainParse',
  'secondaryColumnCreated',
  'truncatedToPlanning',
  'gapColumnMerged',
  'cancelled',
  'partlyCancelled',
  'changed',
  'missingGlyph',
];

function groupKind(kind: ImportReportKind): ImportReportKind {
  return kind === 'edgeOffGridGrouped' ? 'edgeOffGrid' : kind;
}

/**
 * Stelle einer Kantengruppe (UX-AB-F-10): Block, Zeit und die Kante neben der 15-Min-Linie. Gespeichert sind nur die
 * betroffenen Blöcke; die Kante ergibt sich aus der übernommenen Zeit (auf 5 Min gerundet, also neben der Linie).
 * Liegt sie nach dem Runden wieder auf der Linie (2 Min daneben), steht «Kante auf die Linie gerundet».
 */
function edgeMember(plan: Plan, id: Id): { readonly at: number; readonly text: string } {
  const e = plan.entries[id];
  if (e?.type !== 'block' || e.time.form !== 'range') return { at: 0, text: 'Block' };
  const { from, to } = e.time;
  const edges = [
    from % 15 !== 0 ? `Beginn ${formatMilTime(from)}` : '',
    to % 15 !== 0 ? `Ende ${formatMilTime(to)}` : '',
  ].filter((x) => x !== '');
  const title = entryTitle(plan, e);
  return {
    at: from,
    text: `«${title === '' ? 'Ohne Titel' : title}» ${formatMilTime(from)}-${formatMilTime(to)} · ${
      edges.length === 0 ? 'Kante auf die Linie gerundet' : edges.join(', ')
    }`,
  };
}

function itemTitle(item: ImportReportItem): string {
  return item.date === null ? item.sheet : `${item.sheet} · ${formatDate(item.date, 'long')}`;
}

export function ImportReportDialog({
  report,
  plan,
  onClose,
  onJump,
  seen = new Set<string>(),
  focusItem = null,
}: {
  report: ImportReport;
  plan: Plan;
  onClose: () => void;
  /**
   * Sprung zur Stelle (H-UI2, UX-H-10; UI-Richtlinie 9 «Bedienung wie Befundliste»): `stay` bei Maus und Leertaste –
   * der Bericht bleibt offen, der Eintrag wird gewählt; Enter springt mit Fokus auf den Eintrag.
   */
  onJump: (
    weekId: Id,
    entryIds: readonly Id[],
    itemId: string,
    stay: boolean,
    item?: ImportReportItem,
  ) => void;
  /** Angesprungene Meldungen («angesehen», nur Anzeige für die Nacharbeit). */
  seen?: ReadonlySet<string>;
  /** Meldung, deren «Zur Stelle» beim Öffnen den Fokus erhält (die nächste nach dem letzten Sprung). */
  focusItem?: string | null;
}) {
  const headingBase = useId();
  const titleId = useId();
  const descriptionId = useId();
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const lastKey = useRef<string | null>(null);
  // Beim Öffnen (auch nach dem Wochenwechsel eines Sprungs): Fokus auf der gewünschten Meldung, sonst auf dem Titel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur beim Öffnen
  useEffect(() => {
    // Neu gezeichnet nach einem Wochenwechsel aus der Liste: der Fokus bleibt in der Liste (Bearbeiten wie Excel;
    // UX-AB-F-01). Sonst die gewünschte Meldung bzw. der Titel.
    if (document.activeElement?.closest('.wap-list') != null) return;
    // Wochenwechsel aus der offenen Liste, Fokus für einen Augenblick nirgends (Raster neu gezeichnet): die Liste
    // behält ihn, der Bericht nimmt ihn nicht (UX-AB-G-12).
    const active = document.activeElement;
    if (
      (active === null || active === document.body) &&
      document.querySelector('.wap-list') !== null
    )
      return;
    const target =
      focusItem === null
        ? null
        : body.current?.querySelector<HTMLButtonElement>(`[data-report-item="${focusItem}"]`);
    (target ?? heading.current)?.focus({ preventScroll: false });
  }, []);
  const jump = (item: ImportReportItem, ids: readonly Id[], via: { readonly detail: number }) => {
    if (item.weekId === null) return;
    const key = lastKey.current;
    lastKey.current = null;
    onJump(item.weekId, ids, item.id, via.detail > 0 || key === ' ', item);
  };
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: report.items.filter((i) => groupKind(i.kind) === kind),
  })).filter((g) => g.items.length > 0);
  const weekName = (id: Id | null) => plan.weeks.find((w) => w.id === id)?.shortName ?? '–';
  const canJump = (item: ImportReportItem) =>
    item.weekId !== null && plan.weeks.some((w) => w.id === item.weekId);
  return (
    // Angedockt im Seitenbereich neben dem Raster (UI-Richtlinie 2.2 «Tabs … Importbericht», 9; H-UI2 UX-H-10,
    // TE-HUI2-02): nicht modal, verdeckt das Raster nie; Esc schliesst.
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="wap-import-docked"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="wap-import-docked-head">
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          Importbericht «{report.fileName}»
        </h2>
        <button type="button" className="btn" aria-label="Dialog schliessen" onClick={onClose}>
          Schliessen
        </button>
      </header>
      <p id={descriptionId} className="wap-import-docked-note">
        Jede Form der Datei ist gezählt: gelesen = zugeordnet + nicht zugeordnet. «Zur Stelle»
        (Klick, Leertaste) zeigt den Eintrag im Raster, der Bericht bleibt offen; Enter springt mit
        dem Fokus zum Eintrag.
      </p>
      <div className="wap-import-report" ref={body}>
        <table className="wap-import-balance">
          <caption>Formen je Blatt</caption>
          <thead>
            <tr>
              <th scope="col">Blatt</th>
              <th scope="col">Woche</th>
              <th scope="col">Gelesen</th>
              <th scope="col">Zugeordnet</th>
              <th scope="col">Nicht zugeordnet</th>
            </tr>
          </thead>
          <tbody>
            {report.sheets.map((s) => (
              <tr key={s.sheet}>
                <th scope="row">{s.sheet}</th>
                <td>{weekName(s.weekId)}</td>
                <td>{s.shapesRead}</td>
                <td>{s.assigned}</td>
                <td>{s.unassigned}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {groups.length === 0 && <p>Keine Meldungen: alle Formen wurden eindeutig übernommen.</p>}
        {groups.map((g, gi) => (
          <section key={g.kind} aria-labelledby={`${headingBase}-${gi}`}>
            <h3 id={`${headingBase}-${gi}`}>
              {KIND_LABEL[g.kind]} ({g.items.length})
            </h3>
            <ul className="wap-import-items">
              {g.items.map((item) => (
                <li key={item.id}>
                  <div>
                    <span className="wap-import-where">{itemTitle(item)}</span>{' '}
                    <span>{item.message.cause}</span>{' '}
                    <span className="wap-import-next">{item.message.nextStep}</span>
                  </div>
                  {item.notTakenText !== undefined && item.notTakenText.length > 0 && (
                    <ul className="wap-import-lost" aria-label="Nicht übernommener Text">
                      {item.notTakenText.map((t, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Zeilen können gleich lauten; Reihenfolge fest
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  )}
                  {item.group !== null ? (
                    <details>
                      <summary>Betroffene Blöcke ({item.group.members.length})</summary>
                      <ul>
                        {item.group.members
                          .map((id) => ({ id, ...edgeMember(plan, id) }))
                          .sort((a, b) => a.at - b.at)
                          .map(({ id, text }, i) => (
                            <li key={id}>
                              <button
                                type="button"
                                className="btn"
                                disabled={!canJump(item)}
                                onKeyDown={(event) => {
                                  lastKey.current = event.key;
                                }}
                                onClick={(event) => jump(item, [id], event)}
                              >
                                {`Zur Stelle ${String(i + 1)}: ${text}`}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </details>
                  ) : (
                    <span className="wap-import-jump">
                      <button
                        type="button"
                        className="btn"
                        disabled={!canJump(item)}
                        data-report-item={item.id}
                        aria-label={`Zur Stelle: ${KIND_LABEL[g.kind]}, ${itemTitle(item)}${seen.has(item.id) ? ', angesehen' : ''}`}
                        onKeyDown={(event) => {
                          lastKey.current = event.key;
                        }}
                        onClick={(event) =>
                          jump(
                            item,
                            item.target.entryId === null ? [] : [item.target.entryId],
                            event,
                          )
                        }
                      >
                        Zur Stelle
                      </button>
                      {seen.has(item.id) && <span className="wap-import-seen">✓ angesehen</span>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
