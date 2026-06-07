import sqlite3
import os
import datetime
import json
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trade_surveillance.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AlertChannel(Base):
    __tablename__ = "alert_channels"
    channel_type = Column(String, primary_key=True, index=True) # "telegram", "smtp", "jira", "teams"
    enabled = Column(Boolean, default=False)
    config = Column(Text, nullable=False) # Store config fields as JSON string

class Trader(Base):
    __tablename__ = "traders"
    trader_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String)
    sector = Column(String)
    status = Column(String, default="ACTIVE")

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(String, primary_key=True, index=True)
    symbol = Column(String, nullable=False)
    pattern = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    status = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    evidence = Column(Text)
    rca = Column(Text, nullable=True)
    report_content = Column(Text, nullable=True)

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(String, nullable=False)
    message = Column(Text, nullable=False)

class Policy(Base):
    __tablename__ = "policies"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    pattern = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    action = Column(String, nullable=False)
    channels = Column(String, nullable=False)  # Comma-separated list
    enabled = Column(Boolean, default=True)

class AnomalyInjection(Base):
    __tablename__ = "anomaly_injections"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(String, nullable=False)
    trader_id = Column(String)
    trader_name = Column(String)
    instrument = Column(String)
    pattern_type = Column(String)
    severity = Column(String)
    confidence = Column(Float)
    cancel_ratio = Column(Float)
    cancel_time_median = Column(Integer)
    order_count = Column(Integer)
    price_impact = Column(Float)
    description = Column(Text)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    # Run migrations for incidents if columns don't exist
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(incidents)")
        columns = [row[1] for row in cursor.fetchall()]
        if "rca" not in columns:
            cursor.execute("ALTER TABLE incidents ADD COLUMN rca TEXT")
        if "report_content" not in columns:
            cursor.execute("ALTER TABLE incidents ADD COLUMN report_content TEXT")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Migration error: {e}")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed traders
        if db.query(Trader).count() == 0:
            traders_data = [
                Trader(trader_id="TRADER_001", name="Aarav Sharma", role="Senior Desk Trader", sector="Energy", status="ACTIVE"),
                Trader(trader_id="TRADER_002", name="Aditya Patel", role="HFT Specialist", sector="Tech/Fin", status="ACTIVE"),
                Trader(trader_id="TRADER_003", name="Ananya Iyer", role="Arbitrage Associate", sector="Materials", status="ACTIVE"),
                Trader(trader_id="TRADER_004", name="Karan Malhotra", role="Proprietary Trader", sector="Consumer", status="ACTIVE"),
                Trader(trader_id="TRADER_005", name="Priya Rao", role="Quantitative Analyst", sector="Healthcare", status="ACTIVE")
            ]
            db.bulk_save_objects(traders_data)
            db.commit()

        # Seed incidents
        if db.query(Incident).count() == 0:
            incidents_data = [
                Incident(
                    id="INC-2026-9042",
                    symbol="LT",
                    pattern="Quote Stuffing",
                    severity="HIGH",
                    timestamp="2026-06-06 14:10:05",
                    status="ESCALATED",
                    confidence=0.88,
                    evidence="142 orders placed and cancelled in 240ms. Price pressure was created on Sell book."
                ),
                Incident(
                    id="INC-2026-8812",
                    symbol="TATAELXSI",
                    pattern="Insider Trading",
                    severity="CRITICAL",
                    timestamp="2026-06-06 15:30:12",
                    status="PENDING",
                    confidence=0.94,
                    evidence="Block transaction size +5.40 vs average 30-day baseline before corporate quarterly earnings release."
                )
            ]
            db.bulk_save_objects(incidents_data)
            db.commit()

        # Seed events
        if db.query(Event).count() == 0:
            now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            events_data = [
                Event(timestamp=now_str, message="TradeShield security core initialised"),
                Event(timestamp=now_str, message="Connection established to Market Feed on port :8000"),
                Event(timestamp=now_str, message="Real-time Pattern Recognition scanner armed")
            ]
            db.bulk_save_objects(events_data)
            db.commit()

        # Seed policies
        if db.query(Policy).count() == 0:
            policies_data = [
                Policy(id="POL-001", name="Escalate Spoofing Alert to Telegram", pattern="SPOOFING", severity="HIGH", action="ESCALATE", channels="Telegram", enabled=True),
                Policy(id="POL-002", name="Block Layering Orders & Alert Teams", pattern="LAYERING", severity="CRITICAL", action="BLOCK_ORDERS", channels="Teams,Telegram", enabled=True),
                Policy(id="POL-003", name="Throttle Quote Stuffing Rate on NSE", pattern="QUOTE_STUFFING", severity="MEDIUM", action="THROTTLE_RATE", channels="Teams", enabled=False),
                Policy(id="POL-004", name="Log Pump & Dump to External Audit DB", pattern="PUMP_DUMP", severity="LOW", action="LOG_AUDIT", channels="SMTP", enabled=True)
            ]
            db.bulk_save_objects(policies_data)
            db.commit()

        # Seed alert channels
        if db.query(AlertChannel).count() == 0:
            channels_data = [
                AlertChannel(
                    channel_type="telegram",
                    enabled=True,
                    config=json.dumps({
                        "botToken": "bot7284918274:AAHDF83k...",
                        "chatId": "-1002938481"
                    })
                ),
                AlertChannel(
                    channel_type="smtp",
                    enabled=False,
                    config=json.dumps({
                        "host": "smtp.tradeshield.internal",
                        "port": 587,
                        "user": "compliance-alert",
                        "password": "",
                        "from": "alert@tradeshield.com",
                        "to": "desk-l1@tradeshield.com"
                    })
                ),
                AlertChannel(
                    channel_type="jira",
                    enabled=True,
                    config=json.dumps({
                        "endpoint": "https://jira.tradeshield.internal/rest/api/2",
                        "projectKey": "COMP",
                        "issueType": "Incident",
                        "token": "bearer p83klw89s7..."
                    })
                ),
                AlertChannel(
                    channel_type="teams",
                    enabled=True,
                    config=json.dumps({
                        "webhookUrl": "https://outlook.office.com/webhook/73a98...",
                        "channelName": "Compliance Alerts"
                    })
                )
            ]
            db.bulk_save_objects(channels_data)
            db.commit()

    finally:
        db.close()


def get_system_context_for_claude():
    db = SessionLocal()
    try:
        # Fetch last 15 system logs from events
        events = db.query(Event).order_by(Event.id.desc()).limit(15).all()
        log_lines = []
        for ev in reversed(events):
            log_lines.append(f"[{ev.timestamp}] {ev.message}")
        logs_str = "\n".join(log_lines) if log_lines else "No system logs available."

        # Fetch active trader accounts
        traders = db.query(Trader).filter(Trader.status == "ACTIVE").all()
        trader_lines = []
        for t in traders:
            trader_lines.append(f"- ID: {t.trader_id}, Name: {t.name}, Role: {t.role}, Sector Focus: {t.sector}")
        traders_str = "\n".join(trader_lines) if trader_lines else "No active trader accounts available."

        return logs_str, traders_str
    except Exception as e:
        print(f"Error getting context: {e}")
        return "System logs unavailable.", "Trader accounts unavailable."
    finally:
        db.close()

