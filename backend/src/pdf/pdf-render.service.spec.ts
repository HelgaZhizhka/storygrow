jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

const mockPdf = jest.fn();
const mockSetContent = jest.fn();
const mockSetViewport = jest.fn();
const mockNewPage = jest.fn();
const mockClose = jest.fn();
const mockLaunch = jest.fn();

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: (...args: unknown[]): unknown => mockLaunch(...args),
  },
}));

import { Test } from '@nestjs/testing';
import { PdfRenderService } from './pdf-render.service';
import { S3Service } from '../s3/s3.service';
import type { Story } from '../ai/schemas';

const mockS3 = {
  uploadObject: jest.fn(),
};

const story: Story = {
  title: 'Маша и кот <bad>',
  pages: [
    {
      template: 'cover',
      text: null,
      title: 'Маша и кот',
      illustrationPrompt: 'cover art',
    },
    {
      template: 'image-top',
      text: 'Маша играла с котом & смеялась',
      title: null,
      illustrationPrompt: 'girl playing',
    },
    {
      template: 'final',
      text: 'Дружба важна',
      title: null,
      illustrationPrompt: 'ending',
    },
  ],
  discussionQuestions: ['Что случилось?', 'Почему?', 'Q3', 'Q4', 'Q5'],
};

describe('PdfRenderService', () => {
  let service: PdfRenderService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNewPage.mockResolvedValue({
      setViewport: mockSetViewport,
      setContent: mockSetContent,
      pdf: mockPdf,
    });
    mockLaunch.mockResolvedValue({ newPage: mockNewPage, close: mockClose });
    mockPdf.mockResolvedValue(Buffer.from('PDF-BYTES'));

    const module = await Test.createTestingModule({
      providers: [PdfRenderService, { provide: S3Service, useValue: mockS3 }],
    }).compile();
    service = module.get(PdfRenderService);
    service.onModuleInit();
  });

  const input = {
    bookId: 'book-1',
    story,
    illustrationUrls: [
      'https://signed/page-1.png',
      'https://signed/page-2.png',
      'https://signed/page-3.png',
    ],
  };

  it('uploads PDF to S3 at deterministic key and returns it', async () => {
    mockS3.uploadObject.mockResolvedValue(undefined);

    const key = await service.render(input);

    expect(key).toBe('books/book-1/book.pdf');
    expect(mockS3.uploadObject).toHaveBeenCalledWith({
      key: 'books/book-1/book.pdf',
      body: Buffer.from('PDF-BYTES'),
      contentType: 'application/pdf',
    });
  });

  it('rejects when illustration count does not match page count', async () => {
    await expect(service.render({ ...input, illustrationUrls: ['only-one'] })).rejects.toThrow(
      /Illustration count/,
    );
  });

  it('escapes HTML in text and title to prevent injection', async () => {
    mockS3.uploadObject.mockResolvedValue(undefined);
    await service.render(input);

    const calls = mockSetContent.mock.calls as Array<[string, ...unknown[]]>;
    const html = calls[0][0];
    expect(html).not.toContain('<bad>');
    expect(html).toContain('&lt;bad&gt;');
    expect(html).toContain('Маша играла с котом &amp; смеялась');
  });

  it('substitutes illustrationUrl per page', async () => {
    mockS3.uploadObject.mockResolvedValue(undefined);
    await service.render(input);

    const calls = mockSetContent.mock.calls as Array<[string, ...unknown[]]>;
    const html = calls[0][0];
    expect(html).toContain('https://signed/page-1.png');
    expect(html).toContain('https://signed/page-2.png');
    expect(html).toContain('https://signed/page-3.png');
  });

  it('renders discussion questions as <li> only on the final page', async () => {
    mockS3.uploadObject.mockResolvedValue(undefined);
    await service.render(input);

    const calls = mockSetContent.mock.calls as Array<[string, ...unknown[]]>;
    const html = calls[0][0];
    expect(html).toContain('<li>Что случилось?</li>');
    expect(html).toContain('<li>Почему?</li>');
    // Discussion questions must appear exactly once (only the final page renders them)
    const occurrences = html.split('<li>Что случилось?</li>').length - 1;
    expect(occurrences).toBe(1);
  });

  it('closes the browser even when puppeteer.pdf() throws', async () => {
    mockPdf.mockRejectedValueOnce(new Error('headless crash'));

    await expect(service.render(input)).rejects.toThrow('headless crash');
    expect(mockClose).toHaveBeenCalled();
  });

  it('escapes & in URL attributes (signed-URL query strings)', async () => {
    mockS3.uploadObject.mockResolvedValue(undefined);

    await service.render({
      ...input,
      illustrationUrls: [
        'https://signed/p1.png?X-Amz-Algorithm=AWS4&X-Amz-Signature=abc',
        'https://signed/p2.png',
        'https://signed/p3.png',
      ],
    });

    const calls = mockSetContent.mock.calls as Array<[string, ...unknown[]]>;
    const html = calls[0][0];
    // Unescaped & in attribute would let HTML parser try to interpret entities
    expect(html).toContain('X-Amz-Algorithm=AWS4&amp;X-Amz-Signature=abc');
    expect(html).not.toContain('X-Amz-Algorithm=AWS4&X-Amz-Signature=abc');
  });

  it('rejects non-http(s) URL schemes (defends against future XSS via illustrationUrl)', async () => {
    mockS3.uploadObject.mockResolvedValue(undefined);

    await service.render({
      ...input,
      illustrationUrls: ['javascript:alert(1)', 'data:text/html,<script>x</script>', 'https://ok'],
    });

    const calls = mockSetContent.mock.calls as Array<[string, ...unknown[]]>;
    const html = calls[0][0];
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text/html');
    expect(html).toContain('https://ok');
  });

  it('omits --no-sandbox flag by default (security)', async () => {
    delete process.env['PUPPETEER_NO_SANDBOX'];
    mockS3.uploadObject.mockResolvedValue(undefined);

    await service.render(input);

    const launchCalls = mockLaunch.mock.calls as Array<[{ args: string[] }]>;
    expect(launchCalls[0][0].args).toEqual([]);
  });

  it('uses --no-sandbox when PUPPETEER_NO_SANDBOX=true (Docker/root context)', async () => {
    process.env['PUPPETEER_NO_SANDBOX'] = 'true';
    mockS3.uploadObject.mockResolvedValue(undefined);

    await service.render(input);

    const launchCalls = mockLaunch.mock.calls as Array<[{ args: string[] }]>;
    expect(launchCalls[0][0].args).toContain('--no-sandbox');
    expect(launchCalls[0][0].args).toContain('--disable-setuid-sandbox');

    delete process.env['PUPPETEER_NO_SANDBOX'];
  });

  it('uses A5 viewport for rendering', async () => {
    mockS3.uploadObject.mockResolvedValue(undefined);
    await service.render(input);

    expect(mockSetViewport).toHaveBeenCalledWith({ width: 874, height: 1240 });
    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        width: '874px',
        height: '1240px',
        printBackground: true,
      }),
    );
  });
});
