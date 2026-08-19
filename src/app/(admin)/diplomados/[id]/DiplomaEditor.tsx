"use client";

import Link from "next/link";
import { Icon } from "@/components/admin/Icon";
import { GeneralSection } from "./GeneralSection";
import { MetricsSection } from "./MetricsSection";
import { ListsSection } from "./ListsSection";
import type { EditorDiploma, EditorModule, EditorPerms, TeacherOption } from "./types";

const STATUS_LABEL: Record<EditorDiploma["status"], string> = {
  published: "Publicado",
  draft: "Borrador",
  closed: "Cerrado",
};

export function DiplomaEditor({
  diploma,
  modules,
  teachers,
  perms,
}: {
  diploma: EditorDiploma;
  modules: EditorModule[];
  teachers: TeacherOption[];
  perms: EditorPerms;
}) {
  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <h1>{diploma.title}</h1>
          <span className="page__sub">
            {diploma.code} · {STATUS_LABEL[diploma.status]} · {modules.length} módulo
            {modules.length === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="linkbtn" href="/diplomados">
            <Icon name="chevron-right" size={15} style={{ transform: "rotate(180deg)" }} />
            Volver a la lista
          </Link>
          {diploma.status === "published" && (
            <Link className="linkbtn" href={`/diplomado/${diploma.slug}`} target="_blank">
              <Icon name="external" size={15} />
              Ver pública
            </Link>
          )}
        </div>
      </div>

      <GeneralSection diploma={diploma} canWrite={perms.canWrite} />
      <MetricsSection diploma={diploma} canWrite={perms.canWrite} />
      <ListsSection diploma={diploma} canWrite={perms.canWrite} />
      {/* ModulesSection (Task 8) se añade aquí */}
    </div>
  );
}
