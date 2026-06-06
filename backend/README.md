# Trade Threat Intelligence Backend

FastAPI backend serving as the API gateway and orchestrator for the Trade Surveillance & Alert Triage Engine.

## Features

- **RESTful API** for trade data ingestion, pattern detection, and AI triage
- **WebSocket support** for real-time market data streaming
- **Modular architecture** with separate routers for different functionalities
- **Configuration management** using environment variables
- **CORS enabled** for frontend integration

## Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── config.py               # Configuration management
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
├── api/
│   ├── v1/
│   │   ├── endpoints/
│   │   │   ├── trades.py      # Trade data endpoints
│   │   │   ├── detection.py   # Pattern detection endpoints
│   │   │   └── triage.py      # AI triage endpoints
│   │   └── __init__.py
│   └── __init__.py
└── README.md
```

## Installation

### Prerequisites
- Python 3.9+
- pip

### Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env and add your API keys and configuration
# nano .env  # or use your preferred editor
```

## Running the Backend

### Development Mode

```bash
# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
# Run without auto-reload
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Using Python

```bash
python main.py
```

## API Documentation

Once the backend is running, access the interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Available Endpoints

### Health & Info
- `GET /health` - Health check
- `GET /` - API information

### Trades
- `POST /api/v1/trades/ingest` - Ingest trade data from CSV
- `GET /api/v1/trades/instruments` - List available instruments
- `GET /api/v1/trades/{instrument_id}` - Get trade history
- `GET /api/v1/trades/stream/{instrument_id}` - Get streaming info

### Pattern Detection
- `POST /api/v1/detect/analyze` - Run pattern detection
- `GET /api/v1/detect/patterns` - List detected patterns
- `GET /api/v1/detect/alerts` - Get flagged alerts
- `POST /api/v1/detect/patterns/{pattern_type}/configure` - Configure pattern detection

### AI Triage
- `POST /api/v1/triage/analyze` - Analyze alert with Claude API
- `GET /api/v1/triage/{alert_id}` - Get triage result
- `POST /api/v1/triage/batch` - Batch triage multiple alerts

### WebSocket
- `WS /ws/market-data` - Real-time market data streaming

## Configuration

Key environment variables in `.env`:

```env
# API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/trade_surveillance

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Integrations
JIRA_API_URL=https://your-jira-instance.com
SLACK_WEBHOOK_URL=your_slack_webhook_url

# Detection Thresholds
LAYERING_CANCEL_RATIO_THRESHOLD=0.8
SPOOFING_ORDER_COUNT_THRESHOLD=10
```

## Testing the API

### Using curl

```bash
# Health check
curl http://localhost:8000/health

# List instruments
curl http://localhost:8000/api/v1/trades/instruments

# Get trade history
curl http://localhost:8000/api/v1/trades/INE040A01034?limit=10

# Run pattern detection
curl -X POST http://localhost:8000/api/v1/detect/analyze \
  -H "Content-Type: application/json" \
  -d '{"instrument_id": "INE040A01034"}'
```

### Using Python requests

```python
import requests

# Health check
response = requests.get("http://localhost:8000/health")
print(response.json())

# List instruments
response = requests.get("http://localhost:8000/api/v1/trades/instruments")
print(response.json())

# Get trade history
response = requests.get("http://localhost:8000/api/v1/trades/INE040A01034?limit=10")
print(response.json())
```

## Development Notes

### Current Implementation Status

- ✅ FastAPI application setup
- ✅ CORS configuration
- ✅ WebSocket support
- ✅ Trades API (data ingestion and retrieval)
- ✅ Pattern Detection API (placeholder implementation)
- ✅ AI Triage API (placeholder implementation)
- ⏳ Graph Intelligence API (to be implemented)
- ⏳ Risk Scoring API (to be implemented)
- ⏳ Workflows API (to be implemented)
- ⏳ Investigation API (to be implemented)
- ⏳ Database integration (to be implemented)
- ⏳ Claude API integration (to be implemented)
- ⏳ Neo4j integration (to be implemented)

### Next Steps

1. Implement actual pattern detection algorithms
2. Integrate Anthropic Claude API for AI triage
3. Add database models and SQLAlchemy integration
4. Implement Neo4j graph database for entity relationships
5. Add Celery for background task processing
6. Implement Kafka for event streaming
7. Add Jira and Slack integrations
8. Create data replay engine for market data
9. Add authentication and authorization
10. Implement rate limiting

## Troubleshooting

### Port already in use
```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>
```

### Import errors
```bash
# Ensure you're in the backend directory
cd backend

# Activate virtual environment
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Environment variables not loading
```bash
# Ensure .env file exists in backend directory
ls -la .env

# Check .env file format
cat .env
```

## License

Confidential – For Wissen Technology Hackathon 2026 Participants Only
