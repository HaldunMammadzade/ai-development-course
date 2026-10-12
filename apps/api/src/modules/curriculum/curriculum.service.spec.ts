import type { CurriculumRepository } from "@platform/database";
import { describe, expect, it } from "vitest";
import { CurriculumService } from "./curriculum.service";

describe("CurriculumService", () => {
  it("returns a published path and hides a draft path", async () => {
    const repository: CurriculumRepository = {
      async findPathBySlug(slug) {
        return {
          id: slug,
          slug,
          title: slug,
          description: slug,
          track: slug === "backend" ? "backend" : "frontend",
          status: slug === "backend" ? "draft" : "published",
          modules: [],
        };
      },
      async findDirectPrerequisiteSlugs() {
        return ["web.http"];
      },
      async disconnect() {
        return undefined;
      },
    };
    const service = new CurriculumService(repository);

    expect((await service.getPublishedPath("frontend"))?.status).toBe("published");
    expect(await service.getPublishedPath("backend")).toBeNull();
    expect(await service.findDirectPrerequisiteSlugs("web.url")).toEqual(["web.http"]);
  });
});
