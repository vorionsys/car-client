---
"@vorionsys/car-client": patch
---

Extract `car-client` into its own standalone repository (`vorionsys/car-client`) with tokenless OIDC trusted publishing + provenance. Bump `@vorionsys/shared-constants` to `^2.0.0` (no API change — car-client uses only the `/tiers` subpath, which is unchanged in 2.0.0). Relicensed Apache-2.0.
