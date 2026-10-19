import { type ChangeEvent, useId, useState } from 'react';
import { createTbAsset } from '../io/tagesbefehl/assets';
import { readFileBytes } from '../io/tagesbefehl/bytes';
import { prepareSignature } from '../io/tagesbefehl/signature';
import { xlsxFileName } from '../io/tagesbefehl/xlsx';
import { localError } from '../io/text';
import {
  KADER_LABELS,
  KADER_ROLLEN,
  type KaderEintrag,
  type KaderRolle,
  kaderAbweichungen,
  kaderFromPerson,
  kaderOf,
  MAX_BILD_BYTES,
  type Stamm,
} from '../model';
import { isCommanderFunction } from '../model/tagesbefehl';
import type { Person } from '../model/types';
import { changeProject, notify, useProject } from '../store';
import { Icon } from './Icon';
import { ErrorBox, Modal } from './Modal';

type TextKey = Exclude<keyof Stamm, 'nameOrder' | 'kader' | 'grafiken'>;
type BildKind = keyof Stamm['grafiken'];
const BILD_LABELS: Record<BildKind, string> = { unterschrift: 'Unterschrift', wappen: 'Wappen' };
const KADER_FIELDS = [
  ['grad', 'Grad'],
  ['vorname', 'Vorname'],
  ['name', 'Name'],
  ['funktion', 'Funktion'],
] as const;

const isPng = (bytes: Uint8Array): boolean =>
  bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e;
const emptyEntry = (rolle: KaderRolle): KaderEintrag => ({
  rolle,
  personId: '',
  grad: '',
  vorname: '',
  name: '',
  funktion: KADER_LABELS[rolle],
});
/** An entry is kept when it names someone or deviates from the default function. */
const filled = (entry: KaderEintrag): boolean =>
  !!(entry.grad.trim() || entry.vorname.trim() || entry.name.trim() || entry.personId) ||
  (!!entry.funktion.trim() && entry.funktion.trim() !== KADER_LABELS[entry.rolle]);

/**
 * «Dienst und Einheit»: the single place for the master data of a service
 * (ADR-0001). Tagesbefehle and later the WAP-Planer only read these values.
 */
