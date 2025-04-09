#!/bin/bash

# Create virtual environment if it doesn't exist
if [ ! -d "env" ]; then
    echo "Creating virtual environment..."
    python3 -m venv env/

    # Activate virtual environment
    source env/bin/activate

    # Install backend requirements
    echo "Installing backend Python dependencies..."
    pip install --upgrade pip
    pip install -r backend/requirements.txt

    deactivate
else
    echo "Using existing virtual environment..."
fi

# Activate virtual environment
source env/bin/activate  

# Function to clean up on exit or interrupt
cleanup() {
    echo -e "\nShutting down..."

    # Kill background processes
    kill $BACK_PID $FRONT_PID 2>/dev/null

    # Deactivate virtual environment
    deactivate

    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM to run cleanup
trap cleanup SIGINT SIGTERM

# Start backend
echo "Starting backend..."
cd backend
uvicorn transcribe:app --reload &
BACK_PID=$!
cd ..

# Start frontend
echo "Starting frontend..."
cd frontend
npm install
npm run dev &
FRONT_PID=$!
cd ..

# Wait a bit for servers to start
sleep 5

# Open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:5173
else
    xdg-open http://localhost:5173
fi

# Wait for both to exit, or trigger cleanup on interrupt
wait $BACK_PID $FRONT_PID
cleanup  # Also call it if both processes end naturally
