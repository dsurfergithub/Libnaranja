import { useState, useEffect, useMemo, useRef } from 'react'
import {
  getAllTasks, saveTask, deleteTask,
  getDay, saveDay,
  getAnchor, saveAnchor,
  applyCarryOver, seedIfEmpty
} from './storage'
import {
  toISO, fromISO, todayISO, addDays, startOfWeek, weekKey,
  getWeekDays, getMonthGrid, getYearDays,
  formatDayLong, getDayShort, getMonth, getYear, isSameMonth, getMonthName
} from './dates'
import './styles.css'

const COLORS = ['red', 'yellow', 'blue', 'black']
const COLOR_LABELS = {
  red: 'Urgente',
  yellow: 'Importante',
  blue: 'Rutina',
  black: 'Opcional'
}
const COLOR_RANK = { red: 0, yellow: 1, blue: 2, black: 3 }

const VIEWS = ['day', 'week', 'month', 'year']
const VIEW_LABELS = { day: 'Día', week: 'Semana', month: 'Mes', year: 'Año' }

export default function App() {
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('day')
  const [activeDate, setActiveDate] = useState(todayISO())
  const [tasks, setTasks] = useState([])
  const [reflections, setReflections] = useState({}) // {iso: text}
  const [anchors, setAnchors] = useState({}) // {weekKey: text}
  const [carryNotice, setCarryNotice] = useState(0)

  // --- Boot: carry-over, seed, hydrate ---
  useEffect(() => {
    (async () => {
      const today = todayISO()
      const carried = await applyCarryOver(today)
      await seedIfEmpty(today)
      const all = await getAllTasks()
      setTasks(all)
      if (carried > 0) {
        setCarryNotice(carried)
        setTimeout(() => setCarryNotice(0), 4000)
      }
      setReady(true)
    })()
  }, [])

  // --- Hydrate reflection/anchor for active context ---
  useEffect(() => {
    if (!ready) return
    (async () => {
      const day = await getDay(activeDate)
      setReflections(prev => ({ ...prev, [activeDate]: day?.reflection || '' }))
      const wk = weekKey(activeDate)
      const anchor = await getAnchor(wk)
      setAnchors(prev => ({ ...prev, [wk]: anchor?.text || '' }))
    })()
  }, [activeDate, ready])

  const activeTasks = useMemo(
    () => tasks
      .filter(t => t.date === activeDate)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        if (COLOR_RANK[a.color] !== COLOR_RANK[b.color]) return COLOR_RANK[a.color] - COLOR_RANK[b.color]
        return (a.createdAt || 0) - (b.createdAt || 0)
      }),
    [tasks, activeDate]
  )

  // --- Handlers ---
  const handleToggle = async (id) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const updated = { ...task, done: !task.done, doneAt: !task.done ? Date.now() : null }
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
    await saveTask(updated)
  }

  const handleAdd = async (text, color) => {
    if (!text.trim()) return
    const newTask = {
      id: crypto.randomUUID(),
      date: activeDate,
      text: text.trim(),
      color,
      done: false,
      createdAt: Date.now(),
      carriedFrom: []
    }
    setTasks(prev => [...prev, newTask])
    await saveTask(newTask)
  }

  const handleDelete = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await deleteTask(id)
  }

  const handleReflectionChange = (val) => {
    setReflections(prev => ({ ...prev, [activeDate]: val }))
  }

  const handleReflectionBlur = async () => {
    await saveDay({ date: activeDate, reflection: reflections[activeDate] || '' })
  }

  const handleAnchorChange = (val) => {
    const wk = weekKey(activeDate)
    setAnchors(prev => ({ ...prev, [wk]: val }))
  }

  const handleAnchorBlur = async () => {
    const wk = weekKey(activeDate)
    await saveAnchor({ weekKey: wk, text: anchors[wk] || '' })
  }

  const navigateDay = (delta) => setActiveDate(addDays(activeDate, delta))
  const selectDay = (iso) => { setActiveDate(iso); setView('day') }

  if (!ready) {
    return (
      <div className="app-loading">
        <div className="loading-brand">Libreta</div>
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar view={view} setView={setView} />

      {carryNotice > 0 && (
        <div className="carry-toast">
          {carryNotice} {carryNotice === 1 ? 'tarea arrastrada' : 'tareas arrastradas'} a hoy
        </div>
      )}

      {view === 'day' && (
        <DayView
          activeDate={activeDate}
          tasks={activeTasks}
          allTasks={tasks}
          reflection={reflections[activeDate] || ''}
          anchor={anchors[weekKey(activeDate)] || ''}
          onToggle={handleToggle}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onReflectionChange={handleReflectionChange}
          onReflectionBlur={handleReflectionBlur}
          onAnchorChange={handleAnchorChange}
          onAnchorBlur={handleAnchorBlur}
          onNavigate={navigateDay}
        />
      )}

      {view === 'week' && (
        <WeekView
          activeDate={activeDate}
          tasks={tasks}
          anchor={anchors[weekKey(activeDate)] || ''}
          onAnchorChange={handleAnchorChange}
          onAnchorBlur={handleAnchorBlur}
          onSelectDay={selectDay}
          onShift={(delta) => setActiveDate(addDays(activeDate, delta * 7))}
        />
      )}

      {view === 'month' && (
        <MonthView
          activeDate={activeDate}
          tasks={tasks}
          onSelectDay={selectDay}
          onShift={(delta) => {
            const d = fromISO(activeDate)
            d.setMonth(d.getMonth() + delta)
            d.setDate(1)
            setActiveDate(toISO(d))
          }}
        />
      )}

      {view === 'year' && (
        <YearView
          activeDate={activeDate}
          tasks={tasks}
          onSelectDay={selectDay}
          onShift={(delta) => {
            const d = fromISO(activeDate)
            d.setFullYear(d.getFullYear() + delta)
            setActiveDate(toISO(d))
          }}
        />
      )}
    </div>
  )
}

