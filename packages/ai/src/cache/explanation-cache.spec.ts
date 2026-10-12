import { describe, expect, it } from "vitest";
import { admitExplanationCache } from "./explanation-cache";

const allowed = new Set(["web.http"]);

describe("explanation cache admission", () => {
  it("admits a generic explanation", () => {
    const result = admitExplanationCache({
      allowCache: true,
      speech: "HTTP is a request and a response.",
      studentName: "Aysel",
      conceptSlug: "web.http",
      difficulty: "beginner",
      locale: "az-AZ",
      style: "clear",
      allowedConceptSlugs: allowed,
    });
    expect(result.admitted).toBe(true);
  });

  it("rejects personalized content", () => {
    const named = admitExplanationCache({
      allowCache: true,
      speech: "Aysel, you missed this yesterday.",
      studentName: "Aysel",
      conceptSlug: "web.http",
      difficulty: "beginner",
      locale: "az-AZ",
      style: "clear",
      allowedConceptSlugs: allowed,
    });
    const contextual = admitExplanationCache({
      allowCache: false,
      speech: "HTTP is a request and a response.",
      studentName: "Aysel",
      conceptSlug: "web.http",
      difficulty: "beginner",
      locale: "az-AZ",
      style: "clear",
      allowedConceptSlugs: allowed,
    });
    expect(named).toMatchObject({ admitted: false, reason: "personalized" });
    expect(contextual).toMatchObject({ admitted: false, reason: "personalized" });
  });
});
