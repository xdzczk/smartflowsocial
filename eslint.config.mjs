/**
 * ESLint v9 Flat Config
 * Balanced world-class configuration: strict on correctness, reasonable on style
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
import unicorn from "eslint-plugin-unicorn";
import sonarjs from "eslint-plugin-sonarjs";
import promise from "eslint-plugin-promise";
import noSecrets from "eslint-plugin-no-secrets";
import eslintComments from "eslint-plugin-eslint-comments";
import prettier from "eslint-config-prettier";
import globals from "globals";

// ============================================================================
// Shared Rule Sets
// ============================================================================

/**
 * Tier 1: Critical correctness & safety rules (always errors)
 */
const tier1Rules = {
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
    { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
  ],
  "@typescript-eslint/restrict-template-expressions": [
    "error",
    { allowNumber: true, allowBoolean: true, allowAny: false, allowNullish: false },
  ],
};

/**
 * Tier 2: Critical code quality (errors) + Style preferences (warnings)
 */
const tier2Rules = {
  // Critical: errors
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      args: "after-used",
      ignoreRestSiblings: true,
    },
  ],
  "no-unused-vars": "off",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "separate-type-imports" },
  ],
  // Style: warnings
  "@typescript-eslint/prefer-nullish-coalescing": "warn",
  "@typescript-eslint/prefer-optional-chain": "warn",
  "@typescript-eslint/no-inferrable-types": "warn",
  "@typescript-eslint/prefer-readonly": "warn",
  "@typescript-eslint/prefer-reduce-type-parameter": "warn",
  "@typescript-eslint/no-unnecessary-condition": "warn",
  "@typescript-eslint/ban-ts-comment": [
    "warn",
    {
      "ts-expect-error": "allow-with-description",
      "ts-ignore": "allow-with-description",
      "ts-nocheck": "allow-with-description",
      "ts-check": false,
    },
  ],
  // TypeScript consistency rules
  "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],
  "@typescript-eslint/array-type": ["warn", { default: "array-simple" }],
  "@typescript-eslint/no-confusing-void-expression": ["warn", { ignoreArrowShorthand: true }],
  "@typescript-eslint/no-meaningless-void-operator": "warn",
  "@typescript-eslint/no-redundant-type-constituents": "warn",
};

/**
 * Import ordering (error for consistency)
 */
const importOrderRule = [
  "error",
  {
    alphabetize: { caseInsensitive: true, order: "asc" },
    groups: ["builtin", "external", "internal", "parent", "sibling"],
    "newlines-between": "always",
  },
];

/**
 * Feature boundary restrictions (error for architecture enforcement)
 */
