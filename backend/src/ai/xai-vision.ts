import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { XAI_BASE_URL, XAI_VISION_MODEL } from './ai.config';

/**
 * The Grok vision model as an AI-SDK language model (#397). xAI's chat API is
 * OpenAI-compatible, so `createOpenAI` with xAI's baseURL gives us `generateObject`
 * with a Zod schema and no new dependency. Used where Gemini's content filter
 * blocked benign child imagery: the photo descriptor (#397 step 1) and, once
 * recalibrated, the image judge (step 2).
 */
export const createXaiVisionModel = (apiKey: string): LanguageModel =>
  createOpenAI({ apiKey, baseURL: XAI_BASE_URL })(XAI_VISION_MODEL);
