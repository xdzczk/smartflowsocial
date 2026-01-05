/**
 * Prettier Configuration
 * Formats code consistently across the project
 * Integrated with ESLint via eslint-config-prettier
 *
 * @type {import("prettier").Config}
 */
module.exports = {
  // Tailwind CSS plugin - automatically sorts Tailwind classes
  plugins: ["prettier-plugin-tailwindcss"],

  // Standard formatting options
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  useTabs: false,
  trailingComma: "es5",
  printWidth: 80,
  arrowParens: "always",
  endOfLine: "lf",

  // File-specific overrides
  overrides: [
    {
      files: "*.md",
      options: {
        printWidth: 100,
        proseWrap: "always",
      },
    },
    {
      files: "*.json",
      options: {
        printWidth: 100,
      },
    },
  ],
};
