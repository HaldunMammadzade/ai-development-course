import { EXECUTION_MESSAGES } from "./limits";
import type { ExecutionStatus } from "./protocol";

export type SandboxFailureKind = "behavior_mismatch" | "execution_stopped";

const BEHAVIOR_MISMATCH =
  "Qaytarılan nəticə tələb olunan davranışa uyğun gəlmir. Funksiyanın qaytardığı dəyəri tapşırığa görə yenidən yoxla.";

const STOPPED_NEXT = "Yoxlamalar işləmədi. Funksiya nəticə vermədən dayandı.";

const stoppedFeedback: Record<Exclude<ExecutionStatus, "completed">, string> = {
  timeout: `${EXECUTION_MESSAGES.timeout} Yoxlamalar işləmədi. Dövrün bitdiyinə əmin ol.`,
  memory_limit: `${EXECUTION_MESSAGES.memory_limit} Yoxlamalar işləmədi. Daha az yaddaş tutan bir yol yoxla.`,
  process_limit: `${EXECUTION_MESSAGES.process_limit} Yoxlamalar işləmədi. Əlavə proses açmadan yenidən yoxla.`,
  runtime_error: `${EXECUTION_MESSAGES.runtime_error} ${STOPPED_NEXT}`,
  syntax_error: `${EXECUTION_MESSAGES.syntax_error} Yoxlamalar işləmədi. Əvvəl sintaksisi düzəlt.`,
  runner_error: `${EXECUTION_MESSAGES.runtime_error} ${STOPPED_NEXT}`,
};

export function sandboxFailureFeedback(input: {
  status: ExecutionStatus;
  passedCount: number;
  totalCount: number;
}): { kind: SandboxFailureKind; feedback: string } {
  if (input.status !== "completed") {
    return { kind: "execution_stopped", feedback: stoppedFeedback[input.status] };
  }
  const summary = `${input.passedCount}/${input.totalCount} yoxlama keçdi.`;
  return { kind: "behavior_mismatch", feedback: `${summary} ${BEHAVIOR_MISMATCH}` };
}
