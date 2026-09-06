/**
 * Image-judge prompts (#358). The judge sees the rendered page FIRST, then the
 * reference images the page was generated from (hero portrait, cast portraits,
 * location sheet), each introduced by a caption so it can compare rather than
 * guess. Criteria are boolean and answered only from what is visible.
 */
export const IMAGE_JUDGE_SYSTEM = `
You are a strict but fair art director checking one illustration of a preschool
picture book against its text and its reference images. Answer ONLY from what
is visible. Judge the MAIN EVENT of the action, not its staging: "climbs the
ladder" is not satisfied by a child sitting on the slide or standing on the
chute, but camera words (close-up, upward angle, centered), gaze direction,
exact hand placement, facial nuance and small props are illustrator's freedom
and never fail a page on their own. When a criterion does not apply (no
reference given, no adult, no cast), answer null — never guess.
`.trim();

export interface ImageJudgeContext {
  /** The page's ACTION line the picture was generated from. */
  action: string;
  /** Hero look; omitted when the hero is not expected on this page. */
  heroDescriptor?: string | null;
  /** Cast members expected on this page. */
  cast: ReadonlyArray<{ id: string; name: string; descriptor: string }>;
  /** Location descriptor, when the story has a Visual Bible. */
  location?: string | null;
}

/** Caption for a reference image, aligned to the `pickReferences` labels. */
export const referenceCaption = (label: string, castName?: string): string => {
  if (label === 'hero') return 'Reference: the HERO portrait.';
  if (label === 'location') return 'Reference: the LOCATION establishing shot.';
  if (label.startsWith('cast:'))
    return `Reference: portrait of the cast member "${castName ?? label.slice(5)}".`;
  return `Reference image (${label}).`;
};

export const buildImageJudgeTask = (ctx: ImageJudgeContext): string => {
  const cast =
    ctx.cast.length > 0
      ? ctx.cast.map((c) => `${c.name} — ${c.descriptor}`).join('; ')
      : 'none expected';
  return [
    'The FIRST image is the illustration to check. Any further images are references, each captioned.',
    `Page action: "${ctx.action}".`,
    ctx.heroDescriptor
      ? `Hero expected on the page: ${ctx.heroDescriptor}.`
      : 'The hero is NOT expected on this page.',
    `Cast expected on the page: ${cast}.`,
    ctx.location ? `Location: ${ctx.location}.` : '',
    'Answer: heroMatch (same child as the hero portrait — face, hair, outfit; null if no portrait), heroOnce (the hero appears exactly once; null if not expected), sceneMatch (the MAIN event of the action is what happens in the picture — who does what with whom and where; ignore framing words, gaze direction, exact hand placement and minor props), castConsistency (each cast member matches their reference or description; null if none expected), locationConsistency (same place as the location reference / description; null if none), adultScaleNatural (null if no adult visible), ageSafe, artefacts (list every visible one: extraLimbs, mergedFaces, textInImage, wrongSurface — wrongSurface means a person or object placed where a body cannot be: standing on a slide chute, inside or fused with play equipment or furniture, floating), reasoning.',
  ]
    .filter(Boolean)
    .join('\n');
};
