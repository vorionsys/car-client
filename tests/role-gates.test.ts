// SPDX-License-Identifier: LicenseRef-Vorion-Proprietary
// Copyright 2024-2026 Vorion LLC

/**
 * Role Gates Tests (Q3) — 30 tests
 *
 * Tests evaluateRoleGate with each role level, tier gating,
 * kernel/policy/basis layers, evaluation history, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CARClient,
  CARError,
  createCARClient,
  isRoleAllowedForTier,
} from "../src/index.js";
import type { RoleGateResponse, AgentRole, TrustTier } from "../src/index.js";

const mockFetch = vi.fn();

function roleGateResponse(
  overrides: Partial<{
    agentId: string;
    requestedRole: AgentRole;
    currentTier: TrustTier;
    kernelAllowed: boolean;
    finalDecision: string;
    policyResult: string;
    basisOverrideUsed: boolean;
    basisApprovers: string[];
  }>,
): RoleGateResponse {
  return {
    evaluation: {
      id: `eval-${Math.random().toString(36).slice(2, 8)}`,
      agentId: overrides.agentId ?? "agent-1",
      requestedRole: overrides.requestedRole ?? "R_L0",
      currentTier: overrides.currentTier ?? "T0",
      currentScore: 100,
      kernelAllowed: overrides.kernelAllowed ?? true,
      finalDecision: (overrides.finalDecision ?? "ALLOW") as
        | "ALLOW"
        | "DENY"
        | "ESCALATE",
      basisOverrideUsed: overrides.basisOverrideUsed ?? false,
      basisApprovers: overrides.basisApprovers,
      policyResult: overrides.policyResult as
        | "ALLOW"
        | "DENY"
        | "ESCALATE"
        | undefined,
      createdAt: "2026-01-01T00:00:00Z",
    },
    layers: {
      kernel: { allowed: overrides.kernelAllowed ?? true },
      policy: {
        result: overrides.policyResult as
          | "ALLOW"
          | "DENY"
          | "ESCALATE"
          | undefined,
      },
      basis: { overrideUsed: overrides.basisOverrideUsed ?? false },
    },
  };
}

describe("Role Gates (Q3)", () => {
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
  // evaluateRoleGate per role level
  // =========================================================================

  describe("evaluateRoleGate per role level", () => {
    const roles: AgentRole[] = [
      "R_L0",
      "R_L1",
      "R_L2",
      "R_L3",
      "R_L4",
      "R_L5",
      "R_L6",
      "R_L7",
      "R_L8",
    ];

    roles.forEach((role) => {
      it(`should evaluate role gate for ${role}`, async () => {
        const resp = roleGateResponse({
          requestedRole: role,
          currentTier: "T5",
        });
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(resp),
        });
        const result = await client.evaluateRoleGate({
          agentId: "a1",
          requestedRole: role,
          currentTier: "T5",
        });
        expect(result.evaluation.requestedRole).toBe(role);
      });
    });
  });

  // =========================================================================
  // ALLOW / DENY decisions
  // =========================================================================

  describe("Role gate decisions", () => {
    it("should return ALLOW when kernel allows and no policy override", async () => {
      const resp = roleGateResponse({
        finalDecision: "ALLOW",
        kernelAllowed: true,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.evaluateRoleGate({
        agentId: "a1",
        requestedRole: "R_L0",
        currentTier: "T0",
      });
      expect(result.evaluation.finalDecision).toBe("ALLOW");
    });

    it("should return DENY when kernel denies", async () => {
      const resp = roleGateResponse({
        finalDecision: "DENY",
        kernelAllowed: false,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.evaluateRoleGate({
        agentId: "a1",
        requestedRole: "R_L4",
        currentTier: "T0",
      });
      expect(result.evaluation.finalDecision).toBe("DENY");
    });

    it("should return ESCALATE decision", async () => {
      const resp = roleGateResponse({ finalDecision: "ESCALATE" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.evaluateRoleGate({
        agentId: "a1",
        requestedRole: "R_L5",
        currentTier: "T3",
      });
      expect(result.evaluation.finalDecision).toBe("ESCALATE");
    });
  });

  // =========================================================================
  // Kernel layer: R-L0,L1 always allow
  // =========================================================================

  describe("Kernel layer evaluation", () => {
    it("should always allow R_L0 at any tier (via isRoleAllowedForTier)", () => {
      const tiers: TrustTier[] = [
        "T0",
        "T1",
        "T2",
        "T3",
        "T4",
        "T5",
        "T6",
        "T7",
      ];
      tiers.forEach((tier) => {
        expect(isRoleAllowedForTier("R_L0", tier)).toBe(true);
      });
    });

    it("should always allow R_L1 at any tier", () => {
      const tiers: TrustTier[] = [
        "T0",
        "T1",
        "T2",
        "T3",
        "T4",
        "T5",
        "T6",
        "T7",
      ];
      tiers.forEach((tier) => {
        expect(isRoleAllowedForTier("R_L1", tier)).toBe(true);
      });
    });
  });

  // =========================================================================
  // Tier gating
  // =========================================================================

  describe("Tier gating rules", () => {
    it("should deny R_L2 at T0 (requires T1+)", () => {
      expect(isRoleAllowedForTier("R_L2", "T0")).toBe(false);
    });

    it("should allow R_L2 at T1", () => {
      expect(isRoleAllowedForTier("R_L2", "T1")).toBe(true);
    });

    it("should deny R_L3 at T1 (requires T2+)", () => {
      expect(isRoleAllowedForTier("R_L3", "T1")).toBe(false);
    });

    it("should allow R_L3 at T2", () => {
      expect(isRoleAllowedForTier("R_L3", "T2")).toBe(true);
    });

    it("should deny R_L4 at T2 (requires T3+)", () => {
      expect(isRoleAllowedForTier("R_L4", "T2")).toBe(false);
    });

    it("should allow R_L4 at T3", () => {
      expect(isRoleAllowedForTier("R_L4", "T3")).toBe(true);
    });

    it("should deny R_L5 at T3 (requires T4+)", () => {
      expect(isRoleAllowedForTier("R_L5", "T3")).toBe(false);
    });

    it("should allow R_L5 at T4", () => {
      expect(isRoleAllowedForTier("R_L5", "T4")).toBe(true);
    });

    it("should deny R_L6 at T4 (requires T5+)", () => {
      expect(isRoleAllowedForTier("R_L6", "T4")).toBe(false);
    });

    it("should allow R_L6 at T5", () => {
      expect(isRoleAllowedForTier("R_L6", "T5")).toBe(true);
    });
  });

  // =========================================================================
  // Policy layer override
  // =========================================================================

  describe("Policy layer", () => {
    it("should reflect policy override in response", async () => {
      const resp = roleGateResponse({
        policyResult: "DENY",
        finalDecision: "DENY",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.evaluateRoleGate({
        agentId: "a1",
        requestedRole: "R_L3",
        currentTier: "T3",
      });
      expect(result.layers.policy.result).toBe("DENY");
    });
  });

  // =========================================================================
  // Basis layer administrator override
  // =========================================================================

  describe("Basis layer", () => {
    it("should reflect basis override in response", async () => {
      const resp = roleGateResponse({
        basisOverrideUsed: true,
        basisApprovers: ["admin@org.com"],
        finalDecision: "ALLOW",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      });
      const result = await client.evaluateRoleGate({
        agentId: "a1",
        requestedRole: "R_L6",
        currentTier: "T3",
      });
      expect(result.evaluation.basisOverrideUsed).toBe(true);
      expect(result.evaluation.basisApprovers).toContain("admin@org.com");
      expect(result.layers.basis.overrideUsed).toBe(true);
    });
  });

  // =========================================================================
  // getRoleGateEvaluations
  // =========================================================================

  describe("getRoleGateEvaluations", () => {
    it("should retrieve evaluations with pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            evaluations: [{ id: "e1" }, { id: "e2" }],
            summary: { total: 2 },
          }),
      });
      const result = await client.getRoleGateEvaluations(undefined, {
        limit: 2,
      });
      expect(result.evaluations).toHaveLength(2);
    });

    it("should filter evaluations by agentId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            evaluations: [{ id: "e1", agentId: "agent-x" }],
            summary: { total: 1 },
          }),
      });
      await client.getRoleGateEvaluations("agent-x");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("agentId=agent-x");
    });

    it("should include evaluation matrix when requested", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ evaluations: [], summary: {}, matrix: {} }),
      });
      await client.getRoleGateEvaluations(undefined, { includeMatrix: true });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("includeMatrix=true");
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("Edge cases", () => {
    it("should throw on missing agentId (empty string)", async () => {
      await expect(
        client.evaluateRoleGate({
          agentId: "",
          requestedRole: "R_L0",
          currentTier: "T0",
        }),
      ).rejects.toThrow();
    });

    it("should throw on invalid role level via Zod validation", async () => {
      await expect(
        client.evaluateRoleGate({
          agentId: "a1",
          requestedRole: "R_L9" as AgentRole,
          currentTier: "T0",
        }),
      ).rejects.toThrow();
    });

    it("should throw on invalid tier via Zod validation", async () => {
      await expect(
        client.evaluateRoleGate({
          agentId: "a1",
          requestedRole: "R_L0",
          currentTier: "T9" as TrustTier,
        }),
      ).rejects.toThrow();
    });

    it("should propagate server error from role gate endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Agent not found" }),
      });
      // Need valid request to pass Zod
      await expect(
        client.evaluateRoleGate({
          agentId: "nonexistent",
          requestedRole: "R_L0",
          currentTier: "T0",
        }),
      ).rejects.toThrow(CARError);
    });
  });
});
