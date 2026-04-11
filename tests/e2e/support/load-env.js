// This file MUST be loaded first to set environment variables
// before any other modules that depend on them (like PrismaClient)
// Using .js extension ensures require() works correctly

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Try multiple locations for .env file
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../../.env"),
  path.resolve(__dirname, "../../../../.env"),
  ".env",
];

let envFileLoaded = false;
let loadedEnvPath = null;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath, override: true });
    if (!result.error) {
      envFileLoaded = true;
      loadedEnvPath = envPath;
      // Ensure the parsed values are actually in process.env
      if (result.parsed) {
        for (const [key, value] of Object.entries(result.parsed)) {
          if (value) {
            process.env[key] = value;
          }
        }
      }
      break;
    }
  }
}

// In CI we often inject env vars via workflow/job env and do not commit a .env file.
if (!process.env["DATABASE_URL"] && process.env["TEST_DATABASE_URL"]) {
  process.env["DATABASE_URL"] = process.env["TEST_DATABASE_URL"];
}

if (!envFileLoaded) {
  // Do not fail just because .env is missing when required vars are already present.
  const hasInjectedDatabaseUrl =
    typeof process.env["DATABASE_URL"] === "string" &&
    process.env["DATABASE_URL"].trim() !== "";
  if (!hasInjectedDatabaseUrl) {
    console.error("Error: Could not find .env file in any of these locations:");
    envPaths.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
}

// Verify critical env vars are loaded
if (!process.env["DATABASE_URL"]) {
  console.error(
    `Error: DATABASE_URL not found in .env file at ${loadedEnvPath}`
  );
  process.exit(1);
}

// Environment variables are now loaded in process.env
// This file is loaded for its side effects
