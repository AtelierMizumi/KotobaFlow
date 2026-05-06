#!/bin/bash
# =============================================================================
# KotobaFlow — Docker & Environment Setup Script
# Automates the installation of Docker, Docker Compose, and NVIDIA runtime.
# Supports: Ubuntu/Debian, Arch Linux.
# =============================================================================

set -euo pipefail

# Require root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo or as root."
  exit 1
fi

echo "============================================="
echo "  KotobaFlow — Docker Environment Setup"
echo "============================================="
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "Cannot detect OS. /etc/os-release is missing."
    exit 1
fi

echo "[1/4] Checking OS... Detected: $OS"

# 1. Install Docker & Docker Compose
echo "[2/4] Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "  → Docker not found. Installing..."
    if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
        apt-get update
        apt-get install -y ca-certificates curl gnupg
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $VERSION_CODENAME stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        apt-get update
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    elif [[ "$OS" == "arch" ]]; then
        pacman -Sy --noconfirm docker docker-compose
    else
        echo "Unsupported OS for automatic Docker installation: $OS"
        echo "Please install Docker manually and rerun."
        exit 1
    fi
else
    echo "  ✓ Docker is already installed."
fi

# Enable and start docker
systemctl enable --now docker

# 2. Setup user group
echo "[3/4] Configuring Docker permissions..."
if [ -n "${SUDO_USER:-}" ]; then
    usermod -aG docker "$SUDO_USER"
    echo "  ✓ Added user $SUDO_USER to the 'docker' group. (You may need to log out and log back in for this to take effect)."
else
    echo "  ⚠ Not run via sudo (or SUDO_USER not set). Skipping user group config."
fi

# 3. Check for NVIDIA GPU and setup Container Toolkit
echo "[4/4] Checking for NVIDIA GPU..."
if command -v lspci &> /dev/null && lspci | grep -i "nvidia" &> /dev/null; then
    echo "  → NVIDIA GPU detected."
    if ! command -v nvidia-ctk &> /dev/null; then
        echo "  → nvidia-container-toolkit not found. Installing..."
        if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
            curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
            curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
            apt-get update
            apt-get install -y nvidia-container-toolkit
        elif [[ "$OS" == "arch" ]]; then
            pacman -Sy --noconfirm nvidia-container-toolkit
        else
            echo "  ⚠ Unsupported OS for automatic nvidia-container-toolkit installation."
        fi
    else
        echo "  ✓ nvidia-container-toolkit is already installed."
    fi

    # Configure docker runtime
    if command -v nvidia-ctk &> /dev/null; then
        echo "  → Configuring NVIDIA runtime for Docker..."
        nvidia-ctk runtime configure --runtime=docker
        systemctl restart docker
        echo "  ✓ NVIDIA runtime configured successfully."
    fi
else
    echo "  ✓ No NVIDIA GPU detected. Skipping NVIDIA toolkit setup."
fi

echo ""
echo "============================================="
echo "  Environment Setup Complete!"
echo "  Note: If your user was added to the docker group,"
echo "  please log out and log back in to apply changes."
echo "============================================="
