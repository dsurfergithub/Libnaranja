import { test, expect } from "@playwright/test";
async function capture(page, text) {
  await page.getByRole("button", { name: "＋ Capturar" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill(text);
  await page.getByRole("button", { name: "Guardar en bandeja" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function openInbox(page) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Bandeja/ })
    .click();
}
test("capture, clarify, plan a future month, complete, undo and persist", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tu semana, con espacio." }),
  ).toBeVisible();
  await expect(page.locator(".week-day")).toHaveCount(7);
  await capture(page, "Renovar seguro\nIdea para el verano");
  await openInbox(page);
  await expect(page.locator(".task-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Editar: Renovar seguro" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("¿Qué quieres hacer con él?").selectOption("action");
  await dialog
    .getByLabel("El siguiente paso concreto")
    .fill("Pedir dos presupuestos");
  await dialog.getByLabel("¿Cuándo quieres hacerlo?").fill("2028-02-29");
  await dialog.getByRole("button", { name: "Guardar decisión" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Archivo/ })
    .click();
  await page.getByLabel("Mostrar").selectOption("action");
  await expect(page.getByText("Pedir dos presupuestos")).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Archivo/ })
    .click();
  await page.getByLabel("Mostrar").selectOption("action");
  await page.getByRole("button", { name: "Editar: Renovar seguro" }).click();
  await expect(dialog.getByLabel("¿Cuándo quieres hacerlo?")).toHaveValue(
    "2028-02-29",
  );
  await dialog.getByLabel("¿Qué quieres hacer con él?").selectOption("closed");
  await dialog.getByLabel("¿Cómo lo cierras?").selectOption("abandoned");
  await dialog.getByRole("button", { name: "Guardar decisión" }).click();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.getByText("Pedir dos presupuestos")).toBeVisible();
});
test("month can expand and navigate across year without day overflow", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-12-31T12:00:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "Desplegar mes" }).click();
  await expect(page.locator(".month-day")).toHaveCount(42);
  await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page.locator("#month-calendar h3")).toHaveText("Enero 2027");
  await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page.locator("#month-calendar h3")).toHaveText("Febrero 2027");
  await page.locator(".month-day:not(.outside)").last().click();
  await expect(page.locator(".day-detail h2")).toContainText("28 de febrero");
  await page.getByRole("button", { name: "Semana actual" }).click();
  await expect(page.locator(".day-detail h2")).toContainText("31 de diciembre");
});
test("waiting follow-ups are reviewed, archived and recoverable without deletion", async ({
  page,
}) => {
  await page.goto("/");
  await capture(page, "Respuesta del banco");
  await openInbox(page);
  await page
    .getByRole("button", { name: "Editar: Respuesta del banco" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("¿Qué quieres hacer con él?").selectOption("waiting");
  await dialog.getByLabel("¿De quién o de qué depende?").fill("Ana");
  await dialog.getByLabel("Volver a revisar").fill("2020-01-01");
  await dialog.getByRole("button", { name: "Guardar decisión" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Revisión/ })
    .click();
  await expect(page.getByText("De: Ana")).toBeVisible();
  await page
    .getByRole("button", { name: "Editar: Respuesta del banco" })
    .click();
  await dialog.getByLabel("¿Qué quieres hacer con él?").selectOption("closed");
  await dialog.getByLabel("¿Cómo lo cierras?").selectOption("unnecessary");
  await dialog.getByRole("button", { name: "Guardar decisión" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Archivo/ })
    .click();
  await page.getByLabel("Mostrar").selectOption("closed");
  await expect(
    page.getByText("Ya no hace falta", { exact: true }),
  ).toBeVisible();
});
test("reflections and weekly anchor survive fast navigation and reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: /Tu ancla/ })
    .fill("Terminar lo importante");
  await page
    .getByRole("textbox", { name: /Antes de cerrar/ })
    .fill("Hoy me llevo tranquilidad");
  await expect(page.getByText("Guardado", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await page.getByRole("button", { name: "Semana actual" }).click();
  await expect(
    page.getByRole("textbox", { name: /Antes de cerrar/ }),
  ).toHaveValue("Hoy me llevo tranquilidad");
  await page.reload();
  await expect(page.getByRole("textbox", { name: /Tu ancla/ })).toHaveValue(
    "Terminar lo importante",
  );
});
test("JSON export and merge import round trip", async ({ page }) => {
  await page.goto("/");
  await capture(page, "Conservar en copia");
  await page.getByText("Tu libreta, a salvo", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia JSON" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.locator("input[type=file]").setInputFiles(path);
  await expect(page.getByText("0 entradas recuperadas")).toBeVisible();
  await openInbox(page);
  await expect(page.locator(".task-row")).toHaveCount(1);
});
test("mobile keeps seven days and the full month visible without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Desplegar mes" }).click();
  await expect(page.locator(".week-day")).toHaveCount(7);
  await expect(page.locator(".month-day")).toHaveCount(42);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/libnaranja-mobile.png", fullPage: true });
});
test("desktop layout and keyboard modal dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "＋ Capturar" }).click();
  await expect(page.getByRole("dialog").getByRole("textbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Desplegar mes" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/libnaranja-desktop.png",
    fullPage: true,
  });
});

test("legacy browser data survives upgrade and overdue optional tasks remain in review", async ({
  page,
}) => {
  await page.route("**/migration-seed", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html lang="es"><title>Seed</title></html>',
    }),
  );
  await page.goto("/migration-seed");
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("libreta-naranja", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.createObjectStore("tasks", { keyPath: "id" });
        store.createIndex("byDate", "date");
        db.createObjectStore("days", { keyPath: "date" });
        db.createObjectStore("anchors", { keyPath: "weekKey" });
        store.put({
          id: "legacy",
          text: "Opcional de la versión anterior",
          date: "2020-01-01",
          color: "black",
          done: false,
        });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Revisión/ })
    .click();
  await expect(
    page.getByText("Opcional de la versión anterior", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Revisión/ })
    .click();
  await expect(
    page.getByText("Opcional de la versión anterior", { exact: true }),
  ).toBeVisible();
});
test("plan for today, complete and reopen from the weekly detail", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "＋ Planificar", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Asunto", { exact: true })
    .fill("Llamar al taller");
  await page.getByRole("button", { name: "Guardar decisión" }).click();
  await expect(page.locator(".week-day.selected")).toContainText(
    "Llamar al taller",
  );
  await page
    .getByRole("button", { name: "Completar: Llamar al taller" })
    .click();
  await expect(page.locator(".day-footer")).toContainText("1 completados hoy");
  await expect(page.locator(".task-row.closed")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Reabrir: Llamar al taller" }).click();
  await expect(page.locator(".day-footer")).toContainText(
    "1 asuntos pendientes",
  );
});
