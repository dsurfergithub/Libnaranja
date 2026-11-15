import { openDB } from "idb";
import { normalizeTask } from "./model.js";
const DB_NAME = "libreta-naranja";
let dbPromise;
export function getDB() {
  if (!dbPromise)
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db, oldVersion, newVersion, tx) {
        if (!db.objectStoreNames.contains("tasks")) {
          const store = db.createObjectStore("tasks", { keyPath: "id" });
          store.createIndex("byDate", "date");
        }
        if (!db.objectStoreNames.contains("days"))
          db.createObjectStore("days", { keyPath: "date" });
        if (!db.objectStoreNames.contains("anchors"))
          db.createObjectStore("anchors", { keyPath: "weekKey" });
        if (oldVersion < 2) {
          // Preserve every v1 record, including optional/overdue tasks. No carry-over or deletion.
          const store = tx.objectStore("tasks");
          store.openCursor().then(async function migrate(cursor) {
            if (!cursor) return;
            await cursor.update(normalizeTask(cursor.value));
            return cursor.continue().then(migrate);
          });
        }
      },
    });
  return dbPromise;
}
export async function getAllTasks() {
  return (await (await getDB()).getAll("tasks")).map(normalizeTask);
}
export async function saveTask(task) {
  return (await getDB()).put("tasks", normalizeTask(task));
}
export async function saveTasks(tasks) {
  const tx = (await getDB()).transaction("tasks", "readwrite");
  for (const task of tasks) await tx.store.put(normalizeTask(task));
  await tx.done;
}
export async function getDay(date) {
  return (await getDB()).get("days", date);
}
export async function saveDay(day) {
  return (await getDB()).put("days", day);
}
export async function getAnchor(key) {
  return (await getDB()).get("anchors", key);
}
export async function saveAnchor(anchor) {
  return (await getDB()).put("anchors", anchor);
}
export async function exportBackup() {
  const db = await getDB();
  const tx = db.transaction(["tasks", "days", "anchors"]);
  const [tasks, days, anchors] = await Promise.all(
    ["tasks", "days", "anchors"].map((s) => tx.objectStore(s).getAll()),
  );
  await tx.done;
  return {
    app: DB_NAME,
    version: 2,
    exportedAt: new Date().toISOString(),
    tasks,
    days,
    anchors,
  };
}
const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
};
export function validateBackup(data) {
  if (
    !data ||
    data.app !== DB_NAME ||
    data.version !== 2 ||
    !["tasks", "days", "anchors"].every((k) => Array.isArray(data[k]))
  )
    throw new Error(
      "El archivo no es una copia compatible de Libreta Naranja.",
    );
  const optionalString = (t, k) =>
    t[k] === undefined || typeof t[k] === "string";
  const ids = new Set();
  for (const t of data.tasks) {
    if (
      !t ||
      typeof t.id !== "string" ||
      !t.id ||
      ids.has(t.id) ||
      typeof t.text !== "string" ||
      !t.text.trim() ||
      !["inbox", "action", "waiting", "reference", "closed"].includes(
        t.status,
      ) ||
      !["red", "yellow", "blue", "black"].includes(t.color) ||
      ![
        "date",
        "reviewDate",
        "nextAction",
        "notes",
        "waitingFor",
        "outcome",
        "closeReason",
      ].every((k) => optionalString(t, k)) ||
      (t.date && !validDate(t.date)) ||
      (t.reviewDate && !validDate(t.reviewDate)) ||
      (t.status === "closed" &&
        !["done", "unnecessary", "abandoned"].includes(t.closeReason))
    )
      throw new Error("La copia contiene asuntos no válidos.");
    ids.add(t.id);
  }
  if (
    data.days.some(
      (d) => !d || !validDate(d.date) || typeof d.reflection !== "string",
    ) ||
    data.anchors.some(
      (a) => !a || !validDate(a.weekKey) || typeof a.text !== "string",
    )
  )
    throw new Error("La copia contiene fechas o textos no válidos.");
  return data;
}
export async function importBackup(input) {
  const data = validateBackup(input);
  // Merge missing entries only: importing an older copy never overwrites newer local work.
  const tx = (await getDB()).transaction(
    ["tasks", "days", "anchors"],
    "readwrite",
  );
  let added = 0;
  for (const [name, key] of [
    ["tasks", "id"],
    ["days", "date"],
    ["anchors", "weekKey"],
  ]) {
    const store = tx.objectStore(name);
    for (const record of data[name])
      if (!(await store.get(record[key]))) {
        await store.put(name === "tasks" ? normalizeTask(record) : record);
        added++;
      }
  }
  await tx.done;
  return added;
}
