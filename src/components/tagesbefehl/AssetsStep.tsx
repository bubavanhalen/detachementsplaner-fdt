import { type ChangeEvent, useState } from 'react';
import {
  clearTbAssets,
  createTbAsset,
  readTbAssets,
  saveTbAssets,
} from '../../io/tagesbefehl/assets';
import { readFileBytes } from '../../io/tagesbefehl/bytes';
import { prepareSignature } from '../../io/tagesbefehl/signature';
import { xlsxFileName } from '../../io/tagesbefehl/xlsx';
import type { TbAssets } from '../../model/tagesbefehl';
import { notify } from '../../store';
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
  const unit = project.settings.eigeneEinheit.trim();

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
      const stored = kind === 'signature' ? await prepareSignature(bytes) : bytes;
      // Merge with the device store so two quick uploads cannot drop each other.
      onAssets(saveTbAssets({ ...readTbAssets(), [kind]: createTbAsset(file.name, stored) }));
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
      } else {
        const next = { ...readTbAssets() };
        delete next[removing];
        onAssets(saveTbAssets(next));
      }
    });
    setRemoving(null);
  };

  const settings = tb.settings;
  const saveSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    void run(() =>
      changeTb((draft) => {
        draft.settings[key] = value;
      }),
    );

  return (
    <div className="tb-step-grid">
      <section className="panel" aria-labelledby="tb-assets-title">
        <span className="eyebrow">EINMAL PRO GERÄT</span>
        <h2 id="tb-assets-title">Vorlage & Unterschrift</h2>
        <p className="muted">
          Die offizielle Vorlage (.xlsx) und die Unterschrift (PNG) werden nur in dieser
          Browserablage gespeichert und in die private Offline-HTML übernommen. Kein Upload.
        </p>
        <div className="tb-asset-list">
          {(['template', 'signature'] as const).map((kind) => {
            const asset = assets[kind];
            return (
              <div className="tb-asset" key={kind}>
                <div>
                  <strong>{ASSET_LABELS[kind]}</strong>
                  <p className="muted" data-testid={`tb-asset-${kind}`}>
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
                  <label className="button secondary tb-file-button">
                    {asset ? `${ASSET_LABELS[kind]} ersetzen` : `${ASSET_LABELS[kind]} wählen`}
                    <input
                      className="tb-file-input"
                      type="file"
                      aria-label={
                        kind === 'template' ? 'Vorlage (.xlsx) wählen' : 'Unterschrift (PNG) wählen'
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
                      className="button danger"
                      onClick={() => setRemoving(kind)}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {assets.template && assets.signature && (
          <button type="button" className="text-button" onClick={() => setRemoving('all')}>
            Beide von diesem Gerät entfernen
          </button>
        )}
      </section>

      <section className="panel" aria-labelledby="tb-settings-title">
        <span className="eyebrow">ANGABEN IM TAGESBEFEHL</span>
        <h2 id="tb-settings-title">Einstellungen</h2>
        <div className="form-grid">
          <Field className="field span-2" label="Landeskarte (LK)">
            {(id) => (
              <InlineText
                id={id}
                value={settings.lk}
                disabled={archived}
                onCommit={(value) => saveSetting('lk', value)}
              />
            )}
          </Field>
          <Field label="Name Kdt">
            {(id) => (
              <InlineText
                id={id}
                value={settings.kdtName}
                placeholder="Grad Vorname Name"
                disabled={archived}
                onCommit={(value) => saveSetting('kdtName', value.trim())}
              />
            )}
          </Field>
          <Field label="Funktion">
            {(id) => (
              <InlineText
                id={id}
                value={settings.kdtFunktion}
                disabled={archived}
                onCommit={(value) => saveSetting('kdtFunktion', value.trim())}
              />
            )}
          </Field>
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
          <p className="muted span-2 tb-hint">
            Eine Zeile pro Empfänger. <code>{'{Einheit}'}</code> wird durch die eigene Einheit
            ersetzt ({unit ? `«${unit}»` : 'noch nicht erfasst — unter Dateien & Archiv'}).
          </p>
          <Field className="field span-2" label="Dienstleistung (Dateiname)">
            {(id) => (
              <>
                <InlineText
                  id={id}
                  value={settings.dienstleistung}
                  disabled={archived}
                  onCommit={(value) => saveSetting('dienstleistung', value.trim())}
                />
                <small>Beispiel: {xlsxFileName('KVK', settings)}</small>
              </>
            )}
          </Field>
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
              <button type="button" className="button secondary" onClick={() => setRemoving(null)}>
                Abbrechen
              </button>
              <button type="button" className="button danger" onClick={remove}>
                Entfernen
              </button>
            </>
          }
        >
          <p>
            Die Datei wird aus der Browserablage dieses Geräts entfernt. Für weitere Ausgaben muss
            sie erneut gewählt werden.
          </p>
        </Modal>
      )}
    </div>
  );
}
