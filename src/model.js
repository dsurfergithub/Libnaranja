export const STATUS_LABELS = {
  inbox: "Por aclarar",
  action: "Acción",
  waiting: "En espera",
  reference: "Guardado",
  closed: "Cerrado",
};
export const COLOR_LABELS = {
  red: "Urgente",
  yellow: "Importante",
  blue: "Rutina",
  black: "Opcional",
};
export const CLOSE_LABELS = {
  done: "Hecho",
  unnecessary: "Ya no hace falta",
  abandoned: "Decidí dejarlo",
};
export function normalizeTask(task) {
  return {
    ...task,
    status: task.status || (task.done ? "closed" : "action"),
    date: task.date || "",
    nextAction: task.nextAction || "",
    notes: task.notes || "",
    waitingFor: task.waitingFor || "",
    reviewDate: task.reviewDate || "",
    outcome: task.outcome || "",
    closeReason: task.closeReason || (task.done ? "done" : ""),
    reschedules: task.reschedules || 0,
  };
}
export function needsReview(task, today) {
  return (
    task.status === "inbox" ||
    (task.status === "action" && (!task.date || task.date < today)) ||
    (["waiting", "reference"].includes(task.status) &&
      task.reviewDate &&
      task.reviewDate <= today)
  );
}
export function scheduledOn(task, date) {
  return (
    (task.status === "action" && task.date === date) ||
    (["waiting", "reference"].includes(task.status) &&
      task.reviewDate === date) ||
    (task.status === "closed" && task.date === date)
  );
}
export function prepareEdit(original, values, now = Date.now()) {
  return {
    ...original,
    ...values,
    text: values.text.trim(),
    date:
      values.status === "action"
        ? values.date
        : values.status === "closed"
          ? original.date || values.date
          : "",
    reviewDate: ["waiting", "reference"].includes(values.status)
      ? values.reviewDate
      : "",
    reschedules:
      (original.reschedules || 0) +
      (original.date &&
      values.status === "action" &&
      values.date &&
      values.date !== original.date
        ? 1
        : 0),
    done: values.status === "closed" && values.closeReason === "done",
    doneAt:
      values.status === "closed" && values.closeReason === "done"
        ? original.doneAt || now
        : null,
    closedAt: values.status === "closed" ? original.closedAt || now : null,
    updatedAt: now,
  };
}
