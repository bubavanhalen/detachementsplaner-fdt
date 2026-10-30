// Einstiegsseite des Zwischenstands I1 (Paket E1-02f; Vertrag E1-02f, Notiz «Ausarbeitung Schritt 2» Abschnitt F,
// V-02f-3; AE-001 §3). Zeigt den synthetischen, fiktiven Plan (E1-02a) mit Wochen- und Zoomwahl und erzeugt das
// PDF der Woche bzw. aller Wochen als lokalen Download über blob:. Kein Speicher (weder localStorage noch
// IndexedDB), keine Netzanfrage, keine Konsolenausgabe. Gebaut mit der Build-Hilfe aus E1-01b
// (npm run wap:einzeldatei -- --entry tests/wap-e2e/harness/zwischenstand-i1.tsx …); bündelt kein Modul aus
// tests/wap/fixtures/durchstich/ (syntheticPlan importiert nur Typen).
import { type JSX, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WeekPageView } from '../../../src/components/wap/render/WeekPageView';
import { renderPlanPdf, renderWeekPdf } from '../../../src/io/wap-pdf';
import { isoWeek } from '../../../src/model/wap/calendar';
import { WapError } from '../../../src/model/wap/errors';
import type { PageOptions } from '../../../src/model/wap/layout';
import { builtInTemplates } from '../../../src/model/wap/template';
import { syntheticPlan } from '../../wap/support/synthetic-plan';

const PLAN = syntheticPlan();

/** A4, Status rot, mitgelieferte Vorlagen; ein stabiles Objekt (Vertrag D4, O-4). */
const OPTIONEN: PageOptions = { paper: 'A4', showStatus: true, templates: builtInTemplates() };

/** Zoomstufen in Prozent; scale = Prozent/100 · 4/3 (UI-Richtlinie 4.1: 100 % = 1,333 px/pt). */
const ZOOM = [100, 150, 200, 300] as const;

const PRAEFIX = 'WAP-Planer_Zwischenstand_I1_';

/** Lokaler Download über blob: (nur auf dieses Gerät). */
function herunterladen(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Zwischenstand(): JSX.Element {
  const [weekId, setWeekId] = useState(PLAN.weeks[0]?.id ?? '');
  const [zoom, setZoom] = useState<number>(200);
  const [meldung, setMeldung] = useState<readonly string[]>([]);
  const woche = PLAN.weeks.find((w) => w.id === weekId);

  async function erzeuge(art: 'woche' | 'plan'): Promise<void> {
    const name = `${PRAEFIX}${art === 'woche' ? (woche?.shortName ?? '') : 'Plan'}.pdf`;
    const titel = name.slice(0, -'.pdf'.length);
    try {
      const r =
        art === 'woche'
          ? await renderWeekPdf(PLAN, weekId, OPTIONEN, titel)
          : await renderPlanPdf(PLAN, OPTIONEN, titel);
      herunterladen(r.bytes, name);
      setMeldung([`PDF erstellt: ${name}`]);
    } catch (e: unknown) {
      setMeldung(
        e instanceof WapError
          ? [e.userMessage.cause, e.userMessage.nextStep]
          : ['Das PDF konnte nicht erzeugt werden.', 'Seite neu laden und erneut versuchen.'],
      );
    }
  }

  return (
    <main>
      <h1>WAP-Planer – Zwischenstand I1</h1>
      <p>
        Fiktiver Plan zur Ansicht, keine echten Daten. Die Seite speichert nichts im Browser und
        sendet nichts; PDF werden nur auf dieses Gerät heruntergeladen.
      </p>
      <p>
        <label>
          Woche{' '}
          <select value={weekId} onChange={(e) => setWeekId(e.target.value)}>
            {PLAN.weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {`${w.shortName} KW ${String(isoWeek(w.startDate))}`}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Zoom{' '}
          <select value={String(zoom)} onChange={(e) => setZoom(Number(e.target.value))}>
            {ZOOM.map((z) => (
              <option key={z} value={String(z)}>
                {`${String(z)} %`}
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={() => void erzeuge('woche')}>
          PDF dieser Woche
        </button>{' '}
        <button type="button" onClick={() => void erzeuge('plan')}>
          PDF aller Wochen
        </button>
      </p>
      <div role="status">
        {meldung.map((m) => (
          <p key={m}>{m}</p>
        ))}
      </div>
      <WeekPageView plan={PLAN} weekId={weekId} options={OPTIONEN} scale={(zoom / 100) * (4 / 3)} />
    </main>
  );
}

const wurzel = document.getElementById('root');
if (wurzel !== null) createRoot(wurzel).render(<Zwischenstand />);
