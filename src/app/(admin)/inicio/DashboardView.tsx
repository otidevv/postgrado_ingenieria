import Link from "next/link";
import { Icon, type IconName } from "@/components/admin/Icon";
import { formatRelative } from "@/lib/ui/dates";
import "./dashboard.css";
import type { DashboardData, DiplomaRow } from "./types";

const TZ = "America/Lima";

const nf = new Intl.NumberFormat("es-PE");

function Kpi({
  icon,
  tone,
  value,
  label,
  sub,
  href,
  trend,
}: {
  icon: IconName;
  tone: string;
  value: number | string;
  label: string;
  sub?: string;
  href?: string;
  /** Variación semanal: positivo = sube, negativo = baja */
  trend?: { delta: number; label: string };
}) {
  const body = (
    <>
      <span className={`kpi__icon kpi__icon--${tone}`}>
        <Icon name={icon} size={22} />
      </span>
      <div className="kpi__body">
        <div className="kpi__val">
          {typeof value === "number" ? nf.format(value) : value}
        </div>
        <div className="kpi__label">{label}</div>
        {trend && trend.delta !== 0 ? (
          <div
            className={`kpi__trend ${
              trend.delta > 0 ? "kpi__trend--up" : "kpi__trend--down"
            }`}
          >
            <Icon name={trend.delta > 0 ? "sort-asc" : "sort-desc"} size={13} />
            {trend.delta > 0 ? "+" : ""}
            {trend.delta} {trend.label}
          </div>
        ) : trend ? (
          <div className="kpi__sub">Sin cambio {trend.label}</div>
        ) : (
          sub && <div className="kpi__sub">{sub}</div>
        )}
      </div>
      {href && <Icon name="chevron-right" size={18} className="kpi__chev" />}
    </>
  );
  return href ? (
    <Link className="kpi kpi--link" href={href}>
      {body}
    </Link>
  ) : (
    <div className="kpi">{body}</div>
  );
}

/* Mini gráfico de barras (14 días). Solo CSS, sin librerías. */
function Sparkbars({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, d) => a + d.count, 0);
  const fmt = new Intl.DateTimeFormat("es-PE", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
  });
  return (
    <div className="spark" role="img" aria-label={`${total} postulaciones en 14 días`}>
      {data.map((d, i) => {
        const label = fmt.format(new Date(`${d.day}T12:00:00Z`));
        const isToday = i === data.length - 1;
        return (
          <span
            key={d.day}
            className={`spark__col ${isToday ? "is-today" : ""} ${
              d.count === 0 ? "is-zero" : ""
            }`}
            title={`${label}: ${d.count}`}
          >
            <span
              className="spark__bar"
              style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }}
            />
          </span>
        );
      })}
    </div>
  );
}

const DIPLOMA_STATUS: Record<
  DiplomaRow["status"],
  { label: string; token: string }
> = {
  published: { label: "Publicado", token: "resolved" },
  draft: { label: "Borrador", token: "closed" },
  closed: { label: "Cerrado", token: "rejected" },
};

