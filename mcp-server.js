const net = require('net');
const EventEmitter = require('events');
const bleManager = require('./ble-manager');

class MCPServer {
    constructor(port) {
        this.port = port || process.env.MCP_PORT || 8123;
        this.server = null;
        this.clients = new Set();
        this.subscriptions = new Map(); // key: socket, value: Map<charKey, listener>
        this.authToken = process.env.MCP_TOKEN || null;
    }

    start() {
        this.server = net.createServer(socket => this._onConnection(socket));
        this.server.listen(this.port);
        console.log(`MCP server listening on ${this.port}`);
        return this.server;
    }

    stop(callback) {
        for (const c of this.clients) c.destroy();
        if (this.server) this.server.close(callback);
    }

    _onConnection(socket) {
        socket.setEncoding('utf8');
        this.clients.add(socket);
        this.subscriptions.set(socket, new Map());

        socket.write(JSON.stringify({id: 'welcome', status: 'ok', server: 'BLE2WebSvc MCP'}) + '\n');

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
        });

        socket.on('error', () => {
            this._cleanSubscriptions(socket);
            this.clients.delete(socket);
        });
    }

    async _handleMessage(socket, raw) {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (err) {
            socket.write(JSON.stringify({status: 'error', error: 'invalid_json'}) + '\n');
            return;
        }

        // optional auth requirement
        if (this.authToken) {
            if (!socket._mcpAuthenticated) {
                if (!msg.cmd || msg.cmd !== 'auth') {
                    socket.write(JSON.stringify({status: 'error', error: 'authentication_required'}) + '\n');
                    return;
                }
                if (msg.token !== this.authToken) {
                    socket.write(JSON.stringify({status: 'error', error: 'invalid_token'}) + '\n');
                    return;
                }
                socket._mcpAuthenticated = true;
                socket.write(JSON.stringify({status: 'ok', id: msg.id || null, msg: 'authenticated'}) + '\n');
                return;
            }
        }

        const cmd = msg.cmd && msg.cmd.toLowerCase();
        try {
            switch (cmd) {
                case 'listdevices':
                case 'devices': {
                    const devs = await bleManager.getDevices();
                    socket.write(JSON.stringify({status: 'ok', id: msg.id || null, devices: devs}) + '\n');
                    break;
                }
                case 'connect': {
                    const deviceId = msg.deviceId;
                    if (!deviceId) throw new Error('missing_deviceId');
                    const res = await bleManager.connectDevice(deviceId);
                    socket.write(JSON.stringify({status: 'ok', id: msg.id || null, device: res}) + '\n');
                    break;
                }
                case 'disconnect': {
                    const deviceId = msg.deviceId;
                    if (!deviceId) throw new Error('missing_deviceId');
                    const res = await bleManager.disconnectDevice(deviceId);
                    socket.write(JSON.stringify({status: 'ok', id: msg.id || null, device: res}) + '\n');
                    break;
                }
                case 'services': {
                    const {deviceId} = msg;
                    if (!deviceId) throw new Error('missing_deviceId');
                    const services = await bleManager.getServices(deviceId);
                    socket.write(JSON.stringify({status: 'ok', id: msg.id || null, services}) + '\n');
                    break;
                }
                case 'characteristics': {
                    const {deviceId, serviceUuid} = msg;
                    if (!deviceId || !serviceUuid) throw new Error('missing_params');
                    const chars = await bleManager.getCharacteristics(deviceId, serviceUuid);
                    socket.write(JSON.stringify({status: 'ok', id: msg.id || null, characteristics: chars}) + '\n');
                    break;
                }
                case 'read': {
                    const {deviceId, characteristicUuid} = msg;
                    if (!deviceId || !characteristicUuid) throw new Error('missing_params');
                    const value = await bleManager.readCharacteristic(deviceId, characteristicUuid);
                    socket.write(JSON.stringify({status: 'ok', id: msg.id || null, characteristicUuid, value}) + '\n');
                    break;
                }
                case 'write': {
                    const {deviceId, characteristicUuid, value, withoutResponse} = msg;
                    if (!deviceId || !characteristicUuid || !value) throw new Error('missing_params');
                    await bleManager.writeCharacteristic(deviceId, characteristicUuid, value, !!withoutResponse);
                    socket.write(JSON.stringify({status: 'ok', id: msg.id || null, msg: 'written'}) + '\n');
                    break;
                }
                case 'subscribe': {
                    const {deviceId, characteristicUuid} = msg;
                    if (!deviceId || !characteristicUuid) throw new Error('missing_params');
                    // subscribe via bleManager; expected to return an EventEmitter or callback registration
                    const listener = (data) => {
                        socket.write(JSON.stringify({
                            status: 'notification',
                            deviceId,
                            characteristicUuid,
                            data: data.toString('hex'),
                            ts: new Date().toISOString()
                        }) + '\n');
                    };
                    await bleManager.subscribe(deviceId, characteristicUuid, listener);
                    this.subscriptions.get(socket).set(`${deviceId}:${characteristicUuid}`, listener);
                    socket.write(JSON.stringify({status: 'ok', id: msg.id || null, msg: 'subscribed'}) + '\n');
                    break;
                }
                case 'unsubscribe': {
                    const {deviceId, characteristicUuid} = msg;
                    if (!deviceId || !characteristicUuid) throw new Error('missing_params');
                    const key = `${deviceId}:${characteristicUuid}`;
                    const listener = this.subscriptions.get(socket).get(key);
                    if (listener) {
                        await bleManager.unsubscribe(deviceId, characteristicUuid, listener);
                        this.subscriptions.get(socket).delete(key);
                        socket.write(JSON.stringify({status: 'ok', id: msg.id || null, msg: 'unsubscribed'}) + '\n');
                    } else {
                        socket.write(JSON.stringify({status: 'error', id: msg.id || null, error: 'not_subscribed'}) + '\n');
                    }
                    break;
                }
                case 'getnotifications': {
                    const {deviceId, characteristicUuid} = msg;
                    if (!deviceId || !characteristicUuid) throw new Error('missing_params');
                    const notifications = await bleManager.getNotifications(deviceId, characteristicUuid);
                    socket.write(JSON.stringify({status: 'ok', id: msg.id || null, notifications}) + '\n');
                    break;
                }
                default:
                    socket.write(JSON.stringify({status: 'error', id: msg.id || null, error: 'unsupported_command'}) + '\n');
            }
        } catch (err) {
            socket.write(JSON.stringify({status: 'error', id: msg.id || null, error: err.message || String(err)}) + '\n');
        }
    }

    _cleanSubscriptions(socket) {
        const map = this.subscriptions.get(socket);
        if (!map) return;
        for (const [key, listener] of map.entries()) {
            const [deviceId, characteristicUuid] = key.split(':');
            // best-effort cleanup
            try {
                bleManager.unsubscribe(deviceId, characteristicUuid, listener).catch(()=>{});
            } catch {}
        }
        map.clear();
    }
}

module.exports = new MCPServer();