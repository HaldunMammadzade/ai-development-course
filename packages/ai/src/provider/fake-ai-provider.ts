import type { AIProvider, AIRequest, AIResponse } from "./ai-provider";

export class FakeAiProvider implements AIProvider {
  readonly calls: AIRequest[] = [];

  constructor(
    readonly id: string,
    private readonly respond: (request: AIRequest) => AIResponse | Promise<AIResponse>,
  ) {}

  async complete(request: AIRequest): Promise<AIResponse> {
    this.calls.push(request);
    return this.respond(request);
  }
}
