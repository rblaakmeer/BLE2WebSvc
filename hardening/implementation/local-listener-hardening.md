# Implementation Plan: Fail-closed local listeners

## Selected Design And Constraints

Selected Option 1 from `proposals/trusted-ble-ingress.md`. The patch is bound to
scan revision `4d2a211409bb25b42c09249d6543bae8eac194d3`, which matched the
checkout before implementation. Application listeners remain loopback-only;
remote deployment is delegated to a TLS-capable proxy or tunnel.

## Affected Components

`server.js`, `mcp-server.js`, HTTP/MCP tests, and deployment documentation.

## Ordered Work Packages

1. Bind HTTP and MCP to validated loopback hosts.
2. Reject URL API keys and retain header authentication.
3. Add MCP client, pre-auth, handshake, and idle limits.
4. Add regression tests and update deployment guidance.

## Tests And Security Validation

Verify external bind rejection, query-key rejection, authenticated loopback
requests, MCP pre-auth admission rejection, and idle handshake cleanup.

## Rollout And Rollback

Deploy the TLS proxy or tunnel before upgrading a remote installation. Rollback
means restoring the prior release only inside a trusted network; do not restore
public direct listener exposure.
