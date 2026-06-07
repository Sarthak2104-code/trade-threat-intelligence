"""
AI Triage API Endpoints
Handle Claude API integration for alert analysis and triage
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import anthropic
import os
import json

router = APIRouter()

# Module-level cache
triage_cache = {}


class TriageRequest(BaseModel):
    """Request model for AI triage"""
    alert_id: str
    pattern_type: str
    evidence: dict
    instrument: str
    timestamp: str


class TriageResult(BaseModel):
    """AI triage result model"""
    alert_id: str
    verdict: str  # ESCALATE or DISMISS
    confidence: float
    false_positive_probability: float
    rationale: str
    supporting_evidence: dict
    recommendations: List[str]


async def _process_triage_request(request: TriageRequest) -> dict:
    """Helper to process triage using cache, Claude API, or rule-based fallback"""
    if request.alert_id in triage_cache:
        return triage_cache[request.alert_id]

    triage_result = None
    try:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY is not configured")

        client = anthropic.AsyncAnthropic(api_key=api_key)

        user_prompt = (
            f"Analyze the following trading alert:\n"
            f"- Pattern Type: {request.pattern_type}\n"
            f"- Evidence: {json.dumps(request.evidence)}\n"
            f"- Instrument: {request.instrument}\n"
            f"- Timestamp: {request.timestamp}\n\n"
            f"Respond with a valid JSON object containing these fields:\n"
            f"- verdict: ESCALATE or DISMISS\n"
            f"- confidence: float between 0 and 1\n"
            f"- false_positive_probability: float between 0 and 1\n"
            f"- rationale: string explaining the decision\n"
            f"- recommendations: list of strings for next steps"
        )

        response = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            system=(
                "You are a senior compliance analyst at a financial institution. "
                "Analyze the trading alert and respond ONLY with a valid JSON object. "
                "No markdown, no explanation, just JSON."
            ),
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )

        response_text = response.content[0].text.strip()

        # Clean up any potential markdown wrap
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        parsed = json.loads(response_text)

        triage_result = {
            "alert_id": request.alert_id,
            "verdict": parsed.get("verdict", "DISMISS"),
            "confidence": float(parsed.get("confidence", 0.5)),
            "false_positive_probability": float(parsed.get("false_positive_probability", 0.5)),
            "rationale": parsed.get("rationale", "No rationale provided by AI."),
            "supporting_evidence": request.evidence,
            "recommendations": parsed.get("recommendations", [])
        }

    except Exception as e:
        # Rule-based fallback: if evidence has cancel_ratio > 0.8 then ESCALATE confidence=0.75, else DISMISS confidence=0.60
        cancel_ratio = 0.0
        if request.evidence and isinstance(request.evidence, dict):
            raw_ratio = request.evidence.get("cancel_ratio")
            if raw_ratio is None:
                raw_ratio = request.evidence.get("cancellation_ratio")
            if raw_ratio is not None:
                try:
                    cancel_ratio = float(raw_ratio)
                except (ValueError, TypeError):
                    pass

        if cancel_ratio > 0.8:
            verdict = "ESCALATE"
            confidence = 0.75
            false_positive_probability = 0.25
            rationale = f"Rule-based fallback: High cancel ratio of {cancel_ratio:.2f} (> 0.8) detected."
            recommendations = [
                "Perform manual inspection of order entry and cancellation history",
                "Verify trader identity and historical cancel patterns"
            ]
        else:
            verdict = "DISMISS"
            confidence = 0.60
            false_positive_probability = 0.40
            rationale = f"Rule-based fallback: Cancel ratio of {cancel_ratio:.2f} is within normal threshold (<= 0.8)."
            recommendations = [
                "Archive alert for routine audit logging"
            ]

        triage_result = {
            "alert_id": request.alert_id,
            "verdict": verdict,
            "confidence": confidence,
            "false_positive_probability": false_positive_probability,
            "rationale": rationale,
            "supporting_evidence": request.evidence,
            "recommendations": recommendations
        }

    triage_cache[request.alert_id] = triage_result
    return triage_result


@router.post("/analyze")
async def analyze_alert(request: TriageRequest):
    """
    Analyze alert using Anthropic Claude API

    - **alert_id**: Alert identifier
    - **pattern_type**: Type of pattern detected
    - **evidence**: Evidence from pattern detection
    - **instrument**: Instrument involved
    - **timestamp**: Alert timestamp
    """
    try:
        triage_result = await _process_triage_request(request)
        return {
            "status": "success",
            "triage_result": triage_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache-stats")
async def get_cache_stats():
    """
    Get cache statistics

    Returns the number of cached items and their alert_ids
    """
    return {
        "cache_size": len(triage_cache),
        "cached_alert_ids": list(triage_cache.keys())
    }


@router.get("/{alert_id}")
async def get_triage_result(alert_id: str):
    """
    Get triage result for a specific alert

    - **alert_id**: Alert identifier
    """
    # TODO: Implement database query to fetch triage results
    return {
        "status": "success",
        "message": "Triage result retrieval - to be implemented with database",
        "alert_id": alert_id
    }


@router.post("/batch")
async def batch_triage(alerts: List[TriageRequest]):
    """
    Batch triage multiple alerts

    - **alerts**: List of alerts to triage
    """
    try:
        results = []
        for alert in alerts:
            result = await _process_triage_request(alert)
            results.append(result)

        return {
            "status": "success",
            "total_alerts": len(alerts),
            "processed": len(results),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
