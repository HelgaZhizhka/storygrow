# Character Personalization & Illustration Style — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the custom (AI) story flow choose the protagonist (the child vs an invented observer character), describe the child's appearance, and pick one of five illustration styles.

**Architecture:** Three new persisted fields (`Child.appearance`, `Book.protagonistMode`, `Book.artStyle`) flow from the new-book form through the books API, into the generation processor, then into the story prompt (protagonist + appearance + gender) and the image generator (style suffix). The previously-added `characterProfile` field keeps the character description identical across pages.

**Tech Stack:** NestJS, Prisma (pgvector), Vercel AI SDK (`generateObject`/`generateImage`), Zod, Next.js (App Router), Jest (backend), Vitest (frontend).

---

## Design reference

Spec: `docs/superpowers/specs/2026-06-05-character-personalization-design.md`

Key decisions:
- `protagonistMode = child`: hero name = child name; appearance from `Child.appearance` (or LLM-invented if blank); gender passed in.
- `protagonistMode = observer`: third-person story about an invented character; child's name and appearance are NOT used.
- Art styles: `watercolor` (default), `cartoon`, `storybook`, `pixel`, `realistic` → image-prompt suffix.
- Bug fix: child `gender` is collected but never reaches generation — wire it through.
- Out of scope: photo/vision agent, reference-image models, child-edit page, art style for fast-flow.

## File structure

| File | Responsibility | Action |
|---|---|---|
| `backend/prisma/schema.prisma` | enums + columns | Modify |
| `backend/src/ai/ai.config.ts` | style suffix map | Modify |
| `backend/src/ai/image-generator/image-generator.service.ts` | apply style suffix | Modify |
| `backend/src/ai/story-generator/story-generator.service.ts` | input type | Modify |
| `backend/src/ai/prompts/story-generator.prompt.ts` | protagonist + appearance + gender | Modify |
| `backend/src/ai/story-generator/story-orchestrator.service.ts` | thread fields | Modify |
| `backend/src/generation/generation.processor.ts` | fetch + pass fields | Modify |
| `backend/src/books/books.controller.ts` | request schemas | Modify |
| `backend/src/books/books.service.ts` | persist fields | Modify |
| `frontend/src/app/(app)/books/new/page.tsx` | form controls | Modify |

---

## Task 1: Prisma schema — enums, columns, migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the two enums after the `BookStatus` enum (after line 77)**

```prisma
enum ProtagonistMode {
  child
  observer
}

enum ArtStyle {
  watercolor
  cartoon
  storybook
  pixel
  realistic
}
```

- [ ] **Step 2: Add `appearance` to the `Child` model**

In `model Child` (around line 37–48), add after the `gender` line:

```prisma
  appearance String?
```

- [ ] **Step 3: Add `protagonistMode` and `artStyle` to the `Book` model**

In `model Book` (around line 52–69), add after the `pdfKey` line:

```prisma
  protagonistMode ProtagonistMode @default(child)
  artStyle        ArtStyle        @default(watercolor)
```

- [ ] **Step 4: Run the migration (uses the HNSW-safe wrapper)**

Run: `pnpm --filter backend prisma:migrate --name add_character_personalization`
Expected: `Applied migration(s)` and `Generated Prisma Client`. The wrapper drops/re-creates the HNSW index around the migration.

- [ ] **Step 5: Verify the generated client has the new fields**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: PASS (no type errors from the new columns).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add appearance, protagonistMode, artStyle columns"
```

---

## Task 2: ai.config — STYLE_SUFFIXES map

**Files:**
- Modify: `backend/src/ai/ai.config.ts:17-18`
- Test: `backend/src/ai/ai.config.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `backend/src/ai/ai.config.spec.ts`:

```typescript
import { STYLE_SUFFIXES, type ArtStyle } from './ai.config';

describe('STYLE_SUFFIXES', () => {
  it('defines a suffix for every art style', () => {
    const keys: ArtStyle[] = ['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic'];
    for (const key of keys) {
      expect(STYLE_SUFFIXES[key]).toMatch(/^,/);
      expect(STYLE_SUFFIXES[key]).toContain('no text in image');
    }
  });

  it('watercolor suffix mentions watercolour', () => {
    expect(STYLE_SUFFIXES.watercolor).toMatch(/watercolour/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- ai.config.spec`
Expected: FAIL — `STYLE_SUFFIXES` is not exported.

- [ ] **Step 3: Replace the `IMAGE_STYLE_SUFFIX` constant**

