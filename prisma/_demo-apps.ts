import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Inserta postulaciones DEMO (código DEMO-####) para probar la vista admin.
// Borrar luego con: DELETE FROM "DiplomaApplication" WHERE code LIKE 'DEMO-%';

const FIRST = ["María", "José", "Luz", "Carlos", "Ana", "Pedro", "Rosa", "Juan", "Carmen", "Luis", "Julia", "Miguel"];
const LAST = ["Quispe Mamani", "Huamán Ríos", "Flores Cusi", "García Torres", "Condori Apaza", "Ramos Vega", "Chávez Luna", "Salas Paredes"];
const STATUSES = ["pending", "reviewing", "accepted", "rejected"] as const;

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const diploma = await prisma.diploma.findUnique({ where: { slug: "tic" } });
  if (!diploma) throw new Error("diplomado 'tic' no existe");

  const now = Date.now();
  for (let i = 1; i <= 57; i++) {
    const firstName = FIRST[i % FIRST.length];
    const lastName = LAST[i % LAST.length];
    await prisma.diplomaApplication.upsert({
      where: { code: `DEMO-${String(i).padStart(4, "0")}` },
      update: {},
      create: {
        code: `DEMO-${String(i).padStart(4, "0")}`,
        diplomaId: diploma.id,
        docType: "DNI",
        docNumber: String(40000000 + i * 137),
        firstName,
        lastName,
        email: `demo${i}@example.com`,
        phone: `9${String(10000000 + i * 991).slice(0, 8)}`,
        status: STATUSES[i % STATUSES.length],
        createdAt: new Date(now - i * 36e5 * 7),
      },
    });
  }
  console.log("✓ 57 postulaciones demo listas");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
