import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CopyButton } from '../components/CopyButton';
import { type DataColumn, DataTable } from '../components/DataTable';
import { DetachmentDialog } from '../components/DetachmentDialog';
import { Icon } from '../components/Icon';
import { ErrorBox, errorText, Modal } from '../components/Modal';
import { displayDate } from '../io/text';
import { derivePisa, entrySignature, projectSignature, validateProject, validEc } from '../model';
import type { OrderMode, Person, PisaEntry, Project } from '../model/types';
import { changeProject, notify, useProject } from '../store';
import { isTyping, openOverlay } from '../ui';
import { policyConfirmed, policyRequired } from '../workflow';
import './pages.css';

const personColumns: DataColumn<Person>[] = [
  {
    id: 'number',
    header: 'Versicherten-Nr.',
    value: (person) => person.pnr ?? '',
    cell: (person) => <span className="mono">{person.pnr || '—'}</span>,
  },
  {
    id: 'rank',
    header: 'Grad',
    value: (person) => person.grad,
    cell: (person) => person.grad || '—',
  },
  {
    id: 'name',
    header: 'Name / Vorname',
    value: (person) => person.name,
    cell: (person) => <strong>{person.name}</strong>,
  },
  {
    id: 'function',
    header: 'Funktion',
    value: (person) => person.funktion,
    cell: (person) => person.funktion || '—',
  },
  {
    id: 'copy',
    header: '',
    cell: (person) => (
      <CopyButton value={person.pnr ?? ''} label={`Versicherten-Nr. von ${person.name} kopieren`} />
    ),
  },
];

function kindLabel(entry: PisaEntry, confirmed: boolean): string {
  if (!confirmed) return 'Entwurf · Aufgebotsart offen';
  return entry.kind === 'additional'
    ? 'Zusatzmarschbefehl'
    : entry.extraIds.length
      ? 'Haupt-MB mit Zusatz-MB'
      : 'Hauptmarschbefehl';
}

