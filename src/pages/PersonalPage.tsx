// biome-ignore-all lint/suspicious/noArrayIndexKey: List rows and cells are a fixed, derived, non-reorderable schema.
import { useState } from 'react';
import { copyText } from '../components/CopyButton';
import { Icon } from '../components/Icon';
import { pickLocalFile } from '../components/projectActions';
import { download } from '../io/exports';
import { displayDate } from '../io/text';
import { XLSX } from '../io/workbook';
import {
  addDays,
  daysBetween,
  dienstvollender,
  fahrerliste,
  geburtstage,
  isIsoDate,
  listName,
  type NachfuehrungStatus,
  nzlInfo,
  sortByRank,
  today,
  verfuegbarkeit,
  wacheNachfuehrung,
  zuteilungskonflikte,
} from '../model';
import type { Person, Project } from '../model/types';
import { changeProject, notify, useProject } from '../store';
import './pages.css';
import './personal.css';

type Tab = 'dienstvollender' | 'geburtstage' | 'fahrer' | 'verfuegbarkeit' | 'wache';
const TABS: { key: Tab; label: string; icon: 'flag' | 'calendar' | 'map' | 'users' | 'shield' }[] =
  [
    { key: 'dienstvollender', label: 'Dienstvollender', icon: 'flag' },
    { key: 'geburtstage', label: 'Geburtstage', icon: 'calendar' },
    { key: 'fahrer', label: 'Fahrer', icon: 'map' },
    { key: 'verfuegbarkeit', label: 'Verfügbarkeit', icon: 'users' },
    { key: 'wache', label: 'Wache → MILO', icon: 'shield' },
  ];

/** One derived list: the table on screen, the print, the Excel file and the text agree. */
interface ListSheet {
  title: string;
  fileStem: string;
  note: string;
  columns: string[];
  rows: string[][];
}

const label = (person: Person) => [person.grad, listName(person)].filter(Boolean).join(' ');
function fileStem(project: Project, title: string, day: string): string {
  return [title, project.stamm.einheit || project.name, day]
    .join('_')
    .replace(/[^\wÄÖÜäöü-]+/g, '_')
    .replace(/_+/g, '_');
}
function standNote(project: Project, heute: string): string {
  const stand = project.milo?.stand;
  if (!stand) return 'Noch kein MILO-Stand';
  const age = daysBetween(stand, heute);
  return `Stand MILO ${displayDate(stand)}${age > 0 ? ` (${age} Tag${age === 1 ? '' : 'e'} out of date)` : ''}`;
}

let printing: (() => void) | undefined;
function printSheet(sheet: ListSheet): void {
  printing?.();
  const root = document.documentElement,
    previousTitle = document.title;
  root.classList.add('personal-print');
  document.title = sheet.fileStem;
  const cleanup = () => {
    if (printing !== cleanup) return;
    printing = undefined;
    window.removeEventListener('afterprint', cleanup);
    root.classList.remove('personal-print');
    document.title = previousTitle;
  };
  printing = cleanup;
  window.addEventListener('afterprint', cleanup);
  try {
    window.print();
  } catch {
    cleanup();
  }
}
function exportSheet(sheet: ListSheet): void {
  const table = XLSX.utils.aoa_to_sheet([
    [sheet.title],
    [sheet.note],
    [],
    sheet.columns,
    ...sheet.rows,
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, table, sheet.title.slice(0, 31));
  download(
    `${sheet.fileStem}.xlsx`,
    XLSX.write(book, { bookType: 'xlsx', type: 'array' }),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
function sheetText(sheet: ListSheet): string {
  return [
    sheet.title,
    sheet.note,
    '',
    sheet.columns.join('\t'),
    ...sheet.rows.map((row) => row.join('\t')),
  ].join('\n');
}

function SheetView({ sheet, empty }: { sheet: ListSheet; empty: string }) {
  return (
    <section className="card personal-output">
      <div className="toolbar no-print">
        <span className="muted grow">
          {sheet.rows.length} Einträge · {sheet.note}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!sheet.rows.length}
          onClick={() => printSheet(sheet)}
        >
          <Icon name="printer" size={15} /> Drucken / PDF
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!sheet.rows.length}
          onClick={() => {
            exportSheet(sheet);
            notify('Excel-Liste lokal gespeichert.', { tone: 'success' });
          }}
        >
          <Icon name="sheet" size={15} /> Excel
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!sheet.rows.length}
          onClick={async () => {
            if (await copyText(sheetText(sheet)))
              notify('Liste als Text in die Zwischenablage kopiert.', { tone: 'success' });
          }}
        >
          <Icon name="copy" size={15} /> Text
        </button>
      </div>
      <div className="personal-sheet">
        <h3 className="personal-sheet-title">{sheet.title}</h3>
        <p className="personal-sheet-note">{sheet.note}</p>
        {sheet.rows.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {sheet.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">{empty}</p>
        )}
      </div>
    </section>
  );
}

