// Wochenbefehle (I3 C3; Beschrieb 5.2; UI-Richtlinie 3 «Wochenmenü»; F-16, F-17): einfügen und duplizieren mit
// Vorschau der Folgewochen, umbenennen, löschen (Meldung mit «Rückgängig») und «Gelöschte Wochen» wiederherstellen.

import { useEffect, useId, useRef, useState } from 'react';
import { addDays, formatDate, isoWeek } from '../../../model/wap/calendar';
import {
  deleteWeek,
  duplicateWeek,
  insertWeek,
  insertWeekPreview,
  renameWeek,
  restoreWeek,
} from '../../../model/wap/commands/weeks';
import { isRenderable } from '../../../model/wap/layout/text/measure';
import type { Id, Plan } from '../../../model/wap/types';
import { GLYPH_MESSAGE } from '../panel/fields';
import type { RunCommand } from '../panel/types';
import type { GridToast } from './GridEditor';
import { GridMenu } from './GridMenu';
import { I2Dialog } from './I2Dialog';

type Open = 'menu' | 'insert' | 'duplicate' | 'rename' | 'deleted' | null;

function range(start: string): string {
  return `${formatDate(start, 'long')}–${formatDate(addDays(start, 6), 'long')} · KW ${isoWeek(start)}`;
}

