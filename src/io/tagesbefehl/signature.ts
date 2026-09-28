// Signature preparation, locally in the browser (canvas). The image never leaves
// the device: it is decoded, processed and re-encoded in memory only.

/** Aspect of the template's signature picture (1026 × 302 px). */
export const SIGNATURE_ASPECT = 1026 / 302;
/** Larger images are scaled down first (the template picture is 1026 px wide). */
const MAX_SIDE = 1600;

export interface RgbaImage {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/** 0…255 ink strength: alpha for transparent scans, darkness for opaque ones. */
function inkMask(image: RgbaImage): Uint8ClampedArray<ArrayBuffer> {
  const { data, width, height } = image;
  const n = width * height;
  let translucent = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 250) translucent++;
  const useAlpha = translucent > n * 0.02;
  const mask = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2],
      a = data[i * 4 + 3];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const value = useAlpha ? a : (Math.max(0, 235 - luminance) * 255) / 235;
    mask[i] = value < 24 ? 0 : value;
  }
  return mask;
}

/** Square max filter (like PIL's MaxFilter), separable. */
function dilate(
  mask: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray<ArrayBuffer> {
  if (radius < 1) return mask;
  const tmp = new Uint8ClampedArray(mask.length);
  const out = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let max = 0;
      for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++)
        max = Math.max(max, mask[y * width + k]);
      tmp[y * width + x] = max;
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let max = 0;
      for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++)
        max = Math.max(max, tmp[k * width + x]);
      out[y * width + x] = max;
    }
  return out;
}

/**
 * Crops to the ink, thickens thin strokes slightly, and pads (transparent) to
 * the template aspect ≈ 3.4:1 — left aligned when too narrow, vertically centred
 * when too flat. Returns null when the image contains no visible ink.
 */
export function processSignaturePixels(image: RgbaImage): RgbaImage | null {
  const { data, width, height } = image;
  const mask = inkMask(image);
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1,
    area = 0,
    edge = 0,
    red = 0,
    green = 0,
    blue = 0,
    weight = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] < 64) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      area++;
      const outside = (dx: number, dy: number) => {
        const nx = x + dx,
          ny = y + dy;
        return nx < 0 || ny < 0 || nx >= width || ny >= height || mask[ny * width + nx] < 64;
      };
      if (outside(1, 0) || outside(-1, 0) || outside(0, 1) || outside(0, -1)) edge++;
      if (mask[i] >= 128) {
        red += data[i * 4] * mask[i];
        green += data[i * 4 + 1] * mask[i];
        blue += data[i * 4 + 2] * mask[i];
        weight += mask[i];
      }
    }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1,
    bh = y1 - y0 + 1;
  // Mean stroke width ≈ 2 · area / perimeter; aim for ≈ 0.6 % of the signature size.
  const stroke = edge ? (2 * area) / edge : 1;
  const wanted = Math.max(3, Math.max(bw, bh) / 170);
  const radius = Math.max(0, Math.min(3, Math.round((wanted - stroke) / 2)));
  const pad = radius;
  const cw = bw + 2 * pad,
    ch = bh + 2 * pad;
  let crop = new Uint8ClampedArray(cw * ch);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) crop[(y + pad) * cw + x + pad] = mask[(y0 + y) * width + x0 + x];
  crop = dilate(crop, cw, ch, radius);

  const tooNarrow = cw / ch < SIGNATURE_ASPECT;
  const outWidth = tooNarrow ? Math.round(ch * SIGNATURE_ASPECT) : cw;
  const outHeight = tooNarrow ? ch : Math.round(cw / SIGNATURE_ASPECT);
  const offsetY = tooNarrow ? 0 : Math.floor((outHeight - ch) / 2);
  const color = weight ? [red / weight, green / weight, blue / weight].map(Math.round) : [0, 0, 0];
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const alpha = crop[y * cw + x];
      if (!alpha) continue;
      const o = ((y + offsetY) * outWidth + x) * 4;
      out[o] = color[0];
      out[o + 1] = color[1];
      out[o + 2] = color[2];
      out[o + 3] = alpha;
    }
  return { data: out, width: outWidth, height: outHeight };
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
interface Surface {
  ctx: Context2D;
  toPng: () => Promise<Blob | null>;
}

function surface(width: number, height: number): Surface | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) return { ctx, toPng: () => canvas.convertToBlob({ type: 'image/png' }) };
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return {
    ctx,
    toPng: () => new Promise((resolve) => canvas.toBlob(resolve, 'image/png')),
  };
}

/**
 * Pads a signature PNG to the template aspect (≈3.4:1) and thickens thin strokes.
 * Browser only (canvas); falls back to the unchanged PNG where no canvas exists.
 */
export async function prepareSignature(png: Uint8Array): Promise<Uint8Array> {
  if (typeof createImageBitmap !== 'function') return png;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([png.slice()], { type: 'image/png' }));
  } catch {
    throw new Error('Die Unterschrift konnte nicht als Bild gelesen werden.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale)),
    height = Math.max(1, Math.round(bitmap.height * scale));
  const source = surface(width, height);
  if (!source) {
    bitmap.close();
    return png;
  }
  source.ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = source.ctx.getImageData(0, 0, width, height);
  const result = processSignaturePixels({ data: pixels.data, width, height });
  if (!result) throw new Error('Auf dem Bild ist keine Unterschrift erkennbar.');
  const target = surface(result.width, result.height);
  if (!target) return png;
  target.ctx.putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
  const blob = await target.toPng();
  if (!blob) throw new Error('Die Unterschrift konnte nicht verarbeitet werden.');
  return new Uint8Array(await blob.arrayBuffer());
}
