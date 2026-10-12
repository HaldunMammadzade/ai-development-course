/** Argon2id memory cost in KiB. 19 MiB, as fixed in the security policy. */
export const ARGON2_MEMORY_KIB = 19 * 1024;

export const ARGON2_TIME_COST = 2;

export const ARGON2_PARALLELISM = 1;

export const SESSION_COOKIE_NAME = "session";

/** Absolute session lifetime from issuance, and the length of a sliding extension. */
export const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

/** A use after this age extends the session. */
export const SESSION_SLIDE_AFTER_MS = 24 * 60 * 60 * 1000;

/** No extension may push expiry past this long after issuance. */
export const SESSION_MAX_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Free plan teacher-turn caps. Enforcement is not part of the curriculum package. */
export const FREE_DAILY_TEACHER_TURNS = 40;

export const FREE_MONTHLY_TEACHER_TURNS = 600;

export const DEFAULT_LOCALE = "az-AZ";

export const DEFAULT_TIMEZONE = "UTC";

export const DEFAULT_EXPLANATION_STYLE = "clear";

export const DEFAULT_CHALLENGE_LEVEL = "adaptive";
