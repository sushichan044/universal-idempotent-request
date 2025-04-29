# universal-idempotent-request

A framework-agnostic library implementing the HTTP Idempotency-Key draft ([draft-ietf-httpapi-idempotency-key-header-06](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06)) for server-side request handling.

See [examples](./examples) for sample implementations.

<!-- TOC -->

- [universal-idempotent-request](#universal-idempotent-request)
  - [Core Concepts](#core-concepts)
  - [Installation](#installation)
    - [Framework Integration](#framework-integration)
  - [Important Point](#important-point)
    - [Endpoint implementations that should not use this middleware](#endpoint-implementations-that-should-not-use-this-middleware)
  - [Build your own implementation](#build-your-own-implementation)
  - [Contribution Guide](#contribution-guide)

<!-- /TOC -->

## Core Concepts

- **Framework Agnostic**: powered by [universal-middleware](https://github.com/magne4000/universal-middleware)
- **Easy Installation**: Integrate into existing applications in a minute.
- **Bring your own implementation**: Customizable conditions for enabling idempotency, request identity conditions, etc.

## Installation

Install core package from npm:

```bash
pnpm add universal-idempotent-request
# or
npm install universal-idempotent-request
# or
yarn add universal-idempotent-request
```

### Framework Integration

You must install additional adapters to integrate with frameworks.

See [integration-tests](./integration-tests/) for minimal framework integration.

Framework support status:

- [x] hono
- [x] h3 (only v1 support)
- [x] elysia
- [x] hattip
- [ ] express (May work, but unverified)
- [ ] fastify (May work, but unverified)

As an example, you can start using this middleware in Hono like this:

```ts
import { createMiddleware } from "@universal-middleware/hono";
import { Hono } from "hono";
import { idempotentRequestUniversalMiddleware } from "universal-idempotent-request";

const app = new Hono();

const idempotentRequestMiddleware = createMiddleware(
  idempotentRequestUniversalMiddleware,
);

app.on(["POST", "PATCH"], "/api/*", idempotentRequestMiddleware(
  activationStrategy: "always", // Default behavior
  server: {
    specification: // Bring your own specification
  },
  storage: {
    adapter: // Bring your own specification
  }
  // Hooks are optional. Useful for customizing response.
  hooks: {
    modifyResponse: (response, type) => {
      response.headers.set("X-Idempotency-Status", type);
      return response;
    },
  }
))
```

## Important Point

### Endpoint implementations that should not use this middleware

This middleware may not work correctly with endpoints that use HTTP Streaming, Server-Sent Events (SSE), or WebSocket connections.
These protocols establish long-lived connections that may prevent proper response capturing and storage for idempotent requests.
It is recommended to disable this middleware for such endpoints.

## Build your own implementation

This middleware implements only abstract processing according to Draft.

Therefore, it is necessary to implement and inject the connection to storage, request identity determination, etc.

See `IdempotentRequestImplementation` in [middleware.ts](./src/middleware.ts) for acceptable implementations.

See [examples](./examples/) for sample implementations.

## Contribution Guide

WIP