// =================== TOP BAR ===================
function TopBar({ view, setView }) {
  return (
    <div className="topbar">
      <div className="brand">Libreta</div>
      <div className="view-toggle">
        {VIEWS.map(v => (
          <button
            key={v}
            className={`view-btn ${view === v ? 'active' : ''}`}
            onClick={() => setView(v)}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  )
}

// =================== DAY VIEW ===================
function DayView({
  activeDate, tasks, reflection, anchor,
  onToggle, onAdd, onDelete,
  onReflectionChange, onReflectionBlur,
  onAnchorChange, onAnchorBlur,
  onNavigate
}) {
  const [newText, setNewText] = useState('')
  const [newColor, setNewColor] = useState('yellow')
  const meta = formatDayLong(activeDate)
  const isToday = activeDate === todayISO()

  const handleSubmit = () => {
    if (!newText.trim()) return
    onAdd(newText, newColor)
    setNewText('')
  }

  return (
    <div className="view-container">
      <div className="date-header">
        <div className="date-main">
          <span className="date-day-num">{meta.day}</span>
          <div className="date-side">
            <div className="date-name">{meta.dayShort}</div>
            <div className="date-month">{meta.monthShort} · {meta.year}</div>
          </div>
        </div>
        <div className="date-nav">
          <button className="nav-btn" onClick={() => onNavigate(-1)}>‹</button>
          <button className="nav-btn" onClick={() => onNavigate(1)}>›</button>
        </div>
      </div>

      {isToday && <div className="today-pill">Hoy</div>}

      <div className="daily">
        {anchor && (
          <div className="anchor-display">
            <span className="anchor-label">Ancla de la semana</span>
            <span className="anchor-text">{anchor}</span>
          </div>
        )}

        <div className="section-label">Tareas del día</div>

        <div className="tasks-list">
          {tasks.length === 0 && (
            <div className="empty-state">
              ningún plan todavía · empieza con tu primera tarea
            </div>
          )}

          {tasks.map((task, idx) => (
            <TaskRow
              key={task.id}
              task={task}
              showAnchor={idx < 3}
              onToggle={() => onToggle(task.id)}
              onDelete={() => onDelete(task.id)}
            />
          ))}

          <div className="add-row">
            <div className="color-picker">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`color-dot ${c} ${newColor === c ? 'selected' : ''}`}
                  onClick={() => setNewColor(c)}
                  aria-label={COLOR_LABELS[c]}
                />
              ))}
            </div>
            <input
              className="task-input"
              placeholder="añadir tarea…"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        <div className="section-label">Reflexión</div>
        <div className="reflection-area">
          <textarea
            className="reflection-input"
            placeholder="cómo fue el día… (opcional)"
            value={reflection}
            onChange={(e) => onReflectionChange(e.target.value)}
            onBlur={onReflectionBlur}
          />
        </div>

        <div className="bottom-hint">
          toca el círculo para marcar hecho · negro caduca · resto arrastra al día siguiente
        </div>
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onDelete }) {
  const carried = (task.carriedFrom?.length || 0) > 0
  return (
    <div className={`task ${task.done ? 'done' : ''}`}>
      <button
        className={`dot ${task.color}`}
        onClick={onToggle}
        aria-label={task.done ? 'Marcar pendiente' : 'Marcar hecho'}
      />
      <span className="task-text" onClick={onToggle}>
        {task.text}
        {carried && <span className="carry-mark" title={`Arrastrada desde ${task.carriedFrom[0]}`}>↻</span>}
      </span>
      <button className="task-delete" onClick={onDelete} aria-label="Eliminar">×</button>
    </div>
  )
}

