import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { exportJson } from '../io/exports';
import { createProject } from '../model';
import {
  feedbackStore,
  notify,
  projectStore,
  redoProject,
  undoProject,
  useFeedback,
  useProject,
} from '../store';
import {
  isTyping,
  modKey,
  openOverlay,
  preferencesStore,
  setPreference,
  useOverlays,
  usePreferences,
} from '../ui';
import { type Step, useWorkflow } from '../workflow';
import { CommandPalette } from './CommandPalette';
import { HistoryButtons, runSafely } from './HistoryButtons';
import { Icon, type IconName } from './Icon';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from './Menu';
import { Modal } from './Modal';
import { ProjectDialogs, servicePeriod } from './ProjectDialogs';
import { pickLocalFile } from './projectActions';

const tools = [
  { to: '/persons', label: 'Personen', icon: 'users', hint: 'Nachschlagen & bearbeiten' },
  { to: '/contacts', label: 'Kontakte', icon: 'contact', hint: 'CSV lokal erstellen' },
] as const;
const titles: Record<string, { title: string; description: string; step?: number }> = {
  '/persons': { title: 'Personen', description: 'Suchen, prüfen und Angaben ergänzen' },
  '/contacts': { title: 'Kontakte', description: 'Kontakt-CSV lokal vorbereiten' },
};

