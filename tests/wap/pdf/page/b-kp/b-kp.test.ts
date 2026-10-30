// @vitest-environment jsdom
// Paket E1-02e: Anhang B-Kp vollständig erfüllt (R-14.2-01; Vertrag E1-02e §4, Notiz «Ausarbeitung Schritt 2» I, J;
// ADR-010 §7.1; Gate 0 F-51, B-F-10, Q-015). Je Zeile der versionierten CSV ein Test mit Prüfer (Formmuster für
// Einheit, Sollwert und Toleranz; Zahlen aus der CSV); Testnamen tragen R-14.2-01 und die E1-02e-IDs aus der Spalte
// Anforderung (ohne Verweis-IDs). Dazu Vollständigkeit und Platzhalter. Jeder Test ruft vor seiner ersten
// Erwartung den Vertrags-Stub (KVK-Seite) auf (H11). Pseudonymisierte KVK-Fixture und fiktive Varianten.
// Nachtrag E1-02k (Vertrag E1-02k §3, §7 N5): 119 Zeilen (neu B-Kp-113 bis -119), 116 Prüfer.
import { describe, expect, it } from 'vitest';
import { req } from '../../../support/common/ids';
import {
  BKP_KOPF,
  ersetze,
  istBekannterPlatzhalter,
  leseBkp,
  PLATZHALTER,
  platzhalterIn,
  testIds,
  ZAHL,
} from '../../../support/page/bkp';
import { form } from '../../../support/page/stile';
import { neuerKontext } from './kontext';
import { AUFGESCHOBEN, PRUEFER, type Werte } from './pruefer';

const datei = leseBkp();
const k = neuerKontext();

describe('Anhang B-Kp: Vollständigkeit und Form (R-14.2-01)', () => {
  it('[R-14.2-01] Vollständigkeit: 119 Zeilen, Kopfzeile nach normalisierung.md §11; CSV-IDs = Prüfer ∪ Aufgeschoben (B-Kp-55, -56, -100 an E1-10), disjunkt', async () => {
    await k.kvk();
    expect(datei.kopf).toEqual([...BKP_KOPF]);
    const ids = datei.zeilen.map((z) => z.id);
    expect(ids.length).toBe(119);
    expect(new Set(ids).size).toBe(119);
    const pruefer = Object.keys(PRUEFER);
    expect(pruefer.filter((id) => AUFGESCHOBEN.has(id))).toEqual([]);
    expect([...pruefer, ...AUFGESCHOBEN].sort()).toEqual([...ids].sort());
    expect(pruefer.length).toBe(116);
  });

  it('[R-14.2-01] Platzhalter: jeder Platzhalter der CSV steht in der Tabelle von Abschnitt I; 14 verschiedene in 13 Zeilen, in der Spalte Soll 12 verschiedene in 10 Zeilen; ein unbekannter Platzhalter wird abgelehnt', async () => {
    await k.kvk();
    const alle = new Set<string>();
    const zeilen = new Set<string>();
    const soll = new Set<string>();
    const sollZeilen: string[] = [];
    for (const z of datei.zeilen) {
      const ph = z.zellen.flatMap(platzhalterIn);
      for (const p of ph) {
        expect(istBekannterPlatzhalter(p), `${z.id}: Platzhalter ${p} nicht in Abschnitt I`).toBe(
          true,
        );
        alle.add(p);
      }
      if (ph.length > 0) zeilen.add(z.id);
      const s = platzhalterIn(z.soll);
      for (const p of s) soll.add(p);
      if (s.length > 0) sollZeilen.push(z.id);
    }
    expect(alle.size).toBe(14);
    expect([...alle].sort()).toEqual([...PLATZHALTER].sort());
    expect(zeilen.size).toBe(13);
    expect(soll.size).toBe(12);
    expect(sollZeilen).toEqual([
      'B-Kp-17',
      'B-Kp-18',
      'B-Kp-22',
      'B-Kp-23',
      'B-Kp-25',
      'B-Kp-29',
      'B-Kp-53',
      'B-Kp-68',
      'B-Kp-81',
      'B-Kp-91',
    ]);
    expect(istBekannterPlatzhalter('<Unbekannt>')).toBe(false);
    expect(() => ersetze('«<Unbekannt>»', {})).toThrowError(/unbekannter Platzhalter/);
    expect(() => ersetze('«<Einheit>»', {})).toThrowError(/kein Ersatz/);
  });

  it('[R-14.2-01] Formmuster: eine abweichende Zelle (Punkt statt Dezimalkomma) macht den Test rot und nennt die ID', async () => {
    await k.kvk();
    expect(() => form('B-Kp-02', 'Sollwert', '0.48', new RegExp(`^(${ZAHL})$`))).toThrowError(
      /B-Kp-02/,
    );
    expect(form('B-Kp-02', 'Sollwert', '0,48', new RegExp(`^(${ZAHL})$`))[1]).toBe('0,48');
  });
});

describe('Anhang B-Kp: Prüfer je Zeile (R-14.2-01)', () => {
  for (const z of datei.zeilen) {
    if (AUFGESCHOBEN.has(z.id)) continue;
    const p = PRUEFER[z.id];
    const titel = `${z.id} ${p?.titel ?? 'ohne Prüfer'}${p?.kennung === undefined ? '' : ` ${p.kennung}`}`;
    it(req(testIds(z), titel), async () => {
      await k.kvk();
      expect(p, `Prüfer für ${z.id}`).toBeDefined();
      if (p === undefined) return;
      for (const zelle of [z.soll, z.sollwert, z.einheit, z.toleranz, z.anforderung.join(', ')]) {
        for (const ph of platzhalterIn(zelle)) {
          expect(istBekannterPlatzhalter(ph), `${z.id}: unbekannter Platzhalter ${ph}`).toBe(true);
        }
      }
      expect(z.einheit, `${z.id}: Einheit`).toBe(p.einheit);
      const w: Werte = {
        z,
        soll: p.soll === undefined ? null : form(z.id, 'Soll', z.soll, p.soll),
        sollwert: form(z.id, 'Sollwert', z.sollwert, p.sollwert),
        toleranz: form(z.id, 'Toleranz', z.toleranz, p.toleranz),
      };
      await p.pruefe(k, w);
    });
  }
});
