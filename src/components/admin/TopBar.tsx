"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import type { AdminNotification } from "./data";
import { initialsFor } from "@/lib/ui/avatar";

type Props = {
  onMenuClick: () => void;
  user: { name: string; email: string; roles: string[] };
  notifications: AdminNotification[];
};

type SearchItem = {
  id: string;
  title: string;
  sub: string;
  href: string;
  icon: string;
};
type SearchGroup = { key: string; label: string; items: SearchItem[] };

export function TopBar({ onMenuClick, user, notifications }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQuery = params.get("q") ?? "";
  const [search, setSearch] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Keep input synced when navigation drops ?q=
  useEffect(() => {
    setSearch(params.get("q") ?? "");
  }, [params]);

  // Debounced global search across modules the user can read. All state
  // updates happen inside the timeout callback (never synchronously in the
  // effect body) to avoid cascading renders.
  useEffect(() => {
    const q = search.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { groups?: SearchGroup[] };
        setResults(data.groups ?? []);
      } catch {
        /* aborted or failed */
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target))
        setFocused(false);
      if (notifRef.current && !notifRef.current.contains(target))
        setNotifOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(target))
        setAvatarOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const updateQuery = (value: string) => {
    setSearch(value);
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const onSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    updateQuery(e.target.value);
  };

  const goTo = (href: string) => {
    setFocused(false);
    router.push(href);
  };

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.replace("/login");
    router.refresh();
  };

  const showResults =
    focused && search.trim().length >= 2 && (results.length > 0 || !searching);

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="iconbtn" onClick={onMenuClick} aria-label="Menú">
          <Icon name="menu" size={22} />
        </button>
        <div className="topbar__brand">
          <Icon name="logo" size={28} />
          <span className="topbar__brand-text">Admin</span>
        </div>
      </div>

      <div className="topbar__search-wrap" ref={searchRef}>
        <div className={`topbar__search ${focused ? "is-focused" : ""}`}>
          <Icon name="search" size={20} className="topbar__search-icon" />
          <input
            type="text"
            placeholder="Buscar usuarios, roles o incidentes"
            value={search}
            onChange={onSearchChange}
            onFocus={() => setFocused(true)}
          />
          {search && (
            <button
              className="topbar__search-clear"
              onClick={() => updateQuery("")}
              aria-label="Borrar búsqueda"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {showResults && (
          <div className="popover popover--search">
            {results.length === 0 ? (
              <div className="search-empty">
                {searching ? "Buscando…" : "Sin resultados"}
              </div>
            ) : (
              results.map((g) => (
                <div key={g.key} className="search-group">
                  <div className="search-group__label">{g.label}</div>
                  {g.items.map((it) => (
                    <button
                      key={it.id}
                      className="search-item"
                      onClick={() => goTo(it.href)}
                    >
                      <span className="search-item__icon">
                        <Icon name={it.icon as IconName} size={18} />
                      </span>
                      <span className="search-item__text">
                        <span className="search-item__title">{it.title}</span>
                        <span className="search-item__sub">{it.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="topbar__right">
        <ThemeToggle />

        <div className="topbar__action-wrap" ref={notifRef}>
          <button
            className="iconbtn"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notificaciones"
          >
            <Icon name="bell" size={20} />
            {notifications.length > 0 && (
              <span className="iconbtn__badge">{notifications.length}</span>
            )}
          </button>
          {notifOpen && (
            <div className="popover popover--notif">
              <div className="popover__head">
                <b>Notificaciones</b>
              </div>
              {notifications.length === 0 ? (
                <div className="search-empty">Todo al día. Sin novedades.</div>
              ) : (
                <ul className="notif-list">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className="notif-item"
                      onClick={() => {
                        setNotifOpen(false);
                        router.push(n.href);
                      }}
                    >
                      <span className="notif-item__icon">
                        <Icon name={n.icon} size={18} />
                      </span>
                      <div>
                        <div className="notif-item__t">{n.title}</div>
                        <div className="notif-item__s">{n.sub}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="topbar__action-wrap" ref={avatarRef}>
          <button
            className="avatar"
            onClick={() => setAvatarOpen((v) => !v)}
            aria-label="Cuenta"
          >
            {initialsFor(user.name)}
          </button>
          {avatarOpen && (
            <div className="popover popover--avatar">
              <div className="account">
                <div className="account__row">
                  <div className="account__avatar">{initialsFor(user.name)}</div>
                  <div>
                    <div className="account__name">{user.name}</div>
                    <div className="account__email">{user.email}</div>
                  </div>
                </div>
                {user.roles.length > 0 && (
                  <div className="account__roles">
                    {user.roles.map((r) => (
                      <span key={r} className="chip chip--static">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="account__divider" />
              <div className="account__actions">
                <button
                  className="account__action"
                  onClick={() => {
                    setAvatarOpen(false);
                    router.push("/cuenta");
                  }}
                >
                  <Icon name="user" size={18} />
                  <span>Mi cuenta</span>
                </button>
                <button
                  className="account__action"
                  onClick={onLogout}
                  disabled={loggingOut}
                >
                  <Icon name="lock" size={18} />
                  <span>{loggingOut ? "Cerrando…" : "Cerrar sesión"}</span>
                </button>
              </div>
              <div className="account__foot">
                Política de Privacidad · Términos del Servicio
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