In `backend/src/ai/ai.config.ts`, replace lines 17–18:

```typescript
export const IMAGE_STYLE_SUFFIX =
  ", flat children's book illustration style, soft pastel colors, warm lighting, no text in image";
```

with:

```typescript
export type ArtStyle = 'watercolor' | 'cartoon' | 'storybook' | 'pixel' | 'realistic';

export const STYLE_SUFFIXES: Record<ArtStyle, string> = {
  watercolor:
    ', soft watercolour painting, children’s book illustration, gentle pastel colours, warm lighting, no text in image',
  cartoon:
    ', flat cartoon illustration, bold clean outlines, bright saturated colours, playful, no text in image',
  storybook:
    ', classic storybook illustration, richly detailed, warm traditional colours, no text in image',
  pixel: ', pixel art, 16-bit retro game style, crisp pixels, vibrant palette, no text in image',
  realistic:
    ', semi-realistic 3D render, soft cinematic lighting, detailed, child-friendly, no text in image',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- ai.config.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/ai.config.ts backend/src/ai/ai.config.spec.ts
git commit -m "feat(ai): add per-style illustration suffix map"
```

---

## Task 3: image-generator — accept and apply artStyle

**Files:**
- Modify: `backend/src/ai/image-generator/image-generator.service.ts`
- Test: `backend/src/ai/image-generator/image-generator.service.spec.ts`

- [ ] **Step 1: Update the test fixture + style assertion**

In `image-generator.service.spec.ts`, the `story` fixture already carries `characterProfile`. Update the two `service.generate({ story, bookId })` style expectations:

Replace the `appends style suffix to each prompt` test body with:

```typescript
  it('appends the artStyle suffix to each prompt', async () => {
    mockGenerateImage.mockResolvedValue({ image: { base64: Buffer.from('x').toString('base64') } });
    mockS3.uploadObject.mockResolvedValue(undefined);

    await service.generate({ story, bookId: 'b', artStyle: 'cartoon' });

    const calls = mockGenerateImage.mock.calls as Array<[{ prompt: string }]>;
    for (const [args] of calls) {
      expect(args.prompt).toMatch(/flat cartoon illustration/);
    }
  });
```

Then update EVERY other `service.generate({ story, bookId: '…' })` call in this file to add `artStyle: 'watercolor'`, e.g. `service.generate({ story, bookId: 'book-1', artStyle: 'watercolor' })`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- image-generator.service.spec`
Expected: FAIL — `artStyle` not in `ImageGenInput`; cartoon suffix not applied.

- [ ] **Step 3: Add `artStyle` to `ImageGenInput` and apply the suffix**

In `image-generator.service.ts`:

Change the import on line 10 from:

```typescript
import { IMAGE_MODEL, IMAGE_QUALITY, IMAGE_STYLE_SUFFIX, GENERATION_MODEL } from '../ai.config';
```

to:

```typescript
import {
  IMAGE_MODEL,
  IMAGE_QUALITY,
  STYLE_SUFFIXES,
  GENERATION_MODEL,
  type ArtStyle,
} from '../ai.config';
```

Change `ImageGenInput` (lines 17–20):

```typescript
export interface ImageGenInput {
  story: Story;
  bookId: string;
  artStyle: ArtStyle;
}
```

In `generate()`, the per-page loop already builds `characterPrefix`. Thread `artStyle` into `generateOne` → `generateWithFallback`. Change the loop body to pass it:

```typescript
      const keys = await Promise.all(
        input.story.pages.map((page, index) =>
          this.generateOne({
            bookId: input.bookId,
            pageNumber: index + 1,
            prompt: `${characterPrefix}${page.illustrationPrompt}`,
            template: page.template,
            artStyle: input.artStyle,
          }),
        ),
      );
```

Add `artStyle: ArtStyle` to the `generateOne` opts type and pass it through to `generateWithFallback`. In `generateWithFallback`, change the `fullPrompt` line from `${IMAGE_STYLE_SUFFIX}` to `${STYLE_SUFFIXES[opts.artStyle]}`, and add `artStyle: ArtStyle` to its opts type.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- image-generator.service.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/image-generator/image-generator.service.ts backend/src/ai/image-generator/image-generator.service.spec.ts
git commit -m "feat(ai): apply selected art style to illustration prompts"
```

---

## Task 4: story prompt + GenerateStoryInput — protagonist, gender, appearance