export function DashboardView({
  data,
  nowMs,
}: {
  data: DashboardData;
  nowMs: number;
}) {
  const {
    users,
    roles,
    incidents,
    applications,
    enrollments,
    diplomas,
    sessions,
    activity,
    quickActions,
  } = data;
  const now = nowMs;

  const maxRole = Math.max(1, ...(roles?.distribution.map((r) => r.count) ?? [1]));
  const maxSeverity = Math.max(
    1,
    ...(incidents?.bySeverity.map((s) => s.count) ?? [1]),
  );
  const statusTotal = incidents?.byStatus.reduce((a, s) => a + s.count, 0) ?? 0;
  const appTotal = applications?.byStatus.reduce((a, s) => a + s.count, 0) ?? 0;

  const sessionDay = new Intl.DateTimeFormat("es-PE", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
  });
  const sessionTime = new Intl.DateTimeFormat("es-PE", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));

  const hasAcademic = Boolean(applications || enrollments || diplomas);

  return (
    <div className="page dash">
      <header className="dash__greet">
        <div>
          <h1>
            {data.greeting}, {data.firstName}
          </h1>
          <p className="dash__date">{data.dateLabel}</p>
        </div>
        <p className="dash__summary">{data.summary}</p>
      </header>

      {/* KPIs */}
      <section className="kpi-grid" aria-label="Indicadores">
        {applications && (
          <Kpi
            icon="inbox"
            tone="blue"
            value={applications.pending}
            label="Postulaciones pendientes"
            href="/postulaciones"
            trend={{
              delta: applications.last7 - applications.prev7,
              label: "vs. semana anterior",
            }}
          />
        )}
        {enrollments && (
          <Kpi
            icon="award"
            tone="green"
            value={enrollments.active}
            label="Matriculados activos"
            sub={`${nf.format(enrollments.last30)} en los últimos 30 días`}
            href="/matriculas"
          />
        )}
        {diplomas && (
          <Kpi
            icon="cloud"
            tone="violet"
            value={diplomas.published}
            label="Diplomados publicados"
            sub={`${diplomas.draft} en borrador · ${diplomas.closed} cerrados`}
            href="/diplomados"
          />
        )}
        {incidents && (
          <Kpi
            icon="alert"
            tone="amber"
            value={incidents.open}
            label="Incidentes abiertos"
            sub={
              incidents.critical > 0
                ? `${incidents.critical} críticos · ${incidents.total} en total`
                : `${incidents.total} en total`
            }
            href="/incidentes"
          />
        )}
        {users && !hasAcademic && (
          <Kpi
            icon="users"
            tone="blue"
            value={users.total}
            label="Usuarios"
            sub={`${users.active} activos · ${users.suspended} suspendidos`}
            href="/usuarios"
          />
        )}
        {roles && !hasAcademic && (
          <Kpi
            icon="shield"
            tone="violet"
            value={roles.total}
            label="Roles"
            sub="Configurados en el sistema"
            href="/roles"
          />
        )}
      </section>

      <div className="dash__cols">
        <div className="dash__main">
          {/* Diplomados: avance de matrícula */}
          {diplomas && (
            <section className="panel">
              <div className="panel__hd">
                <h2>Diplomados</h2>
                <Link className="linkbtn" href="/diplomados">
                  Administrar
                  <Icon name="chevron-right" size={16} />
                </Link>
              </div>
              {diplomas.rows.length === 0 ? (
                <div className="panel__empty">
                  <span className="panel__empty-icon">
                    <Icon name="cloud" size={24} />
                  </span>
                  <p>Aún no hay diplomados creados.</p>
                </div>
              ) : (
                <div className="tbl-wrap">
                  <table className="dtbl">
                    <thead>
                      <tr>
                        <th>Programa</th>
                        <th className="dtbl__num">Pend.</th>
                        <th className="dtbl__prog">Matrícula</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diplomas.rows.map((d) => {
                        const pct = Math.min(
                          100,
                          Math.round((d.enrolled / Math.max(1, d.minEnrollment)) * 100),
                        );
                        const reached = d.enrolled >= d.minEnrollment;
                        const st = DIPLOMA_STATUS[d.status];
                        return (
                          <tr key={d.id}>
                            <td>
                              <Link
                                className="dtbl__title"
                                href={`/diplomados/${d.id}`}
                              >
                                {d.title}
                              </Link>
                              <span className="dtbl__meta">
                                {d.code} · {d.moduleCount} módulos
                                {d.admissionLabel ? ` · ${d.admissionLabel}` : ""}
                              </span>
                            </td>
                            <td className="dtbl__num">
                              {d.pendingApplications > 0 ? (
                                <Link
                                  className="pill pill--open"
                                  href="/postulaciones"
                                  title={`${d.totalApplications} postulaciones en total`}
                                >
                                  {d.pendingApplications}
                                </Link>
                              ) : (
                                <span className="dtbl__zero">—</span>
                              )}
                            </td>
                            <td className="dtbl__prog">
                              <div className="prog">
                                <span className="prog__track">
                                  <span
                                    className={`prog__fill ${reached ? "is-ok" : ""}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                  <span
                                    className="prog__min"
                                    title={`Mínimo ${d.minEnrollment}`}
                                  />
                                </span>
                                <span className="prog__label">
                                  <b>{d.enrolled}</b>
                                  <span className="prog__of">/{d.minEnrollment}</span>
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={`pill pill--${st.token}`}>{st.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {diplomas.rows.length > 0 && (
                <p className="panel__foot">
                  La barra muestra matriculados activos frente al mínimo para
                  abrir el programa.
                </p>
              )}
            </section>
          )}

          {/* Postulaciones: tendencia + estados */}
          {applications && (
            <section className="panel">
              <div className="panel__hd">
                <h2>Postulaciones</h2>
                <Link className="linkbtn" href="/postulaciones">
                  Ver bandeja
                  <Icon name="chevron-right" size={16} />
                </Link>
              </div>
              {applications.total === 0 ? (
                <div className="panel__empty">
                  <span className="panel__empty-icon">
                    <Icon name="inbox" size={24} />
                  </span>
                  <p>Todavía no se han recibido postulaciones.</p>
                </div>
              ) : (
                <div className="split">
                  <div className="split__trend">
                    <div className="split__trend-hd">
                      <span className="panel__subhd">Últimos 14 días</span>
                      <span className="split__trend-n">
                        <b>{nf.format(applications.last7)}</b> esta semana{" "}
                        <span className="split__trend-prev">
                          · {nf.format(applications.prev7)} la anterior
                        </span>
                      </span>
                    </div>
                    <Sparkbars data={applications.daily} />
                  </div>
                  <div className="split__status">
                    <span className="panel__subhd">Por estado</span>
                    <div className="statbar" role="img" aria-label="Distribución por estado">
                      {applications.byStatus
                        .filter((s) => s.count > 0)
                        .map((s) => (
                          <span
                            key={s.key}
                            className="statbar__seg"
                            style={{
                              width: `${(s.count / appTotal) * 100}%`,
                              background: `var(--st-${s.token}-fg)`,
                            }}
                            title={`${s.label}: ${s.count}`}
                          />
                        ))}
                    </div>
                    <ul className="statlegend">
                      {applications.byStatus.map((s) => (
                        <li key={s.key}>
                          <span
                            className="dot"
                            style={{ background: `var(--st-${s.token}-fg)` }}
                          />
                          <span className="statlegend__label">{s.label}</span>
                          <span className="statlegend__count">{nf.format(s.count)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Incidents breakdown */}
          {incidents && (
            <section className="panel">
              <div className="panel__hd">
                <h2>Incidentes</h2>
                <Link className="linkbtn" href="/incidentes">
                  Ver bandeja
                  <Icon name="chevron-right" size={16} />
                </Link>
              </div>

              {incidents.total === 0 ? (
                <div className="panel__empty">
                  <span className="panel__empty-icon">
                    <Icon name="inbox" size={24} />
                  </span>
                  <p>Aún no hay incidentes registrados.</p>
                </div>
              ) : (
                <div className="split">
                  <div>
                    <span className="panel__subhd">Por estado</span>
                    <div className="statbar" role="img" aria-label="Distribución por estado">
                      {incidents.byStatus
                        .filter((s) => s.count > 0)
                        .map((s) => (
                          <span
                            key={s.key}
                            className="statbar__seg"
                            style={{
                              width: `${(s.count / statusTotal) * 100}%`,
                              background: `var(--st-${s.token}-fg)`,
                            }}
                            title={`${s.label}: ${s.count}`}
                          />
                        ))}
                    </div>
                    <ul className="statlegend">
                      {incidents.byStatus.map((s) => (
                        <li key={s.key}>
                          <span
                            className="dot"
                            style={{ background: `var(--st-${s.token}-fg)` }}
                          />
                          <span className="statlegend__label">{s.label}</span>
                          <span className="statlegend__count">{s.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="panel__subhd">Por severidad</span>
                    <div className="sevbars">
                      {incidents.bySeverity.map((s) => (
                        <div className="sevrow" key={s.key}>
                          <span className="sevrow__label">{s.label}</span>
                          <span className="sevtrack">
                            <span
                              className="sevtrack__fill"
                              style={{
                                width: `${(s.count / maxSeverity) * 100}%`,
                                background: s.color,
                              }}
                            />
                          </span>
                          <span className="sevrow__count">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Roles distribution */}
          {roles && roles.distribution.length > 0 && (
            <section className="panel">
              <div className="panel__hd">
                <h2>Usuarios por rol</h2>
                <Link className="linkbtn" href="/roles">
                  Gestionar
                  <Icon name="chevron-right" size={16} />
                </Link>
              </div>
              <div className="sevbars">
                {roles.distribution.map((r) => (
                  <div className="sevrow" key={r.name}>
                    <span className="sevrow__label" title={r.name}>
                      {r.name}
                    </span>
                    <span className="sevtrack">
                      <span
                        className="sevtrack__fill"
                        style={{
                          width: `${(r.count / maxRole) * 100}%`,
                          background: r.system
                            ? "var(--accent)"
                            : "var(--sev-low)",
                        }}
                      />
                    </span>
                    <span className="sevrow__count">{r.count}</span>
                  </div>
                ))}
              </div>
              {users && (
                <p className="panel__foot">
                  {nf.format(users.total)} usuarios · {users.active} activos ·{" "}
                  {users.suspended} suspendidos
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="dash__side">
          {/* Quick actions */}
          {quickActions.length > 0 && (
            <section className="panel">
              <div className="panel__hd">
                <h2>Accesos rápidos</h2>
              </div>
              <div className="qa-list">
                {quickActions.map((qa) => (
                  <Link key={qa.href + qa.label} className="qa" href={qa.href}>
                    <span className="qa__icon">
                      <Icon name={qa.icon} size={20} />
                    </span>
                    <span className="qa__text">
                      <span className="qa__label">{qa.label}</span>
                      <span className="qa__desc">{qa.desc}</span>
                    </span>
                    {qa.badge ? (
                      <span className="qa__badge">{nf.format(qa.badge)}</span>
                    ) : (
                      <Icon name="chevron-right" size={18} className="qa__chev" />
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Próximas sesiones */}
          {(diplomas || sessions.length > 0) && (
            <section className="panel">
              <div className="panel__hd">
                <h2>Próximas clases</h2>
                <span className="panel__hint">7 días</span>
              </div>
              {sessions.length === 0 ? (
                <div className="panel__empty panel__empty--compact">
                  <p>No hay sesiones programadas esta semana.</p>
                </div>
              ) : (
                <ul className="agenda">
                  {sessions.map((s) => {
                    const isToday = dayKey(s.at) === todayKey;
                    const d = new Date(s.at);
                    const [wd, dd] = sessionDay.format(d).replace(",", "").split(" ");
                    return (
                      <li key={s.id} className={`agenda__item ${isToday ? "is-today" : ""}`}>
                        <span className="agenda__date">
                          <span className="agenda__wd">{wd}</span>
                          <span className="agenda__dd">{dd}</span>
                        </span>
                        <span className="agenda__text">
                          <span className="agenda__topic">{s.topic}</span>
                          <span className="agenda__sub">
                            {s.diplomaCode} · {s.moduleName}
                            {s.teacher ? ` · ${s.teacher}` : ""}
                          </span>
                        </span>
                        <time className="agenda__time" dateTime={s.at}>
                          {sessionTime.format(d)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* Activity feed */}
          <section className="panel">
            <div className="panel__hd">
              <h2>Actividad reciente</h2>
            </div>
            {activity.length === 0 ? (
              <div className="panel__empty panel__empty--compact">
                <p>Sin actividad reciente.</p>
              </div>
            ) : (
              <ul className="feed">
                {activity.map((a) => {
                  const inner = (
                    <>
                      <span className={`feed__icon feed__icon--${a.tone}`}>
                        <Icon name={a.icon} size={16} />
                      </span>
                      <span className="feed__text">
                        <span className="feed__title">{a.title}</span>
                        <span className="feed__sub">{a.sub}</span>
                      </span>
                      <time className="feed__time" dateTime={a.at}>
                        {formatRelative(a.at, now)}
                      </time>
                    </>
                  );
                  return (
                    <li key={a.id} className="feed__item">
                      {a.href ? (
                        <Link className="feed__link" href={a.href}>
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
