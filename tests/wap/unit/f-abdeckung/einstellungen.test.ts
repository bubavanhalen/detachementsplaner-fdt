// @vitest-environment node
// F-ABDECKUNG (FT-A-01): Befehle der Plan-, Wochen-, Tages- und Legendeneinstellungen (Beschrieb 4.1, 4.2, 4.3, 4.4,
// 4.7, 4.8; I3 C1/C3) mit Fehlerpfaden (Meldung mit Ursache und nächstem Schritt, Plan unverändert), Grenzwerten,
// «keine Änderung → kein Undo-Schritt» und Rückgängig über die inversen Patches (R-5.6-14). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { CommandError, type CommandResult } from '../../../../src/model/wap/commands/command';
import {
  addRapportCode,
  categoryOf,
  categoryUsage,
  createColumnSet,
  deleteCategory,
  deleteColumnSet,
  isKnownCode,
  moveCategory,
  moveColumn,
  renameColumnSet,
  STATUS_NAMES,
  setDayNote,
  setRemarkHidden,
  setWeekGoals,
  updateAbbreviations,
  updateCommonFields,
  updateFunctionList,
  updateMarkerLabels,
  updatePlanFields,
  updateRapportCodes,
  updateWeekFields,
  upsertCategory,
} from '../../../../src/model/wap/commands/settings';
import type { Commander, Plan, Weekday } from '../../../../src/model/wap/types';
import { undo } from '../../support/i3/plan';
import { add, block, CTX, column, kpPlan, MO } from '../../support/i5/plan';

const wk = (plan: Plan, i = 0) => plan.weeks[i]?.id ?? '';
const unchanged = (plan: Plan, r: CommandResult) => {
  expect(r.plan).toBe(plan);
  expect(r.patches).toEqual([]);
};
/** Erwarteter Befehlsfehler mit Code, Feld und vollständiger Meldung (Ursache und nächster Schritt). */
function fehler(fn: () => unknown, code: string, field: string | null): CommandError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CommandError);
    const c = e as CommandError;
    expect(c.code).toBe(code);
    expect(c.field).toBe(field);
    expect(c.userMessage.cause.length).toBeGreaterThan(10);
    expect(c.userMessage.nextStep.length).toBeGreaterThan(5);
    return c;
  }
  throw new Error('kein Fehler geworfen');
}
const PNG = { mime: 'image/png' as const, dataBase64: 'iVBORw0KGgo=' };
const KDT: Commander = {
  grad: ' Hptm ',
  name: ' Beispiel ',
  vorname: 'Anna',
  funktion: 'Kp Kdt ',
  nameOrder: 'gradNameVorname',
};

describe('F-ABDECKUNG Plan-Felder (Beschrieb 4.1)', () => {
  it('[R-4.1-02][R-15-01] Texte am Rand getrimmt; Klassifizierung leer bleibt leer; ein Undo-Schritt', () => {
    const p = kpPlan(1);
    const r = updatePlanFields(
      p,
      {
        unit: '  Inf Fik Kp 99/9 ',
        parentUnit: 'Inf Bat 99 ',
        classification: '  ',
        motto: ' Vorwärts ',
      },
      CTX,
    );
    expect(r.label).toBe('Plan-Einstellungen geändert');
    expect(r.plan).toMatchObject({
      unit: 'Inf Fik Kp 99/9',
      parentUnit: 'Inf Bat 99',
      classification: '',
      motto: 'Vorwärts',
    });
    expect(undo(r)).toEqual(p);
    // Gleiche Werte noch einmal: keine Änderung, kein Undo-Schritt.
    unchanged(r.plan, updatePlanFields(r.plan, { unit: 'Inf Fik Kp 99/9 ' }, CTX));
  });

  it('[R-4.1-07] Kommandant: Felder getrimmt, Reihenfolge gespeichert; unbekannte Reihenfolge → Fehler', () => {
    const p = kpPlan(1);
    const r = updatePlanFields(p, { commander: KDT }, CTX);
    expect(r.plan.commander).toEqual({
      grad: 'Hptm',
      name: 'Beispiel',
      vorname: 'Anna',
      funktion: 'Kp Kdt',
      nameOrder: 'gradNameVorname',
    });
    unchanged(r.plan, updatePlanFields(r.plan, { commander: KDT }, CTX));
    const c = fehler(
      () =>
        updatePlanFields(
          p,
          { commander: { ...KDT, nameOrder: 'nameZuerst' as unknown as Commander['nameOrder'] } },
          CTX,
        ),
      'invalidEntry',
      'commander.nameOrder',
    );
    expect(c.userMessage.nextStep).toBe('«Grad Vorname Name» oder «Grad Name Vorname» wählen.');
  });

  it('[R-4.1-13][R-4.1-08][R-15-03] Wappen und Unterschrift setzen, ersetzen, entfernen; Unterschrift ein/aus', () => {
    const p = kpPlan(1);
    expect(p.signatureEnabled).toBe(false);
    let r = updatePlanFields(
      p,
      { coatOfArms: PNG, signatureImage: PNG, signatureEnabled: true },
      CTX,
    );
    expect(r.plan).toMatchObject({ coatOfArms: PNG, signatureImage: PNG, signatureEnabled: true });
    unchanged(
      r.plan,
      updatePlanFields(r.plan, { coatOfArms: { ...PNG }, signatureEnabled: true }, CTX),
    );
    r = updatePlanFields(
      r.plan,
      { coatOfArms: null, signatureImage: null, signatureEnabled: false },
      CTX,
    );
    expect(r.plan).toMatchObject({
      coatOfArms: null,
      signatureImage: null,
      signatureEnabled: false,
    });
  });

  it('[R-4.1-13] Fehlerpfad: Bild ohne PNG/JPEG-Typ oder ohne Daten → Fehler am Feld, Plan unverändert', () => {
    const p = kpPlan(1);
    const gif = { mime: 'image/gif', dataBase64: 'R0lG' } as unknown as typeof PNG;
    const c = fehler(
      () => updatePlanFields(p, { coatOfArms: gif }, CTX),
      'invalidEntry',
      'coatOfArms',
    );
    expect(c.userMessage).toEqual({
      cause: 'Das Bild ist keine PNG- oder JPEG-Datei.',
      nextStep: 'Eine PNG- oder JPEG-Datei von diesem Gerät wählen.',
    });
    fehler(
      () => updatePlanFields(p, { signatureImage: { mime: 'image/jpeg', dataBase64: '' } }, CTX),
      'invalidEntry',
      'signatureImage',
    );
    fehler(
      () =>
        updatePlanFields(
          p,
          { signatureImage: { mime: 'image/jpeg', dataBase64: 7 } as unknown as typeof PNG },
          CTX,
        ),
      'invalidEntry',
      'signatureImage',
    );
  });
});