**Files:**
- Modify: `backend/src/ai/story-generator/story-generator.service.ts`
- Modify: `backend/src/ai/prompts/story-generator.prompt.ts`
- Test: `backend/src/ai/prompts/story-generator.prompt.spec.ts` (create)

- [ ] **Step 1: Write the failing prompt-builder test**

Create `backend/src/ai/prompts/story-generator.prompt.spec.ts`:

```typescript
import { buildStoryUserPrompt } from './story-generator.prompt';

const base = {
  childName: 'Маша',
  childAge: 6,
  topic: 'дружба',
  learningGoal: 'научиться дружить',
  allowedWords: ['маша', 'кот'],
};

describe('buildStoryUserPrompt', () => {
  it('child mode: names the child as the hero and uses appearance', () => {
    const p = buildStoryUserPrompt({
      ...base,
      protagonistMode: 'child',
      gender: 'female',
      appearance: 'brown curly hair, blue dress',
    });
    expect(p).toContain('Маша');
    expect(p).toContain('brown curly hair, blue dress');
    expect(p.toLowerCase()).toContain('protagonist');
  });

  it('observer mode: does NOT use the child name and asks for an invented character', () => {
    const p = buildStoryUserPrompt({
      ...base,
      protagonistMode: 'observer',
      gender: 'female',
      appearance: 'brown curly hair',
    });
    expect(p).not.toContain('Маша');
    expect(p).not.toContain('brown curly hair');
    expect(p.toLowerCase()).toContain('invent');
    expect(p.toLowerCase()).toContain('third person');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- story-generator.prompt.spec`
Expected: FAIL — `buildStoryUserPrompt` does not accept `protagonistMode`.

- [ ] **Step 3: Extend `BuildStoryPromptOptions` and the prompt body**

In `story-generator.prompt.ts`, add to `BuildStoryPromptOptions`:

```typescript
  gender?: string;
  appearance?: string;
  protagonistMode: 'child' | 'observer';
```

Change system-prompt rule 3 (currently "The protagonist's name MUST match the child's name provided in the prompt.") to:

```
3. The protagonist is defined in the user prompt — either the named child or an
   invented character. Follow the user prompt's instruction exactly.
```

In `buildStoryUserPrompt`, build a protagonist block before the existing child-profile lines and replace the illustration/characterProfile instructions:

```typescript
  const { childName, childAge, topic, learningGoal, allowedWords, feedback } = opts;
  const gender = opts.gender ?? 'unspecified';
  const catalogue = buildTemplateCatalogue(childAge);
  const feedbackBlock = feedback
    ? `\nREGENERATION FEEDBACK (fix these issues):\n${feedback}\n`
    : '';

  const protagonistBlock =
    opts.protagonistMode === 'child'
      ? `Protagonist: the child named "${childName}" (age ${childAge}, gender ${gender}).
The hero's name MUST be "${childName}".
Hero appearance: ${opts.appearance && opts.appearance.trim().length > 0 ? opts.appearance : 'invent a fitting, age-appropriate appearance'}.
Set characterProfile to this hero's English visual description.`
      : `Protagonist: an INVENTED character — NOT the child. Do NOT use the name "${childName}".
Invent a name and appearance for an age-${childAge} ${gender === 'unspecified' ? 'child' : gender} character.
Tell the story in third person ("Жил-был…").
Set characterProfile to the invented character's English visual description.`;

  return `
Generate a personalised children's book in Russian.

${protagonistBlock}

  Topic: ${topic}
  Learning goal: ${learningGoal}

${catalogue}

${BOOK_STRUCTURE_RULES}

Allowed vocabulary (Russian words — use ONLY these plus common function words):
${allowedWords.join(', ')}

For each page's illustrationPrompt: write a vivid DALL-E prompt in English with the
scene, mood, colours, and art style ("watercolour, children's book"). The character
profile is added automatically — do NOT repeat it. Keep prompts under 180 characters.
${feedbackBlock}`.trim();
```

- [ ] **Step 4: Add the fields to `GenerateStoryInput`**

In `story-generator.service.ts`, add to `GenerateStoryInput`:

```typescript
  gender?: string;
  appearance?: string;
  protagonistMode: 'child' | 'observer';
```

`generateStory` already spreads `input` into `buildStoryUserPrompt(input)` — no body change needed since the new fields flow through.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter backend test -- story-generator.prompt.spec story-generator.service.spec`
Expected: PASS. (The service spec fixture already passes `validStory`; it needs `protagonistMode` in its input — see next step.)

- [ ] **Step 6: Fix the service spec input**

