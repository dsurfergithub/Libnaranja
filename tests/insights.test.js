import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsights, timestampDate } from "../src/insights.js";
const at = (iso) => new Date(iso + "T12:00:00").valueOf();
const task = (id, fields = {}) => ({
  id,
  text: id,
  status: "action",
  color: "yellow",
  date: "",
  ...fields,
});
test("periods include local calendar boundaries and compare against an equal non-overlapping range", () => {
  const tasks = [
    task("first", { createdAt: at("2026-11-09") }),
    task("last", { createdAt: at("2026-11-15") }),
    task("previous-end", { createdAt: at("2026-11-08") }),
    task("previous-start", { createdAt: at("2026-11-02") }),
    task("too-old", { createdAt: at("2026-11-01") }),
    task("future", { createdAt: at("2026-11-16") }),
  ];
  const stats = buildInsights(tasks, "2026-11-15", 7);
  assert.equal(stats.start, "2026-11-09");
  assert.equal(stats.previousStart, "2026-11-02");
  assert.equal(stats.previousEnd, "2026-11-08");
  assert.equal(stats.current.registered, 2);
  assert.equal(stats.previous.registered, 2);
  assert.equal(stats.registrationDelta, 0);
  assert.equal(
    stats.activity.reduce((n, b) => n + b.registered, 0),
    2,
  );
});
test("closures use actual timestamps, not planned dates; legacy missing dates stay out of time series", () => {
  const stats = buildInsights(
    [
      task("done", {
        status: "closed",
        closeReason: "done",
        date: "2027-05-01",
        createdAt: at("2026-11-10"),
        doneAt: at("2026-11-11"),
      }),
      task("not-needed", {
        status: "closed",
        closeReason: "unnecessary",
        createdAt: at("2026-11-10"),
        closedAt: at("2026-11-13"),
      }),
      task("let-go", {
        status: "closed",
        closeReason: "abandoned",
        createdAt: at("2026-11-10"),
        closedAt: at("2026-11-14"),
      }),
      task("legacy", {
        status: "closed",
        closeReason: "done",
        date: "2026-11-15",
      }),
      task("reopened", { status: "action", closedAt: at("2026-11-15") }),
      task("invalid-duration", {
        status: "closed",
        closeReason: "done",
        createdAt: at("2026-11-15"),
        closedAt: at("2026-11-14"),
      }),
    ],
    "2026-11-15",
    7,
  );
  assert.equal(stats.current.closed, 4);
  assert.equal(stats.current.done, 2);
  assert.equal(stats.current.unnecessary, 1);
  assert.equal(stats.current.abandoned, 1);
  assert.equal(stats.current.durationSamples, 3);
  assert.equal(stats.current.medianDays, 3);
  assert.equal(stats.unknownClosed, 1);
  assert.equal(stats.open, 1);
});
test("current inventory is independent of range and references are not treated as open commitments", () => {
  const tasks = [
    task("inbox", { status: "inbox", createdAt: at("2026-11-01") }),
    task("overdue", { date: "2026-11-14", reschedules: 3 }),
    task("undated"),
    task("waiting", { status: "waiting", reviewDate: "2026-11-15" }),
    task("saved", { status: "reference", reviewDate: "2026-11-15" }),
    task("already-closed", { status: "closed", reschedules: 10 }),
  ];
  const stats = buildInsights(tasks, "2026-11-15", 30);
  assert.equal(stats.open, 4);
  assert.equal(stats.saved, 1);
  assert.equal(stats.oldInbox, 1);
  assert.equal(stats.overdue, 1);
  assert.equal(stats.undated, 1);
  assert.equal(stats.followups, 2);
  assert.equal(stats.stalled, 1);
  assert.equal(stats.review, 5);
  assert.equal(stats.week[6].count, 2);
  assert.equal(buildInsights(tasks, "2026-11-15", 7).open, stats.open);
});
test("empty data has no invented percentages, medians or dates and all chart buckets partition the range", () => {
  for (const days of [7, 30, 90]) {
    const stats = buildInsights([], "2027-01-03", days);
    assert.equal(stats.current.medianDays, null);
    assert.equal(stats.firstKnownDate, null);
    assert.equal(stats.closureDelta, 0);
    assert.equal(stats.activity[0].start, stats.start);
    assert.equal(stats.activity.at(-1).end, "2027-01-03");
    assert.equal(stats.week.length, 7);
  }
  assert.equal(timestampDate("2026-11-15"), null);
  assert.equal(timestampDate(Infinity), null);
  assert.equal(timestampDate(1e30), null);
  assert.equal(buildInsights([], "2026-11-15", 100000).days, 30);
});
test("median handles even sample counts and local dates stay stable near midnight and DST", () => {
  const tasks = [2, 4].map((duration, i) =>
    task(String(i), {
      status: "closed",
      closeReason: "done",
      createdAt: at("2026-11-01"),
      closedAt: at(`2026-11-0${duration + 1}`),
    }),
  );
  assert.equal(buildInsights(tasks, "2026-11-15", 30).current.medianDays, 3);
  const midnight = new Date(2026, 10, 15, 0, 5).valueOf();
  assert.equal(timestampDate(midnight), "2026-11-15");
  const stats = buildInsights(
    [task("dst", { createdAt: new Date(2026, 2, 29, 0, 5).valueOf() })],
    "2026-03-29",
    7,
  );
  assert.equal(stats.current.registered, 1);
  assert.equal(
    stats.activity.reduce((n, b) => n + b.registered, 0),
    1,
  );
});
