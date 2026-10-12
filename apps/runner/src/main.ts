import { executeInDocker } from "./docker-runner";
import { readRunnerListenToken } from "./runner-env";
import { createRunnerServer } from "./server";
import { onceSignal } from "./shutdown";

const port = Number(process.env.EXECUTION_RUNNER_PORT ?? 3002);
const token = readRunnerListenToken(process.env);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("EXECUTION_RUNNER_PORT is invalid.");
}
if (token.length < 16) {
  throw new Error("EXECUTION_RUNNER_TOKEN must be at least 16 characters.");
}

const server = createRunnerServer({ execute: executeInDocker }, token);
server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ status: "listening", port }));
});

onceSignal(process, ["SIGTERM", "SIGINT"], () => {
  server.close(() => {
    process.exit(0);
  });
});
