export const SPEECH_MEDIA_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/mp4",
  "audio/mpeg",
] as const;

export type SpeechMediaType = (typeof SPEECH_MEDIA_TYPES)[number];

export interface SpeechAudio {
  bytes: Uint8Array;
  mediaType: SpeechMediaType;
}

export interface SpeechTranscript {
  text: string;
  provider: string;
  model: string;
  durationMs: number | null;
  latencyMs: number;
  costMicros: bigint;
}

export interface SpeechToTextProvider {
  transcribe(audio: SpeechAudio): Promise<SpeechTranscript>;
}

const SPEECH_FAILURE_CATEGORY =
  /^(timeout|unavailable|authentication|rate_limit|provider_http_error|empty_provider_response|malformed_json|schema_rejection|unknown)$/;
const SPEECH_ISSUE_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_SPEECH_SCHEMA_ISSUES = 8;

export interface SpeechSchemaIssue {
  path: string;
  code: string;
}

export interface SpeechFailureDetails {
  failureCategory?: string | null;
  httpStatus?: number | null;
  schemaIssues?: readonly SpeechSchemaIssue[];
}

export class SpeechUnavailableError extends Error {
  readonly code = "SPEECH_UNAVAILABLE";
  readonly failureCategory: string | null;
  readonly httpStatus: number | null;
  readonly schemaIssues: readonly SpeechSchemaIssue[];

  constructor(details: SpeechFailureDetails = {}) {
    super("Speech transcription is temporarily unavailable.");
    this.name = "SpeechUnavailableError";
    const category = details.failureCategory ?? null;
    this.failureCategory =
      category !== null && SPEECH_FAILURE_CATEGORY.test(category) ? category : null;
    const status = details.httpStatus ?? null;
    this.httpStatus =
      typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
        ? status
        : null;
    this.schemaIssues = sanitizeSpeechIssues(details.schemaIssues ?? []);
  }
}

function sanitizeSpeechIssues(issues: readonly SpeechSchemaIssue[]): SpeechSchemaIssue[] {
  const accepted: SpeechSchemaIssue[] = [];
  for (const issue of issues) {
    if (accepted.length >= MAX_SPEECH_SCHEMA_ISSUES || !SPEECH_ISSUE_TOKEN.test(issue.code)) {
      continue;
    }
    const parts = issue.path.length === 0 ? [] : issue.path.split(".");
    if (parts.some((part) => !SPEECH_ISSUE_TOKEN.test(part))) {
      continue;
    }
    accepted.push({ path: parts.join("."), code: issue.code });
  }
  return accepted;
}

export class DisabledSpeechToTextProvider implements SpeechToTextProvider {
  async transcribe(_audio: SpeechAudio): Promise<SpeechTranscript> {
    throw new SpeechUnavailableError();
  }
}

export class FakeSpeechToTextProvider implements SpeechToTextProvider {
  calls = 0;
  failure: "none" | "unavailable" = "none";
  thrown: SpeechUnavailableError | null = null;
  transcript = "Semantik element header və footer kimi teqlərlə səhifənin mənasını bildirir.";

  async transcribe(audio: SpeechAudio): Promise<SpeechTranscript> {
    this.calls += 1;
    if (this.thrown !== null) {
      throw this.thrown;
    }
    if (this.failure === "unavailable") {
      throw new SpeechUnavailableError();
    }
    const embedded = embeddedTranscript(audio.bytes);
    return {
      text: embedded ?? this.transcript,
      provider: "fake",
      model: "fake-stt",
      durationMs: 1_000,
      latencyMs: 1,
      costMicros: 0n,
    };
  }
}

function embeddedTranscript(bytes: Uint8Array): string | null {
  const text = Buffer.from(bytes).toString("utf8");
  const marker = "TRANSCRIPT:";
  const index = text.indexOf(marker);
  if (index < 0) {
    return null;
  }
  return text.slice(index + marker.length).replace(/\0/g, "");
}
