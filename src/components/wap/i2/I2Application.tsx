import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ImportReport } from '../../../io/wap-import/index';
import type { PlanFile } from '../../../io/wap-plan/planFile';
import type { StandRenderers } from '../../../io/wap-plan/standStore';
import { daysBetween, formatDate, isoWeek } from '../../../model/wap/calendar';
import { WapError } from '../../../model/wap/errors';
import type { HistoryStep } from '../../../model/wap/history/history';
import { builtInTemplates } from '../../../model/wap/template';
import { formatMilTime } from '../../../model/wap/time';
import type { Id, Plan } from '../../../model/wap/types';
import { FirstRun, ImportUnavailableDialog } from '../flows/Safety';
import { useFlows } from '../flows/useFlows';
import { ExcelImportControl, ImportReportDialog } from '../import/ExcelImport';
import type { ExcelImportEngine } from '../import/engine';
import { focusListFilter, ListView } from '../list/ListView';
import { ensureScreenFont } from '../render/screenFont';
import { PlanSettings } from '../settings/PlanSettings';
import {
  fileSaveAge,
  localDate,
  needsSaveReminder,
  type SaveState,
  saveIsStale,
} from './fileNames';
import {
  type CursorMemory,
  type FocusRequest,
  type GhostPlace,
  type GridToast,
  I2GridEditor,
} from './GridEditor';
import type { MenuItem } from './GridMenu';
import { I2Dialog as Modal } from './I2Dialog';
import { ownsRouteKey, type RouteKeys } from './keyboard';
import { type BarItem, MoreMenu, OverflowBar } from './OverflowBar';
import { entryDate } from './selectionCommands';
import { mondayHint, parseDateInput } from './timeInput';
import { downloadLocal, usePlan } from './usePlan';
import { type WapCommand, WapPalette } from './WapPalette';
import { WeekCommands } from './WeekCommands';
import './app.css';

/** Kennzeichnung der Plan-Datei mit internen Notizen (F-46; R-6-39; H-UI2, SA-H-08). */
const NOTES_HINT = 'enthält interne Notizen – nur zur eigenen Sicherung, nicht weitergeben';

/** Planname in Guillemets, ausser der Anzeigename trägt sie schon (z.B. «Übung»; UX-H-N2). */
function quotedName(name: string): string {
  return name.includes('«') ? name : `«${name}»`;
}

/** Enthält der Plan interne Notizen (Einträge oder Tage)? */
function hasInternalNotes(plan: Plan): boolean {
  return (
    Object.values(plan.entries).some((e) => e.internalNote.trim() !== '') ||
    plan.weeks.some((w) => w.days.some((d) => d.internalNote.trim() !== ''))
  );
}

const WEEK_KEY = 'wap-planer-woche:';

/** Zuletzt offene Woche eines Plans auf diesem Gerät (nur die ID, kein Planinhalt); ohne Speicher null. */
function readWeek(planId: Id): Id | null {
  try {
    return localStorage.getItem(WEEK_KEY + planId);
  } catch {
    return null;
  }
}

function writeWeek(planId: Id, weekId: Id): void {
  try {
    localStorage.setItem(WEEK_KEY + planId, weekId);
  } catch {
    /* Ohne Speicher gilt beim nächsten Öffnen die erste Woche. */
  }
}

const quietly = (promise: Promise<unknown>) => {
  void promise.catch(() => {
    /* Session displays the error. */
  });
};

