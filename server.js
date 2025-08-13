/**
 * @file server.js
 * @description Sets up an Express web server to act as a bridge for BLE (Bluetooth Low Energy)
 * interactions. It defines API endpoints to discover, connect to, and interact with BLE devices
 * using the functionalities provided by `ble-manager.js`.
 */
var express = require('express');
const bleManager = require('./ble-manager.js'); // Manages BLE interactions.

// Global Error Handlers - These should be defined early.
// Handles unhandled promise rejections.
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic can be added here.
});

// Handles uncaught exceptions.
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Application specific logging, cleanup. It's critical to exit after an uncaught exception.
  process.exit(1); // Mandatory exit.
});

var app = express();

// Middleware to parse incoming JSON requests.
app.use(express.json());

// Configure MIME types for static files
express.static.mime.define({'text/javascript': ['js']});

// Serve static files from public directory
app.use('/web', express.static('public'));
app.get('/webble', (req, res) => {
  res.sendFile(__dirname + '/public/webble.html');
});

/**
 * @route GET /ble/devices
 * @description Retrieves a list of discovered BLE devices.
 * @returns {Object[]} 200 - An array of device objects, each with id, name, address, etc.
 * @returns {Object} 500 - Error object if fetching devices fails.
 */
app.get('/ble/devices', (req, res) => {
  try {
    const devices = bleManager.getDiscoveredPeripherals();
    res.json(devices);
  } catch (error) {
    console.error('API: Error getting discovered devices:', error);
    res.status(500).json({ error: 'Failed to get discovered devices', details: error.message });
  }
});

/**
 * @route POST /ble/devices/:deviceId/connect
 * @description Connects to a specific BLE device by its ID.
 * @param {string} req.params.deviceId - The ID of the device to connect to.
 * @returns {Object} 200 - Success message and device connection information.
 * @returns {Object} 400 - If device is already connected/connecting.
 * @returns {Object} 404 - If device is not found.
 * @returns {Object} 500 - Error object if connection fails for other reasons.
 */
app.post('/ble/devices/:deviceId/connect', async (req, res) => {
  const { deviceId } = req.params;
  try {
    console.log(`API: Request to connect to ${deviceId}`);
    const connectionResult = await bleManager.connectDevice(deviceId);
    res.json({ message: 'Connection successful', device: connectionResult });
  } catch (error) {
    console.error(`API: Error connecting to ${deviceId}:`, error);
    // Determine appropriate status code based on error message.
    let statusCode = 500;
    if (error.message.includes('not found')) statusCode = 404;
    else if (error.message.includes('already connected') || error.message.includes('connecting') || error.message.includes('Peripheral disconnected during connection process') ) statusCode = 400;
    res.status(statusCode).json({ error: `Failed to connect to device ${deviceId}`, details: error.message });
  }
});

/**
 * @route POST /ble/devices/:deviceId/disconnect
 * @description Disconnects from a specific BLE device by its ID.
 * @param {string} req.params.deviceId - The ID of the device to disconnect from.
 * @returns {Object} 200 - Success message and device disconnection information.
 * @returns {Object} 404 - If device is not connected or not found.
 * @returns {Object} 500 - Error object if disconnection fails for other reasons.
 */
app.post('/ble/devices/:deviceId/disconnect', async (req, res) => {
  const { deviceId } = req.params;
  try {
    console.log(`API: Request to disconnect from ${deviceId}`);
    const disconnectionResult = await bleManager.disconnectDevice(deviceId);
    res.json({ message: 'Disconnection successful', device: disconnectionResult });
  } catch (error) {
    console.error(`API: Error disconnecting from ${deviceId}:`, error);
    let statusCode = 500;
    if (error.message.includes('not found') || error.message.includes('not connected')) statusCode = 404;
    res.status(statusCode).json({ error: `Failed to disconnect from device ${deviceId}`, details: error.message });
  }
});

/**
 * @route GET /ble/devices/:deviceId/services
 * @description Retrieves a list of services for a connected BLE device.
 * @param {string} req.params.deviceId - The ID of the connected device.
 * @returns {Object[]} 200 - An array of service objects.
 * @returns {Object} 404 - If device is not connected.
 * @returns {Object} 500 - Error object if fetching services fails.
 */
