import type { IconName } from "./Icon";
import type { PermissionKey } from "@/lib/auth/permissions";

export type AdminNotification = {
  id: string;
  title: string;
  sub: string;
  icon: IconName;
  href: string;
};

export type SidebarChild = { id: string; label: string; href: string };
export type SidebarItem = {
  id: string;
  label: string;
  icon: IconName;
  href?: string;
  /** Permiso necesario para ver el ítem; sin él, visible para cualquier sesión. */
  perm?: PermissionKey;
  expandable?: boolean;
  dot?: boolean;
  children?: SidebarChild[];
};

export const SIDEBAR_NAV: SidebarItem[] = [
  { id: "inicio", label: "Inicio", icon: "home", href: "/inicio" },
  { id: "usuarios", label: "Usuarios", icon: "users", href: "/usuarios", perm: "users.read" },
  { id: "roles", label: "Roles", icon: "shield", href: "/roles", perm: "roles.read" },
  { id: "incidentes", label: "Incidentes", icon: "alert", href: "/incidentes", perm: "incidents.read" },
  { id: "diplomados", label: "Diplomados", icon: "cloud", href: "/diplomados", perm: "diplomas.read" },
  { id: "docentes", label: "Docentes", icon: "user", href: "/docentes", perm: "users.read" },
  { id: "postulaciones", label: "Postulaciones", icon: "inbox", href: "/postulaciones", perm: "applications.read" },
];
