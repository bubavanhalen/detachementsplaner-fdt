// Plan-Einstellungen (I3 C3/C4; Beschrieb 4.1, 4.4, 4.7; UI-Richtlinie 2.2 Planmenü, 10 Dialoge): Plan, Kommandant und
// Bilder, Legende, Funktionsliste, Personenliste (von Hand oder aus Datei), Spaltensätze als Vorlagen, Kürzelliste,
// Marker. Jede Änderung ist ein Befehl und ein Undo-Schritt; Esc schliesst den Dialog.

import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { readPersonFile } from '../../../io/wap-persons/index';
import { type ColumnSetChange, updateColumnSet } from '../../../model/wap/commands/columns';
import { columnSetReferences, columnSetUsage } from '../../../model/wap/commands/dayColumns';
import { addPersons, type PersonInput, replacePersons } from '../../../model/wap/commands/persons';
import {
  categoryUsage,
  createColumnSet,
  deleteCategory,
  deleteColumnSet,
  moveCategory,
  moveColumn,
  renameColumnSet,
  updateAbbreviations,
  updateFunctionList,
  updateMarkerLabels,
  updatePlanFields,
  updateRapportCodes,
  upsertCategory,
} from '../../../model/wap/commands/settings';
import { WapError } from '../../../model/wap/errors';
import type {
  Column,
  ColumnWeight,
  ImageAsset,
  LabelOrientation,
  LtgCategory,
  Plan,
  Rgb,
} from '../../../model/wap/types';
import { I2Dialog } from '../i2/I2Dialog';
import { CheckField, type Choice, Section, SelectField, TextField } from '../panel/fields';
import type { RunCommand } from '../panel/types';
import '../panel/panel.css';

type TabId =
  | 'plan'
  | 'commander'
  | 'legend'
  | 'functions'
  | 'persons'
  | 'sets'
  | 'codes'
  | 'markers';

const TABS: readonly { readonly id: TabId; readonly label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'commander', label: 'Kommandant und Bilder' },
  { id: 'legend', label: 'Legende' },
  { id: 'functions', label: 'Funktionsliste' },
  { id: 'persons', label: 'Personenliste' },
  { id: 'sets', label: 'Spaltensätze' },
  { id: 'codes', label: 'Kürzelliste' },
  { id: 'markers', label: 'Marker' },
];

interface Props {
  readonly plan: Plan;
  readonly disabled: boolean;
  readonly run: (cmd: RunCommand) => Promise<void>;
  readonly onClose: () => void;
  readonly initialTab?: TabId;
}

