export type Racer = ReturnType<typeof createRacer>;

/**
 * Utility for simulating race condition
 * @param serverDelay - delay in milliseconds
 * @returns
 */
export const createRacer = (
  arguments_: Partial<{
    concurrency: number;
    totalDelayOnServer: number;
  }> = {},
) => {
  const concurrency = arguments_.concurrency ?? 1;
  const totalWaitOnServer = arguments_.totalDelayOnServer ?? 1000;

  const clientDelay = totalWaitOnServer / concurrency;

  const waitOnClient = async (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(void 0);
      }, clientDelay);
    });

  const waitOnServer = async (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(void 0);
      }, totalWaitOnServer);
    });

  return {
    /**
     * Await this promise when you want to make concurrent requests.
     *
     * Use this function on second or later request.
     */
    waitOnClient,
    /**
     * Await this promise when you want to simulate server delay
     */
    waitOnServer,
  };
};
