import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { openai } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import { PrismaClient } from '../generated/prisma/client';
import { IMAGE_MODEL, IMAGE_QUALITY, STYLE_SUFFIXES } from '../ai/ai.config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ALL_TAGS, type IllustrationTag } from '../fast-flow/tag-taxonomy';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? '',
    secretAccessKey: process.env.S3_SECRET_KEY ?? '',
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET ?? 'storygrow';

const FAST_ILLUSTRATION_PROMPT_PREFIX = "Children's book illustration: ";

// GitHub Actions sets CI=true for every job. verify.sh's Postgres/MinIO are
// always empty in CI (a fresh runner each time), so the idempotency check
// below never finds an existing row there -- without this, every CI run
// re-generates all 44 illustrations for real, on a real (tiny, course) OpenAI
// budget, regardless of merge frequency. A 1x1 placeholder is enough for the
// e2e's own assertions (the PDF renders, the button appears) -- it never
// inspects image content. Local dev is unaffected: CI is unset there, and the
// idempotency check already skips already-seeded tags.
const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const TAG_PROMPT_MAP: Record<IllustrationTag, string> = {
  boy: 'a cheerful young boy with a backpack, smiling',
  girl: 'a happy young girl with braids, laughing',
  mom: 'a kind mother with warm eyes, wearing an apron',
  dad: 'a friendly father with a big smile, wearing casual clothes',
  cat: 'a fluffy orange cat sitting curiously',
  dog: 'a friendly golden puppy wagging its tail',
  bear: 'a small brown teddy bear with a bowtie',
  rabbit: 'a white bunny with pink ears hopping in a meadow',
  happy: 'two children laughing and playing together joyfully',
  sad: 'a child sitting alone looking thoughtful and a little sad',
  scared: 'a child hiding under the blanket at night, wide eyes',
  proud: 'a child standing tall, beaming with pride',
  curious: 'a child peeking around a corner with big curious eyes',
  bedroom: "a cozy child's bedroom with soft lamp light, toys on shelves",
  forest: 'a bright sunny forest path with tall trees and flowers',
  kitchen: 'a warm family kitchen with colorful tiles and plants',
  park: 'a sunny park with a bench, green grass and a fountain',
  school: 'a bright classroom with colourful posters and small desks',
  sharing: 'two children sharing a toy, both smiling warmly',
  helping: 'a child helping to carry groceries up stairs',
  playing: 'children playing with a ball on a playground',
  sleeping: 'a child sleeping peacefully with a stuffed animal',
};

async function generateReal(tag: IllustrationTag): Promise<Buffer> {
  const prompt = FAST_ILLUSTRATION_PROMPT_PREFIX + TAG_PROMPT_MAP[tag] + STYLE_SUFFIXES.watercolor;

  const result = await generateImage({
    model: openai.imageModel(IMAGE_MODEL),
    prompt,
    size: '1024x1024',
    maxRetries: 1,
    providerOptions: { openai: { quality: IMAGE_QUALITY } },
  });

  return Buffer.from(result.image.base64, 'base64');
}

async function generateOne(tag: IllustrationTag, variation: number): Promise<string> {
  const buffer = process.env['CI']
    ? Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64')
    : await generateReal(tag);
  const key = `fast-flow-illustrations/${tag}-v${variation}.png`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
    }),
  );

  return `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
}

async function main(): Promise<void> {
  const VARIATIONS = 2;
  console.log(
    `Seeding fast-flow illustrations: ${ALL_TAGS.length} tags × ${VARIATIONS} variations`,
  );

  for (const tag of ALL_TAGS) {
    for (let v = 1; v <= VARIATIONS; v++) {
      const variantKey = `${tag}-v${v}`;
      const existing = await prisma.fastIllustration.findFirst({
        where: { tags: { has: variantKey } },
      });
      if (existing) {
        console.log(`  ↩ ${tag} v${v} already seeded`);
        continue;
      }

      try {
        const url = await generateOne(tag, v);
        await prisma.fastIllustration.create({ data: { url, tags: [tag, variantKey] } });
        console.log(`  ✓ ${tag} v${v}`);
      } catch (err) {
        console.error(`  ✗ ${tag} v${v}: ${String(err)}`);
      }
    }
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => pool.end());
