# Running BLE2WebSvc on Raspberry Pi Zero W (Standalone)

This guide will help you run BLE2WebSvc directly on a Raspberry Pi Zero W without using resin.io.

## Prerequisites

- Raspberry Pi Zero W with Raspberry Pi OS installed
- SSH access to your Pi
- Internet connection on the Pi

## Installation Steps

### 1. Update Your Raspberry Pi

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js

```bash
# Install Node.js (using NodeSource repository for latest LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install Bluetooth Dependencies

```bash
sudo apt-get install -y \
    bluetooth \
    bluez \
    libbluetooth-dev \
    libudev-dev \
    bluez-firmware \
    pi-bluetooth
```

### 4. Configure Bluetooth

```bash
# Enable Bluetooth service
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# Add your user to the bluetooth group
sudo usermod -a -G bluetooth $USER

# You may need to reboot for group changes to take effect
sudo reboot
```

### 5. Clone and Setup the Project

```bash
# Clone your project (replace with your actual repository URL)
git clone https://github.com/rblaakmeer/BLE2WebSvc.git
cd BLE2WebSvc

# Install dependencies
npm install

# Make scripts executable
chmod +x start.sh
chmod +x activate-bluetooth.sh
chmod +x setup-pi.sh
```

### 6. Configure Bluetooth on Pi Zero W

The Pi Zero W has specific Bluetooth configuration requirements. Run:

```bash
# Run the setup script for Pi-specific configuration
sudo ./setup-pi.sh
```

### 7. Test Bluetooth

```bash
# Check if Bluetooth is working
sudo hciconfig
sudo hcitool scan
```

### 8. Run the Application

```bash
# Start the application
npm start

# Or use the provided start script
./start.sh
```

The server will start on port 8111. You can access it at:
- Local: `http://localhost:8111`
- Network: `http://[PI_IP_ADDRESS]:8111`

## Running as a Service (Optional)

To run BLE2WebSvc as a system service that starts automatically:

### 1. Create Service File

```bash
sudo nano /etc/systemd/system/ble2websvc.service
```

Add the following content (adjust paths as needed):

```ini
[Unit]
Description=BLE2WebSvc - BLE to Web Service Bridge
After=network.target bluetooth.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/BLE2WebSvc
ExecStartPre=/home/pi/BLE2WebSvc/activate-bluetooth.sh
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8111

[Install]
WantedBy=multi-user.target
```

### 2. Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable ble2websvc
sudo systemctl start ble2websvc

# Check service status
sudo systemctl status ble2websvc

# View logs
sudo journalctl -u ble2websvc -f
```

## Troubleshooting

### Common Issues

1. **Permission Denied for Bluetooth**
   ```bash
   sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
   ```

2. **Bluetooth Not Working**
   ```bash
   sudo systemctl restart bluetooth
   sudo hciconfig hci0 up
   ```

3. **Noble Module Issues**
   ```bash
   # Rebuild native modules
   npm rebuild
   ```

4. **Port Already in Use**
   ```bash
   # Change port in package.json or set environment variable
   export PORT=8112
   npm start
   ```

### Checking Logs

```bash
# Application logs (if running as service)
sudo journalctl -u ble2websvc -n 50

# Bluetooth logs
sudo journalctl -u bluetooth -n 20

# System logs
dmesg | grep -i bluetooth
```

## API Testing

Once running, test the API:

```bash
# List discovered devices
curl http://localhost:8111/ble/devices

# Check if server is responding
curl http://localhost:8111/ble/devices -v
```

## Network Access

To access from other devices on your network:

1. Find your Pi's IP address:
   ```bash
   hostname -I
   ```

2. Access from another device:
   ```
   http://[PI_IP_ADDRESS]:8111/ble/devices
   ```

## Security Considerations

- Consider setting up a firewall
- Use HTTPS in production
- Implement authentication if needed
- Keep the system updated

## Performance Tips

- The Pi Zero W has limited resources
- Monitor memory usage: `free -h`
- Monitor CPU usage: `top`
- Consider limiting concurrent BLE connections
