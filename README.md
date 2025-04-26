# universal-idempotent-request

A framework-agnostic library implementing the HTTP Idempotency-Key draft ([draft-ietf-httpapi-idempotency-key-header-06](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06)) for server-side request handling.

<!-- TOC -->

- [universal-idempotent-request](#universal-idempotent-request)
  - [Core Concepts](#core-concepts)
  - [Installation](#installation)
  - [Build your own implementation](#build-your-own-implementation)
    - [IdempotentRequestServerSpecification](#idempotentrequestserverspecification)
  - [Guides for each framework](#guides-for-each-framework)
    - [Hono](#hono)
  - [Contribution Guide](#contribution-guide)

<!-- /TOC -->

## Core Concepts

- **Easy Installation**: Integrate into existing applications in a minute.
- **Bring your own implementation**: Customizable conditions for enabling idempotency, request identity conditions, etc.

## Installation

> [!WARNING]
> You must install additional per-framework adapters.
>
> See [Guides for each framework](#guides-for-each-framework).

Install core package from npm:

```bash
pnpm add universal-idempotent-request
# or
npm install universal-idempotent-request
# or
yarn add universal-idempotent-request
```

## Build your own implementation

To use this middleware, these interfaces must be implemented.

```ts
/**
 * Specification - defines key validation and request digest generation.
 *
 * @see Section 2.2, 2.3, 2.4 of {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2}
 */
interface IdempotentRequestServerSpecification {
  /**
   * Get a fingerprint from the request's payload.
   *
   * Just return `null` if you don't use fingerprint for identifying the request.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.4 Idempotency Fingerprint}
   *
   * @param request
   * Web-standard request object
   * @returns
   * A fingerprint string representing the uniqueness of the request.
   * Returning `null` means this server specification does not use fingerprint.
   */
  getFingerprint(request: Request): MaybePromise<string | null>;
  /**
   * Get a key for searching the request in the storage.
   * This key should be unique in the storage.
   *
   * If there are no special considerations, just return the value of the `Idempotency-Key` header.
   *
   * Existence of `Idempotency-Key` header is already guaranteed by the middleware.
   *
   * YOU MUST INCLUDE THE VALUE OF THE `Idempotency-Key` HEADER IN THE STORAGE KEY.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-5 Security Considerations}
   *
   * @param source
   * Object containing idempotencyKey and request
   * @returns
   * A key that is used to retrieve the request from the storage.
   */
  getStorageKey(source: GetStorageKeySource): MaybePromise<string>;
  /**
   * Check if the idempotency key satisfies the server-defined specifications
   *
   * If the key does not satisfy the specifications, the request will be processed without idempotency.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.5.2 Responsibilities - Resource}
   *
   * @param idempotencyKey
   * The `Idempotency-Key` header from the request
   * @returns
   * Whether the key satisfies the server-defined specifications
   */
  satisfiesKeySpec(idempotencyKey: string): boolean;
}
```

### IdempotentRequestServerSpecification

```ts
/**
 * Storage for idempotent request records.
 *
 * You should implement features like TTL, cleanup, etc. at this layer.
 */
interface IdempotentRequestStorageDriver {
  /**
   * Get a stored request.
   *
   * @param storageKey
   * The storage key of the request.
   * @returns
   * Stored request or `null` if the request is not found.
   */
  get(storageKey: StorageKey): MaybePromise<IdempotentRequest | null>;
  /**
   * Save a request.
   *
   * @param request
   * The request to save.
   */
  save(request: IdempotentRequest): MaybePromise<void>;
}
```

## Guides for each framework

### Hono

```bash
pnpm add @universal-middleware/hono
```

```ts
import { createMiddleware } from "@universal-middleware/hono";
import { Hono } from "hono";
import { idempotentRequestUniversalMiddleware } from "universal-idempotent-request";

const app = new Hono();

const idempotentRequestMiddleware = createMiddleware(idempotentRequestUniversalMiddleware)

app.on(
  ["POST", "PUT", "PATCH"],
  "/api/*",
  idempotentRequestMiddleware({
    server: {
      specification: // Bring your own server specification
    },
    storage: {
      driver: // Bring your own driver
    }
  })
);

// ... Your API
```

## Contribution Guide

WIP
