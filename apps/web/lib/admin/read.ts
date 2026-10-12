function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export function readList(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

export function metrics(pairs: Array<[string, unknown]>): Array<{ label: string; value: string }> {
  return pairs.map(([label, value]) => ({ label, value: display(value) }));
}

export function display(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "bəli" : "xeyr";
  }
  return "—";
}
