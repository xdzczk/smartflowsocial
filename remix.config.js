/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  cacheDirectory: "./node_modules/.cache/remix",
  ignoredRouteFiles: [
    "**/.*",
    "**/*.test.{ts,tsx}",
    "**/*.server.ts",
    "**/*.server.tsx",
  ],
  serverModuleFormat: "cjs",
  tailwind: true,
  postcss: true,
  future: {
    // Remix v2 future flags
    v2_errorBoundary: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
  browserNodeBuiltinsPolyfill: {
    modules: {
      util: true,
      punycode: true,
      querystring: true,
      events: true,
    },
  },
};
