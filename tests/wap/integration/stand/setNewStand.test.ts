// @vitest-environment jsdom
// Paket E1-05: Ablauf «Neuen Stand setzen» atomar über den Port StandStore (Vertrag
// docs/wap-planer/plan/vertraege/E1-05.md, Notiz «Ausarbeitung Schritt 2» Abschnitte C1, E, F, G; ADR-002 Punkt 6,
// ADR-006 Punkt 2a; AR0-25, AR0-31, AR0-40, AR0-49). R-5.5-03 (8) (zwei Stände nach Wiederherstellen),
// R-5.5-04 (3)–(11) (Abbruch, Konflikt, Fehler, Undo während des Renderns), R-5.5-06 (früherer Stand bytegleich,
// nie neu gerendert). In-Memory-Double (H1) mit Revisionsregel und Prüf-Renderer (H2, echtes writePdf).
// Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { StandError, standPdf } from '../../../../src/io/wap-plan/standStore';
import { CommandError } from '../../../../src/model/wap/commands/command';
import { WapError } from '../../../../src/model/wap/errors';
import type { PdfTarget } from '../../../../src/model/wap/stand/fileName';
import {
  bemerkungAendern,
  kuerzelAendern,
  mitZeitlimit,
  neuerStore,
  planMitInhalt,
  setzen,
  titelAendern,
} from '../../support/stand/ablauf';
import { KONFLIKT_MELDUNG, StandStoreDouble } from '../../support/stand/double';
import {
  ablehnungVon,
  beobachte,
  kopie,
  runden,
  sha256,
  Tor,
  UUID_V4,
} from '../../support/stand/hilfen';
import { MELDUNG } from '../../support/stand/meldungen';
import { DATUM, PLAN_ID, wocheId } from '../../support/stand/plan';
import { PruefRenderer, pruefPdf } from '../../support/stand/renderer';

const P = planMitInhalt();
const KVK_ID = wocheId(P, 'KVK');
const WO1_ID = wocheId(P, 'Wo1');
const WO2_ID = wocheId(P, 'Wo2');
const WO3_ID = wocheId(P, 'Wo3');
const ZIELE: PdfTarget[] = [
  ...[KVK_ID, WO1_ID, WO2_ID, WO3_ID].map((weekId) => ({ kind: 'week' as const, weekId })),
  { kind: 'plan' },
];

function erwarteStandError(
  e: unknown,
  code: StandError['code'],
  variant: string | null = null,
): StandError {
  expect(e).toBeInstanceOf(StandError);
  expect(e).toBeInstanceOf(WapError);
  const f = e as StandError;
  expect(f.code).toBe(code);
  expect(f.variant).toBe(variant);
  expect(f.userMessage).toEqual(MELDUNG[code]);
  return f;
}

/** Zustand des Doubles für «nichts geschrieben»-Vergleiche. */
function zustand(store: StandStoreDouble): unknown {
  return {
    revision: store.revision(PLAN_ID),
    zaehler: store.zaehler(PLAN_ID),
    dokument: kopie(store.dokument(PLAN_ID)),
    aufzeichnungen: store.aufzeichnungen(PLAN_ID).map((a) => a.recordId),
  };
}

/** Wartet, bis das Tor erreicht ist; scheitert mit Assertion, wenn setNewStand vorher endet. */
async function erwarteTorErreicht(tor: Tor, b: ReturnType<typeof beobachte>): Promise<void> {
  const r = await mitZeitlimit(
    Promise.race([tor.erreicht.then(() => 'erreicht' as const), b.erledigt]),
  );
  expect(r, 'Ablauf erreicht das Tor').toBe('erreicht');
}

