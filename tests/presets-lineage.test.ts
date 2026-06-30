// SPDX-License-Identifier: LicenseRef-Vorion-Proprietary
// Copyright 2024-2026 Vorion LLC

/**
 * Presets & Lineage Tests (Q4) — 20 tests
 *
 * Tests preset hierarchy retrieval, CAR/Vorion/Axiom presets,
 * lineage verification, weight overrides, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CARClient, CARError, createCARClient } from "../src/index.js";
import type {
  PresetHierarchy,
  CARPreset,
  VorionPreset,
  AxiomPreset,
} from "../src/index.js";

const mockFetch = vi.fn();

const CAR_PRESET: CARPreset = {
  id: "cp-1",
  presetId: "car-default",
  name: "CAR Default",
  description: "Default canonical preset",
  weights: {
    transparency: 0.2,
    reliability: 0.2,
    safety: 0.2,
    fairness: 0.2,
    privacy: 0.2,
  },
  constraints: { maxTier: "T7" },
  presetHash: "hash-car-1",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
};

const VORION_PRESET: VorionPreset = {
  id: "vp-1",
  presetId: "vorion-default",
  parentCarIdPresetId: "car-default",
  name: "Vorion Default",
  description: "Reference preset",
  weightOverrides: { transparency: 0.25 },
  additionalConstraints: { minScore: 200 },
  presetHash: "hash-vor-1",
  parentHash: "hash-car-1",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const AXIOM_PRESET: AxiomPreset = {
  id: "ap-1",
  presetId: "axiom-prod",
  deploymentId: "dep-001",
  parentVorionPresetId: "vorion-default",
  name: "Axiom Production",
  weightOverrides: { safety: 0.3 },
  deploymentConstraints: { region: "eu" },
  presetHash: "hash-ax-1",
  parentHash: "hash-vor-1",
  lineageVerified: true,
  lineageVerifiedAt: "2026-01-01T00:00:00Z",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const HIERARCHY_STUB: PresetHierarchy = {
  carId: [CAR_PRESET],
  vorion: [VORION_PRESET],
  axiom: [AXIOM_PRESET],
  summary: {
    carIdCount: 1,
    vorionCount: 1,
    axiomCount: 1,
    verifiedLineages: 1,
  },
  lineages: [
    {
      axiom: { id: "ap-1", name: "Axiom Production", verified: true },
      vorion: { id: "vp-1", name: "Vorion Default" },
      carId: { id: "cp-1", name: "CAR Default" },
    },
  ],
};

describe("Presets & Lineage (Q4)", () => {
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
  // getPresetHierarchy
  // =========================================================================

  describe("getPresetHierarchy", () => {
    it("should return 3-tier tree (CAR -> Vorion -> Axiom)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: HIERARCHY_STUB }),
      });
      const result = await client.getPresetHierarchy();
      expect(result.carId).toHaveLength(1);
      expect(result.vorion).toHaveLength(1);
      expect(result.axiom).toHaveLength(1);
    });

    it("should include lineages array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: HIERARCHY_STUB }),
      });
      const result = await client.getPresetHierarchy();
      expect(result.lineages).toHaveLength(1);
      expect(result.lineages[0].axiom.verified).toBe(true);
    });

    it("should include summary counts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: HIERARCHY_STUB }),
      });
      const result = await client.getPresetHierarchy();
      expect(result.summary.carIdCount).toBe(1);
      expect(result.summary.verifiedLineages).toBe(1);
    });

    it("should handle empty presets", async () => {
      const empty: PresetHierarchy = {
        carId: [],
        vorion: [],
        axiom: [],
        summary: {
          carIdCount: 0,
          vorionCount: 0,
          axiomCount: 0,
          verifiedLineages: 0,
        },
        lineages: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: empty }),
      });
      const result = await client.getPresetHierarchy();
      expect(result.carId).toHaveLength(0);
    });
  });

  // =========================================================================
  // getCARPresets
  // =========================================================================

  describe("getCARPresets", () => {
    it("should return canonical CAR presets", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [CAR_PRESET] } }),
      });
      const result = await client.getCARPresets();
      expect(result).toHaveLength(1);
      expect(result[0].presetId).toBe("car-default");
    });

    it("should pass tier=carId query parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [] } }),
      });
      await client.getCARPresets();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("tier=carId");
    });

    it("should include weights and constraints", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [CAR_PRESET] } }),
      });
      const result = await client.getCARPresets();
      expect(result[0].weights.transparency).toBe(0.2);
      expect(result[0].constraints.maxTier).toBe("T7");
    });
  });

  // =========================================================================
  // getVorionPresets
  // =========================================================================

  describe("getVorionPresets", () => {
    it("should return Vorion reference presets", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [VORION_PRESET] } }),
      });
      const result = await client.getVorionPresets();
      expect(result).toHaveLength(1);
      expect(result[0].parentCarIdPresetId).toBe("car-default");
    });

    it("should pass tier=vorion query parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [] } }),
      });
      await client.getVorionPresets();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("tier=vorion");
    });

    it("should include parentHash linking to CAR preset", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [VORION_PRESET] } }),
      });
      const result = await client.getVorionPresets();
      expect(result[0].parentHash).toBe("hash-car-1");
    });
  });

  // =========================================================================
  // getAxiomPresets
  // =========================================================================

  describe("getAxiomPresets", () => {
    it("should return Axiom deployment presets", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [AXIOM_PRESET] } }),
      });
      const result = await client.getAxiomPresets();
      expect(result).toHaveLength(1);
      expect(result[0].deploymentId).toBe("dep-001");
    });

    it("should filter by deploymentId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [AXIOM_PRESET] } }),
      });
      await client.getAxiomPresets("dep-001");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("deploymentId=dep-001");
    });

    it("should include lineageVerified status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [AXIOM_PRESET] } }),
      });
      const result = await client.getAxiomPresets();
      expect(result[0].lineageVerified).toBe(true);
    });
  });

  // =========================================================================
  // verifyPresetLineage
  // =========================================================================

  describe("verifyPresetLineage", () => {
    it("should verify valid lineage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            verified: true,
            lineage: { axiom: "ap-1", vorion: "vp-1", carId: "cp-1" },
          }),
      });
      const result = await client.verifyPresetLineage("ap-1");
      expect(result.verified).toBe(true);
      expect(result.lineage).toBeDefined();
    });

    it("should detect broken lineage (hash mismatch)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            verified: false,
            reason:
              "Parent hash mismatch: expected hash-vor-1, got hash-vor-bad",
          }),
      });
      const result = await client.verifyPresetLineage("ap-bad");
      expect(result.verified).toBe(false);
      expect(result.reason).toContain("hash mismatch");
    });

    it("should send POST with action=verify-lineage query param", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verified: true }),
      });
      await client.verifyPresetLineage("ap-1");
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("action=verify-lineage");
    });

    it("should propagate server errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Preset not found" }),
      });
      await expect(client.verifyPresetLineage("nonexistent")).rejects.toThrow(
        CARError,
      );
    });
  });

  // =========================================================================
  // Weight overrides
  // =========================================================================

  describe("Weight override merging", () => {
    it("should allow Vorion to override CAR weights", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [VORION_PRESET] } }),
      });
      const result = await client.getVorionPresets();
      expect(result[0].weightOverrides.transparency).toBe(0.25);
    });

    it("should allow Axiom to override Vorion weights", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { presets: [AXIOM_PRESET] } }),
      });
      const result = await client.getAxiomPresets();
      expect(result[0].weightOverrides.safety).toBe(0.3);
    });
  });

  // =========================================================================
  // Orphaned presets
  // =========================================================================

  describe("Orphaned preset detection", () => {
    it("should detect orphaned axiom preset with null vorion parent in lineage", async () => {
      const orphanedHierarchy: PresetHierarchy = {
        ...HIERARCHY_STUB,
        lineages: [
          {
            axiom: { id: "ap-orphan", name: "Orphan", verified: false },
            vorion: null,
            carId: null,
          },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: orphanedHierarchy }),
      });
      const result = await client.getPresetHierarchy();
      const orphan = result.lineages.find((l) => l.vorion === null);
      expect(orphan).toBeDefined();
      expect(orphan!.axiom.verified).toBe(false);
    });
  });
});
