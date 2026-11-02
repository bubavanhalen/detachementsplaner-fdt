// @vitest-environment node
// I3 C4: Personenliste aus Datei (Beschrieb 4.1; Prompt §8; Gate-0-Entscheid 8, Vertrag E1-09 §1). Nur Grad, Name,
// Vorname, Funktion werden übernommen; Werte anderer Spalten entstehen nie im Ergebnis. Fiktive Dateien.
import { strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PersonFileError, readPersonFile } from '../../../../src/io/wap-persons/index';
import {
  addPersons,
  personFields,
  replacePersons,
} from '../../../../src/model/wap/commands/persons';
import { csvMitZusatz, PERSONEN, VERWORFEN, xlsxMitZusatz } from '../../support/i3/personen';
import { CTX, kpPlan, undo } from '../../support/i3/plan';

async function fehler(f: () => Promise<unknown>): Promise<PersonFileError> {
  try {
    await f();
  } catch (e) {
    if (e instanceof PersonFileError) return e;
    throw e;
  }
  throw new Error('kein Fehler');
}

describe('I3 C4 Personenliste aus Datei', () => {
  it('[R-4.1-09] CSV (;): Kopfzeile in beliebiger Reihenfolge, nur die vier Felder, Zusatzspalten nur gezählt', async () => {
    const r = await readPersonFile(csvMitZusatz(), 'liste.csv');
    expect(r.persons).toEqual(PERSONEN);
    expect(r.droppedColumnCount).toBe(3);
    expect(r.skippedRows).toEqual([]);
    const json = JSON.stringify(r);
    for (const v of VERWORFEN) expect(json.includes(v), 'verworfener Wert im Ergebnis').toBe(false);
  });

  it('[R-4.1-09] CSV (,) mit Anführungszeichen, Zeilenumbruch im Feld, Leer- und Namenlos-Zeilen', async () => {
    const text = [
      'grad , NAME,Vorname,Funktion,Notiz',
      '"Lt","Muster, Beispiel","Anna","Zfhr","PRUEFWERT-NOTIZ ""zitiert"""',
      ',,,,',
      'Wm,,Ohne,Four,PRUEFWERT-NOTIZ',
      '"Oblt","Probe","Zeile',
      'zwei","Kdt Stv",x',
    ].join('\n');
    const r = await readPersonFile(strToU8(text), 'liste.csv');
    expect(r.persons).toEqual([
      { grad: 'Lt', name: 'Muster, Beispiel', vorname: 'Anna', funktion: 'Zfhr' },
      { grad: 'Oblt', name: 'Probe', vorname: 'Zeile\nzwei', funktion: 'Kdt Stv' },
    ]);
    expect(r.skippedRows.map((s) => s.reason)).toEqual(['empty', 'missingName']);
    expect(JSON.stringify(r).includes('PRUEFWERT')).toBe(false);
  });

  it('[R-4.1-09] XLSX: erstes Blatt, gemeinsame und eingebettete Zeichenketten; Zusatzspalten und zweites Blatt nie gelesen', async () => {
    const r = await readPersonFile(xlsxMitZusatz(), 'liste.xlsx');
    expect(r.persons).toEqual(PERSONEN);
    expect(r.droppedColumnCount).toBe(3);
    const json = JSON.stringify(r);
    for (const v of VERWORFEN) expect(json.includes(v)).toBe(false);
    expect(json.includes('Zweitblatt')).toBe(false);
  });

  it('[R-4.1-09] fehlende Pflichtspalten, falsches Format und leere Datei: Meldung mit Ursache und nächstem Schritt', async () => {
    const fehlt = await fehler(() =>
      readPersonFile(strToU8('Grad;Name;Telefon\nLt;Muster;x\n'), 'a.csv'),
    );
    expect(fehlt.code).toBe('missingColumns');
    expect(fehlt.userMessage.cause).toContain('«Vorname», «Funktion»');
    expect(fehlt.userMessage.cause).not.toContain('Telefon');
    expect(fehlt.userMessage.nextStep).toMatch(/Kopfzeile/);
    const alt = await fehler(() => readPersonFile(new Uint8Array([1, 2]), 'alt.xls'));
    expect(alt.code).toBe('unsupportedFormat');
    const bild = await fehler(() => readPersonFile(new Uint8Array([1, 2]), 'bild.png'));
    expect(bild.code).toBe('unsupportedFormat');
    const leer = await fehler(() => readPersonFile(strToU8(''), 'leer.csv'));
    expect(leer.code).toBe('empty');
    const kaputt = await fehler(() => readPersonFile(new Uint8Array([1, 2, 3]), 'kaputt.xlsx'));
    expect(kaputt.code).toBe('invalidFile');
  });

  it('[R-4.1-09] Befehle: ersetzen behält IDs bekannter Personen, ergänzen legt Doppelte nicht erneut an, andere Felder fallen weg; je ein Undo-Schritt', () => {
    const p = kpPlan(1);
    const first = replacePersons(p, PERSONEN, CTX);
    expect(first.plan.persons.map((x) => x.name)).toEqual(['Muster', 'Probe']);
    const ids = first.plan.persons.map((x) => x.id);
    const again = replacePersons(first.plan, [PERSONEN[1], PERSONEN[0]], CTX);
    expect(again.plan.persons.map((x) => x.id)).toEqual([ids[1], ids[0]]);
    const extra = { ...PERSONEN[0], vorname: 'Neu', ahv: 'PRUEFWERT-AHV-EINS' } as never;
    const add = addPersons(again.plan, [PERSONEN[0], extra], CTX);
    expect(add.added).toBe(1);
    expect(add.plan.persons).toHaveLength(3);
    expect(JSON.stringify(add.plan.persons).includes('PRUEFWERT')).toBe(false);
    expect(Object.keys(personFields(extra)).sort()).toEqual([
      'funktion',
      'grad',
      'name',
      'vorname',
    ]);
    expect(undo(add).persons).toHaveLength(2);
    expect(() =>
      addPersons(p, [{ grad: 'Lt', name: ' ', vorname: '', funktion: '' }], CTX),
    ).toThrow(/keinen Namen/);
  });
});
