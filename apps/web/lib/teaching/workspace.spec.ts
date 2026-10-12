import { describe, expect, it } from "vitest";
import type { LearningCatalog, TeachingSessionView } from "@platform/types";
import { copy } from "@/lib/copy";
import {
  adaptiveCue,
  buildLessonWorkspace,
  conceptStatus,
  readingParagraphs,
  teacherVisual,
} from "./workspace";

function catalog(patch: Partial<LearningCatalog> = {}): LearningCatalog {
  return {
    path: { slug: "frontend", title: "Frontend", description: "Yol" },
    modules: [
      {
        slug: "web",
        title: "Web Fundamentals",
        description: "Səhifə",
        lessons: [
          {
            slug: "how-the-web-delivers-a-page",
            title: "Brauzer səhifəni necə alır",
            objective: "HTTP sorğusunu izah etmək.",
            estimatedMinutes: 15,
            availability: "current",
          },
          {
            slug: "what-is-a-url",
            title: "URL nədir",
            objective: "URL hissələrini tanımaq.",
            estimatedMinutes: 12,
            availability: "locked",
          },
        ],
      },
    ],
    concepts: [
      {
        slug: "web.http",
        name: "HTTP",
        moduleTitle: "Web Fundamentals",
        lessonSlug: "how-the-web-delivers-a-page",
        mastery: null,
        confidence: null,
        band: null,
        reviewDue: false,
      },
    ],
    focus: {
      slug: "web.http",
      name: "HTTP",
      decision: "CONTINUE",
      reason: "baseline",
    },
    nextAction: { kind: "start_lesson", lessonId: "lesson-1", title: "Brauzer səhifəni necə alır" },
    activity: [],
    ...patch,
  };
}

function session(patch: Partial<TeachingSessionView> = {}): TeachingSessionView {
  return {
    id: "session-1",
    lessonSlug: "how-the-web-delivers-a-page",
    lessonTitle: "Brauzer səhifəni necə alır",
    mode: "explain",
    state: "explain",
    turnNumber: 1,
    completed: false,
    reviewConceptName: null,
    block: { type: "reading", position: 1, markdown: "Brauzer sorğu göndərir.\n\n<p>Salam</p>" },
    messages: [
      {
        id: "m1",
        role: "teacher",
        speech: "Üç addımı yadda saxla.",
        createdAt: "2026-10-08T00:00:00.000Z",
      },
    ],
    homework: null,
    progress: [{ slug: "web.http", mastery: 32 }],
    nextAction: { kind: "continue_lesson", sessionId: "session-1", lessonId: "lesson-1", title: "Brauzer" },
    ...patch,
  };
}

