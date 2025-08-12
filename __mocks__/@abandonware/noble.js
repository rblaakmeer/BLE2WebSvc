const EventEmitter = require('events');

class MockNoble extends EventEmitter {
  constructor() {
    super();
    this.state = 'poweredOff';
    this.peripherals = {};

    // Mock functions
    this.startScanning = jest.fn((serviceUuids, allowDuplicates, callback) => {
      if (this.state !== 'poweredOn') {
        if (callback) {
          callback(new Error('BLE adapter not powered on'));
        }
        return;
      }
      this.emit('scanStart');
      if (callback) {
        callback(null);
      }
    });

    this.stopScanning = jest.fn((callback) => {
      this.emit('scanStop');
      if (callback) {
        callback(null);
      }
    });

    this.on = jest.fn(this.on);
    this.removeListener = jest.fn(this.removeListener);
    this.removeAllListeners = jest.fn(this.removeAllListeners);
  }

  // Helper to simulate a state change
  _setState(state) {
    this.state = state;
    this.emit('stateChange', state);
  }

  // Helper to simulate peripheral discovery
  _discover(peripheral) {
    this.peripherals[peripheral.id] = peripheral;
    this.emit('discover', peripheral);
  }

  // Reset all mocks
  _reset() {
    this.state = 'poweredOff';
    this.peripherals = {};
    this.startScanning.mockClear();
    this.stopScanning.mockClear();
    this.on.mockClear();
    this.removeListener.mockClear();
    this.removeAllListeners.mockClear();
  }
}

class MockPeripheral extends EventEmitter {
  constructor(id, name, advertisement = {}) {
    super();
    this.id = id;
    this.name = name;
    this.advertisement = { localName: name, ...advertisement };
    this.state = 'disconnected';
    this.services = [];

    // Mock functions
    this.connect = jest.fn((callback) => {
      if (this.state === 'connected') {
        if (callback) callback(new Error('Already connected'));
        return;
      }
      this.state = 'connecting';
      process.nextTick(() => {
        this.state = 'connected';
        this.emit('connect');
        if (callback) callback(null);
      });
    });

    this.disconnect = jest.fn((callback) => {
      this.state = 'disconnecting';
      process.nextTick(() => {
        this.state = 'disconnected';
        this.emit('disconnect');
        if (callback) callback(null);
      });
    });

    this.discoverAllServicesAndCharacteristics = jest.fn((callback) => {
      process.nextTick(() => {
        if (callback) callback(null, this.services, this.services.flatMap(s => s.characteristics));
      });
    });

    this.on = jest.fn(this.on);
    this.removeListener = jest.fn(this.removeListener);
    this.removeAllListeners = jest.fn(this.removeAllListeners);
    this.once = jest.fn(this.once);
  }

  _addService(service) {
    this.services.push(service);
  }
}

class MockService extends EventEmitter {
  constructor(uuid, characteristics = []) {
    super();
    this.uuid = uuid;
    this.name = `Service ${uuid}`;
    this.characteristics = characteristics;
  }

   _addCharacteristic(characteristic) {
    this.characteristics.push(characteristic);
  }
}

class MockCharacteristic extends EventEmitter {
  constructor(uuid, properties, data = Buffer.from([])) {
    super();
    this.uuid = uuid;
    this.name = `Characteristic ${uuid}`;
    this.properties = properties;
    this._data = data;

    this.read = jest.fn((callback) => {
      if (!this.properties.includes('read')) {
        if(callback) callback(new Error('Not a readable characteristic'));
        return;
      }
      process.nextTick(() => {
        if (callback) callback(null, this._data);
      });
    });

    this.write = jest.fn((buffer, withoutResponse, callback) => {
      if (!this.properties.includes('write') && !this.properties.includes('writeWithoutResponse')) {
        if(callback) callback(new Error('Not a writable characteristic'));
        return;
      }
      this._data = buffer;
      process.nextTick(() => {
        if (callback) callback(null);
      });
    });

    this.subscribe = jest.fn((callback) => {
       if (!this.properties.includes('notify') && !this.properties.includes('indicate')) {
        if(callback) callback(new Error('Characteristic does not support notifications or indications'));
        return;
      }
      process.nextTick(() => {
        if (callback) callback(null);
      });
    });

    this.unsubscribe = jest.fn((callback) => {
      process.nextTick(() => {
        if (callback) callback(null);
      });
    });
  }

  // Helper to simulate data notification
  _notify(data) {
    this._data = data;
    this.emit('data', data, true);
  }
}

const noble = new MockNoble();

// Attach mock classes to the instance for easy creation in tests
noble.MockPeripheral = MockPeripheral;
noble.MockService = MockService;
noble.MockCharacteristic = MockCharacteristic;

module.exports = noble;
