/**
 * @file ble-manager.js
 * @description Manages Bluetooth Low Energy (BLE) interactions, including device discovery,
 * connection, disconnection, and data exchange (services, characteristics).
 * It uses the '@abandonware/noble' library for BLE communication.
 */
const noble = require('@abandonware/noble'); // Changed to @abandonware/noble

console.log('noble'); // Initial log to indicate noble module is being processed.

// Stores discovered peripheral objects.
var discoveredPeripherals = [];
// Stores currently connected peripheral objects, keyed by peripheral ID.
var connectedPeripherals = {};

// Handles state changes in the BLE adapter (e.g., powered on, powered off).
noble.on('stateChange', function(state) {
  console.log('on -> stateChange: ' + state); // Log the new state.
  if (state === 'poweredOn') {
    noble.startScanning(); // Start scanning for BLE devices if adapter is powered on.
  } else {
    noble.stopScanning(); // Stop scanning if adapter is not powered on.
  }
});

// Fired when scanning for BLE devices starts.
noble.on('scanStart', function() {
  console.log('on -> scanStart');
});

// Fired when scanning for BLE devices stops.
noble.on('scanStop', function() {
  console.log('on -> scanStop');
});

// Fired when a BLE peripheral is discovered.
noble.on('discover', function(peripheral) {
  // Check if the peripheral is already in the list to avoid duplicates.
  if (!discoveredPeripherals.find(p => p.id === peripheral.id)) {
    console.log('on -> discover: ' + peripheral.id + ' (' + (peripheral.advertisement.localName || 'Unknown') + ')');
    discoveredPeripherals.push(peripheral); // Add new peripheral to the list.
  }
});

/**
 * @function getDiscoveredPeripherals
 * @description Retrieves a list of discovered BLE peripherals, formatted for client consumption.
 * @returns {Array<Object>} An array of objects, each representing a discovered peripheral
 *                          with properties like id, address, name, advertisedServices, and state.
 */
function getDiscoveredPeripherals() {
  return discoveredPeripherals.map(peripheral => ({
    id: peripheral.id,
    address: peripheral.address,
    name: peripheral.advertisement.localName,
    advertisedServices: peripheral.advertisement.serviceUuids,
    state: peripheral.state
  }));
}

/**
 * @function connectDevice
 * @description Connects to a specified BLE peripheral by its ID.
 * Discovers all services and characteristics upon successful connection.
 * @param {string} peripheralId - The ID of the peripheral to connect to.
 * @returns {Promise<Object>} A Promise that resolves with an object containing peripheral
 *                            information (id, name, state) on successful connection and
 *                            service/characteristic discovery.
 * @rejects {Error} If the peripheral is not found, already connected/connecting,
 *                  or if connection/discovery fails.
 */
async function connectDevice(peripheralId) {
  const peripheral = discoveredPeripherals.find(p => p.id === peripheralId);

  if (!peripheral) {
    return Promise.reject(new Error('Peripheral not found'));
  }

  // Check if already connected or in the process of connecting.
  if (peripheral.state === 'connected' || peripheral.state === 'connecting') {
    if(peripheral.state === 'connected' && connectedPeripherals[peripheral.id]) {
        console.log('Peripheral already connected: ' + peripheral.id);
        // Resolve if already connected and tracked in connectedPeripherals.
        return Promise.resolve({ id: peripheral.id, name: peripheral.advertisement.localName, state: peripheral.state });
    }
    return Promise.reject(new Error('Peripheral already connected or connecting'));
  }

  console.log('Attempting to connect to peripheral: ' + peripheral.id);

  return new Promise((resolve, reject) => {
    const onConnect = () => {
      // Clean up listeners for this specific connection attempt to avoid multiple firings.
      peripheral.removeListener('disconnect', onDisconnectDuringConnection);
      peripheral.removeListener('error', onErrorDuringConnection);

      connectedPeripherals[peripheral.id] = peripheral; // Track connected peripheral.
      console.log('Connected to peripheral: ' + peripheral.id);

      // After connecting, discover all services and characteristics.
      peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
        if (error) {
          console.error('Error discovering services/characteristics for ' + peripheral.id + ': ', error);
          // Reject if discovery fails, as it's crucial for later operations.
          delete connectedPeripherals[peripheral.id]; // Untrack on error post-connect.
          return reject(new Error('Failed to discover services/characteristics: ' + error.message));
        }
        console.log('Discovered services for ' + peripheral.id + ':', services.map(s => s.uuid));
        resolve({ id: peripheral.id, name: peripheral.advertisement.localName, state: peripheral.state });
      });
    };

    const onDisconnectDuringConnection = () => {
      // Handles unexpected disconnects during the connection or discovery process.
      peripheral.removeListener('connect', onConnect);
      peripheral.removeListener('error', onErrorDuringConnection);
      delete connectedPeripherals[peripheral.id]; // Ensure peripheral is untracked.
      console.log('Disconnected from peripheral: ' + peripheral.id + ' (during connection attempt or unexpectedly)');
      reject(new Error('Peripheral disconnected during connection process'));
    };

    const onErrorDuringConnection = (error) => {
      // Handles errors emitted by the peripheral object during connection.
      peripheral.removeListener('connect', onConnect);
      peripheral.removeListener('disconnect', onDisconnectDuringConnection);
      console.error('Connection error for ' + peripheral.id + ':', error);
      reject(error);
    };

    // Attach one-time listeners for connection events.
    peripheral.once('connect', onConnect);
    peripheral.once('disconnect', onDisconnectDuringConnection);
    peripheral.once('error', onErrorDuringConnection);

    // Initiate the connection.
    peripheral.connect(error => {
      if (error) {
        // Handles immediate errors from the .connect() call (e.g., device not available).
        onErrorDuringConnection(error);
      }
    });
  });
}

