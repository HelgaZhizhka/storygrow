import { generateText, type LanguageModel } from 'ai';
import { SIMPLIFY_ILLUSTRATION_SYSTEM_PROMPT } from '../prompts/image-prompt-simplifier.prompt';

export const simplifyIllustrationPrompt = async (
  rejectedPrompt: string,
  model: LanguageModel,
  telemetry?: Parameters<typeof generateText>[0]['experimental_telemetry'],
): Promise<string> => {
  const { text } = await generateText({
    model,
    system: SIMPLIFY_ILLUSTRATION_SYSTEM_PROMPT,
    prompt: `Rejected prompt: "${rejectedPrompt}"\n\nProvide a safer rephrasing:`,
    experimental_telemetry: telemetry,
  });
  return text.trim();
};