In `story-generator.service.spec.ts`, the `input: GenerateStoryInput` fixture must include `protagonistMode: 'child'`. Add that line to the fixture object.

Run: `pnpm --filter backend test -- story-generator.service.spec`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/ai/prompts/story-generator.prompt.ts backend/src/ai/prompts/story-generator.prompt.spec.ts backend/src/ai/story-generator/story-generator.service.ts backend/src/ai/story-generator/story-generator.service.spec.ts
git commit -m "feat(ai): protagonist mode, gender and appearance in story prompt"
```

---

## Task 5: orchestrator — thread the new fields through

**Files:**
- Modify: `backend/src/ai/story-generator/story-orchestrator.service.ts`
- Test: `backend/src/ai/story-generator/story-orchestrator.service.spec.ts`

- [ ] **Step 1: Write the failing test**

In `story-orchestrator.service.spec.ts`, after the existing `opts` fixture, add a test that the generator receives `protagonistMode`. Find where `mockGenerator.generateStory` is asserted (or add a new `it`):

```typescript
  it('passes protagonistMode, gender and appearance to the generator', async () => {
    await orchestrator.generate({
      ...opts,
      protagonistMode: 'observer',
      gender: 'male',
      appearance: 'red hair',
    });
    expect(mockGenerator.generateStory).toHaveBeenCalledWith(
      expect.objectContaining({ protagonistMode: 'observer', gender: 'male', appearance: 'red hair' }),
    );
  });
```

Also add `protagonistMode: 'child'` to the existing `opts` fixture so the other tests type-check.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- story-orchestrator.service.spec`
Expected: FAIL — `GenerateStoryOptions` has no `protagonistMode`.

- [ ] **Step 3: Extend `GenerateStoryOptions` and pass through**

In `story-orchestrator.service.ts`, add to `GenerateStoryOptions`:

```typescript
  gender?: string;
  appearance?: string;
  protagonistMode: 'child' | 'observer';
```

In `runLoop`, the call already spreads `...ctx.opts` into `generateStory`, so `protagonistMode`/`gender`/`appearance` flow through automatically. No further change needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter backend test -- story-orchestrator.service.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/story-generator/story-orchestrator.service.ts backend/src/ai/story-generator/story-orchestrator.service.spec.ts
git commit -m "feat(ai): thread protagonist/appearance through orchestrator"
```

---

## Task 6: generation processor — fetch and pass the fields

**Files:**
- Modify: `backend/src/generation/generation.processor.ts`
- Test: `backend/src/generation/generation.processor.spec.ts`

- [ ] **Step 1: Update the test fixture and assertions**

In `generation.processor.spec.ts`, the mocked book (fixture around line 30) must include the new fields. Update the `fetchBook`/prisma mock so `book.child` has `gender` and `appearance`, and `book` has `protagonistMode` and `artStyle`. Add an assertion that the orchestrator and image generator receive them:

```typescript
    expect(mockOrchestrator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ protagonistMode: 'child', gender: 'female', appearance: 'brown hair' }),
    );
    expect(mockImageGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ artStyle: 'watercolor' }),
    );
```

Set the prisma mock's `findUnique` to resolve a book with:
`{ id, storyJson: null, imageKeys: [], child: { name: 'Маша', age: 6, gender: 'female', appearance: 'brown hair' }, learningGoal: { title: 'дружба', description: '…' }, protagonistMode: 'child', artStyle: 'watercolor' }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- generation.processor.spec`
Expected: FAIL — orchestrator/image calls lack the new fields.

- [ ] **Step 3: Extend `BookWithRelations` and the `fetchBook` select**

In `generation.processor.ts`, update the interface (lines 14–20):

```typescript
interface BookWithRelations {
  id: string;
  storyJson: Story | null;
  imageKeys: string[];
  protagonistMode: 'child' | 'observer';
  artStyle: 'watercolor' | 'cartoon' | 'storybook' | 'pixel' | 'realistic';
  child: { name: string; age: number; gender: string | null; appearance: string | null };
  learningGoal: { title: string; description: string };
}
```

Update the `fetchBook` select (lines 144–150):

```typescript
      select: {
        id: true,
        storyJson: true,
        imageKeys: true,
        protagonistMode: true,
        artStyle: true,
        child: { select: { name: true, age: true, gender: true, appearance: true } },
        learningGoal: { select: { title: true, description: true } },
      },
