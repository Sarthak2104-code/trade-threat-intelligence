"""
Configuration management for Trade Threat Intelligence Backend
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # API Keys
    anthropic_api_key: str
    
    # Database
    database_url: str = "postgresql://user:password@localhost:5432/trade_surveillance"
    database_pool_size: int = 20
    database_max_overflow: int = 10
    
    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic_trades: str = "trade_events"
    kafka_topic_alerts: str = "suspicious_alerts"
    kafka_consumer_group: str = "trade_surveillance_group"
    
    # Jira Integration
    jira_api_url: Optional[str] = None
    jira_api_token: Optional[str] = None
    jira_email: Optional[str] = None
    jira_project_key: str = "COMP"
    
    # Slack Integration
    slack_webhook_url: Optional[str] = None
    slack_channel: str = "#compliance-alerts"
    
    # Application
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    frontend_url: str = "http://localhost:3000"
    api_v1_prefix: str = "/api/v1"
    
    # Logging
    log_level: str = "INFO"
    
    # Detection Thresholds
    layering_cancel_ratio_threshold: float = 0.8
    layering_cancel_time_threshold: int = 1000
    spoofing_order_count_threshold: int = 10
    spoofing_cancel_ratio_threshold: float = 0.7
    wash_trading_match_threshold: float = 0.95
    wash_trading_time_window: int = 300
    pump_dump_volume_spike_threshold: float = 5.0
    pump_dump_price_change_threshold: float = 0.05
    
    # Risk Scoring
    high_risk_threshold: float = 0.8
    medium_risk_threshold: float = 0.5
    low_risk_threshold: float = 0.3
    
    # Replay Configuration
    replay_speed_multiplier: float = 10.0
    replay_batch_size: int = 100
    
    # Rate Limiting
    rate_limit_per_minute: int = 100
    rate_limit_per_hour: int = 1000
    
    # WebSocket
    ws_heartbeat_interval: int = 30
    ws_max_connections: int = 100
    
    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
