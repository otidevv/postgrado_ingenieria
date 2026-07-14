import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Diplomados de MUESTRA (4) para revisar el diseño de la landing con varias
 * tarjetas. Contenido redactado como demo alineado a las tres escuelas de la
 * Facultad de Ingeniería — reemplazar con las propuestas oficiales cuando
 * existan. Idempotente: upsert por `slug` y reemplazo de módulos.
 * Ejecutar:  npx tsx prisma/seed-diplomas-demo.ts
 */

const REQUIREMENTS = [
  "Título profesional o grado de bachiller en carreras reconocidas por la SUNEDU (o revalidadas).",
  "Solicitud de inscripción dirigida a la Escuela de Posgrado.",
  "Fotocopia autenticada o legalizada del Título Profesional o Grado de Bachiller.",
  "Fotocopia simple del DNI.",
  "Dos fotografías recientes tamaño carné, a color y fondo blanco.",
  "Recibo de pago por los derechos del diplomado.",
];

const COMMON = {
  subtitle: "Diplomado de Posgrado",
  faculty: "Facultad de Ingeniería · Unidad de Posgrado",
  status: "published" as const,
  modality: "Semipresencial · Google Meet",
  weeksPerModule: 4,
  minEnrollment: 35,
  enrollmentFee: 200,
  moduleFee: 300,
  certificationFee: 50,
  admissionLabel: "Admisión 2026-II",
  featured: false,
  requirements: REQUIREMENTS,
  instructors: [] as string[], // pendiente de confirmar con la Unidad de Posgrado
};

type ModuleSeed = {
  code: string;
  order: number;
  name: string;
  summary: string;
  topics: string[];
};

type DiplomaSeed = {
  slug: string;
  code: string;
  title: string;
  summary: string;
  description: string;
  objective: string;
  schedule: string;
  totalHours: number;
  credits: number;
  order: number;
  objectives: string[];
  graduateProfile: string[];
  modules: ModuleSeed[];
};