/** Einträge, die ein Historienschritt hinzufügt, ändert oder entfernt (Fokus nach Rückgängig, B5). */
function affectedEntries(step: HistoryStep | undefined): readonly Id[] {
  if (step === undefined) return [];
  const ids = new Set<Id>();
  for (const p of [...step.patches, ...step.inversePatches]) {
    const [root, id] = p.path;
    if (root === 'entries' && typeof id === 'string') ids.add(id);
  }
  return [...ids];
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function stamp(iso: string): string {
  const at = new Date(iso);
  return `${formatDate(localDate(at), 'long')} ${timeOf(iso)}`;
}

interface Toast extends GridToast {
  readonly key: number;
}

interface Collision {
  readonly file: PlanFile;
  readonly fileName: string;
  readonly localName: string;
  readonly localModifiedAt: string;
  readonly localNewer: boolean;
}

export function I2Application({
  demoPlans,
  standRenderers,
  importEngine,
  routeKeys,
  routeCommands,
  headerTools,
}: {
  demoPlans?: readonly Plan[];
  /** Renderer des Stand-PDF (I5); Standard: PDF-Ausgabe A4, Status rot. Die Testharness verzögert sie. */
  standRenderers?: StandRenderers;
  /** Excel-Import (I4); ohne Werk kein Knopf «Excel-WAP importieren» (Einzeldateien ohne fflate). */
  importEngine?: ExcelImportEngine;
  /**
   * In der Suite: Delegation der globalen Kürzel an die Route (UI-Richtlinie 18 S-3, `setRouteKeyDelegate`). Ohne
   * (eigenständige Einstiege) hört der WAP-Planer selbst auf `window`.
   */
  routeKeys?: (delegate: RouteKeys | null) => void;
  /**
   * In der Suite: Befehle der Route für die Suite-Palette (Ctrl+K, Gruppe «WAP-Planer»; UI-Richtlinie 11.6, 13.1).
   * Ohne (eigenständige Einstiege) öffnet Ctrl+K die Befehlspalette des WAP-Planers.
   */
  routeCommands?: (source: (() => readonly WapCommand[]) | null) => void;
  /** Knöpfe der Suite in der Kopfleiste der Route, z.B. «Darstellung» (UI-Richtlinie 2.1, 18 S-2). */
  headerTools?: ReactNode;
} = {}) {
  const { session, state, plan } = usePlan(demoPlans);
  const [weekId, setWeekId] = useState('');
  const [newPlan, setNewPlan] = useState(false);
  const [collision, setCollision] = useState<Collision | null>(null);
  /** Übersicht «Tastenkürzel – WAP-Planer»; 'speicher' rollt zum Hinweis zum gemeinsamen Speicher (UI-Richtlinie 11.6). */
  const [shortcuts, setShortcuts] = useState<'kuerzel' | 'speicher' | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  /** Rote Status-Darstellung im PDF (Beschrieb 10; R-10-31: pro PDF abschaltbar), Vorgabe an. */
  const [showStatus, setShowStatus] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  /** Historie beim Zeigen der Meldung und ihr eigener Schritt (Cursor/Schritte), sobald er gespeichert ist. */
  const toastStep = useRef<{ readonly base: number; readonly own: string | null } | null>(null);
  const toastCursor = useRef(0);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  /** Angesprungene Meldungen des Importberichts und die nächste (H-UI2, UX-H-10); gelten für die Sitzung. */
  const [reportSeen, setReportSeen] = useState<ReadonlySet<string>>(() => new Set());
  /** Meldung mit dem Fokus beim (Wieder-)Öffnen: die angesprungene (Bericht offen) bzw. die nächste (nach Enter). */
  const [reportNext, setReportNext] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  /** Befehlspalette des WAP-Planers (Ctrl+K ausserhalb der Suite) und Befehle des Rasters (H-UI2, UX-H-08). */
  const [palette, setPalette] = useState(false);
  const gridCommands = useRef<readonly WapCommand[]>([]);
  const [, setFocusSeq] = useState(0);
  const focusRequest = useRef<FocusRequest>({ seq: 0, ids: [], handled: true });
  const cursorMemory = useRef<CursorMemory | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importUnavailable, setImportUnavailable] = useState(false);
  /** Dateiauswahl des Excel-Imports (I4); Kopfleiste, Planmenü, Palette und Erststart rufen sie auf (I5 D4). */
  const importInput = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  // Ohne gewählte Woche: die zuletzt auf diesem Gerät offene Woche des Plans, sonst die erste (H-UI2, ux-critic
  // «nach Neuladen KVK statt letzte Woche»; wie der Zoom pro Plan und Gerät, UI-Richtlinie 4.1).
  const remembered = plan === null ? null : readWeek(plan.id);
  const activeWeekId = plan?.weeks.some((week) => week.id === weekId)
    ? weekId
    : plan?.weeks.some((week) => week.id === remembered)
      ? (remembered ?? '')
      : (plan?.weeks[0]?.id ?? '');
  const planIdForWeek = plan?.id ?? null;
  useEffect(() => {
    if (planIdForWeek !== null && activeWeekId !== '') writeWeek(planIdForWeek, activeWeekId);
  }, [planIdForWeek, activeWeekId]);
  // Speichern läuft im Hintergrund (I2b-A A3): nur Lesemodus und ungespeicherte Änderung sperren.
  const editDisabled = state.readOnly || !!state.pending;
  const history = state.loaded?.history;

  /** Fokus ins Raster: betroffener Eintrag, sonst Zellzeiger (B5: nie auf body). */
  const requestFocus = useCallback((ids: readonly Id[], reveal = false, place?: GhostPlace) => {
    const seq = focusRequest.current.seq + 1;
    focusRequest.current = {
      seq,
      ids,
      handled: false,
      ...(reveal ? { reveal: true } : {}),
      ...(place === undefined ? {} : { place }),
    };
    setFocusSeq(seq);
  }, []);

  const showToast = useCallback((next: GridToast) => {
    window.clearTimeout(toastTimer.current);
    toastStep.current = { base: toastCursor.current, own: null };
    setToast({ ...next, key: Date.now() });
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      next.undo === undefined ? 4500 : 7000,
    );
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  // Meldung mit «Rückgängig» nur, solange ihr Schritt der letzte ist (UX-H-15): Die erste Änderung der Historie nach
  // der Meldung ist ihr eigener Schritt; jede weitere (Rückgängig, Wiederholen, neue Änderung) macht sie veraltet.
  const cursorNow = history?.cursor ?? 0;
  const stepsNow = history?.steps.length ?? 0;
  useEffect(() => {
    toastCursor.current = cursorNow;
    const t = toastStep.current;
    if (t === null) return;
    const mark = `${String(cursorNow)}/${String(stepsNow)}`;
    if (t.own === null) {
      if (cursorNow !== t.base) toastStep.current = { ...t, own: mark };
      return;
    }
    if (mark !== t.own) {
      toastStep.current = null;
      setToast((current) => (current?.undo === undefined ? current : null));
    }
  }, [cursorNow, stepsNow]);

  /** Rückgängig/Wiederholen mit Fokus auf dem betroffenen Eintrag, falls nötig in seiner Woche (UI-Richtlinie 11.5). */
  const stepHistory = useCallback(
    (redo: boolean) => {
      const h = session.state.loaded?.history;
      const step = h === undefined ? undefined : h.steps[redo ? h.cursor : h.cursor - 1];
      const ids = affectedEntries(step);
      const inGrid = document.activeElement?.closest('.i2-grid') !== null;
      quietly(
        session.history(redo).then(() => {
          const after = session.state.loaded?.plan;
          const entry = ids.map((id) => after?.entries[id]).find((e) => e !== undefined);
          const date = entry === undefined ? null : entryDate(entry);
          if (after !== undefined && date !== null) {
            const week = after.weeks.find((w) => {
              const offset = daysBetween(w.startDate, date);
              return offset >= 0 && offset < 7;
            });
            if (week !== undefined) setWeekId(week.id);
          }
          if (inGrid || entry !== undefined || document.activeElement === document.body)
            requestFocus(ids);
        }),
      );
    },
    [session, requestFocus],
  );

  const savePlanFile = useCallback(() => {
    // Die Plan-Datei enthält die internen Notizen (F-46; R-6-39): Kennzeichnung bis zum Export zur Weitergabe.
    const current = session.state.pending?.plan ?? session.state.loaded?.plan ?? null;
    const notes = current !== null && hasInternalNotes(current);
    void session
      .saveFile()
      .then((name) => {
        if (name !== null)
          showToast({
            text: `Plan-Datei «${name}» gesichert${notes ? ` · ${NOTES_HINT}` : ''}`,
          });
      })
      .catch(() => {
        /* Session displays the error. */
      });
  }, [session, showToast]);

  /** Export «PDF dieser Woche»; davor zeigt flows.openWeekPdf die Befunde der Woche (F-UX1, TE-I5-01). */
  const exportPdf = useCallback(() => {
    if (!activeWeekId || pdfBusy) return;
    setPdfBusy(true);
    void session
      .pdf(activeWeekId, showStatus)
      .then((name) => {
        if (name !== null) showToast({ text: `PDF «${name}» erstellt` });
      })
      .catch(() => {
        /* Session displays the error. */
      })
      .finally(() => setPdfBusy(false));
  }, [session, activeWeekId, pdfBusy, showToast, showStatus]);

  // Wochenwechsel baut das Raster neu auf: der Fokus bleibt auf dem Bedienelement, das ihn hatte (B4).
  const weekFocus = useRef<'tab' | 'select' | null>(null);
  const chooseWeek = useCallback((id: Id) => {
    const active = document.activeElement;
    weekFocus.current =
      active instanceof Element && active.closest('[role="tablist"]') !== null
        ? 'tab'
        : active instanceof HTMLSelectElement && active.getAttribute('aria-label') === 'Woche'
          ? 'select'
          : null;
    setWeekId(id);
  }, []);

  // I5: Prüfungen, Befunde, Stand, PDF-Export, Wiederherstellung, Speicherhinweise (Beschrieb 5.5, 5.6, 7, 10).
  const flows = useFlows({
    session,
    plan,
    weekId: activeWeekId,
    editDisabled,
    onWeek: setWeekId,
    requestFocus,
    showToast,
    exportWeekPdf: exportPdf,
    showStatus,
    ...(standRenderers === undefined ? {} : { standRenderers }),
  });
  const openWeekPdf = flows.openWeekPdf;
  useEffect(() => {
    const target = weekFocus.current;
    weekFocus.current = null;
    if (target === 'tab') document.getElementById(`wap-week-tab-${activeWeekId}`)?.focus();
    else if (target === 'select')
      document.querySelector<HTMLSelectElement>('select[aria-label="Woche"]')?.focus();
  }, [activeWeekId]);

  // Route öffnen: Fokus auf dem Raster (UI-Richtlinie 13.4), nur wenn noch nichts den Fokus hat.
  const opened = useRef(false);
  const hasPlan = plan !== null;
  useEffect(() => {
    if (!hasPlan || opened.current) return;
    opened.current = true;
    if (document.activeElement === document.body || document.activeElement === null)
      requestFocus([]);
  }, [hasPlan, requestFocus]);

  const stepWeek = useCallback(
    (direction: 1 | -1) => {
      if (plan === null) return;
      const index = plan.weeks.findIndex((w) => w.id === activeWeekId);
      const next = plan.weeks[index + direction];
      if (next === undefined) return;
      const inGrid = document.activeElement?.closest('.i2-grid') !== null;
      chooseWeek(next.id);
      if (inGrid) requestFocus([]);
    },
    [plan, activeWeekId, requestFocus, chooseWeek],
  );

  useEffect(() => {
    let mounted = true;
    void ensureScreenFont().catch((error: unknown) => {
      if (mounted) session.report(error);
    });
    return () => {
      mounted = false;
    };
  }, [session]);

  // Route-weite Kürzel (B4; UI-Richtlinie 13.2): Ctrl+S, Ctrl+Z/Y, Ctrl+O, Ctrl+P, Alt+Bild↑/↓, «?».
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.matches('input,textarea,select') || target.isContentEditable);
      const ctrl = event.ctrlKey || event.metaKey;
      if (event.altKey && !ctrl && (event.key === 'PageUp' || event.key === 'PageDown')) {
        if (typing) return;
        event.preventDefault();
        stepWeek(event.key === 'PageDown' ? 1 : -1);
        return;
      }
      if (!ctrl && !event.altKey && event.key === '?' && !typing) {
        event.preventDefault();
        setShortcuts('kuerzel');
        return;
      }
      if (!ctrl || event.altKey) return;
      const name = event.key.toLowerCase();
      // Ctrl+K: Befehlspalette des WAP-Planers; in der Suite öffnet die Shell die Suite-Palette mit denselben Befehlen.
      if (name === 'k' && routeKeys === undefined) {
        event.preventDefault();
        setPalette(true);
        return;
      }
      if (name === 'l') {
        event.preventDefault();
        setShowList((v) => !v);
        return;
      }
      if (name === 'f' && document.querySelector('.wap-list') !== null) {
        event.preventDefault();
        focusListFilter();
        return;
      }
      if (name === 's') {
        event.preventDefault();
        savePlanFile();
      } else if (name === 'o') {
        event.preventDefault();
        // Nie still wirkungslos (wie Ctrl+S): Die Dateiauswahl ändert nichts; das Öffnen reiht sich hinter
        // laufendes Speichern ein (I3, wie CS-I2-E2E-FLAKE-01). Die Auswahl öffnet einen Takt später (die
        // Benutzeraktion gilt einige Sekunden), damit sie nicht mit dem Abschluss einer Sicherung zusammenfällt.
        if (state.ready && !state.migration) {
          const input = fileInput.current;
          window.setTimeout(() => input?.click(), 60);
        }
      } else if (name === 'p') {
        event.preventDefault();
        if (activeWeekId && !pdfBusy) openWeekPdf();
      } else if (!typing && (name === 'z' || name === 'y')) {
        event.preventDefault();
        if (!editDisabled) stepHistory(name === 'y' || event.shiftKey);
      }
    };
    if (routeKeys !== undefined) {
      routeKeys({ handles: ownsRouteKey, handle: key });
      return () => routeKeys(null);
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [
    editDisabled,
    stepWeek,
    savePlanFile,
    openWeekPdf,
    activeWeekId,
    pdfBusy,
    stepHistory,
    state,
    routeKeys,
  ]);

  // Importbericht des Plans: gespeichert mit dem Import-Schritt, nach Undo ausgeblendet (AR0-12).
  const planIdForReport = plan?.id ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: «angesehen» gilt je Plan
  useEffect(() => {
    setReportSeen(new Set());
    setReportNext(null);
  }, [planIdForReport]);
  const historyCursor = state.loaded?.history.cursor ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Bericht nach Undo/Redo neu lesen (AR0-12)
  useEffect(() => {
    let current = true;
    if (planIdForReport === null || !state.ready) {
      setImportReport(null);
      return;
    }
    void session
      .importReport(planIdForReport)
      .then((r) => {
        if (current) setImportReport(r);
      })
      .catch(() => {
        if (current) setImportReport(null);
      });
    return () => {
      current = false;
    };
  }, [session, planIdForReport, historyCursor, state.ready]);

  // Erinnerung beim Schliessen nach mehr als einem Arbeitstag ohne Datei-Sicherung (Beschrieb 5.6 Pkt 3).
  const saveState: SaveState | null =
    state.loaded === null
      ? null
      : {
          lastFileSaveAt: state.loaded.lastFileSaveAt,
          modifiedAt: state.loaded.modifiedAt,
          firstChangeAt: state.loaded.history.steps[0]?.at ?? null,
        };
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  useEffect(() => {
    const remind = (event: BeforeUnloadEvent) => {
      const current = saveStateRef.current;
      if (current !== null && needsSaveReminder(current, new Date())) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', remind);
    return () => window.removeEventListener('beforeunload', remind);
  }, []);

  const openChosenFile = (file: File) => {
    quietly(
      session.readFile(file).then(async (parsed) => {
        if (await session.openFile(parsed)) {
          setWeekId('');
          requestFocus([]);
          showToast({ text: `Plan-Datei «${file.name}» geöffnet` });
          return;
        }
        const local = session.state.summaries.find((s) => s.id === parsed.planId);
        const loaded = session.state.loaded;
        const localModifiedAt =
          loaded !== null && loaded.plan.id === parsed.planId
            ? loaded.modifiedAt
            : (local?.modifiedAt ?? parsed.modifiedAt);
        setCollision({
          file: parsed,
          fileName: file.name,
          localName: local?.name ?? 'Plan',
          localModifiedAt,
          localNewer: new Date(localModifiedAt).getTime() > new Date(parsed.modifiedAt).getTime(),
        });
      }),
    );
  };

  const now = new Date();
  const weekLabel = (shortName: string) => shortName.replace(/^Wo(\d)/, 'Wo $1');
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (plan === null) return;
    const step =
      event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'Home'
            ? -index
            : event.key === 'End'
              ? plan.weeks.length - 1 - index
              : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = plan.weeks[index + step];
    if (next === undefined) return;
    chooseWeek(next.id);
  };

  // ---------------------------------------------------------------------------------------------
  // Kopf- und Werkzeugleiste mit Überlauf, Planmenü und Befehlspalette (H-UI2: UX-H-03, UX-H-08, SA-H-11)
  // ---------------------------------------------------------------------------------------------

  const planHasNotes = useMemo(() => plan !== null && hasInternalNotes(plan), [plan]);
  const fileActionsDisabled = !state.ready || state.busy || !!state.pending || !!state.migration;
  const local = typeof location !== 'undefined' && location.protocol === 'file:';
  const openFile = useCallback(() => {
    if (!state.ready || state.migration) return;
    fileInput.current?.click();
  }, [state.ready, state.migration]);
  const openImport = useCallback(() => {
    if (importEngine === undefined) setImportUnavailable(true);
    else importInput.current?.click();
  }, [importEngine]);
  const openStorageHint = useCallback(() => setShortcuts('speicher'), []);
  const stale = saveState !== null && saveIsStale(saveState, now);
  const notPersisted = flows.storage !== null && !flows.storage.persisted;
  const undoLabel = history?.steps[(history?.cursor ?? 0) - 1]?.label;
  const redoLabel = history?.steps[history?.cursor ?? 0]?.label;
  const canUndo = !editDisabled && !!history?.cursor;
  const canRedo = !editDisabled && !!history && history.cursor < history.steps.length;

  /** Planmenü (UI-Richtlinie 2.2): alle Plan-Befehle, auch die, die in der Kopfleiste ausweichen. */
  const planMenu: MenuItem[] = [
    ...(plan === null
      ? []
      : [
          { label: 'Plan-Einstellungen …', run: () => setSettings(true) },
          { label: 'Plan-Datei sichern (Ctrl+S)', run: savePlanFile },
        ]),
    { label: 'Plan-Datei öffnen … (Ctrl+O)', disabled: fileActionsDisabled, run: openFile },
    ...(importEngine === undefined
      ? []
      : [
          {
            label: 'Excel-WAP importieren …',
            disabled: fileActionsDisabled || importBusy,
            run: openImport,
          },
        ]),
    ...(importReport !== null && plan !== null
      ? [{ label: 'Importbericht anzeigen', run: () => setShowReport(true) }]
      : []),
    ...(plan === null ? [] : [{ label: 'Wiederherstellungspunkte …', run: flows.openRestore }]),
    {
      label: 'Neuer Plan aus Vorlage …',
      disabled: fileActionsDisabled,
      run: () => setNewPlan(true),
      separatorBefore: true,
    },
    { label: 'Tastenkürzel (?)', run: () => setShortcuts('kuerzel'), separatorBefore: true },
    ...(local ? [{ label: 'Hinweis zum gemeinsamen Speicher', run: openStorageHint }] : []),
    ...(routeKeys === undefined
      ? [{ label: 'Befehle suchen … (Ctrl+K)', run: () => setPalette(true) }]
      : []),
  ];
  const planMenuButton = useRef<HTMLButtonElement>(null);

  const saveInfo = plan !== null && (
    <span className="wap-i2-save-info">
      <span role="status" aria-label="Speicher" className="wap-i2-save">
        {state.pending
          ? 'Nicht gespeichert'
          : state.busy
            ? 'Speichern …'
            : `Gespeichert${state.loaded ? ` ${timeOf(state.loaded.modifiedAt)}` : ''}`}
      </span>
      {state.loaded && (
        // Speicheranzeige (UI-Richtlinie 11.3, 11.4): bedienbar, öffnet Wiederherstellungspunkte, Dauerhaftigkeit und
        // Belegung; der Warnpunkt «Speicher nicht dauerhaft» gehört zu ihrem Namen.
        <button
          type="button"
          className={`wap-i2-file-age${stale ? ' is-stale' : ''}`}
          aria-haspopup="dialog"
          aria-label={`Speicheranzeige: letzte Datei-Sicherung ${fileSaveAge(state.loaded.lastFileSaveAt, now)}${notPersisted ? ', Speicher nicht dauerhaft' : ''}. Wiederherstellungspunkte und Speicher anzeigen`}
          title={`${
            state.loaded.lastFileSaveAt === null
              ? 'Noch keine Plan-Datei gesichert'
              : `Letzte Datei-Sicherung ${stamp(state.loaded.lastFileSaveAt)}`
          }${notPersisted ? ' · Speicher nicht dauerhaft' : ''} · Wiederherstellungspunkte und Speicher anzeigen`}
          onClick={flows.openRestore}
        >
          {notPersisted && (
            <span className="wap-i2-warnpoint" aria-hidden="true">
              ▲
            </span>
          )}
          {stale ? '▲ ' : '· '}
          letzte Datei-Sicherung {fileSaveAge(state.loaded.lastFileSaveAt, now)}
        </button>
      )}
    </span>
  );

  const headerItems: BarItem[] = [
    {
      id: 'titel',
      node: (
        <h1 title="Wochen planen. Änderungen werden sofort auf diesem Gerät gespeichert.">
          WAP-Planer
        </h1>
      ),
    },
  ];
  if (demoPlans)
    headerItems.push({
      id: 'demoplan',
      node: (
        <label title="Demoplan: «Realistisch» oder «Belastungstest»">
          <span className="wap-i2-sr">Demoplan</span>
          <select
            aria-label="Demoplan"
            value={Math.max(
              0,
              demoPlans.findIndex((demo) => demo.id === plan?.id),
            )}
            disabled={state.busy || !!state.pending}
            onChange={(event) => {
              const demo = demoPlans[Number(event.target.value)];
              if (demo) {
                setWeekId('');
                quietly(session.select(demo.id));
              }
            }}
          >
            <option value="0">Realistisch</option>
            <option value="1">Belastungstest</option>
          </select>
        </label>
      ),
    });
  if (state.summaries.length > 0)
    headerItems.push({
      id: 'plan',
      node: (
        <label title="Plan wählen">
          <span className="wap-i2-sr">Plan</span>
          <select
            aria-label="Plan"
            className="wap-i2-plan-select"
            value={plan?.id ?? ''}
            disabled={state.busy || !!state.pending}
            onChange={(event) => {
              setWeekId('');
              quietly(session.select(event.target.value));
            }}
          >
            {state.summaries.map((summary) => (
              <option key={summary.id} value={summary.id}>
                {summary.name}
                {summary.copyCreatedAt ? ' (Kopie)' : ''}
              </option>
            ))}
          </select>
        </label>
      ),
    });
  headerItems.push(
    {
      id: 'planmenue',
      node: (
        <MoreMenu
          label="Planmenü"
          text="Planmenü"
          title="Alle Befehle zum Plan: Einstellungen, Datei, Import, Wiederherstellung, neuer Plan"
          items={planMenu}
          buttonRef={planMenuButton}
          hidden={false}
        />
      ),
    },
    {
      id: 'neu',
      priority: 60,
      node: (
        <button
          type="button"
          className="btn"
          aria-label="Neuer Plan aus Vorlage"
          title="Neuer Plan aus Vorlage …"
          disabled={fileActionsDisabled}
          onClick={() => setNewPlan(true)}
        >
          Neuer Plan
        </button>
      ),
    },
    {
      id: 'oeffnen',
      priority: 80,
      node: (
        <button
          type="button"
          className="btn"
          aria-label="Plan-Datei öffnen"
          title="Plan-Datei öffnen (Ctrl+O)"
          disabled={fileActionsDisabled}
          onClick={openFile}
        >
          Öffnen
        </button>
      ),
    },
  );
  if (importEngine !== undefined)
    headerItems.push({
      id: 'import',
      priority: 50,
      node: (
        <button
          type="button"
          className="btn"
          aria-label="Excel-WAP importieren"
          title="Excel-WAP importieren: eine Arbeitsmappe des WAP (.xlsx) von diesem Gerät lesen"
          disabled={fileActionsDisabled || importBusy}
          onClick={openImport}
        >
          Importieren
        </button>
      ),
    });
  if (importReport !== null && plan !== null)
    headerItems.push({
      id: 'bericht',
      priority: 40,
      node: (
        <button
          type="button"
          className="btn"
          aria-haspopup="dialog"
          title="Bericht des letzten Excel-Imports dieses Plans"
          onClick={() => setShowReport(true)}
        >
          Importbericht
        </button>
      ),
    });
  if (plan !== null)
    headerItems.push({
      id: 'einstellungen',
      priority: 45,
      node: (
        <button
          type="button"
          className="btn"
          aria-haspopup="dialog"
          aria-label="Plan-Einstellungen …"
          title="Plan-Einstellungen: Einheit, Kommandant, Legende, Funktions- und Personenliste, Spaltensätze, Kürzelliste"
          onClick={() => setSettings(true)}
        >
          Einstellungen …
        </button>
      ),
    });
  headerItems.push(...flows.headerItems);
  if (plan !== null) {
    headerItems.push({ id: 'speicher', node: saveInfo });
    if (flows.banners !== null) headerItems.push({ id: 'speicherhinweis', node: flows.banners });
  }
  headerItems.push(
    {
      id: 'sichern',
      node: (
        <button
          type="button"
          className={`btn${stale ? ' btn-primary' : ''}`}
          aria-label="Plan-Datei sichern"
          title={`Plan-Datei sichern (Ctrl+S)${planHasNotes ? ` · ${NOTES_HINT}` : ''}`}
          // Nie still wirkungslos: die Sicherung reiht sich hinter laufendes Speichern ein (CS-I2-E2E-FLAKE-01).
          disabled={!plan}
          onClick={savePlanFile}
        >
          Datei sichern
        </button>
      ),
    },
    {
      id: 'kuerzel',
      node: (
        <button
          type="button"
          className="btn wap-i2-icon"
          aria-haspopup="dialog"
          aria-label="Tastenkürzel"
          title="Tastenkürzel (?)"
          onClick={() => setShortcuts('kuerzel')}
        >
          <span aria-hidden="true">⌨</span>
        </button>
      ),
    },
  );
  if (headerTools !== undefined) headerItems.push({ id: 'darstellung', node: headerTools });
  if (demoPlans)
    headerItems.push({
      id: 'demohinweis',
      node: (
        <span className="wap-i2-demo-note" title="Demo: fiktive bzw. pseudonymisierte Daten">
          Demo<span className="wap-i2-sr">: fiktive bzw. pseudonymisierte Daten</span>
        </span>
      ),
    });

  // Werkzeugleiste: Wochen, Rückgängig/Wiederholen fest; die übrigen weichen nach Priorität ins Menü «Mehr …» aus.
  const toolbarItems: BarItem[] =
    plan === null
      ? []
      : [
          {
            id: 'wochen',
            node: (
              <div className="wap-i2-weeks" role="tablist" aria-label="Wochen">
                {plan.weeks.map((week, index) => (
                  <button
                    key={week.id}
                    id={`wap-week-tab-${week.id}`}
                    type="button"
                    role="tab"
                    aria-selected={week.id === activeWeekId}
                    tabIndex={week.id === activeWeekId ? 0 : -1}
                    title={`${week.label} · ${formatDate(week.startDate, 'long')} · Alt+Bild↑/↓`}
                    onClick={() => chooseWeek(week.id)}
                    onKeyDown={(event) => tabKey(event, index)}
                  >
                    {weekLabel(week.shortName)}
                  </button>
                ))}
              </div>
            ),
          },
          {
            id: 'woche',
            node: (
              <label className="wap-i2-week-select">
                <span className="wap-i2-sr">Woche</span>
                <select
                  aria-label="Woche"
                  title="Woche wählen"
                  value={activeWeekId}
                  onChange={(event) => chooseWeek(event.target.value)}
                >
                  {plan.weeks.map((week) => (
                    <option
                      key={week.id}
                      value={week.id}
                      title={formatDate(week.startDate, 'long')}
                    >
                      {weekLabel(week.shortName)} KW {isoWeek(week.startDate)}
                    </option>
                  ))}
                </select>
              </label>
            ),
          },
          {
            id: 'wochenbefehle',
            node: (
              <WeekCommands
                plan={plan}
                weekId={activeWeekId}
                disabled={editDisabled}
                run={session.command}
                onWeek={chooseWeek}
                onToast={showToast}
              />
            ),
          },
          {
            id: 'rueckgaengig',
            node: (
              <button
                type="button"
                className="btn wap-i2-icon"
                aria-label="Rückgängig"
                disabled={!canUndo}
                title={
                  undoLabel !== undefined
                    ? `Rückgängig: ${undoLabel} (Ctrl+Z)`
                    : plan?.stand != null && !editDisabled
                      ? // Grauer Knopf an der Grenze «Stand» nennt Grund und Weg (UX-2-09).
                        'Rückgängig (Ctrl+Z): nicht möglich, ein gesetzter Stand lässt sich nicht rückgängig machen. Die Fassung davor holt «Wiederherstellungspunkte …» (Punkt «vor Stand») zurück.'
                      : 'Rückgängig (Ctrl+Z)'
                }
                onClick={() => stepHistory(false)}
              >
                <span aria-hidden="true">↶</span>
              </button>
            ),
          },
          {
            id: 'wiederholen',
            node: (
              <button
                type="button"
                className="btn wap-i2-icon"
                aria-label="Wiederholen"
                disabled={!canRedo}
                title={
                  redoLabel === undefined
                    ? 'Wiederholen (Ctrl+Y)'
                    : `Wiederholen: ${redoLabel} (Ctrl+Y)`
                }
                onClick={() => stepHistory(true)}
              >
                <span aria-hidden="true">↷</span>
              </button>
            ),
          },
          ...flows.toolbarItems,
          {
            id: 'pdf-woche',
            priority: 86,
            node: (
              <button
                type="button"
                className="btn"
                title="PDF dieser Woche (Ctrl+P)"
                disabled={pdfBusy || !activeWeekId}
                onClick={openWeekPdf}
              >
                PDF dieser Woche
              </button>
            ),
            menu: [
              {
                label: 'PDF dieser Woche (Ctrl+P)',
                disabled: pdfBusy || !activeWeekId,
                run: openWeekPdf,
              },
            ],
          },
          {
            id: 'liste',
            priority: 84,
            node: (
              <button
                type="button"
                className="btn"
                aria-pressed={showList}
                title="Listenansicht ein- oder ausblenden (Ctrl+L)"
                onClick={() => setShowList((v) => !v)}
              >
                Liste
              </button>
            ),
            menu: [
              { label: 'Liste (Ctrl+L)', checked: showList, run: () => setShowList((v) => !v) },
            ],
          },
          {
            id: 'status-rot',
            priority: 5,
            node: (
              <label
                className="wap-i2-check"
                title="Rote Status-Darstellung (offen, gestrichen) im PDF"
              >
                <input
                  type="checkbox"
                  checked={showStatus}
                  onChange={(event) => setShowStatus(event.target.checked)}
                />
                Status rot darstellen
              </label>
            ),
            menu: [
              {
                label: 'Status rot darstellen (PDF)',
                checked: showStatus,
                run: () => setShowStatus((v) => !v),
              },
            ],
          },
        ];

  // Befehlspalette (Ctrl+K): alle Befehle der Route, auch die des Rasters (UI-Richtlinie 1 Leitsatz 4, 13.1).
  const appCommands = (): WapCommand[] => {
    const list: WapCommand[] = [];
    const add = (c: WapCommand) => list.push(c);
    if (plan !== null) {
      add({ id: 'sichern', label: 'Plan-Datei sichern', hint: 'Ctrl+S', run: savePlanFile });
      add({ id: 'einstellungen', label: 'Plan-Einstellungen …', run: () => setSettings(true) });
    }
    add({
      id: 'oeffnen',
      label: 'Plan-Datei öffnen …',
      hint: 'Ctrl+O',
      disabled: fileActionsDisabled,
      run: openFile,
    });
    add({
      id: 'neu',
      label: 'Neuer Plan aus Vorlage …',
      disabled: fileActionsDisabled,
      run: () => setNewPlan(true),
    });
    if (importEngine !== undefined)
      add({
        id: 'import',
        label: 'Excel-WAP importieren …',
        keywords: 'xlsx excel',
        disabled: fileActionsDisabled || importBusy,
        run: openImport,
      });
    if (plan !== null) {
      if (importReport !== null)
        add({ id: 'bericht', label: 'Importbericht anzeigen', run: () => setShowReport(true) });
      add({
        id: 'wiederherstellung',
        label: 'Wiederherstellungspunkte …',
        keywords: 'speicher sicherung',
        run: flows.openRestore,
      });
      add({
        id: 'stand',
        label: 'Neuen Stand setzen …',
        keywords: 'version fassung',
        disabled: editDisabled,
        run: flows.openStand,
      });
      add({ id: 'pdf', label: 'PDF-Export …', keywords: 'drucken a3', run: flows.openPdf });
      add({
        id: 'pdf-woche',
        label: 'PDF dieser Woche',
        hint: 'Ctrl+P',
        // Ohne aktive Woche nicht anbieten (CR-U-2-10), wie der Knopf.
        disabled: pdfBusy || !activeWeekId,
        run: openWeekPdf,
      });
      add({
        id: 'status-rot',
        label: showStatus ? 'Status rot darstellen: aus' : 'Status rot darstellen: ein',
        keywords: 'pdf',
        run: () => setShowStatus((v) => !v),
      });
      add({
        id: 'liste',
        label: showList ? 'Liste ausblenden' : 'Liste einblenden',
        hint: 'Ctrl+L',
        run: () => setShowList((v) => !v),
      });
      add({
        id: 'befunde',
        label: 'Befundliste ein/aus',
        hint: 'Ctrl+.',
        run: flows.toggleFindings,
      });
      add({
        id: 'befund-weiter',
        label: 'Nächster Befund',
        hint: 'F8',
        run: () => flows.nextFinding(false),
      });
      add({
        id: 'befund-zurueck',
        label: 'Vorheriger Befund',
        hint: 'Shift+F8',
        run: () => flows.nextFinding(true),
      });
      add({
        id: 'rueckgaengig',
        label: undoLabel === undefined ? 'Rückgängig' : `Rückgängig: ${undoLabel}`,
        hint: 'Ctrl+Z',
        disabled: !canUndo,
        run: () => stepHistory(false),
      });
      add({
        id: 'wiederholen',
        label: redoLabel === undefined ? 'Wiederholen' : `Wiederholen: ${redoLabel}`,
        hint: 'Ctrl+Y',
        disabled: !canRedo,
        run: () => stepHistory(true),
      });
      add({ id: 'woche-vor', label: 'Vorige Woche', hint: 'Alt+Bild↑', run: () => stepWeek(-1) });
      add({ id: 'woche-nach', label: 'Nächste Woche', hint: 'Alt+Bild↓', run: () => stepWeek(1) });
      for (const week of plan.weeks)
        add({
          id: `woche-${week.id}`,
          label: `Woche öffnen: ${weekLabel(week.shortName)} KW ${isoWeek(week.startDate)}`,
          keywords: week.label,
          run: () => chooseWeek(week.id),
        });
    }
    add({
      id: 'kuerzel',
      label: 'Tastenkürzel anzeigen',
      hint: '?',
      run: () => setShortcuts('kuerzel'),
    });
    if (local)
      add({
        id: 'speicherhinweis',
        label: 'Hinweis zum gemeinsamen Speicher',
        keywords: 'browserspeicher file lokal',
        run: openStorageHint,
      });
    return list;
  };
  const allCommands = (): readonly WapCommand[] => [
    ...appCommands(),
    ...(plan === null ? [] : gridCommands.current),
  ];
  const commandSource = useRef(allCommands);
  commandSource.current = allCommands;
  // In der Suite: Befehle der Route für die Suite-Palette (Gruppe «WAP-Planer»), solange die Route offen ist.
  useEffect(() => {
    if (routeCommands === undefined) return;
    routeCommands(() => commandSource.current());
    return () => routeCommands(null);
  }, [routeCommands]);

  return (
    <section className="wap-i2" aria-label="WAP-Planer">
      {state.error && (
        <div role="alert" className="wap-i2-error">
          <strong>{state.error.cause}</strong>
          <p>{state.error.nextStep}</p>
        </div>
      )}
      {state.readOnlyReason && <p className="wap-i2-warning">{state.readOnlyReason}</p>}
      <header className="wap-i2-header">
        <OverflowBar className="wap-i2-toolbar" moreLabel={null} items={headerItems} />
      </header>
      {importEngine !== undefined && (
        <ExcelImportControl
          session={session}
          engine={importEngine}
          inputRef={importInput}
          onBusy={setImportBusy}
          disabled={!state.ready || state.busy || !!state.pending || !!state.migration}
          onDone={(report) => {
            setWeekId('');
            setReportSeen(new Set());
            setReportNext(null);
            setImportReport(report);
            setShowReport(true);
            showToast({ text: `Excel-WAP «${report.fileName}» importiert`, undo: 'Import' });
          }}
          onError={(message) => session.report(new WapError('importFailed', message))}
        />
      )}
      <input
        ref={fileInput}
        type="file"
        hidden
        aria-label="Plan-Datei öffnen"
        accept=".json,application/json"
        disabled={!state.ready || !!state.migration}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) openChosenFile(file);
        }}
      />
      {!state.ready && <p role="status">Lokale Pläne werden geöffnet …</p>}
      {state.ready && !plan && !state.migration && (
        <FirstRun
          disabled={state.busy || !!state.pending}
          onNewPlan={() => setNewPlan(true)}
          onOpenFile={() => fileInput.current?.click()}
          onImportExcel={() => {
            // Einstieg an den Import aus I4 (Dateiauswahl des Excel-Imports); ohne Import ein Hinweis.
            const input = importInput.current;
            if (importEngine !== undefined && input !== null) input.click();
            else setImportUnavailable(true);
          }}
        />
      )}
      {state.ready && !plan && !state.migration && local && (
        // Erststart unter file:// (UI-Richtlinie 11.1, 11.6; R-L-09): Tab-Stopp nach den drei Karten.
        <p className="wap-first-run-local">
          Alles bleibt auf diesem Gerät.{' '}
          <button
            type="button"
            className="wap-i2-link"
            aria-haspopup="dialog"
            onClick={openStorageHint}
          >
            Hinweis zum gemeinsamen Speicher …
          </button>
        </p>
      )}
      {plan && (
        <>
          {state.pending && (
            <div className="wap-i2-warning">
              <p>
                Die letzte Änderung bleibt in dieser Ansicht erhalten. Vor dem Schliessen die
                Plan-Datei sichern.
              </p>
              <button
                type="button"
                className="btn"
                disabled={state.busy || state.readOnly}
                onClick={() => quietly(session.retry())}
              >
                Speichern erneut versuchen
              </button>
            </div>
          )}
          {activeWeekId && (
            <I2GridEditor
              key={`${plan.id}:${activeWeekId}`}
              plan={plan}
              weekId={activeWeekId}
              onCommand={session.command}
              readOnly={editDisabled}
              onToast={showToast}
              focusRequest={focusRequest.current}
              cursorMemory={cursorMemory}
              findingMarks={flows.marks}
              aside={
                <>
                  {flows.aside}
                  {showReport && importReport !== null && (
                    <ImportReportDialog
                      report={importReport}
                      plan={plan}
                      seen={reportSeen}
                      focusItem={reportNext}
                      onClose={() => {
                        setShowReport(false);
                        requestFocus([]);
                      }}
                      onJump={(weekIdOfItem, ids, itemId, stay, item) => {
                        // Stelle ohne Eintrag (verdeckte Form): Geist an der Originallage (UX-AB-07).
                        const place: GhostPlace | undefined =
                          ids.length === 0 && item?.date != null && item.span !== null
                            ? {
                                date: item.date,
                                from: item.span.from,
                                to: item.span.to,
                                label: [
                                  `Nicht übernommene Form ${formatMilTime(item.span.from)}–${formatMilTime(item.span.to)}`,
                                  ...(item.notTakenText ?? []),
                                ].join(' · '),
                              }
                            : undefined;
                        setReportSeen((seen) => new Set(seen).add(itemId));
                        const order = importReport.items.map((i) => i.id);
                        // Bleibt der Bericht offen, behält die angesprungene Meldung den Fokus (auch nach dem Wochenwechsel).
                        setReportNext(stay ? itemId : (order[order.indexOf(itemId) + 1] ?? null));
                        setWeekId(weekIdOfItem);
                        // Maus und Leertaste: Bericht bleibt offen, der Eintrag wird gewählt und gezeigt (UX-H-10).
                        if (stay) requestFocus(ids, true, place);
                        else {
                          setShowReport(false);
                          requestFocus(ids, false, place);
                        }
                      }}
                    />
                  )}
                </>
              }
              toolbarItems={toolbarItems}
              commands={gridCommands}
            />
          )}
          {activeWeekId && showList && (
            <ListView
              plan={plan}
              weekId={activeWeekId}
              readOnly={editDisabled}
              onCommand={session.command}
              onShowInGrid={(weekIdOfRow, entryId) => {
                setWeekId(weekIdOfRow);
                requestFocus([entryId]);
              }}
              onSelectEntry={(weekIdOfRow, entryId) => {
                // Die Auswahl wandert mit (UI-Richtlinie 7, UX-AB-02): wählen und zeigen, Fokus bleibt in der Liste.
                if (weekIdOfRow !== activeWeekId) setWeekId(weekIdOfRow);
                requestFocus([entryId], true);
              }}
              onDeleted={(text) => showToast({ text, undo: 'Löschen' })}
              onExport={(csv, fileName) => {
                downloadLocal(new TextEncoder().encode(csv), fileName, 'text/csv');
                showToast({ text: `Liste «${fileName}» gespeichert` });
              }}
            />
          )}
        </>
      )}
      {!plan && (
        <footer className="wap-i2-footnote">
          Alle Daten bleiben lokal. Regelmässig eine Plan-Datei als Sicherung speichern. Weitere
          Planungsfunktionen folgen.
        </footer>
      )}
      {toast !== null && (
        <div
          key={toast.key}
          className="i2-grid-toast"
          role="status"
          aria-label="Meldung"
          onMouseEnter={() => window.clearTimeout(toastTimer.current)}
          onMouseLeave={() => {
            toastTimer.current = window.setTimeout(() => setToast(null), 3000);
          }}
        >
          <span>{toast.text}</span>
          {toast.undo !== undefined && (
            <button
              type="button"
              aria-label={`${toast.undo} rückgängig machen`}
              disabled={editDisabled}
              onClick={() => {
                setToast(null);
                stepHistory(false);
              }}
            >
              Rückgängig
            </button>
          )}
        </div>
      )}
      {newPlan && (
        <NewPlanDialog
          busy={state.busy}
          onClose={() => setNewPlan(false)}
          onCreate={async (...args) => {
            await session.create(...args);
            setWeekId('');
            setNewPlan(false);
            requestFocus([]);
          }}
        />
      )}
      {collision && (
        <OpenFileDialog
          collision={collision}
          busy={state.busy}
          onClose={() => {
            setCollision(null);
            requestFocus([]);
          }}
          onKeep={() => {
            setCollision(null);
            requestFocus([]);
            showToast({
              text: `Plan-Datei nicht geöffnet. Der lokale Stand von ${quotedName(collision.localName)} bleibt.`,
            });
          }}
          onCopy={() =>
            quietly(
              session.openFile(collision.file, true).then(() => {
                setCollision(null);
                setWeekId('');
                requestFocus([]);
                showToast({ text: `«${collision.fileName}» als Kopie geöffnet` });
              }),
            )
          }
          onReplace={() =>
            quietly(
              session.replaceFile(collision.file).then(() => {
                setCollision(null);
                setWeekId('');
                requestFocus([]);
                showToast({
                  text: `Plan durch «${collision.fileName}» ersetzt. Der vorherige Stand ist als Wiederherstellungspunkt gesichert.`,
                  undo: 'Ersetzen',
                });
              }),
            )
          }
        />
      )}
      {shortcuts !== null && (
        <ShortcutsDialog
          focusStorageHint={shortcuts === 'speicher'}
          onClose={() => setShortcuts(null)}
        />
      )}
      {palette && <WapPalette commands={allCommands()} onClose={() => setPalette(false)} />}
      {flows.dialogs}
      {importUnavailable && <ImportUnavailableDialog onClose={() => setImportUnavailable(false)} />}

      {settings && plan && (
        <PlanSettings
          plan={plan}
          disabled={editDisabled}
          run={session.command}
          onClose={() => {
            setSettings(false);
            requestFocus([]);
          }}
        />
      )}
      {state.migration && (
        <Modal
          title="Sicherung vor dem Update"
          dismissible={false}
          onClose={() => {}}
          description="Die vorhandenen Pläne müssen ins neue Format umgestellt werden. Zuerst die bisherigen Plan-Dateien als Sicherung herunterladen."
        >
          <button
            type="button"
            className="btn btn-primary"
            disabled={state.busy}
            onClick={() => quietly(session.migrate(true))}
          >
            Plan-Dateien sichern und fortfahren
          </button>
          <button
            type="button"
            className="btn"
            disabled={state.busy}
            onClick={() => quietly(session.migrate(false))}
          >
            Ohne Sicherung fortfahren
          </button>
        </Modal>
      )}
    </section>
  );
}

