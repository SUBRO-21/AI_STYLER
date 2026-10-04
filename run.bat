@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   AI Wardrobe & Outfit Stylist (Local)
echo ===================================================

if not exist "venv\Scripts\python.exe" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo Error: Python is not installed or not in PATH.
        pause
        exit /b 1
    )
)

echo [2/3] Activating virtual environment & checking dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet

echo [3/3] Launching AI Stylist at http://localhost:8000 ...
python main.py
pause
