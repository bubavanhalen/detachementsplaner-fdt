// Tagesbefehle page with wholly fictional persons, WAP entries and file bytes.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import {
  moveEntry,
  previousWeek,
  relocateEntry,
  reviewBuckets,
  suggestFirstNumber,
  suggestStartDate,
  weekFromParse,
} from '../src/components/tagesbefehl/weekTools';
import { bundleHtml } from '../src/io/exports';
import {
  clearTbAssets,
  createTbAsset,
  normalizeTbAssets,
  readTbAssets,
  saveTbAssets,
  seedTbAssets,
  TB_ASSETS_KEY,
} from '../src/io/tagesbefehl/assets';
import { createProject, normalizeProject } from '../src/model';
import {
  createTbState,
  emptyWeek,
  type TbAssets,
  type TbState,
  type WapParseResult,
} from '../src/model/tagesbefehl';
import type { Person, Project } from '../src/model/types';
import TagesbefehlePage from '../src/pages/TagesbefehlePage';
import { projectStore } from '../src/store';

const mocks = vi.hoisted(() => ({
  listWapSheets: vi.fn(),
  parseWap: vi.fn(),
  buildXlsx: vi.fn(),
  buildPdfZip: vi.fn(),
  buildDayPdf: vi.fn(),
  download: vi.fn(),
  prepareSignature: vi.fn(),
}));
vi.mock('../src/io/wap', () => ({
  listWapSheets: mocks.listWapSheets,
  parseWap: mocks.parseWap,
}));
vi.mock('../src/io/exports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/io/exports')>()),
  download: mocks.download,
}));
vi.mock('../src/io/tagesbefehl/xlsx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/io/tagesbefehl/xlsx')>()),
  buildTagesbefehlXlsx: mocks.buildXlsx,
}));
vi.mock('../src/io/tagesbefehl/pdf', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/io/tagesbefehl/pdf')>()),
  buildPdfZip: mocks.buildPdfZip,
  buildDayPdf: mocks.buildDayPdf,
}));
vi.mock('../src/io/tagesbefehl/template', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/io/tagesbefehl/template')>()),
  extractTemplateLogos: () => [],
}));
vi.mock('../src/io/tagesbefehl/signature', () => ({
  prepareSignature: mocks.prepareSignature,
}));

const UNIT = 'Fiktiv Kp 99/9';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]);

function fictionalParse(sheet: string): WapParseResult {
  return {
    sheet,
    startDate: sheet === 'KVK' ? '2030-01-07' : '',
    days: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    entries: [
      {
        id: `${sheet}-mo-1`,
        day: 'Mo',
        section: 'dienstbetrieb',
        group: '',
        zeit: '0600',
        taetigkeit: 'Tagwache',
        verantwortlich: '',
        ort: '',
        source: { kind: 'box', rawText: 'Tagwache', rawStart: 598, rawEnd: 603, leitung: 'kp' },
      },
      {
        id: `${sheet}-mo-2`,
        day: 'Mo',
        section: 'dienstbetrieb',
        group: 'Zug Fiktiv',
        zeit: '0800 - 1100',
        taetigkeit: 'Fiktive Ausbildung',
        verantwortlich: 'Zfhr Fiktiv',
        ort: 'Übungsplatz Nirgendwo',
        source: {
          kind: 'box',
          rawText: 'Fiktive Ausbildung / Ltg: Zfhr Fiktiv',
          flags: ['Zeit aus Position'],
        },
      },
      {
        id: `${sheet}-di-1`,
        day: 'Di',
        section: 'besonderes',
        group: '',
        zeit: '1000',
        taetigkeit: 'Fiktiver Besuch',
        verantwortlich: 'Extern Fiktiv',
        ort: 'Ukft',
      },
      {
        id: `${sheet}-di-2`,
        day: 'Di',
        section: 'rapporte',
        group: '',
        zeit: '1700',
        taetigkeit: 'KR',
        verantwortlich: '',
        ort: '',
      },
    ],
    groups: { Mo: ['Zug Fiktiv'] },
    conflicts: [
      {
        id: `${sheet}-c1`,
        day: 'Di',
        type: 'overlap',
        message: 'Fiktive Überschneidung am Dienstag',
        entryIds: [`${sheet}-di-2`],
      },
    ],
    notes: { wochenziele: ['Fiktives Wochenziel'], bemerkungen: ['Fiktive Bemerkung'] },
    diagnostics: ['4 Felder erkannt'],
  };
}

