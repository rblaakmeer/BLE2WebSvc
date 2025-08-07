#!/bin/bash

echo "Installing Node.js on Raspberry Pi Zero W..."

# Check if Node.js is already installed
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "Node.js is already installed: $NODE_VERSION"
    echo "If you want to update, this script will install the latest LTS version."
    read -p "Continue with installation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
fi

# Update package list
echo "Updating package list..."
sudo apt update

# Install curl if not present
if ! command -v curl >/dev/null 2>&1; then
    echo "Installing curl..."
    sudo apt install -y curl
fi

# Install Node.js using NodeSource repository
echo "Adding NodeSource repository..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

echo "Installing Node.js..."
sudo apt-get install -y nodejs

# Verify installation
echo ""
echo "Installation complete!"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Check if we need to fix npm permissions
echo ""
echo "Checking npm permissions..."
NPM_PREFIX=$(npm config get prefix)
if [[ "$NPM_PREFIX" == "/usr" ]]; then
    echo "Setting up npm for user installation..."
    mkdir -p ~/.npm-global
    npm config set prefix '~/.npm-global'
    
    # Add to PATH if not already there
    if ! grep -q 'export PATH=~/.npm-global/bin:$PATH' ~/.bashrc; then
        echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
        echo "Added npm global bin to PATH in ~/.bashrc"
        echo "Run 'source ~/.bashrc' or restart your terminal to apply changes"
    fi
fi

echo ""
echo "✓ Node.js installation complete!"
echo ""
echo "Next steps:"
echo "1. If PATH was updated, run: source ~/.bashrc"
echo "2. Navigate to your BLE2WebSvc directory"
echo "3. Run: npm install"
echo "4. Run the Pi setup: sudo ./setup-pi.sh"