const DIPLOMAS: DiplomaSeed[] = [
  {
    slug: "inocuidad-agroalimentaria",
    code: "DGIA",
    title: "Gestión de la Calidad e Inocuidad Agroalimentaria",
    summary:
      "Forma especialistas en sistemas de calidad e inocuidad para la agroindustria: BPM, HACCP, normativa sanitaria y auditoría, con énfasis en las cadenas productivas amazónicas.",
    description:
      "La agroindustria regional demanda profesionales capaces de garantizar productos seguros y competitivos para los mercados nacional y de exportación. El diplomado desarrolla competencias en gestión de la calidad, inocuidad alimentaria y cumplimiento normativo, aplicadas a las cadenas de valor de la Amazonía como castaña, cacao, copoazú y acuicultura.",
    objective:
      "Desarrollar competencias para diseñar, implementar y auditar sistemas de gestión de la calidad e inocuidad en empresas agroalimentarias, cumpliendo la normativa sanitaria vigente y los estándares internacionales.",
    schedule: "Viernes y sábado",
    totalHours: 320,
    credits: 20,
    order: 20,
    objectives: [
      "Aplicar los principios de las buenas prácticas de manufactura y los prerrequisitos de inocuidad en plantas agroalimentarias.",
      "Diseñar e implementar planes HACCP para procesos de transformación de productos amazónicos.",
      "Conducir auditorías internas y preparar a la organización para certificaciones y habilitaciones sanitarias.",
    ],
    graduateProfile: [
      "Domina los sistemas de gestión de calidad e inocuidad aplicables a la agroindustria.",
      "Elabora e implementa planes HACCP y programas de prerrequisitos.",
      "Interpreta y aplica la normativa sanitaria nacional y los estándares internacionales.",
      "Lidera procesos de auditoría y mejora continua en plantas de alimentos.",
    ],
    modules: [
      {
        code: "DGIA-M1",
        order: 1,
        name: "Sistemas de Gestión de la Calidad",
        summary:
          "Fundamentos y herramientas de la gestión de la calidad en la industria alimentaria, desde los principios de ISO 9001 hasta las buenas prácticas de manufactura.",
        topics: [
          "Principios de gestión de la calidad e ISO 9001",
          "Buenas prácticas de manufactura (BPM)",
          "Programas de higiene y saneamiento (POES)",
          "Documentación y control de procesos",
        ],
      },
      {
        code: "DGIA-M2",
        order: 2,
        name: "Inocuidad Alimentaria y HACCP",
        summary:
          "Diseño e implementación del sistema de análisis de peligros y puntos críticos de control en procesos agroalimentarios.",
        topics: [
          "Peligros físicos, químicos y biológicos",
          "Los siete principios del sistema HACCP",
          "Elaboración del plan HACCP paso a paso",
          "Validación y verificación del sistema",
        ],
      },
      {
        code: "DGIA-M3",
        order: 3,
        name: "Microbiología e Higiene de Alimentos",
        summary:
          "Bases microbiológicas para el control de la inocuidad: microorganismos de interés, muestreo y criterios de aceptación.",
        topics: [
          "Microorganismos indicadores y patógenos",
          "Muestreo y análisis microbiológico",
          "Criterios microbiológicos nacionales",
          "Control de alérgenos y contaminación cruzada",
        ],
      },
      {
        code: "DGIA-M4",
        order: 4,
        name: "Normativa Sanitaria y Certificaciones",
        summary:
          "Marco regulatorio sanitario peruano y estándares voluntarios para el acceso a mercados de exportación.",
        topics: [
          "Normativa DIGESA y SENASA aplicable",
          "Registro sanitario y habilitación de plantas",
          "Estándares GFSI: BRCGS, FSSC 22000",
          "Requisitos para mercados de exportación",
        ],
      },
      {
        code: "DGIA-M5",
        order: 5,
        name: "Auditoría y Mejora Continua",
        summary:
          "Técnicas de auditoría de sistemas de calidad e inocuidad y herramientas de mejora continua para plantas agroalimentarias.",
        topics: [
          "Planificación y ejecución de auditorías internas",
          "Gestión de no conformidades y acciones correctivas",
          "Indicadores y herramientas de mejora continua",
          "Proyecto integrador aplicado a una planta regional",
        ],
      },
    ],
  },
  {
    slug: "gestion-ambiental-territorial",
    code: "DGAT",
    title: "Gestión Ambiental y Ordenamiento Territorial",
    summary:
      "Especializa en evaluación de impacto ambiental, ordenamiento territorial y gobernanza de ecosistemas amazónicos, con instrumentos aplicables a la gestión pública y privada.",
    description:
      "Madre de Dios, capital de la biodiversidad del Perú, requiere cuadros técnicos capaces de compatibilizar el desarrollo productivo con la conservación. El diplomado brinda los instrumentos de gestión ambiental y de ordenamiento territorial que exigen el sector público, la empresa y la cooperación, con énfasis en los ecosistemas amazónicos y sus dinámicas socioambientales.",
    objective:
      "Formar especialistas capaces de elaborar, evaluar y supervisar instrumentos de gestión ambiental y de ordenamiento territorial, contribuyendo al desarrollo sostenible de la Amazonía.",
    schedule: "Viernes y sábado",
    totalHours: 384,
    credits: 24,
    order: 30,
    objectives: [
      "Aplicar el marco legal e institucional ambiental peruano en la gestión de proyectos y territorios.",
      "Elaborar y evaluar instrumentos de gestión ambiental como DIA, EIA y PAMA.",
      "Formular propuestas de ordenamiento territorial basadas en la zonificación ecológica y económica.",
    ],
    graduateProfile: [
      "Interpreta y aplica la normativa ambiental nacional y regional.",
      "Elabora y evalúa estudios de impacto ambiental en sus distintas categorías.",
      "Maneja instrumentos de ordenamiento territorial y zonificación.",
      "Diseña estrategias de gestión de ecosistemas y remediación de áreas degradadas.",
      "Facilita procesos de gobernanza ambiental con actores públicos y comunitarios.",
    ],
    modules: [
      {
        code: "DGAT-M1",
        order: 1,
        name: "Marco Legal e Institucional Ambiental",
        summary:
          "Panorama del sistema nacional de gestión ambiental, sus autoridades, competencias e instrumentos.",
        topics: [
          "Sistema Nacional de Gestión Ambiental",
          "Ley General del Ambiente y normas sectoriales",
          "Competencias nacionales, regionales y locales",
          "Participación ciudadana y consulta previa",
        ],
      },
      {
        code: "DGAT-M2",
        order: 2,
        name: "Evaluación de Impacto Ambiental",
        summary:
          "Metodologías para identificar, predecir y valorar impactos ambientales de proyectos de inversión.",
        topics: [
          "El SEIA y sus categorías (DIA, EIA-sd, EIA-d)",
          "Línea base física, biológica y social",
          "Identificación y valoración de impactos",
          "Planes de manejo y compromisos ambientales",
        ],
      },
      {
        code: "DGAT-M3",
        order: 3,
        name: "Ordenamiento Territorial y ZEE",
        summary:
          "Instrumentos técnicos del ordenamiento territorial y su aplicación a la planificación regional amazónica.",
        topics: [
          "Zonificación ecológica y económica (ZEE)",
          "Estudios especializados y diagnóstico territorial",
          "Planes de ordenamiento y acondicionamiento territorial",
          "Conflictos por uso del suelo en la Amazonía",
        ],
      },
      {
        code: "DGAT-M4",
        order: 4,
        name: "Manejo de Ecosistemas Amazónicos",
        summary:
          "Bases ecológicas y estrategias de conservación y aprovechamiento sostenible de los ecosistemas de la región.",
        topics: [
          "Estructura y dinámica de bosques tropicales",
          "Servicios ecosistémicos y su valoración",
          "Áreas naturales protegidas y corredores",
          "Sistemas productivos sostenibles",
        ],
      },
      {
        code: "DGAT-M5",
        order: 5,
        name: "Gestión de Residuos y Remediación",
        summary:
          "Gestión integral de residuos sólidos y estrategias de remediación de sitios degradados, incluida la minería aurífera.",
        topics: [
          "Gestión integral de residuos sólidos municipales",
          "Residuos peligrosos y responsabilidad extendida",
          "Remediación de áreas degradadas por minería",
          "Casos de restauración ecológica regional",
        ],
      },
      {
        code: "DGAT-M6",
        order: 6,
        name: "Fiscalización y Gobernanza Ambiental",
        summary:
          "Supervisión, fiscalización y sanción ambiental, y mecanismos de gobernanza multiactor para el territorio.",
        topics: [
          "El SINEFA y el rol del OEFA",
          "Supervisión y fiscalización sectorial",
          "Gobernanza ambiental y gestión de conflictos",
          "Proyecto integrador territorial",
        ],
      },
    ],
  },
  {
    slug: "sig-teledeteccion",
    code: "DSIG",
    title: "Sistemas de Información Geográfica y Teledetección",
    summary:
      "Capacita en SIG, teledetección y análisis espacial para el monitoreo de bosques, el catastro y la planificación territorial con software libre y datos satelitales.",
    description:
      "El monitoreo del territorio amazónico exige dominar herramientas geoespaciales: desde la elaboración de cartografía temática hasta el análisis multitemporal de imágenes satelitales para detectar deforestación y cambios de uso del suelo. El diplomado combina fundamentos, práctica intensiva con software libre y un proyecto aplicado a datos reales de la región.",
    objective:
      "Desarrollar competencias en la captura, procesamiento, análisis y publicación de información geoespacial para la gestión del territorio y los recursos naturales.",
    schedule: "Sábado y domingo",
    totalHours: 256,
    credits: 16,
    order: 40,
    objectives: [
      "Elaborar cartografía temática con sistemas de información geográfica de escritorio y de código abierto.",
      "Procesar e interpretar imágenes satelitales ópticas y de radar para el monitoreo ambiental.",
      "Aplicar análisis espacial y geoestadística a problemas de planificación y conservación.",
    ],
    graduateProfile: [
      "Maneja QGIS y herramientas geoespaciales de código abierto con solvencia.",
      "Procesa imágenes satelitales y genera productos de monitoreo de coberturas.",
      "Aplica análisis espacial a la gestión territorial, forestal y de riesgos.",
      "Publica y comparte información geográfica mediante servicios web.",
    ],
    modules: [
      {
        code: "DSIG-M1",
        order: 1,
        name: "Fundamentos de SIG y Cartografía",
        summary:
          "Conceptos y práctica de los sistemas de información geográfica: datos vectoriales y ráster, sistemas de referencia y producción cartográfica.",
        topics: [
          "Modelos de datos vectorial y ráster",
          "Sistemas de referencia y proyecciones",
          "Edición y geoprocesamiento en QGIS",
          "Diseño y composición cartográfica",
        ],
      },
      {
        code: "DSIG-M2",
        order: 2,
        name: "Teledetección y Sensores Remotos",
        summary:
          "Principios físicos de la teledetección y procesamiento digital de imágenes ópticas y de radar para el estudio del territorio.",
        topics: [
          "Plataformas y sensores: Landsat, Sentinel, PlanetScope",
          "Correcciones y preprocesamiento",
          "Índices espectrales y clasificación de coberturas",
          "Análisis multitemporal y detección de cambios",
        ],
      },
      {
        code: "DSIG-M3",
        order: 3,
        name: "Análisis Espacial y Geoestadística",
        summary:
          "Métodos de análisis espacial e interpolación para transformar datos geográficos en información para la decisión.",
        topics: [
          "Análisis de patrones y autocorrelación espacial",
          "Interpolación e isolíneas (IDW, kriging)",
          "Análisis multicriterio para aptitud territorial",
          "Modelamiento hidrológico y de terreno",
        ],
      },
      {
        code: "DSIG-M4",
        order: 4,
        name: "Proyectos SIG Aplicados",
        summary:
          "Desarrollo de un proyecto geoespacial completo aplicado a la región: del levantamiento de datos a la publicación de resultados.",
        topics: [
          "Levantamiento con GPS y drones",
          "Monitoreo de deforestación con datos abiertos",
          "Infraestructura de datos espaciales y servicios web",
          "Proyecto integrador con datos de Madre de Dios",
        ],
      },
    ],
  },
  {
    slug: "gestion-proyectos",
    code: "DGPI",
    title: "Gestión de Proyectos de Ingeniería",
    summary:
      "Entrena en dirección de proyectos con estándares internacionales y marcos ágiles, incluyendo la formulación de proyectos de inversión pública bajo Invierte.pe.",
    description:
      "La ejecución de proyectos de infraestructura, tecnología y desarrollo productivo requiere directores capaces de planificar, ejecutar y controlar con método. El diplomado integra los estándares internacionales de dirección de proyectos con los marcos ágiles y la normativa peruana de inversión pública, mediante casos aplicados al contexto regional.",
    objective:
      "Desarrollar competencias para dirigir proyectos de ingeniería a lo largo de su ciclo de vida, aplicando estándares internacionales, enfoques ágiles y la normativa de inversión pública peruana.",
    schedule: "Viernes y sábado",
    totalHours: 320,
    credits: 20,
    order: 50,
    objectives: [
      "Planificar el alcance, cronograma y costos de un proyecto con técnicas reconocidas internacionalmente.",
      "Gestionar riesgos, calidad e interesados durante la ejecución y el control del proyecto.",
      "Formular y evaluar proyectos de inversión pública en el marco de Invierte.pe.",
    ],
    graduateProfile: [
      "Dirige proyectos aplicando buenas prácticas internacionales y marcos ágiles.",
      "Elabora líneas base de alcance, tiempo y costo, y controla su ejecución.",
      "Gestiona riesgos, calidad y comunicaciones con los interesados.",
      "Formula proyectos de inversión pública viables para el territorio.",
    ],
    modules: [
      {
        code: "DGPI-M1",
        order: 1,
        name: "Fundamentos de Dirección de Proyectos",
        summary:
          "Marco conceptual de la dirección de proyectos: ciclo de vida, procesos, roles y entornos de gobernanza.",
        topics: [
          "Ciclo de vida y estructuras organizacionales",
          "Grupos de procesos y áreas de conocimiento",
          "Acta de constitución y gestión de interesados",
          "Oficinas de proyectos (PMO)",
        ],
      },
      {
        code: "DGPI-M2",
        order: 2,
        name: "Alcance, Cronograma y Costos",
        summary:
          "Técnicas de planificación de las líneas base del proyecto y su control mediante valor ganado.",
        topics: [
          "EDT y definición del alcance",
          "Redes, ruta crítica y nivelación de recursos",
          "Estimación y presupuesto de costos",
          "Control con gestión del valor ganado (EVM)",
        ],
      },
      {
        code: "DGPI-M3",
        order: 3,
        name: "Metodologías Ágiles",
        summary:
          "Enfoques adaptativos para entornos de alta incertidumbre: valores, marcos de trabajo y escalamiento.",
        topics: [
          "Manifiesto ágil y mentalidad adaptativa",
          "Scrum: roles, eventos y artefactos",
          "Kanban y gestión del flujo",
          "Enfoques híbridos en proyectos de ingeniería",
        ],
      },
      {
        code: "DGPI-M4",
        order: 4,
        name: "Riesgos, Calidad y Adquisiciones",
        summary:
          "Gestión integral de la incertidumbre, la calidad y los contratos durante el ciclo de vida del proyecto.",
        topics: [
          "Identificación y análisis cualitativo y cuantitativo de riesgos",
          "Planes de respuesta y reservas",
          "Aseguramiento y control de calidad",
          "Estrategias de contratación y adquisiciones",
        ],
      },
      {
        code: "DGPI-M5",
        order: 5,
        name: "Proyectos de Inversión Pública",
        summary:
          "Formulación y evaluación de proyectos bajo el sistema nacional de programación multianual y gestión de inversiones.",
        topics: [
          "El ciclo de inversión en Invierte.pe",
          "Identificación, formulación y evaluación social",
          "Fichas técnicas y estudios de preinversión",
          "Seguimiento de la ejecución y cierre",
        ],
      },
    ],
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  for (const d of DIPLOMAS) {
    const { modules, ...data } = d;
    console.log(`→ Sembrando ${data.code} (${data.title})…`);
    const diploma = await prisma.diploma.upsert({
      where: { slug: data.slug },
      update: { ...COMMON, ...data },
      create: { ...COMMON, ...data },
    });

    await prisma.diplomaModule.deleteMany({ where: { diplomaId: diploma.id } });
    for (const m of modules) {
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
    console.log(`  ✓ ${modules.length} módulos`);
  }

  console.log("✓ Diplomados de muestra listos.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("✗", e);
  process.exit(1);
});
