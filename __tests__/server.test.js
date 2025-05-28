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
        error: 'Failed to get discovered devices',
        details: 'Internal Error',
      });
      expect(consoleErrorSpy).toHaveBeenCalled(); // Verify console.error was called
      // Optionally, be more specific:
      // expect(consoleErrorSpy).toHaveBeenCalledWith('API: Error getting discovered devices:', expect.any(Error));

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
      bleManager.connectDevice.mockRejectedValue(new Error('Peripheral not found'));

      const response = await request(app).post(`/ble/devices/${deviceId}/connect`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: `Failed to connect to device ${deviceId}`,
        details: 'Peripheral not found',
      });
    });

    it('should return 400 if device is already connected', async () => {
      bleManager.connectDevice.mockRejectedValue(new Error('Peripheral already connected'));

      const response = await request(app).post(`/ble/devices/${deviceId}/connect`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: `Failed to connect to device ${deviceId}`,
        details: 'Peripheral already connected',
      });
    });
    
    it('should return 500 for other connection errors', async () => {
      bleManager.connectDevice.mockRejectedValue(new Error('Some other connection error'));

      const response = await request(app).post(`/ble/devices/${deviceId}/connect`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: `Failed to connect to device ${deviceId}`,
        details: 'Some other connection error',
      });
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
      bleManager.disconnectDevice.mockRejectedValue(new Error('Peripheral not connected'));

      const response = await request(app).post(`/ble/devices/${deviceId}/disconnect`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: `Failed to disconnect from device ${deviceId}`,
        details: 'Peripheral not connected',
      });
    });
    
    it('should return 500 for other disconnection errors', async () => {
      bleManager.disconnectDevice.mockRejectedValue(new Error('Some other disconnection error'));
      
      const response = await request(app).post(`/ble/devices/${deviceId}/disconnect`);
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: `Failed to disconnect from device ${deviceId}`,
        details: 'Some other disconnection error',
      });
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
      bleManager.getServices.mockRejectedValue(new Error('Peripheral not connected'));

      const response = await request(app).get(`/ble/devices/${deviceId}/services`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: `Failed to get services for device ${deviceId}`,
        details: 'Peripheral not connected',
      });
    });
    
    it('should return 500 for other errors when getting services', async () => {
      bleManager.getServices.mockRejectedValue(new Error('Some other error'));

      const response = await request(app).get(`/ble/devices/${deviceId}/services`);

      expect(response.status).toBe(500);
       expect(response.body).toEqual({
        error: `Failed to get services for device ${deviceId}`,
        details: 'Some other error',
      });
    });
  });

  describe('GET /ble/devices/:deviceId/services/:serviceUuid/characteristics', () => {
    const deviceId = 'test-device-id';
    const serviceUuid = 'service-uuid-1';

    it('should return characteristics for a service successfully', async () => {
      const mockCharacteristics = [{ uuid: 'char1', name: 'Char 1', properties: ['read'] }];
      bleManager.getCharacteristics.mockResolvedValue(mockCharacteristics);

      const response = await request(app).get(`/ble/devices/${deviceId}/services/${serviceUuid}/characteristics`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCharacteristics);
      expect(bleManager.getCharacteristics).toHaveBeenCalledWith(deviceId, serviceUuid);
    });

    it('should return 404 if service is not found when getting characteristics', async () => {
      bleManager.getCharacteristics.mockRejectedValue(new Error('Service not found'));

      const response = await request(app).get(`/ble/devices/${deviceId}/services/${serviceUuid}/characteristics`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: `Failed to get characteristics for device ${deviceId}, service ${serviceUuid}`,
        details: 'Service not found',
      });
    });
    
    it('should return 404 if device is not connected when getting characteristics', async () => {
      bleManager.getCharacteristics.mockRejectedValue(new Error('Peripheral not connected'));

      const response = await request(app).get(`/ble/devices/${deviceId}/services/${serviceUuid}/characteristics`);

      expect(response.status).toBe(404);
      // The error message in server.js for this specific case might need checking if it's generic
      // For now, assume it includes "Peripheral not connected" or similar that leads to 404
       expect(response.body.details).toContain('Peripheral not connected');
    });
    
    it('should return 500 for other errors when getting characteristics', async () => {
      bleManager.getCharacteristics.mockRejectedValue(new Error('Some other error'));
      
      const response = await request(app).get(`/ble/devices/${deviceId}/services/${serviceUuid}/characteristics`);
      
      expect(response.status).toBe(500);
      expect(response.body.details).toContain('Some other error');
    });
  });

  // Placeholder for next endpoint tests can be added here if desired
  // it('should have a test placeholder for next endpoint', () => { expect(true).toBe(true); });

});
