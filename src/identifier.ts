import type { IdempotencyFingerprint } from "./brand";
import type { IdempotentRequestServerSpecification } from "./server-specification";

export type RequestIdentifier = {
  /**
   * Request method
   */
  requestMethod: string;

  /**
   * Request path
   */
  requestPath: string;

  /**
   * `Idempotency-Key` header value
   */
  idempotencyKey: string;

  /**
   * Request fingerprint
   *
   * This is used to identify the request in the storage.
   */
  fingerprint: IdempotencyFingerprint | null;
};

export const isIdenticalRequest = (
  target: RequestIdentifier,
  candidate: RequestIdentifier,
): boolean => {
  return (
    target.requestMethod === candidate.requestMethod &&
    target.requestPath === candidate.requestPath &&
    target.idempotencyKey === candidate.idempotencyKey &&
    target.fingerprint === candidate.fingerprint
  );
};

type CreateRequestIdentifierInput = {
  idempotencyKey: string;
  request: Request;
};

export const createRequestIdentifier = async (
  spec: IdempotentRequestServerSpecification,
  input: CreateRequestIdentifierInput,
): Promise<RequestIdentifier> => {
  const fingerprint = await spec.getFingerprint(input.request);
  const requestPath = new URL(input.request.url).pathname;

  return {
    fingerprint,
    idempotencyKey: input.idempotencyKey,
    requestMethod: input.request.method,
    requestPath,
  };
};
