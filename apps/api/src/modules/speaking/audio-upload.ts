import { SPEAKING_TRANSCRIPT_MAX } from "@platform/curriculum";
import { AudioValidationError, inspectAudio, type AudioMediaType } from "@platform/validation";

const MAX_BODY_BYTES = 8 * 1024 * 1024 + 64 * 1024;

export interface ParsedSpeakingUpload {
  clientAttemptId: string;
  text: string | null;
  audio: { bytes: Uint8Array; mediaType: AudioMediaType; durationMs: number | null } | null;
}

export class UploadValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "UploadValidationError";
  }
}

export function parseSpeakingUpload(contentType: string, body: Buffer): ParsedSpeakingUpload {
  if (body.byteLength > MAX_BODY_BYTES) {
    throw new UploadValidationError("AUDIO_TOO_LARGE");
  }
  const boundary = /boundary="?([^";]+)"?/i.exec(contentType)?.[1];
  if (boundary === undefined || boundary.length === 0 || boundary.length > 120) {
    throw new UploadValidationError("AUDIO_MALFORMED");
  }
  const parts = splitParts(body, boundary);
  const fields = new Map<string, string>();
  let audio: ParsedSpeakingUpload["audio"] = null;
  for (const part of parts) {
    if (part.name === "audio") {
      if (audio !== null) {
        throw new UploadValidationError("AUDIO_MALFORMED");
      }
      try {
        const inspected = inspectAudio({
          bytes: part.body,
          declaredType: part.type ?? "",
          declaredDurationMs: null,
          filename: part.filename,
        });
        audio = {
          bytes: part.body,
          mediaType: inspected.mediaType,
          durationMs: inspected.durationMs,
        };
      } catch (error) {
        if (error instanceof AudioValidationError) {
          throw new UploadValidationError(error.code);
        }
        throw error;
      }
      continue;
    }
    if (part.filename !== null) {
      throw new UploadValidationError("AUDIO_MALFORMED");
    }
    if (fields.has(part.name)) {
      throw new UploadValidationError("VALIDATION");
    }
    fields.set(part.name, part.body.toString("utf8"));
  }
  const allowed = new Set(["clientAttemptId", "text", "durationMs"]);
  for (const name of fields.keys()) {
    if (!allowed.has(name)) {
      throw new UploadValidationError("VALIDATION");
    }
  }
  const clientAttemptId = fields.get("clientAttemptId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientAttemptId)) {
    throw new UploadValidationError("VALIDATION");
  }
  const durationRaw = fields.get("durationMs");
  if (durationRaw !== undefined) {
    const duration = Number(durationRaw);
    if (!Number.isInteger(duration) || duration < 0 || duration > 60_000) {
      throw new UploadValidationError("AUDIO_TOO_LONG");
    }
  }
  const text = fields.get("text") ?? null;
  if (
    text !== null &&
    (text.length === 0 || text.length > SPEAKING_TRANSCRIPT_MAX || text.includes("\0"))
  ) {
    throw new UploadValidationError("VALIDATION");
  }
  if ((text === null) === (audio === null)) {
    throw new UploadValidationError("VALIDATION");
  }
  return { clientAttemptId, text, audio };
}

interface Part {
  name: string;
  filename: string | null;
  type: string | null;
  body: Buffer;
}

function splitParts(body: Buffer, boundary: string): Part[] {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts: Part[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf(delimiter, cursor);
    if (start < 0) {
      break;
    }
    const after = start + delimiter.length;
    if (body.subarray(after, after + 2).toString() === "--") {
      break;
    }
    const next = body.indexOf(delimiter, after);
    const chunkEnd = next < 0 ? body.length : next;
    const chunk = body.subarray(after, chunkEnd);
    const headerEnd = chunk.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      throw new UploadValidationError("AUDIO_MALFORMED");
    }
    const headers = chunk.subarray(0, headerEnd).toString("utf8");
    let content = chunk.subarray(headerEnd + 4);
    if (content.subarray(content.length - 2).toString() === "\r\n") {
      content = content.subarray(0, content.length - 2);
    }
    const name = /name="([^"]+)"/.exec(headers)?.[1];
    if (name === undefined || name.length === 0 || name.length > 40) {
      throw new UploadValidationError("AUDIO_MALFORMED");
    }
    const filename = /filename="([^"]*)"/.exec(headers)?.[1] ?? null;
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? null;
    parts.push({ name, filename, type, body: Buffer.from(content) });
    cursor = next < 0 ? body.length : next;
  }
  if (parts.length === 0 || parts.length > 4) {
    throw new UploadValidationError("AUDIO_MALFORMED");
  }
  return parts;
}
