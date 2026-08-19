# Intranet académica — Fase 2 (Diseño)

**Fecha:** 2026-08-19
**Estado:** Aprobado por el usuario (diseño en chat)
**Base:** Fase 1 mergeada (spec `2026-08-18-diplomados-administrables-fase1-design.md`): diplomados administrables, rol `docente` con login, `TeacherProfile`, docente responsable por módulo (`DiplomaModule.teacherId`).

## Problema

El docente puede iniciar sesión pero solo consulta diplomados. Se necesita una
intranet académica completa: matrícula de estudiantes, y gestión del curso por
el docente (asistencia, notas, trabajos, materiales) con portal para el alumno.

## Decisiones tomadas (con el usuario)

- Estudiantes salen de **postulaciones aceptadas** (conversión con un clic) y
  también por **alta manual** para casos excepcionales.
- Los estudiantes **inician sesión desde esta fase** (portal del alumno incluido).
- Seguridad por **propiedad**, no solo permiso: docente gestiona solo módulos
  donde `teacherId` es el suyo; alumno solo ve sus propias matrículas. Sin
  permisos por-módulo en RBAC (sobre-ingeniería descartada).
- Escala de calificación peruana **0–20** (2 decimales). Promedio de módulo =
  ponderado por pesos de evaluación (calculado, nunca almacenado).
- Entregas de archivos en `storage/entregas/` fuera de `/public`, con descarga
  por ruta protegida — mismo patrón que `src/lib/applications-storage.ts`.

## Subsistemas (orden de construcción)

Un plan de implementación por subsistema; se ejecutan A → B → C.

### A — Matrícula (admin)

**Roles/permisos nuevos:** rol `estudiante` (permiso `aula.view`); `docente`
gana `teaching.manage`; `admin`/`superadmin` ganan `enrollments.read` y
`enrollments.write` (categoría "Matrículas"). `viewer` gana `enrollments.read`.

**Modelos:**

```prisma
model StudentProfile {
  id        String  @id @default(cuid())
  userId    String  @unique
  docType   IdDocType @default(DNI)
  docNumber String
  phone     String?

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  enrollments Enrollment[]

  @@index([docNumber])
}

enum EnrollmentStatus {
  active     // cursando
  withdrawn  // retirado (conserva historial, pierde acceso al aula)
  completed  // concluido
}

model Enrollment {
  id            String           @id @default(cuid())
  studentId     String
  diplomaId     String
  applicationId String?          @unique // postulación de origen; null = alta manual
  status        EnrollmentStatus @default(active)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  student     StudentProfile     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  diploma     Diploma            @relation(fields: [diplomaId], references: [id], onDelete: Restrict)
  application DiplomaApplication? @relation(fields: [applicationId], references: [id], onDelete: SetNull)
  attendance  AttendanceRecord[]
  grades      Grade[]
  submissions Submission[]

  @@unique([studentId, diplomaId])
  @@index([diplomaId])
}
```

(`Diploma` con matrículas usa `onDelete: Restrict`: no se elimina un diplomado
con historial académico; se cierra. Refuerza el guard existente de
postulaciones.)

**UI:**

- Detalle de postulación **aceptada** (`/postulaciones/[id]`): botón
  **"Matricular"**. Transacción: crea `User` (email del postulante, nombre
  completo, contraseña temporal generada aleatoria mostrada UNA vez al admin)
  + rol `estudiante` + `StudentProfile` (con docType/docNumber/phone de la
  postulación) + `Enrollment` enlazada a la postulación. Si el email ya es
  usuario: añade rol/perfil/matrícula sin tocar su contraseña. Si ya está
  matriculado en ese diplomado: aviso, sin duplicar.
- Página **`/matriculas`** (sidebar "Matrículas", `enrollments.read`): tabla
  global — alumno, documento, diplomado, origen (postulación/manual), estado,
  fecha — con filtro por diplomado y estado. **Alta manual** (modal: datos del
  alumno + diplomado + contraseña temporal). Acciones: retirar / reactivar /
  marcar concluida (`enrollments.write`).

### B — Intranet del docente (`/docencia`)

**Modelos:**

```prisma
model ModuleSession {
  id       String   @id @default(cuid())
  moduleId String
  date     DateTime // fecha de la clase
  topic    String   // tema tratado
  order    Int

  module     DiplomaModule      @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  attendance AttendanceRecord[]

  @@index([moduleId])
}

enum AttendanceStatus {
  presente
  tardanza
  falta
  justificada
}

model AttendanceRecord {
  sessionId    String
  enrollmentId String
  status       AttendanceStatus

  session    ModuleSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  enrollment Enrollment    @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@id([sessionId, enrollmentId])
  @@index([enrollmentId])
}

enum AssessmentKind {
  tarea
  trabajo
  examen
  participacion
}

model Assessment {
  id               String         @id @default(cuid())
  moduleId         String
  title            String
  description      String?
  kind             AssessmentKind @default(tarea)
  weight           Int            // % del promedio del módulo (0–100)
  dueDate          DateTime?
  allowsSubmission Boolean        @default(false)
  createdAt        DateTime       @default(now())

  module      DiplomaModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  grades      Grade[]
  submissions Submission[]

  @@index([moduleId])
}

model Grade {
  assessmentId String
  enrollmentId String
  score        Decimal  @db.Decimal(4, 2) // 0.00–20.00
  feedback     String?
  gradedAt     DateTime @default(now())

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@id([assessmentId, enrollmentId])
  @@index([enrollmentId])
}

model ModuleMaterial {
  id       String @id @default(cuid())
  moduleId String
  title    String
  url      String
  order    Int    @default(0)

  module DiplomaModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@index([moduleId])
}
```

