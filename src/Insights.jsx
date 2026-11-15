import { useMemo, useState } from "react";
import { buildInsights } from "./insights.js";
import { formatDayLong } from "./dates.js";
import { COLOR_LABELS } from "./model.js";

const shortDate = (iso) => {
  const d = formatDayLong(iso);
  return `${d.day} ${d.monthShort.toLowerCase()}`;
};
const dateRange = (start, end) =>
  `${shortDate(start)}${start.slice(0, 4) !== end.slice(0, 4) ? ` ${start.slice(0, 4)}` : ""} — ${shortDate(end)} ${end.slice(0, 4)}`;
const deltaText = (value) =>
  value === 0
    ? "Sin cambio frente al período anterior"
    : `${Math.abs(value)} ${value > 0 ? "más" : "menos"} que en el período anterior`;
const number = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });
export default function Insights({ tasks, today, navigate }) {
  const [days, setDays] = useState(30);
  const stats = useMemo(
    () => buildInsights(tasks, today, days),
    [tasks, today, days],
  );
  const maxActivity = Math.max(
    1,
    ...stats.activity.flatMap((b) => [b.registered, b.closed]),
  );
  const maxWeek = Math.max(1, ...stats.week.map((d) => d.count));
  const suggestions = [
    stats.oldInbox > 0 && {
      count: stats.oldInbox,
      title: "Pensamientos que llevan una semana esperando",
      text: "Han pasado al menos siete días desde que los apuntaste. Un siguiente paso pequeño puede bastar.",
      target: "inbox",
      action: "Aclarar la bandeja",
    },
    stats.overdue > 0 && {
      count: stats.overdue,
      title: "Acciones de días anteriores",
      text: "Revisa si siguen teniendo sentido antes de volver a ponerles fecha.",
      target: "review",
      action: "Revisar pendientes",
    },
    stats.stalled > 0 && {
      count: stats.stalled,
      title: "Asuntos reprogramados tres veces o más",
      text: "Prueba a dividir el siguiente paso, pedir ayuda o decidir dejarlos ir.",
      target: "review",
      action: "Ver asuntos estancados",
      filter: "stalled",
    },
    stats.followups > 0 && {
      count: stats.followups,
      title: "Seguimientos que ya puedes revisar",
      text: "Su fecha de revisión ha llegado. Comprueba si hay respuesta o si necesitas hacer una pregunta.",
      target: "review",
      action: "Revisar seguimientos",
    },
    stats.undated > 0 && {
      count: stats.undated,
      title: "Acciones todavía sin fecha",
      text: "Pueden seguir esperando aquí. Elige solo las que quieras abordar próximamente.",
      target: "review",
      action: "Decidir el próximo paso",
    },
  ].filter(Boolean);
  return (
    <section className="insights-page" aria-label="Insights de tu libreta">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Insights</p>
          <h1>Un poco de perspectiva.</h1>
          <p>Observa tu ritmo y encuentra qué necesita una decisión.</p>
        </div>
        <label className="insights-range">
          Período
          <select
            aria-label="Período"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
        </label>
      </div>
      <p className="insights-period">
        {dateRange(stats.start, today)} · Comparado con{" "}
        {dateRange(stats.previousStart, stats.previousEnd)}. Incluye hoy.
      </p>
      {!tasks.length && (
        <div className="insights-welcome">
          <span className="small-ring" />
          <div>
            <h2>Tu perspectiva empieza con una primera nota.</h2>
            <p>
              Los insights se irán completando al registrar y cerrar asuntos. No
              necesitas activar nada.
            </p>
            <button onClick={() => navigate("inbox")}>
              Escribir mi primera nota →
            </button>
          </div>
        </div>
      )}
      <div className="insight-metrics">
        <Metric
          label="Asuntos registrados"
          value={stats.current.registered}
          detail={deltaText(stats.registrationDelta)}
        />
        <Metric
          label="Circuitos cerrados"
          value={stats.current.closed}
          detail={deltaText(stats.closureDelta)}
        />
        <Metric
          label="Asuntos abiertos ahora"
          value={stats.open}
          detail={`${stats.inbox} en bandeja · ${stats.waiting} en espera`}
        />
        <Metric
          label="Tiempo típico hasta cerrar"
          value={
            stats.current.medianDays === null
              ? "—"
              : `${number.format(stats.current.medianDays)} d`
          }
          detail={
            stats.current.durationSamples
              ? `Mediana de ${stats.current.durationSamples} cierres con fechas conocidas`
              : "Aparecerá cuando haya fechas suficientes"
          }
        />
      </div>
      <div className="insight-panels">
        <section className="insight-panel activity-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">TU RITMO</p>
              <h2>Lo que entra y lo que cierras</h2>
            </div>
          </div>
          <div className="activity-legend">
            <span>
              <i className="registered-key" />
              Registrados
            </span>
            <span>
              <i className="closed-key" />
              Cerrados
            </span>
          </div>
          <div
            className="activity-chart"
            aria-hidden="true"
            style={{
              gridTemplateColumns: `repeat(${stats.activity.length}, minmax(0, 1fr))`,
            }}
          >
            {stats.activity.map((bucket) => (
              <div className="activity-bucket" key={bucket.start}>
                <div className="activity-bars">
                  <span
                    className="activity-bar registered-bar"
                    style={{
                      height: `${(bucket.registered / maxActivity) * 100}%`,
                    }}
                  >
                    {bucket.registered > 0 && (
                      <small>{bucket.registered}</small>
                    )}
                  </span>
                  <span
                    className="activity-bar closed-bar"
                    style={{
                      height: `${(bucket.closed / maxActivity) * 100}%`,
                    }}
                  >
                    {bucket.closed > 0 && <small>{bucket.closed}</small>}
                  </span>
                </div>
                <span className="activity-label">
                  {shortDate(bucket.start)}
                </span>
              </div>
            ))}
          </div>
          <details className="insights-data">
            <summary>
              Ver cifras por {days === 7 ? "día" : "tramo de siete días"}
            </summary>
            <table>
              <caption>Actividad del período</caption>
              <thead>
                <tr>
                  <th scope="col">Fechas</th>
                  <th scope="col">Registrados</th>
                  <th scope="col">Cerrados</th>
                </tr>
              </thead>
              <tbody>
                {stats.activity.map((b) => (
                  <tr key={b.start}>
                    <th scope="row">
                      {shortDate(b.start)}
                      {b.start !== b.end ? ` — ${shortDate(b.end)}` : ""}
                    </th>
                    <td>{b.registered}</td>
                    <td>{b.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p className="insight-footnote">
            Fechas reales de registro y cierre. El último tramo puede ser más
            corto. Al reabrir un asunto deja de contar como cerrado.
          </p>
        </section>
        <section className="insight-panel">
          <p className="eyebrow">TAMBIÉN ES AVANZAR</p>
          <h2>Cómo has cerrado</h2>
          <ul className="closure-breakdown">
            <li>
              <span>Hecho</span>
              <strong>{stats.current.done}</strong>
            </li>
            <li>
              <span>Ya no hace falta</span>
              <strong>{stats.current.unnecessary}</strong>
            </li>
            <li>
              <span>Decidí dejarlo</span>
              <strong>{stats.current.abandoned}</strong>
            </li>
          </ul>
          <p className="insight-footnote">
            Cerrar también puede ser decidir que algo ya no merece tu atención.
          </p>
          <div className="open-summary">
            <span>Ideas guardadas, sin tratar como pendientes</span>
            <strong>{stats.saved}</strong>
          </div>
        </section>
      </div>
      <div className="insight-panels">
        <section className="insight-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LA SEMANA ACTUAL</p>
              <h2>Cómo se reparte tu agenda</h2>
            </div>
            <button className="text-button" onClick={() => navigate("plan")}>
              Ver semana →
            </button>
          </div>
          <ol className="week-load">
            {stats.week.map((day) => (
              <li key={day.date}>
                <span>
                  {formatDayLong(day.date).dayShort}{" "}
                  {formatDayLong(day.date).day}
                </span>
                <span className="load-track" aria-hidden="true">
                  <span style={{ width: `${(day.count / maxWeek) * 100}%` }} />
                </span>
                <strong aria-label={`${day.count} asuntos pendientes`}>
                  {day.count}
                </strong>
              </li>
            ))}
          </ol>
          <p className="insight-footnote">
            Acciones y seguimientos pendientes por día, incluidos los de días ya
            pasados. La fecha de hoy está marcada en Mi semana.
          </p>
        </section>
        <section className="insight-panel">
          <p className="eyebrow">LO QUE SIGUE ABIERTO</p>
          <h2>Prioridades de tus pendientes</h2>
          <ul className="priority-breakdown">
            {stats.openPriorities.map((p) => (
              <li key={p.color}>
                <span className={`priority ${p.color}`}>
                  {COLOR_LABELS[p.color]}
                </span>
                <strong>{p.count}</strong>
              </li>
            ))}
          </ul>
          <p className="insight-footnote">
            Bandeja, acciones y asuntos en espera. Este resumen refleja el
            estado actual y no cambia con el período.
          </p>
        </section>
      </div>
      <section className="insights-suggestions">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PEQUEÑAS DECISIONES</p>
            <h2>Algo que puedes soltar hoy</h2>
          </div>
        </div>
        {suggestions.length ? (
          <div className="suggestion-grid">
            {suggestions.map((item) => (
              <article className="suggestion-card" key={item.title}>
                <span className="suggestion-count">{item.count}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <button
                    className="text-button"
                    onClick={() => navigate(item.target, item.filter)}
                  >
                    {item.action} →
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">
            No hay pendientes atrasados, seguimientos vencidos ni asuntos
            estancados que señalar. Puedes volver a tu semana.
          </p>
        )}
      </section>
      <details className="insights-method">
        <summary>Cómo se calculan estos insights</summary>
        <p>
          El período incluye hoy y los {days - 1} días anteriores. Se compara
          con los {days} días inmediatamente anteriores. Las cifras se calculan
          en este dispositivo a partir de tus asuntos guardados, sin enviar
          datos a servicios de analítica.
        </p>
        <p>
          Los cierres usan su fecha real, nunca el día para el que se planificó
          la tarea. Los registros antiguos sin fecha conocida cuentan en el
          estado actual, pero no en la actividad temporal:{" "}
          {stats.unknownCreated} sin fecha de registro y {stats.unknownClosed}{" "}
          cierres sin fecha real. El tiempo típico usa la mediana de los cierres
          del período que tienen fechas válidas de registro y cierre.
        </p>
        <p>
          {stats.firstKnownDate
            ? `La primera fecha conocida de tus asuntos es ${shortDate(stats.firstKnownDate)} de ${stats.firstKnownDate.slice(0, 4)}. `
            : "Todavía no hay fechas de actividad conocidas. "}
          Las cifras describen los asuntos que conservas y su estado actual:
          editar, reabrir, deshacer o importar una copia puede cambiar los
          resultados. No se conserva un historial de cada transición ni se
          reconstruyen pendientes de fechas pasadas.
        </p>
      </details>
    </section>
  );
}
function Metric({ label, value, detail }) {
  return (
    <article className="insight-metric" aria-label={label}>
      <h2>{label}</h2>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