function officer(id: string, grad: string, patch: Partial<Person> = {}): Person {
  return {
    id,
    name: `Fiktiv ${id}`,
    vorname: 'Test',
    nachname: `Fiktiv${id.toUpperCase()}`,
    grad,
    funktion: 'Zugführer',
    lics: [],
    raw: {},
    einteilung: UNIT,
    tel: '+41 00 000 00 00',
    planning: { status: 'included', reason: '' },
    ...patch,
  };
}

function projectWithWeek(patch: (tb: TbState) => void = () => {}): Project {
  const project = createProject();
  project.settings.eigeneEinheit = UNIT;
  project.persons = [
    officer('a', 'Lt'),
    officer('b', 'Oblt'),
    officer('c', 'Lt'),
    officer('kdt', 'Hptm', { funktion: 'Kommandant' }),
  ];
  const tb = createTbState();
  tb.wochen.KVK = weekFromParse(tb, fictionalParse('KVK'), 'fiktiver-wap.xlsx');
  patch(tb);
  project.tb = tb;
  return project;
}

function storeTemplateAndSignature(): TbAssets {
  return saveTbAssets({
    template: createTbAsset('fiktive-vorlage.xlsx', ZIP_BYTES),
    signature: createTbAsset('fiktive-unterschrift.png', PNG_BYTES),
  });
}

function memoryStorage(failOnWrite = false): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      if (failOnWrite) throw new DOMException('Voll', 'QuotaExceededError');
      data.set(key, String(value));
    },
  };
}

const tbOf = (): TbState => projectStore.get().tb as TbState;
const stepper = () => within(screen.getByRole('navigation', { name: 'Schritte' }));
async function openStep(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  await user.click(stepper().getByRole('button', { name: label }));
}

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open');
    },
  });
  Object.defineProperty(window, 'print', { configurable: true, value: vi.fn() });
  // jsdom has no layout; the router restores scroll positions on navigation.
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
  mocks.listWapSheets.mockImplementation(() => ['KVK', 'Wo 1']);
  mocks.parseWap.mockImplementation(async (_bytes: Uint8Array, sheet: string) =>
    fictionalParse(sheet),
  );
  mocks.buildXlsx.mockImplementation(() => new Uint8Array([1, 2, 3]));
  mocks.buildPdfZip.mockImplementation(async () => new Uint8Array([4, 5]));
  mocks.buildDayPdf.mockImplementation(async () => new Uint8Array([6]));
  mocks.prepareSignature.mockImplementation(async (png: Uint8Array) => png);
});