export function Shell() {
  const project = useProject();
  const feedback = useFeedback();
  const overlays = useOverlays();
  const preferences = usePreferences();
  const steps = useWorkflow();
  const navigate = useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const archived = Boolean(project.archive);
  const currentStep = steps.find((step) => step.to === path);
  const heading = currentStep
    ? { title: currentStep.title, description: currentStep.description, step: currentStep.number }
    : (titles[path] ?? { title: 'Detachementsplaner', description: '' });
  const next = currentStep ? steps[currentStep.number] : undefined;

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = preferences.theme;
  }, [preferences.theme]);
  useEffect(() => {
    document.title = `${heading.title} · ${project.name} · Detachementsplaner`;
  }, [heading.title, project.name]);

  // Global keyboard shortcuts. Text fields keep their native behaviour (including undo).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 'k') {
        event.preventDefault();
        openOverlay({ palette: true });
        return;
      }
      if (mod && key === 's') {
        event.preventDefault();
        exportJson(projectStore.get());
        notify('JSON-Sicherung lokal heruntergeladen.', { tone: 'success' });
        return;
      }
      if (mod && key === 'b') {
        event.preventDefault();
        setPreference(
          'sidebar',
          preferencesStore.get().sidebar === 'collapsed' ? 'expanded' : 'collapsed',
        );
        return;
      }
      if (document.querySelector('dialog[open]') || isTyping(event.target)) return;
      if (mod && key === 'z') {
        event.preventDefault();
        runSafely(event.shiftKey ? redoProject : undoProject);
      } else if (mod && key === 'y') {
        event.preventDefault();
        runSafely(redoProject);
      } else if (event.altKey && /^[1-6]$/.test(event.key)) {
        event.preventDefault();
        const targets = ['/sources', '/', '/pisa', '/finish', '/persons', '/contacts'] as const;
        void navigate({ to: targets[Number(event.key) - 1] });
      } else if (!mod && !event.altKey && event.key === '?') {
        event.preventDefault();
        openOverlay({ shortcuts: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  // Warn before closing only when the browser could not store the latest changes.
  useEffect(() => {
    if (!feedback.saveError) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [feedback.saveError]);

  return (
    <div className="app" data-sidebar={preferences.sidebar}>
      <aside className="sidebar" aria-label="Seitenleiste">
        <div className="sb-top">
          <Link to="/" className="brand" title="Detachementsplaner">
            <span className="brand-mark" aria-hidden="true">
              D
            </span>
            <span className="brand-name sb-hide">Detachementsplaner</span>
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={
              preferences.sidebar === 'collapsed'
                ? 'Seitenleiste ausklappen'
                : 'Seitenleiste einklappen'
            }
            title={`Seitenleiste (${modKey}+B)`}
            onClick={() =>
              setPreference(
                'sidebar',
                preferences.sidebar === 'collapsed' ? 'expanded' : 'collapsed',
              )
            }
          >
            <Icon name="sidebar" size={17} />
          </button>
        </div>
        <ProjectMenu />
        <div className="sb-section">Ablauf</div>
        <nav className="sb-nav sb-steps" aria-label="Arbeitsschritte">
          {steps.map((step) => (
            <StepLink key={step.to} step={step} />
          ))}
        </nav>
        <div className="sb-section">Nachschlagen</div>
        <nav className="sb-nav" aria-label="Werkzeuge">
          {tools.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              className="sb-link"
              activeProps={{ className: 'sb-link active' }}
              title={tool.label}
            >
              <Icon name={tool.icon as IconName} />
              <span className="sb-link-text sb-hide">
                <span>{tool.label}</span>
                <small>{tool.hint}</small>
              </span>
              {tool.to === '/persons' && (
                <span className="count sb-hide">{project.persons.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sb-footer">
          <button
            type="button"
            className="sb-search"
            onClick={() => openOverlay({ palette: true })}
            title={`Suchen & Befehle (${modKey}+K)`}
          >
            <Icon name="search" size={16} />
            <span className="sb-hide">Suchen …</span>
            <span className="kbd sb-hide" aria-hidden="true">
              {modKey} K
            </span>
          </button>
          <div className="offline-note" title="Keine Uploads, kein Server, keine Übertragung">
            <Icon name="shield" size={16} />
            <span className="sb-hide">Alles bleibt auf diesem Gerät</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{heading.title}</h1>
            {heading.description && <p>{heading.description}</p>}
          </div>
          <div className="topbar-actions">
            <SaveState />
            <HistoryButtons />
            <ThemeMenu />
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Tastenkürzel"
              title="Tastenkürzel (?)"
              onClick={() => openOverlay({ shortcuts: true })}
            >
              <Icon name="keyboard" size={17} />
            </button>
            {next && (
              <>
                <span className="topbar-sep" />
                <Link
                  to={next.to}
                  className={`btn btn-sm ${currentStep?.state === 'done' ? 'btn-primary' : ''}`}
                >
                  Weiter: {next.label} <Icon name="arrowRight" size={15} />
                </Link>
              </>
            )}
          </div>
        </header>
        {feedback.saveError && (
          <div className="banner banner-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{feedback.saveError}</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => exportJson(projectStore.get())}
            >
              <Icon name="download" size={15} /> JSON sichern
            </button>
          </div>
        )}
        {archived && project.archive && (
          <div className="banner banner-info">
            <Icon name="archive" size={16} />
            <span>
              Archivstand vom {new Date(project.archive.at).toLocaleDateString('de-CH')} ·
              schreibgeschützt. Zum Weiterplanen eine Arbeitskopie öffnen.
            </span>
            <Link to="/finish" className="btn btn-sm">
              Arbeitskopie öffnen
            </Link>
          </div>
        )}
        <div className="page-scroll" id="main">
          <Outlet />
        </div>
      </div>

      <Toast />
      <ProjectDialogs />
      {overlays.palette && <CommandPalette onClose={() => openOverlay({ palette: false })} />}
      {overlays.shortcuts && <ShortcutSheet onClose={() => openOverlay({ shortcuts: false })} />}
    </div>
  );
}

function StepLink({ step }: { step: Step }) {
  return (
    <Link
      to={step.to}
      className="sb-link"
      activeProps={{ className: 'sb-link active' }}
      activeOptions={{ exact: true }}
      title={`${step.number}. ${step.label} · ${step.status}`}
    >
      <span className={`step-marker is-${step.state}`} aria-hidden="true">
        {step.state === 'done' ? (
          <Icon name="check" />
        ) : step.state === 'attention' ? (
          '!'
        ) : (
          step.number
        )}
      </span>
      <span className="sb-link-text sb-hide">
        <span>{step.label}</span>
        <small>{step.status}</small>
      </span>
    </Link>
  );
}

function ProjectMenu() {
  const project = useProject();
  const navigate = useNavigate();
  const period = servicePeriod(project);
  return (
    <Menu
      label="Dienstleistung"
      align="left"
      triggerClassName="sb-project"
      trigger={
        <>
          <span className="avatar" aria-hidden="true">
            {initials(project.name)}
          </span>
          <span className="sb-project-text sb-hide">
            <strong>{project.name}</strong>
            <small>
              {[project.settings.eigeneEinheit, period].filter(Boolean).join(' · ') ||
                'Details ergänzen'}
            </small>
          </span>
          <Icon name="chevronDown" size={15} className="sb-hide" />
        </>
      }
    >
      <MenuLabel>Diese Dienstleistung</MenuLabel>
      <MenuItem
        icon="edit"
        disabled={Boolean(project.archive)}
        onSelect={() => openOverlay({ service: true })}
      >
        Bezeichnung & Zeitraum …
      </MenuItem>
      <MenuItem icon="download" shortcut={`${modKey} S`} onSelect={() => exportJson(project)}>
        Als JSON sichern
      </MenuItem>
      <MenuSeparator />
      <MenuLabel>Wechseln</MenuLabel>
      <MenuItem icon="folder" onSelect={() => pickLocalFile('json')}>
        Projektdatei öffnen …
      </MenuItem>
      <MenuItem icon="plus" onSelect={() => openOverlay({ incoming: createProject() })}>
        Neue Dienstleistung
      </MenuItem>
      <MenuItem icon="archive" onSelect={() => void navigate({ to: '/finish' })}>
        Frühere Dienstleistungen …
      </MenuItem>
    </Menu>
  );
}
function initials(name: string): string {
  const letters = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase());
  return letters.join('') || 'D';
}

function ThemeMenu() {
  const { theme } = usePreferences();
  const icon: IconName = theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'monitor';
  return (
    <Menu label="Darstellung" trigger={<Icon name={icon} size={17} />}>
      <MenuLabel>Darstellung</MenuLabel>
      {(
        [
          ['system', 'Wie System', 'monitor'],
          ['light', 'Hell', 'sun'],
          ['dark', 'Dunkel', 'moon'],
        ] as const
      ).map(([value, label, name]) => (
        <MenuItem key={value} icon={name} onSelect={() => setPreference('theme', value)}>
          {label}
          {theme === value ? ' ✓' : ''}
        </MenuItem>
      ))}
    </Menu>
  );
}

function SaveState() {
  const feedback = useFeedback();
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  if (feedback.saveError)
    return (
      <span className="save-state is-error">
        <span className="dot dot-danger" /> Nicht gespeichert
      </span>
    );
  if (!feedback.savedAt)
    return (
      <span className="save-state" title="Änderungen werden automatisch lokal gespeichert">
        <span className="dot dot-success" /> Lokal
      </span>
    );
  const seconds = Math.round((Date.now() - feedback.savedAt) / 1000);
  const when =
    seconds < 45
      ? 'gerade eben'
      : seconds < 3600
        ? `vor ${Math.round(seconds / 60)} Min.`
        : new Date(feedback.savedAt).toLocaleTimeString('de-CH', {
            hour: '2-digit',
            minute: '2-digit',
          });
  return (
    <span
      className="save-state"
      title="Automatisch in diesem Browser gespeichert. Für eine unabhängige Sicherung JSON herunterladen."
    >
      <span className="dot dot-success" /> Gespeichert · {when}
    </span>
  );
}

function Toast() {
  const feedback = useFeedback();
  const [hover, setHover] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new notification (seq) restarts the timer even when the text repeats.
  useEffect(() => {
    if (!feedback.message || hover) return;
    const timer = window.setTimeout(
      () => feedbackStore.setState((old) => ({ ...old, message: '', action: undefined })),
      feedback.action ? 7000 : 4500,
    );
    return () => window.clearTimeout(timer);
  }, [feedback.message, feedback.seq, feedback.action, hover]);
  const close = () => feedbackStore.setState((old) => ({ ...old, message: '', action: undefined }));
  return (
    <div className="toast-region" aria-live="polite">
      {feedback.message && (
        <div
          key={feedback.seq}
          className={`toast ${feedback.tone === 'warning' ? 'is-warning' : ''}`}
          role="status"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <Icon
            name={
              feedback.tone === 'warning'
                ? 'alert'
                : feedback.tone === 'success'
                  ? 'checkCircle'
                  : 'info'
            }
            size={17}
          />
          <span>{feedback.message}</span>
          {feedback.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                const action = feedback.action;
                close();
                if (action) runSafely(action.run);
              }}
            >
              {feedback.action.label}
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label="Hinweis schliessen"
            onClick={close}
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const groups: [string, [string, string[]][]][] = [
    [
      'Überall',
      [
        ['Suchen & Befehle', [modKey, 'K']],
        ['Rückgängig', [modKey, 'Z']],
        ['Wiederholen', [modKey, 'Shift', 'Z']],
        ['JSON sichern', [modKey, 'S']],
        ['Seitenleiste', [modKey, 'B']],
        ['Schritt 1–4 öffnen', ['Alt', '1–4']],
        ['Personen / Kontakte', ['Alt', '5/6']],
        ['Diese Übersicht', ['?']],
      ],
    ],
    [
      'Planung',
      [
        ['Neues Detachement', ['N']],
        ['Alles anzeigen', ['F']],
        ['Liste «Noch frei»', ['T']],
        ['Karte verschieben', ['←', '↑', '→', '↓']],
        ['Name bestätigen', ['Enter']],
        ['Bearbeitung verwerfen', ['Esc']],
        ['Neue Karte an Position', ['Doppelklick']],
      ],
    ],
    [
      'Listen',
      [
        ['Suchfeld fokussieren', ['/']],
        ['Nächster / vorheriger Eintrag', ['J', 'K']],
        ['Bereich von Treffern wählen', ['Shift', 'Klick']],
        ['Dialog schliessen', ['Esc']],
      ],
    ],
  ];
  return (
    <Modal title="Tastenkürzel" onClose={onClose} wide>
      <div className="shortcut-grid">
        {groups.map(([title, rows]) => (
          <div key={title}>
            <h3>{title}</h3>
            {rows.map(([label, keys]) => (
              <div className="shortcut-row" key={label}>
                <span>{label}</span>
                <span>
                  {keys.map((key) => (
                    <span className="kbd" key={key}>
                      {key}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
