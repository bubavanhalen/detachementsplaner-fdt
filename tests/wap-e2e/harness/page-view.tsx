// Harness der E2E-Tests von Paket E1-02c (Vertrag E1-02c P-14, Änderungsnotiz Vertragsprüfung V14; Vertrag
// E1-01b `runE2e`: ein Einstieg hängt sich selbst in #root ein). Stellt window.wapHarness bereit: PageView
// zeigen, writePdf im Browser (Edge-Teil von R-L-01) und ensureScreenFont mit Fehlercode. Keine Konsolenausgabe,
// keine Netzanfragen; Seitenmodelle kommen nur aus den fiktiven Testdaten.
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PageView, type PageViewProps } from '../../../src/components/wap/render/PageView';
import { ensureScreenFont, FontLoadError } from '../../../src/components/wap/render/screenFont';
import { PdfWriteError, writePdf } from '../../../src/io/wap-pdf/writer';
import { WapError } from '../../../src/model/wap/errors';
import { ausJson, type SeiteJson, zuBase64 } from '../../wap/pdf/writer/support/seite-json';
import type { Ergebnis, HarnessApi, ZeigeOptionen } from '../render/support/harness-api';

const wurzel = document.getElementById('root');
let root: Root | null = null;

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

function overlay(): ReactNode {
  return (
    <button type="button" style={{ position: 'absolute', left: 8, top: 8 }}>
      Prüfmarke
    </button>
  );
}

const api: HarnessApi = {
  zeige(seite: SeiteJson, opts: ZeigeOptionen): void {
    if (wurzel === null) throw new Error('Harness: #root fehlt');
    root ??= createRoot(wurzel);
    const props: PageViewProps = {
      page: ausJson(seite),
      scale: opts.scale,
      label: opts.label,
      ...(opts.overlay === true ? { overlay: overlay() } : {}),
      ...(opts.semanticsProvidedByOverlay === undefined
        ? {}
        : { semanticsProvidedByOverlay: opts.semanticsProvidedByOverlay }),
    };
    root.render(<PageView {...props} />);
  },
  async pdf(seiten, title) {
    try {
      const bytes = await writePdf({ pages: seiten.map(ausJson), title });
      return { ok: true, base64: zuBase64(bytes) };
    } catch (e: unknown) {
      return fehler(e);
    }
  },
  async schrift() {
    const einmal = async (): Promise<Ergebnis<object>> => {
      try {
        await ensureScreenFont();
        return { ok: true };
      } catch (e: unknown) {
        return fehler(e);
      }
    };
    const erster = await einmal();
    const zweiter = await einmal();
    return [erster, zweiter] as const;
  },
};

window.wapHarness = api;
