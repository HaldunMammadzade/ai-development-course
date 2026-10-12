import type { TeachingStreamEvent, TeachingTurnResponse } from "@platform/types";

export function completedTeachingEvents(turn: TeachingTurnResponse): TeachingStreamEvent[] {
  return [
    { type: "teacher.started", sessionId: turn.session.id },
    { type: "teacher.completed", turn },
  ];
}

export function teachingErrorEvent(code: string, message: string): TeachingStreamEvent {
  return { type: "teacher.error", code, message };
}