function DayField({
  value,
  onChange,
  text,
}: {
  value: string;
  onChange: (day: string) => void;
  text: string;
}) {
  return (
    <label className="field personal-day">
      {text}
      <input
        type="date"
        value={value}
        onChange={(event) => isIsoDate(event.target.value) && onChange(event.target.value)}
      />
    </label>
  );
}

export default function PersonalPage() {
  const project = useProject();
  const [tab, setTab] = useState<Tab>('dienstvollender');
  const heute = today();
  const stand = project.milo?.stand ?? '';
  const age = stand ? daysBetween(stand, heute) : 0;
  const inService =
    isIsoDate(project.service.start) &&
    heute >= project.service.start &&
    (!isIsoDate(project.service.end) || heute <= project.service.end);
  const archived = Boolean(project.archive);
  const lists = project.milo?.listen ?? {};
  return (
    <div className="page page-wide personal-page">
      <section className="page-intro no-print">
        <div>
          <h2>Personal und MILO-Abgleich</h2>
          <p>
            MILO ist die Hauptquelle. Während des Dienstes täglich die MILO-Listen lokal abgleichen;
            die Listen hier entstehen nur aus diesem Stand. Die Dateien werden ausschliesslich in
            diesem Browser gelesen.
          </p>
        </div>
      </section>
      {inService && (!stand || age > 0) && (
        <div className="callout callout-warning no-print" role="status">
          <Icon name="alert" />
          <div className="callout-body">
            <strong>
              {stand
                ? `MILO-Stand von ${displayDate(stand)} – ${age} Tag${age === 1 ? '' : 'e'} out of date.`
                : 'Noch kein MILO-Stand für diesen Dienst.'}
            </strong>{' '}
            Bitte die Bestandesliste aus MILO abgleichen. Bis dahin rechnet die App die NZL selbst
            weiter.
          </div>
        </div>
      )}
      <section className="card card-pad personal-sources no-print" aria-label="MILO-Listen">
        <div className="personal-source">
          <strong>Bestandesliste / Personal</strong>
          <span className="muted">
            {stand ? `Stand ${displayDate(stand)}` : 'Noch nicht abgeglichen'}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={archived}
            onClick={() => pickLocalFile('milo')}
          >
            <Icon name="upload" size={15} /> Abgleichen
          </button>
        </div>
        <div className="personal-source">
          <strong>Urlaube</strong>
          <span className="muted">
            {lists.urlaub
              ? `${lists.urlaub.anz} Einträge · ${new Date(lists.urlaub.zeit).toLocaleDateString('de-CH')}`
              : 'Noch nicht geladen'}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={archived}
            onClick={() => pickLocalFile('urlaub')}
          >
            <Icon name="upload" size={15} /> Abgleichen
          </button>
        </div>
        <div className="personal-source">
          <strong>Kommandierungen</strong>
          <span className="muted">
            {lists.kommandierung
              ? `${lists.kommandierung.anz} Einträge · ${new Date(lists.kommandierung.zeit).toLocaleDateString('de-CH')}`
              : 'Noch nicht geladen'}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={archived}
            onClick={() => pickLocalFile('kommandierung')}
          >
            <Icon name="upload" size={15} /> Abgleichen
          </button>
        </div>
      </section>
      <div className="segmented no-print" role="tablist" aria-label="Standardlisten">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            <Icon name={item.icon} size={15} /> {item.label}
          </button>
        ))}
      </div>
      {tab === 'dienstvollender' && <DienstvollenderTab project={project} heute={heute} />}
      {tab === 'geburtstage' && <GeburtstageTab project={project} heute={heute} />}
      {tab === 'fahrer' && <FahrerTab project={project} heute={heute} />}
      {tab === 'verfuegbarkeit' && <VerfuegbarkeitTab project={project} heute={heute} />}
      {tab === 'wache' && <WacheTab project={project} heute={heute} />}
    </div>
  );
}