describe("lesson workspace model", () => {
  it("places a new lesson on the server objective and hides baseline focus", () => {
    const model = buildLessonWorkspace({
      slug: "how-the-web-delivers-a-page",
      catalog: catalog(),
      session: session({ state: "created", messages: [], progress: [{ slug: "web.http", mastery: null }] }),
      phase: "ready",
      pending: false,
      hasError: false,
      adaptive: null,
      notice: [],
    });

    expect(model.title).toBe("Brauzer səhifəni necə alır");
    expect(model.moduleTitle).toBe("Web Fundamentals");
    expect(model.position).toBe("Dərs 1 / 2");
    expect(model.objective).toBe("HTTP sorğusunu izah etmək.");
    expect(model.advance).toBe(copy.teacher.begin);
    expect(model.adaptive).toBeNull();
    expect(model.next?.href).toBeNull();
    expect(model.next?.lockedReason).toBe(copy.teacher.lockedWhy);
    expect(model.concepts[0]).toMatchObject({ name: "HTTP", status: copy.teacher.notStarted, weak: false });
    expect(model.teacherVisual).toBe("explaining");
    expect(JSON.stringify(model)).not.toContain("0%");
    expect(JSON.stringify(model)).not.toContain("32");
    expect(model).not.toHaveProperty("streak");
  });

  it("shows the check as a question and a weak concept in words", () => {
    const model = buildLessonWorkspace({
      slug: "how-the-web-delivers-a-page",
      catalog: catalog({
        concepts: [
          {
            slug: "web.http",
            name: "HTTP",
            moduleTitle: "Web Fundamentals",
            lessonSlug: "how-the-web-delivers-a-page",
            mastery: 32,
            confidence: "low",
            band: "weak",
            reviewDue: false,
          },
        ],
        focus: {
          slug: "web.http",
          name: "HTTP",
          decision: "REEXPLAIN",
          reason: "repeated_failure",
        },
      }),
      session: session({
        state: "evaluate",
        block: { type: "check_question", position: 2, prompt: "Nə baş verir?" },
        messages: [
          { id: "s1", role: "student", speech: "Bilmirəm", createdAt: "2026-10-08T00:00:00.000Z" },
          { id: "t1", role: "teacher", speech: "Bir daha baxaq.", createdAt: "2026-10-08T00:00:01.000Z" },
        ],
      }),
      phase: "ready",
      pending: false,
      hasError: false,
      adaptive: "RETRY",
      notice: [{ name: "HTTP", understanding: "incorrect" }],
    });

    expect(model.block).toMatchObject({ kind: "question", prompt: "Nə baş verir?" });
    expect(model.mode).toBe("answer");
    expect(model.questionSpeech).toBe("Bir daha baxaq.");
    expect(model.answers).toEqual(["Bilmirəm"]);
    expect(model.adaptive).toBe(copy.teacher.adaptiveCue.RETRY);
    expect(model.adaptive).not.toContain("RETRY");
    expect(model.concepts[0]?.status).toBe(copy.dashboard.weakStatus);
    expect(model.notice).toEqual([{ name: "HTTP", status: copy.teacher.understanding.incorrect }]);
    expect(JSON.stringify(model)).not.toContain("32");
    expect(JSON.stringify(model)).not.toContain("confidence");
  });

  it("completes into the server's next homework action", () => {
    const model = buildLessonWorkspace({
      slug: "how-the-web-delivers-a-page",
      catalog: catalog(),
      session: session({
        state: "completed",
        completed: true,
        nextAction: { kind: "do_homework", homeworkId: "hw-1", lessonId: "lesson-1", title: "Ev" },
        homework: {
          id: "hw-1",
          prompt: "Üç addımı yaz.",
          status: "assigned",
          dueAt: "2026-10-09T00:00:00.000Z",
          completedAt: null,
          lessonSlug: "how-the-web-delivers-a-page",
          lessonTitle: "Brauzer səhifəni necə alır",
          title: "Ev",
        },
      }),
      phase: "ready",
      pending: false,
      hasError: false,
      adaptive: null,
      notice: [],
    });

    expect(model.completion?.href).toBe("/app/homework");
    expect(model.completion?.learned).toBe("HTTP sorğusunu izah etmək.");
    expect(model.completion?.concepts).toEqual(["HTTP"]);
    expect(model.advance).toBeNull();
    expect(model.completion?.title).toBe(copy.teacher.completedTitle);
  });

  it("shows a finished concept review without lesson or path completion", () => {
    const model = buildLessonWorkspace({
      slug: "how-the-web-delivers-a-page",
      catalog: catalog(),
      session: session({
        state: "review_completed",
        completed: false,
        reviewConceptName: "HTTP",
        nextAction: { kind: "review_concept", conceptSlug: "web.http", lessonId: "lesson-1", title: "Brauzer" },
      }),
      phase: "ready",
      pending: false,
      hasError: false,
      adaptive: null,
      notice: [],
    });

    expect(model.mode).toBe("done");
    expect(model.advance).toBeNull();
    expect(model.completion?.title).toBe("HTTP təkrarı bitdi");
    expect(model.completion?.body).toBe(copy.teacher.reviewDoneBody);
    expect(model.completion?.href).toBe("/app/dashboard");
    expect(model.completion?.label).toBe(copy.teacher.reviewDoneAction);
    expect(model.completion?.learned).toBeNull();
    expect(model.completion?.pathDone).toBe(false);
    expect(model.stateLabel).toBe(copy.teacher.phase.review_completed);
    const shown = JSON.stringify(model.completion);
    expect(shown).not.toContain(copy.teacher.completedTitle);
    expect(shown).not.toContain(copy.teacher.pathDone);
    expect(shown).not.toContain(copy.teacher.nextLesson);
  });

  it("maps teacher and adaptive states without enum names", () => {
    expect(teacherVisual({ phase: "loading", pending: false, state: null, adaptive: null, hasError: false })).toBe(
      "thinking",
    );
    expect(teacherVisual({ phase: "ready", pending: false, state: "hint", adaptive: null, hasError: false })).toBe(
      "hint",
    );
    expect(teacherVisual({ phase: "ready", pending: false, state: "explain", adaptive: "REMEDIATE_PREREQUISITE", hasError: false })).toBe(
      "explaining",
    );
    expect(teacherVisual({ phase: "error", pending: false, state: "explain", adaptive: null, hasError: true })).toBe(
      "error",
    );
    const decisions = [
      "REEXPLAIN",
      "HINT",
      "RETRY",
      "REVIEW",
      "CHALLENGE",
      "REMEDIATE_PREREQUISITE",
    ] as const;
    for (const decision of decisions) {
      const cue = adaptiveCue(decision, null);
      expect(cue).toBe(copy.teacher.adaptiveCue[decision]);
      expect(cue).not.toBe(decision);
    }
    expect(adaptiveCue("CONTINUE", null)).toBeNull();
    expect(conceptStatus({ band: "strong", recorded: true }).status).toBe(copy.teacher.band.strong);
    expect(readingParagraphs("Mətn.\n\n<p>Salam</p>")).toEqual([
      { text: "Mətn.", code: false },
      { text: "<p>Salam</p>", code: true },
    ]);
  });
});
