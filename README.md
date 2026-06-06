# Trade Threat Intelligence Project

**Trade Surveillance & Alert Triage Engine**

An AI-powered system that monitors trading activity in real time, detects suspicious patterns using machine learning, and automatically triages alerts to reduce false positives for compliance teams.

## 🎯 Project Overview

Financial firms generate thousands of trade surveillance alerts daily — the vast majority are false positives that drain compliance analyst time and delay genuine escalations. This system:

- **Ingests** trade and order event data from multiple sources
- **Detects** suspicious trading patterns using rule-based and ML approaches
- **Triages** alerts using Anthropic Claude API for human-readable analysis
- **Escalates** genuine alerts through automated workflows

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Trade Data     │────▶│  Pattern        │────▶│  AI Triage      │────▶│  Automated      │
│  Ingestion      │     │  Detection      │     │  (Claude API)   │     │  Escalation     │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Graph          │     │  Risk           │     │  Interactive    │     │  Compliance     │
│  Intelligence   │     │  Scoring       │     │  Dashboard      │     │  Workflows      │
│  (Cytoscape)    │     │  Engine         │     │  (React)        │     │  (Jira/Slack)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Anthropic Claude API key
- Docker & Docker Compose (optional)
- PostgreSQL
- Neo4j (optional, for graph intelligence)

### Installation

```bash
# Clone the repository
git clone https://github.com/r04nx-w/trade-threat-intelligence.git
cd trade-threat-intelligence

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys and configuration
```

### Running the System

#### Option 1: Docker (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

#### Option 2: Manual Setup
```bash
# Terminal 1: Start backend
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Start frontend
cd frontend
npm run dev

# Terminal 3: Start Neo4j (if using graph intelligence)
# Neo4j runs on default port 7474
```

#### Generate Synthetic Data
```bash
cd scripts
python generate_synthetic_data.py --output ../data/trade_data.csv --records 10000
```

### Access the Application
- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Neo4j Browser**: http://localhost:7474 (if enabled)

## �️ Tech Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **Python 3.9+** - Core language
- **SQLAlchemy** - ORM for database operations
- **PostgreSQL** - Primary database for structured data
- **Neo4j** - Graph database for relationship intelligence
- **Apache Kafka** - Real-time event streaming (optional)
- **WebSockets** - Real-time updates
- **Celery** - Background job processing

### Frontend
- **Next.js** - React framework for dashboard
- **React** - UI library
- **shadcn/ui** - Modern UI component library
- **TailwindCSS** - Utility-first CSS framework
- **Cytoscape.js** - Interactive graph visualization
- **TradingView Lightweight Charts** - Professional financial charts
- **Apache ECharts** - Advanced data visualization
- **Framer Motion** - Smooth animations

### AI & Analytics
- **Anthropic Claude API** - AI-powered triage and RCA
- **Pandas** - Data manipulation and analysis
- **NumPy** - Numerical computing
- **Scikit-learn** - Machine learning utilities

### Integration & Workflows
- **Slack API** - Real-time notifications
- **Jira API** - Compliance case management
- **Socket.IO** - Real-time bidirectional communication

### Development Tools
- **Docker** - Containerization
- **pytest** - Testing framework
- **Black** - Code formatting
- **pre-commit** - Git hooks

##  Project Structure

```
trade-threat-intelligence/
├── README.md
├── requirements.txt
├── .env.example
├── docker-compose.yml
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── ingest_data.py          # Trade data ingestion module
│   ├── detect_patterns.py      # Suspicious pattern detection
│   ├── triage_alerts.py        # AI-driven alert triage
│   ├── escalate_workflows.py   # Automated escalation workflows
│   ├── graph_intelligence.py   # Graph-based RCA engine
│   ├── risk_scoring.py         # Risk scoring engine
│   ├── models.py               # Database models
│   ├── schemas.py              # Pydantic schemas
│   └── utils.py                # Utility functions
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main dashboard
│   │   │   ├── layout.tsx      # Root layout
│   │   │   └── globals.css     # Global styles
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── charts/         # TradingView & ECharts
│   │   │   ├── graph/          # Cytoscape visualization
│   │   │   ├── alerts/         # Alert components
│   │   │   └── timeline/       # Timeline components
│   │   ├── lib/
│   │   │   ├── api.ts          # API client
│   │   │   └── utils.ts        # Frontend utilities
│   │   └── hooks/
│   │       └── useWebSocket.ts # WebSocket hook
├── data/
│   ├── trade_data.csv          # Sample trade data
│   ├── processed_data.json     # Ingested and processed data
│   ├── flagged_alerts.json     # Detected suspicious patterns
│   └── triaged_alerts.json     # AI triage results
├── patterns/
│   ├── layering.py             # Layering pattern detection
│   ├── spoofing.py             # Spoofing pattern detection
│   ├── wash_trading.py         # Wash trading detection
│   └── pump_dump.py            # Pump and dump detection
├── workflows/
│   ├── jira_integration.py     # Jira case creation
│   ├── slack_notifier.py       # Slack notifications
│   ├── watchlist.py            # Watchlist management
│   └── auto_enforcement.py     # Automated enforcement
├── graph/
│   ├── neo4j_client.py         # Neo4j graph database client
│   ├── graph_builder.py        # Graph construction
│   └── graph_analytics.py      # Graph algorithms
├── tests/
│   ├── test_ingest.py
│   ├── test_detection.py
│   ├── test_triage.py
│   └── test_graph.py
└── scripts/
    ├── generate_synthetic_data.py  # Synthetic trade data generator
    └── setup_db.py                 # Database setup script
```

