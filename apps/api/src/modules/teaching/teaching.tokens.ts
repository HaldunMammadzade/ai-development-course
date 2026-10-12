export const TEACHING_REPOSITORY = Symbol("TEACHING_REPOSITORY");
export const TEACHING_CLOCK = Symbol("TEACHING_CLOCK");
export const TEACHING_MONOTONIC = Symbol("TEACHING_MONOTONIC");

export interface TeachingClock {
  now(): Date;
}

export type MonotonicClock = () => number;
