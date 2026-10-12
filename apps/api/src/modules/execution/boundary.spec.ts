import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

describe("API execution boundary", () => {
  it("does not give student source a host execution primitive", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, "src"))) {
      if (file.endsWith(".spec.ts")) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      for (const pattern of [
        "child_process",
        "execFile",
        "spawn(",
        "fork(",
        "eval(",
        "new Function",
        "node:vm",
        'from "vm"',
        "WebAssembly",
        "docker.sock",
        "dangerouslySetInnerHTML",
      ]) {
        if (text.includes(pattern)) {
          violations.push(`${path.relative(ROOT, file)} contains ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (full.endsWith(".ts")) {
      found.push(full);
    }
  }
  return found;
}
