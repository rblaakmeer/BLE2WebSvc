// __tests__/ble-manager.test.js
const noble = require('@abandonware/noble');
const bleManager = require('../ble-manager');

// Mock the noble instance provided by the mock file
const mockNoble = noble;
const MockPeripheral = noble.MockPeripheral;
const MockService = noble.MockService;
const MockCharacteristic = noble.MockCharacteristic;

describe('BLEManager', () => {
  // Reset mocks before each test to ensure isolation
  beforeEach(() => {
    // Reset the top-level noble mock state
    mockNoble._reset();
    // Clear the internal lists in ble-manager
    bleManager.discoveredPeripherals.length = 0;
    for (const prop in bleManager.connectedPeripherals) {
      delete bleManager.connectedPeripherals[prop];
    }
  });

  // Test suite for device scanning and discovery
  describe('Scanning and Discovery', () => {
    it('should start scanning when BLE is powered on', () => {
      mockNoble._setState('poweredOn');
      expect(mockNoble.startScanning).toHaveBeenCalled();
    });

    it('should stop scanning when BLE is powered off', () => {
      mockNoble._setState('poweredOn'); // First power on
      mockNoble._setState('poweredOff'); // Then power off
      expect(mockNoble.stopScanning).toHaveBeenCalled();
    });

    it('should discover a peripheral and add it to the list', () => {
      const mockPeripheral = new MockPeripheral('p1', 'Test Peripheral');
      mockNoble._discover(mockPeripheral);
      
      const discovered = bleManager.getDiscoveredPeripherals();
      expect(discovered).toHaveLength(1);
      expect(discovered[0].id).toBe('p1');
      expect(discovered[0].name).toBe('Test Peripheral');
    });
  });

  // Test suite for device connection
  describe('Connection', () => {
    it('should connect to a discovered device successfully', async () => {
      const mockPeripheral = new MockPeripheral('p1', 'Connect-Test');
      mockNoble._discover(mockPeripheral);

      await bleManager.connectDevice('p1');
      
      expect(mockPeripheral.connect).toHaveBeenCalled();
      expect(bleManager.connectedPeripherals['p1']).toBe(mockPeripheral);
    });

    it('should fail to connect to a non-existent device', async () => {
      await expect(bleManager.connectDevice('nonexistent')).rejects.toThrow('Peripheral not found');
    });
  });

  // Test suite for device disconnection
  describe('Disconnection', () => {
    it('should disconnect from a connected device successfully', async () => {
      const mockPeripheral = new MockPeripheral('p1', 'Disconnect-Test');
      mockNoble._discover(mockPeripheral);
      await bleManager.connectDevice('p1');
      
      // Ensure it's connected before disconnecting
      expect(bleManager.connectedPeripherals['p1']).toBeDefined();

      await bleManager.disconnectDevice('p1');

      expect(mockPeripheral.disconnect).toHaveBeenCalled();
      expect(bleManager.connectedPeripherals['p1']).toBeUndefined();
    });
  });

  // Test suite for services and characteristics
  describe('Services and Characteristics', () => {
    let mockPeripheral;
    let mockService;
    let mockCharacteristic;

    beforeEach(async () => {
      // Setup a connected peripheral with services and characteristics for these tests
      mockCharacteristic = new MockCharacteristic('c1', ['read', 'write'], Buffer.from('hello'));
      mockService = new MockService('s1', [mockCharacteristic]);
      mockPeripheral = new MockPeripheral('p1', 'Svc-Char-Test');
      
      mockPeripheral._addService(mockService);
      mockNoble._discover(mockPeripheral);
      await bleManager.connectDevice('p1');
    });

    it('should get services from a connected peripheral', async () => {
      const services = await bleManager.getServices('p1');
      expect(services).toHaveLength(1);
      expect(services[0].uuid).toBe('s1');
    });

    it('should get characteristics from a service', async () => {
      const characteristics = await bleManager.getCharacteristics('p1', 's1');
      expect(characteristics).toHaveLength(1);
      expect(characteristics[0].uuid).toBe('c1');
    });

    it('should read from a characteristic', async () => {
      const data = await bleManager.readCharacteristic('p1', 'c1');
      expect(mockCharacteristic.read).toHaveBeenCalled();
      expect(data).toBe('68656c6c6f'); // "hello" in hex
    });

    it('should write to a characteristic', async () => {
      await bleManager.writeCharacteristic('p1', 'c1', '776f726c64'); // "world"
      expect(mockCharacteristic.write).toHaveBeenCalledWith(Buffer.from('776f726c64', 'hex'), false, expect.any(Function));
    });
  });
   // Test suite for subscriptions
  describe('Subscriptions', () => {
    let mockPeripheral;
    let mockCharacteristic;

    beforeEach(async () => {
      mockCharacteristic = new MockCharacteristic('c1', ['notify']);
      const mockService = new MockService('s1', [mockCharacteristic]);
      mockPeripheral = new MockPeripheral('p1', 'Sub-Test');
      
      mockPeripheral._addService(mockService);
      mockNoble._discover(mockPeripheral);
      await bleManager.connectDevice('p1');
    });

    it('should subscribe to a characteristic', async () => {
      const callback = jest.fn();
      await bleManager.subscribeToCharacteristic('p1', 'c1', callback);
      expect(mockCharacteristic.subscribe).toHaveBeenCalled();

      // Simulate a notification
      const testData = Buffer.from('test_notification');
      mockCharacteristic._notify(testData);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        value: testData.toString('hex')
      }));
    });

    it('should unsubscribe from a characteristic', async () => {
      await bleManager.subscribeToCharacteristic('p1', 'c1', jest.fn());
      await bleManager.unsubscribeFromCharacteristic('p1', 'c1');
      expect(mockCharacteristic.unsubscribe).toHaveBeenCalled();
    });
  });
});
