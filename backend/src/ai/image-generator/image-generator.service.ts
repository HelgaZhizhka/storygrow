import { Injectable, Logger } from '@nestjs/common';
import { startActiveObservation } from '@langfuse/tracing';
import { generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { type Story } from '../schemas';
import { PAGE_TEMPLATES } from '../../pdf/page-templates/page-templates.config';
import { S3Service } from '../../s3/s3.service';
import { IMAGE_MODEL, IMAGE_STYLE_SUFFIX } from '../ai.config';

export interface ImageGenInput {
  story: Story;
  bookId: string;
}

@Injectable()
export class ImageGeneratorService {
  private readonly logger = new Logger(ImageGeneratorService.name);

  constructor(private readonly s3: S3Service) {}

  async generate(input: ImageGenInput): Promise<string[]> {
    return startActiveObservation(`image-generation`, async (span) => {
      span.update({
        input: { bookId: input.bookId, pageCount: input.story.pages.length },
        metadata: { bookId: input.bookId },
      });

      const urls = await Promise.all(
        input.story.pages.map((page, index) =>
          this.generateOne({
            bookId: input.bookId,
            pageNumber: index + 1,
            prompt: page.illustrationPrompt,
            template: page.template,
          }),
        ),
      );

      span.update({ output: { count: urls.length } });
      return urls;
    });
  }

  private async generateOne(opts: {
    bookId: string;
    pageNumber: number;
    prompt: string;
    template: Story['pages'][number]['template'];
  }): Promise<string> {
    const dalleSize = PAGE_TEMPLATES[opts.template].images[0]?.dalleSize ?? '1024x1024';
    const fullPrompt = `${opts.prompt}${IMAGE_STYLE_SUFFIX}`;

    const result = await generateImage({
      model: openai.imageModel(IMAGE_MODEL),
      prompt: fullPrompt,
      size: dalleSize,
      providerOptions: {
        openai: { quality: 'standard' },
      },
    });

    const buffer = Buffer.from(result.image.base64, 'base64');
    const key = `books/${opts.bookId}/page-${opts.pageNumber}.png`;

    await this.s3.uploadObject({
      key,
      body: buffer,
      contentType: 'image/png',
    });

    this.logger.log(`Generated image for book ${opts.bookId} page ${opts.pageNumber}`);
    return this.s3.getSignedUrl(key);
  }
}
