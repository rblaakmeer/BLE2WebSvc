const net = require('net');
const bleManager = require('./ble-manager');
const crypto = require('crypto');

class MCPServer {
    constructor(port) {
        this.port = port || process.env.MCP_PORT || 8123;
        this.server = null;
        this.clients = new Set();
        this.subscriptions = new Map(); // socket -> Map<deviceId:charUuid, listener>
        this.authToken = process.env.MCP_TOKEN || null;

        // Tool / execution management (MCP SDK)
        this.tools = new Map(); // toolId -> { meta, handler }
        this.executions = new Map(); // execId -> { toolId, status, result, cancelFn }
        this.execSubscribers = new Map(); // execId -> Set(sockets)
        this._execCounter = 0;
    }

    start(port, callback) {
        if (typeof port === 'function') {
            callback = port;
            port = null;
        }
        this.port = port || this.port;
        this.server = net.createServer(socket => this._onConnection(socket));
        this.server.listen(this.port, () => {
            console.log(`MCP server listening on ${this.port}`);
            if (callback) {
                callback();
            }
        });
        return this.server;
    }

    stop(callback) {
        for (const c of this.clients) c.destroy();
        if (this.server) this.server.close(callback);
    }

    registerTool(toolDef, handler) {
        if (!toolDef || !toolDef.id) throw new Error('tool_def_missing_id');
        if (this.tools.has(toolDef.id)) throw new Error('tool_already_registered');
        this.tools.set(toolDef.id, { meta: toolDef, handler });
        return toolDef.id;
    }

