import { useEffect, useId, useRef, useState } from "react";
import {
  getAllTasks,
  saveTask,
  saveTasks,
  getDay,
  saveDay,
  getAnchor,
  saveAnchor,
  exportBackup,
  importBackup,
} from "./storage";
import {
  normalizeTask,
  needsReview,
  scheduledOn,
  prepareEdit,
  STATUS_LABELS,
  COLOR_LABELS,
  CLOSE_LABELS,
} from "./model";
import {
  todayISO,
  toISO,
  fromISO,
  addDays,
  weekKey,
  getWeekDays,
  getMonthGrid,
  formatDayLong,
  getDayShort,
  getMonthName,
} from "./dates";
import "./styles.css";
import Insights from "./Insights";
import ThemeControl from "./ThemeControl";
const SECTIONS = {
  plan: "Mi semana",
  inbox: "Bandeja",
  review: "Revisión",
  library: "Archivo",
  insights: "Insights",
};
const dateLabel = (iso) => {
  const d = formatDayLong(iso);
  return `${d.dayName.toLowerCase()}, ${d.day} de ${d.monthName.toLowerCase()}`;
};
const monthLabel = (iso) => {
  const d = fromISO(iso);
  return `${getMonthName(d.getMonth())} ${d.getFullYear()}`;
};
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState("plan");
  const [reviewFilter, setReviewFilter] = useState("");
  function navigate(target, filter = "") {
    setReviewFilter(filter);
    if (target === "plan") setSelected(todayISO());
    setSection(target);
  }
  const [selected, setSelected] = useState(todayISO());
  const [today, setToday] = useState(todayISO());
  const [monthOpen, setMonthOpen] = useState(false);
  const [capture, setCapture] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const importRef = useRef(null);
  useEffect(() => {
    getAllTasks()
      .then((data) => {
        setTasks(data);
        setReady(true);
      })
      .catch(() =>
        setError(
          "No se pudo abrir la libreta. Recarga para intentarlo de nuevo.",
        ),
      );
    const timer = setInterval(() => setToday(todayISO()), 30000);
    const refresh = () => setToday(todayISO());
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  async function run(action) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (e) {
      setError(
        e.message ||
          "No se pudo guardar. Tus cambios siguen disponibles para reintentarlo.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function update(task, message = "Asunto guardado") {
    return run(async () => {
      await saveTask(task);
      const previous = tasks.find((t) => t.id === task.id);
      setTasks((all) => all.map((t) => (t.id === task.id ? task : t)));
      setUndo(previous || null);
      setNotice(message);
    });
  }
  async function addCaptures(text) {
    return run(async () => {
      const entries = text
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text, i) =>
          normalizeTask({
            id: crypto.randomUUID(),
            text,
            status: "inbox",
            color: "yellow",
            date: "",
            createdAt: Date.now() + i,
            done: false,
          }),
        );
      await saveTasks(entries);
      setTasks((all) => [...all, ...entries]);
      setUndo(null);
      setNotice(
        `${entries.length} ${entries.length === 1 ? "asunto capturado" : "asuntos capturados"}. Puedes aclararlos en la bandeja.`,
      );
    });
  }
  async function toggle(task) {
    const closed = task.status === "closed";
    await update(
      {
        ...task,
        status: closed ? "action" : "closed",
        done: !closed,
        closeReason: closed ? "" : "done",
        doneAt: closed ? null : Date.now(),
        closedAt: closed ? null : Date.now(),
        date: task.date || selected,
      },
      closed ? "Asunto reabierto" : "Un asunto menos en la cabeza",
    );
  }
  async function backup(markdown = false) {
    await run(async () => {
      const data = await exportBackup();
      const content = markdown
        ? `# Libreta Naranja · ${today}\n\n` +
          data.tasks
            .map(
              (t) =>
                `- [${t.done ? "x" : " "}] ${t.text}\n  - Estado: ${STATUS_LABELS[t.status]}${t.closeReason ? ` · ${CLOSE_LABELS[t.closeReason]}` : ""}\n  - Fecha: ${t.date || "Sin fecha"}${t.reviewDate ? ` · Revisar: ${t.reviewDate}` : ""}\n  - Siguiente paso: ${t.nextAction || "—"}\n  - En espera de: ${t.waitingFor || "—"}\n  - Cierre esperado: ${t.outcome || "—"}\n  - Notas: ${t.notes || "—"}`,
            )
            .join("\n\n") +
          "\n\n## Reflexiones\n\n" +
          data.days.map((d) => `### ${d.date}\n${d.reflection}`).join("\n\n") +
          "\n\n## Anclas semanales\n\n" +
          data.anchors.map((a) => `- ${a.weekKey}: ${a.text}`).join("\n")
        : JSON.stringify(data, null, 2);
      download(
        `libreta-naranja-${today}.${markdown ? "md" : "json"}`,
        content,
        markdown ? "text/markdown" : "application/json",
      );
      setUndo(null);
      setNotice(
        markdown
          ? "Exportación Markdown preparada"
          : "Copia de seguridad preparada",
      );
    });
  }
  const inbox = tasks.filter((t) => t.status === "inbox");
  const review = tasks.filter((t) => needsReview(t, today));
  const dayTasks = tasks.filter((t) => scheduledOn(t, selected));
  const doneToday = tasks.filter(
    (t) =>
      t.status === "closed" && t.closeReason === "done" && t.date === today,
  ).length;
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSection("plan");
            setSelected(today);
          }}
        >
          <img
            className="brand-mark"
            src="./notebook-icon.svg?v=2"
            width="52"
            height="52"
            alt=""
          />
          <span>
            libreta<span className="brand-sub">NARANJA</span>
          </span>
        </a>
        <span className="tagline">
          Un lugar para soltar. Un momento para decidir.
        </span>
        <ThemeControl />
        <button className="primary" onClick={() => setCapture(true)}>
          ＋ Capturar<span className="desktop-only"> un pensamiento</span>
        </button>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">TU ESPACIO</p>
          <nav aria-label="Principal">
            {Object.entries(SECTIONS).map(([key, label]) => (
              <button
                key={key}
                className={section === key ? "nav-item active" : "nav-item"}
                aria-current={section === key ? "page" : undefined}
                onClick={() => navigate(key)}
              >
                {label}
                {["inbox", "review"].includes(key) && (
                  <span className="badge">
                    {key === "inbox" ? inbox.length : review.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="small-ring" />
            <p>No tienes que resolverlo todo ahora.</p>
            <small>Captura · Aclara · Revisa</small>
          </div>
          <details className="backup-menu">
            <summary>Tu libreta, a salvo</summary>
            <button onClick={() => backup()} disabled={busy}>
              Descargar copia JSON
            </button>
            <button onClick={() => backup(true)} disabled={busy}>
              Exportar a Markdown
            </button>
            <button onClick={() => importRef.current.click()} disabled={busy}>
              Importar copia
            </button>
            <small>
              La importación añade entradas nuevas sin sobrescribir las
              existentes.
            </small>
          </details>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files[0];
              e.target.value = "";
              if (!file) return;
              await run(async () => {
                if (file.size > 10 * 1024 * 1024)
                  throw new Error("El archivo supera los 10 MB.");
                const count = await importBackup(JSON.parse(await file.text()));
                setTasks(await getAllTasks());
                setNotice(`${count} entradas recuperadas`);
                setUndo(null);
                setSection("plan");
              });
            }}
          />
        </aside>
        <main>
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                onClick={() => setError("")}
                aria-label="Cerrar aviso de error"
              >
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              {undo && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await saveTask(undo);
                      setTasks((all) =>
                        all.map((t) => (t.id === undo.id ? undo : t)),
                      );
                      setUndo(null);
                      setNotice("Cambio deshecho");
                    })
                  }
                >
                  Deshacer
                </button>
              )}
              <button
                onClick={() => {
                  setNotice("");
                  setUndo(null);
                }}
                aria-label="Cerrar aviso"
              >
                ×
              </button>
            </div>
          )}
          {!ready ? (
            <div className="empty">
              {error
                ? "Tu libreta no se ha abierto todavía."
                : "Abriendo tu libreta…"}
            </div>
          ) : (
            <>
              {section === "plan" && (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">PERSPECTIVA, SIN PRISA</p>
                      <h1>Tu semana, con espacio.</h1>
                      <p>
                        Todas tus acciones de la semana, juntas y sin perder el
                        hilo.
                      </p>
                    </div>
                    <button onClick={() => setSelected(today)}>
                      Semana actual →
                    </button>
                  </div>
                  <Planner
                    selected={selected}
                    setSelected={setSelected}
                    today={today}
                    tasks={tasks}
                    monthOpen={monthOpen}
                    setMonthOpen={setMonthOpen}
                    onEdit={setEditing}
                    onToggle={toggle}
                    busy={busy}
                  />
                  <div className="day-layout">
                    <section className="day-detail">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">
                            {selected === today ? "HOY" : "DÍA SELECCIONADO"}
                          </p>
                          <h2>{dateLabel(selected)}</h2>
                        </div>
                        <button
                          className="text-button"
                          onClick={() =>
                            setEditing(
                              normalizeTask({
                                id: crypto.randomUUID(),
                                text: "",
                                status: "action",
                                date: selected,
                                color: "yellow",
                                createdAt: Date.now(),
                              }),
                            )
                          }
                        >
                          ＋ Planificar
                        </button>
                      </div>
                      <div className="day-footer">
                        <span>
                          {dayTasks.filter((t) => t.status !== "closed").length}{" "}
                          asuntos pendientes
                        </span>
                        {selected === today && (
                          <span>{doneToday} completados hoy</span>
                        )}
                      </div>
                    </section>
                    <aside className="notes-column">
                      <SavedNote
                        key={`anchor-${weekKey(selected)}`}
                        label="Tu ancla de la semana"
                        hint="Una intención para volver a lo importante."
                        placeholder="Esta semana quiero…"
                        load={() =>
                          getAnchor(weekKey(selected)).then(
                            (a) => a?.text || "",
                          )
                        }
                        save={(text) =>
                          saveAnchor({ weekKey: weekKey(selected), text })
                        }
                      />
                      <SavedNote
                        key={`reflection-${selected}`}
                        label="Antes de cerrar el día"
                        hint="¿Qué queda en tu cabeza? ¿Qué puedes soltar?"
                        placeholder="Hoy me llevo…"
                        load={() =>
                          getDay(selected).then((d) => d?.reflection || "")
                        }
                        save={(reflection) =>
                          saveDay({ date: selected, reflection })
                        }
                      />
                      <button
                        className="review-link"
                        onClick={() => navigate("review")}
                      >
                        <span>Un momento para revisar</span>
                        <strong>{review.length} asuntos por decidir →</strong>
                      </button>
                    </aside>
                  </div>
                </>
              )}
              {section === "inbox" && (
                <>
                  <PageHeading
                    eyebrow="01 / CAPTURAR"
                    title="Fuera de tu cabeza."
                    description="Ideas, pendientes o preocupaciones. Primero apúntalos; después decide."
                  />
                  <div className="capture-inline">
                    <CaptureForm onSave={addCaptures} busy={busy} />
                  </div>
                  <div className="section-heading">
                    <h2>Por aclarar</h2>
                    <span className="muted">{inbox.length} asuntos</span>
                  </div>
                  <TaskList
                    tasks={inbox}
                    onEdit={setEditing}
                    busy={busy}
                    empty="Tu bandeja está despejada. Vuelve cuando algo te ronde la cabeza."
                  />
                </>
              )}
              {section === "review" && (
                <>
                  <PageHeading
                    eyebrow="02 / ACLARAR · 03 / REVISAR"
                    title="Dale una salida."
                    description="Una decisión pequeña puede liberar mucho espacio."
                  />
                  {reviewFilter === "stalled" && (
                    <button
                      className="review-filter-reset"
                      onClick={() => setReviewFilter("")}
                    >
                      Mostrar toda la revisión
                    </button>
                  )}
                  <div className="review-intro">
                    <span className="small-ring" />
                    <p>
                      ¿Cuál es el siguiente paso? Hazlo concreto, ponle un
                      momento o decide dejarlo ir.
                    </p>
                  </div>
                  {(reviewFilter === "stalled"
                    ? [
                        [
                          "Asuntos reprogramados",
                          tasks.filter(
                            (t) =>
                              ["inbox", "action", "waiting"].includes(
                                t.status,
                              ) &&
                              Number.isFinite(t.reschedules) &&
                              t.reschedules >= 3,
                          ),
                        ],
                      ]
                    : [
                        ["Sin aclarar", inbox],
                        [
                          "Acciones por decidir",
                          tasks.filter(
                            (t) =>
                              t.status === "action" &&
                              (!t.date || t.date < today),
                          ),
                        ],
                        [
                          "Seguimientos para revisar",
                          tasks.filter(
                            (t) =>
                              ["waiting", "reference"].includes(t.status) &&
                              t.reviewDate &&
                              t.reviewDate <= today,
                          ),
                        ],
                      ]
                  ).map(([label, list]) => (
                    <section className="review-group" key={label}>
                      <div className="section-heading">
                        <h2>{label}</h2>
                        <span className="muted">{list.length}</span>
                      </div>
                      <TaskList
                        tasks={list}
                        onEdit={setEditing}
                        busy={busy}
                        empty="Todo en orden por aquí."
                      />
                    </section>
                  ))}
                </>
              )}
              {section === "insights" && (
                <Insights tasks={tasks} today={today} navigate={navigate} />
              )}
              {section === "library" && (
                <Library
                  tasks={tasks}
                  onEdit={setEditing}
                  busy={busy}
                  selected={selected}
                  selectDate={(iso) => {
                    setSelected(iso);
                    setSection("plan");
                  }}
                />
              )}
            </>
          )}
          <footer className="main-footer">
            <span>LIBRETA NARANJA</span>
            <span>Tu espacio personal · Guardado en este dispositivo</span>
          </footer>
        </main>
      </div>
      {capture && (
        <Modal title="Vaciar la cabeza" onClose={() => setCapture(false)}>
          <p className="modal-description">
            Una línea por asunto. No necesitas ordenarlo todavía.
          </p>
          <CaptureForm
            busy={busy}
            onSave={async (text) => {
              const ok = await addCaptures(text);
              if (ok) setCapture(false);
              return ok;
            }}
          />
        </Modal>
      )}
      {editing && (
        <Editor
          task={editing}
          today={today}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const task = prepareEdit(editing, values);
            const exists = tasks.some((t) => t.id === task.id);
            const ok = exists
              ? await update(task)
              : await run(async () => {
                  await saveTask(task);
                  setTasks((all) => [...all, task]);
                  setNotice("Acción planificada");
                  setUndo(null);
                });
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}
function PageHeading({ eyebrow, title, description }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function Planner({
  selected,
  setSelected,
  today,
  tasks,
  monthOpen,
  setMonthOpen,
  onEdit,
  onToggle,
  busy,
}) {
  const date = fromISO(selected),
    days = getWeekDays(selected);
  const counts = (iso) =>
    tasks.filter((t) => scheduledOn(t, iso) && t.status !== "closed");
  const shiftMonth = (delta) =>
    setSelected(
      toISO(new Date(date.getFullYear(), date.getMonth() + delta, 1)),
    );
  return (
    <section className="planner" aria-label="Planificación semanal y mensual">
      <div className="planner-toolbar">
        <div className="period">
          <button
            aria-label="Semana anterior"
            onClick={() => setSelected(addDays(selected, -7))}
          >
            ‹
          </button>
          <h2>
            {Number(days[0].slice(8))}
            {days[0].slice(0, 7) !== days[6].slice(0, 7)
              ? ` ${formatDayLong(days[0]).monthShort.toLowerCase()}`
              : ""}{" "}
            — {Number(days[6].slice(8))} <span>{monthLabel(selected)}</span>
          </h2>
          <button
            aria-label="Semana siguiente"
            onClick={() => setSelected(addDays(selected, 7))}
          >
            ›
          </button>
        </div>
        <button
          className={monthOpen ? "month-toggle selected" : "month-toggle"}
          aria-expanded={monthOpen}
          aria-controls="month-calendar"
          onClick={() => setMonthOpen((v) => !v)}
        >
          <svg
            className="calendar-symbol"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M5 5h14v15H5zM8 3v5m8-5v5M5 10h14M9 14h1m4 0h1m-6 3h1m4 0h1" />
          </svg>
          <span>{monthOpen ? "Plegar mes" : "Desplegar mes"}</span>
          <svg className="month-chevron" viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5 8 5 5 5-5" />
          </svg>
        </button>
      </div>
      <div
        className="week-grid"
        role="group"
        aria-label="Todas las acciones de la semana"
      >
        {days.map((iso) => {
          const list = tasks.filter((task) => scheduledOn(task, iso));
          const pending = list.filter(
            (task) => task.status !== "closed",
          ).length;
          return (
            <section
              className={`week-column ${iso === selected ? "selected" : ""}`}
              key={iso}
              aria-label={dateLabel(iso)}
            >
              <button
                className={`week-day ${iso === selected ? "selected" : ""} ${iso === today ? "today" : ""}`}
                aria-label={`${dateLabel(iso)}: ${pending} pendientes`}
                aria-pressed={iso === selected}
                onClick={() => setSelected(iso)}
              >
                <span className="weekday">{getDayShort(iso)}</span>
                <strong>{Number(iso.slice(8))}</strong>
                {iso === today && <span className="today-marker">Hoy</span>}
              </button>
              <div className="week-tasks">
                {list.length ? (
                  <TaskList
                    tasks={list}
                    onEdit={onEdit}
                    onToggle={onToggle}
                    busy={busy}
                    compact
                  />
                ) : (
                  <p className="week-empty">Sin asuntos</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {monthOpen && (
        <div id="month-calendar" className="month-calendar">
          <div className="section-heading">
            <h3>{monthLabel(selected)}</h3>
            <div className="button-group">
              <button aria-label="Mes anterior" onClick={() => shiftMonth(-1)}>
                ‹
              </button>
              <button onClick={() => setSelected(today)}>Hoy</button>
              <button aria-label="Mes siguiente" onClick={() => shiftMonth(1)}>
                ›
              </button>
            </div>
          </div>
          <div className="month-grid">
            {["L", "M", "X", "J", "V", "S", "D"].map((name, i) => (
              <span className="month-weekday" key={i}>
                {name}
              </span>
            ))}
            {getMonthGrid(date.getFullYear(), date.getMonth()).map((iso) => {
              const list = counts(iso);
              return (
                <button
                  key={iso}
                  className={`month-day ${iso.slice(0, 7) !== selected.slice(0, 7) ? "outside" : ""} ${iso === selected ? "selected" : ""} ${iso === today ? "today" : ""}`}
                  aria-pressed={iso === selected}
                  aria-label={`${dateLabel(iso)}: ${list.length} pendientes`}
                  onClick={() => setSelected(iso)}
                >
                  <span>{Number(iso.slice(8))}</span>
                  <span className="month-items">
                    {list.slice(0, 2).map((t) => (
                      <span key={t.id}>{t.nextAction || t.text}</span>
                    ))}
                  </span>
                  <span className="month-count">
                    {list.length > 0 ? `${list.length} pend.` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
function TaskList({ tasks, onEdit, onToggle, busy, empty, compact = false }) {
  const ordered = [...tasks].sort(
    (a, b) =>
      (a.status === "closed") - (b.status === "closed") ||
      (a.createdAt || 0) - (b.createdAt || 0),
  );
  return (
    <div className={compact ? "task-list task-list-compact" : "task-list"}>
      {!tasks.length && <p className="empty">{empty}</p>}
      {ordered.map((task) => (
        <article
          className={`task-row ${task.status === "closed" ? "closed" : ""}`}
          key={task.id}
        >
          {onToggle && ["action", "closed"].includes(task.status) ? (
            <button
              className={`task-check ${task.color}`}
              disabled={busy}
              aria-label={`${task.status === "closed" ? "Reabrir" : "Completar"}: ${task.text}`}
              onClick={() => onToggle(task)}
            >
              {task.status === "closed" ? "✓" : ""}
            </button>
          ) : (
            <span className={`task-bullet ${task.color}`} />
          )}
          <button
            className="task-body"
            aria-label={compact ? `Editar: ${task.text}` : undefined}
            disabled={busy}
            onClick={() => onEdit(task)}
          >
            <strong>{task.text}</strong>
            {task.nextAction && task.nextAction !== task.text && (
              <span className="next-action">→ {task.nextAction}</span>
            )}
            <span className="task-meta">
              <span className={`priority ${task.color}`}>
                {COLOR_LABELS[task.color]}
              </span>
              <span>
                {task.status === "closed"
                  ? CLOSE_LABELS[task.closeReason]
                  : STATUS_LABELS[task.status]}
              </span>
              {!compact && task.date && (
                <span>{task.date.split("-").reverse().join("/")}</span>
              )}
              {task.waitingFor && task.status === "waiting" && (
                <span>De: {task.waitingFor}</span>
              )}
              {task.reviewDate && (
                <span>
                  Revisar {task.reviewDate.split("-").reverse().join("/")}
                </span>
              )}
            </span>
            {task.reschedules >= 3 && task.status !== "closed" && (
              <span className="stalled">
                Lo has reprogramado varias veces. ¿Puedes dividirlo o dejarlo
                ir?
              </span>
            )}
          </button>
          {!compact && (
            <button
              className="edit-button"
              disabled={busy}
              aria-label={`Editar: ${task.text}`}
              onClick={() => onEdit(task)}
            >
              →
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
function CaptureForm({ onSave, busy }) {
  const [text, setText] = useState("");
  const inputId = useId();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim() && (await onSave(text))) setText("");
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        Pensamientos, uno por línea
      </label>
      <textarea
        id={inputId}
        autoFocus
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "¿Qué te ronda la cabeza?\nEscribe un asunto en cada línea…"
        }
        required
      />
      <div className="form-footer">
        <small>Sin fechas ni categorías. Solo sacarlo de la cabeza.</small>
        <button className="primary" disabled={busy || !text.trim()}>
          Guardar en bandeja →
        </button>
      </div>
    </form>
  );
}
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    dialog.querySelector("textarea, input, select")?.focus();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button type="button" aria-label="Cerrar ventana" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Editor({ task, busy, onClose, onSave }) {
  const [values, setValues] = useState({
    ...task,
    date: task.date,
    closeReason: task.closeReason || "done",
  });
  const field = (key) => ({
    value: values[key] || "",
    onChange: (e) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });
  return (
    <Modal
      title={
        task.status === "inbox"
          ? "Aclara este pensamiento"
          : "Un asunto, una decisión"
      }
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(values);
        }}
      >
        <label>
          Asunto
          <input autoFocus required {...field("text")} />
        </label>
        <div className="field-grid">
          <label>
            ¿Qué quieres hacer con él?
            <select {...field("status")}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridad
            <select {...field("color")}>
              {Object.entries(COLOR_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {values.status === "action" && (
          <>
            <label>
              El siguiente paso concreto
              <input
                {...field("nextAction")}
                placeholder="Por ejemplo: pedir dos presupuestos"
              />
            </label>
            <label>
              ¿Cuándo quieres hacerlo?
              <input type="date" {...field("date")} />
            </label>
            <small>
              Puedes dejar la fecha vacía: seguirá disponible en Revisión.
            </small>
          </>
        )}
        {values.status === "waiting" && (
          <label>
            ¿De quién o de qué depende?
            <input
              {...field("waitingFor")}
              placeholder="Persona, respuesta o condición"
            />
          </label>
        )}
        {["waiting", "reference"].includes(values.status) && (
          <label>
            Volver a revisar (opcional)
            <input type="date" {...field("reviewDate")} />
          </label>
        )}
        {values.status === "closed" && (
          <label>
            ¿Cómo lo cierras?
            <select {...field("closeReason")}>
              {Object.entries(CLOSE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <details className="editor-details">
          <summary>Un poco más de contexto</summary>
          <label>
            ¿Qué tendría que pasar para darlo por cerrado?
            <input
              {...field("outcome")}
              placeholder="Sabré que está resuelto cuando…"
            />
          </label>
          <label>
            Notas
            <textarea rows={3} {...field("notes")} />
          </label>
        </details>
        <div className="form-footer">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={busy || !values.text.trim()}>
            Guardar decisión
          </button>
        </div>
      </form>
    </Modal>
  );
}
function SavedNote({ label, hint, placeholder, load, save }) {
  const [value, setValue] = useState(""),
    [status, setStatus] = useState("Cargando…"),
    [loaded, setLoaded] = useState(false);
  const latest = useRef(""),
    queue = useRef(Promise.resolve()),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    load()
      .then((text) => {
        if (mounted.current) {
          latest.current = text;
          setValue(text);
          setLoaded(true);
          setStatus("");
        }
      })
      .catch(() => {
        if (mounted.current)
          setStatus("No se pudo cargar. Vuelve a seleccionar este día.");
      });
    return () => {
      mounted.current = false;
    };
  }, []);
  function persist(text) {
    latest.current = text;
    setValue(text);
    setStatus("Guardando…");
    queue.current = queue.current
      .catch(() => {})
      .then(() => save(text))
      .then(() => {
        if (mounted.current && latest.current === text) setStatus("Guardado");
      })
      .catch(() => {
        if (mounted.current) setStatus("Error al guardar. Pulsa Reintentar.");
      });
  }
  return (
    <section className="note-card">
      <label>
        <span className="eyebrow">{label}</span>
        <p>{hint}</p>
        <textarea
          disabled={!loaded}
          value={value}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => persist(e.target.value)}
        />
      </label>
      <div className="note-status" role="status">
        {status}
        {status.startsWith("Error") && (
          <button onClick={() => persist(value)}>Reintentar</button>
        )}
      </div>
    </section>
  );
}
function Library({ tasks, onEdit, busy, selected, selectDate }) {
  const [filter, setFilter] = useState("waiting"),
    [query, setQuery] = useState(""),
    [year, setYear] = useState(fromISO(selected).getFullYear());
  const list = tasks.filter(
    (t) =>
      t.status === filter &&
      `${t.text} ${t.nextAction} ${t.notes}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="PERSPECTIVA Y MEMORIA"
        title="Cada cosa, en su lugar."
        description="Recupera una idea, consulta un seguimiento o mira lo que ya has cerrado."
      />
      <div className="library-toolbar">
        <label>
          Mostrar
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="waiting">En espera</option>
            <option value="reference">Guardado</option>
            <option value="closed">Cerrado</option>
            <option value="action">Todas las acciones</option>
          </select>
        </label>
        <label>
          Buscar
          <input
            type="search"
            placeholder="Buscar en tus asuntos…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <TaskList
        tasks={list}
        onEdit={onEdit}
        busy={busy}
        empty="Todavía no hay asuntos que coincidan."
      />
      <details className="year-view">
        <summary>Tu año, de un vistazo</summary>
        <div className="section-heading">
          <h2>{year}</h2>
          <div className="button-group">
            <button
              aria-label="Año anterior"
              onClick={() => setYear((y) => y - 1)}
            >
              ‹
            </button>
            <button
              aria-label="Año siguiente"
              onClick={() => setYear((y) => y + 1)}
            >
              ›
            </button>
          </div>
        </div>
        <div className="year-grid">
          {Array.from({ length: 12 }, (_, m) => (
            <section key={m}>
              <h3>{getMonthName(m)}</h3>
              <div className="year-days">
                {Array.from(
                  { length: new Date(year, m + 1, 0).getDate() },
                  (_, i) => {
                    const iso = toISO(new Date(year, m, i + 1));
                    const done = tasks.filter(
                      (t) => t.date === iso && t.done,
                    ).length;
                    return (
                      <button
                        className={done ? "has-done" : ""}
                        key={iso}
                        title={`${iso}: ${done} completados`}
                        aria-label={`${iso}: ${done} completados`}
                        onClick={() => selectDate(iso)}
                      >
                        {i + 1}
                      </button>
                    );
                  },
                )}
              </div>
            </section>
          ))}
        </div>
      </details>
    </>
  );
}