describe('F-ABDECKUNG Wochen-Felder und Wochenziele (Beschrieb 4.2, 4.8)', () => {
  it('[R-4.8-11] Sonnenzeiten von Hand: gültige Werte gespeichert; Grenzwerte 0000 und 2355', () => {
    const p = kpPlan(1);
    const r = updateWeekFields(p, wk(p), { sunOverride: { sunrise: 0, sunset: 1435 } }, CTX);
    expect(r.plan.weeks[0]?.sunOverride).toEqual({ sunrise: 0, sunset: 1435 });
    expect(r.label).toBe('Woche «KVK» geändert');
    unchanged(
      r.plan,
      updateWeekFields(r.plan, wk(p), { sunOverride: { sunrise: 0, sunset: 1435 } }, CTX),
    );
    const leer = updateWeekFields(
      r.plan,
      wk(p),
      { sunOverride: { sunrise: null, sunset: null } },
      CTX,
    );
    expect(leer.plan.weeks[0]?.sunOverride).toEqual({ sunrise: null, sunset: null });
  });

  it('[R-4.8-11] Fehlerpfad Sonnenzeit: 2400, negativ, nicht auf 5 Minuten, keine ganze Zahl → Fehler mit Feld', () => {
    const p = kpPlan(1);
    const c = fehler(
      () => updateWeekFields(p, wk(p), { sunOverride: { sunrise: 1440, sunset: null } }, CTX),
      'invalidEntry',
      'sunOverride.sunrise',
    );
    expect(c.userMessage.nextStep).toBe('Eine Zeit wie 0715 oder 1930 eingeben (auf 5 Minuten).');
    for (const t of [-5, 432, 7.5])
      fehler(
        () => updateWeekFields(p, wk(p), { sunOverride: { sunrise: null, sunset: t } }, CTX),
        'invalidEntry',
        'sunOverride.sunset',
      );
  });

  it('[R-4.2-06] Erhöhte Bereitschaft getrimmt; Terminbereich Wochenende; unbekannte Woche → unknownWeek', () => {
    const p = kpPlan(1);
    const r = updateWeekFields(
      p,
      wk(p),
      { heightenedReadiness: '  Pikett Zug 1 ', agendaWeekend: 'combined' },
      CTX,
    );
    expect(r.plan.weeks[0]).toMatchObject({
      heightenedReadiness: 'Pikett Zug 1',
      agendaWeekend: 'combined',
    });
    unchanged(r.plan, updateWeekFields(r.plan, wk(p), { agendaWeekend: 'combined' }, CTX));
    fehler(() => updateWeekFields(p, 'w-unbekannt', {}, CTX), 'unknownWeek', null);
    fehler(() => setWeekGoals(p, 'w-unbekannt', [], CTX), 'unknownWeek', null);
    fehler(() => setDayNote(p, 'w-unbekannt', 'Mo', 'x', CTX), 'unknownWeek', null);
  });

  it('[R-4.2-08] Ausgeblendete Plan-Bemerkungen über die Wochenfelder: Doppel entfallen', () => {
    const p = kpPlan(1);
    const r = updateWeekFields(p, wk(p), { hiddenRemarkIds: ['e1', 'e1', 'e2'] }, CTX);
    expect(r.plan.weeks[0]?.hiddenRemarkIds).toEqual(['e1', 'e2']);
  });

  it('[R-4.2-04] Wochenziele: leere Zeilen entfallen, Text getrimmt, IDs bleiben je Lage; Kürzen behält die ersten', () => {
    const p = kpPlan(1);
    const r1 = setWeekGoals(p, wk(p), ['  Ausbildung ', '', 'Material'], CTX);
    const goals = r1.plan.weeks[0]?.weekGoals ?? [];
    expect(goals.map((g) => g.text)).toEqual(['Ausbildung', 'Material']);
    expect(goals.map((g) => g.group)).toEqual([null, null]);
    const r2 = setWeekGoals(r1.plan, wk(p), ['Ausbildung neu', 'Material', 'Wache'], CTX);
    const g2 = r2.plan.weeks[0]?.weekGoals ?? [];
    expect(g2.map((g) => g.id).slice(0, 2)).toEqual(goals.map((g) => g.id));
    expect(new Set(g2.map((g) => g.id)).size).toBe(3);
    expect(r2.label).toBe('Wochenziele von «KVK» geändert');
    unchanged(r2.plan, setWeekGoals(r2.plan, wk(p), ['Ausbildung neu', 'Material', 'Wache'], CTX));
    const r3 = setWeekGoals(r2.plan, wk(p), [], CTX);
    expect(r3.plan.weeks[0]?.weekGoals).toEqual([]);
    expect(undo(r3)).toEqual(r2.plan);
  });

  it('[R-4.2-08] Plan-Bemerkung je Woche aus- und wieder einblenden; zweimal ausblenden ändert nichts', () => {
    const base = kpPlan(2);
    const { plan, id } = add(base, {
      type: 'multiDayRemark',
      text: 'Gilt',
      scope: { kind: 'plan' },
    });
    const aus = setRemarkHidden(plan, wk(plan, 1), id, true, CTX);
    expect(aus.label).toBe('Bemerkung in «Woche 1» ausgeblendet');
    expect(aus.plan.weeks.map((w) => w.hiddenRemarkIds)).toEqual([[], [id]]);
    unchanged(aus.plan, setRemarkHidden(aus.plan, wk(plan, 1), id, true, CTX));
    const ein = setRemarkHidden(aus.plan, wk(plan, 1), id, false, CTX);
    expect(ein.label).toBe('Bemerkung in «Woche 1» eingeblendet');
    expect(ein.plan.weeks[1]?.hiddenRemarkIds).toEqual([]);
  });

  it('[R-4.2-08] Fehlerpfad: Eintrag ist keine Bemerkung → Fehler am Feld remarkId; unbekannter Eintrag → notFound', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const c = fehler(
      () => setRemarkHidden(plan, wk(plan), id, true, CTX),
      'invalidEntry',
      'remarkId',
    );
    expect(c.userMessage.cause).toBe('Der Eintrag ist keine Bemerkung.');
    fehler(() => setRemarkHidden(plan, wk(plan), 'e-weg', true, CTX), 'notFound', null);
  });

  it('[R-6-07] Interne Notiz des Tages: gespeichert, gleiche Notiz kein Schritt; unbekannter Wochentag → RangeError', () => {
    const p = kpPlan(1);
    const r = setDayNote(p, wk(p), 'Mi', 'Fahrzeug fiktiv prüfen', CTX);
    expect(r.label).toBe('Interne Notiz Mi geändert');
    expect(r.plan.weeks[0]?.days[2]?.internalNote).toBe('Fahrzeug fiktiv prüfen');
    unchanged(r.plan, setDayNote(r.plan, wk(p), 'Mi', 'Fahrzeug fiktiv prüfen', CTX));
    expect(() => setDayNote(p, wk(p), 'Xy' as Weekday, 'x', CTX)).toThrow(RangeError);
  });
});

