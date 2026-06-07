# Trade Threat Intelligence
> **AI-powered Trade Surveillance & Alert Triage Engine**
> Built for Wissen Technology Hackathon 2026

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | FastAPI · Python 3.9+ · SQLAlchemy · SQLite (dev) / PostgreSQL (prod) · Uvicorn · Pydantic |
| **AI / Triage** | Anthropic Claude API (claude-sonnet-4) |
| **Frontend** | React + TypeScript · Vite · TailwindCSS · Cytoscape.js · TradingView Lightweight Charts |
| **Alert Channels** | Telegram Bot API · SMTP · Jira REST API · Microsoft Teams Webhooks |
| **Datasets** | 7 Indian stock ISINs — RELIANCE, HDFCBANK, ICICIBANK, LT, TATAELXSI, HINDUNILVR, SUNPHARMA (raw tick-level CSV) |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Data Flow](#3-data-flow)
4. [Backend Module Breakdown](#4-backend-module-breakdown)
5. [API Endpoint Structure](#5-api-endpoint-structure)
6. [Pattern Detection Flow](#6-pattern-detection-flow)
7. [AI Triage Flow (Claude API)](#7-ai-triage-flow-claude-api)
8. [WebSocket Market Data Stream](#8-websocket-market-data-stream)
9. [Alert Channel Dispatch Flow](#9-alert-channel-dispatch-flow)
10. [Exchange State & Order Flow](#10-exchange-state--order-flow)
11. [Database Schema](#11-database-schema)
12. [Configuration Reference](#12-configuration-reference)

---

## 1. System Overview

The system monitors real-time trading activity, detects suspicious market manipulation patterns using rule-based and ML approaches, and uses **Anthropic Claude API** to triage alerts — reducing false positives for compliance teams. Genuine alerts are escalated through automated channels (Telegram, SMTP, Jira, Microsoft Teams).

**Core capabilities:**
- Real-time tick-level ingestion from 7 Indian equities
- Six manipulation pattern detectors (Layering, Spoofing, Wash Trading, Pump & Dump, Insider Trading, Quote Stuffing)
- Claude-powered AI triage with confidence scoring and RCA generation
- Multi-channel alert dispatch (Telegram, Email, Jira, MS Teams)
- WebSocket live market stream with exchange-state simulation

---

## 2. High-Level Architecture

```mermaid
flowchart TD
    A[Trade Data\nCSV Datasets] -->|Load on demand| B[Dataset Cache\nin-memory]
    B -->|tick stream| C[WebSocket\nws/market-data]
    C -->|real-time ticks| D[React Frontend\nDashboard]

    E[Exchange State\nSimulator] -->|mutate_market_stream| C
    E -->|market depth| C

    D -->|HTTP POST| F[FastAPI Backend\nmain.py]

    F --> G[api/v1/trades]
    F --> H[api/v1/detect]
    F --> I[api/v1/triage]
    F --> J[api/v1/orders]
    F --> K[api/v1/channels]

    H -->|detected patterns| I
    I -->|Claude API call| L[Anthropic Claude]
    L -->|verdict + rationale| I

    I -->|ESCALATE| M[Alert Channels]
    M --> N[Telegram Bot]
    M --> O[SMTP Email]
    M --> P[Jira Ticket]
    M --> Q[MS Teams Webhook]

    F --> R[(SQLite DB\ntrade_surveillance.db)]
    G & H & I & J & K --> R
```

---

## 3. Data Flow

```mermaid
flowchart LR
    DS[(CSV Datasets\n7 Indian stocks\nINE codes)] -->|pd.read_csv| Cache
    Cache -->|records list| StreamTask

    subgraph WebSocket Loop
        StreamTask -->|per tick| MutateStep
        MutateStep -->|modified record| DepthStep
        DepthStep -->|JSON send| WS[WebSocket\nclient]
    end

    WS -->|subscribe/unsubscribe/ping| StreamTask

    subgraph Backend Persistence
        OrdersAPI -->|INSERT| OrdersTable
        DetectionAPI -->|INSERT/UPDATE| IncidentsTable
        TriageAPI -->|UPDATE rca field| IncidentsTable
        ChannelsAPI -->|UPDATE| ChannelsTable
        TradersAPI -->|CRUD| TradersTable
    end
```

---

## 4. Backend Module Breakdown

| Module | Responsibility |
|---|---|
| `main.py` | FastAPI app entrypoint, lifespan, WebSocket handler, CORS, routing |
| `config.py` | Settings via `pydantic_settings`, `.env` file loading |
| `db.py` | SQLite engine + ORM models (SQLAlchemy + raw sqlite3), `get_system_context_for_claude()` |
| `exchange_state.py` | `ExchangeState` singleton — `mutate_market_stream()`, `get_market_depth()`, `set_scenario()` |
| `trades.py` | Trade ingestion, trader history |
| `detection.py` | Pattern detection, Incident CRUD, Trader CRUD, Policy CRUD, Event log |
| `triage.py` | Claude API triage, RCA generation, report generation, investigation queries |
| `orders.py` | Place orders, order history, trigger scenarios, positions tracking |
| `channels.py` | Channel config CRUD, test connections, dispatch alerts (Telegram, SMTP, Jira, Teams) |

---

## 5. API Endpoint Structure

| Group | Endpoints |
|---|---|
| **Trades** | `POST /ingest` · `GET /stream` · `GET /{trader_id}` |
| **Detection** | `POST /analyze` · `GET /patterns` · `GET /alerts` · `GET\|POST /incidents` · `GET\|POST /traders` · `GET\|POST /policies` · `GET /events` |
| **Triage** | `POST /analyze` · `GET /{alert_id}` · `POST /batch` · `POST /rca` · `POST /report` · `POST /query` |
| **Orders** | `POST /place` · `GET /history` · `POST /trigger-scenario` · `GET /positions` |
| **Channels** | `GET /list` · `POST /configure` · `POST /test` · `POST /dispatch` |

---

## 6. Pattern Detection Flow

```mermaid
flowchart TD
    Start([POST detect/analyze]) --> Input[DetectionRequest\ninstrument_id · start_time · end_time · patterns list]

    Input --> LoadData[Load trade data\nfrom cache or CSV]
    LoadData --> WindowFilter[Apply time window filter]

    WindowFilter --> Fork{Run pattern checks}

    Fork --> L[Layering\ncancel_ratio gt 0.8\ncancel_time lt 1000ms]
    Fork --> S[Spoofing\norder_count gt 10\ncancel_ratio gt 0.7]
    Fork --> W[Wash Trading\nprice match gt 0.95\ntime window 300s]
    Fork --> P[Pump and Dump\nvolume spike gt 5x\nprice change gt 5pct]
    Fork --> IT[Insider Trading]
    Fork --> QS[Quote Stuffing]

    L & S & W & P & IT & QS --> Score[Compute confidence score per pattern]

    Score --> Severity{Severity classification}
    Severity --> LOW[LOW — score lt 0.3]
    Severity --> MED[MEDIUM — 0.3 to 0.5]
    Severity --> HIGH[HIGH — 0.5 to 0.8]
    Severity --> CRIT[CRITICAL — score gt 0.8]

    LOW & MED & HIGH & CRIT --> SaveIncident[Save to incidents table in SQLite]
    SaveIncident --> ReturnAlerts([Return DetectedPattern list])
```

---

## 7. AI Triage Flow (Claude API)

```mermaid
flowchart TD
    Start([POST triage/analyze]) --> Req[TriageRequest\nalert_id · pattern_type · evidence · instrument · llm_provider · api_key]

    Req --> Check{api_key provided?}

    Check -- No --> Fallback[Return synthetic fallback response]
    Check -- Yes --> GetCtx[get_system_context_for_claude\nfrom SQLite: system event logs tail + active trader list]

    GetCtx --> Prompt[Build prompt:\nAlert details · Evidence JSON\nSystem logs · Trader accounts]

    Prompt --> Claude[anthropic.Anthropic\nclient.messages.create\nmodel: claude-sonnet-4]

    Claude --> ParseJSON[Parse JSON response:\nverdict: ESCALATE or DISMISS\nconfidence score\nfalse_positive_probability\nrationale · recommendations]

    ParseJSON --> SaveRCA[Update incident.rca in SQLite if ESCALATE]
    SaveRCA --> Return([Return TriageResult])

    Fallback --> Return
```

---

## 8. WebSocket Market Data Stream

```mermaid
sequenceDiagram
    participant Client as React Frontend
    participant WS as /ws/market-data
    participant Cache as Dataset Cache
    participant ES as ExchangeState

    Client->>WS: connect
    WS-->>Client: accepted

    Client->>WS: {"action":"subscribe","instrument":"INE002A01018","speed":10}
    WS->>Cache: get_dataset(instrument_id)
    Cache-->>WS: List[dict] records
    WS-->>Client: {"type":"subscription","status":"subscribed"}

    loop For each tick record
        WS->>ES: mutate_market_stream(record, instrument)
        ES-->>WS: mutated record (with anomaly if scenario active)
        WS->>ES: get_market_depth(instrument)
        ES-->>WS: depth snapshot
        WS-->>Client: {"type":"tick","data":record,"depth":depth}
        Note over WS: sleep = time_diff / speed_multiplier (max 2s)
    end

    Client->>WS: {"action":"unsubscribe","instrument":"INE002A01018"}
    WS-->>Client: {"type":"subscription","status":"unsubscribed"}
    Client->>WS: disconnect
    WS->>WS: cleanup task + connection
```

---

## 9. Alert Channel Dispatch Flow

```mermaid
flowchart TD
    Trigger([POST channels/dispatch]) --> LoadCfg[Load enabled channels\nfrom alert_channels table · parse JSON config]

    LoadCfg --> ForEach{For each enabled channel}

    ForEach --> TG[Telegram\nPOST to Bot API\nwith chat_id]
    ForEach --> SMTP[SMTP Email\nsmtplib + TLS\nfrom · to · subject · body]
    ForEach --> Jira[Jira\nPOST rest/api/2/issue\nBasic or Bearer auth]
    ForEach --> Teams[MS Teams\nPOST Webhook URL\nAdaptive Card JSON]

    TG & SMTP & Jira & Teams --> Result[Collect success / failure per channel]
    Result --> Return([Return dispatch summary])
```

---

## 10. Exchange State & Order Flow

```mermaid
flowchart TD
    subgraph ScenarioTrigger
        TrigReq([POST orders/trigger-scenario]) --> SetScenario[exchange_state.set_scenario\npattern_type + parameters]
        SetScenario --> Active[active_scenario stored\nin ExchangeState singleton]
    end

    subgraph OrderPlacement
        OrderReq([POST orders/place]) --> Validate[Validate OrderRequest]
        Validate --> InsertDB[INSERT into orders table SQLite]
        InsertDB --> AddBuffer[exchange_state.events_buffer append record]
        AddBuffer --> CheckPattern[Check buffer for pattern match]
        CheckPattern --> AlertCheck{Pattern detected?}
        AlertCheck -- Yes --> DedupCheck{In recent_alerts\nwithin 20s?}
        DedupCheck -- No --> SaveIncident[Save to incidents table]
        DedupCheck -- Yes --> Skip[Skip duplicate]
        AlertCheck -- No --> Done([Return order ID])
        SaveIncident --> Done
    end

    subgraph MarketMutation
        Tick[Incoming tick from CSV] --> MutateCheck{active_scenario set?}
        MutateCheck -- Yes --> ApplyPattern[Apply pattern:\nSpoofing: inflate depth\nLayering: add ghost orders\nWash: duplicate side\nPump-Dump: spike price]
        MutateCheck -- No --> PassThrough[Pass tick unchanged]
        ApplyPattern & PassThrough --> Out[Mutated tick to WebSocket]
    end
```

---

## 11. Database Schema

```mermaid
erDiagram
    TRADERS {
        string trader_id PK
        string name
        string role
        string sector
        string status
    }

    INCIDENTS {
        string id PK
        string symbol
        string pattern
        string severity
        string timestamp
        string status
        float confidence
        text evidence
        text rca
        text report_content
    }

    EVENTS {
        int id PK
        string timestamp
        text message
    }

    POLICIES {
        string id PK
        string name
        string description
        string status
        text rules
    }

    ANOMALY_INJECTIONS {
        int id PK
        string pattern_type
        string instrument
        string timestamp
        text parameters
    }

    ORDERS {
        int id PK
        string timestamp
        string instrument
        string symbol
        string side
        string order_type
        int quantity
        float price
        float total_value
        string status
        string trader_id
        string trader_name
        string note
    }

    ALERT_CHANNELS {
        string channel_type PK
        bool enabled
        text config
    }
```

---

## 12. Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for Claude triage |
| `DATABASE_URL` | SQLite local | PostgreSQL URL for production |
| `LAYERING_CANCEL_RATIO_THRESHOLD` | `0.8` | Cancel ratio to flag layering |
| `LAYERING_CANCEL_TIME_THRESHOLD` | `1000` ms | Max time before cancel = suspicious |
| `SPOOFING_ORDER_COUNT_THRESHOLD` | `10` | Min orders for spoofing signal |
| `WASH_TRADING_MATCH_THRESHOLD` | `0.95` | Price match ratio for wash trades |
| `PUMP_DUMP_VOLUME_SPIKE_THRESHOLD` | `5.0x` | Volume spike multiplier |
| `HIGH_RISK_THRESHOLD` | `0.8` | Score above → HIGH risk |
| `REPLAY_SPEED_MULTIPLIER` | `10.0` | WebSocket stream speed |
| `WS_MAX_CONNECTIONS` | `100` | Max concurrent WebSocket clients |
| `JIRA_API_URL` | optional | Jira instance base URL |
| `SLACK_WEBHOOK_URL` | optional | Slack incoming webhook |
