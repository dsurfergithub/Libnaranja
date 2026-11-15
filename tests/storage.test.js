import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDB } from "idb";
import {
  normalizeTask,
  needsReview,
  prepareEdit,
  scheduledOn,
} from "../src/model.js";
import {
  getAllTasks,
  exportBackup,
  importBackup,
  validateBackup,
} from "../src/storage.js";
import { getWeekDays, getMonthGrid } from "../src/dates.js";
test("v1 migration retains overdue optional tasks, completed tasks, anchors and reflections", async () => {
  const db = await openDB("libreta-naranja", 1, {
    upgrade(db) {
      const s = db.createObjectStore("tasks", { keyPath: "id" });
      s.createIndex("byDate", "date");
      db.createObjectStore("days", { keyPath: "date" });
      db.createObjectStore("anchors", { keyPath: "weekKey" });
    },
  });
  await db.put("tasks", {
    id: "optional",
    text: "No perder",
    color: "black",
    date: "2020-01-01",
    done: false,
  });
  await db.put("tasks", {
    id: "done",
    text: "Resuelto",
    color: "red",
    date: "2020-01-02",
    done: true,
  });
  await db.put("days", { date: "2020-01-01", reflection: "Mi reflexión" });
  await db.put("anchors", { weekKey: "2019-12-30", text: "Mi ancla" });
  db.close();
  const tasks = await getAllTasks();
  assert.equal(tasks.length, 2);
  assert.equal(tasks.find((t) => t.id === "optional").date, "2020-01-01");
  assert.equal(tasks.find((t) => t.id === "optional").status, "action");
  assert.equal(tasks.find((t) => t.id === "done").closeReason, "done");
  const backup = await exportBackup();
  assert.equal(backup.days[0].reflection, "Mi reflexión");
  assert.equal(backup.anchors[0].text, "Mi ancla");
  const copy = structuredClone(backup);
  copy.tasks[0].text = "Older copy must not overwrite";
  copy.tasks.push(
    normalizeTask({
      id: "new",
      text: "Importado",
      status: "inbox",
      color: "yellow",
    }),
  );
  assert.equal(await importBackup(copy), 1);
  assert.equal(
    (await getAllTasks()).find((t) => t.id === backup.tasks[0].id).text,
    backup.tasks[0].text,
  );
  assert.equal(await importBackup(copy), 0);
  const bad = structuredClone(copy);
  bad.tasks[0].date = "2026-02-31";
  assert.throws(() => validateBackup(bad));
  await assert.rejects(
    importBackup({ ...copy, days: [{ date: "bad", reflection: "" }] }),
  );
  assert.equal((await getAllTasks()).length, 3);
});
test("review includes overdue actions and due follow-ups, without pulling future work into today", () => {
  const today = "2026-11-15";
  for (const task of [
    { status: "inbox" },
    { status: "action", date: "" },
    { status: "action", date: "2026-11-14" },
    { status: "waiting", reviewDate: today },
    { status: "reference", reviewDate: today },
  ])
    assert.ok(needsReview(task, today));
  for (const task of [
    { status: "closed", date: "2020-01-01" },
    { status: "action", date: "2026-12-15" },
    { status: "waiting", reviewDate: "" },
  ])
    assert.ok(!needsReview(task, today));
  assert.ok(scheduledOn({ status: "waiting", reviewDate: today }, today));
});
test("editing tracks reschedules and distinguishes completion from intentional closure", () => {
  const original = normalizeTask({
    id: "a",
    text: "Test",
    status: "action",
    date: "2026-11-15",
    color: "yellow",
  });
  const moved = prepareEdit(original, { ...original, date: "2026-11-16" });
  assert.equal(moved.reschedules, 1);
  const closed = prepareEdit(moved, {
    ...moved,
    status: "closed",
    closeReason: "abandoned",
  });
  assert.equal(closed.done, false);
  assert.equal(closed.date, "2026-11-16");
  const waiting = prepareEdit(original, {
    ...original,
    status: "waiting",
    reviewDate: "2026-12-01",
  });
  assert.equal(waiting.date, "");
  assert.equal(waiting.reviewDate, "2026-12-01");
});
test("week and month navigation work across years and leap days", () => {
  assert.deepEqual(getWeekDays("2027-01-01"), [
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
  ]);
  assert.equal(
    getMonthGrid(2028, 1).filter((d) => d.startsWith("2028-02")).length,
    29,
  );
  assert.equal(getMonthGrid(2026, 10).length, 42);
});
