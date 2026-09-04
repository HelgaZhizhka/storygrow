import type { Scene, VisualBible } from '../schemas';
import type { ArtStyle } from '../ai.config';
import { ACTION_MAX_CHARS, STYLE_SUFFIXES } from '../ai.config';

/**
 * Illustration-prompt assembly (#348) — builds a page's image prompt
 * deterministically from the Visual Bible + the page Scene + the page action,
 * in a fixed block order. This replaces the free-form ≤180-char prompt and the
 * old recurring-creature prose rule: appearance and place now come from ONE
 * fixed description, so nothing drifts.
 *
 * `labels` align 1:1 (by index) with the reference images actually passed to the
 * model (from `pickReferences`); when a label is present the block cites
 * "reference image k" so the model anchors on the picture, not just the words.
 */
export interface IllustrationPromptInput {
  bible: VisualBible;
  scene: Scene;
  /** The page ACTION (Prose output). */
  action: string;
  /** Hero look to use: the photo descriptor when present, else the bible hero. */
  heroDescriptor: string;
  artStyle: ArtStyle;
  /** Reference labels aligned to the passed images ('hero' | `cast:<id>` | 'location'). */
  labels: readonly string[];
}

const FRAMING_PHRASE: Record<Scene['framing'], string> = {
  wide: 'Wide shot showing the whole scene.',
  medium: 'Medium shot.',
  close: 'Close-up on the characters.',
};

/** "(as in reference image k)" when this label was actually passed, else ''. */
const refMention = (labels: readonly string[], label: string): string => {
  const i = labels.indexOf(label);
  return i >= 0 ? ` (as in reference image ${i + 1})` : '';
};

const heroLock = (input: IllustrationPromptInput): string => {
  const name = input.bible.hero.name;
  const once = `${name} appears EXACTLY ONCE in the picture; never draw the hero twice.`;
  // Reinforce the descriptor in TEXT even when the portrait is the reference —
  // the photo flow (#128) relies on named features (e.g. "red glasses") the
  // reference image may under-emphasize; legacy folded them into every page.
  const anchor = input.labels.includes('hero')
    ? `Keep this exact child — same face, hair, and outfit${refMention(input.labels, 'hero')} (${input.heroDescriptor}).`
    : `The hero is ${input.heroDescriptor}.`;
  return `${anchor} ${once}`;
};

const castBlock = (input: IllustrationPromptInput): string => {
  const lines = input.scene.castIds
    .map((id) => {
      const member = input.bible.cast.find((c) => c.id === id);
      if (!member) return '';
      return `${member.name} — ${member.descriptor}${refMention(input.labels, `cast:${id}`)}`;
    })
    .filter(Boolean);
  return lines.length > 0 ? `Also in the scene: ${lines.join('; ')}.` : '';
};

const settingBlock = (input: IllustrationPromptInput): string => {
  const loc =
    input.bible.locations.find((l) => l.id === input.scene.locationId) ?? input.bible.locations[0];
  const place = loc ? loc.descriptor : '';
  return `Setting: ${place}${refMention(input.labels, 'location')}. Time: ${input.scene.timeOfDay}. ${input.bible.atmosphere}.`;
};

const propsBlock = (input: IllustrationPromptInput): string => {
  const descs = input.scene.propIds
    .map((id) => input.bible.props.find((p) => p.id === id)?.descriptor)
    .filter((d): d is string => Boolean(d));
  return descs.length > 0 ? `Visible objects: ${descs.join('; ')}.` : '';
};

/** Continuity line when the previous page is passed as a reference (cascade). */
const prevBlock = (input: IllustrationPromptInput): string => {
  const i = input.labels.indexOf('prev');
  return i >= 0
    ? `Keep the same objects, colours and the same place as in reference image ${i + 1} (the previous scene) — same slide, furniture and background, only the action changes.`
    : '';
};

export const buildIllustrationPrompt = (input: IllustrationPromptInput): string => {
  const action = input.action.slice(0, ACTION_MAX_CHARS);
  const style = STYLE_SUFFIXES[input.artStyle].replace(/^,\s*/, '');
  const blocks = [
    input.scene.heroOnPage ? heroLock(input) : '',
    prevBlock(input),
    castBlock(input),
    settingBlock(input),
    propsBlock(input),
    action,
    FRAMING_PHRASE[input.scene.framing],
    `Style: ${style}.`,
    'No text or letters in the image. No people or animals beyond those described above.',
  ];
  return blocks.filter(Boolean).join(' ');
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
