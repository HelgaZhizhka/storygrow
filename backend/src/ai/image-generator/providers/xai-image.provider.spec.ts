const mockFetch = jest.fn();
global.fetch = mockFetch;

import { XaiImageProvider } from './xai-image.provider';

interface XaiBody {
  model: string;
  aspect_ratio: string;
  images?: Array<{ type: string; url: string }>;
  prompt?: string;
}

const b64 = Buffer.from([7, 7, 7]).toString('base64');
const okResponse = { ok: true, json: () => Promise.resolve({ data: [{ b64_json: b64 }] }) };
const bodyOf = (call: unknown[]): XaiBody =>
  JSON.parse((call[1] as { body: string }).body) as XaiBody;

describe('XaiImageProvider', () => {
  beforeEach(() => mockFetch.mockReset());

  it('page with no reference calls the generations endpoint', async () => {
    mockFetch.mockResolvedValue(okResponse);
    const out = await new XaiImageProvider('k').generatePage({
      prompt: 'a fox',
      imageSize: '1024x1536',
      references: [],
    });
    expect(out).toEqual(new Uint8Array([7, 7, 7]));
    const call = mockFetch.mock.calls[0] as unknown[];
    expect(call[0]).toContain('/v1/images/generations');
    const body = bodyOf(call);
    expect(body.model).toBe('grok-imagine-image-2.0');
    expect(body.aspect_ratio).toBe('2:3');
  });

  it('page with references calls the edits endpoint with every image as a data URI', async () => {
    mockFetch.mockResolvedValue(okResponse);
    await new XaiImageProvider('k').generatePage({
      prompt: 'a fox',
      imageSize: '1536x1024',
      references: [new Uint8Array([1, 2, 3])],
    });
    const call = mockFetch.mock.calls[0] as unknown[];
    expect(call[0]).toContain('/v1/images/edits');
    const body = bodyOf(call);
    expect(body.images?.[0]?.type).toBe('image_url');
    expect(body.images?.[0]?.url).toMatch(/^data:image\/png;base64,/);
    expect(body.aspect_ratio).toBe('3:2');
  });

  it('maps a 400 content-policy error to a refusal', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('content policy violation'),
    });
    await expect(
      new XaiImageProvider('k').generatePage({
        prompt: 'x',
        imageSize: '1024x1024',
        references: [],
      }),
    ).rejects.toMatchObject({ refused: true });
  });

  it('renders a location sheet as a landscape text-to-image generation', async () => {
    mockFetch.mockResolvedValue(okResponse);
    await new XaiImageProvider('k').generateLocationSheet({
      descriptor: 'a cozy playroom',
      atmosphere: 'sunny morning',
      artStyle: 'watercolor',
    });
    const call = mockFetch.mock.calls[0] as unknown[];
    expect(call[0]).toContain('/v1/images/generations');
    const body = bodyOf(call);
    expect(body.prompt).toContain('Establishing shot of a cozy playroom');
    expect(body.aspect_ratio).toBe('3:2');
  });
});
