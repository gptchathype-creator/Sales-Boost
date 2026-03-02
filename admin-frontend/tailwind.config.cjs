const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: "#F6F6F6",
            foreground: "#111827",
            primary: "#6366F1",
            content1: "#FFFFFF",
            default: {
              50: "#F8F8F8",
              100: "#F2F2F2",
              200: "#ECECEC",
              300: "#E0E0E0",
              400: "#9CA3AF",
              500: "#6B7280",
              600: "#4B5563",
              700: "#374151",
              800: "#1F2937",
              900: "#111827",
            },
          },
        },
        dark: {
          colors: {
            background: "#020617",
            foreground: "#f9fafb",
            primary: "#3b82f6",
          },
        },
      },
    }),
  ],
};

