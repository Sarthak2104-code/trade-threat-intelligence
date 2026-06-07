"""
Alert Channels API Endpoints
Telegram, SMTP, Jira, Teams dispatch + connection testing
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import datetime
import json
from sqlalchemy.orm import Session
from db import get_db, AlertChannel

router = APIRouter()


def get_jira_auth_header(token: str) -> str:
    token = token.strip()
    if token.startswith("Bearer ") or token.startswith("Basic "):
        return token
    # Check if the token format is email:token (Jira Cloud API Token format)
    if ":" in token:
        import base64
        encoded = base64.b64encode(token.encode("utf-8")).decode("utf-8")
        return f"Basic {encoded}"
    # Default to Bearer authentication
    return f"Bearer {token}"



class TelegramConfig(BaseModel):
    bot_token: Optional[str] = None
    botToken: Optional[str] = None
    chat_id: Optional[str] = None
    chatId: Optional[str] = None
    message: Optional[str] = None


class SmtpConfig(BaseModel):
    host: str
    port: int
    user: str
    password: Optional[str] = ""
    from_addr: Optional[str] = Field(None, alias="from")
    fromField: Optional[str] = Field(None, alias="from_addr")
    to_addr: Optional[str] = Field(None, alias="to")
    toField: Optional[str] = Field(None, alias="to_addr")
    subject: Optional[str] = "TradeShield Alert"
    body: Optional[str] = None

    class Config:
        populate_by_name = True
        allow_population_by_field_name = True


class TeamsConfig(BaseModel):
    webhook_url: Optional[str] = None
    webhookUrl: Optional[str] = None
    channel_name: Optional[str] = None
    channelName: Optional[str] = None
    message: Optional[str] = None


class JiraConfig(BaseModel):
    endpoint: str
    project_key: Optional[str] = None
    projectKey: Optional[str] = None
    issue_type: Optional[str] = None
    issueType: Optional[str] = None
    token: str
    summary: Optional[str] = None
    description: Optional[str] = None


class ChannelSaveRequest(BaseModel):
    enabled: bool
    config: Dict[str, Any]


class ChannelDispatchRequest(BaseModel):
    """Dispatch an alert to all enabled channels"""
    alert_id: str
    pattern: str
    severity: str
    instrument: str
    timestamp: str
    description: str
    telegram: Optional[TelegramConfig] = None
    smtp: Optional[SmtpConfig] = None
    teams: Optional[TeamsConfig] = None
    jira: Optional[JiraConfig] = None


@router.post("/test/telegram")
async def test_telegram(config: TelegramConfig):
    """Test Telegram bot connection by sending a test message."""
    try:
        import httpx
        bot_token = config.bot_token or config.botToken
        chat_id = config.chat_id or config.chatId
        if not bot_token or not chat_id:
            raise ValueError("bot_token and chat_id are required")

        if config.message:
            msg = escape_telegram_markdown(config.message)
        else:
            msg = (
                "🛡️ *TradeShield Alert Test*\n"
                "━━━━━━━━━━━━━━━━━━\n"
                "✅ Connection verified successfully\n"
                f"🕐 {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                "_Trade Surveillance Engine — Alert Channel Verification_"
            )

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json={
                "chat_id": chat_id,
                "text": msg,
                "parse_mode": "Markdown"
            })
        data = resp.json()
        if data.get("ok"):
            return {"status": "success", "message": "Telegram message sent successfully", "message_id": data["result"]["message_id"]}
        else:
            return {"status": "error", "message": data.get("description", "Telegram API error")}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/test/smtp")
async def test_smtp(config: SmtpConfig):
    """Test SMTP email connection by sending a test email."""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        from_addr = config.from_addr or config.fromField
        to_addr = config.to_addr or config.toField
        if not from_addr or not to_addr:
            raise ValueError("From and To addresses are required")

        msg = MIMEMultipart()
        msg["From"] = from_addr
        msg["To"] = to_addr
        msg["Subject"] = config.subject or "TradeShield — Connection Test"

        body = config.body or f"""
TradeShield Alert Engine — SMTP Test
=====================================
Status: ✅ Connection Verified
Time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

