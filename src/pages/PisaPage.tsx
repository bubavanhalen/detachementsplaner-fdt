import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type DataColumn, DataTable } from '../components/DataTable';
import { DetachmentDialog } from '../components/DetachmentDialog';
import { ErrorBox, errorText, Modal } from '../components/Modal';
import { derivePisa, entrySignature, projectSignature, validateProject, validEc } from '../model';
import type { OrderMode, Person, PisaEntry } from '../model/types';
import { changeProject, notify, useProject } from '../store';

const personColumns: DataColumn<Person>[] = [
  {
    id: 'number',
    header: 'Personennummer',
    value: (person) => person.pnr ?? '',
    cell: (person) => person.pnr || '—',
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
];

export default function PisaPage() {
  const project = useProject();
  const entries = derivePisa(project);
  const issues = validateProject(project);
  const [selectedId, setSelectedId] = useState('');
  const [policyOpen, setPolicyOpen] = useState(false);
  const [editDetails, setEditDetails] = useState(false);
  const [codeEntry, setCodeEntry] = useState<PisaEntry | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const archived = Boolean(project.archive);
  const policyRequired = project.connections.length > 0;
  const confirmed =
    !policyRequired ||
    (project.orderPolicy.mode !== 'unconfirmed' &&
      Boolean(project.orderPolicy.confirmedBy && project.orderPolicy.confirmedAt));
  const verified = project.pisa.verified?.signature === projectSignature(project);
  const mutate = (callback: Parameters<typeof changeProject>[0]) => {
    setError('');
    try {
      changeProject(callback);
    } catch (caught) {
      setError(errorText(caught));
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Lokal in die Zwischenablage kopiert.');
    } catch {
      setError(
        'Kopieren ist hier nicht verfügbar. Bitte die Angaben direkt in der Ansicht markieren und kopieren.',
      );
    }
  };
  const checkedCount = entries.filter(
    (entry) => project.pisa.entered[entry.id]?.signature === entrySignature(project, entry),
  ).length;
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">02 / PISA vorbereiten</p>
          <h1>So wird daraus ein Aufgebot.</h1>
          <p>
            Detailangaben und Personenzuteilung in PISA nachbilden, dann lokal als abgeglichen
            markieren.
          </p>
        </div>
        <span className={`status-pill ${verified ? 'is-good' : ''}`}>
          {verified ? 'Plan abgeglichen' : `${checkedCount} / ${entries.length} EC abgeglichen`}
        </span>
      </header>
      {policyRequired && (
        <>
          <div className={`notice ${confirmed ? '' : 'notice-warning'}`}>
            <div>
              <strong>
                {confirmed
                  ? `Aufgebotsart: ${project.orderPolicy.mode === 'separate' ? 'Separate KVK-/WK-MB' : 'Durchgehender MB'}`
                  : 'Aufgebotsart noch bestätigen'}
              </strong>
              <p>
                {confirmed
                  ? `KF-Bestätigung erfasst: ${project.orderPolicy.confirmedBy}`
                  : 'Der PAT beschreibt unterschiedliche KVK-/WK-Strukturen. Die Vorschau bleibt ein Entwurf, bis die KF-Auskunft für diesen Dienst erfasst ist.'}
              </p>
            </div>
            <button
              type="button"
              className="button-secondary"
              disabled={archived}
              onClick={() => setPolicyOpen(true)}
            >
              {confirmed ? 'Auskunft bearbeiten' : 'KF-Auskunft erfassen'}
            </button>
          </div>
          <details className="details-panel">
            <summary>Warum braucht es diese Bestätigung?</summary>
            <p>
              PAT S. 85 beschreibt einen MB für KVK und den anschliessenden WK. S. 93–94 verlangen
              separate ECs. Die App leitet daraus keinen Standard ab. Deine verbundenen
              Planungskarten bleiben gleich; nur die PISA-Struktur folgt der bestätigten
              Aufgebotsart.
            </p>
          </details>
        </>
      )}
      <ErrorBox message={error} />
      {issues.length > 0 && (
        <details className="validation-list" open>
          <summary>{issues.length} Punkte vor dem abschliessenden Abgleich</summary>
          <ul>
            {issues.map((issue) => {
              const person = project.persons.find((item) => item.id === issue.personId);
              const group = project.dets.find((item) => item.id === issue.groupId);
              const label = person
                ? [person.grad, person.name].filter(Boolean).join(' ')
                : group?.name;
              return (
                <li key={`${issue.code}-${issue.personId ?? issue.groupId ?? ''}-${issue.message}`}>
                  {label && (
                    <>
                      <Link to={person ? '/persons' : '/'}>{label}</Link>:{' '}
                    </>
                  )}
                  {issue.message}
                </li>
              );
            })}
          </ul>
          <Link to="/">Zur Planung →</Link>
        </details>
      )}
      {!entries.length ? (
        <section className="empty-state">
          <h2>Hier erscheinen deine PISA-Einträge.</h2>
          <p>Erstelle zuerst Detachemente und teile Personen zu.</p>
          <Link className="button" to="/">
            Planung öffnen
          </Link>
        </section>
      ) : (
        <>
          <section className="pisa-window">
            <header>
              <div>
                <span className="eyebrow">Schritt 1 · Nach PAT-Feldfolge</span>
                <h2>Detailangaben MB</h2>
              </div>
              <span className="badge">Lokale Vorschau</span>
            </header>
            <p className="pisa-instruction">
              {confirmed
                ? 'Jede Zeile entspricht einem EC in PISA. Eine Zeile auswählen, um Zusatz-MB und Personen zu sehen. Gemeinsame Angaben werden aus deinen Planungskarten übernommen.'
                : 'Entwurf deiner Planungskarten. Anzahl und Struktur der PISA-Einträge entstehen erst nach der KF-Bestätigung. Noch nicht in PISA übertragen.'}
            </p>
            <div className="table-scroll">
              <table className="pisa-table">
                <thead>
                  <tr>
                    <th>EC</th>
                    <th>Bezeichnung</th>
                    <th>
                      Einrücken
                      <br />
                      Datum / Zeit
                    </th>
                    <th>Ort / Treffpunkt</th>
                    <th>Anzug</th>
                    <th>
                      Entlassung
                      <br />
                      Datum
                    </th>
                    <th>Entlassungsort</th>
                    <th>Bemerkungen</th>
                    <th>Personen</th>
                    <th>Abgleich</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const checked =
                      project.pisa.entered[entry.id]?.signature === entrySignature(project, entry);
                    return (
                      <tr
                        className={selected?.id === entry.id ? 'selected-row' : ''}
                        key={entry.id}
                      >
                        <td>
                          <button
                            type="button"
                            className="ec-button"
                            onClick={() => setSelectedId(entry.id)}
                            aria-pressed={selected?.id === entry.id}
                          >
                            {entry.ec || 'EC?'}
                          </button>
                        </td>
                        <td>
                          <strong>{entry.name}</strong>
                          <small>
                            {!confirmed
                              ? 'Entwurf · Aufgebotsart offen'
                              : entry.kind === 'additional'
                                ? 'Zusatzmarschbefehl'
                                : entry.extraIds.length
                                  ? 'Haupt-MB mit Zusatz-MB'
                                  : 'Hauptmarschbefehl'}
                            {entry.generated ? ' · abgeleitet' : ''}
                          </small>
                        </td>
                        <td>
                          {entry.details.datum || '—'}
                          <small>{entry.details.von || '—'}</small>
                        </td>
                        <td>
                          {entry.details.ort || '—'}
                          <small>{entry.details.treffpunkt}</small>
                        </td>
                        <td>{entry.details.anzug || '—'}</td>
                        <td>{entry.details.bisDatum || '—'}</td>
                        <td>{entry.details.entlassungsort || '—'}</td>
                        <td>{entry.details.bem || '—'}</td>
                        <td>{confirmed ? entry.personIds.length : '—'}</td>
                        <td>{checked ? '✓ Abgeglichen' : 'Offen'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          {selected && (
            <section className="pisa-window">
              <header>
                <div>
                  <span className="eyebrow">Schritt 2 · Gewählter EC {selected.ec || '—'}</span>
                  <h2>Detachemente · {selected.name}</h2>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button-secondary"
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
                    className="button-secondary"
                    disabled={archived}
                    onClick={() => setEditDetails(true)}
                  >
                    Angaben bearbeiten
                  </button>
                </div>
              </header>
              <div className="pisa-entry-meta">
                <div>
                  <span className="field-caption">Einrücken</span>
                  <strong>
                    {[selected.details.datum, selected.details.von, selected.details.ort]
                      .filter(Boolean)
                      .join(' · ') || 'Noch offen'}
                  </strong>
                </div>
                <div>
                  <span className="field-caption">Entlassung</span>
                  <strong>
                    {[selected.details.bisDatum, selected.details.entlassungsort]
                      .filter(Boolean)
                      .join(' · ') || 'Noch offen'}
                  </strong>
                </div>
                <div>
                  <span className="field-caption">Zusatzmarschbefehle</span>
                  <strong>
                    {!confirmed
                      ? 'Zuordnung erst nach KF-Bestätigung'
                      : selected.extraIds.length
                        ? selected.extraIds
                            .map((id) => {
                              const entry = entries.find((item) => item.id === id);
                              return entry
                                ? `${entry.ec || 'EC?'} · ${entry.name}`
                                : 'Fehlender Zusatz-MB';
                            })
                            .join(', ')
                        : 'Keine'}
                  </strong>
                </div>
              </div>
              <div className="pisa-instruction">
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
              {confirmed && selected.personIds.length > 0 && (
                <DataTable
                  data={project.persons.filter((person) => selected.personIds.includes(person.id))}
                  columns={personColumns}
                  getRowId={(person) => person.id}
                />
              )}
              <footer className="pisa-footer">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() =>
                    void copy(
                      project.persons
                        .filter((person) => selected.personIds.includes(person.id))
                        .map((person) => [person.pnr ?? '', person.grad, person.name].join('\t'))
                        .join('\n'),
                    )
                  }
                  disabled={!confirmed || !selected.personIds.length}
                >
                  Personenliste kopieren
                </button>
                <button
                  type="button"
                  disabled={archived || !confirmed || issues.length > 0}
                  onClick={() =>
                    mutate((draft) => {
                      draft.pisa.entered[selected.id] = {
                        at: new Date().toISOString(),
                        signature: entrySignature(draft, selected),
                      };
                    })
                  }
                >
                  EC {selected.ec || '—'} als abgeglichen markieren
                </button>
              </footer>
            </section>
          )}
          <div className="next-step">
            <div>
              <strong>Alle Einträge in PISA kontrolliert?</strong>
              <p>
                Änderungen an der Planung heben den betreffenden Abgleich automatisch auf. Es werden
                keine Daten an PISA gesendet.
              </p>
            </div>
            <button
              type="button"
              disabled={
                archived || !confirmed || issues.length > 0 || checkedCount !== entries.length
              }
              onClick={() =>
                mutate((draft) => {
                  draft.pisa.verified = {
                    at: new Date().toISOString(),
                    signature: projectSignature(draft),
                  };
                })
              }
            >
              Plan abschliessend abgleichen
            </button>
          </div>
        </>
      )}
      {policyOpen && <PolicyDialog onClose={() => setPolicyOpen(false)} />}
      {editDetails && selected && (
        <DetachmentDialog
          group={project.dets.find((group) => group.id === selected.sourceId)}
          onClose={() => setEditDetails(false)}
        />
      )}
      {codeEntry && (
        <Modal title="PISA-EC bearbeiten" onClose={() => setCodeEntry(null)}>
          <ErrorBox message={error} />
          <p>
            Dieser Code erscheint in der PISA-Vorschau und bleibt für diesen Eintrag gespeichert.
          </p>
          <label>
            EC
            <input
              value={code}
              maxLength={2}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </label>
          <div className="form-actions">
            <button type="button" className="button-secondary" onClick={() => setCodeEntry(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              disabled={!validEc(code)}
              onClick={() => {
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
              EC speichern
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function PolicyDialog({ onClose }: { onClose: () => void }) {
  const project = useProject();
  const [mode, setMode] = useState<OrderMode>(project.orderPolicy.mode);
  const [confirmedBy, setConfirmedBy] = useState(project.orderPolicy.confirmedBy);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal title="KF-Auskunft zur Aufgebotsart" onClose={onClose}>
      <ErrorBox message={error} />
      <p>
        Die Auswahl gilt für diesen Dienst. Nur eine tatsächlich erhaltene Auskunft als bestätigt
        erfassen.
      </p>
      <div className="policy-options">
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
          <label className="policy-option" key={value}>
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
          <label>
            Bestätigung durch KF / Referenz
            <input
              value={confirmedBy}
              onChange={(event) => setConfirmedBy(event.target.value)}
              placeholder="KF-Auskunft / Referenz"
            />
          </label>
          <label className="check-label policy-confirm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            Diese Aufgebotsart wurde für diesen Dienst bestätigt.
          </label>
        </>
      )}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onClose}>
          Abbrechen
        </button>
        <button
          type="button"
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
      </div>
    </Modal>
  );
}
