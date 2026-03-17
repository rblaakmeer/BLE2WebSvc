// __tests__/server.test.js
const request = require('supertest');
const app = require('../server.js'); // Our Express app

// Mock the ble-manager module
// Jest will hoist this, so it's mocked before 'app' is required if 'app' itself requires ble-manager.
jest.mock('../ble-manager.js'); 
const bleManager = require('../ble-manager.js'); // Import the mocked version

describe('BLE API Endpoints', () => {
  // Clear all mocks before each test to ensure test isolation
  beforeEach(() => {
    jest.clearAllMocks(); 
  });

  describe('GET /ble/devices', () => {
    it('should return a list of discovered devices successfully', async () => {
      const mockDevices = [
        { id: 'id1', name: 'Device1', address: 'addr1', advertisedServices: [], state: 'disconnected' },
        { id: 'id2', name: 'Device2', address: 'addr2', advertisedServices: [], state: 'disconnected' },
      ];
      bleManager.getDiscoveredPeripherals.mockReturnValue(mockDevices); // Mock implementation

      const response = await request(app).get('/ble/devices');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDevices);
      expect(bleManager.getDiscoveredPeripherals).toHaveBeenCalledTimes(1);
    });

    it('should return 500 if getDiscoveredPeripherals throws an error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Spy and silence

      bleManager.getDiscoveredPeripherals.mockImplementation(() => {
        throw new Error('Internal Error');
      });

      const response = await request(app).get('/ble/devices');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to get discovered devices'
      });
      expect(consoleErrorSpy).toHaveBeenCalled(); // Verify console.error was called

      consoleErrorSpy.mockRestore(); // Restore original console.error
    });
  });

  describe('POST /ble/devices/:deviceId/connect', () => {
    const deviceId = 'test-device-id';

    it('should connect to a device successfully', async () => {
      const mockConnectionResult = { id: deviceId, name: 'Test Device', state: 'connected' };
      bleManager.connectDevice.mockResolvedValue(mockConnectionResult);

      const response = await request(app).post(`/ble/devices/${deviceId}/connect`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Connection successful', device: mockConnectionResult });
      expect(bleManager.connectDevice).toHaveBeenCalledWith(deviceId);
    });

    it('should return 404 if device to connect is not found', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.connectDevice.mockRejectedValue(new Error('Peripheral not found'));

      const response = await request(app).post(`/ble/devices/${deviceId}/connect`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Device or resource not found.'
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should return 400 if device is already connected', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.connectDevice.mockRejectedValue(new Error('Peripheral already connected'));

      const response = await request(app).post(`/ble/devices/${deviceId}/connect`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Device is already connected.'
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
    
    it('should return 500 for other connection errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.connectDevice.mockRejectedValue(new Error('Some other connection error'));

      const response = await request(app).post(`/ble/devices/${deviceId}/connect`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'An error occurred. Please try again later.'
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('POST /ble/devices/:deviceId/disconnect', () => {
    const deviceId = 'test-device-id';

    it('should disconnect from a device successfully', async () => {
      const mockDisconnectionResult = { id: deviceId, message: 'Disconnected successfully' };
      bleManager.disconnectDevice.mockResolvedValue(mockDisconnectionResult);

      const response = await request(app).post(`/ble/devices/${deviceId}/disconnect`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Disconnection successful', device: mockDisconnectionResult });
      expect(bleManager.disconnectDevice).toHaveBeenCalledWith(deviceId);
    });

    it('should return 404 if device to disconnect is not found or not connected', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.disconnectDevice.mockRejectedValue(new Error('Peripheral not connected'));

      const response = await request(app).post(`/ble/devices/${deviceId}/disconnect`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Device is not connected.'
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
    
    it('should return 500 for other disconnection errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.disconnectDevice.mockRejectedValue(new Error('Some other disconnection error'));
      
      const response = await request(app).post(`/ble/devices/${deviceId}/disconnect`);
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'An error occurred. Please try again later.'
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('GET /ble/devices/:deviceId/services', () => {
    const deviceId = 'test-device-id';

    it('should return services for a device successfully', async () => {
      const mockServices = [{ uuid: 'service1', name: 'Service 1' }];
      bleManager.getServices.mockResolvedValue(mockServices);

      const response = await request(app).get(`/ble/devices/${deviceId}/services`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockServices);
      expect(bleManager.getServices).toHaveBeenCalledWith(deviceId);
    });

    it('should return 404 if device is not connected when getting services', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.getServices.mockRejectedValue(new Error('Peripheral not connected'));

      const response = await request(app).get(`/ble/devices/${deviceId}/services`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Device is not connected.'
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
    
    it('should return 500 for other errors when getting services', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.getServices.mockRejectedValue(new Error('Some other error'));

      const response = await request(app).get(`/ble/devices/${deviceId}/services`);

      expect(response.status).toBe(500);
       expect(response.body).toEqual({
        error: 'An error occurred. Please try again later.'
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('GET /ble/devices/:deviceId/services/:serviceUuid/characteristics', () => {
    const deviceId = 'test-device-id';
    const serviceUuid = '180d'; // Valid 16-bit UUID

    it('should return characteristics for a service successfully', async () => {
      const mockCharacteristics = [{ uuid: '2a37', name: 'Char 1', properties: ['read'] }];
      bleManager.getCharacteristics.mockResolvedValue(mockCharacteristics);

      const response = await request(app).get(`/ble/devices/${deviceId}/services/${serviceUuid}/characteristics`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCharacteristics);
      expect(bleManager.getCharacteristics).toHaveBeenCalledWith(deviceId, serviceUuid);
    });

    it('should return 404 if service is not found when getting characteristics', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.getCharacteristics.mockRejectedValue(new Error('Service not found'));

      const response = await request(app).get(`/ble/devices/${deviceId}/services/${serviceUuid}/characteristics`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Device or resource not found.'
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
    
    it('should return 404 if device is not connected when getting characteristics', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.getCharacteristics.mockRejectedValue(new Error('Peripheral not connected'));

      const response = await request(app).get(`/ble/devices/${deviceId}/services/${serviceUuid}/characteristics`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Device is not connected.');
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
    
    it('should return 500 for other errors when getting characteristics', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bleManager.getCharacteristics.mockRejectedValue(new Error('Some other error'));
      
      const response = await request(app).get(`/ble/devices/${deviceId}/services/${serviceUuid}/characteristics`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('An error occurred. Please try again later.');
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

});