/**
 * @function disconnectDevice
 * @description Disconnects from a specified BLE peripheral.
 * @param {string} peripheralId - The ID of the peripheral to disconnect from.
 * @returns {Promise<Object>} A Promise that resolves with an object containing the
 *                            peripheral ID and a success message.
 * @rejects {Error} If the peripheral is not connected or not found in the connected list,
 *                  or if the disconnect call fails.
 */
async function disconnectDevice(peripheralId) {
  const peripheral = connectedPeripherals[peripheralId];

  if (!peripheral) {
    return Promise.reject(new Error('Peripheral not connected or not found'));
  }

  console.log('Attempting to disconnect from peripheral: ' + peripheral.id);

  return new Promise((resolve, reject) => {
    // Listen for the 'disconnect' event.
    peripheral.once('disconnect', () => {
      delete connectedPeripherals[peripheral.id]; // Untrack peripheral.
      console.log('Successfully disconnected from peripheral: ' + peripheral.id);
      resolve({ id: peripheral.id, message: 'Disconnected successfully' });
    });

    // Initiate disconnection.
    peripheral.disconnect(error => {
      if (error) {
        console.error('Error during disconnect call for ' + peripheral.id + ':', error);
        reject(error); // Reject if the disconnect call itself errors.
      }
      // If no error, the 'disconnect' event handler will resolve the promise.
    });
  });
}

/**
 * @function getServices
 * @description Retrieves a list of services for a connected peripheral.
 * @param {string} peripheralId - The ID of the connected peripheral.
 * @returns {Promise<Array<Object>>} A Promise that resolves with an array of service objects.
 *                                   Each service object contains uuid, name, type, and includedServiceUuids.
 * @rejects {Error} If the peripheral is not connected, services are not discovered, or re-discovery fails.
 */
async function getServices(peripheralId) {
  const peripheral = connectedPeripherals[peripheralId];
  if (!peripheral) {
    return Promise.reject(new Error('Peripheral not connected'));
  }
  // Check if services are already discovered.
  if (!peripheral.services) {
    console.warn('Peripheral services not available for ' + peripheralId + '. Attempting re-discovery.');
    // Attempt to re-discover if services are missing (should be rare if connectDevice worked).
    return new Promise((resolve, reject) => {
        peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
            if (error) {
                return reject(new Error('Failed to re-discover services: ' + error.message));
            }
            resolve(services.map(s => ({ uuid: s.uuid, name: s.name, type: s.type, includedServiceUuids: s.includedServiceUuids })));
        });
    });
  }
  // Map and resolve service details if already available.
  return Promise.resolve(peripheral.services.map(s => ({ uuid: s.uuid, name: s.name, type: s.type, includedServiceUuids: s.includedServiceUuids })));
}

/**
 * @function getCharacteristics
 * @description Retrieves a list of characteristics for a specific service on a connected peripheral.
 * @param {string} peripheralId - The ID of the connected peripheral.
 * @param {string} serviceUuid - The UUID of the service to get characteristics from.
 * @returns {Promise<Array<Object>>} A Promise that resolves with an array of characteristic objects.
 *                                   Each characteristic object contains uuid, name, type, and properties.
 * @rejects {Error} If peripheral not connected, services/characteristics not discovered, or service not found.
 */