    _onConnection(socket) {
        socket.setEncoding('utf8');
        this.clients.add(socket);
        this.subscriptions.set(socket, new Map());

        socket.write(JSON.stringify({ type: 'mcp/handshake', id: null, payload: { server: 'BLE2WebSvc MCP', version: '1.0' } }) + '\n');

        let buffer = '';
        socket.on('data', chunk => {
            buffer += chunk;
            let idx;
            while ((idx = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (line.length) this._handleMessage(socket, line);
            }
        });

        socket.on('close', () => {
            this._cleanSubscriptions(socket);
            this.subscriptions.delete(socket);
            this.clients.delete(socket);
            for (const subs of this.execSubscribers.values()) subs.delete(socket);
        });

        socket.on('error', () => {
            this._cleanSubscriptions(socket);
            this.clients.delete(socket);
            for (const subs of this.execSubscribers.values()) subs.delete(socket);
        });
    }

    async _handleMessage(socket, raw) {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (err) {
            socket.write(JSON.stringify({ type: 'mcp/error', id: null, payload: { code: 'invalid_json' } }) + '\n');
            return;
        }

        // normalize envelope
        const type = (msg.type && String(msg.type).toLowerCase()) || null;
        const id = msg.id || null;
        const payload = msg.payload || {};

        // auth if required (expecting type 'mcp/auth' with payload.token)
        if (this.authToken && !socket._mcpAuthenticated) {
            if (type !== 'mcp/auth') {
                socket.write(JSON.stringify({ type: 'mcp/error', id, payload: { code: 'authentication_required' } }) + '\n');
                return;
            }
            const token = payload.token;
            if (token !== this.authToken) {
                socket.write(JSON.stringify({ type: 'mcp/error', id, payload: { code: 'invalid_token' } }) + '\n');
                return;
            }
            socket._mcpAuthenticated = true;
            socket.write(JSON.stringify({ type: 'mcp/auth.ok', id, payload: { msg: 'authenticated' } }) + '\n');
            return;
        }

        try {
            // Tool discovery
            if (type === 'mcp.tools.discover' || type === 'mcp.tools.list') {
                const list = [];
                for (const [tid, t] of this.tools.entries()) list.push(Object.assign({ id: tid }, t.meta));
                socket.write(JSON.stringify({ type: 'mcp.tools.list.result', id, payload: { tools: list } }) + '\n');
                return;
            }

            if (type === 'mcp.tool.info') {
                const toolId = payload.toolId;
                if (!toolId) throw new Error('missing_toolId');
                const entry = this.tools.get(toolId);
                if (!entry) throw new Error('tool_not_found');
                socket.write(JSON.stringify({ type: 'mcp.tool.info.result', id, payload: { tool: Object.assign({ id: toolId }, entry.meta) } }) + '\n');
                return;
            }

            // Tool execution
            if (type === 'mcp.tool.execute') {
                const toolId = payload.toolId;
                if (!toolId) throw new Error('missing_toolId');
                const entry = this.tools.get(toolId);
                if (!entry) throw new Error('tool_not_found');

                const execId = this._generateExecId();
                this.executions.set(execId, { toolId, status: 'running', result: null, cancelFn: null });
                this.execSubscribers.set(execId, new Set([socket]));

                const broadcast = (evtType, data) => {
                    const msg = JSON.stringify({ type: 'mcp.tool.event', id: null, payload: { event: evtType, execId, toolId, data, ts: new Date().toISOString() } }) + '\n';
                    const subs = this.execSubscribers.get(execId) || new Set();
                    for (const s of subs) {
                        try { s.write(msg); } catch (_) {}
                    }
                };

                const onProgress = (p) => broadcast('progress', p);

                (async () => {
                    try {
                        const maybe = await entry.handler(payload.input, payload.context || {}, onProgress);
                        if (maybe && typeof maybe === 'object' && typeof maybe.cancel === 'function') {
                            this.executions.get(execId).cancelFn = maybe.cancel;
                            this.executions.get(execId).result = maybe.result || null;
                        } else {
                            this.executions.get(execId).result = maybe;
                        }
                        this.executions.get(execId).status = 'completed';
                        broadcast('completed', this.executions.get(execId).result);
                    } catch (err) {
                        this.executions.get(execId).status = 'failed';
                        this.executions.get(execId).result = { error: err && err.message ? err.message : String(err) };
                        broadcast('failed', this.executions.get(execId).result);
                    }
                })();

                socket.write(JSON.stringify({ type: 'mcp.tool.execute.started', id, payload: { execId, toolId } }) + '\n');
                return;
            }

            // Execution subscription management
            if (type === 'mcp.exec.subscribe') {
                const execId = payload.execId;
                if (!execId) throw new Error('missing_execId');
                if (!this.executions.has(execId)) throw new Error('execution_not_found');
                const subs = this.execSubscribers.get(execId) || new Set();
                subs.add(socket);
                this.execSubscribers.set(execId, subs);
                socket.write(JSON.stringify({ type: 'mcp.exec.subscribe.ack', id, payload: { execId } }) + '\n');
                return;
            }

            if (type === 'mcp.exec.unsubscribe') {
                const execId = payload.execId;
                if (!execId) throw new Error('missing_execId');
                const subs = this.execSubscribers.get(execId);
                if (subs) subs.delete(socket);
                socket.write(JSON.stringify({ type: 'mcp.exec.unsubscribe.ack', id, payload: { execId } }) + '\n');
                return;
            }

            if (type === 'mcp.exec.status') {
                const execId = payload.execId;
                if (!execId) throw new Error('missing_execId');
                const rec = this.executions.get(execId);
                if (!rec) throw new Error('execution_not_found');
                socket.write(JSON.stringify({ type: 'mcp.exec.status.result', id, payload: { execId, toolId: rec.toolId, state: rec.status, result: rec.result } }) + '\n');
                return;
            }

            if (type === 'mcp.exec.cancel') {
                const execId = payload.execId;
                if (!execId) throw new Error('missing_execId');
                const rec = this.executions.get(execId);
                if (!rec) throw new Error('execution_not_found');
                if (rec.cancelFn && typeof rec.cancelFn === 'function') {
                    try {
                        await rec.cancelFn();
                        rec.status = 'cancelled';
                        socket.write(JSON.stringify({ type: 'mcp.exec.cancel.ack', id, payload: { execId, status: 'cancelled' } }) + '\n');
                        const s = JSON.stringify({ type: 'mcp.tool.event', id: null, payload: { event: 'cancelled', execId, toolId: rec.toolId, ts: new Date().toISOString() } }) + '\n';
                        const subs = this.execSubscribers.get(execId) || new Set();
                        for (const sub of subs) try { sub.write(s); } catch (_) {}
                    } catch (err) {
                        throw new Error('cancel_failed');
                    }
                } else {
                    throw new Error('not_cancellable');
                }
                return;
            }

            // BLE operations via MCP envelope
            if (type === 'mcp.ble.devices') {
                const devs = await bleManager.getDiscoveredPeripherals();
                socket.write(JSON.stringify({ type: 'mcp.ble.devices.result', id, payload: { devices: devs } }) + '\n');
                return;
            }

            if (type === 'mcp.ble.connect') {
                const deviceId = payload.deviceId;
                if (!deviceId) throw new Error('missing_deviceId');
                const res = await bleManager.connectDevice(deviceId);
                socket.write(JSON.stringify({ type: 'mcp.ble.connect.result', id, payload: { device: res } }) + '\n');
                return;
            }

            if (type === 'mcp.ble.disconnect') {
                const deviceId = payload.deviceId;
                if (!deviceId) throw new Error('missing_deviceId');
                const res = await bleManager.disconnectDevice(deviceId);
                socket.write(JSON.stringify({ type: 'mcp.ble.disconnect.result', id, payload: { device: res } }) + '\n');
                return;
            }

            if (type === 'mcp.ble.services') {
                const deviceId = payload.deviceId;
                if (!deviceId) throw new Error('missing_deviceId');
                const services = await bleManager.getServices(deviceId);
                socket.write(JSON.stringify({ type: 'mcp.ble.services.result', id, payload: { services } }) + '\n');
                return;
            }

            if (type === 'mcp.ble.characteristics') {
                const { deviceId, serviceUuid } = payload;
                if (!deviceId || !serviceUuid) throw new Error('missing_params');
                const chars = await bleManager.getCharacteristics(deviceId, serviceUuid);
                socket.write(JSON.stringify({ type: 'mcp.ble.characteristics.result', id, payload: { characteristics: chars } }) + '\n');
                return;
            }

            if (type === 'mcp.ble.read') {
                const { deviceId, characteristicUuid } = payload;
                if (!deviceId || !characteristicUuid) throw new Error('missing_params');
                const value = await bleManager.readCharacteristic(deviceId, characteristicUuid);
                socket.write(JSON.stringify({ type: 'mcp.ble.read.result', id, payload: { characteristicUuid, value } }) + '\n');
                return;
            }

            if (type === 'mcp.ble.write') {
                const { deviceId, characteristicUuid, value, withoutResponse } = payload;
                if (!deviceId || !characteristicUuid || typeof value === 'undefined') throw new Error('missing_params');
                await bleManager.writeCharacteristic(deviceId, characteristicUuid, value, !!withoutResponse);
                socket.write(JSON.stringify({ type: 'mcp.ble.write.result', id, payload: { msg: 'written' } }) + '\n');
                return;
            }

            if (type === 'mcp.ble.subscribe') {
                const { deviceId, characteristicUuid } = payload;
                if (!deviceId || !characteristicUuid) throw new Error('missing_params');
                const listener = (data) => {
                    const nm = { type: 'mcp.ble.notification', id: null, payload: { deviceId, characteristicUuid, data: data.toString('hex'), ts: new Date().toISOString() } };
                    try { socket.write(JSON.stringify(nm) + '\n'); } catch (_) {}
                };
                await bleManager.subscribe(deviceId, characteristicUuid, listener);
                this.subscriptions.get(socket).set(`${deviceId}:${characteristicUuid}`, listener);
                socket.write(JSON.stringify({ type: 'mcp.ble.subscribe.result', id, payload: { msg: 'subscribed' } }) + '\n');
                return;
            }

            if (type === 'mcp.ble.unsubscribe') {
                const { deviceId, characteristicUuid } = payload;
                if (!deviceId || !characteristicUuid) throw new Error('missing_params');
                const key = `${deviceId}:${characteristicUuid}`;
                const listener = this.subscriptions.get(socket).get(key);
                if (listener) {
                    await bleManager.unsubscribe(deviceId, characteristicUuid, listener);
                    this.subscriptions.get(socket).delete(key);
                    socket.write(JSON.stringify({ type: 'mcp.ble.unsubscribe.result', id, payload: { msg: 'unsubscribed' } }) + '\n');
                } else {
                    throw new Error('not_subscribed');
                }
                return;
            }

            if (type === 'mcp.ble.getnotifications') {
                const { deviceId, characteristicUuid } = payload;
                if (!deviceId || !characteristicUuid) throw new Error('missing_params');
                const notifications = await bleManager.getNotifications(deviceId, characteristicUuid);
                socket.write(JSON.stringify({ type: 'mcp.ble.getnotifications.result', id, payload: { notifications } }) + '\n');
                return;
            }

            // unknown / unsupported
            socket.write(JSON.stringify({ type: 'mcp/error', id, payload: { code: 'unsupported_command' } }) + '\n');
        } catch (err) {
            socket.write(JSON.stringify({ type: 'mcp/error', id, payload: { code: err.message || String(err) } }) + '\n');
        }
    }

    _cleanSubscriptions(socket) {
        const map = this.subscriptions.get(socket);
        if (!map) return;
        for (const [key, listener] of map.entries()) {
            const [deviceId, characteristicUuid] = key.split(':');
            try {
                bleManager.unsubscribe(deviceId, characteristicUuid, listener).catch(()=>{});
            } catch {}
        }
        map.clear();

        for (const [execId, rec] of this.executions.entries()) {
            const subs = this.execSubscribers.get(execId);
            if (subs) subs.delete(socket);
        }
    }

    _generateExecId() {
        if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        this._execCounter += 1;
        return `${Date.now()}-${process.pid}-${this._execCounter}`;
    }
}

module.exports = new MCPServer();