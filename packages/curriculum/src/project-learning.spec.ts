import { describe, expect, it } from "vitest";
import {
  milestoneWorkflow,
  projectBrief,
  projectDifficultyBand,
  projectPortfolio,
  projectSelectionRank,
  selectProjects,
} from "./project-learning";

describe("project learning", () => {
  it("publishes a brief without hidden checks", () => {
    const brief = projectBrief("personal-portfolio");
    const body = JSON.stringify(brief);
    expect(brief?.required.length).toBeGreaterThan(0);
    expect(brief?.recommended.length).toBeGreaterThan(0);
    expect(brief?.optional.length).toBeGreaterThan(0);
    expect(body).not.toContain("Qx7");
    expect(body).not.toContain("javascript_call");
    expect(body).not.toContain("html_element_exists");
    expect(body).not.toContain("https://example.com");
    const taskflow = projectBrief("taskflow");
    const taskflowBody = JSON.stringify(taskflow);
    expect(taskflow?.goal).toContain("TaskFlow");
    expect(taskflow?.required.length).toBe(8);
    expect(taskflow?.recommended.length).toBeGreaterThan(0);
    expect(taskflowBody).not.toContain("forbidden_text");
    expect(taskflowBody).not.toContain("contains_text");
    expect(taskflowBody).not.toContain("javascript_call");
    expect(projectBrief("missing")).toBeNull();
  });

  it("maps the existing difficulty labels", () => {
    expect(projectDifficultyBand("beginner")).toBe("FOUNDATION");
    expect(projectDifficultyBand("easy")).toBe("FOUNDATION");
    expect(projectDifficultyBand("intermediate")).toBe("INTERMEDIATE");
    expect(projectDifficultyBand("advanced")).toBe("ADVANCED");
    expect(projectDifficultyBand("expert")).toBe("ADVANCED");
  });

  it("orders an active project ahead of required, remediation, and challenge work", () => {
    const projects = [
      item("challenge", "advanced", { masteryHigh: true }),
      item("repair", "beginner", { remediation: true }),
      item("required", "beginner", {}),
      item("active", "beginner", { passedMilestones: 1 }),
      item("done", "beginner", { completed: true, passedMilestones: 6 }),
      item("early-challenge", "expert", { masteryHigh: false }),
    ];
    expect(selectProjects(projects).map((project) => project.slug)).toEqual([
      "active",
      "required",
      "repair",
      "challenge",
      "done",
      "early-challenge",
    ]);
    expect(projectSelectionRank(item("active", "beginner", { passedMilestones: 2 }))).toBe(0);
  });

  it("keeps milestone workflow on the server side of the current status", () => {
    expect(milestoneWorkflow({ status: "locked", latestPassed: null, claimed: false })).toBe(
      "TODO",
    );
    expect(milestoneWorkflow({ status: "current", latestPassed: null, claimed: false })).toBe(
      "IN_PROGRESS",
    );
    expect(milestoneWorkflow({ status: "current", latestPassed: null, claimed: true })).toBe(
      "SUBMITTED",
    );
    expect(milestoneWorkflow({ status: "current", latestPassed: false, claimed: false })).toBe(
      "FAILED",
    );
    expect(milestoneWorkflow({ status: "passed", latestPassed: false, claimed: true })).toBe(
      "PASSED",
    );
  });

  it("builds a portfolio only from passed milestone evidence", () => {
    expect(
      projectPortfolio({
        title: "Şəxsi Portfolio Səhifəsi",
        objective: "Səhifə qurun",
        completed: false,
        completedAt: null,
        milestones: [],
      }),
    ).toBeNull();
    const portfolio = projectPortfolio({
      title: "Şəxsi Portfolio Səhifəsi",
      objective: "Səhifə qurun",
      completed: true,
      completedAt: "2026-10-07T12:00:00.000Z",
      milestones: [
        {
          title: "HTML quruluşu",
          status: "passed",
          concepts: [{ slug: "html.elements", name: "Elementlər" }],
        },
        {
          title: "Rəng",
          status: "passed",
          concepts: [{ slug: "web.css", name: "CSS" }],
        },
      ],
    });
    expect(portfolio?.skills).toEqual(["Elementlər", "CSS"]);
    expect(portfolio?.technologies).toEqual(["HTML", "CSS"]);
    expect(portfolio?.features).toEqual(["HTML quruluşu", "Rəng"]);
    expect(portfolio?.skills).not.toContain("JavaScript");
    const taskflow = projectPortfolio({
      title: "TaskFlow — Real-World Task Management App",
      objective: "Tapşırıq tətbiqi qurun",
      completed: true,
      completedAt: "2026-10-08T12:00:00.000Z",
      milestones: [
        { title: "Layihə əsası", status: "passed", concepts: [{ slug: "next.app-router", name: "App Router" }] },
        { title: "Task modeli", status: "passed", concepts: [{ slug: "ts.interface", name: "Interface" }] },
        { title: "Siyahı", status: "passed", concepts: [{ slug: "react.list", name: "Siyahı renderi" }] },
        { title: "Cila", status: "passed", concepts: [{ slug: "html.a11y", name: "Əlçatanlıq" }] },
      ],
    });
    expect(taskflow?.technologies).toEqual(["Next.js", "TypeScript", "React", "HTML"]);
    expect(taskflow?.skills).toEqual(["App Router", "Interface", "Siyahı renderi", "Əlçatanlıq"]);
    expect(taskflow?.completedAt).toBe("2026-10-08T12:00:00.000Z");
  });
});

function item(
  slug: string,
  difficulty: "beginner" | "advanced" | "expert",
  extra: {
    completed?: boolean;
    passedMilestones?: number;
    remediation?: boolean;
    masteryHigh?: boolean;
  },
) {
  return {
    slug,
    title: slug,
    completed: extra.completed ?? false,
    passedMilestones: extra.passedMilestones ?? 0,
    difficulty,
    remediation: extra.remediation ?? false,
    masteryHigh: extra.masteryHigh ?? false,
  };
}
