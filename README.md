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