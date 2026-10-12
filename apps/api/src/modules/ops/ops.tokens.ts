export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");
export const JOB_REPOSITORY = Symbol("JOB_REPOSITORY");

export class JobError extends Error {
  constructor(
    readonly code: string,
    readonly permanent: boolean,
  ) {
    super(code);
    this.name = "JobError";
  }
}
