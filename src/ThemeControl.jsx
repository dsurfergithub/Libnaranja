import { useEffect, useState } from "react";
const THEME_KEY = "libreta-naranja-appearance";
function readPreference() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return ["light", "dark", "system"].includes(value) ? value : "system";
  } catch {
    return "system";
  }
}
export default function ThemeControl() {
  const [preference, setPreference] = useState(readPreference);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme =
        preference === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preference;
      document.documentElement.dataset.theme = theme;
      const paper = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-paper-base")
        .trim();
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", paper);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);
  useEffect(() => {
    const sync = (e) => {
      if (e.key === THEME_KEY || e.key === null)
        setPreference(readPreference());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function change(value) {
    setPreference(value);
    try {
      localStorage.setItem(THEME_KEY, value);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  return (
    <div className="theme-control">
      <label>
        <span className="sr-only">Apariencia</span>
        <svg className="theme-symbol" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 0 0 16Z" />
        </svg>
        <select
          aria-label="Apariencia"
          value={preference}
          onChange={(e) => change(e.target.value)}
        >
          <option value="system">Sistema</option>
          <option value="light">Claro</option>
          <option value="dark">Oscuro</option>
        </select>
      </label>
      {storageError && (
        <span className="theme-save-error" role="status">
          Se aplicará solo en esta sesión.
        </span>
      )}
    </div>
  );
}
