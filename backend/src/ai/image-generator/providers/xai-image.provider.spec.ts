const mockFetch = jest.fn();
global.fetch = mockFetch;

import { XaiImageProvider } from './xai-image.provider';

const b64 = Buffer.from([7, 7, 7]).toString('base64');
const okResponse = { ok: true, json: async () => ({ data: [{ b64_json: b64 }] }) };

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
    const [url, opts] = mockFetch.mock.calls[0] as [string, { body: string }];
    expect(url).toContain('/v1/images/generations');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('grok-imagine-image-2.0');
    expect(body.aspect_ratio).toBe('2:3');
  });

  it('page with a reference calls the edits endpoint with the image as a data URI', async () => {
    mockFetch.mockResolvedValue(okResponse);
    await new XaiImageProvider('k').generatePage({
      prompt: 'a fox',
      imageSize: '1536x1024',
      references: [new Uint8Array([1, 2, 3])],
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, { body: string }];
    expect(url).toContain('/v1/images/edits');
    const body = JSON.parse(opts.body);
    expect(body.image.type).toBe('image_url');
    expect(body.image.url).toMatch(/^data:image\/png;base64,/);
    expect(body.aspect_ratio).toBe('3:2');
  });

  it('maps a 400 content-policy error to a refusal', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'content policy violation',
    });
    await expect(
      new XaiImageProvider('k').generatePage({
        prompt: 'x',
        imageSize: '1024x1024',
        references: [],
      }),
    ).rejects.toMatchObject({ refused: true });
  });

  it('does not support location sheets', async () => {
    await expect(
      new XaiImageProvider('k').generateLocationSheet({
        descriptor: 'd',
        atmosphere: 'a',
        artStyle: 'watercolor',
      }),
    ).rejects.toThrow();
  });
});
