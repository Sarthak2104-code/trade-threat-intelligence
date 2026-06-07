from dotenv import load_dotenv
load_dotenv()

"""
Workflows Endpoint
Handles alert escalation workflows, Slack notifications, and trader watchlist management.
"""

import os
import logging
import httpx
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter()

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

# In-memory watchlist: { trader_id: { "timestamp": ..., "alert_id": ... } }
watchlist: dict = {}


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class SlackNotifyRequest(BaseModel):
    alert_id: str
    verdict: str          # "ESCALATE" | "DISMISS"
    confidence: float     # 0.0 – 1.0
    pattern_type: str
    instrument: str
    trader_id: str
    rationale: str


class EscalateRequest(BaseModel):
    alert_id: str
    verdict: str
    confidence: float
    pattern_type: str
    instrument: str
    trader_id: str
    rationale: str
    severity: str         # "HIGH" | "MEDIUM" | "LOW"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_slack_blocks(
    alert_id: str,
    verdict: str,
    confidence: float,
    pattern_type: str,
    instrument: str,
    trader_id: str,
    rationale: str,
) -> list:
    """Build Slack Block Kit payload for an alert notification."""
    header_emoji = "🚨 ESCALATE" if verdict.upper() == "ESCALATE" else "✅ DISMISS"
    confidence_pct = f"{round(confidence * 100)}%"

    return [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": header_emoji,
                "emoji": True,
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Alert ID:*\n{alert_id}"},
                {"type": "mrkdwn", "text": f"*Pattern Type:*\n{pattern_type}"},
                {"type": "mrkdwn", "text": f"*Instrument:*\n{instrument}"},
                {"type": "mrkdwn", "text": f"*Trader ID:*\n{trader_id}"},
                {"type": "mrkdwn", "text": f"*Confidence:*\n{confidence_pct}"},
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Rationale:*\n{rationale}",
            },
        },
    ]


async def _send_slack_notification(
    alert_id: str,
    verdict: str,
    confidence: float,
    pattern_type: str,
    instrument: str,
    trader_id: str,
    rationale: str,
) -> dict:
    """
    Core Slack send logic, shared by /slack/notify and /escalate.
    Returns a status dict.
    """
    if not SLACK_WEBHOOK_URL:
        logger.warning("SLACK_WEBHOOK_URL is not configured — skipping Slack notification")
        return {"status": "skipped", "reason": "SLACK_WEBHOOK_URL not configured"}

    blocks = _build_slack_blocks(
        alert_id=alert_id,
        verdict=verdict,
        confidence=confidence,
        pattern_type=pattern_type,
        instrument=instrument,
        trader_id=trader_id,
        rationale=rationale,
    )

    payload = {"blocks": blocks}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(SLACK_WEBHOOK_URL, json=payload)
            response.raise_for_status()
            logger.info(f"Slack notification sent for alert {alert_id} (verdict={verdict})")
            return {"status": "sent", "alert_id": alert_id, "verdict": verdict}
    except httpx.HTTPStatusError as e:
        logger.error(f"Slack webhook returned HTTP error: {e.response.status_code} — {e.response.text}")
        return {"status": "error", "reason": f"Slack HTTP {e.response.status_code}"}
    except httpx.RequestError as e:
        logger.error(f"Slack webhook request failed: {e}")
        return {"status": "error", "reason": str(e)}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/slack/notify")
async def slack_notify(request: SlackNotifyRequest):
    """
    Send an alert notification to the configured Slack webhook.
    If SLACK_WEBHOOK_URL is not set, returns a skipped status without error.
    """
    try:
        result = await _send_slack_notification(
            alert_id=request.alert_id,
            verdict=request.verdict,
            confidence=request.confidence,
            pattern_type=request.pattern_type,
            instrument=request.instrument,
            trader_id=request.trader_id,
            rationale=request.rationale,
        )
        return result
    except Exception as e:
        logger.error(f"Unexpected error in /slack/notify: {e}")
        return {"status": "error", "reason": str(e)}


@router.post("/escalate")
async def escalate(request: EscalateRequest):
    """
    Escalate an alert.
    - Sends a Slack notification for all escalations.
    - Adds the trader to the in-memory watchlist when severity is HIGH and verdict is ESCALATE.
    """
    try:
        slack_result = await _send_slack_notification(
            alert_id=request.alert_id,
            verdict=request.verdict,
            confidence=request.confidence,
            pattern_type=request.pattern_type,
            instrument=request.instrument,
            trader_id=request.trader_id,
            rationale=request.rationale,
        )

        watchlist_updated = False
        if request.severity.upper() == "HIGH" and request.verdict.upper() == "ESCALATE":
            watchlist[request.trader_id] = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "alert_id": request.alert_id,
            }
            watchlist_updated = True
            logger.info(
                f"Trader {request.trader_id} added to watchlist "
                f"(alert={request.alert_id}, severity={request.severity})"
            )

        return {
            "status": "ok",
            "alert_id": request.alert_id,
            "verdict": request.verdict,
            "severity": request.severity,
            "slack": slack_result,
            "watchlist_updated": watchlist_updated,
        }
    except Exception as e:
        logger.error(f"Unexpected error in /escalate: {e}")
        return {"status": "error", "reason": str(e)}


@router.get("/watchlist")
async def get_watchlist():
    """
    Return the current in-memory trader watchlist.
    """
    try:
        return {"watchlist": watchlist, "count": len(watchlist)}
    except Exception as e:
        logger.error(f"Unexpected error in /watchlist: {e}")
        return {"status": "error", "reason": str(e)}
