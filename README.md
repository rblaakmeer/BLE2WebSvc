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
