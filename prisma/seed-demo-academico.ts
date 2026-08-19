import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

/**
 * Datos DEMO del ciclo académico completo sobre el diplomado TIC:
 * docentes, postulaciones en todos los estados, matrículas, sesiones con
 * asistencia, evaluaciones con notas parciales, materiales y entregas.
 *
 * Idempotente: borra y recrea SOLO sus propios datos, identificables por
 *  - usuarios con correo *.demo@unamad.edu.pe
 *  - postulaciones con código POST-DEMO-*
 *  - el CONTENIDO (sesiones/evaluaciones/materiales) de los módulos 1 y 3
 *    de TIC, que esta semilla considera suyos. ⚠ Si cargas contenido real
 *    en esos dos módulos, no vuelvas a ejecutar esta semilla.
 *
 * Todas las cuentas demo usan la contraseña: demo123
 */

const PASSWORD = "demo123";

const DOCENTES = [
  { name: "Ralph Miranda Castillo", email: "r.miranda.demo@unamad.edu.pe", degree: "Dr.", specialty: "Desarrollo de Software", moduleOrder: 3 },
  { name: "Aldo Alarcón Sucasaca", email: "a.alarcon.demo@unamad.edu.pe", degree: "Mg.", specialty: "Inteligencia Artificial", moduleOrder: 4 },
  { name: "Nataly Miranda Mondragón", email: "n.miranda.demo@unamad.edu.pe", degree: "Mg.", specialty: "Ciberseguridad", moduleOrder: 5 },
  { name: "Frank Arpita Salcedo", email: "f.arpita.demo@unamad.edu.pe", degree: "Ing.", specialty: "Internet de las Cosas", moduleOrder: null },
];

// 10 postulantes; los 3 primeros aceptados y matriculados vía postulación.
const POSTULANTES = [
  { first: "María Fernanda", last: "Quispe Huamán", dni: "71234501", status: "accepted", enroll: "active" },
  { first: "Jorge Luis", last: "Mamani Ccori", dni: "71234502", status: "accepted", enroll: "active" },
  { first: "Rosa Elena", last: "Condori Pacheco", dni: "71234503", status: "accepted", enroll: "active" },
  { first: "Carlos Alberto", last: "Huanca Flores", dni: "71234504", status: "reviewing", enroll: null },
  { first: "Lucía", last: "Zevallos Ríos", dni: "71234505", status: "reviewing", enroll: null },
  { first: "Pedro Pablo", last: "Cárdenas Soto", dni: "71234506", status: "pending", enroll: null },
  { first: "Ana Cecilia", last: "Torres Delgado", dni: "71234507", status: "pending", enroll: null },
  { first: "Miguel Ángel", last: "Rojas Paredes", dni: "71234508", status: "pending", enroll: null },
  { first: "Silvia", last: "Chambi Apaza", dni: "71234509", status: "waitlist", enroll: null },
  { first: "Renato", last: "Gutiérrez Salas", dni: "71234510", status: "rejected", enroll: null },
] as const;

// Matrículas manuales adicionales (sin postulación).
const MANUALES = [
  { name: "Verónica Paredes Luna", dni: "71234511", enroll: "active" },
  { name: "Óscar Ttito Ramos", dni: "71234512", enroll: "active" },
  { name: "Diana Salazar Ochoa", dni: "71234513", enroll: "active" },
  { name: "Héctor Núñez Vera", dni: "71234514", enroll: "withdrawn" },
  { name: "Karina Ayma Choque", dni: "71234515", enroll: "completed" },
] as const;

const PROFESIONES = [
  "Ingeniería de Sistemas",
  "Ingeniería Informática",
  "Administración",
  "Contabilidad",
  "Educación",
];

function emailFor(fullName: string): string {
  const slug = fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(".");
  return `${slug}.demo@unamad.edu.pe`;
}

