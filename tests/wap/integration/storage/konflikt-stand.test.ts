// @vitest-environment jsdom
// Paket E1-04: «Neuen Stand setzen» gegen den echten Speicher mit einer Zwischenänderung (Vertrag
// docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Neu zugewiesene ID R-L-08» und «Ausarbeitung Schritt 2» Abschnitte
// G1, I2 commitAtomic, L R-L-08, P; Leitplanke 5; ADR-006 Punkt 2a; AR0-25, AR0-40; Vertrag E1-05 Abschnitt C1).
// setNewStand (E1-05, eingefroren) mit dem Prüf-Renderer von E1-05, der hinter einem Tor wartet. Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { setNewStand } from '../../../../src/io/wap-plan/standStore';
import { StorageError } from '../../../../src/io/wap-plan/store';
import { beobachte, Tor } from '../../support/stand/hilfen';
import { PruefRenderer } from '../../support/stand/renderer';
import { anzahlen, neueFabrik, oeffnen } from '../../support/storage/datenbank';
import { KONFLIKT } from '../../support/storage/meldungen';
import { A, ctx, DATUM, planA, speichern, titel } from '../../support/storage/plaene';
import { gleich, vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

describe('Konflikt beim Stand-Setzen (R-L-08)', () => {
  it('[R-L-08] Zwischenänderung während des Renderns: StorageError conflict mit Stand-Meldung; Zahl der Datensätze wie nach der Zwischenänderung; Dokument mit der Zwischenänderung', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await speichern(store, A, titel('e101', 'Vorher (fiktiv)'), uhr);
    const r0 = vorhanden(await store.load(A)).revision;

    const tor = new Tor();
    const renderer = new PruefRenderer().bei(1, { tor });
    const ablauf = beobachte(setNewStand(store, A, { date: DATUM }, renderer, uhr, { ctx }));
    await Promise.race([tor.erreicht, ablauf.erledigt]);
    if (ablauf.status() === 'abgelehnt') {
      const r = await ablauf.erledigt;
      // Fehler vor dem Rendern (z.B. beim Lesen) unverändert weitergeben.
      if (!r.ok) throw r.fehler;
    }
    expect(tor.istErreicht, 'Rendern hat begonnen (Schritt 0 gelesen)').toBe(true);

    const zwischen = await speichern(store, A, titel('e101', 'Zwischenänderung (fiktiv)'), uhr);
    expect(zwischen.revision).toBe(r0 + 1);
    const zahlenNachZwischen = await anzahlen(f);

    tor.oeffnen();
    const ergebnis = await ablauf.erledigt;
    expect(ergebnis.ok, 'setNewStand lehnt ab').toBe(false);
    const fehler = ergebnis.ok ? undefined : ergebnis.fehler;
    expect(fehler).toBeInstanceOf(StorageError);
    const e = fehler as StorageError;
    expect(e.code).toBe('conflict');
    expect(e.userMessage).toEqual(KONFLIKT.stand);

    const zahlen = await anzahlen(f);
    expect(zahlen.plans).toBe(zahlenNachZwischen.plans);
    expect(zahlen.history, 'kein Historienschritt').toBe(zahlenNachZwischen.history);
    expect(zahlen.restorePoints).toBe(zahlenNachZwischen.restorePoints);
    expect(zahlen.stands, 'kein Stand').toBe(zahlenNachZwischen.stands);
    expect(zahlen.importReports).toBe(zahlenNachZwischen.importReports);
    expect(zahlen).toEqual(zahlenNachZwischen);

    const geladen = vorhanden(await store.load(A));
    gleich(geladen.plan, zwischen.result.plan, 'Dokument mit der Zwischenänderung');
    expect(geladen.revision).toBe(r0 + 1);
    expect(geladen.plan.stand).toBeNull();
    expect(await store.standRecords(A)).toEqual([]);
  });
});
