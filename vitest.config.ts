// SPDX-License-Identifier: LicenseRef-Vorion-Proprietary
// Copyright 2024-2026 Vorion LLC

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Avoid barrel @vorionsys/shared-constants in Vitest (CI ESM init race → undefined TIER_THRESHOLDS)
    alias: {
      "@vorionsys/shared-constants/tiers": path.resolve(
        packageDir,
        "../shared-constants/src/tiers.ts",
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts", "tests/**/*.test.ts"],
    // Pact contract tests excluded from default run — require @pact-foundation/pact and broker infrastructure
    exclude: ["tests/pact/**", "**/node_modules/**"],
  },
});
