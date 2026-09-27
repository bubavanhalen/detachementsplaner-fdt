import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  TB_SECTION_HEADINGS,
  TB_WEEKDAY_NAMES,
  TB_WEEKDAYS,
  type TbConflict,
  type TbConflictType,
  type TbEntry,
  type TbWeek,
  type TbWeekday,
} from '../../model/tagesbefehl';
import { Icon } from '../Icon';
import { InlineText } from './fields';
import { RulesEditor } from './RulesEditor';
import { changeWeek, type TbStepProps } from './tbStore';
import {
  bucketKey,
  dayGroups,
  insertEntry,
  manualEntry,
  moveEntry,
  openConflicts,
  parseBucketKey,
  relocateEntry,
  reviewBuckets,
  reviewDays,
  sourceDetails,
  weekConflicts,
} from './weekTools';

export const CONFLICT_LABELS: Record<TbConflictType, string> = {
  label_vs_position: 'Zeit im Text ≠ Position',
  footnote_vs_box: 'Fussnote ≠ Feld',
  footnote_missing_text: 'Fussnote ohne Text',
  footnote_missing_marker: 'Fussnote ohne Marker',
  footnote_without_time: 'Fussnote ohne Zeit',
  overlap: 'Überschneidung',
  location_overlap: 'Gleichzeitig an zwei Orten',
  unknown_abbreviation: 'Unbekannte Abkürzung',
  naming: 'Bezeichnung prüfen',
  ambiguous: 'Unklar',
};

const conflictLabel = (conflict: TbConflict): string => CONFLICT_LABELS[conflict.type] ?? 'Hinweis';

type EntryField = 'zeit' | 'taetigkeit' | 'verantwortlich' | 'ort';
const FIELDS: { key: EntryField; label: string }[] = [
  { key: 'zeit', label: 'Zeit' },
  { key: 'taetigkeit', label: 'Tätigkeit' },
  { key: 'verantwortlich', label: 'Verantwortlich' },
  { key: 'ort', label: 'Ort' },
];

