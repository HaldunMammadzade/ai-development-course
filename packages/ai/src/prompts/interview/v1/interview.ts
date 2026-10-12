import { INTERVIEW_PROMPT_VERSION, INTERVIEW_SYSTEM_PROMPT } from "./system";

export interface InterviewPromptInput {
  interviewTitle: string;
  question: {
    title: string;
    prompt: string;
    type: "verbal" | "code";
    difficulty: string;
    conceptName: string;
  };
  answer: {
    text: string;
    code: string | null;
  };
  execution: {
    status: string;
    passed: boolean;
    note: string;
  } | null;
  priorAnswers: string[];
  masteryBand: string | null;
  misconception: string | null;
  locale: string;
}

export interface InterviewPrompt {
  version: typeof INTERVIEW_PROMPT_VERSION;
  system: string;
  user: string;
}

export function renderInterviewPrompt(input: InterviewPromptInput): InterviewPrompt {
  const prior =
    input.priorAnswers.length === 0
      ? "none"
      : input.priorAnswers.map((answer, index) => `${index + 1}. ${clip(answer, 400)}`).join("\n");
  const execution =
    input.execution === null
      ? "none"
      : [
          `status: ${input.execution.status}`,
          `passed: ${input.execution.passed}`,
          `note: ${clip(input.execution.note, 240)}`,
        ].join("\n");
  const user = [
    `Interview: ${input.interviewTitle}`,
    `Locale: ${input.locale}`,
    `Question: ${input.question.title}`,
    `Type: ${input.question.type}`,
    `Difficulty: ${input.question.difficulty}`,
    `Concept: ${input.question.conceptName}`,
    `Objective: ${input.question.prompt}`,
    `Mastery band: ${input.masteryBand ?? "unknown"}`,
    "Earlier answers:",
    prior,
    "Execution:",
    execution,
    "student_note:",
    fence(input.misconception ?? ""),
    "student_answer:",
    fence(input.answer.text),
    "student_code:",
    fence(input.answer.code ?? ""),
  ].join("\n");
  return {
    version: INTERVIEW_PROMPT_VERSION,
    system: INTERVIEW_SYSTEM_PROMPT,
    user,
  };
}

function fence(value: string): string {
  return `<student_block>\n${value.replaceAll("</student_block>", "")}\n</student_block>`;
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