describe('F-ABDECKUNG Legende (Beschrieb 4.7; F-58)', () => {
  const ROT = { r: 192, g: 0, b: 0 };

  it('[R-4.7-01] Kategorie anlegen: neue ID, Name und Legendentext getrimmt; ändern: gleiche ID; gleiche Werte kein Schritt', () => {
    const p = kpPlan(1);
    const r = upsertCategory(
      p,
      {
        name: ' Ltg Fik ',
        legendLabel: ' Leitung Fik ',
        color: ROT,
        neutral: false,
        inLegend: true,
      },
      CTX,
    );
    expect(r.label).toBe('Kategorie «Ltg Fik» angelegt');
    expect(categoryOf(r.plan, r.categoryId)).toEqual({
      id: r.categoryId,
      name: 'Ltg Fik',
      legendLabel: 'Leitung Fik',
      color: ROT,
      neutral: false,
      inLegend: true,
    });
    const r2 = upsertCategory(
      r.plan,
      {
        id: r.categoryId,
        name: 'Ltg Fik',
        legendLabel: 'Neu',
        color: ROT,
        neutral: true,
        inLegend: false,
      },
      CTX,
    );
    expect(r2.label).toBe('Kategorie «Ltg Fik» geändert');
    expect(categoryOf(r2.plan, r.categoryId)).toMatchObject({
      legendLabel: 'Neu',
      neutral: true,
      inLegend: false,
    });
    unchanged(
      r2.plan,
      upsertCategory(
        r2.plan,
        {
          id: r.categoryId,
          name: 'Ltg Fik',
          legendLabel: 'Neu',
          color: ROT,
          neutral: true,
          inLegend: false,
        },
        CTX,
      ),
    );
    expect(categoryOf(p, null)).toBeNull();
    expect(categoryOf(p, 'k-weg')).toBeNull();
  });

  it('[R-4.7-01] Fehlerpfade: Name leer, Name doppelt, Farbe ausserhalb 0–255 bzw. keine ganze Zahl, unbekannte ID', () => {
    const p = kpPlan(1);
    const base = { legendLabel: 'x', color: ROT, neutral: false, inLegend: true };
    fehler(() => upsertCategory(p, { ...base, name: '  ' }, CTX), 'invalidEntry', 'name');
    const doppelt = fehler(
      () => upsertCategory(p, { ...base, name: 'Ltg Kp' }, CTX),
      'invalidEntry',
      'name',
    );
    expect(doppelt.userMessage.cause).toBe('Eine Kategorie «Ltg Kp» gibt es schon.');
    // Eigener Name beim Ändern ist erlaubt.
    const kp = p.legend[1];
    expect(upsertCategory(p, { ...base, id: kp?.id ?? '', name: 'Ltg Kp' }, CTX).categoryId).toBe(
      kp?.id,
    );
    for (const color of [
      { r: 256, g: 0, b: 0 },
      { r: 0, g: -1, b: 0 },
      { r: 0, g: 0, b: 1.5 },
    ])
      fehler(
        () => upsertCategory(p, { ...base, name: 'Neu', color }, CTX),
        'invalidEntry',
        'color',
      );
    fehler(
      () => upsertCategory(p, { ...base, id: 'k-weg', name: 'Neu' }, CTX),
      'invalidEntry',
      'id',
    );
  });

  it('[R-4.7-01] Verwendung zählt Einträge (auch zweite Kategorie und gelöschte Wochen), Spalten, Funktionen, Rapportkürzel', () => {
    let p = kpPlan(1);
    const [bat, kp] = p.legend;
    const batId = bat?.id ?? '';
    const vorher = categoryUsage(p, batId);
    // Kp-Vorlage: Bat Kdt, S3 (Funktionsliste) und BR0–BR3 (Rapportkürzel) verwenden Ltg Bat.
    expect(vorher).toBeGreaterThanOrEqual(6);
    p = block(p, 'A', { categoryId: kp?.id ?? '', secondCategoryId: batId }).plan;
    p = block(p, 'B', { categoryId: batId }).plan;
    expect(categoryUsage(p, batId)).toBe(vorher + 2);
    const geloescht = {
      ...p,
      deletedWeeks: [
        { week: p.weeks[0] as Plan['weeks'][number], entries: Object.values(p.entries) },
      ],
    };
    expect(categoryUsage(geloescht, batId)).toBe(vorher + 4);
  });

  it('[R-4.7-01] Löschen mit Ersatz: alle Verweise wechseln in einem Schritt; zweite Kategorie gleich dem Ersatz entfällt', () => {
    let p = kpPlan(1);
    const [bat, kp] = p.legend;
    const batId = bat?.id ?? '';
    const kpId = kp?.id ?? '';
    const a = block(p, 'A', { categoryId: kpId, secondCategoryId: batId });
    p = a.plan;
    const b = block(p, 'B', { categoryId: batId, secondCategoryId: null });
    p = b.plan;
    p = { ...p, lastUsedCategoryId: batId };
    const r = deleteCategory(p, batId, kpId, CTX);
    expect(r.label).toBe('Kategorie «Ltg Bat» gelöscht');
    expect(r.plan.legend.some((x) => x.id === batId)).toBe(false);
    expect(r.plan.entries[a.id]).toMatchObject({ categoryId: kpId, secondCategoryId: null });
    expect(r.plan.entries[b.id]).toMatchObject({ categoryId: kpId, secondCategoryId: null });
    expect(categoryUsage(r.plan, batId)).toBe(0);
    expect(r.plan.functionList.every((f) => f.categoryId !== batId)).toBe(true);
    expect(r.plan.rapportCodes.every((x) => x.categoryId !== batId)).toBe(true);
    expect(r.plan.lastUsedCategoryId).toBe(kpId);
    expect(undo(r)).toEqual(p);
  });

  it('[R-4.7-01][FA-02] erste Kategorie gelöscht, zweite = Ersatz → Block erhält den Ersatz, die zweite Kategorie entfällt', () => {
    // Soll (R-4.7-01, F-58): alle Verweise wechseln; die zweite Kategorie entfällt, wenn sie der ersten gleich wird
    // (wie in updateEntry «dropSameSecond»). Bis F-FIX prüfte deleteCategory nur den umgekehrten Fall; der Block wurde
    // ungültig und das Löschen brach mit «Die zweite Kategorie ist gleich der ersten.» ab (Befund FA-02).
    const base = kpPlan(1);
    const [bat, kp] = base.legend;
    const batId = bat?.id ?? '';
    const kpId = kp?.id ?? '';
    const c = block(base, 'C', { categoryId: batId, secondCategoryId: kpId });
    expect(() => deleteCategory(c.plan, batId, kpId, CTX)).not.toThrow();
    const r = deleteCategory(c.plan, batId, kpId, CTX);
    expect(r.label).toBe('Kategorie «Ltg Bat» gelöscht');
    expect(r.plan.legend.some((x) => x.id === batId)).toBe(false);
    expect(r.plan.entries[c.id]).toMatchObject({ categoryId: kpId, secondCategoryId: null });
    expect(categoryUsage(r.plan, batId)).toBe(0);
    expect(undo(r)).toEqual(c.plan);
  });

  it('[R-4.7-01] Löschen ohne Verwendung ohne Ersatz; Spalten-Standardkategorie wechselt mit', () => {
    let p = kpPlan(1);
    const neu = upsertCategory(
      p,
      { name: 'Ltg Fik', legendLabel: 'Fik', color: ROT, neutral: false, inLegend: true },
      CTX,
    );
    p = neu.plan;
    expect(deleteCategory(p, neu.categoryId, null, CTX).plan.legend).toHaveLength(
      p.legend.length - 1,
    );
    const set = p.columnSets[0];
    if (set === undefined) throw new Error('Satz fehlt');
    const mitSpalte: Plan = {
      ...p,
      columnSets: [
        {
          ...set,
          columns: set.columns.map((c, i) =>
            i === 0 ? { ...c, defaultCategoryId: neu.categoryId } : c,
          ),
        },
        ...p.columnSets.slice(1),
      ],
    };
    const kpId = p.legend[1]?.id ?? '';
    const r = deleteCategory(mitSpalte, neu.categoryId, kpId, CTX);
    expect(r.plan.columnSets[0]?.columns[0]?.defaultCategoryId).toBe(kpId);
  });

  it('[R-4.7-01] Fehlerpfade Löschen: unbekannt, letzte Kategorie, verwendet ohne Ersatz bzw. mit sich selbst, Ersatz fehlt', () => {
    const p = kpPlan(1);
    const batId = p.legend[0]?.id ?? '';
    fehler(() => deleteCategory(p, 'k-weg', null, CTX), 'invalidEntry', 'id');
    const einzig: Plan = { ...p, legend: p.legend.slice(0, 1) };
    const c1 = fehler(() => deleteCategory(einzig, batId, null, CTX), 'invalidEntry', 'id');
    expect(c1.userMessage.nextStep).toBe('Zuerst eine weitere Kategorie anlegen.');
    const c2 = fehler(() => deleteCategory(p, batId, null, CTX), 'invalidEntry', 'replacementId');
    expect(c2.userMessage.cause).toMatch(/^«Ltg Bat» wird \d+-mal verwendet\.$/);
    fehler(() => deleteCategory(p, batId, batId, CTX), 'invalidEntry', 'replacementId');
    const c3 = fehler(
      () => deleteCategory(p, batId, 'k-weg', CTX),
      'invalidEntry',
      'replacementId',
    );
    expect(c3.userMessage.cause).toBe('Die Ersatzkategorie fehlt.');
  });

  it('[R-4.7-01] Reihenfolge: eine Stelle nach oben bzw. unten; am Rand und unbekannt → keine Änderung', () => {
    const p = kpPlan(1);
    const [a, b] = p.legend;
    const r = moveCategory(p, b?.id ?? '', -1, CTX);
    expect(r.label).toBe('Kategorie «Ltg Kp» verschoben');
    expect(r.plan.legend.slice(0, 2).map((c) => c.id)).toEqual([b?.id, a?.id]);
    const r2 = moveCategory(p, a?.id ?? '', 1, CTX);
    expect(r2.plan.legend.slice(0, 2).map((c) => c.id)).toEqual([b?.id, a?.id]);
    unchanged(p, moveCategory(p, a?.id ?? '', -1, CTX));
    unchanged(p, moveCategory(p, p.legend.at(-1)?.id ?? '', 1, CTX));
    unchanged(p, moveCategory(p, 'k-weg', 1, CTX));
  });
});

