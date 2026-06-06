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
```

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Anthropic Claude API key
- pip

### Installation

```bash
# Clone the repository
git clone https://github.com/r04nx-w/trade-threat-intelligence.git
cd trade-threat-intelligence

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your Claude API key
```

### Running the System

```bash
# Run the full pipeline
python main.py --input data/trade_data.csv

# Run individual components
python ingest_data.py --input data/trade_data.csv
python detect_patterns.py --input data/processed_data.json
python triage_alerts.py --input data/flagged_alerts.json
python escalate_workflows.py --input data/triaged_alerts.json
```

## 📁 Project Structure

```
trade-threat-intelligence/
├── README.md
├── requirements.txt
├── .env.example
├── main.py                 # Main pipeline orchestrator
├── ingest_data.py          # Trade data ingestion module
├── detect_patterns.py      # Suspicious pattern detection
├── triage_alerts.py        # AI-driven alert triage
├── escalate_workflows.py   # Automated escalation workflows
├── data/
│   ├── trade_data.csv      # Sample trade data
│   ├── processed_data.json # Ingested and processed data
│   ├── flagged_alerts.json # Detected suspicious patterns
│   └── triaged_alerts.json # AI triage results
├── patterns/
│   ├── layering.py         # Layering pattern detection
│   ├── spoofing.py         # Spoofing pattern detection
│   └── wash_trading.py     # Wash trading detection
├── workflows/
│   ├── jira_integration.py # Jira case creation
│   ├── slack_notifier.py   # Slack notifications
│   └── watchlist.py        # Watchlist management
└── tests/
    ├── test_ingest.py
    ├── test_detection.py
    └── test_triage.py
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
ANTHROPIC_API_KEY=your_api_key_here
JIRA_API_URL=https://your-jira-instance.com
JIRA_API_TOKEN=your_jira_token
SLACK_WEBHOOK_URL=your_slack_webhook_url
LOG_LEVEL=INFO
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
- **Caching**: Cache common analysis patterns
- **Token Efficiency**: Optimized prompts to minimize API costs
- **Async Processing**: Parallel pattern detection and triage

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