```

- [ ] **Step 4: Pass the fields into orchestrator and image generator**

Update the `orchestrator.generate` call (lines 69–75):

```typescript
        const storyResult = await this.orchestrator.generate({
          bookId,
          childName: book.child.name,
          childAge: book.child.age,
          gender: book.child.gender ?? undefined,
          appearance: book.child.appearance ?? undefined,
          protagonistMode: book.protagonistMode,
          topic: book.learningGoal.title,
          learningGoal: book.learningGoal.description,
        });
```

Update the image generation call (line 97):

```typescript
        imageKeys = await this.imageGenerator.generate({ story, bookId, artStyle: book.artStyle });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter backend test -- generation.processor.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/generation/generation.processor.ts backend/src/generation/generation.processor.spec.ts
git commit -m "feat(generation): pass protagonist, appearance and art style into pipeline"
```

---

## Task 7: books API — accept and persist the new fields

**Files:**
- Modify: `backend/src/books/books.controller.ts:22-32`
- Modify: `backend/src/books/books.service.ts`
- Test: `backend/src/books/books.service.spec.ts`

- [ ] **Step 1: Write the failing service test**

In `books.service.spec.ts`, add tests that `createChild` persists `appearance` and `createBook` persists `protagonistMode`/`artStyle`. Example (adapt to the file's existing prisma mock style):

```typescript
  it('createChild stores appearance', async () => {
    await service.createChild('u1', { name: 'Маша', age: 6, appearance: 'brown hair' });
    expect(mockPrisma.child.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ appearance: 'brown hair' }),
      }),
    );
  });

  it('createBook stores protagonistMode and artStyle', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.book.count.mockResolvedValue(0);
    mockPrisma.book.create.mockResolvedValue({ id: 'b1', status: 'pending', childId: 'c1', learningGoalId: 'g1', createdAt: new Date() });
    await service.createBook('u1', {
      childId: 'c1', learningGoalId: 'g1', mode: 'custom',
      protagonistMode: 'observer', artStyle: 'pixel',
    });
    expect(mockPrisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ protagonistMode: 'observer', artStyle: 'pixel' }),
      }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test -- books.service.spec`
Expected: FAIL — DTOs/persistence lack the new fields.

- [ ] **Step 3: Extend the request schemas in the controller**

In `books.controller.ts`, replace the two schemas (lines 22–32):

```typescript
const createChildSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(1).max(18),
  gender: z.enum(['male', 'female', 'other']).optional(),
  appearance: z.string().max(500).optional(),
});

const createBookSchema = z.object({
  childId: z.string().min(1),
  learningGoalId: z.string().min(1),
  mode: z.enum(['fast', 'custom']),
  protagonistMode: z.enum(['child', 'observer']).default('child'),
  artStyle: z.enum(['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic']).default('watercolor'),
});
```

- [ ] **Step 4: Extend the DTOs and persistence in the service**

In `books.service.ts`, update `CreateChildDto` and `CreateBookDto`:

```typescript
interface CreateChildDto {
  name: string;
  age: number;
  gender?: 'male' | 'female' | 'other';
  appearance?: string;
}

interface CreateBookDto {
  childId: string;
  learningGoalId: string;
  mode: 'fast' | 'custom';
  protagonistMode: 'child' | 'observer';
  artStyle: 'watercolor' | 'cartoon' | 'storybook' | 'pixel' | 'realistic';
}
```

Update `createChild` (lines 42–48) to persist appearance:

```typescript
  createChild(userId: string, dto: CreateChildDto) {
    return this.prisma.child.upsert({
      where: { userId_name: { userId, name: dto.name } },
      create: { userId, name: dto.name, age: dto.age, gender: dto.gender, appearance: dto.appearance },
      update: { age: dto.age, gender: dto.gender, appearance: dto.appearance },
    });
  }
