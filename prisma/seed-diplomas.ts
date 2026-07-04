import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Semilla del Diplomado en TIC (Facultad de Ingeniería · Unidad de Posgrado, UNAMAD).
 * Datos tomados de la propuesta oficial "AVANCE PROPUESTA DIPLOMADO-TIC DDAISI 2024-2".
 * Idempotente: hace upsert del diplomado por `slug` y reemplaza sus módulos.
 */

const DIPLOMA = {
  slug: "tic",
  code: "DTIC",
  title: "Tecnologías de la Información y Comunicación",
  subtitle: "Diplomado de Posgrado",
  faculty: "Facultad de Ingeniería · Unidad de Posgrado",
  summary:
    "Forma profesionales capaces de diseñar, implementar y gestionar soluciones TIC: redes, bases de datos, desarrollo de software, inteligencia artificial, ciberseguridad e Internet de las Cosas.",
  description:
    "La sociedad actual se encuentra inmersa en un acelerado proceso de digitalización y transformación tecnológica, donde las Tecnologías de la Información y Comunicación (TIC) juegan un rol fundamental en la educación, la industria, la gestión empresarial, el gobierno y la salud. El diplomado integra la teoría, el desarrollo de habilidades técnicas y su aplicación en los sectores público y privado, capacitando a los profesionales en el uso adecuado de estas tecnologías.",
  objective:
    "Brindar a los participantes los conocimientos y habilidades necesarios en el campo de las tecnologías de la información y la comunicación (TIC), permitiéndoles diseñar, implementar y gestionar soluciones tecnológicas innovadoras que mejoren los procesos organizacionales y optimicen el uso de los recursos tecnológicos.",
  status: "published" as const,
  modality: "Semipresencial · Google Meet",
  schedule: "Viernes y sábado",
  totalHours: 384,
  credits: 24,
  weeksPerModule: 4,
  minEnrollment: 35,
  enrollmentFee: 200,
  moduleFee: 300,
  certificationFee: 50,
  admissionLabel: "Admisión 2026-II",
  featured: true,
  order: 10,
  objectives: [
    "Dominar los fundamentos teóricos y prácticos de las TIC para comprender su impacto en diferentes sectores y aplicarlas a la resolución de problemas específicos.",
    "Desarrollar habilidades técnicas en el uso y gestión de sistemas de información, redes y bases de datos, asegurando su integración eficiente en la infraestructura tecnológica.",
    "Evaluar e implementar soluciones innovadoras que utilicen TIC para mejorar la productividad, la seguridad de la información y la competitividad en un entorno en constante evolución.",
  ],
  requirements: [
    "Título profesional o grado de bachiller en carreras reconocidas por la SUNEDU (o revalidadas).",
    "Solicitud de inscripción dirigida a la Escuela de Posgrado.",
    "Fotocopia autenticada o legalizada del Título Profesional o Grado de Bachiller.",
    "Fotocopia simple del DNI.",
    "Dos fotografías recientes tamaño carné, a color y fondo blanco.",
    "Recibo de pago por los derechos del diplomado.",
  ],
  graduateProfile: [
    "Conocimientos actualizados en inteligencia artificial, big data, ciberseguridad y redes.",
    "Competencia en el uso de herramientas y plataformas relevantes del campo TIC.",
    "Capacidad para implementar mejoras en sistemas y procesos tecnológicos.",
    "Pensamiento crítico y creatividad para proponer nuevas soluciones.",
    "Compromiso ético con la privacidad y la seguridad de la información.",
  ],
  instructors: [
    "Jaime C. Prieto Luna",
    "Nelly J. Ulloa Gallardo",
    "Ralph Miranda Castillo",
    "Aldo Alarcón Sucasaca",
    "Mario J. Ormachea Mejía",
    "Frank Arpita Salcedo",
    "Andy J. Cucho Cruz",
    "Nataly C. Miranda Mondragón",
  ],
};

