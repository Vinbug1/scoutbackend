import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.videoCategory.createMany({
    data: [
      { title: "Skill" },
      { title: "General" },
      { title: "TACTICAL"},
      { title: "PHYSICAL" },
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