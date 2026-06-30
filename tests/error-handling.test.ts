// SPDX-License-Identifier: LicenseRef-Vorion-Proprietary
// Copyright 2024-2026 Vorion LLC

/**
 * Error Handling Tests — 10 tests
 *
 * Tests CARError class construction, status checks,
 * client/server error detection, timeout, and detail preservation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CARError, CARClient, createCARClient } from "../src/index.js";

const mockFetch = vi.fn();

describe("CARError", () => {
  // =========================================================================
  // Constructor
  // =========================================================================

  describe("Constructor", () => {
    it("should construct with message, statusCode, and details", () => {
      const details = { field: "agentId", issue: "required" };
      const err = new CARError("Validation failed", 400, details);
      expect(err.message).toBe("Validation failed");
      expect(err.statusCode).toBe(400);
      expect(err.details).toEqual(details);
      expect(err.name).toBe("CARError");
    });

    it("should construct without details", () => {
      const err = new CARError("Not Found", 404);
      expect(err.details).toBeUndefined();
    });

    it("should be an instance of Error", () => {
      const err = new CARError("test", 500);
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(CARError);
    });
  });

  // =========================================================================
  // isStatus
  // =========================================================================

  describe("isStatus()", () => {
    it("should return true for matching status code", () => {
      const err = new CARError("Bad Request", 400);
      expect(err.isStatus(400)).toBe(true);
    });

    it("should return false for non-matching status code", () => {
      const err = new CARError("Bad Request", 400);
      expect(err.isStatus(401)).toBe(false);
      expect(err.isStatus(500)).toBe(false);
    });
  });

  // =========================================================================
  // isClientError
  // =========================================================================

  describe("isClientError()", () => {
    it("should return true for 4xx status codes", () => {
      expect(new CARError("", 400).isClientError()).toBe(true);
      expect(new CARError("", 401).isClientError()).toBe(true);
      expect(new CARError("", 403).isClientError()).toBe(true);
      expect(new CARError("", 404).isClientError()).toBe(true);
      expect(new CARError("", 422).isClientError()).toBe(true);
      expect(new CARError("", 429).isClientError()).toBe(true);
      expect(new CARError("", 499).isClientError()).toBe(true);
    });

    it("should return false for non-4xx status codes", () => {
      expect(new CARError("", 200).isClientError()).toBe(false);
      expect(new CARError("", 301).isClientError()).toBe(false);
      expect(new CARError("", 500).isClientError()).toBe(false);
      expect(new CARError("", 0).isClientError()).toBe(false);
    });
  });

  // =========================================================================
  // isServerError
  // =========================================================================

  describe("isServerError()", () => {
    it("should return true for 5xx status codes", () => {
      expect(new CARError("", 500).isServerError()).toBe(true);
      expect(new CARError("", 502).isServerError()).toBe(true);
      expect(new CARError("", 503).isServerError()).toBe(true);
      expect(new CARError("", 599).isServerError()).toBe(true);
    });

    it("should return false for non-5xx status codes", () => {
      expect(new CARError("", 400).isServerError()).toBe(false);
      expect(new CARError("", 200).isServerError()).toBe(false);
      expect(new CARError("", 0).isServerError()).toBe(false);
    });
  });

  // =========================================================================
  // isTimeout
  // =========================================================================

  describe("isTimeout()", () => {
    it("should return true only for status 408", () => {
      expect(new CARError("Timeout", 408).isTimeout()).toBe(true);
    });

    it("should return false for other status codes", () => {
      expect(new CARError("", 400).isTimeout()).toBe(false);
      expect(new CARError("", 500).isTimeout()).toBe(false);
      expect(new CARError("", 0).isTimeout()).toBe(false);
    });
  });

  // =========================================================================
  // Detail preservation
  // =========================================================================

  describe("Detail preservation", () => {
    it("should preserve complex detail objects", () => {
      const details = {
        error: "Validation failed",
        details: { field: "agentId", issue: "required" },
        meta: { requestId: "req-123" },
      };
      const err = new CARError("Bad Request", 400, details);
      expect(err.details).toEqual(details);
    });
  });

  // =========================================================================
  // Non-CARError from fetch
  // =========================================================================

  describe("Non-CARError thrown by fetch", () => {
    let client: CARClient;

    beforeEach(() => {
      vi.stubGlobal("fetch", mockFetch);
      mockFetch.mockReset();
      client = createCARClient({
        baseUrl: "https://api.test.com",
        apiKey: "key",
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should wrap non-CARError exceptions into CARError with statusCode 0", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      try {
        await client.getStats();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(0);
        expect((err as CARError).message).toBe("ECONNREFUSED");
      }
    });
  });
});
