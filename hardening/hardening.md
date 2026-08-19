# Security Hardening Review: BLE2WebSvc

## Evidence Basis

We derived this portfolio from the completed Codex Security scan at revision
`4d2a211409bb25b42c09249d6543bae8eac194d3`; the current checkout matches that
revision. The scan identified one high-severity exposure of unauthenticated BLE
control and three medium-severity resource or transport weaknesses. The review
was partial: generated coverage artifacts and dependency-resolution analysis
were not assessed.

## Constraints

We assume a balanced profile: preserve convenient loopback development, retain
the existing HTTP and MCP interfaces where practical, and make remote operation
an explicit deployment choice. No latency, memory, device-fleet, or certificate
management budget was supplied, so performance and operational claims in the
proposals are source-derived rather than measured.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Trusted BLE ingress | Unauthenticated BLE control, cleartext credentials, idle MCP sockets | 1. Fail-closed local listeners; 2. TLS gateway | Start with Option 1; use Option 2 if remote MCP is a supported product capability. | [Proposal](proposals/trusted-ble-ingress.md) |
| Bounded BLE discovery | Unbounded discovered-peripheral cache | 1. TTL/LRU registry; 2. allowlisted on-demand scan | Use Option 1 now; choose Option 2 only for managed device fleets. | [Proposal](proposals/bounded-ble-discovery.md) |

## Recommendation Summary

I recommend treating the ingress change as the immediate work: default both
listeners to loopback, make any non-loopback binding fail closed without strong
credentials, remove query-string API keys, and bound unauthenticated MCP
connections. This gives us a reliable local development path without leaving
network exposure to an environment-name convention. We should pair it with a
documented TLS proxy or tunnel for every supported remote deployment; a gateway
becomes the better long-term choice if remote MCP is normal rather than rare.

In parallel, we should replace the global discovery array with a TTL/LRU
registry. That is a contained code change with a direct safety property: nearby
advertisement churn cannot grow process state indefinitely. The allowlist option
is stronger, but it changes the operational model and should wait until we know
whether the product has a stable device inventory.

## Next Decisions

1. Select the supported remote MCP transport: local-only tunnel, mTLS proxy, or
   in-process TLS.
2. Set initial bounds for MCP clients, handshake/idle timeouts, BLE discovery
   entries, and entry TTL.
3. Approve implementation of the recommended options and their regression and
   load tests.
