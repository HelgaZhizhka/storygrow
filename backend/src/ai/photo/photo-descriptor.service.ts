import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject, type LanguageModel } from 'ai';
import { PhotoDescriptorSchema, type PhotoDescriptor } from '../schemas/photo-descriptor.schema';
import { PHOTO_DESCRIPTOR_SYSTEM, PHOTO_DESCRIPTOR_TASK } from '../prompts/photo-descriptor.prompt';
import { createTelemetry } from '../telemetry';
import { createXaiVisionModel } from '../xai-vision';

export interface DescribePhotoInput {
  photo: Uint8Array;
  mimeType: string;
  bookId: string;
}

@Injectable()
export class PhotoDescriptorService {
  private readonly model: LanguageModel;

  // Grok-4 vision (#397): Gemini's content filter blocked benign child photos
  // (measured 4/4 on a real photo), surfacing as a 503 on upload. Grok reads the
  // same photo; xAI's chat API is OpenAI-compatible, so generateObject + Zod are
  // unchanged.
  constructor(config: ConfigService) {
    this.model = createXaiVisionModel(config.getOrThrow<string>('XAI_API_KEY'));
  }

  // One vision call: gates on a child's face AND extracts the editable descriptor.
  // The photo bytes are NEVER put in telemetry metadata (privacy — spec 5).
  async describePhoto(input: DescribePhotoInput): Promise<PhotoDescriptor> {
    const { object } = await generateObject({
      model: this.model,
      schema: PhotoDescriptorSchema,
      system: PHOTO_DESCRIPTOR_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PHOTO_DESCRIPTOR_TASK },
            { type: 'image', image: input.photo, mediaType: input.mimeType },
          ],
        },
      ],
      experimental_telemetry: createTelemetry('photo.descriptor', { bookId: input.bookId }),
    });
    return object;
  }
}
