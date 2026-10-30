// P8 (Fehler): jeder Fall der Rückfallregel ist ein Befund (Beschrieb 7 P8, 10 «Rückfallregel»; Vertrag E1-06
// Abschnitt 2 mit Änderungsnotizen E1-02d, E1-02e, E1-02k; R-7-11, R-10-43; E1-02l R1/R2). Rein; das Layout der
// Wochenseite kommt als Parameter (nur Typen der Layout-Schicht).

import type { DroppedLine } from '../layout/grid/types';
import type { PageFallbackEvent, PageTextKind, WeekPageLayout } from '../layout/page/types';
import type { Plan, Week } from '../types';
import { columnName, dayText, entryMinute, entryTitle, placeOf } from './entryFacts';
import type { RawFinding } from './rules';
import { RULE_SEVERITY } from './types';

type BlockLine = Extract<DroppedLine, 'tn' | 'tenue' | 'ltg' | 'ort' | 'supplement'>;

const DROPPED: Readonly<Record<BlockLine, string>> = {
  tn: 'Tn',
  tenue: 'Tenue',
  ltg: 'Ltg',
  ort: 'Ort',
  supplement: 'Zusatz',
};

const isBlockLine = (d: DroppedLine): d is BlockLine => Object.hasOwn(DROPPED, d);

/** «1 Teilaufgabe» bzw. «n Teilaufgaben». */
function subtaskCount(n: number): string {
  return n === 1 ? '1 Teilaufgabe' : `${String(n)} Teilaufgaben`;
}

/**
 * Entfallene Zeilen als Text (R-10-43, R-10-48; H-LAYOUT SA-H-01): Zeilen des Blocks mit Namen, Zeilen der
 * Teilaufgaben mit ihrer Anzahl.
 */
function droppedText(dropped: readonly DroppedLine[]): string {
  const count = (k: DroppedLine): number => dropped.filter((d) => d === k).length;
  const parts = dropped.filter(isBlockLine).map((d) => DROPPED[d]);
  if (count('subtaskGap') > 0) parts.push('Leerzeilen vor Teilaufgaben');
  if (count('subtaskOrt') > 0) parts.push(`Ort von ${subtaskCount(count('subtaskOrt'))}`);
  if (count('subtaskLtg') > 0) parts.push(`Ltg von ${subtaskCount(count('subtaskLtg'))}`);
  if (count('subtaskTitle') > 0) parts.push(`${subtaskCount(count('subtaskTitle'))} ganz`);
  return parts.join(', ') || 'Zusatzzeilen';
}

/** Hinweis «Teilaufgabe gekürzt/entfallen» vor der Liste (H-LAYOUT SA-H-01); '' ohne Teilaufgaben. */
function subtaskNote(dropped: readonly DroppedLine[]): string {
  if (dropped.includes('subtaskTitle')) return ' Teilaufgabe entfallen.';
  return dropped.some((d) => !isBlockLine(d)) ? ' Teilaufgabe gekürzt.' : '';
}

const FIELD: Readonly<Record<PageTextKind, string>> = {
  army: 'Kopf «SCHWEIZER ARMEE»',
  weekLine: 'Kopf «Woche vom …»',
  title: 'Titel im Kopf',
  beilage: 'Beilage im Kopf',
  classification: 'Klassifizierung im Kopf',
  unit: 'Einheit im Kopf',
  stand: 'Stand im Kopf',
  continuationTitle: 'Titel der Fortsetzungsseite',
  axisHead: 'Kopf der Zeitachse',
  hour: 'Stundenbeschriftung',
  dayHead: 'Tageskopf',
  columnHead: 'Spaltenkopf',
  agendaLabel: 'Beschriftung der Termine',
  agendaHead: 'Kopf der Termine',
  agendaLine: 'Terminzeile',
  sidebarHeading: 'Überschrift der Seitenleiste',
  goal: 'Wochenziel in der Seitenleiste',
  readiness: 'Erhöhte Bereitschaft in der Seitenleiste',
  remarkNumber: 'Nummer einer Bemerkung',
  remark: 'Bemerkung in der Seitenleiste',
  abbreviation: 'Seitenleiste Kürzelliste',
  legendLabel: 'Legende in der Seitenleiste',
  abbreviationMeaning: 'Seitenleiste Kürzelliste',
  signature: 'Unterschrift in der Seitenleiste',
  motto: 'Motto in der Seitenleiste',
  sunTime: 'Sonnenzeiten in der Seitenleiste',
};

function size(min: number): string {
  return `${String(min).replace('.', ',')} pt`;
}

function eventDetail(e: PageFallbackEvent): string {
  return [
    e.kind,
    e.field ?? '',
    e.date ?? '',
    e.columnId ?? '',
    e.columnSetId ?? '',
    e.piece === null ? '' : String(e.piece),
    e.text ?? '',
  ].join('|');
}

