/**
 * @vitest-environment happy-dom
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetail } from "@platform/types";
import { copy } from "@/lib/copy";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiGet: api.get,
  apiPost: api.post,
}));

vi.mock("@/lib/teaching/turn-id", () => ({
  createClientTurnId: () => "client-1",
}));

vi.mock("@/components/exercises/coding-editor", () => ({
  CodingEditor: (props: { value: string; onChange: (value: string) => void; language: string }) =>
    createElement("textarea", {
      "aria-label": props.language,
      value: props.value,
      onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
    }),
}));

const project: ProjectDetail = {
  slug: "personal-portfolio",
  title: "Şəxsi Portfolio Səhifəsi",
  description: "Kiçik səhifə",
  objective: "Özünüz yazın",
  difficulty: "beginner",
  estimatedMinutes: 40,
  completed: false,
  completedAt: null,
  currentMilestone: "structure",
  band: "FOUNDATION",
  brief: {
    goal: "Kiçik səhifə qurun.",
    required: ["Header və main olsun"],
    recommended: ["Qısa cümlələr"],
    optional: ["Bir şərh"],
  },
  plan: null,
  portfolio: null,
  concepts: [{ slug: "html.elements", name: "Elementlər" }],
  milestones: [
    {
      slug: "structure",
      position: 1,
      title: "HTML quruluşu",
      status: "current",
      workflow: "IN_PROGRESS",
      objective: "Hissələri ayırın",
      instructions: "header və main yazın",
      concepts: [{ slug: "html.elements", name: "Elementlər" }],
      files: {
        "index.html": "<body></body>",
        "style.css": "/* stillər */",
        "script.js": 'function greet(name) { return ""; }',
      },
    },
    {
      slug: "links",
      position: 2,
      title: "Keçid",
      status: "locked",
      workflow: "TODO",
    },
  ],
};

describe("project board", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockResolvedValue({ attempts: [] });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("posts the allowlisted files, keeps a locked milestone closed, and escapes advice", async () => {
    api.post.mockResolvedValue({
      id: "attempt-1",
      milestoneSlug: "structure",
      status: "failed",
      score: 0,
      passed: false,
      feedback: "Header görünmür",
      passedChecks: [],
      failedChecks: ["<script>alert(1)</script>"],
      files: project.milestones[0]?.files,
      attemptNumber: 1,
      createdAt: "2026-10-07T00:00:00.000Z",
    });
    await act(async () => {
      root.render(
        createElement((await import("./project-board")).ProjectBoard, {
          initial: project,
          timeZone: "Asia/Baku",
        }),
      );
    });
    const locked = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Keçid"),
    );
    expect(locked?.disabled).toBe(true);
    const check = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === copy.projects.check,
    );
    await act(async () => {
      check?.click();
    });
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/projects/personal-portfolio/milestones/structure/attempts",
      {
        clientAttemptId: "client-1",
        files: project.milestones[0]?.files,
      },
    );
    const body = JSON.stringify(api.post.mock.calls[0]?.[1]);
    expect(body).not.toContain("score");
    expect(body).not.toContain("passed");
    expect(host.innerHTML).not.toContain("<script>alert");
    expect(host.textContent).toContain("alert(1)");
    expect(host.textContent).toContain(copy.projects.result);
    expect(host.textContent).toContain(copy.projects.mentorWait);
    expect(host.textContent).toContain(copy.projects.attention);
    expect(host.textContent).not.toContain(`${copy.exercise.attempt} 1: 0`);
  });

  it("shows a calm completion state and keeps a locked milestone without files", async () => {
    const done: ProjectDetail = {
      ...project,
      completed: true,
      completedAt: "2026-10-08T00:00:00.000Z",
      portfolio: {
        title: project.title,
        problem: project.objective,
        technologies: ["HTML"],
        features: ["HTML quruluşu"],
        skills: ["Elementlər"],
        completedAt: "2026-10-08T00:00:00.000Z",
      },
    };
    await act(async () => {
      root.render(
        createElement((await import("./project-board")).ProjectBoard, {
          initial: done,
          timeZone: "Asia/Baku",
        }),
      );
    });
    expect(host.textContent).toContain(copy.projects.completedLead);
    expect(host.textContent).toContain(copy.projects.portfolioMark);
    expect(host.innerHTML).toContain('href="/app/achievements"');
    const locked = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Keçid"),
    );
    expect(locked?.disabled).toBe(true);
    expect(host.textContent).toContain(copy.projects.stateLocked);
  });
});
