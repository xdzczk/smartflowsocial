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
        "jsx-a11y/click-events-have-key-events": "warn",
        "jsx-a11y/no-static-element-interactions": "warn",
        "jsx-a11y/media-has-caption": "warn",
        "jsx-a11y/label-has-associated-control": "warn",
        "jsx-a11y/no-autofocus": "warn",
        "jsx-a11y/img-redundant-alt": "warn",
        "jsx-a11y/no-noninteractive-element-interactions": "warn",
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
        "@typescript-eslint/no-unused-vars": [
          "warn",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-inferrable-types": "warn",
        "@typescript-eslint/ban-ts-comment": "warn",
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
        // Temporarily set to warn to allow incremental fixing
        "import/no-restricted-paths": [
          "warn",
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

    // Markdown - relaxed rules for documentation
    {
      files: ["**/*.md"],
      plugins: ["markdown"],
      extends: ["plugin:markdown/recommended-legacy", "prettier"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
        "import/order": "off",
        "import/no-unresolved": "off",
        "react/jsx-no-undef": "off",
        "no-unused-labels": "off",
        "no-empty": "off",
        "no-debugger": "off",
      },
    },

    // Jest/Vitest - relaxed rules for test files
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
      rules: {
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/no-explicit-any": "warn",
        "no-console": "off",
        "import/order": "warn",
        "import/no-restricted-paths": "warn",
      },
    },

    // Cypress - relaxed rules for E2E tests
    {
      files: ["cypress/**/*.ts", "tests/e2e/**/*.ts"],
      plugins: ["cypress"],
      extends: ["plugin:cypress/recommended", "prettier"],
      rules: {
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "import/order": "warn",
      },
    },

    // Node scripts and config files
    {
      files: [".eslintrc.js", "mocks/**/*.js", "scripts/**/*.js", "*.config.{js,ts}", "cypress.config.ts", "vitest.config.ts"],
      env: {
        node: true,
      },
      rules: {
        "no-console": "off",
        "no-undef": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "import/order": "warn",
      },
    },

    // Allow console in error-logger (it's the logging infrastructure itself)
    {
      files: ["app/lib/error-logger.server.ts", "app/lib/error-handler.client.ts", "app/lib/secrets-sanitizer.server.ts"],
      rules: {
        "no-console": "off",
      },
    },

    // Seed files and factories - allow console and relaxed rules
    {
      files: ["**/seed*.ts", "**/*factory*.ts", "prisma/**/*.ts"],
      rules: {
        "no-console": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/no-explicit-any": "warn",
        "import/order": "warn",
      },
    },

    // Server entry files - allow console
    {
      files: ["server.ts", "worker.ts"],
      rules: {
        "no-console": "off",
        "@typescript-eslint/no-explicit-any": "warn",
      },
    },
  ],
};
