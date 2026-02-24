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

