import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.videoCategory.createMany({
    data: [
      { title: "Skills" },
      { title: "Challenges" },
      { title: "Training"},
      { title: "Match" },
    ],
    skipDuplicates: true, // won't error if you run it twice
  });

  console.log('✅ Video categories seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });