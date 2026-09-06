import { preflightImage, readPngSize } from './png-size';

/** Minimal PNG header (signature + IHDR length/type + width/height). */
const png = (width: number, height: number): Uint8Array => {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
};

describe('readPngSize', () => {
  it('reads width/height from the IHDR chunk', () => {
    expect(readPngSize(png(1536, 1024))).toEqual({ width: 1536, height: 1024 });
  });
  it('returns null for non-PNG bytes', () => {
    expect(readPngSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('preflightImage', () => {
  it('fails empty bytes', () => {
    expect(preflightImage(new Uint8Array(0), '1024x1024')).toEqual(['preflight:empty']);
  });
  it('passes a PNG whose aspect matches the slot (provider rounding tolerated)', () => {
    expect(preflightImage(png(1536, 1024), '1536x1024')).toEqual([]);
    expect(preflightImage(png(1248, 832), '1536x1024')).toEqual([]);
  });
  it('fails a PNG with the wrong aspect', () => {
    expect(preflightImage(png(1024, 1024), '1536x1024')).toEqual(['preflight:aspect']);
  });
  it('does not fail non-PNG bytes on aspect (cannot be asserted)', () => {
    expect(preflightImage(new Uint8Array([0xff, 0xd8, 0xff]), '1024x1536')).toEqual([]);
  });
});
