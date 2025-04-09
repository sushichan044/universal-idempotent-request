# Simple API Sample with hono-idempotent-request

This sample provides a simple account management API that implements idempotent requests using hono-idempotent-request.

## Overview

This API includes the following endpoints:

- Account balance inquiry: `GET /api/account/:id`
- Deposit processing: `POST /api/account/:id/deposit`
- Withdrawal processing: `POST /api/account/:id/withdraw`

All POST / PATCH / PUT API endpoints support the `Idempotency-Key` header,
ensuring that requests with the same key will not result in duplicate processing.

## API Documentation

Swagger UI is available.

Start local server and visit `/`.

## Server Startup

```bash
pnpm install
pnpm dev
```
