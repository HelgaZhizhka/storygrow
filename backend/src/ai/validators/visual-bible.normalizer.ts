import type { PlanPage, Scene, StoryPlan } from '../schemas';

export interface NormalizeResult {
  plan: StoryPlan;
  /** Number of repairs made (dangling ids dropped, hero flags forced). */
  repairs: number;
}

interface BibleIds {
  locations: Set<string>;
  cast: Set<string>;
  props: Set<string>;
  fallbackLocation: string;
  /** Hero names (plan + bible) to detect the hero in a page intent. */
  heroNames: string[];
  /** Cast id → name, to add a cast member the intent names but the scene omits. */
  castNames: Record<string, string>;
}

/**
 * A page whose intent names the hero has the hero on it, whatever the flag says.
 * Seen live: an observer-mode plan set `heroOnPage: false` on "Misha left behind
 * in the foreground" — no portrait was passed and a generic boy was drawn.
 */
const intentNames = (intent: string, names: string[]): boolean => {
  const text = intent.toLowerCase();
  return names.some((name) => name.length > 1 && text.includes(name.toLowerCase()));
};

/** Cast ids the intent names (by the bible name) but the scene left out — same slip as the hero flag. */
const castNamedButMissing = (
  intent: string,
  present: string[],
  castNames: Record<string, string>,
): string[] =>
  Object.entries(castNames)
    .filter(([id, name]) => !present.includes(id) && intentNames(intent, [name]))
    .map(([id]) => id);

/** Drop ids the bible doesn't know and de-duplicate, counting each removal. */
const cleanIds = (ids: string[], known: Set<string>): { kept: string[]; dropped: number } => {
  const seen = new Set<string>();
  const kept: string[] = [];
  let dropped = 0;
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) {
      dropped++;
      continue;
    }
    seen.add(id);
    kept.push(id);
  }
  return { kept, dropped };
};

/** Repair one page's scene against the bible ids; returns the page + repair count. */
const normalizePage = (page: PlanPage, ids: BibleIds): { page: PlanPage; repairs: number } => {
  const scene: Scene = page.scene;
  let repairs = 0;

  let locationId = scene.locationId;
  if (!ids.locations.has(locationId)) {
    locationId = ids.fallbackLocation;
    repairs++;
  }

  const cast = cleanIds(scene.castIds, ids.cast);
  const props = cleanIds(scene.propIds, ids.props);
  const addedCast = castNamedButMissing(page.intent, cast.kept, ids.castNames);
  repairs += cast.dropped + props.dropped + addedCast.length;

  const forceHero =
    page.template === 'cover' ||
    page.template === 'final' ||
    intentNames(page.intent, ids.heroNames);
  const heroOnPage = forceHero && !scene.heroOnPage ? (repairs++, true) : scene.heroOnPage;

  return {
    page: {
      ...page,
      scene: {
        ...scene,
        locationId,
        castIds: [...cast.kept, ...addedCast],
        propIds: props.kept,
        heroOnPage,
      },
    },
    repairs,
  };
};

/**
 * normalizeVisualBible (#348) — deterministic referential repair of a plan's
 * Visual Bible, run right after the Plan phase. Repair over rejection: a
 * dangling id is not worth a full plan regeneration. Every repair is counted so
 * a noisy plan is visible in the logs.
 *
 * Repairs:
 *  - a page's `locationId` that names no bible location → first location;
 *  - `castIds` / `propIds` that name no bible entry → dropped; duplicates removed;
 *  - `cover` and `final` pages → `heroOnPage: true` (the hero always anchors the
 *    opening and closing spread);
 *  - a page whose intent names the hero → `heroOnPage: true` (the portrait must
 *    be passed whenever the hero is drawn);
 *  - a page whose intent names a cast member missing from `castIds` → added (so
 *    the cast sheet is passed and the character is not re-invented from text).
 */
export const normalizeVisualBible = (plan: StoryPlan): NormalizeResult => {
  const ids: BibleIds = {
    locations: new Set(plan.visualBible.locations.map((l) => l.id)),
    cast: new Set(plan.visualBible.cast.map((c) => c.id)),
    props: new Set(plan.visualBible.props.map((p) => p.id)),
    fallbackLocation: plan.visualBible.locations[0]?.id ?? '',
    heroNames: [plan.heroName, plan.visualBible.hero.name],
    castNames: Object.fromEntries(plan.visualBible.cast.map((c) => [c.id, c.name])),
  };
  let repairs = 0;
  const pages = plan.pages.map((page) => {
    const result = normalizePage(page, ids);
    repairs += result.repairs;
    return result.page;
  });
  return { plan: { ...plan, pages }, repairs };
};
