import { useCallback, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AssetsStep } from '../components/tagesbefehl/AssetsStep';
import { OfficersStep } from '../components/tagesbefehl/OfficersStep';
import { OutputStep } from '../components/tagesbefehl/OutputStep';
import { ReviewStep } from '../components/tagesbefehl/ReviewStep';
import type { TbStepProps } from '../components/tagesbefehl/tbStore';
import { WapStep } from '../components/tagesbefehl/WapStep';
import { openConflicts, orderedWeeks, weekConflicts } from '../components/tagesbefehl/weekTools';
import { readTbAssets } from '../io/tagesbefehl/assets';
import { localError } from '../io/text';
import { createTbState, officerLines, rotationOrder, type TbAssets } from '../model/tagesbefehl';
import { redoProject, undoProject, useHistory, useProject } from '../store';
import { modKey } from '../ui';
import type { StepState } from '../workflow';
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
    4: officersSet
      ? 'Eingeteilt'
      : rotationOrder(project, tb).length
        ? 'Einteilung offen'
        : 'Offen',
    5: 'Druck, .xlsx, PDF',
  };
  // Same markers as the guided workflow in the sidebar; the current step is aria-current.
  const marker = (id: Step): StepState =>
    done[id] ? 'done' : id === 3 && open.length > 0 ? 'attention' : id === step ? 'active' : 'todo';
  const shared: TbStepProps = { project, tb, archived, run };
  const needsWeek = (step === 3 || step === 5) && !week;

  return (
    <main className="page page-wide tb-page">
      <section className="page-intro tb-screen-only">
        <div>
          <h2>Vom Wochenplan zum Tagesbefehl.</h2>
          <p>
            WAP lokal einlesen, Einträge prüfen, Tagesoffiziere einteilen und drucken oder als
            .xlsx/PDF speichern. Nichts verlässt dieses Gerät.
          </p>
        </div>
        <div className="actions tb-context">
          {week && (
            <span className={`badge ${open.length ? 'badge-warning' : 'badge-success'}`}>
              <Icon name={open.length ? 'alert' : 'check'} />
              {open.length
                ? `${open.length} ${open.length === 1 ? 'Hinweis' : 'Hinweise'} offen`
                : 'Alle Hinweise geprüft'}
            </span>
          )}
          {weeks.length > 0 && (
            <label className="tb-week-select">
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
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              disabled={archived || !history.canUndo}
              aria-label="Rückgängig"
              title={`Rückgängig (${modKey}+Z)`}
              onClick={() => run(undoProject)}
            >
              <Icon name="undo" size={17} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              disabled={archived || !history.canRedo}
              aria-label="Wiederholen"
              title={`Wiederholen (${modKey}+Shift+Z)`}
              onClick={() => run(redoProject)}
            >
              <Icon name="redo" size={17} />
            </button>
          </div>
        </div>
      </section>

      <nav className="tb-stepper tb-screen-only" aria-label="Schritte">
        <ol>
          {STEPS.map((item) => {
            const state = marker(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="tb-step"
                  aria-current={item.id === step ? 'step' : undefined}
                  onClick={() => setStep(item.id)}
                >
                  <span className={`step-marker is-${state}`} aria-hidden="true">
                    {state === 'done' ? (
                      <Icon name="check" />
                    ) : state === 'attention' ? (
                      '!'
                    ) : (
                      item.id
                    )}
                  </span>
                  <span className="tb-step-text">
                    <span>{item.label}</span>
                    <small>{status[item.id]}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {archived && (
        <div className="callout callout-info tb-screen-only">
          <Icon name="archive" />
          <div className="callout-body">
            Archivstand · Tagesbefehle sind schreibgeschützt. Drucken und Herunterladen bleiben
            möglich.
          </div>
        </div>
      )}
      {error && (
        <div role="alert" className="callout callout-danger tb-screen-only">
          <Icon name="alert" />
          <div className="callout-body">{error}</div>
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
        <section className="card empty">
          <span className="empty-icon">
            <Icon name="calendar" />
          </span>
          <h2>Noch keine Woche geladen.</h2>
          <p>Zuerst den Kp-WAP wählen und ein Tabellenblatt einlesen.</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
              <Icon name="upload" size={16} /> WAP laden
            </button>
          </div>
        </section>
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
