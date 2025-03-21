export class IdempotencyKeyMissingError extends Error {
  constructor() {
    super();
    this.name = "IdempotencyKeyMissingError";
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

export class IdempotencyKeyStorageError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IdempotencyKeyStorageError";
  }
}
