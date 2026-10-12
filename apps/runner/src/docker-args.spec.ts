import { describe, expect, it } from "vitest";
import { hostProcessEnv, sandboxDockerArgs } from "./docker-args";

describe("sandboxDockerArgs", () => {
  it("isolates the container and does not mount the host", () => {
    const args = sandboxDockerArgs("exec-00000000-0000-4000-8000-000000000001");
    expect(args).toContain("--network");
    expect(args[args.indexOf("--network") + 1]).toBe("none");
    expect(args).toContain("--read-only");
    expect(args).toContain("--cap-drop");
    expect(args).toContain("ALL");
    expect(args).toContain("--memory");
    expect(args).toContain("96m");
    expect(args).toContain("--cpus");
    expect(args).toContain("0.5");
    expect(args).toContain("--pids-limit");
    expect(args).toContain("32");
    expect(args).toContain("--user");
    expect(args).toContain("node");
    expect(args).not.toContain("-v");
    expect(args).not.toContain("--volume");
    expect(args).not.toContain("--mount");
    expect(args).not.toContain("-e");
    expect(args).not.toContain("--env");
    expect(args.join(" ")).not.toContain("docker.sock");
    expect(args.join(" ")).not.toContain("DATABASE_URL");
    expect(() => sandboxDockerArgs("student-name")).toThrow(/container name/);
  });
});

describe("hostProcessEnv", () => {
  it("does not forward application secrets to the docker client", () => {
    const env = hostProcessEnv({
      PATH: "/usr/bin",
      HOME: "/tmp",
      DOCKER_HOST: "unix:///var/run/docker.sock",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/platform",
      AI_API_KEY: "sk-secret",
      SESSION_SECRET: "session",
    });
    expect(env).toEqual({
      PATH: "/usr/bin",
      HOME: "/tmp",
      DOCKER_HOST: "unix:///var/run/docker.sock",
    });
  });
});
