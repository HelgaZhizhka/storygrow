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
    title: '{{childName}} учится делиться',
    illustrationTags: ['sharing', 'happy', 'park', 'boy', 'girl'],
    content: templateContentSchema.parse({
      pages: [
        {
          pageNumber: 1,
          text: 'Однажды утром {{childName}} {{собрался|собралась}} на прогулку в парк. {{Он|Она}} {{взял|взяла}} с собой любимую игрушку — большого яркого робота. Солнышко светило, птицы пели, и настроение было отличным.',
          illustrationTag: 'park',
        },
        {
          pageNumber: 2,
          text: 'В парке на скамейке сидел{{|а}} маленьк{{ий|ая}} ребёнок и смотрел{{|а}} на землю. Рядом не было ни игрушек, ни друзей. {{childName}} заметил{{|а}} это и на секунду остановил{{ся|ась}}. «Почему {{он|она}} так{{ой|ая}} грустн{{ый|ая}}?» — {{подумал|подумала}} {{childName}}.',
          illustrationTag: 'sad',
        },
        {
          pageNumber: 3,
          text: '{{childName}} немного {{помедлил|помедлила}} — ведь робот был таким любимым! Но потом {{решительно|решительно}} подош{{ёл|ла}} и протянул{{|а}} игрушку: «Привет! Хочешь поиграть вместе? Я {{childName}}». Незнаком{{ый|ая}} малыш{{|ка}} удивлённо посмотрел{{|а}} и робко улыбнул{{ся|ась}}.',
          illustrationTag: 'sharing',
        },
        {
          pageNumber: 4,
          text: 'Они играли весь день: строили башни из шишек, бегали наперегонки и придумывали истории про робота-путешественника. Когда пришло время расходиться, новый друг сказал{{|а}}: «Это был лучший день! Спасибо, {{childName}}!» — и они договорились встретиться снова.',
          illustrationTag: 'happy',
        },
        {
          pageNumber: 5,
          text: 'Вечером {{childName}} {{лежал|лежала}} в кровати и улыбал{{ся|ась}}. Робот стоял рядом — такой же любимый, как всегда. Но теперь {{он|она}} знал{{|а}}: когда делишься с другими, радости становится вдвое больше. Делиться — значит дарить частичку себя.',
          illustrationTag: 'happy',
        },
      ],
    }),
  },
  {
    goalTitle: 'Преодоление страха темноты',
    title: '{{childName}} и страх темноты',
    illustrationTags: ['scared', 'bedroom', 'happy', 'bear'],
    content: templateContentSchema.parse({
      pages: [
        {
          pageNumber: 1,
          text: 'Каждый вечер, когда гасили свет, {{childName}} боял{{ся|ась}} темноты в своей комнате.',
          illustrationTag: 'bedroom',
        },
        {
          pageNumber: 2,
          text: '{{Ему|Ей}} казалось, что в углу кто-то прячется. Сердце билось часто-часто.',
          illustrationTag: 'scared',
        },
        {
          pageNumber: 3,
          text: 'Однажды мама дала {{ему|ей}} маленького плюшевого медведя. «Он будет охранять тебя», — сказала она.',
          illustrationTag: 'bear',
        },
        {
          pageNumber: 4,
          text: '{{childName}} прижал{{|а}} медведя покрепче и закрыл{{|а}} глаза. Темнота уже не казалась такой страшной.',
          illustrationTag: 'bedroom',
        },
        {
          pageNumber: 5,
          text: 'Скоро {{childName}} пон{{ял|яла}}: темнота — просто отсутствие света. Бояться нечего, когда рядом друг.',
          illustrationTag: 'happy',
        },
        {
          pageNumber: 6,
          text: 'Теперь {{childName}} засыпает спокойно. Темнота стала {{его|её}} другом.',
          illustrationTag: 'sleeping',
        },
      ],
    }),
  },
  {
    goalTitle: 'Доброта',
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
          text: '{{childName}} увидел{{|а}} это и решил{{|а}} помочь. {{Он|Она}} убрал{{|а}} свои игрушки без напоминания.',
          illustrationTag: 'helping',
        },
        {
          pageNumber: 3,
          text: 'Потом {{childName}} пош{{ёл|ла}} на кухню и накрыл{{|а}} стол к ужину.',
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
          text: '{{childName}} пон{{ял|яла}}: помогать тем, кого любишь, — это и есть настоящая любовь.',
          illustrationTag: 'happy',
        },
      ],
    }),
  },
  {
    goalTitle: 'Дружба',
    title: '{{childName}} и новый друг',
    illustrationTags: ['curious', 'school', 'happy', 'playing'],
    content: templateContentSchema.parse({
      pages: [
        {
          pageNumber: 1,
          text: 'В первый день в новой школе {{childName}} никого не знал{{|а}}. Все дети уже дружили между собой.',
          illustrationTag: 'school',
        },
        {
          pageNumber: 2,
          text: '{{childName}} сел{{|а}} в стороне и наблюдал{{|а}} за другими. {{Ему|Ей}} было немного грустно.',
          illustrationTag: 'sad',
        },
        {
          pageNumber: 3,
          text: 'Один мальчик подошёл и сказал: «Привет! Хочешь поиграть с нами?» {{childName}} удивил{{ся|ась}}.',
          illustrationTag: 'curious',
        },
        {
          pageNumber: 4,
          text: 'Они вместе побежали на площадку. Смеялись, играли, придумывали игры.',
          illustrationTag: 'playing',
        },
        {
          pageNumber: 5,
          text: 'К концу дня у {{childName}} уже был новый друг. Знакомиться — не страшно, если улыбнуться перв{{ым|ой}}.',
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
          text: 'На уроке {{childName}} случайно сломал{{|а}} карандаш одноклассника.',
          illustrationTag: 'school',
        },
        {
          pageNumber: 2,
          text: 'Можно было притвориться, что не заметил{{|а}}. Но {{childName}} чувствовал{{|а}} себя неловко.',
          illustrationTag: 'sad',
        },
        {
          pageNumber: 3,
          text: '{{Он|Она}} подош{{ёл|ла}} к однокласснику и сказал{{|а}}: «Я сломал{{|а}} твой карандаш. Прости, пожалуйста».',
          illustrationTag: 'proud',
        },
        {
          pageNumber: 4,
          text: 'Одноклассник улыбнулся: «Ничего страшного. Хорошо, что ты сказал{{|а}}».',
          illustrationTag: 'happy',
        },
        {
          pageNumber: 5,
          text: '{{childName}} почувствовал{{|а}} облегчение. Говорить правду бывает непросто, но всегда лучше.',
          illustrationTag: 'proud',
        },
        {
          pageNumber: 6,
          text: 'С тех пор {{childName}} всегда выбирал{{|а}} честность. Ведь честные люди вызывают настоящее доверие.',
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
