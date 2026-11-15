import { addDays, getWeekDays, toISO } from "./dates.js";
import { needsReview, scheduledOn } from "./model.js";

const DAY_MS = 86400000;
// Counts use the date of the actual registration/closure in the device's timezone.
// A planned date is never substituted for a missing historical timestamp.
export function timestampDate(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : toISO(date);
}
export function closureTimestamp(task) {
  if (task.status !== "closed") return null;
  if (timestampDate(task.closedAt)) return task.closedAt;
  return task.closeReason === "done" && timestampDate(task.doneAt)
    ? task.doneAt
    : null;
}
const between = (date, start, end) =>
  Boolean(date && date >= start && date <= end);
function periodStats(tasks, start, end) {
  const registered = tasks.filter((t) =>
    between(timestampDate(t.createdAt), start, end),
  );
  const closed = tasks.filter((t) =>
    between(timestampDate(closureTimestamp(t)), start, end),
  );
  const durations = closed
    .map((t) => {
      const closedAt = closureTimestamp(t);
      return timestampDate(t.createdAt) && closedAt >= t.createdAt
        ? (closedAt - t.createdAt) / DAY_MS
        : null;
    })
    .filter((n) => n !== null)
    .sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  return {
    registered: registered.length,
    closed: closed.length,
    done: closed.filter((t) => t.closeReason === "done").length,
    unnecessary: closed.filter((t) => t.closeReason === "unnecessary").length,
    abandoned: closed.filter((t) => t.closeReason === "abandoned").length,
    medianDays: !durations.length
      ? null
      : durations.length % 2
        ? durations[mid]
        : (durations[mid - 1] + durations[mid]) / 2,
    durationSamples: durations.length,
  };
}
export function buildInsights(tasks, today, days = 30) {
  const length = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const start = addDays(today, 1 - length);
  const previousStart = addDays(start, -length),
    previousEnd = addDays(start, -1);
  const current = periodStats(tasks, start, today);
  const previous = periodStats(tasks, previousStart, previousEnd);
  const open = tasks.filter((t) =>
    ["inbox", "action", "waiting"].includes(t.status),
  );
  const inbox = tasks.filter((t) => t.status === "inbox");
  const oldInbox = inbox.filter((t) => {
    const date = timestampDate(t.createdAt);
    return date && date <= addDays(today, -7);
  });
  const overdue = tasks.filter(
    (t) => t.status === "action" && t.date && t.date < today,
  );
  const undated = tasks.filter((t) => t.status === "action" && !t.date);
  const followups = tasks.filter(
    (t) =>
      ["waiting", "reference"].includes(t.status) &&
      t.reviewDate &&
      t.reviewDate <= today,
  );
  const stalled = open.filter(
    (t) => Number.isFinite(t.reschedules) && t.reschedules >= 3,
  );
  const bucketDays = length === 7 ? 1 : 7;
  const activity = [];
  for (let offset = 0; offset < length; offset += bucketDays) {
    const first = addDays(start, offset),
      last = addDays(start, Math.min(offset + bucketDays - 1, length - 1));
    activity.push({
      start: first,
      end: last,
      ...periodStats(tasks, first, last),
    });
  }
  const week = getWeekDays(today).map((date) => ({
    date,
    count: tasks.filter((t) => t.status !== "closed" && scheduledOn(t, date))
      .length,
  }));
  const openPriorities = ["red", "yellow", "blue", "black"].map((color) => ({
    color,
    count: open.filter((t) => t.color === color).length,
  }));
  return {
    start,
    end: today,
    previousStart,
    previousEnd,
    days: length,
    current,
    previous,
    open: open.length,
    inbox: inbox.length,
    oldInbox: oldInbox.length,
    overdue: overdue.length,
    undated: undated.length,
    followups: followups.length,
    stalled: stalled.length,
    review: tasks.filter((t) => needsReview(t, today)).length,
    saved: tasks.filter((t) => t.status === "reference").length,
    waiting: tasks.filter((t) => t.status === "waiting").length,
    activity,
    week,
    openPriorities,
    unknownCreated: tasks.filter((t) => !timestampDate(t.createdAt)).length,
    unknownClosed: tasks.filter(
      (t) => t.status === "closed" && !closureTimestamp(t),
    ).length,
    firstKnownDate:
      tasks
        .flatMap((t) => [
          timestampDate(t.createdAt),
          timestampDate(closureTimestamp(t)),
        ])
        .filter((d) => d && d <= today)
        .sort()[0] || null,
    // Previous-period comparisons are absolute differences; no percentage with a zero baseline.
    registrationDelta: current.registered - previous.registered,
    closureDelta: current.closed - previous.closed,
  };
}