/**
 * Plan-Datei öffnen, obwohl der Plan lokal vorhanden ist (B6; Beschrieb 5.6 Pkt 5, UI-Richtlinie 10): behalten,
 * ersetzen (vorher Wiederherstellungspunkt, rückgängig machbar) oder als Kopie öffnen. Nie still überschreiben.
 */
function OpenFileDialog({
  collision,
  busy,
  onClose,
  onKeep,
  onCopy,
  onReplace,
}: {
  collision: Collision;
  busy: boolean;
  onClose: () => void;
  onKeep: () => void;
  onCopy: () => void;
  onReplace: () => void;
}) {
  const safe = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    safe.current?.focus();
  }, []);
  const local = `${quotedName(collision.localName)} auf diesem Gerät (geändert ${stamp(collision.localModifiedAt)})`;
  const file = `der Datei «${collision.fileName}» (geändert ${stamp(collision.file.modifiedAt)})`;
  return (
    <Modal
      title={collision.localNewer ? 'Plan als Kopie öffnen' : 'Plan-Datei öffnen'}
      onClose={onClose}
      description={
        collision.localNewer
          ? `Dieser Plan liegt schon vor: ${local} ist neuer als der Stand ${file}. Nichts wird ohne Wahl überschrieben.`
          : `Dieser Plan liegt schon vor: ${local} ist älter als oder gleich alt wie der Stand ${file}. Nichts wird ohne Wahl überschrieben.`
      }
    >
      <div className="wap-i2-choices">
        <div>
          <button
            ref={collision.localNewer ? undefined : safe}
            type="button"
            className={`btn${collision.localNewer ? '' : ' btn-primary'}`}
            disabled={busy}
            onClick={onReplace}
          >
            Durch Datei ersetzen
          </button>
          <p>Vorher entsteht ein Wiederherstellungspunkt. Rückgängig machbar (Ctrl+Z).</p>
        </div>
        <div>
          <button
            type="button"
            className={`btn${collision.localNewer ? ' btn-primary' : ''}`}
            disabled={busy}
            onClick={onCopy}
          >
            Als Kopie öffnen
          </button>
          <p>Die Datei wird ein eigenständiger Plan; der vorhandene bleibt unverändert.</p>
        </div>
        <div>
          <button
            ref={collision.localNewer ? safe : undefined}
            type="button"
            className="btn"
            disabled={busy}
            onClick={onKeep}
          >
            Lokalen Stand behalten
          </button>
          <p>Die Datei wird nicht geöffnet.</p>
        </div>
      </div>
    </Modal>
  );
}

