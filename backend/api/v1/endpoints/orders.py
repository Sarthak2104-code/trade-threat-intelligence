"""
Orders API Endpoints
Handles order placement, cancellation, positions tracking, and square-off logic
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_db_connection
import uuid
import datetime
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class PlaceOrderRequest(BaseModel):
    instrument: str
    side: str  # BUY or SELL
    quantity: int
    price: float
    order_type: str = "LIMIT"


@router.post("/place")
async def place_order(request: PlaceOrderRequest):
    """
    Place a new order. Updates/creates positions based on side (BUY/SELL).
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Validate side
        side = request.side.upper()
        if side not in ("BUY", "SELL"):
            conn.close()
            raise HTTPException(status_code=400, detail="Side must be BUY or SELL")

        order_type = request.order_type.upper()
        order_id = f"ORD-{str(uuid.uuid4())[:8]}"
        timestamp = datetime.datetime.now().isoformat()
        pnl = 0.0

        if side == "BUY":
            # Check if position exists for instrument
            cursor.execute("SELECT quantity, avg_price FROM positions WHERE instrument = ?", (request.instrument,))
            pos = cursor.fetchone()
            if pos:
                existing_qty = pos["quantity"]
                existing_avg = pos["avg_price"]
                new_qty = existing_qty + request.quantity
                new_avg = ((existing_qty * existing_avg) + (request.quantity * request.price)) / new_qty

                cursor.execute("""
                    UPDATE positions
                    SET quantity = ?, avg_price = ?, current_price = ?, side = 'BUY'
                    WHERE instrument = ?
                """, (new_qty, new_avg, request.price, request.instrument))
            else:
                cursor.execute("""
                    INSERT INTO positions (instrument, side, quantity, avg_price, current_price, pnl)
                    VALUES (?, 'BUY', ?, ?, ?, 0.0)
                """, (request.instrument, request.quantity, request.price, request.price))

        else:  # SELL
            # Check if position exists
            cursor.execute("SELECT quantity, avg_price FROM positions WHERE instrument = ?", (request.instrument,))
            pos = cursor.fetchone()
            if pos:
                existing_qty = pos["quantity"]
                existing_avg = pos["avg_price"]
                new_qty = existing_qty - request.quantity
                pnl = (request.price - existing_avg) * request.quantity

                if new_qty <= 0:
                    cursor.execute("DELETE FROM positions WHERE instrument = ?", (request.instrument,))
                else:
                    cursor.execute("""
                        UPDATE positions
                        SET quantity = ?, current_price = ?
                        WHERE instrument = ?
                    """, (new_qty, request.price, request.instrument))
            # If no position exists, pnl remains 0.0 and order is still recorded

        # Insert the order record
        cursor.execute("""
            INSERT INTO orders (order_id, timestamp, instrument, side, quantity, price, order_type, status, pnl)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
        """, (order_id, timestamp, request.instrument, side, request.quantity, request.price, order_type, pnl))

        conn.commit()
        conn.close()

        return {
            "order_id": order_id,
            "status": "OPEN",
            "instrument": request.instrument,
            "side": side,
            "quantity": request.quantity,
            "price": request.price
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error placing order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def get_orders():
    """
    Get all orders, newest first.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders ORDER BY id DESC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/positions")
async def get_positions():
    """
    Get all open positions.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM positions")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{order_id}")
async def cancel_order(order_id: str):
    """
    Cancel an order by setting its status to CANCELLED.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        order = cursor.fetchone()
        if not order:
            conn.close()
            raise HTTPException(status_code=404, detail="Order not found")

        cursor.execute("UPDATE orders SET status = 'CANCELLED' WHERE order_id = ?", (order_id,))
        conn.commit()
        conn.close()

        return {"status": "success", "message": f"Order {order_id} has been cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/square-off/{instrument}")
async def square_off_position(instrument: str):
    """
    Square off an open position by placing an opposite order and deleting the position.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM positions WHERE instrument = ?", (instrument,))
        pos = cursor.fetchone()
        if not pos:
            conn.close()
            raise HTTPException(status_code=404, detail=f"No open position found for {instrument}")

        qty = pos["quantity"]
        avg_price = pos["avg_price"]
        side = pos["side"]
        current_price = pos["current_price"] if pos["current_price"] else avg_price

        opposite_side = "SELL" if side == "BUY" else "BUY"
        pnl = (current_price - avg_price) * qty if side == "BUY" else (avg_price - current_price) * qty

        order_id = f"ORD-{str(uuid.uuid4())[:8]}"
        timestamp = datetime.datetime.now().isoformat()

        # Place opposite order to close position
        cursor.execute("""
            INSERT INTO orders (order_id, timestamp, instrument, side, quantity, price, order_type, status, pnl)
            VALUES (?, ?, ?, ?, ?, ?, 'MARKET', 'EXECUTED', ?)
        """, (order_id, timestamp, instrument, opposite_side, qty, current_price, pnl))

        # Delete position
        cursor.execute("DELETE FROM positions WHERE instrument = ?", (instrument,))

        conn.commit()
        conn.close()

        return {
            "status": "success",
            "message": f"Position for {instrument} squared off.",
            "order_id": order_id,
            "pnl": pnl
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error squaring off position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_summary():
    """
    Get order/position metrics summary from the database.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM orders")
        total_orders = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM positions")
        open_positions = cursor.fetchone()[0]

        cursor.execute("SELECT SUM(pnl) FROM positions")
        total_pnl = cursor.fetchone()[0]
        if total_pnl is None:
            total_pnl = 0.0

        conn.close()

        return {
            "total_orders": total_orders,
            "open_positions": open_positions,
            "total_pnl": total_pnl
        }
    except Exception as e:
        logger.error(f"Error fetching summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
