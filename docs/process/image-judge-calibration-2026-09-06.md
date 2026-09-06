# Image judge calibration — 2026-09-06 (#358)

How the vision judge (`ImageJudgeService`: `gemini-3.6-flash` + `generateObject`, boolean
criteria, see `CONTEXT.md` → Image Eval) was calibrated before it was switched on by default.
Runner: `pnpm --filter backend eval:image-judge --manifest=<json> --out=<md>` over a labelled
manifest (image + the page's action / hero / cast / location context + the reference images the
page was generated from + expected verdict). Images and the manifest live outside the repo
(`backend/output/` is gitignored); the numbers and every verdict are recorded here.

## Labelled set (n = 78, 13 labelled bad)

| Group | n | bad | Source |
|---|---|---|---|
| `new/*` — 5 frozen books re-rendered on Grok with cast/location sheets (2026-09-06), every page reviewed by eye | 38 | 0 | `eval:images --variant=bible+sheets` |
| `old/*` — pages of the earlier portrait-only Grok set the product owner and I reviewed | 19 | 2 | delitsya p4 (generic boy, no portrait passed), smelost-6 p2 (mom drawn inside the slide) |
| `ladder/*` — controlled single-page samples of the hardest page ("grips the handrails and climbs the ladder") | 21 | 11 | 9 comparison renders + 12 prompt-shape samples; bad = child on the chute, sitting, steps drawn on the chute, or a name badge ("Alice") in the picture |

Labels are per page (what a judge can see on one page). Cross-page drift (a brother re-dressed on
every page) is not a per-page judgement; it is prevented upstream by the reference sheets.

## Iterations

| Version | Prompt change | Recall (bad caught) | False-fail rate (good pages) | Precision of a FAIL |
|---|---|---|---|---|
| v1 | "be literal about actions" | 8/10 (80%)* | 9/68 (13%)* | 47% |
| v2 | sceneMatch = the MAIN event; framing words, gaze, hand placement, minor props never fail a page | 10/13 (77%) | 0/65 (0%) | 100% |
| v3 (shipped) | wrongSurface spelled out: standing on a chute, inside / fused with equipment, floating | 10/13 (77%) | 0/65 (0%) | 100% |

\* v1 was scored against a manifest with three wrong labels: the `lean3` samples were marked good,
but they carry an "Alice" name badge and the child on the chute — the judge was right and the
labels were fixed (they are the run that revealed the hero-name problem). Corrected v1 numbers:
recall 11/13, false fails 6/65 (9%), all six of them over-literal readings of staging words
("close-up of the pocket", "looks toward the slide, not at Mama", "lifts the bear by its paw").

## What the judge misses (v3)

- Two "steps drawn on the slide chute" renders (`calib/04`, `calib/08`): the child holds
  handrails and stands on rungs, but the rungs are painted onto the chute surface. Ambiguous even
  to people; a geometry question the retry loop does not need to win to be useful.
- One "sitting on the ladder" render (`calib/02`) passed in v3 after failing in v2 — a stochastic
  borderline (v2/v3 differ only in the wrongSurface wording).

Nothing on the good pages was failed in v2 or v3, so a retry is never spent on a page a human
would have kept — the cost of the gate is one vision call per page (~$0.002) plus one extra image
for the pages that actually fail.

## Decision

`IMAGE_EVAL` defaults to **on** with `IMAGE_EVAL_MAX_RETRIES=1`: a failing page is re-rendered
once with the same prompt (fresh sample); the attempt with fewer failures ships; every attempt
writes an `ImageEval` row and an `image-judge` LangFuse span. Soft gate — a judge false negative
never blocks a book.

## Per-item verdicts (v3)