app.get('/ble/devices/:deviceId/services', async (req, res) => {
  const { deviceId } = req.params;
  try {
    console.log(`API: Request to get services for ${deviceId}`);
    const services = await bleManager.getServices(deviceId);
    res.json(services);
  } catch (error) {
    console.error(`API: Error getting services for ${deviceId}:`, error);
    let statusCode = 500;
    if (error.message.includes('not connected')) statusCode = 404;
    res.status(statusCode).json({ error: `Failed to get services for device ${deviceId}`, details: error.message });
  }
});

/**
 * @route GET /ble/devices/:deviceId/services/:serviceUuid/characteristics
 * @description Retrieves characteristics for a specific service on a connected BLE device.
 * @param {string} req.params.deviceId - The ID of the connected device.
 * @param {string} req.params.serviceUuid - The UUID of the service.
 * @returns {Object[]} 200 - An array of characteristic objects.
 * @returns {Object} 404 - If device not connected or service not found.
 * @returns {Object} 500 - Error object if fetching characteristics fails.
 */
app.get('/ble/devices/:deviceId/services/:serviceUuid/characteristics', async (req, res) => {
  const { deviceId, serviceUuid } = req.params;
  try {
    console.log(`API: Request to get characteristics for service ${serviceUuid} on device ${deviceId}`);
    const characteristics = await bleManager.getCharacteristics(deviceId, serviceUuid);
    res.json(characteristics);
  } catch (error) {
    console.error(`API: Error getting characteristics for ${deviceId}, service ${serviceUuid}:`, error);
    let statusCode = 500;
    if (error.message.includes('not connected') || error.message.includes('Service not found')) statusCode = 404;
    res.status(statusCode).json({ error: `Failed to get characteristics for device ${deviceId}, service ${serviceUuid}`, details: error.message });
  }
});

/**
 * @route GET /ble/devices/:deviceId/characteristics/:characteristicUuid
 * @description Reads the value of a specific characteristic from a connected BLE device.
 * @param {string} req.params.deviceId - The ID of the connected device.
 * @param {string} req.params.characteristicUuid - The UUID of the characteristic to read.
 * @returns {Object} 200 - Object containing the characteristic UUID and its hex value.
 * @returns {Object} 404 - If device not connected, characteristic not found, or not readable.
 * @returns {Object} 500 - Error object if reading fails.
 */
app.get('/ble/devices/:deviceId/characteristics/:characteristicUuid', async (req, res) => {
  const { deviceId, characteristicUuid } = req.params;
  try {
    console.log(`API: Request to read characteristic ${characteristicUuid} on device ${deviceId}`);
    const data = await bleManager.readCharacteristic(deviceId, characteristicUuid);
    res.json({ characteristicUuid, value: data });
  } catch (error)
 {
    console.error(`API: Error reading characteristic ${characteristicUuid} for ${deviceId}:`, error);
    let statusCode = 500;
    if (error.message.includes('not connected') || error.message.includes('Characteristic not found') || error.message.includes('not readable')) statusCode = 404;
    res.status(statusCode).json({ error: `Failed to read characteristic ${characteristicUuid} for device ${deviceId}`, details: error.message });
  }
});

/**
 * @route POST /ble/devices/:deviceId/characteristics/:characteristicUuid
 * @description Writes a value to a specific characteristic on a connected BLE device.
 * @param {string} req.params.deviceId - The ID of the connected device.
 * @param {string} req.params.characteristicUuid - The UUID of the characteristic to write to.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.value - The hex string value to write.
 * @param {boolean} [req.body.withoutResponse=false] - Optional. If true, perform write without response.
 * @returns {Object} 200 - Success message.
 * @returns {Object} 400 - If 'value' is missing or invalid in request body.
 * @returns {Object} 404 - If device not connected, characteristic not found, or not writable.
 * @returns {Object} 500 - Error object if writing fails.
 */
