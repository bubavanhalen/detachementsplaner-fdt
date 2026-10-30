// @vitest-environment jsdom
// I3 C4: Personenliste aus Datei ohne Zwischenspeicherung verworfener Spalten (Beschrieb 4.1, 11; Prompt §8;
// R-4.1-11, R-11-05). Echter Speicher auf fake-indexeddb wie in der App: Einlesen → Befehl → Speichern, Undo/Redo,
// Plan-Datei und PDF. Byte- bzw. Textsuche nach den Prüfwerten der verworfenen Spalten; Ausgabe nur Anzahlen.
import { describe, expect, it } from 'vitest';
import { renderWeekPdf } from '../../../../src/io/wap-pdf/index';
import { readPersonFile } from '../../../../src/io/wap-persons/index';
import { addPersons, replacePersons } from '../../../../src/model/wap/commands/persons';
import { csvMitZusatz, PERSONEN, treffer, xlsxMitZusatz } from '../../support/i3/personen';
import { CTX, kpPlan, weekId } from '../../support/i3/plan';
import { pageOptions } from '../../support/i3/seite';
import { readPdf } from '../../support/pdf/read';
import {
  datensaetze,
  kanonisch,
  neueFabrik,
  neuLaden,
  oeffnen,
  SPEICHERBEREICHE,
} from '../../support/storage/datenbank';

const clock = { now: () => new Date('2026-10-14T08:00:00Z') };
const utf8 = (s: string) => new TextEncoder().encode(s);

async function speicherTreffer(fabrik: IDBFactory): Promise<number> {
  let n = 0;
  for (const b of SPEICHERBEREICHE)
    n += treffer(utf8(JSON.stringify(kanonisch(await datensaetze(fabrik, b)))));
  return n;
}

describe('I3 C4 Datenschutz der Personenliste', () => {
  for (const [name, bytes] of [
    ['liste.csv', csvMitZusatz],
    ['liste.xlsx', xlsxMitZusatz],
  ] as const) {
    it(`[R-4.1-11][R-11-05] ${name} mit AHV-Nr, Telefon und Adresse: übernommen nur Grad, Name, Vorname, Funktion; Speicher, Undo-Historie, Plan-Datei und PDF ohne diese Werte`, async () => {
      const fabrik = neueFabrik();
      let store = await oeffnen(fabrik);
      const plan = kpPlan(1);
      await store.create(plan, clock);
      const gelesen = await readPersonFile(bytes(), name);
      expect(treffer(utf8(JSON.stringify(gelesen)))).toBe(0);
      const before = await store.load(plan.id);
      if (before === null) throw new Error('Plan fehlt');
      const r = replacePersons(before.plan, gelesen.persons, CTX);
      await store.commit(plan.id, r, clock, { expectedRevision: before.revision });
      const add = addPersons(r.plan, gelesen.persons, CTX);
      expect(add.added).toBe(0);
      // Neu laden: lokaler Speicher (alle Bereiche) und Undo-Historie.
      store = await neuLaden(store, fabrik);
      const loaded = await store.load(plan.id);
      expect(
        loaded?.plan.persons.map(({ grad, name: n, vorname, funktion }) => ({
          grad,
          name: n,
          vorname,
          funktion,
        })),
      ).toEqual(PERSONEN);
      expect(await speicherTreffer(fabrik)).toBe(0);
      expect(treffer(utf8(JSON.stringify(loaded?.history ?? null)))).toBe(0);
      // Undo und Redo bleiben ohne die Werte.
      await store.undo(plan.id, clock);
      expect(await speicherTreffer(fabrik)).toBe(0);
      await store.redo(plan.id, clock);
      expect(await speicherTreffer(fabrik)).toBe(0);
      // Plan-Datei.
      const file = await store.exportPlanFile(plan.id, clock);
      expect(treffer(file.bytes)).toBe(0);
      expect(new TextDecoder().decode(file.bytes)).toContain('Muster');
      // PDF der Woche (Text aus dem fertigen PDF).
      const after = await store.load(plan.id);
      if (after === null) throw new Error('Plan fehlt');
      const pdf = await renderWeekPdf(
        after.plan,
        weekId(after.plan, 0),
        pageOptions(),
        'I3 Personen',
      );
      const text = (await readPdf(pdf.bytes)).texts.map((t) => t.text).join('\n');
      expect(treffer(utf8(text))).toBe(0);
      store.close();
    });
  }
});
