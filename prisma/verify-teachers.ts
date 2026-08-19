import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Verificación de la infraestructura de docentes:
 * crea (si falta) un docente de prueba con rol `docente`, lo lista y lo limpia.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const role = await prisma.role.findUnique({ where: { key: "docente" } });
  if (!role) throw new Error("Falta el rol docente (ejecuta prisma/seed.ts)");

  const email = "verify.docente@unamad.edu.pe";
  await prisma.user.deleteMany({ where: { email } }); // limpia corridas previas

  const user = await prisma.user.create({
    data: {
      email,
      name: "Docente de Verificación",
      passwordHash: "x",
      roles: { create: [{ roleId: role.id }] },
      teacherProfile: { create: { academicDegree: "Mg.", specialty: "Prueba" } },
    },
    include: { teacherProfile: true },
  });
  console.log("Creado:", user.name, "perfil:", user.teacherProfile?.id);

  const rows = await prisma.teacherProfile.findMany({
    include: { user: true, _count: { select: { modules: true } } },
  });
  console.log(`Docentes en BD: ${rows.length}`);
  for (const t of rows) {
    console.log(` - ${t.academicDegree} ${t.user.name} (${t._count.modules} módulos)`);
  }

  await prisma.user.deleteMany({ where: { email } }); // cascade borra el perfil
  const orphans = await prisma.teacherProfile.count({ where: { user: { email } } });
  console.log("Perfiles huérfanos tras borrar:", orphans, "(esperado: 0)");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
