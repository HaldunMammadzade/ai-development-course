import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { IdentityRepository } from "@platform/database";
import { currentUser } from "../auth/current-user";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";

const HIDDEN = new HttpException({ code: "NOT_FOUND", message: "Not found." }, 404);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(IDENTITY_REPOSITORY) private readonly identity: IdentityRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = currentUser(context.switchToHttp().getRequest());
    if (user.emailVerifiedAt === null || user.status !== "active") {
      throw HIDDEN;
    }
    const role = await this.identity.accountRole(user.id);
    if (role !== "admin") {
      throw HIDDEN;
    }
    return true;
  }
}
