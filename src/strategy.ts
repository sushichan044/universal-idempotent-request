import type { HonoRequest } from "hono";

import type { MaybePromise } from "./utils/types";

import { isNonEmptyString } from "./utils/string";

/**
 * Function type for defining the condition for activating idempotency processing
 *
 * Receives a request object and returns a boolean indicating whether to apply idempotency processing
 *
 * Return `true` to activate idempotency processing, `false` otherwise
 */
type IdempotencyActivationStrategyFunction = (
  request: HonoRequest,
) => MaybePromise<boolean>;

/**
 * Strategy for activating idempotency processing
 *
 * @default "always"
 */
export type IdempotencyActivationStrategy =
  | "always"
  | "opt-in"
  | IdempotencyActivationStrategyFunction;

/**
 * Convert strategy to function type
 *
 * If specified as a string, convert to the corresponding function,
 * and if specified as a function, return it as is
 */
export const prepareActivationStrategy = (
  strategy: IdempotencyActivationStrategy = "always",
): IdempotencyActivationStrategyFunction => {
  if (typeof strategy === "function") {
    return strategy;
  }

  if (strategy === "opt-in") {
    return OPT_IN_WITH_KEY;
  }

  return ALWAYS_ACTIVE;
};

/**
 * Strategy for always applying idempotency processing
 */
const ALWAYS_ACTIVE = (() =>
  true) satisfies IdempotencyActivationStrategyFunction;

/**
 * Strategy for applying idempotency processing only if the Idempotency-Key header exists
 */
const OPT_IN_WITH_KEY: IdempotencyActivationStrategyFunction = (request) =>
  isNonEmptyString(request.header("Idempotency-Key"));
