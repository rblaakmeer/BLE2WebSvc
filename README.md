# BLE2WebSvc

Building a bridge between BLE devices and Webservices on a Raspberry Pi Zero W.

This fork implements an MCP (Model Context Protocol) server compatible with the official MCP SDK. BLE access and Tool Discovery / Tool Execution are exposed via MCP-compliant JSON-over-TCP messages.

## Features

- MCP SDK compliant TCP interface (JSON per line)
- BLE device discovery, connect, services, characteristics, read/write, subscribe
- Tool Discovery and Tool Execution (MCP SDK style)
- Execution event streaming (progress/completed/failed/cancelled)
- Optional token authentication via `MCP_TOKEN`

## Requirements

- Node.js (16+ recommended)
- Linux (Raspberry Pi OS recommended for Pi Zero W)
- BLE-capable hardware

## Local development and testing

Run the HTTP API and web UI locally, and optionally protect BLE endpoints with an API key.

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment (optional)
- `PORT` – HTTP server port (default: 8111)
- `API_KEY` – If set, required on all `/ble/*` endpoints via header `x-api-key` or query `?api_key=`
- `CORS_ORIGIN` – Allowed origin for CORS (default: `*`)
- `RATE_LIMIT_WINDOW_MS` – Rate limit window in ms (default: `60000`)
- `RATE_LIMIT_MAX` – Max requests per window per IP for `/ble` (default: `120`)

Windows (PowerShell):
```powershell
$env:API_KEY = "dev-key-123"      # optional
$env:CORS_ORIGIN = "*"            # optional
$env:RATE_LIMIT_WINDOW_MS = "60000"
$env:RATE_LIMIT_MAX = "120"
```

Linux/macOS:
```bash
export API_KEY=dev-key-123      # optional
export CORS_ORIGIN="*"         # optional
export RATE_LIMIT_WINDOW_MS=60000
export RATE_LIMIT_MAX=120
```

### 3) Start the server
```bash
npm start
```
The server listens on `http://localhost:8111` by default. Health check: `GET /health`.

### 4) Open the web UI
Visit `http://localhost:8111/web` in your browser. Use the UI to discover, connect, read/write, and subscribe.

### 5) Call the API directly
If `API_KEY` is set, include it in `x-api-key` header (or `?api_key=` query).

PowerShell examples:
```powershell
$headers = @{ "x-api-key" = "dev-key-123" }  # omit if API_KEY not set
Invoke-RestMethod -Headers $headers -Uri "http://localhost:8111/ble/devices"

$deviceId = "<your_device_id>"
Invoke-RestMethod -Headers $headers -Method Post -Uri "http://localhost:8111/ble/devices/$deviceId/connect"
Invoke-RestMethod -Headers $headers -Uri "http://localhost:8111/ble/devices/$deviceId/services"
Invoke-RestMethod -Headers $headers -Uri "http://localhost:8111/ble/devices/$deviceId/services/<service_uuid>/characteristics"
Invoke-RestMethod -Headers $headers -Uri "http://localhost:8111/ble/devices/$deviceId/characteristics/<char_uuid>"

$body = @{ value = "0aff" ; withoutResponse = $false } | ConvertTo-Json
Invoke-RestMethod -Headers $headers -Method Post -ContentType "application/json" -Body $body -Uri "http://localhost:8111/ble/devices/$deviceId/characteristics/<char_uuid>"

Invoke-RestMethod -Headers $headers -Method Post -Uri "http://localhost:8111/ble/devices/$deviceId/characteristics/<char_uuid>/subscribe"
Invoke-RestMethod -Headers $headers -Uri "http://localhost:8111/ble/devices/$deviceId/characteristics/<char_uuid>/notifications?since=0&limit=10"
Invoke-RestMethod -Headers $headers -Method Post -Uri "http://localhost:8111/ble/devices/$deviceId/characteristics/<char_uuid>/unsubscribe"
```

