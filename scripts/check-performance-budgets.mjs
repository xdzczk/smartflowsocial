#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  return Object.fromEntries(
    argv
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, value] = arg.slice(2).split("=");
        return [key, value ?? "true"];
      })
  );
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function toMegabytes(bytes) {
  return bytes / (1024 * 1024);
}

function collectFiles(directory, extension) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(extension))
    .map((file) => path.join(directory, file));
}

function ensureWithinBudget(label, actual, limit) {
  if (typeof actual !== "number" || Number.isNaN(actual)) {
    fail(`${label} is missing or invalid`);
  }
  if (actual > limit) {
    fail(`${label}=${actual} exceeded budget ${limit}`);
  }
}

function checkVitestBudgets(config) {
  const resultsPath =
    config.vitest?.resultsPath ?? path.resolve("test-results", "results.json");
  const results = readJsonIfExists(resultsPath);
  if (!results) {
    ok(
      `No vitest JSON results found at ${resultsPath}; skipping budget checks.`
    );
    return;
  }

  const failed = Number(results.numFailedTests ?? 0);
  ensureWithinBudget("vitest.numFailedTests", failed, 0);
  ok("Vitest performance budget check passed.");
}

function checkK6Budgets(config, args) {
  const summariesDir =
    args.dir ??
    config.k6?.summariesDir ??
    path.resolve("tests", "performance", "results");
  const summaryFiles = collectFiles(summariesDir, ".json").filter((file) =>
    file.includes("summary")
  );

  if (summaryFiles.length === 0) {
    fail(`No k6 summary files found in ${summariesDir}`);
  }

  for (const summaryFile of summaryFiles) {
    const summary = readJsonIfExists(summaryFile);
    if (!summary) continue;
    const metric = summary.metrics ?? {};
    const reqDuration = metric.http_req_duration?.values ?? {};
    const reqFailed = metric.http_req_failed?.values ?? {};

    const globalBudget = config.k6?.global ?? {};
    ensureWithinBudget(
      `${path.basename(summaryFile)} p95`,
      Number(reqDuration["p(95)"]),
      Number(globalBudget.maxP95Ms ?? 2000)
    );
    ensureWithinBudget(
      `${path.basename(summaryFile)} p99`,
      Number(reqDuration["p(99)"]),
      Number(globalBudget.maxP99Ms ?? 5000)
    );
    ensureWithinBudget(
      `${path.basename(summaryFile)} errorRate`,
      Number(reqFailed.rate),
      Number(globalBudget.maxErrorRate ?? 0.01)
    );
  }

  ok(
    `k6 performance budget check passed for ${summaryFiles.length} summary files.`
  );
}

function checkBundleBudgets(config) {
  const buildDir = config.bundle?.directory ?? path.resolve("public", "build");
  if (!fs.existsSync(buildDir)) {
    fail(`Build directory does not exist: ${buildDir}`);
  }

  const files = fs.readdirSync(buildDir);
  const jsFiles = files.filter((file) => file.endsWith(".js"));
  const cssFiles = files.filter((file) => file.endsWith(".css"));

  const jsSizes = jsFiles.map(
    (file) => fs.statSync(path.join(buildDir, file)).size
  );
  const cssSizes = cssFiles.map(
    (file) => fs.statSync(path.join(buildDir, file)).size
  );

  const totalJsMb = toMegabytes(jsSizes.reduce((acc, value) => acc + value, 0));
  const totalCssMb = toMegabytes(
    cssSizes.reduce((acc, value) => acc + value, 0)
  );
  const largestJsKb = Math.max(...jsSizes, 0) / 1024;

  const budgets = config.bundle ?? {};
  ensureWithinBudget(
    "bundle.totalJsMb",
    totalJsMb,
    Number(budgets.maxTotalJsMb ?? 2.5)
  );
  ensureWithinBudget(
    "bundle.totalCssMb",
    totalCssMb,
    Number(budgets.maxTotalCssMb ?? 0.6)
  );
  ensureWithinBudget(
    "bundle.largestJsChunkKb",
    largestJsKb,
    Number(budgets.maxLargestJsChunkKb ?? 350)
  );

  ok(
    `Bundle budgets passed (JS ${totalJsMb.toFixed(2)}MB, CSS ${totalCssMb.toFixed(
      2
    )}MB, largest JS ${largestJsKb.toFixed(1)}KB).`
  );
}

const args = parseArgs(process.argv.slice(2));
const source = args.source ?? "vitest";
const configPath =
  args.config ??
  path.resolve("tests", "performance", "performance-budgets.json");
const config = readJsonIfExists(configPath);

if (!config) {
  fail(`Missing performance budget config at ${configPath}`);
}

if (source === "vitest") {
  checkVitestBudgets(config);
} else if (source === "k6") {
  checkK6Budgets(config, args);
} else if (source === "bundle") {
  checkBundleBudgets(config);
} else {
  fail(`Unknown source "${source}". Use vitest, k6, or bundle.`);
}
