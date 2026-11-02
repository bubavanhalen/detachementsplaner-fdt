// Befundzähler, Befundliste und Quittieren (I5 D1; Beschrieb 7; UI-Richtlinie 8.1, 8.2, 12; R-7-02, R-7-03, R-7-34).
// Die Liste ist eine Liste mit Knöpfen «Zur Stelle» und «Quittieren …» je Befund (statt listbox, damit keine
// Bedienelemente in Optionen liegen); ↑/↓ wechseln zwischen den Befunden, Enter springt zur Stelle.

import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  acknowledgementText,
  countBySeverity,
  type Finding,
  type FindingSeverity,
  SEVERITY_LABEL,
} from '../../../model/wap/checks';
import type { Id, Plan } from '../../../model/wap/types';
import { I2Dialog as Modal } from '../i2/I2Dialog';
import './flows.css';

const ORDER: readonly FindingSeverity[] = ['error', 'warning', 'hint'];
const PLURAL: Readonly<Record<FindingSeverity, string>> = {
  error: 'Fehler',
  warning: 'Warnungen',
  hint: 'Hinweise',
};

/** Form trägt die Stufe (nicht nur Farbe): Kreis «!», Raute «!», Kreis «i» (UI-Richtlinie 4.2). */
export function SeveritySymbol({ severity }: { readonly severity: FindingSeverity }) {
  return (
    <span className={`wap-finding-symbol is-${severity}`} aria-hidden="true">
      {severity === 'hint' ? 'i' : '!'}
    </span>
  );
}