describe('Tagesbefehle navigation and stepper', () => {
  it('is reachable from the main navigation', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => createProject());
    window.location.hash = '#/persons';
    render(<App />);
    await user.click(await screen.findByRole('link', { name: /^Tagesbefehle/ }));
    expect(
      await screen.findByRole('heading', { name: 'Vom Wochenplan zum Tagesbefehl.' }),
    ).toBeInTheDocument();
    window.location.hash = '#/';
  });

  it('opens an old project without tb, walks all steps and adds nothing by viewing', async () => {
    const user = userEvent.setup();
    const old = normalizeProject(createProject());
    projectStore.setState(() => old);
    render(<TagesbefehlePage />);
    expect(screen.getByRole('heading', { name: 'Vorlage & Unterschrift' })).toBeInTheDocument();
    expect(stepper().getByRole('button', { name: /Vorlage & Unterschrift/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await openStep(user, /WAP laden/);
    expect(screen.getByRole('heading', { name: 'WAP laden' })).toBeInTheDocument();
    await openStep(user, /Prüfen/);
    expect(screen.getByText('Noch keine Woche geladen.')).toBeInTheDocument();
    await openStep(user, /Tagesoffiziere/);
    expect(screen.getByRole('heading', { name: 'Tagesoffiziere' })).toBeInTheDocument();
    await openStep(user, /Ausgabe/);
    expect(screen.getByText('Noch keine Woche geladen.')).toBeInTheDocument();
    expect(projectStore.get()).toEqual(old);
    expect(projectStore.get().tb).toBeUndefined();
  });
});

describe('Vorlage & Unterschrift', () => {
  it('stores template and prepared signature once on this device', async () => {
    const user = userEvent.setup({ applyAccept: false });
    projectStore.setState(() => createProject());
    render(<TagesbefehlePage />);
    await user.upload(
      screen.getByLabelText('Vorlage (.xlsx) wählen'),
      new File([ZIP_BYTES], 'fiktive-vorlage.xlsx', { type: XLSX_MIME }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('tb-asset-template')).toHaveTextContent('fiktive-vorlage.xlsx'),
    );
    await user.upload(
      screen.getByLabelText('Unterschrift (PNG) wählen'),
      new File(['kein Bild'], 'fiktiv.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG-Datei');
    await user.upload(
      screen.getByLabelText('Unterschrift (PNG) wählen'),
      new File([PNG_BYTES], 'fiktive-unterschrift.png', { type: 'image/png' }),
    );
    expect(await screen.findByAltText('Gespeicherte Unterschrift')).toBeInTheDocument();
    expect(mocks.prepareSignature).toHaveBeenCalledOnce();
    const stored = readTbAssets();
    expect(stored.template?.name).toBe('fiktive-vorlage.xlsx');
    expect(stored.signature?.name).toBe('fiktive-unterschrift.png');
    // Binary assets never enter the project JSON.
    expect(JSON.stringify(projectStore.get())).not.toContain(stored.template?.base64 ?? '---');
  });

  it('edits the Tagesbefehl settings in the project with a commit on blur', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => projectWithWeek());
    render(<TagesbefehlePage />);
    const name = screen.getByLabelText('Name Kdt');
    expect(name).toHaveValue('');
    await user.type(name, 'Hptm Test Fiktiv');
    expect(tbOf().settings.kdtName).toBe('');
    await user.tab();
    expect(tbOf().settings.kdtName).toBe('Hptm Test Fiktiv');
    const zk = screen.getByLabelText('Verteiler «z K an»');
    await user.type(zk, 'Kdt Fiktiv Bat 99{Enter}{Enter}Fiktiv S3');
    await user.tab();
    expect(tbOf().settings.zK).toEqual(['Kdt Fiktiv Bat 99', 'Fiktiv S3']);
  });
});