function hex(c: Rgb): string {
  return `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function rgbOf(value: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (m === null) return { r: 255, g: 255, b: 255 };
  return {
    r: Number.parseInt(m[1] ?? 'ff', 16),
    g: Number.parseInt(m[2] ?? 'ff', 16),
    b: Number.parseInt(m[3] ?? 'ff', 16),
  };
}

function messageOf(error: unknown): string {
  return error instanceof WapError
    ? `${error.userMessage.cause} ${error.userMessage.nextStep}`
    : 'Die Änderung konnte nicht übernommen werden. Eingaben prüfen und erneut versuchen.';
}

/** Bild aus einer lokalen Datei (PNG oder JPEG) als ImageAsset; nichts verlässt das Gerät. */
async function readImage(file: File): Promise<ImageAsset> {
  const mime =
    file.type === 'image/png' ? 'image/png' : file.type === 'image/jpeg' ? 'image/jpeg' : null;
  if (mime === null)
    throw new WapError('invalidImage', {
      cause: `«${file.name}» ist kein PNG- oder JPEG-Bild.`,
      nextStep: 'Ein Bild als PNG oder JPEG wählen.',
    });
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mime, dataBase64: btoa(binary) };
}

export function PlanSettings({ plan, disabled, run, onClose, initialTab = 'plan' }: Props) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());
  const panelId = useId();
  const exec = (cmd: RunCommand, done?: string) => {
    setError('');
    setNotice('');
    run(cmd)
      .then(() => {
        if (done !== undefined) setNotice(done);
      })
      .catch((e: unknown) => setError(messageOf(e)));
  };
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    if (next === undefined) return;
    setTab(next.id);
    tabRefs.current.get(next.id)?.focus();
  };
  const props = { plan, disabled, exec, setError, setNotice };
  return (
    <I2Dialog
      title="Plan-Einstellungen"
      description="Änderungen gelten sofort und sind einzeln rückgängig machbar (Ctrl+Z nach dem Schliessen)."
      onClose={onClose}
    >
      <div className="wap-settings">
        <div role="tablist" aria-label="Bereiche der Plan-Einstellungen">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${panelId}-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`${panelId}-panel`}
              tabIndex={tab === t.id ? 0 : -1}
              ref={(el) => {
                if (el === null) tabRefs.current.delete(t.id);
                else tabRefs.current.set(t.id, el);
              }}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => tabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {error !== '' && (
          <p role="alert" className="wap-panel-error wap-panel-message">
            {error}
          </p>
        )}
        {notice !== '' && (
          <p role="status" aria-label="Ergebnis" className="wap-panel-hint">
            {notice}
          </p>
        )}
        <div
          role="tabpanel"
          id={`${panelId}-panel`}
          aria-labelledby={`${panelId}-${tab}`}
          tabIndex={-1}
        >
          {tab === 'plan' && <PlanTab {...props} />}
          {tab === 'commander' && <CommanderTab {...props} />}
          {tab === 'legend' && <LegendTab {...props} />}
          {tab === 'functions' && <FunctionTab {...props} />}
          {tab === 'persons' && <PersonTab {...props} />}
          {tab === 'sets' && <SetTab {...props} />}
          {tab === 'codes' && <CodeTab {...props} />}
          {tab === 'markers' && <MarkerTab {...props} />}
        </div>
      </div>
    </I2Dialog>
  );
}

interface TabProps {
  readonly plan: Plan;
  readonly disabled: boolean;
  readonly exec: (cmd: RunCommand, done?: string) => void;
  readonly setError: (m: string) => void;
  readonly setNotice: (m: string) => void;
}

function PlanTab({ plan, disabled, exec, setError }: TabProps) {
  const field = (
    label: string,
    key:
      | 'unit'
      | 'parentUnit'
      | 'service'
      | 'exerciseName'
      | 'beilage'
      | 'classification'
      | 'sunLocation'
      | 'motto',
    hint?: string,
  ) => (
    <TextField
      label={label}
      value={plan[key]}
      disabled={disabled}
      {...(hint === undefined ? {} : { hint })}
      onCommit={(v) => exec((p, ctx) => updatePlanFields(p, { [key]: v }, ctx))}
    />
  );
  return (
    <>
      <div className="wap-settings-grid">
        {field('Einheit', 'unit', 'Erscheint im Kopf, z.B. «Inf Ustü Kp 99/4».')}
        {field('Übergeordnete Einheit', 'parentUnit')}
        {field('Dienst', 'service', 'Z.B. «FDT 2026»; auch im Dateinamen.')}
        {field('Übungsname', 'exerciseName')}
        {field('Beilage', 'beilage', 'Beilage-Text im Kopf.')}
        {field('Klassifizierung', 'classification', 'Leer = keine Klassifizierung (Vorgabe).')}
        {field('Standort (Sonnenzeiten)', 'sunLocation')}
        {field('Motto', 'motto')}
      </div>
      <ImageField
        label="Wappen"
        image={plan.coatOfArms}
        disabled={disabled}
        onError={setError}
        onChange={(image) => exec((p, ctx) => updatePlanFields(p, { coatOfArms: image }, ctx))}
      />
      <p className="wap-panel-hint">
        Vorlage: {plan.level === 'kp' ? 'Kp' : 'Bat'} (fest für diesen Plan).
      </p>
    </>
  );
}

function ImageField({
  label,
  image,
  disabled,
  onChange,
  onError,
}: {
  label: string;
  image: ImageAsset | null;
  disabled: boolean;
  onChange: (image: ImageAsset | null) => void;
  onError: (m: string) => void;
}) {
  const id = useId();
  return (
    <div className="wap-panel-field">
      <label htmlFor={id} className="wap-panel-label">
        <span>{label} (PNG oder JPEG von diesem Gerät)</span>
      </label>
      <div className="wap-panel-row">
        {image !== null && (
          <img
            src={`data:${image.mime};base64,${image.dataBase64}`}
            alt={`${label}, Vorschau`}
            style={{ maxHeight: 48, maxWidth: 96, border: '1px solid #c4cec7' }}
          />
        )}
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file === undefined) return;
            readImage(file)
              .then(onChange)
              .catch((e: unknown) => onError(messageOf(e)));
          }}
        />
        {image !== null && (
          <button type="button" className="btn" disabled={disabled} onClick={() => onChange(null)}>
            {label} entfernen
          </button>
        )}
      </div>
    </div>
  );
}

function CommanderTab({ plan, disabled, exec, setError }: TabProps) {
  const c = plan.commander;
  const set = (patch: Partial<typeof c>) =>
    exec((p, ctx) => updatePlanFields(p, { commander: { ...p.commander, ...patch } }, ctx));
  return (
    <>
      <div className="wap-settings-grid">
        <TextField
          label="Grad"
          value={c.grad}
          disabled={disabled}
          onCommit={(grad) => set({ grad })}
        />
        <TextField
          label="Name"
          value={c.name}
          disabled={disabled}
          onCommit={(name) => set({ name })}
        />
        <TextField
          label="Vorname"
          value={c.vorname}
          disabled={disabled}
          onCommit={(vorname) => set({ vorname })}
        />
        <TextField
          label="Funktion"
          value={c.funktion}
          disabled={disabled}
          onCommit={(funktion) => set({ funktion })}
        />
        <SelectField
          label="Reihenfolge im Unterschriftblock"
          value={c.nameOrder}
          disabled={disabled}
          choices={[
            { value: 'gradVornameName', label: 'Grad Vorname Name' },
            { value: 'gradNameVorname', label: 'Grad Name Vorname' },
          ]}
          onCommit={(v) => set({ nameOrder: v as typeof c.nameOrder })}
        />
      </div>
      <ImageField
        label="Unterschrift"
        image={plan.signatureImage}
        disabled={disabled}
        onError={setError}
        onChange={(image) => exec((p, ctx) => updatePlanFields(p, { signatureImage: image }, ctx))}
      />
      <CheckField
        label="Unterschrift als Bild im PDF zeigen (Vorgabe: aus)"
        checked={plan.signatureEnabled}
        disabled={disabled || plan.signatureImage === null}
        onCommit={(signatureEnabled) =>
          exec((p, ctx) => updatePlanFields(p, { signatureEnabled }, ctx))
        }
      />
    </>
  );
}

function LegendTab({ plan, disabled, exec }: TabProps) {
  const [deleting, setDeleting] = useState<{ id: string; replacement: string } | null>(null);
  const save = (c: LtgCategory, patch: Partial<LtgCategory>) =>
    exec((p, ctx) => upsertCategory(p, { ...c, ...patch }, ctx));
  return (
    <>
      <table aria-label="Legende (Leitungskategorien)">
        <thead>
          <tr>
            <th scope="col">Farbe</th>
            <th scope="col">Name</th>
            <th scope="col">Beschriftung in der Legende</th>
            <th scope="col">neutral</th>
            <th scope="col">in der Legende</th>
            <th scope="col">
              <span className="wap-i2-sr">Aktionen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {plan.legend.map((c, i) => (
            <tr key={c.id}>
              <td>
                <input
                  type="color"
                  aria-label={`Farbe ${c.name}`}
                  value={hex(c.color)}
                  disabled={disabled}
                  onChange={(e) => save(c, { color: rgbOf(e.target.value) })}
                />
              </td>
              <td>
                <TextField
                  label={`Name ${c.name}`}
                  value={c.name}
                  disabled={disabled}
                  onCommit={(name) => save(c, { name })}
                />
              </td>
              <td>
                <TextField
                  label={`Beschriftung ${c.name}`}
                  value={c.legendLabel}
                  disabled={disabled}
                  onCommit={(legendLabel) => save(c, { legendLabel })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`${c.name} neutral`}
                  checked={c.neutral}
                  disabled={disabled}
                  onChange={(e) => save(c, { neutral: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`${c.name} in der Legende`}
                  checked={c.inLegend}
                  disabled={disabled}
                  onChange={(e) => save(c, { inLegend: e.target.checked })}
                />
              </td>
              <td className="wap-panel-actions">
                <button
                  type="button"
                  className="btn"
                  aria-label={`${c.name} nach oben`}
                  disabled={disabled || i === 0}
                  onClick={() => exec((p, ctx) => moveCategory(p, c.id, -1, ctx))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={`${c.name} nach unten`}
                  disabled={disabled || i === plan.legend.length - 1}
                  onClick={() => exec((p, ctx) => moveCategory(p, c.id, 1, ctx))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Kategorie ${c.name} löschen`}
                  disabled={disabled || plan.legend.length === 1}
                  onClick={() => {
                    if (categoryUsage(plan, c.id) === 0)
                      exec((p, ctx) => deleteCategory(p, c.id, null, ctx));
                    else
                      setDeleting({
                        id: c.id,
                        replacement: plan.legend.find((k) => k.id !== c.id)?.id ?? '',
                      });
                  }}
                >
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleting !== null && (
        <fieldset className="wap-panel-proposal" aria-label="Kategorie mit Ersatz löschen">
          <span>
            «{plan.legend.find((k) => k.id === deleting.id)?.name}» wird{' '}
            {categoryUsage(plan, deleting.id)}-mal verwendet. Eine Ersatzkategorie für alle
            betroffenen Einträge wählen.
          </span>
          <SelectField
            label="Ersatzkategorie"
            value={deleting.replacement}
            choices={plan.legend
              .filter((k) => k.id !== deleting.id)
              .map((k) => ({ value: k.id, label: k.name }))}
            onCommit={(replacement) => setDeleting({ ...deleting, replacement })}
          />
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => {
              const d = deleting;
              setDeleting(null);
              exec(
                (p, ctx) => deleteCategory(p, d.id, d.replacement, ctx),
                'Kategorie gelöscht, Einträge umgeteilt.',
              );
            }}
          >
            Löschen und ersetzen
          </button>
          <button type="button" className="btn" onClick={() => setDeleting(null)}>
            Abbrechen
          </button>
        </fieldset>
      )}
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={() => {
          let n = plan.legend.length + 1;
          while (plan.legend.some((c) => c.name === `Kategorie ${n}`)) n += 1;
          exec((p, ctx) =>
            upsertCategory(
              p,
              {
                name: `Kategorie ${n}`,
                legendLabel: `Kategorie ${n}`,
                color: { r: 220, g: 220, b: 220 },
                neutral: false,
                inLegend: true,
              },
              ctx,
            ),
          );
        }}
      >
        Neue Kategorie
      </button>
    </>
  );
}

