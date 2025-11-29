/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
    "./components/**/*.{ts,tsx,js,jsx,mdx}",
    "./hooks/**/*.{ts,tsx,js,jsx}",
    "./lib/**/*.{ts,tsx,js,jsx}",
    "./data/**/*.{ts,tsx,js,jsx,md,mdx}",
    "./scripts/**/*.{ts,tsx,js,jsx}",
    "./public/**/*.html",
  ],
  darkMode: ["class", "html[data-theme='dark']"],
  theme: {
    extend: {},
  },
  plugins: [],
};

module.exports = config;
