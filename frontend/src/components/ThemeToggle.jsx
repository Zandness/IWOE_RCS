import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import "../styles/Theme.css";

const THEME_KEY = "wms-color-theme-v1";

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "day" ? "day" : "night";
  } catch {
    return "night";
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "day" ? "light" : "dark";
}

// Apply the stored theme before React paints the page.
applyTheme(savedTheme());

export default function ThemeToggle() {
  const [theme, setTheme] = useState(savedTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    function sync(event) {
      if (event.key === THEME_KEY || event.key === null) {
        setTheme(savedTheme());
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggle() {
    const next = theme === "night" ? "day" : "night";
    applyTheme(next);
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Switching still works when browser storage is unavailable.
    }
  }

  return (
    <div className="wms-theme-control">
      <button
        type="button"
        className="wms-theme-switch"
        role="switch"
        aria-checked={theme === "day"}
        aria-label="Day mode"
        title={`Switch to ${theme === "night" ? "Day" : "Night"} mode`}
        onClick={toggle}
      >
        <Sun className="wms-theme-sun" size={23} aria-hidden="true" />
        <Moon className="wms-theme-moon" size={23} aria-hidden="true" />
        <span className="wms-theme-thumb" aria-hidden="true" />
      </button>
      <span className="wms-theme-label">{theme === "day" ? "Day" : "Night"}</span>
    </div>
  );
}
