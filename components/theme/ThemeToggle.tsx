"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, THEMES, type Theme } from "@/lib/theme";

const LABELS: Record<Theme, { icon: string; text: string }> = {
  system: { icon: "🖥️", text: "System" },
  light: { icon: "☀️", text: "Light" },
  dark: { icon: "🌙", text: "Dark" },
};

/** Cycles System → Light → Dark and keeps the document in sync. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  // When following the system, re-apply if the OS preference changes.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function cycle() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    applyTheme(next);
  }

  const { icon, text } = LABELS[theme];

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${text} (click to change)`}
      className="flex items-center gap-1.5 rounded-md border border-hive-border px-2 py-1 text-[11px] text-hive-muted transition hover:border-hive-accent hover:text-hive-accent"
    >
      <span aria-hidden>{icon}</span>
      <span>{text}</span>
    </button>
  );
}