export function ReviewStep({ project, tb, archived, run, week }: TbStepProps & { week: TbWeek }) {
  const days = reviewDays(week);
  const [selectedDay, setDay] = useState<TbWeekday | ''>('');
  const day: TbWeekday | undefined =
    selectedDay && days.includes(selectedDay) ? selectedDay : days[0];
  const [target, setTarget] = useState<{ id: string; nonce: number } | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const table = useRef<HTMLDivElement>(null);

  const conflicts = useMemo(() => weekConflicts(week), [week]);
  const open = openConflicts(week, conflicts);
  const checked = conflicts.filter((conflict) => week.dismissedConflicts.includes(conflict.id));
  const warnings = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const conflict of open)
      for (const id of conflict.entryIds) map.set(id, [...(map.get(id) ?? []), conflict.message]);
    return map;
  }, [open]);

  // Conflict click → show the day, scroll to and focus the first field of the row.
  useEffect(() => {
    if (!target) return;
    const row = Array.from(
      table.current?.querySelectorAll<HTMLElement>('tr[data-entry-id]') ?? [],
    ).find((item) => item.dataset.entryId === target.id);
    if (!row) return;
    row.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    (row.querySelector<HTMLElement>('input, select') ?? row).focus();
  }, [target]);

  const edit = (mutator: (draft: TbWeek) => void) =>
    run(() => changeWeek(week.sheet, (draft) => mutator(draft)));
  const setField = (entry: TbEntry, key: EntryField, value: string) =>
    edit((draft) => {
      const item = draft.entries.find((candidate) => candidate.id === entry.id);
      if (item) item[key] = value;
    });
  const add = (dayValue: TbWeekday, key: string, taetigkeit = '', rawText = '') => {
    const { section, group } = parseBucketKey(key);
    const entry = manualEntry(dayValue, section, group, taetigkeit);
    if (rawText) entry.source = { kind: 'manual', rawText };
    void edit((draft) => insertEntry(draft, entry)).then((ok) => {
      if (ok) setTarget({ id: entry.id, nonce: Date.now() });
    });
  };
  const jump = (conflict: TbConflict) => {
    setDay(conflict.day);
    if (conflict.entryIds[0]) setTarget({ id: conflict.entryIds[0], nonce: Date.now() });
  };
  const toggleConflict = (id: string, dismissed: boolean) =>
    void edit((draft) => {
      draft.dismissedConflicts = dismissed
        ? [...new Set([...draft.dismissedConflicts, id])]
        : draft.dismissedConflicts.filter((item) => item !== id);
    });

  if (!day)
    return (
      <section className="card empty">
        <span className="empty-icon">
          <Icon name="calendar" />
        </span>
        <h2>Diese Woche hat noch keine Tage.</h2>
        <p>Unter «WAP laden» die Tage mit Tagesbefehl wählen oder ein anderes Blatt einlesen.</p>
      </section>
    );

  const buckets = reviewBuckets(week, day);
  const groups = dayGroups(week, day);
  const sectionOptions = [
    { key: bucketKey('dienstbetrieb'), label: TB_SECTION_HEADINGS.dienstbetrieb },
    ...groups.map((group) => ({ key: bucketKey('dienstbetrieb', group), label: `1 · ${group}` })),
    { key: bucketKey('besonderes'), label: TB_SECTION_HEADINGS.besonderes },
    { key: bucketKey('rapporte'), label: TB_SECTION_HEADINGS.rapporte },
  ];
  const dayEntries = week.entries.filter((entry) => entry.day === day);
  const notes = [
    { key: 'wochenziele', title: 'Wochenziele', lines: week.notes.wochenziele },
    {
      key: 'bemerkungen',
      title: 'Bemerkungen (gelten durchgehend)',
      lines: week.notes.bemerkungen,
    },
  ];

  return (
    <div className="tb-review">
      <div className="tb-review-main">
        <div className="segmented tb-day-tabs" role="toolbar" aria-label="Tag wählen">
          {days.map((item) => {
            const count = open.filter((conflict) => conflict.day === item).length;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={item === day}
                onClick={() => setDay(item)}
              >
                <span>{item}</span>
                {!week.days.includes(item) && <small>ohne TB</small>}
                {count > 0 && (
                  <span className="tb-count" title={`${count} offene Hinweise`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <section className="card tb-table-card" aria-labelledby="tb-review-day">
          <header className="card-head">
            <h2 id="tb-review-day">
              <Icon name="calendar" /> {TB_WEEKDAY_NAMES[day]}
            </h2>
            <span className="muted tb-head-note">{dayEntries.length} Einträge</span>
          </header>
          {!week.days.includes(day) && (
            <div className="card-body tb-card-callout">
              <div className="callout callout-warning">
                <Icon name="info" />
                <p className="callout-body">
                  Für diesen Tag wird kein Tagesbefehl ausgegeben (unter «WAP laden» aktivierbar).
                </p>
              </div>
            </div>
          )}
          <div className="data-table tb-edit-table tb-review-table" ref={table}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="tb-col-time">Zeit</th>
                    <th>Tätigkeit</th>
                    <th className="tb-col-who">Verantwortlich</th>
                    <th className="tb-col-where">Ort</th>
                    <th className="tb-col-section">Abschnitt/Gruppe</th>
                    <th className="tb-col-actions">
                      <span className="visually-hidden">Aktionen</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((bucket) => (
                    <Fragment key={bucket.key}>
                      <tr
                        className={`tb-bucket ${bucket.group ? 'tb-bucket-group' : ''}`}
                        data-bucket={bucket.key}
                      >
                        <th scope="colgroup" colSpan={5}>
                          {bucket.heading}
                          {!bucket.printed && (
                            <span className="tb-warning-text">
                              {' '}
                              · wird am Wochenende nicht ausgegeben
                            </span>
                          )}
                        </th>
                        <td className="tb-row-actions">
                          {!archived && (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                aria-label={`Eintrag in «${bucket.heading}» hinzufügen`}
                                onClick={() => add(day, bucket.key)}
                              >
                                <Icon name="plus" size={15} /> Eintrag
                              </button>
                              {bucket.group && !bucket.entries.length && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon btn-sm tb-remove"
                                  aria-label={`Gruppe «${bucket.group}» entfernen`}
                                  title="Gruppe entfernen"
                                  onClick={() =>
                                    void edit((draft) => {
                                      draft.groups[day] = (draft.groups[day] ?? []).filter(
                                        (group) => group !== bucket.group,
                                      );
                                    })
                                  }
                                >
                                  <Icon name="x" size={15} />
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                      {bucket.entries.map((entry, index) => {
                        const details = sourceDetails(entry);
                        const issues = warnings.get(entry.id) ?? [];
                        const isOpen = expanded.includes(entry.id);
                        return (
                          <Fragment key={entry.id}>
                            <tr
                              data-entry-id={entry.id}
                              tabIndex={-1}
                              title={details.join('\n') || undefined}
                              className={[
                                issues.length ? 'tb-row-warn' : '',
                                target?.id === entry.id ? 'is-target' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {FIELDS.map((field) => (
                                <td
                                  key={field.key}
                                  className={field.key === 'zeit' ? 'tb-col-time' : ''}
                                >
                                  <InlineText
                                    aria-label={field.label}
                                    value={entry[field.key]}
                                    disabled={archived}
                                    onCommit={(value) => void setField(entry, field.key, value)}
                                  />
                                </td>
                              ))}
                              <td>
                                <select
                                  aria-label="Abschnitt/Gruppe"
                                  value={bucketKey(entry.section, entry.group)}
                                  disabled={archived}
                                  onChange={(event) => {
                                    const key = event.target.value;
                                    void edit((draft) => relocateEntry(draft, entry.id, key));
                                  }}
                                >
                                  {sectionOptions.map((option) => (
                                    <option key={option.key} value={option.key}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="tb-row-actions">
                                <button
                                  type="button"
                                  className={`btn btn-ghost btn-icon btn-sm tb-info ${
                                    entry.source?.flags?.length ? 'has-flags' : ''
                                  } ${issues.length ? 'has-issues' : ''}`}
                                  aria-label="Quelle und Hinweise anzeigen"
                                  aria-expanded={isOpen}
                                  title={[...details, ...issues].join('\n') || 'Keine Quelle'}
                                  onClick={() =>
                                    setExpanded((old) =>
                                      old.includes(entry.id)
                                        ? old.filter((id) => id !== entry.id)
                                        : [...old, entry.id],
                                    )
                                  }
                                >
                                  <Icon name={issues.length ? 'alert' : 'info'} size={16} />
                                </button>
                                {!archived && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-icon btn-sm"
                                      aria-label="Nach oben"
                                      title="Nach oben"
                                      disabled={index === 0}
                                      onClick={() =>
                                        void edit((draft) => {
                                          moveEntry(draft, entry.id, -1);
                                        })
                                      }
                                    >
                                      <Icon name="chevronDown" size={16} className="tb-icon-up" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-icon btn-sm"
                                      aria-label="Nach unten"
                                      title="Nach unten"
                                      disabled={index === bucket.entries.length - 1}
                                      onClick={() =>
                                        void edit((draft) => {
                                          moveEntry(draft, entry.id, 1);
                                        })
                                      }
                                    >
                                      <Icon name="chevronDown" size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-icon btn-sm tb-remove"
                                      aria-label="Eintrag löschen"
                                      title="Eintrag löschen"
                                      onClick={() =>
                                        void edit((draft) => {
                                          draft.entries = draft.entries.filter(
                                            (item) => item.id !== entry.id,
                                          );
                                        })
                                      }
                                    >
                                      <Icon name="trash" size={15} />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="tb-source-row">
                                <td colSpan={6}>
                                  <ul>
                                    {[...details, ...issues].map((line) => (
                                      <li key={line}>{line}</li>
                                    ))}
                                    {!details.length && !issues.length && <li>Keine Quelle</li>}
                                  </ul>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {!bucket.entries.length && (
                        <tr className="tb-empty-row">
                          <td colSpan={6} className="muted">
                            Keine Einträge
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {!archived && (
            <form
              className="card-body toolbar tb-group-form"
              onSubmit={(event) => {
                event.preventDefault();
                const name = groupName.trim();
                if (!name) return;
                void edit((draft) => {
                  const list = draft.groups[day] ?? [];
                  if (!list.includes(name)) draft.groups[day] = [...list, name];
                }).then((ok) => ok && setGroupName(''));
              }}
            >
              <label className="field grow">
                Gruppe unter «1 Dienstbetrieb / Ausbildung» hinzufügen
                <input
                  type="text"
                  value={groupName}
                  placeholder="z. B. Zug 1"
                  onChange={(event) => setGroupName(event.target.value)}
                />
              </label>
              <button type="submit" className="btn" disabled={!groupName.trim()}>
                <Icon name="plus" size={16} /> Gruppe hinzufügen
              </button>
            </form>
          )}
        </section>
        <RulesEditor {...{ project, tb, archived, run, week }} />
      </div>

      <aside className="tb-review-side">
        <section className="card tb-conflicts" aria-labelledby="tb-conflicts-title">
          <header className="card-head">
            <h2 id="tb-conflicts-title">
              <Icon name="alert" /> Hinweise
            </h2>
            <span className={`badge ${open.length ? 'badge-warning' : 'badge-success'}`}>
              {open.length ? `${open.length} offen` : 'Alle geprüft'}
            </span>
          </header>
          <div className="card-body tb-card-stack">
            {!conflicts.length && <p className="muted">Keine Hinweise für diese Woche.</p>}
            {TB_WEEKDAYS.map((item) => {
              const list = open.filter((conflict) => conflict.day === item);
              if (!list.length) return null;
              return (
                <div key={item} className="tb-conflict-day">
                  <h3>{TB_WEEKDAY_NAMES[item]}</h3>
                  <ul>
                    {list.map((conflict) => (
                      <li key={conflict.id} className="tb-conflict">
                        <button
                          type="button"
                          className="tb-conflict-link"
                          aria-label={`${conflictLabel(conflict)}: ${conflict.message}`}
                          onClick={() => jump(conflict)}
                        >
                          <small>{conflictLabel(conflict)}</small>
                          <span>{conflict.message}</span>
                        </button>
                        {!archived && (
                          <button
                            type="button"
                            className="btn btn-sm tb-check"
                            aria-label={`Als geprüft markieren: ${conflict.message}`}
                            title="Als geprüft markieren"
                            onClick={() => toggleConflict(conflict.id, true)}
                          >
                            <Icon name="check" size={14} /> geprüft
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {checked.length > 0 && (
              <details className="tb-details tb-checked">
                <summary>Geprüft ({checked.length})</summary>
                <ul>
                  {checked.map((conflict) => (
                    <li key={conflict.id} className="tb-conflict">
                      <button
                        type="button"
                        className="tb-conflict-link"
                        aria-label={`${conflict.day} · ${conflictLabel(conflict)}: ${conflict.message}`}
                        onClick={() => jump(conflict)}
                      >
                        <small>
                          {conflict.day} · {conflictLabel(conflict)}
                        </small>
                        <span>{conflict.message}</span>
                      </button>
                      {!archived && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm tb-check"
                          aria-label={`Wieder öffnen: ${conflict.message}`}
                          onClick={() => toggleConflict(conflict.id, false)}
                        >
                          Wieder öffnen
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </section>

        <section className="card tb-notes" aria-labelledby="tb-notes-title">
          <header className="card-head">
            <h2 id="tb-notes-title">
              <Icon name="flag" /> Wochenziele & Bemerkungen
            </h2>
          </header>
          <div className="card-body tb-card-stack">
            {notes.map((group) => (
              <div key={group.key}>
                <h3>{group.title}</h3>
                {group.lines.length ? (
                  <ul>
                    {group.lines.map((line, index) => {
                      const taken = dayEntries.some(
                        (entry) =>
                          entry.section === 'besonderes' &&
                          (entry.taetigkeit === line || entry.source?.rawText === line),
                      );
                      return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: lines may repeat
                        <li key={`${group.key}-${index}`} className="tb-note">
                          <span>{line}</span>
                          {!archived && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm tb-note-take"
                              disabled={taken}
                              aria-label={`In Besonderes am ${TB_WEEKDAY_NAMES[day]} übernehmen: ${line}`}
                              title={
                                taken ? 'Bereits übernommen' : 'In «2 Besonderes» dieses Tages'
                              }
                              onClick={() => add(day, bucketKey('besonderes'), line, line)}
                            >
                              {taken ? (
                                <>
                                  <Icon name="check" size={14} /> {day}
                                </>
                              ) : (
                                <>
                                  <Icon name="arrowRight" size={14} /> Besonderes {day}
                                </>
                              )}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted">Keine Angaben im WAP.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