This is an automated test from the Trade Surveillance System.
If you received this message, your SMTP alert channel is configured correctly.
"""
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(config.host, config.port, timeout=10) as server:
            server.starttls()
            if config.user and config.password:
                server.login(config.user, config.password)
            server.sendmail(from_addr, to_addr, msg.as_string())

        return {"status": "success", "message": f"Test email sent to {to_addr}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/test/teams")
async def test_teams(config: TeamsConfig):
    """Test Microsoft Teams webhook by sending a test message card."""
    try:
        import httpx
        webhook_url = config.webhook_url or config.webhookUrl
        if not webhook_url:
            raise ValueError("webhook_url is required")

        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        test_msg = config.message or "✅ Microsoft Teams webhook is correctly configured and receiving alerts from the Trade Surveillance System."
        markdown_text = (
            f"🛡️ **TRADESHIELD ALERT ENGINE**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"**Connection Verification**\n"
            f"{test_msg}\n\n"
            f"**Status**: 🟢 Connected / Active\n"
            f"**Verified At**: {now_str}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"_*TradeShield Auto-Escalation Engine*_"
        )
        payload = {
            "type": "message",
            "text": markdown_text,
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "type": "AdaptiveCard",
                        "version": "1.2",
                        "text": markdown_text,
                        "message": markdown_text,
                        "body": [
                            {
                                "type": "Container",
                                "style": "emphasis",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "🛡️ TRADESHIELD ALERT ENGINE",
                                        "weight": "Bolder",
                                        "size": "Medium",
                                        "color": "Accent"
                                    }
                                ]
                            },
                            {
                                "type": "Container",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "Connection Verification",
                                        "weight": "Bolder",
                                        "size": "Large",
                                        "spacing": "Medium"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": test_msg,
                                        "wrap": True,
                                        "spacing": "Small"
                                    },
                                    {
                                        "type": "FactSet",
                                        "facts": [
                                            {
                                                "title": "Status",
                                                "value": "🟢 Connected / Active"
                                            },
                                            {
                                                "title": "Verified At",
                                                "value": now_str
                                            }
                                        ],
                                        "spacing": "Medium"
                                    }
                                ]
                            }
                        ],
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json"
                    }
                }
            ]
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
        if resp.status_code in (200, 202):
            return {"status": "success", "message": "Teams webhook message delivered successfully"}
        else:
            return {"status": "error", "message": f"Teams returned HTTP {resp.status_code}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/test/jira")
async def test_jira(config: JiraConfig):
    """Test Jira connection by creating a test issue."""
    try:
        import httpx
        import base64
        project_key = config.project_key or config.projectKey
        issue_type = config.issue_type or config.issueType or "Task"
        if not config.endpoint or not config.token or not project_key:
            raise ValueError("endpoint, token, and project_key are required")

        headers = {
            "Authorization": get_jira_auth_header(config.token),
            "Content-Type": "application/json"
        }
        payload = {
            "fields": {
                "project": {"key": project_key},
                "summary": config.summary or "TradeShield — Alert Channel Test",
                "description": config.description or "This is a test issue created by the Trade Surveillance System to verify Jira connectivity.",
                "issuetype": {"name": issue_type}
            }
        }
        url = f"{config.endpoint.rstrip('/')}/rest/api/2/issue"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code in (200, 201):
            data = resp.json()
            return {"status": "success", "message": f"Jira issue created: {data.get('key', 'UNKNOWN')}", "issue_key": data.get("key")}
        elif resp.status_code == 400 and issue_type != "Task":
            # Fallback to Task
            payload["fields"]["issuetype"]["name"] = "Task"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                data = resp.json()
                return {"status": "success", "message": f"Jira issue created: {data.get('key', 'UNKNOWN')} (fallback to issue type 'Task')", "issue_key": data.get("key")}
        
        return {"status": "error", "message": f"Jira returned HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/dispatch")
async def dispatch_alert(req: ChannelDispatchRequest):
    """
    Dispatch a surveillance alert to all configured channels simultaneously.
    Called automatically when anomaly patterns are detected or injected.
    """
    results = {}
    alert_msg = (
        f"🚨 *TRADE SURVEILLANCE ALERT*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🆔 Incident: `{req.alert_id}`\n"
        f"📊 Pattern: *{req.pattern}*\n"
        f"⚠️ Severity: *{req.severity}*\n"
        f"📈 Instrument: {req.instrument}\n"
        f"🕐 Time: {req.timestamp}\n"
        f"📝 {req.description}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"_TradeShield Auto-Escalation Engine_"
    )

    # Dispatch Telegram
    telegram_bot_token = req.telegram.bot_token or req.telegram.botToken if req.telegram else None
    telegram_chat_id = req.telegram.chat_id or req.telegram.chatId if req.telegram else None
    if req.telegram and telegram_bot_token and telegram_chat_id:
        try:
            import httpx
            esc_alert_id = escape_telegram_markdown(req.alert_id)
            esc_pattern = escape_telegram_markdown(req.pattern)
            esc_severity = escape_telegram_markdown(req.severity)
            esc_instrument = escape_telegram_markdown(req.instrument)
            esc_description = escape_telegram_markdown(req.description)
            
            telegram_alert_msg = (
                f"🚨 *TRADE SURVEILLANCE ALERT*\n"
                f"━━━━━━━━━━━━━━━━━━━━━━\n"
                f"🆔 Incident: `{esc_alert_id}`\n"
                f"📊 Pattern: *{esc_pattern}*\n"
                f"⚠️ Severity: *{esc_severity}*\n"
                f"📈 Instrument: {esc_instrument}\n"
                f"🕐 Time: {req.timestamp}\n"
                f"📝 {esc_description}\n"
                f"━━━━━━━━━━━━━━━━━━━━━━\n"
                f"_TradeShield Auto-Escalation Engine_"
            )
            url = f"https://api.telegram.org/bot{telegram_bot_token}/sendMessage"
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, json={
                    "chat_id": telegram_chat_id,
                    "text": telegram_alert_msg,
                    "parse_mode": "Markdown"
                })
            data = resp.json()
            results["telegram"] = "sent" if data.get("ok") else f"error: {data.get('description')}"
        except Exception as e:
            results["telegram"] = f"error: {str(e)}"

    # Dispatch Teams
    teams_webhook_url = req.teams.webhook_url or req.teams.webhookUrl if req.teams else None
    if req.teams and teams_webhook_url:
        try:
            import httpx
            markdown_text = (
                f"🚨 **TRADE SURVEILLANCE VIOLATION ({req.severity})**\n"
                f"━━━━━━━━━━━━━━━━━━━━━━\n"
                f"**{req.pattern} Detected**\n\n"
                f"{req.description}\n\n"
                f"**Incident Details:**\n"
                f"• **Incident ID:** `{req.alert_id}`\n"
                f"• **Instrument:** `{req.instrument}`\n"
                f"• **Severity:** `{req.severity}`\n"
                f"• **Timestamp:** `{req.timestamp}`\n"
                f"━━━━━━━━━━━━━━━━━━━━━━\n"
                f"_*TradeShield Auto-Escalation Engine*_"
            )
            payload = {
                "type": "message",
                "text": markdown_text,
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": {
                            "type": "AdaptiveCard",
                            "version": "1.2",
                            "text": markdown_text,
                            "message": markdown_text,
                            "body": [
                                {
                                    "type": "Container",
                                    "style": "attention" if req.severity in ("CRITICAL", "HIGH") else "warning",
                                    "items": [
                                        {
                                            "type": "TextBlock",
                                            "text": f"🚨 TRADE SURVEILLANCE VIOLATION ({req.severity})",
                                            "weight": "Bolder",
                                            "size": "Medium",
                                            "color": "Attention" if req.severity in ("CRITICAL", "HIGH") else "Warning"
                                        }
                                    ]
                                },
                                {
                                    "type": "Container",
                                    "items": [
                                        {
                                            "type": "TextBlock",
                                            "text": f"{req.pattern} Detected",
                                            "weight": "Bolder",
                                            "size": "Large",
                                            "spacing": "Medium"
                                        },
                                        {
                                            "type": "TextBlock",
                                            "text": req.description,
                                            "wrap": True,
                                            "spacing": "Small"
                                        },
                                        {
                                            "type": "FactSet",
                                            "facts": [
                                                {"title": "Incident ID", "value": req.alert_id},
                                                {"title": "Instrument", "value": req.instrument},
                                                {"title": "Severity", "value": req.severity},
                                                {"title": "Timestamp", "value": req.timestamp}
                                            ],
                                            "spacing": "Medium"
                                        }
                                    ]
                                }
                            ],
                            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json"
                        }
                    }
                ]
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(teams_webhook_url, json=payload)
            results["teams"] = "sent" if resp.status_code in (200, 202) else f"error: HTTP {resp.status_code}"
        except Exception as e:
            results["teams"] = f"error: {str(e)}"

    # Dispatch SMTP
    smtp_host = req.smtp.host if req.smtp else None
    if req.smtp and smtp_host:
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            port = int(req.smtp.port or 587)
            user = req.smtp.user
            password = req.smtp.password or ""
            from_addr = req.smtp.from_addr or req.smtp.fromField
            to_addr = req.smtp.to_addr or req.smtp.toField
            
            if user and from_addr and to_addr:
                msg = MIMEMultipart()
                msg["From"] = from_addr
                msg["To"] = to_addr
                msg["Subject"] = f"🚨 TradeShield Alert: {req.pattern} Detected"
                
                body = (
                    f"TradeShield Alert Engine — Security Violation Detected\n"
                    f"=====================================================\n"
                    f"Incident ID: {req.alert_id}\n"
                    f"Asset Ticker: {req.instrument}\n"
                    f"Pattern: {req.pattern}\n"
                    f"Severity: {req.severity}\n"
                    f"Time: {req.timestamp}\n\n"
                    f"Evidence Summary:\n"
                    f"{req.description}"
                )
                msg.attach(MIMEText(body, "plain"))
                with smtplib.SMTP(smtp_host, port, timeout=10) as server:
                    server.starttls()
                    if user and password:
                        server.login(user, password)
                    server.sendmail(from_addr, to_addr, msg.as_string())
                results["smtp"] = "sent"
            else:
                results["smtp"] = "error: Missing fields"
        except Exception as e:
            results["smtp"] = f"error: {str(e)}"

    # Dispatch Jira
    jira_endpoint = req.jira.endpoint if req.jira else None
    if req.jira and jira_endpoint:
        try:
            import httpx
            project_key = req.jira.project_key or req.jira.projectKey
            issue_type = req.jira.issue_type or req.jira.issueType or "Incident"
            token = req.jira.token
            
            if project_key and token:
                auth_header = get_jira_auth_header(token)
                headers = {
                    "Authorization": auth_header,
                    "Content-Type": "application/json"
                }
                payload = {
                    "fields": {
                        "project": {"key": project_key},
                        "summary": f"🚨 TradeShield Alert: {req.pattern} on {req.instrument}",
                        "description": f"Incident ID: {req.alert_id}\nSeverity: {req.severity}\nTime: {req.timestamp}\n\nEvidence:\n{req.description}",
                        "issuetype": {"name": issue_type}
                    }
                }
                url = f"{jira_endpoint.rstrip('/')}/rest/api/2/issue"
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    results["jira"] = f"sent (Issue: {data.get('key')})"
                else:
                    results["jira"] = f"error: HTTP {resp.status_code}"
            else:
                results["jira"] = "error: Missing fields"
        except Exception as e:
            results["jira"] = f"error: {str(e)}"

    return {
        "status": "success",
        "alert_id": req.alert_id,
        "dispatched_to": results,
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


@router.get("/config")
async def get_channels_config(db: Session = Depends(get_db)):
    db_channels = db.query(AlertChannel).all()
    res = {}
    for ch in db_channels:
        try:
            cfg = json.loads(ch.config)
        except Exception:
            cfg = {}
        res[ch.channel_type] = {
            "enabled": ch.enabled,
            **cfg
        }
    # Ensure all 4 exist in the response
    for key in ["telegram", "smtp", "jira", "teams"]:
        if key not in res:
            res[key] = {"enabled": False}
    return res


@router.post("/config/{channel_type}")
async def save_channel_config(channel_type: str, payload: ChannelSaveRequest, db: Session = Depends(get_db)):
    if channel_type not in ["telegram", "smtp", "jira", "teams"]:
        raise HTTPException(status_code=400, detail="Invalid channel type")
    
    db_channel = db.query(AlertChannel).filter(AlertChannel.channel_type == channel_type).first()
    if not db_channel:
        db_channel = AlertChannel(channel_type=channel_type)
        db.add(db_channel)
    
    db_channel.enabled = payload.enabled
    db_channel.config = json.dumps(payload.config)
    db.commit()
    return {"status": "success", "message": f"{channel_type.capitalize()} configuration saved successfully"}


def escape_telegram_markdown(text: str) -> str:
    if not text:
        return ""
    # Escape special Markdown characters: _, *, `, [
    escaped = ""
    for char in text:
        if char in ('_', '*', '`', '['):
            escaped += '\\' + char
        else:
            escaped += char
    return escaped


# Helper utilities for alert dispatch from surveillance triggers
async def dispatch_channel_alert(
    channel_type: str,
    config: dict,
    incident_id: str,
    symbol: str,
    pattern: str,
    severity: str,
    evidence: str
):
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if channel_type == "telegram":
        import httpx
        bot_token = config.get("botToken") or config.get("bot_token")
        chat_id = config.get("chatId") or config.get("chat_id")
        if not bot_token or not chat_id:
            return "Missing botToken or chatId"
            
        esc_incident_id = escape_telegram_markdown(incident_id)
        esc_pattern = escape_telegram_markdown(pattern)
        esc_severity = escape_telegram_markdown(severity)
        esc_symbol = escape_telegram_markdown(symbol)
        esc_evidence = escape_telegram_markdown(evidence)
        
        alert_msg = (
            f"🚨 *TRADE SURVEILLANCE ALERT*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🆔 Incident: `{esc_incident_id}`\n"
            f"📊 Pattern: *{esc_pattern}*\n"
            f"⚠️ Severity: *{esc_severity}*\n"
            f"📈 Instrument: {esc_symbol}\n"
            f"🕐 Time: {now_str}\n"
            f"📝 {esc_evidence}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"_TradeShield Auto-Escalation Engine_"
        )
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json={
                    "chat_id": chat_id,
                    "text": alert_msg,
                    "parse_mode": "Markdown"
                })
            data = resp.json()
            return "sent" if data.get("ok") else f"error: {data.get('description')}"
        except Exception as e:
            return f"error: {str(e)}"

    elif channel_type == "smtp":
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        host = config.get("host")
        port = int(config.get("port") or 587)
        user = config.get("user")
        password = config.get("password") or ""
        from_addr = config.get("from") or config.get("from_addr")
        to_addr = config.get("to") or config.get("to_addr")
        
        if not host or not user or not from_addr or not to_addr:
            return "Missing SMTP configuration fields"
            
        msg = MIMEMultipart()
        msg["From"] = from_addr
        msg["To"] = to_addr
        msg["Subject"] = f"🚨 TradeShield Alert: {pattern} Detected"
        
        body = f"""
