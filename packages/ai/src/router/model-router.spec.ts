import { describe, expect, it } from "vitest";
import { FakeAiProvider } from "../provider/fake-ai-provider";
import { estimateCostMicros } from "../usage";
import {
  AiConfigurationError,
  AiTaskUnavailableError,
  UnknownAiTaskError,
  completeTeach,
  createModelRouter,
} from "./model-router";

const configured = {
  provider: "openai-compatible",
  model: "teach-model",
  maxInputChars: 1000,
  maxOutputTokens: 400,
};

describe("model router", () => {
  it("maps teach to the configured provider and model", () => {
    const route = createModelRouter(configured).resolve("teach");
    expect(route).toMatchObject({
      task: "teach",
      provider: "openai-compatible",
      model: "teach-model",
      maxOutputTokens: 400,
      temperature: 0.2,
      strength: "fast",
    });
    expect(JSON.stringify(route)).not.toContain("apiKey");
  });

  it("keeps teach fast unless the route is explicitly strong", () => {
    expect(createModelRouter({ ...configured, strength: "strong" }).resolve("teach").strength).toBe(
      "strong",
    );
  });

  it("fails safely when the teach model is not configured", () => {
    expect(() => createModelRouter(null).resolve("teach")).toThrow(AiConfigurationError);
    expect(() => createModelRouter(null).resolve("teach")).toThrow(/not configured/);
  });

  it("routes code review independently of teach", () => {
    const router = createModelRouter(configured, { ...configured, model: "review-model" });
    expect(router.resolve("code_review")).toMatchObject({
      task: "code_review",
      model: "review-model",
      temperature: 0.2,
    });
    expect(router.resolve("teach").model).toBe("teach-model");
    expect(JSON.stringify(router.resolve("code_review"))).not.toContain("apiKey");
    expect(() => createModelRouter(configured).resolve("code_review")).toThrow(/not configured/);
    const project = createModelRouter(configured, null, { ...configured, model: "project-model" });
    expect(project.resolve("project_review")).toMatchObject({
      task: "project_review",
      model: "project-model",
    });
    expect(() => project.resolve("code_review")).toThrow(/not configured/);
    expect(() => createModelRouter(configured, configured).resolve("project_review")).toThrow(
      /not configured/,
    );
  });

  it("routes interviews independently of teach and review", () => {
    const router = createModelRouter(configured, null, null, {
      ...configured,
      model: "interview-model",
    });
    expect(router.resolve("interview")).toMatchObject({
      task: "interview",
      model: "interview-model",
      temperature: 0.2,
    });
    expect(() => router.resolve("teach")).not.toThrow();
    expect(() => createModelRouter(configured).resolve("interview")).toThrow(/not configured/);
    expect(() => router.resolve("review")).toThrow(AiTaskUnavailableError);
  });

  it("rejects an unknown task and leaves future tasks uncalled", () => {
    const router = createModelRouter(configured);
    expect(() => router.resolve("review")).toThrow(AiTaskUnavailableError);
    expect(() => router.resolve("not-a-task" as "teach")).toThrow(UnknownAiTaskError);
  });

  it("makes one provider call for a teach completion", async () => {
    const provider = new FakeAiProvider("openai-compatible", () => ({
      json: { speech: "ok" },
      inputTokens: 10,
      outputTokens: 5,
      model: "teach-model",
      latencyMs: 4,
      usage: {
        provider: "openai-compatible",
        model: "teach-model",
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        latencyMs: 4,
      },
    }));

    const response = await completeTeach({
      router: createModelRouter(configured),
      provider,
      system: "system",
      user: "hello",
    });

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.schemaName).toBe("TeacherResult");
    expect(response.usage.totalTokens).toBe(15);
    expect(
      estimateCostMicros({
        inputTokens: 1_000_000,
        outputTokens: 0,
        inputMicrosPerMillion: 150_000,
        outputMicrosPerMillion: 600_000,
      }),
    ).toBe(150_000n);
  });
});