const MODULES: Array<{
  code: string;
  order: number;
  name: string;
  summary: string;
  topics: string[];
}> = [
  {
    code: "DTIC-M1",
    order: 1,
    name: "Redes y Seguridad",
    summary:
      "Diseñar, implementar y administrar sistemas de redes seguros, garantizando la confidencialidad, integridad y disponibilidad de la información, e identificando, evaluando y mitigando las amenazas.",
    topics: [
      "Fundamentos de redes (OSI, TCP/IP, protocolos y dispositivos)",
      "Seguridad en redes: amenazas, vulnerabilidades y gestión de riesgos",
      "Herramientas y técnicas: firewalls, IDS/IPS, cifrado (SSL/TLS), pentesting",
      "Casos prácticos y tendencias (IoT, Cloud, Big Data)",
    ],
  },
  {
    code: "DTIC-M2",
    order: 2,
    name: "Bases de Datos",
    summary:
      "Diseñar y comprender una base de datos aplicando la normalización, el modelo entidad-relación y el diseño lógico para optimizar los procesos en las organizaciones.",
    topics: [
      "Modelos de bases de datos",
      "Normalización y desnormalización",
      "Bases de datos distribuidas y optimización de consultas",
      "Tolerancia a fallos y recuperación",
      "Seguridad en bases de datos",
      "Big Data y tendencias en gestión de datos",
    ],
  },
  {
    code: "DTIC-M3",
    order: 3,
    name: "Desarrollo de Software",
    summary:
      "Desarrollar aplicaciones eficientes y escalables con enfoque en la calidad y la seguridad del software para enfrentar los desafíos del mundo laboral y aportar a la transformación digital.",
    topics: [
      "Introducción al desarrollo de software y metodologías ágiles",
      "Diseño y arquitectura de software (UML, calidad, pruebas)",
      "Desarrollo de aplicaciones con lenguajes modernos y backend",
      "Despliegue y mantenimiento (DevOps, CI/CD)",
    ],
  },
  {
    code: "DTIC-M4",
    order: 4,
    name: "Inteligencia Artificial",
    summary:
      "Capacitar en los fundamentos y aplicaciones de la inteligencia artificial, brindando conocimientos sólidos y habilidades prácticas para su implementación y la investigación científico-tecnológica.",
    topics: [
      "Introducción a la inteligencia artificial",
      "Fundamentos de Machine Learning",
      "Aprendizaje supervisado, no supervisado y por refuerzo",
      "Redes neuronales y sus aplicaciones",
      "Implicaciones éticas del uso de IA",
      "Desarrollo de proyecto",
    ],
  },
  {
    code: "DTIC-M5",
    order: 5,
    name: "Ciberseguridad",
    summary:
      "Implementar controles de seguridad, gestionar identidades y accesos y aplicar cumplimiento normativo, considerando un programa de gobierno de ciberseguridad para prevenir y responder ante ciberataques.",
    topics: [
      "Gobierno de ciberseguridad y gestión de riesgos",
      "Seguridad en sistemas de información (criptografía, DevSecOps, malware)",
      "Seguridad en infraestructuras de red y defensa en profundidad",
      "Seguridad en redes inalámbricas",
    ],
  },
  {
    code: "DTIC-M6",
    order: 6,
    name: "Internet de las Cosas",
    summary:
      "Diseñar e implementar soluciones basadas en una arquitectura IoT que integra desde la adquisición y el transporte de datos hasta el análisis y la gestión de la información, aplicadas a la región y el país.",
    topics: [
      "Arquitectura de Internet de las Cosas",
      "Capa física: sensores, dispositivos y microcontroladores",
      "Capa de comunicación: redes, protocolos e interfaces",
      "Capa de almacenamiento y de aplicaciones",
      "Proyecto de Internet de las Cosas (IoT)",
    ],
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  console.log(`→ Sembrando diplomado ${DIPLOMA.code} (${DIPLOMA.title})…`);

  const { objectives, requirements, graduateProfile, ...scalar } = DIPLOMA;
  const diploma = await prisma.diploma.upsert({
    where: { slug: DIPLOMA.slug },
    update: { ...scalar, objectives, requirements, graduateProfile },
    create: { ...scalar, objectives, requirements, graduateProfile },
  });

  // Reemplaza los módulos para reflejar exactamente la propuesta.
  await prisma.diplomaModule.deleteMany({ where: { diplomaId: diploma.id } });
  for (const m of MODULES) {
    await prisma.diplomaModule.create({
      data: {
        diplomaId: diploma.id,
        code: m.code,
        order: m.order,
        name: m.name,
        syncHours: 40,
        asyncHours: 24,
        totalHours: 64,
        credits: 4,
        summary: m.summary,
        topics: m.topics,
      },
    });
  }

  console.log(`✓ Diplomado listo con ${MODULES.length} módulos.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("✗", e);
  process.exit(1);
});
