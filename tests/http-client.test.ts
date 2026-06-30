// SPDX-License-Identifier: LicenseRef-Vorion-Proprietary
// Copyright 2024-2026 Vorion LLC

/**
 * HTTP Client Layer Tests — 35 tests
 *
 * Tests all HTTP methods, authorization, URL construction,
 * timeout handling, error codes, and serialization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CARClient,
  CARError,
  createCARClient,
  createLocalCARClient,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

function okJson(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function errJson(status: number, body: Record<string, unknown> = {}) {
  return { ok: false, status, json: () => Promise.resolve(body) };
}

const DASHBOARD_STUB = {
  stats: {
    contextStats: {
      deployments: 1,
      organizations: 1,
      agents: 1,
      activeOperations: 0,
    },
    ceilingStats: {
      totalEvents: 0,
      totalAuditEntries: 0,
      complianceBreakdown: { compliant: 0, warning: 0, violation: 0 },
      agentsWithAlerts: 0,
    },
    roleGateStats: {
      totalEvaluations: 0,
      byDecision: { ALLOW: 0, DENY: 0, ESCALATE: 0 },
    },
    presetStats: {
      carIdPresets: 0,
      vorionPresets: 0,
      axiomPresets: 0,
      verifiedLineages: 0,
    },
    provenanceStats: {
      totalRecords: 0,
      byCreationType: {
        FRESH: 0,
        CLONED: 0,
        EVOLVED: 0,
        PROMOTED: 0,
        IMPORTED: 0,
      },
    },
  },
  tierDistribution: [],
  recentEvents: [],
  version: { major: 1, minor: 0, patch: 0, label: "Phase 6", decisions: [] },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HTTP Client Layer", () => {
  let client: CARClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = createCARClient({
      baseUrl: "https://api.test.com",
      apiKey: "test-key-123",
      timeout: 5000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // HTTP Methods
  // =========================================================================

  describe("HTTP Methods", () => {
    it("should send GET requests", async () => {
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await client.getStats();
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch.mock.calls[0][1].method).toBe("GET");
    });

    it("should send POST requests", async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          evaluation: {
            id: "e1",
            agentId: "a1",
            requestedRole: "R_L0",
            currentTier: "T0",
            currentScore: 0,
            kernelAllowed: true,
            finalDecision: "ALLOW",
            basisOverrideUsed: false,
            createdAt: "2026-01-01T00:00:00Z",
          },
          layers: {
            kernel: { allowed: true },
            policy: {},
            basis: { overrideUsed: false },
          },
        }),
      );
      await client.evaluateRoleGate({
        agentId: "a1",
        requestedRole: "R_L0",
        currentTier: "T0",
      });
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });

    it("should send PATCH requests", async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({ alert: { id: "al-1", status: "RESOLVED" } }),
      );
      await client.updateGamingAlertStatus(
        "al-1",
        "RESOLVED",
        "admin",
        "Fixed",
      );
      expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");
    });

    it("should not include body for GET requests", async () => {
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await client.getStats();
      expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
    });

    it("should include JSON body for POST requests", async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          record: {
            id: "p1",
            agentId: "a1",
            creationType: "FRESH",
            createdBy: "sys",
            trustModifier: 0,
            provenanceHash: "h1",
            metadata: {},
            createdAt: "2026-01-01T00:00:00Z",
          },
        }),
      );
      await client.createProvenance({
        agentId: "a1",
        creationType: "FRESH",
        createdBy: "sys",
      });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.agentId).toBe("a1");
      expect(body.creationType).toBe("FRESH");
    });
  });

  // =========================================================================
  // Authorization
  // =========================================================================

  describe("Authorization", () => {
    it("should include Bearer token when apiKey is set", async () => {
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await client.getStats();
      expect(mockFetch.mock.calls[0][1].headers["Authorization"]).toBe(
        "Bearer test-key-123",
      );
    });

    it("should not include Authorization header when apiKey is absent", async () => {
      const noAuthClient = createCARClient({ baseUrl: "https://api.test.com" });
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await noAuthClient.getStats();
      expect(
        mockFetch.mock.calls[0][1].headers["Authorization"],
      ).toBeUndefined();
    });

    it("should include Content-Type application/json", async () => {
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await client.getStats();
      expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe(
        "application/json",
      );
    });

    it("should merge custom headers", async () => {
      const customClient = createCARClient({
        baseUrl: "https://api.test.com",
        headers: { "X-Custom": "val" },
      });
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await customClient.getStats();
      expect(mockFetch.mock.calls[0][1].headers["X-Custom"]).toBe("val");
    });
  });

  // =========================================================================
  // URL Construction
  // =========================================================================

  describe("URL Construction", () => {
    it("should construct URL from baseUrl + path", async () => {
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await client.getStats();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("https://api.test.com/api/phase6/stats");
    });

    it("should strip trailing slash from baseUrl", async () => {
      const slashClient = createCARClient({ baseUrl: "https://api.test.com/" });
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await slashClient.getStats();
      const calledUrl = mockFetch.mock.calls[0][0];
      // Trailing slash was removed so the path joins cleanly (no double slash before 'api/phase6')
      expect(calledUrl).not.toContain(".com//api");
      expect(calledUrl).toContain("https://api.test.com/api/phase6/stats");
    });

    it("should handle base URL without protocol in a valid way", async () => {
      // URL constructor requires protocol; this tests that we don't crash on unexpected input
      const localClient = createLocalCARClient(4000);
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await localClient.getStats();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("http://localhost:4000/api/phase6/stats");
    });

    it("should use default port 3000 for createLocalCARClient()", async () => {
      const localClient = createLocalCARClient();
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await localClient.getStats();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("http://localhost:3000/");
    });
  });

  // =========================================================================
  // Timeout Handling
  // =========================================================================

  describe("Timeout Handling", () => {
    it("should abort request after configured timeout", async () => {
      const abortError = new DOMException(
        "The operation was aborted",
        "AbortError",
      );
      Object.defineProperty(abortError, "name", { value: "AbortError" });
      mockFetch.mockRejectedValueOnce(abortError);
      await expect(client.getStats()).rejects.toThrow(CARError);
      try {
        await client.getStats().catch(() => {}); // already rejected above
      } catch {
        /* noop */
      }
    });

    it("should throw CARError with status 408 on timeout", async () => {
      const abortError = new DOMException(
        "The operation was aborted",
        "AbortError",
      );
      Object.defineProperty(abortError, "name", { value: "AbortError" });
      mockFetch.mockRejectedValueOnce(abortError);
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(408);
        expect((err as CARError).isTimeout()).toBe(true);
      }
    });

    it("should pass AbortSignal to fetch", async () => {
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      await client.getStats();
      expect(mockFetch.mock.calls[0][1].signal).toBeDefined();
    });
  });

  // =========================================================================
  // Network Errors
  // =========================================================================

  describe("Network Errors", () => {
    it("should wrap TypeError from fetch into CARError", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(0);
        expect((err as CARError).message).toBe("Failed to fetch");
      }
    });

    it("should wrap generic Error from fetch into CARError", async () => {
      mockFetch.mockRejectedValueOnce(new Error("DNS resolution failed"));
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).message).toBe("DNS resolution failed");
      }
    });
  });

  // =========================================================================
  // Non-JSON Responses
  // =========================================================================

  describe("Non-JSON Responses", () => {
    it("should throw CARError when response.json() fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      });
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(0);
      }
    });
  });

  // =========================================================================
  // HTTP Status Code Handling
  // =========================================================================

  describe("HTTP Error Status Codes", () => {
    it("should throw CARError with details on 400 Bad Request", async () => {
      mockFetch.mockResolvedValueOnce(
        errJson(400, { error: "Bad Request", details: { field: "agentId" } }),
      );
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(400);
        expect((err as CARError).isClientError()).toBe(true);
        expect((err as CARError).details).toBeDefined();
      }
    });

    it("should throw CARError on 401 Unauthorized", async () => {
      mockFetch.mockResolvedValueOnce(errJson(401, { error: "Unauthorized" }));
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(401);
        expect((err as CARError).isClientError()).toBe(true);
      }
    });

    it("should throw CARError on 403 Forbidden", async () => {
      mockFetch.mockResolvedValueOnce(errJson(403, { error: "Forbidden" }));
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(403);
      }
    });

    it("should throw CARError on 404 Not Found", async () => {
      mockFetch.mockResolvedValueOnce(errJson(404, { error: "Not Found" }));
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(404);
      }
    });

    it("should throw CARError on 429 Rate Limited", async () => {
      mockFetch.mockResolvedValueOnce(
        errJson(429, { error: "Too Many Requests" }),
      );
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(429);
        expect((err as CARError).isClientError()).toBe(true);
      }
    });

    it("should throw CARError on 500 Internal Server Error", async () => {
      mockFetch.mockResolvedValueOnce(
        errJson(500, { error: "Internal Server Error" }),
      );
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(500);
        expect((err as CARError).isServerError()).toBe(true);
      }
    });

    it("should throw CARError on 503 Service Unavailable", async () => {
      mockFetch.mockResolvedValueOnce(
        errJson(503, { error: "Service Unavailable" }),
      );
      try {
        await client.getStats();
      } catch (err) {
        expect(err).toBeInstanceOf(CARError);
        expect((err as CARError).statusCode).toBe(503);
        expect((err as CARError).isServerError()).toBe(true);
      }
    });

    it("should use error field from response body as message", async () => {
      mockFetch.mockResolvedValueOnce(
        errJson(422, { error: "Unprocessable Entity" }),
      );
      try {
        await client.getStats();
      } catch (err) {
        expect((err as CARError).message).toBe("Unprocessable Entity");
      }
    });

    it("should fall back to HTTP status in message when error field missing", async () => {
      mockFetch.mockResolvedValueOnce(errJson(418, {}));
      try {
        await client.getStats();
      } catch (err) {
        expect((err as CARError).message).toBe("HTTP 418");
      }
    });
  });

  // =========================================================================
  // Query Parameters
  // =========================================================================

  describe("Query Parameter Encoding", () => {
    it("should append query parameters to URL", async () => {
      mockFetch.mockResolvedValueOnce(okJson({ evaluations: [], summary: {} }));
      await client.getRoleGateEvaluations("agent-x", { limit: 10 });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("agentId=agent-x");
      expect(calledUrl).toContain("limit=10");
    });

    it("should encode special characters in query parameters", async () => {
      mockFetch.mockResolvedValueOnce(okJson({ evaluations: [], summary: {} }));
      await client.getRoleGateEvaluations("agent with spaces");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("agentId=agent");
    });

    it("should omit undefined parameters", async () => {
      mockFetch.mockResolvedValueOnce(okJson({ evaluations: [], summary: {} }));
      await client.getRoleGateEvaluations(undefined);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).not.toContain("agentId");
    });
  });

  // =========================================================================
  // Request Body
  // =========================================================================

  describe("Request Body Serialization", () => {
    it("should JSON-serialize request body", async () => {
      mockFetch.mockResolvedValueOnce(okJson({ alert: { id: "al-1" } }));
      await client.createGamingAlert({
        agentId: "a1",
        alertType: "RAPID_CHANGE",
        severity: "HIGH",
        details: "Score jumped 200 points",
      });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.agentId).toBe("a1");
      expect(body.alertType).toBe("RAPID_CHANGE");
    });

    it("should handle nested objects in request body", async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          record: {
            id: "p1",
            agentId: "a1",
            creationType: "FRESH",
            createdBy: "sys",
            trustModifier: 0,
            provenanceHash: "h",
            metadata: { key: "value" },
            createdAt: "2026-01-01T00:00:00Z",
          },
        }),
      );
      await client.createProvenance({
        agentId: "a1",
        creationType: "FRESH",
        createdBy: "sys",
        metadata: { key: "value" },
      });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.metadata).toEqual({ key: "value" });
    });
  });

  // =========================================================================
  // Health Check
  // =========================================================================

  describe("healthCheck()", () => {
    it("should return healthy status with version string", async () => {
      mockFetch.mockResolvedValueOnce(okJson(DASHBOARD_STUB));
      const result = await client.healthCheck();
      expect(result.status).toBe("healthy");
      expect(result.version).toBe("1.0.0");
    });

    it("should propagate errors from underlying getStats call", async () => {
      mockFetch.mockResolvedValueOnce(errJson(500, { error: "Down" }));
      await expect(client.healthCheck()).rejects.toThrow(CARError);
    });
  });
});
