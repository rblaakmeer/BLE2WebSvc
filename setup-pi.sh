#!/bin/bash

echo "Setting up Raspberry Pi Zero W for BLE2WebSvc..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)" 
   exit 1
fi

# Enable UART for Bluetooth
echo "Configuring UART for Bluetooth..."
if ! grep -q "enable_uart=1" /boot/config.txt; then
    echo "enable_uart=1" >> /boot/config.txt
    echo "Added enable_uart=1 to /boot/config.txt"
fi

# Disable Bluetooth on UART (we'll use it for BLE)
if ! grep -q "dtoverlay=disable-bt" /boot/config.txt; then
    echo "dtoverlay=disable-bt" >> /boot/config.txt
    echo "Added disable-bt overlay to /boot/config.txt"
fi

# Configure Bluetooth service
echo "Configuring Bluetooth service..."
systemctl enable bluetooth
systemctl enable hciuart

# Set up permissions for Node.js to access Bluetooth
echo "Setting up Node.js Bluetooth permissions..."
NODE_PATH=$(which node)
if [ -n "$NODE_PATH" ]; then
    setcap cap_net_raw+eip $NODE_PATH
    echo "Set Bluetooth capabilities for Node.js at $NODE_PATH"
else
    echo "Warning: Node.js not found. You may need to run this after installing Node.js:"
    echo "sudo setcap cap_net_raw+eip \$(which node)"
fi

# Create udev rule for Bluetooth access
echo "Creating udev rule for Bluetooth access..."
cat > /etc/udev/rules.d/99-bluetooth.rules << EOF
# Allow users in bluetooth group to access Bluetooth devices
SUBSYSTEM=="bluetooth", GROUP="bluetooth", MODE="0664"
KERNEL=="hci[0-9]*", GROUP="bluetooth", MODE="0664"
EOF

# Reload udev rules
udevadm control --reload-rules
udevadm trigger

# Configure Bluetooth on Pi Zero W specifically
echo "Configuring Bluetooth for Pi Zero W..."

# Create a more robust Bluetooth activation script
cat > /usr/local/bin/pi-bluetooth-setup << 'EOF'
#!/bin/bash

# Pi Zero W specific Bluetooth setup
echo "Setting up Bluetooth on Pi Zero W..."

# Stop existing Bluetooth services
systemctl stop bluetooth
systemctl stop hciuart

# Reset Bluetooth hardware
if [ -e /dev/ttyAMA0 ]; then
    echo "Resetting Bluetooth hardware..."
    echo 0 > /sys/class/gpio/gpio45/value 2>/dev/null || true
    sleep 1
    echo 1 > /sys/class/gpio/gpio45/value 2>/dev/null || true
    sleep 1
fi

# Start hciuart service
systemctl start hciuart
sleep 2

# Start Bluetooth service
systemctl start bluetooth
sleep 2

# Bring up HCI interface
hciconfig hci0 up 2>/dev/null || {
    echo "Trying alternative Bluetooth initialization..."
    /usr/bin/hciattach /dev/ttyAMA0 bcm43xx 921600 noflow - 2>/dev/null || true
    sleep 2
    hciconfig hci0 up
}

echo "Bluetooth setup complete"
hciconfig
EOF

chmod +x /usr/local/bin/pi-bluetooth-setup

# Update the activate-bluetooth.sh script to be more robust
cat > activate-bluetooth.sh << 'EOF'
#!/bin/bash

echo "Activating Bluetooth on Raspberry Pi Zero W..."

# Check if we're running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    # Running as root, call the setup script directly
    /usr/local/bin/pi-bluetooth-setup
else
    # Not root, try with sudo
    if command -v sudo >/dev/null 2>&1; then
        echo "Running Bluetooth setup with sudo..."
        sudo /usr/local/bin/pi-bluetooth-setup
    else
        echo "Warning: Not running as root and sudo not available"
        echo "Attempting basic Bluetooth activation..."
        
        # Try basic activation
        if [ -e /dev/ttyAMA0 ]; then
            echo "Attaching hci0..."
            /usr/bin/hciattach /dev/ttyAMA0 bcm43xx 921600 noflow - 2>/dev/null || {
                echo "First try failed. Trying again..."
                sleep 1
                /usr/bin/hciattach /dev/ttyAMA0 bcm43xx 921600 noflow - 2>/dev/null || true
            }
        fi
        
        echo "Bringing hci0 up..."
        hciconfig hci0 up 2>/dev/null || echo "Could not bring up hci0 - may need root privileges"
    fi
fi

# Verify Bluetooth is working
if hciconfig hci0 2>/dev/null | grep -q "UP RUNNING"; then
    echo "✓ Bluetooth is active and running"
    hciconfig hci0
else
    echo "⚠ Bluetooth may not be fully activated"
    echo "Current HCI status:"
    hciconfig 2>/dev/null || echo "No HCI devices found"
fi
EOF

chmod +x activate-bluetooth.sh

echo ""
echo "✓ Raspberry Pi Zero W setup complete!"
echo ""
echo "Next steps:"
echo "1. Reboot your Pi: sudo reboot"
echo "2. After reboot, test Bluetooth: sudo hciconfig"
echo "3. Install Node.js and npm if not already installed"
echo "4. Run: npm install"
echo "5. Start the application: ./start.sh"
echo ""
echo "Note: A reboot is recommended for all changes to take effect."
