import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GOALS = [
  {
    title: 'Дружба',
    description: 'Учится ценить дружбу, заводить друзей и заботиться о них.',
    ageRangeMin: 3,
    ageRangeMax: 8,
  },
  {
    title: 'Честность',
    description: 'Понимает, почему важно говорить правду даже когда это сложно.',
    arcType: 'flaw' as const,
    ageRangeMin: 4,
    ageRangeMax: 10,
  },
  {
    title: 'Доброта',
    description: 'Учится проявлять доброту и заботу об окружающих.',
    ageRangeMin: 3,
    ageRangeMax: 7,
  },
  {
    title: 'Преодоление страха темноты',
    description: 'Справляется со страхом темноты с помощью смелости и воображения.',
    ageRangeMin: 3,
    ageRangeMax: 7,
  },
  {
    title: 'Смелость',
    description:
      'Понимает, что быть смелым не значит не бояться — это действовать несмотря на страх.',
    ageRangeMin: 4,
    ageRangeMax: 9,
  },
  {
    title: 'Делиться с другими',
    description: 'Учится делиться игрушками, едой и временем с другими детьми.',
    arcType: 'flaw' as const,
    ageRangeMin: 2,
    ageRangeMax: 6,
  },
  {
    title: 'Уважение к природе',
    description: 'Узнаёт о важности бережного отношения к природе и животным.',
    ageRangeMin: 4,
    ageRangeMax: 10,
  },
  {
    title: 'Ответственность',
    description: 'Учится выполнять обещания и брать на себя ответственность за свои поступки.',
    arcType: 'flaw' as const,
    ageRangeMin: 5,
    ageRangeMax: 12,
  },
  {
    title: 'Принятие различий',
    description: 'Понимает ценность разнообразия и учится уважать тех, кто отличается от него.',
    ageRangeMin: 4,
    ageRangeMax: 9,
  },
  {
    title: 'Терпение',
    description:
      'Учится ждать и сохранять спокойствие, когда что-то происходит медленнее, чем хочется.',
    arcType: 'flaw' as const,
    ageRangeMin: 3,
    ageRangeMax: 8,
  },
  {
    title: 'Самостоятельность',
    description: 'Развивает уверенность в себе и умение справляться с задачами самостоятельно.',
    ageRangeMin: 4,
    ageRangeMax: 10,
  },
  {
    title: 'Управление гневом',
    description: 'Учится выражать злость и разочарование в конструктивной форме.',
    arcType: 'flaw' as const,
    ageRangeMin: 4,
    ageRangeMax: 9,
  },
  {
    title: 'Сочувствие',
    description: 'Развивает способность понимать чувства других людей и сопереживать им.',
    ageRangeMin: 4,
    ageRangeMax: 10,
  },
  {
    title: 'Настойчивость',
    description: 'Понимает ценность продолжать попытки, не сдаваться при первой неудаче.',
    ageRangeMin: 5,
    ageRangeMax: 12,
  },
  {
    title: 'Уважение к старшим',
    description: 'Учится уважать бабушек, дедушек и других взрослых.',
    ageRangeMin: 3,
    ageRangeMax: 8,
  },
  {
    title: 'Забота о младших',
    description: 'Учится помогать и заботиться о братьях, сёстрах и маленьких детях.',
    ageRangeMin: 5,
    ageRangeMax: 12,
  },
  {
    title: 'Трудолюбие',
    description: 'Понимает ценность усилий и радость от достигнутого результата.',
    ageRangeMin: 5,
    ageRangeMax: 12,
  },
  {
    title: 'Любопытство и любовь к знаниям',
    description: 'Развивает интерес к познанию мира и радость от новых открытий.',
    ageRangeMin: 3,
    ageRangeMax: 10,
  },
  {
    title: 'Бережное отношение к вещам',
    description: 'Учится ценить и беречь свои и чужие вещи.',
    arcType: 'flaw' as const,
    ageRangeMin: 3,
    ageRangeMax: 7,
  },
  {
    title: 'Преодоление разлуки',
    description: 'Справляется с тоской по родителям, например, при первом посещении детского сада.',
    ageRangeMin: 2,
    ageRangeMax: 6,
  },
];

async function main(): Promise<void> {
  const existing = await prisma.learningGoal.count();
  if (existing > 0) {
    console.log(`Already seeded (${existing} goals). Run with --force to reset.`);
    if (!process.argv.includes('--force')) return;
    await prisma.learningGoal.deleteMany();
  }
  console.log('Seeding learning goals…');
  await prisma.learningGoal.createMany({ data: GOALS });
  console.log(`Seeded ${GOALS.length} learning goals.`);
}

main()
  .catch(console.error)
  .finally(() => void prisma.$disconnect())
  .finally(() => void pool.end());
