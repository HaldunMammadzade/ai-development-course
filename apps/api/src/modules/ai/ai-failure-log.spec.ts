import { describe, expect, it } from "vitest";
import {
  AIProviderError,
  AiConfigurationError,
  AiTaskUnavailableError,
  SpeechUnavailableError,
} from "@platform/ai";
import { aiFailureLogSuffix } from "./ai-failure-log";

describe("AI failure log suffix", () => {
  it("keeps an adapter category, HTTP status, and sanitized schema issue", () => {
    const error = new AIProviderError("invalid_response", {
      failureCategory: "provider_http_error",
      httpStatus: 400,
      schemaIssues: [
        { path: "suggestedState", code: "invalid_value" },
        { path: "speech secret", code: "invalid_value" },
      ],
    });

    const line = aiFailureLogSuffix(error);

    expect(line).toBe(
      "category=provider_http_error http_status=400 schema_issues=suggestedState:invalid_value",
    );
    expect(line).not.toContain("speech secret");
    expect(line).not.toContain("invalid response");
  });

  it("uses the provider code when the adapter did not set a category", () => {
    expect(aiFailureLogSuffix(new AIProviderError("timeout"))).toBe(
      "category=timeout http_status=null",
    );
    expect(
      aiFailureLogSuffix(
        new AIProviderError("malformed_json", { failureCategory: "malformed_json" }),
      ),
    ).toBe("category=malformed_json http_status=null");
    expect(
      aiFailureLogSuffix(
        new AIProviderError("invalid_response", { failureCategory: "empty_provider_response" }),
      ),
    ).toBe("category=empty_provider_response http_status=null");
  });

  it("leaves a module validation error without an HTTP status or schema issue", () => {
    const line = aiFailureLogSuffix(new AIProviderError("invalid_response"));

    expect(line).toBe("category=invalid_response http_status=null");
    expect(line).not.toContain("schema_issues");
  });

  it("keeps a speech category and status out of the public message", () => {
    expect(aiFailureLogSuffix(new SpeechUnavailableError({ failureCategory: "timeout" }))).toBe(
      "category=timeout http_status=null",
    );
    expect(
      aiFailureLogSuffix(
        new SpeechUnavailableError({ failureCategory: "rate_limit", httpStatus: 429 }),
      ),
    ).toBe("category=rate_limit http_status=429");
    expect(
      aiFailureLogSuffix(
        new SpeechUnavailableError({
          failureCategory: "schema_rejection",
          schemaIssues: [
            { path: "text", code: "invalid_type" },
            { path: "secret transcript", code: "invalid_type" },
          ],
        }),
      ),
    ).toBe("category=schema_rejection http_status=null schema_issues=text:invalid_type");
    const unknown = aiFailureLogSuffix(new SpeechUnavailableError());
    expect(unknown).toBe("category=unknown http_status=null");
    expect(unknown).not.toContain("schema_issues");
    expect(unknown).not.toContain("temporarily unavailable");
  });

  it("names configuration and unavailable tasks without their messages", () => {
    expect(aiFailureLogSuffix(new AiConfigurationError("code_review"))).toBe(
      "category=configuration http_status=null",
    );
    expect(aiFailureLogSuffix(new AiTaskUnavailableError())).toBe(
      "category=task_unavailable http_status=null",
    );
    expect(aiFailureLogSuffix(new Error("sk-secret prompt"))).toBe(
      "category=unknown http_status=null",
    );
    expect(aiFailureLogSuffix(new Error("sk-secret prompt"))).not.toContain("sk-secret");
  });
});