const featureBoundaryRestrictions = [
  {
    target: "app/routes/**/*",
    from: "app/models/**",
    message: "Routes cannot import from ~/models/* directly. Use feature service layers instead.",
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
    target: ["app/features/**/*.{ts,tsx}", "!app/features/**/index.{ts,tsx}"],
    from: "~/features/*/services/**",
    except: ["app/features/*/services/**", "app/features/**/services/**"],
    message: "Features must use other features' public API (index.ts), not internal services. Use relative imports for same-feature imports.",
  },
  {
    target: ["app/features/**/*.{ts,tsx}", "!app/features/**/index.{ts,tsx}"],
    from: "~/features/*/hooks/**",
    except: ["app/features/*/hooks/**", "app/features/**/hooks/**"],
    message: "Features must use other features' public API (index.ts), not internal hooks. Use relative imports for same-feature imports.",
  },
  {
    target: ["app/features/**/*.{ts,tsx}", "!app/features/**/index.{ts,tsx}"],
    from: "~/features/*/components/**",
    except: ["app/features/*/components/**", "app/features/**/components/**"],
    message: "Features must use other features' public API (index.ts), not internal components. Use relative imports for same-feature imports.",
  },
  {
    target: ["app/features/**/*.{ts,tsx}", "!app/features/**/index.{ts,tsx}"],
    from: "~/features/*/utils/**",
    except: ["app/features/*/utils/**", "app/features/**/utils/**"],
    message: "Features must use other features' public API (index.ts), not internal utils. Use relative imports for same-feature imports.",
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
];

/**
 * Quality improvement rules (warnings - code quality, not correctness)
 */
const qualityRules = {
  // Unicorn
  "unicorn/prevent-abbreviations": "off",
  "unicorn/filename-case": [
    "warn",
    {
      case: "kebabCase",
      ignore: [/^[A-Z]/, /\.server\.ts$/, /\.client\.ts$/, /^use[A-Z]/],
    },
  ],
  "unicorn/no-array-callback-reference": "warn",
  "unicorn/no-array-method-this-argument": "warn",
  "unicorn/no-array-reduce": "off",
  "unicorn/no-useless-undefined": "warn",
  "unicorn/prefer-array-find": "warn",
  "unicorn/prefer-array-some": "warn",
  "unicorn/prefer-array-index-of": "warn",
  "unicorn/prefer-includes": "warn",
  "unicorn/prefer-string-starts-ends-with": "warn",
  "unicorn/prefer-string-trim-start-end": "warn",
  "unicorn/prefer-top-level-await": "off",
  // SonarJS
  "sonarjs/cognitive-complexity": ["warn", 15],
  "sonarjs/no-duplicate-string": ["warn", { threshold: 3 }],
  "sonarjs/no-identical-functions": "warn",
  "sonarjs/no-small-switch": "off",
  "sonarjs/prefer-immediate-return": "warn",
  "sonarjs/prefer-single-boolean-return": "warn",
  // Promise
  "promise/always-return": "warn",
  "promise/catch-or-return": "warn",
  "promise/no-nesting": "warn",
  "promise/no-promise-in-callback": "warn",
  "promise/no-return-in-finally": "error",
  "promise/prefer-await-to-callbacks": "warn",
  "promise/prefer-await-to-then": "warn",
  // Security
  "no-secrets/no-secrets": [
    "warn",
    {
      tolerance: 4.2,
      ignoreContent: [
        "^[a-f0-9]{32,64}$",
        "^[A-Za-z0-9+/=]{20,}$",
        "^[A-Za-z]{26,}$",
      ],
    },
  ],
};

// ============================================================================
// Main Config
// ============================================================================

export default (async () => {
  let cypressPlugin;
  try {
    const cypressModule = await import("eslint-plugin-cypress");
    cypressPlugin = cypressModule.default;
  } catch {
    cypressPlugin = undefined;
  }

  return [
    js.configs.recommended,

    // ESLint comment best practices (global)
    {
      plugins: {
        "eslint-comments": eslintComments,
      },
      rules: {
        "eslint-comments/disable-enable-pair": "warn",
        "eslint-comments/no-unlimited-disable": "error",
        "eslint-comments/no-unused-disable": "error",
        "eslint-comments/require-description": ["warn", { ignore: ["eslint-enable"] }],
      },
    },

    // Ignore patterns
    {
      ignores: [
        "**/*.md",
        "node_modules/**",
        "build/**",
        "public/build/**",
        "postgres-data/**",
        "coverage/**",
        "tests/e2e/cypress.config.mobile.ts",
      ],
    },

    // Base: React & JSX for all files
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
        parserOptions: { ecmaFeatures: { jsx: true } },
        globals: { ...globals.browser, ...globals.node },
      },
      settings: { react: { version: "detect" } },
      rules: {
        ...reactPlugin.configs.recommended.rules,
        ...reactPlugin.configs["jsx-runtime"].rules,
        ...reactHooks.configs.recommended.rules,
        ...jsxA11y.configs.recommended.rules,
        "react/jsx-no-leaked-render": ["warn", { validStrategies: ["ternary"] }],
        "react/prop-types": "off",
        "no-undef": "off",
        // React performance rules
        "react/jsx-no-constructed-context-values": "warn",
        "react/no-array-index-key": "warn",
        "react/no-unstable-nested-components": "warn",
        "jsx-a11y/click-events-have-key-events": "warn",
        "jsx-a11y/no-static-element-interactions": "warn",
        "jsx-a11y/media-has-caption": "warn",
        "jsx-a11y/label-has-associated-control": "warn",
        "jsx-a11y/no-autofocus": "warn",
        "jsx-a11y/img-redundant-alt": "warn",
        "jsx-a11y/no-noninteractive-element-interactions": "warn",
      },
    },

    // Production TypeScript: Strict rules for correctness & safety
    {
      files: ["**/*.{ts,tsx}"],
      ignores: [
        "tailwind.config.ts",
        "tests/**",
        "cypress/**",
        "**/*.test.{ts,tsx}",
        "**/*.config.ts",
        "scripts/**",
        "mocks/**",
        "**/seed*.ts",
        "**/*factory*.ts",
        "prisma/**",
        "server.ts",
        "worker.ts",
      ],
      plugins: {
        "@typescript-eslint": tseslintPlugin,
        import: importPlugin,
        unicorn,
        sonarjs,
        promise,
        "no-secrets": noSecrets,
        "eslint-comments": eslintComments,
      },
      languageOptions: {
        parser: tseslintParser,
        parserOptions: {
          project: "./tsconfig.json",
          tsconfigRootDir: import.meta.dirname,
          isolatedModules: true, // Match tsconfig.json setting
        },
      },
      settings: {
        "import/internal-regex": "^~/",
        "import/resolver": {
          node: { extensions: [".ts", ".tsx"] },
          typescript: { alwaysTryTypes: true },
        },
      },
      rules: {
        ...tier1Rules,
        ...tier2Rules,
        "import/order": importOrderRule,
        "no-console": ["error", { allow: ["error", "warn", "info"] }],
        "import/no-restricted-paths": ["error", { zones: featureBoundaryRestrictions }],
        "no-restricted-imports": "off", // Handled in routes-specific block
        // Import quality rules
        "import/no-cycle": ["error", { maxDepth: 10 }],
        "import/no-duplicates": "error",
        "import/no-self-import": "error",
        "import/no-useless-path-segments": ["warn", { noUselessIndex: true }],
        ...qualityRules,
      },
    },

    // Routes: Additional Prisma restrictions
    {
      files: ["app/routes/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@prisma/client",
                importNames: ["PrismaClient"],
                message: "Routes should not import PrismaClient directly. Use models layer instead.",
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

    // Validation utilities: Allow type assertions for Zod boundaries
    {
      files: ["app/lib/validation/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unsafe-assignment": "warn",
        "@typescript-eslint/no-unsafe-member-access": "warn",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
      },
    },

    // Feature index files: Allow importing from own internals
    {
      files: ["app/features/**/index.{ts,tsx}"],
      rules: {
        "import/no-restricted-paths": "off",
      },
    },

    // Tests: Same strictness as production, but relaxed for testing needs
    {
      files: ["**/*.test.{ts,tsx}", "tests/**/*.{ts,tsx}", "cypress/**/*.ts"],
      ignores: ["tests/e2e/**/*.config.ts"],
      plugins: {
        "@typescript-eslint": tseslintPlugin,
        jest,
        "jest-dom": jestDom,
        "testing-library": testingLibrary,
        import: importPlugin,
        promise,
        ...(cypressPlugin && { cypress: cypressPlugin }),
      },
      languageOptions: {
        parser: tseslintParser,
        parserOptions: {
          project: ["./tsconfig.json", "./tests/e2e/tsconfig.json"],
          tsconfigRootDir: import.meta.dirname,
          isolatedModules: true, // Match tsconfig.json setting
        },
        globals: { ...globals.jest },
      },
      settings: { jest: { version: 28 } },
      rules: {
        ...jest.configs.recommended.rules,
        ...jestDom.configs.recommended.rules,
        ...testingLibrary.configs.react.rules,
        ...(cypressPlugin?.configs?.recommended?.rules || {}),
        ...tier1Rules,
        ...tier2Rules,
        "import/order": importOrderRule,
        "no-console": "off",
        "import/no-restricted-paths": "off",
        "no-restricted-imports": "off",
        "promise/always-return": "off",
        "promise/catch-or-return": "off",
        ...(cypressPlugin && { "cypress/no-unnecessary-waiting": "warn" }),
        "jest/valid-expect": "off",
        "jest/expect-expect": "off",
        // Test quality rules
        "jest/no-focused-tests": "error",
        "jest/no-disabled-tests": "warn",
        "jest/no-standalone-expect": "error",
      },
    },

    // JavaScript tests
    {
      files: ["**/*.test.{js,jsx}", "tests/**/*.{js,jsx}"],
      plugins: {
        "@typescript-eslint": tseslintPlugin,
        jest,
        "jest-dom": jestDom,
        "testing-library": testingLibrary,
        import: importPlugin,
      },
      languageOptions: { globals: { ...globals.jest } },
      settings: { jest: { version: 28 } },
      rules: {
        ...jest.configs.recommended.rules,
        ...jestDom.configs.recommended.rules,
        ...testingLibrary.configs.react.rules,
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "no-console": "off",
        "import/order": "warn",
        "import/no-restricted-paths": "off",
        "no-restricted-imports": "off",
        // Test quality rules
        "jest/no-focused-tests": "error",
        "jest/no-disabled-tests": "warn",
        "jest/no-standalone-expect": "error",
      },
    },

    // Config & script files: Minimal rules (no type-aware parsing)
    {
      files: [
        "**/*.config.{js,ts}",
        "scripts/**",
        "mocks/**",
        "**/seed*.ts",
        "**/*factory*.ts",
        "prisma/**",
        "server.ts",
        "worker.ts",
        "tailwind.config.ts",
        "tests/e2e/**/*.config.ts",
      ],
      plugins: {
        "@typescript-eslint": tseslintPlugin,
        import: importPlugin,
      },
      languageOptions: {
        parser: tseslintParser,
        parserOptions: {},
        globals: { ...globals.node },
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "no-console": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "import/order": "warn",
        "import/no-restricted-paths": "off",
        "no-restricted-imports": "off",
      },
    },

    // Error handlers: Allow console
    {
      files: [
        "app/lib/error-*.{ts,tsx}",
        "app/lib/secrets-sanitizer.server.ts",
        "**/*.example.{ts,tsx}",
      ],
      rules: {
        "no-console": "off",
      },
    },

    prettier,
  ];
})();