## 🔍 Suspicious Patterns Detected

### 1. Layering / Order Book Manipulation
- Large visible orders placed to create false impression of demand
- Orders cancelled before execution
- Profit taken on opposite side of the book

### 2. Spoofing
- Non-bona fide orders placed on one side
- Intent to cancel before execution
- Actual trades executed on opposite side

### 3. Wash Trading
- Simultaneous buy and sell orders
- No change in beneficial ownership
- Artificial volume inflation

### 4. Pump and Dump
- Artificial price inflation through coordinated buying
- Subsequent selling at inflated prices
- Social media manipulation patterns

## 🚀 Innovative Features

### 1. Interactive Graph-Based Investigation Engine
- **Cytoscape.js** powered entity relationship visualization
- Zoomable, clickable, and expandable nodes
- Real-time graph expansion on investigation
- Multi-layer timeline visualization
- Entity connections: Trader → Broker → Orders → Instruments → IP/Device

### 2. AI-Powered Root Cause Analysis (RCA)
- Claude-generated incident explanations
- Behavioral anomaly detection with sigma deviations
- Attack evolution timeline reconstruction
- Financial impact assessment
- Recommended enforcement actions

### 3. Live Attack Replay Mode
- Animated playback of suspicious trading activity
- Time-based order book visualization
- Price movement reconstruction
- Cancellation pattern visualization
- Like cybersecurity attack replay for trades

### 4. Behavioral Fingerprinting
- Trader behavior profile generation
- Baseline deviation detection (e.g., +6σ from normal)
- Trading style learning
- Instrument and timing pattern analysis
- Risk score computation based on behavior

### 5. AI Compliance Copilot
- Conversational investigation interface
- Natural language queries: "Why was this flagged?"
- Related trader discovery
- Similar incident finding
- One-click regulatory report generation

### 6. Risk Heatmaps
- High-risk trader visualization
- Most manipulated instruments
- Time-based anomaly clustering
- Suspicious broker network detection
- Color-coded severity (Red/Yellow/Green)

### 7. Connected Entity Detection
- Multi-account IP correlation
- Same broker pattern detection
- Device fingerprint matching
- Timing behavior analysis
- Collusion network uncovering

### 8. Smart Enforcement Engine
- Automatic account freezing on high confidence
- Trading limit reduction
- Enhanced monitoring periods
- Compliance team escalation
- Regulator notification automation

### 9. Real-Time Dashboard
- **TradingView Lightweight Charts** for professional financial visualization
- Live alert streaming via WebSockets
- Multi-panel investigation interface
- Severity heatmaps and trend analysis
- Watchlist management system

## 🤖 AI Triage (Claude API)

The system uses Anthropic Claude API to analyze flagged alerts and provide:
- **Triage Verdict**: ESCALATE or DISMISS
- **Confidence Score**: Probability assessment (0-100%)
- **Rationale**: Human-readable explanation of the decision
- **Supporting Evidence**: Statistical analysis and pattern matching

### Example Output
```
Alert ID: TRD-2026-0042
Severity: HIGH
Detected Pattern: Layering / Order Book Manipulation

AI Triage (Claude):
The order pattern is consistent with layering: large visible orders inflate
perceived demand, inducing price movement, before cancellation enables a
profitable sell-side fill.
Cancellation ratio: 85.7% | Time-to-cancel median: 620 ms

Triage Verdict: ESCALATE
Detection Confidence: 91%
False Positive Probability: 9%
```

