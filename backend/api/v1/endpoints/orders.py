"""
Orders API Endpoints
Exchange engine: place buy/sell orders, track positions and order history
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import datetime
from db import get_db_connection
from exchange_state import exchange_state

router = APIRouter()


class OrderRequest(BaseModel):
    instrument: str
    symbol: str
    side: str          # BUY or SELL
    order_type: str    # MARKET or LIMIT
    quantity: int
    price: float
    trader_id: Optional[str] = "COMPLIANCE_OFFICER"
    trader_name: Optional[str] = "Compliance Officer"
    note: Optional[str] = ""
    auto_execute: Optional[bool] = False


class TriggerScenarioRequest(BaseModel):
    pattern_type: str
    parameters: dict


def ensure_orders_table():
    """Ensure the orders table exists in SQLite with correct columns."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            instrument TEXT NOT NULL,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            order_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            total_value REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'FILLED',
            trader_id TEXT DEFAULT 'COMPLIANCE_OFFICER',
            trader_name TEXT DEFAULT 'Compliance Officer',
            note TEXT DEFAULT ''
        )
    """)
    conn.commit()
    conn.close()


@router.post("/place")
async def place_order(order: OrderRequest):
    """
    Place a buy or sell order through the simulated exchange engine.
    If auto_execute is True or order_type is MARKET, it fills immediately.
    Otherwise, it is marked as PENDING and shown in the Exchange Server.
    """
    try:
        ensure_orders_table()
        conn = get_db_connection()
        cursor = conn.cursor()

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        total_value = round(order.quantity * order.price, 2)
        
        status = "FILLED" if (order.order_type.upper() == "MARKET" or order.auto_execute) else "PENDING"

        cursor.execute("""
            INSERT INTO orders (
                timestamp, instrument, symbol, side, order_type,
                quantity, price, total_value, status, trader_id, trader_name, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            timestamp, order.instrument, order.symbol, order.side.upper(), order.order_type.upper(),
            order.quantity, order.price, total_value, status,
            order.trader_id or "COMPLIANCE_OFFICER", 
            order.trader_name or "Compliance Officer", 
            order.note or ""
        ))
        conn.commit()
        order_id = cursor.lastrowid

        # Log event in the Exchange simulation engine
        event_name = "ORDER_FILLED" if status == "FILLED" else "ORDER_PLACED"
        exchange_state.record_event(event_name, {
            "order_id": order_id,
            "instrument": order.instrument,
            "side": order.side.upper(),
            "quantity": order.quantity,
            "price": order.price,
            "trader_id": order.trader_id or "COMPLIANCE_OFFICER",
            "trader_name": order.trader_name or "Compliance Officer",
            "order_type": order.order_type.upper()
        })

        # Log security audit console event
        side_emoji = "🟢" if order.side.upper() == "BUY" else "🔴"
        status_label = "PENDING" if status == "PENDING" else "FILLED"
        event_msg = (
            f"{side_emoji} [{order.side.upper()}] {order.quantity} × {order.symbol} @ ₹{order.price:,.2f} "
            f"| Total: ₹{total_value:,.2f} | Status: {status_label} | Trader: {order.trader_name} | Order #{order_id}"
        )
        cursor.execute(
            "INSERT INTO events (timestamp, message) VALUES (?, ?)",
            (timestamp, event_msg)
        )
        conn.commit()
        conn.close()

        return {
            "status": "success",
            "order_id": order_id,
            "timestamp": timestamp,
            "side": order.side.upper(),
            "symbol": order.symbol,
            "quantity": order.quantity,
            "price": order.price,
            "total_value": total_value,
            "order_status": status,
            "message": f"Order #{order_id} {status}: {order.side.upper()} {order.quantity} {order.symbol} @ ₹{order.price:,.2f}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order placement failed: {str(e)}")


