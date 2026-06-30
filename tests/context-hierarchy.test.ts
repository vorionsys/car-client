// SPDX-License-Identifier: LicenseRef-Vorion-Proprietary
// Copyright 2024-2026 Vorion LLC

/**
 * Context Hierarchy Tests (Q2) — 20 tests
 *
 * Tests context hierarchy retrieval, deployments, organizations,
 * agents, operations, creation, and filtering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CARClient, createCARClient } from "../src/index.js";
import type {
  ContextHierarchy,
  DeploymentContext,
  OrgContext,
  AgentContext,
  OperationContext,
} from "../src/index.js";

const mockFetch = vi.fn();

const DEPLOYMENT_STUB: DeploymentContext = {
  id: "d-1",
  deploymentId: "dep-001",
  name: "Production",
  version: "1.0.0",
  environment: "production",
  maxTrustCeiling: 1000,
  contextHash: "hash-d1",
  frozenAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
};

const ORG_STUB: OrgContext = {
  id: "o-1",
  deploymentId: "dep-001",
  orgId: "org-001",
  name: "Acme Corp",
  complianceFrameworks: ["EU_AI_ACT"],
  trustCeiling: 699,
  contextHash: "hash-o1",
  parentHash: "hash-d1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const AGENT_STUB: AgentContext = {
  id: "a-1",
  deploymentId: "dep-001",
  orgId: "org-001",
  agentId: "agent-001",
  name: "TestAgent",
  capabilities: ["read", "write"],
  trustCeiling: 699,
  contextHash: "hash-a1",
  parentHash: "hash-o1",
  frozenAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
};

const OPERATION_STUB: OperationContext = {
  id: "op-1",
  deploymentId: "dep-001",
  orgId: "org-001",
  agentId: "agent-001",
  operationId: "op-001",
  operationType: "data_query",
  requestedRole: "R_L2",
  contextHash: "hash-op1",
  parentHash: "hash-a1",
  startedAt: "2026-01-01T00:00:00Z",
  ttlSeconds: 300,
};

const HIERARCHY_STUB: ContextHierarchy = {
  deployments: [DEPLOYMENT_STUB],
  organizations: [ORG_STUB],
  agents: [AGENT_STUB],
  operations: [OPERATION_STUB],
  summary: {
    deploymentCount: 1,
    orgCount: 1,
    agentCount: 1,
    activeOperations: 1,
  },
};

describe("Context Hierarchy (Q2)", () => {
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
  // getContextHierarchy
  // =========================================================================

  describe("getContextHierarchy", () => {
    it("should return full context tree", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: HIERARCHY_STUB }),
      });
      const result = await client.getContextHierarchy();
      expect(result.deployments).toHaveLength(1);
      expect(result.organizations).toHaveLength(1);
      expect(result.agents).toHaveLength(1);
      expect(result.operations).toHaveLength(1);
    });

    it("should include summary counts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: HIERARCHY_STUB }),
      });
      const result = await client.getContextHierarchy();
      expect(result.summary.deploymentCount).toBe(1);
      expect(result.summary.orgCount).toBe(1);
      expect(result.summary.agentCount).toBe(1);
      expect(result.summary.activeOperations).toBe(1);
    });

    it("should handle empty context tree", async () => {
      const empty: ContextHierarchy = {
        deployments: [],
        organizations: [],
        agents: [],
        operations: [],
        summary: {
          deploymentCount: 0,
          orgCount: 0,
          agentCount: 0,
          activeOperations: 0,
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: empty }),
      });
      const result = await client.getContextHierarchy();
      expect(result.deployments).toHaveLength(0);
      expect(result.summary.deploymentCount).toBe(0);
    });
  });

  // =========================================================================
  // getDeployments
  // =========================================================================

  describe("getDeployments", () => {
    it("should return deployment contexts (IMMUTABLE tier)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [DEPLOYMENT_STUB] }),
      });
      const result = await client.getDeployments();
      expect(result).toHaveLength(1);
      expect(result[0].deploymentId).toBe("dep-001");
    });

    it("should pass tier=deployment query parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      await client.getDeployments();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("tier=deployment");
    });

    it("should include frozenAt for immutable deployments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [DEPLOYMENT_STUB] }),
      });
      const result = await client.getDeployments();
      expect(result[0].frozenAt).toBeDefined();
    });
  });

  // =========================================================================
  // getOrganizations
  // =========================================================================

  describe("getOrganizations", () => {
    it("should return organization contexts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [ORG_STUB] }),
      });
      const result = await client.getOrganizations();
      expect(result).toHaveLength(1);
      expect(result[0].orgId).toBe("org-001");
    });

    it("should filter by deploymentId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [ORG_STUB] }),
      });
      await client.getOrganizations("dep-001");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("deploymentId=dep-001");
    });

    it("should include compliance frameworks", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [ORG_STUB] }),
      });
      const result = await client.getOrganizations();
      expect(result[0].complianceFrameworks).toContain("EU_AI_ACT");
    });
  });

  // =========================================================================
  // getAgents
  // =========================================================================

  describe("getAgents", () => {
    it("should return agent contexts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [AGENT_STUB] }),
      });
      const result = await client.getAgents();
      expect(result).toHaveLength(1);
      expect(result[0].agentId).toBe("agent-001");
    });

    it("should filter by deploymentId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      await client.getAgents("dep-001");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("deploymentId=dep-001");
    });

    it("should filter by orgId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      await client.getAgents(undefined, "org-001");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("orgId=org-001");
    });

    it("should filter by both deploymentId and orgId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      await client.getAgents("dep-001", "org-001");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("deploymentId=dep-001");
      expect(calledUrl).toContain("orgId=org-001");
    });
  });

  // =========================================================================
  // getOperations
  // =========================================================================

  describe("getOperations", () => {
    it("should return operation contexts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [OPERATION_STUB] }),
      });
      const result = await client.getOperations();
      expect(result).toHaveLength(1);
      expect(result[0].operationId).toBe("op-001");
    });

    it("should filter by agentId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      await client.getOperations("agent-001");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("agentId=agent-001");
    });

    it("should include TTL seconds for ephemeral operations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [OPERATION_STUB] }),
      });
      const result = await client.getOperations();
      expect(result[0].ttlSeconds).toBe(300);
    });
  });

  // =========================================================================
  // createDeployment
  // =========================================================================

  describe("createDeployment", () => {
    it("should create a deployment context", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: DEPLOYMENT_STUB }),
      });
      const result = await client.createDeployment({
        deploymentId: "dep-001",
        name: "Production",
        version: "1.0.0",
        environment: "production",
        maxTrustCeiling: 1000,
        contextHash: "hash-d1",
      });
      expect(result.deploymentId).toBe("dep-001");
    });

    it("should send POST request with deployment data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: DEPLOYMENT_STUB }),
      });
      await client.createDeployment({
        deploymentId: "dep-002",
        name: "Staging",
        version: "1.0.0",
        environment: "staging",
        maxTrustCeiling: 800,
        contextHash: "hash-d2",
      });
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tier).toBe("deployment");
      expect(body.deploymentId).toBe("dep-002");
    });
  });

  // =========================================================================
  // Parent-child relationships
  // =========================================================================

  describe("Parent-child relationships", () => {
    it("should have org parentHash matching deployment contextHash", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: HIERARCHY_STUB }),
      });
      const result = await client.getContextHierarchy();
      expect(result.organizations[0].parentHash).toBe(
        result.deployments[0].contextHash,
      );
    });

    it("should have agent parentHash matching org contextHash", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: HIERARCHY_STUB }),
      });
      const result = await client.getContextHierarchy();
      expect(result.agents[0].parentHash).toBe(
        result.organizations[0].contextHash,
      );
    });
  });
});
