"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/admin/Icon";
import {
  ACCEPT_ATTR,
  INITIAL_VOUCHER_STATE,
  MAX_FILE_BYTES,
  PAYMENT_SLOTS,
  fmtBytes,
  formatReceipt,
  type FieldErrors,
  type PaymentKind,
  type VoucherLookup,
  type VoucherMap,
  type VoucherSubmitState,
} from "@/lib/applications";
import { lookupVouchers, submitVouchers } from "./actions";

/* ────────────────────────────────────────────────────────────────
   Formulario de vouchers (matrícula + mensualidad)
   Dos pasos: (1) identificarse con el número de documento → el sistema
   busca la postulación y muestra qué vouchers ya tiene; (2) subir los
   que falten. Se usa en la pantalla de éxito de la postulación (con el
   documento ya conocido) y en el panel flotante de /postular.
   ──────────────────────────────────────────────────────────────── */

type Props = {
  slug: string;
  /** Documento ya conocido (pantalla de éxito): salta el paso 1. */
  initialDocNumber?: string;
  /** Compacto: sin título grande (para el modal flotante). */
  compact?: boolean;
  onDone?: () => void;
};

export function VoucherForm({ slug, initialDocNumber, compact, onDone }: Props) {
  const [docNumber, setDocNumber] = useState(initialDocNumber ?? "");
  const [lookup, setLookup] = useState<VoucherLookup | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();

  const doLookup = (value: string) => {
    const v = value.trim();
    // Todo el setState ocurre dentro de la transición (asíncrono).
    startLookup(async () => {
      if (v.length < 6) {
        setLookupErr("Ingresa tu número de documento.");
        return;
      }
      const res = await lookupVouchers(slug, v);
      setLookup(res);
      setLookupErr(
        res.found
          ? null
          : "No encontramos una postulación con ese documento para este diplomado.",
      );
    });
  };

  // Con documento conocido, busca de inmediato.
  useEffect(() => {
    if (initialDocNumber) doLookup(initialDocNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocNumber]);

  const found = lookup?.found ? lookup : null;

  return (
    <div className={`vf ${compact ? "vf--compact" : ""}`}>
      {!compact && (
        <div className="vf__head">
          <span className="vf__eyebrow">Paso final</span>
          <h3 className="vf__title">Envía tus vouchers de pago</h3>
          <p className="vf__lead">
            Para completar tu postulación realiza los dos pagos con estos
            códigos y sube aquí los comprobantes.
          </p>
        </div>
      )}

      {/* Códigos de pago, siempre visibles */}
      <ul className="vf__codes" aria-label="Códigos de pago">
        {PAYMENT_SLOTS.map((p) => (
          <li key={p.kind} className="vf__code">
            <span className="vf__code-label">{p.label.replace("Voucher de ", "")}</span>
            <span className="vf__code-num">{p.code}</span>
            <span className="vf__code-sub">código de pago</span>
          </li>
        ))}
      </ul>

      {/* Paso 1: identificarse */}
      {!found && (
        <form
          className="vf__lookup"
          onSubmit={(e) => {
            e.preventDefault();
            doLookup(docNumber);
          }}
        >
          <label className="ps-label" htmlFor={`vf-doc-${slug}`}>
            Número de documento con el que postulaste
          </label>
          <div className="vf__lookup-row">
            <input
              id={`vf-doc-${slug}`}
              className={`ps-input ${lookupErr ? "is-invalid" : ""}`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="DNI, CE o pasaporte"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              disabled={looking}
            />
            <button
              type="submit"
              className="ps-btn ps-btn--primary"
              disabled={looking}
            >
              {looking ? "Buscando…" : "Continuar"}
            </button>
          </div>
          {lookupErr && (
            <p className="vf__err" role="alert">
              <Icon name="alert" size={14} /> {lookupErr}
            </p>
          )}
        </form>
      )}

      {/* Paso 2: subir vouchers */}
      {found && (
        <>
          <div className="vf__who">
            <span className="vf__who-icon">
              <Icon name="check" size={16} />
            </span>
            <span>
              Hola, <b>{found.firstName}</b>. Postulación <code>{found.code}</code>
              {!initialDocNumber && (
                <>
                  {" "}
                  ·{" "}
                  <button
                    type="button"
                    className="vf__link"
                    onClick={() => {
                      setLookup(null);
                      setDocNumber("");
                    }}
                  >
                    cambiar documento
                  </button>
                </>
              )}
            </span>
          </div>

          <UploadForm
            slug={slug}
            docNumber={docNumber.trim()}
            initialUploaded={found.uploaded}
            onDone={onDone}
          />
        </>
      )}
    </div>
  );
}

/* Sub-formulario de subida. Mantiene los archivos elegidos en estado local;
   tras un envío correcto se remonta (key) para limpiar la selección. */
function UploadForm({
  slug,
  docNumber,
  initialUploaded,
  onDone,
}: {
  slug: string;
  docNumber: string;
  initialUploaded: VoucherMap;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    submitVouchers,
    INITIAL_VOUCHER_STATE,
  );
  const successKey = state.status === "success" ? JSON.stringify(state.uploaded) : "";
  // Estado efectivo: lo que devolvió el último envío, o lo que había al buscar.
  const uploaded = state.status === "success" ? state.uploaded : initialUploaded;
  const allDone = PAYMENT_SLOTS.every((p) => uploaded[p.kind]);

  return (
    <>
      {allDone && state.status !== "success" && (
        <div className="vf__ok" role="status">
          <Icon name="check" size={16} />
          Ya recibimos tus dos vouchers. Puedes volver a subirlos si necesitas
          reemplazarlos.
        </div>
      )}
      {state.status === "success" && (
        <div className="vf__ok" role="status">
          <Icon name="check" size={16} />
          {allDone
            ? "¡Listo! Recibimos tus dos vouchers. Tu postulación está completa."
            : "Voucher recibido. Aún falta el otro comprobante."}
        </div>
      )}
      {state.status === "error" && (
        <p className="vf__err" role="alert">
          <Icon name="alert" size={14} /> {state.message}
        </p>
      )}

      <UploadFields
        key={successKey}
        slug={slug}
        docNumber={docNumber}
        uploaded={uploaded}
        state={state}
        formAction={formAction}
        pending={pending}
        allDone={allDone}
        onDone={onDone}
      />
    </>
  );
}

function UploadFields({
  slug,
  docNumber,
  uploaded,
  state,
  formAction,
  pending,
  allDone,
  onDone,
}: {
  slug: string;
  docNumber: string;
  uploaded: VoucherMap;
  state: VoucherSubmitState;
  formAction: (formData: FormData) => void;
  pending: boolean;
  allDone: boolean;
  onDone?: () => void;
}) {
  const [picked, setPicked] = useState<Partial<Record<PaymentKind, File>>>({});
  const [guideOpen, setGuideOpen] = useState(false);
  const fieldErrors: FieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <form
      className="vf__form"
      noValidate
      // Envío manual: con `action=` React reinicia el formulario tras cada
      // respuesta y el usuario perdería archivo, recibo y fecha al corregir.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="docNumber" value={docNumber} />

      {/* Guía: dónde están el número de recibo y la fecha en el voucher */}
      <div className="vf__guide">
        <p className="vf__guide-text">
          <Icon name="info" size={15} />
          <span>
            Por cada voucher indica el <b>número de recibo</b> (ej. 002 - 00060299)
            y la <b>fecha de pago</b> tal como figuran en el comprobante de caja.
          </span>
        </p>
        <button
          type="button"
          className="vf__link"
          aria-expanded={guideOpen}
          onClick={() => setGuideOpen((v) => !v)}
        >
          {guideOpen ? "Ocultar ejemplo" : "Ver ejemplo"}
        </button>
      </div>
      {guideOpen && (
        <figure className="vf__guide-fig">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/vaucher/vaucher_pago.png"
            alt="Ejemplo de recibo de pago de caja UNAMAD con el número de recibo y la fecha de pago resaltados"
            width={1024}
            height={1536}
            loading="lazy"
          />
        </figure>
      )}

      <div className="ps-docs vf__docs">
        {PAYMENT_SLOTS.map((p) => {
          const file = picked[p.kind];
          const has = uploaded[p.kind];
          const err = fieldErrors[p.kind];
          return (
            <div
              key={p.kind}
              className={`ps-doc ${file || has ? "is-filled" : ""} ${
                err ? "is-invalid" : ""
              }`}
            >
              <div className="ps-doc__head">
                <span className="ps-doc__label">{p.label}</span>
                {file ? (
                  <span className="ps-doc__file" title={file.name}>
                    <Icon name="check" size={13} /> {file.name}
                  </span>
                ) : has ? (
                  <span className="ps-doc__file">
                    <Icon name="check" size={13} /> Recibido
                  </span>
                ) : null}
              </div>
              <p className="ps-doc__hint">
                {p.hint} Máx. {fmtBytes(MAX_FILE_BYTES)}.
              </p>
              {has && !file && (
                <p className="vf__saved">
                  Recibo <b>{formatReceipt(has.receiptNumber)}</b>
                  {has.paidAt && (
                    <>
                      {" "}
                      · pagado el{" "}
                      <b>
                        {new Date(has.paidAt).toLocaleDateString("es-PE", {
                          timeZone: "America/Lima",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </b>
                    </>
                  )}
                </p>
              )}
              <div className="vf__fields">
                <label className="vf__field">
                  <span className="ps-label">Número de recibo</span>
                  <input
                    className={`ps-input ${fieldErrors[`${p.kind}_receipt`] ? "is-invalid" : ""}`}
                    name={`${p.kind}_receipt`}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="002 - 00060299"
                    maxLength={16}
                    defaultValue={has ? formatReceipt(has.receiptNumber) : ""}
                  />
                  {fieldErrors[`${p.kind}_receipt`] && (
                    <span className="vf__err">
                      <Icon name="alert" size={13} /> {fieldErrors[`${p.kind}_receipt`]}
                    </span>
                  )}
                </label>
                <label className="vf__field">
                  <span className="ps-label">Fecha de pago</span>
                  <input
                    className={`ps-input ${fieldErrors[`${p.kind}_paidAt`] ? "is-invalid" : ""}`}
                    type="date"
                    name={`${p.kind}_paidAt`}
                    max={todayStr}
                    defaultValue={has?.paidAt ? has.paidAt.slice(0, 10) : ""}
                  />
                  {fieldErrors[`${p.kind}_paidAt`] && (
                    <span className="vf__err">
                      <Icon name="alert" size={13} /> {fieldErrors[`${p.kind}_paidAt`]}
                    </span>
                  )}
                </label>
              </div>
              <label className="ps-doc__drop">
                <Icon name="download" size={16} />
                {file ? "Cambiar archivo" : has ? "Reemplazar" : "Elegir archivo"}
                <input
                  type="file"
                  name={p.kind}
                  accept={ACCEPT_ATTR}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setPicked((prev) => ({ ...prev, [p.kind]: f ?? undefined }));
                  }}
                />
              </label>
              {err && (
                <p className="vf__err" role="alert">
                  <Icon name="alert" size={14} /> {err}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {fieldErrors.files && (
        <p className="vf__err" role="alert">
          <Icon name="alert" size={14} /> {fieldErrors.files}
        </p>
      )}

      <div className="vf__actions">
        <button
          type="submit"
          className="ps-btn ps-btn--primary"
          disabled={pending || !Object.values(picked).some(Boolean)}
        >
          {pending ? "Enviando…" : "Enviar vouchers"}
        </button>
        {onDone && (
          <button type="button" className="ps-btn ps-btn--ghost" onClick={onDone}>
            {allDone ? "Cerrar" : "Más tarde"}
          </button>
        )}
      </div>
    </form>
  );
}
