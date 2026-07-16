/**
 * Text-only generation harness — iterate on story TEXT quality cheaply.
 *
 * Single verbose run: full page text + judge reasoning printed. For systematic
 * multi-goal comparison use eval-batch.ts (#162). Shared run logic lives in
 * lib/eval-run.ts.
 *
 * Usage:
 *   pnpm --filter backend eval:text "<goal>" <age> [child|observer] [--model=<id>]
 * Example:
 *   pnpm --filter backend eval:text "Смелость" 6 child
 *
 * The arc type (virtue|flaw) is taken from the LearningGoal row, so a flaw goal
 * (e.g. Честность) is generated with the flaw beat sheet + exemplar automatically.
 *
 * Traces land in LangFuse when LANGFUSE_PUBLIC_KEY/SECRET_KEY are set (#162).
 */
import '../instrument';
import { shutdownTelemetry } from '../instrument';
import { createEvalServices, runTextEval } from './lib/eval-run';

const main = async (): Promise<void> => {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const goalTitle = positional[0];
  const age = Number(positional[1] ?? '6');
  const mode = (positional[2] ?? 'child') as 'child' | 'observer';
  const modelFlag = process.argv.find((a) => a.startsWith('--model='));
  const model = modelFlag ? modelFlag.slice('--model='.length) : undefined;
  const appearanceFlag = process.argv.find((a) => a.startsWith('--appearance='));
  const appearance = appearanceFlag ? appearanceFlag.slice('--appearance='.length) : undefined;
  const seedFlag = (name: string): string[] => {
    const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
    return flag
      ? flag
          .slice(`--${name}=`.length)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  };
  const seeds = {
    interests: seedFlag('interests'),
    motifs: seedFlag('motifs'),
    favoriteWords: seedFlag('favoriteWords'),
  };
  if (!goalTitle) {
    console.error(
      'Usage: pnpm --filter backend eval:text "<goal>" <age> [child|observer] [--model=<id>]',
    );
    process.exit(1);
  }

  const services = await createEvalServices();
  const { story, checks, arcType, avgChars, maxChars } = await runTextEval(services, {
    goalTitle,
    age,
    mode,
    model,
    appearance,
    seeds,
  });

  console.log(
    `\n=== "${story.title}" | goal=${goalTitle} | arc=${arcType} | age=${age} | mode=${mode} | model=${model ?? 'default'} ===\n`,
  );
  console.log(`characterProfile (image-only): ${story.characterProfile}\n`);
  story.pages.forEach((p, i) => {
    const len = p.text ? ` [${p.text.length}]` : '';
    console.log(`[${i + 1}] ${p.template}${len}\n    ${p.text ?? `(${p.template}, no text)`}`);
    console.log(`    IMG: ${p.illustrationPrompt}\n`);
  });
  const pagesWithText = story.pages.filter((p) => p.text != null).length;
  console.log(`pages w/ text: ${pagesWithText} | avg chars: ${avgChars} | max: ${maxChars}`);
  console.log(`judge scores: ${JSON.stringify(checks.judgeResult.scores)}`);
  console.log(
    `registerMatch (finalScore): ${checks.computedFinalScore}/10 | passed: ${checks.passed}`,
  );
  console.log(`vocabularyCompliance: ${checks.vocabularyCompliance.toFixed(2)}`);
  if (checks.structuralErrors.length > 0) console.log(`structural:`, checks.structuralErrors);
  if (checks.outOfCorpus.length > 0)
    console.log(
      `outOfCorpus (${checks.outOfCorpus.length}): ${checks.outOfCorpus.slice(0, 15).join(', ')}`,
    );
  console.log(`\njudge reasoning: ${checks.judgeResult.reasoning}\n`);

  await services.prisma.$disconnect();
  await shutdownTelemetry();
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
