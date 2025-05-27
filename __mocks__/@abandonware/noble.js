// __mocks__/noble.js
const EventEmitter = require('events');

class MockPeripheral extends EventEmitter {
  constructor(id, advertisement) {
    super();
    this.id = id || 'mock-peripheral-id';
    this.advertisement = advertisement || { localName: 'Mock Peripheral' };
    this.state = 'disconnected'; // initial state
    this.services = [];
    this.characteristics = [];
  }

  connect = jest.fn(callback => {
    this.state = 'connected';
    if (callback) callback(null); // null for no error
    this.emit('connect');
  });

  disconnect = jest.fn(callback => {
    this.state = 'disconnected';
    if (callback) callback(null);
    this.emit('disconnect');
  });

  discoverAllServicesAndCharacteristics = jest.fn(callback => {
    // Simulate finding some services and characteristics
    this.services = [{ uuid: 's1', characteristics: [{ uuid: 'c1', properties: ['read', 'write'] }] }];
    this.characteristics = this.services[0].characteristics;
    if (callback) callback(null, this.services, this.characteristics);
  });
  
  // Add other Peripheral methods as needed for tests, e.g., read, write
  // For now, these can be simple jest.fn()
  read = jest.fn();
  write = jest.fn();
  // ... any other peripheral methods used by ble-manager
}

const noble = new EventEmitter();
noble.startScanning = jest.fn((serviceUuids, allowDuplicates, callback) => {
  if (callback) callback(null);
  noble.emit('scanStart');
  // Optionally, simulate finding a device for some tests
  // noble.emit('discover', new MockPeripheral());
});
noble.stopScanning = jest.fn(() => {
  noble.emit('scanStop');
});

// Export the mocked noble instance and the MockPeripheral class for tests to use/instantiate
module.exports = noble;
module.exports.Peripheral = MockPeripheral; // Allow tests to create instances if needed
