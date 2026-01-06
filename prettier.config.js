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
  bracketSpacing: true, // { foo: bar } instead of {foo: bar}
  bracketSameLine: false, // JSX closing bracket on new line
  quoteProps: "as-needed", // Only quote object properties when needed

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
        tabWidth: 2,
      },
    },
    {
      files: "*.{yml,yaml}",
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
    {
      files: "*.{css,scss}",
      options: {
        printWidth: 100,
      },
    },
    {
      files: "*.html",
      options: {
        printWidth: 100,
        htmlWhitespaceSensitivity: "css",
      },
    },
    {
      files: ["package.json", "pnpm-lock.yaml"],
      options: {
        printWidth: 1000, // Don't break package.json lines
      },
    },
  ],
};