app.post('/ble/devices/:deviceId/characteristics/:characteristicUuid', async (req, res) => {
  const { deviceId, characteristicUuid } = req.params;
  const { value, withoutResponse } = req.body; // `value` should be a hex string.

  // Validate request body: 'value' must be present.
  if (value === undefined) {
    return res.status(400).json({ error: 'Missing "value" in request body. Please provide a hex string.' });
  }
  // Basic validation for hex string format.
  if (typeof value !== 'string' || !/^[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
      // Allow empty string for some characteristics, but still must be even length if not empty.
      // Corrected regex to allow empty string, but still check for even length if not empty.
      if (value.length > 0 && (value.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(value))) {
        return res.status(400).json({ error: 'Invalid "value" format. Must be a valid hex string with an even number of characters, or an empty string.' });
      }
  }


  try {
    console.log(`API: Request to write to characteristic ${characteristicUuid} on device ${deviceId} with value ${value}`);
    const result = await bleManager.writeCharacteristic(deviceId, characteristicUuid, value, withoutResponse || false);
    res.json(result);
  } catch (error) {
    console.error(`API: Error writing to characteristic ${characteristicUuid} for ${deviceId}:`, error);
    let statusCode = 500;
    if (error.message.includes('not connected') || error.message.includes('Characteristic not found') || error.message.includes('not writable')) statusCode = 404;
    else if (error.message.includes('Invalid "value" format')) statusCode = 400;
    res.status(statusCode).json({ error: `Failed to write to characteristic ${characteristicUuid} for device ${deviceId}`, details: error.message });
  }
});

// Store active subscriptions for each device/characteristic combination
const activeSubscriptions = new Map();

/**
 * @route POST /ble/devices/:deviceId/characteristics/:characteristicUuid/subscribe
 * @description Subscribes to notifications/indications from a specific characteristic.
 * @param {string} req.params.deviceId - The ID of the connected device.
 * @param {string} req.params.characteristicUuid - The UUID of the characteristic to subscribe to.
 * @returns {Object} 200 - Success message with subscription details.
 * @returns {Object} 404 - If device not connected, characteristic not found, or not notifiable.
 * @returns {Object} 500 - Error object if subscription fails.
 */
app.post('/ble/devices/:deviceId/characteristics/:characteristicUuid/subscribe', async (req, res) => {
  const { deviceId, characteristicUuid } = req.params;
  const subscriptionKey = `${deviceId}-${characteristicUuid}`;
  
  try {
    console.log(`API: Request to subscribe to characteristic ${characteristicUuid} on device ${deviceId}`);
    
    // Check if already subscribed
    if (activeSubscriptions.has(subscriptionKey)) {
      return res.status(400).json({ error: 'Already subscribed to this characteristic' });
    }
    
    // Create a data buffer to store received notifications
    const dataBuffer = [];
    
    // Subscribe with a callback to handle incoming data
    const result = await bleManager.subscribeToCharacteristic(deviceId, characteristicUuid, (data) => {
      // Store the notification data with timestamp
      dataBuffer.push({
        ...data,
        receivedAt: new Date().toISOString()
      });
      
      // Keep only the last 100 notifications to prevent memory issues
      if (dataBuffer.length > 100) {
        dataBuffer.shift();
      }
    });
    
    // Store the subscription info
    activeSubscriptions.set(subscriptionKey, {
      deviceId,
      characteristicUuid,
      dataBuffer,
      subscribedAt: new Date().toISOString()
    });
    
    res.json({ 
      message: 'Subscription successful', 
      subscriptionKey,
      ...result 
    });
    
  } catch (error) {
    console.error(`API: Error subscribing to characteristic ${characteristicUuid} for ${deviceId}:`, error);
    let statusCode = 500;
    if (error.message.includes('not connected') || error.message.includes('Characteristic not found') || error.message.includes('not support')) statusCode = 404;
    res.status(statusCode).json({ error: `Failed to subscribe to characteristic ${characteristicUuid} for device ${deviceId}`, details: error.message });
  }
});

/**
 * @route POST /ble/devices/:deviceId/characteristics/:characteristicUuid/unsubscribe
 * @description Unsubscribes from notifications/indications from a specific characteristic.
 * @param {string} req.params.deviceId - The ID of the connected device.
 * @param {string} req.params.characteristicUuid - The UUID of the characteristic to unsubscribe from.
 * @returns {Object} 200 - Success message.
 * @returns {Object} 404 - If device not connected, characteristic not found, or not subscribed.
 * @returns {Object} 500 - Error object if unsubscription fails.
 */
app.post('/ble/devices/:deviceId/characteristics/:characteristicUuid/unsubscribe', async (req, res) => {
  const { deviceId, characteristicUuid } = req.params;
  const subscriptionKey = `${deviceId}-${characteristicUuid}`;
  
  try {
    console.log(`API: Request to unsubscribe from characteristic ${characteristicUuid} on device ${deviceId}`);
    
    // Check if subscribed
    if (!activeSubscriptions.has(subscriptionKey)) {
      return res.status(404).json({ error: 'Not subscribed to this characteristic' });
    }
    
    const result = await bleManager.unsubscribeFromCharacteristic(deviceId, characteristicUuid);
    
    // Remove from active subscriptions
    activeSubscriptions.delete(subscriptionKey);
    
    res.json(result);
    
  } catch (error) {
    console.error(`API: Error unsubscribing from characteristic ${characteristicUuid} for ${deviceId}:`, error);
    let statusCode = 500;
    if (error.message.includes('not connected') || error.message.includes('Characteristic not found')) statusCode = 404;
    res.status(statusCode).json({ error: `Failed to unsubscribe from characteristic ${characteristicUuid} for device ${deviceId}`, details: error.message });
  }
});

/**
 * @route GET /ble/devices/:deviceId/characteristics/:characteristicUuid/notifications
 * @description Gets the latest notifications/indications received from a subscribed characteristic.
 * @param {string} req.params.deviceId - The ID of the connected device.
 * @param {string} req.params.characteristicUuid - The UUID of the characteristic.
 * @param {number} [req.query.since] - Optional timestamp to get notifications since a specific time.
 * @param {number} [req.query.limit=10] - Optional limit for number of notifications to return.
 * @returns {Object} 200 - Array of notification data.
 * @returns {Object} 404 - If not subscribed to this characteristic.
 */
app.get('/ble/devices/:deviceId/characteristics/:characteristicUuid/notifications', (req, res) => {
  const { deviceId, characteristicUuid } = req.params;
  const { since, limit = 10 } = req.query;
  const subscriptionKey = `${deviceId}-${characteristicUuid}`;
  
  try {
    console.log(`API: Request to get notifications for characteristic ${characteristicUuid} on device ${deviceId}`);
    
    const subscription = activeSubscriptions.get(subscriptionKey);
    if (!subscription) {
      return res.status(404).json({ error: 'Not subscribed to this characteristic' });
    }
    
    let notifications = subscription.dataBuffer;
    
    // Filter by timestamp if 'since' parameter is provided
    if (since) {
      const sinceDate = new Date(parseInt(since));
      notifications = notifications.filter(notification => 
        new Date(notification.receivedAt) > sinceDate
      );
    }
    
    // Apply limit
    const limitNum = parseInt(limit);
    if (limitNum > 0) {
      notifications = notifications.slice(-limitNum);
    }
    
    res.json({
      subscriptionKey,
      deviceId,
      characteristicUuid,
      notifications,
      totalCount: subscription.dataBuffer.length,
      subscribedAt: subscription.subscribedAt
    });
    
  } catch (error) {
    console.error(`API: Error getting notifications for characteristic ${characteristicUuid} for ${deviceId}:`, error);
    res.status(500).json({ error: `Failed to get notifications for characteristic ${characteristicUuid} for device ${deviceId}`, details: error.message });
  }
});

/**
 * @route GET /ble/subscriptions
 * @description Gets a list of all active subscriptions.
 * @returns {Object} 200 - Array of active subscription information.
 */
app.get('/ble/subscriptions', (req, res) => {
  try {
    const subscriptions = Array.from(activeSubscriptions.entries()).map(([key, subscription]) => ({
      subscriptionKey: key,
      deviceId: subscription.deviceId,
      characteristicUuid: subscription.characteristicUuid,
      subscribedAt: subscription.subscribedAt,
      notificationCount: subscription.dataBuffer.length,
      lastNotification: subscription.dataBuffer.length > 0 ? 
        subscription.dataBuffer[subscription.dataBuffer.length - 1] : null
    }));
    
    res.json({ subscriptions });
  } catch (error) {
    console.error('API: Error getting subscriptions:', error);
    res.status(500).json({ error: 'Failed to get subscriptions', details: error.message });
  }
});

// Export the app instance for testing or other module usage
module.exports = app;

// Start the server only if this script is executed directly
if (require.main === module) {
  const port = process.env.PORT || 8111; // Use environment variable for port if available, default to 8111
  const server = app.listen(port, () => { // 'server' var is now local to this block
    console.log(`BLE2WebSvc server listening on port ${port}`);
  });
}
