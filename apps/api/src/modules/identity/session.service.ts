import { Inject, Injectable } from "@nestjs/common";
import {
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_MS,
  SESSION_MAX_LIFETIME_MS,
  SESSION_SLIDE_AFTER_MS,
  type NodeEnv,
} from "@platform/config";
import type { IdentityRepository } from "@platform/database";
import { IDENTITY_REPOSITORY } from "./identity.repository";
import { createOpaqueToken, hashOpaqueToken } from "./opaque-token";

export const SESSION_CONTEXT = Symbol("SESSION_CONTEXT");

export interface SessionContext {
  nodeEnv: NodeEnv;
  cookieDomain?: string;
}

export interface SessionCookie {
  name: typeof SESSION_COOKIE_NAME;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    expires: Date;
    domain?: string;
  };
}

export interface CreatedSession {
  sessionId: string;
  token: string;
  expiresAt: Date;
  cookie: SessionCookie;
}

export interface ResolvedSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  lastUsedAt: Date;
}

export class SessionRejectedError extends Error {
  readonly reason: "missing" | "expired" | "revoked" | "disabled";

  constructor(reason: SessionRejectedError["reason"]) {
    super("Session is not valid.");
    this.name = "SessionRejectedError";
    this.reason = reason;
  }
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(IDENTITY_REPOSITORY) private readonly repository: IdentityRepository,
    @Inject(SESSION_CONTEXT) private readonly context: SessionContext,
  ) {}

  async createSession(userId: string, now = new Date()): Promise<CreatedSession> {
    const token = createOpaqueToken();
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
    const session = await this.repository.insertSession({
      userId,
      tokenHash: hashOpaqueToken(token),
      expiresAt,
      createdAt: now,
    });

    return {
      sessionId: session.id,
      token,
      expiresAt,
      cookie: this.cookie(token, expiresAt),
    };
  }

  async resolveSession(token: string, now = new Date()): Promise<ResolvedSession> {
    const session = await this.repository.findSessionByTokenHash(hashOpaqueToken(token));
    if (session === null) {
      throw new SessionRejectedError("missing");
    }
    if (session.revokedAt !== null) {
      throw new SessionRejectedError("revoked");
    }
    if (session.expiresAt.getTime() <= now.getTime()) {
      throw new SessionRejectedError("expired");
    }
    if (session.userStatus !== "active") {
      throw new SessionRejectedError("disabled");
    }

    const expiresAt = extendedExpiry(session.createdAt, session.expiresAt, now);
    const updated = await this.repository.updateSessionActivity({
      sessionId: session.id,
      lastUsedAt: now,
      expiresAt,
    });

    return {
      sessionId: updated.id,
      userId: updated.userId,
      expiresAt: updated.expiresAt,
      lastUsedAt: updated.lastUsedAt,
    };
  }

  async revokeSession(sessionId: string, now = new Date()): Promise<void> {
    await this.repository.revokeSession(sessionId, now);
  }

  async revokeByToken(token: string, now = new Date()): Promise<void> {
    if (token.length === 0) {
      return;
    }
    await this.repository.revokeSessionByTokenHash(hashOpaqueToken(token), now);
  }

  blankCookie(): SessionCookie {
    return this.cookie("", new Date(0));
  }

  private cookie(token: string, expiresAt: Date): SessionCookie {
    const domain = this.context.cookieDomain;
    return {
      name: SESSION_COOKIE_NAME,
      value: token,
      options: {
        httpOnly: true,
        secure: this.context.nodeEnv === "production",
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
        ...(domain === undefined ? {} : { domain }),
      },
    };
  }
}

function extendedExpiry(createdAt: Date, expiresAt: Date, now: Date): Date {
  if (now.getTime() - createdAt.getTime() <= SESSION_SLIDE_AFTER_MS) {
    return expiresAt;
  }

  const slid = now.getTime() + SESSION_LIFETIME_MS;
  const cap = createdAt.getTime() + SESSION_MAX_LIFETIME_MS;
  return new Date(Math.min(slid, cap));
}
