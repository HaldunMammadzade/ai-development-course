import { describe, expect, it } from "vitest";
import { PasswordService } from "./password.service";

const password = "correct horse battery";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("stores a non-plaintext Argon2id hash", async () => {
    const hash = await service.hash(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).toContain("m=19456,p=1,t=2");
    expect(hash).not.toContain(password);
  });

  it("verifies the correct password", async () => {
    const hash = await service.hash(password);
    await expect(service.verify(hash, password)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await service.hash(password);
    await expect(service.verify(hash, "a different passphrase")).resolves.toBe(false);
  });

  it("rejects a malformed hash", async () => {
    await expect(service.verify("not-a-hash", password)).resolves.toBe(false);
  });
});
