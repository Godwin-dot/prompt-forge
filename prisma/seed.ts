import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.prompt.findFirst({
    where: { title: "Exemple" },
  });

  if (!existing) {
    await prisma.prompt.create({
      data: { title: "Exemple", content: "Contenu de prompt par défaut." },
    });
  }

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });