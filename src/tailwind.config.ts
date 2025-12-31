import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          darkest: "#03045E",
          darker: "#023E8A",
          dark: "#0077B6",
          DEFAULT: "#0096C7",
          light: "#00B4D8",
          lighter: "#48CAE4",
          lightest: "#90E0EF",
        },
        secondary: {
          DEFAULT: "#ADE8F4",
          light: "#CAF0F8",
        },
        status: {
          reject: "#ef4444",
          hold: "#eab308", 
          select: "#22c55e",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;