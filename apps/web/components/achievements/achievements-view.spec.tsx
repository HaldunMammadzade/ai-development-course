import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AchievementList } from "@platform/types";
import { copy } from "@/lib/copy";
import { AchievementsView } from "./achievements-view";

const empty: AchievementList = {
  items: [
    {
      id: "first-lesson",
      title: "İlk addım",
      description: "İlk dərsi tamamladın",
      category: "learning",
      state: "locked",
      earnedAt: null,
    },
  ],
  earnedCount: 0,
  latest: null,
};

describe("achievements view", () => {
  it("teaches a new learner what will appear and keeps locked status in text", () => {
    const html = renderToStaticMarkup(
      createElement(AchievementsView, { list: empty, timeZone: "Asia/Baku" }),
    );
    expect(html).toContain(copy.achievements.empty);
    expect(html).toContain(copy.achievements.emptyBody);
    expect(html).toContain(copy.achievements.locked);
    expect(html).toContain("İlk addım");
    expect(html).not.toContain("0 achievements");
    expect(html).not.toContain("%");
  });

  it("shows an earned milestone with its real date", () => {
    const html = renderToStaticMarkup(
      createElement(AchievementsView, {
        timeZone: "Asia/Baku",
        list: {
          earnedCount: 1,
          latest: null,
          items: [
            {
              id: "css-foundations",
              title: "CSS əsasları",
              description: "CSS əsaslarını tamamladın",
              category: "skill",
              state: "earned",
              earnedAt: "2026-10-08T08:00:00.000Z",
            },
          ],
        },
      }),
    );
    expect(html).toContain("CSS əsasları");
    expect(html).toContain(copy.achievements.earned);
    expect(html).toContain("oktyabr");
    expect(html).not.toContain(copy.achievements.empty);
  });
});
