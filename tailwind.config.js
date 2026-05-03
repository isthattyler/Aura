/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base surfaces — resolved via CSS custom properties for theme switching
        bg: {
          base: "var(--color-bg-base)",
          surface: "var(--color-bg-surface)",
          elevated: "var(--color-bg-elevated)",
          overlay: "var(--color-bg-overlay)",
        },
        // Borders
        border: {
          subtle: "var(--color-border-subtle)",
          default: "var(--color-border-default)",
          strong: "var(--color-border-strong)",
        },
        // Text
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
        // Accent
        accent: {
          DEFAULT: "var(--color-accent)",
          dim: "var(--color-accent-dim)",
          hover: "var(--color-accent-hover)",
        },
        // Semantic — same values in both themes, kept as-is for opacity modifier support
        success: "#22C987",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#60A5FA",
        // Feature category colors — decorative, don't change with theme
        junk: "#F59E0B",
        trash: "#EF4444",
        files: "#8B5CF6",
        apps: "#3B82F6",
        privacy: "#EC4899",
        startup: "#10B981",
        disk: "#06B6D4",
        maintenance: "#F97316",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "sans-serif"],
        body: ['"DM Sans"', "sans-serif"],
        mono: ['"DM Mono"', "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["12px", { lineHeight: "18px" }],
        base: ["13px", { lineHeight: "20px" }],
        md: ["14px", { lineHeight: "22px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["18px", { lineHeight: "28px" }],
        "2xl": ["22px", { lineHeight: "30px" }],
        "3xl": ["28px", { lineHeight: "36px" }],
      },
      spacing: {
        "0.5": "2px",
        1: "4px",
        1.5: "6px",
        2: "8px",
        2.5: "10px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
        16: "64px",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.4)",
        DEFAULT: "0 2px 8px rgba(0,0,0,0.5)",
        lg: "0 4px 20px rgba(0,0,0,0.6)",
        glow: "0 0 20px rgba(0,212,170,0.15)",
        "glow-sm": "0 0 10px rgba(0,212,170,0.1)",
      },
      animation: {
        "fade-up": "fadeUp 180ms ease-out forwards",
        "fade-in": "fadeIn 150ms ease-out forwards",
        "slide-in-right": "slideInRight 200ms ease-out forwards",
        "spin-slow": "spin 3s linear infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "scan-ring": "scanRing 1.5s ease-in-out infinite",
        "scan-pulse": "scanPulse 1.2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scanRing: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        scanPulse: {
          "0%, 100%": { boxShadow: "0 0 0px transparent" },
          "50%": { boxShadow: "0 0 12px var(--scan-pulse-color, rgba(0,212,170,0.3))" },
        },
      },
    },
  },
  plugins: [],
};
