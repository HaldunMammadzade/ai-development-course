import { providerErrorCode } from "../provider/errors";
import {
  SpeechUnavailableError,
  type SpeechAudio,
  type SpeechToTextProvider,
  type SpeechTranscript,
} from "./speech-to-text";

export interface HttpSpeechConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
}

const TIMEOUT_MS = 20_000;

export class HttpSpeechToTextProvider implements SpeechToTextProvider {
  constructor(private readonly config: HttpSpeechConfig) {}

  async transcribe(audio: SpeechAudio): Promise<SpeechTranscript> {
    const started = Date.now();
    const boundary = `speaking-${crypto.randomUUID()}`;
    const body = multipart(boundary, this.config.model, audio);
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs ?? TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeout(error)) {
        throw new SpeechUnavailableError({ failureCategory: "timeout" });
      }
      throw new SpeechUnavailableError({ failureCategory: "unavailable" });
    }
    if (!response.ok) {
      throw speechHttpFailure(response.status);
    }
    const payload = await readPayload(response);
    const text = readText(payload);
    if (text === null) {
      throw new SpeechUnavailableError({
        failureCategory: "schema_rejection",
        schemaIssues: [{ path: "text", code: "invalid_type" }],
      });
    }
    return {
      text,
      provider: this.config.provider,
      model: this.config.model,
      durationMs: null,
      latencyMs: Date.now() - started,
      costMicros: 0n,
    };
  }
}

function speechHttpFailure(status: number): SpeechUnavailableError {
  const code = providerErrorCode(status, "");
  if (code === "authentication" || code === "rate_limit" || code === "unavailable") {
    return new SpeechUnavailableError({ failureCategory: code, httpStatus: status });
  }
  if (code === "invalid_response" || code === "timeout") {
    return new SpeechUnavailableError({
      failureCategory: "provider_http_error",
      httpStatus: status,
    });
  }
  return new SpeechUnavailableError({ failureCategory: "unknown", httpStatus: status });
}

async function readPayload(response: Response): Promise<unknown> {
  let bodyText: string;
  try {
    bodyText = await response.text();
  } catch {
    throw new SpeechUnavailableError({ failureCategory: "unavailable" });
  }
  if (bodyText.trim().length === 0) {
    throw new SpeechUnavailableError({ failureCategory: "empty_provider_response" });
  }
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new SpeechUnavailableError({ failureCategory: "malformed_json" });
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function readText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("text" in payload)) {
    return null;
  }
  const text = payload.text;
  return typeof text === "string" ? text : null;
}

function multipart(boundary: string, model: string, audio: SpeechAudio): Uint8Array {
  const extension = audio.mediaType.split("/")[1] ?? "bin";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="answer.${extension}"\r\n` +
      `Content-Type: ${audio.mediaType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, Buffer.from(audio.bytes), tail]);
}
