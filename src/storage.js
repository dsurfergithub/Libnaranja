import { openDB } from 'idb'

const DB_NAME = 'libreta-naranja'
const DB_VERSION = 1
const TASKS_STORE = 'tasks'
const DAYS_STORE = 'days'
const ANCHORS_STORE = 'anchors'

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(TASKS_STORE)) {
          const store = db.createObjectStore(TASKS_STORE, { keyPath: 'id' })
          store.createIndex('byDate', 'date')
        }
        if (!db.objectStoreNames.contains(DAYS_STORE)) {
          db.createObjectStore(DAYS_STORE, { keyPath: 'date' })
        }
        if (!db.objectStoreNames.contains(ANCHORS_STORE)) {
          db.createObjectStore(ANCHORS_STORE, { keyPath: 'weekKey' })
        }
      }
    })
  }
  return dbPromise
}

// --- Tasks ---
export async function getAllTasks() {
  const db = await getDB()
  return db.getAll(TASKS_STORE)
}

export async function getTasksByDate(date) {
  const db = await getDB()
  return db.getAllFromIndex(TASKS_STORE, 'byDate', date)
}

export async function getTasksInRange(start, end) {
  const db = await getDB()
  const range = IDBKeyRange.bound(start, end)
  return db.getAllFromIndex(TASKS_STORE, 'byDate', range)
}

export async function saveTask(task) {
  const db = await getDB()
  await db.put(TASKS_STORE, task)
}

export async function deleteTask(id) {
  const db = await getDB()
  await db.delete(TASKS_STORE, id)
}

export async function updateTaskDate(id, newDate) {
  const db = await getDB()
  const tx = db.transaction(TASKS_STORE, 'readwrite')
  const task = await tx.store.get(id)
  if (task) {
    task.date = newDate
    task.carriedFrom = task.carriedFrom || []
    await tx.store.put(task)
  }
  await tx.done
}

// --- Days (reflections, metadata) ---
export async function getDay(date) {
  const db = await getDB()
  return db.get(DAYS_STORE, date)
}

export async function saveDay(day) {
  const db = await getDB()
  await db.put(DAYS_STORE, day)
}

// --- Anchors (weekly anchor task) ---
export async function getAnchor(weekKey) {
  const db = await getDB()
  return db.get(ANCHORS_STORE, weekKey)
}

export async function saveAnchor(anchor) {
  const db = await getDB()
  await db.put(ANCHORS_STORE, anchor)
}

export async function deleteAnchor(weekKey) {
  const db = await getDB()
  await db.delete(ANCHORS_STORE, weekKey)
}

// --- Carry-over logic ---
// Run on app start: for any task with date < today, not done, color != 'black',
// move it to today (record carry).
export async function applyCarryOver(todayISO) {
  const db = await getDB()
  const tx = db.transaction(TASKS_STORE, 'readwrite')
  const store = tx.store
  const index = store.index('byDate')
  const range = IDBKeyRange.upperBound(todayISO, true)
  let cursor = await index.openCursor(range)
  const operations = []
  while (cursor) {
    const task = cursor.value
    if (!task.done) {
      if (task.color === 'black') {
        operations.push({ type: 'delete', id: task.id })
      } else {
        const carriedFrom = task.carriedFrom || []
        carriedFrom.push(task.date)
        operations.push({
          type: 'update',
          task: { ...task, date: todayISO, carriedFrom }
        })
      }
    }
    cursor = await cursor.continue()
  }
  for (const op of operations) {
    if (op.type === 'delete') await store.delete(op.id)
    else await store.put(op.task)
  }
  await tx.done
  return operations.filter(o => o.type === 'update').length
}

export async function seedIfEmpty(todayISO) {
  const db = await getDB()
  const count = await db.count(TASKS_STORE)
  if (count > 0) return false
  // Seed a few tasks for today so the user sees something real on first open
  const seed = [
    { id: crypto.randomUUID(), date: todayISO, text: 'Probar la libreta', color: 'yellow', done: false, createdAt: Date.now() },
    { id: crypto.randomUUID(), date: todayISO, text: 'Definir la primera tarea ancla', color: 'red', done: false, createdAt: Date.now() + 1 },
    { id: crypto.randomUUID(), date: todayISO, text: 'Caminar 30 min', color: 'blue', done: false, createdAt: Date.now() + 2 }
  ]
  const tx = db.transaction(TASKS_STORE, 'readwrite')
  for (const t of seed) await tx.store.put(t)
  await tx.done
  return true
}
