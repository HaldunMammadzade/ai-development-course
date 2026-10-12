import { describe, expect, it } from "vitest";
import {
  AUDIO_MAX_BYTES,
  AUDIO_UNPROVEN_MAX_BYTES,
  AudioValidationError,
  inspectAudio,
} from "./audio";

describe("inspectAudio", () => {
  it("accepts a short wav and records its duration", () => {
    const wav = wavWithPayload(8_000);
    const inspected = inspectAudio({
      bytes: wav,
      declaredType: "audio/wav",
      declaredDurationMs: 1_000,
      filename: "answer.wav",
    });
    expect(inspected.mediaType).toBe("audio/wav");
    expect(inspected.durationMs).toBe(1_000);
  });

  it("rejects an empty file, a bad type, a long duration, and a traversal name", () => {
    expect(() =>
      inspectAudio({
        bytes: new Uint8Array(),
        declaredType: "audio/wav",
        declaredDurationMs: null,
        filename: null,
      }),
    ).toThrow(AudioValidationError);
    expect(() =>
      inspectAudio({
        bytes: wavWithPayload(800),
        declaredType: "text/plain",
        declaredDurationMs: null,
        filename: "answer.wav",
      }),
    ).toThrow(/AUDIO_TYPE/);
    expect(() =>
      inspectAudio({
        bytes: wavWithPayload(800),
        declaredType: "audio/wav",
        declaredDurationMs: 120_000,
        filename: "answer.wav",
      }),
    ).toThrow(/AUDIO_TOO_LONG/);
    expect(() =>
      inspectAudio({
        bytes: wavWithPayload(800),
        declaredType: "audio/wav",
        declaredDurationMs: null,
        filename: "../../etc/passwd.wav",
      }),
    ).toThrow(/AUDIO_FILENAME/);
    expect(() =>
      inspectAudio({
        bytes: wavWithPayload(800),
        declaredType: "audio/wav",
        declaredDurationMs: null,
        filename: "answer.exe",
      }),
    ).toThrow(/AUDIO_FILENAME/);
  });

  it("rejects an unproven recording that cannot fit in one minute", () => {
    const webm = new Uint8Array(AUDIO_UNPROVEN_MAX_BYTES + 1);
    webm[0] = 0x1a;
    webm[1] = 0x45;
    webm[2] = 0xdf;
    webm[3] = 0xa3;
    expect(() =>
      inspectAudio({
        bytes: webm,
        declaredType: "audio/webm",
        declaredDurationMs: null,
        filename: "answer.webm",
      }),
    ).toThrow(/AUDIO_TOO_LONG/);
    expect(AUDIO_MAX_BYTES).toBeGreaterThan(AUDIO_UNPROVEN_MAX_BYTES);
  });
});

function wavWithPayload(dataSize: number): Uint8Array {
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  write(bytes, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(bytes, 8, "WAVE");
  write(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8_000, true);
  view.setUint32(28, 8_000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  write(bytes, 36, "data");
  view.setUint32(40, dataSize, true);
  return bytes;
}

function write(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}
