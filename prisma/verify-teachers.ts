import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/** Verifica que TeacherProfile y DiplomaModule.teacherId existen y son consultables. */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const teachers = await prisma.teacherProfile.count();
  const unassigned = await prisma.diplomaModule.count({ where: { teacherId: null } });
  console.log(`TeacherProfile: ${teachers} registros`);
  console.log(`Módulos sin docente: ${unassigned}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
