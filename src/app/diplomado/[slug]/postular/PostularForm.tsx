"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Toaster, toast } from "sonner";
import { Icon } from "@/components/admin/Icon";
import {
  DOC_TYPES,
  GENDERS,
  INITIAL_SUBMIT_STATE,
} from "@/lib/applications";
import { submitApplication } from "./actions";
import "./postular.css";

/* ── Secciones del formulario, usadas por el rail de progreso ──
   `required` son los name= de los campos obligatorios de la sección;
   las secciones sin obligatorios se marcan como opcionales. */
const SECTIONS = [
  {
    id: "personales",
    title: "Datos personales",
    required: ["docType", "docNumber", "firstName", "lastName"],
  },
  { id: "contacto", title: "Contacto", required: ["email", "phone"] },
] as const;

const REQUIRED_SECTIONS = SECTIONS;

/** Sigue el tema claro/oscuro del sitio (html[data-theme]) para el Toaster. */
function useSiteTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const el = document.documentElement;
    const read = () =>
      setTheme(el.getAttribute("data-theme") === "dark" ? "dark" : "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

export function PostularForm({
  slug,
  diplomaTitle,
  modality,
  totalHours,
  credits,
  modulesCount,
}: {
  slug: string;
  diplomaTitle: string;
  modality: string;
  totalHours: number;
  credits: number;
  modulesCount: number;
}) {
  const [state, formAction, pending] = useActionState(
    submitApplication,
    INITIAL_SUBMIT_STATE,
  );
  const theme = useSiteTheme();

  // ── Autocompletado por DNI (consulta a la API institucional vía /api/dni) ──
  const [docType, setDocType] = useState("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [dniLookup, setDniLookup] = useState<{
    status: "idle" | "loading" | "ok" | "error";
    message?: string;
  }>({ status: "idle" });
  const [pendingDni, setPendingDni] = useState<{
    dni: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    gender: string;
    address: string;
    region: string;
    province: string;
    district: string;
  } | null>(null);
  const lastDni = useRef("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // ── Progreso por sección para el rail lateral ──
  // Se recalcula leyendo el FormData real, así cubre también los campos
  // no controlados (correo, teléfono, archivos…).
  const [sectionDone, setSectionDone] = useState<boolean[]>(() =>
    SECTIONS.map(() => false),
  );

  function recomputeProgress() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const filled = (n: string) => String(fd.get(n) ?? "").trim() !== "";
    const next = SECTIONS.map((s) => s.required.every(filled));
    // Evita re-renderizar en cada tecla si ninguna sección cambió de estado.
    setSectionDone((prev) =>
      next.every((v, i) => v === prev[i]) ? prev : next,
    );
  }

  // Cubre el autocompletado por DNI (campos controlados que cambian por
  // setState, sin disparar eventos de input en el DOM) y el estado inicial.
  useEffect(recomputeProgress, [
    docType,
    docNumber,
    firstName,
    lastName,
    birthDate,
    gender,
    address,
  ]);

  async function lookupDni(value: string) {
    if (docType !== "DNI" || !/^\d{8}$/.test(value)) return;
    if (lastDni.current === value && dniLookup.status === "ok") return;
    lastDni.current = value;
    setDniLookup({ status: "loading" });
    try {
      const res = await fetch(`/api/dni/${value}`);
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error ?? "No se pudo consultar el DNI.";
        setDniLookup({ status: "error", message });
        toast.error("Consulta de DNI", { description: message });
        return;
      }
      // Autocompleta los campos y muestra un modal informativo.
      if (data.firstName) setFirstName(data.firstName);
      if (data.lastName) setLastName(data.lastName);
      if (data.birthDate) setBirthDate(data.birthDate);
      if (data.gender) setGender(data.gender);
      if (data.address) setAddress(data.address);
      if (data.region) setRegion(data.region);
      if (data.province) setProvince(data.province);
      if (data.district) setDistrict(data.district);
      setPendingDni({
        dni: value,
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        birthDate: data.birthDate ?? "",
        gender: data.gender ?? "",
        address: data.address ?? "",
        region: data.region ?? "",
        province: data.province ?? "",
        district: data.district ?? "",
      });
      setDniLookup({ status: "idle" });
    } catch {
      const message = "No se pudo conectar con el servicio de consulta.";
      setDniLookup({ status: "error", message });
      toast.error("Consulta de DNI", { description: message });
    }
  }

  function dismissDni() {
    setPendingDni(null);
    setDniLookup({
      status: "ok",
      message: "Datos autocompletados desde tu DNI.",
    });
  }

  // Envío manual del Server Action: al despachar la acción con FormData
  // (en lugar de dejar que React procese <form action>), React NO resetea
  // los campos no controlados, así el postulante no pierde lo escrito
  // (correo, teléfono, archivos…) cuando hay errores de validación.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  // Reacciona al resultado del envío: modal para errores de negocio,
  // toast + scroll al primer campo inválido para errores de validación,
  // toast de confirmación en el éxito.
  useEffect(() => {
    if (state.status === "error") {
      if (state.modal) {
        setShowErrorModal(true);
        return;
      }
      const n = Object.keys(state.fieldErrors ?? {}).length;
      toast.error(state.message, {
        description: n
          ? `${n} ${n === 1 ? "campo requiere" : "campos requieren"} tu atención.`
          : undefined,
      });
      // Lleva al postulante al primer campo con error.
      requestAnimationFrame(() => {
        const bad = formRef.current?.querySelector<HTMLElement>(".is-invalid");
        if (!bad) return;
        bad.scrollIntoView({ behavior: "smooth", block: "center" });
        const input = bad.matches("input, select, textarea")
          ? bad
          : bad.querySelector<HTMLElement>("input, select, textarea");
        input?.focus({ preventScroll: true });
      });
    } else if (state.status === "success") {
      toast.success("¡Postulación registrada!", {
        description: `Tu código de seguimiento es ${state.code}.`,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state]);

  const fe = state.status === "error" ? state.fieldErrors ?? {} : {};
  const err = (name: string) =>
    fe[name] ? (
      <span className="ps-err" role="alert">
        {fe[name]}
      </span>
    ) : null;
  const cls = (name: string) => `ps-input${fe[name] ? " is-invalid" : ""}`;
  const inv = (name: string) => (fe[name] ? true : undefined);

  const toaster = (
    <Toaster
      theme={theme}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ style: { fontFamily: "inherit" } }}
    />
  );

  if (state.status === "success") {
    return (
      <>
        {toaster}
        <div className="ps-done">
          <span className="ps-done__icon">
            <Icon name="check" size={34} />
          </span>
          <h2>¡Postulación registrada!</h2>
          <p>
            Recibimos tu postulación al <b>Diplomado en {diplomaTitle}</b>.
            Guarda tu código de seguimiento:
          </p>
          <div className="ps-code">{state.code}</div>
          <p className="ps-done__note">
            Nuestro equipo de la Escuela de Posgrado revisará tus documentos y
            se comunicará contigo al correo registrado. Si necesitas asistencia,
            menciona tu código de seguimiento.
          </p>
          <div className="ps-done__actions">
            <Link href={`/diplomado/${slug}`} className="ps-btn ps-btn--primary">
              Volver al diplomado
            </Link>
            <Link href="/" className="ps-btn ps-btn--ghost">
              Ir al inicio
            </Link>
          </div>
        </div>
      </>
    );
  }

  const doneCount = REQUIRED_SECTIONS.filter(
    (s) => sectionDone[SECTIONS.findIndex((x) => x.id === s.id)],
  ).length;

  function jumpTo(id: string) {
    document
      .getElementById(`ps-sect-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
    {toaster}
    <div className="ps-layout">
    <div className="ps-mini">
      <div className="ps-mini__bar">
        <span
          style={{ width: `${(doneCount / REQUIRED_SECTIONS.length) * 100}%` }}
        />
      </div>
      <span className="ps-mini__label">
        {doneCount} de {REQUIRED_SECTIONS.length} secciones completas
      </span>
    </div>
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      onInput={recomputeProgress}
      onChange={recomputeProgress}
      className="ps-form"
      noValidate
    >
      <input type="hidden" name="slug" value={slug} />

      {state.status === "error" && !state.modal && (
        <div className="ps-alert" role="alert">
          <Icon name="alert" size={18} />
          <span>{state.message}</span>
        </div>
      )}

      {/* ── Datos personales ── */}
      <fieldset className="ps-sect" id="ps-sect-personales">
        <legend>
          <span className="ps-sect__num">1</span>Datos personales
        </legend>
        <p className="ps-sect__desc">
          Tus datos tal como figuran en tu documento de identidad. Si tienes
          DNI, podemos autocompletarlos por ti.
        </p>
        <div className="ps-grid">
          <label className="ps-field">
            <span className="ps-label">Tipo de documento *</span>
            <select
              name="docType"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className={cls("docType")}
              aria-invalid={inv("docType")}
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            {err("docType")}
          </label>
          <div className="ps-field">
            <span className="ps-label">Número de documento *</span>
            <div className="ps-dni-row">
              <input
                name="docNumber"
                aria-label="Número de documento"
                value={docNumber}
                onChange={(e) => {
                  const v =
                    docType === "DNI"
                      ? e.target.value.replace(/\D/g, "").slice(0, 8)
                      : e.target.value;
                  setDocNumber(v);
                  if (docType === "DNI" && /^\d{8}$/.test(v)) void lookupDni(v);
                }}
                inputMode={docType === "DNI" ? "numeric" : "text"}
                autoComplete="off"
                className={cls("docNumber")}
                aria-invalid={inv("docNumber")}
                placeholder="Ej. 71234567"
              />
              {docType === "DNI" && (
                <button
                  type="button"
                  className="ps-dni-btn"
                  onClick={() => void lookupDni(docNumber)}
                  disabled={
                    !/^\d{8}$/.test(docNumber) || dniLookup.status === "loading"
                  }
                >
                  {dniLookup.status === "loading" ? "Buscando…" : "Autocompletar"}
                </button>
              )}
            </div>
            {docType === "DNI" && dniLookup.status !== "idle" && (
              <span className={`ps-dni-msg ps-dni-msg--${dniLookup.status}`}>
                {dniLookup.status === "loading"
                  ? "Consultando datos del DNI…"
                  : dniLookup.message}
              </span>
            )}
            {err("docNumber")}
          </div>
          <label className="ps-field">
            <span className="ps-label">Nombres *</span>
            <input
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={cls("firstName")}
              aria-invalid={inv("firstName")}
              autoComplete="given-name"
            />
            {err("firstName")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Apellidos *</span>
            <input
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={cls("lastName")}
              aria-invalid={inv("lastName")}
              autoComplete="family-name"
            />
            {err("lastName")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Fecha de nacimiento</span>
            <input
              type="date"
              name="birthDate"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={cls("birthDate")}
            />
          </label>
          <label className="ps-field">
            <span className="ps-label">Sexo</span>
            <select
              name="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={cls("gender")}
            >
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      {/* ── Contacto ── */}
      <fieldset className="ps-sect" id="ps-sect-contacto">
        <legend>
          <span className="ps-sect__num">2</span>Contacto
        </legend>
        <p className="ps-sect__desc">
          Usaremos estos datos para comunicarnos contigo durante el proceso de
          admisión.
        </p>
        <div className="ps-grid">
          <label className="ps-field">
            <span className="ps-label">Correo electrónico *</span>
            <input
              type="email"
              name="email"
              className={cls("email")}
              aria-invalid={inv("email")}
              autoComplete="email"
              placeholder="nombre@correo.com"
            />
            {err("email")}
          </label>
          <label className="ps-field">
            <span className="ps-label">Celular / teléfono *</span>
            <input
              name="phone"
              className={cls("phone")}
              aria-invalid={inv("phone")}
              autoComplete="tel"
              inputMode="tel"
              placeholder="Ej. 987654321"
            />
            {err("phone")}
          </label>
          <label className="ps-field ps-field--wide">
            <span className="ps-label">Dirección</span>
            <input
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={cls("address")}
              autoComplete="street-address"
            />
          </label>
          <label className="ps-field">
            <span className="ps-label">Región</span>
            <input
              name="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className={cls("region")}
              placeholder="Madre de Dios"
            />
          </label>
          <label className="ps-field">
            <span className="ps-label">Provincia</span>
            <input
              name="province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className={cls("province")}
              placeholder="Tambopata"
            />
          </label>
          <label className="ps-field">
            <span className="ps-label">Distrito</span>
            <input
              name="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className={cls("district")}
              placeholder="Puerto Maldonado"
            />
          </label>
        </div>
      </fieldset>

      {/* ── Consentimiento ── */}
      <label className={`ps-consent${fe.consent ? " is-invalid" : ""}`}>
        <input type="checkbox" name="consent" value="yes" />
        <span>
          Autorizo a la Escuela de Posgrado de la UNAMAD a tratar mis datos
          personales y documentos con fines del proceso de admisión, conforme a
          la Ley N° 29733 de Protección de Datos Personales. *
        </span>
      </label>
      {err("consent")}

      <div className="ps-submit">
        <button type="submit" className="ps-btn ps-btn--primary ps-btn--lg" disabled={pending}>
          {pending && <span className="ps-spinner" aria-hidden />}
          {pending ? "Enviando postulación…" : "Enviar postulación"}
          {!pending && <Icon name="chevron-right" size={18} />}
        </button>
        <p className="ps-required-note">* Campos obligatorios</p>
      </div>
    </form>

    {/* ── Rail lateral: resumen del diplomado + progreso en vivo ── */}
    <aside className="ps-aside" aria-label="Resumen de tu postulación">
      <div className="ps-aside__card">
        <span className="ps-aside__eyebrow">Tu postulación</span>
        <h2 className="ps-aside__title">Diplomado en {diplomaTitle}</h2>
        <ul className="ps-aside__meta">
          <li>
            <Icon name="device" size={15} /> {modality}
          </li>
          <li>
            <Icon name="clock" size={15} /> {totalHours} horas · {credits}{" "}
            créditos
          </li>
          <li>
            <Icon name="folder" size={15} /> {modulesCount} módulos
          </li>
        </ul>

        <div className="ps-aside__progress">
          <div
            className="ps-aside__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={REQUIRED_SECTIONS.length}
            aria-valuenow={doneCount}
            aria-label="Secciones obligatorias completas"
          >
            <span
              style={{
                width: `${(doneCount / REQUIRED_SECTIONS.length) * 100}%`,
              }}
            />
          </div>
          <span className="ps-aside__count">
            {doneCount} de {REQUIRED_SECTIONS.length} secciones completas
          </span>
        </div>

        <ol className="ps-steps">
          {SECTIONS.map((s, i) => {
            const done = sectionDone[i];
            const optional = "optional" in s && s.optional;
            return (
              <li
                key={s.id}
                className={`ps-step${done ? " is-done" : ""}`}
              >
                <button type="button" onClick={() => jumpTo(s.id)}>
                  <span className="ps-step__dot" aria-hidden>
                    {done ? <Icon name="check" size={12} /> : i + 1}
                  </span>
                  <span className="ps-step__label">{s.title}</span>
                  {optional && !done && (
                    <span className="ps-step__tag">Opcional</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="ps-aside__help">
        Al enviar tu postulación recibirás un <b>código de seguimiento</b>.
        Guárdalo: te servirá para consultar el estado de tu expediente.
      </p>
    </aside>
    </div>
    {pendingDni && <DniModal data={pendingDni} onClose={dismissDni} />}
    {showErrorModal && state.status === "error" && (
      <ErrorModal
        message={state.message}
        onClose={() => setShowErrorModal(false)}
      />
    )}
    </>
  );
}

/** Modal informativo: avisa que los datos se autocompletaron desde el DNI. */
function DniModal({
  data,
  onClose,
}: {
  data: {
    dni: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    gender: string;
    address: string;
    region: string;
    province: string;
    district: string;
  };
  onClose: () => void;
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const genderLabel = GENDERS.find((g) => g.value === data.gender)?.label ?? "—";
  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}/${m}/${y}` : iso;
  };

  const rows: { label: string; value: string }[] = [
    { label: "Nombres", value: data.firstName },
    { label: "Apellidos", value: data.lastName },
    {
      label: "Fecha de nacimiento",
      value: data.birthDate ? fmtDate(data.birthDate) : "—",
    },
    { label: "Sexo", value: genderLabel },
    { label: "Dirección", value: data.address },
    { label: "Región", value: data.region },
    { label: "Provincia", value: data.province },
    { label: "Distrito", value: data.district },
  ];

  return (
    <div
      className="ps-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ps-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ps-dni-modal-title"
      >
        <div className="ps-modal__head">
          <span className="ps-modal__icon">
            <Icon name="check" size={24} />
          </span>
          <div className="ps-modal__heading">
            <h3 id="ps-dni-modal-title" className="ps-modal__title">
              ¡Datos autocompletados!
            </h3>
            <p className="ps-modal__sub">DNI {data.dni}</p>
          </div>
          <button
            type="button"
            className="ps-modal__x"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className="ps-modal__msg">
          Completamos tus datos personales a partir de tu DNI. Por favor,
          <b> revísalos</b> y corrige lo que haga falta antes de enviar tu
          postulación.
        </p>

        <dl className="ps-modal__list">
          {rows.map((r) => (
            <div key={r.label} className="ps-modal__row">
              <dt>{r.label}</dt>
              <dd>{r.value || "—"}</dd>
            </div>
          ))}
        </dl>

        <div className="ps-modal__actions">
          <button
            type="button"
            ref={okRef}
            className="ps-btn ps-btn--primary"
            onClick={onClose}
          >
            <Icon name="check" size={16} />
            Entendido, revisar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal de error de envío (postulación duplicada, servicio no disponible, etc.). */
function ErrorModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="ps-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ps-modal__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ps-error-modal-title"
      >
        <div className="ps-modal__head">
          <span className="ps-modal__icon ps-modal__icon--error">
            <Icon name="alert" size={24} />
          </span>
          <div className="ps-modal__heading">
            <h3 id="ps-error-modal-title" className="ps-modal__title">
              No se pudo enviar
            </h3>
            <p className="ps-modal__sub">
              Revisa la información e inténtalo de nuevo
            </p>
          </div>
          <button
            type="button"
            className="ps-modal__x"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className="ps-modal__msg ps-modal__msg--pad">{message}</p>

        <div className="ps-modal__actions">
          <button
            type="button"
            ref={okRef}
            className="ps-btn ps-btn--primary"
            onClick={onClose}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