const SHORTCUT_GROUPS: readonly (readonly [string, readonly (readonly [string, string])[]])[] = [
  [
    'Im Raster (Zellzeiger)',
    [
      ['Pfeile', 'Zelle wechseln (15 Min, eine Spalte, über die Tagesgrenze)'],
      ['Shift+Pfeile', 'Bereich erweitern'],
      ['Bild↑ / Bild↓', 'eine Stunde'],
      ['Pos1 / Ende', 'Tagesanfang / Tagesende'],
      ['Ctrl+← / Ctrl+→', 'voriger / nächster Tag'],
      ['Enter oder Tippen', 'Block erfassen (Rap-/Beso-Spalte: Rapport bzw. Beso)'],
      ['Tab / Shift+Tab', 'nächster / vorheriger Eintrag'],
      ['Ctrl+V', 'einfügen'],
      ['Ctrl+A', 'alle Einträge des Tages, zweimal: der Woche'],
      [
        'Shift+F10 / Menütaste',
        'Kontextmenü: Block (N), Beso (B), Rapport (R), Querbalken (Q), Marker (M), ganztägige Bemerkung (G)',
      ],
      [
        '↓ unter der letzten Zeile',
        'Terminbereich des Tages (↑/↓ Zeilen, Enter bearbeitet, Entf löscht)',
      ],
      ['↑ aus der ersten Zeile', 'Spaltenkopf (←/→, Shift+←/→ Breite, F2 umbenennen)'],
      [
        'Spaltenkopf: Einfg / Shift+Einfg / Entf',
        'Spalte rechts / links einfügen, Spalte entfernen',
      ],
      ['Spaltenkopf: Shift+F10 / Menütaste', 'Menü der Spalte (einfügen, umbenennen, entfernen)'],
      ['+ / − / 0, Ctrl+Plus / Ctrl+Minus / Ctrl+0', 'Zoom vergrössern / verkleinern / einpassen'],
      ['Ctrl+Mausrad über dem Raster', 'Zoom'],
    ],
  ],
  [
    'Tageskopf',
    [
      ['← / →', 'voriger / nächster Tag'],
      ['Shift+← / Shift+→', 'Bereich von Tagen wählen'],
      ['Leertaste, Ctrl+Leertaste', 'Tag wählen, Tag hinzunehmen'],
      ['S / D / Enter', 'Spaltensatz / Darstellung / Seitenfeld des Tages'],
    ],
  ],
  [
    'Eintrag gewählt',
    [
      ['Pfeile', 'verschieben (15 Min / eine Spalte)'],
      ['Bild↑ / Bild↓', 'um eine Stunde verschieben'],
      ['Shift+↑ / Shift+↓', 'Dauer ändern'],
      ['F2 / Enter', 'bearbeiten'],
      ['Z / T / S', 'Zeit, Tag, Spalten'],
      ['K', 'Kategorie'],
      ['E', 'Seitenfeld (alle Angaben); dort Esc zurück ins Raster'],
      [
        'Z / T / S / K / L / O bei offenem Seitenfeld',
        'Feld Zeit, Tag, Spalten, Kategorie, Ltg, Ort',
      ],
      [
        'Alt+Z / T / S / K / L / O im Seitenfeld',
        'Feld wechseln (auch mit Tab); Buchstaben sind Text, auch im eben mit E geöffneten Titel',
      ],
      ['X', 'streichen bzw. Streichung aufheben'],
      ['Ctrl+B in der Titelbearbeitung', 'markierten Teil fett / normal'],
      ['Ctrl+Z / Ctrl+Y in der Titelbearbeitung', 'Eingabe rückgängig / wiederholen'],
      ['Ctrl+Shift+↑ / Ctrl+Shift+↓', 'bis zum Nachbarblock auffüllen (oben / unten)'],
      ['Shift+F10', 'Kontextmenü des Eintrags'],
      ['A', 'Auch an anderen Tagen …'],
      ['Ctrl+C / Ctrl+X / Ctrl+V', 'kopieren, ausschneiden, einfügen'],
      ['Ctrl+D', 'duplizieren'],
      ['Entf', 'löschen'],
      ['Ctrl+Pfeile, Ctrl+Leertaste', 'zum Nachbarn, in die Auswahl aufnehmen'],
      ['Esc', 'Auswahl aufheben'],
    ],
  ],
  [
    'Maus',
    [
      ['Ziehen auf leerer Fläche', 'Block erfassen'],
      ['Shift+Ziehen auf leerer Fläche', 'Auswahlrahmen'],
      ['Ctrl-Klick / Shift-Klick', 'Auswahl ergänzen / Bereich'],
      ['Alt+Ziehen auf einem Block', 'paralleler Block'],
      ['Doppelklick Rap- / Beso-Spalte', 'Rapport / Beso'],
      ['Doppelklick auf die obere / untere Blockkante', 'bis zum Nachbarblock auffüllen'],
      ['Rechtsklick auf einen Spaltenkopf', 'Spalte einfügen, umbenennen, entfernen'],
      ['Ziehen in Rap- / Beso-Spalte', 'Rapport / Beso über die Zeit'],
      ['Ziehen im Band über 0500', 'Querbalken über die Tage'],
      [
        'Klick auf den Tageskopf (Ctrl, Shift)',
        'Tag(e) wählen: Spaltensatz, Darstellung im Seitenfeld',
      ],
      [
        'Klick / Doppelklick auf eine Terminzeile',
        'Beso bzw. Bemerkung wählen / Termintext bearbeiten',
      ],
      ['Rechtsklick', 'Kontextmenü'],
    ],
  ],
  [
    'Überall',
    [
      ['Ctrl+S', 'Plan-Datei sichern'],
      ['Ctrl+O', 'Plan-Datei öffnen'],
      ['Ctrl+P', 'PDF dieser Woche'],
      ['Ctrl+G', 'Gehe zu'],
      ['Ctrl+K', 'Befehle suchen (Befehlspalette)'],
      ['Ctrl+L', 'Liste ein / aus'],
      ['Ctrl+F', 'in der Liste filtern'],
      ['Ctrl+.', 'Befundliste'],
      ['F8 / Shift+F8', 'nächster / vorheriger Befund'],
      ['Ctrl+Z / Ctrl+Y', 'Rückgängig / Wiederholen'],
      ['Alt+Bild↑ / Alt+Bild↓', 'vorige / nächste Woche'],
      ['?', 'diese Übersicht'],
    ],
  ],
];

