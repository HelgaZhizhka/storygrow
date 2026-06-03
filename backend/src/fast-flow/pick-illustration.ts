export interface IllustrationRecord {
  id: string;
  url: string;
  tags: string[];
}

export function pickIllustration(
  illustrations: IllustrationRecord[],
  tags: string[],
): IllustrationRecord | null {
  if (illustrations.length === 0 || tags.length === 0) return null;

  const tagSet = new Set(tags);

  let best: IllustrationRecord | null = null;
  let bestScore = -1;

  for (const illus of illustrations) {
    const score = illus.tags.filter((t) => tagSet.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = illus;
    }
  }

  return best;
}
