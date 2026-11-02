// Wochenansicht am Bildschirm (Vertrag E1-02f, Notiz «Ausarbeitung Schritt 2» Abschnitt B3, C, D;
// Änderungsnotiz aus E1-02e CR-03 Nr 3; R-5-01, Leitplanke 2). Zeichnet nur die Seiten aus dem Layout, das
// auch das PDF zeichnet (layoutWeekForOutputSync bzw. layoutWeekForOutput); ausser dem Overlay nichts.

import {
  type CSSProperties,
  type JSX,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { layoutWeekForOutput, layoutWeekForOutputSync } from '../../../io/wap-pdf/planPdf';
import { layoutWeekPage, type PageModel, type PageOptions } from '../../../model/wap/layout';
import type { Id, Plan } from '../../../model/wap/types';
import { PageView } from './PageView';
import { ensureScreenFont, SCREEN_FONT_MESSAGE } from './screenFont';
import './weekPageView.css';

export interface WeekPageViewProps {
  readonly plan: Plan;
  readonly weekId: Id;
  /** Pflicht (vorher optional): PageOptions.templates hat keinen Standardwert (T-5). */
  readonly options: PageOptions;
  /** px pro pt, endlich > 0; an jedes PageView weitergegeben (R-5-02: Umbrüche unabhängig vom Zoom). */
  readonly scale: number;
  /** Bedien- und Prüfmarken, nur auf der Wochenseite (Seite 0), nie im PDF (R-5-03). */
  readonly overlay?: ReactNode;
  /** true: Papier der Wochenseite aria-hidden, die Struktur liefert das Overlay (E1-12). Fortsetzungsseiten bleiben lesbar. Standard false. */
  readonly semanticsProvidedByOverlay?: boolean;
}

type Schriftstand = 'laden' | 'bereit' | 'fehler';

/** Stand der Bildschirmschrift in diesem Dokument; bekannt, sobald der eine Ladevorgang abgeschlossen ist. */
let bekannterStand: Schriftstand = 'laden';

/** Wartet selbst auf die Bildschirmschrift (T-4), damit es höchstens eine Meldung je Ansicht gibt. */
function useSchriftstand(): Schriftstand {
  const [stand, setStand] = useState<Schriftstand>(bekannterStand);
  useEffect(() => {
    if (stand !== 'laden') return;
    let aktiv = true;
    ensureScreenFont().then(
      () => {
        bekannterStand = 'bereit';
        if (aktiv) setStand('bereit');
      },
      () => {
        bekannterStand = 'fehler';
        if (aktiv) setStand('fehler');
      },
    );
    return () => {
      aktiv = false;
    };
  }, [stand]);
  return stand;
}

/** Eingabe des Layouts (D4: Neuberechnung nur bei neuer Identität von plan, weekId oder options). */
interface Eingabe {
  readonly plan: Plan;
  readonly weekId: Id;
  readonly options: PageOptions;
}

/** Ergebnis der asynchronen Prüfung des Wappens für eine Eingabe. */
type Pruefung =
  | { readonly eingabe: Eingabe; readonly ok: true; readonly pages: readonly PageModel[] }
  | { readonly eingabe: Eingabe; readonly ok: false; readonly fehler: unknown };

/** Gezeichneter Stand: Seiten mit Bezeichnung und Overlay derselben Eingabe (Notiz Code-Review Runde 1 Nr 1). */
interface Gezeichnet {
  readonly pages: readonly PageModel[];
  readonly bezeichnung: string;
  readonly overlay: ReactNode | undefined;
  readonly semanticsProvidedByOverlay: boolean | undefined;
}

function fuerEingabe(p: Pruefung | null, e: Eingabe): Pruefung | null {
  if (p === null) return null;
  const a = p.eingabe;
  return a.plan === e.plan && a.weekId === e.weekId && a.options === e.options ? p : null;
}

/** Name der Seite k (D2): «Wochenseite ‹Bezeichnung›» bzw. «Fortsetzung ‹k› – ‹Bezeichnung›». */
function seitenName(k: number, bezeichnung: string): string {
  return k === 0 ? `Wochenseite ${bezeichnung}` : `Fortsetzung ${String(k)} – ${bezeichnung}`;
}

/** Leerer Platzhalter einer Seite, solange die Schrift lädt (D3 «lädt»). */
function Platzhalter(props: {
  readonly page: PageModel;
  readonly scale: number;
  readonly label: string;
}): JSX.Element {
  const { page, scale, label } = props;
  const groesse: CSSProperties = {
    width: `${String(page.widthPt * scale)}px`,
    height: `${String(page.heightPt * scale)}px`,
  };
  return (
    <div
      role="document"
      aria-label={label}
      aria-busy="true"
      className="wap-seite"
      style={groesse}
    />
  );
}

/**
 * Wochenseite «Wochenseite ‹Bezeichnung›» und Fortsetzungsseiten «Fortsetzung ‹k› – ‹Bezeichnung›»
 * untereinander (D1, D2). Unbekannte Woche: wirft beim Rendern ModelError 'unknownWeek' (C).
 * Ist das Wappen noch ungeprüft, bleiben die zuletzt gezeichneten Seiten samt Namen und Overlay stehen, bis das
 * Ergebnis vorliegt; ein überholtes Ergebnis wird verworfen (CR-03 Nr 3, Notiz Code-Review Runde 1 Nr 1).
 * So zeigt der Bildschirm nie ein Wappen, das das PDF nicht zeichnet, und Name, Overlay und Inhalt wechseln
 * nur gemeinsam.
 */
export function WeekPageView(props: WeekPageViewProps): JSX.Element {
  const { plan, weekId, options, scale, overlay, semanticsProvidedByOverlay } = props;
  const schrift = useSchriftstand();

  // Synchron, wenn das Wappen fehlt oder schon geprüft ist; wirft die Fehler von layoutWeekPage beim Rendern.
  const sofort = useMemo(
    () => layoutWeekForOutputSync(plan, weekId, options),
    [plan, weekId, options],
  );
  const [pruefung, setPruefung] = useState<Pruefung | null>(null);
  // Zuletzt im Zustand «bereit» gezeichnet: Seiten samt Namen und Overlay ihrer damaligen Eingabe
  // (Notiz Code-Review Runde 1 Nr 1). Gesetzt erst nach dem Commit, gelesen nur, solange die Prüfung aussteht.
  const gezeichnet = useRef<Gezeichnet | null>(null);

  const geprueft = fuerEingabe(pruefung, { plan, weekId, options });
  const aktuell = sofort?.layout.pages ?? (geprueft?.ok === true ? geprueft.pages : null);
  const offen = sofort === null && geprueft === null;

  useEffect(() => {
    if (!offen) return;
    let aktiv = true;
    const eingabe: Eingabe = { plan, weekId, options };
    layoutWeekForOutput(plan, weekId, options).then(
      (r) => {
        if (aktiv) setPruefung({ eingabe, ok: true, pages: r.layout.pages });
      },
      (fehler: unknown) => {
        if (aktiv) setPruefung({ eingabe, ok: false, fehler });
      },
    );
    return () => {
      aktiv = false;
    };
  }, [offen, plan, weekId, options]);

  const bezeichnung = plan.weeks.find((w) => w.id === weekId)?.label ?? '';

  // Merker erst im Zustand «bereit» und nur mit einem Ergebnis der aktuellen Eingabe (Notiz CR1 Nr 1).
  useEffect(() => {
    if (schrift !== 'bereit' || aktuell === null) return;
    gezeichnet.current = { pages: aktuell, bezeichnung, overlay, semanticsProvidedByOverlay };
  });

  // Steht die Prüfung aus, bleibt der zuletzt gezeichnete Stand als Ganzes stehen (CR-03 Nr 3).
  const stehen = aktuell === null && schrift === 'bereit' ? gezeichnet.current : null;

  // Platzhalter: Zahl und Grösse aus layoutWeekPage der aktuellen Eingabe, solange es kein Ergebnis gibt (D3).
  const ohneErgebnis = aktuell === null && stehen === null;
  const vorlaeufig = useMemo(
    () => (ohneErgebnis ? layoutWeekPage(plan, weekId, options).pages : null),
    [ohneErgebnis, plan, weekId, options],
  );

  // Fehler der asynchronen Berechnung erscheinen beim Rendern wie die synchronen (C).
  if (geprueft !== null && !geprueft.ok) throw geprueft.fehler;

  if (schrift === 'fehler') {
    return (
      <div className="wap-woche">
        <div role="alert" className="banner-danger wap-seite-fehler">
          <p>{SCREEN_FONT_MESSAGE.cause}</p>
          <p>{SCREEN_FONT_MESSAGE.nextStep}</p>
        </div>
      </div>
    );
  }

  const stand: Gezeichnet | null =
    aktuell !== null && schrift === 'bereit'
      ? { pages: aktuell, bezeichnung, overlay, semanticsProvidedByOverlay }
      : stehen;
  if (stand === null) {
    return (
      <div className="wap-woche">
        {(aktuell ?? vorlaeufig ?? []).map((page, k) => (
          <Platzhalter
            key={seitenName(k, '')}
            page={page}
            scale={scale}
            label={seitenName(k, bezeichnung)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="wap-woche">
      {stand.pages.map((page, k) => (
        <PageView
          // Gleicher Schlüssel je Lage, damit die Seiten bei einer Neuberechnung stehen bleiben (CR-03 Nr 3).
          key={seitenName(k, '')}
          page={page}
          scale={scale}
          label={seitenName(k, stand.bezeichnung)}
          {...(k === 0 && stand.overlay !== undefined ? { overlay: stand.overlay } : {})}
          {...(k === 0 && stand.semanticsProvidedByOverlay !== undefined
            ? { semanticsProvidedByOverlay: stand.semanticsProvidedByOverlay }
            : {})}
        />
      ))}
    </div>
  );
}