describe('WAP laden', () => {
  it('parses a chosen sheet into a stored week and suggests numbering for the next week', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => createProject());
    render(<TagesbefehlePage />);
    await openStep(user, /WAP laden/);
    await user.upload(
      screen.getByLabelText('Kp-WAP (.xlsx) wählen'),
      new File([ZIP_BYTES], 'fiktiver-wap.xlsx', { type: XLSX_MIME }),
    );
    const sheet = await screen.findByRole('combobox', { name: 'Tabellenblatt' });
    expect(sheet).toHaveValue('KVK');
    await user.click(screen.getByRole('button', { name: 'Einlesen' }));
    expect(await screen.findByText('KVK: 4 Einträge an 7 Tagen erkannt.')).toBeInTheDocument();
    const kvk = tbOf().wochen.KVK;
    expect(kvk).toMatchObject({
      sourceFile: 'fiktiver-wap.xlsx',
      startDate: '2030-01-07',
      firstNumber: 1,
    });
    // Rule table filled the empty Tagwache fields.
    expect(kvk.entries[0]).toMatchObject({ verantwortlich: 'Zfhr / Einh Fw', ort: 'Ukft' });
    expect(mocks.parseWap).toHaveBeenCalledWith(expect.any(Uint8Array), 'KVK', {
      rules: createTbState().regeln,
    });

    await user.selectOptions(sheet, 'Wo 1');
    await user.click(screen.getByRole('button', { name: 'Einlesen' }));
    await waitFor(() => expect(tbOf().wochen['Wo 1']).toBeDefined());
    expect(tbOf().wochen['Wo 1']).toMatchObject({ startDate: '2030-01-14', firstNumber: 8 });
  });

  it('asks before overwriting a reviewed week and keeps per-week settings', async () => {
    const user = userEvent.setup();
    projectStore.setState(() =>
      projectWithWeek((tb) => {
        tb.wochen.KVK.entries[1].taetigkeit = 'Geprüfte Änderung';
        tb.wochen.KVK.officers.Mo = { personId: '', text: 'Lt Fiktiv Gast', tel: '' };
        tb.wochen.KVK.firstNumber = 5;
        tb.wochen.KVK.dismissedConflicts = ['KVK-c1'];
      }),
    );
    render(<TagesbefehlePage />);
    await openStep(user, /WAP laden/);
    await user.upload(
      screen.getByLabelText('Kp-WAP (.xlsx) wählen'),
      new File([ZIP_BYTES], 'fiktiver-wap.xlsx', { type: XLSX_MIME }),
    );
    const sheet = await screen.findByRole('combobox', { name: 'Tabellenblatt' });
    await user.selectOptions(sheet, 'KVK');
    await user.click(screen.getByRole('button', { name: 'Einlesen' }));
    const dialog = screen.getByRole('dialog', { name: 'Woche neu einlesen?' });
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(mocks.parseWap).not.toHaveBeenCalled();
    expect(tbOf().wochen.KVK.entries[1].taetigkeit).toBe('Geprüfte Änderung');

    await user.click(screen.getByRole('button', { name: 'Einlesen' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Woche neu einlesen?' })).getByRole('button', {
        name: 'Überschreiben',
      }),
    );
    await waitFor(() => expect(mocks.parseWap).toHaveBeenCalledOnce());
    await waitFor(() => expect(tbOf().wochen.KVK.entries[1].taetigkeit).toBe('Fiktive Ausbildung'));
    const kvk = tbOf().wochen.KVK;
    expect(kvk.officers.Mo?.text).toBe('Lt Fiktiv Gast');
    expect(kvk.firstNumber).toBe(5);
    expect(kvk.dismissedConflicts).toEqual([]);
  });

  it('shows a generic error when the workbook cannot be read', async () => {
    const user = userEvent.setup();
    mocks.listWapSheets.mockImplementation(() => {
      throw new Error('interne Details');
    });
    projectStore.setState(() => createProject());
    render(<TagesbefehlePage />);
    await openStep(user, /WAP laden/);
    await user.upload(
      screen.getByLabelText('Kp-WAP (.xlsx) wählen'),
      new File([ZIP_BYTES], 'fiktiver-wap.xlsx', { type: XLSX_MIME }),
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('konnte nicht als Kp-WAP (.xlsx) gelesen werden');
    expect(alert).not.toHaveTextContent('interne Details');
  });
});

