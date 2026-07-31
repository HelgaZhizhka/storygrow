import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { PhotoDescriptorSchema, type PhotoDescriptor } from '../schemas/photo-descriptor.schema';
import { PHOTO_DESCRIPTOR_SYSTEM, PHOTO_DESCRIPTOR_TASK } from '../prompts/photo-descriptor.prompt';
import { createTelemetry } from '../telemetry';
import { GEMINI_VISION_MODEL } from '../ai.config';

export interface DescribePhotoInput {
  photo: Uint8Array;
  mimeType: string;
  bookId: string;
}

@Injectable()
export class PhotoDescriptorService {
  private readonly google: GoogleGenerativeAIProvider;

  constructor(config: ConfigService) {
    this.google = createGoogleGenerativeAI({
      apiKey: config.getOrThrow<string>('GOOGLE_GENERATIVE_AI_API_KEY'),
    });
  }

  // One vision call: gates on a child's face AND extracts the editable descriptor.
  // The photo bytes are NEVER put in telemetry metadata (privacy — spec 5).
  async describePhoto(input: DescribePhotoInput): Promise<PhotoDescriptor> {
    const { object } = await generateObject({
      model: this.google(GEMINI_VISION_MODEL),
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
