// SPDX-License-Identifier: LicenseRef-Vorion-Proprietary
// Copyright 2024-2026 Vorion LLC

/**
 * Provenance Tests (Q5) — 10 tests
 *
 * Tests provenance creation for each type, lineage retrieval,
 * parent agent references, hash chaining, and empty state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CARClient,
  createCARClient,
  DEFAULT_PROVENANCE_MODIFIERS,
} from "../src/index.js";
import type { Provenance, CreationType } from "../src/index.js";

const mockFetch = vi.fn();

function provenanceRecord(
  type: CreationType,
  overrides: Partial<Provenance> = {},
): Provenance {
  return {
    id: `prov-${type.toLowerCase()}`,
    agentId: overrides.agentId ?? "agent-1",
    creationType: type,
    parentAgentId: overrides.parentAgentId,
    createdBy: overrides.createdBy ?? "system",
    trustModifier: DEFAULT_PROVENANCE_MODIFIERS[type],
    provenanceHash: overrides.provenanceHash ?? `hash-${type.toLowerCase()}`,
    parentProvenanceHash: overrides.parentProvenanceHash,
    metadata: overrides.metadata ?? {},
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("Provenance (Q5)", () => {
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
  // createProvenance per type
  // =========================================================================

  describe("createProvenance per creation type", () => {
    it("should create FRESH provenance with +0 modifier", async () => {
      const record = provenanceRecord("FRESH");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ record }),
      });
      const result = await client.createProvenance({
        agentId: "agent-1",
        creationType: "FRESH",
        createdBy: "system",
      });
      expect(result.record.creationType).toBe("FRESH");
      expect(result.record.trustModifier).toBe(0);
    });

    it("should create CLONED provenance with -50 modifier", async () => {
      const record = provenanceRecord("CLONED", {
        parentAgentId: "agent-parent",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ record }),
      });
      const result = await client.createProvenance({
        agentId: "agent-clone",
        creationType: "CLONED",
        createdBy: "admin",
        parentAgentId: "agent-parent",
      });
      expect(result.record.trustModifier).toBe(-50);
    });

    it("should create EVOLVED provenance with +100 modifier", async () => {
      const record = provenanceRecord("EVOLVED", { parentAgentId: "agent-v1" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ record }),
      });
      const result = await client.createProvenance({
        agentId: "agent-v2",
        creationType: "EVOLVED",
        createdBy: "system",
        parentAgentId: "agent-v1",
      });
      expect(result.record.trustModifier).toBe(100);
    });

    it("should create PROMOTED provenance with +150 modifier", async () => {
      const record = provenanceRecord("PROMOTED", {
        parentAgentId: "agent-base",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ record }),
      });
      const result = await client.createProvenance({
        agentId: "agent-promoted",
        creationType: "PROMOTED",
        createdBy: "admin",
        parentAgentId: "agent-base",
      });
      expect(result.record.trustModifier).toBe(150);
    });

    it("should create IMPORTED provenance with -100 modifier", async () => {
      const record = provenanceRecord("IMPORTED", {
        agentId: "agent-imported",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ record }),
      });
      const result = await client.createProvenance({
        agentId: "agent-imported",
        creationType: "IMPORTED",
        createdBy: "migration-tool",
        originDeployment: "external-dep",
      });
      expect(result.record.trustModifier).toBe(-100);
    });
  });

  // =========================================================================
  // getProvenance
  // =========================================================================

  describe("getProvenance", () => {
    it("should return lineage chain", async () => {
      const chain = [
        provenanceRecord("FRESH", { provenanceHash: "h1" }),
        provenanceRecord("EVOLVED", {
          parentProvenanceHash: "h1",
          provenanceHash: "h2",
        }),
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            records: chain,
            summary: { total: 2 },
            lineage: chain,
          }),
      });
      const result = await client.getProvenance("agent-1");
      expect(result.records).toHaveLength(2);
      expect(result.lineage).toHaveLength(2);
    });

    it("should filter by agentId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ records: [], summary: { total: 0 } }),
      });
      await client.getProvenance("agent-x");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("agentId=agent-x");
    });

    it("should handle empty provenance", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ records: [], summary: { total: 0 } }),
      });
      const result = await client.getProvenance();
      expect(result.records).toHaveLength(0);
    });
  });

  // =========================================================================
  // Hash chaining
  // =========================================================================

  describe("Hash chaining", () => {
    it("should chain provenance hashes from parent to child", async () => {
      const parent = provenanceRecord("FRESH", {
        provenanceHash: "parent-hash",
      });
      const child = provenanceRecord("EVOLVED", {
        parentProvenanceHash: "parent-hash",
        provenanceHash: "child-hash",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            records: [parent, child],
            summary: { total: 2 },
            lineage: [parent, child],
          }),
      });
      const result = await client.getProvenance("agent-1");
      expect(result.records[1].parentProvenanceHash).toBe(
        result.records[0].provenanceHash,
      );
    });
  });
});
