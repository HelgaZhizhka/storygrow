import type { Scene, VisualBible } from '../schemas';
import type { ArtStyle } from '../ai.config';
import { ACTION_MAX_CHARS, STYLE_SUFFIXES } from '../ai.config';

/**
 * Illustration-prompt assembly (#348) — builds a page's image prompt
 * deterministically from the Visual Bible + the page Scene + the page action.
 *
 * DELIBERATELY SHORT. A controlled test on one page (3 samples per shape, same
 * portrait reference, Grok Imagine 2.0) showed the earlier dense prompt —
 * hero-lock "as in reference image k", framing phrase, negatives — put the hero
 * on the slide chute 3/3, while this minimal shape (identity + place + ACTION +
 * style) rendered the correct pose 3/3; a vision judge agreed 6/6. Competing
 * instructions dilute the action and the model latches onto a noun in the
 * setting. Keep it lean: one fixed identity line, the setting, the action LAST
 * and unqualified, then the style. No per-reference mentions — identity is
 * carried by the reference image itself, not by words about it.
 *
 * `labels` are the reference labels actually passed (from `pickReferences`);
 * only 'prev' (the cascade experiment) adds a continuity line.
 */
export interface IllustrationPromptInput {
  bible: VisualBible;
  scene: Scene;
  /** The page ACTION (Prose output). */
  action: string;
  /** Hero look to use: the photo descriptor when present, else the bible hero. */
  heroDescriptor: string;
  artStyle: ArtStyle;
  /** Reference labels aligned to the passed images ('hero' | 'prev' | `cast:<id>` | 'location'). */
  labels: readonly string[];
}

// No hero NAME here on purpose: naming the child in an image prompt makes models
// write the name on a sign/label in the picture (seen: an "Alice" signpost).
// The name belongs to the story text; the image only needs the look.
const heroLine = (input: IllustrationPromptInput): string =>
  input.scene.heroOnPage
    ? `Keep this exact child: ${input.heroDescriptor}. The child appears exactly once.`
    : '';

const castLine = (input: IllustrationPromptInput): string => {
  const parts = input.scene.castIds
    .map((id) => input.bible.cast.find((c) => c.id === id))
    .filter((m): m is VisualBible['cast'][number] => Boolean(m))
    .map((m) => `${m.name} — ${m.descriptor}`);
  return parts.length > 0 ? `Also in the scene: ${parts.join('; ')}.` : '';
};

const settingLine = (input: IllustrationPromptInput): string => {
  const loc =
    input.bible.locations.find((l) => l.id === input.scene.locationId) ?? input.bible.locations[0];
  return `Setting: ${loc ? loc.descriptor : ''}. ${input.bible.atmosphere}.`;
};

// Props are deliberately NOT emitted as their own line. A standalone
// "Visible: a tall red slide…" right before the action made the prop the focal
// subject and put the child ON the slide chute (judge: chute 3/3); without it the
// same page rendered the correct ladder pose 3/3. The action already names what
// the hero interacts with; props stay in the bible for the Plan and sheets.

/** Continuity line only for the cascade experiment (previous page passed as a reference). */
const prevLine = (input: IllustrationPromptInput): string =>
  input.labels.includes('prev')
    ? 'Same place and objects as the previous scene; only the action changes.'
    : '';

/** Ensure the action reads as one sentence so the style suffix never merges into it. */
const asSentence = (text: string): string => {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

export const buildIllustrationPrompt = (input: IllustrationPromptInput): string => {
  const action = asSentence(input.action.slice(0, ACTION_MAX_CHARS));
  const style = STYLE_SUFFIXES[input.artStyle].replace(/^,\s*/, '');
  return [
    heroLine(input),
    castLine(input),
    settingLine(input),
    prevLine(input),
    action,
    `${style.charAt(0).toUpperCase()}${style.slice(1)}.`,
  ]
    .filter(Boolean)
    .join(' ');
};

/**
 * Location establishing-sheet prompt (#348, PR 2): a peopleless reference image
 * of a location, generated once per book and passed as a reference so every page
 * in that place matches. Cast portraits reuse `buildPortraitPrompt` (the cast
 * descriptor as the character), so no separate builder is needed for them.
 */
export const buildLocationSheetPrompt = (
  descriptor: string,
  atmosphere: string,
  artStyle: ArtStyle,
): string =>
  `Establishing shot of ${descriptor}. ${atmosphere}. No people, no animals` +
  STYLE_SUFFIXES[artStyle];
