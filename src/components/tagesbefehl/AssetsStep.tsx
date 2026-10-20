import { type ChangeEvent, useState } from 'react';
import {
  clearTbAssets,
  createTbAsset,
  readTbAssets,
  saveTbAssets,
} from '../../io/tagesbefehl/assets';
import { fromBase64, readFileBytes } from '../../io/tagesbefehl/bytes';
import { prepareSignature } from '../../io/tagesbefehl/signature';
import { xlsxFileName } from '../../io/tagesbefehl/xlsx';
import { commanderSignature, MAX_BILD_BYTES } from '../../model';
import type { TbAssets } from '../../model/tagesbefehl';
import { changeProject, notify } from '../../store';
import { openOverlay } from '../../ui';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { Field, InlineLines, InlineText } from './fields';
import { changeTb, type TbStepProps } from './tbStore';

const isZip = (bytes: Uint8Array): boolean =>
  bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
const isPng = (bytes: Uint8Array): boolean =>
  bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e;

export function savedLabel(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString('de-CH')} ${date.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

type AssetKind = 'template' | 'signature';
const ASSET_LABELS: Record<AssetKind, string> = {
  template: 'Vorlage',
  signature: 'Unterschrift',
};

export function AssetsStep({
  project,
  tb,
  archived,
  run,
  assets,
  onAssets,
}: TbStepProps & { assets: TbAssets; onAssets: (assets: TbAssets) => void }) {
  const [removing, setRemoving] = useState<AssetKind | 'all' | null>(null);
  const unit = project.stamm.einheit.trim();
  // The template is a device value; the signature belongs to the service (ADR-0001).
  const unterschrift = project.stamm.grafiken.unterschrift;
  const legacySignature = assets.signature;
  const shown: Partial<Record<AssetKind, TbAssets['template']>> = {
    template: assets.template,
    signature: unterschrift,
  };
  const kdt = commanderSignature(project.stamm);

  const receive = (kind: AssetKind) => (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget,
      file = input.files?.[0];
    if (!file) return;
    void run(async () => {
      const bytes = await readFileBytes(file);
      if (kind === 'template' && !isZip(bytes))
        throw new Error('Die Vorlage ist keine lesbare .xlsx-Datei.');
      if (kind === 'signature' && !isPng(bytes))
        throw new Error('Die Unterschrift muss eine PNG-Datei sein.');
      if (kind === 'signature') {
        const prepared = await prepareSignature(bytes);
        if (prepared.length > MAX_BILD_BYTES)
          throw new Error(`Die Unterschrift ist grösser als ${MAX_BILD_BYTES / 1024} KB.`);
        changeProject((draft) => {
          draft.stamm.grafiken.unterschrift = createTbAsset(file.name, prepared);
        });
        notify('Unterschrift für diesen Dienst gespeichert.');
        return;
      }
      // Merge with the device store so two quick uploads cannot drop each other.
      onAssets(saveTbAssets({ ...readTbAssets(), template: createTbAsset(file.name, bytes) }));
      notify(`${ASSET_LABELS[kind]} lokal gespeichert.`);
    }).finally(() => {
      input.value = '';
    });
  };

  const remove = () => {
    if (!removing) return;
    void run(() => {
      if (removing === 'all') {
        clearTbAssets();
        onAssets({});
      } else if (removing === 'signature') {
        changeProject((draft) => {
          delete draft.stamm.grafiken.unterschrift;
        });
      } else {
        const next = { ...readTbAssets() };
        delete next[removing];
        onAssets(saveTbAssets(next));
      }
    });
    setRemoving(null);
  };
  /** The former device-wide signature, moved to this service only on request. */
  const adoptLegacy = () =>
    void run(() => {
      if (!legacySignature) return;
      // Earlier versions had no size limit; the project must stay within it.
      if (fromBase64(legacySignature.base64).length > MAX_BILD_BYTES)
        throw new Error(
          `Die gespeicherte Unterschrift ist grösser als ${MAX_BILD_BYTES / 1024} KB. Bitte eine kleinere PNG-Datei wählen.`,
        );
      changeProject((draft) => {
        draft.stamm.grafiken.unterschrift = { ...legacySignature };
      });
      notify('Unterschrift diesem Dienst zugeordnet.');
    });
  const dropLegacy = () =>
    void run(() => {
      const next = { ...readTbAssets() };
      delete next.signature;
      onAssets(saveTbAssets(next));
    });

  const settings = tb.settings;
  const saveSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    void run(() =>
      changeTb((draft) => {
        draft.settings[key] = value;
      }),
    );

  return (
    <div className="tb-step-grid">
      <section className="card" aria-labelledby="tb-assets-title">
        <header className="card-head">
          <h2 id="tb-assets-title">
            <Icon name="file" /> Vorlage & Unterschrift
          </h2>
          <span className="muted tb-head-note">Vorlage pro Gerät · Unterschrift pro Dienst</span>
        </header>
        <div className="card-body tb-card-stack">
          <p className="muted">
            Die offizielle Vorlage (.xlsx) gilt für dieses Gerät. Die Unterschrift (PNG) gehört zum
            Dienst und ist auch unter «Dienst und Einheit» sichtbar. Beides bleibt lokal; kein
            Upload.
          </p>
          {legacySignature && (
            <div className="callout callout-warning" data-testid="tb-legacy-signature">
              <Icon name="info" />
              <div className="callout-body">
                {unterschrift
                  ? 'Auf diesem Gerät liegt noch eine Unterschrift aus der früheren Version. Sie wird nicht mehr verwendet.'
                  : 'Auf diesem Gerät liegt noch eine Unterschrift aus der früheren Version. Die Unterschrift gehört jetzt zum Dienst.'}
                <div className="actions">
                  {!unterschrift && !archived && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={adoptLegacy}>
                      Diesem Dienst zuordnen
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={dropLegacy}>
                    Vom Gerät entfernen
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="tb-asset-list">
            {(['template', 'signature'] as const).map((kind) => {
              const asset = shown[kind];
              return (
                <div className={`tb-asset ${asset ? 'is-loaded' : ''}`} key={kind}>
                  <span className="tb-asset-icon" aria-hidden="true">
                    <Icon
                      name={asset ? 'checkCircle' : kind === 'template' ? 'sheet' : 'edit'}
                      size={20}
                    />
                  </span>
                  <div className="tb-asset-text">
                    <strong>{ASSET_LABELS[kind]}</strong>
                    <p className="tb-asset-status" data-testid={`tb-asset-${kind}`}>
                      {asset
                        ? `${asset.name || 'Ohne Dateiname'} · gespeichert ${savedLabel(asset.savedAt)}`
                        : 'Noch nicht gespeichert'}
                    </p>
                    {kind === 'signature' && asset && (
                      <img
                        className="tb-signature-preview"
                        src={`data:image/png;base64,${asset.base64}`}
                        alt="Gespeicherte Unterschrift"
                      />
                    )}
                  </div>
                  <div className="tb-asset-actions">
                    <label
                      className={`btn btn-sm tb-file-button ${
                        !asset && kind === 'template' ? 'btn-primary' : ''
                      }`}
                    >
                      <Icon name="upload" size={15} />
                      {asset ? `${ASSET_LABELS[kind]} ersetzen` : `${ASSET_LABELS[kind]} wählen`}
                      <input
                        className="tb-file-input"
                        type="file"
                        aria-label={
                          kind === 'template'
                            ? 'Vorlage (.xlsx) wählen'
                            : 'Unterschrift (PNG) wählen'
                        }
                        accept={
                          kind === 'template'
                            ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                            : '.png,image/png'
                        }
                        onChange={receive(kind)}
                      />
                    </label>
                    {asset && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost tb-remove"
                        onClick={() => setRemoving(kind)}
                      >
                        <Icon name="trash" size={15} /> Entfernen
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {assets.template && legacySignature && (
            <button
              type="button"
              className="btn-link tb-remove-all"
              onClick={() => setRemoving('all')}
            >
              Vorlage und alte Unterschrift von diesem Gerät entfernen
            </button>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="tb-settings-title">
        <header className="card-head">
          <h2 id="tb-settings-title">
            <Icon name="edit" /> Einstellungen
          </h2>
          <span className="muted tb-head-note">Angaben im Tagesbefehl</span>
        </header>
        <div className="card-body form-grid">
          <Field className="field span-all" label="Landeskarte (LK)">
            {(id) => (
              <InlineText
                id={id}
                value={settings.lk}
                disabled={archived}
                onCommit={(value) => saveSetting('lk', value)}
              />
            )}
          </Field>
          <div className="span-all tb-stamm" data-testid="tb-stamm">
            <dl>
              <dt>Unterzeichnet</dt>
              <dd>{[kdt.name || 'Name Kdt fehlt', kdt.funktion].filter(Boolean).join(' · ')}</dd>
              <dt>Einheit</dt>
              <dd>{unit || 'fehlt'}</dd>
              <dt>Dateikürzel</dt>
              <dd>
                {project.stamm.dateikuerzel || 'keines'} · z. B.{' '}
                <span className="mono">{xlsxFileName('KVK', project.stamm.dateikuerzel)}</span>
              </dd>
            </dl>
            {!archived && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => openOverlay({ service: true })}
              >
                <Icon name="edit" size={15} /> Dienst und Einheit bearbeiten
              </button>
            )}
          </div>
          <Field label="Verteiler «Geht an»">
            {(id) => (
              <InlineLines
                id={id}
                value={settings.gehtAn}
                disabled={archived}
                onCommit={(value) => saveSetting('gehtAn', value)}
              />
            )}
          </Field>
          <Field label="Verteiler «z K an»">
            {(id) => (
              <InlineLines
                id={id}
                value={settings.zK}
                disabled={archived}
                onCommit={(value) => saveSetting('zK', value)}
              />
            )}
          </Field>
          <p className="muted span-all tb-hint">
            Eine Zeile pro Empfänger. <code>{'{Einheit}'}</code> wird durch die eigene Einheit
            ersetzt ({unit ? `«${unit}»` : 'noch nicht erfasst — Projektmenü → Dienst und Einheit'}
            ).
          </p>
        </div>
      </section>

      {removing && (
        <Modal
          title={
            removing === 'all'
              ? 'Vorlage und Unterschrift entfernen'
              : `${ASSET_LABELS[removing]} entfernen`
          }
          onClose={() => setRemoving(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setRemoving(null)}>
                Abbrechen
              </button>
              <button type="button" className="btn btn-danger" onClick={remove}>
                Entfernen
              </button>
            </>
          }
        >
          <p>
            {removing === 'signature'
              ? 'Die Unterschrift wird aus diesem Dienst entfernt. Ohne Unterschrift bleibt das Bild der Vorlage.'
              : 'Die Datei wird aus der Browserablage dieses Geräts entfernt. Für weitere Ausgaben muss sie erneut gewählt werden.'}
          </p>
        </Modal>
      )}
    </div>
  );
}
