"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/Icon";
import { avatarColor, initialsFor } from "@/lib/ui/avatar";
import { formatFullDate, formatRelative } from "@/lib/ui/dates";
import {
  changeOwnPassword,
  revokeOtherSessions,
  revokeOwnSession,
} from "./actions";
import type { AccountData, AccountSession } from "./types";
import "./cuenta.css";

function deviceLabel(s: AccountSession): string {
  if (s.clientType === "mobile") return "Aplicación móvil";
  const ua = s.userAgent ?? "";
  let browser = "Navegador";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  let os = "";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os|macintosh/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";
  return os ? `${browser} · ${os}` : browser;
}

export function AccountView({ data }: { data: AccountData }) {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const others = data.sessions.filter((s) => !s.current).length;

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwBusy) return;
    setPwError(null);
    setPwOk(null);
    setFieldErrors({});

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Las contraseñas no coinciden." });
      setPwError("Las contraseñas no coinciden.");
      return;
    }

    setPwBusy(true);
    try {
      const res = await changeOwnPassword({ currentPassword, newPassword });
      if (res.ok) {
        const n = res.data?.sessionsRevoked ?? 0;
        setPwOk(
          n > 0
            ? `Contraseña actualizada. Se cerraron ${n} ${n === 1 ? "sesión" : "sesiones"}.`
            : "Contraseña actualizada correctamente.",
        );
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        router.refresh();
      } else {
        setPwError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      }
    } finally {
      setPwBusy(false);
    }
  }

  async function onRevoke(id: string) {
    if (busyId) return;
    setBusyId(id);
    setSessionError(null);
    try {
      const res = await revokeOwnSession(id);
      if (!res.ok) setSessionError(res.error);
      else router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onRevokeAll() {
    if (bulkBusy || others === 0) return;
    setBulkBusy(true);
    setSessionError(null);
    try {
      const res = await revokeOtherSessions();
      if (!res.ok) setSessionError(res.error);
      else router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="page acct">
      <div className="page__head">
        <div className="page__title">
          <h1>Mi cuenta</h1>
        </div>
      </div>

      {/* Identity header */}
      <section className="panel acct__id">
        <span
          className="acct__avatar"
          style={{ background: avatarColor(data.email) }}
        >
          {initialsFor(data.name)}
        </span>
        <div className="acct__id-info">
          <div className="acct__name">{data.name}</div>
          <div className="acct__email">
            <Icon name="mail" size={15} />
            {data.email}
          </div>
          {data.roles.length > 0 && (
            <div className="acct__roles">
              {data.roles.map((r) => (
                <span key={r} className="chip chip--static">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="acct__grid">
        {/* Profile details */}
        <section className="panel">
          <div className="panel__hd">
            <h2>Información</h2>
          </div>
          <div className="acct__rows">
            <div className="drow">
              <span className="drow__icon">
                <Icon name="calendar" size={18} />
              </span>
              <span className="drow__l">Miembro desde</span>
              <span className="drow__v">{formatFullDate(data.createdAt)}</span>
            </div>
            <div className="drow">
              <span className="drow__icon">
                <Icon name="clock" size={18} />
              </span>
              <span className="drow__l">Último acceso</span>
              <span className="drow__v">
                {data.lastLoginAt ? formatRelative(data.lastLoginAt) : "Nunca"}
              </span>
            </div>
            <div className="drow">
              <span className="drow__icon">
                <Icon name="shield" size={18} />
              </span>
              <span className="drow__l">Roles</span>
              <span className="drow__v">{data.roles.length}</span>
            </div>
          </div>
        </section>

        {/* Password change */}
        <section className="panel">
          <div className="panel__hd">
            <h2>Cambiar contraseña</h2>
          </div>
          <form onSubmit={onSubmitPassword} className="acct__form">
            <div className="field">
              <label className="field__label" htmlFor="cur">
                Contraseña actual<span className="field__req">*</span>
              </label>
              <input
                id="cur"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                disabled={pwBusy}
              />
              {fieldErrors.currentPassword && (
                <span className="field__error">{fieldErrors.currentPassword}</span>
              )}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="new">
                Nueva contraseña<span className="field__req">*</span>
              </label>
              <input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={pwBusy}
              />
              {fieldErrors.newPassword && (
                <span className="field__error">{fieldErrors.newPassword}</span>
              )}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="conf">
                Confirmar nueva contraseña<span className="field__req">*</span>
              </label>
              <input
                id="conf"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={pwBusy}
              />
              {fieldErrors.confirmPassword && (
                <span className="field__error">{fieldErrors.confirmPassword}</span>
              )}
            </div>

            {pwError && (
              <div className="acct__alert acct__alert--error" role="alert">
                <Icon name="info" size={16} />
                <span>{pwError}</span>
              </div>
            )}
            {pwOk && (
              <div className="acct__alert acct__alert--ok" role="status">
                <Icon name="check" size={16} />
                <span>{pwOk}</span>
              </div>
            )}

            <p className="acct__hint">
              Al cambiar tu contraseña se cerrarán todas tus otras sesiones.
            </p>

            <button
              type="submit"
              className="btn btn--primary"
              disabled={
                pwBusy || !currentPassword || !newPassword || !confirmPassword
              }
            >
              {pwBusy ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </form>
        </section>
      </div>

      {/* Active sessions */}
      <section className="panel">
        <div className="panel__hd">
          <h2>Sesiones activas</h2>
          {others > 0 && (
            <button
              className="linkbtn linkbtn--danger"
              onClick={onRevokeAll}
              disabled={bulkBusy}
            >
              {bulkBusy ? "Cerrando…" : "Cerrar las demás"}
            </button>
          )}
        </div>

        {sessionError && (
          <div className="acct__alert acct__alert--error" role="alert">
            <Icon name="info" size={16} />
            <span>{sessionError}</span>
          </div>
        )}

        <ul className="sess-list">
          {data.sessions.map((s) => (
            <li key={s.id} className="sess">
              <span className="sess__icon">
                <Icon name={s.clientType === "mobile" ? "device" : "external"} size={18} />
              </span>
              <div className="sess__info">
                <div className="sess__title">
                  {deviceLabel(s)}
                  {s.current && <span className="sess__badge">Esta sesión</span>}
                </div>
                <div className="sess__sub">
                  {s.ip ? `${s.ip} · ` : ""}Iniciada {formatRelative(s.createdAt)}
                </div>
              </div>
              {!s.current && (
                <button
                  className="btn btn--ghost"
                  onClick={() => onRevoke(s.id)}
                  disabled={busyId === s.id}
                >
                  {busyId === s.id ? "Cerrando…" : "Cerrar"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
