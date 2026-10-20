import { useMemo, useState } from 'react';
import { download } from '../../io/exports';
import { fromBase64 } from '../../io/tagesbefehl/bytes';
import { buildDayPdf, buildPdfZip, pdfFileName, pdfZipName } from '../../io/tagesbefehl/pdf';
import {
  extractTemplateLogos,
  type TbTemplateLogo,
  wappenSlot,
  withWappen,
} from '../../io/tagesbefehl/template';
import { buildTagesbefehlXlsx, xlsxFileName } from '../../io/tagesbefehl/xlsx';
import { commanderSignature } from '../../model';
import { buildOrders, type TbAssets, type TbOrder, type TbWeek } from '../../model/tagesbefehl';
import { notify } from '../../store';
import { Icon } from '../Icon';
import PrintView, { printOrders } from './PrintView';
import type { TbStepProps } from './tbStore';
import { openConflicts, weekConflicts } from './weekTools';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Copies into a fresh ArrayBuffer so the Blob never sees a shared/resizable buffer. */
const blobBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);

export function OutputStep({
  project,
  tb,
  run,
  week,
  assets,
  onStep,
}: TbStepProps & { week: TbWeek; assets: TbAssets; onStep: (step: number) => void }) {
  const [busy, setBusy] = useState('');
  const orders = useMemo(() => buildOrders(project, tb, week), [project, tb, week]);
  const template = useMemo(
    () => (assets.template ? fromBase64(assets.template.base64) : undefined),
    [assets.template],
  );
  // The signature belongs to the service (ADR-0001), not to the device.
  const unterschrift = project.stamm.grafiken.unterschrift;
  const signature = useMemo(
    () => (unterschrift ? fromBase64(unterschrift.base64) : undefined),
    [unterschrift],
  );
  // The service may show its coat of arms instead of the template's right-hand logo.
  const wappenBild = project.stamm.grafiken.wappen,
    wappenGewaehlt = !!tb.settings.wappenAlsLogo;
  const wappen = useMemo(
    () => (wappenGewaehlt && wappenBild ? fromBase64(wappenBild.base64) : undefined),
    [wappenGewaehlt, wappenBild],
  );
  const templateLogos = useMemo<TbTemplateLogo[]>(() => {
    if (!template) return [];
    try {
      return extractTemplateLogos(template);
    } catch {
      return [];
    }
  }, [template]);
  const logos = useMemo(() => withWappen(templateLogos, wappen), [templateLogos, wappen]);
  const signatureUrl = unterschrift ? `data:image/png;base64,${unterschrift.base64}` : undefined;
  const kdt = commanderSignature(project.stamm),
    dateikuerzel = project.stamm.dateikuerzel;
  const open = openConflicts(week, weekConflicts(week));

  const missing: { text: string; step: number }[] = [];
  if (!assets.template)
    missing.push({ text: 'Vorlage (.xlsx) fehlt — in Schritt 1 einmal wählen.', step: 1 });
  if (!week.startDate)
    missing.push({ text: 'Startdatum (Montag) fehlt — in Schritt 2 erfassen.', step: 2 });
  if (!orders.length)
    missing.push({ text: 'Keine Tage mit Tagesbefehl — in Schritt 2 wählen.', step: 2 });
  const blocked = missing.length > 0 || !!busy;
  const hints: string[] = [];
  if (!unterschrift)
    hints.push(
      'Ohne Unterschrift des Dienstes bleibt das Bild der Vorlage (Projektmenü → Dienst und Einheit).',
    );
  if (wappenGewaehlt && !wappenBild)
    hints.push(
      'Wappen statt Vorlagenlogo gewählt, aber kein Wappen erfasst: Das Logo der Vorlage bleibt (Projektmenü → Dienst und Einheit).',
    );
  else if (wappen && template && wappenSlot(templateLogos) < 0)
    hints.push('Die Vorlage hat rechts kein Logo; das Wappen wird nicht eingesetzt.');
  if (!kdt.name) hints.push('Name Kdt fehlt (Projektmenü → Dienst und Einheit).');
  if (!project.stamm.einheit.trim())
    hints.push('Eigene Einheit fehlt (Projektmenü → Dienst und Einheit).');
  const pdfAssets = { logos, signature };

  const exportFile = (label: string, action: () => Promise<void>) => {
    setBusy(label);
    void run(action).finally(() => setBusy(''));
  };
  const xlsx = () =>
    exportFile('xlsx', async () => {
      if (!template) return;
      const bytes = await buildTagesbefehlXlsx({
        template,
        signature,
        wappen,
        week,
        orders,
        settings: tb.settings,
        einheit: project.stamm.einheit,
        kdt,
        dateikuerzel,
      });
      const name = xlsxFileName(week.sheet, dateikuerzel);
      download(name, blobBytes(bytes), XLSX_MIME);
      notify(`${name} lokal erstellt.`);
    });
  const zip = () =>
    exportFile('zip', async () => {
      const bytes = await buildPdfZip(orders, pdfAssets);
      const name = pdfZipName(week.sheet, dateikuerzel);
      download(name, blobBytes(bytes), 'application/zip');
      notify(`${name} lokal erstellt.`);
    });
  const dayPdf = (order: TbOrder) =>
    exportFile(`pdf-${order.day}`, async () => {
      const bytes = await buildDayPdf(order, pdfAssets);
      download(pdfFileName(order), blobBytes(bytes), 'application/pdf');
    });

  return (
    <div className="tb-output">
      <section className="card tb-screen-only" aria-labelledby="tb-output-title">
        <header className="card-head">
          <h2 id="tb-output-title">
            <Icon name="printer" /> Ausgabe
          </h2>
          <span className="badge badge-accent">Woche {week.sheet}</span>
        </header>
        <div className="card-body tb-card-stack">
          {missing.length > 0 && (
            <div className="callout callout-warning" role="alert">
              <Icon name="alert" />
              <div className="callout-body">
                <strong>Ausgabe noch nicht möglich</strong>
                <ul className="tb-missing">
                  {missing.map((item) => (
                    <li key={item.text}>
                      {item.text}{' '}
                      <button type="button" className="btn-link" onClick={() => onStep(item.step)}>
                        Zu Schritt {item.step}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {open.length > 0 && (
            <div className="callout callout-warning">
              <Icon name="info" />
              <div className="callout-body">
                <strong>
                  {open.length} {open.length === 1 ? 'Hinweis' : 'Hinweise'} offen · Ausgabe
                  trotzdem möglich
                </strong>
                <p>Vor dem Verteilen die Hinweise unter «Prüfen» kontrollieren.</p>
              </div>
              <div className="callout-actions">
                <button type="button" className="btn btn-sm" onClick={() => onStep(3)}>
                  Zu den Hinweisen
                </button>
              </div>
            </div>
          )}
          {hints.length > 0 && (
            <ul className="tb-hints muted">
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}
          <div className="toolbar">
            <button
              type="button"
              className="btn btn-primary"
              disabled={blocked}
              onClick={() => printOrders()}
            >
              <Icon name="printer" size={16} /> Alle drucken
            </button>
            <button type="button" className="btn" disabled={blocked} onClick={xlsx}>
              <Icon name="sheet" size={16} />
              {busy === 'xlsx' ? 'Wird erstellt …' : '.xlsx herunterladen'}
            </button>
            <button type="button" className="btn" disabled={blocked} onClick={zip}>
              <Icon name="download" size={16} />
              {busy === 'zip' ? 'Wird erstellt …' : 'PDF je Tag herunterladen'}
            </button>
          </div>
          <p className="muted tb-hint">
            Dateien: <span className="mono">{xlsxFileName(week.sheet, dateikuerzel)}</span> ·{' '}
            <span className="mono">{pdfZipName(week.sheet, dateikuerzel)}</span>. Alles entsteht
            lokal auf diesem Gerät und enthält private Daten.
          </p>
        </div>
      </section>
      {orders.length > 0 && (
        <section className="tb-print-area" aria-label="Druckansicht">
          <PrintView
            orders={orders}
            logos={logos}
            signatureUrl={signatureUrl}
            sheetActions={(order) => (
              <div className="tb-sheet-toolbar">
                <span className="tb-sheet-name">
                  <strong>{order.day}</strong> · <span className="mono">{pdfFileName(order)}</span>
                  {order.date ? '' : ' · Datum offen'}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label={`${order.day} drucken`}
                  disabled={blocked}
                  onClick={() => printOrders(order.day)}
                >
                  <Icon name="printer" size={15} /> Drucken
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label={`PDF ${pdfFileName(order)} herunterladen`}
                  disabled={blocked}
                  onClick={() => dayPdf(order)}
                >
                  <Icon name="download" size={15} />
                  {busy === `pdf-${order.day}` ? 'Wird erstellt …' : 'PDF'}
                </button>
              </div>
            )}
          />
        </section>
      )}
    </div>
  );
}
