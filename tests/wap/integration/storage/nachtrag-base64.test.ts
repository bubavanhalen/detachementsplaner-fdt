// @vitest-environment jsdom
// Paket E1-04b (Nachtrag E1-04, CR-E104-01): Base64-Prüfung der Plan-Datei bei grossem Gesamt-PDF und gleich
// strenge Regel D2 (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, «Änderungsnotiz Runde 2» R2-0, R2-1, R2-7,
// R2-8; Katalog-Notiz E1-04b R-L-12). Pflichtfälle N1-a bis N1-c tragen R-L-12 und die alte ID R-5.6-17,
// Gegenfälle N1-d bis N1-f nur R-5.6-17 (Plan Etappe 1 Regel 1.1). Fehler werden als Wert erfasst (R2-0).
// Das PDF ist synthetisch (Byte i = (i * 31 + 7) & 255), alle übrigen Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  type PlanFile,
  PlanFileError,
  parsePlanFile,
  type StandSnapshotFile,
  serializePlanFile,
} from '../../../../src/io/wap-plan/planFile';
import { standPdf } from '../../../../src/io/wap-plan/standStore';
import type { PlanFileExport } from '../../../../src/io/wap-plan/store';
import { sha256 } from '../../support/stand/hilfen';
import { neueFabrik, oeffnen } from '../../support/storage/datenbank';
import {
  A,
  dateiStand,
  jsonBytes,
  planA,
  planDatei,
  rohDatei,
  standAuftrag,
} from '../../support/storage/plaene';
import { gleicheBytes, vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

/** Zeitgrenze der Fälle mit 4-MiB-PDF (R2-1, V05). */
const LANG = 60_000;

/** Gesamt-PDF von 4 MiB (R2-1): reine Testdaten, keine Paketfunktion. */
const PDF_GROSS: Uint8Array = (() => {
  const b = new Uint8Array(4 * 1_048_576);
  for (let i = 0; i < b.length; i++) b[i] = (i * 31 + 7) & 255;
  return b;
})();
const PDF_GROSS_SHA = sha256(PDF_GROSS);

const MODIFIZIERT = '2026-10-01T12:00:00.000Z';
const PFAD = 'stands[0].pdfs[0].base64';

/** Ergebnis oder Fehler eines synchronen Aufrufs als Wert (Fehler null, wenn nichts geworfen wurde). */
function erfasse<T>(fn: () => T): { readonly wert: T | null; readonly fehler: unknown } {
  try {
    return { wert: fn(), fehler: null };
  } catch (fehler: unknown) {
    return { wert: null, fehler };
  }
}

/** Ergebnis oder Ablehnungsgrund eines Promise als Wert. */
async function erfasseAsync<T>(
  p: Promise<T>,
): Promise<{ readonly wert: T | null; readonly fehler: unknown }> {
  try {
    return { wert: await p, fehler: null };
  } catch (fehler: unknown) {
    return { wert: null, fehler };
  }
}

/** Datei-Stand mit dem 4-MiB-PDF unter 'plan', Wochen-PDF unverändert. */
function grosserStand(): StandSnapshotFile {
  const basis = dateiStand(planA(), 'stand-gross');
  const pdfs = new Map(basis.pdfs);
  pdfs.set('plan', PDF_GROSS);
  return { ...basis, pdfs };
}

/** Prüft das Gesamt-PDF über Länge und SHA-256 (R2-0: grosse Bytes nicht über gleicheBytes). */
function gesamtGleich(bytes: Uint8Array | undefined): void {
  const b = vorhanden(bytes, "Gesamt-PDF 'plan' vorhanden");
  expect(b.length, 'Länge des Gesamt-PDF').toBe(PDF_GROSS.length);
  expect(sha256(b), 'SHA-256 des Gesamt-PDF').toBe(PDF_GROSS_SHA);
}

/** Rohes Dateiobjekt mit kleinen PDF; Base64 des ersten PDF des ersten Stands ersetzt. */
function rohMitBase64(text: string): {
  readonly roh: Record<string, unknown>;
  readonly key: string;
} {
  const roh = rohDatei(planDatei(planA(), { stands: [dateiStand(planA(), 's')] }));
  const stands = roh.stands as { pdfs: { key: string; base64: string }[] }[];
  const erstes = vorhanden(stands[0]?.pdfs[0], 'erstes PDF im rohen Objekt');
  erstes.base64 = text;
  return { roh, key: erstes.key };
}

describe('E1-04b Base64 der Plan-Datei (R2-1)', () => {
  it(
    '[R-L-12][R-5.6-17] serializePlanFile → parsePlanFile mit Gesamt-PDF von 4 MiB bytegleich',
    () => {
      const plan = planA();
      const stand = grosserStand();
      const uhr = new TestUhr(zeitpunkt('2026-10-07'));
      const gesichert = erfasse(() =>
        serializePlanFile({ plan, revision: 3, modifiedAt: MODIFIZIERT, stands: [stand] }, uhr),
      );
      expect(gesichert.fehler, 'kein Fehler beim Sichern').toBeNull();
      const gelesen = erfasse(() => parsePlanFile(vorhanden(gesichert.wert)));
      expect(gelesen.fehler, 'kein Fehler beim Lesen').toBeNull();
      const datei = vorhanden(gelesen.wert);
      expect(datei.stands).toHaveLength(1);
      const s0 = vorhanden(datei.stands[0]);
      expect([...s0.pdfs.keys()].sort(), 'Schlüssel der PDF').toEqual(
        [...stand.pdfs.keys()].sort(),
      );
      gesamtGleich(s0.pdfs.get('plan'));
      for (const w of plan.weeks) gleicheBytes(s0.pdfs.get(w.id), stand.pdfs.get(w.id));
    },
    LANG,
  );

  it(
    '[R-L-12][R-5.6-17] parsePlanFile liest eine ohne serializePlanFile gebaute Datei mit 4-MiB-PDF',
    () => {
      const stand = grosserStand();
      const bytes = jsonBytes(rohDatei(planDatei(planA(), { stands: [stand] })));
      const gelesen = erfasse(() => parsePlanFile(bytes));
      expect(gelesen.fehler, 'kein Fehler beim Lesen').toBeNull();
      const s0 = vorhanden(vorhanden(gelesen.wert).stands[0], 'Stand gelesen');
      gesamtGleich(s0.pdfs.get('plan'));
      for (const w of planA().weeks) gleicheBytes(s0.pdfs.get(w.id), stand.pdfs.get(w.id));
    },
    LANG,
  );

  it(
    '[R-L-12][R-5.6-17] exportPlanFile → parsePlanFile → openFromFile (neue Fabrik) → standPdf: 4-MiB-Gesamt-PDF bytegleich',
    async () => {
      const uhr = new TestUhr(zeitpunkt('2026-10-07'));
      const s1 = await oeffnen(neueFabrik());
      const geladen = await s1.create(planA(), uhr);
      const { result, standRecord } = standAuftrag(geladen.plan, { standId: 'stand-gross' });
      const pdfs = new Map(standRecord.pdfs);
      pdfs.set('plan', PDF_GROSS);
      await s1.commitAtomic(
        A,
        {
          expectedRevision: geladen.revision,
          result,
          restorePoint: 'stand',
          standRecord: { ...standRecord, pdfs },
        },
        uhr,
      );
      const exportiert = await erfasseAsync<PlanFileExport>(s1.exportPlanFile(A, uhr));
      s1.close();
      expect(exportiert.fehler, 'kein Fehler bei exportPlanFile').toBeNull();

      const gelesen = erfasse<PlanFile>(() => parsePlanFile(vorhanden(exportiert.wert).bytes));
      expect(gelesen.fehler, 'kein Fehler bei parsePlanFile').toBeNull();
      const s2 = await oeffnen(neueFabrik());
      const geoeffnet = await erfasseAsync(s2.openFromFile(vorhanden(gelesen.wert), uhr));
      expect(geoeffnet.fehler, 'kein Fehler bei openFromFile').toBeNull();

      gesamtGleich((await standPdf(s2, A, 'stand-gross', { kind: 'plan' })).bytes);
      for (const w of result.plan.weeks) {
        const woche = await standPdf(s2, A, 'stand-gross', { kind: 'week', weekId: w.id });
        gleicheBytes(woche.bytes, standRecord.pdfs.get(w.id));
      }
      s2.close();
    },
    LANG,
  );

  /** Gegenfall N1-d: ungültige Base64-Formen (Bezeichnung im Namen ohne Steuerzeichen). */
  const UNGUELTIG: readonly (readonly [string, string])[] = [
    ['leer', ''],
    ['A (Länge 1)', 'A'],
    ['AAA (Länge 3)', 'AAA'],
    ['AAAAA (Länge 5)', 'AAAAA'],
    ['AA=A (Auffüllung in der Mitte)', 'AA=A'],
    ['=AAA (Auffüllung am Anfang)', '=AAA'],
    ['A=== (drei Auffüllzeichen)', 'A==='],
    ['==== (nur Auffüllung)', '===='],
    ['AAAA==== (vier Auffüllzeichen am Ende)', 'AAAA===='],
    ['AA==AA== (Auffüllung vor weiteren Zeichen)', 'AA==AA=='],
    ['AAA mit Zeilenumbruch am Ende', 'AAA\n'],
    ['AAAA mit vier Leerzeichen am Ende', 'AAAA    '],
    ['AA-_ (URL-Alphabet)', 'AA-_'],
    ['AAA mit é am Ende', 'AAAé'],
  ];

  it.each(UNGUELTIG)('[R-5.6-17] ungültiges Base64 bleibt corrupt: «%s»', (_bezeichnung, text) => {
    const { roh } = rohMitBase64(text);
    const gelesen = erfasse(() => parsePlanFile(jsonBytes(roh)));
    expect(gelesen.fehler).toBeInstanceOf(PlanFileError);
    const e = gelesen.fehler as PlanFileError;
    expect(e.code).toBe('corrupt');
    expect(e.path).toBe(PFAD);
  });

  it('[R-5.6-17] serializePlanFile: PDF mit 0 Byte ist notSerializable', () => {
    const plan = planA();
    const basis = dateiStand(plan, 's');
    const ersteWoche = vorhanden(plan.weeks[0], 'erste Woche').id;
    const pdfs = new Map(basis.pdfs);
    pdfs.set(ersteWoche, new Uint8Array(0));
    expect([...pdfs.keys()][0], 'erste Woche ist das erste PDF').toBe(ersteWoche);
    const uhr = new TestUhr(zeitpunkt('2026-10-07'));
    const gesichert = erfasse(() =>
      serializePlanFile(
        { plan, revision: 3, modifiedAt: MODIFIZIERT, stands: [{ ...basis, pdfs }] },
        uhr,
      ),
    );
    expect(gesichert.fehler).toBeInstanceOf(PlanFileError);
    const e = gesichert.fehler as PlanFileError;
    expect(e.code).toBe('notSerializable');
    expect(e.path).toBe(PFAD);
  });

  /** Gegenfall N1-f: gültige Formen mit und ohne Auffüllung und erwartete Bytes. */
  const GUELTIG: readonly (readonly [string, readonly number[]])[] = [
    ['AA==', [0]],
    ['AAA=', [0, 0]],
    ['AAAA', [0, 0, 0]],
    ['+/+/', [251, 255, 191]],
  ];

  it.each(GUELTIG)(
    '[R-5.6-17] gültiges Base64 mit und ohne Auffüllung wird gelesen: «%s»',
    (text, bytes) => {
      const { roh, key } = rohMitBase64(text);
      const gelesen = erfasse(() => parsePlanFile(jsonBytes(roh)));
      expect(gelesen.fehler, 'kein Fehler beim Lesen').toBeNull();
      const s0 = vorhanden(vorhanden(gelesen.wert).stands[0], 'Stand gelesen');
      expect(Array.from(vorhanden(s0.pdfs.get(key), 'erstes PDF'))).toEqual(bytes);
    },
  );
});