**UI:**

- Sidebar **"Mi docencia"** (`teaching.manage`). `/docencia`: tarjetas/tabla de
  los módulos con `teacherId = miTeacherProfile.id` (diplomado, nº de
  matriculados activos, nº de sesiones).
- **`/docencia/[moduleId]`** — guard duro: el módulo debe ser mío, si no
  redirect a `/403`. Cuatro pestañas:
  1. **Sesiones y asistencia:** CRUD de sesiones (fecha + tema). Al expandir
     una sesión: lista de matriculados ACTIVOS del diplomado con selector de
     estado (los 4 valores; sin registro = aún no pasada); guardado por sesión
     (upsert masivo).
  2. **Evaluaciones y notas:** CRUD de evaluaciones (título, tipo, peso,
     fecha, acepta entrega). Aviso visible si la suma de pesos ≠ 100 (no
     bloquea). Tabla de notas: filas = alumnos activos, columnas =
     evaluaciones; celdas editables 0–20 (vacía = sin calificar); columna
     final = promedio ponderado sobre las evaluaciones calificadas.
  3. **Materiales:** lista de enlaces (título + URL) con añadir/quitar/ordenar.
  4. **Estudiantes:** roster con % de asistencia (presente+tardanza sobre
     sesiones registradas) y promedio actual; para evaluaciones con entrega,
     indicador de entregado y acceso a la entrega (descarga protegida o
     enlace) para calificar.

### C — Portal del estudiante (`/aula`)

**Modelo:**

```prisma
model Submission {
  id           String   @id @default(cuid())
  assessmentId String
  enrollmentId String
  fileName     String?  // nombre original mostrado
  storedPath   String?  // storage/entregas/<assessmentId>/<archivo>
  linkUrl      String?  // alternativa: entrega por enlace
  comment      String?
  submittedAt  DateTime @default(now())

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@unique([assessmentId, enrollmentId])
}
```

**UI:**

- Sidebar **"Mi aula"** (`aula.view`). `/aula`: diplomados con matrícula
  ACTIVA del alumno → módulos de cada uno.
- **`/aula/modulo/[moduleId]`** — guard: existe matrícula activa mía en el
  diplomado del módulo; si no, `/403`. Pestañas:
  - **Notas:** sus calificaciones por evaluación + promedio ponderado.
  - **Asistencia:** sus registros por sesión + % de asistencia.
  - **Materiales:** los enlaces del módulo.
  - **Trabajos:** evaluaciones con su estado (pendiente/entregado/calificado,
    fecha límite). Si `allowsSubmission` y no venció: subir archivo (PDF, DOC,
    DOCX, ZIP; máx. 10 MB) **o** enlace + comentario. Puede reemplazar su
    entrega mientras no exista `Grade` para esa evaluación. Vencida la fecha
    límite, no se aceptan entregas nuevas ni reemplazos.
- **Almacenamiento:** `src/lib/submissions-storage.ts` clonando el patrón de
  `applications-storage.ts` (raíz `storage/entregas/`, nombre aleatorio,
  bloqueo de path traversal). Descarga por route handler protegido: solo el
  alumno dueño o el docente del módulo (o admin con `enrollments.read`).

## Seguridad (transversal)

- Cada server action valida sesión + permiso + **propiedad**:
  - Docente: `module.teacherId === me.teacherProfile.id` (cargar el módulo y
    comparar; nunca confiar en ids del cliente).
  - Alumno: la `Enrollment` referida pertenece a `me` y está `active`.
  - Admin: `enrollments.write` gestiona matrículas; NO califica ni pasa lista.
- Validaciones: score 0–20 con 2 decimales; weight entero 0–100; asistencia
  solo estados del enum; no calificar/pasar lista a matrículas no activas;
  MIME y tamaño de archivo validados en servidor.
- Retirar matrícula conserva notas/asistencia y corta el acceso del alumno a
  ese diplomado (los guards filtran por `status: active`).
- Contraseñas temporales: generadas (12 caracteres aleatorios), mostradas una
  sola vez; el hash con `hashPassword` existente.

## Verificación

E2E en navegador por subsistema y un ciclo completo final: aceptar postulación
→ matricular (capturar contraseña temporal) → login docente: crear sesión,
pasar lista, crear trabajo con entrega y peso, calificar → login alumno: ver
notas/asistencia, subir entrega → docente ve la entrega y la califica → alumno
ve la nota. Flujos negativos: docente ajeno al módulo → 403; alumno ajeno →
403; entrega tras fecha límite → rechazada; reemplazo tras calificación →
rechazado.

## Fuera de alcance (YAGNI)

- Notificaciones por correo.
- Exportación de actas (PDF/Excel).
- Mensajería docente–alumno y foros.
- Recuperación de contraseña autoservicio (existe gestión por admin).
- Certificados y cierre académico del diplomado.
- Varios docentes por módulo (sigue el diseño de Fase 1).
