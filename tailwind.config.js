/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#07090d",
          text: "#e8edf5",
          muted: "#9aa6b8",
          panel: "#0f141d",
          accent: "#47d7b4",
        },
      },
      boxShadow: {
        premium:
          "0 24px 48px -24px rgba(0, 0, 0, 0.8), 0 10px 30px -20px rgba(71, 215, 180, 0.35)",
      },
    },
  },
  plugins: [],
};