function DienstvollenderTab({ project, heute }: { project: Project; heute: string }) {
  const entries = dienstvollender(project, heute);
  const stale = project.persons.filter(
    (person) => (nzlInfo(project, person, heute)?.veraltetTage ?? 0) > 0,
  ).length;
  const sheet: ListSheet = {
    title: 'Dienstvollender',
    fileStem: fileStem(project, 'Dienstvollender', heute),
    note: standNote(project, heute),
    columns: [
      'Grad Name',
      'Funktion',
      'Zug',
      'NZL MILO',
      'NZL heute',
      'Letzter Diensttag',
      'Dienstvollend ab',
      'Status',
    ],
    rows: entries.map(({ person, info }) => [
      label(person),
      person.funktion,
      person.zug ?? '',
      `${info.milo} (${displayDate(info.stand)})`,
      info.veraltetTage > 0
        ? `${info.heute} · ${info.veraltetTage} T out of date`
        : String(info.heute),
      displayDate(info.letzterDiensttag),
      displayDate(info.dienstvollendAb),
      heute >= info.dienstvollendAb ? 'nicht mehr dienstpflichtig' : 'Prognose',
    ]),
  };
  return (
    <>
      {stale > 0 && (
        <p className="muted no-print">
          Bei {stale} Personen ist die NZL seit dem MILO-Stand von der App weitergerechnet (jeder
          Diensttag zählt). Mit dem nächsten MILO-Abgleich gilt wieder der MILO-Wert.
        </p>
      )}
      <SheetView sheet={sheet} empty="Niemand erreicht die NZL innerhalb dieses Dienstes." />
    </>
  );
}

function GeburtstageTab({ project, heute }: { project: Project; heute: string }) {
  const start = isIsoDate(project.service.start) ? project.service.start : heute;
  const end =
    isIsoDate(project.service.end) && project.service.end >= start
      ? project.service.end
      : addDays(start, 30);
  const [von, setVon] = useState(start),
    [bis, setBis] = useState(end);
  const entries = geburtstage(project, von, bis);
  const sheet: ListSheet = {
    title: 'Geburtstage',
    fileStem: fileStem(project, 'Geburtstage', von),
    note: `${displayDate(von)} – ${displayDate(bis)}`,
    columns: ['Datum', 'Grad Name', 'Zug', 'Funktion', 'wird'],
    rows: entries.map(({ person, datum, alter }) => [
      `${new Date(`${datum}T12:00:00Z`).toLocaleDateString('de-CH', { weekday: 'short' })} ${displayDate(datum)}`,
      label(person),
      person.zug ?? '',
      person.funktion,
      String(alter),
    ]),
  };
  const missing = project.persons.filter((person) => !person.geburtsdatum).length;
  return (
    <>
      <div className="form-grid no-print">
        <DayField text="Von" value={von} onChange={setVon} />
        <DayField text="Bis" value={bis} onChange={setBis} />
      </div>
      {missing > 0 && (
        <p className="muted no-print">
          {missing} Personen ohne Geburtsdatum – in der MILO-Liste die Spalte «Geburtsdatum»
          zuordnen.
        </p>
      )}
      <SheetView sheet={sheet} empty="Keine Geburtstage in diesem Zeitraum." />
    </>
  );
}

function FahrerTab({ project, heute }: { project: Project; heute: string }) {
  const [day, setDay] = useState(heute),
    [showAll, setShowAll] = useState(false);
  const { verfuegbar, nichtVerfuegbar } = fahrerliste(project, day, heute);
  const order = (list: typeof verfuegbar) => {
    const sorted = sortByRank(list.map((entry) => entry.person));
    return sorted.map(
      (person) => list.find((entry) => entry.person.id === person.id) as (typeof list)[number],
    );
  };
  const rows = [...order(verfuegbar), ...(showAll ? order(nichtVerfuegbar) : [])];
  const unknown = verfuegbar.filter((entry) => entry.verfuegbarkeit.statusUnbekannt).length;
  const sheet: ListSheet = {
    title: 'Fahrerliste',
    fileStem: fileStem(project, 'Fahrerliste', day),
    note: `Stichtag ${displayDate(day)} · ${standNote(project, heute)}`,
    columns: ['Grad Name', 'Kategorien', 'Zug', 'Mobiltelefon', ...(showAll ? ['Verfügbar'] : [])],
    rows: rows.map((entry) => [
      label(entry.person),
      entry.kategorien.join(', '),
      entry.person.zug ?? '',
      entry.person.tel ?? '',
      ...(showAll ? [entry.verfuegbarkeit.grund || 'ja'] : []),
    ]),
  };
  return (
    <>
      <div className="form-grid no-print">
        <DayField text="Stichtag" value={day} onChange={setDay} />
        <label className="check">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
          />
          Nicht verfügbare Fahrer mit Grund anzeigen ({nichtVerfuegbar.length})
        </label>
      </div>
      {unknown > 0 && (
        <p className="muted no-print">
          {unknown} Fahrer ohne Status aus der Bestandesliste; sie gelten als verfügbar, bis MILO
          etwas anderes meldet.
        </p>
      )}
      <SheetView sheet={sheet} empty="Keine verfügbaren Fahrer an diesem Tag." />
    </>
  );
}

