import type { ImageSize } from '../../pdf/page-templates/page-templates.config';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Relative tolerance on the aspect ratio: providers round to their own grid. */
const ASPECT_TOLERANCE = 0.06;

/** Width/height from a PNG IHDR chunk; null when the bytes are not a PNG. */
export const readPngSize = (bytes: Uint8Array): { width: number; height: number } | null => {
  if (bytes.length < 24 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

/**
 * Deterministic pre-checks before spending a vision call (#358): the bytes
 * exist and, when they are a PNG, the aspect ratio matches the template slot.
 * Non-PNG bytes are not failed here (a provider may return JPEG) — only what
 * can be asserted cheaply and certainly is asserted.
 */
export const preflightImage = (bytes: Uint8Array, imageSize: ImageSize): string[] => {
  if (bytes.length === 0) return ['preflight:empty'];
  const size = readPngSize(bytes);
  if (!size || size.height === 0) return [];
  const [w, h] = imageSize.split('x').map(Number);
  const expected = w / h;
  const actual = size.width / size.height;
  return Math.abs(actual - expected) / expected > ASPECT_TOLERANCE ? ['preflight:aspect'] : [];
};
