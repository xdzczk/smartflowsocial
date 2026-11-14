/**
 * Refuses to point k6 at production unless the operator opts in.
 * Prints the host only, never credentials.
 */
const raw = process.env.BASE_URL ?? "";
const allowProduction = process.env.ALLOW_PRODUCTION_LOAD_TEST === "true";

if (!raw) {
  console.error(
    "BASE_URL is empty. Set STAGING_URL or start the local load-test fixture."
  );
  process.exit(1);
}

let url;
try {
  url = new URL(raw);
} catch {
  console.error("BASE_URL is not a valid URL.");
  process.exit(1);
}

const host = url.hostname.toLowerCase();
const productionHosts = new Set([
  "smartflow.social",
  "www.smartflow.social",
  "app.smartflow.social",
]);

if (productionHosts.has(host) && !allowProduction) {
  console.error(
    `Refusing to load-test ${host}. Set ALLOW_PRODUCTION_LOAD_TEST=true only for an approved drill.`
  );
  process.exit(1);
}

console.log(`Load-test target host: ${host}`);
