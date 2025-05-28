# BLE2WebSvc

Building a bridge between BLE devices and Webservices using Resin.io on a Raspberry Pi Zero W


## Running Tests

This project uses [Jest](https://jestjs.io/) for unit testing. The tests cover the core logic in `ble-manager.js` (using mocks for the `noble` BLE library) and the API endpoints in `server.js` (using `supertest` and mocks for `ble-manager.js`).

### Prerequisites

- Node.js and npm installed on your system.
- Git (to clone the repository).

### Steps to Run Tests

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <repository_url>
    cd BLE2WebSvc 
    ```
    (Replace `<repository_url>` with the actual URL of this repository).

2.  **Install dependencies:**
    Navigate to the project directory and install both runtime and development dependencies:
    ```bash
    npm install
    ```

3.  **Run the tests:**
    Execute the test script defined in `package.json`:
    ```bash
    npm test
    ```
    This will run Jest, which will discover and execute the test files (located in the `__tests__` directory). You should see output in your console indicating the status of the tests (pass/fail) and any coverage information if configured.


## API Documentation

This section details the API endpoints available for interacting with the BLE2WebSvc.

---
#### `GET /ble/devices`

-   **Description:** Retrieves a list of currently discovered BLE (Bluetooth Low Energy) devices. The list includes devices found during the ongoing scanning process.
-   **Path Parameters:** None.
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns an array of device objects. Each object represents a discovered peripheral.
    ```json
    [
      {
        "id": "string", // Unique identifier for the peripheral
        "address": "string", // MAC address of the peripheral (if available)
        "name": "string", // Local name of the peripheral (if available, otherwise null or 'Unknown')
        "advertisedServices": ["string"], // Array of UUIDs of services advertised by the peripheral
        "state": "string" // Current connection state (e.g., "disconnected", "connecting", "connected")
      }
    ]
    ```
-   **Error Responses:**
    -   `500 Internal Server Error`: If there's an unexpected error while fetching the list of devices (e.g., an issue within the `ble-manager`).

---
#### `POST /ble/devices/:deviceId/connect`

-   **Description:** Attempts to establish a connection with a specified BLE device and discover its services and characteristics.
-   **Path Parameters:**
    -   `deviceId` (string, required): The unique identifier of the BLE device to connect to (obtained from the `GET /ble/devices` endpoint).
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns a message indicating successful connection and information about the connected device.
    ```json
    {
      "message": "Connection successful",
      "device": {
        "id": "string", // Unique identifier of the connected peripheral
        "name": "string", // Local name of the peripheral
        "state": "string" // Should be "connected"
      }
    }
    ```
-   **Error Responses:**
    -   `400 Bad Request`: If the device is already connected, attempting to connect, or if the peripheral disconnects during the connection process.
    -   `404 Not Found`: If the specified `deviceId` does not correspond to any discovered peripheral.
    -   `500 Internal Server Error`: If an unexpected error occurs during the connection attempt (e.g., failure to discover services/characteristics after initial connection, or other internal errors in `ble-manager`).

---
#### `POST /ble/devices/:deviceId/disconnect`

-   **Description:** Disconnects from a currently connected BLE device.
-   **Path Parameters:**
    -   `deviceId` (string, required): The unique identifier of the BLE device to disconnect from.
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns a message indicating successful disconnection and information about the disconnected device.
    ```json
    {
      "message": "Disconnection successful",
      "device": {
        "id": "string", // Unique identifier of the disconnected peripheral
        "message": "Disconnected successfully"
      }
    }
    ```
-   **Error Responses:**
    -   `404 Not Found`: If the specified `deviceId` is not currently connected or was not found in the list of connected devices.
    -   `500 Internal Server Error`: If an unexpected error occurs during the disconnection attempt.

---
#### `GET /ble/devices/:deviceId/services`

-   **Description:** Retrieves a list of services offered by a connected BLE device.
-   **Path Parameters:**
    -   `deviceId` (string, required): The unique identifier of the connected BLE device.
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns an array of service objects.
    ```json
    [
      {
        "uuid": "string", // UUID of the service
        "name": "string", // Human-readable name of the service (if available)
        "type": "string", // Type of the service (if available)
        "includedServiceUuids": ["string"] // Array of UUIDs of included services (if any)
      }
    ]
    ```
-   **Error Responses:**
    -   `404 Not Found`: If the specified `deviceId` is not connected.
    -   `500 Internal Server Error`: If an unexpected error occurs while fetching services (e.g., services were not discovered properly during connection).

---
#### `GET /ble/devices/:deviceId/services/:serviceUuid/characteristics`

-   **Description:** Retrieves a list of characteristics for a specific service on a connected BLE device.
-   **Path Parameters:**
    -   `deviceId` (string, required): The unique identifier of the connected BLE device.
    -   `serviceUuid` (string, required): The UUID of the service from which to retrieve characteristics.
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns an array of characteristic objects.
    ```json
    [
      {
        "uuid": "string", // UUID of the characteristic
        "name": "string", // Human-readable name of the characteristic (if available)
        "type": "string", // Type of the characteristic (if available)
        "properties": ["string"] // Array of properties (e.g., "read", "write", "notify")
      }
    ]
    ```
-   **Error Responses:**
    -   `404 Not Found`: If the specified `deviceId` is not connected, or if the `serviceUuid` is not found on the device.
    -   `500 Internal Server Error`: If an unexpected error occurs while fetching characteristics.

---
#### `GET /ble/devices/:deviceId/characteristics/:characteristicUuid`

-   **Description:** Reads the value of a specific characteristic from a connected BLE device.
-   **Path Parameters:**
    -   `deviceId` (string, required): The unique identifier of the connected BLE device.
    -   `characteristicUuid` (string, required): The UUID of the characteristic to read.
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns the characteristic UUID and its value as a hexadecimal string.
    ```json
    {
      "characteristicUuid": "string",
      "value": "string" // Hexadecimal representation of the characteristic value (e.g., "0102030a")
    }
    ```
-   **Error Responses:**
    -   `404 Not Found`: If the `deviceId` is not connected, the `characteristicUuid` is not found, or the characteristic is not readable.
    -   `500 Internal Server Error`: If an unexpected error occurs during the read operation.

---
#### `POST /ble/devices/:deviceId/characteristics/:characteristicUuid`

-   **Description:** Writes a value to a specific characteristic on a connected BLE device.
-   **Path Parameters:**
    -   `deviceId` (string, required): The unique identifier of the connected BLE device.
    -   `characteristicUuid` (string, required): The UUID of the characteristic to write to.
-   **Request Body:**
    ```json
    {
      "value": "string", // Required. The hexadecimal string value to write (e.g., "010203ff"). Must be an even number of characters. Empty string is allowed.
      "withoutResponse": "boolean" // Optional. If true, performs a "write without response" operation. Defaults to false.
    }
    ```
-   **Success Response (200 OK):**
    Returns a message indicating the write operation was successful.
    ```json
    {
      "message": "Write successful"
    }
    ```
-   **Error Responses:**
    -   `400 Bad Request`: If the `value` field is missing from the request body or if its format is invalid (not a valid hex string or odd length).
    -   `404 Not Found`: If the `deviceId` is not connected, the `characteristicUuid` is not found, or the characteristic is not writable with the specified response option.
    -   `500 Internal Server Error`: If an unexpected error occurs during the write operation.

---