import time
import json
import random
import logging
from typing import Dict, List, Optional
from pydantic import BaseModel
import sqlite3
from db import DB_PATH, get_db_connection

logger = logging.getLogger("exchange-simulator")

# Map ISINs (instrument_ids) to human-readable stock symbols
ISIN_TO_SYMBOL: Dict[str, str] = {
    "INE002A01018": "RELIANCE",
    "INE040A01034": "HDFCBANK",
    "INE090A01021": "ICICIBANK",
    "INE018A01030": "LT",
    "INE670A01012": "TATAELXSI",
    "INE030A01027": "HINDUNILVR",
    "INE044A01036": "SUNPHARMA",
}

class ExchangeOrder(BaseModel):
    id: int
    timestamp: str
    instrument: str
    symbol: str
    side: str
    order_type: str
    quantity: int
    price: float
    total_value: float
    status: str  # PENDING, FILLED, CANCELED
    trader_id: str
    trader_name: str
    note: str

class ExchangeState:
    def __init__(self):
        # Active scenario parameters (e.g., wash_trading, spoofing)
        self.active_scenario: Optional[dict] = None
        
        # In-memory buffer of recent order events & ticks for pattern matching (sliding window)
        self.events_buffer: List[dict] = []
        self.max_buffer_size = 100
        
        # Track duplicate alerts: set of (instrument, pattern) triggered in last 20 seconds
        self.recent_alerts: Dict[str, float] = {}

        # Track the last LTP of each instrument to align market depth with the tick feed
        self.last_ltp: Dict[str, float] = {}

    def set_scenario(self, pattern_type: str, parameters: dict):
        self.active_scenario = {
            "pattern_type": pattern_type,
            "parameters": parameters,
            "activated_at": time.time()
        }
        logger.info(f"Exchange scenario set: {pattern_type} with parameters {parameters}")

    def clear_scenario(self):
        self.active_scenario = None
        logger.info("Exchange scenario cleared")

    def get_market_depth(self, instrument_id: str):
        """
        Generates realistic market depth.
        Extracts other brokers' orders and overlays our active trader's pending orders.
        """
        # Base mid price for generation, default to something realistic if not available
        mid_price = 1330.0
        clean_id = instrument_id.split("|")[-1]
        
        if "002" in clean_id or "RELIANCE" in instrument_id:
            mid_price = 1330.0
        elif "018" in clean_id or "TATAELXSI" in instrument_id:
            mid_price = 7800.0
        elif "044" in clean_id or "LT" in instrument_id:
            mid_price = 3500.0

        if instrument_id in self.last_ltp:
            mid_price = self.last_ltp[instrument_id]

        # Generate separate other brokers' depth (bids and asks)
        other_bids = []
        other_asks = []
        
        for i in range(1, 6):
            # Other brokers
            other_bids.append({
                "price": round(mid_price - (i * 0.5) - random.uniform(0.01, 0.2), 2),
                "qty": random.randint(100, 1500),
                "broker": f"Broker_{random.choice(['HDFC', 'ICICI', 'ZERODHA', 'KOTAK', 'GROWW'])}"
            })
            other_asks.append({
                "price": round(mid_price + (i * 0.5) + random.uniform(0.01, 0.2), 2),
                "qty": random.randint(100, 1500),
                "broker": f"Broker_{random.choice(['HDFC', 'ICICI', 'ZERODHA', 'KOTAK', 'GROWW'])}"
            })

        # Fetch our pending orders from SQLite
        our_bids = []
        our_asks = []
        
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, side, quantity, price, trader_id, trader_name, note
                FROM orders 
                WHERE status = 'PENDING' AND (instrument = ? OR symbol = ?)
            """, (instrument_id, clean_id))
            rows = cursor.fetchall()
            conn.close()
            
            for r in rows:
                order_item = {
                    "id": r["id"],
                    "price": r["price"],
                    "qty": r["quantity"],
                    "trader_id": r["trader_id"],
                    "trader_name": r["trader_name"],
                    "note": r["note"]
                }
                if r["side"].upper() == "BUY":
                    our_bids.append(order_item)
                else:
                    our_asks.append(order_item)
        except Exception as e:
            logger.error(f"Error fetching pending orders for depth: {e}")

        # Return separately as requested: other brokers' depth vs our own bids/asks
        return {
            "instrument": instrument_id,
            "mid_price": mid_price,
            "market_depth": {
                "bids": sorted(other_bids, key=lambda x: x["price"], reverse=True),
                "asks": sorted(other_asks, key=lambda x: x["price"])
            },
            "our_orders": {
                "bids": sorted(our_bids, key=lambda x: x["price"], reverse=True),
                "asks": sorted(our_asks, key=lambda x: x["price"])
            }
        }

    def record_event(self, event_type: str, details: dict):
        """
        Record order placements, fills, and cancels to events_buffer for threat detection.
        """
        details["event_type"] = event_type
        details["timestamp_ms"] = time.time()
        self.events_buffer.append(details)
        if len(self.events_buffer) > self.max_buffer_size:
            self.events_buffer.pop(0)

        # Run detection engine check
        self.scan_for_anomalies(details.get("instrument", "RELIANCE"))

    def mutate_market_stream(self, tick_record: dict, instrument_id: str) -> dict:
        """
        Manipulates the live streaming tick records with orders/events if a scenario is active.
        """
        # Save the live LTP to match generated market depth with the CSV tick replayer
        price_val = tick_record.get("ltp") or tick_record.get("last_price") or tick_record.get("price")
        if price_val:
            try:
                self.last_ltp[instrument_id] = float(price_val)
            except (ValueError, TypeError):
                pass

        if not self.active_scenario:
            return tick_record

        # Check if the active scenario applies to this instrument
        scenario_instrument = self.active_scenario["parameters"].get("instrument", "")
        is_match = False
        if scenario_instrument:
            s = scenario_instrument.upper()
            t = instrument_id.upper()
            if s in t or t in s:
                is_match = True
            elif "RELIANCE" in s and ("002" in t or "RELIANCE" in t):
                is_match = True
            elif "TATAELXSI" in s and ("018" in t or "TATAELXSI" in t):
                is_match = True
            elif "LT" in s and ("044" in t or "LT" in t):
                is_match = True

        if scenario_instrument and not is_match:
            return tick_record

        pattern = self.active_scenario["pattern_type"].upper()
        now_ts = time.time()

        # Mutate tick based on scenario characteristics
        mutated = dict(tick_record)
        
        if "SPOOF" in pattern:
            # Spoofing mutation: Inject a huge bid size to skew depth, and tick prices slightly increase
            mutated["bid1_qty"] = int(tick_record.get("bid1_qty", 100) * 15)  # Make it look huge
            mutated["ltp"] = round(tick_record.get("ltp", 100.0) * 1.002, 2)
            bid_price = mutated.get("bid1_price") or mutated.get("ltp") or 1330.0
            
            # Record a mock event in the buffer representing this spoof bid placement
            if random.random() < 0.2:
                self.record_event("ORDER_PLACED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-SPOOF-MOCK",
                    "trader_name": "Algo Spoof Agent",
                    "side": "BUY",
                    "price": bid_price,
                    "quantity": mutated["bid1_qty"],
                    "order_type": "LIMIT"
                })
            # Sometime cancel it
            if random.random() < 0.15:
                self.record_event("ORDER_CANCELED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-SPOOF-MOCK",
                    "trader_name": "Algo Spoof Agent",
                    "side": "BUY",
                    "price": bid_price,
                    "quantity": mutated["bid1_qty"]
                })
                # Simulate the execution of the opposite side trade that was aided by the spoofing!
                self.record_event("ORDER_FILLED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-SPOOF-VICTIM",
                    "trader_name": "Victim Liquidity Provider",
                    "side": "SELL",
                    "price": bid_price,
                    "quantity": random.randint(100, 500)
                })
                
        elif "LAYERING" in pattern:
            # Layering mutation: Inject large quantities across multiple pricing steps
            mutated["bid1_qty"] = int(tick_record.get("bid1_qty", 100) * 8)
            mutated["bid2_qty"] = int(tick_record.get("bid2_qty", 100) * 10)
            mutated["bid3_qty"] = int(tick_record.get("bid3_qty", 100) * 12)
            bid_price1 = mutated.get("bid1_price") or mutated.get("ltp") or 1330.0
            bid_price2 = mutated.get("bid2_price") or (bid_price1 - 0.5)
            
            # Add placement and cancel events across consecutive layers
            if random.random() < 0.25:
                self.record_event("ORDER_PLACED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-LAY-MOCK",
                    "trader_name": "Layering Desk",
                    "side": "BUY",
                    "price": bid_price1,
                    "quantity": mutated["bid1_qty"],
                    "order_type": "LIMIT"
                })
                self.record_event("ORDER_PLACED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-LAY-MOCK",
                    "trader_name": "Layering Desk",
                    "side": "BUY",
                    "price": bid_price2,
                    "quantity": mutated["bid2_qty"],
                    "order_type": "LIMIT"
                })
            if random.random() < 0.20:
                self.record_event("ORDER_CANCELED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-LAY-MOCK",
                    "trader_name": "Layering Desk",
                    "side": "BUY",
                    "price": bid_price1,
                    "quantity": mutated["bid1_qty"]
                })
                self.record_event("ORDER_CANCELED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-LAY-MOCK",
                    "trader_name": "Layering Desk",
                    "side": "BUY",
                    "price": bid_price2,
                    "quantity": mutated["bid2_qty"]
                })

        elif "WASH" in pattern:
            # Wash trading: Inject high-volume trades with no net price impact
            mutated["ltq"] = random.randint(1000, 5000)
            mutated["volume"] = tick_record.get("volume", 0) + mutated["ltq"]
            
            # Record rapid matching buy/sell trades by same trader ID
            if random.random() < 0.3:
                self.record_event("ORDER_FILLED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-WASH-MOCK",
                    "trader_name": "Wash Exec Agent",
                    "side": "BUY",
                    "price": mutated["ltp"],
                    "quantity": mutated["ltq"],
                    "matching_trader_id": "TRD-WASH-MOCK" # Same entity!
                })

        elif "STUFFING" in pattern or "QUOTE" in pattern:
            # Quote Stuffing: Extremely high event logs.
            for _ in range(random.randint(5, 15)):
                self.record_event("ORDER_PLACED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-STUFF-MOCK",
                    "trader_name": "Stuffing Desk",
                    "side": "SELL",
                    "price": mutated["ask1_price"],
                    "quantity": random.randint(100, 500),
                    "order_type": "LIMIT"
                })
                self.record_event("ORDER_CANCELED", {
                    "instrument": instrument_id,
                    "trader_id": "TRD-STUFF-MOCK",
                    "trader_name": "Stuffing Desk",
                    "side": "SELL",
                    "price": mutated["ask1_price"],
                    "quantity": random.randint(100, 500)
                })

        elif "PUMP" in pattern or "DUMP" in pattern:
            # Pump & Dump: Force price upward rapidly
            elapsed = now_ts - self.active_scenario["activated_at"]
            if elapsed < 25:  # Pump phase (rising prices)
                mutated["ltp"] = round(tick_record.get("ltp", 100.0) * (1.0 + (elapsed * 0.003)), 2)
                mutated["ltq"] = random.randint(500, 2000)
                if random.random() < 0.4:
                    self.record_event("ORDER_FILLED", {
                        "instrument": instrument_id,
                        "trader_id": "TRD-PUMP-MOCK",
                        "trader_name": "Pump Master",
                        "side": "BUY",
                        "price": mutated["ltp"],
                        "quantity": mutated["ltq"]
                    })
            else:  # Dump phase (steep drop)
                mutated["ltp"] = round(tick_record.get("ltp", 100.0) * 0.92, 2)
                mutated["ltq"] = random.randint(5000, 20000)  # Huge volume dump
                if random.random() < 0.5:
                    self.record_event("ORDER_FILLED", {
                        "instrument": instrument_id,
                        "trader_id": "TRD-PUMP-MOCK",
                        "trader_name": "Pump Master",
                        "side": "SELL",
                        "price": mutated["ltp"],
                        "quantity": mutated["ltq"],
                        "note": "Liquidation dump"
                    })

        return mutated

    def scan_for_anomalies(self, instrument_id: str):
        """
        Core detection loop. Evaluates sliding window order event buffer.
        Detects anomalies dynamically and registers real incidents.
        """
        now = time.time()
        clean_id = instrument_id.split("|")[-1]
        
        # Filter buffer for current instrument
        inst_events = [e for e in self.events_buffer if e.get("instrument") == instrument_id]
        if not inst_events:
            return

        # 1. SCAN FOR SPOOFING
        # Pattern: Large order placed, canceled quickly (<10s) while a trade of the opposite side executes
        cancels = [e for e in inst_events if e["event_type"] == "ORDER_CANCELED"]
        fills = [e for e in inst_events if e["event_type"] == "ORDER_FILLED"]
        placements = [e for e in inst_events if e["event_type"] == "ORDER_PLACED"]

        for c in cancels:
            # Look for corresponding placement
            matching_placements = [p for p in placements if p["trader_id"] == c["trader_id"] and p["side"] == c["side"] and abs(p["price"] - c["price"]) < 0.05]
            if not matching_placements:
                continue
            p = matching_placements[-1]
            lifetime = c["timestamp_ms"] - p["timestamp_ms"]
            
            # If canceled quickly and quantity is large (e.g. qty > 800)
            if lifetime < 12 and c["quantity"] >= 800:
                # Look for an opposite fill near the cancellation time
                opp_side = "SELL" if c["side"] == "BUY" else "BUY"
                opp_fills = [f for f in fills if f["side"] == opp_side and abs(f["timestamp_ms"] - c["timestamp_ms"]) < 6]
                
                if opp_fills:
                    self.trigger_dynamic_incident(
                        instrument_id=instrument_id,
                        pattern="Spoofing Alert",
                        severity="HIGH" if c["quantity"] > 2000 else "MEDIUM",
                        confidence=round(0.75 + min(0.20, (c["quantity"] / 5000)), 2),
                        evidence=f"Phantom limit order ({c['quantity']} shares {c['side']} @ ₹{c['price']}) canceled in {lifetime:.2f}s "
                                 f"while opposite executed trade filled on {opp_side} side. Trader Account: {c['trader_id']} ({c['trader_name']})."
                    )
                    break

        # 2. SCAN FOR LAYERING
        # Pattern: Multiple distinct limit orders placed by same trader at consecutive prices, canceled in close succession
        for p in placements:
            same_trader_cancels = [c for c in cancels if c["trader_id"] == p["trader_id"] and abs(c["timestamp_ms"] - p["timestamp_ms"]) < 10]
            if len(same_trader_cancels) >= 2:
                # Check if prices are layered
                prices = set(round(c["price"], 1) for c in same_trader_cancels)
                if len(prices) >= 2:
                    total_qty = sum(c["quantity"] for c in same_trader_cancels)
                    self.trigger_dynamic_incident(
                        instrument_id=instrument_id,
                        pattern="Layering Alert",
                        severity="CRITICAL" if total_qty > 4000 else "HIGH",
                        confidence=round(0.80 + min(0.18, (total_qty / 10000)), 2),
                        evidence=f"Stacked limit orders across {len(prices)} price layers canceled in rapid succession. "
                                 f"Total layered volume: {total_qty} shares. Trader Account: {p['trader_id']} ({p['trader_name']})."
                    )
                    break

        # 3. SCAN FOR WASH TRADING
        # Pattern: Trade filled where buy and sell trader ID match (Self Trade)
        for f in fills:
            if f.get("matching_trader_id") == f["trader_id"] or f.get("trader_id") == "TRD-WASH-MOCK":
                self.trigger_dynamic_incident(
                    instrument_id=instrument_id,
                    pattern="Wash Trading",
                    severity="CRITICAL",
                    confidence=0.99,
                    evidence=f"Internal cross-trade matching buy and sell execution orders for same beneficial owner. "
                             f"Executed: {f['quantity']} shares @ ₹{f['price']}. Trader Account: {f['trader_id']} ({f['trader_name']})."
                )
                break

        # 4. SCAN FOR QUOTE STUFFING
        # Pattern: Extremely high rate of placements/cancellations in small window
        recent_window_events = [e for e in inst_events if now - e["timestamp_ms"] < 6]
        stuffing_agents = {}
        for e in recent_window_events:
            if e["event_type"] in ["ORDER_PLACED", "ORDER_CANCELED"]:
                t_id = e["trader_id"]
                stuffing_agents[t_id] = stuffing_agents.get(t_id, 0) + 1

        for agent, count in stuffing_agents.items():
            if count >= 15:
                # Find matching event trader name
                agent_name = next((e["trader_name"] for e in recent_window_events if e["trader_id"] == agent), "Unknown")
                self.trigger_dynamic_incident(
                    instrument_id=instrument_id,
                    pattern="Quote Stuffing",
                    severity="HIGH" if count > 30 else "MEDIUM",
                    confidence=round(0.70 + min(0.25, (count / 50)), 2),
                    evidence=f"High frequency flood of {count} quote events (placements/cancellations) within 6 seconds. "
                             f"Designed to choke broker pipeline or feed latency. Trader: {agent} ({agent_name})."
                )

        # 5. SCAN FOR PUMP AND DUMP
        # Pattern: Coordinated sequence of buy fills followed by a huge sell dump
        trader_fills = {}
        for f in fills:
            t_id = f["trader_id"]
            trader_fills.setdefault(t_id, []).append(f)

        for t_id, t_fills in trader_fills.items():
            buys = [f for f in t_fills if f["side"] == "BUY"]
            sells = [f for f in t_fills if f["side"] == "SELL"]
            if buys and sells:
                # Check if sells have a massive volume relative to buy accumulation, or if note indicates liquidation dump
                total_buy_qty = sum(b["quantity"] for b in buys)
                total_sell_qty = sum(s["quantity"] for s in sells)
                
                # Check for rapid pump and dump
                if total_sell_qty > 3000 and total_buy_qty > 1000:
                    agent_name = t_fills[0]["trader_name"]
                    self.trigger_dynamic_incident(
                        instrument_id=instrument_id,
                        pattern="Pump & Dump Alert",
                        severity="CRITICAL" if total_sell_qty > 8000 else "HIGH",
                        confidence=0.90,
                        evidence=f"Unusual coordinate sequence of aggressive buying ({total_buy_qty} shares accumulated) "
                                 f"followed immediately by a large volume dump of {total_sell_qty} shares at ₹{sells[0]['price']}. Trader: {t_id} ({agent_name})."
                    )

    def trigger_dynamic_incident(self, instrument_id: str, pattern: str, severity: str, confidence: float, evidence: str):
        """
        Creates and persists the incident in the database, writing log events & triggering notifications.
        Implements throttling to prevent duplicates.
        """
        key = f"{instrument_id}:{pattern}"
        now = time.time()
        
        # Throttle matching alerts to once every 20 seconds
        if key in self.recent_alerts and now - self.recent_alerts[key] < 20:
            return
            
        self.recent_alerts[key] = now
        # Extract the raw ISIN from the instrument_id (may contain pipe separators)
        clean_id = instrument_id.split("|")[-1]
        # Resolve to a human-readable stock symbol; fall back to the ISIN if unknown
        resolved_symbol = ISIN_TO_SYMBOL.get(clean_id, clean_id)
        
        try:
            # Format incident timestamp
            import datetime
            timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Generate incident ID
            cursor.execute("SELECT count(*) FROM incidents")
            cnt = cursor.fetchone()[0] + 1
            incident_id = f"INC-DETECT-{cnt:03d}"
            
            # Insert incident — store resolved symbol (e.g. 'RELIANCE') not raw ISIN
            cursor.execute("""
                INSERT INTO incidents (id, symbol, pattern, severity, timestamp, status, confidence, evidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (incident_id, resolved_symbol, pattern, severity, timestamp_str, "PENDING", confidence, evidence))
            
            # Insert log event
            event_msg = f"⚠️ [Surveillance Engine] Smart threat alert triggered: {pattern} ({severity}) on {clean_id}. Confidence: {int(confidence*100)}%."
            cursor.execute("""
                INSERT INTO events (timestamp, message)
                VALUES (?, ?)
            """, (timestamp_str, event_msg))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Dynamically generated incident: {incident_id} ({pattern})")

            # Fire alert channel notifications in a background task (synchronous execution for simpler module loading)
            try:
                import asyncio
                from api.v1.endpoints.channels import trigger_policy_alerts
                from sqlalchemy.orm import Session
                from db import SessionLocal
                
                db = SessionLocal()
                # Run the notification
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # Run async task in the background of the event loop
                    asyncio.ensure_future(trigger_policy_alerts(
                        incident_id=incident_id,
                        symbol=clean_id,
                        pattern=pattern,
                        severity=severity,
                        evidence=evidence,
                        db=db
                    ))
                else:
                    # Run synchronously
                    loop.run_until_complete(trigger_policy_alerts(
                        incident_id=incident_id,
                        symbol=clean_id,
                        pattern=pattern,
                        severity=severity,
                        evidence=evidence,
                        db=db
                    ))
            except Exception as notify_err:
                logger.error(f"Error firing alerts for dynamic incident: {notify_err}")

        except Exception as err:
            logger.error(f"Failed to create dynamic incident: {err}")

# Single global instance of simulated exchange state
exchange_state = ExchangeState()
