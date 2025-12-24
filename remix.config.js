/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  cacheDirectory: "./node_modules/.cache/remix",
  ignoredRouteFiles: ["**/.*", "**/*.test.{ts,tsx}"],
  serverModuleFormat: "cjs",
  tailwind: true,
  postcss: true,
  browserNodeBuiltinsPolyfill: {
    modules: {
      util: true,
      punycode: true,
      querystring: true,
      events: true,
    },
  },
};
