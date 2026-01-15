module.exports = {
  plugins: {
    "@tailwindcss/postcss": {
      // Explicitly specify the config file to ensure content paths and safelist are used
      // This is critical for Docker builds where automatic content detection may fail
      config: "./tailwind.config.ts",
    },
    // Process CSS nesting to resolve & references
    "postcss-nesting": {},
    autoprefixer: {},
  },
};
