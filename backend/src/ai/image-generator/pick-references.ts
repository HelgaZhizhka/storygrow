import type { Scene } from '../schemas';

/**
 * Reference labels align 1:1 with the picked images by index, so the prompt
 * assembler can say "(as in reference image k)" for the right entry.
 *   'hero'        → the hero portrait
 *   'prev'        → the previous page's illustration (cascade)
 *   `cast:${id}`  → a cast member's portrait sheet
 *   'location'    → the location establishing sheet
 */
export type RefLabel = string;

export interface ReferenceSources {
  /** Hero portrait bytes — pass only when the hero is on the page and a portrait exists. */
  heroPortrait?: Uint8Array;
  /** The previous page's rendered image (cascade experiment) — carries objects/setting forward. */
  previousPage?: Uint8Array;
  /** Cast id → portrait sheet bytes (PR2). */
  castSheets?: Record<string, Uint8Array | undefined>;
  /** Establishing sheet for the page's location (PR2). */
  locationSheet?: Uint8Array;
}

export interface PickedReferences {
  images: Uint8Array[];
  labels: RefLabel[];
}

/**
 * pickReferences (#348) — choose the input reference images for one page within
 * the model's reference budget. Priority: hero → previous page → cast (in scene
 * order) → location. The previous page ranks high because it carries the whole
 * scene's objects/setting forward (cascade); faces then outrank the location
 * sheet. Whatever does not fit is carried by text only. Pure function.
 */
export const pickReferences = (opts: {
  scene: Scene;
  sources: ReferenceSources;
  budget: number;
}): PickedReferences => {
  const { scene, sources, budget } = opts;
  const images: Uint8Array[] = [];
  const labels: RefLabel[] = [];

  const push = (image: Uint8Array | undefined, label: RefLabel): void => {
    if (image && images.length < budget) {
      images.push(image);
      labels.push(label);
    }
  };

  if (scene.heroOnPage) push(sources.heroPortrait, 'hero');
  push(sources.previousPage, 'prev');
  for (const id of scene.castIds) push(sources.castSheets?.[id], `cast:${id}`);
  push(sources.locationSheet, 'location');

  return { images, labels };
};
