"""
Pattern Detection API Endpoints
Handle suspicious pattern detection, alert generation, incidents, policies, events and trader profiles
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum
import datetime
from sqlalchemy.orm import Session
from db import (
    get_db, 
    get_db_connection,
    Trader as DBTrader, 
    Incident as DBIncident, 
    Event as DBEvent, 
    Policy as DBPolicy, 
    AnomalyInjection as DBAnomalyInjection
)

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


# --- Pydantic Models for CRUD ---

class TraderCreate(BaseModel):
    trader_id: str
    name: str
    role: str
    sector: str
    status: Optional[str] = "ACTIVE"

    class Config:
        orm_mode = True
        from_attributes = True


class TraderUpdate(BaseModel):
    name: str
    role: str
    sector: str
    status: Optional[str] = "ACTIVE"

    class Config:
        orm_mode = True
        from_attributes = True


class IncidentCreate(BaseModel):
    id: str
    symbol: str
    pattern: str
    severity: str
    timestamp: str
    status: str
    confidence: float
    evidence: str
    rca: Optional[str] = None
    report_content: Optional[str] = None


class IncidentStatusUpdate(BaseModel):
    status: str


class EventSchema(BaseModel):
    id: Optional[int] = None
    timestamp: str
    message: str


class EventCreate(BaseModel):
    message: str


class PolicySchema(BaseModel):
    id: str
    name: str
    pattern: str
    severity: str
    action: str
    channels: List[str]
    enabled: bool


class PolicyCreate(BaseModel):
    id: str
    name: str
    pattern: str
    severity: str
    action: str
    channels: List[str]
    enabled: bool


class PolicyUpdate(BaseModel):
    name: str
    pattern: str
    severity: str
    action: str
    channels: List[str]
    enabled: bool


class BulkDeleteRequest(BaseModel):
    ids: List[str]


class BulkImportRequest(BaseModel):
    policies: List[PolicyCreate]


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
    timestamp: Optional[str] = None


# --- Pattern Detection Endpoints ---

@router.post("/analyze")
async def run_pattern_detection(request: DetectionRequest):
    """Run pattern detection on trade data"""
    try:
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
    """List detected suspicious patterns"""
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
    """Get flagged alerts from pattern detection"""
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
    """Configure detection parameters for a specific pattern"""
    return {
        "status": "success",
        "pattern_type": pattern_type,
        "message": f"Configuration updated for {pattern_type}",
        "config": config
    }


# --- Trader Profile CRUD Endpoints ---

@router.get("/traders", response_model=List[TraderCreate])
async def list_traders(db: Session = Depends(get_db)):
    """List all available trader profiles"""
    return db.query(DBTrader).all()


@router.post("/traders")
async def create_trader(trader: TraderCreate, db: Session = Depends(get_db)):
    """Create a new trader profile"""
    db_trader = db.query(DBTrader).filter(DBTrader.trader_id == trader.trader_id).first()
    if db_trader:
        raise HTTPException(status_code=400, detail="Trader ID already exists")
    new_trader = DBTrader(**trader.dict())
    db.add(new_trader)
    db.commit()
    return {"status": "success", "message": "Trader profile created successfully"}


@router.put("/traders/{trader_id}")
async def update_trader(trader_id: str, trader: TraderUpdate, db: Session = Depends(get_db)):
    """Update an existing trader profile"""
    db_trader = db.query(DBTrader).filter(DBTrader.trader_id == trader_id).first()
    if not db_trader:
        raise HTTPException(status_code=404, detail="Trader profile not found")
    db_trader.name = trader.name
    db_trader.role = trader.role
    db_trader.sector = trader.sector
    db_trader.status = trader.status
    db.commit()
    return {"status": "success", "message": "Trader profile updated successfully"}


@router.delete("/traders/{trader_id}")
async def delete_trader(trader_id: str, db: Session = Depends(get_db)):
    """Delete a trader profile"""
    db_trader = db.query(DBTrader).filter(DBTrader.trader_id == trader_id).first()
    if not db_trader:
        raise HTTPException(status_code=404, detail="Trader profile not found")
    db.delete(db_trader)
    db.commit()
    return {"status": "success", "message": "Trader profile deleted successfully"}


# --- Incident CRUD Endpoints ---

@router.get("/incidents", response_model=List[IncidentCreate])
async def list_incidents(db: Session = Depends(get_db)):
    """List all surveillance incidents"""
    return db.query(DBIncident).all()


@router.post("/incidents", response_model=IncidentCreate)
async def create_incident(incident: IncidentCreate, db: Session = Depends(get_db)):
    """Create a new incident"""
    db_incident = db.query(DBIncident).filter(DBIncident.id == incident.id).first()
    if db_incident:
        raise HTTPException(status_code=400, detail="Incident ID already exists")
    new_incident = DBIncident(**incident.dict())
    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)

    # Trigger policies and alert channels dispatch
    try:
        from api.v1.endpoints.channels import trigger_policy_alerts
        await trigger_policy_alerts(
            incident_id=new_incident.id,
            symbol=new_incident.symbol,
            pattern=new_incident.pattern,
            severity=new_incident.severity,
            evidence=new_incident.evidence,
            db=db
        )
        db.refresh(new_incident)
    except Exception as e:
        # Don't fail incident creation if alert dispatch fails, just log it
        import logging
        logging.getLogger(__name__).error(f"Error triggering policies for incident {new_incident.id}: {e}")

    return new_incident


@router.put("/incidents/{incident_id}", response_model=IncidentCreate)
async def update_incident_status(incident_id: str, payload: IncidentStatusUpdate, db: Session = Depends(get_db)):
    """Update surveillance incident status"""
    db_incident = db.query(DBIncident).filter(DBIncident.id == incident_id).first()
    if not db_incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    db_incident.status = payload.status
    db.commit()
    db.refresh(db_incident)
    return db_incident


@router.delete("/incidents/{incident_id}")
async def delete_incident(incident_id: str, db: Session = Depends(get_db)):
    """Delete an incident and its associated anomaly injection if applicable"""
    db_incident = db.query(DBIncident).filter(DBIncident.id == incident_id).first()
    if not db_incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Delete associated anomaly injection if created via threat injector
    if incident_id.startswith("INC-INJECT-"):
        try:
            inj_id = int(incident_id.split("INC-INJECT-")[1])
            db.query(DBAnomalyInjection).filter(DBAnomalyInjection.id == inj_id).delete(synchronize_session=False)
        except ValueError:
            pass

    db.delete(db_incident)
    db.commit()
    return {"status": "success", "message": "Incident deleted successfully"}


@router.post("/incidents/bulk-delete")
async def bulk_delete_incidents(payload: BulkDeleteRequest, db: Session = Depends(get_db)):
    """Bulk delete incidents and their associated anomaly injections if applicable"""
    injection_ids = []
    for inc_id in payload.ids:
        if inc_id.startswith("INC-INJECT-"):
            try:
                inj_id = int(inc_id.split("INC-INJECT-")[1])
                injection_ids.append(inj_id)
            except ValueError:
                pass
                
    if injection_ids:
        db.query(DBAnomalyInjection).filter(DBAnomalyInjection.id.in_(injection_ids)).delete(synchronize_session=False)

    deleted_count = db.query(DBIncident).filter(DBIncident.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "message": f"Successfully deleted {deleted_count} incidents"}


# --- Event / Audit Console Endpoints ---

@router.get("/events", response_model=List[EventSchema])
async def list_events(db: Session = Depends(get_db)):
    """Get audit logs and security console events"""
    return db.query(DBEvent).order_by(DBEvent.id.asc()).all()


@router.post("/events", response_model=EventSchema)
async def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    """Log a new security console event"""
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_event = DBEvent(timestamp=now_str, message=payload.message)
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event


# --- Policy Management CRUD Endpoints ---

@router.get("/policies", response_model=List[PolicySchema])
async def list_policies(db: Session = Depends(get_db)):
    """List all active/inactive compliance policy rules"""
    db_policies = db.query(DBPolicy).all()
    policies = []
    for p in db_policies:
        channels_list = [c.strip() for c in p.channels.split(",")] if p.channels else []
        policies.append(
            PolicySchema(
                id=p.id,
                name=p.name,
                pattern=p.pattern,
                severity=p.severity,
                action=p.action,
                channels=channels_list,
                enabled=p.enabled
            )
        )
    return policies


@router.post("/policies", response_model=PolicySchema)
async def create_policy(policy: PolicyCreate, db: Session = Depends(get_db)):
    """Create a new compliance policy rule"""
    db_policy = db.query(DBPolicy).filter(DBPolicy.id == policy.id).first()
    if db_policy:
        raise HTTPException(status_code=400, detail="Policy ID already exists")
    new_policy = DBPolicy(
        id=policy.id,
        name=policy.name,
        pattern=policy.pattern,
        severity=policy.severity,
        action=policy.action,
        channels=",".join(policy.channels),
        enabled=policy.enabled
    )
    db.add(new_policy)
    db.commit()
    return PolicySchema(
        id=new_policy.id,
        name=new_policy.name,
        pattern=new_policy.pattern,
        severity=new_policy.severity,
        action=new_policy.action,
        channels=policy.channels,
        enabled=new_policy.enabled
    )


@router.put("/policies/{policy_id}", response_model=PolicySchema)
async def update_policy(policy_id: str, policy: PolicyUpdate, db: Session = Depends(get_db)):
    """Update an existing compliance policy rule"""
    db_policy = db.query(DBPolicy).filter(DBPolicy.id == policy_id).first()
    if not db_policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    db_policy.name = policy.name
    db_policy.pattern = policy.pattern
    db_policy.severity = policy.severity
    db_policy.action = policy.action
    db_policy.channels = ",".join(policy.channels)
    db_policy.enabled = policy.enabled
    db.commit()
    return PolicySchema(
        id=db_policy.id,
        name=db_policy.name,
        pattern=db_policy.pattern,
        severity=db_policy.severity,
        action=db_policy.action,
        channels=policy.channels,
        enabled=db_policy.enabled
    )


@router.delete("/policies/{policy_id}")
async def delete_policy(policy_id: str, db: Session = Depends(get_db)):
    """Delete a compliance policy rule"""
    db_policy = db.query(DBPolicy).filter(DBPolicy.id == policy_id).first()
    if not db_policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(db_policy)
    db.commit()
    return {"status": "success", "message": "Policy deleted successfully"}


@router.post("/policies/bulk-delete")
async def bulk_delete_policies(payload: BulkDeleteRequest, db: Session = Depends(get_db)):
    """Bulk delete compliance policy rules"""
    deleted_count = db.query(DBPolicy).filter(DBPolicy.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "message": f"Successfully deleted {deleted_count} policies"}


@router.post("/policies/bulk-import")
async def bulk_import_policies(payload: BulkImportRequest, db: Session = Depends(get_db)):
    """Bulk import/restore compliance policy rules"""
    imported_count = 0
    for p in payload.policies:
        db_policy = db.query(DBPolicy).filter(DBPolicy.id == p.id).first()
        if db_policy:
            db_policy.name = p.name
            db_policy.pattern = p.pattern
            db_policy.severity = p.severity
            db_policy.action = p.action
            db_policy.channels = ",".join(p.channels)
            db_policy.enabled = p.enabled
        else:
            new_policy = DBPolicy(
                id=p.id,
                name=p.name,
                pattern=p.pattern,
                severity=p.severity,
                action=p.action,
                channels=",".join(p.channels),
                enabled=p.enabled
            )
            db.add(new_policy)
        imported_count += 1
    db.commit()
    return {"status": "success", "message": f"Successfully imported {imported_count} policies"}


# --- Anomaly Scenario Injection Endpoints ---

@router.post("/inject")
async def inject_anomaly(request: InjectionRequest, db: Session = Depends(get_db)):
    """
    Log an anomaly injection in SQLite database for auditing and accountability,
    and automatically register a surveillance incident.
    """
    try:
        timestamp = request.timestamp
        if timestamp:
            timestamp = timestamp.replace("T", " ").replace("Z", "")
            if len(timestamp) > 19:
                timestamp = timestamp[:19]
        else:
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        new_injection = DBAnomalyInjection(
            timestamp=timestamp,
            trader_id=request.trader_id,
            trader_name=request.trader_name,
            instrument=request.instrument,
            pattern_type=request.pattern_type,
            severity=request.severity,
            confidence=request.confidence,
            cancel_ratio=request.cancel_ratio,
            cancel_time_median=request.cancel_time_median,
            order_count=request.order_count,
            price_impact=request.price_impact,
            description=request.description
        )
        db.add(new_injection)
        db.commit()
        db.refresh(new_injection)
        injection_id = new_injection.id
        
        # Automatically insert into incidents table to sync dynamic views
        incident_id = f"INC-INJECT-{injection_id}"
        pattern_display = request.pattern_type.replace('_', ' ').title()
        
        isin_map = {
            "INE002A01018": "RELIANCE",
            "INE040A01034": "HDFCBANK",
            "INE090A01021": "ICICIBANK",
            "INE018A01030": "LT",
            "INE670A01012": "TATAELXSI",
            "INE030A01027": "HINDUNILVR",
            "INE044A01036": "SUNPHARMA"
        }
        resolved_symbol = isin_map.get(request.instrument, request.instrument)
        if resolved_symbol and "|" in resolved_symbol:
            resolved_symbol = resolved_symbol.split("|")[-1]
        
        new_incident = DBIncident(
            id=incident_id,
            symbol=resolved_symbol,
            pattern=pattern_display,
            severity=request.severity,
            timestamp=timestamp,
            status="PENDING",
            confidence=request.confidence,
            evidence=request.description
        )
        db.add(new_incident)
        
        # Automatically insert a security log event
        new_event = DBEvent(
            timestamp=timestamp,
            message=f"Rogue threat injection detected: {pattern_display} by {request.trader_name} on {request.instrument}"
        )
        db.add(new_event)
        db.commit()
        
        # Trigger policy alerts
        try:
            from api.v1.endpoints.channels import trigger_policy_alerts
            await trigger_policy_alerts(
                incident_id=incident_id,
                symbol=request.instrument,
                pattern=pattern_display,
                severity=request.severity,
                evidence=request.description,
                db=db
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error triggering policies for injected incident {incident_id}: {e}")
        
        return {
            "status": "success",
            "injection_id": injection_id,
            "incident_id": incident_id,
            "timestamp": timestamp,
            "message": f"Threat scenario registered under incident ID {incident_id} for {request.trader_name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log injection: {str(e)}")


@router.get("/injections")
async def list_injections(limit: int = 100, db: Session = Depends(get_db)):
    """Get history of threat scenario injections for audit accountability"""
    try:
        injections = db.query(DBAnomalyInjection).order_by(DBAnomalyInjection.id.desc()).limit(limit).all()
        return [
            {
                "id": i.id,
                "timestamp": i.timestamp,
                "trader_id": i.trader_id,
                "trader_name": i.trader_name,
                "instrument": i.instrument,
                "pattern_type": i.pattern_type,
                "severity": i.severity,
                "confidence": i.confidence,
                "cancel_ratio": i.cancel_ratio,
                "cancel_time_median": i.cancel_time_median,
                "order_count": i.order_count,
                "price_impact": i.price_impact,
                "description": i.description
            }
            for i in injections
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