export default function PisaPage() {
  const project = useProject();
  const entries = derivePisa(project);
  const issues = validateProject(project);
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<'steps' | 'overview'>('steps');
  const [policyOpen, setPolicyOpen] = useState(false);
  const [editDetails, setEditDetails] = useState(false);
  const [codeEntry, setCodeEntry] = useState<PisaEntry | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const archived = Boolean(project.archive);
  const required = policyRequired(project);
  const confirmed = policyConfirmed(project);
  const verified = project.pisa.verified?.signature === projectSignature(project);
  const isChecked = (entry: PisaEntry) =>
    project.pisa.entered[entry.id]?.signature === entrySignature(project, entry);
  const checkedCount = entries.filter(isChecked).length;
  const mutate = (callback: Parameters<typeof changeProject>[0]) => {
    setError('');
    try {
      changeProject(callback);
      return true;
    } catch (caught) {
      setError(errorText(caught));
      return false;
    }
  };
  const selectedPeople = selected
    ? project.persons.filter((person) => selected.personIds.includes(person.id))
    : [];

  // J/K or arrow keys step through the checklist.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('dialog[open]') || !entries.length) return;
      const step = event.key === 'j' ? 1 : event.key === 'k' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const index = entries.findIndex((entry) => entry.id === selected?.id);
      const next = entries[Math.max(0, Math.min(entries.length - 1, index + step))];
      if (next) setSelectedId(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entries, selected?.id]);

  const markChecked = (entry: PisaEntry) => {
    if (
      mutate((draft) => {
        draft.pisa.entered[entry.id] = {
          at: new Date().toISOString(),
          signature: entrySignature(draft, entry),
        };
      })
    ) {
      // Continue with the next open entry to keep the flow going.
      const index = entries.findIndex((item) => item.id === entry.id);
      const next = [...entries.slice(index + 1), ...entries.slice(0, index)].find(
        (item) => !isChecked(item) && item.id !== entry.id,
      );
      if (next) setSelectedId(next.id);
      notify(
        next
          ? `EC ${entry.ec || '—'} abgeglichen. Weiter mit ${next.ec || next.name}.`
          : `EC ${entry.ec || '—'} abgeglichen. Alle Einträge sind markiert.`,
        { tone: 'success' },
      );
    }
  };

  return (
    <div className="page page-wide">
      {required && (
        <div className={`callout ${confirmed ? 'callout-success' : 'callout-warning'}`}>
          <Icon name={confirmed ? 'checkCircle' : 'info'} />
          <div className="callout-body">
            <strong>
              {confirmed
                ? `Aufgebotsart: ${project.orderPolicy.mode === 'separate' ? 'Separate KVK-/WK-MB' : 'Durchgehender MB'}`
                : 'Aufgebotsart noch bestätigen'}
            </strong>
            {confirmed
              ? `KF-Bestätigung erfasst: ${project.orderPolicy.confirmedBy}`
              : 'Der PAT beschreibt unterschiedliche KVK-/WK-Strukturen. Die Vorschau bleibt ein Entwurf, bis die KF-Auskunft für diesen Dienst erfasst ist.'}
            <details className="inline-details">
              <summary>Warum braucht es diese Bestätigung?</summary>
              <p>
                PAT S. 85 beschreibt einen MB für KVK und den anschliessenden WK. S. 93–94 verlangen
                separate ECs. Die App leitet daraus keinen Standard ab. Deine verbundenen
                Planungskarten bleiben gleich; nur die PISA-Struktur folgt der bestätigten
                Aufgebotsart.
              </p>
            </details>
          </div>
          <div className="callout-actions">
            <button
              type="button"
              className={`btn btn-sm ${confirmed ? '' : 'btn-primary'}`}
              disabled={archived}
              onClick={() => setPolicyOpen(true)}
            >
              {confirmed ? 'Auskunft bearbeiten' : 'KF-Auskunft erfassen'}
            </button>
          </div>
        </div>
      )}
      <ErrorBox message={error} />
      {issues.length > 0 && <IssueSummary project={project} issues={issues} />}

      {!entries.length ? (
        <section className="card empty">
          <span className="empty-icon">
            <Icon name="send" />
          </span>
          <h2>Hier erscheinen deine PISA-Einträge.</h2>
          <p>Erstelle zuerst Detachemente und teile Personen zu.</p>
          <div className="actions">
            <Link className="btn btn-primary" to="/">
              Planung öffnen
            </Link>
          </div>
        </section>
      ) : (
        <div className="pisa-layout">
          <aside className="pisa-rail">
            <div className="card pisa-progress">
              <div className="row">
                <strong>
                  {verified
                    ? 'Plan abgeglichen'
                    : `${checkedCount} / ${entries.length} EC abgeglichen`}
                </strong>
                {verified && <span className="badge badge-success">Fertig</span>}
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-label="Abgleich"
                aria-valuemin={0}
                aria-valuemax={entries.length}
                aria-valuenow={checkedCount}
              >
                <span style={{ width: `${(checkedCount / entries.length) * 100}%` }} />
              </div>
              <button
                type="button"
                className={`btn btn-sm ${checkedCount === entries.length && !verified ? 'btn-primary' : ''}`}
                disabled={
                  archived ||
                  !confirmed ||
                  issues.length > 0 ||
                  checkedCount !== entries.length ||
                  verified
                }
                onClick={() =>
                  mutate((draft) => {
                    draft.pisa.verified = {
                      at: new Date().toISOString(),
                      signature: projectSignature(draft),
                    };
                  }) && notify('Plan abschliessend abgeglichen.', { tone: 'success' })
                }
              >
                <Icon name="checkCircle" size={15} /> Plan abschliessend abgleichen
              </button>
              <p className="muted small-note">
                Änderungen an der Planung heben den betreffenden Abgleich automatisch auf. Es werden
                keine Daten an PISA gesendet.
              </p>
            </div>
            <div className="card">
              <div className="rail-head">
                <div className="segmented" role="tablist" aria-label="Ansicht">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === 'steps'}
                    onClick={() => setView('steps')}
                  >
                    Schrittweise
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === 'overview'}
                    onClick={() => setView('overview')}
                  >
                    Übersicht
                  </button>
                </div>
                <span className="muted rail-hint" title="Mit J und K durch die Einträge">
                  <span className="kbd">J</span>
                  <span className="kbd">K</span>
                </span>
              </div>
              <ul className="entry-list" aria-label="PISA-Einträge">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={`entry-item ${entry.kind === 'additional' && confirmed ? 'is-extra' : ''}`}
                      aria-pressed={selected?.id === entry.id}
                      onClick={() => {
                        setSelectedId(entry.id);
                        setView('steps');
                      }}
                    >
                      <span className={`ec ${entry.ec ? '' : 'is-missing'}`}>
                        {entry.ec || 'EC?'}
                      </span>
                      <span className="grow">
                        <span className="truncate">{entry.name}</span>
                        <small>
                          {kindLabel(entry, confirmed)}
                          {entry.generated ? ' · abgeleitet' : ''}
                        </small>
                      </span>
                      <span
                        className={`entry-check ${isChecked(entry) ? 'is-done' : ''}`}
                        title={isChecked(entry) ? 'Abgeglichen' : 'Offen'}
                      >
                        <Icon name="check" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {view === 'overview' ? (
            <section className="card">
              <header className="card-head">
                <h2>Alle Einträge · nach PAT-Feldfolge</h2>
                <span className="badge">Lokale Vorschau</span>
              </header>
              <div className="table-scroll">
                <table className="table overview-table">
                  <thead>
                    <tr>
                      <th>EC</th>
                      <th>Bezeichnung</th>
                      <th>Einrücken</th>
                      <th>Ort / Treffpunkt</th>
                      <th>Anzug</th>
                      <th>Entlassung</th>
                      <th>Entlassungsort</th>
                      <th>Bemerkungen</th>
                      <th>Pers.</th>
                      <th>Abgleich</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      // The EC list in the rail is the keyboard path; a row click is a shortcut.
                      <tr
                        key={entry.id}
                        onClick={() => {
                          setSelectedId(entry.id);
                          setView('steps');
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <span className={`ec ${entry.ec ? '' : 'is-missing'}`}>
                            {entry.ec || '—'}
                          </span>
                        </td>
                        <td className="wrap">
                          <strong>{entry.name}</strong>
                          <small>{kindLabel(entry, confirmed)}</small>
                        </td>
                        <td>
                          {entry.details.datum ? displayDate(entry.details.datum) : '—'}
                          <small>{entry.details.von || '—'}</small>
                        </td>
                        <td className="wrap">
                          {entry.details.ort || '—'}
                          <small>{entry.details.treffpunkt}</small>
                        </td>
                        <td>{entry.details.anzug || '—'}</td>
                        <td>
                          {entry.details.bisDatum ? displayDate(entry.details.bisDatum) : '—'}
                        </td>
                        <td>{entry.details.entlassungsort || '—'}</td>
                        <td className="wrap">{entry.details.bem || '—'}</td>
                        <td className="num">{confirmed ? entry.personIds.length : '—'}</td>
                        <td>
                          {isChecked(entry) ? (
                            <span className="badge badge-success">
                              <Icon name="check" /> Abgeglichen
                            </span>
                          ) : (
                            <span className="badge">Offen</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            selected && (
              <section className="card pisa-detail" aria-label={`EC ${selected.ec || '—'}`}>
                <header className="pisa-detail-head">
                  <span className={`ec ${selected.ec ? '' : 'is-missing'}`}>
                    {selected.ec || '—'}
                  </span>
                  <div className="grow">
                    <h2>{selected.name}</h2>
                    <p>
                      {kindLabel(selected, confirmed)}
                      {selected.generated ? ' · abgeleitet' : ''}
                    </p>
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={archived}
                      onClick={() => {
                        setCode(selected.ec);
                        setCodeEntry(selected);
                      }}
                    >
                      EC bearbeiten
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={archived}
                      onClick={() => setEditDetails(true)}
                    >
                      <Icon name="edit" size={15} /> Angaben bearbeiten
                    </button>
                  </div>
                </header>
                <div className="pisa-instruction">
                  <Icon name={confirmed ? 'info' : 'alert'} />
                  <div>
                    <strong>
                      {!confirmed
                        ? 'Personenzuteilung erst nach KF-Bestätigung.'
                        : selected.kind === 'additional'
                          ? 'Hier keine Personen direkt zuteilen.'
                          : `${selected.personIds.length} Personen diesem EC direkt zuteilen.`}
                    </strong>
                    <p>
                      {!confirmed
                        ? 'Diese Planungskarte ist noch kein fertiger PISA-Eintrag. Nach bestätigter Aufgebotsart erscheinen hier die genauen Empfänger und Zusatz-MB.'
                        : selected.kind === 'additional'
                          ? 'Die Empfänger werden über den Hauptmarschbefehl bestimmt, der diesen Zusatz-MB enthält.'
                          : selected.extraIds.length
                            ? 'Zuerst die aufgeführten Zusatz-MB verknüpfen, dann genau diese Personen zum Haupt-MB hinzufügen.'
                            : 'Diese Personen erhalten den Hauptmarschbefehl ohne Zusatz-MB.'}
                    </p>
                  </div>
                </div>
                <FieldList entry={selected} entries={entries} confirmed={confirmed} />
                {confirmed && selectedPeople.length > 0 && (
                  <div className="pisa-people">
                    <div className="section-title">
                      <h3>Personen · {selectedPeople.length}</h3>
                      <CopyButton
                        className="btn btn-sm btn-ghost"
                        label="Versicherten-Nummern kopieren"
                        value={selectedPeople.map((person) => person.pnr ?? '').join('\n')}
                      >
                        Nummern kopieren
                      </CopyButton>
                    </div>
                    <DataTable
                      data={selectedPeople}
                      columns={personColumns}
                      getRowId={(person) => person.id}
                      pageSize={50}
                    />
                  </div>
                )}
                <footer className="pisa-footer">
                  <span className="spacer">
                    <CopyButton
                      className="btn btn-sm"
                      label="Personenliste kopieren"
                      value={
                        confirmed
                          ? selectedPeople
                              .map((person) =>
                                [person.pnr ?? '', person.grad, person.name].join('\t'),
                              )
                              .join('\n')
                          : ''
                      }
                    >
                      Personenliste kopieren
                    </CopyButton>
                  </span>
                  {isChecked(selected) ? (
                    <>
                      <span className="badge badge-success">
                        <Icon name="check" /> Abgeglichen
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        disabled={archived}
                        onClick={() =>
                          mutate((draft) => {
                            delete draft.pisa.entered[selected.id];
                          })
                        }
                      >
                        Markierung aufheben
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={archived || !confirmed || issues.length > 0}
                      title={
                        issues.length
                          ? 'Zuerst die offenen Punkte oben klären'
                          : !confirmed
                            ? 'Zuerst die Aufgebotsart bestätigen'
                            : undefined
                      }
                      onClick={() => markChecked(selected)}
                    >
                      <Icon name="check" size={16} /> EC {selected.ec || '—'} als abgeglichen
                      markieren
                    </button>
                  )}
                </footer>
              </section>
            )
          )}
        </div>
      )}
      {policyOpen && <PolicyDialog onClose={() => setPolicyOpen(false)} />}
      {editDetails && selected && (
        <DetachmentDialog
          group={project.dets.find((group) => group.id === selected.sourceId)}
          onClose={() => setEditDetails(false)}
        />
      )}
      {codeEntry && (
        <Modal
          title="PISA-EC bearbeiten"
          description="Dieser Code erscheint in der PISA-Vorschau und bleibt für diesen Eintrag gespeichert."
          onClose={() => setCodeEntry(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setCodeEntry(null)}>
                Abbrechen
              </button>
              <button
                type="submit"
                form="ec-form"
                className="btn btn-primary"
                disabled={!validEc(code)}
              >
                EC speichern
              </button>
            </>
          }
        >
          <ErrorBox message={error} />
          <form
            id="ec-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!validEc(code)) return;
              setError('');
              try {
                changeProject((draft) => {
                  if (codeEntry.generated) draft.generatedCodes[codeEntry.id] = code;
                  else {
                    const group = draft.dets.find((item) => item.id === codeEntry.sourceId);
                    if (group) group.ec = code;
                  }
                });
                setCodeEntry(null);
              } catch (caught) {
                setError(errorText(caught));
              }
            }}
          >
            <div className="field">
              <label htmlFor="ec-input">EC</label>
              <input
                id="ec-input"
                value={code}
                maxLength={2}
                className="mono"
                autoComplete="off"
                aria-describedby="ec-hint"
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
              <span className="hint" id="ec-hint">
                Genau zwei Zeichen, z. B. W2.
              </span>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function FieldList({
  entry,
  entries,
  confirmed,
}: {
  entry: PisaEntry;
  entries: PisaEntry[];
  confirmed: boolean;
}) {
  const details = entry.details;
  const extras = !confirmed
    ? 'Zuordnung erst nach KF-Bestätigung'
    : entry.extraIds.length
      ? entry.extraIds
          .map((id) => {
            const extra = entries.find((item) => item.id === id);
            return extra ? `${extra.ec || 'EC?'} · ${extra.name}` : 'Fehlender Zusatz-MB';
          })
          .join(', ')
      : 'Keine';
  const rows: [string, string, boolean][] = [
    ['EC', entry.ec, true],
    ['Bezeichnung', entry.name, true],
    ['Einrücken · Datum', details.datum ? displayDate(details.datum) : '', true],
    ['Einrücken · Zeit', details.von, true],
    ['Einrückungsort', details.ort, true],
    ['Treffpunkt', details.treffpunkt, true],
    ['Anzug', details.anzug, true],
    ['Entlassung · Datum', details.bisDatum ? displayDate(details.bisDatum) : '', true],
    ['Entlassungsort', details.entlassungsort, true],
    ['Bemerkungen', details.bem, false],
    ['Zusatzmarschbefehle', extras, false],
  ];
  return (
    <ul className="field-list" aria-label="Detailangaben MB nach PAT-Feldfolge">
      {rows.map(([label, value, needed], index) => (
        <li key={label}>
          <span className="field-no">{index + 1}</span>
          <span className="field-label">{label}</span>
          <span className={`field-value ${!value && needed ? 'is-empty' : ''}`}>
            {value || (needed ? 'Noch offen' : '—')}
          </span>
          <CopyButton value={value} label={`${label} kopieren`} />
        </li>
      ))}
    </ul>
  );
}

function IssueSummary({
  project,
  issues,
}: {
  project: Project;
  issues: ReturnType<typeof validateProject>;
}) {
  return (
    <details className="callout callout-warning issue-summary" open={issues.length <= 5}>
      <summary>
        <Icon name="alert" />
        <strong>{issues.length} Punkte vor dem abschliessenden Abgleich</strong>
      </summary>
      <ul className="issue-list">
        {issues.map((issue) => {
          const person = project.persons.find((item) => item.id === issue.personId);
          const group = project.dets.find((item) => item.id === issue.groupId);
          const label = person ? [person.grad, person.name].filter(Boolean).join(' ') : group?.name;
          return (
            <li key={`${issue.code}-${issue.personId ?? issue.groupId ?? ''}-${issue.message}`}>
              <span>
                {label && (
                  <>
                    <Link
                      to={person ? '/persons' : '/'}
                      onClick={() =>
                        person
                          ? openOverlay({ peopleIntent: { personId: person.id } })
                          : group &&
                            openOverlay({ planningIntent: { kind: 'focus', id: group.id } })
                      }
                    >
                      {label}
                    </Link>
                    :{' '}
                  </>
                )}
                {issue.message}
              </span>
            </li>
          );
        })}
      </ul>
      <Link to="/" className="btn-link issue-summary-link">
        Zur Planung <Icon name="arrowRight" size={14} />
      </Link>
    </details>
  );
}

function PolicyDialog({ onClose }: { onClose: () => void }) {
  const project = useProject();
  const [mode, setMode] = useState<OrderMode>(project.orderPolicy.mode);
  const [confirmedBy, setConfirmedBy] = useState(project.orderPolicy.confirmedBy);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      title="KF-Auskunft zur Aufgebotsart"
      description="Die Auswahl gilt für diesen Dienst. Nur eine tatsächlich erhaltene Auskunft als bestätigt erfassen."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={mode !== 'unconfirmed' && (!checked || !confirmedBy.trim())}
            onClick={() => {
              try {
                changeProject((draft) => {
                  draft.orderPolicy = {
                    mode,
                    confirmedBy: mode === 'unconfirmed' ? '' : confirmedBy.trim(),
                    confirmedAt: mode === 'unconfirmed' ? '' : new Date().toISOString(),
                  };
                });
                onClose();
              } catch (caught) {
                setError(errorText(caught));
              }
            }}
          >
            Auswahl speichern
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="option-list">
        {(
          [
            [
              'unconfirmed',
              'Noch nicht bestätigt',
              'Planung weiterführen; PISA bleibt ein Entwurf.',
            ],
            [
              'separate',
              'Separate KVK-/WK-MB',
              'Zusatz-MB für KVK ohne direkt zugeteilte Personen; WK-Haupt-MB nach benötigten Zusätzen aufgeteilt.',
            ],
            [
              'continuous',
              'Durchgehender MB',
              'Ein Haupt-MB vom ersten Einrücken bis zur letzten Entlassung für die jeweilige Personengruppe.',
            ],
          ] as const
        ).map(([value, title, detail]) => (
          <label className="option-card" key={value}>
            <input
              type="radio"
              name="policy"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </label>
        ))}
      </div>
      {mode !== 'unconfirmed' && (
        <>
          <label className="field">
            Bestätigung durch KF / Referenz
            <input
              value={confirmedBy}
              onChange={(event) => setConfirmedBy(event.target.value)}
              placeholder="KF-Auskunft / Referenz"
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            Diese Aufgebotsart wurde für diesen Dienst bestätigt.
          </label>
        </>
      )}
    </Modal>
  );
}