describe('Abbruch (C1 Punkte 1, 6, 7; AR0-40, AR0-49)', () => {
  it('[R-5.5-04] signal schon abgebrochen → aborted; weder load noch Renderer aufgerufen, nichts geschrieben', async () => {
    const store = neuerStore();
    const render = new PruefRenderer();
    const vorher = zustand(store);
    const ac = new AbortController();
    ac.abort();
    const onWriting: string[] = [];
    const e = await ablehnungVon(
      setzen(
        store,
        render,
        { date: DATUM },
        { signal: ac.signal, onWriting: () => onWriting.push('x') },
      ),
    );
    erwarteStandError(e, 'aborted');
    expect(store.aufrufe).toHaveLength(0);
    expect(render.aufrufe).toHaveLength(0);
    expect(onWriting).toHaveLength(0);
    expect(zustand(store)).toEqual(vorher);
  });

  it('[R-5.5-04] Abbruch, während der zweite Wochen-Renderer aussteht (Tor) → aborted; danach kein Renderer-Aufruf, commitAtomic nie; Tor später geöffnet → im Double unverändert', async () => {
    const store = neuerStore();
    const tor = new Tor();
    const render = new PruefRenderer().bei(2, { tor });
    const ac = new AbortController();
    const onWriting: string[] = [];
    const vorher = zustand(store);
    const b = beobachte(
      setzen(
        store,
        render,
        { date: DATUM },
        { signal: ac.signal, onWriting: () => onWriting.push('x') },
      ),
    );
    await erwarteTorErreicht(tor, b);
    ac.abort();
    const r = await mitZeitlimit(b.erledigt);
    expect(r).not.toBe('zeitlimit');
    expect(r !== 'zeitlimit' && r.ok).toBe(false);
    erwarteStandError(r !== 'zeitlimit' && !r.ok ? r.fehler : undefined, 'aborted');
    tor.oeffnen();
    await runden(10);
    expect(render.aufrufe).toHaveLength(2);
    expect(store.commits()).toHaveLength(0);
    expect(onWriting).toHaveLength(0);
    expect(zustand(store)).toEqual(vorher);
  });

  it('[R-5.5-04] Renderer, der nie erfüllt: Abbruch → Ablehnung aborted ohne Zeitüberschreitung, nichts geschrieben', async () => {
    const store = neuerStore();
    const nie = new Tor();
    const render = new PruefRenderer().bei(1, { tor: nie });
    const ac = new AbortController();
    const vorher = zustand(store);
    const b = beobachte(setzen(store, render, { date: DATUM }, { signal: ac.signal }));
    await erwarteTorErreicht(nie, b);
    ac.abort();
    const r = await mitZeitlimit(b.erledigt, 1000);
    expect(r, 'Ablehnung ohne Warten auf den Renderer').not.toBe('zeitlimit');
    erwarteStandError(r !== 'zeitlimit' && !r.ok ? r.fehler : undefined, 'aborted');
    await runden(5);
    expect(render.aufrufe).toHaveLength(1);
    expect(store.commits()).toHaveLength(0);
    expect(zustand(store)).toEqual(vorher);
  });

  it('[R-5.5-04] Abbruch, während load aussteht → aborted ohne Warten; danach kein Aufruf an Speicher oder Renderer', async () => {
    const store = neuerStore();
    const tor = new Tor();
    store.tore.load = tor;
    const render = new PruefRenderer();
    const ac = new AbortController();
    const b = beobachte(setzen(store, render, { date: DATUM }, { signal: ac.signal }));
    await erwarteTorErreicht(tor, b);
    ac.abort();
    const r = await mitZeitlimit(b.erledigt, 1000);
    erwarteStandError(r !== 'zeitlimit' && !r.ok ? r.fehler : undefined, 'aborted');
    tor.oeffnen();
    await runden(10);
    expect(store.methoden()).toEqual(['load']);
    expect(render.aufrufe).toHaveLength(0);
  });

  it('[R-5.5-04] Abbruch, während standRecords (Zählung standsSameDay) aussteht → aborted; danach kein Renderer, kein commitAtomic', async () => {
    const store = neuerStore();
    const tor = new Tor();
    store.tore.standRecords = tor;
    const render = new PruefRenderer();
    const ac = new AbortController();
    const vorher = zustand(store);
    const b = beobachte(setzen(store, render, { date: DATUM }, { signal: ac.signal }));
    await erwarteTorErreicht(tor, b);
    ac.abort();
    const r = await mitZeitlimit(b.erledigt, 1000);
    erwarteStandError(r !== 'zeitlimit' && !r.ok ? r.fehler : undefined, 'aborted');
    tor.oeffnen();
    await runden(10);
    expect(store.methoden()).toEqual(['load', 'standRecords']);
    expect(render.aufrufe).toHaveLength(0);
    expect(zustand(store)).toEqual(vorher);
  });

  it('[R-5.5-04] Abbruch in onWriting → wirkungslos: Erfolg, Stand geschrieben; onWriting genau einmal, vor commitAtomic', async () => {
    const store = neuerStore();
    const ac = new AbortController();
    const commitsBeiOnWriting: number[] = [];
    const rec = await setzen(
      store,
      new PruefRenderer(),
      { date: DATUM },
      {
        signal: ac.signal,
        onWriting: () => {
          commitsBeiOnWriting.push(store.commits().length);
          ac.abort();
        },
      },
    );
    expect(commitsBeiOnWriting).toEqual([0]);
    expect(store.commits()).toHaveLength(1);
    expect(rec.plan.stand).toEqual({ date: DATUM, version: 1 });
    expect(store.aufzeichnungen(PLAN_ID).map((a) => [a.recordId, a.visible])).toEqual([
      [rec.recordId, true],
    ]);
    expect(store.dokument(PLAN_ID)).toEqual(rec.plan);
  });

  it('[R-5.5-04] Abbruch, während commitAtomic aussteht (Tor im Double) → wirkungslos: Erfolg, Stand geschrieben', async () => {
    const store = neuerStore();
    const tor = new Tor();
    store.tore.commitAtomic = tor;
    const ac = new AbortController();
    const b = beobachte(setzen(store, new PruefRenderer(), { date: DATUM }, { signal: ac.signal }));
    await erwarteTorErreicht(tor, b);
    ac.abort();
    await runden(5);
    expect(b.status()).toBe('offen');
    tor.oeffnen();
    const r = await mitZeitlimit(b.erledigt);
    expect(r !== 'zeitlimit' && r.ok).toBe(true);
    expect(store.zaehler(PLAN_ID).aufzeichnungen).toBe(1);
    expect(store.aufzeichnungen(PLAN_ID)[0]?.visible).toBe(true);
  });

  it('[R-5.5-04] onWriting wirft → Ablehnung mit genau diesem Fehler, nichts geschrieben', async () => {
    const store = neuerStore();
    const e = new Error('onWriting fehlgeschlagen (fiktiv)');
    const vorher = zustand(store);
    const f = await ablehnungVon(
      setzen(
        store,
        new PruefRenderer(),
        { date: DATUM },
        {
          onWriting: () => {
            throw e;
          },
        },
      ),
    );
    expect(f).toBe(e);
    expect(store.commits()).toHaveLength(0);
    expect(zustand(store)).toEqual(vorher);
  });
});

