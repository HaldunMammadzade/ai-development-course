const LOCAL_RUNNER_TOKEN = "local-development-runner";

export function readRunnerListenToken(env: NodeJS.ProcessEnv): string {
  const configured = env.EXECUTION_RUNNER_TOKEN?.trim() ?? "";
  if (env.NODE_ENV === "production") {
    if (configured.length < 16 || configured === LOCAL_RUNNER_TOKEN) {
      throw new Error("EXECUTION_RUNNER_TOKEN is required in production.");
    }
    return configured;
  }
  const token = configured.length > 0 ? configured : LOCAL_RUNNER_TOKEN;
  if (token.length < 16) {
    throw new Error("EXECUTION_RUNNER_TOKEN must be at least 16 characters.");
  }
  return token;
}
