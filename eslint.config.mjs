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
// Markdown plugin - may need adjustment for ESLint 9
import prettier from "eslint-config-prettier";
import globals from "globals";

// ESLint 9 supports async config exports
export default (async () => {
  // Conditionally import cypress plugin to avoid module resolution issues
  let cypressPlugin;
  try {
    const cypressModule = await import("eslint-plugin-cypress");
    cypressPlugin = cypressModule.default;
  } catch {
    // Plugin not available or module resolution issue - will be undefined
    // This prevents the config from failing when the plugin can't be resolved
    cypressPlugin = undefined;
  }

  return [
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
      // Disable no-undef for TypeScript files (TypeScript handles this)
      "no-undef": "off",
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
          args: "after-used",
          ignoreRestSiblings: true,
        },
      ],
      // Allow unused parameter names in function type definitions
      "no-unused-vars": "off", // Use @typescript-eslint/no-unused-vars instead
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
            // Routes restrictions
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
            // Feature restrictions (excluding index.ts files which are the public API)
            // Note: index.ts files are allowed to import from their own internals
            // We use a more specific target pattern to exclude index.ts files
            {
              target: ["app/features/**/*.ts", "!app/features/**/index.ts"],
              from: "app/features/*/services/**",
              except: ["app/features/*/services/**"],
              message: "Features must use other features' public API (index.ts), not internal services",
            },
            {
              target: ["app/features/**/*.ts", "!app/features/**/index.ts"],
              from: "app/features/*/hooks/**",
              except: ["app/features/*/hooks/**"],
              message: "Features must use other features' public API (index.ts), not internal hooks",
            },
            {
              target: ["app/features/**/*.ts", "!app/features/**/index.ts"],
              from: "app/features/*/components/**",
              except: ["app/features/*/components/**"],
              message: "Features must use other features' public API (index.ts), not internal components",
            },
            {
              target: ["app/features/**/*.ts", "!app/features/**/index.ts"],
              from: "app/features/*/utils/**",
              except: ["app/features/*/utils/**"],
              message: "Features must use other features' public API (index.ts), not internal utils",
            },
            {
              target: ["app/features/**/*.tsx", "!app/features/**/index.tsx"],
              from: "app/features/*/services/**",
              except: ["app/features/*/services/**"],
              message: "Features must use other features' public API (index.ts), not internal services",
            },
            {
              target: ["app/features/**/*.tsx", "!app/features/**/index.tsx"],
              from: "app/features/*/hooks/**",
              except: ["app/features/*/hooks/**"],
              message: "Features must use other features' public API (index.ts), not internal hooks",
            },
            {
              target: ["app/features/**/*.tsx", "!app/features/**/index.tsx"],
              from: "app/features/*/components/**",
              except: [
                "app/features/*/components/**", // Allow importing from own components
                // Allow relative imports within the same feature (components importing from sibling components)
                "app/features/**/components/**/*.tsx", // Components can import from sibling components using relative paths
              ],
              message: "Features must use other features' public API (index.ts), not internal components",
            },
            {
              target: ["app/features/**/*.tsx", "!app/features/**/index.tsx"],
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

  // JavaScript test files (no TypeScript type-aware rules)
  {
    files: ["**/*.test.{js,jsx}", "tests/**/*.{js,jsx}"],
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
      // Only non-type-aware rules for JS test files
      "@typescript-eslint/no-explicit-any": "off", // Not applicable to JS
      "@typescript-eslint/no-unused-vars": "off", // Use no-unused-vars for JS
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "import/order": "warn",
      "import/no-restricted-paths": "off", // Tests can import from anywhere
      "no-restricted-imports": "off", // Tests can import anything
    },
  },

  // TypeScript test files (with type-aware rules)
  {
    files: ["**/*.test.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      jest,
      "jest-dom": jestDom,
      "testing-library": testingLibrary,
      import: importPlugin,
    },
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
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
      // Relax Tier 1 rules for tests
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/consistent-type-assertions": "warn",
      "@typescript-eslint/restrict-template-expressions": [
        "warn",
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: true,
          allowNullish: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "import/order": "warn",
      "import/no-restricted-paths": "off", // Tests can import from anywhere
      "no-restricted-imports": "off", // Tests can import anything
    },
  },

  // Cypress E2E tests - cypress directory
  {
    files: ["cypress/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      import: importPlugin,
      ...(cypressPlugin && { cypress: cypressPlugin }),
    },
    rules: {
      ...(cypressPlugin?.configs?.recommended?.rules || {}),
      // Relax Tier 1 rules for E2E tests
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/consistent-type-assertions": "warn",
      "@typescript-eslint/restrict-template-expressions": [
        "warn",
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: true,
          allowNullish: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "import/order": "warn",
      "import/no-restricted-paths": "off",
      "no-restricted-imports": "off",
      ...(cypressPlugin && { "cypress/no-unnecessary-waiting": "warn" }),
    },
  },

  // E2E tests - tests/e2e directory (uses separate tsconfig)
  {
    files: ["tests/e2e/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      import: importPlugin,
      ...(cypressPlugin && { cypress: cypressPlugin }),
    },
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        project: "./tests/e2e/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...(cypressPlugin?.configs?.recommended?.rules || {}),
      // Relax Tier 1 rules for E2E tests
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/consistent-type-assertions": "warn",
      "@typescript-eslint/restrict-template-expressions": [
        "warn",
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: true,
          allowNullish: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "import/order": "warn",
      "import/no-restricted-paths": "off",
      "no-restricted-imports": "off",
      ...(cypressPlugin && { "cypress/no-unnecessary-waiting": "warn" }),
    },
  },

  // JavaScript config files (no TypeScript type-aware rules)
  {
    files: [".eslintrc.js", "mocks/**/*.js", "scripts/**/*.js", "*.config.js"],
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
      // Only non-type-aware rules for JS files
      "@typescript-eslint/no-explicit-any": "off", // Not applicable to JS
      "no-console": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": "off", // Use no-unused-vars for JS
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import/order": "warn",
      "import/no-restricted-paths": "off",
      "no-restricted-imports": "off",
    },
  },

  // TypeScript scripts and config files (with type-aware rules)
  {
    files: ["scripts/**/*.ts", "*.config.ts", "cypress.config.ts", "vitest.config.ts"],
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
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Relax Tier 1 rules for scripts
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/consistent-type-assertions": "warn",
      "@typescript-eslint/restrict-template-expressions": [
        "warn",
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: true,
          allowNullish: true,
        },
      ],
      "no-console": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import/order": "warn",
      "import/no-restricted-paths": "off",
      "no-restricted-imports": "off",
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
      // Relax Tier 1 rules for seed/factory files
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/consistent-type-assertions": "warn",
      "@typescript-eslint/restrict-template-expressions": [
        "warn",
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: true,
          allowNullish: true,
        },
      ],
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import/order": "warn",
      "import/no-restricted-paths": "off",
      "no-restricted-imports": "off",
    },
  },

  // Feature index.ts files - allow importing from own internals
  {
    files: ["app/features/**/index.ts", "app/features/**/index.tsx"],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      import: importPlugin,
    },
    rules: {
      "import/no-restricted-paths": "off", // Index.ts files are the public API and should import from their own internals
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
})();

