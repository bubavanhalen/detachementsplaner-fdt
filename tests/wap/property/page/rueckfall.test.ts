// @vitest-environment jsdom
// Paket E1-02e: gleichartige Texte gleich gross, verkleinert nur, was sonst nicht passt (R-10-39; Vertrag E1-02e
// Notiz «Ausarbeitung Schritt 2» E3, E4, E6, J R-10-39 (a) bis (e); Vertrag E1-02d 2e, V-02d-7, V-02d-8; V-02e-3,
// V-02e-9, V33, V06). Zufällige fiktive Wochen mit Farbkennung, Zielen, Bemerkungen und Bereitschaft (fester
// Startwert 20261006, 20 Läufe); geprüft wird das Seitenmodell (Testort Property, ADR-010 §5).
// «Passen» wie E1-02d 2e mit breakText ('ifWordDoesNotFit' für Absätze, 'never' für Kürzel, Nummern und Zeitzeile)
// auf `TextItem.frame`; Zeitzeile und Stapel-Unterkante nach Änderungsnotiz Tests Schritt 3, S3-8 (a), (b), (e).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { agendaLinesForDate } from '../../../../src/model/wap/derive/agenda';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import { GRID_CONSTANTS } from '../../../../src/model/wap/layout/grid';
import type {
  PageTextKind,
  PageTextRef,
  WeekPageLayout,
} from '../../../../src/model/wap/layout/page/types';
import type { PageModel, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { breakText } from '../../../../src/model/wap/layout/text/break';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { kpTemplate } from '../../../../src/model/wap/template';
import { farbWoche, PAGE_RUNS, PAGE_SEED } from '../../support/arbitraries/page';
import { leseBkp, ZAHL, zahl } from '../../support/page/bkp';
import { norm } from '../../support/page/pdf-seite';
import {
  bewerte,
  EPS,
  G,
  styled,
  textVon,
  traegerGruppen,
  zeilenzahl,
} from '../../support/page/rueckfall';
import { seite } from '../../support/page/seite';
import { form, zeile } from '../../support/page/stile';
import { woche } from '../../support/page/varianten';

// includeErrorInReport auch im Suite-Lauf (ohne vitest-setup.ts der WAP-Konfiguration): Ursache im Bericht.
const OPT = { seed: PAGE_SEED, numRuns: PAGE_RUNS, includeErrorInReport: true } as const;

function item(L: WeekPageLayout, r: { page: number; item: number }): TextItem {
  return (L.pages[r.page] as PageModel).items[r.item] as TextItem;
}

const text = textVon;

/**
 * Lage der Wochenziele nach B-Kp-74 (Sollwert «x(«-») = Seitenleiste links + 1,0; Einzug 4,6») und Strichbreite
 * des Seitenrahmens nach B-Kp-02 (S3-2, V34).
 */
function zielLageAusCsv(): { strich: number; einzug: number; rahmen: number } {
  const d = leseBkp();
  const m = form(
    'B-Kp-74',
    'Sollwert',
    zeile(d, 'B-Kp-74').sollwert,
    new RegExp(`^x[(]«-»[)] = Seitenleiste links [+] (${ZAHL}); Einzug (${ZAHL})$`),
  );
  const r = form('B-Kp-02', 'Sollwert', zeile(d, 'B-Kp-02').sollwert, new RegExp(`^(${ZAHL})$`));
  return { strich: zahl(m[1] ?? ''), einzug: zahl(m[2] ?? ''), rahmen: zahl(r[1] ?? '') };
}

let zielLage: { strich: number; einzug: number; rahmen: number } | undefined;

describe('Gleich gross, verkleinert nur bei Platzmangel (R-10-39)', () => {
  it('[R-10-39] (a) Eintragstext verkleinert ⇒ seine Absätze (nach V-02d-7, ohne entfallene) passen in Standardgrösse nicht in frame', () => {
    fc.assert(
      fc.property(farbWoche(), (w) => {
        const L = seite(w.plan, 'w26');
        for (const ts of traegerGruppen(L)) {
          const b = bewerte(L, w.plan, ts);
          expect(b, `Eintrag ${(ts[0] as TextItem).entryId ?? ''}`).not.toBeNull();
          if (b === null || b.gekuerzt) continue;
          if (b.rolle === 'rapport' && (ts[0] as TextItem).rotation !== 0) {
            // E1-02d Notiz Q-032 A3: Passt das Kästchen waagrecht in Standardgrösse, steht es nur nach Stufe 5
            // senkrecht (weniger Trennstriche bei nicht mehr Umbrüchen; Pflichtfall P12).
            expect(
              b.waagrechtPasstStandard === false || b.senkrechtStufe5 === true,
              `Rapport ${b.id} senkrecht, obwohl waagrecht passend und nicht nach Q-032 A3 Stufe 5`,
            ).toBe(true);
          }
          if (b.verkleinert) {
            expect(
              b.passtStandard,
              `${b.rolle} ${b.id} verkleinert, passt aber in Standardgrösse`,
            ).toBe(false);
          }
        }
      }),
      OPT,
    );
  });

  it('[R-10-39] (b) Terminspalte verkleinert ⇒ ihre Einheiten sind in Standardgrösse zu hoch für die Spalte; mit Fortsetzung in Mindestgrösse', () => {
    fc.assert(
      fc.property(farbWoche(), (w) => {
        const L = seite(w.plan, 'w26');
        const spalten = new Map<string, TextItem[]>();
        for (const r of L.texts) {
          if (r.kind !== 'agendaLine' || r.page !== 0) continue;
          const t = item(L, r);
          const k = JSON.stringify(t.frame);
          spalten.set(k, [...(spalten.get(k) ?? []), t]);
        }
        for (const ts of spalten.values()) {
          const s = (ts[0] as TextItem).sizePt;
          for (const t of ts) expect(t.sizePt, 'eine Grösse je Terminspalte').toBe(s);
          if (s >= G.standard - EPS) continue;
          const f = (ts[0] as TextItem).frame;
          const daten = L.grid.days
            .filter((d) => d.x + d.w / 2 > f.x && d.x + d.w / 2 < f.x + f.w)
            .map((d) => d.date);
          const fortsetzung = L.fallbacks.some(
            (e) =>
              e.kind === 'continuationPage' &&
              e.region === 'agenda' &&
              daten.includes(e.date ?? ''),
          );
          if (fortsetzung) {
            expect(s).toBe(G.min);
            continue;
          }
          let zeilen = 0;
          for (const u of daten.flatMap((d) => agendaLinesForDate(w.plan, d))) {
            const runs = styled(u.text);
            const istBeso = w.plan.entries[u.entryId]?.type === 'beso';
            const nr = u.number === null ? '–' : String(u.number);
            const einzug = istBeso
              ? measureRuns([{ text: `${nr} `, weight: runs[0]?.weight ?? 'regular' }], G.standard)
              : 0;
            const z = zeilenzahl(runs, f.w, f.w - einzug, G.standard);
            zeilen += z ?? Number.POSITIVE_INFINITY;
          }
          expect(
            zeilen * lineHeightPt(G.standard),
            `Terminspalte ab x ${f.x.toFixed(1)} verkleinert, passt aber in Standardgrösse`,
          ).toBeGreaterThan(f.h + EPS);
        }
      }),
      OPT,
    );
  });

  it('[R-10-39] (c, d) übrige Texte in standardSizePt; einzeiliger Text verkleinert ⇒ in Standardgrösse breiter als frame oder, bei Zell-Texten, höher als seine Querabmessung (S3-22 (b), S3-23 (a)); waagrechter Spaltenkopf verkleinert ⇒ seine Zeilen passen in Standardgrösse nicht in frame (V33); gekürzt nur in Mindestgrösse', () => {
    const EINZEILIG: readonly PageTextKind[] = [
      'army',
      'weekLine',
      'title',
      'beilage',
      'classification',
      'unit',
      'stand',
      'continuationTitle',
      'axisHead',
      'hour',
      'dayHead',
      'agendaLabel',
      'agendaHead',
      'sidebarHeading',
      'abbreviation',
      'legendLabel',
      'signature',
      'motto',
      'sunTime',
    ];
    fc.assert(
      fc.property(farbWoche(), (w) => {
        const L = seite(w.plan, 'w26');
        const koepfe = new Map<string, { r: PageTextRef; t: TextItem }[]>();
        for (const r of L.texts) {
          if (
            r.kind === 'entry' ||
            r.kind === 'agendaLine' ||
            r.kind === 'goal' ||
            r.kind === 'remark' ||
            r.kind === 'remarkNumber'
          )
            continue;
          const t = item(L, r);
          const std = r.standardSizePt as number;
          expect(std).not.toBeNull();
          if (t.sizePt >= std - EPS) {
            expect(t.sizePt, `${r.kind} «${text(t)}» in Standardgrösse`).toBe(std);
            continue;
          }
          expect(t.sizePt).toBeGreaterThanOrEqual(G.min - EPS);
          if (text(t).endsWith('…')) {
            expect(t.sizePt, `gekürzt «${text(t)}» in Mindestgrösse`).toBe(G.min);
            continue;
          }
          if (r.kind === 'columnHead' && t.rotation === 0) {
            const k = JSON.stringify(t.frame);
            koepfe.set(k, [...(koepfe.get(k) ?? []), { r, t }]);
            continue;
          }
          expect(
            r.kind === 'columnHead' || EINZEILIG.includes(r.kind as PageTextKind),
            `${r.kind} verkleinert`,
          ).toBe(true);
          const runs = t.runs.map((x) => ({ text: x.text, weight: x.weight }));
          const verfuegbar = t.rotation === 0 ? t.frame.w : t.frame.h;
          // S3-23 (a): Querklausel nur für Texte, deren frame die Zelle bzw. der Slot ist (dayHead, agendaLabel,
          // agendaHead, sidebarHeading, senkrechter columnHead); alle übrigen einzeiligen Arten nur über die Breite.
          const quer =
            r.kind === 'dayHead' ||
            r.kind === 'agendaLabel' ||
            r.kind === 'agendaHead' ||
            r.kind === 'sidebarHeading' ||
            (r.kind === 'columnHead' && t.rotation !== 0);
          expect(
            measureRuns(runs, std) > verfuegbar + EPS ||
              (quer && lineHeightPt(std) > (t.rotation === 0 ? t.frame.h : t.frame.w) + EPS),
            `${r.kind} «${text(t)}» verkleinert, passt aber in Standardgrösse`,
          ).toBe(true);
        }
        for (const kopf of koepfe.values()) {
          const t0 = (kopf[0] as { t: TextItem }).t;
          const std = (kopf[0] as { r: PageTextRef }).r.standardSizePt as number;
          const tag = L.grid.days.find((d) => t0.frame.x >= d.x - 0.01 && t0.frame.x < d.x + d.w);
          const spalte = tag?.columns.find(
            (c) => t0.frame.x + t0.frame.w / 2 > c.x && t0.frame.x + t0.frame.w / 2 < c.x + c.w,
          );
          const col = w.plan.columnSets
            .flatMap((s) => s.columns)
            .find((c) => c.id === spalte?.columnId);
          if (col === undefined || col.kind === 'rap' || col.kind === 'beso') {
            // S3-20 Schritt 1: Rap- und Beso-Köpfe einzeilig und ungetrennt.
            expect(kopf.length, `Rap-/Beso-Kopf «${text(t0)}» einzeilig`).toBe(1);
            const runs = [{ text: text(t0), weight: 'bold' as const }];
            expect(
              measureRuns(runs, std) > t0.frame.w + EPS || lineHeightPt(std) > t0.frame.h + EPS,
              `Rap-/Beso-Kopf «${text(t0)}» verkleinert, passt aber einzeilig in Standardgrösse`,
            ).toBe(true);
            continue;
          }
          const name = col.name;
          const r = breakText([{ text: name, weight: 'bold' }], {
            maxWidthPt: t0.frame.w,
            sizePt: std,
            hyphenate: 'ifWordDoesNotFit',
          });
          expect(
            !r.fits || r.lines.length * lineHeightPt(std) > t0.frame.h + EPS,
            `Spaltenkopf «${name}» verkleinert, passt aber`,
          ).toBe(true);
        }
      }),
      OPT,
    );
  });

  it('[R-10-39] (e) Ziel- und Bemerkungstexte verkleinert ⇒ der obere Stapel überlappt in Standardgrösse die Kürzelüberschrift − 0,5 h (V06); mit Fortsetzung in Mindestgrösse', () => {
    fc.assert(
      fc.property(farbWoche(), (w) => {
        const L = seite(w.plan, 'w26');
        // Lage der Wochenziele aus der CSV (B-Kp-74, B-Kp-02), erst nach dem Aufruf der Seite gelesen (H11).
        zielLage ??= zielLageAusCsv();
        const lage = zielLage;
        const auf0 = (k: PageTextKind) =>
          L.texts.filter((r) => r.page === 0 && r.kind === k).map((r) => item(L, r));
        const ziele = auf0('goal');
        const bem = auf0('remark');
        // S3-2 (V34): Textfläche jeder Zielzeile von xS + 1,0 bis rechter Rahmen − ½ Rahmenstrich − textInsetPt.
        const xS = L.frame.sidebarUpper.x;
        const rand =
          L.frame.frame.x + L.frame.frame.w - lage.rahmen / 2 - GRID_CONSTANTS.textInsetPt;
        for (const t of ziele) {
          expect(
            Math.abs(t.frame.x + t.frame.w - rand),
            `rechter Rand der Zielzeile «${text(t)}»`,
          ).toBeLessThanOrEqual(0.01);
          expect(
            Math.abs(t.frame.x - (xS + lage.strich)),
            `linker Rand der Zielzeile «${text(t)}»`,
          ).toBeLessThanOrEqual(0.01);
        }
        const alle = [...ziele, ...bem];
        if (alle.length === 0) return;
        const s = (alle[0] as TextItem).sizePt;
        for (const t of [...alle, ...auf0('remarkNumber')])
          expect(t.sizePt, 'Ziele und Bemerkungen gemeinsam').toBe(s);
        if (s >= G.standard - EPS) return;
        const verschoben = L.fallbacks.some(
          (e) => e.kind === 'continuationPage' && e.region === 'sidebar',
        );
        if (verschoben) {
          expect(s).toBe(G.min);
          return;
        }
        let delta = 0;
        // Wochenziele: Absatz beginnt mit «- », hängender Einzug.
        const zielGruppen: TextItem[][] = [];
        for (const t of [...ziele].sort((a, b) => a.baselineY - b.baselineY)) {
          if (text(t).startsWith('- ') || zielGruppen.length === 0) zielGruppen.push([t]);
          else (zielGruppen[zielGruppen.length - 1] as TextItem[]).push(t);
        }
        woche(w.plan)
          .weekGoals.slice(0, zielGruppen.length)
          .forEach((g, i) => {
            const z = zielGruppen[i] as TextItem[];
            // Zeile 1 ab xS + 1,0, Folgezeilen und nach LF ab xS + 4,6, je bis zum rechten Rand (S3-2, V34).
            const n5 = zeilenzahl(
              [{ text: `- ${g.text}`, weight: 'regular' }],
              rand - (xS + lage.strich),
              rand - (xS + lage.einzug),
              G.standard,
            );
            delta +=
              (n5 ?? Number.POSITIVE_INFINITY) * lineHeightPt(G.standard) -
              z.length * lineHeightPt(s);
          });
        // Bemerkungen: Zeilen der Reihe nach den Bemerkungen der Woche zugeordnet.
        const texte = remarksForWeek(w.plan, 'w26').map((r) => r.text);
        let i = 0;
        let gesammelt = '';
        let gruppe: TextItem[] = [];
        for (const t of [...bem].sort((a, b) => a.baselineY - b.baselineY)) {
          gruppe.push(t);
          gesammelt += norm(text(t));
          if (gesammelt.length >= norm(texte[i] ?? '').length) {
            const t1 = gruppe[0] as TextItem;
            const n5 = zeilenzahl(
              [{ text: texte[i] ?? '', weight: 'regular' }],
              t1.frame.w,
              t1.frame.w,
              G.standard,
            );
            delta +=
              (n5 ?? Number.POSITIVE_INFINITY) * lineHeightPt(G.standard) -
              gruppe.length * lineHeightPt(s);
            i++;
            gesammelt = '';
            gruppe = [];
          }
        }
        const ueberschrift = L.texts
          .filter((r) => r.page === 0 && r.kind === 'sidebarHeading')
          .map((r) => item(L, r))
          .find((t) => text(t) === kpTemplate().abbreviationHeading);
        expect(ueberschrift, 'Kürzelüberschrift').toBeDefined();
        const h = L.frame.h;
        const grenze =
          (ueberschrift as TextItem).baselineY -
          ascentPt((ueberschrift as TextItem).sizePt) -
          0.5 * h;
        // Unterkante des oberen Stapels (S3-8 e): tiefste Zeilenkasten-Unterkante der Arten goal, readiness,
        // remark, remarkNumber und sidebarHeading ohne die Kürzelüberschrift, Seite 0.
        const stapel = (['goal', 'readiness', 'remark', 'remarkNumber', 'sidebarHeading'] as const)
          .flatMap((k) => auf0(k))
          .filter((t) => t !== ueberschrift);
        const unten = Math.max(
          ...stapel.map((t) => t.baselineY - ascentPt(t.sizePt) + lineHeightPt(t.sizePt)),
        );
        expect(
          unten + delta,
          'Stapel in Standardgrösse überlappt die Kürzelüberschrift − 0,5 h',
        ).toBeGreaterThan(grenze + 1e-6);
      }),
      OPT,
    );
  });
});
