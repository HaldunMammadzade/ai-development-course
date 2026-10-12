export const EXECUTION_LIMITS = {
  timeoutMs: 2_000,
  memoryMb: 96,
  cpus: "0.5",
  pids: 32,
  maxStdoutBytes: 16_384,
  maxResultBytes: 8_192,
  maxConcurrent: 4,
  claimTtlMs: 30_000,
  image: "platform-js-sandbox:12",
} as const;

export const EXECUTION_MESSAGES = {
  timeout: "Kod 2 saniyəlik icra limitini keçdi.",
  memory_limit: "Kod yaddaş limitini keçdi.",
  process_limit: "Kod proses limitini keçdi.",
  runtime_error: "Kod icra edilərkən xəta baş verdi.",
  syntax_error: "Sintaksis xətası var.",
} as const;