function VerfuegbarkeitTab({ project, heute }: { project: Project; heute: string }) {
  const [day, setDay] = useState(heute);
  const away = sortByRank(project.persons.filter((person) => person.planning.status !== 'excluded'))
    .map((person) => ({ person, state: verfuegbarkeit(project, person, day, heute) }))
    .filter((entry) => entry.state.status !== 'verfuegbar');
  const conflicts = zuteilungskonflikte(project, heute);
  const missing = project.persons.filter((person) => person.nichtInMilo);
  const sheet: ListSheet = {
    title: 'Nicht verfügbar',
    fileStem: fileStem(project, 'Nicht_verfuegbar', day),
    note: `Stichtag ${displayDate(day)} · ${standNote(project, heute)}`,
    columns: ['Grad Name', 'Zug', 'Grund'],
    rows: away.map(({ person, state }) => [label(person), person.zug ?? '', state.grund]),
  };
  return (
    <>
      <div className="form-grid no-print">
        <DayField text="Stichtag" value={day} onChange={setDay} />
      </div>
      {conflicts.length > 0 && (
        <div className="callout callout-warning no-print">
          <Icon name="alert" />
          <div className="callout-body">
            <strong>{conflicts.length} Zuteilungen während Abwesenheit</strong>
            <ul>
              {conflicts.map((item) => (
                <li key={`${item.det.id}-${item.person.id}`}>
                  {label(item.person)} · {item.det.name || 'Detachement'} · ab{' '}
                  {displayDate(item.tag)}: {item.verfuegbarkeit.grund}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div className="callout callout-info no-print">
          <Icon name="info" />
          <div className="callout-body">
            <strong>{missing.length} Personen nicht mehr in MILO</strong> – nur markiert, nicht
            gelöscht: {missing.map(label).join(', ')}
          </div>
        </div>
      )}
      <SheetView sheet={sheet} empty="An diesem Tag sind alle verfügbar." />
    </>
  );
}

const NACHFUEHRUNG: Record<NachfuehrungStatus, string> = {
  offen: 'in MILO kommandieren',
  'in-milo': 'in MILO erfasst',
  'nur-in-milo': 'nur in MILO (nicht geplant)',
};

function WacheTab({ project, heute }: { project: Project; heute: string }) {
  const archived = Boolean(project.archive);
  const items = wacheNachfuehrung(project);
  const dets = [...project.dets].sort(
    (a, b) =>
      Number(/wach/i.test(b.name)) - Number(/wach/i.test(a.name)) || a.name.localeCompare(b.name),
  );
  const open = items.filter((item) => item.status === 'offen').length;
  const sheet: ListSheet = {
    title: 'Wache – MILO-Nachführung',
    fileStem: fileStem(project, 'Wache_MILO', heute),
    note: project.milo?.listen.kommandierung
      ? `Abgeglichen mit Kommandierungsliste vom ${new Date(project.milo.listen.kommandierung.zeit).toLocaleDateString('de-CH')}`
      : 'Noch keine Kommandierungsliste aus MILO abgeglichen',
    columns: ['Grad Name', 'Detachement', 'Von', 'Bis', 'MILO'],
    rows: items.map((item) => [
      label(item.person),
      item.det?.name ?? '—',
      displayDate(item.von),
      displayDate(item.bis),
      NACHFUEHRUNG[item.status],
    ]),
  };
  return (
    <>
      <section className="card card-pad no-print" aria-label="Wachdetachemente">
        <h3 className="section-title">Welche Detachemente sind Wache?</h3>
        <p className="muted">
          Die Personen markierter Detachemente müssen in MILO als Kommandierung erfasst werden. Die
          App überträgt nichts an MILO; die Liste unten dient zum Nachführen von Hand.
        </p>
        {dets.length ? (
          <div className="option-list">
            {dets.map((det) => (
              <label className="check" key={det.id}>
                <input
                  type="checkbox"
                  disabled={archived}
                  checked={Boolean(det.miloKommandierung)}
                  onChange={(event) =>
                    changeProject((draft) => {
                      const target = draft.dets.find((item) => item.id === det.id);
                      if (!target) return;
                      if (event.target.checked) target.miloKommandierung = true;
                      else delete target.miloKommandierung;
                    })
                  }
                />
                {det.name || 'Detachement ohne Namen'}
                <span className="muted">
                  {det.datum
                    ? ` · ${displayDate(det.datum)}–${displayDate(det.bisDatum || det.datum)}`
                    : ' · Datum offen'}
                  {/wach/i.test(det.name) && !det.miloKommandierung
                    ? ' · Name enthält «Wache»'
                    : ''}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">Noch keine Detachemente geplant.</p>
        )}
      </section>
      {open > 0 && (
        <p className="muted no-print">
          {open} Kommandierungen noch in MILO erfassen. Nach dem Erfassen die Kommandierungsliste
          aus MILO abgleichen; erfasste Einträge erscheinen dann als «in MILO erfasst».
        </p>
      )}
      <SheetView sheet={sheet} empty="Keine Wachdetachemente markiert." />
    </>
  );
}
