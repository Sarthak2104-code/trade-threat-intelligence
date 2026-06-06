# Market Data Datasets

## Overview
This directory contains real market data from NSE (National Stock Exchange of India) for 7 different instruments. The data is perfect for real-time replay demonstrations.

## Dataset Files

| File | Instrument ID | Records | Size | Description |
|------|---------------|---------|------|-------------|
| INE040A01034.csv | NSE_EQ\|INE040A01034 | 37,847 | 11.3 MB | High-volume stock |
| INE090A01021.csv | NSE_EQ\|INE090A01021 | 35,725 | 11.0 MB | Mid-cap stock |
| INE002A01018.csv | NSE_EQ\|INE002A01018 | 39,978 | 12.4 MB | Large-cap stock |
| INE018A01030.csv | NSE_EQ\|INE018A01030 | 28,188 | 8.3 MB | High-price stock |
| INE670A01012.csv | NSE_EQ\|INE670A01012 | 27,027 | 7.7 MB | Mid-cap stock |
| INE030A01027.csv | NSE_EQ\|INE030A01027 | 20,293 | 6.0 MB | Mid-cap stock |
| INE044A01036.csv | NSE_EQ\|INE044A01036 | 40,231 | 12.2 MB | High-volume stock |

## Data Structure

Each CSV file contains the following columns:

| Column | Description |
|--------|-------------|
| timestamp | Market timestamp (YYYY-MM-DD HH:MM:SS.mmm) |
| timestamp_system | System timestamp when data was received |
| instrument | Instrument identifier (NSE_EQ\|INEXXXXXXXX) |
| ltp | Last Traded Price |
| ltt | Last Trade Time (Unix timestamp in nanoseconds) |
| ltq | Last Traded Quantity |
| cp | Close Price (previous close) |
| atp | Average Traded Price |
| volume | Total volume traded |
| total_buy_qty | Total buy quantity in order book |
| total_sell_qty | Total sell quantity in order book |
| open_day | Day's opening price |
| high_day | Day's high price |
| low_day | Day's low price |
| close_day | Day's closing price |
| open_1min | 1-minute opening price |
| high_1min | 1-minute high price |
| low_1min | 1-minute low price |
| close_1min | 1-minute closing price |
| vol_1min | 1-minute volume |
| bid1_price - bid5_price | Bid prices for 5 levels |
| bid1_qty - bid5_qty | Bid quantities for 5 levels |
| ask1_price - ask5_price | Ask prices for 5 levels |
| ask1_qty - ask5_qty | Ask quantities for 5 levels |

## Real-Time Replay Capability

### ✅ YES - Perfect for Real-Time Demonstration

This data is **excellent** for real-time market replay because:

1. **Precise Timestamps**: Millisecond-level precision in timestamps
2. **Sequential Data**: Records are ordered chronologically
3. **Complete Market Data**: Contains LTP, bid/ask spreads, volumes, order book depth
4. **Order Book Depth**: 5-level bid/ask data for realistic order book visualization
5. **Time Gaps**: Natural time gaps between records for realistic replay speed
6. **Multiple Instruments**: 7 different stocks for diverse demonstration scenarios

### Replay Implementation Options

#### Option 1: Time-Based Replay (Recommended)
Replay data at original speed or accelerated:
```python
# Replay at 1x speed (real-time)
replay_speed = 1.0

# Replay at 10x speed (for faster demo)
replay_speed = 10.0

# Replay at 100x speed (for quick testing)
replay_speed = 100.0
```

#### Option 2: Event-Driven Replay
Trigger pattern detection on each market event:
```python
for row in data:
    process_market_event(row)
    detect_suspicious_patterns(row)
    update_dashboard(row)
```

#### Option 3: WebSocket Streaming
Stream data via WebSockets to frontend:
```python
async def stream_market_data():
    for row in data:
        await websocket.send_json(row)
        await asyncio.sleep(time_delay)
```

### Sample Replay Code

```python
import pandas as pd
import time
from datetime import datetime

def replay_market_data(file_path, speed_multiplier=1.0):
    """Replay market data with configurable speed"""
    df = pd.read_csv(file_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    previous_time = None
    
    for _, row in df.iterrows():
        current_time = row['timestamp']
        
        if previous_time:
            # Calculate time difference
            time_diff = (current_time - previous_time).total_seconds()
            # Apply speed multiplier
            sleep_time = time_diff / speed_multiplier
            time.sleep(max(0, sleep_time))
        
        # Process market data
        process_tick(row)
        
        previous_time = current_time

def process_tick(row):
    """Process individual market tick"""
    print(f"[{row['timestamp']}] {row['instrument']}")
    print(f"  LTP: {row['ltp']} | Volume: {row['volume']}")
    print(f"  Bid: {row['bid1_price']} ({row['bid1_qty']})")
    print(f"  Ask: {row['ask1_price']} ({row['ask1_qty']})")
```

### Demonstration Scenarios

1. **Normal Trading**: Replay entire trading day (09:15 - 15:30)
2. **Pattern Detection**: Focus on specific time windows with suspicious activity
3. **Multi-Instrument**: Replay multiple instruments simultaneously
4. **Order Book Visualization**: Show bid/ask spread changes in real-time
5. **Volume Spikes**: Highlight unusual volume increases
6. **Price Manipulation**: Detect and visualize layering/spoofing patterns

### Integration with Trade Surveillance System

```python
# In your FastAPI backend
@app.post("/api/v1/replay/start")
async def start_replay(instrument_id: str, speed: float = 1.0):
    file_path = f"datasets/{instrument_id}.csv"
    
    # Start background task for replay
    asyncio.create_task(replay_market_data(file_path, speed))
    
    return {"status": "replay_started", "instrument": instrument_id}

@app.websocket("/ws/market-data")
async def market_data_stream(websocket: WebSocket):
    await websocket.accept()
    
    # Stream replayed data to connected clients
    async for tick in replay_generator():
        await websocket.send_json(tick)
```

### Performance Considerations

- **Total Records**: ~229,000 records across all files
- **Time Range**: Single trading day (2026-04-27)
- **Replay Duration**: 
  - 1x speed: ~6 hours (full trading day)
  - 10x speed: ~36 minutes
  - 100x speed: ~3.6 minutes
- **Memory Usage**: ~50MB for all datasets in memory

### Recommended Demo Setup

For hackathon demonstration:
1. **Use 10x speed**: Balance between realism and demo time
2. **Focus on 2-3 instruments**: Don't overwhelm the dashboard
3. **Highlight suspicious patterns**: Pre-identify time windows with anomalies
4. **Show real-time detection**: Display pattern detection as it happens
5. **Interactive controls**: Allow pause/speed adjustment during demo

### Data Quality Notes

- **Clean Data**: No missing values or corrupted records
- **Consistent Format**: All files have identical structure
- **Real Market Data**: Actual NSE market data (not synthetic)
- **Trading Day**: Complete trading day data from market open to close

## Usage in Hackathon Project

This data can be used for:
1. **Trade Data Ingestion**: Load and parse market data
2. **Pattern Detection**: Identify layering, spoofing, wash trading
3. **Real-Time Dashboard**: Display live market data with TradingView charts
4. **Graph Intelligence**: Build entity relationships from trading patterns
5. **AI Triage**: Feed suspicious events to Claude API for analysis
6. **Replay Investigation**: Reconstruct suspicious trading sequences

## Next Steps

1. ✅ Files renamed with instrument IDs
2. ⏭️ Create data ingestion pipeline
3. ⏭️ Implement replay engine
4. ⏭️ Build pattern detection on this data
5. ⏭️ Integrate with frontend dashboard
