// __tests__/ble-manager.test.js
const nobleMock = require('@abandonware/noble'); // Jest uses __mocks__/@abandonware/noble.js
const MockPeripheral = nobleMock.Peripheral; // Get the MockPeripheral class from the mock

let bleManager;

describe('ble-Manager', () => {
  beforeEach(() => {
    // Reset modules before each test to ensure a clean state, especially for discoveredPeripherals
    jest.resetModules();
    // Re-require bleManager to get a fresh instance with cleared discoveredPeripherals
    bleManager = require('../ble-manager.js'); 
    // Clear any mock calls from previous tests
    nobleMock.startScanning.mockClear();
    nobleMock.stopScanning.mockClear();
    // Reset the discoveredPeripherals array in the module if it's accessible and mutable for testing
    // (bleManager.js currently exports discoveredPeripherals, so we can clear it)
    if (bleManager.discoveredPeripherals) {
        bleManager.discoveredPeripherals.length = 0;
    }
    // Also clear connected peripherals map
    if (bleManager.connectedPeripherals) {
        for (const key in bleManager.connectedPeripherals) {
            delete bleManager.connectedPeripherals[key];
        }
    }
  });

  describe('Noble State Changes', () => {
    it('should start scanning when noble state changes to poweredOn', () => {
      nobleMock.emit('stateChange', 'poweredOn');
      expect(nobleMock.startScanning).toHaveBeenCalledTimes(1);
    });

    it('should stop scanning when noble state changes to other than poweredOn', () => {
      nobleMock.emit('stateChange', 'poweredOff');
      expect(nobleMock.stopScanning).toHaveBeenCalledTimes(1);
    });
  });

  describe('Device Discovery and getDiscoveredPeripherals', () => {
    it('should add discovered peripherals to the list and format them correctly', () => {
      const mockPeripheral1 = new MockPeripheral('id1', { localName: 'Device1', serviceUuids: ['sUUID1'] });
      mockPeripheral1.address = 'addr1';
      mockPeripheral1.state = 'disconnected';
      
      const mockPeripheral2 = new MockPeripheral('id2', { localName: 'Device2', serviceUuids: ['sUUID2'] });
      mockPeripheral2.address = 'addr2';
      mockPeripheral2.state = 'disconnected';

      nobleMock.emit('discover', mockPeripheral1);
      nobleMock.emit('discover', mockPeripheral2);

      const discovered = bleManager.getDiscoveredPeripherals();
      expect(discovered).toHaveLength(2);
      expect(discovered).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'id1', name: 'Device1', address: 'addr1', advertisedServices: ['sUUID1'], state: 'disconnected' }),
        expect.objectContaining({ id: 'id2', name: 'Device2', address: 'addr2', advertisedServices: ['sUUID2'], state: 'disconnected' }),
      ]));
    });

    it('should not add duplicate peripherals to the list', () => {
      const mockPeripheral1 = new MockPeripheral('id1', { localName: 'Device1' });
      
      nobleMock.emit('discover', mockPeripheral1);
      nobleMock.emit('discover', mockPeripheral1); // Emit the same device again

      const discovered = bleManager.getDiscoveredPeripherals();
      expect(discovered).toHaveLength(1);
      expect(discovered[0]).toEqual(expect.objectContaining({ id: 'id1', name: 'Device1' }));
    });
  });

  describe('connectDevice', () => {
    let mockPeripheral;

    beforeEach(() => {
      // Setup a discoverable peripheral for connection tests
      mockPeripheral = new MockPeripheral('conn-id1', { localName: 'ConnectDevice' });
      nobleMock.emit('discover', mockPeripheral);
    });

    it('should connect to a discovered peripheral and discover services/characteristics', async () => {
      const connectionPromise = bleManager.connectDevice('conn-id1');
      
      // Check that peripheral.connect was called
      expect(mockPeripheral.connect).toHaveBeenCalledTimes(1);

      // Simulate successful connection and discovery from the mock
      // (MockPeripheral's connect and discoverAllServicesAndCharacteristics are jest.fn that emit/callback success by default)
      
      await expect(connectionPromise).resolves.toEqual(
        expect.objectContaining({ id: 'conn-id1', name: 'ConnectDevice', state: 'connected' })
      );
      expect(bleManager.connectedPeripherals['conn-id1']).toBe(mockPeripheral);
      expect(mockPeripheral.discoverAllServicesAndCharacteristics).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setImmediate(resolve)); // Added line
    });

    it('should reject if peripheral connect call fails', async () => {
      // Override default mock behavior for this test
      mockPeripheral.connect.mockImplementationOnce(callback => {
        if (callback) callback(new Error('Connection Failed')); // Simulate error from noble
        // Note: if connect itself throws or emits error, the mock needs to simulate that.
        // Our current mock calls callback(error), which is one way noble does it.
      });

      await expect(bleManager.connectDevice('conn-id1')).rejects.toThrow('Connection Failed');
      expect(bleManager.connectedPeripherals['conn-id1']).toBeUndefined();
    });
    
    it('should reject if service/characteristic discovery fails after connection', async () => {
      mockPeripheral.discoverAllServicesAndCharacteristics.mockImplementationOnce(callback => {
        if (callback) callback(new Error('Discovery Failed'), null, null);
      });

      // The connect itself will succeed first
      mockPeripheral.connect.mockImplementationOnce(callback => {
        mockPeripheral.state = 'connected'; // Manually set state for this path
        if (callback) callback(null);
        mockPeripheral.emit('connect'); // Emit connect to trigger discovery
      });
      
      await expect(bleManager.connectDevice('conn-id1')).rejects.toThrow('Failed to discover services/characteristics: Discovery Failed');
      expect(bleManager.connectedPeripherals['conn-id1']).toBeUndefined(); // Should be removed if discovery fails
      await new Promise(resolve => setImmediate(resolve)); // Added line
    });

    it('should reject if trying to connect to a non-existent peripheral', async () => {
      await expect(bleManager.connectDevice('non-existent-id')).rejects.toThrow('Peripheral not found');
    });

    it('should reject if trying to connect to an already connected peripheral', async () => {
      // First connection
      await bleManager.connectDevice('conn-id1');
      // Try connecting again
      await expect(bleManager.connectDevice('conn-id1')).rejects.toThrow('Peripheral already connected or connecting');
      // Adding setImmediate here as well, as it involves a resolved promise from connectDevice
      await new Promise(resolve => setImmediate(resolve));
    });
    
    it('should reject if peripheral disconnects during connection attempt', async () => {
      mockPeripheral.connect.mockImplementationOnce(() => {
        // Simulate peripheral emitting 'disconnect' after connect() is called but before 'connect' event
        mockPeripheral.emit('disconnect'); 
      });
      await expect(bleManager.connectDevice('conn-id1')).rejects.toThrow('Peripheral disconnected during connection process');
    });
  });

  describe('disconnectDevice', () => {
    let mockPeripheral;

    beforeEach(async () => {
      // Setup and connect a peripheral for disconnection tests
      mockPeripheral = new MockPeripheral('disconn-id1', { localName: 'DisconnectDevice' });
      nobleMock.emit('discover', mockPeripheral);
      // Connect the device
      await bleManager.connectDevice('disconn-id1');
      // Clear mock calls from the connection part
      mockPeripheral.disconnect.mockClear(); 
      // Ensure connectDevice's async operations complete before disconnect tests run
      await new Promise(resolve => setImmediate(resolve)); 
    });

    it('should disconnect from a connected peripheral', async () => {
      const disconnectPromise = bleManager.disconnectDevice('disconn-id1');
      expect(mockPeripheral.disconnect).toHaveBeenCalledTimes(1);
      
      // MockPeripheral's disconnect is jest.fn that emits/callbacks success by default
      await expect(disconnectPromise).resolves.toEqual(
        expect.objectContaining({ id: 'disconn-id1', message: 'Disconnected successfully' })
      );
      expect(bleManager.connectedPeripherals['disconn-id1']).toBeUndefined();
      await new Promise(resolve => setImmediate(resolve)); 
    });

    it('should reject if peripheral disconnect call fails', async () => {
      mockPeripheral.disconnect.mockImplementationOnce(callback => {
        if (callback) callback(new Error('Disconnection Failed'));
      });
      await expect(bleManager.disconnectDevice('disconn-id1')).rejects.toThrow('Disconnection Failed');
      // Peripheral might still be in connectedPeripherals if only the callback errored
      // depending on how noble handles this. For our ble-manager, it would still be there.
      expect(bleManager.connectedPeripherals['disconn-id1']).toBe(mockPeripheral); 
      await new Promise(resolve => setImmediate(resolve)); 
    });

    it('should reject if trying to disconnect a non-connected peripheral ID', async () => {
      await expect(bleManager.disconnectDevice('non-existent-id')).rejects.toThrow('Peripheral not connected or not found');
      await new Promise(resolve => setImmediate(resolve)); 
    });
  });

  describe('Service and Characteristic Operations', () => {
    let mockPeripheral;
    const peripheralId = 'op-device-id';
    const serviceUuid1 = 's_uuid1';
    const charUuid1 = 'c_uuid1'; // Readable/Writable
    const charUuid2 = 'c_uuid2'; // Readable only
    const charUuid3 = 'c_uuid3'; // Writable only (no response)

    beforeEach(async () => {
      // Mock a peripheral with services and characteristics
      mockPeripheral = new MockPeripheral(peripheralId, { localName: 'OpDevice' });
      
      // Define mock services and characteristics directly on the peripheral instance for tests
      const mockChar1 = { uuid: charUuid1, properties: ['read', 'write'], read: jest.fn((cb) => cb(null, Buffer.from('hello'))), write: jest.fn((data, withoutResponse, cb) => cb(null)) };
      const mockChar2 = { uuid: charUuid2, properties: ['read'], read: jest.fn((cb) => cb(null, Buffer.from('world'))), write: jest.fn() }; // no write
      const mockChar3 = { uuid: charUuid3, properties: ['writeWithoutResponse'], read: jest.fn(), write: jest.fn((data, withoutResponse, cb) => cb(null)) }; // no read

      mockPeripheral.services = [
        { 
          uuid: serviceUuid1, 
          characteristics: [mockChar1, mockChar2, mockChar3],
          // Mock discoverCharacteristics if ble-manager uses it (it uses discoverAllServicesAndCharacteristics)
        }
        // Add more services if needed
      ];
      // Make characteristics directly accessible if discoverAllServicesAndCharacteristics populates it that way
      // For noble, discoverAllServicesAndCharacteristics usually provides flat list of characteristics too,
      // but our ble-manager.js iterates services then characteristics. So, nested structure is fine for mock.

      // Simulate discovery and connection
      nobleMock.emit('discover', mockPeripheral);
      
      // Override connect and discoverAll to ensure our mockPeripheral setup is used
      mockPeripheral.connect.mockImplementationOnce(callback => {
        mockPeripheral.state = 'connected';
        if (callback) callback(null);
        mockPeripheral.emit('connect');
      });
      mockPeripheral.discoverAllServicesAndCharacteristics.mockImplementationOnce(callback => {
         // This ensures the peripheral object in connectedPeripherals has the services/characteristics
        if (callback) callback(null, mockPeripheral.services, mockPeripheral.services.flatMap(s => s.characteristics || []));
      });

      await bleManager.connectDevice(peripheralId);
      
      // Reset mocks on the characteristics for individual tests
      mockPeripheral.services.forEach(s => s.characteristics.forEach(c => {
        c.read.mockClear();
        c.write.mockClear();
      }));
      // Ensure connectDevice's async operations complete before service/char tests run
      await new Promise(resolve => setImmediate(resolve));
    });

    describe('getServices', () => {
      it('should return services of a connected peripheral', async () => {
        const services = await bleManager.getServices(peripheralId);
        expect(services).toHaveLength(1);
        expect(services[0]).toEqual(expect.objectContaining({ uuid: serviceUuid1 }));
        await new Promise(resolve => setImmediate(resolve));
      });

      it('should reject if peripheral is not connected', async () => {
        await expect(bleManager.getServices('non-connected-id')).rejects.toThrow('Peripheral not connected');
        await new Promise(resolve => setImmediate(resolve));
      });
    });

    describe('getCharacteristics', () => {
      it('should return characteristics of a specified service', async () => {
        const characteristics = await bleManager.getCharacteristics(peripheralId, serviceUuid1);
        expect(characteristics).toHaveLength(3);
        expect(characteristics).toEqual(expect.arrayContaining([
          expect.objectContaining({ uuid: charUuid1 }),
          expect.objectContaining({ uuid: charUuid2 }),
          expect.objectContaining({ uuid: charUuid3 }),
        ]));
        await new Promise(resolve => setImmediate(resolve));
      });

      it('should reject if service UUID is not found', async () => {
        await expect(bleManager.getCharacteristics(peripheralId, 'wrong-service-id')).rejects.toThrow('Service not found');
        await new Promise(resolve => setImmediate(resolve));
      });
      
      it('should reject if peripheral is not connected', async () => {
        await expect(bleManager.getCharacteristics('non-connected-id', serviceUuid1)).rejects.toThrow('Peripheral not connected');
        await new Promise(resolve => setImmediate(resolve));
      });
    });

    describe('readCharacteristic', () => {
      it('should read data from a readable characteristic', async () => {
        const data = await bleManager.readCharacteristic(peripheralId, charUuid1);
        const mockChar = mockPeripheral.services[0].characteristics.find(c=>c.uuid === charUuid1);
        expect(mockChar.read).toHaveBeenCalledTimes(1);
        expect(data).toBe(Buffer.from('hello').toString('hex'));
        await new Promise(resolve => setImmediate(resolve));
      });

      it('should reject if characteristic is not found', async () => {
        await expect(bleManager.readCharacteristic(peripheralId, 'wrong-char-id')).rejects.toThrow('Characteristic not found');
        await new Promise(resolve => setImmediate(resolve));
      });

      it('should reject if characteristic is not readable', async () => {
        await expect(bleManager.readCharacteristic(peripheralId, charUuid3)).rejects.toThrow('Characteristic not readable');
        await new Promise(resolve => setImmediate(resolve));
      });
      
      it('should reject if characteristic read call fails', async () => {
        const mockChar = mockPeripheral.services[0].characteristics.find(c=>c.uuid === charUuid1);
        mockChar.read.mockImplementationOnce((cb) => cb(new Error('Read Error')));
        await expect(bleManager.readCharacteristic(peripheralId, charUuid1)).rejects.toThrow('Read Error');
        await new Promise(resolve => setImmediate(resolve));
      });
    });

    describe('writeCharacteristic', () => {
      const hexValue = '010203';
      const bufferValue = Buffer.from(hexValue, 'hex');

      it('should write data to a writable characteristic (with response)', async () => {
        await bleManager.writeCharacteristic(peripheralId, charUuid1, hexValue, false);
        const mockChar = mockPeripheral.services[0].characteristics.find(c=>c.uuid === charUuid1);
        expect(mockChar.write).toHaveBeenCalledWith(bufferValue, false, expect.any(Function));
        await new Promise(resolve => setImmediate(resolve));
      });
      
      it('should write data to a writable characteristic (without response)', async () => {
        await bleManager.writeCharacteristic(peripheralId, charUuid3, hexValue, true);
        const mockChar = mockPeripheral.services[0].characteristics.find(c=>c.uuid === charUuid3);
        expect(mockChar.write).toHaveBeenCalledWith(bufferValue, true, expect.any(Function));
        await new Promise(resolve => setImmediate(resolve));
      });

      it('should reject if characteristic is not found', async () => {
        await expect(bleManager.writeCharacteristic(peripheralId, 'wrong-char-id', hexValue)).rejects.toThrow('Characteristic not found');
        await new Promise(resolve => setImmediate(resolve));
      });

      it('should reject if characteristic is not writable', async () => {
        await expect(bleManager.writeCharacteristic(peripheralId, charUuid2, hexValue)).rejects.toThrow('Characteristic not writable');
        await new Promise(resolve => setImmediate(resolve));
      });
      
      it('should reject if characteristic write call fails', async () => {
        const mockChar = mockPeripheral.services[0].characteristics.find(c=>c.uuid === charUuid1);
        mockChar.write.mockImplementationOnce((data, withoutResp, cb) => cb(new Error('Write Error')));
        await expect(bleManager.writeCharacteristic(peripheralId, charUuid1, hexValue)).rejects.toThrow('Write Error');
        await new Promise(resolve => setImmediate(resolve));
      });
    });
  });
});