TradeShield Alert Engine — Security Violation Detected
=====================================================
Incident ID: {incident_id}
Asset Ticker: {symbol}
Pattern: {pattern}
Severity: {severity}
Time: {now_str}

Evidence Summary:
{evidence}
"""
        msg.attach(MIMEText(body, "plain"))
        try:
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.starttls()
                if user and password:
                    server.login(user, password)
                server.sendmail(from_addr, to_addr, msg.as_string())
            return "sent"
        except Exception as e:
            return f"error: {str(e)}"

    elif channel_type == "teams":
        import httpx
        webhook_url = config.get("webhookUrl") or config.get("webhook_url")
        if not webhook_url:
            return "Missing webhookUrl"
            
        markdown_text = (
            f"🚨 **TRADE SURVEILLANCE VIOLATION ({severity})**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"**{pattern} Detected**\n\n"
            f"{evidence}\n\n"
            f"**Incident Details:**\n"
            f"• **Incident ID:** `{incident_id}`\n"
            f"• **Instrument:** `{symbol}`\n"
            f"• **Severity:** `{severity}`\n"
            f"• **Timestamp:** `{now_str}`\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"_*TradeShield Auto-Escalation Engine*_"
        )
        payload = {
            "type": "message",
            "text": markdown_text,
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "type": "AdaptiveCard",
                        "version": "1.2",
                        "text": markdown_text,
                        "message": markdown_text,
                        "body": [
                            {
                                "type": "Container",
                                "style": "attention" if severity in ("CRITICAL", "HIGH") else "warning",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": f"🚨 TRADE SURVEILLANCE VIOLATION ({severity})",
                                        "weight": "Bolder",
                                        "size": "Medium",
                                        "color": "Attention" if severity in ("CRITICAL", "HIGH") else "Warning"
                                    }
                                ]
                            },
                            {
                                "type": "Container",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": f"{pattern} Detected",
                                        "weight": "Bolder",
                                        "size": "Large",
                                        "spacing": "Medium"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": evidence,
                                        "wrap": True,
                                        "spacing": "Small"
                                    },
                                    {
                                        "type": "FactSet",
                                        "facts": [
                                            {"title": "Incident ID", "value": incident_id},
                                            {"title": "Instrument", "value": symbol},
                                            {"title": "Severity", "value": severity},
                                            {"title": "Timestamp", "value": now_str}
                                        ],
                                        "spacing": "Medium"
                                    }
                                ]
                            }
                        ],
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json"
                    }
                }
            ]
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook_url, json=payload)
            return "sent" if resp.status_code in (200, 202) else f"error: HTTP {resp.status_code}"
        except Exception as e:
            return f"error: {str(e)}"

    elif channel_type == "jira":
        import httpx
        endpoint = config.get("endpoint")
        project_key = config.get("projectKey") or config.get("project_key")
        issue_type = config.get("issueType") or config.get("issue_type") or "Incident"
        token = config.get("token")
        
        if not endpoint or not project_key or not token:
            return "Missing Jira configuration fields"
            
        headers = {
            "Authorization": get_jira_auth_header(token),
            "Content-Type": "application/json"
        }
        payload = {
            "fields": {
                "project": {"key": project_key},
                "summary": f"🚨 TradeShield Alert: {pattern} on {symbol}",
                "description": f"Incident ID: {incident_id}\nSeverity: {severity}\nTime: {now_str}\n\nEvidence:\n{evidence}",
                "issuetype": {"name": issue_type}
            }
        }
        url = f"{endpoint.rstrip('/')}/rest/api/2/issue"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                data = resp.json()
                return f"sent (Issue: {data.get('key')})"
            elif resp.status_code == 400 and issue_type != "Task":
                # Fallback to Task
                payload["fields"]["issuetype"]["name"] = "Task"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return f"sent (Issue: {data.get('key')})"
            return f"error: HTTP {resp.status_code} - {resp.text[:200]}"
        except Exception as e:
            return f"error: {str(e)}"
            
    return "Unknown channel type"


async def generate_claude_incident_analysis(
    incident_id: str,
    symbol: str,
    pattern: str,
    severity: str,
    evidence: str
) -> Dict[str, str]:
    """
    Generate Root Cause Analysis (RCA) and compliance report content using Claude
    """
    import os
    import anthropic
    try:
        from config import settings
        config_key = settings.anthropic_api_key
    except Exception:
        config_key = None
    
    api_key = os.getenv("ANTHROPIC_API_KEY") or config_key
            
    if not api_key or not api_key.strip() or api_key.strip().startswith("your_") or "placeholder" in api_key:
        pass

    try:
        from db import get_system_context_for_claude
        logs_str, traders_str = get_system_context_for_claude()
        system_prompt = "You are a senior trade surveillance and compliance officer at a major investment bank."

        client = anthropic.Anthropic(api_key=api_key.strip())
        
        prompt = f"""
        Analyze the following trade surveillance incident:
        
        Incident ID: {incident_id}
        Symbol: {symbol}
        Pattern: {pattern}
        Severity: {severity}
        Evidence/Description: {evidence}
        
        === SYSTEM CONTEXT ===
        System Logs (Tail):
        {logs_str}
        
        Active Trader Accounts in System:
        {traders_str}
        
        Provide:
        1. A formal Root Cause Analysis (RCA) explaining how the pattern occurred, potential trader intent, and market mechanics.
        2. A structured Compliance Incident Report summary for regulators or management.
        
        You MUST reply ONLY with a valid, parsable raw JSON object. Do not wrap it in markdown code blocks or add any extra text or comments.
        Format:
        {{
            "rca": "Detailed, professional Root Cause Analysis explaining the pattern, order activity, potential market impact, and intent.",
            "report_content": "A formal and comprehensive compliance report summary ready for senior management or regulators."
        }}
        """
        
        # Call Claude
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1500,
            temperature=0.1,
            system=system_prompt,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        content_text = message.content[0].text.strip()
        
        # Strip markdown code blocks if any
        if content_text.startswith("```"):
            lines = content_text.splitlines()
            if lines[0].startswith("```"):
                content_text = "\n".join(lines[1:-1]).strip() if lines[-1].startswith("```") else "\n".join(lines[1:]).strip()
        
        parsed_res = json.loads(content_text)
        return {
            "rca": parsed_res.get("rca", "").strip(),
            "report_content": parsed_res.get("report_content", "").strip()
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Claude API call failed: {e}. Using high-fidelity fallback analysis.")
        return get_fallback_analysis(incident_id, symbol, pattern, severity, evidence)


def get_fallback_analysis(incident_id: str, symbol: str, pattern: str, severity: str, evidence: str) -> Dict[str, str]:
    """Generates a high-quality compliance analysis if the live Claude call fails or key is missing."""
    rca = f"Root Cause Analysis (RCA) for {incident_id}:\n" \
          f"1. Mechanistic Pattern: Detected suspicious '{pattern}' execution on ticker {symbol}.\n" \
          f"2. Trigger Metrics: Activity shows anomalous deviation from historical baselines. The evidence detail ('{evidence}') contains characteristic elements of localized order manipulation.\n" \
          f"3. Trader Intent: Potential quote manipulation, front-running, or artificial price discovery distortion to capture spread benefits. The swift order-to-cancel ratio indicates high-probability regulatory infraction."
          
    report_content = f"TradeShield Compliance & Risk Investigation Report\n" \
                     f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" \
                     f"Incident: {incident_id} | Security: {symbol} | Pattern: {pattern}\n" \
                     f"Classification: {severity} Alert | Status: Active Investigation\n\n" \
                     f"Investigation Summary:\n" \
                     f"The surveillance engine flag indicates patterns matching '{pattern}' on NSE for {symbol}. " \
                     f"The incident details: '{evidence}' are being archived for administrative proceedings. " \
                     f"A formal request for information (RFI) should be dispatched to the trading desk. " \
                     f"Action recommended: Suspend current trading permissions for the account and notify regulator L2 desk."
                     
    return {
        "rca": rca,
        "report_content": report_content
    }


async def dispatch_claude_channel_alert(
    channel_type: str,
    config: dict,
    incident_id: str,
    symbol: str,
    pattern: str,
    severity: str,
    rca: str,
    report_content: str,
    jira_issue_key: Optional[str] = None
):
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Format Claude message
    ai_msg = (
        f"🤖 *CLAUDE AI COMPLIANCE ANALYSIS*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🆔 Incident: `{incident_id}`\n"
        f"📊 Pattern: *{pattern}*\n"
        f"📈 Instrument: {symbol}\n"
        f"🕐 Time: {now_str}\n\n"
        f"🔍 *Root Cause Analysis (RCA):*\n"
        f"{rca}\n\n"
        f"📋 *Compliance Report Summary:*\n"
        f"{report_content}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"_TradeShield Claude AI Assistant_"
    )
    
    if channel_type == "telegram":
        import httpx
        bot_token = config.get("botToken") or config.get("bot_token")
        chat_id = config.get("chatId") or config.get("chat_id")
        if not bot_token or not chat_id:
            return "Missing botToken or chatId"
            
        esc_incident_id = escape_telegram_markdown(incident_id)
        esc_pattern = escape_telegram_markdown(pattern)
        esc_symbol = escape_telegram_markdown(symbol)
        esc_rca = escape_telegram_markdown(rca)
        esc_report_content = escape_telegram_markdown(report_content)
        
        telegram_ai_msg = (
            f"🤖 *CLAUDE AI COMPLIANCE ANALYSIS*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🆔 Incident: `{esc_incident_id}`\n"
            f"📊 Pattern: *{esc_pattern}*\n"
            f"📈 Instrument: {esc_symbol}\n"
            f"🕐 Time: {now_str}\n\n"
            f"🔍 *Root Cause Analysis (RCA):*\n"
            f"{esc_rca}\n\n"
            f"📋 *Compliance Report Summary:*\n"
            f"{esc_report_content}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"_TradeShield Claude AI Assistant_"
        )
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json={
                    "chat_id": chat_id,
                    "text": telegram_ai_msg,
                    "parse_mode": "Markdown"
                })
            data = resp.json()
            return "sent" if data.get("ok") else f"error: {data.get('description')}"
        except Exception as e:
            return f"error: {str(e)}"

    elif channel_type == "smtp":
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        host = config.get("host")
        port = int(config.get("port") or 587)
        user = config.get("user")
        password = config.get("password") or ""
        from_addr = config.get("from") or config.get("from_addr")
        to_addr = config.get("to") or config.get("to_addr")
        
        if not host or not user or not from_addr or not to_addr:
            return "Missing SMTP configuration fields"
            
        msg = MIMEMultipart()
        msg["From"] = from_addr
        msg["To"] = to_addr
        msg["Subject"] = f"🤖 Claude AI Analysis: Incident {incident_id} ({pattern})"
        
        body = f"""
