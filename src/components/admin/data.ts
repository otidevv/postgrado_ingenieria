import type { IconName } from "./Icon";

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
  expandable?: boolean;
  dot?: boolean;
  children?: SidebarChild[];
};

export const SIDEBAR_NAV: SidebarItem[] = [
  { id: "inicio", label: "Inicio", icon: "home", href: "/inicio" },
  { id: "usuarios", label: "Usuarios", icon: "users", href: "/usuarios" },
  { id: "roles", label: "Roles", icon: "shield", href: "/roles" },
  { id: "incidentes", label: "Incidentes", icon: "alert", href: "/incidentes" },
  { id: "diplomados", label: "Diplomados", icon: "cloud", href: "/diplomados" },
  { id: "postulaciones", label: "Postulaciones", icon: "inbox", href: "/postulaciones" },
];
