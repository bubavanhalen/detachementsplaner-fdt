// Datenverlust-Schutz und Erststart (I5 D4; Beschrieb 5.6, 5.7; UI-Richtlinie 10, 11.1, 11.3, 11.4; R-5.6-09,
// R-5.6-11, R-5.6-12, R-5.7-01, R-5.7-02).

import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { PersistenceStatus, RestorePointInfo } from '../../../io/wap-plan/store';
import { I2Dialog as Modal } from '../i2/I2Dialog';
import { localStamp, restoreReasonText } from './support';
import './flows.css';

/** Dialog «Wiederherstellungspunkte»: Zeitpunkt, Grund, Umfang; «Wiederherstellen» ohne Rückfrage (rückgängig). */
export function RestorePointsDialog({
  load,
  readOnly,
  persistence,
  onRestore,
  onClose,
}: {
  readonly load: () => Promise<readonly RestorePointInfo[]>;
  readonly readOnly: boolean;
  readonly persistence: PersistenceStatus | null;
  readonly onRestore: (point: RestorePointInfo) => void;
  readonly onClose: () => void;
}) {
  const [points, setPoints] = useState<readonly RestorePointInfo[] | null>(null);
  useEffect(() => {
    let current = true;
    void load()
      .then((list) => {
        if (current) setPoints(list);
      })
      .catch(() => {
        if (current) setPoints([]);
      });
    return () => {
      current = false;
    };
  }, [load]);
  const used =
    persistence?.usageBytes !== null &&
    persistence?.usageBytes !== undefined &&
    persistence.quotaBytes !== null &&
    persistence.quotaBytes > 0
      ? Math.round((persistence.usageBytes / persistence.quotaBytes) * 100)
      : null;
  return (
    <Modal
      title="Wiederherstellungspunkte"
      onClose={onClose}
      description="Automatisch täglich und vor jedem Import, jeder Übernahme, jedem Stand, Ersetzen und Wiederherstellen; mindestens 30 bleiben erhalten. Wiederherstellen ist rückgängig machbar (Ctrl+Z)."
    >
      <dl className="wap-flow-facts">
        <div>
          <dt>Dauerhaft gespeichert</dt>
          <dd>
            {persistence === null
              ? 'unbekannt'
              : persistence.persisted
                ? 'ja'
                : 'nein – der Browser darf die Pläne bei Platzmangel löschen. Plan-Datei regelmässig sichern.'}
          </dd>
        </div>
        <div>
          <dt>Belegung</dt>
          <dd>{used === null ? 'unbekannt' : `${String(used)} % des lokalen Speichers`}</dd>
        </div>
      </dl>
      {points === null ? (
        <p role="status">Wiederherstellungspunkte werden gelesen …</p>
      ) : points.length === 0 ? (
        <p>
          Noch keine Wiederherstellungspunkte. Der erste entsteht mit der ersten Änderung des Tages.
        </p>
      ) : (
        <table className="wap-flow-table">
          <caption className="wap-i2-sr">Wiederherstellungspunkte, neueste zuerst</caption>
          <thead>
            <tr>
              <th scope="col">Zeitpunkt</th>
              <th scope="col">Grund</th>
              <th scope="col">Umfang</th>
              <th scope="col">
                <span className="wap-i2-sr">Aktion</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <td>{localStamp(p.at)}</td>
                <td>{restoreReasonText(p)}</td>
                <td>
                  {String(p.entryCount)} {p.entryCount === 1 ? 'Eintrag' : 'Einträge'}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    disabled={readOnly}
                    aria-label={`Wiederherstellen: ${restoreReasonText(p)}, ${localStamp(p.at)}`}
                    onClick={() => onRestore(p)}
                  >
                    Wiederherstellen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

const SESSION_KEY = 'wap-planer:speicherhinweis-geschlossen';

function readClosed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Speicherwarnungen (UI-Richtlinie 11.4): nicht dauerhaft → gelbes, ruhiges Banner einmal je Sitzung (schliessbar);
 * ab 80 % Belegung gelbes Banner «Speicher fast voll» mit «Wiederherstellungspunkte …».
 */
export function StorageBanner({
  status,
  onMore,
}: {
  readonly status: PersistenceStatus | null;
  readonly onMore: () => void;
}) {
  const [closed, setClosed] = useState(readClosed);
  if (status === null) return null;
  const used =
    status.usageBytes !== null && status.quotaBytes !== null && status.quotaBytes > 0
      ? Math.round((status.usageBytes / status.quotaBytes) * 100)
      : null;
  const fullText = `Lokaler Speicher fast voll${used === null ? '' : ` (${String(used)} %)`}: Weitere Änderungen könnten nicht mehr gespeichert werden. Jetzt die Plan-Datei sichern und danach alte Wiederherstellungspunkte löschen oder nicht benötigte Pläne entfernen.`;
  const persistText =
    'Speicher nicht dauerhaft: Der Browser darf die Pläne bei Platzmangel löschen. Plan-Datei regelmässig sichern.';
  // Kompakt in der Kopfzeile (Kopf und Werkzeugleiste höchstens 100 px, I2b A5): Kurztext sichtbar, voller Text
  // im Status und im Tooltip.
  return (
    <>
      {status.nearFull && (
        <span
          className="wap-flow-chip"
          role="status"
          aria-label="Speicher fast voll"
          title={fullText}
        >
          <span aria-hidden="true">
            ▲ Speicher fast voll{used === null ? '' : ` (${String(used)} %)`}
          </span>
          <span className="wap-i2-sr">{fullText}</span>
          <button type="button" className="btn" onClick={onMore}>
            Speicher verwalten …
          </button>
        </span>
      )}
      {!status.persisted && !closed && (
        <span
          className="wap-flow-chip"
          role="status"
          aria-label="Speicherhinweis"
          title={persistText}
        >
          <span aria-hidden="true">▲ Nicht dauerhaft</span>
          <span className="wap-i2-sr">{persistText}</span>
          <button
            type="button"
            className="btn wap-i2-icon"
            aria-label="Mehr erfahren"
            title="Mehr erfahren: Wiederherstellungspunkte, Dauerhaftigkeit und Belegung des Speichers"
            onClick={onMore}
          >
            <span aria-hidden="true">?</span>
          </button>
          <button
            type="button"
            className="btn"
            aria-label="Hinweis schliessen"
            onClick={() => {
              setClosed(true);
              try {
                sessionStorage.setItem(SESSION_KEY, '1');
              } catch {
                /* Nur für diese Sitzung; ohne sessionStorage bleibt der Hinweis bis zum Neuladen zu. */
              }
            }}
          >
            ✕
          </button>
        </span>
      )}
    </>
  );
}

const CARDS = [
  {
    key: 'N',
    title: 'Neuer Plan aus Vorlage',
    text: 'Kp-Vorlage mit Spaltensätzen und leeren Wochen ab dem KVK-Montag.',
  },
  {
    key: 'O',
    title: 'Plan-Datei öffnen',
    text: 'Eine mit «Plan-Datei sichern» erstellte Datei von diesem Gerät öffnen.',
  },
  {
    key: 'I',
    title: 'Excel-WAP importieren',
    text: 'Einen bestehenden Kp-WAP (.xlsx) einlesen; die Originaldatei bleibt unverändert.',
  },
] as const;

/**
 * Erststart (UI-Richtlinie 11.1, Ansicht 01; R-5.7-01): drei Karten mit Kürzeln N, O, I, Anfangsfokus auf der ersten.
 * «Excel-WAP importieren» ruft die Schnittstelle `onImportExcel` auf (Import selbst aus I4).
 */
export function FirstRun({
  disabled,
  onNewPlan,
  onOpenFile,
  onImportExcel,
}: {
  readonly disabled: boolean;
  readonly onNewPlan: () => void;
  readonly onOpenFile: () => void;
  readonly onImportExcel: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (document.activeElement === document.body || document.activeElement === null)
      first.current?.focus();
  }, []);
  const key = (event: KeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.altKey || event.metaKey || disabled) return;
    if (event.target instanceof HTMLInputElement) return;
    const k = event.key.toLowerCase();
    if (k === 'n') onNewPlan();
    else if (k === 'o') onOpenFile();
    else if (k === 'i') onImportExcel();
    else return;
    event.preventDefault();
  };
  return (
    <section className="wap-first-run" aria-labelledby="wap-first-run-title" onKeyDown={key}>
      <h2 id="wap-first-run-title">Ein neuer Wochenplan</h2>
      <p>Wie beginnen? Alles bleibt auf diesem Gerät.</p>
      <div className="wap-first-run-cards">
        {CARDS.map((c, i) => (
          <button
            key={c.key}
            ref={i === 0 ? first : undefined}
            type="button"
            className="wap-first-run-card"
            disabled={disabled}
            aria-label={`${c.title} (${c.key})`}
            aria-describedby={`wap-first-run-${c.key}`}
            onClick={[onNewPlan, onOpenFile, onImportExcel][i]}
          >
            <strong>{c.title}</strong>
            <span id={`wap-first-run-${c.key}`}>{c.text}</span>
            <kbd>{c.key}</kbd>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Hinweis, solange der Excel-Import in diesem Stand noch fehlt (Meldung mit Ursache und nächstem Schritt). */
export function ImportUnavailableDialog({ onClose }: { readonly onClose: () => void }) {
  return (
    <Modal
      title="Excel-WAP importieren"
      onClose={onClose}
      description="Der Excel-Import ist in diesem Zwischenstand noch nicht eingebunden. Nichts wurde geändert. Nächster Schritt: einen Plan aus der Vorlage anlegen oder eine Plan-Datei öffnen."
    >
      <div className="wap-flow-buttons">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Zurück zum Erststart
        </button>
      </div>
    </Modal>
  );
}