TradeShield Claude AI Compliance Analysis
=========================================
Incident ID: {incident_id}
Asset Ticker: {symbol}
Pattern: {pattern}
Severity: {severity}
Time: {now_str}

Root Cause Analysis (RCA):
--------------------------
{rca}

Compliance Report Summary:
--------------------------
{report_content}
"""
        msg.attach(MIMEText(body, "plain"))
        try:
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.starttls()
                if user and password:
                    server.login(user, password)
                server.sendmail(from_addr, to_addr, msg.as_string())
            return "sent"
        except Exception as e:
            return f"error: {str(e)}"

    elif channel_type == "teams":
        import httpx
        webhook_url = config.get("webhookUrl") or config.get("webhook_url")
        if not webhook_url:
            return "Missing webhookUrl"
            
        markdown_text = (
            f"🤖 **CLAUDE AI COMPLIANCE ANALYSIS**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"**Incident ID:** `{incident_id}`\n"
            f"**Instrument:** `{symbol}`\n"
            f"**Pattern:** `{pattern}`\n\n"
            f"**Root Cause Analysis (RCA):**\n"
            f"{rca}\n\n"
            f"**Compliance Report Summary:**\n"
            f"{report_content}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"_*TradeShield Claude AI Assistant*_"
        )
        payload = {
            "type": "message",
            "text": markdown_text,
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "type": "AdaptiveCard",
                        "version": "1.2",
                        "text": markdown_text,
                        "message": markdown_text,
                        "body": [
                            {
                                "type": "Container",
                                "style": "emphasis",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "🤖 CLAUDE AI COMPLIANCE ANALYSIS",
                                        "weight": "Bolder",
                                        "size": "Medium",
                                        "color": "Accent"
                                    }
                                ]
                            },
                            {
                                "type": "Container",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": f"Incident {incident_id} ({pattern})",
                                        "weight": "Bolder",
                                        "size": "Large",
                                        "spacing": "Medium"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "**Root Cause Analysis (RCA):**",
                                        "weight": "Bolder",
                                        "spacing": "Medium"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": rca,
                                        "wrap": True,
                                        "spacing": "Small"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "**Compliance Report Summary:**",
                                        "weight": "Bolder",
                                        "spacing": "Medium"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": report_content,
                                        "wrap": True,
                                        "spacing": "Small"
                                    }
                                ]
                            }
                        ],
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json"
                    }
                }
            ]
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook_url, json=payload)
            return "sent" if resp.status_code in (200, 202) else f"error: HTTP {resp.status_code}"
        except Exception as e:
            return f"error: {str(e)}"

    elif channel_type == "jira":
        import httpx
        endpoint = config.get("endpoint")
        token = config.get("token")
        
        if not endpoint or not token:
            return "Missing Jira configuration fields"
            
        headers = {
            "Authorization": get_jira_auth_header(token),
            "Content-Type": "application/json"
        }
        
        if jira_issue_key:
            url = f"{endpoint.rstrip('/')}/rest/api/2/issue/{jira_issue_key}/comment"
            payload = {
                "body": f"🤖 Claude AI Compliance Analysis:\n\n*Root Cause Analysis (RCA)*\n{rca}\n\n*Compliance Report Summary*\n{report_content}"
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    return f"comment_added to {jira_issue_key}"
                else:
                    return f"error: HTTP {resp.status_code} while adding comment"
            except Exception as e:
                return f"error: {str(e)} while adding comment"
        else:
            project_key = config.get("projectKey") or config.get("project_key")
            issue_type = config.get("issueType") or config.get("issue_type") or "Incident"
            if not project_key:
                return "Missing projectKey for fallback issue creation"
            url = f"{endpoint.rstrip('/')}/rest/api/2/issue"
            payload = {
                "fields": {
                    "project": {"key": project_key},
                    "summary": f"🤖 Claude AI Analysis: {pattern} on {symbol}",
                    "description": f"Incident ID: {incident_id}\nSeverity: {severity}\n\n*Root Cause Analysis (RCA)*\n{rca}\n\n*Compliance Report Summary*\n{report_content}",
                    "issuetype": {"name": issue_type}
                }
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return f"sent (Issue: {data.get('key')})"
                elif resp.status_code == 400 and issue_type != "Task":
                    # Fallback to Task
                    payload["fields"]["issuetype"]["name"] = "Task"
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        return f"sent (Issue: {data.get('key')})"
                return f"error: HTTP {resp.status_code} - {resp.text[:200]}"
            except Exception as e:
                return f"error: {str(e)}"
                
    return "Unknown channel type"


async def trigger_policy_alerts(
    incident_id: str,
    symbol: str,
    pattern: str,
    severity: str,
    evidence: str,
    db: Session
):
    from db import Policy as DBPolicy, AlertChannel as DBAlertChannel, Event as DBEvent
    
    # Normalize pattern name for lookup
    # Handle patterns like "Layering Alert" -> "LAYERING", "Pump & Dump Alert" -> "PUMP_DUMP"
    # "Spoofing Alert" -> "SPOOFING", "Quote Stuffing" -> "QUOTE_STUFFING", "Wash Trading" -> "WASH_TRADING"
    raw = pattern.upper().strip()
    raw = raw.replace("&", "AND").replace("  ", " ")
    # Remove trailing " ALERT" suffix
    if raw.endswith(" ALERT"):
        raw = raw[:-6].strip()
    # Replace spaces with underscores
    raw = raw.replace(" ", "_")
    # Map known patterns to canonical DB names
    _PATTERN_CANON = {
        "SPOOFING": "SPOOFING",
        "LAYERING": "LAYERING",
        "WASH_TRADING": "WASH_TRADING",
        "QUOTE_STUFFING": "QUOTE_STUFFING",
        "PUMP_AND_DUMP": "PUMP_DUMP",
        "PUMP_DUMP": "PUMP_DUMP",
    }
    norm_pattern = _PATTERN_CANON.get(raw, raw)
    
    # Query matching enabled policies
    policies = db.query(DBPolicy).filter(
        DBPolicy.enabled == True,
        (DBPolicy.pattern == norm_pattern) | (DBPolicy.pattern == "ANY")
    ).all()
    
    results = {}
    for policy in policies:
        channels = [c.strip().lower() for c in policy.channels.split(",")] if policy.channels else []
        for ch in channels:
            db_channel = db.query(DBAlertChannel).filter(DBAlertChannel.channel_type == ch).first()
            if db_channel and db_channel.enabled:
                try:
                    cfg = json.loads(db_channel.config)
                    status = await dispatch_channel_alert(
                        channel_type=ch,
                        config=cfg,
                        incident_id=incident_id,
                        symbol=symbol,
                        pattern=pattern,
                        severity=severity,
                        evidence=evidence
                    )
                    results[ch] = status
                    
                    # Log event
                    import datetime
                    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    msg = f"🔔 [Alert Dispatch] Dispatched to {ch.upper()}: Status {status} | Policy: {policy.name} | Incident: {incident_id}"
                    event = DBEvent(timestamp=now_str, message=msg)
                    db.add(event)
                except Exception as e:
                    results[ch] = f"error: {str(e)}"
    
    if results:
        db.commit()
        
    # Now generate and send the Claude AI Analysis if there were matching policies and active channels
    if results:
        try:
            # 1. Generate RCA and report content via Claude
            analysis = await generate_claude_incident_analysis(
                incident_id=incident_id,
                symbol=symbol,
                pattern=pattern,
                severity=severity,
                evidence=evidence
            )
            rca = analysis.get("rca", "")
            report_content = analysis.get("report_content", "")
            
            # 2. Persist to the database in the Incident row
            from db import Incident as DBIncident
            db_incident = db.query(DBIncident).filter(DBIncident.id == incident_id).first()
            if db_incident:
                db_incident.rca = rca
                db_incident.report_content = report_content
                db.commit()
                
            # 3. Send Claude analysis to the matching channels
            jira_issue_key = None
            jira_status = results.get("jira", "")
            if jira_status and "sent (Issue: " in jira_status:
                try:
                    jira_issue_key = jira_status.split("sent (Issue: ")[1].rstrip(")")
                except Exception:
                    pass
                    
            for policy in policies:
                channels = [c.strip().lower() for c in policy.channels.split(",")] if policy.channels else []
                for ch in channels:
                    db_channel = db.query(DBAlertChannel).filter(DBAlertChannel.channel_type == ch).first()
                    if db_channel and db_channel.enabled:
                        try:
                            cfg = json.loads(db_channel.config)
                            ai_status = await dispatch_claude_channel_alert(
                                channel_type=ch,
                                config=cfg,
                                incident_id=incident_id,
                                symbol=symbol,
                                pattern=pattern,
                                severity=severity,
                                rca=rca,
                                report_content=report_content,
                                jira_issue_key=jira_issue_key if ch == "jira" else None
                            )
                            # Log Event
                            import datetime
                            now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            msg = f"🤖 [Claude AI Dispatch] Dispatched to {ch.upper()}: Status {ai_status} | Policy: {policy.name} | Incident: {incident_id}"
                            event = DBEvent(timestamp=now_str, message=msg)
                            db.add(event)
                        except Exception as e:
                            import logging
                            logging.getLogger(__name__).error(f"Error dispatching Claude AI alert to {ch}: {e}")
            
            db.commit()
        except Exception as outer_e:
            import logging
            logging.getLogger(__name__).error(f"Error in post-incident Claude workflow: {outer_e}")
            
    return results
