import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/** Verifica modelos de matrícula y el rol estudiante con sus permisos. */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const role = await prisma.role.findUnique({
    where: { key: "estudiante" },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) throw new Error("Falta el rol estudiante");
  console.log("Rol:", role.name, role.permissions.map((p) => p.permission.key));

  const docente = await prisma.role.findUnique({
    where: { key: "docente" },
    include: { permissions: { include: { permission: true } } },
  });
  console.log("Docente:", docente?.permissions.map((p) => p.permission.key));

  console.log("Matrículas:", await prisma.enrollment.count());
  console.log("Perfiles de estudiante:", await prisma.studentProfile.count());
  console.log("Sesiones:", await prisma.moduleSession.count());
  console.log("Evaluaciones:", await prisma.assessment.count());
  console.log("Notas:", await prisma.grade.count());
  console.log("Materiales:", await prisma.moduleMaterial.count());
  console.log("Entregas:", await prisma.submission.count());
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