describe('Prüfen', () => {
  it('edits an entry inline, updates the project and can be undone', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => projectWithWeek());
    render(<TagesbefehlePage />);
    await openStep(user, /Prüfen/);
    const field = screen.getByDisplayValue('Fiktive Ausbildung');
    const row = field.closest('tr') as HTMLElement;
    expect(row.getAttribute('title')).toContain('Fiktive Ausbildung / Ltg: Zfhr Fiktiv');
    expect(row.getAttribute('title')).toContain('Zeit aus Position');
    await user.clear(field);
    await user.type(field, 'Geänderte Übung');
    await user.tab();
    expect(tbOf().wochen.KVK.entries.find((e) => e.id === 'KVK-mo-2')?.taetigkeit).toBe(
      'Geänderte Übung',
    );
    await user.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(tbOf().wochen.KVK.entries.find((e) => e.id === 'KVK-mo-2')?.taetigkeit).toBe(
      'Fiktive Ausbildung',
    );
    expect(screen.getByDisplayValue('Fiktive Ausbildung')).toBeInTheDocument();
  });

  it('adds, moves, relocates and deletes entries', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => projectWithWeek());
    render(<TagesbefehlePage />);
    await openStep(user, /Prüfen/);
    await user.click(
      screen.getByRole('button', { name: 'Eintrag in «1 Dienstbetrieb / Ausbildung» hinzufügen' }),
    );
    const mondayGeneral = () =>
      tbOf().wochen.KVK.entries.filter(
        (e) => e.day === 'Mo' && e.section === 'dienstbetrieb' && !e.group,
      );
    expect(mondayGeneral()).toHaveLength(2);
    const added = mondayGeneral()[1];
    expect(added.source?.kind).toBe('manual');
    // The new row's first field has the focus for immediate typing.
    expect((document.activeElement as HTMLElement).closest('tr')?.dataset.entryId).toBe(added.id);
    await user.keyboard('0530');
    await user.tab();
    expect(mondayGeneral()[1].zeit).toBe('0530');

    const addedRow = screen.getByDisplayValue('0530').closest('tr') as HTMLElement;
    await user.click(within(addedRow).getByRole('button', { name: 'Nach oben' }));
    expect(mondayGeneral().map((e) => e.id)).toEqual([added.id, 'KVK-mo-1']);

    await user.selectOptions(
      within(addedRow).getByRole('combobox', { name: 'Abschnitt/Gruppe' }),
      '2 Besonderes',
    );
    expect(tbOf().wochen.KVK.entries.find((e) => e.id === added.id)?.section).toBe('besonderes');

    const movedRow = screen.getByDisplayValue('0530').closest('tr') as HTMLElement;
    await user.click(within(movedRow).getByRole('button', { name: 'Eintrag löschen' }));
    expect(tbOf().wochen.KVK.entries.some((e) => e.id === added.id)).toBe(false);
  });

  it('jumps from a conflict to its row, focuses it and stores the check mark', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => projectWithWeek());
    render(<TagesbefehlePage />);
    await openStep(user, /Prüfen/);
    expect(screen.getByRole('heading', { name: 'Montag', level: 2 })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Überschneidung: Fiktive Überschneidung am Dienstag' }),
    );
    expect(screen.getByRole('heading', { name: 'Dienstag', level: 2 })).toBeInTheDocument();
    const focused = document.activeElement as HTMLElement;
    expect(focused.closest('tr')?.dataset.entryId).toBe('KVK-di-2');
    expect(focused.closest('tr')).toHaveClass('tb-row-warn');
    await user.click(
      screen.getByRole('button', {
        name: 'Als geprüft markieren: Fiktive Überschneidung am Dienstag',
      }),
    );
    expect(tbOf().wochen.KVK.dismissedConflicts).toEqual(['KVK-c1']);
    expect(screen.getByText('Alle geprüft')).toBeInTheDocument();
    await user.click(screen.getByText('Geprüft (1)'));
    await user.click(
      screen.getByRole('button', { name: 'Wieder öffnen: Fiktive Überschneidung am Dienstag' }),
    );
    expect(tbOf().wochen.KVK.dismissedConflicts).toEqual([]);
  });

  it('takes a Bemerkung into Besonderes of the shown day and applies rules to empty fields', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => projectWithWeek());
    render(<TagesbefehlePage />);
    await openStep(user, /Prüfen/);
    await user.click(
      screen.getByRole('button', {
        name: 'In Besonderes am Montag übernehmen: Fiktive Bemerkung',
      }),
    );
    const taken = tbOf().wochen.KVK.entries.find((e) => e.taetigkeit === 'Fiktive Bemerkung');
    expect(taken).toMatchObject({ day: 'Mo', section: 'besonderes' });
    expect(
      screen.getByRole('button', { name: 'In Besonderes am Montag übernehmen: Fiktive Bemerkung' }),
    ).toBeDisabled();

    projectStore.setState((old) => {
      const next = structuredClone(old);
      const entry = next.tb?.wochen.KVK.entries.find((e) => e.id === 'KVK-di-2');
      if (entry) Object.assign(entry, { verantwortlich: '', ort: '' });
      return next;
    });
    await user.click(screen.getByText(/Standardregeln für Verantwortlich/));
    await user.click(screen.getByRole('button', { name: 'Regeln auf leere Felder anwenden' }));
    expect(tbOf().wochen.KVK.entries.find((e) => e.id === 'KVK-di-2')).toMatchObject({
      verantwortlich: 'Kp Kdt',
      ort: 'Rapportraum',
    });
  });

  it('keeps an archived week read-only', async () => {
    const user = userEvent.setup();
    const archived = projectWithWeek();
    archived.archive = { id: 'fiktiv-archiv', at: '2030-02-01T00:00:00.000Z' };
    projectStore.setState(() => archived);
    render(<TagesbefehlePage />);
    expect(screen.getByText(/Tagesbefehle sind schreibgeschützt/)).toBeInTheDocument();
    await openStep(user, /Prüfen/);
    expect(screen.getByDisplayValue('Fiktive Ausbildung')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Eintrag löschen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hinzufügen/ })).not.toBeInTheDocument();
  });
});

