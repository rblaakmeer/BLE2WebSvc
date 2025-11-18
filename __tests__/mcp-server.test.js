const net = require('net');
jest.mock('../ble-manager'); // stub ble-manager functions

const bleManager = require('../ble-manager');
const mcp = require('../mcp-server');

describe('MCP server', () => {
    beforeAll(() => {
        bleManager.getDevices.mockResolvedValue([{id:'dev1', name:'Test'}]);
        mcp.start(8124);
    });
    afterAll(done => {
        mcp.stop(done);
    });

    test('returns device list on listDevices', (done) => {
        const client = net.createConnection(8124, '127.0.0.1', () => {
            client.write(JSON.stringify({id:'r1', cmd:'listDevices'}) + '\n');
        });
        client.setEncoding('utf8');
        client.on('data', (data) => {
            if (data.includes('"devices"')) {
                expect(data).toMatch(/Test/);
                client.end();
                done();
            }
        });
    });
});