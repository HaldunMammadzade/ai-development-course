import { SPEAKING_PROMPT_VERSION, SPEAKING_SYSTEM_PROMPT } from "./system";

export interface SpeakingPromptInput {
  mode: "lesson" | "interview";
  questionTitle: string;
  questionPrompt: string;
  conceptName: string;
  transcript: string;
  priorAnswers: readonly string[];
  masteryBand: string | null;
  misconception: string | null;
  locale: string;
}

export interface SpeakingPrompt {
  version: string;
  system: string;
  user: string;
}

export function renderSpeakingPrompt(input: SpeakingPromptInput): SpeakingPrompt {
  const prior =
    input.priorAnswers.length === 0
      ? "none"
      : input.priorAnswers.map((answer, index) => `${index + 1}. ${clip(answer, 400)}`).join("\n");
  const user = [
    `mode: ${input.mode === "interview" ? "interview practice" : "lesson practice"}`,
    `locale: ${input.locale}`,
    `question: ${clip(input.questionTitle, 120)}`,
    `objective: ${clip(input.questionPrompt, 400)}`,
    `concept: ${clip(input.conceptName, 80)}`,
    `mastery band: ${input.masteryBand ?? "unknown"}`,
    `misconception: ${input.misconception === null ? "none" : clip(input.misconception, 200)}`,
    "previous answers:",
    prior,
    "<student_block>",
    clip(input.transcript, 6_000),
    "</student_block>",
  ].join("\n");
  return {
    version: SPEAKING_PROMPT_VERSION,
    system: SPEAKING_SYSTEM_PROMPT,
    user,
  };
}

function clip(value: string, max: number): string {
  return value.replaceAll("\0", "").slice(0, max);
}
