import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trade_surveillance.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create traders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS traders (
        trader_id TEXT PRIMARY KEY,
        name TEXT,
        role TEXT,
        sector TEXT
    )
    """)
    
    # Create anomaly_injections table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS anomaly_injections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        trader_id TEXT,
        trader_name TEXT,
        instrument TEXT,
        pattern_type TEXT,
        severity TEXT,
        confidence REAL,
        cancel_ratio REAL,
        cancel_time_median INTEGER,
        order_count INTEGER,
        price_impact REAL,
        description TEXT
    )
    """)

    # Create orders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT UNIQUE,
        timestamp TEXT,
        instrument TEXT,
        side TEXT,
        quantity INTEGER,
        price REAL,
        order_type TEXT,
        status TEXT,
        pnl REAL DEFAULT 0
    )
    """)

    # Create positions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instrument TEXT UNIQUE,
        side TEXT,
        quantity INTEGER,
        avg_price REAL,
        current_price REAL,
        pnl REAL DEFAULT 0,
        margin_used REAL DEFAULT 0
    )
    """)

    # Seed traders if empty
    cursor.execute("SELECT COUNT(*) FROM traders")
    if cursor.fetchone()[0] == 0:
        traders_data = [
            ("TRADER_001", "Aarav Sharma", "Senior Desk Trader", "Energy"),
            ("TRADER_002", "Aditya Patel", "HFT Specialist", "Tech/Fin"),
            ("TRADER_003", "Ananya Iyer", "Arbitrage Associate", "Materials"),
            ("TRADER_004", "Karan Malhotra", "Proprietary Trader", "Consumer"),
            ("TRADER_005", "Priya Rao", "Quantitative Analyst", "Healthcare")
        ]
        cursor.executemany("INSERT INTO traders (trader_id, name, role, sector) VALUES (?, ?, ?, ?)", traders_data)
        
    conn.commit()
    conn.close()
