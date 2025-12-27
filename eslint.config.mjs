/**
 * ESLint v9 Flat Config
 * Migrated from .eslintrc.js
 */

import js from "@eslint/js";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import jest from "eslint-plugin-jest";
import jestDom from "eslint-plugin-jest-dom";
import testingLibrary from "eslint-plugin-testing-library";
import cypress from "eslint-plugin-cypress";
// Markdown plugin - may need adjustment for ESLint 9
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // Base config
  js.configs.recommended,
  
  // Ignore patterns
  {
    ignores: [
      "**/*.md",
      "app/lib/error-handler.example.ts",
      "app/lib/error-handler.server.ts",
      "node_modules/**",
      "build/**",
      "public/build/**",
      "postgres-data/**",
    ],
  },

  // React config for all JS/TS files
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/jsx-no-leaked-render": [
        "warn",
        { validStrategies: ["ternary"] },
      ],
      "react/prop-types": "off",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/img-redundant-alt": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
    },
  },

  // TypeScript config
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      import: importPlugin,
    },
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
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
      rules: {
      // Tier 1 — Must be zero (non-negotiable for correctness, safety, and valuation)
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "never",
        },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: false,
          allowNullish: false,
        },
      ],
      // Tier 2 — Strongly preferred to be zero
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/no-inferrable-types": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": "allow-with-description",
          "ts-nocheck": "allow-with-description",
          "ts-check": false,
        },
      ],
      "import/order": [
        "error",
        {
          alphabetize: { caseInsensitive: true, order: "asc" },
          groups: ["builtin", "external", "internal", "parent", "sibling"],
          "newlines-between": "always",
        },
      ],
      // Disallow console.log/warn/info, but allow console.error
      "no-console": [
        "error",
        {
          allow: ["error", "warn", "info"],
        },
      ],
      // Enforce feature boundaries
      "import/no-restricted-paths": [
        "warn",
        {
          zones: [
            {
              target: "app/routes/**/*",
              from: "app/models/**",
              message: "Routes cannot import from ~/models/* directly. Use feature service layers instead (e.g., ~/features/*/services/*.server.ts)",
            },
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
      // Prevent Prisma imports in routes
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

  // Markdown files - temporarily disabled for ESLint 9 compatibility
  // TODO: Re-enable when eslint-plugin-markdown has full ESLint 9 support
  {
    files: ["**/*.md"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-console": "off",
      "import/order": "off",
      "import/no-unresolved": "off",
      "react/jsx-no-undef": "off",
      "no-unused-labels": "off",
      "no-empty": "off",
      "no-debugger": "off",
      "no-undef": "off",
      "jsx-a11y/alt-text": "off",
    },
  },

  // Jest/Vitest test files
  {
    files: ["**/*.test.{js,jsx,ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      jest,
      "jest-dom": jestDom,
      "testing-library": testingLibrary,
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    settings: {
      jest: {
        version: 28,
      },
    },
    rules: {
      ...jest.configs.recommended.rules,
      ...jestDom.configs.recommended.rules,
      ...testingLibrary.configs.react.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "off",
      "import/order": "warn",
      "import/no-restricted-paths": "warn",
    },
  },

  // Cypress E2E tests - cypress directory
  {
    files: ["cypress/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      import: importPlugin,
      cypress,
    },
    rules: {
      ...cypress.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import/order": "warn",
      "cypress/no-unnecessary-waiting": "warn",
    },
  },

  // E2E tests - tests/e2e directory (uses separate tsconfig)
  {
    files: ["tests/e2e/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      import: importPlugin,
      cypress,
    },
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        project: "./tests/e2e/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...cypress.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import/order": "warn",
      "cypress/no-unnecessary-waiting": "warn",
    },
  },

  // Node scripts and config files
  {
    files: [".eslintrc.js", "mocks/**/*.js", "scripts/**/*.js", "*.config.{js,ts}", "cypress.config.ts", "vitest.config.ts"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import/order": "warn",
    },
  },

  // Allow console in error-logger and error-handler
  {
    files: [
      "app/lib/error-logger.server.ts",
      "app/lib/error-handler.client.ts",
      "app/lib/error-handler.server.ts",
      "app/lib/error-handler.example.ts",
      "app/lib/secrets-sanitizer.server.ts",
      "**/*.example.ts",
      "**/*.example.tsx",
    ],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      import: importPlugin,
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "import/order": "warn",
    },
  },

  // Seed files and factories
  {
    files: ["**/seed*.ts", "**/*factory*.ts", "prisma/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      import: importPlugin,
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "import/order": "warn",
    },
  },

  // Server entry files
  {
    files: ["server.ts", "worker.ts"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Prettier config (must be last)
  prettier,
];

