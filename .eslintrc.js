/**
 * This is intended to be a basic starting point for linting in the Blues Stack.
 * It relies on recommended configs out of the box for simplicity, but you can
 * and should modify this configuration to best suit your team's needs.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },

  // Base config
  extends: ["eslint:recommended"],

  overrides: [
    // React
    {
      files: ["**/*.{js,jsx,ts,tsx}"],
      plugins: ["react", "jsx-a11y"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
        "prettier",
      ],
      settings: {
        react: {
          version: "detect",
        },
        formComponents: ["Form"],
        linkComponents: [
          { name: "Link", linkAttribute: "to" },
          { name: "NavLink", linkAttribute: "to" },
        ],
      },
      rules: {
        "react/jsx-no-leaked-render": [
          "warn",
          { validStrategies: ["ternary"] },
        ],
        "react/prop-types": "off", // <-- Disable prop-types rule
      },
    },

    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint", "import"],
      parser: "@typescript-eslint/parser",
      settings: {
        "import/internal-regex": "^~/",
        "import/resolver": {
          node: {
            extensions: [".ts", ".tsx"],
          },
          typescript: {
            alwaysTryTypes: true,
          },
        },
      },
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/stylistic",
        "plugin:import/recommended",
        "plugin:import/typescript",
        "prettier",
      ],
      rules: {
        "import/order": [
          "error",
          {
            alphabetize: { caseInsensitive: true, order: "asc" },
            groups: ["builtin", "external", "internal", "parent", "sibling"],
            "newlines-between": "always",
          },
        ],
        // Disallow console.log/warn/info, but allow console.error (and allow all in error-logger)
        "no-console": [
          "error",
          {
            allow: ["error", "warn", "info"],
          },
        ],
        // Enforce feature boundaries - prevent deep imports across features
        "import/no-restricted-paths": [
          "error",
          {
            // Prevent importing from feature subdirectories (services/, hooks/, components/, utils/)
            // Must use public API via index.ts instead
            zones: [
              // Routes cannot import from models directly - must use service layers
              {
                target: "app/routes/**/*",
                from: "app/models/**",
                message: "Routes cannot import from ~/models/* directly. Use feature service layers instead (e.g., ~/features/*/services/*.server.ts)",
              },
              // Routes can only import from features via public API
              {
                target: "app/routes/**/*",
                from: "app/features/**/services/**",
                message: "Routes must use feature public API (index.ts), not internal services",
              },
              {
                target: "app/routes/**/*",
                from: "app/features/**/hooks/**",
                message: "Routes must use feature public API (index.ts), not internal hooks",
              },
              {
                target: "app/routes/**/*",
                from: "app/features/**/components/**",
                message: "Routes must use feature public API (index.ts), not internal components",
              },
              {
                target: "app/routes/**/*",
                from: "app/features/**/utils/**",
                message: "Routes must use feature public API (index.ts), not internal utils",
              },
              // Features cannot import from other features' internals
              {
                target: "app/features/**/*",
                from: "app/features/*/services/**",
                except: ["app/features/*/services/**"],
                message: "Features must use other features' public API (index.ts), not internal services",
              },
              {
                target: "app/features/**/*",
                from: "app/features/*/hooks/**",
                except: ["app/features/*/hooks/**"],
                message: "Features must use other features' public API (index.ts), not internal hooks",
              },
              {
                target: "app/features/**/*",
                from: "app/features/*/components/**",
                except: ["app/features/*/components/**"],
                message: "Features must use other features' public API (index.ts), not internal components",
              },
              {
                target: "app/features/**/*",
                from: "app/features/*/utils/**",
                except: ["app/features/*/utils/**"],
                message: "Features must use other features' public API (index.ts), not internal utils",
              },
              // Models should not import from feature internals
              {
                target: "app/models/**/*",
                from: "app/features/**/services/**",
                message: "Models must use feature public API (index.ts), not internal services",
              },
              {
                target: "app/models/**/*",
                from: "app/features/**/hooks/**",
                message: "Models must use feature public API (index.ts), not internal hooks",
              },
              {
                target: "app/models/**/*",
                from: "app/features/**/components/**",
                message: "Models must use feature public API (index.ts), not internal components",
              },
            ],
          },
        ],
        // Prevent Prisma imports in routes (routes should use models layer)
        "no-restricted-imports": [
          "warn",
          {
            paths: [
              {
                name: "@prisma/client",
                importNames: ["PrismaClient"],
                message: "Routes should not import PrismaClient directly. Use models layer instead (e.g., ~/models/*.server.ts)",
              },
            ],
            patterns: [
              {
                group: ["**/prisma.server"],
                message: "Routes should not import prisma.server directly. Use models layer instead.",
              },
            ],
          },
        ],
      },
    },

    // Markdown
    {
      files: ["**/*.md"],
      plugins: ["markdown"],
      extends: ["plugin:markdown/recommended-legacy", "prettier"],
    },

    // Jest/Vitest
    {
      files: ["**/*.test.{js,jsx,ts,tsx}"],
      plugins: ["jest", "jest-dom", "testing-library"],
      extends: [
        "plugin:jest/recommended",
        "plugin:jest-dom/recommended",
        "plugin:testing-library/react",
        "prettier",
      ],
      env: {
        "jest/globals": true,
      },
      settings: {
        jest: {
          version: 28,
        },
      },
    },

    // Cypress
    {
      files: ["cypress/**/*.ts"],
      plugins: ["cypress"],
      extends: ["plugin:cypress/recommended", "prettier"],
    },

    // Node
    {
      files: [".eslintrc.js", "mocks/**/*.js"],
      env: {
        node: true,
      },
    },

    // Allow console in error-logger (it's the logging infrastructure itself)
    {
      files: ["app/lib/error-logger.server.ts", "app/lib/error-handler.client.ts", "app/lib/secrets-sanitizer.server.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
};
