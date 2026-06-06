#!/bin/bash

# Trade Threat Intelligence Backend Startup Script

echo "🚀 Starting Trade Threat Intelligence Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies if requirements.txt has changed
echo "Checking dependencies..."
pip install -q -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "Please edit .env file with your configuration before running the backend."
fi

# Start the backend
echo "Starting FastAPI server on http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""
uvicorn main:app --reload --host 0.0.0.0 --port 8000
