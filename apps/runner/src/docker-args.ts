import { EXECUTION_LIMITS } from "@platform/execution";

const NAME = /^exec-[0-9a-f-]{36}$/;

export function sandboxDockerArgs(containerName: string): string[] {
  if (!NAME.test(containerName)) {
    throw new Error("Invalid execution container name.");
  }
  return [
    "run",
    "--rm",
    "--name",
    containerName,
    "--network",
    "none",
    "--memory",
    `${EXECUTION_LIMITS.memoryMb}m`,
    "--memory-swap",
    `${EXECUTION_LIMITS.memoryMb}m`,
    "--cpus",
    EXECUTION_LIMITS.cpus,
    "--pids-limit",
    String(EXECUTION_LIMITS.pids),
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=8m",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--user",
    "node",
    "-i",
    EXECUTION_LIMITS.image,
  ];
}

export function hostProcessEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  if (source.PATH !== undefined) {
    env.PATH = source.PATH;
  }
  if (source.HOME !== undefined) {
    env.HOME = source.HOME;
  }
  if (source.DOCKER_HOST !== undefined) {
    env.DOCKER_HOST = source.DOCKER_HOST;
  }
  return env;
}
