// Personenliste (I3 C4; Beschrieb 4.1 «Personenliste (Grad, Name, Vorname, Funktion) … von Hand oder aus einer
// Datei erfasst»; Prompt §8; R-4.1-09, R-4.1-11, R-11-05). Eine Person führt nur diese vier Felder; jede Änderung
// ist ein Undo-Schritt. Andere Spalten einer Datei erreichen diese Befehle nie (src/io/wap-persons).

import { castDraft } from 'immer';
import type { Person, Plan } from '../types';
import { type CommandContext, CommandError, type CommandResult, command } from './command';

/** Eine Person ohne ID: genau Grad, Name, Vorname, Funktion (getrimmt). */
export type PersonInput = Omit<Person, 'id'>;

/** Nur die vier erlaubten Felder, getrimmt; andere Eigenschaften eines Objekts werden nie übernommen (R-11-05). */
export function personFields(p: PersonInput): PersonInput {
  return {
    grad: String(p.grad ?? '').trim(),
    name: String(p.name ?? '').trim(),
    vorname: String(p.vorname ?? '').trim(),
    funktion: String(p.funktion ?? '').trim(),
  };
}

function key(p: PersonInput): string {
  return `${p.grad.toLowerCase()}\u0000${p.name.toLowerCase()}\u0000${p.vorname.toLowerCase()}`;
}

function checked(list: readonly PersonInput[]): readonly PersonInput[] {
  return list.map((p, i) => {
    const f = personFields(p);
    if (f.name === '') {
      throw new CommandError(
        'invalidEntry',
        {
          cause: `Person ${i + 1} hat keinen Namen.`,
          nextStep: 'Den Namen eingeben oder die Zeile entfernen.',
        },
        { field: `persons[${i}].name` },
      );
    }
    return f;
  });
}

/** Text einer Person für Auswahl und Autovervollständigung, z.B. «Lt Muster Beispiel (Zfhr)». */
export function personLabel(p: PersonInput): string {
  const name = [p.grad, p.name, p.vorname].filter((x) => x !== '').join(' ');
  return p.funktion === '' ? name : `${name} (${p.funktion})`;
}

/** Text, der beim Wählen einer Person in Ltg bzw. Tn eingetragen wird (Grad und Name, wie im WAP üblich). */
export function personShort(p: PersonInput): string {
  return [p.grad, p.name].filter((x) => x !== '').join(' ');
}

/**
 * Ersetzt die Personenliste (Plan-Einstellungen von Hand oder Datei «ersetzen»). Bestehende Personen mit gleichem
 * Grad, Name und Vorname behalten ihre ID; neue erhalten eine neue (Präfix «r»).
 */
export function replacePersons(
  plan: Plan,
  persons: readonly PersonInput[],
  ctx: CommandContext,
): CommandResult {
  const list = checked(persons);
  const existing = new Map(plan.persons.map((p) => [key(p), p.id]));
  return command(
    plan,
    `Personenliste ersetzt (${list.length} ${list.length === 1 ? 'Person' : 'Personen'})`,
    (d, t) => {
      const used = new Set<string>();
      const next: Person[] = list.map((p) => {
        const known = existing.get(key(p));
        const id = known !== undefined && !used.has(known) ? known : t.newId('r');
        used.add(id);
        return { id, ...p };
      });
      d.persons = castDraft(next);
    },
    ctx,
  );
}

/** Ergänzt die Liste; doppelte Personen (gleicher Grad, Name, Vorname) werden nicht erneut angelegt (Vertrag E1-09). */
export function addPersons(
  plan: Plan,
  persons: readonly PersonInput[],
  ctx: CommandContext,
): CommandResult & { readonly added: number } {
  const list = checked(persons);
  const known = new Set(plan.persons.map(key));
  const fresh: PersonInput[] = [];
  for (const p of list) {
    if (known.has(key(p))) continue;
    known.add(key(p));
    fresh.push(p);
  }
  const r = command(
    plan,
    `${fresh.length} ${fresh.length === 1 ? 'Person' : 'Personen'} ergänzt`,
    (d, t) => {
      for (const p of fresh) d.persons.push({ id: t.newId('r'), ...p });
    },
    ctx,
  );
  return { ...r, added: fresh.length };
}
