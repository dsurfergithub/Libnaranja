// Date utilities — all dates handled as ISO YYYY-MM-DD strings in local time

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO() {
  return toISO(new Date())
}

export function addDays(iso, n) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

// Week starts on Monday
export function startOfWeek(iso) {
  const d = fromISO(iso)
  const dow = d.getDay() // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return toISO(d)
}

export function weekKey(iso) {
  return startOfWeek(iso)
}

export function getWeekDays(iso) {
  const start = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function getMonthGrid(year, month) {
  // month is 0-indexed; returns 6 weeks of dates including padding
  const firstOfMonth = new Date(year, month, 1)
  const startDow = firstOfMonth.getDay()
  const padStart = startDow === 0 ? 6 : startDow - 1
  const gridStart = new Date(year, month, 1 - padStart)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return toISO(d)
  })
}

export function getYearDays(year) {
  const days = []
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= daysInMonth[m]; d++) {
      days.push(toISO(new Date(year, m, d)))
    }
  }
  return days
}

export function formatDayLong(iso) {
  const d = fromISO(iso)
  return {
    day: d.getDate(),
    dayName: DAY_NAMES[d.getDay()],
    dayShort: DAY_SHORT[d.getDay()],
    monthName: MONTH_NAMES[d.getMonth()],
    monthShort: MONTH_SHORT[d.getMonth()],
    year: d.getFullYear()
  }
}

export function getMonthName(month) {
  return MONTH_NAMES[month]
}

export function getDayShort(iso) {
  return DAY_SHORT[fromISO(iso).getDay()]
}

export function getDayName(iso) {
  return DAY_NAMES[fromISO(iso).getDay()]
}

export function isSameMonth(iso, year, month) {
  const d = fromISO(iso)
  return d.getFullYear() === year && d.getMonth() === month
}

export function getYear(iso) {
  return fromISO(iso).getFullYear()
}

export function getMonth(iso) {
  return fromISO(iso).getMonth()
}
