import type { NodeEnv } from "@platform/config";

export function readCookie(header: string | undefined, name: string): string | null {
  if (header === undefined || header.length === 0) {
    return null;
  }
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const cookieName = part.slice(0, separator).trim();
    if (cookieName !== name) {
      continue;
    }
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export function developmentSecretHeader(
  nodeEnv: NodeEnv,
  name: string,
  token: string | null,
): [string, string] | null {
  if (nodeEnv === "production" || token === null || token.length === 0) {
    return null;
  }
  return [name, token];
}
