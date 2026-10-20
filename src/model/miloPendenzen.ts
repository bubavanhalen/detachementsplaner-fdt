import { wacheNachfuehrung } from './milo';
import { listName } from './onsite';
import { type Pendenz, type PendenzFields, pendenzenOf, upsertPendenz } from './pendenzen';
import type { Project } from './types';

// Guard commands still to enter in MILO become Pendenzen (kanal 'milo'), so they are
// ticked off in the one Pendenzen list. The comparison opens and closes them, always
// with the status it last saw: a status the user set differently becomes a proposal.

export const MILO_AGENT = 'MILO-Abgleich';
const BY = { autor: 'agent' as const, agent: MILO_AGENT };
const PREFIX = 'In MILO kommandieren: ';

export interface WacheSyncResult {
  neu: number;
  geaendert: number;
  vorschlaege: number;
}

function show(value: string): string {
  const [year, month, day] = value.split('-');
  return day ? `${day}.${month}.${year}` : value;
}
/** The last status change in the history, and whether this comparison made it. */
function lastStatus(pendenz: Pendenz): { am: string; ours: boolean } {
  const entry = [...pendenz.verlauf].reverse().find((item) => item.text.includes('Status:'));
  return entry
    ? { am: entry.am, ours: entry.agent === MILO_AGENT }
    : { am: pendenz.erstellt, ours: pendenz.erstelltVon === 'agent' };
}
function wacheRef(pendenz: Pendenz): string | undefined {
  return pendenz.quellen.find((item) => item.kanal === 'milo' && item.ref.startsWith('wache:'))
    ?.ref;
}

/** Brings the Wache Pendenzen in line with the plan and the last MILO command list. */
export function syncWachePendenzen(
  project: Project,
  now = new Date().toISOString(),
): WacheSyncResult {
  const result: WacheSyncResult = { neu: 0, geaendert: 0, vorschlaege: 0 };
  const listed = project.milo?.listen.kommandierung?.zeit ?? '';
  const count = (outcome: ReturnType<typeof upsertPendenz>) => {
    if (!outcome) return;
    if (outcome.status === 'neu') result.neu++;
    if (outcome.status === 'geaendert') result.geaendert++;
    if (outcome.vorschlag.length) result.vorschlaege++;
  };
  const wanted = new Set<string>();
  for (const item of wacheNachfuehrung(project)) {
    if (!item.det) continue;
    wanted.add(item.ref);
    const name = [item.person.grad, listName(item.person)].filter(Boolean).join(' ');
    const dates = item.von
      ? item.bis && item.bis !== item.von
        ? `${show(item.von)}–${show(item.bis)}`
        : show(item.von)
      : 'Datum offen';
    const titel = `${PREFIX}${name}, ${item.det.name || 'Wache'} ${dates}`;
    const quelle = { kanal: 'milo' as const, ref: item.ref, von: '', am: '', betreff: '' };
    const existing = pendenzenOf(project).find((pendenz) => wacheRef(pendenz) === item.ref);
    if (!existing) {
      count(
        upsertPendenz(
          project,
          {
            quelle,
            felder: {
              titel,
              personIds: [item.person.id],
              detIds: [item.det.id],
              faellig: item.von,
              status: item.status === 'in-milo' ? 'erledigt' : 'offen',
              tags: ['MILO', 'Wache'],
            },
            notiz:
              item.status === 'in-milo'
                ? 'In der MILO-Kommandierungsliste bereits vorhanden.'
                : 'Wachdetachement geplant; Kommandierung in MILO erfassen.',
          },
          BY,
          now,
        ),
      );
      continue;
    }
    const felder: PendenzFields = {},
      vorher: PendenzFields = {};
    let notiz = '';
    // Title and due date follow the plan while the user has not reworded the Pendenz.
    if (existing.titel.startsWith(PREFIX)) {
      felder.titel = titel;
      vorher.titel = existing.titel;
      felder.faellig = item.von;
      vorher.faellig = existing.faellig;
    }
    const last = lastStatus(existing);
    if (item.status === 'in-milo' && existing.status !== 'erledigt') {
      if (existing.status !== 'verworfen' || last.ours) {
        felder.status = 'erledigt';
        vorher.status = existing.status === 'verworfen' ? 'verworfen' : 'offen';
        notiz = 'In der MILO-Kommandierungsliste gefunden.';
      }
    } else if (item.status === 'offen') {
      if (existing.status === 'erledigt' && listed && listed > last.am) {
        felder.status = 'offen';
        vorher.status = 'erledigt';
        notiz = `Abgehakt, aber in der MILO-Kommandierungsliste vom ${show(listed.slice(0, 10))} nicht gefunden.`;
      } else if (existing.status === 'verworfen' && last.ours) {
        felder.status = 'offen';
        vorher.status = 'verworfen';
        notiz = 'Wieder nötig: wieder als Wache eingeteilt.';
      }
    }
    count(upsertPendenz(project, { id: existing.id, felder, vorher, notiz }, BY, now));
  }
  // A guard assignment that disappeared is no longer needed; the Pendenz stays for the record.
  for (const pendenz of pendenzenOf(project)) {
    const ref = wacheRef(pendenz);
    if (!ref || wanted.has(ref) || (pendenz.status !== 'offen' && pendenz.status !== 'wartet'))
      continue;
    count(
      upsertPendenz(
        project,
        {
          id: pendenz.id,
          felder: { status: 'verworfen' },
          vorher: { status: 'offen' },
          notiz: 'Nicht mehr nötig: Zuteilung oder Wachmarkierung entfernt.',
        },
        BY,
        now,
      ),
    );
  }
  return result;
}

/** The Pendenz of one guard command, for showing its status next to the list. */
export function wachePendenz(project: Project, ref: string): Pendenz | undefined {
  return pendenzenOf(project).find((pendenz) => wacheRef(pendenz) === ref);
}
