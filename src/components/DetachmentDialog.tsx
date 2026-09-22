import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { createDetachment } from '../model';
import type { Detachment } from '../model/types';
import { changeProject } from '../store';
import { ErrorBox, errorText, Modal } from './Modal';
import { PlanningPanel } from './PlanningPanel';

const detailFields = [
  ['datum', 'Einrücken · Datum', 'date'],
  ['von', 'Zeit', 'time'],
  ['ort', 'Einrückungsort', 'text'],
  ['treffpunkt', 'Treffpunkt', 'text'],
  ['anzug', 'Anzug', 'text'],
  ['bisDatum', 'Entlassung · Datum', 'date'],
  ['entlassungsort', 'Entlassungsort', 'text'],
  ['bem', 'Bemerkungen', 'text'],
] as const;

export function DetachmentDialog({
  group,
  onClose,
  presentation = 'dialog',
}: {
  group?: Detachment;
  onClose: () => void;
  presentation?: 'dialog' | 'panel';
}) {
  const Surface = presentation === 'panel' ? PlanningPanel : Modal;
  const [error, setError] = useState('');
  const [initial] = useState(() => group ?? createDetachment());
  const form = useForm({
    defaultValues: {
      name: initial.name,
      ec: initial.ec,
      datum: initial.datum,
      von: initial.von,
      ort: initial.ort,
      treffpunkt: initial.treffpunkt,
      anzug: initial.anzug,
      bisDatum: initial.bisDatum,
      bis: initial.bis,
      entlassungsort: initial.entlassungsort,
      bem: initial.bem,
    },
    onSubmit: ({ value }) => {
      setError('');
      try {
        if (!value.name.trim()) throw new Error('Bitte einen Namen für das Detachement eingeben.');
        changeProject((draft) => {
          const saved = {
            ...initial,
            ...value,
            name: value.name.trim(),
            ec: value.ec.trim().toUpperCase(),
          };
          if (group) {
            const index = draft.dets.findIndex((item) => item.id === group.id);
            if (index < 0) throw new Error('Das Detachement ist nicht mehr vorhanden.');
            const current = draft.dets[index];
            // Nonmodal editing must preserve changes made on the card while this form is open.
            for (const key of Object.keys(value) as (keyof typeof value)[]) {
              if (saved[key] === initial[key]) continue;
              if (current[key] !== initial[key] && current[key] !== saved[key])
                throw new Error(
                  'Diese Angabe wurde inzwischen auf der Karte geändert. Bereich neu öffnen und die Änderung prüfen.',
                );
              current[key] = saved[key];
            }
          } else {
            draft.dets.push(saved);
            draft.assign[saved.id] = [];
          }
        });
        onClose();
      } catch (caught) {
        setError(errorText(caught));
      }
    },
  });
  return (
    <Surface title={group ? `${group.name} · Angaben` : 'Neues Detachement'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <ErrorBox message={error} />
        <p className="muted">
          Zuerst die Gruppe erstellen. Einrückungsangaben kannst du später ergänzen.
        </p>
        <div className="form-grid">
          <form.Field name="name">
            {(field) => (
              <label className="span-2">
                Name
                <input
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="z. B. KVK Fahrer"
                  required
                />
              </label>
            )}
          </form.Field>
          <form.Field name="ec">
            {(field) => (
              <label>
                EC <span className="muted">optional</span>
                <input
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  maxLength={2}
                  placeholder="z. B. K1"
                />
              </label>
            )}
          </form.Field>
        </div>
        <details className="details-panel" open={Boolean(group)}>
          <summary>Einrücken und Entlassung</summary>
          <div className="form-grid">
            {detailFields.map(([name, label, type]) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <label>
                    {label}
                    <input
                      type={type}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </label>
                )}
              </form.Field>
            ))}
          </div>
        </details>
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit">{group ? 'Änderungen speichern' : 'Detachement erstellen'}</button>
        </div>
      </form>
    </Surface>
  );
}
