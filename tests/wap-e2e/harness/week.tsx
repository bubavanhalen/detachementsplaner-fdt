// Harness der Paritäts- und Wochenansichtstests von Paket E1-02f (Vertrag E1-02f, Notiz «Ausarbeitung Schritt 2»
// Abschnitt E; Vertrag E1-01b `runE2e`: ein Einstieg hängt sich selbst in #root ein). Stellt
// window.wapWochenHarness bereit: Plan setzen, WeekPageView zeigen (hinter einer Fehlergrenze), Wochen- und
// Gesamt-PDF im Browser erzeugen und die Ebenen je Seite zählen. Keine Konsolenausgabe, keine Netzanfrage, kein
// Speicher; Pläne kommen nur als JSON aus dem Node-Test (fiktiv oder pseudonymisiert).
import { Component, type JSX, type ReactNode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FontLoadError } from '../../../src/components/wap/render/screenFont';
import { WeekPageView } from '../../../src/components/wap/render/WeekPageView';
import { PdfWriteError, renderPlanPdf, renderWeekPdf } from '../../../src/io/wap-pdf';
import { WapError } from '../../../src/model/wap/errors';
import type { PageOptions } from '../../../src/model/wap/layout';
import { builtInTemplates } from '../../../src/model/wap/template';
import type { IsoDate, Plan } from '../../../src/model/wap/types';
import { zuBase64 } from '../../wap/pdf/writer/support/seite-json';
import type {
  Ergebnis,
  WochenHarnessApi,
  WochenOptionen,
} from '../parity/support/wochen-harness-api';

const wurzel = document.getElementById('root');
const VORLAGEN = builtInTemplates();

/** Fehler ohne Inhalte des Plans (Name, Code, Meldung). */
function fehler(e: unknown): Ergebnis<never> {
  return {
    ok: false,
    name: e instanceof Error ? e.name : typeof e,
    code: e instanceof WapError ? e.code : null,
    message: e instanceof Error ? e.message : String(e),
    istFontLoadError: e instanceof FontLoadError,
    istPdfWriteError: e instanceof PdfWriteError,
  };
}

/** PageOptions der Harness (Vertrag E): A4, Status an, mitgelieferte Vorlagen. */
function optionenAus(o: WochenOptionen): PageOptions {
  return {
    paper: o.paper ?? 'A4',
    showStatus: o.showStatus ?? true,
    templates: VORLAGEN,
    ...(o.standOverride === undefined
      ? {}
      : {
          standOverride: {
            date: o.standOverride.date as IsoDate,
            version: o.standOverride.version,
          },
        }),
  };
}

let plan: Plan | null = null;
let root: Root | null = null;

/** Laufender Aufruf von zeigeWoche (höchstens einer). */
let offen: { readonly aufruf: number; readonly aufloesen: (e: Ergebnis<object>) => void } | null =
  null;
/** Fehler, die ausserhalb eines Aufrufs auftraten; der nächste Aufruf liefert den ersten. */
const vorgemerkt: unknown[] = [];
let aufrufe = 0;
let grenze = 0;
let gefangen = false;

function meldeFehler(e: unknown): void {
  if (offen !== null) {
    const o = offen;
    offen = null;
    o.aufloesen(fehler(e));
  } else {
    vorgemerkt.push(e);
  }
}

function meldeCommit(aufruf: number): void {
  if (offen !== null && offen.aufruf === aufruf) {
    const o = offen;
    offen = null;
    o.aufloesen({ ok: true });
  }
}

/** Meldet den ersten Commit eines Aufrufs (Wochenansicht gerendert). */
function Melder({ aufruf }: { readonly aufruf: number }): null {
  useEffect(() => {
    meldeCommit(aufruf);
  }, [aufruf]);
  return null;
}

/** Fehlergrenze: zeigt nach einem Fehler nichts; der Fehler geht über onCaughtError an den Aufruf. */
class Grenze extends Component<{ readonly children: ReactNode }, { readonly fehler: boolean }> {
  override state = { fehler: false };

  static getDerivedStateFromError(): { fehler: boolean } {
    return { fehler: true };
  }

  override render(): ReactNode {
    return this.state.fehler ? null : this.props.children;
  }
}

function ueberlagerung(): JSX.Element {
  return (
    <button type="button" style={{ position: 'absolute', left: 8, top: 8 }}>
      Prüfmarke
    </button>
  );
}

function wurzelVon(): Root {
  if (wurzel === null) throw new Error('Harness: #root fehlt');
  root ??= createRoot(wurzel, {
    onCaughtError: (e: unknown) => {
      gefangen = true;
      meldeFehler(e);
    },
    onUncaughtError: (e: unknown) => {
      meldeFehler(e);
    },
  });
  return root;
}

const api: WochenHarnessApi = {
  setzePlan(p: unknown): void {
    plan = p as Plan;
  },
  zeigeWoche(o) {
    return new Promise<Ergebnis<object>>((aufloesen) => {
      if (vorgemerkt.length > 0) {
        aufloesen(fehler(vorgemerkt.shift()));
        return;
      }
      if (plan === null) {
        aufloesen(fehler(new Error('Harness: kein Plan gesetzt')));
        return;
      }
      let r: Root;
      try {
        r = wurzelVon();
      } catch (e: unknown) {
        aufloesen(fehler(e));
        return;
      }
      if (offen !== null) meldeFehler(new Error('Harness: Aufruf durch einen neuen ersetzt'));
      aufrufe += 1;
      offen = { aufruf: aufrufe, aufloesen };
      if (gefangen) {
        gefangen = false;
        grenze += 1;
      }
      r.render(
        <Grenze key={`grenze-${String(grenze)}`}>
          <WeekPageView
            plan={plan}
            weekId={o.weekId}
            options={optionenAus(o)}
            scale={o.scale}
            {...(o.overlay === true ? { overlay: ueberlagerung() } : {})}
            {...(o.semanticsProvidedByOverlay === undefined
              ? {}
              : { semanticsProvidedByOverlay: o.semanticsProvidedByOverlay })}
          />
          <Melder aufruf={aufrufe} />
        </Grenze>,
      );
    });
  },
  async pdfWoche(o) {
    try {
      if (plan === null) throw new Error('Harness: kein Plan gesetzt');
      const r = await renderWeekPdf(plan, o.weekId, optionenAus(o), o.title);
      return {
        ok: true,
        base64: zuBase64(r.bytes),
        pageCount: r.pageCount,
        fallbacks: r.fallbacks,
      };
    } catch (e: unknown) {
      return fehler(e);
    }
  },
  async pdfPlan(o) {
    try {
      if (plan === null) throw new Error('Harness: kein Plan gesetzt');
      const r = await renderPlanPdf(plan, optionenAus(o), o.title);
      return {
        ok: true,
        base64: zuBase64(r.bytes),
        pageCount: r.pageCount,
        fallbacks: r.fallbacks,
      };
    } catch (e: unknown) {
      return fehler(e);
    }
  },
  ebenen() {
    return [...document.querySelectorAll('#root [role="document"]')].map((c) => ({
      name: c.getAttribute('aria-label') ?? '',
      svg: c.querySelectorAll('svg').length,
      zeilen: c.querySelectorAll('[data-wap-item]').length,
      knoten: c.querySelectorAll('*').length,
    }));
  },
};

window.wapWochenHarness = api;