describe('Revisionsprüfung (C1 Punkte 2, 7, 8; Abschnitt E; AR0-25)', () => {
  it('[R-5.5-04] Änderung während des Renderns geht nicht verloren: Ablehnung mit demselben Konfliktobjekt des Doubles (conflict); Dokument mit der Zwischenänderung, Zähler wie nach ihr', async () => {
    const store = neuerStore();
    const r0 = store.revision(PLAN_ID);
    const tor = new Tor();
    const render = new PruefRenderer().bei(1, { tor });
    const b = beobachte(setzen(store, render));
    await erwarteTorErreicht(tor, b);
    store.aendern(PLAN_ID, titelAendern('e101', 'Zwischenänderung (fiktiv)'));
    expect(store.revision(PLAN_ID)).toBe(r0 + 1);
    const nachAenderung = zustand(store);
    tor.oeffnen();
    const r = await mitZeitlimit(b.erledigt);
    expect(r !== 'zeitlimit' && r.ok).toBe(false);
    const fehler = r !== 'zeitlimit' && !r.ok ? r.fehler : undefined;
    expect(store.letzterKonflikt).not.toBeNull();
    expect(fehler).toBe(store.letzterKonflikt);
    expect((fehler as WapError).code).toBe('conflict');
    expect((fehler as WapError).userMessage).toEqual(KONFLIKT_MELDUNG);
    expect(store.commits()).toHaveLength(1);
    expect(store.commits()[0]?.write?.expectedRevision).toBe(r0);
    expect(zustand(store)).toEqual(nachAenderung);
    const block = store.dokument(PLAN_ID).entries.e101;
    expect(block?.type === 'block' ? block.title[0]?.text : null).toBe('Zwischenänderung (fiktiv)');
    expect(store.methoden()).toEqual(['load', 'standRecords', 'commitAtomic']);
  });

  it('[R-5.5-04] Undo während des Renderns: Ablehnung mit demselben Konfliktobjekt (conflict); Dokument = Stand nach dem Undo, keine neue Aufzeichnung, kein neuer Schritt, kein neuer Wiederherstellungspunkt', async () => {
    const store = neuerStore();
    store.aendern(PLAN_ID, titelAendern('e101', 'Änderung s (fiktiv)'));
    const tor = new Tor();
    const render = new PruefRenderer().bei(1, { tor });
    const b = beobachte(setzen(store, render));
    await erwarteTorErreicht(tor, b);
    store.undo(PLAN_ID);
    expect(store.dokument(PLAN_ID)).toEqual(P);
    const nachUndo = zustand(store);
    tor.oeffnen();
    const r = await mitZeitlimit(b.erledigt);
    const fehler = r !== 'zeitlimit' && !r.ok ? r.fehler : undefined;
    expect(store.letzterKonflikt).not.toBeNull();
    expect(fehler).toBe(store.letzterKonflikt);
    expect((fehler as WapError).code).toBe('conflict');
    expect(zustand(store)).toEqual(nachUndo);
    expect(store.dokument(PLAN_ID)).toEqual(P);
  });

  it('[R-5.5-04] Fehler aus commitAtomic (kein Konflikt) wird als dasselbe Objekt abgelehnt; kein zweiter Versuch', async () => {
    const store = neuerStore();
    const e = new WapError('quotaExceeded', {
      cause: 'Speicher voll (fiktiv).',
      nextStep: 'Platz schaffen.',
    });
    store.fehler.commitAtomic = e;
    const f = await ablehnungVon(setzen(store, new PruefRenderer()));
    expect(f).toBe(e);
    expect(store.methoden()).toEqual(['load', 'standRecords', 'commitAtomic']);
    expect(store.zaehler(PLAN_ID).aufzeichnungen).toBe(0);
  });
});