// =================== WEEK VIEW ===================
function WeekView({ activeDate, tasks, anchor, onAnchorChange, onAnchorBlur, onSelectDay, onShift }) {
  const days = getWeekDays(activeDate)
  const today = todayISO()
  const startMeta = formatDayLong(days[0])
  const endMeta = formatDayLong(days[6])

  const tasksByDay = useMemo(() => {
    const map = {}
    days.forEach(d => { map[d] = [] })
    tasks.forEach(t => { if (map[t.date]) map[t.date].push(t) })
    return map
  }, [tasks, activeDate])

  return (
    <div className="view-container">
      <div className="date-header">
        <div className="week-title-block">
          <div className="week-title">
            Semana del {startMeta.day} al {endMeta.day}
          </div>
          <div className="week-sub">{endMeta.monthName} · {endMeta.year}</div>
        </div>
        <div className="date-nav">
          <button className="nav-btn" onClick={() => onShift(-1)}>‹</button>
          <button className="nav-btn" onClick={() => onShift(1)}>›</button>
        </div>
      </div>

      <div className="weekly">
        <div className="section-label">Ancla de la semana</div>
        <div className="anchor-input-wrap">
          <input
            className="anchor-input"
            placeholder="la cosa más importante esta semana…"
            value={anchor}
            onChange={(e) => onAnchorChange(e.target.value)}
            onBlur={onAnchorBlur}
          />
        </div>

        <div className="section-label">Los siete días</div>

        {days.map(iso => {
          const dayTasks = tasksByDay[iso] || []
          const done = dayTasks.filter(t => t.done).length
          const total = dayTasks.length
          const isToday = iso === today
          const meta = formatDayLong(iso)
          return (
            <div
              key={iso}
              className={`day-card ${isToday ? 'today' : ''}`}
              onClick={() => onSelectDay(iso)}
            >
              <div className="day-card-head">
                <div>
                  <span className="day-card-name">{meta.dayName}</span>
                  <span className="day-card-num">{meta.day}</span>
                </div>
                {total > 0 && (
                  <span className="day-card-summary">{done}/{total}</span>
                )}
              </div>
              <div className="day-card-dots">
                {total === 0 && (
                  <span className="day-card-empty">sin tareas</span>
                )}
                {dayTasks.slice(0, 8).map(t => (
                  <span
                    key={t.id}
                    className={`mini-dot ${t.color} ${t.done ? 'done' : ''}`}
                  />
                ))}
                {dayTasks.length > 8 && (
                  <span className="more-dots">+{dayTasks.length - 8}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =================== MONTH VIEW ===================
function MonthView({ activeDate, tasks, onSelectDay, onShift }) {
  const year = getYear(activeDate)
  const month = getMonth(activeDate)
  const grid = getMonthGrid(year, month)
  const today = todayISO()

  // Dominant color per date among completed tasks
  const dominantByDate = useMemo(() => {
    const counts = {}
    tasks.forEach(t => {
      if (!t.done) return
      counts[t.date] = counts[t.date] || { red: 0, yellow: 0, blue: 0, black: 0 }
      counts[t.date][t.color]++
    })
    const out = {}
    for (const date in counts) {
      const c = counts[date]
      let best = 'yellow'
      let bestN = -1
      // Pick by precedence red>yellow>blue>black if tied
      for (const color of COLORS) {
        if (c[color] > bestN) { bestN = c[color]; best = color }
      }
      out[date] = best
    }
    return out
  }, [tasks])

  const countByDate = useMemo(() => {
    const out = {}
    tasks.forEach(t => {
      out[t.date] = out[t.date] || { total: 0, done: 0 }
      out[t.date].total++
      if (t.done) out[t.date].done++
    })
    return out
  }, [tasks])

  return (
    <div className="view-container">
      <div className="date-header">
        <div className="week-title-block">
          <div className="week-title">{getMonthName(month)}</div>
          <div className="week-sub">{year}</div>
        </div>
        <div className="date-nav">
          <button className="nav-btn" onClick={() => onShift(-1)}>‹</button>
          <button className="nav-btn" onClick={() => onShift(1)}>›</button>
        </div>
      </div>

      <div className="monthly">
        <div className="month-dow">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={i} className="month-dow-cell">{d}</div>
          ))}
        </div>

        <div className="month-grid">
          {grid.map(iso => {
            const inMonth = isSameMonth(iso, year, month)
            const isToday = iso === today
            const dom = dominantByDate[iso]
            const meta = formatDayLong(iso)
            const counts = countByDate[iso]
            return (
              <button
                key={iso}
                className={`month-cell ${inMonth ? '' : 'out'} ${isToday ? 'today' : ''}`}
                onClick={() => onSelectDay(iso)}
              >
                <span className="month-cell-num">{meta.day}</span>
                {dom && inMonth && (
                  <span className={`month-cell-dot ${dom}`} />
                )}
                {counts && inMonth && counts.total > 0 && !dom && (
                  <span className="month-cell-dot pending" />
                )}
              </button>
            )
          })}
        </div>

        <div className="month-legend">
          <span className="legend-item"><span className="legend-dot red" /> urgente</span>
          <span className="legend-item"><span className="legend-dot yellow" /> importante</span>
          <span className="legend-item"><span className="legend-dot blue" /> rutina</span>
          <span className="legend-item"><span className="legend-dot black" /> opcional</span>
        </div>

        <div className="bottom-hint">
          el color del punto = prioridad dominante del día completado
        </div>
      </div>
    </div>
  )
}

// =================== YEAR VIEW ===================
function YearView({ activeDate, tasks, onSelectDay, onShift }) {
  const year = getYear(activeDate)
  const today = todayISO()
  const days = useMemo(() => getYearDays(year), [year])

  const dominantByDate = useMemo(() => {
    const counts = {}
    tasks.forEach(t => {
      if (!t.done) return
      counts[t.date] = counts[t.date] || { red: 0, yellow: 0, blue: 0, black: 0 }
      counts[t.date][t.color]++
    })
    const out = {}
    for (const date in counts) {
      const c = counts[date]
      let best = null
      let bestN = -1
      for (const color of COLORS) {
        if (c[color] > bestN) { bestN = c[color]; best = color }
      }
      out[date] = best
    }
    return out
  }, [tasks])

  // Group by month for layout
  const byMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, () => [])
    days.forEach(iso => {
      const m = getMonth(iso)
      months[m].push(iso)
    })
    return months
  }, [days])

  const totalDone = Object.keys(dominantByDate).length

  return (
    <div className="view-container">
      <div className="date-header">
        <div className="week-title-block">
          <div className="week-title">{year}</div>
          <div className="week-sub">{totalDone} días con marca</div>
        </div>
        <div className="date-nav">
          <button className="nav-btn" onClick={() => onShift(-1)}>‹</button>
          <button className="nav-btn" onClick={() => onShift(1)}>›</button>
        </div>
      </div>

      <div className="yearly">
        {byMonth.map((monthDays, mi) => (
          <div key={mi} className="year-month">
            <div className="year-month-label">{getMonthName(mi).slice(0, 3)}</div>
            <div className="year-month-dots">
              {monthDays.map(iso => {
                const dom = dominantByDate[iso]
                const isToday = iso === today
                return (
                  <button
                    key={iso}
                    className={`year-dot ${dom || 'empty'} ${isToday ? 'today' : ''}`}
                    onClick={() => onSelectDay(iso)}
                    aria-label={iso}
                  />
                )
              })}
            </div>
          </div>
        ))}

        <div className="bottom-hint">
          una constelación de días · cada punto coloreado es un día con tarea hecha
        </div>
      </div>
    </div>
  )
}
