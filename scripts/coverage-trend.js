#!/usr/bin/env node
/**
 * Coverage trend tracking script
 * Tracks coverage over time and generates trend reports
 */

const fs = require("fs");
const path = require("path");

const COVERAGE_DIR = path.join(__dirname, "../coverage");
const TREND_FILE = path.join(__dirname, "../coverage/.coverage-trend.json");

function loadTrendData() {
  if (fs.existsSync(TREND_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TREND_FILE, "utf8"));
    } catch (error) {
      console.error("Error loading trend data:", error);
      return { history: [] };
    }
  }
  return { history: [] };
}

function saveTrendData(data) {
  const trendDir = path.dirname(TREND_FILE);
  if (!fs.existsSync(trendDir)) {
    fs.mkdirSync(trendDir, { recursive: true });
  }
  fs.writeFileSync(TREND_FILE, JSON.stringify(data, null, 2));
}

function getCurrentCoverage() {
  const summaryFile = path.join(COVERAGE_DIR, "coverage-summary.json");
  if (!fs.existsSync(summaryFile)) {
    console.error(
      "Coverage summary not found. Run 'npm run test:coverage' first."
    );
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
  return {
    lines: summary.total.lines.pct,
    functions: summary.total.functions.pct,
    branches: summary.total.branches.pct,
    statements: summary.total.statements.pct,
  };
}

function generateTrendReport(trendData) {
  const history = trendData.history || [];
  if (history.length === 0) {
    console.log("No coverage history available yet.");
    return;
  }

  console.log("\n📈 Coverage Trend Report");
  console.log("=".repeat(50));
  console.log(`Total snapshots: ${history.length}`);
  console.log("");

  // Show last 5 entries
  const recent = history.slice(-5);
  console.log("Recent coverage:");
  recent.forEach((entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString();
    console.log(
      `  ${date}: Lines ${entry.coverage.lines.toFixed(2)}% | Functions ${entry.coverage.functions.toFixed(2)}% | Branches ${entry.coverage.branches.toFixed(2)}% | Statements ${entry.coverage.statements.toFixed(2)}%`
    );
  });

  // Calculate trend
  if (history.length >= 2) {
    const latest = history[history.length - 1];
    const previous = history[history.length - 2];
    const diff = {
      lines: latest.coverage.lines - previous.coverage.lines,
      functions: latest.coverage.functions - previous.coverage.functions,
      branches: latest.coverage.branches - previous.coverage.branches,
      statements: latest.coverage.statements - previous.coverage.statements,
    };

    console.log("");
    console.log("Trend (vs previous snapshot):");
    Object.entries(diff).forEach(([metric, change]) => {
      const symbol = change >= 0 ? "📈" : "📉";
      const sign = change >= 0 ? "+" : "";
      console.log(`  ${symbol} ${metric}: ${sign}${change.toFixed(2)}%`);
    });
  }
}

function main() {
  const command = process.argv[2];

  if (command === "record") {
    // Record current coverage
    const coverage = getCurrentCoverage();
    const trendData = loadTrendData();
    const history = trendData.history || [];

    history.push({
      timestamp: new Date().toISOString(),
      coverage,
    });

    // Keep only last 100 entries
    if (history.length > 100) {
      trendData.history = history.slice(-100);
    } else {
      trendData.history = history;
    }

    saveTrendData(trendData);
    console.log("✅ Coverage snapshot recorded");
    console.log(`   Lines: ${coverage.lines.toFixed(2)}%`);
    console.log(`   Functions: ${coverage.functions.toFixed(2)}%`);
    console.log(`   Branches: ${coverage.branches.toFixed(2)}%`);
    console.log(`   Statements: ${coverage.statements.toFixed(2)}%`);
  } else if (command === "report") {
    // Show trend report
    const trendData = loadTrendData();
    generateTrendReport(trendData);
  } else {
    console.log("Usage:");
    console.log(
      "  node scripts/coverage-trend.js record  - Record current coverage"
    );
    console.log("  node scripts/coverage-trend.js report  - Show trend report");
    process.exit(1);
  }
}

main();
