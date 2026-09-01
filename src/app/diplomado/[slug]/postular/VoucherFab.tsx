"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { VoucherForm } from "./VoucherForm";

/* Botón flotante "¿Ya postulaste? Envía tus vouchers" → abre un modal con
   el formulario de vouchers. Pensado para quien cerró la pantalla de éxito
   sin subirlos y vuelve más tarde a /diplomado/[slug]/postular. */
export function VoucherFab({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="vfab"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="vfab__icon">
          <Icon name="card" size={18} />
        </span>
        <span className="vfab__text">
          <span className="vfab__title">¿Ya postulaste?</span>
          <span className="vfab__sub">Envía tu voucher de matrícula</span>
        </span>
        <span className="vfab__pulse" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="ps-modal"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="ps-modal__card vfab__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vfab-title"
          >
            <div className="vfab__card-hd">
              <div>
                <span className="vf__eyebrow">Paso final de tu postulación</span>
                <h3 id="vfab-title" className="vf__title">
                  Envía tu voucher de matrícula
                </h3>
              </div>
              <button
                type="button"
                className="ps-modal__x"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="vfab__card-bd">
              <VoucherForm slug={slug} compact onDone={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
