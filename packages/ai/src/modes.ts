import {
  PHASE_1_TEACHING_MODES,
  TEACHING_MODES,
  type Phase1TeachingMode,
  type TeachingMode,
} from "@platform/types";

export function isTeachingMode(value: string): value is TeachingMode {
  return (TEACHING_MODES as readonly string[]).includes(value);
}

export function isPhase1TeachingMode(value: TeachingMode): value is Phase1TeachingMode {
  return (PHASE_1_TEACHING_MODES as readonly string[]).includes(value);
}
