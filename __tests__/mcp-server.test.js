const net = require('net');
jest.mock('../ble-manager'); // stub ble-manager functions

const bleManager = require('../ble-manager');
const mcp = require('../mcp-server');

describe('MCP server (SDK envelope)', () => {
  beforeAll(done => {
    bleManager.getDiscoveredPeripherals.mockResolvedValue([{ id: 'dev1', name: 'Test' }]);
    mcp.start(8124, done);
  });

  afterAll(done => {
    mcp.stop(() => {
        done();
    });
  });

  test('responds with device list for mcp.ble.devices', (done) => {
    const client = net.createConnection({ port: 8124, host: '127.0.0.1' }, () => {
      // send MCP SDK envelope
      client.write(JSON.stringify({ type: 'mcp.ble.devices', id: 'r1', payload: {} }) + '\n');
    });
    client.setEncoding('utf8');

    let buffer = '';
    client.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.type === 'mcp.ble.devices.result') {
          expect(msg.payload).toHaveProperty('devices');
          expect(Array.isArray(msg.payload.devices)).toBe(true);
          expect(msg.payload.devices[0].id).toBe('dev1');
          client.end();
          done();
        }
      }
    });

    client.on('error', (err) => {
      done(err);
    });
  });
});