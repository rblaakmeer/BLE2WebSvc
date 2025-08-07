#!/bin/bash

echo "Activating Bluetooth on Raspberry Pi Zero W..."

# Check if we're running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    # Running as root, call the setup script directly
    if [ -f "/usr/local/bin/pi-bluetooth-setup" ]; then
        /usr/local/bin/pi-bluetooth-setup
    else
        echo "Pi Bluetooth setup script not found. Using basic activation..."
        # Basic activation fallback
        systemctl start bluetooth 2>/dev/null || true
        sleep 1
        if [ -e /dev/ttyAMA0 ]; then
            /usr/bin/hciattach /dev/ttyAMA0 bcm43xx 921600 noflow - 2>/dev/null || true
            sleep 1
        fi
        hciconfig hci0 up 2>/dev/null || true
    fi
else
    # Not root, try with sudo
    if command -v sudo >/dev/null 2>&1; then
        echo "Running Bluetooth setup with sudo..."
        if [ -f "/usr/local/bin/pi-bluetooth-setup" ]; then
            sudo /usr/local/bin/pi-bluetooth-setup
        else
            echo "Pi setup script not found. Using basic activation..."
            sudo systemctl start bluetooth 2>/dev/null || true
            sleep 1
            if [ -e /dev/ttyAMA0 ]; then
                sudo /usr/bin/hciattach /dev/ttyAMA0 bcm43xx 921600 noflow - 2>/dev/null || true
                sleep 1
            fi
            sudo hciconfig hci0 up 2>/dev/null || true
        fi
    else
        echo "Warning: Not running as root and sudo not available"
        echo "Attempting basic Bluetooth activation..."
        
        # Try basic activation without sudo
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
echo "Checking Bluetooth status..."
if hciconfig hci0 2>/dev/null | grep -q "UP RUNNING"; then
    echo "✓ Bluetooth is active and running"
    echo "HCI devices:"
    hciconfig hci0 2>/dev/null || echo "Could not get HCI info"
else
    echo "⚠ Bluetooth may not be fully activated"
    echo "Current HCI status:"
    hciconfig 2>/dev/null || echo "No HCI devices found"
    echo ""
    echo "If Bluetooth is not working:"
    echo "1. Make sure you've run: sudo ./setup-pi.sh"
    echo "2. Reboot your Pi: sudo reboot"
    echo "3. Check Bluetooth service: sudo systemctl status bluetooth"
fi