```

Update `createBook` (lines 96–106) to store the two new fields in `data`:

```typescript
    const book = await this.prisma.book.create({
      data: {
        userId,
        childId: dto.childId,
        learningGoalId: dto.learningGoalId,
        title: '',
        status: 'pending',
        protagonistMode: dto.protagonistMode,
        artStyle: dto.artStyle,
      },
      select: { id: true, status: true, childId: true, learningGoalId: true, createdAt: true },
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter backend test -- books.service.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/books/books.controller.ts backend/src/books/books.service.ts backend/src/books/books.service.spec.ts
git commit -m "feat(books): accept and persist appearance, protagonistMode, artStyle"
```

---

## Task 8: frontend new-book form

**Files:**
- Modify: `frontend/src/app/(app)/books/new/page.tsx`

- [ ] **Step 1: Extend the form schema**

In `new/page.tsx`, add to the zod `schema` object (after `mode`):

```typescript
    childAppearance: z.string().optional(),
    protagonistMode: z.enum(['child', 'observer']),
    artStyle: z.enum(['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic']),
```

Update `defaultValues`:

```typescript
    defaultValues: { childOption: 'existing', mode: 'custom', protagonistMode: 'child', artStyle: 'watercolor' },
```

- [ ] **Step 2: Add the appearance textarea to the new-child block**

Inside the `childOption === 'new'` block, after the gender `Field`, add:

```tsx
              <Field label="Как выглядит (необязательно)" error={errors.childAppearance?.message}>
                <textarea
                  rows={2}
                  placeholder="Например: кудрявые каштановые волосы, голубые глаза, красное платье"
                  {...register('childAppearance')}
                  className={inputCls}
                />
              </Field>
```

- [ ] **Step 3: Add protagonist-mode and art-style controls (custom mode only)**

After the `Mode` fieldset, add a block rendered only when `mode === 'custom'`:

```tsx
        {mode === 'custom' && (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Кто главный герой</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input type="radio" value="child" {...register('protagonistMode')} />
                Ребёнок — главный герой
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input type="radio" value="observer" {...register('protagonistMode')} />
                История про другого персонажа
              </label>
            </fieldset>

            <Field label="Стиль иллюстраций">
              <select {...register('artStyle')} className={inputCls}>
                <option value="watercolor">Акварель</option>
                <option value="cartoon">Мультяшный</option>
                <option value="storybook">Книжная иллюстрация</option>
                <option value="pixel">Пиксель-арт</option>
                <option value="realistic">Реалистичный</option>
              </select>
            </Field>
          </>
        )}
```

- [ ] **Step 4: Send the new fields in `onSubmit`**

In `onSubmit`, include `appearance` when creating a new child:

```typescript
        const created = await api.post<Child>('/children', {
          name: values.childName,
          age: values.childAge,
          gender: values.childGender || undefined,
          appearance: values.childAppearance || undefined,
        });
```

And include `protagonistMode`/`artStyle` in the custom book POST:

```typescript
        const book = await api.post<CustomBookResult>('/books', {
          childId,
          learningGoalId: values.learningGoalId,
          mode: 'custom',
          protagonistMode: values.protagonistMode,
          artStyle: values.artStyle,
        });
```

- [ ] **Step 5: Verify the build and lint pass**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint`
Expected: PASS (existing 2 warnings are pre-existing and acceptable).

- [ ] **Step 6: Commit**

```bash
git add "frontend/src/app/(app)/books/new/page.tsx"
git commit -m "feat(web): character appearance, protagonist mode and art style controls"
```

---

## Task 9: Full verification + manual smoke test

- [ ] **Step 1: Run the full smoke check**

Run: `./init.sh`
Expected: `Smoke check PASSED` (tsc + lint + all backend & frontend tests).

- [ ] **Step 2: Manual end-to-end (custom flow)**

With infra and dev servers running:
1. Open the new-book form, choose **Новый** child, fill name/age and an appearance description.
2. Choose **Персонализированный** mode, **История про другого персонажа**, style **Мультяшный**.
3. Create the book and watch progress to `ready`.
4. Open the book — confirm the hero is an invented character (not the child's name) and the illustrations are cartoon-styled and visually consistent.
5. Create a second book with **Ребёнок — главный герой** + **Акварель** and confirm the hero uses the child's name and described appearance.

- [ ] **Step 3: Open the PR**

```bash
git push -u origin issue/character-personalization
gh pr create --title "feat: character personalization + illustration style" --body "Implements docs/superpowers/specs/2026-06-05-character-personalization-design.md"
```

---

## Self-review notes

- **Spec coverage:** protagonist mode (Tasks 1,4,5,6,7,8), appearance (1,4,5,6,7,8), art style (1,2,3,6,7,8), gender wiring (4,6,7,8), characterProfile reuse (pre-existing, applied in Task 3). All spec sections map to tasks.
- **Type consistency:** `protagonistMode: 'child' | 'observer'` and the 5-value `artStyle` union are used identically across config, prompt, orchestrator, processor, service, and controller. Prisma enum values are string-identical to these unions.
- **Out-of-scope respected:** no photo/vision, no reference models, no child-edit page, fast-flow image path untouched (it does not use `ImageGeneratorService`).
