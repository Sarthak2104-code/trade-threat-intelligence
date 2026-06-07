"""
Workflows API Endpoints
Handles integrations with Slack and Alert Escalation logic
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os
import logging
import datetime
from typing import Optional, Dict

router = APIRouter()
logger = logging.getLogger(__name__)

# Module-level watchlist
watchlist = {}


class SlackNotifyRequest(BaseModel):
    alert_id: str
    verdict: str
    confidence: float
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
    severity: str


@router.post("/slack/notify")
async def slack_notify(request: SlackNotifyRequest):
    """
    Send a block-formatted message to Slack if SLACK_WEBHOOK_URL is configured.
    """
    slack_webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not slack_webhook_url:
        logger.warning("SLACK_WEBHOOK_URL is not configured.")
        return {"status": "skipped", "reason": "SLACK_WEBHOOK_URL not configured"}

    try:
        # Determine verdict text and emoji
        header_text = "🚨 ESCALATE" if request.verdict.upper() == "ESCALATE" else "✅ DISMISS"

        # Ensure confidence is expressed as a percentage string
        conf_pct = request.confidence * 100.0 if request.confidence <= 1.0 else request.confidence

        slack_payload = {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": header_text,
                        "emoji": True
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Alert ID:*\n{request.alert_id}"},
                        {"type": "mrkdwn", "text": f"*Pattern Type:*\n{request.pattern_type}"},
                        {"type": "mrkdwn", "text": f"*Instrument:*\n{request.instrument}"},
                        {"type": "mrkdwn", "text": f"*Trader ID:*\n{request.trader_id}"},
                        {"type": "mrkdwn", "text": f"*Confidence:*\n{conf_pct:.1f}%"}
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Rationale:*\n{request.rationale}"
                    }
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(slack_webhook_url, json=slack_payload, timeout=10.0)
            response.raise_for_status()

        return {"status": "success", "message": "Notification sent to Slack"}
    except Exception as e:
        logger.error(f"Error sending Slack notification: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/escalate")
async def escalate_alert(request: EscalateRequest):
    """
    Escalate an alert. If severity is HIGH and verdict is ESCALATE,
    trigger Slack alert and add trader to watchlist.
    """
    try:
        slack_status = None
        watchlist_added = False

        if request.severity.upper() == "HIGH" and request.verdict.upper() == "ESCALATE":
            # Call the slack notify logic
            slack_req = SlackNotifyRequest(
                alert_id=request.alert_id,
                verdict=request.verdict,
                confidence=request.confidence,
                pattern_type=request.pattern_type,
                instrument=request.instrument,
                trader_id=request.trader_id,
                rationale=request.rationale
            )
            slack_status = await slack_notify(slack_req)

            # Add trader_id to watchlist dict with timestamp and alert_id
            watchlist[request.trader_id] = {
                "timestamp": datetime.datetime.now().isoformat(),
                "alert_id": request.alert_id
            }
            watchlist_added = True

        return {
            "status": "success",
            "severity": request.severity,
            "verdict": request.verdict,
            "slack_status": slack_status,
            "watchlist_added": watchlist_added
        }
    except Exception as e:
        logger.error(f"Error in escalate endpoint: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/watchlist")
async def get_watchlist():
    """
    Get the current watchlist of high-risk traders.
    """
    return watchlist