async function getCharacteristics(peripheralId, serviceUuid) {
  const peripheral = connectedPeripherals[peripheralId];
  if (!peripheral) {
    return Promise.reject(new Error('Peripheral not connected'));
  }
  if (!peripheral.services) {
      return Promise.reject(new Error('Services not discovered for this peripheral.'));
  }

  const service = peripheral.services.find(s => s.uuid === serviceUuid);
  if (!service) {
    return Promise.reject(new Error('Service not found'));
  }
  if (!service.characteristics) {
      return Promise.reject(new Error('Characteristics not discovered for this service.'));
  }
  // Map and resolve characteristic details.
  return Promise.resolve(service.characteristics.map(c => ({ uuid: c.uuid, name: c.name, type: c.type, properties: c.properties })));
}

/**
 * @function readCharacteristic
 * @description Reads the value of a specific characteristic from a connected peripheral.
 * @param {string} peripheralId - The ID of the connected peripheral.
 * @param {string} characteristicUuid - The UUID of the characteristic to read.
 * @returns {Promise<string|null>} A Promise that resolves with the characteristic value as a hex string,
 *                                or null if data is empty.
 * @rejects {Error} If peripheral not connected, characteristic not found, not readable, or read operation fails.
 */
async function readCharacteristic(peripheralId, characteristicUuid) {
  const peripheral = connectedPeripherals[peripheralId];
  if (!peripheral) {
    return Promise.reject(new Error('Peripheral not connected'));
  }

  // Find the target characteristic within any service.
  let targetCharacteristic = null;
  if (peripheral.services) {
    for (const service of peripheral.services) {
      if (service.characteristics) {
        targetCharacteristic = service.characteristics.find(c => c.uuid === characteristicUuid);
        if (targetCharacteristic) break;
      }
    }
  }

  if (!targetCharacteristic) {
    return Promise.reject(new Error('Characteristic not found'));
  }

  // Check if characteristic is readable.
  if (!targetCharacteristic.properties || !targetCharacteristic.properties.includes('read')) {
    return Promise.reject(new Error('Characteristic not readable'));
  }

  // Perform the read operation.
  return new Promise((resolve, reject) => {
    targetCharacteristic.read((error, data) => {
      if (error) {
        return reject(error);
      }
      resolve(data ? data.toString('hex') : null); // Convert data to hex string.
    });
  });
}

/**
 * @function writeCharacteristic
 * @description Writes a value to a specific characteristic on a connected peripheral.
 * @param {string} peripheralId - The ID of the connected peripheral.
 * @param {string} characteristicUuid - The UUID of the characteristic to write to.
 * @param {string} valueHex - The value to write, as a hex string.
 * @param {boolean} [withoutResponse=false] - Whether to perform a write without response.
 * @returns {Promise<Object>} A Promise that resolves with a success message.
 * @rejects {Error} If peripheral not connected, characteristic not found, not writable,
 *                  or write operation fails.
 */
async function writeCharacteristic(peripheralId, characteristicUuid, valueHex, withoutResponse = false) {
  const peripheral = connectedPeripherals[peripheralId];
  if (!peripheral) {
    return Promise.reject(new Error('Peripheral not connected'));
  }

  // Find the target characteristic.
  let targetCharacteristic = null;
  if (peripheral.services) {
    for (const service of peripheral.services) {
      if (service.characteristics) {
        targetCharacteristic = service.characteristics.find(c => c.uuid === characteristicUuid);
        if (targetCharacteristic) break;
      }
    }
  }

  if (!targetCharacteristic) {
    return Promise.reject(new Error('Characteristic not found'));
  }

  // Check writability and selected write mode.
  const canWrite = targetCharacteristic.properties && targetCharacteristic.properties.includes('write');
  const canWriteWithoutResponse = targetCharacteristic.properties && targetCharacteristic.properties.includes('writeWithoutResponse');

  if (!canWrite && !canWriteWithoutResponse) {
    return Promise.reject(new Error('Characteristic not writable'));
  }
  
  let useWithoutResponse = withoutResponse;
  // Adjust write mode if the selected one is not supported but the other is.
  if (withoutResponse && !canWriteWithoutResponse) {
    console.warn(`Characteristic ${characteristicUuid} does not support 'writeWithoutResponse'. Falling back to 'write' if available.`);
    if (canWrite) {
        useWithoutResponse = false; // Fallback to write with response.
    } else {
        return Promise.reject(new Error('Characteristic does not support writeWithoutResponse and write is also not available.'));
    }
  } else if (!withoutResponse && !canWrite) {
      if (canWriteWithoutResponse) {
          console.warn(`Characteristic ${characteristicUuid} does not support 'write' with response. Using 'writeWithoutResponse'.`);
          useWithoutResponse = true; // Use write without response if only that is available.
      } else {
          return Promise.reject(new Error('Characteristic not writable with selected response option.'));
      }
  }

  // Convert hex string to Buffer for writing.
  const buffer = Buffer.from(valueHex, 'hex');

  // Perform the write operation.
  return new Promise((resolve, reject) => {
    targetCharacteristic.write(buffer, useWithoutResponse, (error) => {
      if (error) {
        return reject(error);
      }
      resolve({ message: 'Write successful' });
    });
  });
}

