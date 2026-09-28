import type { TbAssets } from '../../model/tagesbefehl/types';
import { toBase64 } from './bytes';

/**
 * Template and signature are stored once per device, separate from the project
 * JSON (they are binary and not part of a planning state). They never leave the
 * device except inside the private self-contained HTML export.
 */
export const TB_ASSETS_KEY = 'detplaner.tb.assets';

type TbAssetEntry = NonNullable<TbAssets['template']>;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function assetEntry(value: unknown): TbAssetEntry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.base64 !== 'string' || !BASE64.test(item.base64)) return undefined;
  return {
    name: typeof item.name === 'string' ? item.name : '',
    base64: item.base64,
    savedAt: typeof item.savedAt === 'string' ? item.savedAt : '',
  };
}

/** Tolerant: invalid parts are dropped instead of rejecting the whole value. */
export function normalizeTbAssets(value: unknown): TbAssets {
  const input =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const template = assetEntry(input.template),
    signature = assetEntry(input.signature);
  return { ...(template ? { template } : {}), ...(signature ? { signature } : {}) };
}

export const hasTbAssets = (assets: TbAssets): boolean => !!(assets.template || assets.signature);

export function createTbAsset(name: string, bytes: Uint8Array, now = new Date()): TbAssetEntry {
  return { name, base64: toBase64(bytes), savedAt: now.toISOString() };
}

/** Unreadable or missing storage yields no assets; they can be uploaded again. */
export function readTbAssets(storage?: Storage): TbAssets {
  try {
    const raw = (storage ?? localStorage).getItem(TB_ASSETS_KEY);
    return raw ? normalizeTbAssets(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveTbAssets(assets: TbAssets, storage?: Storage): TbAssets {
  const clean = normalizeTbAssets(assets);
  try {
    const target = storage ?? localStorage;
    if (hasTbAssets(clean)) target.setItem(TB_ASSETS_KEY, JSON.stringify(clean));
    else target.removeItem(TB_ASSETS_KEY);
  } catch {
    throw new Error(
      'Vorlage bzw. Unterschrift konnte nicht lokal gespeichert werden. Browserablage nicht verfügbar oder voll.',
    );
  }
  return clean;
}

export function clearTbAssets(storage?: Storage): void {
  try {
    (storage ?? localStorage).removeItem(TB_ASSETS_KEY);
  } catch {
    // Nothing readable is stored; nothing to remove.
  }
}

/**
 * Seeds the device storage from assets embedded in a self-contained HTML export.
 * Existing local assets always win. Returns true when assets were stored.
 */
export function seedTbAssets(embedded: unknown, storage?: Storage): boolean {
  if (embedded == null) return false;
  const incoming = normalizeTbAssets(embedded);
  if (!hasTbAssets(incoming) || hasTbAssets(readTbAssets(storage))) return false;
  try {
    saveTbAssets(incoming, storage);
    return true;
  } catch {
    return false;
  }
}

/** Script fragment for the boot-data script of the self-contained HTML export. */
export function embeddedTbAssetsScript(assets: TbAssets | undefined): string {
  const clean = normalizeTbAssets(assets);
  if (!hasTbAssets(clean)) return '';
  return `window.__TBASSETS=${JSON.stringify(clean).replace(/</g, '\\u003c')};`;
}