describe('F-ABDECKUNG Funktionsliste, Rapportkürzel, Kürzelliste (Beschrieb 4.7)', () => {
  it('[R-4.7-09] Funktionsliste: Kürzel getrimmt, leere Zeilen entfallen; doppelt bzw. unbekannte Kategorie → Fehler mit Zeile', () => {
    const p = kpPlan(1);
    const kp = p.legend[1]?.id ?? null;
    const r = updateFunctionList(
      p,
      [
        { code: ' Four ', categoryId: kp, singleFunction: true },
        { code: '  ', categoryId: null, singleFunction: false },
        { code: 'Wm', categoryId: null, singleFunction: false },
      ],
      CTX,
    );
    expect(r.plan.functionList).toEqual([
      { code: 'Four', categoryId: kp, singleFunction: true },
      { code: 'Wm', categoryId: null, singleFunction: false },
    ]);
    unchanged(r.plan, updateFunctionList(r.plan, r.plan.functionList, CTX));
    const d = fehler(
      () =>
        updateFunctionList(
          p,
          [
            { code: 'Four', categoryId: null, singleFunction: true },
            { code: 'Four ', categoryId: null, singleFunction: true },
          ],
          CTX,
        ),
      'invalidEntry',
      'functionList[1].code',
    );
    expect(d.userMessage.cause).toBe('Die Funktion «Four» steht doppelt in der Liste.');
    fehler(
      () =>
        updateFunctionList(p, [{ code: 'Four', categoryId: 'k-weg', singleFunction: true }], CTX),
      'invalidEntry',
      'functionList[0].categoryId',
    );
  });

  it('[R-4.9-18] Rapportkürzel: getrimmt, leere entfallen; doppelt bzw. unbekannte Kategorie → Fehler mit Zeile', () => {
    const p = kpPlan(1);
    const kp = p.legend[1]?.id ?? '';
    const r = updateRapportCodes(
      p,
      [
        { code: ' KR ', categoryId: kp },
        { code: '', categoryId: kp },
        { code: 'TR', categoryId: kp },
      ],
      CTX,
    );
    expect(r.plan.rapportCodes).toEqual([
      { code: 'KR', categoryId: kp },
      { code: 'TR', categoryId: kp },
    ]);
    unchanged(r.plan, updateRapportCodes(r.plan, r.plan.rapportCodes, CTX));
    const d = fehler(
      () =>
        updateRapportCodes(
          p,
          [
            { code: 'KR', categoryId: kp },
            { code: 'KR', categoryId: kp },
          ],
          CTX,
        ),
      'invalidEntry',
      'rapportCodes[1].code',
    );
    expect(d.userMessage.cause).toBe('Das Rapportkürzel «KR» steht doppelt in der Liste.');
    fehler(
      () => updateRapportCodes(p, [{ code: 'KR', categoryId: 'k-weg' }], CTX),
      'invalidEntry',
      'rapportCodes[0].categoryId',
    );
  });

  it('[R-4.7-16] Unbekanntes Kürzel aufnehmen: bekannt, leer bzw. gewähltes Kürzel → keine Änderung; neu → Rapportkürzel', () => {
    let p = kpPlan(1);
    const kp = p.legend[1]?.id ?? '';
    expect(isKnownCode(p, 'KR')).toBe(true);
    expect(isKnownCode(p, ' ')).toBe(true);
    expect(isKnownCode(p, 'TR')).toBe(false);
    unchanged(p, addRapportCode(p, ' KR ', kp, CTX));
    unchanged(p, addRapportCode(p, '', kp, CTX));
    p = updateAbbreviations(p, ['Tw'], {}, CTX).plan;
    expect(isKnownCode(p, 'Tw')).toBe(true);
    unchanged(p, addRapportCode(p, 'Tw', kp, CTX));
    const r = addRapportCode(p, ' TR ', kp, CTX);
    expect(r.label).toBe('«TR» in die Abkürzungsliste aufgenommen');
    expect(r.plan.rapportCodes.at(-1)).toEqual({ code: 'TR', categoryId: kp });
    fehler(() => addRapportCode(p, 'XR', 'k-weg', CTX), 'invalidEntry', 'categoryId');
  });

  it('[R-4.7-14][R-4.7-21] Kürzelliste: gewählte Kürzel ohne Doppel und Leere; eigene Bedeutungen getrimmt, leere entfernt', () => {
    const p = kpPlan(1);
    const r = updateAbbreviations(
      p,
      [' Tw ', 'Tw', '', 'Spl'],
      { ' Tw ': ' Tagwache ', Spl: '  ', '': 'leer' },
      CTX,
    );
    expect(r.plan.abbreviationsSelected).toEqual(['Tw', 'Spl']);
    expect(r.plan.abbreviationMeanings).toEqual({ Tw: 'Tagwache' });
    expect(r.label).toBe('Kürzelliste geändert');
    unchanged(r.plan, updateAbbreviations(r.plan, ['Tw', 'Spl'], { Tw: 'Tagwache' }, CTX));
    // Keine eigenen Werte mehr: das Feld entfällt ganz (kanonisch).
    const ohne = updateAbbreviations(r.plan, ['Tw', 'Spl'], { Tw: ' ' }, CTX);
    expect('abbreviationMeanings' in ohne.plan).toBe(false);
    unchanged(p, updateAbbreviations(p, [...p.abbreviationsSelected], {}, CTX));
  });

  it('[R-4.7-21] Datenschutz/Robustheit: Schlüssel «__proto__», «constructor», «prototype» werden nie übernommen', () => {
    const p = kpPlan(1);
    const meanings = JSON.parse(
      '{"__proto__":"x","constructor":"y","prototype":"z","KR":"Kp Rapport"}',
    ) as Record<string, string>;
    const r = updateAbbreviations(p, [], meanings, CTX);
    expect(r.plan.abbreviationMeanings).toEqual({ KR: 'Kp Rapport' });
    expect(Object.keys(r.plan.abbreviationMeanings ?? {})).toEqual(['KR']);
  });

  it('[R-4.6-37] Markerbeschriftung je Art mit oder ohne Zeit; gleiche Einstellung kein Schritt', () => {
    const p = kpPlan(1);
    const r = updateMarkerLabels(p, [{ kind: 'ABV', withTime: true }], CTX);
    expect(r.plan.markerLabels).toEqual([{ kind: 'ABV', withTime: true }]);
    unchanged(r.plan, updateMarkerLabels(r.plan, [{ kind: 'ABV', withTime: true }], CTX));
  });
});