/** Übersicht der Tastenkürzel (B4; UI-Richtlinie 11.6, 13, Ansicht 14). */
function ShortcutsDialog({
  onClose,
  focusStorageHint = false,
}: {
  onClose: () => void;
  /** Zum Abschnitt «Gemeinsamer Browserspeicher» rollen und seine Überschrift fokussieren (UI-Richtlinie 11.6). */
  focusStorageHint?: boolean;
}) {
  const first = useRef<HTMLHeadingElement>(null);
  const storage = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const target = focusStorageHint && storage.current !== null ? storage.current : first.current;
    target?.focus();
    if (target === storage.current) target?.scrollIntoView({ block: 'nearest' });
  }, [focusStorageHint]);
  const local = typeof location !== 'undefined' && location.protocol === 'file:';
  return (
    <Modal title="Tastenkürzel – WAP-Planer" onClose={onClose}>
      <div className="wap-i2-shortcuts">
        {SHORTCUT_GROUPS.map(([title, rows], index) => (
          <section key={title} aria-labelledby={`wap-sc-${index}`}>
            <h3 id={`wap-sc-${index}`} ref={index === 0 ? first : undefined} tabIndex={-1}>
              {title}
            </h3>
            <dl>
              {rows.map(([keys, what]) => (
                <div key={keys}>
                  <dt>
                    <kbd>{keys}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {local && (
          <section aria-labelledby="wap-sc-local" className="wap-i2-callout">
            <h3 id="wap-sc-local" ref={storage} tabIndex={-1}>
              Gemeinsamer Browserspeicher
            </h3>
            <p>
              Der WAP-Planer ist als lokale Datei geöffnet. Der Browser legt die Pläne deshalb in
              einem Speicher ab, den alle lokal geöffneten HTML-Dateien in diesem Edge-Profil
              gemeinsam nutzen. Eine solche Datei kann die Pläne lesen. Im selben Edge-Profil
              deshalb keine fremden HTML-Dateien öffnen, sondern nur die Suite und den WAP-Planer
              aus bekannter Quelle.
            </p>
            <details>
              <summary>Details</summary>
              <p>
                Bei Adressen, die mit «file://» beginnen, behandelt der Browser alle lokalen Dateien
                als dieselbe Herkunft. Das ist eine Eigenschaft des Browsers und kein Fehler des
                Plans.
              </p>
            </details>
          </section>
        )}
      </div>
    </Modal>
  );
}

/** Nächster Montag (heute, wenn Montag) als dd.mm.yyyy. */
function nextMonday(): string {
  const at = new Date();
  const day = at.getDay();
  at.setDate(at.getDate() + ((8 - day) % 7));
  return formatDate(localDate(at), 'long');
}

export function NewPlanDialog({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, templateId: string, date: string, weeks: number) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const templates = [...builtInTemplates().values()];
  const [template, setTemplate] = useState(templates[0]?.id ?? '');
  const [date, setDate] = useState(nextMonday);
  const [weeks, setWeeks] = useState('4');
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<'name' | 'date' | 'weeks' | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const weeksInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameInput.current?.focus();
  }, []);
  const parsedDate = parseDateInput(date, 'Startdatum');
  const hint = parsedDate.ok ? mondayHint(parsedDate.value) : null;
  const fail = (field: 'name' | 'date' | 'weeks', message: string) => {
    setInvalid(field);
    setError(message);
    (field === 'name' ? nameInput : field === 'date' ? dateInput : weeksInput).current?.focus();
  };
  return (
    <Modal
      title="Neuer Plan aus Vorlage"
      onClose={onClose}
      description="Die Vorlage legt die Spalten und die leeren Wochen an. Das Startdatum ist der Montag der KVK-Woche."
    >
      <form
        className="wap-i2-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          setInvalid(null);
          if (name.trim() === '')
            return fail(
              'name',
              '«Planname» ist leer. Einen Namen eingeben, zum Beispiel «FDT 2026», und erneut anlegen.',
            );
          if (!parsedDate.ok) return fail('date', parsedDate.message);
          if (hint !== null)
            return fail(
              'date',
              `${hint.text} Den Montag ${formatDate(hint.monday, 'long')} übernehmen oder ein anderes Datum eingeben.`,
            );
          const count = Number(weeks);
          if (!Number.isInteger(count) || count < 1 || count > 52)
            return fail(
              'weeks',
              '«Anzahl Wochen» muss eine ganze Zahl von 1 bis 52 sein, zum Beispiel 4.',
            );
          // Ursache und nächster Schritt aus dem Fehler (Beschrieb 5.7; CR-H-U-09), sonst eine allgemeine Meldung.
          void onCreate(name, template, parsedDate.value, count).catch((failure: unknown) =>
            setError(
              failure instanceof WapError
                ? `${failure.userMessage.cause} ${failure.userMessage.nextStep}`
                : 'Der Plan konnte nicht angelegt werden. Die Angaben prüfen und erneut anlegen.',
            ),
          );
        }}
      >
        <label>
          Planname
          <input
            ref={nameInput}
            aria-invalid={invalid === 'name'}
            aria-describedby={invalid === 'name' ? 'wap-new-plan-error' : undefined}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (invalid === 'name') setInvalid(null);
            }}
          />
        </label>
        <label>
          Vorlage
          <select value={template} onChange={(event) => setTemplate(event.target.value)}>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.level === 'kp' ? 'Kp' : item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Startdatum
          <input
            ref={dateInput}
            aria-invalid={invalid === 'date'}
            aria-describedby={
              invalid === 'date'
                ? 'wap-new-plan-error'
                : hint !== null
                  ? 'wap-new-plan-hint'
                  : undefined
            }
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              if (invalid === 'date') setInvalid(null);
            }}
            onBlur={() => {
              const parsed = parseDateInput(date, 'Startdatum');
              if (parsed.ok) setDate(formatDate(parsed.value, 'long'));
            }}
            placeholder="dd.mm.yyyy"
          />
        </label>
        {hint !== null && (
          <p id="wap-new-plan-hint" className="wap-i2-hint">
            {hint.text}{' '}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDate(formatDate(hint.monday, 'long'));
                setInvalid(null);
                setError('');
                dateInput.current?.focus();
              }}
            >
              Montag {formatDate(hint.monday, 'long')} übernehmen
            </button>
          </p>
        )}
        <label>
          Anzahl Wochen
          <input
            ref={weeksInput}
            type="number"
            min="1"
            max="52"
            aria-invalid={invalid === 'weeks'}
            aria-describedby={invalid === 'weeks' ? 'wap-new-plan-error' : undefined}
            value={weeks}
            onChange={(event) => {
              setWeeks(event.target.value);
              if (invalid === 'weeks') setInvalid(null);
            }}
          />
        </label>
        {error && (
          <p role="alert" id="wap-new-plan-error" className="wap-i2-field-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Anlegen
        </button>
      </form>
    </Modal>
  );
}
