// Abläufe I5 im App-Rahmen (E1-16; Beschrieb 5.5, 5.6, 7, 10): Prüflauf bei jeder Änderung, Befundzähler und
// -liste, «Neuen Stand setzen» mit modalem Fortschritt, PDF-Export mit Befunden, Wiederherstellungspunkte,
// Speicherhinweise. Liefert Bausteine, die I2Application an ihre Stelle setzt. F-UX1: «PDF dieser Woche» und Ctrl+P
// öffnen zuerst den Dialog mit den Befunden der Woche (TE-I5-01); der Stand bietet kein «Rückgängig» («Stand: ja»).

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StandRenderers, StandSummary } from '../../../io/wap-plan/standStore';
import type { PersistenceStatus, RestorePointInfo } from '../../../io/wap-plan/store';
import { formatDate } from '../../../model/wap/calendar';
import {
  acknowledgeFinding,
  createCheckRunner,
  type Finding,
  unacknowledgeFinding,
} from '../../../model/wap/checks';
import { WapError } from '../../../model/wap/errors';
import { layoutWeekPage } from '../../../model/wap/layout/page/compose';
import type { StandInput } from '../../../model/wap/stand/stand';
import { builtInTemplates } from '../../../model/wap/template';
import type { Id, Plan } from '../../../model/wap/types';
import type { FindingMark, GridToast } from '../i2/GridEditor';
import type { BarItem } from '../i2/OverflowBar';
import type { I2Session } from '../i2/usePlan';
import { FindingsCounter, FindingsPanel, findingMarks } from './findings';
import { RestorePointsDialog, StorageBanner } from './Safety';
import {
  BlockingProgress,
  PdfExportDialog,
  type PdfRequest,
  StandDialog,
  standText,
  WeekPdfDialog,
} from './StandAndPdf';
import {
  changesSince,
  defaultStandRenderers,
  localStamp,
  restoreReasonText,
  standPageOptions,
  todayIso,
  withProgress,
} from './support';

const CTX = { templates: builtInTemplates() };

interface Progress {
  readonly step: string;
  readonly writing: boolean;
}

export interface FlowsInput {
  readonly session: I2Session;
  readonly plan: Plan | null;
  readonly weekId: Id;
  readonly editDisabled: boolean;
  readonly onWeek: (weekId: Id) => void;
  readonly requestFocus: (ids: readonly Id[]) => void;
  readonly showToast: (toast: GridToast) => void;
  /** Renderer des Stand-PDF; Standard: PDF-Ausgabe A4, Status rot (Testharness verzögert sie). */
  readonly standRenderers?: StandRenderers;
  /** Export «PDF dieser Woche» der Arbeitsfassung; läuft erst nach dem Dialog mit den Befunden (TE-I5-01). */
  readonly exportWeekPdf: () => void;
  /** Einstellung «Status rot darstellen» für «PDF dieser Woche». */
  readonly showStatus: boolean;
}

export interface Flows {
  readonly findings: readonly Finding[];
  readonly marks: ReadonlyMap<Id, FindingMark>;
  /** Zähler, Stand-Anzeige, «Neuen Stand setzen …», «PDF …» für die Werkzeugleiste (H-UI2: mit Überlauf). */
  readonly toolbarItems: readonly BarItem[];
  /** «Wiederherstellungspunkte …» für die Kopfleiste (weicht ins Planmenü aus). */
  readonly headerItems: readonly BarItem[];
  /** Dialog «Wiederherstellungspunkte» (auch über die Speicheranzeige, UI-Richtlinie 11.3). */
  readonly openRestore: () => void;
  /** Dialog «Neuen Stand setzen». */
  readonly openStand: () => void;
  /** Befundliste ein/aus, nächster bzw. vorheriger Befund (Befehlspalette). */
  readonly nextFinding: (back: boolean) => void;
  readonly storage: PersistenceStatus | null;
  readonly banners: ReactNode;
  readonly aside: ReactNode;
  readonly dialogs: ReactNode;
  /** Ein Ablauf sperrt die Bearbeitung (modaler Fortschritt). */
  readonly blocking: boolean;
  readonly openPdf: () => void;
  /** «PDF dieser Woche» (Knopf, Ctrl+P, Befehlspalette): Dialog mit den Befunden der Woche (Beschrieb 7). */
  readonly openWeekPdf: () => void;
  readonly toggleFindings: () => void;
}

