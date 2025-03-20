import type { Context } from "hono";

/**
 * Wraps the `waitUntil` method of the execution context to ensure that it is safe to use
 * @param context - The context object
 * @param promise - The promise to wait for
 * @returns `true` if the promise was marked as deferred, otherwise the promise itself
 */
export const safeWaitUntil = <T>(
  context: Context,
  promise: Promise<T>,
): true | Promise<T> => {
  try {
    context.executionCtx.waitUntil(promise);
    return true;
  } catch {
    // Execution context is not available in this runtime
    return promise;
  }
};