## ⚡ Automated Escalation Workflows

### 1. Compliance Case Creation
- Automatic Jira ticket generation
- Assignment to appropriate surveillance desk
- Priority based on severity and confidence

### 2. Slack Notifications
- Real-time alert digests to compliance channels
- Trader watchlist updates
- Escalation to management for high-severity cases

### 3. Watchlist Management
- Automatic trader flagging
- Enhanced monitoring periods
- Historical pattern tracking

## 🔧 Configuration

Edit `.env` file to configure:

```env
# API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/trade_surveillance
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Integration APIs
JIRA_API_URL=https://your-jira-instance.com
JIRA_API_TOKEN=your_jira_token
JIRA_EMAIL=your_jira_email
SLACK_WEBHOOK_URL=your_slack_webhook_url

# Streaming
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_TOPIC_TRADES=trade_events
KAFKA_TOPIC_ALERTS=suspicious_alerts

# Application
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=INFO

# Detection Thresholds
LAYERING_CANCEL_RATIO_THRESHOLD=0.8
LAYERING_CANCEL_TIME_THRESHOLD=1000  # milliseconds
SPOOFING_ORDER_COUNT_THRESHOLD=10
WASH_TRADING_MATCH_THRESHOLD=0.95

# Risk Scoring
HIGH_RISK_THRESHOLD=0.8
MEDIUM_RISK_THRESHOLD=0.5
```

## 📊 Data Format

### Trade Data CSV Format
```csv
timestamp,trader_id,instrument,order_type,quantity,price,side,status
2026-05-09 09:44:12,T-4821,HDFCBANK,LIMIT,50000,1450.50,BUY,FILLED
2026-05-09 09:44:15,T-4821,HDFCBANK,LIMIT,50000,1450.75,BUY,CANCELLED
```

## 🧪 Testing

```bash
# Run all tests
python -m pytest tests/

# Run specific test
python -m pytest tests/test_detection.py
```

## 📈 Performance Optimization

- **Batch Processing**: Process multiple alerts in single API calls
- **Caching**: Cache common analysis patterns and graph queries
- **Token Efficiency**: Optimized prompts to minimize API costs
- **Async Processing**: Parallel pattern detection and triage with Celery
- **WebSocket Streaming**: Real-time updates without polling
- **Graph Query Optimization**: Neo4j indexing and query optimization
- **Database Connection Pooling**: SQLAlchemy connection pooling
- **Frontend Code Splitting**: Next.js dynamic imports for faster loading

## 🔌 API Endpoints

### Trade Data
- `POST /api/v1/trades/ingest` - Ingest trade data
- `GET /api/v1/trades/stream` - WebSocket stream for live trades
- `GET /api/v1/trades/{trader_id}` - Get trader history

### Pattern Detection
- `POST /api/v1/detect/analyze` - Run pattern detection
- `GET /api/v1/detect/patterns` - List detected patterns
- `GET /api/v1/detect/alerts` - Get flagged alerts

### AI Triage
- `POST /api/v1/triage/analyze` - Analyze alert with Claude
- `GET /api/v1/triage/{alert_id}` - Get triage result
- `POST /api/v1/triage/batch` - Batch triage multiple alerts

### Graph Intelligence
- `GET /api/v1/graph/entities/{entity_id}` - Get entity graph
- `POST /api/v1/graph/expand` - Expand graph relationships
- `GET /api/v1/graph/paths` - Find shortest paths between entities
- `GET /api/v1/graph/communities` - Detect fraud communities

### Risk Scoring
- `GET /api/v1/risk/trader/{trader_id}` - Get trader risk score
- `GET /api/v1/risk/instrument/{instrument}` - Get instrument risk
- `GET /api/v1/risk/heatmap` - Get risk heatmap data

### Workflows
- `POST /api/v1/workflows/escalate` - Trigger escalation workflow
- `POST /api/v1/workflows/jira` - Create Jira ticket
- `POST /api/v1/workflows/slack` - Send Slack notification
- `POST /api/v1/workflows/enforce` - Trigger enforcement actions

### Investigation
- `POST /api/v1/investigation/rca` - Generate Root Cause Analysis
- `POST /api/v1/investigation/replay` - Generate attack replay
- `POST /api/v1/investigation/query` - AI-powered investigation query
- `GET /api/v1/investigation/report` - Generate regulatory report

## 🤝 Contributing

This is a hackathon project. For contributions:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

Confidential – For Wissen Technology Hackathon 2026 Participants Only

---

**Built for Wissen Technology Hackathon 2026**
