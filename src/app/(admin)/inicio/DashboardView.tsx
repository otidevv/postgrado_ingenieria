import Link from "next/link";
import { Icon, type IconName } from "@/components/admin/Icon";
import { formatRelative } from "@/lib/ui/dates";
import "./dashboard.css";
import type { DashboardData } from "./types";

function Kpi({
  icon,
  tone,
  value,
  label,
  sub,
}: {
  icon: IconName;
  tone: string;
  value: number | string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="kpi">
      <span className={`kpi__icon kpi__icon--${tone}`}>
        <Icon name={icon} size={22} />
      </span>
      <div className="kpi__body">
        <div className="kpi__val">{value}</div>
        <div className="kpi__label">{label}</div>
        {sub && <div className="kpi__sub">{sub}</div>}
      </div>
    </div>
  );
}

export function DashboardView({
  data,
  nowMs,
}: {
  data: DashboardData;
  nowMs: number;
}) {
  const { users, roles, incidents, activity, quickActions } = data;
  const now = nowMs;

  const maxRole = Math.max(1, ...(roles?.distribution.map((r) => r.count) ?? [1]));
  const maxSeverity = Math.max(
    1,
    ...(incidents?.bySeverity.map((s) => s.count) ?? [1]),
  );
  const statusTotal = incidents?.byStatus.reduce((a, s) => a + s.count, 0) ?? 0;

  return (
    <div className="page dash">
      <header className="dash__greet">
        <h1>
          {data.greeting}, {data.firstName}
        </h1>
        <p className="dash__date">{data.dateLabel}</p>
      </header>

      {/* KPIs */}
      <section className="kpi-grid">
        {users && (
          <Kpi
            icon="users"
            tone="blue"
            value={users.total}
            label="Usuarios"
            sub={`${users.active} activos · ${users.suspended} suspendidos`}
          />
        )}
        {roles && (
          <Kpi
            icon="shield"
            tone="violet"
            value={roles.total}
            label="Roles"
            sub="Configurados en el sistema"
          />
        )}
        {incidents && (
          <Kpi
            icon="alert"
            tone="amber"
            value={incidents.open}
            label="Incidentes abiertos"
            sub={`${incidents.total} en total`}
          />
        )}
        {incidents && (
          <Kpi
            icon="check"
            tone="green"
            value={incidents.resolved}
            label="Incidentes resueltos"
            sub={`${incidents.critical} críticos`}
          />
        )}
      </section>

      <div className="dash__cols">
        <div className="dash__main">
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
                <>
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

                  <h3 className="panel__subhd">Por severidad</h3>
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
                </>
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
                    <Icon name="chevron-right" size={18} className="qa__chev" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Activity feed */}
          <section className="panel">
            <div className="panel__hd">
              <h2>Actividad reciente</h2>
            </div>
            {activity.length === 0 ? (
              <div className="panel__empty">
                <p>Sin actividad reciente.</p>
              </div>
            ) : (
              <ul className="feed">
                {activity.map((a) => (
                  <li key={a.id} className="feed__item">
                    <span className={`feed__icon feed__icon--${a.tone}`}>
                      <Icon name={a.icon} size={16} />
                    </span>
                    <span className="feed__text">
                      <span className="feed__title">{a.title}</span>
                      <span className="feed__sub">{a.sub}</span>
                    </span>
                    <time className="feed__time">{formatRelative(a.at, now)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
