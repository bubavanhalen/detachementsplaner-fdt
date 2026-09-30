import { useState } from 'react';
import {
  eligibleOfficers,
  isCommanderFunction,
  isRotationGrade,
  isWeekend,
  officerLines,
  personLabel,
  rotationOfficer,
  rotationOrder,
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
  const order = rotationOrder(project, tb);
  const persons = new Map(project.persons.map((person) => [person.id, person]));
  const addable = project.persons.filter(
    (person) => !order.includes(person.id) && person.planning.status !== 'excluded',
  );
  const suggested = addable.filter(
    (person) => eligible.includes(person) || isRotationGrade(person.grad),
  );
  const others = addable.filter((person) => !suggested.includes(person));
  const choice = addable.some((person) => person.id === candidate)
    ? candidate
    : (suggested[0]?.id ?? others[0]?.id ?? '');
  const customised = tb.offiziere.length > 0 || tb.offiziereEntfernt.length > 0;
  const lieutenants = project.persons.filter(
    (person) =>
      person.planning.status !== 'excluded' &&
      isRotationGrade(person.grad) &&
      !isCommanderFunction(person.funktion),
  );
  const label = (id: string) => {
    const person = persons.get(id);
    return person ? personLabel(person) : 'Person nicht mehr vorhanden';
  };
  /** Stores the fixed order; planned officers not listed are appended automatically. */
  const editRotation = (next: string[], removed: string[], start = tb.rotationStart) => {
    const unique = [...new Set(removed)];
    const length = rotationOrder(project, {
      ...tb,
      offiziere: next,
      offiziereEntfernt: unique,
    }).length;
    void run(() =>
      changeTb((draft) => {
        draft.offiziere = next;
        draft.offiziereEntfernt = unique;
        draft.rotationStart = length ? Math.min(Math.max(0, start), length - 1) : 0;
      }),
    );
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const list = [...order];
    [list[index], list[target]] = [list[target], list[index]];
    editRotation(list, tb.offiziereEntfernt);
  };

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
            Eingeplante Lt und Oblt der eigenen Einheit (ohne Kdt und Kdt Stv) sind automatisch in
            der Rotation. Reihenfolge ändern, entfernen oder weitere Personen hinzufügen ist
            jederzeit möglich. Die Reihenfolge läuft Mo–Fr über alle geladenen Wochen (nach
            Startdatum) weiter.
          </p>
          {!project.settings.eigeneEinheit.trim() && (
            <div className="callout callout-warning">
              <Icon name="info" />
              <p className="callout-body">
                Eigene Einheit noch nicht erfasst (Projektmenü → Bezeichnung & Zeitraum). Bis dahin
                werden alle eingeplanten Lt/Oblt aufgenommen.
              </p>
            </div>
          )}
          {!eligible.length && (
            <div className="callout callout-warning" data-testid="tb-rotation-hint">
              <Icon name="info" />
              <p className="callout-body">
                {lieutenants.length
                  ? `${lieutenants.length} eingeplante Lt/Oblt gehören laut Personenliste zu einer anderen Einheit als «${project.settings.eigeneEinheit.trim()}». Einheit prüfen oder unten von Hand hinzufügen.`
                  : 'Keine eingeplanten Lt/Oblt in der Personenliste gefunden (Grad prüfen). Offiziere können unten von Hand hinzugefügt werden.'}
              </p>
            </div>
          )}
          {order.length ? (
            <ol className="tb-rotation">
              {order.map((id, index) => {
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
                        {tb.offiziere.includes(id) ? '' : ' · automatisch'}
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
                          disabled={index === order.length - 1}
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
                              order.filter((item) => item !== id),
                              [...tb.offiziereEntfernt, id],
                              index < tb.rotationStart ? tb.rotationStart - 1 : tb.rotationStart,
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
              {addable.length > 0 && (
                <>
                  <label className="field grow">
                    Offizier hinzufügen
                    <select value={choice} onChange={(event) => setCandidate(event.target.value)}>
                      {suggested.length > 0 && (
                        <optgroup label="Lt / Oblt">
                          {suggested.map((person) => (
                            <option key={person.id} value={person.id}>
                              {personLabel(person)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {others.length > 0 && (
                        <optgroup label="Weitere Personen">
                          {others.map((person) => (
                            <option key={person.id} value={person.id}>
                              {personLabel(person)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={!choice}
                    onClick={() =>
                      editRotation(
                        [...order, choice],
                        tb.offiziereEntfernt.filter((id) => id !== choice),
                      )
                    }
                  >
                    <Icon name="plus" size={16} /> Hinzufügen
                  </button>
                </>
              )}
              {customised && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => editRotation([], [], 0)}
                  title="Eigene Reihenfolge und entfernte Personen zurücksetzen"
                >
                  <Icon name="undo" size={16} /> Automatische Rotation wiederherstellen
                </button>
              )}
            </div>
          )}
          {order.length > 1 && (
            <label className="field">
              Erster Tagesoffizier (erster Wochentag der frühesten Woche)
              <select
                value={tb.rotationStart}
                disabled={archived}
                onChange={(event) =>
                  editRotation(tb.offiziere, tb.offiziereEntfernt, Number(event.target.value))
                }
              >
                {order.map((id, index) => (
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
  const order = rotationOrder(project, tb);
  const options = [
    ...eligible,
    ...project.persons.filter(
      (person) =>
        !eligible.includes(person) &&
        (order.includes(person.id) ||
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
            const rotation = rotationOfficer(project, tb, week.sheet, day);
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