/** Ursache und nächster Schritt eines Rückfallereignisses (UI-Richtlinie 12 «P8»). */
function messageOf(
  plan: Plan,
  week: Week,
  e: PageFallbackEvent,
  min: number,
): { title: string; cause: string; nextStep: string } {
  const entry = e.entryId === null ? undefined : plan.entries[e.entryId];
  const title = entry === undefined ? '' : entryTitle(plan, entry);
  const day = e.date === null ? '' : dayText(e.date);
  switch (e.kind) {
    case 'bandOverflow':
      return {
        title,
        cause: `Am ${day} haben im Band höchstens zwei Querbalken Platz; «${title}» wird dort nicht gezeichnet.`,
        nextStep: 'Einen Querbalken auf andere Tage kürzen oder als Bemerkung erfassen.',
      };
    case 'bandNoCommonLane':
      return {
        title,
        cause: `«${title}» hat an seinen Tagen keine gemeinsame Lage im Band und wird auf dieser Seite nicht gezeichnet.`,
        nextStep: 'Einen Querbalken auf andere Tage kürzen oder als Bemerkung erfassen.',
      };
    case 'tooManyColumns':
      return {
        title: `Spaltensatz ${day}`,
        cause: `Zu viele Spalten für den ${day}: Nicht alle Spaltenköpfe passen auch mit ${size(min)} in ihre Spalte.`,
        nextStep:
          'Spalten schmaler stellen, zusammenfassen oder auf einen anderen Spaltensatz wechseln.',
      };
    case 'continuationPage':
      return {
        title: e.region === 'agenda' ? 'Termine' : 'Seitenleiste',
        cause: `${e.region === 'agenda' ? 'Die Termine' : 'Die Seitenleiste'} von ${week.shortName} ${e.region === 'agenda' ? 'passen' : 'passt'} auch mit ${size(min)} nicht auf die Seite. Das PDF erhält die Zusatzseite «Fortsetzung – ${week.shortName}».`,
        nextStep: 'Texte kürzen oder Einträge auf andere Tage bzw. Wochen verteilen.',
      };
    case 'labelOutside':
      if (entry === undefined)
        return {
          title: FIELD.abbreviation,
          cause: `Das Kürzel «${e.text ?? ''}» der Kürzelliste von ${week.shortName} passt auch mit ${size(min)} nicht in die Kürzelspalte; es steht im PDF vollständig und ragt in die Spalte der Bedeutung.`,
          nextStep: 'Das Kürzel kürzen und die Bedeutung ausschreiben.',
        };
      return {
        title,
        cause: `Nummer bzw. Kürzel von «${title}» passt auch mit ${size(min)} nicht ins Kästchen und steht im PDF daneben.`,
        nextStep: 'Das Kästchen verlängern oder Platz neben dem Kästchen freimachen.',
      };
    default:
      break;
  }
  if (entry !== undefined) {
    const what = `Text von «${title}»`;
    if (e.kind === 'lineDropped')
      return {
        title,
        cause: `${what} passt auch mit ${size(min)} nicht.${subtaskNote(e.dropped)} Im PDF entfallen ${droppedText(e.dropped)}.`,
        nextStep: 'Titel kürzen, Block vergrössern oder Zusatzzeilen entfernen.',
      };
    if (e.kind === 'textOmitted')
      return {
        title,
        cause: `${what} hat auch mit ${size(min)} keinen Platz und entfällt im PDF.`,
        nextStep: 'Titel kürzen oder den Eintrag vergrössern.',
      };
    return {
      title,
      cause: `${what} passt auch mit ${size(min)} nicht. Im PDF mit «…» gekürzt.${e.dropped.includes('subtaskTitle') ? ' Teilaufgaben entfallen.' : ''}`,
      nextStep: 'Titel kürzen, Block vergrössern oder Zusatzzeilen entfernen.',
    };
  }
  const field =
    e.field === null
      ? 'Ein Text'
      : e.field === 'columnHead' && e.columnId !== null
        ? `Spaltenkopf «${columnName(plan, e.columnId) ?? ''}»${day === '' ? '' : ` am ${day}`}`
        : FIELD[e.field];
  return {
    title: field,
    cause: `${field} passt auch mit ${size(min)} nicht. Im PDF gekürzt.`,
    nextStep: 'Text kürzen.',
  };
}

/** Befunde P8 einer Woche aus den Rückfallereignissen ihres Layouts; doppelte Schlüssel einmal. */
export function checkP8(
  plan: Plan,
  week: Week,
  layout: WeekPageLayout,
  minSizePt: number,
): RawFinding[] {
  const out: RawFinding[] = [];
  const seen = new Set<string>();
  for (const e of layout.fallbacks) {
    const key = `P8|${week.id}|${e.entryId ?? e.region}|${eventDetail(e)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const m = messageOf(plan, week, e, minSizePt);
    const entry = e.entryId === null ? undefined : plan.entries[e.entryId];
    const minute = entry === undefined ? null : entryMinute(entry);
    out.push({
      key,
      rule: 'P8',
      severity: RULE_SEVERITY.P8,
      weekId: week.id,
      date: e.date,
      entryId: entry === undefined ? null : e.entryId,
      region: e.region,
      sortMinute: minute,
      place: placeOf(e.date, minute) || week.shortName,
      title: m.title,
      message: { cause: m.cause, nextStep: m.nextStep },
    });
  }
  return out;
}
