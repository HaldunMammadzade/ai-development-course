import { HttpException, Inject, Injectable } from "@nestjs/common";
import {
  ASSESSMENT_ITEM_LIMIT,
  assessmentItemById,
  placeAssessment,
  projectAssessmentMastery,
  selectAssessmentItem,
} from "@platform/curriculum";
import { AssessmentRuleError, type AssessmentRepository } from "@platform/database";
import type { AssessmentAnswerInput } from "@platform/validation";
import type { AssessmentView } from "@platform/types";
import { ASSESSMENT_REPOSITORY } from "./assessment.tokens";

@Injectable()
export class AssessmentService {
  constructor(
    @Inject(ASSESSMENT_REPOSITORY) private readonly assessments: AssessmentRepository,
  ) {}

  async view(userId: string, now = new Date()): Promise<AssessmentView> {
    let state = await this.assessments.availability(userId);
    if (state.kind === "in_progress") {
      await this.assessments.begin(userId, now);
      state = await this.assessments.availability(userId);
    }
    return present(state);
  }

  async answer(userId: string, input: AssessmentAnswerInput, now = new Date()): Promise<AssessmentView> {
    try {
      await this.assessments.answer({
        userId,
        itemId: input.itemId,
        submission: input.answer,
        clientAttemptId: input.clientAttemptId,
        now,
      });
    } catch (error) {
      throw asHttp(error);
    }
    return this.view(userId, now);
  }

  async skip(userId: string, now = new Date()): Promise<AssessmentView> {
    try {
      await this.assessments.skip(userId, now);
    } catch (error) {
      throw asHttp(error);
    }
    return this.view(userId, now);
  }
}

function present(
  state: Awaited<ReturnType<AssessmentRepository["availability"]>>,
): AssessmentView {
  if (state.kind === "not_required" || state.kind === "skipped") {
    return {
      status: state.kind,
      answered: 0,
      limit: ASSESSMENT_ITEM_LIMIT,
      item: null,
      previous: null,
      result: null,
    };
  }
  const marks = state.answers.map((answer) => ({ itemId: answer.itemId, passed: answer.passed }));
  const current = state.kind === "completed" ? null : selectAssessmentItem(marks);
  const last = state.answers.at(-1);
  const lastItem = last === undefined ? null : assessmentItemById(last.itemId);
  const mastery = projectAssessmentMastery({
    answers: state.answers.map((answer) => ({
      itemId: answer.itemId,
      passed: answer.passed,
      at: answer.createdAt,
    })),
    now: new Date(),
    timeZone: state.graph.timeZone,
  });
  const placement =
    state.kind === "completed"
      ? placeAssessment({
          lessons: state.graph.lessons,
          prerequisites: state.graph.prerequisites,
          mastery,
        })
      : null;
  return {
    status: state.kind,
    answered: state.answers.length,
    limit: ASSESSMENT_ITEM_LIMIT,
    item:
      current === null
        ? null
        : {
            id: current.id,
            kind: current.kind,
            prompt: current.prompt,
            options: current.options.map((option) => ({ id: option.id, label: option.label })),
          },
    previous:
      last === undefined || lastItem === null || state.kind === "completed"
        ? null
        : {
            prompt: lastItem.prompt,
            submission:
              lastItem.options.find((option) => option.id === last.submission)?.label ??
              last.submission,
            passed: last.passed,
          },
    result:
      placement === null
        ? null
        : {
            label: placement.label,
            lesson:
              placement.start === null
                ? null
                : {
                    slug: placement.start.slug,
                    title: placement.start.title,
                    moduleTitle: placement.start.moduleTitle,
                  },
            known: notes(mastery, state.graph.names, "known"),
            gaps: notes(mastery, state.graph.names, "gap"),
          },
  };
}

function notes(
  mastery: Map<string, { score: number; evidenceCount: number }>,
  names: Map<string, string>,
  kind: "known" | "gap",
): Array<{ name: string; weak: boolean }> {
  const rows = [...mastery.entries()]
    .filter(([, row]) => (kind === "known" ? row.score >= 60 : row.score < 60))
    .map(([slug, row]) => ({
      name: names.get(slug) ?? slug,
      weak: row.score < 45 && row.evidenceCount >= 2,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "az"));
  if (kind === "known") {
    return rows.map((row) => ({ name: row.name, weak: false }));
  }
  return rows;
}

function asHttp(error: unknown): Error {
  if (error instanceof AssessmentRuleError) {
    return new HttpException({ code: error.code, message: error.message }, error.status);
  }
  return error instanceof Error ? error : new Error("Assessment failed.");
}