describe('Tagesoffiziere', () => {
  it('builds the rotation from eligible officers and applies a free-text override', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => projectWithWeek());
    render(<TagesbefehlePage />);
    await openStep(user, /Tagesoffiziere/);
    await user.click(screen.getByRole('button', { name: 'Alle berechtigten übernehmen (3)' }));
    expect(tbOf().offiziere).toEqual(['a', 'b', 'c']);
    expect(screen.getByTestId('tb-officer-Mo')).toHaveTextContent('Lt Test FiktivA');
    expect(screen.getByTestId('tb-officer-Di')).toHaveTextContent('Oblt Test FiktivB');

    await user.click(screen.getByRole('button', { name: 'Lt Test FiktivA nach unten' }));
    expect(tbOf().offiziere).toEqual(['b', 'a', 'c']);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tagesoffizier Mi' }),
      'Andere Person (Freitext)',
    );
    await user.type(screen.getByLabelText('Name Mi'), 'Lt Fiktiv Gast');
    await user.tab();
    expect(tbOf().wochen.KVK.officers.Mi).toEqual({
      personId: '',
      text: 'Lt Fiktiv Gast',
      tel: '',
    });
    expect(screen.getByTestId('tb-officer-Mi')).toHaveTextContent('Lt Fiktiv Gast');

    await user.type(screen.getByLabelText('Wochenend Wacht Of Sa'), 'Wacht Of Fiktiv Kp 11/1');
    await user.tab();
    expect(tbOf().wochen.KVK.wachtOf.Sa).toEqual(['Wacht Of Fiktiv Kp 11/1']);
  });
});