describe('Fehler vor dem Schreiben (C1 Punkte 2, 3, 5)', () => {
  it('[R-5.5-04] zweiter Wochen-Renderer lehnt mit E ab → renderFailed, variant = weekId von «Wo1», cause E; kein Gesamt-PDF-Renderer, kein commitAtomic', async () => {
    const store = neuerStore();
    const e = new Error('Renderer-Fehler (fiktiv)');
    const render = new PruefRenderer().bei(2, { ablehnen: e });
    const vorher = zustand(store);
    const f = erwarteStandError(await ablehnungVon(setzen(store, render)), 'renderFailed', WO1_ID);
    expect(f.cause).toBe(e);
    expect(render.aufrufe.map((a) => a.art)).toEqual(['week', 'week']);
    expect(store.commits()).toHaveLength(0);
    expect(zustand(store)).toEqual(vorher);
  });

  it('[R-5.5-04] Renderer wirft synchron (dritter Aufruf, «Wo2») → renderFailed mit variant und cause; kein weiterer Renderer', async () => {
    const store = neuerStore();
    const e = new Error('synchroner Renderer-Fehler (fiktiv)');
    const render = new PruefRenderer().bei(3, { werfen: e });
    const f = erwarteStandError(await ablehnungVon(setzen(store, render)), 'renderFailed', WO2_ID);
    expect(f.cause).toBe(e);
    expect(render.aufrufe).toHaveLength(3);
    expect(store.commits()).toHaveLength(0);
  });

  it('[R-5.5-04] Gesamt-PDF-Renderer liefert etwas anderes als Uint8Array → renderFailed, variant «plan», ohne cause', async () => {
    for (const falsch of [
      'kein PDF',
      new ArrayBuffer(8),
      null,
      [1, 2, 3],
      new Uint16Array(2),
      new DataView(new ArrayBuffer(4)),
    ]) {
      const store = neuerStore();
      const render = new PruefRenderer().bei(5, { liefern: falsch });
      const f = erwarteStandError(
        await ablehnungVon(setzen(store, render)),
        'renderFailed',
        'plan',
      );
      expect(f.cause).toBeUndefined();
      expect(store.commits()).toHaveLength(0);
    }
  });

  it('[R-5.5-04] load liefert null → planNotFound; kein Renderer, kein weiterer Port-Aufruf', async () => {
    const store = new StandStoreDouble();
    const render = new PruefRenderer();
    erwarteStandError(await ablehnungVon(setzen(store, render)), 'planNotFound');
    expect(store.methoden()).toEqual(['load']);
    expect(render.aufrufe).toHaveLength(0);
  });

  it('[R-5.5-04] Version nicht steigend → Ablehnung mit CommandError versionNotIncreasing; kein Renderer, kein weiterer Port-Aufruf', async () => {
    const store = neuerStore({ ...P, stand: { date: '2026-09-10', version: 3 } });
    const render = new PruefRenderer();
    const e = await ablehnungVon(setzen(store, render, { date: DATUM, version: 2 }));
    expect(e).toBeInstanceOf(CommandError);
    const f = e as CommandError<string>;
    expect(f.code).toBe('versionNotIncreasing');
    expect(f.field).toBe('version');
    expect(f.entryId).toBeNull();
    expect(f.userMessage).toEqual({
      cause: 'Die Version muss höher sein als die des letzten Stands (V3).',
      nextStep: 'Version 4 oder höher eingeben.',
    });
    expect(store.methoden()).toEqual(['load']);
    expect(render.aufrufe).toHaveLength(0);
  });

  it('[R-5.5-04] Fehler des Ports in load wird als dasselbe Objekt abgelehnt', async () => {
    const store = neuerStore();
    const e = new Error('Speicher nicht lesbar (fiktiv)');
    store.fehler.load = e;
    expect(await ablehnungVon(setzen(store, new PruefRenderer()))).toBe(e);
  });
});

