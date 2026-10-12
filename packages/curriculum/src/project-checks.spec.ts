import { describe, expect, it } from "vitest";
import type { ProjectFiles } from "@platform/types";
import { projectSeedSchema } from "@platform/validation";
import { frontendCurriculum } from "./frontend-seed";
import { frontendProjects } from "./frontend-project";
import { evaluateProjectMilestone, projectHiddenLiterals } from "./project-checks";

const empty: ProjectFiles = {
  "index.html": "<!DOCTYPE html><html><body></body></html>",
  "style.css": "",
  "script.js": 'function greet(name) {\n  return "";\n}\n',
};

describe("portfolio project checks", () => {
  it("uses published concepts and keeps the sentinel out of student text", () => {
    const slugs = new Set(frontendCurriculum.concepts.map((concept) => concept.slug));
    const published = frontendProjects.find((project) => project.slug === "personal-portfolio");
    expect(published?.status).toBe("published");
    expect(published?.milestones).toHaveLength(6);
    for (const concept of published?.requiredConcepts ?? []) {
      expect(slugs.has(concept)).toBe(true);
    }
    for (const milestone of published?.milestones ?? []) {
      expect(slugs.has(milestone.conceptSlug)).toBe(true);
      expect(milestone.instructions).not.toContain("Qx7");
      expect(JSON.stringify(milestone.checks.map((check) => check.feedback))).not.toContain("Qx7");
      expect(JSON.stringify(milestone.checks.map((check) => check.label))).not.toContain("Qx7");
    }
    const greeting = published?.milestones.find((milestone) => milestone.slug === "greeting");
    expect(projectHiddenLiterals(greeting?.checks ?? [])).toContain("Qx7");
    expect(frontendProjects.some((project) => project.status === "draft")).toBe(true);
  });

  it("scores structure without executing code and fails a later milestone early", () => {
    const project = frontendProjects[0];
    expect(project).toBeDefined();
    const structure = project?.milestones[0];
    const links = project?.milestones[1];
    expect(structure).toBeDefined();
    expect(links).toBeDefined();
    if (structure === undefined || links === undefined) {
      return;
    }
    const files: ProjectFiles = {
      ...empty,
      "index.html": "<header></header><main><h1>Salam</h1></main>",
    };
    expect(
      evaluateProjectMilestone({ checks: structure.checks, files, observation: null }).passed,
    ).toBe(true);
    expect(
      evaluateProjectMilestone({ checks: links.checks, files, observation: null }).passed,
    ).toBe(false);
  });

  it("passes the greeting only when the hidden calls succeed", () => {
    const greeting = frontendProjects[0]?.milestones.find(
      (milestone) => milestone.slug === "greeting",
    );
    expect(greeting).toBeDefined();
    if (greeting === undefined) {
      return;
    }
    const failed = evaluateProjectMilestone({
      checks: greeting.checks,
      files: empty,
      observation: {
        status: "completed",
        tests: [
          { id: "greet-a", passed: false },
          { id: "greet-b", passed: false },
        ],
      },
    });
    expect(failed.passed).toBe(false);
    expect(JSON.stringify(failed)).not.toContain("Qx7");

    const passed = evaluateProjectMilestone({
      checks: greeting.checks,
      files: empty,
      observation: {
        status: "completed",
        tests: [
          { id: "greet-a", passed: true },
          { id: "greet-b", passed: true },
        ],
      },
    });
    expect(passed.score).toBe(100);
    expect(passed.passed).toBe(true);
    expect(JSON.stringify(passed)).not.toContain("greet-b");
  });
});

describe("TaskFlow project checks", () => {
  const project = frontendProjects.find((item) => item.slug === "taskflow");

  it("publishes eight ordered milestones on existing concepts", () => {
    expect(projectSeedSchema.safeParse(project).success).toBe(true);
    expect(project?.status).toBe("published");
    expect(project?.milestones).toHaveLength(8);
    const slugs = new Set(frontendCurriculum.concepts.map((concept) => concept.slug));
    const concepts = project?.milestones.map((milestone) => milestone.conceptSlug) ?? [];
    expect(new Set(concepts).size).toBe(concepts.length);
    expect(project?.milestones.map((milestone) => milestone.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const concept of [...(project?.requiredConcepts ?? []), ...concepts]) {
      expect(slugs.has(concept)).toBe(true);
    }
    const body = JSON.stringify({
      description: project?.description,
      objective: project?.objective,
      milestones: project?.milestones.map((milestone) => ({
        title: milestone.title,
        objective: milestone.objective,
        instructions: milestone.instructions,
      })),
    });
    expect(body).not.toContain("forbidden_text");
    expect(body).not.toContain("contains_text");
    expect(body).not.toContain("javascript_call");
    expect(project?.milestones.every((milestone) => milestone.checks.every((check) => check.type !== "javascript_call"))).toBe(true);
  });

  it("rejects derived filtering that is stored in an effect and accepts the render-time filter", () => {
    const milestone = project?.milestones.find((item) => item.slug === "search-filter");
    expect(milestone).toBeDefined();
    if (milestone === undefined) {
      return;
    }
    const derived = files({
      "script.js": "const visible = tasks.filter((task) => task.title.includes(search));\n",
    });
    expect(evaluateProjectMilestone({ checks: milestone.checks, files: derived, observation: null }).passed).toBe(
      true,
    );
    const effect = files({
      "script.js":
        "useEffect(() => { setVisible(tasks.filter((task) => task.title.includes(search))); }, [tasks, search]);\n",
    });
    const failed = evaluateProjectMilestone({ checks: milestone.checks, files: effect, observation: null });
    expect(failed.passed).toBe(false);
    expect(JSON.stringify(failed)).not.toContain("useEffect");
    expect(failed.score).toBeLessThan(70);
  });

  it("accepts a typed list key and rejects an index key", () => {
    const milestone = project?.milestones.find((item) => item.slug === "task-list");
    expect(milestone).toBeDefined();
    if (milestone === undefined) {
      return;
    }
    const indexed = files({
      "script.js": "tasks.map((task, index) => <article key={index}>{task.title}</article>);\n",
    });
    expect(evaluateProjectMilestone({ checks: milestone.checks, files: indexed, observation: null }).passed).toBe(
      false,
    );
    const stable = files({
      "script.js": "tasks.map((task) => <article key={task.id}>{task.title}</article>);\n",
    });
    expect(evaluateProjectMilestone({ checks: milestone.checks, files: stable, observation: null }).passed).toBe(
      true,
    );
  });
});

function files(patch: Partial<ProjectFiles>): ProjectFiles {
  return {
    "index.html": "<!DOCTYPE html><html><body></body></html>",
    "style.css": "",
    "script.js": "",
    ...patch,
  };
}
