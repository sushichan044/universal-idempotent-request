import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProcessedIdempotentRequest,
  ProcessingIdempotentRequest,
  UnProcessedIdempotentRequest,
} from "../idempotent-request";
import type { SerializedResponse } from "../serializer";

import { createStorageKey } from "../brand";
import { IdempotencyKeyStorageError } from "../error";
import { createIdempotentRequestStorage } from "./index";

const fakeDriver = {
  get: vi.fn(),
  save: vi.fn(),
};

describe("createIdempotentRequestStorage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:01:00.000Z")); // Consistent lockedAt
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const storage = createIdempotentRequestStorage(fakeDriver);

  const baseRequest: UnProcessedIdempotentRequest = {
    fingerprint: null,
    idempotencyKey: "cd4e21a0-f506-4ca3-a825-522a28bf7165",
    lockedAt: null,
    requestMethod: "POST",
    requestPath: "/test",
    response: null,
    storageKey: createStorageKey("test-key"),
  };

  describe("acquireLock", () => {
    it("should acquire a lock and save the processing request", async () => {
      const lockedRequest = await storage.acquireLock(baseRequest);

      expect(lockedRequest).toStrictEqual({
        ...baseRequest,
        lockedAt: new Date("2024-01-01T00:01:00.000Z"),
      });
    });

    it("should throw IdempotencyKeyStorageError if driver.save fails", async () => {
      const driverError = new Error("Driver save failed");
      fakeDriver.save.mockRejectedValue(driverError);

      await expect(storage.acquireLock(baseRequest)).rejects.toThrowError(
        new IdempotencyKeyStorageError(
          `Failed to acquire a lock for the stored idempotent request: ${baseRequest.storageKey}`,
          { cause: driverError },
        ),
      );
      expect(fakeDriver.save).toHaveBeenCalledOnce();
    });
  });

  describe("findOrCreate", () => {
    const response: SerializedResponse = {
      body: '{"id": 123}',
      headers: { location: "/new-resource" },
      status: 201,
    };

    it("should early return with cached request if already processed", async () => {
      const existingRequest: ProcessedIdempotentRequest = {
        ...baseRequest,
        response,
      };
      fakeDriver.get.mockResolvedValue(existingRequest);

      const result = await storage.findOrCreate(baseRequest);

      expect(result).toStrictEqual({
        created: false,
        request: existingRequest,
      });
      expect(fakeDriver.save).not.toHaveBeenCalled();
    });

    it("should create and save a new unprocessed request if not found", async () => {
      const expectedNewRequest: UnProcessedIdempotentRequest = {
        ...baseRequest,
        lockedAt: null,
        response: null,
      };
      fakeDriver.get.mockResolvedValue(null);

      const result = await storage.findOrCreate(baseRequest);

      expect(result).toStrictEqual({
        created: true,
        request: expectedNewRequest,
      });
    });

    it("should throw IdempotencyKeyStorageError if driver.get fails", async () => {
      const driverError = new Error("Driver get failed");
      fakeDriver.get.mockRejectedValue(driverError);

      await expect(storage.findOrCreate(baseRequest)).rejects.toThrowError(
        new IdempotencyKeyStorageError(
          `Failed to find or create the stored idempotent request: ${baseRequest.storageKey}`,
          { cause: driverError },
        ),
      );
    });

    it("should throw IdempotencyKeyStorageError if driver.save fails", async () => {
      const driverError = new Error("Driver save failed");
      fakeDriver.save.mockRejectedValue(driverError);

      await expect(storage.findOrCreate(baseRequest)).rejects.toThrowError(
        new IdempotencyKeyStorageError(
          `Failed to find or create the stored idempotent request: ${baseRequest.storageKey}`,
          { cause: driverError },
        ),
      );
    });
  });

  describe("setResponseAndUnlock", () => {
    const processingRequest: ProcessingIdempotentRequest = {
      ...baseRequest,
      lockedAt: new Date("2024-01-01T00:01:00.000Z"),
      response: null,
    };

    const response: SerializedResponse = {
      body: '{"id": 123}',
      headers: { location: "/new-resource" },
      status: 201,
    };

    it("should set the response, unlock the request, and save", async () => {
      await storage.setResponseAndUnlock(processingRequest, response);

      expect(fakeDriver.save).toHaveBeenCalledExactlyOnceWith({
        ...processingRequest,
        lockedAt: null,
        response,
      });
    });

    it("should throw IdempotencyKeyStorageError if driver.save fails", async () => {
      const driverError = new Error("Driver save failed");
      fakeDriver.save.mockRejectedValue(driverError);

      await expect(
        storage.setResponseAndUnlock(processingRequest, response),
      ).rejects.toThrowError(
        new IdempotencyKeyStorageError(
          `Failed to save the response of an idempotent request: ${processingRequest.storageKey}. You should unlock the request manually.`,
          { cause: driverError },
        ),
      );
      expect(fakeDriver.save).toHaveBeenCalledOnce();
    });
  });
});