describe('Zwei Stände nach Wiederherstellen (AR0-31)', () => {
  it('[R-5.5-03] Stand S1, Dokument vor S1 als neuen Schritt wiederhergestellt, Stand S2 am selben Tag → standId und recordId verschieden, je UUID v4, recordId ≠ standId, beide Aufzeichnungen vorhanden, Bytes von S1 unverändert', async () => {
    const store = neuerStore();
    const vorS1 = kopie(store.dokument(PLAN_ID));
    const s1 = await setzen(store, new PruefRenderer());
    const shaS1 = [...s1.pdfs.entries()].map(([k, v]) => [k, sha256(v)]);
    store.wiederherstellen(PLAN_ID, vorS1);
    expect(store.dokument(PLAN_ID).stand).toBeNull();
    const s2 = await setzen(store, new PruefRenderer());
    expect(s2.version).toBe(2);
    for (const id of [s1.standId, s1.recordId, s2.standId, s2.recordId])
      expect(id).toMatch(UUID_V4);
    expect(new Set([s1.standId, s1.recordId, s2.standId, s2.recordId]).size).toBe(4);
    const gespeichert = store.aufzeichnungen(PLAN_ID);
    expect(gespeichert.map((a) => a.recordId).sort()).toEqual([s1.recordId, s2.recordId].sort());
    const a1 = gespeichert.find((a) => a.recordId === s1.recordId);
    expect([...(a1?.pdfs ?? new Map()).entries()].map(([k, v]) => [k, sha256(v)])).toEqual(shaS1);
    for (const ziel of ZIELE) {
      const k = ziel.kind === 'plan' ? 'plan' : ziel.weekId;
      const bytes = (await standPdf(store, PLAN_ID, s1.standId, ziel)).bytes;
      expect(sha256(bytes)).toBe(shaS1.find(([x]) => x === k)?.[1]);
    }
  });
});