export function useFlows(input: FlowsInput): Flows {
  const { session, plan, weekId, editDisabled, onWeek, requestFocus, showToast } = input;
  const [panel, setPanel] = useState(false);
  const [standDialog, setStandDialog] = useState<readonly StandSummary[] | null>(null);
  const [pdfDialog, setPdfDialog] = useState<{
    stands: readonly StandSummary[];
    changes: { changed: readonly Id[]; removed: number } | null;
  } | null>(null);
  const [restoreDialog, setRestoreDialog] = useState(false);
  const [weekPdf, setWeekPdf] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [storage, setStorage] = useState<PersistenceStatus | null>(null);
  const abort = useRef<AbortController | null>(null);
  const cursor = useRef(-1);

  // Prüfungen bei jeder Änderung (R-7-01): je Woche zwischengespeichert, nur geänderte Wochen neu (R-11-14).
  const runner = useRef(createCheckRunner());
  const options = useMemo(() => standPageOptions(), []);
  const findings = useMemo(
    () =>
      plan === null
        ? []
        : runner.current({ plan, layoutFor: (id) => layoutWeekPage(plan, id, options) }),
    [plan, options],
  );
  const marks = useMemo(() => findingMarks(findings), [findings]);
  const openErrors = findings.filter((f) => f.severity === 'error' && !f.acknowledged).length;

  // Speicherzustand beim Öffnen eines Plans (Beschrieb 5.6 Pkt 4; UI-Richtlinie 11.4).
  const planId = plan?.id ?? null;
  useEffect(() => {
    if (planId === null) return;
    let current = true;
    void session.persistence().then((s) => {
      if (current) setStorage(s);
    });
    return () => {
      current = false;
    };
  }, [session, planId]);

  /** Zuletzt angesprungene Meldung der Befundliste (Ctrl+. geht von dort zur nächsten; UX-3-03). */
  const lastJump = useRef<string | null>(null);
  const jump = useCallback(
    (f: Finding) => {
      lastJump.current = f.key;
      if (f.weekId !== weekId) onWeek(f.weekId);
      requestFocus(f.entryId === null ? [] : [f.entryId]);
    },
    [weekId, onWeek, requestFocus],
  );

  const toggleFindings = useCallback(() => setPanel((v) => !v), []);
  const nextFinding = useCallback(
    (back: boolean) => {
      const open = findings.filter((f) => !f.acknowledged);
      if (open.length === 0) return;
      cursor.current = (cursor.current + (back ? -1 : 1) + open.length) % open.length;
      const f = open[cursor.current];
      if (f !== undefined) jump(f);
    },
    [findings, jump],
  );

  // Ctrl+. öffnet die Befundliste, F8 / Shift+F8 springen zum nächsten bzw. vorherigen Befund (UI-Richtlinie 8.1).
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && !event.altKey && event.key === '.') {
        event.preventDefault();
        // Liste offen, Fokus ausserhalb (z.B. nach «Zur Stelle»): zur nächsten offenen Meldung statt schliessen;
        // geschlossen wird mit Esc in der Liste oder Ctrl+. in der Liste (UX-3-03).
        const list = document.querySelector<HTMLElement>('.wap-findings');
        if (list !== null && !list.contains(document.activeElement)) {
          const jumps = [...list.querySelectorAll<HTMLElement>('[data-finding-jump]')];
          if (jumps.length > 0) {
            const at = jumps.findIndex((b) => b.dataset.findingKey === lastJump.current);
            (jumps[at < 0 ? 0 : (at + 1) % jumps.length] as HTMLElement).focus();
            return;
          }
        }
        setPanel((v) => !v);
        return;
      }
      if (event.key !== 'F8' || ctrl || event.altKey) return;
      if (findings.every((f) => f.acknowledged)) return;
      event.preventDefault();
      nextFinding(event.shiftKey);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [findings, nextFinding]);

  const acknowledge = (f: Finding, reason: string) => {
    void session
      .command((p, ctx) => acknowledgeFinding(p, f, reason, todayIso(), ctx))
      .then(() =>
        showToast({ text: `Befund ${f.rule} «${f.title}» quittiert`, undo: 'Quittieren' }),
      )
      .catch(() => {
        /* Die Sitzung zeigt den Fehler. */
      });
  };
  const unacknowledge = (f: Finding) => {
    void session
      .command((p, ctx) => unacknowledgeFinding(p, f, ctx))
      .then(() => showToast({ text: `Quittierung von ${f.rule} aufgehoben`, undo: 'Aufheben' }))
      .catch(() => {
        /* Die Sitzung zeigt den Fehler. */
      });
  };

  const openStand = useCallback(() => {
    void session.stands().then((list) => setStandDialog(list));
  }, [session]);

  const runStand = (standInput: StandInput) => {
    setStandDialog(null);
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ step: 'Plan wird gelesen (Schritt 1 von 3)', writing: false });
    const renderers = withProgress(input.standRenderers ?? defaultStandRenderers(), (_, label) => {
      if (!controller.signal.aborted)
        setProgress({ step: `${label} (Schritt 2 von 3)`, writing: false });
    });
    session
      .setStand(standInput, renderers, {
        signal: controller.signal,
        onWriting: () =>
          setProgress({ step: 'Stand wird gespeichert (Schritt 3 von 3)', writing: true }),
      })
      .then((result) => {
        if (abort.current === controller) abort.current = null;
        setProgress(null);
        // Ohne «Rückgängig»: ein gesetzter Stand ist eine Grenze der Undo-Historie (ADR-006, F-UX1).
        if (result !== null) showToast({ text: `${standText(result)} gesetzt` });
        requestFocus([]);
      })
      .catch((error: unknown) => {
        if (abort.current === controller) abort.current = null;
        setProgress(null);
        if (error instanceof WapError && error.code === 'aborted')
          showToast({ text: 'Stand nicht gesetzt: abgebrochen.' });
      });
  };
  const abortStand = () => {
    const c = abort.current;
    if (c === null) return;
    abort.current = null;
    c.abort();
    // Der Dialog schliesst ohne Warten auf den Renderer (UI-Richtlinie 11.2).
    setProgress(null);
    showToast({ text: 'Stand nicht gesetzt: abgebrochen.' });
  };

  const openPdf = useCallback(() => {
    void Promise.all([session.stands(), session.lastStandPlan()]).then(([stands, last]) => {
      const current = session.state.pending?.plan ?? session.state.loaded?.plan ?? null;
      setPdfDialog({
        stands,
        changes: last === null || current === null ? null : changesSince(current, last),
      });
    });
  }, [session]);

  // Nie über einem anderen Dialog (z.B. Ctrl+P im Dialog «Neuen Stand setzen»).
  const openWeekPdf = useCallback(() => {
    if (document.querySelector('dialog[open]')) return;
    setWeekPdf(true);
  }, []);

  const exportPdf = (request: PdfRequest) => {
    const changes = pdfDialog?.changes ?? null;
    setPdfDialog(null);
    showToast({ text: 'PDF wird erstellt …' });
    const done = (name: string | null) => {
      if (name !== null) showToast({ text: `PDF «${name}» erstellt` });
    };
    const fail = () => {
      /* Die Sitzung zeigt den Fehler. */
    };
    if (request.kind === 'stand') {
      void session.standPdf(request.standId, request.target).then(done, fail);
      return;
    }
    void session
      .exportPdf({
        target: request.target,
        paper: request.paper,
        showStatus: request.showStatus,
        ...(request.markChanges && changes !== null ? { changedEntryIds: changes.changed } : {}),
      })
      .then(done, fail);
  };

  const restore = (p: RestorePointInfo) => {
    setRestoreDialog(false);
    void session
      .restore(p.id)
      .then(() => {
        showToast({
          text: `Wiederherstellungspunkt «${restoreReasonText(p)}» vom ${localStamp(p.at)} wiederhergestellt`,
          undo: 'Wiederherstellen',
        });
        requestFocus([]);
      })
      .catch(() => {
        /* Die Sitzung zeigt den Fehler. */
      });
  };

  const stand = plan?.stand ?? null;
  const standLabel =
    stand === null
      ? 'Noch kein Stand'
      : `Stand ${formatDate(stand.date, 'long')} · V${String(stand.version)}`;
  const openRestore = useCallback(() => setRestoreDialog(true), []);
  // Werkzeugleiste (UI-Richtlinie 2.2): Zähler und «PDF …» fest, Stand-Anzeige und «Neuen Stand setzen …» weichen bei
  // Platzmangel ins Menü «Mehr …» aus (H-UI2, UX-H-03).
  const toolbarItems: readonly BarItem[] =
    plan === null
      ? []
      : [
          {
            id: 'befunde',
            node: <FindingsCounter findings={findings} open={panel} onToggle={toggleFindings} />,
          },
          {
            id: 'stand',
            priority: 92,
            node: (
              <>
                <span className="wap-i2-stand" title="Geltender Stand des Plans">
                  {standLabel}
                </span>
                <button
                  type="button"
                  className="btn"
                  aria-haspopup="dialog"
                  aria-label="Neuen Stand setzen …"
                  disabled={editDisabled}
                  title={`Datum und Version für den ganzen Plan setzen; friert die Fassung ein (${standLabel})`}
                  onClick={openStand}
                >
                  Stand setzen …
                </button>
              </>
            ),
            menu: [
              {
                label: `Neuen Stand setzen … (${standLabel})`,
                disabled: editDisabled,
                run: openStand,
              },
            ],
          },
          {
            id: 'pdf',
            node: (
              <button
                type="button"
                className="btn btn-primary"
                aria-haspopup="dialog"
                title="PDF-Export: Woche oder ganzer Plan, Fassung, A3, Status, Änderungen, Befunde"
                onClick={openPdf}
              >
                PDF …
              </button>
            ),
          },
        ];
  const headerItems: readonly BarItem[] =
    plan === null
      ? []
      : [
          {
            id: 'wiederherstellung',
            priority: 30,
            node: (
              <button
                type="button"
                className="btn"
                aria-haspopup="dialog"
                title="Automatische Sicherungen dieses Plans; Wiederherstellen ist rückgängig machbar"
                onClick={openRestore}
              >
                Wiederherstellungspunkte …
              </button>
            ),
          },
        ];
  const banners =
    plan === null ? null : <StorageBanner status={storage} onMore={() => setRestoreDialog(true)} />;
  const aside =
    plan === null || !panel ? null : (
      <FindingsPanel
        plan={plan}
        findings={findings}
        weekId={weekId}
        readOnly={editDisabled}
        onJump={jump}
        onAcknowledge={acknowledge}
        onUnacknowledge={unacknowledge}
        onClose={() => {
          setPanel(false);
          requestFocus([]);
        }}
      />
    );
  const dialogs = (
    <>
      {standDialog !== null && plan !== null && (
        <StandDialog
          plan={plan}
          stands={standDialog}
          openErrors={openErrors}
          ctx={CTX}
          onClose={() => setStandDialog(null)}
          onConfirm={runStand}
        />
      )}
      {progress !== null && (
        <BlockingProgress
          title="Stand wird gesetzt …"
          step={progress.step}
          writing={progress.writing}
          writingNote="Das Speichern hat begonnen: «Abbrechen» ist nicht mehr möglich, der Stand wird vollständig gesetzt."
          onAbort={abortStand}
        />
      )}
      {pdfDialog !== null && plan !== null && weekId !== '' && (
        <PdfExportDialog
          plan={plan}
          weekId={weekId}
          stands={pdfDialog.stands}
          findings={findings}
          changedSinceStand={pdfDialog.changes}
          previewOptions={options}
          onClose={() => setPdfDialog(null)}
          onExport={exportPdf}
        />
      )}
      {weekPdf && plan !== null && weekId !== '' && (
        <WeekPdfDialog
          plan={plan}
          weekId={weekId}
          findings={findings}
          showStatus={input.showStatus}
          onClose={() => setWeekPdf(false)}
          onExport={() => {
            setWeekPdf(false);
            input.exportWeekPdf();
          }}
        />
      )}
      {restoreDialog && plan !== null && (
        <RestorePointsDialog
          load={session.restorePoints}
          readOnly={editDisabled}
          persistence={storage}
          onRestore={restore}
          onClose={() => setRestoreDialog(false)}
        />
      )}
    </>
  );
  return {
    findings,
    marks,
    toolbarItems,
    headerItems,
    openRestore,
    openStand,
    nextFinding,
    storage,
    banners,
    aside,
    dialogs,
    blocking: progress !== null,
    openPdf,
    openWeekPdf,
    toggleFindings,
  };
}
