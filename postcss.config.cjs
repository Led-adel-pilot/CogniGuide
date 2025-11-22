const path = require("path");
const isProduction = process.env.NODE_ENV === "production";

const contentGlobs = [
  "./app/**/*.{ts,tsx,js,jsx,mdx}",
  "./components/**/*.{ts,tsx,js,jsx,mdx}",
  "./hooks/**/*.{ts,tsx,js,jsx}",
  "./lib/**/*.{ts,tsx,js,jsx}",
  "./data/**/*.{ts,tsx,js,jsx,md,mdx}",
  "./scripts/**/*.{ts,tsx,js,jsx}",
  "./public/**/*.html",
];

const plugins = {
  "@tailwindcss/postcss": {},
};

if (isProduction) {
  plugins[path.join(__dirname, "purgecss.plugin.cjs")] = {
    content: contentGlobs,
    defaultExtractor: (content) => content.match(/[\w-/:.%@[\](),]+/g) ?? [],
    safelist: [
      /data-theme/,
      /flashcard-grade-/,
      /mindmap-node/,
      /generator-card/,
      /map-viewport/,
      /spaced-due-badge/,
      /billing-toggle-/,
      /upgrade-plan-btn/,
    ],
  };
}

module.exports = { plugins };
