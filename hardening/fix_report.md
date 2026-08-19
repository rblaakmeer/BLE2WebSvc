# Selected hardening implementation report

This report records implementation of Option 1 from both hardening proposals
against scan revision `4d2a211409bb25b42c09249d6543bae8eac194d3`.

## Outcome

Fixed in the current working tree, subject to deployment of a TLS-capable proxy
or tunnel for any remote access.

## Vulnerable paths and invariants

- HTTP and raw MCP listeners could bind on unspecified interfaces while
  authentication was optional outside production. The invariant is that the BLE
  process has no direct network-facing listener.
- REST accepted `api_key` in URLs. The invariant is that bearer secrets are not
  accepted from URLs.
- MCP allocated socket state without connection limits or handshake/idle
  deadlines. The invariant is bounded state for every peer.
- BLE advertisements appended indefinitely to discovery state. The invariant is
  bounded, expiring discovery metadata.

## Patch strategy

The narrowest complete repository-native strategy was to enforce loopback at the
two listener boundaries, keep existing header/MCP authentication behavior,
remove the URL credential path, bound MCP state at socket acceptance, and add
expiry/LRU eviction to the existing discovery collection while preserving its
public array API.

## Files changed

- `server.js`, `mcp-server.js`, `ble-manager.js`
- `__tests__/server.test.js`, `__tests__/mcp-server.test.js`,
  `__tests__/ble-manager.test.js`
- `README.md`, `SECURITY_HARDENING.md`, `RASPBERRY_PI_SETUP.md`

## Verification

1. Syntax: `node --check server.js`, `node --check mcp-server.js`, and
   `node --check ble-manager.js` passed.
2. Security regression coverage: non-loopback HTTP/MCP binds are rejected; URL
   API keys fail while header credentials succeed; unauthenticated and total MCP
   connection limits reject excess sockets; stale and churned BLE discovery
   entries are bounded.
3. Full suite: `npm test -- --runInBand` passed (40 tests, 4 suites).
4. Diff hygiene: `git diff --check` passed.

## Remaining deployment requirement

The application deliberately does not implement TLS itself. Remote HTTP and MCP
clients must use a TLS-capable reverse proxy or tunnel that forwards only to the
loopback listeners.
