import { test, expect } from "@playwright/test";
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function checkContrast(page, selectors) {
  const result = await page.evaluate((selectors) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rgb = (color) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const luminance = (color) =>
      rgb(color)
        .slice(0, 3)
        .map((n) => {
          n /= 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        })
        .reduce((v, n, i) => v + n * [0.2126, 0.7152, 0.0722][i], 0);
    return selectors.map((selector) => {
      const [target, pseudo] = selector.split("::");
      const el = document.querySelector(target),
        style = getComputedStyle(el, pseudo ? `::${pseudo}` : null);
      let parent = el,
        background;
      while (parent) {
        const c = getComputedStyle(parent).backgroundColor;
        if (rgb(c)[3] > 0) {
          background = c;
          break;
        }
        parent = parent.parentElement;
      }
      const a = luminance(style.color),
        b = luminance(background);
      return {
        selector,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
  }, selectors);
  for (const sample of result)
    expect(sample.ratio, `${sample.selector} contrast`).toBeGreaterThanOrEqual(
      4.5,
    );
}
for (const width of [320, 375, 414, 768]) {
  for (const theme of ["light", "dark"]) {
    test(`notebook ${theme} at ${width}px: week, month, notes, insights and modal`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (value) => localStorage.setItem("libreta-naranja-appearance", value),
        theme,
      );
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByLabel("Apariencia", { exact: true })).toHaveValue(
        theme,
      );
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(".week-day")).toHaveCount(7);
      await checkContrast(page, [
        ".page-heading p:last-child",
        ".nav-item.active",
        ".primary",
        ".note-card p",
        ".note-card:nth-child(2) p",
        ".note-card textarea::placeholder",
        ".note-card:nth-child(2) textarea::placeholder",
      ]);
      await noOverflow(page);
      const month = page.getByRole("button", {
        name: "Desplegar mes",
        exact: true,
      });
      await expect(month).toHaveAttribute("aria-expanded", "false");
      await month.click();
      await expect(
        page.getByRole("button", { name: "Plegar mes", exact: true }),
      ).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".month-day")).toHaveCount(42);
      await noOverflow(page);
      await page.screenshot({
        path: `/tmp/libnaranja-cuaderno-${theme}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page
        .getByRole("navigation")
        .getByRole("button", { name: /Insights/ })
        .click();
      await page.getByLabel("Período", { exact: true }).selectOption("90");
      await page.getByText("Ver cifras por tramo de siete días").click();
      await expect(
        page.getByRole("table", { name: "Actividad del período" }),
      ).toBeVisible();
      await checkContrast(page, [
        ".insight-metric h2",
        ".insight-footnote",
        ".insight-panel:nth-child(2) .insight-footnote",
      ]);
      await noOverflow(page);
      await page.getByRole("button", { name: "＋ Capturar" }).click();
      await expect(page.getByRole("dialog").getByRole("textbox")).toBeFocused();
      await checkContrast(page, [".modal-description", ".modal .primary"]);
      await noOverflow(page);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  }
}
test("system theme follows OS; explicit preference persists without changing notes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Apariencia", { exact: true })).toHaveValue(
    "system",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("textbox", { name: /Tu ancla/ })
    .fill("Mi intención se conserva");
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible();
  await page.getByLabel("Apariencia", { exact: true }).selectOption("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("textbox", { name: /Tu ancla/ })).toHaveValue(
    "Mi intención se conserva",
  );
  await page.getByLabel("Apariencia", { exact: true }).selectOption("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Apariencia", { exact: true }).selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("stored theme is applied before React starts", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("libreta-naranja-appearance", "dark"),
  );
  await page.route("**/src/main.jsx", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#root")).toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("appearance remains usable when preference storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value() {
        throw new Error("Storage unavailable");
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      value() {
        throw new Error("Storage unavailable");
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Apariencia", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByText("Se aplicará solo en esta sesión."),
  ).toBeVisible();
  await page.getByRole("button", { name: "＋ Capturar" }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox")
    .fill("La libreta sigue funcionando");
  await page.getByRole("button", { name: "Guardar en bandeja" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("new icon is available as SVG, favicon and correctly sized installable PNGs", async ({
  page,
  request,
}) => {
  const response = await request.get("/manifest.json");
  const manifest = await response.json();
  for (const icon of manifest.icons) {
    const response = await request.get("/" + icon.src.replace("./", ""));
    expect(response.ok()).toBe(true);
    const png = await response.body(),
      size = Number(icon.sizes.split("x")[0]);
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
  await page.goto("/");
  await expect(page.locator("link[rel=icon]")).toHaveAttribute(
    "href",
    "./notebook-icon.svg?v=2",
  );
  expect(
    await page
      .locator(".brand-mark")
      .evaluate((el) => el.complete && el.naturalWidth > 0),
  ).toBe(true);
});
