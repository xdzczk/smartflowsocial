/**
 * Minimal logger for scripts.
 *
 * - Avoids `console.*` to comply with app logging standards.
 * - Uses stdout/stderr directly.
 */

function formatArgs(args) {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

function writeStdout(...args) {
  process.stdout.write(`${formatArgs(args)}\n`);
}

function writeStderr(...args) {
  process.stderr.write(`${formatArgs(args)}\n`);
}

module.exports = {
  log: writeStdout,
  info: writeStdout,
  warn: writeStderr,
  error: writeStderr,
};
