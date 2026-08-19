const net = require('net');
jest.mock('../ble-manager'); // stub ble-manager functions

const bleManager = require('../ble-manager');
const mcp = require('../mcp-server');
const { MCPServer } = require('../mcp-server');

function startServer(server) {
  return new Promise(resolve => server.start(0, '127.0.0.1', resolve));
}

function readMessages(socket) {
  const messages = [];
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', chunk => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) messages.push(JSON.parse(line));
    }
  });
  return messages;
}

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

  test('refuses a non-loopback listener', () => {
    expect(() => mcp.start(0, '0.0.0.0')).toThrow(/outside loopback/);
  });

  test('limits unauthenticated clients and drops idle handshakes', async () => {
    const limited = new MCPServer();
    limited.authToken = 'test-token';
    limited.maxUnauthenticatedClients = 1;
    limited.handshakeTimeoutMs = 30;
    limited.idleTimeoutMs = 1_000;
    await startServer(limited);
    const port = limited.server.address().port;

    const first = net.createConnection({ port, host: '127.0.0.1' });
    const firstMessages = readMessages(first);
    await new Promise(resolve => first.once('data', resolve));

    const second = net.createConnection({ port, host: '127.0.0.1' });
    const secondMessages = readMessages(second);
    await new Promise(resolve => second.once('close', resolve));

    expect(firstMessages[0].type).toBe('mcp/handshake');
    expect(secondMessages[0]).toEqual(expect.objectContaining({
      type: 'mcp/error',
      payload: { code: 'too_many_unauthenticated_clients' }
    }));

    const firstClosed = new Promise(resolve => first.once('close', resolve));
    await firstClosed;
    await new Promise(resolve => limited.stop(resolve));
  });

  test('limits total idle client connections', async () => {
    const limited = new MCPServer();
    limited.maxClients = 1;
    limited.idleTimeoutMs = 1_000;
    await startServer(limited);
    const port = limited.server.address().port;

    const first = net.createConnection({ port, host: '127.0.0.1' });
    readMessages(first);
    await new Promise(resolve => first.once('data', resolve));

    const second = net.createConnection({ port, host: '127.0.0.1' });
    const secondMessages = readMessages(second);
    await new Promise(resolve => second.once('close', resolve));

    expect(secondMessages[0]).toEqual(expect.objectContaining({
      type: 'mcp/error',
      payload: { code: 'server_busy' }
    }));

    first.destroy();
    await new Promise(resolve => limited.stop(resolve));
  });
});
