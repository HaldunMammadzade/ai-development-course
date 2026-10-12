import { Injectable } from "@nestjs/common";
import {
  resolveTeachingTransition,
  type TeachingTransitionInput,
  type TeachingTransitionResult,
} from "@platform/curriculum";

@Injectable()
export class TeachingService {
  resolve(input: TeachingTransitionInput): TeachingTransitionResult {
    return resolveTeachingTransition(input);
  }
}
