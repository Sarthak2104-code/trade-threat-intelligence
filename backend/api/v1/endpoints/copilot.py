"""
Compliance Copilot Endpoint
AI-powered chat interface for compliance analysts investigating suspicious trading alerts.
"""

import os
import json
import logging
import anthropic

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List

logger = logging.getLogger(__name__)

router = APIRouter()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

SYSTEM_PROMPT = (
    "You are an AI compliance copilot for a financial trade surveillance system. "
    "You help compliance analysts investigate suspicious trading alerts. "
    "Be concise, precise and actionable. "
    "Always refer to specific data points from the alert context when available."
)


class CopilotRequest(BaseModel):
    question: str
    alert_context: Optional[dict] = None


class CopilotResponse(BaseModel):
    answer: str
    sources: List[str]


def _rule_based_response(question: str) -> str:
    """Keyword-driven fallback when Claude is unavailable."""
    q = question.lower()

    if "spoof" in q:
        return (
            "Spoofing indicators to investigate: (1) Large orders placed and cancelled "
            "within milliseconds before a price move. (2) Order-to-trade ratio significantly "
            "above the trader's historical average. (3) Consistent pattern of orders on one "
            "side that disappear once the opposing side executes. Review the order book "
            "snapshots and cancellation timestamps in the alert context."
        )
    elif "wash" in q:
        return (
            "Wash trade indicators to investigate: (1) Buyer and seller share the same "
            "beneficial owner or are closely affiliated entities. (2) Trades executed at "
            "off-market prices with no net position change. (3) Circular trading patterns "
            "across multiple accounts. Cross-reference counterparty IDs and account "
            "ownership records."
        )
    elif "front run" in q or "front-run" in q or "insider" in q:
        return (
            "Front-running / insider trading indicators: (1) Unusual position buildup "
            "immediately before a material announcement. (2) Trader had access to "
            "non-public information (check information barrier logs). (3) Profitability "
            "spike that is statistically anomalous relative to the trader's own history. "
            "Correlate trade timestamps with news/announcement timestamps."
        )
    elif "layering" in q:
        return (
            "Layering indicators: (1) Multiple orders placed at different price levels to "
            "create artificial depth on one side of the book. (2) Orders cancelled in rapid "
            "succession after a smaller opposing order executes. (3) Net position at end of "
            "episode is flat or minimal. Examine the order book depth over the alert window."
        )
    elif "volume" in q or "unusual" in q:
        return (
            "For unusual volume alerts: (1) Compare traded volume to the 30-day average "
            "daily volume for the instrument. (2) Check whether volume spike aligns with "
            "any public news, earnings, or macro events. (3) Identify whether the activity "
            "is concentrated in a small number of accounts. Use the instrument and "
            "timestamp fields from the alert context."
        )
    else:
        return (
            "To investigate this alert, focus on: (1) Volume and timing — is the activity "
            "clustered around a specific event? (2) Counterparty relationships — are the "
            "same parties appearing repeatedly? (3) Price impact — did the trading "
            "materially move the market? (4) Historical baseline — how does this compare "
            "to the trader's normal behaviour? Pull the full order and trade blotter for "
            "the flagged time window."
        )


@router.post("/chat", response_model=CopilotResponse)
async def chat(request: CopilotRequest):
    """
    AI compliance copilot chat endpoint.
    Accepts a compliance question and optional alert context, returns an AI-generated answer.
    Falls back to rule-based guidance if Claude is unavailable.
    """
    sources: List[str] = []

    # Build the user message
    if request.alert_context:
        context_block = json.dumps(request.alert_context, indent=2, default=str)
        user_message = (
            f"Alert Context:\n```json\n{context_block}\n```\n\n"
            f"Question: {request.question}"
        )
        sources = ["alert_context"]
    else:
        user_message = request.question

    # Attempt Claude response
    try:
        if not ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY is not set")

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": user_message}
            ],
        )

        answer = message.content[0].text
        logger.info("Claude response received successfully")
        return CopilotResponse(answer=answer, sources=sources)

    except Exception as e:
        logger.warning(f"Claude unavailable, using rule-based fallback: {e}")
        fallback_answer = _rule_based_response(request.question)
        return CopilotResponse(answer=fallback_answer, sources=["rule_based_fallback"])