export function ServiceDialog({ onClose }: { onClose: () => void }) {
  const project = useProject();
  const ids = useId();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(() => ({
    name: project.name,
    start: project.service.start,
    end: project.service.end,
    note: project.service.note,
    stamm: structuredClone(project.stamm),
  }));
  const stamm = draft.stamm;
  const setStamm = (update: (next: Stamm) => void) =>
    setDraft((old) => {
      const next = structuredClone(old.stamm);
      update(next);
      return { ...old, stamm: next };
    });
  const setEntry = (rolle: KaderRolle, entry: KaderEintrag | undefined) =>
    setStamm((next) => {
      next.kader = KADER_ROLLEN.flatMap((item) => {
        const value = item === rolle ? entry : kaderOf(next, item);
        return value ? [value] : [];
      });
    });
  const people = [...project.persons].sort(
    (a, b) =>
      Number(isCommanderFunction(b.funktion)) - Number(isCommanderFunction(a.funktion)) ||
      a.name.localeCompare(b.name, 'de-CH'),
  );

  const receive = (kind: BildKind) => (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget,
      file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    void (async () => {
      try {
        const bytes = await readFileBytes(file);
        if (!isPng(bytes)) throw new Error(`${BILD_LABELS[kind]}: bitte eine PNG-Datei wählen.`);
        const stored = kind === 'unterschrift' ? await prepareSignature(bytes) : bytes;
        if (stored.length > MAX_BILD_BYTES)
          throw new Error(
            `${BILD_LABELS[kind]}: Die Datei ist grösser als ${MAX_BILD_BYTES / 1024} KB. Bitte verkleinern.`,
          );
        setStamm((next) => {
          next.grafiken[kind] = createTbAsset(file.name, stored);
        });
        setError('');
      } catch (failure) {
        setError(localError(failure));
      } finally {
        input.value = '';
        setBusy(false);
      }
    })();
  };

  const save = () => {
    try {
      if (!draft.name.trim()) throw new Error('Bitte eine Bezeichnung eingeben.');
      if (draft.start && draft.end && draft.end < draft.start)
        throw new Error('Das Ende liegt vor dem Beginn.');
      const trim = (value: string) => value.trim();
      changeProject((target) => {
        target.name = draft.name.trim();
        target.service = {
          ...target.service,
          start: draft.start,
          end: draft.end,
          note: draft.note,
        };
        target.stamm = {
          ...stamm,
          einheit: trim(stamm.einheit),
          uebergeordneteEinheit: trim(stamm.uebergeordneteEinheit),
          uebungsname: trim(stamm.uebungsname),
          dateikuerzel: trim(stamm.dateikuerzel),
          standort: trim(stamm.standort),
          klassifizierung: trim(stamm.klassifizierung),
          motto: trim(stamm.motto),
          // Saving the dialog counts as having checked the migrated commander.
          kader: stamm.kader.filter(filled).map(({ pruefen: _checked, ...entry }) => ({
            ...entry,
            grad: trim(entry.grad),
            vorname: trim(entry.vorname),
            name: trim(entry.name),
            funktion: trim(entry.funktion),
          })),
        };
      });
      notify('Dienst und Einheit gespeichert.', { tone: 'success' });
      onClose();
    } catch (failure) {
      setError(localError(failure));
    }
  };

  const text = (key: TextKey, label: string, placeholder = '', className = '') => (
    <label className={`field ${className}`}>
      {label}
      <input
        type="text"
        value={stamm[key]}
        placeholder={placeholder}
        onChange={(event) => {
          const value = event.target.value;
          setStamm((next) => {
            next[key] = value;
          });
        }}
      />
    </label>
  );

  return (
    <Modal
      wide
      title="Dienst und Einheit"
      description="Diese Angaben werden nur hier gepflegt. Planung und Tagesbefehle verwenden sie direkt."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" form="service-form" className="btn btn-primary" disabled={busy}>
            Speichern
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <form
        id="service-form"
        className="stamm-form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <fieldset className="field-group">
          <legend>
            <Icon name="calendar" /> Dienst
          </legend>
          <div className="form-grid">
            <label className="field span-all">
              Bezeichnung
              <input
                type="text"
                value={draft.name}
                placeholder="z. B. WK 2027"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label className="field">
              Beginn
              <input
                type="date"
                value={draft.start}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
              />
            </label>
            <label className="field">
              Ende
              <input
                type="date"
                value={draft.end}
                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
              />
            </label>
            {text('uebungsname', 'Übungsname')}
            <div className="field">
              <label htmlFor={`${ids}-kuerzel`}>Dateikürzel</label>
              <input
                id={`${ids}-kuerzel`}
                aria-describedby={`${ids}-kuerzel-hint`}
                type="text"
                value={stamm.dateikuerzel}
                placeholder="z. B. WK_2027"
                onChange={(event) => {
                  const value = event.target.value;
                  setStamm((next) => {
                    next.dateikuerzel = value;
                  });
                }}
              />
              <small className="hint" id={`${ids}-kuerzel-hint`}>
                Beispiel: {xlsxFileName('KVK', stamm.dateikuerzel)}
              </small>
            </div>
            <label className="field span-all">
              Planungsnotiz
              <input
                type="text"
                value={draft.note}
                onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend>
            <Icon name="users" /> Einheit
          </legend>
          <div className="form-grid">
            {text('einheit', 'Einheit', 'z. B. Inf Kp 12/3')}
            {text('uebergeordneteEinheit', 'Übergeordnete Einheit', 'z. B. Inf Bat 12')}
            {text('standort', 'Standort', 'z. B. Kaserne Beispiel')}
            {text('klassifizierung', 'Klassifizierung', 'z. B. INTERN')}
            {text('motto', 'Motto', '', 'span-all')}
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend>
            <Icon name="user" /> Kader
          </legend>
          {KADER_ROLLEN.map((rolle) => (
            <KaderFields
              key={rolle}
              rolle={rolle}
              entry={kaderOf(stamm, rolle)}
              people={people}
              onChange={(entry) => setEntry(rolle, entry)}
            />
          ))}
          <label className="field stamm-order">
            Reihenfolge der Namen
            <select
              value={stamm.nameOrder}
              onChange={(event) => {
                const value = event.target.value === 'nameVorname' ? 'nameVorname' : 'vornameName';
                setStamm((next) => {
                  next.nameOrder = value;
                });
              }}
            >
              <option value="vornameName">Grad Vorname Name</option>
              <option value="nameVorname">Grad Name Vorname</option>
            </select>
          </label>
        </fieldset>

        <fieldset className="field-group">
          <legend>
            <Icon name="edit" /> Grafiken
          </legend>
          <p className="muted">
            PNG-Dateien, nur in diesem Projekt auf diesem Gerät gespeichert. Die Unterschrift wird
            für den Druck aufbereitet. Kein Upload.
          </p>
          {(['unterschrift', 'wappen'] as const).map((kind) => {
            const bild = stamm.grafiken[kind];
            return (
              <div className="stamm-bild" key={kind}>
                <div>
                  <strong>{BILD_LABELS[kind]}</strong>
                  <p className="muted" data-testid={`stamm-bild-${kind}`}>
                    {bild ? bild.name || 'Ohne Dateiname' : 'Noch nicht gespeichert'}
                  </p>
                  {bild && (
                    <img
                      src={`data:image/png;base64,${bild.base64}`}
                      alt={`${BILD_LABELS[kind]} des Dienstes`}
                    />
                  )}
                </div>
                <div className="actions">
                  <label className="btn btn-sm stamm-file">
                    <Icon name="upload" size={15} />
                    {bild ? 'Ersetzen' : 'Wählen'}
                    <input
                      type="file"
                      accept=".png,image/png"
                      aria-label={`${BILD_LABELS[kind]} (PNG) wählen`}
                      disabled={busy}
                      onChange={receive(kind)}
                    />
                  </label>
                  {bild && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() =>
                        setStamm((next) => {
                          delete next.grafiken[kind];
                        })
                      }
                    >
                      <Icon name="trash" size={15} /> Entfernen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </fieldset>
      </form>
    </Modal>
  );
}

function KaderFields({
  rolle,
  entry,
  people,
  onChange,
}: {
  rolle: KaderRolle;
  entry: KaderEintrag | undefined;
  people: Person[];
  onChange: (entry: KaderEintrag | undefined) => void;
}) {
  const value = entry ?? emptyEntry(rolle);
  const linked = people.find((person) => person.id === value.personId);
  const differences = kaderAbweichungen(value, people);
  return (
    <fieldset className="stamm-kader" aria-label={KADER_LABELS[rolle]}>
      <div className="stamm-kader-head">
        <strong>{KADER_LABELS[rolle]}</strong>
        <label className="field">
          <span className="visually-hidden">{KADER_LABELS[rolle]} aus Personenliste</span>
          <select
            value={value.personId}
            aria-label={`${KADER_LABELS[rolle]} aus Personenliste`}
            onChange={(event) => {
              const person = people.find((item) => item.id === event.target.value);
              onChange(
                person
                  ? kaderFromPerson(person, rolle, value.funktion || KADER_LABELS[rolle])
                  : { ...value, personId: '' },
              );
            }}
          >
            <option value="">Von Hand erfasst</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {[person.grad, person.name, person.funktion && `(${person.funktion})`]
                  .filter(Boolean)
                  .join(' ')}
              </option>
            ))}
          </select>
        </label>
        {filled(value) && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => onChange(undefined)}
          >
            <Icon name="trash" size={15} /> Leeren
          </button>
        )}
      </div>
      {value.pruefen && (
        <p className="callout callout-warning" data-testid={`kader-pruefen-${rolle}`}>
          Aus dem bisherigen Feld «Name Kdt» der Tagesbefehle übernommen. Bitte Grad, Vorname und
          Name prüfen und speichern.
        </p>
      )}
      {differences.length > 0 && (
        <p className="callout callout-warning" data-testid={`kader-abweichung-${rolle}`}>
          Weicht von der Personenliste ab: {differences.join(', ')}.{' '}
          {linked && (
            <button
              type="button"
              className="btn-link"
              onClick={() => onChange(kaderFromPerson(linked, rolle, value.funktion))}
            >
              Aus Personenliste übernehmen
            </button>
          )}
        </p>
      )}
      <div className="form-grid">
        {KADER_FIELDS.map(([key, label]) => (
          <label className="field" key={key}>
            {label}
            <input
              type="text"
              value={value[key]}
              onChange={(event) => onChange({ ...value, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
