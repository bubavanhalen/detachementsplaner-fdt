// @vitest-environment jsdom
// Paket E1-04: Historie im Speicher – 200 Schritte über Neuladen, Verwerfen und Kürzen mit Stand-Aufzeichnungen und
// Importberichten (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitte H, I2,
// J, L R-5.6-15 Nr 4–6; ADR-006 Punkt 1, 2d; AR0-45, AR0-48). Echter Speicher auf fake-indexeddb, je Test eine neue
// Fabrik. Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { listStands } from '../../../../src/io/wap-plan/standStore';
import { EMPTY_HISTORY } from '../../../../src/model/wap/history/history';
import type { Plan } from '../../../../src/model/wap/types';
import {
  anzahlen,
  neueFabrik,
  neuLaden,
  oeffnen,
  planDatensatz,
  werteVonPlan,
} from '../../support/storage/datenbank';
import {
  A,
  dateiStand,
  motto,
  planA,
  planDatei,
  speichern,
  standSetzen,
  titel,
} from '../../support/storage/plaene';
import { gleich, vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

const LANG = 60_000;

describe('Historie im Speicher', () => {
  it(
    '[R-5.6-15] 210 × commit → Neuladen → 200 × undo ergibt das Dokument nach Änderung 10; 201. undo null; 200 Schritt-Datensätze; nextSeq 211',
    async () => {
      const f = neueFabrik();
      let store = await oeffnen(f);
      const uhr = new TestUhr(zeitpunkt('2026-10-07', 8));
      const geladen = await store.create(planA(), uhr);
      expect(geladen.history).toEqual(EMPTY_HISTORY);
      expect(geladen.revision).toBe(0);
      let plan: Plan = geladen.plan;
      const plaene: Plan[] = [plan];
      for (let i = 1; i <= 210; i++) {
        const r = titel('e101', `Titel ${String(i)} (fiktiv)`)(plan);
        const s = await store.commit(A, r, uhr);
        expect(s.seq).toBe(i);
        plan = r.plan;
        plaene.push(plan);
      }
      expect((await anzahlen(f)).history).toBe(200);
      const kopf = vorhanden(await planDatensatz(f, A)).historyHead as Record<string, unknown>;
      expect(kopf).toEqual({ cursor: 200, nextSeq: 211, truncatedThroughSeq: 10 });

      store = await neuLaden(store, f);
      const nachLaden = vorhanden(await store.load(A));
      expect(nachLaden.history.steps).toHaveLength(200);
      expect(nachLaden.history.cursor).toBe(200);
      expect(nachLaden.history.nextSeq).toBe(211);
      expect(nachLaden.history.truncatedThroughSeq).toBe(10);
      gleich(nachLaden.plan, plaene[210]);

      for (let i = 0; i < 200; i++) vorhanden(await store.undo(A, uhr), `Undo ${String(i + 1)}`);
      gleich(vorhanden(await store.load(A)).plan, plaene[10], 'Dokument nach Änderung 10');
      expect(await store.undo(A, uhr)).toBeNull();
      expect((await anzahlen(f)).history, 'Undo löscht keine Schritte').toBe(200);

      const weiter = await store.commit(
        A,
        titel('e101', 'Neu nach Undo (fiktiv)')(plaene[10] ?? plan),
        uhr,
      );
      expect(weiter.seq).toBe(211);
      expect((await anzahlen(f)).history, 'Redo-Zweig verworfen').toBe(1);
    },
    LANG,
  );

  it('[R-5.6-15] Verwerfen: Stand per commitAtomic (Schritt s), undo, neuer commit → Aufzeichnung und Importbericht von s gelöscht', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await speichern(store, A, motto('Vorher (fiktiv)'), uhr);
    const s = await standSetzen(store, A, uhr, {
      standId: 'stand-s',
      importReport: { art: 'Importbericht (fiktiv)', eintraege: 2 },
    });
    expect(s.seq).toBe(2);
    expect(await werteVonPlan(f, 'stands', A)).toHaveLength(1);
    expect(await werteVonPlan(f, 'importReports', A)).toHaveLength(1);
    expect(await store.importReports(A)).toHaveLength(1);

    vorhanden(await store.undo(A, uhr));
    expect((await store.standRecords(A)).map((r) => r.visible)).toEqual([false]);
    expect(await store.importReports(A)).toEqual([]);
    expect(await werteVonPlan(f, 'stands', A), 'Undo löscht nichts').toHaveLength(1);

    const neu = await speichern(store, A, motto('Neu (fiktiv)'), uhr);
    expect(neu.seq).toBe(3);
    expect(await werteVonPlan(f, 'stands', A)).toHaveLength(0);
    expect(await werteVonPlan(f, 'importReports', A)).toHaveLength(0);
    expect(await werteVonPlan(f, 'history', A)).toHaveLength(2);
    expect(await store.standRecords(A)).toEqual([]);
    expect(await store.importReports(A)).toEqual([]);
  });

  it('[R-5.6-15] Verwerfen: nach replaceFromFile, undo und neuem commit haben die lokalen Aufzeichnungen hiddenBySeq null und sind sichtbar', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 10));
    await store.create(planA(), uhr);
    const lokal = await standSetzen(store, A, uhr, { standId: 'stand-lokal' });
    const datei = planDatei(
      { ...planA(), motto: 'Aus Datei (fiktiv)' },
      { stands: [dateiStand(planA(), 'stand-datei')] },
    );
    const ersetzt = await store.replaceFromFile(A, datei, uhr);
    const lokalNachErsetzen = (await store.standRecords(A)).find(
      (r) => r.standId === 'stand-lokal',
    );
    expect(lokalNachErsetzen?.hiddenBySeq).toBe(ersetzt.seq);
    expect(lokalNachErsetzen?.visible).toBe(false);

    vorhanden(await store.undo(A, uhr));
    await speichern(store, A, motto('Neu nach Undo (fiktiv)'), uhr);

    const records = await store.standRecords(A);
    expect(records.map((r) => r.standId)).toEqual(['stand-lokal']);
    const l = vorhanden(records[0]);
    expect(l.recordId).toBe(lokal.standRecord.recordId);
    expect(l.seq).toBe(lokal.seq);
    expect(l.hiddenBySeq).toBeNull();
    expect(l.visible).toBe(true);
    expect((await listStands(store, A)).map((x) => x.standId)).toEqual(['stand-lokal']);
  });

  it(
    '[R-5.6-15] Kürzen: eine durch replaceFromFile ausgeblendete Aufzeichnung ist nach mehr als 200 weiteren commit gelöscht; eine Aufzeichnung mit gekürzter seq bleibt sichtbar',
    async () => {
      const f = neueFabrik();
      const store = await oeffnen(f);
      const uhr = new TestUhr(zeitpunkt('2026-10-07', 11));
      await store.create(planA(), uhr);
      const lokal = await standSetzen(store, A, uhr, { standId: 'stand-lokal' });
      expect(lokal.seq).toBe(1);
      const ersetzt = await store.replaceFromFile(
        A,
        planDatei(planA(), { stands: [dateiStand(planA(), 'stand-datei')] }),
        uhr,
      );
      expect(ersetzt.seq).toBe(2);
      for (let i = 1; i <= 201; i++) await speichern(store, A, motto(`M${String(i)}`), uhr);

      const geladen = vorhanden(await store.load(A));
      expect(geladen.history.truncatedThroughSeq).toBe(3);
      const records = await store.standRecords(A);
      expect(records.map((r) => r.standId)).toEqual(['stand-datei']);
      expect(records[0]?.seq).toBe(2);
      expect(records[0]?.visible).toBe(true);
      expect(await werteVonPlan(f, 'stands', A)).toHaveLength(1);
      expect((await listStands(store, A)).map((x) => x.standId)).toEqual(['stand-datei']);
    },
    LANG,
  );
});
