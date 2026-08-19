# Hardening analysis context

Source scan: `a46a41b5-0388-4e82-b8e5-6f84af5de155`.

Target revision: `4d2a211409bb25b42c09249d6543bae8eac194d3`.
The current checkout resolved to the same revision. The scan was completed with
partial coverage: generated coverage assets and dependency-resolution analysis
were deferred.

Evidence used:

| ID | Finding | Source anchors |
| --- | --- | --- |
| F1 | Default startup exposes unauthenticated BLE control over HTTP and MCP | `server.js`, `mcp-server.js`, `Dockerfile.template` |
| F2 | BLE service credentials are accepted over cleartext transports | `server.js`, `mcp-server.js` |
| F3 | BLE advertisements can grow the discovered-peripheral cache without bound | `ble-manager.js` |
| F4 | MCP accepts unlimited idle TCP clients without timeouts or admission limits | `mcp-server.js` |

This directory is a derived design product. It does not modify the scan
artifacts and does not claim that any finding is fixed.
