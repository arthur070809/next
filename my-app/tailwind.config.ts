import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        brand: "var(--brand)",
        "brand-hover": "var(--brand-hover)",
        "brand-pressed": "var(--brand-pressed)",
        surface: "var(--surface)",
        "text-secondary": "var(--text-secondary)",
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        success: "var(--success)",
        "success-surface": "var(--success-surface)",
        warning: "var(--warning)",
        "warning-surface": "var(--warning-surface)",
        error: "var(--error)",
        "error-surface": "var(--error-surface)",
        priority: "var(--priority)",
        "priority-surface": "var(--priority-surface)",
      },
    },
  },
};

export default config;