describe('Früherer Stand jederzeit identisch (R-5.5-06, AR0-26, G-12 a)', () => {
  it('[R-5.5-06] Stand S1, Änderungen, S2, Undo, Redo, S3 → standPdf(S1) liefert für jede Woche und das Gesamt-PDF dieselben SHA-256; nie neu gerendert; Prüf-Renderer auf das aktuelle Dokument ergibt andere Bytes', async () => {
    const store = neuerStore();
    const render = new PruefRenderer();
    const s1 = await setzen(store, render);
    const sha1 = new Map([...s1.pdfs.entries()].map(([k, v]) => [k, sha256(v)]));
    const titel1 = new Map(render.aufrufe.map((a) => [a.weekId ?? 'plan', a.title]));
    expect([...sha1.keys()]).toEqual([KVK_ID, WO1_ID, WO2_ID, WO3_ID, 'plan']);

    store.aendern(PLAN_ID, titelAendern('e101', 'KVK geändert (fiktiv)'));
    store.aendern(PLAN_ID, titelAendern('e111', 'Wo1 geändert (fiktiv)'));
    store.aendern(PLAN_ID, kuerzelAendern('e121', 'DR'));
    store.aendern(PLAN_ID, bemerkungAendern('e131', 'Wo3 geändert (fiktiv)'));
    await setzen(store, render, { date: '2026-09-18' });
    store.undo(PLAN_ID);
    store.redo(PLAN_ID);
    await setzen(store, render, { date: '2026-09-19' });
    const renderAufrufe = render.aufrufe.length;
    expect(renderAufrufe).toBe(15);

    for (const ziel of ZIELE) {
      const k = ziel.kind === 'plan' ? 'plan' : ziel.weekId;
      const r = await standPdf(store, PLAN_ID, s1.standId, ziel);
      expect(sha256(r.bytes), `Variante ${k}`).toBe(sha1.get(k));
      const aktuell = await pruefPdf(store.dokument(PLAN_ID), ziel, titel1.get(k) ?? '');
      expect(sha256(aktuell), `Empfindlichkeit ${k}`).not.toBe(sha1.get(k));
    }
    expect(render.aufrufe).toHaveLength(renderAufrufe);
    const plan = sha1.get('plan');
    for (const w of [KVK_ID, WO1_ID, WO2_ID, WO3_ID]) expect(sha1.get(w)).not.toBe(plan);
  });

  it('[R-5.5-06] der Dateiname des früheren Stands bleibt nach weiteren Ständen am selben Tag gleich (gespeichertes standsSameDay)', async () => {
    const store = neuerStore();
    const s1 = await setzen(store, new PruefRenderer());
    const name1 = (await standPdf(store, PLAN_ID, s1.standId, { kind: 'plan' })).fileName;
    await setzen(store, new PruefRenderer());
    await setzen(store, new PruefRenderer());
    expect((await standPdf(store, PLAN_ID, s1.standId, { kind: 'plan' })).fileName).toBe(name1);
    expect(name1).toBe('01_02_WAP_FDT_2026_Plan_Stand_2026-09-17.pdf');
  });
});