function countLabel(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

/** Zugänglicher Name des Zählers (UI-Richtlinie 8.1). */
export function counterLabel(findings: readonly Finding[]): string {
  const c = countBySeverity(findings);
  const open = c.error + c.warning + c.hint;
  return `${countLabel(open, 'offener Befund', 'offene Befunde')}: ${countLabel(c.error, 'Fehler', 'Fehler')}, ${countLabel(c.warning, 'Warnung', 'Warnungen')}, ${countLabel(c.hint, 'Hinweis', 'Hinweise')}. Befundliste öffnen (Ctrl+.)`;
}

/** Zähler in der Werkzeugleiste; quittierte zählen nicht (R-7-02, R-7-34). */
export function FindingsCounter({
  findings,
  open,
  onToggle,
}: {
  readonly findings: readonly Finding[];
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const c = countBySeverity(findings);
  const total = c.error + c.warning + c.hint;
  // Höfliche Ansage, wenn die Zahl der Fehler steigt (UI-Richtlinie 8.1, 13.6).
  const [announce, setAnnounce] = useState('');
  const lastErrors = useRef(c.error);
  useEffect(() => {
    if (c.error > lastErrors.current) {
      const newest = findings.find((f) => f.severity === 'error' && !f.acknowledged);
      setAnnounce(
        newest === undefined
          ? `${String(c.error)} Fehler`
          : `Neuer Fehler ${newest.rule}: «${newest.title}»`,
      );
    }
    lastErrors.current = c.error;
  }, [c.error, findings]);
  return (
    <>
      <button
        type="button"
        className={`btn wap-findings-counter${c.error > 0 ? ' has-errors' : ''}`}
        aria-label={counterLabel(findings)}
        aria-expanded={open}
        title="Befundliste (Ctrl+.); F8 / Shift+F8: nächster / vorheriger Befund"
        onClick={onToggle}
      >
        {total === 0 ? (
          <>
            <span className="wap-finding-ok" aria-hidden="true">
              ✓
            </span>
            Keine Befunde
          </>
        ) : (
          <>
            Befunde
            {ORDER.map((s) => (
              <span key={s} className="wap-findings-count">
                <SeveritySymbol severity={s} />
                {c[s]}
              </span>
            ))}
          </>
        )}
      </button>
      <span className="wap-i2-sr" role="status" aria-live="polite">
        {announce}
      </span>
    </>
  );
}

/** Befundliste im Seitenbereich mit Sprung zur Stelle und Quittieren (UI-Richtlinie 8.2). */
export function FindingsPanel({
  plan,
  findings,
  weekId,
  readOnly,
  onJump,
  onAcknowledge,
  onUnacknowledge,
  onClose,
}: {
  readonly plan: Plan;
  readonly findings: readonly Finding[];
  readonly weekId: Id;
  readonly readOnly: boolean;
  readonly onJump: (finding: Finding) => void;
  readonly onAcknowledge: (finding: Finding, reason: string) => void;
  readonly onUnacknowledge: (finding: Finding) => void;
  readonly onClose: () => void;
}) {
  const [scope, setScope] = useState<'week' | 'plan'>('week');
  const [asking, setAsking] = useState<Finding | null>(null);
  const heading = useId();
  const week = plan.weeks.find((w) => w.id === weekId);
  const weekName = week?.shortName.replace(/^Wo(\d)/, 'Wo $1') ?? '';
  const inScope = useMemo(
    () => (scope === 'week' ? findings.filter((f) => f.weekId === weekId) : findings),
    [findings, scope, weekId],
  );
  const open = inScope.filter((f) => !f.acknowledged);
  const acked = inScope.filter((f) => f.acknowledged);
  const where = scope === 'week' ? weekName : 'im ganzen Plan';
  const weekOf = (f: Finding) =>
    plan.weeks.find((w) => w.id === f.weekId)?.shortName.replace(/^Wo(\d)/, 'Wo $1') ?? '';
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    // Anfangsfokus auf der ersten offenen Meldung («Zur Stelle», ↓/↑ wie in der Liste), ohne Meldung auf der
    // Überschrift (UI-Richtlinie 10 «Anfangsfokus»; UX-2-07, SA-20).
    const first = panel.current?.querySelector<HTMLElement>('[data-finding-jump]');
    (first ?? panel.current?.querySelector<HTMLElement>('h2'))?.focus();
  }, []);

  const move = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = [
      ...(panel.current?.querySelectorAll<HTMLButtonElement>('[data-finding-jump]') ?? []),
    ];
    const current = document.activeElement
      ?.closest('li')
      ?.querySelector<HTMLButtonElement>('[data-finding-jump]');
    const i = current === null || current === undefined ? -1 : buttons.indexOf(current);
    const next = buttons[i + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next !== undefined) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <aside
      ref={panel}
      className="wap-findings"
      aria-labelledby={heading}
      onKeyDown={(event) => {
        // Esc schliesst die Befundliste (UX-3-03; Ctrl+. bei Fokus ausserhalb geht zur nächsten Meldung).
        if (event.key !== 'Escape' || asking !== null) return;
        event.preventDefault();
        onClose();
      }}
    >
      <header className="wap-findings-head">
        <h2 id={heading} tabIndex={-1}>
          Befunde
        </h2>
        <fieldset className="wap-segmented">
          <legend className="wap-i2-sr">Umfang der Befundliste</legend>
          <button
            type="button"
            className="btn"
            aria-pressed={scope === 'week'}
            onClick={() => setScope('week')}
          >
            {weekName || 'Woche'}
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={scope === 'plan'}
            onClick={() => setScope('plan')}
          >
            Ganzer Plan
          </button>
        </fieldset>
        <button type="button" className="btn" aria-label="Befundliste schliessen" onClick={onClose}>
          Schliessen
        </button>
      </header>
      {open.length === 0 && (
        <p className="wap-findings-empty">
          Keine offenen Befunde {scope === 'week' ? `in ${weekName}` : 'im Plan'}. Die Prüfungen
          laufen bei jeder Änderung.
          {acked.length > 0 &&
            ` ${countLabel(acked.length, 'Befund ist', 'Befunde sind')} quittiert.`}
        </p>
      )}
      {ORDER.map((severity) => {
        const list = open.filter((f) => f.severity === severity);
        if (list.length === 0) return null;
        return (
          <section key={severity} className="wap-findings-group">
            <h3>
              {PLURAL[severity]} ({list.length})
            </h3>
            <ul aria-label={`${PLURAL[severity]} ${where}`} onKeyDown={move}>
              {list.map((f) => (
                <li key={f.key} className={`wap-finding is-${f.severity}`}>
                  <p className="wap-finding-title">
                    <SeveritySymbol severity={f.severity} />
                    <strong>{f.rule}</strong> {f.title}
                    <span className="wap-finding-place">
                      {scope === 'plan' ? `${weekOf(f)} · ` : ''}
                      {f.place}
                    </span>
                  </p>
                  <p>{f.message.cause}</p>
                  <p className="wap-finding-next">Nächster Schritt: {f.message.nextStep}</p>
                  <div className="wap-finding-actions">
                    <button
                      type="button"
                      className="btn"
                      data-finding-jump=""
                      data-finding-key={f.key}
                      aria-label={`Zur Stelle: ${f.rule} «${f.title}» ${f.place}`}
                      onClick={() => onJump(f)}
                    >
                      Zur Stelle
                    </button>
                    <button
                      type="button"
                      className="btn"
                      aria-haspopup="dialog"
                      aria-label={`${f.rule} «${f.title}» quittieren …`}
                      disabled={readOnly}
                      onClick={() => setAsking(f)}
                    >
                      Quittieren …
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {acked.length > 0 && (
        <details className="wap-findings-acked">
          <summary>Quittiert ({acked.length})</summary>
          <ul aria-label={`Quittierte Befunde ${where}`}>
            {acked.map((f) => (
              <li key={f.key} className="wap-finding is-acked">
                <p className="wap-finding-title">
                  <SeveritySymbol severity={f.severity} />
                  <strong>{f.rule}</strong> {f.title}
                  <span className="wap-finding-place">{f.place}</span>
                </p>
                <p>
                  {SEVERITY_LABEL[f.severity]},{' '}
                  {f.acknowledgement === null
                    ? 'quittiert'
                    : acknowledgementText(f.acknowledgement)}
                </p>
                <div className="wap-finding-actions">
                  <button type="button" className="btn" onClick={() => onJump(f)}>
                    Zur Stelle
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={readOnly}
                    aria-label={`Quittierung von ${f.rule} «${f.title}» aufheben`}
                    onClick={() => onUnacknowledge(f)}
                  >
                    Quittierung aufheben
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {asking !== null && (
        <AcknowledgeDialog
          finding={asking}
          onClose={() => setAsking(null)}
          onConfirm={(reason) => {
            const f = asking;
            setAsking(null);
            onAcknowledge(f, reason);
          }}
        />
      )}
    </aside>
  );
}

/** Kleiner Dialog «Befund quittieren» mit optionalem Grund (eine Zeile), Enter quittiert (UI-Richtlinie 8.2, 10). */
function AcknowledgeDialog({
  finding,
  onClose,
  onConfirm,
}: {
  readonly finding: Finding;
  readonly onClose: () => void;
  readonly onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <Modal
      title="Befund quittieren"
      onClose={onClose}
      description={`${finding.rule} «${finding.title}» ${finding.place}: Der Befund zählt danach nicht mehr und bleibt unter «Quittiert» sichtbar, solange die Ursache gleich bleibt. Rückgängig machbar (Ctrl+Z).`}
    >
      <form
        className="wap-i2-form"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(reason);
        }}
      >
        <label>
          Grund (optional)
          <input
            ref={input}
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="wap-flow-buttons">
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary">
            Quittieren
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Prüfmarken für das Raster: höchste Stufe der offenen Befunde je Eintrag (UI-Richtlinie 4.2). */
export function findingMarks(
  findings: readonly Finding[],
): ReadonlyMap<Id, { severity: FindingSeverity; text: string }> {
  const out = new Map<Id, { severity: FindingSeverity; text: string }>();
  for (const f of findings) {
    if (f.acknowledged || f.entryId === null) continue;
    const known = out.get(f.entryId);
    const text = `Befund ${f.rule} (${SEVERITY_LABEL[f.severity]}): ${f.message.cause} Nächster Schritt: ${f.message.nextStep}`;
    if (known === undefined) out.set(f.entryId, { severity: f.severity, text });
    else
      out.set(f.entryId, {
        severity:
          ORDER.indexOf(f.severity) < ORDER.indexOf(known.severity) ? f.severity : known.severity,
        text: `${known.text}\n${text}`,
      });
  }
  return out;
}
