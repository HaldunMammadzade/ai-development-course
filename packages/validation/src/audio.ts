export const AUDIO_MAX_BYTES = 8 * 1024 * 1024;
export const AUDIO_MAX_MS = 60_000;
export const AUDIO_UNPROVEN_MAX_BYTES = 2_000_000;

export const AUDIO_MEDIA_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/mp4",
  "audio/mpeg",
] as const;

export type AudioMediaType = (typeof AUDIO_MEDIA_TYPES)[number];

export class AudioValidationError extends Error {
  constructor(
    readonly code:
      | "AUDIO_TOO_LARGE"
      | "AUDIO_TOO_LONG"
      | "AUDIO_EMPTY"
      | "AUDIO_TYPE"
      | "AUDIO_MALFORMED"
      | "AUDIO_FILENAME",
  ) {
    super(code);
    this.name = "AudioValidationError";
  }
}

const EXTENSIONS = new Set(["webm", "ogg", "wav", "m4a", "mp4", "mp3", "mpeg"]);

export function inspectAudio(input: {
  bytes: Uint8Array;
  declaredType: string;
  declaredDurationMs: number | null;
  filename: string | null;
}): { mediaType: AudioMediaType; durationMs: number | null } {
  if (input.bytes.byteLength === 0) {
    throw new AudioValidationError("AUDIO_EMPTY");
  }
  if (input.bytes.byteLength > AUDIO_MAX_BYTES) {
    throw new AudioValidationError("AUDIO_TOO_LARGE");
  }
  assertFilename(input.filename);
  if (
    input.declaredDurationMs !== null &&
    (!Number.isInteger(input.declaredDurationMs) ||
      input.declaredDurationMs < 0 ||
      input.declaredDurationMs > AUDIO_MAX_MS)
  ) {
    throw new AudioValidationError("AUDIO_TOO_LONG");
  }
  const detected = detectMedia(input.bytes);
  const declared = normalizeType(input.declaredType);
  if (detected === null || declared === null || detected !== declared) {
    throw new AudioValidationError("AUDIO_TYPE");
  }
  const durationMs = detected === "audio/wav" ? wavDurationMs(input.bytes) : null;
  if (detected === "audio/wav" && (durationMs === null || durationMs === 0)) {
    throw new AudioValidationError(durationMs === 0 ? "AUDIO_EMPTY" : "AUDIO_MALFORMED");
  }
  if (durationMs !== null && durationMs > AUDIO_MAX_MS) {
    throw new AudioValidationError("AUDIO_TOO_LONG");
  }
  if (durationMs === null && input.bytes.byteLength > AUDIO_UNPROVEN_MAX_BYTES) {
    throw new AudioValidationError("AUDIO_TOO_LONG");
  }
  return { mediaType: detected, durationMs };
}

function assertFilename(filename: string | null): void {
  if (filename === null || filename.length === 0) {
    return;
  }
  if (filename.length > 120 || filename.includes("\0") || /[/\\]|\.\./.test(filename)) {
    throw new AudioValidationError("AUDIO_FILENAME");
  }
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".") + 1) : "";
  if (!EXTENSIONS.has(extension.toLowerCase())) {
    throw new AudioValidationError("AUDIO_FILENAME");
  }
}

function normalizeType(value: string): AudioMediaType | null {
  const base = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return AUDIO_MEDIA_TYPES.find((type) => type === base) ?? null;
}

function detectMedia(bytes: Uint8Array): AudioMediaType | null {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE") {
    return "audio/wav";
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") {
    return "audio/ogg";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "audio/webm";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    return "audio/mp4";
  }
  const first = bytes[0];
  const second = bytes[1];
  const third = bytes[2];
  if (
    (bytes.length >= 3 && first === 0x49 && second === 0x44 && third === 0x33) ||
    (bytes.length >= 2 && first === 0xff && second !== undefined && (second & 0xe0) === 0xe0)
  ) {
    return "audio/mpeg";
  }
  return null;
}

function wavDurationMs(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let byteRate = 0;
  let dataSize = -1;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, offset + 4);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt " && offset + 16 <= bytes.length) {
      byteRate = view.getUint32(offset + 16, true);
    }
    if (id === "data") {
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataSize === 0) {
    return 0;
  }
  if (byteRate <= 0 || dataSize < 0) {
    return null;
  }
  return Math.round((dataSize / byteRate) * 1000);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}
