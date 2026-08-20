/**
 * Sincroniza permisos y roles del sistema con las definiciones de
 * src/lib/auth/permissions.ts, sin tocar usuarios ni otros datos.
 *
 * Úsalo cada vez que se añadan permisos o módulos nuevos:
 *   npx tsx prisma/sync-roles.ts
 *
 * Es idempotente: crea/actualiza permisos, crea/actualiza los roles del
 * sistema y reemplaza sus enlaces rol→permiso. No borra roles creados a mano.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSIONS, ROLE_DEFS } from "../src/lib/auth/permissions";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log("→ Sincronizando permisos…");
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { name: p.name, description: p.description, category: p.category },
      create: p,
    });
  }

  console.log("→ Sincronizando roles…");
  const permByKey = new Map(
    (await prisma.permission.findMany()).map((p) => [p.key, p.id]),
  );

  for (const role of ROLE_DEFS) {
    const dbRole = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, system: role.system },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        system: role.system,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: dbRole.id } });
    await prisma.rolePermission.createMany({
      data: role.permissions.map((k) => {
        const permissionId = permByKey.get(k);
        if (!permissionId) throw new Error(`Permiso "${k}" no encontrado`);
        return { roleId: dbRole.id, permissionId };
      }),
    });
    console.log(`  ${role.name}: ${role.permissions.length} permisos`);
  }
  console.log("✓ Listo. Cierra sesión y vuelve a entrar para ver los cambios.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
