document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const devicesContainer = document.getElementById('devices-container');
    let connectedDevices = {}; // Store device objects and their servers

    scanButton.addEventListener('click', scanForDevices);

    async function scanForDevices() {
        devicesContainer.innerHTML = '<div class="loading">Scanning...</div>';
        try {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['battery_service', 'heart_rate'] // Add more services as needed
            });
            devicesContainer.innerHTML = ''; // Clear the container
            handleDevice(device);
        } catch (error) {
            console.error('Error scanning for devices:', error);
            devicesContainer.innerHTML = `<div class="error">Scan failed: ${error.message}</div>`;
        }
    }

    function handleDevice(device) {
        const deviceCard = document.createElement('div');
        deviceCard.className = 'device-card';
        deviceCard.id = `device-${device.id}`;
        deviceCard.innerHTML = `
            <div class="device-name">${device.name || 'Unknown Device'}</div>
            <div class="device-info">
                <strong>ID:</strong> ${device.id}<br>
                <strong>Status:</strong> <span class="status-text">Disconnected</span>
            </div>
            <button class="connect-btn">Connect</button>
            <div class="services-section" style="display: none;"></div>
        `;
        devicesContainer.appendChild(deviceCard);

        const connectButton = deviceCard.querySelector('.connect-btn');
        connectButton.addEventListener('click', () => toggleConnection(device, deviceCard));
    }

    async function toggleConnection(device, card) {
        const connectButton = card.querySelector('.connect-btn');
        const statusText = card.querySelector('.status-text');
        const servicesSection = card.querySelector('.services-section');

        if (connectedDevices[device.id] && connectedDevices[device.id].connected) {
            // Disconnect
            connectButton.textContent = 'Disconnecting...';
            connectedDevices[device.id].disconnect();
        } else {
            // Connect
            connectButton.textContent = 'Connecting...';
            connectButton.disabled = true;
            try {
                const server = await device.gatt.connect();
                connectedDevices[device.id] = server;

                // Handle disconnection
                device.addEventListener('gattserverdisconnected', () => onDisconnected(device, card));

                statusText.textContent = 'Connected';
                connectButton.textContent = 'Disconnect';
                connectButton.disabled = false;
                servicesSection.style.display = 'block';
                await discoverServices(server, servicesSection);
            } catch (error) {
                console.error('Connection failed:', error);
                statusText.textContent = 'Connection Failed';
                connectButton.textContent = 'Connect';
                connectButton.disabled = false;
            }
        }
    }

    function onDisconnected(device, card) {
        const statusText = card.querySelector('.status-text');
        const connectButton = card.querySelector('.connect-btn');
        const servicesSection = card.querySelector('.services-section');

        statusText.textContent = 'Disconnected';
        connectButton.textContent = 'Connect';
        connectButton.disabled = false;
        servicesSection.style.display = 'none';
        servicesSection.innerHTML = '';
        delete connectedDevices[device.id];
    }

    async function discoverServices(server, servicesSection) {
        servicesSection.innerHTML = '<div class="loading">Discovering services...</div>';
        try {
            const services = await server.getPrimaryServices();
            let servicesHtml = '<h3>Services</h3>';
            for (const service of services) {
                servicesHtml += `
                    <div class="service-card">
                        <strong>Service:</strong> ${service.uuid}
                        <div class="characteristics-list"></div>
                    </div>
                `;
            }
            servicesSection.innerHTML = servicesHtml;

            const serviceCards = servicesSection.querySelectorAll('.service-card');
            for (let i = 0; i < services.length; i++) {
                discoverCharacteristics(services[i], serviceCards[i].querySelector('.characteristics-list'));
            }
        } catch (error) {
            servicesSection.innerHTML = `<div class="error">Failed to discover services: ${error.message}</div>`;
        }
    }

    async function discoverCharacteristics(service, characteristicsList) {
        characteristicsList.innerHTML = '<div class="loading">Discovering characteristics...</div>';
        try {
            const characteristics = await service.getCharacteristics();
            let characteristicsHtml = '';
            for (const characteristic of characteristics) {
                characteristicsHtml += `
                    <div class="characteristic-item">
                        <div class="characteristic-info">
                            <strong>Characteristic:</strong> ${characteristic.uuid}<br>
                            Properties: ${Object.keys(characteristic.properties).filter(k => characteristic.properties[k]).join(', ')}
                        </div>
                        <div class="button-group">
                            ${characteristic.properties.read ? '<button class="read-btn">Read</button>' : ''}
                            ${characteristic.properties.write ? '<button class="write-btn">Write</button>' : ''}
                            ${characteristic.properties.notify ? '<button class="subscribe-btn">Notify</button>' : ''}
                        </div>
                        <div class="characteristic-value" style="display: none;"></div>
                    </div>
                `;
            }
            characteristicsList.innerHTML = characteristicsHtml;

            const charItems = characteristicsList.querySelectorAll('.characteristic-item');
            for (let i = 0; i < characteristics.length; i++) {
                const char = characteristics[i];
                const item = charItems[i];
                if (char.properties.read) {
                    item.querySelector('.read-btn').addEventListener('click', () => readValue(char, item.querySelector('.characteristic-value')));
                }
                 if (char.properties.notify) {
                    item.querySelector('.subscribe-btn').addEventListener('click', (event) => toggleNotifications(char, event.target));
                }
            }
        } catch (error) {
            characteristicsList.innerHTML = `<div class="error">Failed to discover characteristics: ${error.message}</div>`;
        }
    }

    async function readValue(characteristic, valueDiv) {
        try {
            const value = await characteristic.readValue();
            const decoder = new TextDecoder('utf-8');
            valueDiv.textContent = `Value: ${decoder.decode(value)}`;
            valueDiv.style.display = 'block';
        } catch (error) {
            valueDiv.textContent = `Read failed: ${error.message}`;
            valueDiv.style.display = 'block';
        }
    }

    async function toggleNotifications(characteristic, button) {
        if (button.textContent === 'Notify') {
            try {
                await characteristic.startNotifications();
                characteristic.addEventListener('characteristicvaluechanged', handleNotifications);
                button.textContent = 'Stop Notify';
            } catch (error) {
                console.error('Failed to start notifications:', error);
            }
        } else {
            try {
                await characteristic.stopNotifications();
                characteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
                button.textContent = 'Notify';
            } catch (error) {
                console.error('Failed to stop notifications:', error);
            }
        }
    }

    function handleNotifications(event) {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const valueStr = decoder.decode(value);
        console.log(`Notification: ${valueStr}`);

        const valueDiv = event.target.service.device.gatt.connected ?
            document.querySelector(`#device-${event.target.service.device.id} #value-${event.target.uuid}`) : null;

        if (valueDiv) {
            valueDiv.textContent = `Notification: ${valueStr}`;
            valueDiv.style.display = 'block';
        }
    }
});