@router.post("/execute/{order_id}")
async def execute_pending_order(order_id: int):
    """
    Fulfill and execute a pending order from the Exchange Server dashboard.
    """
    try:
        ensure_orders_table()
        conn = get_db_connection()
        conn.row_factory = conn.row_factory  # keep row dictionary access
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        
        if not order:
            conn.close()
            raise HTTPException(status_code=404, detail="Order not found")
            
        if order["status"] != "PENDING":
            conn.close()
            return {"status": "success", "message": f"Order is already {order['status']}"}
            
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        # Update order status
        cursor.execute("UPDATE orders SET status = 'FILLED' WHERE id = ?", (order_id,))
        
        # Log matching trade event
        side_emoji = "🎯"
        event_msg = (
            f"{side_emoji} [EXECUTE] Flipped Order #{order_id} to FILLED | "
            f"{order['side']} {order['quantity']} × {order['symbol']} @ ₹{order['price']:,.2f} | Trader: {order['trader_name']}"
        )
        cursor.execute("INSERT INTO events (timestamp, message) VALUES (?, ?)", (timestamp, event_msg))
        conn.commit()
        conn.close()

        # Notify simulator engine of the fill event
        exchange_state.record_event("ORDER_FILLED", {
            "order_id": order_id,
            "instrument": order["instrument"],
            "side": order["side"],
            "quantity": order["quantity"],
            "price": order["price"],
            "trader_id": order["trader_id"],
            "trader_name": order["trader_name"]
        })

        return {"status": "success", "message": f"Order #{order_id} successfully executed/filled"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order execution failed: {str(e)}")


@router.post("/cancel/{order_id}")
async def cancel_pending_order(order_id: int):
    """
    Cancel an active pending order from the client dashboard.
    """
    try:
        ensure_orders_table()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        
        if not order:
            conn.close()
            raise HTTPException(status_code=404, detail="Order not found")
            
        if order["status"] != "PENDING":
            conn.close()
            return {"status": "success", "message": f"Order is already {order['status']}"}
            
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        # Update status
        cursor.execute("UPDATE orders SET status = 'CANCELED' WHERE id = ?", (order_id,))
        
        # Log cancel event
        event_msg = f"⚪ [CANCEL] Cancelled pending Order #{order_id} | {order['side']} {order['quantity']} × {order['symbol']}"
        cursor.execute("INSERT INTO events (timestamp, message) VALUES (?, ?)", (timestamp, event_msg))
        conn.commit()
        conn.close()

        # Notify simulator engine of cancel event
        exchange_state.record_event("ORDER_CANCELED", {
            "order_id": order_id,
            "instrument": order["instrument"],
            "side": order["side"],
            "quantity": order["quantity"],
            "price": order["price"],
            "trader_id": order["trader_id"],
            "trader_name": order["trader_name"]
        })

        return {"status": "success", "message": f"Order #{order_id} successfully canceled"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order cancellation failed: {str(e)}")


@router.get("/pending")
async def get_pending_orders():
    """
    Get all pending limit orders.
    """
    try:
        ensure_orders_table()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, timestamp, instrument, symbol, side, order_type,
                   quantity, price, total_value, status, trader_id, trader_name, note
            FROM orders WHERE status = 'PENDING' ORDER BY id DESC
        """)
        rows = cursor.fetchall()
        conn.close()

        orders = []
        for row in rows:
            orders.append({
                "id": row["id"],
                "timestamp": row["timestamp"],
                "instrument": row["instrument"],
                "symbol": row["symbol"],
                "side": row["side"],
                "order_type": row["order_type"],
                "quantity": row["quantity"],
                "price": row["price"],
                "total_value": row["total_value"],
                "status": row["status"],
                "trader_id": row["trader_id"],
                "trader_name": row["trader_name"],
                "note": row["note"]
            })
        return {"status": "success", "orders": orders}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/depth")
async def get_exchange_market_depth(instrument_id: str):
    """
    Returns separate list of general market depth (other brokers) and our active user's pending bids/asks.
    """
    try:
        data = exchange_state.get_market_depth(instrument_id)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trigger-scenario")
async def trigger_exchange_scenario(req: TriggerScenarioRequest):
    """
    Set active scenario mutation on the market data tick stream.
    """
    try:
        exchange_state.set_scenario(req.pattern_type, req.parameters)
        return {
            "status": "success",
            "message": f"Surveillance injection active on trade stream for pattern {req.pattern_type}",
            "scenario": exchange_state.active_scenario
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-scenario")
async def clear_exchange_scenario():
    """
    Clear active scenario mutation on the market data tick stream.
    """
    try:
        exchange_state.clear_scenario()
        return {"status": "success", "message": "All stream scenarios cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_order_history(limit: int = 50):
    """Get order history from the exchange engine."""
    try:
        ensure_orders_table()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, timestamp, instrument, symbol, side, order_type,
                   quantity, price, total_value, status, trader_id, trader_name, note
            FROM orders ORDER BY id DESC LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        conn.close()

        orders = []
        for row in rows:
            orders.append({
                "id": row["id"],
                "timestamp": row["timestamp"],
                "instrument": row["instrument"],
                "symbol": row["symbol"],
                "side": row["side"],
                "order_type": row["order_type"],
                "quantity": row["quantity"],
                "price": row["price"],
                "total_value": row["total_value"],
                "status": row["status"],
                "trader_id": row["trader_id"],
                "trader_name": row["trader_name"],
                "note": row["note"]
            })
        return {"status": "success", "count": len(orders), "orders": orders}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch order history: {str(e)}")
