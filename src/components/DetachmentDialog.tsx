import { useForm } from '@tanstack/react-form';
import { useId, useState } from 'react';
import { createDetachment } from '../model';
import type { Detachment } from '../model/types';
import { changeProject, useProject } from '../store';
import { Icon } from './Icon';
import { ErrorBox, errorText, Modal } from './Modal';
import { PlanningPanel } from './PlanningPanel';

const startFields = [
  ['datum', 'Einrücken · Datum', 'date', ''],
  ['von', 'Zeit', 'time', ''],
  ['ort', 'Einrückungsort', 'text', 'z. B. Kaserne Beispiel'],
  ['treffpunkt', 'Treffpunkt', 'text', 'z. B. Haupteingang'],
  ['anzug', 'Anzug', 'text', 'z. B. Tenue B'],
] as const;
const endFields = [
  ['bisDatum', 'Entlassung · Datum', 'date', ''],
  ['entlassungsort', 'Entlassungsort', 'text', ''],
  ['bem', 'Bemerkungen', 'text', ''],
] as const;
type FieldName = (typeof startFields)[number][0] | (typeof endFields)[number][0];

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
  const project = useProject();
  const formId = useId();
  const [error, setError] = useState('');
  const [initial] = useState(() => group ?? createDetachment());
  // Other cards with details can serve as a template for shared places and times.
  const templates = project.dets.filter(
    (item) => item.id !== initial.id && (item.ort || item.datum || item.anzug),
  );
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
        if (value.datum && value.bisDatum && value.bisDatum < value.datum)
          throw new Error('Die Entlassung liegt vor dem Einrücken. Bitte die Daten prüfen.');
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
  const field = (name: FieldName, label: string, type: string, placeholder: string) => (
    <form.Field key={name} name={name}>
      {(item) => (
        <label className={`field ${name === 'bem' ? 'span-all' : ''}`}>
          {label}
          <input
            type={type}
            value={item.state.value}
            placeholder={placeholder}
            onChange={(event) => item.handleChange(event.target.value)}
          />
        </label>
      )}
    </form.Field>
  );
  return (
    <Surface
      title={group ? `${group.name} · Angaben` : 'Neues Detachement'}
      description="Für die Planung genügt der Name. Die übrigen Angaben braucht es für PISA."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" form={formId} className="btn btn-primary">
            {group ? 'Änderungen speichern' : 'Detachement erstellen'}
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <ErrorBox message={error} />
        <div className="form-grid detachment-identity">
          <form.Field name="name">
            {(item) => (
              <label className="field">
                Name
                <input
                  value={item.state.value}
                  onChange={(event) => item.handleChange(event.target.value)}
                  placeholder="z. B. KVK Fahrer"
                  required
                />
              </label>
            )}
          </form.Field>
          <form.Field name="ec">
            {(item) => (
              <label className="field">
                <span>
                  EC <span className="optional">· 2 Zeichen</span>
                </span>
                <input
                  value={item.state.value}
                  onChange={(event) => item.handleChange(event.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder="K1"
                  className="mono"
                />
              </label>
            )}
          </form.Field>
        </div>
        {templates.length > 0 && (
          <label className="field">
            <span>
              Angaben übernehmen von <span className="optional">· optional</span>
            </span>
            <select
              value=""
              onChange={(event) => {
                const source = templates.find((item) => item.id === event.target.value);
                if (!source) return;
                for (const [name] of [...startFields, ...endFields])
                  if (name !== 'bem' && source[name]) form.setFieldValue(name, source[name]);
              }}
            >
              <option value="">Andere Karte wählen …</option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.ort ? ` · ${item.ort}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset className="field-group">
          <legend>
            <Icon name="calendar" size={15} /> Einrücken
          </legend>
          <div className="form-grid">
            {startFields.map(([name, label, type, placeholder]) =>
              field(name, label, type, placeholder),
            )}
          </div>
        </fieldset>
        <fieldset className="field-group">
          <legend>
            <Icon name="flag" size={15} /> Entlassung
          </legend>
          <div className="form-grid">
            {endFields.map(([name, label, type, placeholder]) =>
              field(name, label, type, placeholder),
            )}
          </div>
        </fieldset>
      </form>
    </Surface>
  );
}
