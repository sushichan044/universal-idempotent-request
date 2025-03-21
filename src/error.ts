export class IdempotencyKeyMissingError extends Error {
  constructor() {
    super();
    this.name = "IdempotencyKeyMissingError";
  }
}

export class IdempotencyKeyInvalidError extends Error {
  constructor() {
    super();
    this.name = "IdempotencyKeyInvalidError";
  }
}

export class IdempotencyKeyConflictError extends Error {
  constructor() {
    super();
    this.name = "IdempotencyKeyConflictError";
  }
}

export class IdempotencyKeyFingerprintMismatchError extends Error {
  constructor() {
    super();
    this.name = "IdempotencyKeyFingerprintMismatchError";
  }
}