bash (curl) examples:
```bash
API=http://localhost:8111
HDR=( -H "x-api-key: ${API_KEY}" )   # omit if API_KEY not set

curl -sS "$API/health"
curl -sS "$API/ble/devices" "${HDR[@]}"

DEVICE_ID="<your_device_id>"
curl -sS -X POST "$API/ble/devices/$DEVICE_ID/connect" "${HDR[@]}"
curl -sS "$API/ble/devices/$DEVICE_ID/services" "${HDR[@]}"
curl -sS "$API/ble/devices/$DEVICE_ID/services/<service_uuid>/characteristics" "${HDR[@]}"
curl -sS "$API/ble/devices/$DEVICE_ID/characteristics/<char_uuid>" "${HDR[@]}"
curl -sS -X POST -H 'Content-Type: application/json' -d '{"value":"0aff","withoutResponse":false}' "$API/ble/devices/$DEVICE_ID/characteristics/<char_uuid>" "${HDR[@]}"
curl -sS -X POST "$API/ble/devices/$DEVICE_ID/characteristics/<char_uuid>/subscribe" "${HDR[@]}"
curl -sS "$API/ble/devices/$DEVICE_ID/characteristics/<char_uuid>/notifications?since=0&limit=10" "${HDR[@]}"
curl -sS -X POST "$API/ble/devices/$DEVICE_ID/characteristics/<char_uuid>/unsubscribe" "${HDR[@]}"
```

### Troubleshooting
- Ensure your machine has a BLE adapter enabled and accessible to Node.
- If the browser shows CORS errors when using another origin, set `CORS_ORIGIN` appropriately.
- If rate limiting triggers during testing, increase `RATE_LIMIT_MAX` or window.
- If you set `API_KEY` and the web UI can’t call APIs, add the `x-api-key` header via a proxy or disable `API_KEY` during local UI testing.

## Starting the MCP Server

Set optional environment variables and start the Node server:

Windows (PowerShell):
```powershell
$env:MCP_PORT = "8123"
$env:MCP_TOKEN = "secret"    # optional
npm start
```

Linux/macOS:
```bash
export MCP_PORT=8123
export MCP_TOKEN=secret   # optional
npm start
```

By default the MCP server listens on the port set in `MCP_PORT` or 8123.

A single JSON object per line is expected. The server sends a handshake on connection:
```json
{"type":"mcp/handshake","id":null,"payload":{"server":"BLE2WebSvc MCP","version":"1.0"}}
```

## Protocol: MCP SDK envelope

All requests/commands use an envelope:
```json
{
  "type": "mcp.tool.execute",
  "id": "request-id",
  "payload": { ... }
}
```

Responses and events are sent with `type` values per the SDK style.

### Authentication
If `MCP_TOKEN` is set, client must authenticate first:
Request:
```json
{"type":"mcp/auth","id":"auth1","payload":{"token":"secret"}}
```
Server response:
```json
{"type":"mcp/auth.ok","id":"auth1","payload":{"msg":"authenticated"}}
```

### Tool Discovery
List registered tools:
Request:
```json
{"type":"mcp.tools.discover","id":"t1","payload":{}}
```
Response:
```json
{"type":"mcp.tools.list.result","id":"t1","payload":{"tools":[{"id":"tool1","name":"Example","description":"..."}]}}}
```

Get tool info:
Request:
```json
{"type":"mcp.tool.info","id":"t2","payload":{"toolId":"tool1"}}
```
Response:
```json
{"type":"mcp.tool.info.result","id":"t2","payload":{"toolId":"tool1","name":"Example","description":"...","execSchema":{...}}}
```

### Tool Execution
Start tool:
Request:
```json
{"type":"mcp.tool.execute","id":"exec1","payload":{"toolId":"tool1","input":{...}}}
```
Server immediately responds:
```json
{"type":"mcp.tool.execute.started","id":"exec1","payload":{"execId":"...","toolId":"tool1"}}
```
Execution events stream to subscribers and initiator as:
```json
{"type":"mcp.tool.event","id":null,"payload":{"event":"progress","execId":"...","toolId":"tool1","data":{...},"ts":"..."}}
{"type":"mcp.tool.event","id":null,"payload":{"event":"completed","execId":"...","toolId":"tool1","data":{...},"ts":"..."}}
```

