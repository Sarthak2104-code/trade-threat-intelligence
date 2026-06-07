"""
FastAPI Backend - Trade Threat Intelligence System
API Gateway and Orchestrator for Trade Surveillance & Alert Triage
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from typing import List, Dict, Optional
import json
import os
import asyncio
import pandas as pd
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global state for WebSocket connections
active_connections: List[WebSocket] = []


from db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events"""
    logger.info("Starting Trade Threat Intelligence Backend")
    try:
        init_db()
        logger.info("SQLite database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing SQLite database: {e}")
    yield
    logger.info("Shutting down Trade Threat Intelligence Backend")
    # Shutdown logic here (e.g., close connections)


# Create FastAPI application
app = FastAPI(
    title="Trade Threat Intelligence API",
    description="AI-powered Trade Surveillance & Alert Triage Engine",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://10.10.50.157:5173",
        "http://localhost:3000",
        "http://localhost:3001",
    ],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "trade-threat-intelligence-backend",
        "version": "1.0.0"
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Trade Threat Intelligence API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "api_docs": "/docs",
            "trades": "/api/v1/trades",
            "detection": "/api/v1/detect",
            "triage": "/api/v1/triage",
            "graph": "/api/v1/graph",
            "risk": "/api/v1/risk",
            "workflows": "/api/v1/workflows",
            "investigation": "/api/v1/investigation",
            "websocket": "/ws/market-data"
        }
    }


# Cache for datasets to avoid slow file reads
datasets_cache: Dict[str, List[dict]] = {}
active_streams: Dict[WebSocket, asyncio.Task] = {}

def get_dataset(instrument_id: str) -> List[dict]:
    clean_id = instrument_id.split("|")[-1]
    if clean_id not in datasets_cache:
        datasets_dir = "../datasets"
        file_path = os.path.join(datasets_dir, f"{clean_id}.csv")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dataset not found for {instrument_id} (searched {file_path})")
        
        logger.info(f"Loading dataset {file_path} into memory...")
        df = pd.read_csv(file_path)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        datasets_cache[clean_id] = df.to_dict('records')
        logger.info(f"Successfully loaded {len(datasets_cache[clean_id])} records for {clean_id}")
    return datasets_cache[clean_id]


async def stream_data(websocket: WebSocket, instrument_id: str, speed_multiplier: float = 10.0, start_after: Optional[str] = None):
    try:
        records = get_dataset(instrument_id)
    except Exception as e:
        logger.error(f"Error loading dataset: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
        return

    logger.info(f"Started streaming {len(records)} ticks for {instrument_id} at {speed_multiplier}x speed (start_after: {start_after})")
    
    start_index = 0
    if start_after:
        try:
            start_dt = pd.to_datetime(start_after)
            for idx, record in enumerate(records):
                rec_dt = pd.to_datetime(record['timestamp'])
                if rec_dt > start_dt:
                    start_index = idx
                    break
            else:
                start_index = len(records)
        except Exception as e:
            logger.error(f"Error parsing start_after {start_after}: {e}")

    records_to_stream = records[start_index:]
    logger.info(f"Streaming {len(records_to_stream)} records starting from index {start_index}")
    
    previous_timestamp = None
    for record in records_to_stream:
        # Format timestamps as strings for JSON serialization
        if hasattr(record['timestamp'], 'isoformat'):
            record_str_time = record['timestamp'].isoformat()
        else:
            record_str_time = str(record['timestamp'])
            
        system_time = record.get('timestamp_system')
        if system_time and hasattr(system_time, 'isoformat'):
            record['timestamp_system'] = system_time.isoformat()
            
        record['timestamp'] = record_str_time
        
        # Calculate delay based on time difference between ticks
        current_timestamp = pd.to_datetime(record_str_time)
        if previous_timestamp is not None:
            time_diff = (current_timestamp - previous_timestamp).total_seconds()
            if time_diff > 0:
                sleep_time = time_diff / speed_multiplier
                # Limit max sleep to 2 seconds to keep UI responsive and stream moving
                sleep_time = min(sleep_time, 2.0)
                await asyncio.sleep(sleep_time)
        
        previous_timestamp = current_timestamp
        
        try:
            await websocket.send_json({
                "type": "tick",
                "instrument": instrument_id,
                "data": record
            })
        except Exception as e:
            logger.error(f"Error sending tick: {e}")
            break


# WebSocket endpoint for real-time market data streaming
@app.websocket("/ws/market-data")
async def websocket_market_data(websocket: WebSocket):
    """WebSocket endpoint for streaming real-time market data"""
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"WebSocket connection established. Total connections: {len(active_connections)}")
    
    try:
        while True:
            # Receive data from client
            data = await websocket.receive_text()
            message = json.loads(data)
            action = message.get("action")
            
            if action == "subscribe":
                instrument = message.get("instrument")
                speed = float(message.get("speed", 10.0))
                start_after = message.get("start_after")
                logger.info(f"Client subscribed to {instrument} at speed {speed} starting after {start_after}")
                
                # Cancel existing stream for this socket if any
                if websocket in active_streams:
                    active_streams[websocket].cancel()
                    
                # Start streaming tasks
                task = asyncio.create_task(stream_data(websocket, instrument, speed, start_after))
                active_streams[websocket] = task
                
                await websocket.send_json({
                    "type": "subscription",
                    "instrument": instrument,
                    "status": "subscribed",
                    "speed": speed
                })
            
            elif action == "unsubscribe":
                instrument = message.get("instrument")
                logger.info(f"Client unsubscribed from {instrument}")
                if websocket in active_streams:
                    active_streams[websocket].cancel()
                    del active_streams[websocket]
                await websocket.send_json({
                    "type": "subscription",
                    "instrument": instrument,
                    "status": "unsubscribed"
                })
            
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        if websocket in active_streams:
            active_streams[websocket].cancel()
            del active_streams[websocket]
        logger.info(f"WebSocket connection cleaned up. Total connections: {len(active_connections)}")


# API Routers
from api.v1.endpoints import trades, detection, triage, workflows

app.include_router(trades.router, prefix="/api/v1/trades", tags=["Trades"])
app.include_router(detection.router, prefix="/api/v1/detect", tags=["Detection"])
app.include_router(triage.router, prefix="/api/v1/triage", tags=["Triage"])
app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["Workflows"])

# Additional routers to be implemented
# app.include_router(graph.router, prefix="/api/v1/graph", tags=["Graph"])
# app.include_router(risk.router, prefix="/api/v1/risk", tags=["Risk"])
# app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["Workflows"])
# app.include_router(investigation.router, prefix="/api/v1/investigation", tags=["Investigation"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
