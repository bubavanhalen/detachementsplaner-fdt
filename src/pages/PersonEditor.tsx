import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { ErrorBox, Modal } from '../components/Modal';
import { PlanningPanel } from '../components/PlanningPanel';
import { contactNames } from '../io/exports';
import { localError, searchText } from '../io/text';
import { assignPeople, directGroupIds, removePeople } from '../model';
import type { Person } from '../model/types';
import { changeProject, useProject } from '../store';

export function PersonEditor({
  person,
  onClose,
  presentation = 'dialog',
}: {
  person?: Person;
  onClose: () => void;
  presentation?: 'dialog' | 'panel';
}) {
  const Surface = presentation === 'panel' ? PlanningPanel : Modal;
  const project = useProject();
  const [initial] = useState(() => ({
    person: person ? structuredClone(person) : undefined,
    projectId: project.id,
    groups: person ? directGroupIds(project, person.id).sort() : [],
  }));
  const names = initial.person ? contactNames(initial.person) : { first: '', last: '' };
  const [error, setError] = useState('');
  const [defaults] = useState(() => ({
    first: names.first,
    last: names.last,
    grad: initial.person?.grad || '',
    pnr: initial.person?.pnr || '',
    funktion: initial.person?.funktion || '',
    tel: initial.person?.tel || '',
    mail: initial.person?.mail || '',
    zug: initial.person?.zug || '',
    einteilung: initial.person?.einteilung || '',
    lics: initial.person?.lics.join('; ') || '',
    status:
      initial.person?.planning.status || ('unreviewed' as 'unreviewed' | 'included' | 'excluded'),
    reason: initial.person?.planning.reason || '',
    group: initial.groups.length > 1 ? '__multiple__' : initial.groups[0] || '',
    identity: false,
  }));
  const form = useForm({
    defaultValues: defaults,
    onSubmit: ({ value }) => {
      try {
        if (![value.first.trim(), value.last.trim()].some(Boolean))
          throw new Error('Bitte einen Namen eingeben.');
        changeProject((draft) => {
          if (draft.id !== initial.projectId)
            throw new Error('Die Dienstleistung wurde gewechselt. Bitte die Person erneut öffnen.');
          const target: Person = initial.person
            ? draft.persons.find((item) => item.id === initial.person?.id) ||
              (() => {
                throw new Error('Person nicht gefunden.');
              })()
            : {
                id: crypto.randomUUID(),
                name: '',
                grad: '',
                funktion: '',
                raw: {},
                lics: [],
                planning: { status: 'unreviewed', reason: '' },
              };
          const checkConflict = (before: unknown, current: unknown, next: unknown) => {
            if (
              JSON.stringify(current) !== JSON.stringify(before) &&
              JSON.stringify(current) !== JSON.stringify(next)
            )
              throw new Error(
                'Diese Angabe wurde inzwischen geändert. Bitte die Person erneut öffnen und die Änderungen prüfen.',
              );
          };
          const nameChanged =
            !initial.person ||
            value.first.trim() !== defaults.first.trim() ||
            value.last.trim() !== defaults.last.trim();
          if (nameChanged) {
            const nextName = [value.first.trim(), value.last.trim()].filter(Boolean).join(' ');
            if (initial.person)
              checkConflict(
                [initial.person.name, initial.person.vorname || '', initial.person.nachname || ''],
                [target.name, target.vorname || '', target.nachname || ''],
                [nextName, value.first.trim(), value.last.trim()],
              );
            target.name = nextName;
            target.vorname = value.first.trim();
            target.nachname = value.last.trim();
            target.key = searchText(nextName);
          }
          for (const key of [
            'grad',
            'pnr',
            'funktion',
            'tel',
            'mail',
            'zug',
            'einteilung',
          ] as const) {
            const next = value[key].trim();
            if (!initial.person || next !== defaults[key].trim()) {
              if (initial.person)
                checkConflict(defaults[key].trim(), String(target[key] || '').trim(), next);
              target[key] = next;
            }
          }
          const licenses = value.lics
            .split(';')
            .map((text) => text.trim())
            .filter(Boolean);
          if (!initial.person || JSON.stringify(licenses) !== JSON.stringify(initial.person.lics)) {
            if (initial.person) checkConflict(initial.person.lics, target.lics, licenses);
            target.lics = licenses;
          }
          const statusChanged = !initial.person || value.status !== defaults.status;
          const reasonChanged = !initial.person || value.reason.trim() !== defaults.reason.trim();
          const groupChanged = value.group !== defaults.group;
          if (statusChanged) {
            if (initial.person)
              checkConflict(defaults.status, target.planning.status, value.status);
            target.planning = { ...target.planning, status: value.status };
          }
          if (reasonChanged) {
            if (initial.person)
              checkConflict(
                defaults.reason.trim(),
                target.planning.reason.trim(),
                value.reason.trim(),
              );
            target.planning = { ...target.planning, reason: value.reason.trim() };
          }
          if (
            (statusChanged || reasonChanged) &&
            target.planning.status === 'excluded' &&
            !target.planning.reason.trim()
          )
            throw new Error('Bitte den Ausschluss begründen.');
          const clearsAssignments = statusChanged && target.planning.status !== 'included';
          if (!initial.person) draft.persons.push(target);
          if (groupChanged || clearsAssignments) {
            const desiredGroups =
              target.planning.status === 'included' && value.group && value.group !== '__multiple__'
                ? [value.group]
                : [];
            if (groupChanged && value.group && target.planning.status !== 'included')
              throw new Error('Für eine Zuteilung zuerst «Einplanen» wählen.');
            if (initial.person)
              checkConflict(initial.groups, directGroupIds(draft, target.id).sort(), desiredGroups);
            for (const group of draft.dets) removePeople(draft, group.id, [target.id]);
            if (desiredGroups.length) assignPeople(draft, desiredGroups[0], [target.id]);
          }
          if (value.identity) {
            checkConflict(initial.person?.identityReview, target.identityReview, undefined);
            delete target.identityReview;
          }
        });
        onClose();
      } catch (failure) {
        setError(localError(failure));
      }
    },
  });
  const fields = [
    ['first', 'Vorname / vollständiger Name'],
    ['last', 'Nachname'],
    ['grad', 'Grad'],
    ['pnr', 'Versicherten-Nr.'],
    ['funktion', 'Funktion'],
    ['lics', 'Führerausweise (mit ; trennen)'],
    ['zug', 'Zug / Element'],
    ['einteilung', 'Einheit'],
    ['tel', 'Telefon'],
    ['mail', 'E-Mail'],
  ] as const;
  return (
    <Surface
      title={person ? 'Person bearbeiten' : 'Person erfassen'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" form="person-form" className="button primary">
            Speichern
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      {person &&
        project.dets.filter((group) => (project.assign[group.id] || []).includes(person.id))
          .length > 1 && (
          <div className="notice warning">
            Mehrere bisherige direkte Zuteilungen. Sie bleiben erhalten, bis du unten ausdrücklich
            ein Detachement auswählst.
          </div>
        )}
      <form
        id="person-form"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="form-grid">
          {fields.map(([name, label]) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <label className="field">
                  {label}
                  <input
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </label>
              )}
            </form.Field>
          ))}
          <form.Field name="status">
            {(field) => (
              <label className="field">
                Teilnahme
                <select
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(event.target.value as typeof field.state.value)
                  }
                >
                  <option value="unreviewed">Teilnahme klären</option>
                  <option value="included">Einplanen</option>
                  <option value="excluded">Nicht einplanen</option>
                </select>
              </label>
            )}
          </form.Field>
          <form.Field name="group">
            {(field) => (
              <label className="field">
                Direktes Detachement
                <select
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                >
                  {initial.groups.length > 1 && (
                    <option value="__multiple__">Bisherige Mehrfachzuteilung beibehalten</option>
                  )}
                  <option value="">Noch nicht zugeteilt</option>
                  {project.dets.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </form.Field>
          <form.Field name="reason">
            {(field) => (
              <label className="field">
                Begründung / Planungsnotiz
                <textarea
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </label>
            )}
          </form.Field>
        </div>
        {person?.identityReview && (
          <form.Field name="identity">
            {(field) => (
              <label className="check">
                <input
                  type="checkbox"
                  checked={field.state.value}
                  onChange={(event) => field.handleChange(event.target.checked)}
                />{' '}
                Identität mit Quelle geprüft: {person.identityReview}
              </label>
            )}
          </form.Field>
        )}
      </form>
    </Surface>
  );
}