export function WeekCommands({
  plan,
  weekId,
  disabled,
  run,
  onWeek,
  onToast,
}: {
  plan: Plan;
  weekId: Id;
  disabled: boolean;
  run: (cmd: RunCommand) => Promise<void>;
  onWeek: (id: Id) => void;
  onToast: (t: GridToast) => void;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState('');
  const button = useRef<HTMLButtonElement>(null);
  const week = plan.weeks.find((w) => w.id === weekId);
  const close = () => {
    setOpen(null);
    setError('');
    button.current?.focus();
  };
  const exec = (cmd: RunCommand, after?: () => void) => {
    setError('');
    run(cmd)
      .then(() => after?.())
      .catch((e: unknown) => {
        const m = e as { userMessage?: { cause: string; nextStep: string } };
        setError(
          m.userMessage === undefined
            ? 'Der Befehl konnte nicht ausgeführt werden. Erneut versuchen.'
            : `${m.userMessage.cause} ${m.userMessage.nextStep}`,
        );
      });
  };
  const rect = button.current?.getBoundingClientRect();
  return (
    <>
      <button
        ref={button}
        type="button"
        className="btn wap-i2-icon"
        aria-haspopup="menu"
        aria-expanded={open === 'menu'}
        aria-label="Wochenbefehle"
        title="Wochenbefehle: Woche einfügen, duplizieren, umbenennen, löschen, gelöschte Wochen"
        onClick={() => setOpen(open === 'menu' ? null : 'menu')}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open === 'menu' && week !== undefined && (
        <GridMenu
          label="Wochenbefehle"
          x={rect?.left ?? 0}
          y={rect?.bottom ?? 0}
          onClose={(refocus) => {
            setOpen((o) => (o === 'menu' ? null : o));
            if (refocus) button.current?.focus();
          }}
          items={[
            { label: 'Woche danach einfügen …', key: 'E', disabled, run: () => setOpen('insert') },
            { label: 'Woche duplizieren …', key: 'D', disabled, run: () => setOpen('duplicate') },
            { label: 'Woche umbenennen …', key: 'U', disabled, run: () => setOpen('rename') },
            {
              label: `Woche «${week.label}» löschen`,
              key: 'L',
              disabled: disabled || plan.weeks.length === 1,
              run: () => {
                const index = plan.weeks.findIndex((w) => w.id === week.id);
                const neighbour = plan.weeks[index + 1] ?? plan.weeks[index - 1];
                exec(
                  (p, ctx) => deleteWeek(p, week.id, ctx),
                  () => {
                    if (neighbour !== undefined) onWeek(neighbour.id);
                    onToast({
                      text: `${week.shortName} gelöscht. Unter «Gelöschte Wochen» wiederherstellbar.`,
                      undo: 'Woche löschen',
                    });
                  },
                );
              },
            },
            {
              label: `Gelöschte Wochen (${plan.deletedWeeks.length}) …`,
              key: 'G',
              separatorBefore: true,
              run: () => setOpen('deleted'),
            },
          ]}
        />
      )}
      {(open === 'insert' || open === 'duplicate') && week !== undefined && (
        <InsertDialog
          plan={plan}
          weekId={week.id}
          duplicate={open === 'duplicate'}
          error={error}
          disabled={disabled}
          onClose={close}
          onConfirm={(shift) => {
            let created: Id | null = null;
            exec(
              (p, ctx) => {
                const r =
                  open === 'duplicate'
                    ? duplicateWeek(p, week.id, { shiftFollowing: shift }, ctx)
                    : insertWeek(p, week.id, { shiftFollowing: shift }, ctx);
                created = r.weekId;
                return r;
              },
              () => {
                setOpen(null);
                if (created !== null) onWeek(created);
                onToast({
                  text: open === 'duplicate' ? `«${week.label}» dupliziert` : 'Woche eingefügt',
                  undo: open === 'duplicate' ? 'Duplizieren' : 'Einfügen',
                });
              },
            );
          }}
        />
      )}
      {open === 'rename' && week !== undefined && (
        <RenameDialog
          label={week.label}
          shortName={week.shortName}
          error={error}
          onClose={close}
          onConfirm={(label, shortName) =>
            exec(
              (p, ctx) => renameWeek(p, week.id, { label, shortName }, ctx),
              () => close(),
            )
          }
        />
      )}
      {open === 'deleted' && (
        <I2Dialog
          title="Gelöschte Wochen"
          description="Gelöschte Wochen bleiben bis zum nächsten Stand mit allen Einträgen wiederherstellbar (F-17)."
          onClose={close}
        >
          {plan.deletedWeeks.length === 0 ? (
            <p>Keine gelöschten Wochen.</p>
          ) : (
            <ul className="wap-panel-list">
              {plan.deletedWeeks.map((d, i) => (
                <li key={d.week.id} className="wap-panel-row">
                  <span>
                    {d.week.label} ({d.week.shortName}) · {range(d.week.startDate)} ·{' '}
                    {d.entries.length} {d.entries.length === 1 ? 'Eintrag' : 'Einträge'}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    disabled={disabled}
                    onClick={() =>
                      exec(
                        (p, ctx) => restoreWeek(p, i, ctx),
                        () => {
                          setOpen(null);
                          onWeek(d.week.id);
                          onToast({
                            text: `«${d.week.label}» wiederhergestellt`,
                            undo: 'Wiederherstellen',
                          });
                        },
                      )
                    }
                  >
                    «{d.week.label}» wiederherstellen
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error !== '' && (
            <p role="alert" className="wap-i2-field-error">
              {error}
            </p>
          )}
        </I2Dialog>
      )}
    </>
  );
}

function InsertDialog({
  plan,
  weekId,
  duplicate,
  error,
  disabled,
  onClose,
  onConfirm,
}: {
  plan: Plan;
  weekId: Id;
  duplicate: boolean;
  error: string;
  disabled: boolean;
  onClose: () => void;
  onConfirm: (shift: boolean) => void;
}) {
  const preview = insertWeekPreview(plan, weekId);
  const [shift, setShift] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const shiftId = useId();
  useEffect(() => {
    first.current?.focus();
  }, []);
  const week = plan.weeks.find((w) => w.id === weekId);
  return (
    <I2Dialog
      title={duplicate ? 'Woche duplizieren' : 'Woche danach einfügen'}
      description={`${duplicate ? `Kopie von «${week?.label ?? ''}» mit allen Einträgen` : 'Neue leere Woche'}: ${range(preview.startDate)}.`}
      onClose={onClose}
    >
      {preview.collides && (
        <div className="wap-i2-form">
          <p>
            Ab {formatDate(preview.startDate, 'long')} liegt schon eine Woche. Diese Folgewochen
            müssten weichen:
          </p>
          <ul aria-label="Vorschau verschobene Folgewochen">
            {preview.shifted.map((s) => {
              const w = plan.weeks.find((x) => x.id === s.weekId);
              return (
                <li key={s.weekId}>
                  {w?.label ?? ''}: {formatDate(s.from, 'long')} → {formatDate(s.to, 'long')}
                </li>
              );
            })}
          </ul>
          <label htmlFor={shiftId}>
            <input
              id={shiftId}
              type="checkbox"
              checked={shift}
              onChange={(e) => setShift(e.target.checked)}
            />{' '}
            Folgewochen um eine Woche verschieben (ihre Einträge wandern mit)
          </label>
        </div>
      )}
      {error !== '' && (
        <p role="alert" className="wap-i2-field-error">
          {error}
        </p>
      )}
      <div className="i2-grid-scope">
        <button
          ref={first}
          type="button"
          className="btn btn-primary"
          disabled={disabled || (preview.collides && !shift)}
          onClick={() => onConfirm(shift)}
        >
          {duplicate ? 'Duplizieren' : 'Einfügen'}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </I2Dialog>
  );
}

function RenameDialog({
  label,
  shortName,
  error,
  onClose,
  onConfirm,
}: {
  label: string;
  shortName: string;
  error: string;
  onClose: () => void;
  onConfirm: (label: string, shortName: string) => void;
}) {
  const [l, setL] = useState(label);
  const [s, setS] = useState(shortName);
  const [local, setLocal] = useState('');
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    first.current?.select();
  }, []);
  const message = local !== '' ? local : error;
  return (
    <I2Dialog
      title="Woche umbenennen"
      description="Der Kurzname erscheint in den Dateinamen."
      onClose={onClose}
    >
      <form
        className="wap-i2-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!isRenderable(l) || !isRenderable(s)) {
            setLocal(GLYPH_MESSAGE);
            return;
          }
          setLocal('');
          onConfirm(l, s);
        }}
      >
        <label>
          Bezeichnung
          <input ref={first} value={l} onChange={(e) => setL(e.target.value)} />
        </label>
        <label>
          Kurzname
          <input value={s} onChange={(e) => setS(e.target.value)} />
        </label>
        {message !== '' && (
          <p role="alert" className="wap-i2-field-error">
            {message}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          Umbenennen
        </button>
      </form>
    </I2Dialog>
  );
}
