import { useState } from 'react';
import {
  eligibleOfficers,
  isWeekend,
  officerLines,
  personLabel,
  rotationOfficer,
  TB_WEEKDAY_NAMES,
  type TbOfficerOverride,
  type TbWeek,
  type TbWeekday,
} from '../../model/tagesbefehl';
import type { Person } from '../../model/types';
import { Icon } from '../Icon';
import { Field, InlineLines, InlineText } from './fields';
import { changeTb, changeWeek, type TbStepProps } from './tbStore';

const FREE_TEXT = '__text';

export function OfficersStep({
  project,
  tb,
  archived,
  run,
  week,
}: TbStepProps & { week: TbWeek | undefined }) {
  const [candidate, setCandidate] = useState('');
  const eligible = eligibleOfficers(project);
  const persons = new Map(project.persons.map((person) => [person.id, person]));
  const available = eligible.filter((person) => !tb.offiziere.includes(person.id));
  const choice = available.some((person) => person.id === candidate)
    ? candidate
    : (available[0]?.id ?? '');
  const label = (id: string) => {
    const person = persons.get(id);
    return person ? personLabel(person) : 'Person nicht mehr vorhanden';
  };
  const editRotation = (mutator: (list: string[]) => string[], start?: (old: number) => number) =>
    void run(() =>
      changeTb((draft) => {
        draft.offiziere = mutator([...draft.offiziere]);
        const next = start ? start(draft.rotationStart) : draft.rotationStart;
        draft.rotationStart = draft.offiziere.length
          ? Math.min(Math.max(0, next), draft.offiziere.length - 1)
          : 0;
      }),
    );
  const move = (index: number, direction: -1 | 1) =>
    editRotation((list) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) return list;
      [list[index], list[target]] = [list[target], list[index]];
      return list;
    });

  return (
    <div className="tb-step-grid">
      <section className="card" aria-labelledby="tb-rotation-title">
        <header className="card-head">
          <h2 id="tb-rotation-title">
            <Icon name="users" /> Tagesoffiziere
          </h2>
          <span className="muted tb-head-note">Rotation über alle Wochen</span>
        </header>
        <div className="card-body tb-card-stack">
          <p className="muted">
            Lt und Oblt der eigenen Einheit ohne Kdt und Kdt Stv. Die Reihenfolge läuft Mo–Fr über
            alle geladenen Wochen (nach Startdatum) weiter.
          </p>
          {!project.settings.eigeneEinheit.trim() && (
            <div className="callout callout-warning">
              <Icon name="info" />
              <p className="callout-body">
                Eigene Einheit noch nicht erfasst (Projektmenü → Bezeichnung & Zeitraum). Bis dahin
                werden alle Lt/Oblt vorgeschlagen.
              </p>
            </div>
          )}
          {tb.offiziere.length ? (
            <ol className="tb-rotation">
              {tb.offiziere.map((id, index) => {
                const person = persons.get(id);
                return (
                  <li key={id} className={index === tb.rotationStart ? 'is-start' : ''}>
                    <span className="tb-rotation-no" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="tb-rotation-text">
                      <strong>{label(id)}</strong>
                      <small>
                        {person?.tel || 'Telefon fehlt'}
                        {index === tb.rotationStart ? ' · Beginn der Rotation' : ''}
                      </small>
                    </span>
                    {!archived && (
                      <span className="tb-row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          aria-label={`${label(id)} nach oben`}
                          title="Nach oben"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <Icon name="chevronDown" size={16} className="tb-icon-up" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          aria-label={`${label(id)} nach unten`}
                          title="Nach unten"
                          disabled={index === tb.offiziere.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <Icon name="chevronDown" size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm tb-remove"
                          aria-label={`${label(id)} aus der Rotation entfernen`}
                          title="Aus der Rotation entfernen"
                          onClick={() =>
                            editRotation(
                              (list) => list.filter((item) => item !== id),
                              (old) => (index < old ? old - 1 : old),
                            )
                          }
                        >
                          <Icon name="x" size={15} />
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="muted">Noch keine Offiziere in der Rotation.</p>
          )}
          {!archived && (
            <div className="toolbar tb-add-officer">
              {available.length > 0 ? (
                <>
                  <label className="field grow">
                    Offizier hinzufügen
                    <select value={choice} onChange={(event) => setCandidate(event.target.value)}>
                      {available.map((person) => (
                        <option key={person.id} value={person.id}>
                          {personLabel(person)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={!choice}
                    onClick={() => editRotation((list) => [...list, choice])}
                  >
                    <Icon name="plus" size={16} /> Hinzufügen
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      editRotation((list) => [...list, ...available.map((person) => person.id)])
                    }
                  >
                    <Icon name="users" size={16} />
                    {`Alle berechtigten übernehmen (${available.length})`}
                  </button>
                </>
              ) : (
                <p className="muted">
                  {eligible.length
                    ? 'Alle berechtigten Offiziere sind in der Rotation.'
                    : 'Keine berechtigten Offiziere in der Personenliste.'}
                </p>
              )}
            </div>
          )}
          {tb.offiziere.length > 1 && (
            <label className="field">
              Erster Tagesoffizier (erster Wochentag der frühesten Woche)
              <select
                value={tb.rotationStart}
                disabled={archived}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  editRotation(
                    (list) => list,
                    () => value,
                  );
                }}
              >
                {tb.offiziere.map((id, index) => (
                  <option key={id} value={index}>
                    {label(id)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>
      {week ? (
        <DayOfficers {...{ project, tb, archived, run, week, eligible }} />
      ) : (
        <section className="card empty tb-empty-compact">
          <span className="empty-icon">
            <Icon name="calendar" />
          </span>
          <p>Für die Einteilung pro Tag zuerst eine Woche laden.</p>
        </section>
      )}
    </div>
  );
}

function DayOfficers({
  project,
  tb,
  archived,
  run,
  week,
  eligible,
}: TbStepProps & { week: TbWeek; eligible: Person[] }) {
  const options = [
    ...eligible,
    ...project.persons.filter(
      (person) =>
        !eligible.includes(person) &&
        (tb.offiziere.includes(person.id) ||
          Object.values(week.officers).some((item) => item?.personId === person.id)),
    ),
  ];
  const edit = (day: TbWeekday, mutator: (override: TbOfficerOverride | undefined) => unknown) =>
    void run(() =>
      changeWeek(week.sheet, (draft) => {
        const next = mutator(draft.officers[day]);
        if (next === undefined) delete draft.officers[day];
        else draft.officers[day] = next as TbOfficerOverride;
      }),
    );
  return (
    <section className="card" aria-labelledby="tb-days-officers">
      <header className="card-head">
        <h2 id="tb-days-officers">
          <Icon name="calendar" /> Einteilung pro Tag
        </h2>
        <span className="badge badge-accent">Woche {week.sheet}</span>
      </header>
      <div className="card-body tb-card-stack">
        {!week.days.length && <p className="muted">Diese Woche hat noch keine Tage.</p>}
        <div className="tb-officer-days">
          {week.days.map((day) => {
            const preview = officerLines(project, tb, week, day);
            if (isWeekend(day))
              return (
                <div className="tb-officer-day" key={day}>
                  <h3>{TB_WEEKDAY_NAMES[day]}</h3>
                  <Field label={`Wochenend Wacht Of ${day}`}>
                    {(id) => (
                      <InlineLines
                        id={id}
                        rows={2}
                        value={week.wachtOf[day] ?? []}
                        disabled={archived}
                        placeholder={'Wacht Of Kp …\nTel …'}
                        onCommit={(lines) =>
                          void run(() =>
                            changeWeek(week.sheet, (draft) => {
                              if (lines.length) draft.wachtOf[day] = lines;
                              else delete draft.wachtOf[day];
                            }),
                          )
                        }
                      />
                    )}
                  </Field>
                  <p
                    className={`tb-officer-preview ${preview.length ? '' : 'is-open'}`}
                    data-testid={`tb-officer-${day}`}
                  >
                    {preview.join(' · ') || 'Noch offen'}
                  </p>
                </div>
              );
            const override = week.officers[day];
            const rotation = rotationOfficer(tb, week.sheet, day);
            const mode = override ? override.personId || FREE_TEXT : '';
            return (
              <div className="tb-officer-day" key={day}>
                <h3>{TB_WEEKDAY_NAMES[day]}</h3>
                <label className="field">
                  Tagesoffizier {day}
                  <select
                    value={mode}
                    disabled={archived}
                    onChange={(event) => {
                      const value = event.target.value;
                      edit(day, (old) =>
                        value === ''
                          ? undefined
                          : value === FREE_TEXT
                            ? { personId: '', text: old?.text ?? '', tel: old?.tel ?? '' }
                            : { personId: value, text: '', tel: '' },
                      );
                    }}
                  >
                    <option value="">
                      Gemäss Rotation
                      {rotation ? ` (${personLabelById(project.persons, rotation)})` : ''}
                    </option>
                    {options.map((person) => (
                      <option key={person.id} value={person.id}>
                        {personLabel(person)}
                      </option>
                    ))}
                    <option value={FREE_TEXT}>Andere Person (Freitext)</option>
                  </select>
                </label>
                {mode === FREE_TEXT && (
                  <Field label={`Name ${day}`}>
                    {(id) => (
                      <InlineText
                        id={id}
                        value={override?.text ?? ''}
                        placeholder="Grad Vorname Name, Einheit"
                        disabled={archived}
                        onCommit={(value) =>
                          edit(day, (old) => ({
                            personId: '',
                            text: value.trim(),
                            tel: old?.tel ?? '',
                          }))
                        }
                      />
                    )}
                  </Field>
                )}
                {override && (
                  <Field label={`Telefon ${day}`}>
                    {(id) => (
                      <InlineText
                        id={id}
                        value={override.tel}
                        placeholder={
                          persons(project).get(override.personId)?.tel || 'Telefon (optional)'
                        }
                        disabled={archived}
                        onCommit={(value) =>
                          edit(day, (old) => (old ? { ...old, tel: value.trim() } : old))
                        }
                      />
                    )}
                  </Field>
                )}
                <p
                  className={`tb-officer-preview ${preview.length ? '' : 'is-open'}`}
                  data-testid={`tb-officer-${day}`}
                >
                  {preview.join(' · ') || 'Noch offen'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const persons = (project: TbStepProps['project']) =>
  new Map(project.persons.map((person) => [person.id, person]));
function personLabelById(list: Person[], id: string): string {
  const person = list.find((item) => item.id === id);
  return person ? personLabel(person) : 'Person nicht mehr vorhanden';
}
