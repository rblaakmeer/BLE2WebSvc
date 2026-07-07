#!/bin/bash

# Script to create and install systemd service for BLE2WebSvc

echo "Creating systemd service for BLE2WebSvc..."

# Get current user and working directory
CURRENT_USER=$(whoami)
CURRENT_DIR=$(pwd)
NODE_PATH=$(which node)
ENV_FILE="/etc/ble2websvc.env"

if [ -z "$NODE_PATH" ]; then
    echo "Error: Node.js not found. Please install Node.js first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "server.js" ] || [ ! -f "package.json" ]; then
    echo "Error: This script must be run from the BLE2WebSvc directory"
    echo "Make sure server.js and package.json exist in the current directory"
    exit 1
fi

generate_secret() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 32
    else
        head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
    fi
}

# Create the service file content
SERVICE_CONTENT="[Unit]
Description=BLE2WebSvc - BLE to Web Service Bridge
After=network.target bluetooth.target
Wants=bluetooth.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$CURRENT_DIR
ExecStartPre=$CURRENT_DIR/activate-bluetooth.sh
ExecStart=$NODE_PATH server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8111
EnvironmentFile=$ENV_FILE

# Bluetooth capabilities
AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN
CapabilityBoundingSet=CAP_NET_RAW CAP_NET_ADMIN

[Install]
WantedBy=multi-user.target"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo "This script needs to create a system service file."
    echo "Please run with sudo: sudo ./systemd-service.sh"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating security environment file at $ENV_FILE..."
    cat > "$ENV_FILE" << EOF
API_KEY=$(generate_secret)
MCP_TOKEN=$(generate_secret)
EOF
    chmod 600 "$ENV_FILE"
else
    echo "Using existing security environment file at $ENV_FILE"
fi

# Write the service file
echo "Creating service file at /etc/systemd/system/ble2websvc.service..."
echo "$SERVICE_CONTENT" > /etc/systemd/system/ble2websvc.service

# Set proper permissions
chmod 644 /etc/systemd/system/ble2websvc.service

# Reload systemd
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable the service
echo "Enabling ble2websvc service..."
systemctl enable ble2websvc

echo ""
echo "✓ Service created and enabled successfully!"
echo ""
echo "Service management commands:"
echo "  Start service:    sudo systemctl start ble2websvc"
echo "  Stop service:     sudo systemctl stop ble2websvc"
echo "  Restart service:  sudo systemctl restart ble2websvc"
echo "  Check status:     sudo systemctl status ble2websvc"
echo "  View logs:        sudo journalctl -u ble2websvc -f"
echo "  Disable service:  sudo systemctl disable ble2websvc"
echo ""
echo "The service will start automatically on boot."
echo "To start it now, run: sudo systemctl start ble2websvc"
echo "API_KEY and MCP_TOKEN are stored in $ENV_FILE"