/**
 * @function subscribeToCharacteristic
 * @description Subscribes to notifications/indications from a specific characteristic.
 * @param {string} peripheralId - The ID of the connected peripheral.
 * @param {string} characteristicUuid - The UUID of the characteristic to subscribe to.
 * @param {function} callback - Callback function to handle received data.
 * @returns {Promise<Object>} A Promise that resolves with a success message.
 * @rejects {Error} If peripheral not connected, characteristic not found, or not notifiable.
 */
async function subscribeToCharacteristic(peripheralId, characteristicUuid, callback) {
  const peripheral = connectedPeripherals[peripheralId];
  if (!peripheral) {
    return Promise.reject(new Error('Peripheral not connected'));
  }

  // Find the target characteristic.
  let targetCharacteristic = null;
  if (peripheral.services) {
    for (const service of peripheral.services) {
      if (service.characteristics) {
        targetCharacteristic = service.characteristics.find(c => c.uuid === characteristicUuid);
        if (targetCharacteristic) break;
      }
    }
  }

  if (!targetCharacteristic) {
    return Promise.reject(new Error('Characteristic not found'));
  }

  // Check if characteristic supports notifications or indications
  const canNotify = targetCharacteristic.properties && targetCharacteristic.properties.includes('notify');
  const canIndicate = targetCharacteristic.properties && targetCharacteristic.properties.includes('indicate');

  if (!canNotify && !canIndicate) {
    return Promise.reject(new Error('Characteristic does not support notifications or indications'));
  }

  return new Promise((resolve, reject) => {
    // Set up the data event listener
    targetCharacteristic.on('data', (data, isNotification) => {
      const hexValue = data ? data.toString('hex') : null;
      callback({
        characteristicUuid,
        value: hexValue,
        isNotification,
        timestamp: new Date().toISOString()
      });
    });

    // Subscribe to notifications/indications
    targetCharacteristic.subscribe((error) => {
      if (error) {
        return reject(error);
      }
      resolve({ 
        message: 'Subscription successful', 
        characteristicUuid,
        supportsNotify: canNotify,
        supportsIndicate: canIndicate
      });
    });
  });
}

/**
 * @function unsubscribeFromCharacteristic
 * @description Unsubscribes from notifications/indications from a specific characteristic.
 * @param {string} peripheralId - The ID of the connected peripheral.
 * @param {string} characteristicUuid - The UUID of the characteristic to unsubscribe from.
 * @returns {Promise<Object>} A Promise that resolves with a success message.
 * @rejects {Error} If peripheral not connected, characteristic not found, or unsubscribe fails.
 */
async function unsubscribeFromCharacteristic(peripheralId, characteristicUuid) {
  const peripheral = connectedPeripherals[peripheralId];
  if (!peripheral) {
    return Promise.reject(new Error('Peripheral not connected'));
  }

  // Find the target characteristic.
  let targetCharacteristic = null;
  if (peripheral.services) {
    for (const service of peripheral.services) {
      if (service.characteristics) {
        targetCharacteristic = service.characteristics.find(c => c.uuid === characteristicUuid);
        if (targetCharacteristic) break;
      }
    }
  }

  if (!targetCharacteristic) {
    return Promise.reject(new Error('Characteristic not found'));
  }

  return new Promise((resolve, reject) => {
    // Unsubscribe from notifications/indications
    targetCharacteristic.unsubscribe((error) => {
      if (error) {
        return reject(error);
      }
      
      // Remove all data event listeners
      targetCharacteristic.removeAllListeners('data');
      
      resolve({ 
        message: 'Unsubscription successful', 
        characteristicUuid
      });
    });
  });
}

// Exported module functions and objects.
module.exports = {
  noble, // The noble instance itself, for direct use if needed.
  discoveredPeripherals, // Raw array of discovered noble peripheral objects.
  getDiscoveredPeripherals, // Function to get formatted list of discovered peripherals.
  connectedPeripherals, // Object storing currently connected noble peripheral objects.
  connectDevice, // Function to connect to a device.
  disconnectDevice, // Function to disconnect from a device.
  getServices, // Function to get services of a connected device.
  getCharacteristics, // Function to get characteristics of a service.
  readCharacteristic, // Function to read a characteristic's value.
  writeCharacteristic, // Function to write to a characteristic.
  subscribeToCharacteristic, // Function to subscribe to characteristic notifications.
  unsubscribeFromCharacteristic // Function to unsubscribe from characteristic notifications.
};
