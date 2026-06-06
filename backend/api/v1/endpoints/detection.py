"""
Pattern Detection API Endpoints
Handle suspicious pattern detection and alert generation
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum

router = APIRouter()


class PatternType(str, Enum):
    """Types of suspicious patterns"""
    LAYERING = "layering"
    SPOOFING = "spoofing"
    WASH_TRADING = "wash_trading"
    PUMP_DUMP = "pump_dump"
    INSIDER_TRADING = "insider_trading"
    QUOTE_STUFFING = "quote_stuffing"


class Severity(str, Enum):
    """Severity levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class DetectedPattern(BaseModel):
    """Detected pattern model"""
    pattern_type: PatternType
    severity: Severity
    confidence: float
    instrument: str
    timestamp: str
    trader_id: Optional[str] = None
    evidence: dict
    description: str


class DetectionRequest(BaseModel):
    """Request model for pattern detection"""
    instrument_id: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    patterns: Optional[List[PatternType]] = None


@router.post("/analyze")
async def run_pattern_detection(request: DetectionRequest):
    """
    Run pattern detection on trade data
    
    - **instrument_id**: Instrument to analyze
    - **start_time**: Optional start time
    - **end_time**: Optional end time
    - **patterns**: Optional list of patterns to detect
    """
    try:
        # TODO: Implement actual pattern detection logic
        # This is a placeholder that returns mock data
        
        mock_patterns = [
            {
                "pattern_type": "layering",
                "severity": "HIGH",
                "confidence": 0.91,
                "instrument": request.instrument_id,
                "timestamp": "2026-04-27 09:47:33",
                "evidence": {
                    "cancel_ratio": 0.857,
                    "cancel_time_median": 620,
                    "order_count": 14,
                    "price_impact": 0.018
                },
                "description": "Large visible orders inflated perceived demand, 85.7% cancellation ratio"
            }
        ]
        
        return {
            "status": "success",
            "instrument_id": request.instrument_id,
            "patterns_detected": len(mock_patterns),
            "patterns": mock_patterns
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patterns")
async def list_detected_patterns(
    instrument_id: Optional[str] = None,
    severity: Optional[Severity] = None,
    limit: int = 100
):
    """
    List detected suspicious patterns
    
    - **instrument_id**: Optional instrument filter
    - **severity**: Optional severity filter
    - **limit**: Maximum number of results
    """
    # TODO: Implement database query to fetch detected patterns
    return {
        "status": "success",
        "message": "Pattern listing endpoint - to be implemented with database",
        "filters": {
            "instrument_id": instrument_id,
            "severity": severity,
            "limit": limit
        }
    }


@router.get("/alerts")
async def get_flagged_alerts(
    instrument_id: Optional[str] = None,
    severity: Optional[Severity] = None,
    limit: int = 100
):
    """
    Get flagged alerts from pattern detection
    
    - **instrument_id**: Optional instrument filter
    - **severity**: Optional severity filter
    - **limit**: Maximum number of results
    """
    # TODO: Implement database query to fetch alerts
    return {
        "status": "success",
        "message": "Alert listing endpoint - to be implemented with database",
        "filters": {
            "instrument_id": instrument_id,
            "severity": severity,
            "limit": limit
        }
    }


@router.post("/patterns/{pattern_type}/configure")
async def configure_pattern_detection(
    pattern_type: PatternType,
    config: dict
):
    """
    Configure detection parameters for a specific pattern
    
    - **pattern_type**: Pattern to configure
    - **config**: Configuration parameters
    """
    # TODO: Implement pattern configuration storage
    return {
        "status": "success",
        "pattern_type": pattern_type,
        "message": f"Configuration updated for {pattern_type}",
        "config": config
    }


class InjectionRequest(BaseModel):
    trader_id: str
    trader_name: str
    instrument: str
    pattern_type: str
    severity: str
    confidence: float
    cancel_ratio: float
    cancel_time_median: int
    order_count: int
    price_impact: float
    description: str


from db import get_db_connection
import sys

@router.get("/traders")
async def list_traders():
    """List all available trader profiles for scenario injection"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT trader_id, name, role, sector FROM traders")
        rows = cursor.fetchall()
        traders = [
            {
                "trader_id": row["trader_id"],
                "name": row["name"],
                "role": row["role"],
                "sector": row["sector"]
            }
            for row in rows
        ]
        conn.close()
        return traders
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/inject")
async def inject_anomaly(request: InjectionRequest):
    """
    Log an anomaly injection in SQLite database for auditing and accountability
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        cursor.execute("""
            INSERT INTO anomaly_injections (
                timestamp, trader_id, trader_name, instrument, pattern_type, 
                severity, confidence, cancel_ratio, cancel_time_median, 
                order_count, price_impact, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            timestamp, request.trader_id, request.trader_name, request.instrument,
            request.pattern_type, request.severity, request.confidence,
            request.cancel_ratio, request.cancel_time_median, request.order_count,
            request.price_impact, request.description
        ))
        conn.commit()
        injection_id = cursor.lastrowid
        conn.close()
        
        return {
            "status": "success",
            "injection_id": injection_id,
            "timestamp": timestamp,
            "message": f"Threat scenario registered under incident ID ACTOR_INJECT_{injection_id} for {request.trader_name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log injection: {str(e)}")


@router.get("/injections")
async def list_injections(limit: int = 100):
    """Get history of threat scenario injections for audit accountability"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, timestamp, trader_id, trader_name, instrument, pattern_type, 
                   severity, confidence, cancel_ratio, cancel_time_median, 
                   order_count, price_impact, description 
            FROM anomaly_injections 
            ORDER BY id DESC LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        injections = [
            {
                "id": row["id"],
                "timestamp": row["timestamp"],
                "trader_id": row["trader_id"],
                "trader_name": row["trader_name"],
                "instrument": row["instrument"],
                "pattern_type": row["pattern_type"],
                "severity": row["severity"],
                "confidence": row["confidence"],
                "cancel_ratio": row["cancel_ratio"],
                "cancel_time_median": row["cancel_time_median"],
                "order_count": row["order_count"],
                "price_impact": row["price_impact"],
                "description": row["description"]
            }
            for row in rows
        ]
        conn.close()
        return injections
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
