import { test, expect } from "@playwright/test";
const longText =
  "Preparar la propuesta completa del proyecto con todas las observaciones del equipo y enviarla para revisión antes de la reunión";
const tasks = [
  {
    id: "mon1",
    text: "Primera acción del lunes",
    date: "2026-11-09",
    status: "action",
    color: "yellow",
    nextAction: "Llamar para confirmar las condiciones",
  },
  {
    id: "mon2",
    text: "Segunda acción del lunes",
    date: "2026-11-09",
    status: "action",
    color: "blue",
  },
  {
    id: "mon3",
    text: longText,
    date: "2026-11-09",
    status: "action",
    color: "red",
  },
  {
    id: "wed",
    text: "Acción del miércoles",
    date: "2026-11-11",
    status: "action",
    color: "black",
  },
  {
    id: "follow",
    text: "Respuesta de Ana",
    reviewDate: "2026-11-12",
    status: "waiting",
    color: "yellow",
    waitingFor: "Ana",
  },
  {
    id: "sun",
    text: "Cierre del domingo",
    date: "2026-11-15",
    status: "closed",
    color: "blue",
    closeReason: "done",
    done: true,
  },
  {
    id: "next",
    text: "Asunto de la siguiente semana",
    date: "2026-11-16",
    status: "action",
    color: "yellow",
  },
  {
    id: "undated",
    text: "Acción sin fecha",
    date: "",
    status: "action",
    color: "yellow",
  },
];
async function loadWeek(page) {
  await page.clock.setFixedTime(new Date("2026-11-15T12:00:00"));
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "test-week-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        app: "libreta-naranja",
        version: 2,
        tasks,
        days: [],
        anchors: [],
      }),
    ),
  });
  await expect(page.getByText("8 entradas recuperadas")).toBeVisible();
}
test("all weekly actions and follow-ups are visible without selecting a day, and can be edited and completed in place", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loadWeek(page);
  const week = page.getByRole("group", {
    name: "Todas las acciones de la semana",
  });
  await expect(week.locator(".week-day")).toHaveCount(7);
  await expect(week.locator(".task-row")).toHaveCount(6);
  for (const text of [
    "Primera acción del lunes",
    "Segunda acción del lunes",
    longText,
    "Acción del miércoles",
    "Respuesta de Ana",
    "Cierre del domingo",
  ])
    await expect(week.getByText(text, { exact: true })).toBeVisible();
  await expect(
    week.getByText("Llamar para confirmar las condiciones", { exact: false }),
  ).toBeVisible();
  await expect(
    week.getByText("Asunto de la siguiente semana", { exact: true }),
  ).toHaveCount(0);
  await expect(week.getByText("Acción sin fecha", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".day-detail .task-row")).toHaveCount(0);
  await expect(page.locator(".day-detail h2")).toContainText("15 de noviembre");
  await page
    .getByRole("button", {
      name: "Editar: Primera acción del lunes",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("¿Cuándo quieres hacerlo?"),
  ).toHaveValue("2026-11-09");
  await page
    .getByRole("dialog")
    .getByLabel("Asunto", { exact: true })
    .fill("Acción del lunes editada");
  await page.getByRole("button", { name: "Guardar decisión" }).click();
  await page
    .getByRole("button", {
      name: "Completar: Acción del lunes editada",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Reabrir: Acción del lunes editada",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".day-detail h2")).toContainText("15 de noviembre");
  await expect(
    page
      .locator(".week-column")
      .first()
      .getByRole("button", { name: /lunes, 9 de noviembre: 2 pendientes/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Reabrir: Acción del lunes editada",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/libnaranja-semana-completa-fixture-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Semana siguiente", exact: true })
    .click();
  await expect(
    page.getByText("Asunto de la siguiente semana", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(longText, { exact: true })).toHaveCount(0);
});
for (const width of [320, 375, 414, 768]) {
  test(`complete weekly text at ${width}px in both themes, without day navigation or clipping`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await loadWeek(page);
    for (const theme of ["light", "dark"]) {
      await page.getByLabel("Apariencia", { exact: true }).selectOption(theme);
      const week = page.getByRole("group", {
        name: "Todas las acciones de la semana",
      });
      await expect(week.getByText(longText, { exact: true })).toBeVisible();
      await expect(
        week.getByText("Respuesta de Ana", { exact: true }),
      ).toBeVisible();
      await expect(week.locator(".task-row")).toHaveCount(6);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const bodies = await week.locator(".task-body").evaluateAll((elements) =>
        elements.map((el) => ({
          fits: el.scrollHeight <= el.clientHeight + 1,
          clamp: getComputedStyle(el).webkitLineClamp,
        })),
      );
      for (const body of bodies) {
        expect(body.fits).toBe(true);
        expect(body.clamp).toBe("none");
      }
      await page.screenshot({
        path: `/tmp/libnaranja-semana-completa-fixture-${width}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });
}
