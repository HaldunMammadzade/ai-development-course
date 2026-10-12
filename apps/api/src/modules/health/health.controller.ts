import { Controller, Get, HttpException, Inject } from "@nestjs/common";
import type { HealthResponse } from "@platform/types";
import { ReadinessService } from "./readiness.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(ReadinessService) private readonly readiness: ReadinessService) {}

  @Get()
  getHealth(): HealthResponse {
    return { status: "ok" };
  }

  @Get("live")
  live(): HealthResponse {
    return { status: "ok" };
  }

  @Get("ready")
  async ready(): Promise<HealthResponse> {
    const ready = await this.readiness.check();
    if (!ready) {
      throw new HttpException(
        { code: "DATABASE_UNAVAILABLE", message: "The service is not ready." },
        503,
      );
    }
    return { status: "ok" };
  }
}
