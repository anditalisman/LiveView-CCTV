import { useEffect, useState } from "react";

const STORAGE_KEY = "liveview_theme";

export function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem(STORAGE_KEY) !== "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}
