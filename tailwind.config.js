/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#0b0f19",
          text: "#edf0f7",
          muted: "#8a9ab0",
          panel: "#0f1520",
          accent: "#818cf8",
        },
      },
      boxShadow: {
        premium:
          "0 24px 48px -24px rgba(0, 0, 0, 0.8), 0 10px 30px -20px rgba(129, 140, 248, 0.3)",
      },
    },
  },
  plugins: [],
};
