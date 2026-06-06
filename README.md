# Trade Threat Intelligence Project

**Trade Surveillance & Alert Triage Engine**

Monitors trading activity in real time, detects suspicious patterns using AI, and auto-triages alerts to cut false positives for compliance teams.

---

## Hackathon Details

- **Event**: Wissen Technology Hackathon 2026
- **Duration**: Friday 6 PM – Sunday 4 PM (June 4 – 6, 2026)
- **Domain**: Financial Services / Capital Markets – Trade Surveillance & Compliance
- **LLM Stack**: Anthropic Claude API
- **Team Size**: 3 – 4 members

---

## Overview

Financial firms generate thousands of trade surveillance alerts daily — the vast majority are false positives that drain compliance analyst time and delay genuine escalations. This AI-powered surveillance assistant ingests simulated trade and order data, detects potentially suspicious patterns, uses Claude to reason over flagged events and produce a human-readable triage verdict, and triggers automated downstream workflows to route genuine alerts to the right teams.

---

## Core Deliverables

### Task 1 – Trade Data Ingestion
Build a pipeline to ingest order and trade event data. The system must support loading a dataset of transactions and replaying them for demonstration purposes.

### Task 2 – Suspicious Pattern Detection
Detect anomalous or potentially manipulative trading behaviour from the ingested data. The system must identify and flag at least two distinct types of suspicious patterns with a severity classification.

### Task 3 – AI-Driven Alert Triage
For each flagged event, use the Anthropic Claude API to analyse the alert, assess whether it represents genuine misconduct or a false positive, and produce a clear human-readable verdict with a confidence score and supporting rationale.

### Task 4 – Automated Escalation Workflows
On completion of triage, automatically trigger at least two downstream actions — such as creating a compliance case, sending a notification, or updating a watchlist — based on the severity and confidence of the alert.

---

## Example System Output

```
Alert ID: TRD-2026-0042
Timestamp: 2026-05-09 09:47:33 UTC
Trader: T-4821
Instrument: HDFC Bank (NSE: HDFCBANK)
Severity: HIGH
Detected Pattern: Layering / Order Book Manipulation

Trader placed 14 large buy orders (avg 50,000 shares) between 09:44–09:47
12 of 14 orders cancelled within 800 ms of placement
2 sell orders executed at elevated price during cancellation window

AI Triage (Claude):
The order pattern is consistent with layering: large visible orders inflate perceived demand, inducing price movement, before cancellation enables a profitable sell-side fill.
Cancellation ratio: 85.7% | Time-to-cancel median: 620 ms | Anomaly vs 30-day baseline: +4.2σ

Triage Verdict: ESCALATE
Detection Confidence: 91%
False Positive Probability: 9%

Automated Actions Triggered:
1. Compliance case created — Jira: COMP-8812 assigned to Surveillance Desk L2
2. Alert digest sent to #compliance-alerts Slack channel
3. Trader T-4821 flagged in watchlist for 72-hr enhanced monitoring
```

---

## Evaluation Criteria

| Criteria | Description | Weight |
|----------|-------------|--------|
| AI Triage Quality | Accuracy of Claude-generated triage verdicts, confidence scores, and plain-English reasoning | 25% |
| Pattern Detection | Coverage and precision of suspicious pattern detection; false positive suppression rate | 20% |
| Automation & Workflow | Effectiveness of post-triage escalation actions and end-to-end pipeline reliability | 20% |
| Working Demo | Live replay of a complete scenario: ingest → detect → triage → escalate | 20% |
| API Efficiency | Minimal and purposeful Claude API calls; prompt quality and token cost awareness | 10% |
| Docs / README | Clarity of markdown documentation, architecture diagram, and setup instructions | 5% |

---

## Architecture

```
┌─────────────────┐
│  Trade Data     │
│  Ingestion      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pattern        │
│  Detection      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Triage      │
│  (Claude API)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Automated      │
│  Escalation     │
└─────────────────┘
```

---

## Setup Instructions

### Prerequisites
- Python 3.9+
- Anthropic Claude API key
- Git

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

---

## Project Structure

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

---

## Suspicious Patterns Detected

1. **Layering / Order Book Manipulation**
   - Large visible orders placed to create false impression of demand
   - Orders cancelled before execution
   - Profit taken on opposite side of the book

2. **Spoofing**
   - Non-bona fide orders placed on one side
   - Intent to cancel before execution
   - Actual trades executed on opposite side

3. **Wash Trading**
   - Simultaneous buy and sell orders
   - No change in beneficial ownership
   - Artificial volume inflation

---

## Automated Escalation Workflows

1. **Compliance Case Creation**
   - Automatic Jira ticket generation
   - Assignment to appropriate surveillance desk
   - Priority based on severity and confidence

2. **Slack Notifications**
   - Real-time alert digests to compliance channels
   - Trader watchlist updates
   - Escalation to management for high-severity cases

3. **Watchlist Management**
   - Automatic trader flagging
   - Enhanced monitoring periods
   - Historical pattern tracking

---

## API Usage

The system uses the Anthropic Claude API efficiently with:
- Minimal token usage through targeted prompts
- Batch processing for multiple alerts
- Caching of common analysis patterns
- Cost-aware prompt engineering

---

## Contributing

This is a hackathon project. For contributions:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

## License

Confidential – For Wissen Technology Hackathon 2026 Participants Only

---

## Team

- [Team Member 1]
- [Team Member 2]
- [Team Member 3]
- [Team Member 4]

---

**Wissen Technology Hackathon 2026**