/** Fecha (medianoche UTC) desplazada N días desde hoy. */
function dayUTC(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const tic = await prisma.diploma.findUnique({
    where: { slug: "tic" },
    include: { modules: { orderBy: { order: "asc" } } },
  });
  if (!tic) throw new Error("No existe el diplomado TIC (slug 'tic').");
  const mod1 = tic.modules.find((m) => m.order === 1);
  const mod3 = tic.modules.find((m) => m.order === 3);
  if (!mod1 || !mod3) throw new Error("TIC no tiene módulos 1 y 3.");

  const roleDocente = await prisma.role.findUnique({ where: { key: "docente" } });
  const roleEstudiante = await prisma.role.findUnique({ where: { key: "estudiante" } });
  if (!roleDocente || !roleEstudiante) {
    throw new Error("Faltan roles docente/estudiante (ejecuta prisma/seed.ts).");
  }

  console.log("→ Limpiando datos demo previos…");
  // Contenido de los módulos que esta semilla posee (1 y 3 de TIC).
  await prisma.moduleSession.deleteMany({ where: { moduleId: { in: [mod1.id, mod3.id] } } });
  await prisma.assessment.deleteMany({ where: { moduleId: { in: [mod1.id, mod3.id] } } });
  await prisma.moduleMaterial.deleteMany({ where: { moduleId: { in: [mod1.id, mod3.id] } } });
  // Postulaciones y usuarios demo (cascada: perfiles, matrículas, asistencia, notas, entregas).
  await prisma.diplomaApplication.deleteMany({ where: { code: { startsWith: "POST-DEMO-" } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: ".demo@unamad.edu.pe" } } });

  const passwordHash = await hashPassword(PASSWORD);

  console.log("→ Creando docentes demo…");
  for (const d of DOCENTES) {
    const user = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        passwordHash,
        roles: { create: [{ roleId: roleDocente.id }] },
        teacherProfile: {
          create: { academicDegree: d.degree, specialty: d.specialty },
        },
      },
      include: { teacherProfile: true },
    });
    if (d.moduleOrder !== null) {
      const mod = tic.modules.find((m) => m.order === d.moduleOrder);
      // Solo asigna módulos que estén libres (no roba los ya asignados).
      if (mod && !mod.teacherId) {
        await prisma.diplomaModule.update({
          where: { id: mod.id },
          data: { teacherId: user.teacherProfile!.id },
        });
        console.log(`  ${d.degree} ${d.name} → módulo ${d.moduleOrder}`);
      }
    }
  }

  console.log("→ Creando postulaciones demo…");
  const enrollActive: string[] = []; // enrollmentIds activos (para asistencia/notas)
  let seq = 1;
  for (const p of POSTULANTES) {
    const fullName = `${p.first} ${p.last}`;
    const app = await prisma.diplomaApplication.create({
      data: {
        code: `POST-DEMO-${String(seq++).padStart(3, "0")}`,
        diplomaId: tic.id,
        docNumber: p.dni,
        firstName: p.first,
        lastName: p.last,
        email: emailFor(fullName),
        phone: `98${p.dni.slice(2)}`,
        region: "Madre de Dios",
        province: "Tambopata",
        district: "Tambopata",
        academicDegree: "Bachiller",
        profession: PROFESIONES[seq % PROFESIONES.length],
        university: "UNAMAD",
        modality: "Semipresencial",
        motivation:
          "Deseo fortalecer mis competencias en tecnologías de la información para aplicarlas en mi centro laboral.",
        status: p.status,
        reviewNote:
          p.status === "accepted"
            ? "Cumple todos los requisitos."
            : p.status === "rejected"
              ? "Documentación incompleta."
              : null,
        reviewedAt: ["accepted", "rejected", "waitlist"].includes(p.status)
          ? new Date()
          : null,
      },
    });

    if (p.enroll) {
      const user = await prisma.user.create({
        data: {
          name: fullName,
          email: app.email,
          passwordHash,
          roles: { create: [{ roleId: roleEstudiante.id }] },
          studentProfile: {
            create: { docType: "DNI", docNumber: p.dni, phone: app.phone },
          },
        },
        include: { studentProfile: true },
      });
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: user.studentProfile!.id,
          diplomaId: tic.id,
          applicationId: app.id,
          status: p.enroll,
        },
      });
      if (p.enroll === "active") enrollActive.push(enrollment.id);
    }
  }

  console.log("→ Creando matrículas manuales demo…");
  for (const m of MANUALES) {
    const user = await prisma.user.create({
      data: {
        name: m.name,
        email: emailFor(m.name),
        passwordHash,
        roles: { create: [{ roleId: roleEstudiante.id }] },
        studentProfile: { create: { docType: "DNI", docNumber: m.dni } },
      },
      include: { studentProfile: true },
    });
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: user.studentProfile!.id,
        diplomaId: tic.id,
        status: m.enroll,
      },
    });
    if (m.enroll === "active") enrollActive.push(enrollment.id);
  }
  console.log(`  Matrículas activas demo: ${enrollActive.length}`);

  // ────────────── Módulo 1 (Dra. Nelly): curso a mitad de ciclo ──────────────
  console.log("→ Poblando módulo 1 (sesiones, asistencia, evaluaciones, notas)…");
  const temasM1 = [
    "Fundamentos de redes de computadoras",
    "Modelo OSI y TCP/IP",
    "Direccionamiento IP y subredes",
    "Configuración de routers y switches",
    "Seguridad perimetral y firewalls",
  ];
  const sesionesM1 = [];
  for (let i = 0; i < temasM1.length; i++) {
    sesionesM1.push(
      await prisma.moduleSession.create({
        data: {
          moduleId: mod1.id,
          order: i + 1,
          // Viernes/sábados pasados: 2 sesiones por semana hacia atrás.
          date: dayUTC(-21 + i * 4),
          topic: temasM1[i],
        },
      }),
    );
  }

  // Asistencia variada: alumno k falta en la sesión k, tardanza en la k+1, etc.
  const estados = ["presente", "tardanza", "falta", "justificada"] as const;
  for (let s = 0; s < sesionesM1.length; s++) {
    for (let k = 0; k < enrollActive.length; k++) {
      const status =
        (s + k) % 5 === 0 ? estados[(k % 3) + 1] : "presente";
      await prisma.attendanceRecord.create({
        data: {
          sessionId: sesionesM1[s].id,
          enrollmentId: enrollActive[k],
          status,
        },
      });
    }
  }

  const tarea = await prisma.assessment.create({
    data: {
      moduleId: mod1.id,
      title: "Tarea 1: Diseño de subredes",
      description: "Resolver el cuaderno de ejercicios de subneteo VLSM.",
      kind: "tarea",
      weight: 30,
      dueDate: dayUTC(-7),
    },
  });
  const trabajo = await prisma.assessment.create({
    data: {
      moduleId: mod1.id,
      title: "Trabajo aplicativo: red para una pyme",
      description:
        "Diseñar e implementar en Packet Tracer la red de una pyme local. Subir el informe en PDF o el enlace al repositorio.",
      kind: "trabajo",
      weight: 40,
      dueDate: dayUTC(9),
      allowsSubmission: true,
    },
  });
  const examen = await prisma.assessment.create({
    data: {
      moduleId: mod1.id,
      title: "Examen parcial del módulo",
      kind: "examen",
      weight: 30,
      dueDate: dayUTC(14),
    },
  });

  // Notas parciales: tarea calificada para 4 alumnos, examen para 2.
  const notasTarea = [16.5, 14.0, 18.25, 12.75];
  for (let k = 0; k < Math.min(4, enrollActive.length); k++) {
    await prisma.grade.create({
      data: {
        assessmentId: tarea.id,
        enrollmentId: enrollActive[k],
        score: notasTarea[k],
        feedback: k === 1 ? "Revisar el cálculo de la máscara en el ejercicio 3." : null,
      },
    });
  }
  for (let k = 0; k < Math.min(2, enrollActive.length); k++) {
    await prisma.grade.create({
      data: {
        assessmentId: examen.id,
        enrollmentId: enrollActive[k],
        score: [15.0, 17.5][k],
      },
    });
  }

  // Entregas del trabajo: 3 alumnos por enlace; la primera ya calificada.
  const linksEntrega = [
    "https://github.com/demo/red-pyme-packet-tracer",
    "https://drive.google.com/file/d/demo-red-pyme-2",
    "https://drive.google.com/file/d/demo-red-pyme-3",
  ];
  for (let k = 0; k < Math.min(3, enrollActive.length); k++) {
    await prisma.submission.create({
      data: {
        assessmentId: trabajo.id,
        enrollmentId: enrollActive[k],
        linkUrl: linksEntrega[k],
        comment: k === 0 ? "Incluye la topología final y el informe." : null,
        submittedAt: dayUTC(-1),
      },
    });
  }
  await prisma.grade.create({
    data: {
      assessmentId: trabajo.id,
      enrollmentId: enrollActive[0],
      score: 17.0,
      feedback: "Buen diseño; documenta mejor el plan de direccionamiento.",
    },
  });

  await prisma.moduleMaterial.createMany({
    data: [
      { moduleId: mod1.id, order: 1, title: "Sílabo del módulo", url: "https://drive.google.com/demo/silabo-redes" },
      { moduleId: mod1.id, order: 2, title: "Diapositivas: modelo OSI", url: "https://drive.google.com/demo/osi" },
      { moduleId: mod1.id, order: 3, title: "Guía de laboratorio Packet Tracer", url: "https://drive.google.com/demo/lab-pt" },
      { moduleId: mod1.id, order: 4, title: "Video: subneteo paso a paso", url: "https://youtube.com/watch?v=demo-subneteo" },
    ],
  });

  // ────────────── Módulo 3 (docente demo): curso recién iniciado ──────────────
  console.log("→ Poblando módulo 3 (inicio de ciclo)…");
  const s1m3 = await prisma.moduleSession.create({
    data: {
      moduleId: mod3.id,
      order: 1,
      date: dayUTC(-2),
      topic: "Presentación del curso y ciclo de vida del software",
    },
  });
  for (const [k, enrollmentId] of enrollActive.entries()) {
    await prisma.attendanceRecord.create({
      data: {
        sessionId: s1m3.id,
        enrollmentId,
        status: k === enrollActive.length - 1 ? "falta" : "presente",
      },
    });
  }
  await prisma.assessment.create({
    data: {
      moduleId: mod3.id,
      title: "Ensayo: metodologías ágiles vs tradicionales",
      kind: "tarea",
      weight: 20,
      dueDate: dayUTC(12),
      allowsSubmission: true,
    },
  });
  await prisma.moduleMaterial.createMany({
    data: [
      { moduleId: mod3.id, order: 1, title: "Sílabo del módulo", url: "https://drive.google.com/demo/silabo-software" },
      { moduleId: mod3.id, order: 2, title: "Lectura: manifiesto ágil", url: "https://agilemanifesto.org/iso/es/manifesto.html" },
    ],
  });

  // ────────────── Resumen ──────────────
  const [apps, enrolls, sessions, grades, subs] = await Promise.all([
    prisma.diplomaApplication.count({ where: { code: { startsWith: "POST-DEMO-" } } }),
    prisma.enrollment.count({
      where: { student: { user: { email: { endsWith: ".demo@unamad.edu.pe" } } } },
    }),
    prisma.moduleSession.count({ where: { moduleId: { in: [mod1.id, mod3.id] } } }),
    prisma.grade.count({ where: { assessment: { moduleId: mod1.id } } }),
    prisma.submission.count({ where: { assessment: { moduleId: mod1.id } } }),
  ]);
  console.log("\n✔ Datos demo listos:");
  console.log(`  Postulaciones: ${apps} · Matrículas demo: ${enrolls} · Sesiones: ${sessions} · Notas: ${grades} · Entregas: ${subs}`);
  console.log("\nCuentas demo (contraseña: demo123):");
  console.log("  Docente módulo 3: r.miranda.demo@unamad.edu.pe");
  console.log("  Alumna (matrícula por postulación, con notas y entrega calificada): maria.fernanda.demo@unamad.edu.pe");
  console.log("  Alumno (matrícula manual): veronica.paredes.demo@unamad.edu.pe");
  console.log("  (Todas las cuentas *.demo@unamad.edu.pe usan demo123)");
  console.log("\nRecorridos sugeridos: /postulaciones (estados) → /matriculas → /docencia (como docente demo) → /aula (como alumna demo).");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
