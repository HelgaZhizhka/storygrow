import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';
import { templateContentSchema, type TemplateContent } from '../fast-flow/template-content.schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface TemplateDefinition {
  goalTitle: string;
  title: string;
  content: TemplateContent;
  illustrationTags: string[];
}

const TEMPLATES: TemplateDefinition[] = [
  {
    goalTitle: 'Делиться',
    title: 'Маленький {{childName}} учится делиться',
    illustrationTags: ['sharing', 'happy', 'park', 'boy', 'girl'],
    content: templateContentSchema.parse({
      pages: [
        {
          pageNumber: 1,
          text: '{{childName}} вышел гулять в парк. В руках у него была большая красивая игрушка.',
          illustrationTag: 'park',
        },
        {
          pageNumber: 2,
          text: 'Рядом сидела девочка и грустно смотрела. У неё не было игрушек.',
          illustrationTag: 'sad',
        },
        {
          pageNumber: 3,
          text: '{{childName}} подумал немного и протянул ей свою игрушку: «Хочешь поиграть вместе?»',
          illustrationTag: 'sharing',
        },
        {
          pageNumber: 4,
          text: 'Девочка улыбнулась. Они играли вместе весь день и стали друзьями.',
          illustrationTag: 'happy',
        },
        {
          pageNumber: 5,
          text: 'Когда {{childName}} вернулся домой, он чувствовал себя по-настоящему счастливым. Делиться — значит дарить радость.',
          illustrationTag: 'happy',
        },
      ],
    }),
  },
  {
    goalTitle: 'Не бояться темноты',
    title: '{{childName}} и страх темноты',
    illustrationTags: ['scared', 'bedroom', 'happy', 'bear'],
    content: templateContentSchema.parse({
      pages: [
        {
          pageNumber: 1,
          text: 'Каждый вечер, когда гасили свет, {{childName}} боялся темноты в своей комнате.',
          illustrationTag: 'bedroom',
        },
        {
          pageNumber: 2,
          text: 'Ему казалось, что в углу кто-то прячется. Сердце билось часто-часто.',
          illustrationTag: 'scared',
        },
        {
          pageNumber: 3,
          text: 'Однажды мама дала ему маленького плюшевого медведя. «Он будет охранять тебя», — сказала она.',
          illustrationTag: 'bear',
        },
        {
          pageNumber: 4,
          text: '{{childName}} прижал медведя покрепче и закрыл глаза. Темнота уже не казалась такой страшной.',
          illustrationTag: 'bedroom',
        },
        {
          pageNumber: 5,
          text: 'Скоро {{childName}} понял: темнота — просто отсутствие света. Бояться нечего, когда рядом друг.',
          illustrationTag: 'happy',
        },
        {
          pageNumber: 6,
          text: 'Теперь {{childName}} засыпает спокойно. Темнота стала его другом.',
          illustrationTag: 'sleeping',
        },
      ],
    }),
  },
  {
    goalTitle: 'Помогать близким',
    title: '{{childName}} помогает маме',
    illustrationTags: ['helping', 'kitchen', 'happy', 'mom'],
    content: templateContentSchema.parse({
      pages: [
        {
          pageNumber: 1,
          text: 'Мама пришла домой очень уставшей. Она работала весь день.',
          illustrationTag: 'mom',
        },
        {
          pageNumber: 2,
          text: '{{childName}} увидел это и решил помочь. Он убрал свои игрушки без напоминания.',
          illustrationTag: 'helping',
        },
        {
          pageNumber: 3,
          text: 'Потом {{childName}} пошёл на кухню и накрыл стол к ужину.',
          illustrationTag: 'kitchen',
        },
        {
          pageNumber: 4,
          text: 'Когда мама зашла на кухню, она увидела накрытый стол. Её глаза засветились от радости.',
          illustrationTag: 'happy',
        },
        {
          pageNumber: 5,
          text: '«Спасибо, моё солнышко», — сказала мама и крепко обняла {{childName}}.',
          illustrationTag: 'mom',
        },
        {
          pageNumber: 6,
          text: '{{childName}} понял: помогать тем, кого любишь, — это и есть настоящая любовь.',
          illustrationTag: 'happy',
        },
      ],
    }),
  },
  {
    goalTitle: 'Знакомиться и дружить',
    title: '{{childName}} и новый друг',
    illustrationTags: ['curious', 'school', 'happy', 'playing'],
    content: templateContentSchema.parse({
      pages: [
        {
          pageNumber: 1,
          text: 'В первый день в новой школе {{childName}} никого не знал. Все дети уже дружили между собой.',
          illustrationTag: 'school',
        },
        {
          pageNumber: 2,
          text: '{{childName}} сел в стороне и наблюдал за другими. Ему было немного грустно.',
          illustrationTag: 'sad',
        },
        {
          pageNumber: 3,
          text: 'Один мальчик подошёл и сказал: «Привет! Хочешь поиграть с нами?» {{childName}} удивился.',
          illustrationTag: 'curious',
        },
        {
          pageNumber: 4,
          text: 'Они вместе побежали на площадку. Смеялись, играли, придумывали игры.',
          illustrationTag: 'playing',
        },
        {
          pageNumber: 5,
          text: 'К концу дня у {{childName}} уже был новый друг. Знакомиться — не страшно, если улыбнуться первым.',
          illustrationTag: 'happy',
        },
      ],
    }),
  },
  {
    goalTitle: 'Честность',
    title: '{{childName}} говорит правду',
    illustrationTags: ['proud', 'sad', 'happy', 'school'],
    content: templateContentSchema.parse({
      pages: [
        {
          pageNumber: 1,
          text: 'На уроке {{childName}} случайно сломал карандаш одноклассника.',
          illustrationTag: 'school',
        },
        {
          pageNumber: 2,
          text: 'Можно было притвориться, что не заметил. Но {{childName}} чувствовал себя неловко.',
          illustrationTag: 'sad',
        },
        {
          pageNumber: 3,
          text: 'Он подошёл к однокласснику и сказал: «Я сломал твой карандаш. Прости, пожалуйста».',
          illustrationTag: 'proud',
        },
        {
          pageNumber: 4,
          text: 'Одноклассник улыбнулся: «Ничего страшного. Хорошо, что ты сказал».',
          illustrationTag: 'happy',
        },
        {
          pageNumber: 5,
          text: '{{childName}} почувствовал облегчение. Говорить правду бывает непросто, но всегда лучше.',
          illustrationTag: 'proud',
        },
        {
          pageNumber: 6,
          text: 'С тех пор {{childName}} всегда выбирал честность. Ведь честные люди вызывают настоящее доверие.',
          illustrationTag: 'happy',
        },
      ],
    }),
  },
];

async function main(): Promise<void> {
  console.log('Seeding fast-flow templates…');

  for (const def of TEMPLATES) {
    const goal = await prisma.learningGoal.findFirst({
      where: { title: { contains: def.goalTitle, mode: 'insensitive' } },
    });

    if (!goal) {
      console.warn(`LearningGoal not found for: "${def.goalTitle}" — skipping`);
      continue;
    }

    await prisma.template.upsert({
      where: { id: `fast-flow-${goal.id}` },
      create: {
        id: `fast-flow-${goal.id}`,
        title: def.title,
        content: def.content,
        learningGoalId: goal.id,
        illustrationTags: def.illustrationTags,
      },
      update: {
        title: def.title,
        content: def.content,
        illustrationTags: def.illustrationTags,
      },
    });

    console.log(`  ✓ ${def.title}`);
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => pool.end());