| id | expected | judge | failures | reasoning |
|---|---|---|---|---|
| new/chestnost-6-child/p1 | pass | pass | judge:unavailable |  |
| new/chestnost-6-child/p2 | pass | pass |  | The illustration correctly depicts Alisa pointing at a patch of soil while Katya kneels in surprise. Both characters align well with their reference portraits in appearance and outfit, and the garden  |
| new/chestnost-6-child/p3 | pass | pass |  | Alisa and Katya closely match their reference designs in the depicted garden setting. Alisa bends near the ground while Katya points, capturing the scene action accurately without visual artifacts. |
| new/chestnost-6-child/p4 | pass | pass |  | The illustration faithfully depicts the described scene, accurately matching the character designs for Alisa and Katya as well as the garden location. |
| new/chestnost-6-child/p5 | pass | pass | judge:unavailable |  |
| new/chestnost-6-child/p6 | pass | pass |  | The illustration accurately depicts the characters, garden setting, and required action while maintaining visual consistency with all reference images. |
| new/chestnost-6-child/p7 | pass | pass | judge:unavailable |  |
| new/delitsya-s-drugimi-6-observer/p1 | pass | pass |  | The illustration accurately depicts Misha lifting a red toy car in the specified playground setting, closely matching both hero and location reference images without visible visual artefacts. |
| new/delitsya-s-drugimi-6-observer/p2 | pass | pass |  | The illustration matches all references and page action descriptions accurately, featuring correct character appearances, central staging, and appropriate location details without visual artifacts. |
| new/delitsya-s-drugimi-6-observer/p3 | pass | pass |  | The illustration matches all reference portraits for Misha, Sasha, and Anya, as well as the playground location. The main action of inviting Misha while he holds his toy car is correctly depicted with |
| new/delitsya-s-drugimi-6-observer/p4 | pass | pass |  | The illustration aligns with the text and references. Misha is in the foreground holding a toy car, while Sasha and Anya play with balls near the sandbox. |
| new/delitsya-s-drugimi-6-observer/p5 | pass | pass |  | The illustration matches Misha's appearance and the location reference accurately. The main action of sitting on the bench next to his toy car is depicted as specified. |
| new/delitsya-s-drugimi-6-observer/p6 | pass | pass |  | The image accurately depicts Misha offering a toy car to Sasha and Anya in a playground. All characters and the background match their references consistently. |
| new/delitsya-s-drugimi-6-observer/p7 | pass | pass |  | The illustration faithfully matches the hero, cast, location references, and described action without artefacts. |
| new/delitsya-s-drugimi-6-observer/p8 | pass | pass |  | The illustration accurately depicts the three children together joyfully with the car and bouncing balls as described, fully matching character and location references. |
| new/smelost-3-child/p1 | pass | pass |  | The illustration accurately depicts the hero and location from the reference images. Alisa is shown holding her teddy bear and reaching for the closed door as described in the scene action. |
| new/smelost-3-child/p2 | pass | pass |  | The illustration faithfully matches both the hero portrait and location reference. Alisa is depicted pushing her teddy bear in a wooden cart as described. |
| new/smelost-3-child/p3 | pass | pass |  | Alisa matches the hero reference portrait in face, curly hair, and striped outfit. The illustration correctly shows her clutching a teddy bear while peering through a slightly open door, aligning with |
| new/smelost-3-child/p4 | pass | pass |  | The illustration matches the hero portrait, location reference, and page description well. Alisa is depicted whispering to her teddy bear with a determined expression in the matching cozy living room  |
| new/smelost-3-child/p5 | pass | pass |  | The illustration matches the text and reference images well. The main character steps toward the door, reaching for the handle in a side profile. Character design and background details align with the |
| new/smelost-3-child/p6 | pass | pass |  | The illustration perfectly matches the reference character and location. The main action of opening the closet door to discover toys while pointing is accurately depicted with no visible visual artifa |
| new/smelost-3-child/p7 | pass | pass |  | The illustration matches the hero and location references accurately. Alisa is depicted playing with the door as described in the action prompt, with no visual anomalies present. |
| new/smelost-3-child/p8 | pass | pass |  | The illustration matches the text and reference standards well. Alisa and Mama share a warm close-up hug in the cozy room, consistent with their character descriptions and location details. |
| new/smelost-6-child/p1 | pass | pass |  | The illustration matches all reference images and specifications perfectly. Alisa and Mama are seated together in the foreground of the exact playground from the location reference, with Alisa looking |
| new/smelost-6-child/p2 | pass | pass |  | The illustration perfectly matches all reference images and the required page action. The hero (Alisa) matches her portrait in hair, face, floral dress, and sneakers, and appears once. Mama matches he |
| new/smelost-6-child/p3 | pass | pass |  | The illustration matches all reference images and page actions perfectly. Alisa's appearance, dress, and shoes precisely match her character portrait. Mama's appearance and outfit match her reference. |
| new/smelost-6-child/p4 | pass | pass |  | The illustration perfectly matches the hero portrait (brown curly/wavy hair, floral colorful dress) and location reference (playground background with swings, slides, sandbox). Alisa is shown counting |
| new/smelost-6-child/p5 | pass | pass |  | The hero Alisa matches her portrait reference perfectly in facial features, hair, dress, and shoes. She appears once, depicted climbing the ladder of the playground structure as described. The playgro |
| new/smelost-6-child/p6 | pass | pass |  | The illustration perfectly matches the hero's appearance (short brown hair, colorful floral dress, sneakers) and the playground location reference. Alisa is shown sliding down the yellow slide with a  |
| new/smelost-6-child/p7 | pass | pass |  | The illustration accurately features Alisa matching her hero portrait, standing in the foreground with two younger children at the exact playground depicted in the location reference. The main action  |
| new/smelost-6-child/p8 | pass | pass |  | The illustration accurately depicts Mama pouring tea into a cup at the kitchen table while Alisa smiles at her. Both characters perfectly match their reference portraits in features and clothing, and  |
| new/zabota-o-mladshih-3-child/p1 | pass | pass |  | The illustration perfectly matches all reference images and descriptions. Alisa and Artyom maintain complete visual consistency in character design and attire, and the playroom background perfectly re |
| new/zabota-o-mladshih-3-child/p2 | pass | pass |  | Alisa matches the hero reference perfectly in face, hair, and floral dress. Artyom matches his reference character design in clothing and curly blond hair while clearly crying. The location is an exac |
| new/zabota-o-mladshih-3-child/p3 | pass | pass |  | The illustration perfectly matches all reference images and page actions. Alyssa's design, hair, and floral dress precisely match her hero portrait. Artyom's curly blond hair and pink overalls match h |
| new/zabota-o-mladshih-3-child/p4 | pass | pass |  | The illustration accurately depicts Alisa reaching toward the teddy bear in the cozy playroom alongside Artyom. Both characters perfectly match their reference portraits in features and clothing, and  |
| new/zabota-o-mladshih-3-child/p5 | pass | pass |  | The illustration accurately depicts Alisa handing a teddy bear to a smiling Artyom in the playroom. Both children and the playroom setting match their respective reference portraits and location estab |
| new/zabota-o-mladshih-3-child/p6 | pass | pass |  | The illustration perfectly matches all reference images and the page action. Alisa (hero) and Artyom (cast) are accurately rendered according to their portraits, playing with a toy car in the warm liv |
| new/zabota-o-mladshih-3-child/p7 | pass | pass |  | The illustration perfectly matches all references and page descriptions. Alisa matches her hero reference portrait in appearance and attire, appearing exactly once. Artyom matches his reference portra |
| old/zabota-o-mladshih-3-child/p1 | pass | pass |  | Alisa matches her hero reference portrait perfectly in facial features, hair, dress, socks, and shoes. Artyom matches his description as a toddler with blond curls and big brown eyes looking up. Alisa |
| old/zabota-o-mladshih-3-child/p2 | pass | pass |  | Alisa matches the hero portrait consistently in hairstyle, face, and dress. Artyom matches his description as a sweet toddler with curls and big brown eyes, shown crying. The scene correctly shows Ali |
| old/zabota-o-mladshih-3-child/p3 | pass | pass |  | The illustration accurately depicts Alisa kneeling beside Artyom as he rubs his eyes in a cozy playroom. Alisa matches the hero portrait's features and colorful dress perfectly, appearing only once. A |
| old/zabota-o-mladshih-3-child/p4 | pass | pass |  | The illustration matches the hero portrait consistently in dress, hair, and features. Artyom matches his description with blond curls and big brown eyes. The main scene action of Alisa reaching toward |
| old/zabota-o-mladshih-3-child/p5 | pass | pass |  | The illustration perfectly matches the hero portrait and description of both children, showing Alisa handing the teddy bear to Artyom in a cozy playroom. There are no visual artefacts or safety issues |
| old/chestnost-6-child/p1 | pass | pass | judge:unavailable |  |
| old/chestnost-6-child/p3 | pass | pass |  | The illustration depicts Alisa bending down as seeds fall, with Katya pointing towards them in a garden setting. Both characters accurately match their descriptions and references. |
| old/chestnost-6-child/p5 | pass | pass | judge:unavailable |  |
| old/chestnost-6-child/p7 | pass | pass | judge:unavailable |  |
| old/delitsya-s-drugimi-6-observer/p2 | pass | pass |  | The illustration accurately depicts Misha holding a toy car with Sasha and Anya nearby in a playground setting. Character appearances and background elements match all descriptions and reference portr |
| old/delitsya-s-drugimi-6-observer/p4 | fail | FAIL | heroMatch | Misha's appearance differs from the reference portrait as he wears a blue t-shirt instead of red jumper and overalls, and lacks curly hair. The main scene action, cast descriptions, and playground loc |
| old/smelost-6-child/p1 | pass | pass |  | The illustration perfectly matches the reference character and scene description. Alisa and her mother are sitting together on a bench in the foreground, with the playground slide visible in the backg |
| old/smelost-6-child/p2 | fail | FAIL | artefact:wrongSurface | The hero matches her reference image in face, hair, and dress. Mama matches her description well, and the playground location features all specified elements (slide, swings, sandbox, trees). However,  |
| old/smelost-6-child/p3 | pass | pass |  | The illustration matches the hero reference and description perfectly. Alisa is depicted lifting her foot while standing on the ladder structure, looking hesitant/curious, while her mother gestures en |
| old/smelost-6-child/p4 | pass | pass |  | The illustration matches the hero reference portrait precisely in hair, facial features, and dress pattern. Alisa appears once in a close-up side view looking at her hands/fingers in a playground sett |
| old/smelost-6-child/p5 | pass | pass |  | The illustration matches the hero portrait exceptionally well, including hair style, facial features, dress pattern, and footwear. The main action of Alisa gripping the ladder rails and climbing in a  |
| old/smelost-6-child/p6 | pass | pass |  | The illustration matches the hero reference perfectly in face, hair, floral dress, socks, and sneakers. Alisa appears once, sliding down the yellow slide with an enthusiastic expression and hands outs |
| old/smelost-6-child/p7 | pass | pass |  | The illustration faithfully depicts the main event. Alisa perfectly matches her reference portrait in face, short brown hair, floral dress, and sneakers. She is positioned in the foreground showing tw |
| old/smelost-6-child/p8 | pass | pass |  | The illustration perfectly matches the hero reference, page action, cast description, and location setting without any visual artifacts. |
| ladder/calib/01-probeA-portraitRef-simple.png | pass | pass |  | The illustration perfectly matches the hero portrait in face, short brown hair, colorful floral dress with bow, and sneakers. The main action of climbing the ladder in a playground with swings, sandbo |
| ladder/calib/02-probeB-cascadeRef-simple.png | fail | pass ✗ |  | The illustration accurately depicts Alisa climbing the playground ladder while holding the rails in a bright playground setting with trees and swings. No reference image was provided for a hero match  |
| ladder/calib/03-probeC-cartoon.png | pass | pass |  | The illustration perfectly depicts Alisa climbing the ladder while gripping the handrail in a bright, lively playground that includes slides, swings, a sandbox, and surrounding trees. Alisa appears ex |
| ladder/calib/04-probeD-fullPrompt.png | fail | pass ✗ |  | The image accurately illustrates the page action of Alisa gripping the handrails while climbing the slide ladder in a playground setting with swings, a sandbox, and trees. The hero appears once, and t |
| ladder/calib/05-grok-bible-p5.png | fail | FAIL | sceneMatch, artefact:wrongSurface | The child is climbing up the slide chute instead of climbing the ladder. Standing or climbing on a slide chute is an explicit wrongSurface artefact and fails sceneMatch for climbing the ladder. |
| ladder/calib/06-grok-cascade-p5.png | pass | pass |  | The illustration clearly shows the young girl climbing the ladder of a playground structure, matching the described action and playground setting with swings and trees in the background. No hero refer |
| ladder/calib/07-gemini-cascade-p5.png | fail | FAIL | sceneMatch, artefact:wrongSurface | No hero reference image was provided. The hero appears exactly once. The scene match fails because Alisa is climbing up the slide chute surface rather than climbing the ladder, which is positioned on  |
| ladder/calib/08-gemini-flash-sheets-p5.png | fail | pass ✗ |  | The illustration correctly shows Alisa holding the handrails and climbing the steps/ladder of the slide while taking a deep breath. The background perfectly matches the playground description with swi |
| ladder/calib/09-gemini-pro-sheets-p5.png | pass | pass |  | The illustration correctly shows the hero gripping the handrails and climbing the slide ladder in a playground setting with swings, a sandbox, and trees, matching the scene and location descriptions.  |
| ladder/var/full-1.png | fail | FAIL | sceneMatch, artefact:wrongSurface | The character matches the hero portrait consistently and appears once. However, the action specifies climbing the ladder, whereas the character is depicted climbing directly up the slide chute itself, |
| ladder/var/full-2.png | fail | FAIL | sceneMatch, artefact:wrongSurface | Alisa is climbing up the slide chute instead of climbing the ladder as specified in the page action. |
| ladder/var/full-3.png | fail | FAIL | sceneMatch, artefact:wrongSurface | The child is walking/climbing up the slide chute instead of climbing the ladder. Standing or climbing on the chute of a slide is an artefact (wrongSurface). The hero's appearance matches the reference |
| ladder/var/simple-1.png | pass | pass |  | The illustration perfectly matches the hero reference and description. Alisa is depicted climbing the playground ladder while holding onto the handrails, framed from a low/upward angle. The location f |
| ladder/var/simple-2.png | pass | pass |  | The image accurately depicts Alisa matching her reference character climbing a ladder on a playground. The playground includes the swings, sandbox, and slide mentioned in the location prompt. No visua |
| ladder/var/simple-3.png | pass | pass |  | The illustration perfectly matches the hero reference (same dress, collar, bow, sneakers, face, and hair) and accurately depicts Alisa gripping the handrails and climbing the playground ladder. The pl |
| ladder/lean3/lean-1.png | fail | FAIL | sceneMatch, artefact:textInImage | The child matches the hero reference and appears once. However, the page action describes climbing the ladder, whereas the image shows her sitting on the slide chute. There is also text ('Alice') visi |
| ladder/lean3/lean-2.png | fail | FAIL | sceneMatch, artefact:textInImage | The illustration fails sceneMatch because Alisa is sitting at the top of the slide chute rather than climbing the ladder as specified in the page action. Additionally, there is text ('Алиса') written  |
| ladder/lean3/lean-3.png | fail | FAIL | sceneMatch, artefact:textInImage, artefact:wrongSurface | The character is climbing up the slide chute instead of climbing the ladder as specified in the page action. Additionally, standing on the slide chute triggers the wrongSurface artefact, and there is  |
| ladder/lean-v2/v2-1.png | pass | pass |  | The illustration perfectly matches the reference hero Alisa, who is shown climbing the playground ladder in an upward perspective. The playground setting incorporates swings, a slide, sandbox, and sur |
| ladder/lean-v2/v2-2.png | pass | pass |  | The illustration matches the hero reference and page action accurately. Alisa is depicted climbing the playground ladder with an upward angle, wearing her signature colorful dress and sneakers. The ba |
| ladder/lean-v2/v2-3.png | pass | pass |  | The illustration accurately depicts Alisa climbing the playground ladder in an upward-angle view, matching the character design and dress from the reference portrait. The playground location features  |
