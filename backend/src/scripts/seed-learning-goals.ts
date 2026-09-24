import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';
import { LEARNING_GOALS } from './lib/learning-goals.data';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const existing = await prisma.learningGoal.count();
  if (existing > 0) {
    console.log(`Already seeded (${existing} goals). Run with --force to reset.`);
    if (!process.argv.includes('--force')) return;
    await prisma.learningGoal.deleteMany();
  }
  console.log('Seeding learning goals…');
  await prisma.learningGoal.createMany({ data: [...LEARNING_GOALS] });
  console.log(`Seeded ${LEARNING_GOALS.length} learning goals.`);
}

main()
  .catch(console.error)
  .finally(() => void prisma.$disconnect())
  .finally(() => void pool.end());
