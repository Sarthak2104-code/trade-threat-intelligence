"""
Trades API Endpoints
Handle trade data ingestion, streaming, and retrieval
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
import pandas as pd
from datetime import datetime
import os

router = APIRouter()


class TradeData(BaseModel):
    """Trade data model"""
    timestamp: str
    instrument: str
    ltp: float
    volume: int
    bid1_price: float
    bid1_qty: int
    ask1_price: float
    ask1_qty: int


class IngestRequest(BaseModel):
    """Request model for data ingestion"""
    file_path: str
    instrument_id: Optional[str] = None


@router.post("/ingest")
async def ingest_trade_data(request: IngestRequest):
    """
    Ingest trade data from CSV file
    
    - **file_path**: Path to CSV file
    - **instrument_id**: Optional instrument ID filter
    """
    try:
        # Validate file exists
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Load data
        df = pd.read_csv(request.file_path)
        
        # Filter by instrument if provided
        if request.instrument_id:
            df = df[df['instrument'].str.contains(request.instrument_id)]
        
        # Convert timestamp
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Basic statistics
        stats = {
            "total_records": len(df),
            "instruments": df['instrument'].nunique(),
            "time_range": {
                "start": df['timestamp'].min().isoformat(),
                "end": df['timestamp'].max().isoformat()
            },
            "volume_stats": {
                "total": df['volume'].sum(),
                "avg": df['volume'].mean(),
                "max": df['volume'].max()
            }
        }
        
        return {
            "status": "success",
            "message": f"Successfully ingested {len(df)} records",
            "stats": stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/instruments")
async def list_instruments():
    """List all available instruments from datasets"""
    datasets_dir = "../datasets"
    instruments = []
    
    try:
        if os.path.exists(datasets_dir):
            for file in os.listdir(datasets_dir):
                if file.endswith('.csv') and file != 'README.md':
                    instrument_id = file.replace('.csv', '')
                    instruments.append({
                        "instrument_id": instrument_id,
                        "file": file,
                        "exchange": "NSE_EQ"
                    })
        
        return {
            "status": "success",
            "count": len(instruments),
            "instruments": instruments
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{instrument_id}")
async def get_trader_history(
    instrument_id: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    limit: int = Query(100, ge=1, le=10000)
):
    """
    Get trade history for a specific instrument
    
    - **instrument_id**: Instrument identifier
    - **start_time**: Optional start time filter
    - **end_time**: Optional end time filter
    - **limit**: Maximum number of records to return
    """
    try:
        # Find the dataset file
        datasets_dir = "../datasets"
        file_path = os.path.join(datasets_dir, f"{instrument_id}.csv")
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Instrument not found")
        
        # Load data
        df = pd.read_csv(file_path)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Apply time filters
        if start_time:
            df = df[df['timestamp'] >= pd.to_datetime(start_time)]
        if end_time:
            df = df[df['timestamp'] <= pd.to_datetime(end_time)]
        
        # Limit results
        df = df.head(limit)
        
        # Convert to list of dicts
        trades = df.to_dict('records')
        
        return {
            "status": "success",
            "instrument_id": instrument_id,
            "count": len(trades),
            "trades": trades
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stream/{instrument_id}")
async def get_stream_info(instrument_id: str):
    """
    Get streaming information for an instrument
    
    - **instrument_id**: Instrument identifier
    """
    return {
        "status": "success",
        "instrument_id": instrument_id,
        "websocket_endpoint": f"/ws/market-data",
        "message": "Connect to WebSocket endpoint for real-time streaming",
        "subscription_format": {
            "action": "subscribe",
            "instrument": instrument_id
        }
    }
