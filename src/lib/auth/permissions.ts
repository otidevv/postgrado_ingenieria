// Single source of truth for all permission keys in the app.
// Used by the seed AND by ui/server-side checks.
//
// Cada categoría DEBE corresponder a un módulo real (UI o API).
// - "Usuarios"   → /usuarios
// - "Roles"      → /roles
// - "Incidentes" → API /api/v1/incidents (admin UI pendiente)

export type PermissionDef = {
  key: string;
  name: string;
  description: string;
  category: string;
};

export const PERMISSIONS: PermissionDef[] = [
  {
    key: "users.read",
    name: "Ver usuarios",
    description: "Listar y consultar usuarios del sistema",
    category: "Usuarios",
  },
  {
    key: "users.write",
    name: "Gestionar usuarios",
    description: "Crear, editar y eliminar usuarios",
    category: "Usuarios",
  },
  {
    key: "users.assign-roles",
    name: "Asignar roles",
    description: "Cambiar los roles asignados a un usuario",
    category: "Usuarios",
  },
  {
    key: "roles.read",
    name: "Ver roles",
    description: "Consultar roles y permisos",
    category: "Roles",
  },
  {
    key: "roles.write",
    name: "Gestionar roles",
    description: "Crear, editar y eliminar roles personalizados",
    category: "Roles",
  },
  {
    key: "incidents.create",
    name: "Reportar incidentes",
    description: "Crear un nuevo reporte de incidente",
    category: "Incidentes",
  },
  {
    key: "incidents.read",
    name: "Ver todos los incidentes",
    description: "Consultar la bandeja de incidentes (admin)",
    category: "Incidentes",
  },
  {
    key: "incidents.read:own",
    name: "Ver mis incidentes",
    description: "Consultar solo los incidentes que el usuario reportó",
    category: "Incidentes",
  },
  {
    key: "incidents.write",
    name: "Gestionar incidentes",
    description: "Asignar, comentar y cambiar estado de incidentes",
    category: "Incidentes",
  },
  {
    key: "incidents.delete",
    name: "Eliminar incidentes",
    description: "Eliminar incidentes (solo casos excepcionales)",
    category: "Incidentes",
  },
  {
    key: "diplomas.read",
    name: "Ver diplomados",
    description: "Consultar los diplomados de posgrado y sus módulos",
    category: "Diplomados",
  },
  {
    key: "diplomas.write",
    name: "Gestionar diplomados",
    description: "Crear, editar, publicar y eliminar diplomados",
    category: "Diplomados",
  },
  {
    key: "applications.read",
    name: "Ver postulaciones",
    description: "Consultar las postulaciones a los diplomados y sus documentos",
    category: "Postulaciones",
  },
  {
    key: "applications.write",
    name: "Gestionar postulaciones",
    description: "Cambiar el estado y anotar la revisión de las postulaciones",
    category: "Postulaciones",
  },
];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ROLE_DEFS = [
  {
    key: "superadmin",
    name: "Superadministrador",
    description: "Acceso total al sistema. No editable.",
    system: true,
    permissions: PERMISSIONS.map((p) => p.key),
  },
  {
    key: "admin",
    name: "Administrador",
    description: "Gestiona usuarios, roles e incidentes del sistema.",
    system: true,
    permissions: [
      "users.read",
      "users.write",
      "users.assign-roles",
      "roles.read",
      "incidents.read",
      "incidents.write",
      "incidents.create",
      "incidents.read:own",
      "diplomas.read",
      "diplomas.write",
      "applications.read",
      "applications.write",
    ],
  },
  {
    key: "editor",
    name: "Gestor de incidentes",
    description:
      "Triage y seguimiento de la bandeja de incidentes; puede consultar usuarios.",
    system: true,
    permissions: [
      "users.read",
      "incidents.read",
      "incidents.write",
      "incidents.create",
      "incidents.read:own",
    ],
  },
  {
    key: "viewer",
    name: "Consulta",
    description: "Solo lectura sobre usuarios, roles e incidentes.",
    system: true,
    permissions: [
      "users.read",
      "roles.read",
      "incidents.read",
      "diplomas.read",
      "applications.read",
    ],
  },
  {
    key: "reporter",
    name: "Reportante",
    description:
      "Usuario final que puede crear y consultar sus propios reportes de incidente.",
    system: true,
    permissions: ["incidents.create", "incidents.read:own"],
  },
] as const;
