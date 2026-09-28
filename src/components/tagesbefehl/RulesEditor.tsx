import { Fragment } from 'react';
import { newId } from '../../model/project';
import {
  DEFAULT_TB_RULES,
  type TbLeitung,
  type TbRule,
  type TbWeek,
} from '../../model/tagesbefehl';
import { notify } from '../../store';
import { Icon } from '../Icon';
import { InlineText } from './fields';
import { changeTb, changeWeek, type TbStepProps } from './tbStore';
import { applyRulesToWeek, LEITUNG_LABELS } from './weekTools';

const LEITUNG_OPTIONS: TbLeitung[] = ['bat', 'kp', 'zfhr', 'extern', 's2'];
type RuleField = 'match' | 'verantwortlich' | 'ort';
const RULE_FIELDS: { key: RuleField; label: string }[] = [
  { key: 'match', label: 'Tätigkeit (Stichworte, mit Komma getrennt)' },
  { key: 'verantwortlich', label: 'Verantwortlich' },
  { key: 'ort', label: 'Ort' },
];

/** Editable default Verantwortlich/Ort (project.tb.regeln). Never overwrites filled fields. */
export function RulesEditor({ tb, archived, run, week }: TbStepProps & { week: TbWeek }) {
  const edit = (mutator: (rules: TbRule[]) => void) =>
    void run(() =>
      changeTb((draft) => {
        mutator(draft.regeln);
      }),
    );
  return (
    <details className="disclosure tb-rules">
      <summary>
        <Icon name="chevronRight" size={16} className="chev" />
        Standardregeln für Verantwortlich / Ort ({tb.regeln.length})
      </summary>
      <div className="disclosure-body tb-card-stack">
        <p className="muted">
          Gilt nur für leere Felder. Stichworte werden am Wortanfang der Tätigkeit gesucht; «*» gilt
          für alle Einträge der gewählten Leitung.
        </p>
        <div className="data-table tb-edit-table tb-rules-table">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tätigkeit</th>
                  <th>Nur bei Leitung</th>
                  <th>Verantwortlich</th>
                  <th>Ort</th>
                  <th>
                    <span className="visually-hidden">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tb.regeln.map((rule, index) => (
                  <tr key={rule.id}>
                    {RULE_FIELDS.map((field, position) => (
                      <Fragment key={field.key}>
                        <td>
                          <InlineText
                            aria-label={`Regel ${index + 1}: ${field.label}`}
                            value={rule[field.key]}
                            disabled={archived}
                            onCommit={(value) =>
                              edit((rules) => {
                                const item = rules.find((candidate) => candidate.id === rule.id);
                                if (item) item[field.key] = value.trim();
                              })
                            }
                          />
                        </td>
                        {position === 0 && (
                          <td>
                            <select
                              aria-label={`Regel ${index + 1}: Leitung`}
                              value={rule.leitung ?? ''}
                              disabled={archived}
                              onChange={(event) => {
                                const value = event.target.value as TbLeitung;
                                edit((rules) => {
                                  const item = rules.find((candidate) => candidate.id === rule.id);
                                  if (!item) return;
                                  if (value) item.leitung = value;
                                  else delete item.leitung;
                                });
                              }}
                            >
                              <option value="">Alle</option>
                              {LEITUNG_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {LEITUNG_LABELS[option]}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                      </Fragment>
                    ))}
                    <td className="tb-row-actions">
                      {!archived && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm tb-remove"
                          aria-label={`Regel ${index + 1} löschen`}
                          title="Regel löschen"
                          onClick={() =>
                            edit((rules) => {
                              rules.splice(
                                rules.findIndex((candidate) => candidate.id === rule.id),
                                1,
                              );
                            })
                          }
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {!archived && (
          <div className="toolbar">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                edit((rules) => {
                  rules.push({ id: newId('r'), match: '', verantwortlich: '', ort: '' });
                })
              }
            >
              <Icon name="plus" size={15} /> Regel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                let changed = 0;
                void run(() =>
                  changeWeek(week.sheet, (draft, state) => {
                    changed = applyRulesToWeek(draft, state);
                  }),
                ).then(
                  (ok) =>
                    ok &&
                    notify(
                      changed
                        ? `${changed} ${changed === 1 ? 'Eintrag' : 'Einträge'} ergänzt.`
                        : 'Keine leeren Felder mit passender Regel gefunden.',
                    ),
                );
              }}
            >
              Regeln auf leere Felder anwenden
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost spacer"
              onClick={() =>
                edit((rules) => {
                  rules.splice(0, rules.length, ...structuredClone([...DEFAULT_TB_RULES]));
                })
              }
            >
              <Icon name="undo" size={15} /> Standardregeln wiederherstellen
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
