import { HttpException, Inject, Injectable } from "@nestjs/common";
import { getNextAction } from "@platform/curriculum";
import { loadPaymentEnv } from "@platform/config";
import {
  AdminQueryError,
  type AdminAnalytics,
  type AdminWindow,
  type IdentityRepository,
  type StudentDetail,
} from "@platform/database";
import type { NextAction } from "@platform/types";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";
import { ADMIN_ANALYTICS } from "./admin.tokens";

@Injectable()
export class AdminService {
  constructor(
    @Inject(ADMIN_ANALYTICS) private readonly analytics: AdminAnalytics,
    @Inject(IDENTITY_REPOSITORY) private readonly identity: IdentityRepository,
  ) {}

  async overview(adminUserId: string, window: AdminWindow, correlationId: string) {
    const overview = await this.analytics.overview(window);
    await this.record(adminUserId, "overview", null, null, correlationId);
    return {
      range: overview.range,
      students: overview.students,
      learning: overview.learning,
      ai: labeledCost(overview.ai),
      billing: this.billingView(overview.billing),
      funnel: overview.funnel,
      failures: overview.failures,
    };
  }

  async students(
    adminUserId: string,
    input: { query: string; limit: number; cursor: string | null },
    correlationId: string,
  ) {
    try {
      const page = await this.analytics.searchStudents({
        query: input.query,
        limit: input.limit,
        cursor: input.cursor,
      });
      await this.record(adminUserId, "student_search", null, null, correlationId);
      return page;
    } catch (error) {
      if (error instanceof AdminQueryError) {
        throw new HttpException(
          { code: "VALIDATION", message: "The student query is invalid." },
          400,
        );
      }
      throw error;
    }
  }

  async student(adminUserId: string, userId: string, correlationId: string) {
    const detail = await this.analytics.studentDetail(userId);
    if (detail === null) {
      throw new HttpException({ code: "NOT_FOUND", message: "Not found." }, 404);
    }
    const nextAction = await this.nextAction(userId);
    await this.record(adminUserId, "student_detail", "user", userId, correlationId);
    return { student: { ...publicStudent(detail), nextAction } };
  }

  async learning(window: AdminWindow) {
    return this.analytics.learning(window);
  }

  async ai(window: AdminWindow) {
    const report = await this.analytics.ai(window);
    return {
      ...report,
      totals: labeledCost(report.totals),
      speech: {
        ...report.speech,
        costBasis: "stored" as const,
        costAccuracy: "provider_pricing_not_verified" as const,
      },
    };
  }

  async billing(adminUserId: string, window: AdminWindow, correlationId: string) {
    const report = await this.analytics.billing(window);
    await this.record(adminUserId, "billing_inspection", null, null, correlationId);
    return {
      range: report.range,
      plans: report.plans,
      subscriptions: report.subscriptions,
      checkoutAttempts: report.checkoutAttempts,
      processedSubscriptionEvents: report.processedSubscriptionEvents,
      failedPaymentEvents: report.failedPaymentEvents,
      ...this.revenue(report.catalogRecurringMinor),
    };
  }

  async system(adminUserId: string, window: AdminWindow, correlationId: string) {
    const report = await this.analytics.system(window);
    await this.record(adminUserId, "system_inspection", null, null, correlationId);
    return report;
  }

  private billingView(billing: {
    free: number;
    starter: number;
    pro: number;
    premium: number;
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
    expired: number;
    incomplete: number;
    catalogRecurringMinor: number;
  }) {
    return {
      plans: {
        free: billing.free,
        starter: billing.starter,
        pro: billing.pro,
        premium: billing.premium,
      },
      subscriptions: {
        active: billing.active,
        trialing: billing.trialing,
        pastDue: billing.pastDue,
        canceled: billing.canceled,
        expired: billing.expired,
        incomplete: billing.incomplete,
      },
      ...this.revenue(billing.catalogRecurringMinor),
    };
  }

  private revenue(amountMinor: number | null) {
    const configured = loadPaymentEnv(process.env) !== null;
    if (!configured || amountMinor === null) {
      return { paymentConfigured: configured, revenue: null };
    }
    return {
      paymentConfigured: true,
      revenue: { basis: "estimated_catalog" as const, currency: "AZN", amountMinor },
    };
  }

  private async nextAction(userId: string): Promise<NextAction> {
    const context = await this.identity.loadNextActionContext(userId);
    return getNextAction({
      now: new Date(),
      timeZone: context.timeZone,
      homework: context.homework,
      sessions: context.sessions,
      lessons: context.lessons,
      prerequisites: context.prerequisites,
      masteryByConcept: new Map(
        context.mastery.map((row) => [
          row.conceptSlug,
          { score: row.score, evidenceCount: row.evidenceCount },
        ]),
      ),
    });
  }

  private async record(
    adminUserId: string,
    action: string,
    targetType: string | null,
    targetId: string | null,
    correlationId: string,
  ): Promise<void> {
    await this.analytics.audit({ adminUserId, action, targetType, targetId, correlationId });
  }
}

function labeledCost<T extends { costMicros: string }>(totals: T) {
  return { ...totals, costBasis: "stored" as const };
}

function publicStudent(detail: StudentDetail) {
  return {
    id: detail.id,
    email: detail.email,
    name: detail.name,
    status: detail.status,
    verified: detail.verified,
    createdAt: detail.createdAt,
    plan: detail.plan,
    subscription: detail.subscription,
    enrollment: detail.enrollment,
    lessons: detail.lessons,
    mastery: detail.mastery,
    misconceptions: detail.misconceptions,
    exercises: detail.exercises,
    projects: detail.projects,
    interviews: detail.interviews,
    speaking: detail.speaking,
    ai: labeledCost(detail.ai),
  };
}
