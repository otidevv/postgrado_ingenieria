# Diplomados administrables + Docentes — Fase 1 (Diseño)

**Fecha:** 2026-08-18
**Estado:** Aprobado por el usuario (diseño en chat)

## Contexto y problema

Hoy el panel `/diplomados` solo permite publicar/ocultar programas. Todo el
contenido (datos generales, costos, requisitos, módulos, docentes) vive en la
semilla `prisma/seed-diplomas.ts`, y los docentes son un simple `String[]
instructors` en el modelo `Diploma`. Se necesita:

1. Administrar los diplomados por completo desde el panel (sin semillas).
2. Gestionar docentes como usuarios del sistema (con login desde el inicio).
3. Asignar un docente responsable a cada módulo.

## Hoja de ruta (contexto mayor)

- **Fase 1 (este spec):** CRUD de diplomados + rol docente + asignación por módulo.
- **Fase 2 (spec futuro):** panel del docente — planificación del módulo
  (temas/sesiones, trabajos, materiales, enlaces de clase).
- **Fase 3 (spec futuro):** aula virtual del alumno — cuentas para admitidos,
  entregas de trabajos, calificaciones.

Las fases 2 y 3 se diseñan por separado; esta fase deja la base de datos y de
permisos que aquellas necesitan (docente = usuario, `teacherId` por módulo).

## Decisiones tomadas (con el usuario)

- Los docentes **inician sesión desde el día uno** → se modelan como `User`
  con rol `docente`, no como catálogo aparte.
- **Un** docente responsable por módulo (FK simple, nullable). Si algún día se
  necesitan varios, se migra a tabla intermedia — barato de hacer después.
- Editor de diplomado en **página dedicada** `/diplomados/[id]` (no modales):
  el volumen de contenido (~15 campos + 3 listas + N módulos) no cabe en modales.

## Modelo de datos

### Nuevo rol `docente`

En `src/lib/auth/permissions.ts` (`ROLE_DEFS`): rol `docente` con permisos
mínimos (`diplomas.read`). La Fase 2 le añadirá los permisos de su panel.
`prisma/seed.ts` lo crea/actualiza de forma idempotente como ya hace con los demás.

### Nuevo modelo `TeacherProfile`

```prisma
model TeacherProfile {
  id             String  @id @default(cuid())
  userId         String  @unique
  academicDegree String            // "Dr.", "Mg.", "Ing."
  specialty      String?           // p. ej. "Redes y Seguridad"
  bio            String?
  photoUrl       String?
  orcid          String?

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  modules DiplomaModule[]
}
```

### Cambios en modelos existentes

- `DiplomaModule.teacherId String?` + relación a `TeacherProfile` con
  `onDelete: SetNull`. Nullable: un módulo puede estar sin docente asignado.
- `Diploma.instructors String[]` **se conserva temporalmente** como fallback de
  la web pública. Se eliminará en una migración posterior cuando todos los
  diplomados tengan docentes reales asignados.
- `User` gana la relación inversa `teacherProfile TeacherProfile?`.

### Migración y semillas

- Una migración Prisma para `TeacherProfile` + `teacherId`.
- `seed-diplomas.ts` deja de ser la fuente de verdad: queda solo como carga
  inicial de ejemplo.

## Páginas admin

### `/docentes` (nueva; patrón visual de `/usuarios`)

- Tabla: nombre, grado, especialidad, nº de módulos asignados, estado activo.
- **Nuevo docente:** un formulario que crea `User` (nombre, email, contraseña
  temporal) con rol `docente` + su `TeacherProfile`, en una transacción.
  - Si el email ya existe como usuario: ofrecer convertirlo en docente
    (añadir rol + crear perfil), sin duplicar la cuenta.
- Editar perfil académico; activar/desactivar reutiliza `User.active`.
- Permisos: `users.write` para crear/editar (crear docente ES crear usuario);
  `diplomas.read` para ver la página.

### `/diplomados` (existente)

- La tabla gana botón **Editar** por fila (→ `/diplomados/[id]`) y botón
  **Nuevo diplomado** en la cabecera.
- "Nuevo diplomado" crea un borrador con datos mínimos (título, slug, código)
  y redirige al editor.
- Se elimina el banner "se gestiona desde la semilla".

### `/diplomados/[id]` (nueva — el editor)

Página con secciones (pestañas o bloques colapsables):

1. **Datos generales:** título, slug, código, subtítulo, facultad, resumen,
   descripción, objetivo, modalidad, horario, etiqueta de admisión,
   destacado, orden.
2. **Costos y métricas:** matrícula, costo por módulo, certificación, horas
   totales, créditos, semanas por módulo, matrícula mínima.
3. **Listas:** objetivos específicos, requisitos, perfil del egresado —
   editor de lista con añadir/quitar/reordenar renglones.
4. **Módulos:** lista ordenable. Cada módulo edita código, nombre, sumilla,
   horas sincrónicas/asincrónicas, créditos, temas (lista) y **docente
   responsable** (dropdown de docentes activos). Crear y eliminar módulos
   (eliminar pide confirmación).

Comportamiento:

- Guardado **por sección** con server actions (patrón `ActionResult` existente).
- Validación con mensajes en español.
- `revalidatePath` de `/`, `/diplomados` y `/diplomado/[slug]` tras cada cambio.

## Web pública

- `/diplomado/[slug]`: la sección "Instructores" muestra los docentes
  asignados a los módulos (únicos, con grado y foto si existe). Si ningún
  módulo tiene docente, cae al `instructors[]` antiguo (sin romper nada el
  día uno).
- El acordeón de módulos muestra "Docente: Mg. Fulano" cuando está asignado.

## Seguridad y manejo de errores

- Server actions verifican `diplomas.write` (editor de diplomados) o
  `users.write` (gestión de docentes), siguiendo el patrón actual de
  `getCurrentUser()` + `permissions.has(...)`.
- Unicidad de `slug`/`code`: capturar el error P2002 de Prisma y responder
  "Ese slug/código ya existe".
- **No** se puede eliminar un diplomado con postulaciones — solo cerrarlo u
  ocultarlo. Sin postulaciones, eliminar pide confirmación.
- Desactivar un docente no rompe módulos (la FK queda; la web pública solo
  lista docentes activos).

## Verificación

- Flujo end-to-end con Playwright: crear docente → crear/editar diplomado →
  asignar docente a un módulo → verificar que aparece en la web pública.
- Casos de error: slug duplicado, email de docente ya existente, eliminar
  diplomado con postulaciones (debe rechazarse).

## Fuera de alcance (YAGNI)

- Panel del docente y todo lo de Fase 2/3.
- Varios docentes por módulo.
- Subida de foto del docente (se usa URL por ahora; el proyecto ya tiene
  `storage/` para documentos, la subida de imágenes puede añadirse en Fase 2).
- Versionado/historial de cambios del diplomado.