describe('Ausgabe', () => {
  it('disables outputs with a clear hint while the template is missing', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => projectWithWeek());
    render(<TagesbefehlePage />);
    await openStep(user, /Ausgabe/);
    expect(screen.getByRole('alert')).toHaveTextContent('Vorlage (.xlsx) fehlt');
    for (const name of ['Alle drucken', '.xlsx herunterladen', 'PDF je Tag herunterladen'])
      expect(screen.getByRole('button', { name })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'PDF 01_Mo.pdf herunterladen' })).toBeDisabled();
    // Open conflicts are labelled but do not block.
    expect(screen.getByText('1 Hinweis offen · Ausgabe trotzdem möglich')).toBeInTheDocument();
  });

  it('also requires a start date', async () => {
    const user = userEvent.setup();
    storeTemplateAndSignature();
    projectStore.setState(() =>
      projectWithWeek((tb) => {
        tb.wochen.KVK.startDate = '';
      }),
    );
    render(<TagesbefehlePage />);
    await openStep(user, /Ausgabe/);
    expect(screen.getByRole('alert')).toHaveTextContent('Startdatum (Montag) fehlt');
    expect(screen.getByRole('button', { name: '.xlsx herunterladen' })).toBeDisabled();
  });

  it('prints and downloads xlsx, the PDF zip and single-day PDFs locally', async () => {
    const user = userEvent.setup();
    storeTemplateAndSignature();
    projectStore.setState(() =>
      projectWithWeek((tb) => {
        tb.settings.kdtName = 'Hptm Test Fiktiv';
      }),
    );
    render(<TagesbefehlePage />);
    await openStep(user, /Ausgabe/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(7);

    await user.click(screen.getByRole('button', { name: '.xlsx herunterladen' }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
    const input = mocks.buildXlsx.mock.calls[0][0];
    expect(input.orders).toHaveLength(7);
    expect(input.orders[0].title).toBe('Tagesbefehl Nr 1 für Montag, 07.01.2030');
    expect(input.einheit).toBe(UNIT);
    expect(Array.from(input.template)).toEqual(Array.from(ZIP_BYTES));
    expect(Array.from(input.signature)).toEqual(Array.from(PNG_BYTES));
    expect(mocks.download.mock.calls[0][0]).toBe('Tagesbefehle_KVK_FDT_2026.xlsx');

    await user.click(screen.getByRole('button', { name: 'PDF je Tag herunterladen' }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(2));
    expect(mocks.download.mock.calls[1][0]).toBe('Tagesbefehle_KVK_FDT_2026_PDF.zip');
    expect(mocks.buildPdfZip.mock.calls[0][0]).toHaveLength(7);

    await user.click(screen.getByRole('button', { name: 'PDF 03_Mi.pdf herunterladen' }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(3));
    expect(mocks.download.mock.calls[2][0]).toBe('03_Mi.pdf');
    expect(mocks.buildDayPdf.mock.calls[0][0].day).toBe('Mi');

    await user.click(screen.getByRole('button', { name: 'Alle drucken' }));
    expect(window.print).toHaveBeenCalledOnce();
  });

  it('shows a generic error when an export fails', async () => {
    const user = userEvent.setup();
    storeTemplateAndSignature();
    mocks.buildXlsx.mockImplementation(() => {
      throw new Error('xlsx-Export fehlgeschlagen.');
    });
    projectStore.setState(() => projectWithWeek());
    render(<TagesbefehlePage />);
    await openStep(user, /Ausgabe/);
    await user.click(screen.getByRole('button', { name: '.xlsx herunterladen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('xlsx-Export fehlgeschlagen.');
    expect(mocks.download).not.toHaveBeenCalled();
  });
});

describe('local asset storage and self-contained export', () => {
  it('round-trips, tolerates garbage and reports a full store generically', () => {
    const storage = memoryStorage();
    expect(readTbAssets(storage)).toEqual({});
    const saved = saveTbAssets(
      { template: createTbAsset('fiktiv.xlsx', ZIP_BYTES, new Date('2030-01-01T10:00:00Z')) },
      storage,
    );
    expect(readTbAssets(storage)).toEqual(saved);
    expect(saved.template?.savedAt).toBe('2030-01-01T10:00:00.000Z');
    storage.setItem(TB_ASSETS_KEY, '{kaputt');
    expect(readTbAssets(storage)).toEqual({});
    expect(
      normalizeTbAssets({ template: { base64: 'nicht base64!' }, signature: 'x', extra: 1 }),
    ).toEqual({});
    clearTbAssets(storage);
    expect(storage.getItem(TB_ASSETS_KEY)).toBeNull();
    expect(() =>
      saveTbAssets({ signature: createTbAsset('fiktiv.png', PNG_BYTES) }, memoryStorage(true)),
    ).toThrow(/Browserablage nicht verfügbar oder voll/);
  });

  it('embeds the assets in the one boot-data script and seeds only an empty device', () => {
    const template =
      '<!DOCTYPE html><html data-offline="true"><head></head><body><div id="root"></div><script>window.__APP=1;</script></body></html>';
    const project = projectWithWeek();
    const assets: TbAssets = {
      template: createTbAsset('fiktiv</script>.xlsx', ZIP_BYTES),
      signature: createTbAsset('fiktiv.png', PNG_BYTES),
    };
    const html = bundleHtml(bundleHtml(template, project, assets), project, assets);
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    expect(parsed.querySelectorAll('script')).toHaveLength(2);
    expect(parsed.querySelectorAll('#boot-data')).toHaveLength(1);
    expect(html).not.toContain('fiktiv</script>');
    const target: Record<string, unknown> = {};
    new Function('window', parsed.getElementById('boot-data')?.textContent ?? '')(target);
    expect(normalizeProject(target.__BOOTDATA)).toEqual(project);
    expect(target.__TBASSETS).toEqual(assets);

    const empty = memoryStorage();
    expect(seedTbAssets(target.__TBASSETS, empty)).toBe(true);
    expect(readTbAssets(empty)).toEqual(assets);
    const own = memoryStorage();
    const local = saveTbAssets({ signature: createTbAsset('eigene.png', PNG_BYTES) }, own);
    expect(seedTbAssets(target.__TBASSETS, own)).toBe(false);
    expect(readTbAssets(own)).toEqual(local);
    expect(seedTbAssets(undefined, memoryStorage())).toBe(false);

    // Without assets the export stays exactly as before.
    const plain = bundleHtml(template, project);
    expect(plain).not.toContain('__TBASSETS');
  });
});

describe('page helpers', () => {
  it('suggests the next number and Monday after the previous week', () => {
    const tb = createTbState();
    tb.wochen.KVK = { ...emptyWeek('KVK'), startDate: '2030-01-07', days: ['Mo', 'So'] };
    expect(suggestFirstNumber(tb, 'Wo 1')).toBe(8);
    expect(suggestStartDate(tb, 'Wo 1')).toBe('2030-01-14');
    tb.wochen.KVK.days = ['Mo', 'Fr'];
    tb.wochen.KVK.firstNumber = 3;
    expect(suggestFirstNumber(tb, 'Wo 1', '2030-01-14')).toBe(8);
    tb.wochen['Wo 1'] = { ...emptyWeek('Wo 1'), startDate: '2030-01-14', days: ['Mo'] };
    expect(previousWeek(tb, 'Wo 1', '2030-01-14')?.sheet).toBe('KVK');
    expect(previousWeek(tb, 'KVK', '2030-01-07')).toBeUndefined();
    expect(suggestFirstNumber(tb, 'KVK', '2030-01-07')).toBe(1);
  });

  it('moves only within the same day, section and group', () => {
    const week = weekFromParse(createTbState(), fictionalParse('KVK'), 'fiktiv.xlsx');
    expect(moveEntry(week, 'KVK-mo-1', 1)).toBe(false);
    relocateEntry(week, 'KVK-mo-2', 'dienstbetrieb:');
    expect(moveEntry(week, 'KVK-mo-2', -1)).toBe(true);
    expect(week.entries.slice(0, 2).map((e) => e.id)).toEqual(['KVK-mo-2', 'KVK-mo-1']);
    const buckets = reviewBuckets(week, 'Sa');
    expect(buckets.map((b) => b.heading)).toEqual(['1 Dienstbetrieb / Ausbildung', '2 Besonderes']);
  });
});

// Keeps React state updates from late promises inside act() for the last test.
afterEach(async () => {
  await act(async () => {});
});
