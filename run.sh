#!/usr/bin/env bash
cd "$(dirname "$0")"

echo "==================================================="
echo "  AI Wardrobe & Outfit Stylist (Local)"
echo "==================================================="

if [ ! -f "venv/bin/python" ]; then
    echo "[1/3] Creating virtual environment..."
    python3 -m venv venv || { echo "Error: python3-venv is required."; exit 1; }
fi

echo "[2/3] Activating virtual environment & checking dependencies..."
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "[3/3] Launching AI Stylist at http://localhost:8000 ..."
python main.py
