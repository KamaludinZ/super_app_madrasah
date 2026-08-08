#!/bin/bash
# Script untuk install fonts yang diperlukan untuk QR card generation
# Jalankan script ini di production server sebelum menjalankan aplikasi

set -e

echo "==================================="
echo "Font Installation Script"
echo "==================================="

FONTS_DIR="$(dirname "$0")/fonts"
mkdir -p "$FONTS_DIR"

# Function to download DejaVu fonts
download_dejavu() {
    echo "Downloading DejaVu Sans fonts..."

    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    # Download DejaVu fonts
    wget -q https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.tar.bz2

    # Extract
    tar -xjf dejavu-fonts-ttf-2.37.tar.bz2

    # Copy required fonts
    cp dejavu-fonts-ttf-2.37/ttf/DejaVuSans.ttf "$FONTS_DIR/"
    cp dejavu-fonts-ttf-2.37/ttf/DejaVuSans-Bold.ttf "$FONTS_DIR/"

    # Cleanup
    cd -
    rm -rf "$TEMP_DIR"

    echo "✓ DejaVu fonts downloaded successfully"
}

# Check if fonts already exist
if [ -f "$FONTS_DIR/DejaVuSans.ttf" ] && [ -f "$FONTS_DIR/DejaVuSans-Bold.ttf" ]; then
    echo "✓ DejaVu fonts already exist in $FONTS_DIR"
elif [ -f "$FONTS_DIR/Arial.ttf" ] && [ -f "$FONTS_DIR/Arial-Bold.ttf" ]; then
    echo "✓ Arial fonts already exist in $FONTS_DIR"
else
    echo "Fonts not found. Attempting to download..."

    if command -v wget &> /dev/null; then
        download_dejavu
    else
        echo "WARNING: wget not found. Cannot download fonts automatically."
        echo ""
        echo "Please install fonts manually:"
        echo "  Option 1: Install system fonts"
        echo "    Ubuntu/Debian: sudo apt-get install fonts-dejavu-core"
        echo "    CentOS/RHEL:   sudo yum install dejavu-sans-fonts"
        echo ""
        echo "  Option 2: Download and copy fonts to $FONTS_DIR/"
        echo "    - DejaVuSans.ttf"
        echo "    - DejaVuSans-Bold.ttf"
        echo ""
        exit 1
    fi
fi

# Verify fonts are accessible
echo ""
echo "Verifying fonts..."
ls -lh "$FONTS_DIR"/*.ttf 2>/dev/null || {
    echo "ERROR: No .ttf fonts found in $FONTS_DIR"
    exit 1
}

echo ""
echo "✓ Font installation complete!"
echo ""
echo "To install system fonts (alternative method):"
echo "  Ubuntu/Debian: sudo apt-get install fonts-dejavu-core fonts-liberation"
echo "  CentOS/RHEL:   sudo yum install dejavu-sans-fonts liberation-fonts"
