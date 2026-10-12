import { createContext, runInContext } from "node:vm";
import { readFileSync } from "node:fs";

const raw = readFileSync(0, "utf8");
let request;
try {
  request = JSON.parse(raw);
} catch {
  finish({ status: "runtime_error", tests: [] });
}

if (typeof request.source !== "string" || request.source.length > 4000) {
  finish({ status: "runtime_error", tests: [] });
}

const context = createContext({});
try {
  runInContext(
    [
      "Date = function Date() { throw new Error('time'); };",
      "Date.now = function now() { throw new Error('time'); };",
      "Math.random = function random() { throw new Error('random'); };",
      "console.log = function() {};",
      "console.info = function() {};",
      "console.warn = function() {};",
      "console.error = function() {};",
      "console.debug = function() {};",
    ].join("\n"),
    context,
    { timeout: 200 },
  );
  runInContext(request.source, context, {
    timeout: Math.max(100, Number(request.timeoutMs) - 200),
  });
} catch (error) {
  finish({
    status: classify(error),
    tests: [],
  });
}

const fn = context[request.entry];
if (typeof fn !== "function") {
  finish({ status: "runtime_error", tests: [] });
}

const tests = [];
let thrown = 0;
for (const test of Array.isArray(request.tests) ? request.tests : []) {
  try {
    const actual = fn(...(Array.isArray(test.args) ? test.args : []));
    tests.push({ id: String(test.id), passed: same(actual, test.expected) });
  } catch (error) {
    thrown += 1;
    if (classify(error) === "timeout") {
      finish({ status: "timeout", tests: [] });
    }
    tests.push({ id: String(test.id), passed: false });
  }
}

if (tests.length > 0 && thrown === tests.length) {
  finish({ status: "runtime_error", tests: [] });
}

finish({ status: "completed", tests });

function classify(error) {
  if (error !== null && typeof error === "object" && "code" in error) {
    if (error.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
      return "timeout";
    }
  }
  // SyntaxError from the vm realm fails `instanceof` in the harness realm.
  if (
    error instanceof SyntaxError ||
    (error !== null && typeof error === "object" && "name" in error && error.name === "SyntaxError")
  ) {
    return "syntax_error";
  }
  return "runtime_error";
}

function same(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function finish(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}