function categoryChoices(plan: Plan, none?: string): Choice[] {
  return [
    ...(none === undefined ? [] : [{ value: '', label: none }]),
    ...plan.legend.map((c) => ({ value: c.id, label: c.name })),
  ];
}

function FunctionTab({ plan, disabled, exec }: TabProps) {
  const list = plan.functionList;
  const save = (next: typeof list) => exec((p, ctx) => updateFunctionList(p, next, ctx));
  return (
    <>
      <p className="wap-panel-hint">
        Beim Setzen der Ltg schlägt der WAP-Planer die Kategorie gemäss dieser Liste vor.
        «Einzelfunktion» gilt für die Prüfung P5 (Etappe 2).
      </p>
      <table aria-label="Funktionsliste">
        <thead>
          <tr>
            <th scope="col">Kürzel</th>
            <th scope="col">Kategorie</th>
            <th scope="col">Einzelfunktion</th>
            <th scope="col">
              <span className="wap-i2-sr">Aktionen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((f, i) => (
            <tr key={f.code}>
              <td>
                <TextField
                  label={`Kürzel ${f.code}`}
                  value={f.code}
                  disabled={disabled}
                  onCommit={(code) => save(list.map((x, j) => (j === i ? { ...x, code } : x)))}
                />
              </td>
              <td>
                <SelectField
                  label={`Kategorie ${f.code}`}
                  value={f.categoryId ?? ''}
                  choices={categoryChoices(plan, 'keine')}
                  disabled={disabled}
                  onCommit={(v) =>
                    save(
                      list.map((x, j) => (j === i ? { ...x, categoryId: v === '' ? null : v } : x)),
                    )
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`${f.code} Einzelfunktion`}
                  checked={f.singleFunction}
                  disabled={disabled}
                  onChange={(e) =>
                    save(
                      list.map((x, j) =>
                        j === i ? { ...x, singleFunction: e.target.checked } : x,
                      ),
                    )
                  }
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Funktion ${f.code} entfernen`}
                  disabled={disabled}
                  onClick={() => save(list.filter((_, j) => j !== i))}
                >
                  Entfernen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={() => {
          let n = list.length + 1;
          while (list.some((f) => f.code === `Funktion ${n}`)) n += 1;
          save([...list, { code: `Funktion ${n}`, categoryId: null, singleFunction: false }]);
        }}
      >
        Funktion hinzufügen
      </button>
    </>
  );
}

function PersonTab({ plan, disabled, exec, setError, setNotice }: TabProps) {
  const fileId = useId();
  const [mode, setMode] = useState<'replace' | 'add'>('add');
  const [draft, setDraft] = useState<PersonInput>({
    grad: '',
    name: '',
    vorname: '',
    funktion: '',
  });
  const list: PersonInput[] = plan.persons.map((p) => ({
    grad: p.grad,
    name: p.name,
    vorname: p.vorname,
    funktion: p.funktion,
  }));
  const saveAll = (next: readonly PersonInput[]) => exec((p, ctx) => replacePersons(p, next, ctx));
  const cell = (i: number, key: keyof PersonInput, label: string) => (
    <TextField
      label={`${label} Person ${i + 1}`}
      value={list[i]?.[key] ?? ''}
      disabled={disabled}
      validate={(v) => (key === 'name' && v.trim() === '' ? 'Der Name ist Pflicht.' : '')}
      onCommit={(v) => saveAll(list.map((x, j) => (j === i ? { ...x, [key]: v } : x)))}
    />
  );
  return (
    <>
      <Section title="Aus Datei einlesen">
        <p className="wap-panel-hint">
          CSV (Trennzeichen «;» oder «,») oder Excel (.xlsx, erstes Blatt) mit der Kopfzeile Grad,
          Name, Vorname, Funktion. Nur diese vier Spalten werden übernommen; alle übrigen Spalten
          (z.B. AHV-Nummer, Telefon, Adresse) werden nicht gelesen und nirgends gespeichert. Die
          Datei bleibt unverändert auf diesem Gerät.
        </p>
        <div className="wap-panel-row">
          <SelectField
            label="Beim Einlesen"
            value={mode}
            choices={[
              { value: 'add', label: 'Liste ergänzen' },
              { value: 'replace', label: 'Liste ersetzen' },
            ]}
            onCommit={(v) => setMode(v === 'replace' ? 'replace' : 'add')}
          />
          <div className="wap-panel-field">
            <label htmlFor={fileId} className="wap-panel-label">
              <span>Personenliste aus Datei einlesen</span>
            </label>
            <input
              id={fileId}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file === undefined) return;
                const name = file.name;
                file
                  .arrayBuffer()
                  .then((buffer) => readPersonFile(new Uint8Array(buffer), name))
                  .then((result) => {
                    const n = result.persons.length;
                    const skipped = result.skippedRows.length;
                    const summary = `«${name}»: ${n} ${n === 1 ? 'Person' : 'Personen'} gelesen${skipped > 0 ? `, ${skipped} ${skipped === 1 ? 'Zeile' : 'Zeilen'} ohne Name übersprungen` : ''}; ${result.droppedColumnCount} weitere ${result.droppedColumnCount === 1 ? 'Spalte' : 'Spalten'} nicht übernommen.`;
                    exec(
                      (p, ctx) =>
                        mode === 'replace'
                          ? replacePersons(p, result.persons, ctx)
                          : addPersons(p, result.persons, ctx),
                      summary,
                    );
                  })
                  .catch((e: unknown) => {
                    setNotice('');
                    setError(messageOf(e));
                  });
              }}
            />
          </div>
        </div>
      </Section>
      <Section title={`Personen (${list.length})`}>
        {list.length > 0 && (
          <table aria-label="Personenliste">
            <thead>
              <tr>
                <th scope="col">Grad</th>
                <th scope="col">Name</th>
                <th scope="col">Vorname</th>
                <th scope="col">Funktion</th>
                <th scope="col">
                  <span className="wap-i2-sr">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.persons.map((p, i) => (
                <tr key={p.id}>
                  <td>{cell(i, 'grad', 'Grad')}</td>
                  <td>{cell(i, 'name', 'Name')}</td>
                  <td>{cell(i, 'vorname', 'Vorname')}</td>
                  <td>{cell(i, 'funktion', 'Funktion')}</td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      aria-label={`Person ${i + 1} entfernen`}
                      disabled={disabled}
                      onClick={() => saveAll(list.filter((_, j) => j !== i))}
                    >
                      Entfernen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form
          className="wap-panel-row"
          aria-label="Person von Hand erfassen"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.name.trim() === '') {
              setError(
                'Die neue Person hat keinen Namen. Den Namen eingeben und erneut hinzufügen.',
              );
              return;
            }
            exec((p, ctx) => addPersons(p, [draft], ctx));
            setDraft({ grad: '', name: '', vorname: '', funktion: '' });
          }}
        >
          {(['grad', 'name', 'vorname', 'funktion'] as const).map((key) => (
            <label key={key} className="wap-panel-field">
              <span className="wap-panel-label">
                <span>
                  {key === 'grad'
                    ? 'Grad'
                    : key === 'name'
                      ? 'Name'
                      : key === 'vorname'
                        ? 'Vorname'
                        : 'Funktion'}{' '}
                  (neu)
                </span>
              </span>
              <input
                value={draft[key]}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
          <button type="submit" className="btn" disabled={disabled}>
            Person hinzufügen
          </button>
        </form>
      </Section>
    </>
  );
}

const WEIGHTS: readonly Choice[] = [
  { value: 'narrow', label: 'schmal' },
  { value: 'normal', label: 'normal' },
  { value: 'wide', label: 'breit' },
];

function SetTab({ plan, disabled, exec }: TabProps) {
  const [setId, setSetId] = useState(plan.columnSets[0]?.id ?? '');
  /** Rückfrage vor dem Löschen eines Satzes, auf dessen Spalten Einträge verweisen (CR-4-02). */
  const [askDelete, setAskDelete] = useState<{ id: string; name: string; count: number } | null>(
    null,
  );
  const keepRef = useRef<HTMLButtonElement>(null);
  const set = plan.columnSets.find((s) => s.id === setId) ?? plan.columnSets[0];
  const change = (c: ColumnSetChange) => {
    if (set !== undefined) exec((p, ctx) => updateColumnSet(p, set.id, c, ctx));
  };
  const usage = set === undefined ? 0 : columnSetUsage(plan, set.id);
  const placeable = (set?.columns ?? []).filter(
    (c) => c.kind === 'planning' || c.kind === 'secondary',
  ).length;
  const hasSecondary = (set?.columns ?? []).some((c) => c.kind === 'secondary');
  return (
    <>
      <div className="wap-panel-row">
        <SelectField
          label="Spaltensatz"
          value={set?.id ?? ''}
          choices={plan.columnSets.map((s) => ({ value: s.id, label: s.name }))}
          onCommit={setSetId}
        />
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => {
            let n = plan.columnSets.length + 1;
            while (plan.columnSets.some((s) => s.name === `Spaltensatz ${n}`)) n += 1;
            exec((p, ctx) => createColumnSet(p, `Spaltensatz ${n}`, null, ctx));
          }}
        >
          Neuer Spaltensatz
        </button>
        {set !== undefined && (
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => {
              let name = `${set.name} (Kopie)`;
              let n = 2;
              while (plan.columnSets.some((s) => s.name === name))
                name = `${set.name} (Kopie ${n++})`;
              exec((p, ctx) => createColumnSet(p, name, set.id, ctx));
            }}
          >
            Kopie anlegen
          </button>
        )}
        {set !== undefined && (
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => {
              // Verweisen Einträge auf Spalten des Satzes (z.B. aufbewahrter Satz «vor Entfernen»), verlieren sie
              // ihre Lage: erst nach Rückfrage mit Anzahl (CR-4-02).
              const count = columnSetReferences(plan, set.id);
              if (count === 0) exec((p, ctx) => deleteColumnSet(p, set.id, ctx));
              else {
                setAskDelete({ id: set.id, name: set.name, count });
                requestAnimationFrame(() => keepRef.current?.focus());
              }
            }}
          >
            Spaltensatz löschen
          </button>
        )}
      </div>
      {askDelete !== null && (
        <I2Dialog
          title={`Spaltensatz «${askDelete.name}» löschen`}
          description={`${String(askDelete.count)} ${askDelete.count === 1 ? 'Eintrag verweist' : 'Einträge verweisen'} auf Spalten dieses Satzes und ${askDelete.count === 1 ? 'verliert seine' : 'verlieren ihre'} Lage: Sie stehen danach über die ganze Planungsbreite (Befund P1 bleibt). Rückgängig mit Ctrl+Z.`}
          onClose={() => setAskDelete(null)}
        >
          <div className="wap-i2-choices">
            <button
              ref={keepRef}
              type="button"
              className="btn btn-primary"
              onClick={() => setAskDelete(null)}
            >
              Behalten
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const id = askDelete.id;
                setAskDelete(null);
                exec((p, ctx) => deleteColumnSet(p, id, ctx));
              }}
            >
              Trotzdem löschen
            </button>
          </div>
        </I2Dialog>
      )}
      {set !== undefined && (
        <>
          <TextField
            label="Name des Spaltensatzes"
            value={set.name}
            disabled={disabled}
            onCommit={(name) => exec((p, ctx) => renameColumnSet(p, set.id, name, ctx))}
          />
          <p className="wap-panel-hint">
            An {usage} {usage === 1 ? 'Tag' : 'Tagen'} zugewiesen. Eine entfernte Spalte löscht
            keine Einträge; sie werden markiert (Befund P1).
          </p>
          <table aria-label={`Spalten von «${set.name}»`}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Art</th>
                <th scope="col">Breite</th>
                <th scope="col">Beschriftung</th>
                <th scope="col">Standard-Kategorie</th>
                <th scope="col">
                  <span className="wap-i2-sr">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {set.columns.map((c: Column, i) => {
                const free = c.kind === 'planning' || c.kind === 'secondary';
                return (
                  <tr key={c.id}>
                    <td>
                      <TextField
                        label={`Spaltenname ${c.name}`}
                        value={c.name}
                        disabled={disabled}
                        onCommit={(name) =>
                          change({ op: 'update', columnId: c.id, changes: { name } })
                        }
                      />
                    </td>
                    <td>
                      {c.kind === 'planning'
                        ? 'Planungsspalte'
                        : c.kind === 'secondary'
                          ? 'Nebenspalte'
                          : c.kind === 'rap'
                            ? 'Rap-Spalte'
                            : 'Beso-Spalte'}
                    </td>
                    <td>
                      <SelectField
                        label={`Breite ${c.name}`}
                        value={c.weight}
                        choices={WEIGHTS}
                        disabled={disabled || !free}
                        onCommit={(v) =>
                          change({
                            op: 'update',
                            columnId: c.id,
                            changes: { weight: v as ColumnWeight },
                          })
                        }
                      />
                    </td>
                    <td>
                      <SelectField
                        label={`Beschriftung ${c.name}`}
                        value={c.labelOrientation}
                        choices={[
                          { value: 'horizontal', label: 'waagrecht' },
                          { value: 'vertical', label: 'senkrecht' },
                        ]}
                        disabled={disabled || !free}
                        onCommit={(v) =>
                          change({
                            op: 'update',
                            columnId: c.id,
                            changes: { labelOrientation: v as LabelOrientation },
                          })
                        }
                      />
                    </td>
                    <td>
                      <SelectField
                        label={`Standard-Kategorie ${c.name}`}
                        value={c.defaultCategoryId ?? ''}
                        choices={categoryChoices(plan, 'keine')}
                        disabled={disabled || !free}
                        onCommit={(v) =>
                          change({
                            op: 'update',
                            columnId: c.id,
                            changes: { defaultCategoryId: v === '' ? null : v },
                          })
                        }
                      />
                    </td>
                    <td className="wap-panel-actions">
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Spalte ${c.name} nach links`}
                        disabled={disabled || !free || i === 0}
                        onClick={() => exec((p, ctx) => moveColumn(p, set.id, c.id, -1, ctx))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Spalte ${c.name} nach rechts`}
                        disabled={disabled || !free || i >= placeable - 1}
                        onClick={() => exec((p, ctx) => moveColumn(p, set.id, c.id, 1, ctx))}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Spalte ${c.name} entfernen`}
                        disabled={disabled || !free}
                        onClick={() => change({ op: 'remove', columnId: c.id })}
                      >
                        Entfernen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="wap-panel-row">
            <button
              type="button"
              className="btn"
              disabled={disabled}
              onClick={() => {
                const planning = set.columns.filter((c) => c.kind === 'planning').length;
                let n = planning + 1;
                while (set.columns.some((c) => c.name === `Spalte ${n}`)) n += 1;
                change({
                  op: 'add',
                  index: planning,
                  column: { name: `Spalte ${n}`, kind: 'planning' },
                });
              }}
            >
              Planungsspalte hinzufügen
            </button>
            {!hasSecondary && (
              <button
                type="button"
                className="btn"
                disabled={disabled}
                onClick={() =>
                  change({
                    op: 'add',
                    index: set.columns.filter((c) => c.kind === 'planning').length,
                    column: {
                      name: plan.level === 'kp' ? 'Det' : 'Stab 2',
                      kind: 'secondary',
                      weight: 'narrow',
                    },
                  })
                }
              >
                Nebenspalte hinzufügen
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

function CodeTab({ plan, disabled, exec }: TabProps) {
  const meanings = plan.abbreviationMeanings ?? {};
  const [newCode, setNewCode] = useState('');
  const saveMeaning = (code: string, meaning: string) =>
    exec((p, ctx) =>
      updateAbbreviations(
        p,
        p.abbreviationsSelected,
        { ...(p.abbreviationMeanings ?? {}), [code]: meaning },
        ctx,
      ),
    );
  const codes = plan.rapportCodes;
  return (
    <>
      <p className="wap-panel-hint">
        In der Seitenleiste («Legende» bei Kp) erscheinen nur Kürzel, die in der Woche verwendet
        werden.
      </p>
      <Section title="Rapportkürzel">
        <table aria-label="Rapportkürzel">
          <thead>
            <tr>
              <th scope="col">Kürzel</th>
              <th scope="col">Kategorie</th>
              <th scope="col">Bedeutung</th>
              <th scope="col">
                <span className="wap-i2-sr">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {codes.map((r, i) => (
              <tr key={r.code}>
                <td>
                  <TextField
                    label={`Rapportkürzel ${r.code}`}
                    value={r.code}
                    disabled={disabled}
                    onCommit={(code) =>
                      exec((p, ctx) =>
                        updateRapportCodes(
                          p,
                          codes.map((x, j) => (j === i ? { ...x, code } : x)),
                          ctx,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <SelectField
                    label={`Kategorie ${r.code}`}
                    value={r.categoryId}
                    choices={categoryChoices(plan)}
                    disabled={disabled}
                    onCommit={(categoryId) =>
                      exec((p, ctx) =>
                        updateRapportCodes(
                          p,
                          codes.map((x, j) => (j === i ? { ...x, categoryId } : x)),
                          ctx,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <TextField
                    label={`Bedeutung ${r.code}`}
                    value={meanings[r.code] ?? ''}
                    disabled={disabled}
                    onCommit={(v) => saveMeaning(r.code, v)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    aria-label={`Rapportkürzel ${r.code} entfernen`}
                    disabled={disabled}
                    onClick={() =>
                      exec((p, ctx) =>
                        updateRapportCodes(
                          p,
                          codes.filter((_, j) => j !== i),
                          ctx,
                        ),
                      )
                    }
                  >
                    Entfernen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Weitere Kürzel">
        <table aria-label="Weitere Kürzel">
          <tbody>
            {plan.abbreviationsSelected.map((code) => (
              <tr key={code}>
                <th scope="row">{code}</th>
                <td>
                  <TextField
                    label={`Bedeutung ${code}`}
                    value={meanings[code] ?? ''}
                    disabled={disabled}
                    onCommit={(v) => saveMeaning(code, v)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    aria-label={`Kürzel ${code} entfernen`}
                    disabled={disabled}
                    onClick={() =>
                      exec((p, ctx) =>
                        updateAbbreviations(
                          p,
                          p.abbreviationsSelected.filter((x) => x !== code),
                          p.abbreviationMeanings ?? {},
                          ctx,
                        ),
                      )
                    }
                  >
                    Entfernen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          className="wap-panel-row"
          aria-label="Kürzel aufnehmen"
          onSubmit={(event) => {
            event.preventDefault();
            const code = newCode.trim();
            if (code === '') return;
            exec((p, ctx) =>
              updateAbbreviations(
                p,
                [...p.abbreviationsSelected, code],
                p.abbreviationMeanings ?? {},
                ctx,
              ),
            );
            setNewCode('');
          }}
        >
          <label className="wap-panel-field">
            <span className="wap-panel-label">
              <span>Neues Kürzel</span>
            </span>
            <input
              value={newCode}
              disabled={disabled}
              onChange={(e) => setNewCode(e.target.value)}
            />
          </label>
          <button type="submit" className="btn" disabled={disabled}>
            Kürzel aufnehmen
          </button>
        </form>
      </Section>
    </>
  );
}

function MarkerTab({ plan, disabled, exec }: TabProps) {
  const labels = plan.markerLabels;
  return (
    <Section title="Beschriftung der Marker">
      {(['AV', 'ABV', 'HV', 'custom'] as const).map((kind) => {
        const current = labels.find((l) => l.kind === kind);
        return (
          <CheckField
            key={kind}
            label={`${kind === 'custom' ? 'frei' : kind} mit Zeit (z.B. «${kind === 'custom' ? 'Appell' : kind} 2330»)`}
            checked={current?.withTime ?? false}
            disabled={disabled}
            onCommit={(withTime) =>
              exec((p, ctx) =>
                updateMarkerLabels(
                  p,
                  [...p.markerLabels.filter((l) => l.kind !== kind), { kind, withTime }],
                  ctx,
                ),
              )
            }
          />
        );
      })}
    </Section>
  );
}