describe('F-ABDECKUNG Spaltensätze als Vorlagen (Beschrieb 4.4, 5.2)', () => {
  it('[R-4.4-09][R-2-02] Neuer Satz ohne Vorlage: Spalte 1, Rap, Beso mit neuen IDs; Name getrimmt', () => {
    const p = kpPlan(1);
    const r = createColumnSet(p, '  Woche Fik ', null, CTX);
    expect(r.label).toBe('Spaltensatz «Woche Fik» angelegt');
    const set = r.plan.columnSets.find((s) => s.id === r.setId);
    expect(set?.name).toBe('Woche Fik');
    expect(set?.columns.map((c) => [c.name, c.kind])).toEqual([
      ['Spalte 1', 'planning'],
      ['Rap', 'rap'],
      ['Beso', 'beso'],
    ]);
    expect(undo(r)).toEqual(p);
  });

  it('[R-4.4-09] Neuer Satz als Kopie: gleiche Spalten, neue Spalten-IDs, Herkunft «manuell»', () => {
    const p = kpPlan(1);
    const quelle = p.columnSets[0];
    if (quelle === undefined) throw new Error('Satz fehlt');
    const r = createColumnSet(p, 'Kopie', quelle.id, CTX);
    const set = r.plan.columnSets.find((s) => s.id === r.setId);
    expect(set?.columns.map((c) => c.name)).toEqual(quelle.columns.map((c) => c.name));
    const alt = new Set(quelle.columns.map((c) => c.id));
    expect(set?.columns.every((c) => !alt.has(c.id) && c.origin === 'manual')).toBe(true);
  });

  it('[R-4.4-09] Fehlerpfade: Name leer bzw. vergeben, unbekannte Vorlage; ungültige Vorlage (Rap vor Planung) → invalidColumnSet', () => {
    const p = kpPlan(1);
    fehler(() => createColumnSet(p, ' ', null, CTX), 'invalidEntry', 'name');
    const c = fehler(() => createColumnSet(p, 'KVK Stufen', null, CTX), 'invalidEntry', 'name');
    expect(c.userMessage.cause).toBe('Einen Spaltensatz «KVK Stufen» gibt es schon.');
    fehler(() => createColumnSet(p, 'Neu', 's-weg', CTX), 'unknownColumnSet', null);
    const set = p.columnSets[0];
    if (set === undefined) throw new Error('Satz fehlt');
    const kaputt: Plan = {
      ...p,
      columnSets: [{ ...set, columns: [...set.columns].reverse() }, ...p.columnSets.slice(1)],
    };
    fehler(() => createColumnSet(kaputt, 'Neu', set.id, CTX), 'invalidColumnSet', 'columns[1]');
  });

  it('[R-4.4-09] Umbenennen: getrimmt; eigener Name erlaubt; gleicher Name kein Schritt; vergeben → Fehler', () => {
    const p = kpPlan(1);
    const [a, b] = p.columnSets;
    const r = renameColumnSet(p, a?.id ?? '', ' Stufen neu ', CTX);
    expect(r.plan.columnSets[0]?.name).toBe('Stufen neu');
    expect(r.label).toBe('Spaltensatz «Stufen neu» umbenannt');
    unchanged(p, renameColumnSet(p, a?.id ?? '', a?.name ?? '', CTX));
    fehler(() => renameColumnSet(p, a?.id ?? '', b?.name ?? '', CTX), 'invalidEntry', 'name');
    fehler(() => renameColumnSet(p, 's-weg', 'x', CTX), 'unknownColumnSet', null);
  });

  it('[R-4.4-09][R-5.2-06] Löschen: zugewiesener Satz (Einzahl/Mehrzahl) und Satz einer gelöschten Woche → Fehler; frei → gelöscht', () => {
    const p = kpPlan(1);
    const [stufen, mitte, wochenende] = p.columnSets;
    const c = fehler(() => deleteColumnSet(p, stufen?.id ?? '', CTX), 'invalidEntry', 'setId');
    expect(c.userMessage.cause).toBe('«KVK Stufen» ist an 2 Tagen zugewiesen.');
    const w = p.weeks[0];
    if (w === undefined) throw new Error('Woche fehlt');
    const einTag: Plan = {
      ...p,
      weeks: [
        {
          ...w,
          days: w.days.map((d, i) =>
            i === 6
              ? { ...d, columnSetId: stufen?.id ?? null }
              : { ...d, columnSetId: mitte?.id ?? null },
          ) as unknown as typeof w.days,
        },
      ],
    };
    expect(
      fehler(() => deleteColumnSet(einTag, stufen?.id ?? '', CTX), 'invalidEntry', 'setId')
        .userMessage.cause,
    ).toBe('«KVK Stufen» ist an 1 Tag zugewiesen.');
    const frei = deleteColumnSet(einTag, wochenende?.id ?? '', CTX);
    expect(frei.label).toBe('Spaltensatz «Wochenende kompakt» gelöscht');
    expect(frei.plan.columnSets.map((s) => s.id)).toEqual([stufen?.id, mitte?.id]);
    const geloescht: Plan = {
      ...einTag,
      deletedWeeks: [
        { week: { ...w, label: 'Alt A' }, entries: [] },
        { week: { ...w, label: 'Alt B' }, entries: [] },
      ],
    };
    const d = fehler(
      () => deleteColumnSet(geloescht, wochenende?.id ?? '', CTX),
      'invalidEntry',
      'setId',
    );
    expect(d.userMessage.cause).toBe(
      '«Wochenende kompakt» wird von der gelöschten Woche «Alt A» und 1 weiteren verwendet.',
    );
    const nurEine: Plan = { ...geloescht, deletedWeeks: geloescht.deletedWeeks.slice(0, 1) };
    expect(
      fehler(() => deleteColumnSet(nurEine, wochenende?.id ?? '', CTX), 'invalidEntry', 'setId')
        .userMessage.cause,
    ).toBe('«Wochenende kompakt» wird von der gelöschten Woche «Alt A» verwendet.');
  });

  it('[R-2-02][R-5.2-08] Spalte verschieben: innerhalb der Planungsspalten erlaubt; Einträge bleiben in ihrer Spalte', () => {
    const base = kpPlan(1);
    const { plan, id } = block(base, 'Ausb');
    const set = plan.columnSets[0];
    if (set === undefined) throw new Error('Satz fehlt');
    const c1 = column(plan, 1);
    const r = moveColumn(plan, set.id, c1.id, -1, CTX);
    expect(r.label).toBe(`Spalte «${c1.name}» verschoben`);
    expect(r.plan.columnSets[0]?.columns.slice(0, 2).map((c) => c.id)).toEqual([
      c1.id,
      column(plan, 0).id,
    ]);
    expect(r.plan.entries[id]).toEqual(plan.entries[id]);
    expect(undo(r)).toEqual(plan);
  });

  it('[R-2-02] Spalte verschieben: Rap vor eine Planungsspalte → invalidColumnSet; am Rand bzw. unbekannte Spalte → keine Änderung', () => {
    const p = kpPlan(1);
    const set = p.columnSets[0];
    if (set === undefined) throw new Error('Satz fehlt');
    const rap = set.columns.find((c) => c.kind === 'rap');
    fehler(() => moveColumn(p, set.id, rap?.id ?? '', -1, CTX), 'invalidColumnSet', 'columns[6]');
    unchanged(p, moveColumn(p, set.id, set.columns[0]?.id ?? '', -1, CTX));
    unchanged(p, moveColumn(p, set.id, set.columns.at(-1)?.id ?? '', 1, CTX));
    unchanged(p, moveColumn(p, set.id, 'c-weg', 1, CTX));
    fehler(() => moveColumn(p, 's-weg', 'c-weg', 1, CTX), 'unknownColumnSet', null);
  });
});