Subscribe to execution events from another client:
Request:
```json
{"type":"mcp.exec.subscribe","id":"s1","payload":{"execId":"..."}}
```
Response:
```json
{"type":"mcp.exec.subscribe.ok","id":"s1","payload":{"msg":"subscribed"}}
```

Query execution status/result:
Request:
```json
{"type":"mcp.exec.status","id":"q1","payload":{"execId":"..."}}
```
Response:
```json
{"type":"mcp.exec.status.result","id":"q1","payload":{"execId":"...","status":"running","result":null}}
```

Cancel execution (if tool exposes cancel):
Request:
```json
{"type":"mcp.exec.cancel","id":"c1","payload":{"execId":"..."}}
```
Response:
```json
{"type":"mcp.exec.cancel.ok","id":"c1","payload":{"msg":"canceled"}}
```

### BLE Operations via MCP envelope
Discover devices:
Request:
```json
{"type":"mcp.ble.devices","id":"b1","payload":{}}
```
Response:
```json
{"type":"mcp.ble.devices.result","id":"b1","payload":{"devices":[{"id":"string","address":"string","name":"string","advertisedServices":["string"],"state":"string"}]}}
```

Connect:
Request:
```json
{"type":"mcp.ble.connect","id":"b2","payload":{"deviceId":"<id>"}}
```
Response:
```json
{"type":"mcp.ble.connect.ok","id":"b2","payload":{"msg":"Connection successful","device":{"id":"string","name":"string","state":"connected"}}}
```

Read:
Request:
```json
{"type":"mcp.ble.read","id":"b3","payload":{"deviceId":"<id>","characteristicUuid":"<uuid>"}}
```
Response:
```json
{"type":"mcp.ble.read.result","id":"b3","payload":{"characteristicUuid":"string","value":"string"}}
```

Write:
Request:
```json
{"type":"mcp.ble.write","id":"b4","payload":{"deviceId":"<id>","characteristicUuid":"<uuid>","value":"hex-or-base64"}}
```
Response:
```json
{"type":"mcp.ble.write.ok","id":"b4","payload":{"msg":"Write successful"}}
```

Subscribe (notifications):
Request:
```json
{"type":"mcp.ble.subscribe","id":"b5","payload":{"deviceId":"<id>","characteristicUuid":"<uuid>"}}
```
Response:
```json
{"type":"mcp.ble.subscribe.ok","id":"b5","payload":{"msg":"Subscription successful","deviceId":"string","characteristicUuid":"string"}}
```

Notifications are sent as:
```json
{"type":"mcp.ble.notification","id":null,"payload":{"deviceId":"...","characteristicUuid":"...","data":"<hex>","ts":"..."}}
```

## Tool authoring (server side)
Register tools from server code:
```javascript
const mcp = require('./mcp-server');

mcp.registerTool({ id: 'echo', name: 'Echo', description: 'Echo input' }, async (input, context, onProgress) => {
  onProgress({ percent: 10 });
  // do work...
  onProgress({ percent: 100 });
  return { echoed: input };
});
```

Handler signature:
- async function(input, context, onProgress)
- Optionally return an object with { result, cancel } to support cancelable execution.

## Tests

Tests use Jest and are placed under `test/`. Run:
```bash
npm test
```

Included tests cover:
- BLE device listing via MCP
- Tool execution event streaming

## Notes
- This server implements MCP-style JSON envelopes only (legacy command handling removed).
- The MCP implementation expects `ble-manager` to expose promise-based functions:
  - getDevices(), connectDevice(deviceId), disconnectDevice(deviceId),
    getServices(deviceId), getCharacteristics(deviceId, serviceUuid),
    readCharacteristic(deviceId, characteristicUuid),
    writeCharacteristic(deviceId, characteristicUuid, value, withoutResponse),
    subscribe(deviceId, characteristicUuid, listener),
    unsubscribe(deviceId, characteristicUuid, listener),
    getNotifications(deviceId, characteristicUuid)
- Adjust `ble-manager` as needed.
