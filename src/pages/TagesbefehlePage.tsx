import { useCallback, useMemo, useState } from 'react';
import { AssetsStep } from '../components/tagesbefehl/AssetsStep';
import { OfficersStep } from '../components/tagesbefehl/OfficersStep';
import { OutputStep } from '../components/tagesbefehl/OutputStep';
import { ReviewStep } from '../components/tagesbefehl/ReviewStep';
import type { TbStepProps } from '../components/tagesbefehl/tbStore';
import { WapStep } from '../components/tagesbefehl/WapStep';
import { openConflicts, orderedWeeks, weekConflicts } from '../components/tagesbefehl/weekTools';
import { readTbAssets } from '../io/tagesbefehl/assets';
import { localError } from '../io/text';
import { createTbState, officerLines, type TbAssets } from '../model/tagesbefehl';
import { redoProject, undoProject, useHistory, useProject } from '../store';
import './tagesbefehle.css';

const STEPS = [
  { id: 1, label: 'Vorlage & Unterschrift' },
  { id: 2, label: 'WAP laden' },
  { id: 3, label: 'Prüfen' },
  { id: 4, label: 'Tagesoffiziere' },
  { id: 5, label: 'Ausgabe' },
] as const;
type Step = (typeof STEPS)[number]['id'];

export default function TagesbefehlePage() {
  const project = useProject(),
    history = useHistory();
  const tb = useMemo(() => project.tb ?? createTbState(), [project.tb]);
  const archived = !!project.archive;
  const [assets, setAssets] = useState<TbAssets>(() => readTbAssets());
  const weeks = orderedWeeks(tb);
  const [selectedSheet, setSheet] = useState(() => weeks.at(-1)?.sheet ?? '');
  const week = tb.wochen[selectedSheet] ?? weeks.at(-1);
  const [step, setStep] = useState<Step>(() => (!assets.template ? 1 : weeks.length ? 3 : 2));
  const [error, setError] = useState('');

  const run = useCallback<TbStepProps['run']>(async (action) => {
    try {
      await action();
      setError('');
      return true;
    } catch (failure) {
      setError(localError(failure));
      return false;
    }
  }, []);

  const open = week ? openConflicts(week, weekConflicts(week)) : [];
  const officersSet =
    !!week &&
    week.days.length > 0 &&
    week.days.every((day) => officerLines(project, tb, week, day).length > 0);
  const done: Record<Step, boolean> = {
    1: !!assets.template,
    2: weeks.length > 0,
    3: !!week && week.entries.length > 0 && open.length === 0,
    4: officersSet,
    5: false,
  };
  const status: Record<Step, string> = {
    1: assets.template
      ? assets.signature
        ? 'Gespeichert'
        : 'Unterschrift fehlt'
      : 'Vorlage fehlt',
    2: weeks.length ? `${weeks.length} ${weeks.length === 1 ? 'Woche' : 'Wochen'}` : 'Offen',
    3: week ? (open.length ? `${open.length} Hinweise offen` : 'Geprüft') : 'Offen',
    4: officersSet ? 'Eingeteilt' : tb.offiziere.length ? 'Einteilung offen' : 'Offen',
    5: 'Druck, .xlsx, PDF',
  };
  const shared: TbStepProps = { project, tb, archived, run };
  const needsWeek = (step === 3 || step === 5) && !week;

  return (
    <main className="page tb-page">
      <header className="page-heading tb-screen-only">
        <div>
          <p className="eyebrow">TAGESBEFEHLE AUS DEM KP-WAP</p>
          <h1>Vom Wochenplan zum Tagesbefehl.</h1>
          <p>
            WAP lokal einlesen, Einträge prüfen, Tagesoffiziere einteilen und drucken oder als
            .xlsx/PDF speichern. Nichts verlässt dieses Gerät.
          </p>
        </div>
        {week && (
          <span className={`status-pill ${open.length ? '' : 'is-good'}`}>
            {open.length
              ? `${open.length} ${open.length === 1 ? 'Hinweis' : 'Hinweise'} offen`
              : 'Alle Hinweise geprüft'}
          </span>
        )}
      </header>

      <nav className="tb-stepper tb-screen-only" aria-label="Schritte">
        <ol>
          {STEPS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`tb-step ${item.id === step ? 'is-active' : ''} ${done[item.id] ? 'is-done' : ''}`}
                aria-current={item.id === step ? 'step' : undefined}
                onClick={() => setStep(item.id)}
              >
                <span className="tb-step-number" aria-hidden="true">
                  {done[item.id] ? '✓' : item.id}
                </span>
                <span>
                  {item.label}
                  <small>{status[item.id]}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="tb-context tb-screen-only">
        {weeks.length > 0 && (
          <label className="field tb-week-select">
            Woche
            <select value={week?.sheet ?? ''} onChange={(event) => setSheet(event.target.value)}>
              {weeks.map((item) => (
                <option key={item.sheet} value={item.sheet}>
                  {item.sheet}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="history-buttons">
          <button
            type="button"
            className="button secondary"
            disabled={archived || !history.canUndo}
            aria-label="Rückgängig"
            onClick={() => run(undoProject)}
          >
            ↶
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={archived || !history.canRedo}
            aria-label="Wiederholen"
            onClick={() => run(redoProject)}
          >
            ↷
          </button>
        </div>
      </div>

      {archived && (
        <div className="notice tb-screen-only">
          Archivstand · Tagesbefehle sind schreibgeschützt. Drucken und Herunterladen bleiben
          möglich.
        </div>
      )}
      {error && (
        <div role="alert" className="notice warning tb-screen-only">
          {error}
        </div>
      )}

      {step === 1 && <AssetsStep {...shared} assets={assets} onAssets={setAssets} />}
      {step === 2 && (
        <WapStep
          {...shared}
          activeSheet={week?.sheet ?? ''}
          onSelectWeek={setSheet}
          onReview={() => setStep(3)}
        />
      )}
      {needsWeek && (
        <div className="empty-state">
          <strong>Noch keine Woche geladen.</strong>
          <p>Zuerst den Kp-WAP wählen und ein Tabellenblatt einlesen.</p>
          <button type="button" className="button" onClick={() => setStep(2)}>
            WAP laden
          </button>
        </div>
      )}
      {step === 3 && week && <ReviewStep key={week.sheet} {...shared} week={week} />}
      {step === 4 && <OfficersStep {...shared} week={week} />}
      {step === 5 && week && (
        <OutputStep
          {...shared}
          week={week}
          assets={assets}
          onStep={(next) => setStep(next as Step)}
        />
      )}
    </main>
  );
}