describe('F-ABDECKUNG Mehrfachauswahl gemeinsame Felder (R-5.1-21)', () => {
  it('[R-5.1-21] Kategorie, Status und Textrichtung mehrerer Einträge in einem Schritt; Felder nur, wo der Typ sie hat', () => {
    let p = kpPlan(1);
    const kp = p.legend[1]?.id ?? '';
    const bat = p.legend[0]?.id ?? '';
    const a = block(p, 'A', { categoryId: kp, secondCategoryId: bat });
    p = a.plan;
    const n = add(p, { type: 'dayRemark', date: MO, text: 'Bemerkung' });
    p = n.plan;
    const r = updateCommonFields(
      p,
      [a.id, n.id, a.id],
      { categoryId: bat, status: 'cancelled', textDirection: 'vertical' },
      CTX,
    );
    expect(r.label).toBe('2 Einträge geändert');
    expect(r.plan.entries[a.id]).toMatchObject({
      categoryId: bat,
      secondCategoryId: null,
      status: 'cancelled',
      textDirection: 'vertical',
    });
    expect(r.plan.entries[n.id]).toMatchObject({ status: 'cancelled' });
    expect('categoryId' in (r.plan.entries[n.id] ?? {})).toBe(false);
    expect(undo(r)).toEqual(p);
    const eins = updateCommonFields(p, [n.id], { status: 'open' }, CTX);
    expect(eins.label).toBe('Eintrag geändert');
    unchanged(
      r.plan,
      updateCommonFields(r.plan, [a.id], { categoryId: bat, textDirection: 'vertical' }, CTX),
    );
  });

  it('[R-5.1-21] Fehlerpfade: unbekannte Kategorie bzw. unbekannter Eintrag → Fehler, Plan unverändert', () => {
    const { plan, id } = block(kpPlan(1), 'A');
    fehler(
      () => updateCommonFields(plan, [id], { categoryId: 'k-weg' }, CTX),
      'invalidEntry',
      'categoryId',
    );
    fehler(() => updateCommonFields(plan, ['e-weg'], { status: 'open' }, CTX), 'notFound', null);
  });

  it('[R-4.6-33] Kurzwort des Status für Meldungen: bestätigt, offen, gestrichen', () => {
    expect(STATUS_NAMES).toEqual({
      confirmed: 'bestätigt',
      open: 'offen',
      cancelled: 'gestrichen',
    });
  });
});
