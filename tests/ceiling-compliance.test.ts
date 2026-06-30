// SPDX-License-Identifier: LicenseRef-Vorion-Proprietary
// Copyright 2024-2026 Vorion LLC

/**
 * Ceiling Compliance Tests (Q1) — 25 tests
 *
 * Tests checkCeiling for each compliance framework, ceiling values,
 * compliance statuses, gaming indicators, ceiling events, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CARClient,
  CARError,
  createCARClient,
  REGULATORY_CEILINGS,
} from "../src/index.js";
import type {
  CeilingCheckResponse,
  ComplianceFramework,
} from "../src/index.js";

const mockFetch = vi.fn();

function ceilingResponse(
  overrides: Partial<{
    agentId: string;
    proposedScore: number;
    finalScore: number;
    effectiveCeiling: number;
    ceilingApplied: boolean;
    complianceStatus: string;
    framework: ComplianceFramework;
    gamingIndicators: string[];
    auditRequired: boolean;
    orgCeiling: number;
    ceilingSource: string;
  }>,
): CeilingCheckResponse {
  const fw = overrides.framework ?? "DEFAULT";
  const ceiling = overrides.effectiveCeiling ?? REGULATORY_CEILINGS[fw];
  return {
    result: {
      agentId: overrides.agentId ?? "agent-1",
      proposedScore: overrides.proposedScore ?? 500,
      finalScore:
        overrides.finalScore ??
        Math.min(overrides.proposedScore ?? 500, ceiling),
      effectiveCeiling: ceiling,
      ceilingSource: (overrides.ceilingSource ?? "regulatory") as
        | "regulatory"
        | "organizational",
      ceilingApplied: overrides.ceilingApplied ?? false,
      complianceStatus: (overrides.complianceStatus ?? "COMPLIANT") as
        | "COMPLIANT"
        | "WARNING"
        | "VIOLATION",
      complianceFramework: fw,
      auditRequired: overrides.auditRequired ?? false,
      gamingIndicators: (overrides.gamingIndicators ?? []) as (
        | "RAPID_CHANGE"
        | "OSCILLATION"
        | "BOUNDARY_TESTING"
        | "CEILING_BREACH"
      )[],
    },
    ceilingDetails: {
      regulatory: { framework: fw, ceiling: REGULATORY_CEILINGS[fw] },
      organizational: { ceiling: overrides.orgCeiling ?? 1000 },
      effective: ceiling,
    },
  };
}

describe("Ceiling Compliance (Q1)", () => {
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

  // =========================================================================
  // Framework-specific ceilings
  // =========================================================================

  describe("EU_AI_ACT framework", () => {
    it("should enforce ceiling of 699", async () => {
      const resp = ceilingResponse({
        framework: "EU_AI_ACT",
        proposedScore: 750,
        finalScore: 699,
        effectiveCeiling: 699,
        ceilingApplied: true,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 750,
        complianceFramework: "EU_AI_ACT",
      });
      expect(result.result.finalScore).toBe(699);
      expect(result.result.ceilingApplied).toBe(true);
    });

    it("should not cap scores under 699", async () => {
      const resp = ceilingResponse({
        framework: "EU_AI_ACT",
        proposedScore: 500,
        finalScore: 500,
        effectiveCeiling: 699,
        ceilingApplied: false,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 500,
        complianceFramework: "EU_AI_ACT",
      });
      expect(result.result.finalScore).toBe(500);
      expect(result.result.ceilingApplied).toBe(false);
    });
  });

  describe("NIST_AI_RMF framework", () => {
    it("should enforce ceiling of 899", async () => {
      const resp = ceilingResponse({
        framework: "NIST_AI_RMF",
        proposedScore: 950,
        finalScore: 899,
        effectiveCeiling: 899,
        ceilingApplied: true,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 950,
        complianceFramework: "NIST_AI_RMF",
      });
      expect(result.result.finalScore).toBe(899);
      expect(result.result.effectiveCeiling).toBe(899);
    });
  });

  describe("ISO_42001 framework", () => {
    it("should enforce ceiling of 799", async () => {
      const resp = ceilingResponse({
        framework: "ISO_42001",
        proposedScore: 850,
        finalScore: 799,
        effectiveCeiling: 799,
        ceilingApplied: true,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 850,
        complianceFramework: "ISO_42001",
      });
      expect(result.result.finalScore).toBe(799);
    });
  });

  describe("DEFAULT framework", () => {
    it("should use ceiling of 1000", async () => {
      const resp = ceilingResponse({
        framework: "DEFAULT",
        proposedScore: 999,
        finalScore: 999,
        effectiveCeiling: 1000,
        ceilingApplied: false,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 999,
        complianceFramework: "DEFAULT",
      });
      expect(result.result.effectiveCeiling).toBe(1000);
      expect(result.result.ceilingApplied).toBe(false);
    });
  });

  // =========================================================================
  // REGULATORY_CEILINGS constant
  // =========================================================================

  describe("REGULATORY_CEILINGS constant", () => {
    it("should have correct values for all frameworks", () => {
      expect(REGULATORY_CEILINGS.EU_AI_ACT).toBe(699);
      expect(REGULATORY_CEILINGS.NIST_AI_RMF).toBe(899);
      expect(REGULATORY_CEILINGS.ISO_42001).toBe(799);
      expect(REGULATORY_CEILINGS.DEFAULT).toBe(1000);
    });
  });

  // =========================================================================
  // Compliance status
  // =========================================================================

  describe("Compliance status", () => {
    it("should return COMPLIANT when score is well under ceiling", async () => {
      const resp = ceilingResponse({
        complianceStatus: "COMPLIANT",
        proposedScore: 300,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 300,
      });
      expect(result.result.complianceStatus).toBe("COMPLIANT");
    });

    it("should return WARNING when score approaches ceiling", async () => {
      const resp = ceilingResponse({
        complianceStatus: "WARNING",
        framework: "EU_AI_ACT",
        proposedScore: 690,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 690,
        complianceFramework: "EU_AI_ACT",
      });
      expect(result.result.complianceStatus).toBe("WARNING");
    });

    it("should return VIOLATION when score exceeds ceiling", async () => {
      const resp = ceilingResponse({
        complianceStatus: "VIOLATION",
        framework: "EU_AI_ACT",
        proposedScore: 750,
        ceilingApplied: true,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 750,
        complianceFramework: "EU_AI_ACT",
      });
      expect(result.result.complianceStatus).toBe("VIOLATION");
    });
  });

  // =========================================================================
  // Gaming indicators
  // =========================================================================

  describe("Gaming indicators", () => {
    it("should report RAPID_CHANGE indicator", async () => {
      const resp = ceilingResponse({ gamingIndicators: ["RAPID_CHANGE"] });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 500,
        previousScore: 100,
      });
      expect(result.result.gamingIndicators).toContain("RAPID_CHANGE");
    });

    it("should report OSCILLATION indicator", async () => {
      const resp = ceilingResponse({ gamingIndicators: ["OSCILLATION"] });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 500,
      });
      expect(result.result.gamingIndicators).toContain("OSCILLATION");
    });

    it("should report BOUNDARY_TESTING indicator", async () => {
      const resp = ceilingResponse({ gamingIndicators: ["BOUNDARY_TESTING"] });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 698,
        complianceFramework: "EU_AI_ACT",
      });
      expect(result.result.gamingIndicators).toContain("BOUNDARY_TESTING");
    });

    it("should report CEILING_BREACH indicator", async () => {
      const resp = ceilingResponse({
        gamingIndicators: ["CEILING_BREACH"],
        ceilingApplied: true,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 900,
        complianceFramework: "EU_AI_ACT",
      });
      expect(result.result.gamingIndicators).toContain("CEILING_BREACH");
    });

    it("should report multiple gaming indicators simultaneously", async () => {
      const resp = ceilingResponse({
        gamingIndicators: ["RAPID_CHANGE", "CEILING_BREACH"],
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 900,
        previousScore: 100,
        complianceFramework: "EU_AI_ACT",
      });
      expect(result.result.gamingIndicators).toHaveLength(2);
    });
  });

  // =========================================================================
  // getCeilingEvents
  // =========================================================================

  describe("getCeilingEvents", () => {
    it("should retrieve ceiling events with pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            events: [{ id: "ce1" }, { id: "ce2" }],
            summary: { total: 2 },
          }),
      });
      const result = await client.getCeilingEvents(undefined, { limit: 2 });
      expect(result.events).toHaveLength(2);
    });

    it("should filter ceiling events by agentId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            events: [{ id: "ce1", agentId: "a-x" }],
            summary: { total: 1 },
          }),
      });
      await client.getCeilingEvents("a-x");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("agentId=a-x");
    });

    it("should include config when requested", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ events: [], summary: {} }),
      });
      await client.getCeilingEvents(undefined, { includeConfig: true });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("includeConfig=true");
    });
  });

  // =========================================================================
  // Organizational ceiling override
  // =========================================================================

  describe("Organizational ceiling override", () => {
    it("should accept organizationalCeiling parameter", async () => {
      const resp = ceilingResponse({
        orgCeiling: 600,
        effectiveCeiling: 600,
        ceilingSource: "organizational",
        ceilingApplied: true,
        finalScore: 600,
        proposedScore: 700,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 700,
        organizationalCeiling: 600,
      });
      expect(result.result.ceilingSource).toBe("organizational");
      expect(result.result.effectiveCeiling).toBe(600);
    });
  });

  // =========================================================================
  // Audit requirements
  // =========================================================================

  describe("Audit requirements", () => {
    it("should indicate audit required for EU_AI_ACT violations", async () => {
      const resp = ceilingResponse({
        framework: "EU_AI_ACT",
        auditRequired: true,
        complianceStatus: "VIOLATION",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 750,
        complianceFramework: "EU_AI_ACT",
      });
      expect(result.result.auditRequired).toBe(true);
    });

    it("should not require audit for compliant scores", async () => {
      const resp = ceilingResponse({
        framework: "EU_AI_ACT",
        auditRequired: false,
        complianceStatus: "COMPLIANT",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.checkCeiling({
        agentId: "a1",
        proposedScore: 300,
        complianceFramework: "EU_AI_ACT",
      });
      expect(result.result.auditRequired).toBe(false);
    });
  });

  // =========================================================================
  // Validation
  // =========================================================================

  describe("Validation", () => {
    it("should reject empty agentId", async () => {
      await expect(
        client.checkCeiling({ agentId: "", proposedScore: 500 }),
      ).rejects.toThrow();
    });

    it("should reject proposedScore over 1000", async () => {
      await expect(
        client.checkCeiling({ agentId: "a1", proposedScore: 1001 }),
      ).rejects.toThrow();
    });

    it("should reject negative proposedScore", async () => {
      await expect(
        client.checkCeiling({ agentId: "a1", proposedScore: -1 }),
      ).rejects.toThrow();
    });
  });
});
