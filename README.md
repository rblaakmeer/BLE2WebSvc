# BLE2WebSvc

Building a bridge between BLE devices and Webservices using Resin.io on a Raspberry Pi Zero W

BLE2WebSvc is a Node.js Express web server that acts as a bridge between Bluetooth Low Energy (BLE) devices and web services. It provides both a REST API and a comprehensive web interface for BLE device interaction.

## Features

- **Device Discovery & Connection**: Discover and connect to BLE devices
- **Service & Characteristic Access**: Browse services and characteristics
- **Read/Write Operations**: Read from and write to BLE characteristics
- **Real-time Notifications**: Subscribe to BLE notifications and indications
- **Web Interface**: Modern responsive web UI for complete BLE interaction
- **REST API**: Full RESTful API for programmatic access

## Requirements

- **Node.js**: Version 16.16.0 or higher (but less than 17.0.0)
- **Operating System**: Linux (recommended: Raspberry Pi OS for Pi Zero W)
- **Hardware**: Bluetooth Low Energy capable device

## Installation

### Option 1: Automated Installation (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/BLE2WebSvc.git
   cd BLE2WebSvc
   ```

2. **Run the automated Node.js installation script:**
   ```bash
   chmod +x install-nodejs.sh
   ./install-nodejs.sh
   ```
   This script will:
   - Install Node.js v16 specifically
   - Verify the installation
   - Set up the environment

3. **Install project dependencies:**
   ```bash
   npm install
   ```

4. **Verify Node.js version compatibility:**
   ```bash
   npm run check-version
   ```

### Option 2: Manual Installation

1. **Install Node.js v16.16.0:**
   - Download from [Node.js official website](https://nodejs.org/)
   - Or use a version manager like nvm:
     ```bash
     nvm install 16.16.0
     nvm use 16.16.0
     ```

2. **Clone and setup the project:**
   ```bash
   git clone https://github.com/your-username/BLE2WebSvc.git
   cd BLE2WebSvc
   npm install
   ```

### Raspberry Pi Zero W Setup

For deployment on Raspberry Pi Zero W:

1. **Enable Bluetooth:**
   ```bash
   sudo systemctl enable bluetooth
   sudo systemctl start bluetooth
   ```

2. **Install additional dependencies:**
   ```bash
   sudo apt-get update
   sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
   ```

3. **Grant permissions for BLE access:**
   ```bash
   sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
   ```

## Usage

### Starting the Server

```bash
npm start
```

The server will start on port 8111 by default. You can access:
- **Web Interface**: http://localhost:8111/web
- **API Endpoints**: http://localhost:8111/ble/*

### Environment Variables

- `PORT`: Server port (default: 8111)
- `NODE_ENV`: Environment mode (development/production)

## Web Interface

The BLE2WebSvc includes a comprehensive web interface accessible at `/web` that provides full BLE functionality through an intuitive UI.

### Features

#### 1. Device Discovery & Management
- **Automatic Discovery**: Lists all discovered BLE devices in real-time
- **Device Information**: Shows device ID, name, and connection status
- **Connection Management**: Connect/disconnect buttons with visual status indicators

#### 2. Service & Characteristic Browser
- **Service Enumeration**: Browse all services available on connected devices
- **Characteristic Details**: View characteristic properties (read, write, notify, indicate)
- **UUID Display**: Full UUID information for services and characteristics

#### 3. Read Operations
- **One-Click Reading**: Green "Read" buttons for readable characteristics
- **Hex Value Display**: Values displayed in hexadecimal format
- **Real-time Updates**: Automatic refresh of read values

#### 4. Write Operations
- **Hex Input Validation**: Write hex values with automatic validation
- **Write Options**: Support for write with/without response
- **Orange "Write" Buttons**: Clear visual indication for writable characteristics
- **Error Handling**: User-friendly error messages for invalid inputs

#### 5. Subscription Support (Notifications/Indications)
- **Real-time Notifications**: Subscribe to characteristic notifications and indications
- **Purple "Subscribe" Buttons**: Easy identification of subscribable characteristics
- **Live Data Stream**: Real-time display of notification data with timestamps
- **Automatic Cleanup**: Subscriptions automatically cleaned up on device disconnect
- **Unsubscribe Functionality**: Easy unsubscribe with status updates

### UI Design

- **Responsive Layout**: Works on desktop, tablet, and mobile devices
- **Color-Coded Operations**:
  - 🟢 **Green**: Read operations
  - 🟠 **Orange**: Write operations  
  - 🟣 **Purple**: Subscribe/notification operations
- **Real-time Updates**: 1-second polling for live data updates
- **Modern Styling**: Clean, professional interface with intuitive navigation

### Technical Implementation

- **Frontend**: Pure HTML/CSS/JavaScript with no external dependencies
- **Real-time Communication**: Polling-based updates (1-second intervals)
- **Data Buffering**: Server-side notification buffering for reliable delivery
- **Error Handling**: Comprehensive error handling with user feedback
- **Automatic Cleanup**: Memory management and subscription cleanup

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
#### `POST /ble/devices/:deviceId/characteristics/:characteristicUuid/subscribe`

-   **Description:** Subscribes to notifications or indications from a specific characteristic on a connected BLE device.
-   **Path Parameters:**
    -   `deviceId` (string, required): The unique identifier of the connected BLE device.
    -   `characteristicUuid` (string, required): The UUID of the characteristic to subscribe to.
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns a message indicating successful subscription.
    ```json
    {
      "message": "Subscription successful",
      "deviceId": "string",
      "characteristicUuid": "string"
    }
    ```
-   **Error Responses:**
    -   `404 Not Found`: If the `deviceId` is not connected, the `characteristicUuid` is not found, or the characteristic does not support notifications/indications.
    -   `500 Internal Server Error`: If an unexpected error occurs during the subscription process.

---
#### `POST /ble/devices/:deviceId/characteristics/:characteristicUuid/unsubscribe`

-   **Description:** Unsubscribes from notifications or indications from a specific characteristic on a connected BLE device.
-   **Path Parameters:**
    -   `deviceId` (string, required): The unique identifier of the connected BLE device.
    -   `characteristicUuid` (string, required): The UUID of the characteristic to unsubscribe from.
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns a message indicating successful unsubscription.
    ```json
    {
      "message": "Unsubscription successful",
      "deviceId": "string",
      "characteristicUuid": "string"
    }
    ```
-   **Error Responses:**
    -   `404 Not Found`: If the `deviceId` is not connected, the `characteristicUuid` is not found, or there is no active subscription.
    -   `500 Internal Server Error`: If an unexpected error occurs during the unsubscription process.

---
#### `GET /ble/devices/:deviceId/characteristics/:characteristicUuid/notifications`

-   **Description:** Retrieves buffered notification/indication data from a subscribed characteristic.
-   **Path Parameters:**
    -   `deviceId` (string, required): The unique identifier of the connected BLE device.
    -   `characteristicUuid` (string, required): The UUID of the subscribed characteristic.
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns an array of notification data with timestamps.
    ```json
    [
      {
        "value": "string", // Hexadecimal representation of the notification value
        "timestamp": "string" // ISO timestamp of when the notification was received
      }
    ]
    ```
-   **Error Responses:**
    -   `404 Not Found`: If the `deviceId` is not connected, the `characteristicUuid` is not found, or there is no active subscription.
    -   `500 Internal Server Error`: If an unexpected error occurs while retrieving notifications.

---
#### `GET /ble/subscriptions`

-   **Description:** Retrieves a list of all active subscriptions across all connected devices.
-   **Path Parameters:** None.
-   **Request Body:** None.
-   **Success Response (200 OK):**
    Returns an array of active subscription objects.
    ```json
    [
      {
        "deviceId": "string", // Unique identifier of the connected device
        "characteristicUuid": "string", // UUID of the subscribed characteristic
        "deviceName": "string", // Name of the device (if available)
        "subscriptionTime": "string" // ISO timestamp of when the subscription was created
      }
    ]
    ```
-   **Error Responses:**
    -   `500 Internal Server Error`: If an unexpected error occurs while retrieving subscription information.

---

## Architecture

### Core Components

- **`server.js`**: Express web server with REST API endpoints and web interface routing
- **`ble-manager.js`**: Core BLE functionality using @abandonware/noble library with subscription support
- **`/web`**: Complete web interface for BLE device interaction
- **`package.json`**: Node.js project configuration with dependencies

### Dependencies

- **Express 4.19.2**: Web server framework
- **@abandonware/noble 1.9.2-20**: Bluetooth Low Energy library for Node.js
- **Jest 29.7.0**: Testing framework
- **Supertest 6.3.4**: HTTP testing library
- **Semver**: Version checking utility

## Deployment

### Raspberry Pi Zero W with Resin.io

This project is designed for deployment on Raspberry Pi Zero W using Resin.io (now balena.io):

1. **Create a new application** on balena.io
2. **Download the OS image** and flash it to an SD card
3. **Push the code** to your balena application:
   ```bash
   git remote add balena <your-balena-git-endpoint>
   git push balena main
   ```

### Docker Support

The project includes Docker support for containerized deployment. The container will:
- Install Node.js v16
- Install system dependencies for BLE
- Set up the application environment
- Expose port 3000

## Troubleshooting

### Common Issues

1. **Permission Denied for BLE Access:**
   ```bash
   sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
   ```

2. **Node.js Version Compatibility:**
   - Ensure Node.js version is 16.16.0 or higher but less than 17.0.0
   - Run `npm run check-version` to verify

3. **Bluetooth Service Not Running:**
   ```bash
   sudo systemctl start bluetooth
   sudo systemctl enable bluetooth
   ```

4. **Noble Installation Issues:**
   - Install system dependencies: `sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev`
   - Rebuild native modules: `npm rebuild`

### Logs and Debugging

- Check server logs for API errors
- Use browser developer tools for web interface debugging
- Enable Noble debug mode: `DEBUG=noble* npm start`

---