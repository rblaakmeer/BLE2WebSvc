document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const devicesContainer = document.getElementById('devices-container');
    let connectedDevices = {}; // Store device objects and their servers

    scanButton.addEventListener('click', scanForDevices);

    function setStatus(container, className, message) {
        container.replaceChildren();
        const status = document.createElement('div');
        status.className = className;
        status.textContent = message;
        container.appendChild(status);
    }

    function appendText(parent, text) {
        parent.appendChild(document.createTextNode(text));
    }

    async function scanForDevices() {
        setStatus(devicesContainer, 'loading', 'Scanning...');
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['battery_service'] }, { services: ['heart_rate'] }],
                optionalServices: ['battery_service', 'heart_rate'] // Add more services as needed
            });
            devicesContainer.replaceChildren();
            handleDevice(device);
        } catch (error) {
            console.error('Error scanning for devices:', error);
            setStatus(devicesContainer, 'error', `Scan failed: ${error.message}`);
        }
    }

    function handleDevice(device) {
        const deviceCard = document.createElement('div');
        deviceCard.className = 'device-card';
        deviceCard.id = `device-${device.id}`;

        const deviceName = document.createElement('div');
        deviceName.className = 'device-name';
        deviceName.textContent = device.name || 'Unknown Device';

        const deviceInfo = document.createElement('div');
        deviceInfo.className = 'device-info';
        const idLabel = document.createElement('strong');
        idLabel.textContent = 'ID:';
        deviceInfo.appendChild(idLabel);
        appendText(deviceInfo, ` ${device.id}`);
        deviceInfo.appendChild(document.createElement('br'));
        const statusLabel = document.createElement('strong');
        statusLabel.textContent = 'Status:';
        deviceInfo.appendChild(statusLabel);
        appendText(deviceInfo, ' ');
        const statusText = document.createElement('span');
        statusText.className = 'status-text';
        statusText.textContent = 'Disconnected';
        deviceInfo.appendChild(statusText);

        const connectButton = document.createElement('button');
        connectButton.className = 'connect-btn';
        connectButton.textContent = 'Connect';

        const servicesSection = document.createElement('div');
        servicesSection.className = 'services-section';
        servicesSection.style.display = 'none';

        deviceCard.append(deviceName, deviceInfo, connectButton, servicesSection);
        devicesContainer.appendChild(deviceCard);

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
        servicesSection.replaceChildren();
        delete connectedDevices[device.id];
    }

    async function discoverServices(server, servicesSection) {
        setStatus(servicesSection, 'loading', 'Discovering services...');
        try {
            const services = await server.getPrimaryServices();
            servicesSection.replaceChildren();
            const heading = document.createElement('h3');
            heading.textContent = 'Services';
            servicesSection.appendChild(heading);

            const serviceCards = [];
            for (const service of services) {
                const serviceCard = document.createElement('div');
                serviceCard.className = 'service-card';
                const label = document.createElement('strong');
                label.textContent = 'Service:';
                serviceCard.appendChild(label);
                appendText(serviceCard, ` ${service.uuid}`);
                const characteristicsList = document.createElement('div');
                characteristicsList.className = 'characteristics-list';
                serviceCard.appendChild(characteristicsList);
                servicesSection.appendChild(serviceCard);
                serviceCards.push({ service, characteristicsList });
            }

            for (const { service, characteristicsList } of serviceCards) {
                discoverCharacteristics(service, characteristicsList);
            }
        } catch (error) {
            setStatus(servicesSection, 'error', `Failed to discover services: ${error.message}`);
        }
    }

    async function discoverCharacteristics(service, characteristicsList) {
        setStatus(characteristicsList, 'loading', 'Discovering characteristics...');
        try {
            const characteristics = await service.getCharacteristics();
            characteristicsList.replaceChildren();
            for (const characteristic of characteristics) {
                const item = document.createElement('div');
                item.className = 'characteristic-item';

                const info = document.createElement('div');
                info.className = 'characteristic-info';
                const label = document.createElement('strong');
                label.textContent = 'Characteristic:';
                info.appendChild(label);
                appendText(info, ` ${characteristic.uuid}`);
                info.appendChild(document.createElement('br'));
                appendText(info, `Properties: ${Object.keys(characteristic.properties).filter(k => characteristic.properties[k]).join(', ')}`);

                const buttonGroup = document.createElement('div');
                buttonGroup.className = 'button-group';
                const valueDiv = document.createElement('div');
                valueDiv.className = 'characteristic-value';
                valueDiv.style.display = 'none';

                if (characteristic.properties.read) {
                    const readButton = document.createElement('button');
                    readButton.className = 'read-btn';
                    readButton.textContent = 'Read';
                    readButton.addEventListener('click', () => readValue(characteristic, valueDiv));
                    buttonGroup.appendChild(readButton);
                }
                if (characteristic.properties.write) {
                    const writeButton = document.createElement('button');
                    writeButton.className = 'write-btn';
                    writeButton.textContent = 'Write';
                    buttonGroup.appendChild(writeButton);
                }
                if (characteristic.properties.notify) {
                    const notifyButton = document.createElement('button');
                    notifyButton.className = 'subscribe-btn';
                    notifyButton.textContent = 'Notify';
                    notifyButton.addEventListener('click', (event) => toggleNotifications(characteristic, event.target));
                    buttonGroup.appendChild(notifyButton);
                }

                item.append(info, buttonGroup, valueDiv);
                characteristicsList.appendChild(item);
            }

            if (characteristics.length === 0) {
                setStatus(characteristicsList, 'loading', 'No characteristics found.');
            }
        } catch (error) {
            setStatus(characteristicsList, 'error', `Failed to discover characteristics: ${error.message}`);
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

        const rawId = event.target.service.device.id;
        const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(rawId) : rawId.replace(/"/g, '\\"');
        const valueDiv = event.target.service.device.gatt.connected ?
            document.querySelector(`#device-${safeId} #value-${event.target.uuid}`) : null;

        if (valueDiv) {
            valueDiv.textContent = `Notification: ${valueStr}`;
            valueDiv.style.display = 'block';
        }
    }
});
