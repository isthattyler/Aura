/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        bg: {
          base: "#0A0C10",
          surface: "#0F1219",
          elevated: "#161B24",
          overlay: "#1C2333",
        },
        // Borders
        border: {
          subtle: "#1F2733",
          default: "#2A3444",
          strong: "#3A4A5E",
        },
        // Text
        text: {
          primary: "#E8EDF5",
          secondary: "#8A97AA",
          muted: "#4A5568",
        },
        // Accent — Electric Teal
        accent: {
          DEFAULT: "#00D4AA",
          dim: "#00D4AA22",
          hover: "#00EAC0",
        },
        // Semantic
        success: "#22C987",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#60A5FA",
        // Feature category colors
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
      },
    },
  },
  plugins: [],
};
