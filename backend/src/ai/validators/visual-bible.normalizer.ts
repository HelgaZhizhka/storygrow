import type { StoryPlan } from '../schemas';
import type { Scene } from '../schemas';

export interface NormalizeResult {
  plan: StoryPlan;
  /** Number of repairs made (dangling ids dropped, hero flags forced). */
  repairs: number;
}

/**
 * normalizeVisualBible (#348) — deterministic referential repair of a plan's
 * Visual Bible, run right after the Plan phase. Repair over rejection: a
 * dangling id is not worth a full plan regeneration. Every repair is counted so
 * a noisy plan is visible on the `story-planner` span (`bibleRepairs`).
 *
 * Repairs:
 *  - a page's `locationId` that names no bible location → first location;
 *  - `castIds` / `propIds` that name no bible entry → dropped; duplicates removed;
 *  - `cover` and `final` pages → `heroOnPage: true` (the hero always anchors the
 *    opening and closing spread).
 */
export const normalizeVisualBible = (plan: StoryPlan): NormalizeResult => {
  const locationIds = new Set(plan.visualBible.locations.map((l) => l.id));
  const castIds = new Set(plan.visualBible.cast.map((c) => c.id));
  const propIds = new Set(plan.visualBible.props.map((p) => p.id));
  const fallbackLocation = plan.visualBible.locations[0]?.id ?? '';
  let repairs = 0;

  const cleanIds = (ids: string[], known: Set<string>): string[] => {
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const id of ids) {
      if (!known.has(id) || seen.has(id)) {
        repairs++;
        continue;
      }
      seen.add(id);
      kept.push(id);
    }
    return kept;
  };

  const pages = plan.pages.map((page) => {
    const scene: Scene = page.scene;
    let locationId = scene.locationId;
    if (!locationIds.has(locationId)) {
      locationId = fallbackLocation;
      repairs++;
    }
    const forceHero = page.template === 'cover' || page.template === 'final';
    const heroOnPage = forceHero && !scene.heroOnPage ? (repairs++, true) : scene.heroOnPage;
    return {
      ...page,
      scene: {
        ...scene,
        locationId,
        castIds: cleanIds(scene.castIds, castIds),
        propIds: cleanIds(scene.propIds, propIds),
        heroOnPage,
      },
    };
  });

  return { plan: { ...plan, pages }, repairs };
};
