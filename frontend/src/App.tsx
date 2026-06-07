import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import type { ISeriesApi, CandlestickData, HistogramData } from 'lightweight-charts';
import cytoscape from 'cytoscape';
import { 
  ShieldAlert, 
  User, 
  Plus, 
  Search, 
  X, 
  ChevronDown, 
  ChevronRight,
  Activity, 
  Sparkles, 
  Clock, 
  ArrowRightLeft,
  RefreshCw,
  Maximize2,
  Settings,
  Download,
  Upload,
  Edit,
  Trash,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import './App.css';

// Type definitions
interface Instrument {
  instrument_id: string;
  file: string;
  exchange: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  prevClose: number;
}

interface Tick {
  timestamp: string;
  ltp: number;
  volume: number;
  total_buy_qty: number;
  total_sell_qty: number;
  bid1_price?: number;
  bid1_qty?: number;
  ask1_price?: number;
  ask1_qty?: number;
  bid2_price?: number;
  bid2_qty?: number;
  ask2_price?: number;
  ask2_qty?: number;
  bid3_price?: number;
  bid3_qty?: number;
  ask3_price?: number;
  ask3_qty?: number;
  bid4_price?: number;
  bid4_qty?: number;
  ask4_price?: number;
  ask4_qty?: number;
  bid5_price?: number;
  bid5_qty?: number;
  ask5_price?: number;
  ask5_qty?: number;
  open_day?: number;
  high_day?: number;
  low_day?: number;
  close_day?: number;
}

interface Position {
  symbol: string;
  instrumentId: string;
  type: 'BUY' | 'SELL';
  qty: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
}

interface ComplianceAlert {
  alert_id: string;
  pattern_type: string;
  severity: string;
  confidence: number;
  instrument: string;
  timestamp: string;
  evidence: {
    cancel_ratio: number;
    cancel_time_median: number;
    order_count: number;
    price_impact: number;
  };
  description: string;
}

interface TriageResult {
  verdict: 'ESCALATE' | 'DISMISS';
  confidence: number;
  rationale: string;
  supporting_evidence: {
    cancellation_ratio: number;
    time_to_cancel_median: number;
    anomaly_vs_baseline: string;
    order_count: number;
  };
  recommendations: string[];
}

interface Incident {
  id: string;
  symbol: string;
  pattern: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  status: 'PENDING' | 'ESCALATED' | 'DISMISSED';
  confidence: number;
  evidence: string;
}

interface CompanyMetadata {
  domain: string;
  logo: string;
  sector: string;
  industry: string;
  description: string;
}

// 7 Tickers from CSV datasets
const DATASETS_MAP: Record<string, { symbol: string; name: string }> = {
  "INE002A01018": { symbol: "RELIANCE", name: "RELIANCE INDUSTRIES LTD" },
  "INE040A01034": { symbol: "HDFCBANK", name: "HDFC BANK LTD" },
  "INE090A01021": { symbol: "ICICIBANK", name: "ICICI BANK LTD" },
  "INE018A01030": { symbol: "LT", name: "LARSEN & TOUBRO LTD" },
  "INE670A01012": { symbol: "TATAELXSI", name: "TATA ELXSI LTD" },
  "INE030A01027": { symbol: "HINDUNILVR", name: "HINDUSTAN UNILEVER LTD" },
  "INE044A01036": { symbol: "SUNPHARMA", name: "SUN PHARMACEUTICAL IND" }
};

// Attack descriptions for hovering/viewing
const ANOMALY_INFO_MAP: Record<string, string> = {
  "layering": "Spoofing & Layering: A rogue actor places multiple large fake orders to create a false impression of depth, inducing others to trade at artificial prices, then instantly cancels them.",
  "wash_trading": "Wash Trading: A collusive trader sells shares to themselves or an associate without real change in ownership, artificially creating mock volume to trigger retail momentum.",
  "pump_dump": "Pump & Dump: An orchestrator buys heavily to inflate the stock price rapidly, attracting momentum buying, before dumping their position onto public buyers.",
  "quote_stuffing": "Quote Stuffing: A malicious high-frequency script floods the order book with rapid placements and immediate cancellations, causing bandwidth exhaustion and execution lag for other participants."
};

// Mapped Domains for Companies to guarantee high-resolution logos via gstatic
const INITIAL_COMPANY_METADATA: Record<string, CompanyMetadata> = {
  "RELIANCE": {
    domain: "www.relianceindustries.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.relianceindustries.com",
    sector: "Energy & Conglomerate",
    industry: "Oil & Gas, Retail, Telecom",
    description: "Reliance Industries Limited is an Indian conglomerate company."
  },
  "HDFCBANK": {
    domain: "www.hdfcbank.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.hdfcbank.com",
    sector: "Financial Services",
    industry: "Banking",
    description: "HDFC Bank Limited is India's largest private sector bank."
  },
  "ICICIBANK": {
    domain: "www.icicibank.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.icicibank.com",
    sector: "Financial Services",
    industry: "Banking",
    description: "ICICI Bank is a leading private sector bank in India."
  },
  "LT": {
    domain: "www.larsentoubro.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.larsentoubro.com",
    sector: "Industrial Capital Goods",
    industry: "Infrastructure & Construction",
    description: "Larsen & Toubro Limited is an engineering and construction conglomerate."
  },
  "TATAELXSI": {
    domain: "www.tataelxsi.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.tataelxsi.com",
    sector: "Technology",
    industry: "Software & Design Services",
    description: "Tata Elxsi provides design and technology services."
  },
  "HINDUNILVR": {
    domain: "www.hul.co.in",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.hul.co.in",
    sector: "Consumer Goods",
    industry: "FMCG",
    description: "Hindustan Unilever Limited is India's largest consumer goods company."
  },
  "SUNPHARMA": {
    domain: "www.sunpharma.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.sunpharma.com",
    sector: "Healthcare",
    industry: "Pharmaceuticals",
    description: "Sun Pharmaceutical is a major multinational pharma firm."
  },
  "TCS": {
    domain: "www.tcs.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.tcs.com",
    sector: "Technology",
    industry: "IT Consulting Services",
    description: "Tata Consultancy Services is a global IT services provider."
  },
  "BHARTIARTL": {
    domain: "www.airtel.in",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.airtel.in",
    sector: "Communication Services",
    industry: "Telecom",
    description: "Bharti Airtel is a leading global telecommunications company."
  },
  "SBIN": {
    domain: "www.sbi.co.in",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.sbi.co.in",
    sector: "Financial Services",
    industry: "Public Sector Banking",
    description: "State Bank of India is a Fortune 500 public sector bank."
  },
  "INFY": {
    domain: "www.infosys.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.infosys.com",
    sector: "Technology",
    industry: "IT Services",
    description: "Infosys is a global leader in next-generation digital services."
  },
  "BAJFINANCE": {
    domain: "www.bajajfinserv.in",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.bajajfinserv.in",
    sector: "Financial Services",
    industry: "NBFC",
    description: "Bajaj Finance is a prominent diversified financial services firm."
  },
  "ITC": {
    domain: "www.itcportal.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.itcportal.com",
    sector: "Consumer Goods",
    industry: "Diversified FMCG",
    description: "ITC has a presence in FMCG, Hotels, and Agri Business."
  },
  "HCLTECH": {
    domain: "www.hcltech.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.hcltech.com",
    sector: "Technology",
    industry: "IT Services",
    description: "HCL Technologies is a leading global technology company."
  },
  "KOTAKBANK": {
    domain: "www.kotak.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.kotak.com",
    sector: "Financial Services",
    industry: "Banking",
    description: "Kotak Mahindra Bank offers personal and corporate banking."
  },
  "MARUTI": {
    domain: "www.marutisuzuki.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.marutisuzuki.com",
    sector: "Automotive",
    industry: "Passenger Vehicles",
    description: "Maruti Suzuki is India's largest passenger car manufacturer."
  },
  "M&M": {
    domain: "www.mahindra.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.mahindra.com",
    sector: "Automotive",
    industry: "Commercial & Utility Cars",
    description: "Mahindra & Mahindra is an Indian multinational vehicle manufacturer."
  },
  "AXISBANK": {
    domain: "www.axisbank.com",
    logo: "https://www.google.com/s2/favicons?sz=64&domain=www.axisbank.com",
    sector: "Financial Services",
    industry: "Banking",
    description: "Axis Bank is the third-largest private sector bank in India."
  }
};

const STATIC_WATCHLIST_DATA = [
  { symbol: "TCS", name: "TATA CONSULTANCY SERVICES", price: 2198.90, change: -42.10, changePercent: -1.88, prevClose: 2241.00 },
  { symbol: "BHARTIARTL", name: "BHARTI AIRTEL LTD", price: 1758.20, change: -20.70, changePercent: -1.16, prevClose: 1778.90 },
  { symbol: "SBIN", name: "STATE BANK OF INDIA", price: 977.70, change: -1.55, changePercent: -0.16, prevClose: 979.25 },
  { symbol: "INFY", name: "INFOSYS LTD", price: 1197.50, change: -3.80, changePercent: -0.32, prevClose: 1201.30 },
  { symbol: "BAJFINANCE", name: "BAJAJ FINANCE LTD", price: 889.40, change: 15.00, changePercent: 1.72, prevClose: 874.40 },
  { symbol: "ITC", name: "ITC LTD", price: 280.70, change: 0.40, changePercent: 0.14, prevClose: 280.30 },
  { symbol: "HCLTECH", name: "HCL TECHNOLOGIES LTD", price: 1154.70, change: -13.60, changePercent: -1.16, prevClose: 1168.30 },
  { symbol: "KOTAKBANK", name: "KOTAK MAHINDRA BANK", price: 377.45, change: -4.05, changePercent: -1.06, prevClose: 381.50 },
  { symbol: "MARUTI", name: "MARUTI SUZUKI INDIA LTD", price: 13050.00, change: -14.00, changePercent: -0.11, prevClose: 13064.00 },
  { symbol: "M&M", name: "MAHINDRA & MAHINDRA LTD", price: 3040.50, change: 24.40, changePercent: 0.81, prevClose: 3016.10 },
  { symbol: "AXISBANK", name: "AXIS BANK LTD", price: 1272.30, change: 19.00, changePercent: 1.52, prevClose: 1253.30 }
];

const BACKEND_URL = `http://${window.location.hostname}:8000`;
const WS_URL = `ws://${window.location.hostname}:8000/ws/market-data`;

const formatHumanReadableTime = (isoString?: string | null) => {
  if (!isoString) return "No data";
  try {
    const cleanTs = isoString.includes('Z') || isoString.includes('+')
      ? isoString
      : (isoString.includes(' ') ? isoString.replace(' ', 'T') + 'Z' : isoString + 'Z');
    const date = new Date(cleanTs);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata'
    }) + " IST";
  } catch (e) {
    return isoString;
  }
};

// Shared helper to generate and trigger printing of high-fidelity incident reports
const printIncidentReport = (incident: Incident) => {
  const getTraderInfo = (symbol: string) => {
    if (symbol === 'TATAELXSI') {
      return { id: 'TRD-004', name: 'Rohan Mehta', role: 'Prop Trader', location: 'Mumbai HQ, Desk 4', ip: '10.10.50.44', status: 'SUSPENDED' };
    } else if (symbol === 'LT') {
      return { id: 'TRD-002', name: 'Alice Vance', role: 'Market Maker', location: 'London Branch, Desk 12', ip: '10.10.50.82', status: 'UNDER REVIEW' };
    }
    return { id: 'TRD-001', name: 'System Algo', role: 'Automated Agent', location: 'Colocation Rack 4', ip: '10.10.50.111', status: 'ACTIVE' };
  };
  const trader = getTraderInfo(incident.symbol);
  
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>TradeGuard Compliance Audit Report - ${incident.id}</title>
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e1b4b;
              line-height: 1.5;
              padding: 0;
              margin: 0;
              background-color: #ffffff;
            }
            
            /* Page container structure */
            .page {
              width: 210mm;
              height: 296mm;
              box-sizing: border-box;
              padding: 25mm 20mm;
              position: relative;
              page-break-after: always;
              break-after: page;
              overflow: hidden;
            }
            .page:last-child {
              page-break-after: avoid;
              break-after: avoid;
            }
            
            /* Cover Page styles */
            .cover-page {
              background-color: #0f0d2d;
              color: #ffffff;
              padding: 0;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              height: 297mm;
            }
            .cover-bg-container {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 1;
            }
            .cover-bg {
              width: 100%;
              height: 100%;
              object-fit: cover;
              opacity: 0.25;
            }
            .cover-overlay {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(180deg, rgba(15, 13, 45, 0.95) 0%, rgba(30, 20, 80, 0.98) 100%);
              z-index: 2;
            }
            .cover-content {
              position: relative;
              z-index: 3;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              padding: 35mm 25mm;
            }
            .cover-header {
              border-bottom: 2px solid #8b5cf6;
              padding-bottom: 20px;
            }
            .cover-brand {
              font-size: 32px;
              font-weight: 900;
              letter-spacing: 2px;
              color: #ffffff;
              text-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
              margin: 0;
            }
            .cover-brand span {
              color: #c084fc;
            }
            .cover-division {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 3px;
              color: #cbd5e1;
              margin-top: 4px;
              font-weight: 600;
            }
            .cover-body {
              margin-top: 60px;
              flex-grow: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .cover-title {
              font-size: 38px;
              font-weight: 800;
              line-height: 1.2;
              color: #ffffff;
              margin: 0 0 15px 0;
            }
            .cover-subtitle {
              font-size: 15px;
              color: #a78bfa;
              margin: 0;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 1.5px;
            }
            .cover-meta-box {
              background: rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(139, 92, 246, 0.3);
              border-radius: 8px;
              padding: 24px;
              margin-top: 40px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
            }
            .cover-meta-item {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .cover-meta-label {
              font-size: 9px;
              text-transform: uppercase;
              color: #c084fc;
              letter-spacing: 1px;
              font-weight: 700;
            }
            .cover-meta-val {
              font-size: 13px;
              font-weight: 600;
              color: #ffffff;
            }
            .cover-footer {
              font-size: 10px;
              color: #94a3b8;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              padding-top: 20px;
              display: flex;
              justify-content: space-between;
            }
            
            /* Page Header & Footer */
            .page-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #3f2185;
              padding-bottom: 12px;
              margin-bottom: 25px;
            }
            .page-header-logo {
              font-size: 18px;
              font-weight: 800;
              color: #3f2185;
              letter-spacing: 0.5px;
            }
            .page-header-logo span {
              color: #8b5cf6;
            }
            .page-header-title {
              font-size: 10px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              letter-spacing: 1px;
            }
            .page-footer {
              position: absolute;
              bottom: 20mm;
              left: 20mm;
              right: 20mm;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              color: #64748b;
            }
            
            /* General Typography */
            h2.section-header {
              font-size: 14px;
              font-weight: 800;
              color: #1e1b4b;
              margin-top: 0;
              margin-bottom: 15px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-left: 4px solid #8b5cf6;
              padding-left: 10px;
            }
            p.narrative {
              font-size: 12.5px;
              color: #334155;
              line-height: 1.6;
              margin-bottom: 20px;
            }
            
            /* Data Grid */
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 25px;
            }
            .card-panel {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 16px;
              position: relative;
              z-index: 5;
            }
            .card-panel-title {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              color: #64748b;
              margin-bottom: 12px;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            
            /* Details Table */
            table.dense-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 11px;
              position: relative;
              z-index: 5;
            }
            table.dense-table th {
              background-color: #f1f5f9;
              border-bottom: 2px solid #cbd5e1;
              color: #334155;
              font-weight: 700;
              text-align: left;
              padding: 8px 10px;
            }
            table.dense-table td {
              border-bottom: 1px solid #e2e8f0;
              padding: 8px 10px;
              color: #334155;
            }
            table.dense-table tr:nth-child(even) {
              background-color: #f8fafc;
            }
            
            /* Badges */
            .badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .badge.critical { background: #fef2f2; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
            .badge.high { background: #fff7ed; color: #f97316; border: 1px solid rgba(249, 115, 22, 0.2); }
            .badge.medium { background: #fef3c7; color: #d97706; border: 1px solid rgba(217, 119, 6, 0.2); }
            .badge.low { background: #f0fdf4; color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); }
            .badge.passed { background: #ecfdf5; color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
            .badge.flagged { background: #fff1f2; color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2); }
            
            /* ASCII Graph Diagram style */
            .ascii-graph-box {
              background-color: #0f172a;
              border-radius: 6px;
              padding: 16px;
              font-family: monospace;
              font-size: 11px;
              color: #38bdf8;
              line-height: 1.4;
              white-space: pre;
              overflow-x: auto;
              margin-bottom: 20px;
              border-left: 4px solid #38bdf8;
              position: relative;
              z-index: 5;
            }
            
            /* Faint Anti-Forgery Watermark */
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-30deg);
              font-size: 55px;
              font-weight: 900;
              color: rgba(139, 92, 246, 0.04);
              text-transform: uppercase;
              white-space: nowrap;
              pointer-events: none;
              z-index: 9999;
              letter-spacing: 6px;
            }

            /* Print Specific Overrides */
            @media print {
              body {
                background: #ffffff;
                -webkit-print-color-adjust: exact;
              }
              .page {
                border: none;
                box-shadow: none;
                margin: 0;
                padding: 20mm 15mm;
              }
            }
          </style>
        </head>
        <body>
          <!-- PAGE 1: COVER PAGE -->
          <div class="page cover-page">
            <div class="cover-bg-container">
              <img src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80" class="cover-bg" />
              <div class="cover-overlay"></div>
            </div>
            <div class="cover-content">
              <div class="cover-header">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                  <img src="${window.location.origin}/brandlogo.png" style="height: 38px; width: auto; object-fit: contain;" />
                  <div class="cover-brand">Trade<span>Guard</span></div>
                </div>
                <div class="cover-division">MARKET SURVEILLANCE & FORENSIC AUDIT</div>
              </div>
              
              <div class="cover-body">
                <div class="cover-title">Forensic Audit & Algorithmic Reconstruction Report</div>
                <div class="cover-subtitle">COMPLIANCE VIOLATION REFERENCE & DEEP-DIVE ANALYSIS</div>
                
                <div class="cover-meta-box">
                  <div class="cover-meta-item">
                    <span class="cover-meta-label">Audit ID</span>
                    <span class="cover-meta-val">${incident.id}</span>
                  </div>
                  <div class="cover-meta-item">
                    <span class="cover-meta-label">Security Asset</span>
                    <span class="cover-meta-val">${incident.symbol} (NSE India)</span>
                  </div>
                  <div class="cover-meta-item">
                    <span class="cover-meta-label">Threat Pattern</span>
                    <span class="cover-meta-val">${incident.pattern}</span>
                  </div>
                  <div class="cover-meta-item">
                    <span class="cover-meta-label">Severity Level</span>
                    <span class="cover-meta-val">${incident.severity}</span>
                  </div>
                </div>
              </div>
              
              <div class="cover-footer">
                <div>CLASSIFICATION: COMPLIANCE REGULATORY CONFIDENTIAL</div>
                <div>GENERATED: ${new Date().toLocaleString()}</div>
              </div>
            </div>
          </div>
          
          <!-- PAGE 2: METADATA & COMPLIANCE REGISTRY -->
          <div class="page">
            <div class="watermark">TradeGuard Compliance</div>
            
            <div class="page-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${window.location.origin}/brandlogo.png" style="height: 24px; width: auto; object-fit: contain;" />
                <div class="page-header-logo">Trade<span>Guard</span></div>
              </div>
              <div class="page-header-title">Audit Metadata Registry</div>
            </div>
            
            <h2 class="section-header">1. System Metadata & Execution Environment</h2>
            <p class="narrative">
              This section details the runtime execution environment of the TradeGuard surveillance core at the time of the flagged occurrence. 
              Data feeds were captured directly from the National Stock Exchange (NSE) direct colocation feed.
            </p>
            
            <div class="grid-2">
              <div class="card-panel">
                <div class="card-panel-title">Audit Execution Details</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                  <tr><td style="padding:4px 0; color:#64748b;">Target Server IP:</td><td style="padding:4px 0; font-weight:bold; text-align:right;">10.10.50.157</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">Surveillance Gateway:</td><td style="padding:4px 0; font-weight:bold; text-align:right;">ns-gateway.nse.internal</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">Rule Core Version:</td><td style="padding:4px 0; font-weight:bold; text-align:right;">v5.2.14-Release</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">Database Signature:</td><td style="padding:4px 0; font-weight:bold; text-align:right;">SQLite-3.42.0-Audit</td></tr>
                </table>
              </div>
              
              <div class="card-panel">
                <div class="card-panel-title">Incident Parameters</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                  <tr><td style="padding:4px 0; color:#64748b;">AI Confidence Score:</td><td style="padding:4px 0; font-weight:bold; text-align:right; color:#8b5cf6;">${(incident.confidence * 100).toFixed(1)}%</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">Detection Latency:</td><td style="padding:4px 0; font-weight:bold; text-align:right;">14ms</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">Audit Timestamp:</td><td style="padding:4px 0; font-weight:bold; text-align:right;">${formatHumanReadableTime(incident.timestamp)}</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">Case Status:</td><td style="padding:4px 0; font-weight:bold; text-align:right; color:${incident.status === 'PENDING' ? '#f97316' : '#ef4444'};">${incident.status}</td></tr>
                </table>
              </div>
            </div>
            
            <h2 class="section-header" style="margin-top:20px;">2. Surveillance Rule Checklist Status</h2>
            <table class="dense-table">
              <thead>
                <tr>
                  <th>Compliance Checkpoint</th>
                  <th>Assigned Agent Module</th>
                  <th>Core Engine Rule Ref</th>
                  <th>Status Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Order-to-Trade Ratio (OTR) Limit</td>
                  <td>OTR_Scanner_Core</td>
                  <td>Rule-SEC-12A-01</td>
                  <td><span class="badge passed">Passed</span></td>
                </tr>
                <tr>
                  <td>Rapid Quote Stuffing / Layering Check</td>
                  <td>Stuffing_Analyzer</td>
                  <td>Rule-SEC-12A-04</td>
                  <td><span class="badge flagged">Violation Flagged</span></td>
                </tr>
                <tr>
                  <td>Wash Trading Identifier</td>
                  <td>WashTrade_Detector</td>
                  <td>Rule-SEC-12A-09</td>
                  <td><span class="badge passed">Passed</span></td>
                </tr>
                <tr>
                  <td>Cross-Market Spoofing Check</td>
                  <td>Spoof_Analyzer</td>
                  <td>Rule-SEC-12A-12</td>
                  <td><span class="badge flagged">Flagged Attention</span></td>
                </tr>
                <tr>
                  <td>Exchange Gateway Lag Diagnostic</td>
                  <td>Gateway_Lag_Monitor</td>
                  <td>Rule-SEC-SYS-99</td>
                  <td><span class="badge passed">Normal</span></td>
                </tr>
              </tbody>
            </table>
            
            <div class="page-footer">
              <div>TradeGuard Forensic Audit Division</div>
              <div>Page 2 of 3</div>
            </div>
          </div>
          
          <!-- PAGE 3: FORENSIC INVESTIGATION & RCA DETAIL -->
          <div class="page">
            <div class="watermark">TradeGuard Compliance</div>
            
            <div class="page-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${window.location.origin}/brandlogo.png" style="height: 24px; width: auto; object-fit: contain;" />
                <div class="page-header-logo">Trade<span>Guard</span></div>
              </div>
              <div class="page-header-title">Forensic & Root Cause Analysis</div>
            </div>
            
            <h2 class="section-header">3. Trader Profile & Registry Signatures</h2>
            <table class="dense-table" style="margin-bottom:20px;">
              <thead>
                <tr>
                  <th>Trader ID</th>
                  <th>Associated Actor Name</th>
                  <th>Corporate Role</th>
                  <th>Terminal Host IP</th>
                  <th>Registry Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight:bold;">${trader.id}</td>
                  <td>${trader.name}</td>
                  <td>${trader.role}</td>
                  <td>${trader.ip}</td>
                  <td><span class="badge" style="background:#fff1f2; color:#e11d48; border:1px solid rgba(225,29,72,0.2);">${trader.status}</span></td>
                </tr>
              </tbody>
            </table>
            
            <h2 class="section-header">4. Root Cause Analysis (RCA) Metrics</h2>
            <table class="dense-table" style="margin-bottom:20px;">
              <thead>
                <tr>
                  <th>Metric Diagnostic</th>
                  <th>Value</th>
                  <th>Reference Threshold</th>
                  <th>Audit Deviation Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cancel-to-Fill Ratio</td>
                  <td style="font-weight:bold; color:#ef4444;">94.2%</td>
                  <td>&lt; 70.0% Max Limit</td>
                  <td style="color:#ef4444; font-weight:bold;">CRITICAL OVERFLOW</td>
                </tr>
                <tr>
                  <td>Average Cancellation Speed</td>
                  <td style="font-weight:bold; color:#ef4444;">32ms</td>
                  <td>&gt; 500ms Human Median</td>
                  <td style="color:#ef4444; font-weight:bold;">ALGORITHMIC SPEED</td>
                </tr>
                <tr>
                  <td>Order Ingress Velocity</td>
                  <td style="font-weight:bold;">124 orders/sec</td>
                  <td>&lt; 50 orders/sec Max</td>
                  <td style="color:#f97316; font-weight:bold;">HIGH PRESSURE</td>
                </tr>
                <tr>
                  <td>Target Asset Price Impact</td>
                  <td style="font-weight:bold;">0.84%</td>
                  <td>&lt; 0.10% Allowed Drift</td>
                  <td style="color:#ef4444; font-weight:bold;">MANIPULATION SIGN</td>
                </tr>
              </tbody>
            </table>
            
            <h2 class="section-header">5. Threat Vector & Graph Relational Flow</h2>
            <div class="ascii-graph-box">
[TRADER APPARATUS: ${trader.id}] --- (124 orders/sec ingress) ---&gt; [NSE GATEWAY: 10.10.50.157]
                                                                        |
                                                                  (32ms Cancel Latency)
                                                                        |
                                                                        v
[PRICE MANIPULATION INDICATOR: +0.84%] &lt;--- (Depth Pressure) --- [ORDER BOOK LEVEL 3]</div>
            
            <h2 class="section-header">6. Forensic Narrative & Compliance Auditor Sign-Off</h2>
            <p class="narrative" style="font-size:11px; margin-bottom:15px;">
              <b>Incident Analysis Log:</b> ${incident.evidence}. The algorithmic pattern triggers matched our historical models for book pressure exploitation.
              The compliance auditor team has reviewed the associated exchange feeds, and determined that the activity violates Section 12(A) of SEBI guidelines regarding unfair trade practices. 
              The account remains flagged for executive action and potential exchange suspension.
            </p>
            
            <div style="display:flex; justify-content:space-between; margin-top:20px; font-size:11px; border-top:1px dashed #cbd5e1; padding-top:15px;">
              <div>
                <div style="font-weight:bold; color:#64748b;">COMPLIANCE OFFICER</div>
                <div style="margin-top:15px; border-bottom:1px solid #94a3b8; width:150px; height:12px;"></div>
                <div style="margin-top:4px; font-size:10px; color:#94a3b8;">SEBI Compliance Officer Signature</div>
              </div>
              <div>
                <div style="font-weight:bold; color:#64748b;">SURVEILLANCE LEAD</div>
                <div style="margin-top:15px; border-bottom:1px solid #94a3b8; width:150px; height:12px;"></div>
                <div style="margin-top:4px; font-size:10px; color:#94a3b8;">TradeGuard Security Operations</div>
              </div>
            </div>
            
            <div class="page-footer">
              <div>TradeGuard Forensic Audit Division</div>
              <div>Page 3 of 3</div>
            </div>
          </div>

          <script>
            let triggered = false;
            function triggerPrint() {
              if (triggered) return;
              triggered = true;
              window.focus();
              window.print();
            }
            window.onload = triggerPrint;
            // Fallback timeout in case window load event is delayed or fails
            setTimeout(triggerPrint, 3500);
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Since we now have print trigger scripts inside the iframe, the parent page
    // only needs to clean up the iframe after the print operation has occurred!
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 15000);
  }
};

interface IncidentGraphProps {
  incident: Incident;
  isFullscreen?: boolean;
  onClose?: () => void;
  onUpdateIncident?: (id: string, status: 'PENDING' | 'ESCALATED' | 'DISMISSED') => void;
  triggerToast: (msg: string) => void;
}

const IncidentGraph: React.FC<IncidentGraphProps> = ({ incident, isFullscreen, onClose, onUpdateIncident, triggerToast }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<{ id: string; label: string; type: string } | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<{ id: string; label: string; details: string; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: { id: string; label: string; type: string } | null;
  }>({ visible: false, x: 0, y: 0, node: null });

  // We can derive associated mock trader details or other metadata based on incident properties
  const getTraderInfo = (symbol: string) => {
    if (symbol === 'TATAELXSI') {
      return { id: 'TRD-004', name: 'Rohan Mehta', role: 'Prop Trader' };
    } else if (symbol === 'LT') {
      return { id: 'TRD-002', name: 'Alice Vance', role: 'Market Maker' };
    }
    return { id: 'TRD-001', name: 'System Algo', role: 'Automated Agent' };
  };

  const trader = useMemo(() => getTraderInfo(incident.symbol), [incident.symbol]);

  const getNodeDetails = (nodeId: string) => {
    switch (nodeId) {
      case 'root':
        return `Incident Identifier: ${incident.id} (Severity: ${incident.severity}). Core node mapping the triggered Trade Surveillance Anomaly. Currently under compliance investigation.`;
      case 'security':
        return `Instrument Asset: ${incident.symbol}. This node lists the target instrument associated with anomalous bid/ask volume deviations.`;
      case 'pattern':
        return `Pattern Classification: ${incident.pattern.toUpperCase()}. Description: ${ANOMALY_INFO_MAP[incident.pattern] || 'Anomalous trading activity.'}`;
      case 'trader':
        return `Subject Entity: Account ${trader.id} (${trader.name}, ${trader.role}). The trading identity responsible for executing the transaction series.`;
      case 'time':
        return `Timestamp: ${incident.timestamp}. Marks the exact time range of the detected spoofing, wash trading, or layering burst.`;
      case 'status':
        return `Audit Status: ${incident.status}. Reflects the active triage workflow state. Can be updated using the action context options.`;
      case 'audit-auth':
        return `Session IP: 10.10.50.157. Network terminal route verified via secure corporate gateway. No geo-spoofing indicators flagged.`;
      case 'audit-risk':
        return `Risk Engine Vector: High cancel-to-fill ratio detected. Deviation is +5.40 standard deviations above historical rolling average.`;
      case 'audit-policy':
        return `Policy Rule POL-002: Automatic routing config to Level-2 Compliance Desk for Wash Trading and Layering triggers.`;
      case 'audit-db':
        return `DB Persistence: Record serialized into SQLite Audit Logs for compliance inspection and historical forensic playback.`;
      case 'time-window':
        return `Temporal Scan Range: 10-second aggregation window configured for automated threat intelligence pattern matching.`;
      case 'confidence-node':
        return `AI Confidence Level: ${(incident.confidence * 100).toFixed(0)}%. Computed using the random forest classifier trained on historical spoofing signals.`;
      default:
        return 'Forensic entity log details.';
    }
  };

  // Function to re-run the layout animation
  const triggerLayoutAnimation = () => {
    if (!cyRef.current) return;
    const layout = cyRef.current.layout({
      name: 'preset',
      animate: true,
      animationDuration: 1000,
      fit: true,
      padding: 30
    });
    layout.run();
  };

  const centerGraph = () => {
    if (!cyRef.current) return;
    cyRef.current.fit(undefined, 35);
  };

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const el = containerRef.current;
    if (el) {
      el.addEventListener('contextmenu', handleContextMenu);
    }
    return () => {
      if (el) {
        el.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Define elements with horizontal ranking positions
    const elements: cytoscape.ElementDefinition[] = [
      // Core nodes
      { 
        data: { id: 'root', label: `Incident:\n${incident.id}` }, 
        position: { x: 340, y: 190 },
        classes: 'root-node'
      },
      { 
        data: { id: 'security', label: `Security:\n${incident.symbol}` }, 
        position: { x: 480, y: 70 },
        classes: 'security-node'
      },
      { 
        data: { id: 'pattern', label: `Pattern:\n${incident.pattern}` }, 
        position: { x: 200, y: 310 },
        classes: 'pattern-node'
      },
      { 
        data: { id: 'trader', label: `Account:\n${trader.id}\n${trader.name}` }, 
        position: { x: 200, y: 190 },
        classes: 'trader-node'
      },
      { 
        data: { id: 'time', label: `Detected:\n${incident.timestamp}` }, 
        position: { x: 200, y: 70 },
        classes: 'time-node'
      },
      { 
        data: { id: 'status', label: `Audit Status:\n${incident.status}` }, 
        position: { x: 480, y: 310 },
        classes: 'status-node'
      },
      
      // Leaves/Logs
      { 
        data: { id: 'audit-auth', label: `Audit Log:\nSession active from\n10.10.50.157` }, 
        position: { x: 60, y: 190 },
        classes: 'audit-node'
      },
      { 
        data: { id: 'audit-risk', label: `Audit Log:\nBurst activity\ndetected (+5.40)` }, 
        position: { x: 620, y: 70 },
        classes: 'audit-node'
      },
      { 
        data: { id: 'audit-policy', label: `Audit Log:\nCompliance policy\nPOL-002 triggered` }, 
        position: { x: 620, y: 310 },
        classes: 'audit-node'
      },
      { 
        data: { id: 'audit-db', label: `Audit Log:\nPersisted to\nsqlite: audit_log` }, 
        position: { x: 620, y: 220 },
        classes: 'audit-node'
      },
      { 
        data: { id: 'time-window', label: `Time Window:\n10s scan interval` }, 
        position: { x: 60, y: 70 },
        classes: 'audit-node'
      },
      { 
        data: { id: 'confidence-node', label: `Confidence:\n${(incident.confidence * 100).toFixed(0)}%` }, 
        position: { x: 60, y: 310 },
        classes: 'audit-node'
      },

      // Edges with left-to-right directional flow
      { data: { source: 'time-window', target: 'time', label: 'Scan Config' }, classes: 'edge-time' },
      { data: { source: 'audit-auth', target: 'trader', label: 'Terminal Auth' }, classes: 'edge-trader' },
      { data: { source: 'confidence-node', target: 'pattern', label: 'AI Score' }, classes: 'edge-pattern' },

      { data: { source: 'time', target: 'root', label: 'Trigger Time' }, classes: 'edge-time' },
      { data: { source: 'trader', target: 'root', label: 'Subject' }, classes: 'edge-trader' },
      { data: { source: 'pattern', target: 'root', label: 'Violated Rule' }, classes: 'edge-pattern' },

      { data: { source: 'root', target: 'security', label: 'Target Asset' }, classes: 'edge-security' },
      { data: { source: 'root', target: 'status', label: 'Audit Trail' }, classes: 'edge-status' },

      { data: { source: 'security', target: 'audit-risk', label: 'Risk Analysis' }, classes: 'edge-security' },
      { data: { source: 'status', target: 'audit-db', label: 'DB Log' }, classes: 'edge-status' },
      { data: { source: 'status', target: 'audit-policy', label: 'Policy Action' }, classes: 'edge-status' },
    ];

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'font-size': '10px',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '90px',
            'width': '78px',
            'height': '78px',
            'color': '#0f172a',
            'background-color': '#ffffff',
            'border-width': '2px',
            'border-color': '#cbd5e1',
            'font-weight': 'bold',
            'font-family': 'Inter, system-ui, -apple-system, sans-serif'
          }
        },
        {
          selector: 'node.hovered',
          style: {
            'border-width': '3px',
            'border-color': '#1e293b',
            'background-color': '#f8fafc'
          }
        },
        {
          selector: '.root-node',
          style: {
            'width': '90px',
            'height': '90px',
            'border-color': '#ef5350',
            'background-color': '#fef2f2',
            'font-weight': 'bold',
            'font-size': '11px'
          }
        },
        {
          selector: '.security-node',
          style: {
            'shape': 'round-rectangle',
            'width': '85px',
            'height': '65px',
            'border-color': '#3b82f6',
            'background-color': '#eff6ff'
          }
        },
        {
          selector: '.pattern-node',
          style: {
            'shape': 'hexagon',
            'width': '85px',
            'height': '75px',
            'border-color': '#a855f7',
            'background-color': '#faf5ff'
          }
        },
        {
          selector: '.trader-node',
          style: {
            'border-color': '#10b981',
            'background-color': '#ecfdf5',
            'font-weight': 'bold'
          }
        },
        {
          selector: '.time-node',
          style: {
            'shape': 'diamond',
            'border-color': '#64748b',
            'background-color': '#f8fafc'
          }
        },
        {
          selector: '.status-node',
          style: {
            'shape': 'rectangle',
            'width': '85px',
            'height': '55px',
            'border-color': '#f97316',
            'background-color': '#fff7ed'
          }
        },
        {
          selector: '.audit-node',
          style: {
            'shape': 'round-rectangle',
            'width': '105px',
            'height': '55px',
            'font-size': '8.5px',
            'border-color': '#94a3b8',
            'background-color': '#f1f5f9',
            'color': '#475569',
            'font-weight': 'normal'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#cbd5e1',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.3,
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#64748b',
            'text-background-opacity': 1,
            'text-background-color': '#ffffff',
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'line-style': 'dashed',
            'line-dash-pattern': [6, 4]
          }
        },
        {
          selector: 'edge.hovered-edge',
          style: {
            'width': 3,
            'line-color': '#0f172a',
            'target-arrow-color': '#0f172a'
          }
        },
        {
          selector: '.edge-security',
          style: {
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6'
          }
        },
        {
          selector: '.edge-pattern',
          style: {
            'line-color': '#a855f7',
            'target-arrow-color': '#a855f7'
          }
        },
        {
          selector: '.edge-trader',
          style: {
            'line-color': '#10b981',
            'target-arrow-color': '#10b981'
          }
        },
        {
          selector: '.edge-time',
          style: {
            'line-color': '#64748b',
            'target-arrow-color': '#64748b'
          }
        },
        {
          selector: '.edge-status',
          style: {
            'line-color': '#f97316',
            'target-arrow-color': '#f97316'
          }
        }
      ],
      layout: {
        name: 'preset',
        fit: true,
        padding: 30
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    });

    cyRef.current = cy;

    // Immediately fit canvas
    cy.fit(undefined, 30);

    // Node click handlers to show appropriate context actions
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode({
        id: node.id(),
        label: node.data('label'),
        type: node.classes()[0] || 'default-node'
      });
      setContextMenu({ visible: false, x: 0, y: 0, node: null });
    });

    // Right-click context menu handler for both nodes and canvas background
    cy.on('cxttap', (evt) => {
      const originalEvent = evt.originalEvent;
      if (!originalEvent) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = originalEvent.clientX - rect.left;
      const y = originalEvent.clientY - rect.top;

      const node = evt.target !== cy ? evt.target : null;
      setContextMenu({
        visible: true,
        x,
        y,
        node: node ? {
          id: node.id(),
          label: node.data('label'),
          type: node.classes()[0] || 'default-node'
        } : null
      });
    });

    // Clear context menu and selection on tap background
    cy.on('tap', (evt) => {
      setContextMenu({ visible: false, x: 0, y: 0, node: null });
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    // Mouseover / Mouseout for tooltips (only when in fullscreen)
    cy.on('mouseover', 'node', (evt) => {
      if (!isFullscreen) return;
      const node = evt.target;
      node.addClass('hovered');
      
      const originalEvent = evt.originalEvent;
      let x = 0;
      let y = 0;
      if (originalEvent) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          x = originalEvent.clientX - rect.left;
          y = originalEvent.clientY - rect.top;
        }
      }

      setHoveredEntity({
        id: node.id(),
        label: node.data('label').replace(/\n/g, ' '),
        details: getNodeDetails(node.id()),
        x,
        y
      });
    });

    cy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('hovered');
      setHoveredEntity(null);
    });

    cy.on('mouseover', 'edge', (evt) => {
      if (!isFullscreen) return;
      const edge = evt.target;
      edge.addClass('hovered-edge');
      const sourceLabel = edge.source().data('label').replace(/\n/g, ' ');
      const targetLabel = edge.target().data('label').replace(/\n/g, ' ');
      const label = edge.data('label');

      const originalEvent = evt.originalEvent;
      let x = 0;
      let y = 0;
      if (originalEvent) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          x = originalEvent.clientX - rect.left;
          y = originalEvent.clientY - rect.top;
        }
      }

      setHoveredEntity({
        id: edge.id(),
        label: `Relation: ${label}`,
        details: `Connecting forensic vector: "${sourceLabel}" flows directly to "${targetLabel}".`,
        x,
        y
      });
    });

    cy.on('mouseout', 'edge', (evt) => {
      evt.target.removeClass('hovered-edge');
      setHoveredEntity(null);
    });

    cy.on('mousemove', (evt) => {
      if (!isFullscreen) return;
      const originalEvent = evt.originalEvent;
      if (originalEvent) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const x = originalEvent.clientX - rect.left;
          const y = originalEvent.clientY - rect.top;
          setHoveredEntity(prev => prev ? { ...prev, x, y } : null);
        }
      }
    });

    // Flow animation along the edges + pulsing root node
    let frameId: number;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      // 1. Pulse root border
      const pulse = Math.abs(Math.sin(elapsed / 450)) * 3 + 1.5;
      cy.nodes('.root-node').style('border-width', `${pulse}px`);

      // 2. Continuous dash offset movement
      const offset = -Math.floor(elapsed / 30) % 20;
      cy.edges().style('line-dash-offset', offset);

      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [incident.id, incident.status, trader.id, isFullscreen]);

  const getNodeActions = (node: { id: string; label: string; type: string }) => {
    switch (node.type) {
      case 'root-node':
        return [
          { name: 'Acknowledge', action: 'ACK', color: '#1a73e8' },
          { name: 'Export PDF', action: 'PDF', color: '#475569' }
        ];
      case 'security-node':
        return [
          { name: 'Halt Trading', action: 'HALT', color: '#ef5350' },
          { name: 'Inspect Depth', action: 'DEPTH', color: '#1a73e8' }
        ];
      case 'trader-node':
        return [
          { name: 'Restrict Account', action: 'RESTRICT', color: '#ef5350' },
          { name: 'Session Audit', action: 'AUDIT', color: '#10b981' }
        ];
      case 'pattern-node':
        return [
          { name: 'Tune Threshold', action: 'TUNE', color: '#9333ea' },
          { name: 'View Rules', action: 'RULES', color: '#475569' }
        ];
      case 'status-node':
        return [
          { name: 'Escalate Status', action: 'SET_ESCALATED', color: '#ef5350' },
          { name: 'Dismiss Status', action: 'SET_DISMISSED', color: '#10b981' }
        ];
      case 'time-node':
        return [
          { name: 'Zoom Window', action: 'ZOOM_TIME', color: '#64748b' }
        ];
      default:
        return [
          { name: 'Inspect Log', action: 'LOG', color: '#475569' }
        ];
    }
  };

  const handleActionClick = (action: { name: string; action: string; color: string }) => {
    switch (action.action) {
      case 'ACK':
        triggerToast(`Incident ${incident.id} marked as acknowledged.`);
        break;
      case 'PDF':
        printIncidentReport(incident);
        triggerToast(`Generating professional incident audit trail PDF...`);
        break;
      case 'HALT':
        triggerToast(`Trading halt request for ${incident.symbol} submitted to compliance engine.`);
        break;
      case 'DEPTH':
        triggerToast(`Retrieved high-frequency depth logs for ${incident.symbol}.`);
        break;
      case 'RESTRICT':
        triggerToast(`Trader Account ${trader.id} restricted from placing new orders.`);
        break;
      case 'AUDIT':
        triggerToast(`Retrieved audit logs: Login from IP 10.10.50.157, User Agent: TradeShield_Agent_V3`);
        break;
      case 'TUNE':
        triggerToast(`Calibrated pattern threshold for ${incident.pattern} to 92.5% confidence.`);
        break;
      case 'RULES':
        triggerToast(`Displaying logic details: pattern=${incident.pattern}, min_volume=5.40, window=10s`);
        break;
      case 'SET_ESCALATED':
        onUpdateIncident?.(incident.id, 'ESCALATED');
        triggerToast(`Incident status updated to ESCALATED.`);
        break;
      case 'SET_DISMISSED':
        onUpdateIncident?.(incident.id, 'DISMISSED');
        triggerToast(`Incident status updated to DISMISSED.`);
        break;
      case 'ZOOM_TIME':
        triggerToast(`Inspection time window locked: 15:30:02 to 15:30:12.`);
        break;
      case 'LOG':
        triggerToast(`Log Details: Audit Log payload verified at 10.10.50.157.`);
        break;
      default:
        triggerToast(`Action executed: ${action.name}`);
    }
  };

  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'relative', width: '100%', height: isFullscreen ? '100%' : '380px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: '#ffffff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      
      {/* Controls Header Overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        display: 'flex',
        gap: '6px',
        zIndex: 10
      }}>
        <button
          onClick={triggerLayoutAnimation}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#1e293b',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <RefreshCw size={11} /> Re-run Layout
        </button>
        <button
          onClick={centerGraph}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#1e293b',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          Fit Canvas
        </button>
      </div>

      {/* Fullscreen Toggle Button */}
      {!isFullscreen && (
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#1e293b',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            zIndex: 10
          }}
        >
          <Maximize2 size={11} /> Fullscreen
        </button>
      )}

      {/* Canvas with Grid */}
      <div 
        ref={containerRef} 
        style={{ 
          flex: 1, 
          width: '100%', 
          height: '100%',
          backgroundColor: '#f8fafc',
          backgroundImage: 'linear-gradient(to right, rgba(148, 163, 184, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} 
      />

      {/* Hover Information Tooltip next to cursor - Only visible in Fullscreen */}
      {isFullscreen && hoveredEntity && !contextMenu.visible && (
        <div style={{
          position: 'absolute',
          left: `${hoveredEntity.x + 20}px`,
          top: `${hoveredEntity.y - 15}px`,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(8px)',
          color: '#ffffff',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid #334155',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          zIndex: 200,
          pointerEvents: 'none',
          maxWidth: '280px',
          fontSize: '11px',
          lineHeight: '1.4',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', borderBottom: '1px solid #334155', paddingBottom: '4px', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.5px', color: '#38bdf8' }}>
            <Activity size={12} /> Forensic Inspector
          </div>
          <div style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '12px' }}>
            {hoveredEntity.label}
          </div>
          <div style={{ color: '#cbd5e1' }}>
            {hoveredEntity.details}
          </div>
        </div>
      )}

      {/* Right-click Context Menu */}
      {contextMenu.visible && (
        <div 
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            padding: '4px 0',
            zIndex: 150,
            minWidth: '160px'
          }}
        >
          {contextMenu.node ? (
            <>
              <div style={{ padding: '6px 12px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>
                {contextMenu.node.label.split('\n')[0]} Actions
              </div>
              {getNodeActions(contextMenu.node).map((action, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleActionClick(action);
                    setContextMenu({ visible: false, x: 0, y: 0, node: null });
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#1e293b',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: action.color, display: 'inline-block' }} />
                  {action.name}
                </button>
              ))}
            </>
          ) : (
            <>
              <div style={{ padding: '6px 12px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>
                Canvas Actions
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerLayoutAnimation();
                  setContextMenu({ visible: false, x: 0, y: 0, node: null });
                }}
                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#1e293b', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🔄 Re-run Layout
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  centerGraph();
                  setContextMenu({ visible: false, x: 0, y: 0, node: null });
                }}
                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#1e293b', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🔍 Fit Canvas
              </button>
            </>
          )}
        </div>
      )}

      {/* Node Actions Panel */}
      {selectedNode ? (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '10px 14px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>
              Selected Entity Actions
            </span>
            <strong style={{ fontSize: '11px', color: '#1e293b' }}>
              {selectedNode.label.replace(/\n/g, ' ')}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {getNodeActions(selectedNode).map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleActionClick(action)}
                style={{
                  padding: '5px 10px',
                  fontSize: '9px',
                  fontWeight: '700',
                  color: 'white',
                  backgroundColor: action.color,
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                {action.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '9px', color: '#64748b', pointerEvents: 'none' }}>
          💡 Click or right-click any node/box to view context compliance actions
        </div>
      )}
    </div>
  );
};;

function App() {
  // Navigation: Single word menu names
  const [currentView, setCurrentView] = useState<'compliance' | 'incidents' | 'events' | 'rca' | 'simulators' | 'channels' | 'policies'>('compliance');
  const [activeDetailTab, setActiveDetailTab] = useState<'summary' | 'graph'>('graph');
  const [isFullscreenGraph, setIsFullscreenGraph] = useState<boolean>(false);

  // Chart Customization Options
  const [chartUpColor, setChartUpColor] = useState('#26a69a');
  const [chartDownColor, setChartDownColor] = useState('#ef5350');
  const [showGridLines, setShowGridLines] = useState(true);
  const [chartTheme, setChartTheme] = useState<'dark' | 'light'>('dark');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);



  const handleUpdateIncidentStatus = (id: string, status: 'PENDING' | 'ESCALATED' | 'DISMISSED') => {
    setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, status } : inc));
    setSelectedIncident(prev => prev && prev.id === id ? { ...prev, status } : prev);
  };

  // Alert Channels Config States
  const [channelSearch, setChannelSearch] = useState<string>("");
  const [telegramConfig, setTelegramConfig] = useState({ enabled: true, botToken: "bot7284918274:AAHDF83k...", chatId: "-1002938481" });
  const [smtpConfig, setSmtpConfig] = useState({ enabled: false, host: "smtp.tradeshield.internal", port: 587, user: "compliance-alert", from: "alert@tradeshield.com", to: "desk-l1@tradeshield.com" });
  const [jiraConfig, setJiraConfig] = useState({ enabled: true, endpoint: "https://jira.tradeshield.internal/rest/api/2", projectKey: "COMP", issueType: "Incident", token: "bearer p83klw89s7..." });
  const [teamsConfig, setTeamsConfig] = useState({ enabled: false, webhookUrl: "https://outlook.office.com/webhook/73a98...", channelName: "Compliance Alerts" });

  const saveTelegramConfig = async (overrideEnabled?: boolean) => {
    try {
      const isEnabled = typeof overrideEnabled === 'boolean' ? overrideEnabled : telegramConfig.enabled;
      const response = await fetch(`${BACKEND_URL}/api/v1/channels/config/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: isEnabled,
          config: {
            botToken: telegramConfig.botToken,
            chatId: telegramConfig.chatId
          }
        })
      });
      if (response.ok) {
        triggerToast("Telegram configuration saved to database successfully.");
      } else {
        triggerToast("Failed to save Telegram configuration.");
      }
    } catch (err) {
      triggerToast("Error saving Telegram configuration: " + err);
    }
  };

  const saveSmtpConfig = async (overrideEnabled?: boolean) => {
    try {
      const isEnabled = typeof overrideEnabled === 'boolean' ? overrideEnabled : smtpConfig.enabled;
      const response = await fetch(`${BACKEND_URL}/api/v1/channels/config/smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: isEnabled,
          config: {
            host: smtpConfig.host,
            port: smtpConfig.port,
            user: smtpConfig.user,
            from: smtpConfig.from,
            to: smtpConfig.to
          }
        })
      });
      if (response.ok) {
        triggerToast("SMTP configuration saved to database successfully.");
      } else {
        triggerToast("Failed to save SMTP configuration.");
      }
    } catch (err) {
      triggerToast("Error saving SMTP configuration: " + err);
    }
  };

  const saveJiraConfig = async (overrideEnabled?: boolean) => {
    try {
      const isEnabled = typeof overrideEnabled === 'boolean' ? overrideEnabled : jiraConfig.enabled;
      const response = await fetch(`${BACKEND_URL}/api/v1/channels/config/jira`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: isEnabled,
          config: {
            endpoint: jiraConfig.endpoint,
            projectKey: jiraConfig.projectKey,
            issueType: jiraConfig.issueType,
            token: jiraConfig.token
          }
        })
      });
      if (response.ok) {
        triggerToast("Jira configuration saved to database successfully.");
      } else {
        triggerToast("Failed to save Jira configuration.");
      }
    } catch (err) {
      triggerToast("Error saving Jira configuration: " + err);
    }
  };

  const saveTeamsConfig = async (overrideEnabled?: boolean) => {
    try {
      const isEnabled = typeof overrideEnabled === 'boolean' ? overrideEnabled : teamsConfig.enabled;
      const response = await fetch(`${BACKEND_URL}/api/v1/channels/config/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: isEnabled,
          config: {
            webhookUrl: teamsConfig.webhookUrl,
            channelName: teamsConfig.channelName
          }
        })
      });
      if (response.ok) {
        triggerToast("Teams configuration saved to database successfully.");
      } else {
        triggerToast("Failed to save Teams configuration.");
      }
    } catch (err) {
      triggerToast("Error saving Teams configuration: " + err);
    }
  };

  const testTelegramConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/channels/test/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramConfig.botToken,
          chatId: telegramConfig.chatId
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        triggerToast(`Telegram connection test: Success! Msg ID: ${data.message_id}`);
      } else {
        triggerToast(`Telegram connection test failed: ${data.message}`);
      }
    } catch (err) {
      triggerToast("Telegram test error: " + err);
    }
  };

  const testSmtpConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/channels/test/smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpConfig.host,
          port: smtpConfig.port,
          user: smtpConfig.user,
          from: smtpConfig.from,
          to: smtpConfig.to
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        triggerToast(`SMTP connection test: Success!`);
      } else {
        triggerToast(`SMTP connection test failed: ${data.message}`);
      }
    } catch (err) {
      triggerToast("SMTP test error: " + err);
    }
  };

  const testJiraConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/channels/test/jira`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: jiraConfig.endpoint,
          projectKey: jiraConfig.projectKey,
          issueType: jiraConfig.issueType,
          token: jiraConfig.token
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        triggerToast(`Jira connection test: Success! Issue created: ${data.issue_key}`);
      } else {
        triggerToast(`Jira connection test failed: ${data.message}`);
      }
    } catch (err) {
      triggerToast("Jira test error: " + err);
    }
  };

  const testTeamsConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/channels/test/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: teamsConfig.webhookUrl,
          channelName: teamsConfig.channelName
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        triggerToast(`Teams connection test: Success!`);
      } else {
        triggerToast(`Teams connection test failed: ${data.message}`);
      }
    } catch (err) {
      triggerToast("Teams test error: " + err);
    }
  };

  // Policies States
  const [policySearch, setPolicySearch] = useState<string>("");
  const [policies, setPolicies] = useState([
    { id: "POL-001", name: "Auto-Block Trader on Critical Spoofing", pattern: "SPOOFING", severity: "CRITICAL", action: "BLOCK_TRADER", channels: ["Telegram", "SMTP"], enabled: true },
    { id: "POL-002", name: "Escalate Wash Trading to L2 Compliance", pattern: "WASH_TRADING", severity: "HIGH", action: "ESCALATE", channels: ["Telegram", "Jira"], enabled: true },
    { id: "POL-003", name: "Throttle Quote Stuffing Rate on NSE", pattern: "QUOTE_STUFFING", severity: "MEDIUM", action: "THROTTLE_RATE", channels: ["Teams"], enabled: false },
    { id: "POL-004", name: "Log Pump & Dump to External Audit DB", pattern: "PUMP_DUMP", severity: "LOW", action: "LOG_AUDIT", channels: ["SMTP"], enabled: true },
  ]);
  const [showAddPolicyModal, setShowAddPolicyModal] = useState<boolean>(false);
  const [newPolicyName, setNewPolicyName] = useState<string>("");
  const [newPolicyPattern, setNewPolicyPattern] = useState<string>("SPOOFING");
  const [newPolicySeverity, setNewPolicySeverity] = useState<string>("HIGH");
  const [newPolicyAction, setNewPolicyAction] = useState<string>("ESCALATE");
  const [newPolicyChannels, setNewPolicyChannels] = useState<string[]>(["Telegram"]);

  // Multi-select & Edit States for Policies
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [editingPolicy, setEditingPolicy] = useState<any | null>(null);
  const [showEditPolicyModal, setShowEditPolicyModal] = useState<boolean>(false);

  // User Profile Dropdown & Trader CRUD States
  const [showUserProfileDropdown, setShowUserProfileDropdown] = useState<boolean>(false);
  const [showTraderCRUDModal, setShowTraderCRUDModal] = useState<boolean>(false);
  const [crudModalMode, setCrudModalMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingTrader, setEditingTrader] = useState<any | null>(null);
  const [newTraderId, setNewTraderId] = useState<string>("");
  const [newTraderName, setNewTraderName] = useState<string>("");
  const [newTraderRole, setNewTraderRole] = useState<string>("");
  const [newTraderSector, setNewTraderSector] = useState<string>("");
  const [newTraderStatus, setNewTraderStatus] = useState<string>("ACTIVE");
  // RCA Incident search states
  const [rcaSearchQuery, setRcaSearchQuery] = useState<string>("");
  const [showRcaIncidentDropdown, setShowRcaIncidentDropdown] = useState<boolean>(false);
  const [rcaSelectedIncident, setRcaSelectedIncident] = useState<Incident | null>(null);
  const [rcaLoading, setRcaLoading] = useState<boolean>(false);

  // Event log filter states
  const [eventSearchQuery, setEventSearchQuery] = useState<string>("");
  const [eventTagFilter, setEventTagFilter] = useState<string>("ALL");

  // Trader Directory selection
  const FALLBACK_TRADERS = [
    { trader_id: "TRADER_001", name: "Aarav Sharma", role: "Senior Desk Trader", sector: "Energy" },
    { trader_id: "TRADER_002", name: "Aditya Patel", role: "HFT Specialist", sector: "Tech/Fin" },
    { trader_id: "TRADER_003", name: "Ananya Iyer", role: "Arbitrage Associate", sector: "Materials" },
    { trader_id: "TRADER_004", name: "Karan Malhotra", role: "Proprietary Trader", sector: "Consumer" },
    { trader_id: "TRADER_005", name: "Priya Rao", role: "Quantitative Analyst", sector: "Healthcare" }
  ];
  const [tradersList, setTradersList] = useState<any[]>(FALLBACK_TRADERS);
  const [traderSearchQuery, setTraderSearchQuery] = useState<string>("Aarav Sharma (TRADER_001)");
  const [showTraderDropdown, setShowTraderDropdown] = useState<boolean>(false);

  const refreshTradersList = () => {
    fetch(`${BACKEND_URL}/api/v1/detect/traders`)
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setTradersList(data);
        }
      })
      .catch(err => {
        console.error("Failed to refresh traders list:", err);
      });
  };

  const refreshPoliciesList = () => {
    fetch(`${BACKEND_URL}/api/v1/detect/policies`)
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setPolicies(data);
        }
      })
      .catch(err => {
        console.error("Failed to refresh policies list:", err);
      });
  };

  const refreshIncidentsList = () => {
    fetch(`${BACKEND_URL}/api/v1/detect/incidents`)
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setIncidents(data);
          if (data.length > 0) {
            setSelectedIncident(prev => {
              if (!prev) return data[0];
              const found = data.find(i => i.id === prev.id);
              return found || data[0];
            });
          }
        }
      })
      .catch(err => {
        console.error("Failed to refresh incidents list:", err);
      });
  };

  const refreshEventsList = () => {
    fetch(`${BACKEND_URL}/api/v1/detect/events`)
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setLogs(data.map(log => log.message));
        }
      })
      .catch(err => {
        console.error("Failed to refresh events list:", err);
      });
  };

  const exportPolicies = (policiesToExport: typeof policies) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(policiesToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `policy_rules_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast(`Exported ${policiesToExport.length} policy rules.`);
  };

  const handleImportPolicies = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          const validated = imported.map((p, idx) => ({
            id: p.id || `POL-IMP-${Date.now()}-${idx}`,
            name: p.name || "Imported Rule",
            pattern: p.pattern || "SPOOFING",
            severity: p.severity || "MEDIUM",
            action: p.action || "LOG_AUDIT",
            channels: Array.isArray(p.channels) ? p.channels : ["Telegram"],
            enabled: typeof p.enabled === 'boolean' ? p.enabled : true
          }));
          fetch(`${BACKEND_URL}/api/v1/detect/policies/bulk-import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ policies: validated })
          })
          .then(res => {
            if (!res.ok) throw new Error("API error");
            return res.json();
          })
          .then(() => {
            refreshPoliciesList();
            triggerToast(`Successfully imported ${validated.length} policy rules.`);
          })
          .catch(err => {
            console.error("Failed to bulk import policies:", err);
            triggerToast("Failed to import policies into database.");
          });
        } else {
          triggerToast("Invalid format. Imported data must be an array of rules.");
        }
      } catch {
        triggerToast("Failed to parse JSON policy file.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };


  useEffect(() => {
    fetch(`${BACKEND_URL}/api/v1/detect/traders`)
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTradersList(data);
          const first = data[0];
          setActorAccountId(first.trader_id);
          setTraderSearchQuery(`${first.name} (${first.trader_id})`);
        }
      })
      .catch(err => {
        console.warn("Could not fetch trader profiles from backend, using fallbacks:", err);
      });
    
    // Fetch channels configurations
    fetch(`${BACKEND_URL}/api/v1/channels/config`)
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(data => {
        if (data.telegram) {
          setTelegramConfig({
            enabled: data.telegram.enabled ?? false,
            botToken: data.telegram.botToken ?? "",
            chatId: data.telegram.chatId ?? ""
          });
        }
        if (data.smtp) {
          setSmtpConfig({
            enabled: data.smtp.enabled ?? false,
            host: data.smtp.host ?? "",
            port: data.smtp.port ?? 587,
            user: data.smtp.user ?? "",
            from: data.smtp.from ?? "",
            to: data.smtp.to ?? ""
          });
        }
        if (data.jira) {
          setJiraConfig({
            enabled: data.jira.enabled ?? false,
            endpoint: data.jira.endpoint ?? "",
            projectKey: data.jira.projectKey ?? "",
            issueType: data.jira.issueType ?? "Incident",
            token: data.jira.token ?? ""
          });
        }
        if (data.teams) {
          setTeamsConfig({
            enabled: data.teams.enabled ?? false,
            webhookUrl: data.teams.webhookUrl ?? "",
            channelName: data.teams.channelName ?? ""
          });
        }
      })
      .catch(err => {
        console.warn("Could not fetch channels configurations from backend:", err);
      });

    refreshPoliciesList();
    refreshIncidentsList();
    refreshEventsList();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.anomaly-control-group')) {
        setShowTraderDropdown(false);
      }
      if (!target.closest('.user-profile-group')) {
        setShowUserProfileDropdown(false);
      }
      if (!target.closest('.rca-dropdown-group')) {
        setShowRcaIncidentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // App settings
  const [funds, setFunds] = useState<number>(150000); 
  const [showAddFundsModal, setShowAddFundsModal] = useState<boolean>(false);
  const [addFundsAmount, setAddFundsAmount] = useState<string>("50000");

  // System Settings Modal states
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [profileName, setProfileName] = useState<string>(() => localStorage.getItem("tradeSurveillance_profileName") || "Rohan Sharma");
  const [profileRole, setProfileRole] = useState<string>(() => localStorage.getItem("tradeSurveillance_profileRole") || "Compliance L1 Officer");
  const [llmProvider, setLlmProvider] = useState<string>(() => localStorage.getItem("tradeSurveillance_llmProvider") || "Anthropic Claude");
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>(() => localStorage.getItem("tradeSurveillance_anthropicApiKey") || "");
  const [openaiApiKey, setOpenaiApiKey] = useState<string>(() => localStorage.getItem("tradeSurveillance_openaiApiKey") || "");
  const [showAnthropicKey, setShowAnthropicKey] = useState<boolean>(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState<boolean>(false);


  // Panel resizing & UI collapse states
  const [watchlistWidth, setWatchlistWidth] = useState<number>(280);
  const [orderPanelWidth, setOrderPanelWidth] = useState<number>(340);
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const [isResizingRight, setIsResizingRight] = useState<boolean>(false);
  const [isMarketDepthCollapsed, setIsMarketDepthCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(200, Math.min(600, e.clientX));
        setWatchlistWidth(newWidth);
      } else if (isResizingRight) {
        const newWidth = Math.max(240, Math.min(600, window.innerWidth - e.clientX));
        setOrderPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  const startResizing = (e: React.MouseEvent, direction: 'left' | 'right') => {
    e.preventDefault();
    if (direction === 'left') {
      setIsResizingLeft(true);
    } else {
      setIsResizingRight(true);
    }
  };

  // Watchlist state
  const [activeInstrumentId, setActiveInstrumentId] = useState<string>("INE002A01018"); // Default: RELIANCE
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Company Details (dynamic + cached fallback)
  const [companyDetails, setCompanyDetails] = useState<Record<string, CompanyMetadata>>(INITIAL_COMPANY_METADATA);

  // Replay speed state
  const [replaySpeed, setReplaySpeed] = useState<number>(10); // Default 10x
  const [isReplaying, setIsReplaying] = useState<boolean>(true);
  const [jumpDateTime, setJumpDateTime] = useState<string>("");
  const [datasetTimeRange, setDatasetTimeRange] = useState<{ start: string; end: string } | null>(null);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<string | null>(null);

  // Live state
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [lastLtp, setLastLtp] = useState<number>(1291.00);
  const [priceChange, setPriceChange] = useState<{ change: number; pct: number }>({ change: 0, pct: 0 });

  // Candlestick aggregator states
  const [candles, setCandles] = useState<CandlestickData[]>([]);
  const [volumes, setVolumes] = useState<HistogramData[]>([]);
  
  // Order Panel Form
  const [orderAction, setOrderAction] = useState<'BUY' | 'SELL'>('BUY');
  const [orderTab, setOrderTab] = useState<'REGULAR' | 'GTT'>('REGULAR');
  const [orderDuration, setOrderDuration] = useState<'DELIVERY' | 'INTRADAY'>('DELIVERY');
  const [orderQty, setOrderQty] = useState<number>(10);
  const [orderPrice, setOrderPrice] = useState<string>("1291.00");
  const [orderPriceType, setOrderPriceType] = useState<'LIMIT' | 'MARKET'>('LIMIT');

  // Portfolio states
  const [positions, setPositions] = useState<Position[]>([]);
  const [toasts, setToasts] = useState<string[]>([]);

  // Real-time events logs (No emojis)
  const [logs, setLogs] = useState<string[]>([
    "TradeShield security core initialised",
    "Connection established to Market Feed on port :8000",
    "Real-time Pattern Recognition scanner armed"
  ]);

  // Incidents log
  const [incidents, setIncidents] = useState<Incident[]>([
    {
      id: "INC-2026-9042",
      symbol: "LT",
      pattern: "Quote Stuffing",
      severity: "HIGH",
      timestamp: "2026-06-06 14:10:05",
      status: "ESCALATED",
      confidence: 0.88,
      evidence: "142 orders placed and cancelled in 240ms. Price pressure was created on Sell book."
    },
    {
      id: "INC-2026-8812",
      symbol: "TATAELXSI",
      pattern: "Insider Trading",
      severity: "CRITICAL",
      timestamp: "2026-06-06 15:30:12",
      status: "PENDING",
      confidence: 0.94,
      evidence: "Block transaction size +5.40 vs average 30-day baseline before corporate quarterly earnings release."
    }
  ]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(incidents[0]);

  // Incident Markers & Tooltips
  const [hoveredIncidentId, setHoveredIncidentId] = useState<string | null>(null);
  const [markerTooltipPos, setMarkerTooltipPos] = useState<{ x: number, y: number } | null>(null);
  const incidentsRef = useRef(incidents);
  useEffect(() => {
    incidentsRef.current = incidents;
  }, [incidents]);

  const hoveredIncident = useMemo(() => {
    if (!hoveredIncidentId) return null;
    return incidents.find(i => i.id === hoveredIncidentId);
  }, [hoveredIncidentId, incidents]);

  // Compliance Surveillance states
  const [surveillanceAlert, setSurveillanceAlert] = useState<ComplianceAlert | null>(null);
  const [triageReport, setTriageReport] = useState<TriageResult | null>(null);
  const [triageLoading, setTriageLoading] = useState<boolean>(false);
  const [showCompliancePanel, setShowCompliancePanel] = useState<boolean>(false);

  // Anomaly Injection panel - light theme & detailed inputs
  const [showAnomalyPanel, setShowAnomalyPanel] = useState<boolean>(false);
  const [anomalyPanelPos, setAnomalyPanelPos] = useState({ x: 340, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isAnomalyCollapsed, setIsAnomalyCollapsed] = useState(false);

  // Custom Controls for Rogue Actor Threat Injector
  const [customPattern, setCustomPattern] = useState<string>("layering");
  const [actorAccountId, setActorAccountId] = useState<string>("ACTOR_ROGUE_7");
  const [customSeverity, setCustomSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>("HIGH");
  const [customCancelRatio, setCustomCancelRatio] = useState<number>(85); // 0-100%
  const [customCancelMedian, setCustomCancelMedian] = useState<number>(450); // 0-2000 ms
  const [customOrderCount, setCustomOrderCount] = useState<number>(14);
  const [customPriceImpact, setCustomPriceImpact] = useState<number>(1.8); // 0-10%

  // References for TradingView Chart
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lastInstrumentIdRef = useRef<string | null>(null);
  const currentCandleOpenRef = useRef<number | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const eventsConsoleEndRef = useRef<HTMLDivElement>(null);
  const lastHistoricalTimestampRef = useRef<string | null>(null);
  const lastStreamedTimestampRef = useRef<string | null>(null);
  const activeInstrumentIdRef = useRef<string>("");
  const replaySpeedRef = useRef<number>(10);
  const markersPluginRef = useRef<any>(null);

  // Helper for adding notifications and logging events
  const triggerToast = (msg: string) => {
    setToasts(prev => [...prev, msg]);
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 3000);
  };

  const addEventLog = (msg: string, tag: string = "INFO") => {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] [${tag}] ${msg}`;
    fetch(`${BACKEND_URL}/api/v1/detect/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: formatted })
    })
    .then(res => {
      if (!res.ok) throw new Error("API error");
      return res.json();
    })
    .then(() => {
      refreshEventsList();
    })
    .catch(err => {
      console.warn("Could not save log to backend:", err);
      setLogs(prev => [...prev, formatted]);
    });
  };

  // Scroll events log console
  useEffect(() => {
    if (eventsConsoleEndRef.current) {
      eventsConsoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // 1. Fetch Instruments & query Clearbit suggestions for domain details
  useEffect(() => {
    const fetchInstruments = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/trades/instruments`);
        const result = await response.json();
        
        if (result.status === "success") {
          const apiInstruments = result.instruments.map((inst: any) => {
            const mapped = DATASETS_MAP[inst.instrument_id] || { symbol: inst.instrument_id, name: inst.instrument_id };
            return {
              instrument_id: inst.instrument_id,
              file: inst.file,
              exchange: inst.exchange,
              symbol: mapped.symbol,
              name: mapped.name,
              price: 1300.0,
              change: 0.0,
              changePercent: 0.0,
              prevClose: 1300.0
            };
          });
          setInstruments(apiInstruments);
          addEventLog(`Fetched ${apiInstruments.length} active CSV datasets from backend nodes.`, "SYSTEM");
        }
      } catch (err) {
        console.error("Failed to load instruments:", err);
        const fallbackList = Object.entries(DATASETS_MAP).map(([id, val]) => ({
          instrument_id: id,
          file: `${id}.csv`,
          exchange: "NSE_EQ",
          symbol: val.symbol,
          name: val.name,
          price: 1300.0,
          change: 0.0,
          changePercent: 0.0,
          prevClose: 1300.0
        }));
        setInstruments(fallbackList);
      }
    };
    
    fetchInstruments();

    // Query Clearbit Autocomplete suggestions to enrich domains and favicons (ensure www. prefix)
    const loadClearbitInfo = async () => {
      const symbols = Object.keys(INITIAL_COMPANY_METADATA);
      for (const sym of symbols) {
        try {
          const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${sym}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              const suggestion = data[0]; 
              const domain = suggestion.domain || `${sym.toLowerCase()}.com`;
              const cleanDomain = domain.startsWith('www.') ? domain : `www.${domain}`;
              setCompanyDetails(prev => ({
                ...prev,
                [sym]: {
                  ...prev[sym],
                  domain: cleanDomain,
                  logo: `https://www.google.com/s2/favicons?sz=64&domain=${cleanDomain}`
                }
              }));
            }
          }
        } catch (e) {
          // Fall back gracefully
        }
      }
    };

    loadClearbitInfo();
  }, []);

  // 2. Load historical trade data for the selected instrument, convert to candles
  useEffect(() => {
    if (!activeInstrumentId) return;
    if (activeInstrumentId.startsWith("UPLOADED|")) return; 

    const loadHistory = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/trades/${activeInstrumentId}?limit=800`);
        const result = await response.json();
        
        if (result.status === "success" && result.trades && result.trades.length > 0) {
          const sorted = [...result.trades].sort((a: any, b: any) => {
            const tA = new Date(a.timestamp.includes('Z') ? a.timestamp : a.timestamp.replace(' ', 'T') + 'Z').getTime();
            const tB = new Date(b.timestamp.includes('Z') ? b.timestamp : b.timestamp.replace(' ', 'T') + 'Z').getTime();
            return tA - tB;
          });

          const aggCandles: CandlestickData[] = [];
          const aggVolumes: HistogramData[] = [];
          
          let currentWindowKey: number | null = null;
          let windowTicks: any[] = [];
          
          const firstTick = sorted[0];
          const initialClose = firstTick.cp || firstTick.ltp;
          setLastLtp(firstTick.ltp);
          setOrderPrice(firstTick.ltp.toFixed(2));

          let previousTotalVol = 0;

          sorted.forEach((trade: any) => {
            const cleanTs = trade.timestamp.includes('Z') ? trade.timestamp : trade.timestamp.replace(' ', 'T') + 'Z';
            const timeSec = Math.floor(new Date(cleanTs).getTime() / 1000);
            const windowKey = Math.floor(timeSec / 10) * 10;

            if (currentWindowKey === null) {
              currentWindowKey = windowKey;
              windowTicks = [trade];
            } else if (windowKey === currentWindowKey) {
              windowTicks.push(trade);
            } else {
              const prices = windowTicks.map(t => t.ltp);
              const openPrice = prices[0];
              const closePrice = prices[prices.length - 1];
              const highPrice = Math.max(...prices);
              const lowPrice = Math.min(...prices);
              
              const lastTickInWindow = windowTicks[windowTicks.length - 1];
              const volDiff = previousTotalVol > 0 ? Math.max(0, lastTickInWindow.volume - previousTotalVol) : lastTickInWindow.volume;
              previousTotalVol = lastTickInWindow.volume;

              aggCandles.push({
                time: currentWindowKey as any,
                open: openPrice,
                high: highPrice,
                low: lowPrice,
                close: closePrice
              });

              aggVolumes.push({
                time: currentWindowKey as any,
                value: volDiff,
                color: closePrice >= openPrice ? '#26a69a' : '#ef5350'
              });

              currentWindowKey = windowKey;
              windowTicks = [trade];
            }
          });

          // Commit final window
          if (windowTicks.length > 0 && currentWindowKey !== null) {
            const prices = windowTicks.map(t => t.ltp);
            const openPrice = prices[0];
            const closePrice = prices[prices.length - 1];
            const highPrice = Math.max(...prices);
            const lowPrice = Math.min(...prices);
            
            const lastTickInWindow = windowTicks[windowTicks.length - 1];
            const volDiff = previousTotalVol > 0 ? Math.max(0, lastTickInWindow.volume - previousTotalVol) : lastTickInWindow.volume;

            aggCandles.push({
              time: currentWindowKey as any,
              open: openPrice,
              high: highPrice,
              low: lowPrice,
              close: closePrice
            });

            aggVolumes.push({
              time: currentWindowKey as any,
              value: volDiff,
              color: closePrice >= openPrice ? '#26a69a' : '#ef5350'
            });
          }

          if (aggCandles.length > 0) {
            currentCandleOpenRef.current = aggCandles[aggCandles.length - 1].open;
          }
          setCandles(aggCandles);
          setVolumes(aggVolumes);
          
          if (sorted.length > 0) {
            const startStr = sorted[0].timestamp;
            const endStr = sorted[sorted.length - 1].timestamp;
            setDatasetTimeRange({ start: startStr, end: endStr });
            setCurrentPlaybackTime(startStr);
            try {
              const dt = new Date(startStr);
              const offset = dt.getTimezoneOffset();
              const localDt = new Date(dt.getTime() - (offset * 60 * 1000));
              setJumpDateTime(localDt.toISOString().slice(0, 16));
            } catch (e) {
              setJumpDateTime(startStr.slice(0, 16));
            }
          }

          const lastTrade = sorted[sorted.length - 1];
          lastHistoricalTimestampRef.current = lastTrade.timestamp;
          const basePrice = lastTrade.cp || initialClose;
          const currentChange = lastTrade.ltp - basePrice;
          const currentPct = (currentChange / basePrice) * 100;
          setPriceChange({ change: currentChange, pct: currentPct });
          
          addEventLog(`Loaded ${aggCandles.length} historical candles for ${activeInstrument.symbol}.`, "HISTORY");
        }
      } catch (err) {
        console.error("Failed to load historical trades:", err);
      }
    };
    
    loadHistory();
  }, [activeInstrumentId]);

  // Synchronize ref values
  useEffect(() => {
    activeInstrumentIdRef.current = activeInstrumentId || "";
  }, [activeInstrumentId]);

  useEffect(() => {
    replaySpeedRef.current = replaySpeed;
  }, [replaySpeed]);

  // Reset last streamed timestamp when instrument changes
  useEffect(() => {
    lastStreamedTimestampRef.current = null;
  }, [activeInstrumentId]);

  // Close websocket on unmount
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  const handleJumpToTime = (targetTimeStr?: string) => {
    const timeToJump = targetTimeStr || jumpDateTime;
    if (!timeToJump) return;
    
    let isoString = "";
    try {
      const parsed = new Date(timeToJump);
      isoString = parsed.toISOString();
    } catch (e) {
      isoString = timeToJump;
    }
    
    setCandles([]);
    setVolumes([]);
    lastStreamedTimestampRef.current = isoString;
    setCurrentPlaybackTime(isoString);
    
    addEventLog(`Jumping replay timeline to: ${isoString}`, "REPLAY");
    triggerToast(`Jumping timeline to ${isoString}`);
    
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      setIsReplaying(true);
      websocketRef.current.send(JSON.stringify({
        action: "subscribe",
        instrument: activeInstrumentId,
        speed: replaySpeed,
        start_after: isoString
      }));
    }
  };

  const handleTogglePlayPause = () => {
    const nextState = !isReplaying;
    setIsReplaying(nextState);
    
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      if (nextState) {
        addEventLog(`Resuming replay stream for ${activeInstrument.symbol} at ${replaySpeed}x.`, "WS");
        triggerToast("Resuming replay");
        websocketRef.current.send(JSON.stringify({
          action: "subscribe",
          instrument: activeInstrumentId,
          speed: replaySpeed,
          start_after: lastStreamedTimestampRef.current || lastHistoricalTimestampRef.current
        }));
      } else {
        addEventLog(`Pausing replay stream for ${activeInstrument.symbol}.`, "WS");
        triggerToast("Pausing replay");
        websocketRef.current.send(JSON.stringify({
          action: "unsubscribe",
          instrument: activeInstrumentId
        }));
      }
    }
  };

  // 3. Setup WebSocket connection for streaming ticks
  useEffect(() => {
    if (!activeInstrumentId) return;
    if (activeInstrumentId.startsWith("UPLOADED|")) return; 

    // Create or retrieve WebSocket connection
    let ws = websocketRef.current;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      addEventLog(`Establishing persistent WebSocket connection to replayer.`, "WS");
      ws = new WebSocket(WS_URL);
      websocketRef.current = ws;
    }

    const handleOpen = () => {
      if (isReplaying) {
        addEventLog(`WebSocket connection open. Subscribing to ${activeInstrument.symbol} replayer.`, "WS");
        ws.send(JSON.stringify({
          action: "subscribe",
          instrument: activeInstrumentId,
          speed: replaySpeed,
          start_after: lastStreamedTimestampRef.current || lastHistoricalTimestampRef.current
        }));
      }
    };

    if (ws.readyState === WebSocket.OPEN) {
      if (isReplaying) {
        addEventLog(`Updating replayer stream subscription for ${activeInstrument.symbol} at ${replaySpeed}x.`, "WS");
        ws.send(JSON.stringify({
          action: "subscribe",
          instrument: activeInstrumentId,
          speed: replaySpeed,
          start_after: lastStreamedTimestampRef.current || lastHistoricalTimestampRef.current
        }));
      } else {
        addEventLog(`Sending pause signal to replayer stream for ${activeInstrument.symbol}.`, "WS");
        ws.send(JSON.stringify({
          action: "unsubscribe",
          instrument: activeInstrumentId
        }));
      }
    } else {
      ws.onopen = handleOpen;
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "tick" && msg.instrument === activeInstrumentIdRef.current) {
        const tickData: Tick = msg.data;
        setCurrentTick(tickData);
        setLastLtp(tickData.ltp);
        lastStreamedTimestampRef.current = tickData.timestamp;
        setCurrentPlaybackTime(tickData.timestamp);

        if (orderPriceType === 'MARKET') {
          setOrderPrice(tickData.ltp.toFixed(2));
        }

        const prevClose = tickData.open_day || tickData.ltp - 5.0;
        const change = tickData.ltp - prevClose;
        const pct = (change / prevClose) * 100;
        setPriceChange({ change, pct });

        setInstruments(prev => 
          prev.map(inst => {
            if (inst.instrument_id === activeInstrumentIdRef.current) {
              return {
                ...inst,
                price: tickData.ltp,
                change: change,
                changePercent: pct,
                prevClose: prevClose
              };
            }
            return inst;
          })
        );

        const cleanTs = tickData.timestamp.includes('Z') ? tickData.timestamp : tickData.timestamp.replace(' ', 'T') + 'Z';
        const timeSec = Math.floor(new Date(cleanTs).getTime() / 1000);
        const candleKey = Math.floor(timeSec / 10) * 10;
        
        setCandles(prev => {
          const list = [...prev];
          if (list.length === 0) {
            currentCandleOpenRef.current = tickData.ltp;
            return [{
              time: candleKey as any,
              open: tickData.ltp,
              high: tickData.ltp,
              low: tickData.ltp,
              close: tickData.ltp
            }];
          }
          
          const lastCandle = list[list.length - 1];
          if (lastCandle.time === candleKey) {
            if (currentCandleOpenRef.current === null) {
              currentCandleOpenRef.current = lastCandle.open;
            }
            lastCandle.high = Math.max(lastCandle.high, tickData.ltp);
            lastCandle.low = Math.min(lastCandle.low, tickData.ltp);
            lastCandle.close = tickData.ltp;
            return list;
          } else if ((candleKey as any) > (lastCandle.time as any)) {
            currentCandleOpenRef.current = tickData.ltp;
            return [...list, {
              time: candleKey as any,
              open: tickData.ltp,
              high: tickData.ltp,
              low: tickData.ltp,
              close: tickData.ltp
            }];
          }
          return list;
        });

        setVolumes(prev => {
          const list = [...prev];
          const color = tickData.ltp >= (currentCandleOpenRef.current ?? tickData.ltp) ? '#26a69a' : '#ef5350';
          if (list.length === 0) {
            return [{
              time: candleKey as any,
              value: 100,
              color
            }];
          }

          const lastVol = list[list.length - 1];
          if (lastVol.time === candleKey) {
            lastVol.value += 100;
            lastVol.color = color;
            return list;
          } else if ((candleKey as any) > (lastVol.time as any)) {
            return [...list, {
              time: candleKey as any,
              value: 100,
              color
            }];
          }
          return list;
        });
      }
    };

    ws.onclose = () => {
      addEventLog(`WebSocket connection to feed disconnected.`, "WS");
    };
  }, [activeInstrumentId, replaySpeed, isReplaying]);

  // 4. Render lightweight-charts inside the container
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const bgColor = chartTheme === 'dark' ? '#131722' : '#ffffff';
    const textColor = chartTheme === 'dark' ? '#d1d4dc' : '#1e293b';
    const gridColor = chartTheme === 'dark' 
      ? (showGridLines ? 'rgba(42, 46, 57, 0.15)' : 'rgba(0, 0, 0, 0)') 
      : (showGridLines ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0)');
    const borderColor = chartTheme === 'dark' ? '#2b2e39' : '#e2e8f0';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor: borderColor,
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: true,
        secondsVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: Math.max(400, chartContainerRef.current.clientHeight),
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: chartUpColor,
      downColor: chartDownColor,
      borderVisible: false,
      wickUpColor: chartUpColor,
      wickDownColor: chartDownColor,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    candlestickSeriesRef.current = candlestickSeries;
    markersPluginRef.current = createSeriesMarkers(candlestickSeries, []);
    volumeSeriesRef.current = volumeSeries;
    chartRef.current = chart;

    chart.subscribeCrosshairMove((param) => {
      const hoveredMarkerId = (param as any).hoveredMarkerId;
      if (hoveredMarkerId) {
        setHoveredIncidentId(hoveredMarkerId);
        if (param.point) {
          setMarkerTooltipPos({ x: param.point.x, y: param.point.y });
        }
      } else {
        setHoveredIncidentId(null);
        setMarkerTooltipPos(null);
      }
    });

    chart.subscribeClick((param) => {
      const hoveredMarkerId = (param as any).hoveredMarkerId;
      if (hoveredMarkerId) {
        const incId = hoveredMarkerId;
        const inc = incidentsRef.current.find(i => i.id === incId);
        if (inc) {
          setSelectedIncident(inc);
          setCurrentView('incidents');
          setActiveDetailTab('summary');
        }
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: Math.max(400, chartContainerRef.current.clientHeight)
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      markersPluginRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [currentView]);

  // Dynamically resize chart when side panels are resized
  useEffect(() => {
    if (chartRef.current && chartContainerRef.current) {
      chartRef.current.applyOptions({ 
        width: chartContainerRef.current.clientWidth,
        height: Math.max(400, chartContainerRef.current.clientHeight)
      });
    }
  }, [watchlistWidth, orderPanelWidth]);

  // Dynamic Chart Customization Updates
  useEffect(() => {
    if (chartRef.current && candlestickSeriesRef.current) {
      const bgColor = chartTheme === 'dark' ? '#131722' : '#ffffff';
      const textColor = chartTheme === 'dark' ? '#d1d4dc' : '#1e293b';
      const gridColor = chartTheme === 'dark' 
        ? (showGridLines ? 'rgba(42, 46, 57, 0.15)' : 'rgba(0, 0, 0, 0)') 
        : (showGridLines ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0)');
      const borderColor = chartTheme === 'dark' ? '#2b2e39' : '#e2e8f0';

      chartRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: bgColor },
          textColor: textColor,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        rightPriceScale: {
          borderColor: borderColor,
        },
        timeScale: {
          borderColor: borderColor,
        }
      });

      candlestickSeriesRef.current.applyOptions({
        upColor: chartUpColor,
        downColor: chartDownColor,
        wickUpColor: chartUpColor,
        wickDownColor: chartDownColor,
      });
    }

    setVolumes(prev => prev.map(vol => {
      const isUp = vol.color === '#26a69a' || vol.color === '#1a73e8' || vol.color === chartUpColor;
      return {
        ...vol,
        color: isUp ? chartUpColor : chartDownColor
      };
    }));
  }, [chartUpColor, chartDownColor, showGridLines, chartTheme]);

  // Update chart data and sync markers whenever candles or incidents change
  useEffect(() => {
    if (chartRef.current && candlestickSeriesRef.current && candles.length > 0) {
      try {
        // First set the data
        candlestickSeriesRef.current.setData(candles);

        // Immediately resolve and apply the markers to avoid data resets wiping them out
        const currentSymbol = instruments.find(i => i.instrument_id === activeInstrumentId)?.symbol || "RELIANCE";
        const activeIncidents = incidents.filter(inc => inc.symbol === currentSymbol);
        const markers: any[] = [];

        activeIncidents.forEach(inc => {
          const cleanTs = inc.timestamp.includes('Z') ? inc.timestamp : inc.timestamp.replace(' ', 'T') + 'Z';
          const timeSec = Math.floor(new Date(cleanTs).getTime() / 1000);
          
          const windowKey = Math.floor(timeSec / 10) * 10;
          const hasExactCandle = candles.some(c => (c.time as any) === windowKey);

          let markerTime: number | null = null;
          if (hasExactCandle) {
            markerTime = windowKey;
          } else {
            let closestCandle = candles[0];
            let minDiff = Math.abs((closestCandle.time as number) - timeSec);
            
            candles.forEach(c => {
              const diff = Math.abs((c.time as number) - timeSec);
              if (diff < minDiff) {
                minDiff = diff;
                closestCandle = c;
              }
            });

            if (minDiff < 3600) {
              markerTime = closestCandle.time as number;
            } else {
              // Force match for initial mock incidents so they show up on default view
              if (inc.id === "INC-2026-9042" && currentSymbol === "LT") {
                const targetIndex = Math.min(25, candles.length - 1);
                markerTime = candles[targetIndex]?.time as number;
              } else if (inc.id === "INC-2026-8812" && currentSymbol === "TATAELXSI") {
                const targetIndex = Math.min(35, candles.length - 1);
                markerTime = candles[targetIndex]?.time as number;
              }
            }
          }

          if (markerTime !== null) {
            markers.push({
              time: markerTime,
              position: 'aboveBar',
              color: inc.severity === 'CRITICAL' ? '#e53935' : '#ff9800',
              shape: 'arrowDown',
              text: inc.pattern,
              id: inc.id
            });
          }
        });

        markers.sort((a, b) => (a.time as number) - (b.time as number));
        if (markersPluginRef.current) {
          markersPluginRef.current.setMarkers(markers);
        }

        if (lastInstrumentIdRef.current !== activeInstrumentId) {
          chartRef.current.timeScale().fitContent();
          lastInstrumentIdRef.current = activeInstrumentId;
        }
      } catch (err) {
        console.error("Error setting candlestick data and markers:", err);
      }
    }
  }, [candles, incidents, activeInstrumentId]);

  useEffect(() => {
    if (chartRef.current && volumeSeriesRef.current && volumes.length > 0) {
      try {
        volumeSeriesRef.current.setData(volumes);
        if (lastInstrumentIdRef.current !== activeInstrumentId) {
          chartRef.current.timeScale().fitContent();
          lastInstrumentIdRef.current = activeInstrumentId;
        }
      } catch (err) {
        console.error("Error setting volume data:", err);
      }
    }
  }, [volumes, activeInstrumentId]);

  // 5. Update positions live when tick price changes
  useEffect(() => {
    if (positions.length === 0 || !currentTick) return;
    
    setPositions(prev => 
      prev.map(pos => {
        if (pos.instrumentId === activeInstrumentId) {
          const currentPrice = currentTick.ltp;
          const pnl = pos.type === 'BUY' 
            ? (currentPrice - pos.avgPrice) * pos.qty
            : (pos.avgPrice - currentPrice) * pos.qty;
          return {
            ...pos,
            currentPrice,
            pnl
          };
        }
        return pos;
      })
    );
  }, [currentTick, activeInstrumentId]);

  // Dragging event handlers for Anomaly Injector
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - anomalyPanelPos.x,
      y: e.clientY - anomalyPanelPos.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setAnomalyPanelPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Active instrument object resolution
  const activeInstrument = instruments.find(i => i.instrument_id === activeInstrumentId) || {
    symbol: "RELIANCE",
    name: "RELIANCE INDUSTRIES LTD",
    exchange: "NSE_EQ",
    price: lastLtp,
    change: priceChange.change,
    changePercent: priceChange.pct,
    prevClose: lastLtp - priceChange.change,
    instrument_id: "INE002A01018",
    file: "INE002A01018.csv"
  };

  // Resolve favicon Logo safely with Clearbit or gstatic (no borders, no backgrounds, guarantee www. in domain param)
  const getLogoUrl = (symbol: string) => {
    const details = companyDetails[symbol];
    if (details) {
      let logo = details.logo;
      if (logo.includes('domain=') && !logo.includes('domain=www.')) {
        logo = logo.replace('domain=', 'domain=www.');
      }
      return logo;
    }
    return `https://www.google.com/s2/favicons?sz=64&domain=www.${symbol.toLowerCase()}.com`;
  };

  // Order Depth calculations
  const defaultDepth = {
    bids: [
      { price: lastLtp - 0.15, qty: 1420 },
      { price: lastLtp - 0.35, qty: 890 },
      { price: lastLtp - 0.55, qty: 2310 },
      { price: lastLtp - 0.75, qty: 1100 },
      { price: lastLtp - 0.95, qty: 3450 }
    ],
    asks: [
      { price: lastLtp + 0.15, qty: 980 },
      { price: lastLtp + 0.35, qty: 1540 },
      { price: lastLtp + 0.55, qty: 620 },
      { price: lastLtp + 0.75, qty: 1890 },
      { price: lastLtp + 0.95, qty: 2200 }
    ]
  };

  const getLiveDepth = () => {
    if (!currentTick) return defaultDepth;
    return {
      bids: [
        { price: currentTick.bid1_price || lastLtp - 0.10, qty: currentTick.bid1_qty || 1200 },
        { price: currentTick.bid2_price || lastLtp - 0.25, qty: currentTick.bid2_qty || 850 },
        { price: currentTick.bid3_price || lastLtp - 0.40, qty: currentTick.bid3_qty || 2100 },
        { price: currentTick.bid4_price || lastLtp - 0.60, qty: currentTick.bid4_qty || 1500 },
        { price: currentTick.bid5_price || lastLtp - 0.80, qty: currentTick.bid5_qty || 3200 }
      ],
      asks: [
        { price: currentTick.ask1_price || lastLtp + 0.10, qty: currentTick.ask1_qty || 950 },
        { price: currentTick.ask2_price || lastLtp + 0.25, qty: currentTick.ask2_qty || 1400 },
        { price: currentTick.ask3_price || lastLtp + 0.40, qty: currentTick.ask3_qty || 600 },
        { price: currentTick.ask4_price || lastLtp + 0.60, qty: currentTick.ask4_qty || 1800 },
        { price: currentTick.ask5_price || lastLtp + 0.80, qty: currentTick.ask5_qty || 2400 }
      ]
    };
  };

  const depthData = getLiveDepth();
  const maxBidQty = Math.max(...depthData.bids.map(b => b.qty));
  const maxAskQty = Math.max(...depthData.asks.map(a => a.qty));

  const totalBuyQty = currentTick?.total_buy_qty || depthData.bids.reduce((sum, b) => sum + b.qty, 0);
  const totalSellQty = currentTick?.total_sell_qty || depthData.asks.reduce((sum, a) => sum + a.qty, 0);
  const totalQtySum = totalBuyQty + totalSellQty;
  const buyRatio = totalQtySum > 0 ? (totalBuyQty / totalQtySum) * 100 : 50;
  const sellRatio = totalQtySum > 0 ? (totalSellQty / totalQtySum) * 100 : 50;

  // Order Placement logic
  const numericPrice = parseFloat(orderPrice) || lastLtp;
  const rawRequiredFunds = orderQty * numericPrice;
  const requiredFunds = rawRequiredFunds;
  const hasSufficientFunds = funds >= requiredFunds;

  const handlePlaceOrder = () => {
    if (!hasSufficientFunds) {
      triggerToast("Insufficient funds to place this order!");
      return;
    }

    setFunds(prev => prev - requiredFunds);

    const newPos: Position = {
      symbol: activeInstrument.symbol,
      instrumentId: activeInstrumentId,
      type: orderAction,
      qty: orderQty,
      avgPrice: numericPrice,
      currentPrice: lastLtp,
      pnl: 0
    };

    setPositions(prev => {
      const existingIdx = prev.findIndex(p => p.instrumentId === activeInstrumentId && p.type === orderAction);
      if (existingIdx > -1) {
        const list = [...prev];
        const old = list[existingIdx];
        const combinedQty = old.qty + orderQty;
        const averagePrice = ((old.avgPrice * old.qty) + (numericPrice * orderQty)) / combinedQty;
        list[existingIdx] = {
          ...old,
          qty: combinedQty,
          avgPrice: averagePrice,
          currentPrice: lastLtp,
          pnl: orderAction === 'BUY' 
            ? (lastLtp - averagePrice) * combinedQty
            : (averagePrice - lastLtp) * combinedQty
        };
        return list;
      }
      return [...prev, newPos];
    });

    addEventLog(`Order executed: ${orderAction} ${orderQty} shares of ${activeInstrument.symbol} at ${numericPrice.toFixed(2)}`, "TRADE");
    triggerToast(`Order placed: ${orderAction} ${orderQty} shares of ${activeInstrument.symbol}`);
  };

  const handleClosePosition = (index: number) => {
    const pos = positions[index];
    const exitValue = pos.qty * lastLtp;
    const initialValue = pos.qty * pos.avgPrice;
    const posPnl = pos.type === 'BUY' ? exitValue - initialValue : initialValue - exitValue;
    
    const marginReturn = initialValue;
    setFunds(prev => prev + marginReturn + posPnl);

    setPositions(prev => prev.filter((_, i) => i !== index));
    addEventLog(`Position closed: Squared off ${pos.qty} shares of ${pos.symbol} at ${lastLtp.toFixed(2)}. P&L: ${posPnl.toFixed(2)}`, "TRADE");
    triggerToast(`Closed position ${pos.symbol}. P&L: ${posPnl.toFixed(2)}`);
  };

  const handleAddFunds = () => {
    const amt = parseFloat(addFundsAmount);
    if (!isNaN(amt) && amt > 0) {
      setFunds(prev => prev + amt);
      setShowAddFundsModal(false);
      addEventLog(`Deposited ${amt.toLocaleString('en-IN')} mock margin funds.`, "WALLET");
      triggerToast(`Added ${amt.toLocaleString('en-IN')} to wallet.`);
    }
  };

  // Rogue Threat Actor Scenario Injection Action
  const handleInjectCustomAnomaly = () => {
    const incidentId = "INC-2026-" + Math.floor(1000 + Math.random() * 9000);
    const timeStr = currentTick 
      ? currentTick.timestamp.substring(0, 19) 
      : new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // Get trader profile name
    const selectedTraderObj = tradersList.find(t => t.trader_id === actorAccountId) || { name: "Rogue Participant", trader_id: actorAccountId };
    const traderName = selectedTraderObj.name;

    const desc = `Rogue Threat Actor account ${actorAccountId} (${traderName}) executed a ${customPattern.toUpperCase()} scenario on instrument ${activeInstrument.symbol} with Order Cancellation Force of ${customCancelRatio}%, Target Price Shift of ${customPriceImpact}%, and Cancel median speed of ${customCancelMedian}ms.`;
    
    // Automated scanner dynamically determines detection confidence:
    let calculatedConfidence = 0.65;
    if (customCancelRatio > 80 && customOrderCount > 10) {
      calculatedConfidence = 0.94;
    } else if (customCancelRatio > 50 || customOrderCount > 5) {
      calculatedConfidence = 0.82;
    }

    // Call backend to log this injection in SQLite db for audit accountability
    fetch(`${BACKEND_URL}/api/v1/detect/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trader_id: actorAccountId,
        trader_name: traderName,
        instrument: activeInstrument.symbol,
        pattern_type: customPattern,
        severity: customSeverity,
        confidence: calculatedConfidence,
        cancel_ratio: customCancelRatio / 100,
        cancel_time_median: customCancelMedian,
        order_count: customOrderCount,
        price_impact: customPriceImpact / 100,
        description: desc,
        timestamp: timeStr
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log("Anomaly logged for audit accountability:", data);
      triggerToast(`Audit DB Registered: ACTOR_INJECT_${data.injection_id || "OK"}`);
      refreshIncidentsList();
      refreshEventsList();
    })
    .catch(err => {
      console.error("Failed to log anomaly accountability on backend:", err);
    });

    const newAlert: ComplianceAlert = {
      alert_id: incidentId,
      pattern_type: customPattern,
      severity: customSeverity,
      confidence: calculatedConfidence,
      instrument: activeInstrumentId,
      timestamp: timeStr,
      evidence: {
        cancel_ratio: customCancelRatio / 100,
        cancel_time_median: customCancelMedian,
        order_count: customOrderCount,
        price_impact: customPriceImpact / 100
      },
      description: desc
    };

    const newIncident: Incident = {
      id: incidentId,
      symbol: activeInstrument.symbol,
      pattern: customPattern.toUpperCase().replace('_', ' '),
      severity: customSeverity,
      timestamp: timeStr,
      status: 'PENDING',
      confidence: calculatedConfidence,
      evidence: desc
    };

    setSurveillanceAlert(newAlert);
    setTriageReport(null);
    setIncidents(prev => [newIncident, ...prev]);
    setSelectedIncident(newIncident);
    setShowCompliancePanel(true);

    addEventLog(`Rogue actor injected threat activity: [${customPattern.toUpperCase()}] on instrument ${activeInstrument.symbol}`, "THREAT");
    triggerToast(`Threat activity executed by actor ${actorAccountId}!`);
  };

  // AI Triage calls
  const handleRunTriage = async () => {
    if (!surveillanceAlert) return;
    setTriageLoading(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/triage/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_id: surveillanceAlert.alert_id,
          pattern_type: surveillanceAlert.pattern_type,
          evidence: surveillanceAlert.evidence,
          instrument: surveillanceAlert.instrument,
          timestamp: surveillanceAlert.timestamp,
          llm_provider: llmProvider,
          api_key: llmProvider === "Anthropic Claude" ? anthropicApiKey : openaiApiKey
        })
      });
      const result = await response.json();
      if (result.status === "success") {
        setTriageReport(result.triage_result);
      }
    } catch (err) {
      console.error("AI Triage Failed:", err);
      // Fallback AI Report
      setTimeout(() => {
        setTriageReport({
          verdict: "ESCALATE",
          confidence: surveillanceAlert.confidence,
          rationale: `AI Triage analysis of rogue actor behavior (${surveillanceAlert.pattern_type.toUpperCase()}) indicates clear intent to manipulate market liquidity. The cancellation ratio and price target force match signatures of spoofing node distributions.`,
          supporting_evidence: {
            cancellation_ratio: surveillanceAlert.evidence.cancel_ratio,
            time_to_cancel_median: surveillanceAlert.evidence.cancel_time_median,
            anomaly_vs_baseline: "+6.2s",
            order_count: surveillanceAlert.evidence.order_count
          },
          recommendations: [
            "Escalate to Exchange Market Surveillance Desk",
            "Mark rogue account ID for transaction freeze",
            "Submit CSV audit logs to regulatory compliance archive"
          ]
        });
      }, 800);
    } finally {
      setTriageLoading(false);
    }
  };

  // Custom CSV File Upload parser (Replay simulator criteria)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const timestampIdx = headers.findIndex(h => h.includes('time') || h.includes('date'));
        const ltpIdx = headers.findIndex(h => h.includes('price') || h.includes('ltp') || h.includes('close'));
        const volIdx = headers.findIndex(h => h.includes('vol') || h.includes('qty'));

        if (timestampIdx === -1 || ltpIdx === -1) {
          triggerToast("Invalid CSV. File must contain 'timestamp' and 'price'/'ltp' columns.");
          return;
        }

        const parsedTrades: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(v => v.trim());
          if (row.length < headers.length) continue;
          
          parsedTrades.push({
            timestamp: row[timestampIdx],
            ltp: parseFloat(row[ltpIdx]),
            volume: volIdx !== -1 ? parseInt(row[volIdx]) || 100 : 100,
            exchange: "UPLOADED",
            symbol: file.name.split('.')[0].toUpperCase()
          });
        }

        if (parsedTrades.length === 0) {
          triggerToast("No valid rows found in CSV.");
          return;
        }

        triggerToast(`Uploaded ${file.name}. Initialized replayer with ${parsedTrades.length} rows.`);
        addEventLog(`Client uploaded custom dataset: ${file.name} (${parsedTrades.length} ticks)`, "SYSTEM");
        
        const mockUploadedInstrumentId = `UPLOADED|${file.name}`;
        const newInst: Instrument = {
          instrument_id: mockUploadedInstrumentId,
          file: file.name,
          exchange: "UPLOADED",
          symbol: file.name.split('.')[0].toUpperCase().substring(0, 10),
          name: file.name.split('.')[0].toUpperCase() + " (Uploaded)",
          price: parsedTrades[0].ltp,
          change: 0,
          changePercent: 0,
          prevClose: parsedTrades[0].ltp
        };

        setInstruments(prev => [newInst, ...prev]);
        setActiveInstrumentId(mockUploadedInstrumentId);
        
        // Convert parsed records to candlesticks/volumes
        const aggCandles: CandlestickData[] = [];
        const aggVolumes: HistogramData[] = [];
        let currentWindowKey: number | null = null;
        let windowTicks: any[] = [];

        parsedTrades.forEach((trade: any) => {
          const timeSec = Math.floor(new Date(trade.timestamp).getTime() / 1000);
          const windowKey = Math.floor(timeSec / 10) * 10;

          if (currentWindowKey === null) {
            currentWindowKey = windowKey;
            windowTicks = [trade];
          } else if (windowKey === currentWindowKey) {
            windowTicks.push(trade);
          } else {
            const prices = windowTicks.map(t => t.ltp);
            aggCandles.push({
              time: currentWindowKey as any,
              open: prices[0],
              high: Math.max(...prices),
              low: Math.min(...prices),
              close: prices[prices.length - 1]
            });
            aggVolumes.push({
              time: currentWindowKey as any,
              value: windowTicks.reduce((sum, t) => sum + t.volume, 0),
              color: prices[prices.length - 1] >= prices[0] ? '#26a69a' : '#ef5350'
            });
            currentWindowKey = windowKey;
            windowTicks = [trade];
          }
        });

        if (aggCandles.length > 0) {
          currentCandleOpenRef.current = aggCandles[aggCandles.length - 1].open;
        }
        setCandles(aggCandles);
        setVolumes(aggVolumes);
        setLastLtp(parsedTrades[0].ltp);
        setOrderPrice(parsedTrades[0].ltp.toFixed(2));
      } catch (e) {
        triggerToast("Error parsing dataset file.");
      }
    };
    reader.readAsText(file);
  };

  // Filtered lists
  const filteredInstruments = instruments.filter(inst => 
    inst.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStaticWatchlist = STATIC_WATCHLIST_DATA.filter(inst =>
    inst.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Event Log helpers (computed before return to avoid IIFE in JSX) ──
  const EVENT_TAG_META: Record<string, { color: string; bg: string; border: string; rowBg: string }> = {
    THREAT:  { color: '#b91c1c', bg: '#fee2e2', border: '#ef4444', rowBg: '#fff8f8' },
    TRADE:   { color: '#15803d', bg: '#dcfce7', border: '#22c55e', rowBg: '#f0fdf4' },
    SYSTEM:  { color: '#1d4ed8', bg: '#dbeafe', border: '#3b82f6', rowBg: '#eff6ff' },
    WS:      { color: '#7c3aed', bg: '#ede9fe', border: '#8b5cf6', rowBg: '#faf5ff' },
    HISTORY: { color: '#c2410c', bg: '#ffedd5', border: '#f97316', rowBg: '#fff7ed' },
    WALLET:  { color: '#a16207', bg: '#fef9c3', border: '#eab308', rowBg: '#fefce8' },
    INFO:    { color: '#475569', bg: '#f1f5f9', border: '#94a3b8', rowBg: '#ffffff' },
  };
  const parseEventLog = (log: string) => {
    let tag = 'INFO';
    if (log.includes('[THREAT]'))       tag = 'THREAT';
    else if (log.includes('[TRADE]'))   tag = 'TRADE';
    else if (log.includes('[SYSTEM]'))  tag = 'SYSTEM';
    else if (log.includes('[WS]'))      tag = 'WS';
    else if (log.includes('[HISTORY]')) tag = 'HISTORY';
    else if (log.includes('[WALLET]'))  tag = 'WALLET';
    const timeMatch = log.match(/\[(\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?)\]/);
    const time = timeMatch ? timeMatch[1] : '';
    const message = log
      .replace(/\[\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?\]\s*/, '')
      .replace(`[${tag}] `, '').trim();
    return { tag, time, message };
  };
  const filteredEventLogs = logs.filter(log => {
    const { tag, message } = parseEventLog(log);
    const tagMatch = eventTagFilter === 'ALL' || tag === eventTagFilter;
    const searchMatch = !eventSearchQuery.trim() ||
      message.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
      tag.toLowerCase().includes(eventSearchQuery.toLowerCase());
    return tagMatch && searchMatch;
  });
  const eventTagCounts = ['THREAT','TRADE','SYSTEM','WS','HISTORY','WALLET','INFO'].reduce((acc, t) => {
    acc[t] = logs.filter(l => parseEventLog(l).tag === t).length;
    return acc;
  }, {} as Record<string, number>);
  const handleExportEventsCSV = () => {
    const rows = ['Time,Type,Message', ...filteredEventLogs.map(log => {
      const { tag, time, message } = parseEventLog(log);
      return `"${time}","${tag}","${message.replace(/"/g, '""')}"`;
    })];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'events_log.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  const handleExportEventsTXT = () => {
    const blob = new Blob([filteredEventLogs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'events_log.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container" style={{ '--buy-green': chartUpColor, '--sell-red': chartDownColor } as React.CSSProperties}>
      {/* 1. Main Header (Single word navigation menus) */}
      <header className="main-header">
        <div className="header-left">
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/brandlogo.png" alt="TradeShield Logo" style={{ height: '30px', width: 'auto', objectFit: 'contain' }} />
          </div>
          
          <div className="indices-ticker">
            <div className="index-item">
              <span className="index-name">NIFTY 50 <span className="nse-badge">NSE</span></span>
              <div className="index-values">
                <span className="index-price">23,366.70</span>
                <span className="index-change text-down">-49.85 (-0.21%)</span>
              </div>
            </div>
            <div className="index-item">
              <span className="index-name">SENSEX <span className="nse-badge" style={{ color: '#c53030', backgroundColor: '#fff5f5', borderColor: '#feb2b2' }}>BSE</span></span>
              <div className="index-values">
                <span className="index-price">74,243.34</span>
                <span className="index-change text-down">-118.87 (-0.16%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Single word menus in header navigation */}
        <div className="header-nav">
          <div className={`nav-item ${currentView === 'compliance' ? 'active' : ''}`} onClick={() => setCurrentView('compliance')}>Compliance</div>
          <div className={`nav-item ${currentView === 'incidents' ? 'active' : ''}`} onClick={() => setCurrentView('incidents')}>
            Incidents <span className="watchlist-count-badge" style={{ backgroundColor: '#e53935', color: 'white' }}>{incidents.filter(i=>i.status==='PENDING').length}</span>
          </div>
          <div className={`nav-item ${currentView === 'events' ? 'active' : ''}`} onClick={() => setCurrentView('events')}>Events</div>
          <div className={`nav-item ${currentView === 'rca' ? 'active' : ''}`} onClick={() => setCurrentView('rca')}>Analysis</div>
          <div className={`nav-item ${currentView === 'channels' ? 'active' : ''}`} onClick={() => setCurrentView('channels')}>Channels</div>
          <div className={`nav-item ${currentView === 'policies' ? 'active' : ''}`} onClick={() => setCurrentView('policies')}>Policy</div>
          <div className={`nav-item ${currentView === 'simulators' ? 'active' : ''}`} onClick={() => setCurrentView('simulators')}>Simulators</div>
          <div className="nav-item header-anomaly-btn" style={{ color: '#3182ce', fontWeight: 'bold' }} onClick={() => setShowAnomalyPanel(prev => !prev)}>
            Injector
          </div>
        </div>

        {/* Right header buttons */}
        <div className="header-right">
          {surveillanceAlert && (
            <div 
              className={`compliance-badge alert-pulse`}
              onClick={() => {
                setCurrentView('compliance');
                setShowCompliancePanel(true);
              }}
            >
              <ShieldAlert size={14} />
              Compliance Alert
            </div>
          )}
          
          <div className="wallet-badge">
            <User size={12} style={{ marginRight: '4px' }} />
            Margin: <span>₹{funds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          
          <button className="add-funds-btn" onClick={() => setShowAddFundsModal(true)}>
            <Plus size={11} style={{ marginRight: '2px', display: 'inline' }} /> Add Funds
          </button>
          
          <div className="user-profile-group" style={{ position: 'relative' }}>
            <div className="user-profile" onClick={() => setShowUserProfileDropdown(prev => !prev)} style={{ cursor: 'pointer' }}>
              <User size={16} />
            </div>
            {showUserProfileDropdown && (
              <div style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                width: '200px',
                backgroundColor: 'white',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                boxShadow: 'var(--shadow-lg)',
                padding: '8px 0',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--text-main)' }}>{profileName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{profileRole}</span>
                </div>
                <button
                  onClick={() => {
                    setShowUserProfileDropdown(false);
                    refreshTradersList();
                    setShowTraderCRUDModal(true);
                    setCrudModalMode('list');
                  }}
                  className="dropdown-item"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: '11.5px',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <User size={12} />
                  Manage Trader Profiles
                </button>
                <button
                  onClick={() => {
                    setShowUserProfileDropdown(false);
                    setShowSettingsModal(true);
                  }}
                  className="dropdown-item"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: '11.5px',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Settings size={12} />
                  System Settings
                </button>
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '4px' }}>
                  <button
                    onClick={() => {
                      setShowUserProfileDropdown(false);
                      triggerToast("Logged out successfully.");
                    }}
                    className="dropdown-item"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '11.5px',
                      color: 'var(--sell-red)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Draggable/Collapsible Rogue Threat Injector Panel - Light Theme, Professional, Bigger & Compact */}
      {showAnomalyPanel && (
        <div 
          className="anomaly-injector-panel"
          style={{ 
            left: `${anomalyPanelPos.x}px`, 
            top: `${anomalyPanelPos.y}px` 
          }}
        >
          <div className="anomaly-panel-header" onMouseDown={handleMouseDown}>
            <span>ROGUE THREAT INJECTOR SIMULATOR</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                onClick={() => setIsAnomalyCollapsed(!isAnomalyCollapsed)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {isAnomalyCollapsed ? '+' : '-'}
              </button>
              <button 
                onClick={() => setShowAnomalyPanel(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
          </div>
          
          {!isAnomalyCollapsed && (
            <div className="anomaly-panel-body">
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '4px' }}>
                Simulate malicious trade activity from a rogue participant node to evaluate compliance scanning.
              </div>

              {/* Pattern Type Dropdown with Tooltip */}
              <div className="anomaly-control-group">
                <span className="anomaly-control-label" title="The trade manipulation scenario to be executed by the rogue actor.">
                  Malicious Pattern
                </span>
                <select 
                  className="anomaly-control-input"
                  value={customPattern}
                  onChange={e => setCustomPattern(e.target.value)}
                >
                  <option value="layering">Spoofing & Layering</option>
                  <option value="wash_trading">Wash Trading</option>
                  <option value="pump_dump">Pump and Dump</option>
                  <option value="quote_stuffing">Quote Stuffing</option>
                </select>
              </div>

              {/* Dynamic Attack/Pattern Info Box */}
              <div style={{ backgroundColor: 'rgba(76, 29, 149, 0.04)', border: '1px dashed rgba(76, 29, 149, 0.25)', padding: '10px 12px', borderRadius: '6px', fontSize: '11px', color: '#4c1d95', lineHeight: '1.4' }}>
                {ANOMALY_INFO_MAP[customPattern]}
              </div>

              {/* Rogue Actor Account ID Searchable Dropdown */}
              <div className="anomaly-control-group" style={{ position: 'relative' }}>
                <span className="anomaly-control-label" title="Select a rogue trader profile from the user directory.">
                  Rogue Actor Account ID
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      className="anomaly-control-input"
                      style={{ paddingRight: '24px' }}
                      value={traderSearchQuery}
                      onChange={e => {
                        setTraderSearchQuery(e.target.value);
                        setShowTraderDropdown(true);
                      }}
                      onFocus={() => setShowTraderDropdown(true)}
                      placeholder="Search name or ID..."
                    />
                    <ChevronDown 
                      size={14} 
                      style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#718096' }} 
                    />
                  </div>

                  {showTraderDropdown && (
                    <div style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0, 
                      backgroundColor: 'white', 
                      border: '1px solid #cbd5e0', 
                      borderRadius: '4px', 
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', 
                      maxHeight: '160px', 
                      overflowY: 'auto', 
                      zIndex: 1000,
                      marginTop: '2px'
                    }}>
                      {(() => {
                        const filtered = tradersList.filter(t => {
                          const selectedTrader = tradersList.find(x => x.trader_id === actorAccountId);
                          const isExactMatch = selectedTrader && traderSearchQuery === `${selectedTrader.name} (${selectedTrader.trader_id})`;
                          if (isExactMatch || !traderSearchQuery.trim()) return true;
                          
                          const q = traderSearchQuery.toLowerCase();
                          return t.name.toLowerCase().includes(q) || 
                                 t.trader_id.toLowerCase().includes(q) ||
                                 t.role.toLowerCase().includes(q);
                        });
                        return (
                          <>
                            {filtered.map(t => (
                              <div 
                                key={t.trader_id}
                                style={{ 
                                  padding: '6px 10px', 
                                  cursor: 'pointer', 
                                  fontSize: '11px',
                                  borderBottom: '1px solid #f7fafc',
                                  backgroundColor: actorAccountId === t.trader_id ? '#ebf8ff' : 'transparent',
                                  color: '#2d3748'
                                }}
                                onMouseDown={() => {
                                  setActorAccountId(t.trader_id);
                                  setTraderSearchQuery(`${t.name} (${t.trader_id})`);
                                  setShowTraderDropdown(false);
                                }}
                                onMouseEnter={(e) => {
                                  if (actorAccountId !== t.trader_id) {
                                    e.currentTarget.style.backgroundColor = '#f7fafc';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (actorAccountId !== t.trader_id) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }
                                }}
                              >
                                <div style={{ fontWeight: 'bold' }}>{t.name} ({t.trader_id})</div>
                                <div style={{ fontSize: '9.5px', color: '#718096' }}>{t.role} • {t.sector}</div>
                              </div>
                            ))}
                            {filtered.length === 0 && (
                              <div style={{ padding: '6px 10px', fontSize: '11px', color: '#a0aec0', textAlign: 'center' }}>
                                No profiles found
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Attack Intensity Dropdown */}
              <div className="anomaly-control-group">
                <span className="anomaly-control-label" title="Simulated target volume or severity distribution parameters.">
                  Attack Intensity Profile
                </span>
                <select 
                  className="anomaly-control-input"
                  value={customSeverity}
                  onChange={e => setCustomSeverity(e.target.value as any)}
                >
                  <option value="LOW">LOW INTENSITY</option>
                  <option value="MEDIUM">MEDIUM INTENSITY</option>
                  <option value="HIGH">HIGH INTENSITY</option>
                  <option value="CRITICAL">CRITICAL BREACH</option>
                </select>
              </div>

              {/* Cancel Ratio Slider */}
              <div className="anomaly-control-group">
                <span className="anomaly-control-label" title="Percentage of rogue orders placed that are immediately canceled before matching.">
                  Order Cancellation Force: {customCancelRatio}%
                </span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  className="anomaly-control-slider"
                  value={customCancelRatio}
                  onChange={e => setCustomCancelRatio(parseInt(e.target.value))}
                />
              </div>

              {/* Median Time to Cancel Slider */}
              <div className="anomaly-control-group">
                <span className="anomaly-control-label" title="Avg latency in ms between placement and cancellation of rogue orders.">
                  Cancellation Median Speed: {customCancelMedian} ms
                </span>
                <input 
                  type="range" 
                  min="10" 
                  max="2000" 
                  step="10"
                  className="anomaly-control-slider"
                  value={customCancelMedian}
                  onChange={e => setCustomCancelMedian(parseInt(e.target.value))}
                />
              </div>

              {/* Order Count Input */}
              <div className="anomaly-control-group">
                <span className="anomaly-control-label" title="Total count of simulated order actions executed.">
                  Rogue Orders Count
                </span>
                <input 
                  type="number" 
                  className="anomaly-control-input"
                  value={customOrderCount}
                  onChange={e => setCustomOrderCount(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              {/* Price Impact Slider */}
              <div className="anomaly-control-group">
                <span className="anomaly-control-label" title="Rogue targeting threshold for shifting the order book spread.">
                  Target Price Shift: {customPriceImpact}%
                </span>
                <input 
                  type="range" 
                  min="0.1" 
                  max="10.0" 
                  step="0.1"
                  className="anomaly-control-slider"
                  value={customPriceImpact}
                  onChange={e => setCustomPriceImpact(parseFloat(e.target.value))}
                />
              </div>

              <button className="inject-btn" onClick={handleInjectCustomAnomaly}>
                Execute Malicious Scenario
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Main View Grid */}
      {currentView === 'compliance' ? (
        <main className="dashboard-grid" style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden', height: 'calc(100vh - 52px - 36px)' }}>
          
          {/* Left Side Watchlist */}
          <section className="watchlist-panel" style={{ width: watchlistWidth, flexShrink: 0 }}>
            <div className="watchlist-header">
              <div className="watchlist-title-row">
                <span className="watchlist-title">
                  Watchlist <span className="watchlist-count-badge">{filteredInstruments.length + filteredStaticWatchlist.length}</span>
                </span>
              </div>
              
              <div className="watchlist-search-container">
                <Search size={12} className="text-muted" />
                <input 
                  type="text" 
                  className="watchlist-search-input" 
                  placeholder="Filter watchlist..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="watchlist-list">
              {/* Active replaying instruments (Logo on the left before name, no borders) */}
              {filteredInstruments.map(inst => {
                const isSelected = inst.instrument_id === activeInstrumentId;
                const isUp = inst.change >= 0;
                return (
                  <div 
                    key={inst.instrument_id} 
                    className={`watchlist-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setActiveInstrumentId(inst.instrument_id)}
                  >
                    <div className="watchlist-item-left" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                      <img className="company-logo" src={getLogoUrl(inst.symbol)} alt={inst.symbol} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="watchlist-symbol">{inst.symbol}</span>
                        <span className="watchlist-exchange">
                          <span className="nse-badge">NSE</span>
                        </span>
                      </div>
                    </div>
                    <div className="watchlist-item-right">
                      <span className={`watchlist-price ${isUp ? 'text-up' : 'text-down'}`}>
                        {inst.price.toFixed(2)}
                      </span>
                      <span className={`watchlist-change ${isUp ? 'text-up' : 'text-down'}`}>
                        {isUp ? '+' : ''}{inst.change.toFixed(2)} ({isUp ? '+' : ''}{inst.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="watchlist-item-actions">
                      <button 
                        className="quick-btn buy" 
                        style={{ padding: '3px 8px', fontSize: '9px', fontWeight: 'bold', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'var(--buy-green)', color: 'white' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveInstrumentId(inst.instrument_id);
                          setOrderAction('BUY');
                        }}
                      >
                        BUY
                      </button>
                      <button 
                        className="quick-btn sell" 
                        style={{ padding: '3px 8px', fontSize: '9px', fontWeight: 'bold', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'var(--sell-red)', color: 'white' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveInstrumentId(inst.instrument_id);
                          setOrderAction('SELL');
                        }}
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Static watchlist items */}
              {filteredStaticWatchlist.map(inst => {
                const isUp = inst.change >= 0;
                return (
                  <div 
                    key={inst.symbol} 
                    className="watchlist-item"
                    onClick={() => triggerToast(`${inst.symbol} is currently simulated. Select RELIANCE or HDFCBANK to replay live data.`)}
                  >
                    <div className="watchlist-item-left" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                      <img className="company-logo" src={getLogoUrl(inst.symbol)} alt={inst.symbol} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="watchlist-symbol">{inst.symbol}</span>
                        <span className="watchlist-exchange">
                          <span className="nse-badge">NSE</span>
                        </span>
                      </div>
                    </div>
                    <div className="watchlist-item-right">
                      <span className={`watchlist-price ${isUp ? 'text-up' : 'text-down'}`}>
                        {inst.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`watchlist-change ${isUp ? 'text-up' : 'text-down'}`}>
                        {isUp ? '+' : ''}{inst.change.toFixed(2)} ({isUp ? '+' : ''}{inst.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="watchlist-item-actions">
                      <button 
                        className="quick-btn buy" 
                        style={{ padding: '3px 8px', fontSize: '9px', fontWeight: 'bold', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'var(--buy-green)', color: 'white' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerToast(`${inst.symbol} is currently simulated. Select RELIANCE or HDFCBANK to replay live data.`);
                        }}
                      >
                        BUY
                      </button>
                      <button 
                        className="quick-btn sell" 
                        style={{ padding: '3px 8px', fontSize: '9px', fontWeight: 'bold', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'var(--sell-red)', color: 'white' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerToast(`${inst.symbol} is currently simulated. Select RELIANCE or HDFCBANK to replay live data.`);
                        }}
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div 
            className={`resizer-handle ${isResizingLeft ? 'active' : ''}`}
            onMouseDown={(e) => startResizing(e, 'left')}
            style={{
              width: '4px',
              cursor: 'col-resize',
              backgroundColor: isResizingLeft ? 'var(--primary)' : 'var(--border)',
              transition: 'background-color 0.2s',
              alignSelf: 'stretch',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              if (!isResizingLeft) e.currentTarget.style.backgroundColor = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              if (!isResizingLeft) e.currentTarget.style.backgroundColor = 'var(--border)';
            }}
          />

          {/* Center Panel (Chart & Alerts Drawer) */}
          <section className="center-panel" style={{ flex: 1, minWidth: 0 }}>
            <div className="chart-header">
              <div className="chart-info-left" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                {/* Logo in Chart Panel before the stock name */}
                <img className="company-logo large" src={getLogoUrl(activeInstrument.symbol)} alt={activeInstrument.symbol} />
                <div>
                  <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {activeInstrument.name}
                    <span className="nse-badge">NSE</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '2px' }}>
                    <span className={`chart-ltp ${activeInstrument.change >= 0 ? 'text-up' : 'text-down'}`} style={{ fontSize: '13px', fontWeight: 'bold' }}>
                      ₹{activeInstrument.price.toFixed(2)}
                    </span>
                    <span className={`chart-change ${activeInstrument.change >= 0 ? 'text-up' : 'text-down'}`} style={{ fontSize: '11px' }}>
                      {activeInstrument.change >= 0 ? '+' : ''}{activeInstrument.change.toFixed(2)} ({activeInstrument.change >= 0 ? '+' : ''}{activeInstrument.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Day OHLC details */}
              <div className="chart-ohlc-block" style={{ marginLeft: 'auto', marginRight: '16px' }}>
                <div className="ohlc-item">
                  <span className="ohlc-label">O</span>
                  <span className="ohlc-value">{currentTick?.open_day?.toFixed(2) || activeInstrument.price.toFixed(2)}</span>
                </div>
                <div className="ohlc-item">
                  <span className="ohlc-label">H</span>
                  <span className="ohlc-value text-up">{currentTick?.high_day?.toFixed(2) || (activeInstrument.price + 5).toFixed(2)}</span>
                </div>
                <div className="ohlc-item">
                  <span className="ohlc-label">L</span>
                  <span className="ohlc-value text-down">{currentTick?.low_day?.toFixed(2) || (activeInstrument.price - 5).toFixed(2)}</span>
                </div>
                <div className="ohlc-item">
                  <span className="ohlc-label">C</span>
                  <span className="ohlc-value">{currentTick?.close_day?.toFixed(2) || activeInstrument.prevClose.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Chart Canvas Wrapper */}
            <div className="chart-body" style={{ backgroundColor: chartTheme === 'dark' ? '#131722' : '#ffffff' }}>
              <div className="chart-controls-overlay">
                <span style={{ color: '#858994', fontSize: '10px', paddingRight: '6px' }}>View Mode:</span>
                <button className="chart-overlay-btn active">Candlesticks</button>
                <button className="chart-overlay-btn">Order Visualizer</button>
                
                {/* Settings Toggle Button */}
                <button 
                  className={`chart-overlay-btn ${showSettingsPanel ? 'active' : ''}`}
                  onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}
                >
                  <Settings size={11} /> Settings
                </button>
                
                <span className="nse-badge" style={{ marginLeft: 'auto', marginRight: '8px' }}>NSE DATA STREAM</span>
              </div>
              
              {showSettingsPanel && (
                <div className="chart-settings-dropdown" style={{
                  position: 'absolute',
                  top: '36px',
                  left: '12px',
                  zIndex: 100,
                  backgroundColor: 'rgba(20, 24, 33, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '12px',
                  width: '260px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  color: '#d1d4dc',
                  fontSize: '11px',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#fff' }}>Chart Settings</span>
                    <button 
                      onClick={() => setShowSettingsPanel(false)}
                      style={{ background: 'none', border: 'none', color: '#858994', cursor: 'pointer', padding: '0 4px', fontSize: '13px' }}
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* Theme Selector */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Chart Theme</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        onClick={() => setChartTheme('dark')}
                        style={{
                          backgroundColor: chartTheme === 'dark' ? '#2b6cb0' : 'rgba(255,255,255,0.05)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontWeight: chartTheme === 'dark' ? 'bold' : 'normal'
                        }}
                      >
                        Dark
                      </button>
                      <button 
                        onClick={() => setChartTheme('light')}
                        style={{
                          backgroundColor: chartTheme === 'light' ? '#2b6cb0' : 'rgba(255,255,255,0.05)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontWeight: chartTheme === 'light' ? 'bold' : 'normal'
                        }}
                      >
                        Light
                      </button>
                    </div>
                  </div>

                  {/* Up Color */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Bullish (Up) Color</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="color" 
                        value={chartUpColor} 
                        onChange={(e) => setChartUpColor(e.target.value)}
                        style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                      />
                      <span style={{ fontFamily: 'monospace' }}>{chartUpColor.toUpperCase()}</span>
                    </div>
                  </div>

                  {/* Down Color */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Bearish (Down) Color</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="color" 
                        value={chartDownColor} 
                        onChange={(e) => setChartDownColor(e.target.value)}
                        style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                      />
                      <span style={{ fontFamily: 'monospace' }}>{chartDownColor.toUpperCase()}</span>
                    </div>
                  </div>

                  {/* Grid Lines */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Grid Lines</span>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={showGridLines}
                        onChange={(e) => setShowGridLines(e.target.checked)}
                        style={{ cursor: 'pointer', marginRight: '4px' }}
                      />
                      {showGridLines ? 'Enabled' : 'Hidden'}
                    </label>
                  </div>

                  {/* Quick Preset Colors */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                    <span style={{ color: '#858994', display: 'block', marginBottom: '6px' }}>Color Presets</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => {
                          setChartUpColor('#26a69a');
                          setChartDownColor('#ef5350');
                        }}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px'
                        }}
                      >
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#26a69a' }} />
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef5350' }} />
                        Standard
                      </button>
                      
                      <button 
                        onClick={() => {
                          setChartUpColor('#1a73e8');
                          setChartDownColor('#ff9800');
                        }}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px'
                        }}
                      >
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1a73e8' }} />
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff9800' }} />
                        Shield
                      </button>

                      <button 
                        onClick={() => {
                          setChartUpColor('#ffffff');
                          setChartDownColor('#475569');
                        }}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px'
                        }}
                      >
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#475569' }} />
                        Mono
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {hoveredIncident && markerTooltipPos && (
                <div className="chart-marker-tooltip" style={{
                  position: 'absolute',
                  top: `${markerTooltipPos.y - 70}px`,
                  left: `${markerTooltipPos.x + 12}px`,
                  zIndex: 110,
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  borderLeft: `3px solid ${hoveredIncident.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}`,
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderLeftWidth: '3px',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  pointerEvents: 'none',
                  fontSize: '10px',
                  width: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                    <span style={{ color: hoveredIncident.severity === 'CRITICAL' ? '#f87171' : '#fbbf24' }}>
                      ⚠️ {hoveredIncident.pattern}
                    </span>
                    <span style={{ opacity: 0.6, fontSize: '8px' }}>{hoveredIncident.id}</span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '9px', lineHeight: '1.2' }}>
                    {hoveredIncident.evidence.length > 55 ? `${hoveredIncident.evidence.substring(0, 55)}...` : hoveredIncident.evidence}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '3px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '8px' }}>
                    <span>Conf: {(hoveredIncident.confidence * 100).toFixed(0)}%</span>
                    <span style={{ color: '#60a5fa', fontWeight: '500' }}>Click to triage</span>
                  </div>
                </div>
              )}
              
              <div ref={chartContainerRef} className="chart-container-div" />
            </div>

            {/* Chart bottom timeline */}
            <div className="chart-footer">
              <div className="timeframe-selector">
                <button className="timeframe-btn active">1D</button>
                <button className="timeframe-btn">5D</button>
                <button className="timeframe-btn">1M</button>
                <button className="timeframe-btn">3M</button>
              </div>

              <div className="chart-timestamp">
                Replaying: {(() => {
                  const ts = currentTick ? currentTick.timestamp : null;
                  if (!ts) return new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false }) + " IST";
                  try {
                    const d = new Date(ts);
                    return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false }) + " IST";
                  } catch (e) {
                    return ts;
                  }
                })()}
              </div>

              <div className="chart-attribution">
                Live Trade Feed <span className="nse-badge">NSE</span>
              </div>
            </div>

            {/* Compliance Drawer (if alert active and compliance tab opened) */}
            {showCompliancePanel && surveillanceAlert && (
              <div className="compliance-drawer">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                    <ShieldAlert size={16} className="text-down" /> Threat Intelligence Incident Triage
                  </h3>
                  <button 
                    className="watchlist-btn" 
                    onClick={() => {
                      setShowCompliancePanel(false);
                      setTriageReport(null);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="alert-item-card">
                  <div className="alert-card-header">
                    <span>Incident Reference: {surveillanceAlert.alert_id}</span>
                    <span className={`alert-severity-badge ${surveillanceAlert.severity}`}>{surveillanceAlert.severity}</span>
                  </div>
                  
                  <div className="alert-card-body">
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>{surveillanceAlert.description}</p>
                    
                    <div className="alert-evidence-grid">
                      <div className="evidence-item">
                        <span className="evidence-label">Cancel Ratio</span>
                        <span className="evidence-value">{(surveillanceAlert.evidence.cancel_ratio * 100).toFixed(1)}%</span>
                      </div>
                      <div className="evidence-item">
                        <span className="evidence-label">Cancel Median</span>
                        <span className="evidence-value">{surveillanceAlert.evidence.cancel_time_median}ms</span>
                      </div>
                      <div className="evidence-item">
                        <span className="evidence-label">Orders Count</span>
                        <span className="evidence-value">{surveillanceAlert.evidence.order_count}</span>
                      </div>
                      <div className="evidence-item">
                        <span className="evidence-label">Price Impact</span>
                        <span className="evidence-value">{(surveillanceAlert.evidence.price_impact * 100).toFixed(2)}%</span>
                      </div>
                    </div>

                    {!triageReport && (
                      <button 
                        className="triage-analyze-btn" 
                        onClick={handleRunTriage}
                        disabled={triageLoading}
                        style={{ marginTop: '12px' }}
                      >
                        {triageLoading ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            Running Claude AI Surveillance Triage...
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            Analyze Alert with Claude AI
                          </>
                        )}
                      </button>
                    )}

                    {triageReport && (
                      <div className="triage-report-box" style={{ marginTop: '12px' }}>
                        <div className="verdict-header">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Activity size={13} /> AI Surveillance Verdict
                          </span>
                          <span className={`verdict-badge ${triageReport.verdict}`}>{triageReport.verdict}</span>
                        </div>
                        
                        <p style={{ fontWeight: '500', marginBottom: '8px', fontSize: '11px' }}>{triageReport.rationale}</p>
                        
                        <div style={{ fontSize: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                          <div>Cancel vs Baseline: <strong>{triageReport.supporting_evidence.anomaly_vs_baseline}</strong></div>
                          <div>Triage Confidence: <strong>{(triageReport.confidence * 100).toFixed(0)}%</strong></div>
                        </div>

                        <div style={{ marginTop: '8px' }}>
                          <strong>Compliance Action Plan:</strong>
                          <ul className="triage-recommendations">
                            {triageReport.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                          </ul>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', width: '100%' }}>
                          <button 
                            className="place-order-btn buy" 
                            style={{ flex: 1, padding: '10px 16px', fontSize: '12.5px', fontWeight: 'bold', height: '38px', cursor: 'pointer', borderRadius: '6px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => {
                              setIncidents(prev => prev.map(inc => inc.id === surveillanceAlert.alert_id ? { ...inc, status: 'ESCALATED' } : inc));
                              triggerToast("Alert escalated to Compliance Desk L2. Order history archived.");
                              setSurveillanceAlert(null);
                              setTriageReport(null);
                              setShowCompliancePanel(false);
                            }}
                          >
                            Confirm & Escalate
                          </button>
                          <button 
                            className="place-order-btn sell" 
                            style={{ flex: 1, padding: '10px 16px', fontSize: '12.5px', fontWeight: 'bold', height: '38px', cursor: 'pointer', borderRadius: '6px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => {
                              setIncidents(prev => prev.map(inc => inc.id === surveillanceAlert.alert_id ? { ...inc, status: 'DISMISSED' } : inc));
                              triggerToast("Compliance alert dismissed as false positive.");
                              setSurveillanceAlert(null);
                              setTriageReport(null);
                              setShowCompliancePanel(false);
                            }}
                          >
                            Dismiss Alert
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Positions Table */}
            <div className="portfolio-panel" style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 'bold' }}>Margin Positions & Holdings</h3>
              </div>
              
              {positions.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px', fontSize: '11px' }}>
                  No open margin positions. Use the right sidebar to trade.
                </div>
              ) : (
                <table className="portfolio-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Avg Price</th>
                      <th>LTP</th>
                      <th>Day P&L</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold' }}>{pos.symbol}</td>
                        <td style={{ color: pos.type === 'BUY' ? '#1e88e5' : '#e53935', fontWeight: 'bold' }}>
                          {pos.type}
                        </td>
                        <td>{pos.qty}</td>
                        <td>₹{pos.avgPrice.toFixed(2)}</td>
                        <td>₹{pos.currentPrice.toFixed(2)}</td>
                        <td className={`pnl-text ${pos.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                          ₹{pos.pnl.toFixed(2)}
                        </td>
                        <td>
                          <button className="close-pos-btn" onClick={() => handleClosePosition(idx)}>Square Off</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <div 
            className={`resizer-handle ${isResizingRight ? 'active' : ''}`}
            onMouseDown={(e) => startResizing(e, 'right')}
            style={{
              width: '4px',
              cursor: 'col-resize',
              backgroundColor: isResizingRight ? 'var(--primary)' : 'var(--border)',
              transition: 'background-color 0.2s',
              alignSelf: 'stretch',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              if (!isResizingRight) e.currentTarget.style.backgroundColor = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              if (!isResizingRight) e.currentTarget.style.backgroundColor = 'var(--border)';
            }}
          />

          {/* Right Panel (Order Placement Form with Dual Action buttons & Market Depth) */}
          <section className="right-panel" style={{ width: orderPanelWidth, flexShrink: 0 }}>
            <div className="order-panel-header">
              <span className="order-panel-title">
                Trade Terminal <ArrowRightLeft size={13} style={{ color: '#2b6cb0' }} />
              </span>
            </div>

            <div className="order-ticker-summary">
              <div className="summary-symbol-row">
                <span className="summary-symbol" style={{ display: 'flex', alignItems: 'center' }}>
                  <img className="company-logo" src={getLogoUrl(activeInstrument.symbol)} alt={activeInstrument.symbol} />
                  {activeInstrument.symbol} <span className="nse-badge" style={{ marginLeft: '4px' }}>NSE</span>
                </span>
                <span style={{ fontSize: '10px', background: orderAction === 'BUY' ? 'rgba(30,136,229,0.1)' : 'rgba(229,57,53,0.1)', color: orderAction === 'BUY' ? '#1e88e5' : '#e53935', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                  {orderAction} MODE
                </span>
              </div>
              <div className="summary-price-row">
                <span className="summary-price">₹{activeInstrument.price.toFixed(2)}</span>
                <span className={`summary-change ${activeInstrument.change >= 0 ? 'text-up' : 'text-down'}`}>
                  {activeInstrument.change >= 0 ? '+' : ''}{activeInstrument.change.toFixed(2)} ({activeInstrument.change >= 0 ? '+' : ''}{activeInstrument.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="order-form-body">
              <div className="tabs-container">
                <div className={`tab-btn ${orderTab === 'REGULAR' ? 'active' : ''}`} onClick={() => setOrderTab('REGULAR')}>Regular</div>
                <div className={`tab-btn ${orderTab === 'GTT' ? 'active' : ''}`} onClick={() => setOrderTab('GTT')}>GTT</div>
              </div>

              {/* Sub-options */}
              <div className="sub-options-container">
                <div 
                  className={`sub-option-btn ${orderDuration === 'DELIVERY' ? 'active buy-active' : ''}`} 
                  onClick={() => setOrderDuration('DELIVERY')}
                >
                  Delivery (Longterm)
                </div>
                <div 
                  className={`sub-option-btn ${orderDuration === 'INTRADAY' ? 'active buy-active' : ''}`} 
                  onClick={() => setOrderDuration('INTRADAY')}
                >
                  Intraday (Same day)
                </div>
              </div>

              {/* Inputs: Quantity and Price Type */}
              <div className="input-row">
                <div className="input-group">
                  <span className="input-label">Quantity</span>
                  <div className="numeric-input-wrapper">
                    <button className="num-adjust-btn" onClick={() => setOrderQty(Math.max(1, orderQty - 5))}>-</button>
                    <input 
                      type="text" 
                      className="num-input" 
                      value={orderQty} 
                      onChange={e => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <button className="num-adjust-btn" onClick={() => setOrderQty(orderQty + 5)}>+</button>
                  </div>
                </div>

                <div className="input-group">
                  <span className="input-label">Price Type</span>
                  <select 
                    className="dropdown-input"
                    value={orderPriceType}
                    onChange={e => {
                      setOrderPriceType(e.target.value as any);
                      if (e.target.value === 'MARKET') {
                        setOrderPrice(lastLtp.toFixed(2));
                      }
                    }}
                  >
                    <option value="LIMIT">Limit</option>
                    <option value="MARKET">Market</option>
                  </select>
                </div>
              </div>

              <div className="input-row">
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <span className="input-label">Price</span>
                  <div className="numeric-input-wrapper">
                    <button 
                      className="num-adjust-btn" 
                      onClick={() => setOrderPrice((Math.max(0.05, parseFloat(orderPrice) - 0.05)).toFixed(2))}
                      disabled={orderPriceType === 'MARKET'}
                    >
                      -
                    </button>
                    <input 
                      type="text" 
                      className="num-input" 
                      value={orderPrice} 
                      onChange={e => setOrderPrice(e.target.value)}
                      disabled={orderPriceType === 'MARKET'}
                    />
                    <button 
                      className="num-adjust-btn" 
                      onClick={() => setOrderPrice((parseFloat(orderPrice) + 0.05).toFixed(2))}
                      disabled={orderPriceType === 'MARKET'}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Insufficient Funds Box */}
              {!hasSufficientFunds && (
                <div className="funds-warning-banner">
                  Margin insufficient to buy {activeInstrument.symbol}. <a onClick={() => setShowAddFundsModal(true)}>Add funds</a>.
                </div>
              )}

              {/* Market Depth */}
              <div className="market-depth-section">
                <div 
                  className="market-depth-toggle"
                  onClick={() => setIsMarketDepthCollapsed(!isMarketDepthCollapsed)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <span>Market Depth <span className="nse-badge">NSE</span></span>
                  {isMarketDepthCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </div>

                {!isMarketDepthCollapsed && (
                  <div className="depth-table-wrapper">
                    <table className="depth-table">
                      <thead>
                        <tr>
                          <th style={{ width: '20%' }}>Quantity</th>
                          <th style={{ width: '30%' }}>Bid Price</th>
                          <th style={{ width: '30%' }}>Ask Price</th>
                          <th style={{ width: '20%' }}>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const bid = depthData.bids[idx] || { price: 0, qty: 0 };
                          const ask = depthData.asks[idx] || { price: 0, qty: 0 };
                          
                          const bidBarPct = maxBidQty > 0 ? (bid.qty / maxBidQty) * 100 : 0;
                          const askBarPct = maxAskQty > 0 ? (ask.qty / maxAskQty) * 100 : 0;

                          return (
                            <tr 
                              key={idx} 
                              className="depth-row"
                              onClick={() => {
                                if (orderPriceType === 'LIMIT') {
                                  setOrderPrice(bid.price.toFixed(2));
                                }
                              }}
                            >
                              <td>{bid.qty > 0 ? bid.qty : '-'}</td>
                              <td className="text-up" style={{ position: 'relative' }}>
                                {bid.price > 0 ? bid.price.toFixed(2) : '-'}
                                <div className="depth-bar-bg bid" style={{ width: `${bidBarPct}%` }} />
                              </td>
                              <td className="text-down" style={{ position: 'relative' }}>
                                {ask.price > 0 ? ask.price.toFixed(2) : '-'}
                                <div className="depth-bar-bg ask" style={{ width: `${askBarPct}%` }} />
                              </td>
                              <td>{ask.qty > 0 ? ask.qty : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="depth-totals-row" style={{ marginTop: '8px' }}>
                      <span>Total Buy: <strong>{totalBuyQty.toLocaleString()}</strong> ({buyRatio.toFixed(0)}%)</span>
                      <span>Total Sell: <strong>{totalSellQty.toLocaleString()}</strong> ({sellRatio.toFixed(0)}%)</span>
                    </div>
                    
                    <div className="depth-ratio-bar-wrapper">
                      <div className="ratio-bar-bid" style={{ width: `${buyRatio}%` }} />
                      <div className="ratio-bar-ask" style={{ width: `${sellRatio}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Markets closed notice */}
              <div className="order-session-notice">
                <Clock size={14} /> Replaying Historical trade records <span className="nse-badge">NSE</span>
              </div>
            </div>

            {/* Place order footer: side-by-side Buy/Sell buttons */}
            <div className="order-summary-footer">
              <div className="cost-row required">
                <span>Required Margin</span>
                <span className="cost-val">₹{requiredFunds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div className="cost-row available">
                <span>Available Margin</span>
                <span className={`cost-val ${funds >= requiredFunds ? 'green' : 'red'}`}>
                  ₹{funds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="dual-order-buttons">
                <button 
                  className="place-order-btn buy"
                  onClick={() => { setOrderAction('BUY'); handlePlaceOrder(); }}
                  disabled={!hasSufficientFunds}
                >
                  BUY LONG
                </button>
                <button 
                  className="place-order-btn sell"
                  onClick={() => { setOrderAction('SELL'); handlePlaceOrder(); }}
                  disabled={!hasSufficientFunds}
                >
                  SELL SHORT
                </button>
              </div>
            </div>
          </section>
        </main>
      ) : currentView === 'incidents' ? (
        <div className="incidents-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Compliance Incident Log</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>Historical and newly triggered trade surveillance incidents.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px', marginTop: '10px' }}>
            {/* Table list */}
            <div>
              <table className="incident-table">
                <thead>
                  <tr>
                    <th>Incident ID</th>
                    <th>Ticker</th>
                    <th>Pattern Flagged</th>
                    <th>Severity</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr 
                      key={inc.id} 
                      style={{ cursor: 'pointer', backgroundColor: selectedIncident?.id === inc.id ? 'rgba(0,0,0,0.04)' : '' }}
                      onClick={() => setSelectedIncident(inc)}
                    >
                      <td style={{ fontWeight: 'bold' }}>{inc.id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img className="company-logo" src={getLogoUrl(inc.symbol)} alt={inc.symbol} />
                          {inc.symbol}
                        </div>
                      </td>
                      <td>{inc.pattern}</td>
                      <td>
                        <span className={`alert-severity-badge ${inc.severity}`} style={{ fontSize: '9px', padding: '2px 6px' }}>{inc.severity}</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatHumanReadableTime(inc.timestamp)}</td>
                      <td>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 'bold',
                          color: inc.status === 'PENDING' ? '#ff9800' : inc.status === 'ESCALATED' ? '#e53935' : '#1a73e8'
                        }}>
                          {inc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Incident Details Card */}
            {selectedIncident && (
              <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', backgroundColor: 'var(--bg-main)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '10px' }}>
                  <span style={{ fontWeight: '800', fontSize: '13px' }}>Incident: {selectedIncident.id}</span>
                  <span className={`alert-severity-badge ${selectedIncident.severity}`}>{selectedIncident.severity}</span>
                </div>

                {/* Tab buttons to toggle between Summary and Interactive Graph */}
                <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px' }}>
                  <button 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      fontWeight: activeDetailTab === 'graph' ? 'bold' : 'normal', 
                      color: activeDetailTab === 'graph' ? '#1a73e8' : 'var(--text-muted)', 
                      borderBottom: activeDetailTab === 'graph' ? '2px solid #1a73e8' : 'none',
                      paddingBottom: '4px',
                      cursor: 'pointer', 
                      fontSize: '11px' 
                    }}
                    onClick={() => setActiveDetailTab('graph')}
                  >
                    Interactive Graph
                  </button>
                  <button 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      fontWeight: activeDetailTab === 'summary' ? 'bold' : 'normal', 
                      color: activeDetailTab === 'summary' ? '#1a73e8' : 'var(--text-muted)', 
                      borderBottom: activeDetailTab === 'summary' ? '2px solid #1a73e8' : 'none',
                      paddingBottom: '4px',
                      cursor: 'pointer', 
                      fontSize: '11px' 
                    }}
                    onClick={() => setActiveDetailTab('summary')}
                  >
                    Details Summary
                  </button>
                </div>

                {activeDetailTab === 'graph' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <IncidentGraph 
                      incident={selectedIncident} 
                      onClose={() => setIsFullscreenGraph(true)}
                      onUpdateIncident={handleUpdateIncidentStatus}
                      triggerToast={triggerToast}
                    />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                      <button 
                        className="place-order-btn buy" 
                        style={{ padding: '6px 12px', fontSize: '11px' }}
                        onClick={() => {
                          setIncidents(prev => prev.map(inc => inc.id === selectedIncident.id ? { ...inc, status: 'ESCALATED' } : inc));
                          setSelectedIncident(prev => prev ? { ...prev, status: 'ESCALATED' } : null);
                          triggerToast("Incident Escalated.");
                        }}
                      >
                        Escalate to Regulator
                      </button>
                      <button 
                        className="place-order-btn sell" 
                        style={{ padding: '6px 12px', fontSize: '11px' }}
                        onClick={() => {
                          setIncidents(prev => prev.map(inc => inc.id === selectedIncident.id ? { ...inc, status: 'DISMISSED' } : inc));
                          setSelectedIncident(prev => prev ? { ...prev, status: 'DISMISSED' } : null);
                          triggerToast("Incident Dismissed.");
                        }}
                      >
                        Dismiss Case
                      </button>
                      <button 
                        className="place-order-btn" 
                        style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#475569', color: 'white', width: 'auto' }}
                        onClick={() => {
                          printIncidentReport(selectedIncident);
                          triggerToast("Generating professional incident audit trail PDF...");
                        }}
                      >
                        Export PDF
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Security: </span>
                      <strong>{selectedIncident.symbol}</strong> <span className="nse-badge">NSE</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Detection Pattern: </span>
                      <strong>{selectedIncident.pattern}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Detected Time: </span>
                      <span>{formatHumanReadableTime(selectedIncident.timestamp)}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>AI Confidence Score: </span>
                      <strong>{(selectedIncident.confidence * 100).toFixed(0)}%</strong>
                    </div>
                    
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '10px' }}>
                      <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Surveillance Evidence:</span>
                      <p style={{ color: '#4a4a50', lineHeight: 1.4 }}>{selectedIncident.evidence}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                      <button 
                        className="place-order-btn buy" 
                        style={{ padding: '6px 12px', fontSize: '11px' }}
                        onClick={() => {
                          setIncidents(prev => prev.map(inc => inc.id === selectedIncident.id ? { ...inc, status: 'ESCALATED' } : inc));
                          setSelectedIncident(prev => prev ? { ...prev, status: 'ESCALATED' } : null);
                          triggerToast("Incident Escalated.");
                        }}
                      >
                        Escalate to Regulator
                      </button>
                      <button 
                        className="place-order-btn sell" 
                        style={{ padding: '6px 12px', fontSize: '11px' }}
                        onClick={() => {
                          setIncidents(prev => prev.map(inc => inc.id === selectedIncident.id ? { ...inc, status: 'DISMISSED' } : inc));
                          setSelectedIncident(prev => prev ? { ...prev, status: 'DISMISSED' } : null);
                          triggerToast("Incident Dismissed.");
                        }}
                      >
                        Dismiss Case
                      </button>
                      <button 
                        className="place-order-btn" 
                        style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#475569', color: 'white', width: 'auto' }}
                        onClick={() => {
                          printIncidentReport(selectedIncident);
                          triggerToast("Generating professional incident audit trail PDF...");
                        }}
                      >
                        Export PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : currentView === 'events' ? (
        <div className="events-container" style={{ padding: '14px', gap: '10px' }}>

          {/* ── Top Bar ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', margin: 0 }}>System Event Log</h2>
              <p style={{ color: '#94a3b8', fontSize: '10.5px', margin: '1px 0 0' }}>
                {filteredEventLogs.length} of {logs.length} events · Live surveillance engine feed
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={11} style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search messages…"
                  value={eventSearchQuery}
                  onChange={e => setEventSearchQuery(e.target.value)}
                  style={{ paddingLeft: '24px', paddingRight: '8px', height: '26px', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '11px', width: '170px', color: '#374151', outline: 'none', backgroundColor: 'white' }}
                />
              </div>
              <button onClick={handleExportEventsCSV} style={{ height: '26px', padding: '0 10px', fontSize: '10.5px', fontWeight: '600', border: '1px solid #e2e8f0', borderRadius: '5px', background: 'white', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Download size={11} /> CSV
              </button>
              <button onClick={handleExportEventsTXT} style={{ height: '26px', padding: '0 10px', fontSize: '10.5px', fontWeight: '600', border: '1px solid #e2e8f0', borderRadius: '5px', background: 'white', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Download size={11} /> TXT
              </button>
              {(eventSearchQuery || eventTagFilter !== 'ALL') && (
                <button onClick={() => { setEventSearchQuery(''); setEventTagFilter('ALL'); }} style={{ height: '26px', padding: '0 8px', fontSize: '10.5px', fontWeight: '600', border: '1px solid #fecaca', borderRadius: '5px', background: '#fff5f5', color: '#dc2626', cursor: 'pointer' }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Filter Tag Pills ── */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', marginRight: '2px' }}>FILTER:</span>
            {(['ALL', 'THREAT', 'TRADE', 'SYSTEM', 'WS', 'HISTORY', 'WALLET', 'INFO'] as const).map(t => {
              const meta = t !== 'ALL' ? EVENT_TAG_META[t] : null;
              const count = t === 'ALL' ? logs.length : (eventTagCounts[t] || 0);
              const isActive = eventTagFilter === t;
              return (
                <button key={t} onClick={() => setEventTagFilter(t)} style={{
                  height: '22px', padding: '0 8px', fontSize: '10px', fontWeight: '700',
                  borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s',
                  border: isActive ? `1.5px solid ${meta?.border || '#475569'}` : '1.5px solid #e2e8f0',
                  background: isActive ? (meta?.bg || '#f1f5f9') : 'white',
                  color: isActive ? (meta?.color || '#334155') : '#64748b',
                  letterSpacing: '0.03em'
                }}>
                  {t} {count}
                </button>
              );
            })}
          </div>

          {/* ── Table ── */}
          <div className="events-console" style={{ flex: 1, minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 76px 1fr', gap: '10px', padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 2, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#94a3b8', borderRadius: '8px 8px 0 0' }}>
              <span>Time</span><span>Type</span><span>Message</span>
            </div>

            {filteredEventLogs.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>🔍</div>
                {logs.length === 0 ? 'No events yet — trigger a simulation or place an order.' : 'No events match your filters.'}
              </div>
            )}

            {filteredEventLogs.map((log, index) => {
              const { tag, time, message } = parseEventLog(log);
              const meta = EVENT_TAG_META[tag] || EVENT_TAG_META.INFO;
              return (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '80px 76px 1fr', gap: '10px', padding: '5px 12px', borderBottom: '1px solid #f1f5f9', borderLeft: `3px solid ${meta.border}`, backgroundColor: meta.rowBg, alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.97)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
                >
                  <span style={{ fontSize: '10.5px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{time}</span>
                  <span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '800', letterSpacing: '0.07em', padding: '2px 6px', borderRadius: '3px', background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>{tag}</span>
                  </span>
                  <span style={{ fontSize: '11px', color: tag === 'THREAT' ? '#991b1b' : '#374151', fontWeight: tag === 'THREAT' ? '600' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={message}>
                    {eventSearchQuery && message.toLowerCase().includes(eventSearchQuery.toLowerCase()) ? (() => {
                      const idx = message.toLowerCase().indexOf(eventSearchQuery.toLowerCase());
                      return <>{message.slice(0, idx)}<mark style={{ background: '#fef08a', color: '#713f12', borderRadius: '2px', padding: '0 1px' }}>{message.slice(idx, idx + eventSearchQuery.length)}</mark>{message.slice(idx + eventSearchQuery.length)}</>;
                    })() : message}
                  </span>
                </div>
              );
            })}
            <div ref={eventsConsoleEndRef} />
          </div>
        </div>
      ) : currentView === 'rca' ? (
        <div className="rca-container" style={{ padding: '20px', backgroundColor: '#f8fafc', height: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>Root Cause Analysis (RCA)</h2>
              <p style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Detailed breakdown and reconstructed sequence of suspicious market actions.</p>
            </div>
            
            {/* Searchable Dropdown for Incidents */}
            <div className="rca-dropdown-group" style={{ position: 'relative', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: '500' }}>Analyze Incident:</span>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Search & select incident..." 
                  className="anomaly-control-input"
                  style={{ width: '280px', paddingRight: '24px', fontSize: '11px', height: '28px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                  value={rcaSearchQuery}
                  onChange={e => {
                    setRcaSearchQuery(e.target.value);
                    setShowRcaIncidentDropdown(true);
                  }}
                  onFocus={() => setShowRcaIncidentDropdown(true)}
                />
                <ChevronDown size={14} style={{ position: 'absolute', right: '8px', top: '7px', color: '#64748b', pointerEvents: 'none' }} />
                
                {showRcaIncidentDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '32px',
                    left: 0,
                    width: '380px',
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 1000,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    padding: '4px 0'
                  }}>
                    {incidents
                      .filter(inc => {
                        if (!rcaSearchQuery) return true;
                        const q = rcaSearchQuery.toLowerCase();
                        return inc.id.toLowerCase().includes(q) || 
                               inc.symbol.toLowerCase().includes(q) || 
                               inc.pattern.toLowerCase().includes(q);
                      })
                      .map(inc => (
                        <div 
                          key={inc.id}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '11.5px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          onClick={() => {
                            setRcaSelectedIncident(inc);
                            setRcaSearchQuery(`${inc.id} - ${inc.symbol} (${inc.pattern})`);
                            setShowRcaIncidentDropdown(false);
                            setRcaLoading(true);
                            setTimeout(() => setRcaLoading(false), 500);
                          }}
                        >
                          <div>
                            <strong style={{ color: '#1e293b' }}>{inc.id}</strong>
                            <span style={{ marginLeft: '6px', color: '#64748b' }}>{inc.symbol} ({inc.pattern})</span>
                          </div>
                          <span style={{
                            fontSize: '9px', padding: '1px 4px', borderRadius: '2px', fontWeight: 'bold',
                            color: inc.severity === 'CRITICAL' ? '#9b2c2c' : inc.severity === 'HIGH' ? '#c05621' : '#4a5568',
                            backgroundColor: inc.severity === 'CRITICAL' ? '#fff5f5' : inc.severity === 'HIGH' ? '#fffaf0' : '#f7fafc',
                          }}>
                            {inc.severity}
                          </span>
                        </div>
                      ))}
                    {incidents.filter(inc => {
                      if (!rcaSearchQuery) return true;
                      const q = rcaSearchQuery.toLowerCase();
                      return inc.id.toLowerCase().includes(q) || 
                             inc.symbol.toLowerCase().includes(q) || 
                             inc.pattern.toLowerCase().includes(q);
                    }).length === 0 && (
                      <div style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                        No incidents found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {rcaLoading ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '60px 20px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#3182ce', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '12px', color: '#64748b' }}>Running AI Forensic Reconstruction...</span>
            </div>
          ) : (() => {
            const activeInc = rcaSelectedIncident || selectedIncident || incidents[0];
            if (!activeInc) {
              return (
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '40px', backgroundColor: 'white', textAlign: 'center', color: '#64748b' }}>
                  No incidents logged. Please trigger some threat simulations from the Injector.
                </div>
              );
            }
            
            const pat = activeInc.pattern.toUpperCase();
            
            // Build dynamic details based on incident pattern
            let rcaVerdict = `Potential manipulative behavior detected on ${activeInc.symbol}`;
            let metrics = {
              ingress: "12 per 1.5s",
              cancelRatio: "85.7%",
              lag: "+1.2ms",
              disbalance: "+8.4%"
            };
            let phases = [
              { time: "00.0s", title: "Anomaly Inception", text: "Suspicious volume profile starts deviation from average market baseline." },
              { time: "01.2s", title: "Gateway Load Spike", text: "Heavy traffic detected in network ingress buffer." },
              { time: "02.5s", title: "Target Execution", text: "Execution occurs on opposite books." },
              { time: "03.0s", title: "Reversion Check", text: "Trading behavior returns to standard distribution." }
            ];

            if (pat.includes("SPOOFING")) {
              rcaVerdict = `Spoofing sequence on ${activeInc.symbol} - Artificial Demand Creation`;
              metrics = {
                ingress: "14 per 2.1s",
                cancelRatio: "85.7%",
                lag: "+3.2ms",
                disbalance: "+14.8%"
              };
              phases = [
                { time: "09:47:31.022", title: "Phase 1: Volume Inflation", text: `Target account submits 8 Buy Limit orders below LTP to create artificial depth.` },
                { time: "09:47:32.415", title: "Phase 2: Bid Pressure Disbalance", text: "Buy volume depth spikes, inducing algorithmic participants to adjust bids upward." },
                { time: "09:47:32.910", title: "Phase 3: Execution Fill", text: `Target account executes a matching market Sell order at the inflated LTP.` },
                { time: "09:47:33.400", title: "Phase 4: Instant Spoof Cancel", text: "Target account cancels all outstanding Buy Limit orders in under 490ms." }
              ];
            } else if (pat.includes("LAYERING")) {
              rcaVerdict = `Layering sequence on ${activeInc.symbol} - Price Compression Manipulation`;
              metrics = {
                ingress: "22 per 1.8s",
                cancelRatio: "91.2%",
                lag: "+4.1ms",
                disbalance: "-18.2%"
              };
              phases = [
                { time: "11:15:02.110", title: "Phase 1: Quote Layering", text: "Actor submits multiple Sell limit orders at increasing price levels, compounding supply perception." },
                { time: "11:15:03.450", title: "Phase 2: Price Compression", text: "Bid pressure is compressed downward as buyers react to fake heavy supply." },
                { time: "11:15:03.920", title: "Phase 3: Favorable Buy Fill", text: "Actor executes a matching market Buy order at the artificially depressed price." },
                { time: "11:15:04.200", title: "Phase 4: Bulk Layer Cancellation", text: "All layered Sell orders are instantly canceled in a single block network request." }
              ];
            } else if (pat.includes("WASH")) {
              rcaVerdict = `Wash Trading match detected on ${activeInc.symbol} - Self-Matching Accounts`;
              metrics = {
                ingress: "8 trades matching",
                cancelRatio: "5.4%",
                lag: "+0.4ms",
                disbalance: "+0.2%"
              };
              phases = [
                { time: "13:22:10.150", title: "Phase 1: Internal Matching Ingress", text: "Accounts under common beneficial ownership submit buy and sell orders with identical price and size." },
                { time: "13:22:10.160", title: "Phase 2: Execution with No Risk", text: "Orders are crossed internally on the exchange in 10ms with zero change in net market exposure." },
                { time: "13:22:15.000", title: "Phase 3: Volume & Liquidty Inflation", text: "Instrument trading volume spikes +45% in 5 seconds, triggering algorithmic heatmaps." },
                { time: "13:22:20.400", title: "Phase 4: Return to Baseline", text: "Spread recovers, leaving retail traders to follow the artificial momentum signal." }
              ];
            } else if (pat.includes("QUOTE") || pat.includes("STUFFING")) {
              rcaVerdict = `Quote Stuffing on ${activeInc.symbol} - Network Ingress Saturation`;
              metrics = {
                ingress: "142 per 240ms",
                cancelRatio: "98.9%",
                lag: "+18.5ms",
                disbalance: "+32.1%"
              };
              phases = [
                { time: "14:10:04.100", title: "Phase 1: High-Frequency Injection", text: "HFT script begins flooding the exchange gateway with rapid placement/cancel cycles." },
                { time: "14:10:04.250", title: "Phase 2: Feed Latency Congestion", text: "Exchange matching gateway experiences queue build-up. Price feed delays rise by 15ms." },
                { time: "14:10:04.340", title: "Phase 3: Latency Arbitrage Trade", text: "Threat actor executes trades on secondary exchange, exploiting latency differences." },
                { time: "14:10:05.100", title: "Phase 4: Burst Halting", text: "Script halts quote flood, letting matching engine drain the queue and restore sync." }
              ];
            } else if (pat.includes("PUMP") || pat.includes("DUMP")) {
              rcaVerdict = `Pump & Dump scheme on ${activeInc.symbol} - Coordinated Price Spike`;
              metrics = {
                ingress: "Volume Spike 6.2x",
                cancelRatio: "12.5%",
                lag: "+0.8ms",
                disbalance: "+48.2%"
              };
              phases = [
                { time: "15:05:00.000", title: "Phase 1: Coordinated Buying", text: "Multiple accounts launch aggressive buy orders, driving price up +6.2% in a short window." },
                { time: "15:06:12.000", title: "Phase 2: Retail FOMO Attraction", text: "Social alerts and volume spike scanners draw retail momentum buyers into the stock." },
                { time: "15:08:45.000", title: "Phase 3: Block Position Dump", text: "Inside entities execute massive block sell orders at peak prices, absorbing retail bids." },
                { time: "15:09:30.000", title: "Phase 4: Liquidity Collapse", text: "Bids disappear, and stock crashes back down -12% to pre-manipulation levels." }
              ];
            }

            return (
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', backgroundColor: 'white', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#2b6cb0' }}>
                    Root Cause Verdict: {rcaVerdict}
                  </h3>
                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '3px', fontWeight: 'bold', color: 'white',
                    backgroundColor: activeInc.status === 'PENDING' ? '#dd6b20' : activeInc.status === 'ESCALATED' ? '#e53e3e' : '#319795'
                  }}>
                    {activeInc.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', fontSize: '12px' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#475569' }}>RCA Metrics Summary:</span>
                    <ul style={{ listStyleType: 'none', paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '10px', margin: 0 }}>
                      <li style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>Incident ID: <strong style={{ float: 'right' }}>{activeInc.id}</strong></li>
                      <li style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>Trigger Time: <strong style={{ float: 'right' }}>{formatHumanReadableTime(activeInc.timestamp)}</strong></li>
                      <li style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>Ingress Speed: <strong style={{ float: 'right' }}>{metrics.ingress}</strong></li>
                      <li style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>Ratio of Cancels: <strong style={{ float: 'right', color: '#e53e3e' }}>{metrics.cancelRatio}</strong></li>
                      <li style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>Gateway Lag Delta: <strong style={{ float: 'right' }}>{metrics.lag}</strong></li>
                      <li style={{ paddingBottom: '4px' }}>Market Disbalance: <strong style={{ float: 'right', color: '#319795' }}>{metrics.disbalance}</strong></li>
                    </ul>
                  </div>

                  <div>
                    <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#475569' }}>Chronological Activity Reconstruction:</span>
                    <div style={{ borderLeft: '2px solid #cbd5e1', paddingLeft: '16px', marginLeft: '6px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {phases.map((ph, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <div style={{
                            position: 'absolute',
                            left: '-22px',
                            top: '2px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: '#3182ce',
                            border: '2px solid white'
                          }} />
                          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>{ph.time}</span>
                          <strong style={{ color: '#1e293b' }}>{ph.title}</strong>
                          <p style={{ margin: '2px 0 0 0', color: '#475569', fontSize: '11px', lineHeight: 1.4 }}>{ph.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : currentView === 'simulators' ? (
        <div className="simulators-container">
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Replay Simulators</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>Configure speed, manage datasets, and load files.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '10px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '10px' }}>Replay Data Source</span>
              
              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="anomaly-control-group">
                  <span className="anomaly-control-label">Select Active Instrument Source</span>
                  <select 
                    className="anomaly-control-input"
                    value={activeInstrumentId}
                    onChange={e => setActiveInstrumentId(e.target.value)}
                  >
                    {instruments.map(inst => (
                      <option key={inst.instrument_id} value={inst.instrument_id}>
                        {inst.symbol} - {inst.name}
                      </option>
                    ))}
                  </select>
                </div>

                {datasetTimeRange && (() => {
                  const startTimeMs = new Date(datasetTimeRange.start).getTime();
                  const endTimeMs = new Date(datasetTimeRange.end).getTime();
                  const currentTimeMs = currentPlaybackTime 
                    ? new Date(currentPlaybackTime).getTime() 
                    : (lastStreamedTimestampRef.current 
                        ? new Date(lastStreamedTimestampRef.current).getTime() 
                        : startTimeMs);
                  const validCurrentTimeMs = Math.max(startTimeMs, Math.min(currentTimeMs, endTimeMs));
                  
                  // Calculate progress percentage
                  const progressPct = ((validCurrentTimeMs - startTimeMs) / Math.max(1, endTimeMs - startTimeMs)) * 100;
                  
                  return (
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '14px',
                      marginTop: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                    }}>
                      {/* Top Header Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isReplaying ? '#10b981' : '#ef4444',
                            display: 'inline-block'
                          }} />
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                            STATUS: <span style={{ color: isReplaying ? '#10b981' : '#ef4444' }}>{isReplaying ? 'ACTIVE' : 'PAUSED'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Large Glowing Time Display */}
                      <div style={{
                        textAlign: 'center',
                        padding: '10px 0',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          Current Replay Position (IST)
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          color: 'var(--text-main)'
                        }}>
                          {formatHumanReadableTime(currentPlaybackTime || lastStreamedTimestampRef.current || datasetTimeRange.start)}
                        </div>
                      </div>

                      {/* Progress Seek Slider */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                          <input 
                            type="range"
                            min={startTimeMs}
                            max={endTimeMs}
                            value={validCurrentTimeMs}
                            onInput={(e) => {
                              const val = parseInt(e.currentTarget.value);
                              setCurrentPlaybackTime(new Date(val).toISOString());
                            }}
                            onMouseUp={(e) => {
                              const val = parseInt(e.currentTarget.value);
                              handleJumpToTime(new Date(val).toISOString());
                            }}
                            onTouchEnd={(e) => {
                              const val = parseInt(e.currentTarget.value);
                              handleJumpToTime(new Date(val).toISOString());
                            }}
                            onKeyUp={(e) => {
                              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                                const val = parseInt(e.currentTarget.value);
                                handleJumpToTime(new Date(val).toISOString());
                              }
                            }}
                            style={{
                              width: '100%',
                              height: '6px',
                              borderRadius: '3px',
                              background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${progressPct}%, #e2e8f0 ${progressPct}%, #e2e8f0 100%)`,
                              outline: 'none',
                              cursor: 'pointer',
                              WebkitAppearance: 'none'
                            }}
                            className="replay-slider"
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
                          <div><b>Start (IST):</b> {formatHumanReadableTime(datasetTimeRange.start)}</div>
                          <div><b>End (IST):</b> {formatHumanReadableTime(datasetTimeRange.end)}</div>
                        </div>
                      </div>

                      {/* Control Buttons Row */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                          onClick={handleTogglePlayPause}
                          style={{
                            flex: 1,
                            height: '32px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          {isReplaying ? '⏸ Pause' : '▶ Play'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="anomaly-control-group" style={{ marginTop: '5px' }}>
                  <span className="anomaly-control-label">Upload Custom Dataset File (CSV)</span>
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileUpload}
                    style={{ fontSize: '11px', padding: '4px' }} 
                  />
                  <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    CSV must include headers: timestamp, ltp (or price/close).
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Replay Speed Multiplier:</span>
                  <div className="speed-buttons">
                    <button className={`speed-btn ${replaySpeed === 1 ? 'active' : ''}`} onClick={() => setReplaySpeed(1)}>1x</button>
                    <button className={`speed-btn ${replaySpeed === 10 ? 'active' : ''}`} onClick={() => setReplaySpeed(10)}>10x</button>
                    <button className={`speed-btn ${replaySpeed === 50 ? 'active' : ''}`} onClick={() => setReplaySpeed(50)}>50x</button>
                    <button className={`speed-btn ${replaySpeed === 100 ? 'active' : ''}`} onClick={() => setReplaySpeed(100)}>100x</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '10px' }}>Node Diagnostic Health</span>
              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>Diagnostic Status: <strong style={{ color: '#1a73e8' }}>Healthy</strong></div>
                <div>Connection Type: <strong>WebSockets (Stream Engine)</strong></div>
                <div>Node IP Address: <strong>10.10.50.157</strong></div>
                <div>Ingress Latency: <strong>&lt;0.82ms</strong></div>
                <button 
                  className="add-funds-btn" 
                  onClick={() => {
                    setCandles([]);
                    setVolumes([]);
                    triggerToast("Replayer cache cleared. Restarting stream.");
                  }}
                  style={{ width: 'fit-content', marginTop: '10px' }}
                >
                  Force Replayer Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : currentView === 'channels' ? (
        <div className="channels-container" style={{ padding: '20px', backgroundColor: '#f8fafc', height: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>Alert Notification Channels</h2>
              <p style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Configure upstream destinations for security and pattern violations.</p>
            </div>
            
            {/* Tiny Search Bar */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Search config fields..." 
                className="anomaly-control-input"
                style={{ width: '220px', paddingLeft: '28px', fontSize: '11px', height: '28px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                value={channelSearch}
                onChange={e => setChannelSearch(e.target.value)}
              />
              <Search size={12} style={{ position: 'absolute', left: '10px', color: '#64748b' }} />
              {channelSearch && (
                <button 
                  onClick={() => setChannelSearch("")} 
                  style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '10px' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Telegram Channel */}
            {(!channelSearch || "telegram bot token chat id".includes(channelSearch.toLowerCase())) && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', backgroundColor: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: telegramConfig.enabled ? '#1a73e8' : '#cbd5e1' }} />
                    <img src="https://www.google.com/s2/favicons?sz=64&domain=telegram.org" alt="Telegram" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>Telegram Bot Integration</span>
                  </div>
                  <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={telegramConfig.enabled} 
                      onChange={e => {
                        const newVal = e.target.checked;
                        setTelegramConfig(prev => ({ ...prev, enabled: newVal }));
                        saveTelegramConfig(newVal);
                      }}
                    />
                    <span>{telegramConfig.enabled ? "Active" : "Disabled"}</span>
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Bot Token</span>
                    <input 
                      type="text" 
                      className="anomaly-control-input" 
                      style={{ fontSize: '11px', height: '26px' }}
                      value={telegramConfig.botToken} 
                      onChange={e => setTelegramConfig(prev => ({ ...prev, botToken: e.target.value }))}
                    />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Target Chat ID</span>
                    <input 
                      type="text" 
                      className="anomaly-control-input" 
                      style={{ fontSize: '11px', height: '26px' }}
                      value={telegramConfig.chatId} 
                      onChange={e => setTelegramConfig(prev => ({ ...prev, chatId: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button 
                      className="add-funds-btn" 
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => saveTelegramConfig()}
                    >
                      Save Settings
                    </button>
                    <button 
                      className="add-funds-btn" 
                      style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#64748b' }}
                      onClick={testTelegramConnection}
                    >
                      Test Connection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SMTP Email Channel */}
            {(!channelSearch || "smtp email host port user from to".includes(channelSearch.toLowerCase())) && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', backgroundColor: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: smtpConfig.enabled ? '#1a73e8' : '#cbd5e1' }} />
                    <img src="https://www.google.com/s2/favicons?sz=64&domain=gmail.com" alt="SMTP" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>SMTP Email Server</span>
                  </div>
                  <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={smtpConfig.enabled} 
                      onChange={e => {
                        const newVal = e.target.checked;
                        setSmtpConfig(prev => ({ ...prev, enabled: newVal }));
                        saveSmtpConfig(newVal);
                      }}
                    />
                    <span>{smtpConfig.enabled ? "Active" : "Disabled"}</span>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>SMTP Host</span>
                    <input 
                      type="text" 
                      className="anomaly-control-input" 
                      style={{ fontSize: '11px', height: '26px' }}
                      value={smtpConfig.host} 
                      onChange={e => setSmtpConfig(prev => ({ ...prev, host: e.target.value }))}
                    />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Port</span>
                    <input 
                      type="number" 
                      className="anomaly-control-input" 
                      style={{ fontSize: '11px', height: '26px' }}
                      value={smtpConfig.port} 
                      onChange={e => setSmtpConfig(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px', marginTop: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>SMTP User</span>
                    <input 
                      type="text" 
                      className="anomaly-control-input" 
                      style={{ fontSize: '11px', height: '26px' }}
                      value={smtpConfig.user} 
                      onChange={e => setSmtpConfig(prev => ({ ...prev, user: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Sender</span>
                      <input 
                        type="text" 
                        className="anomaly-control-input" 
                        style={{ fontSize: '11px', height: '26px' }}
                        value={smtpConfig.from} 
                        onChange={e => setSmtpConfig(prev => ({ ...prev, from: e.target.value }))}
                      />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Recipient</span>
                      <input 
                        type="text" 
                        className="anomaly-control-input" 
                        style={{ fontSize: '11px', height: '26px' }}
                        value={smtpConfig.to} 
                        onChange={e => setSmtpConfig(prev => ({ ...prev, to: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button 
                      className="add-funds-btn" 
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => saveSmtpConfig()}
                    >
                      Save Settings
                    </button>
                    <button 
                      className="add-funds-btn" 
                      style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#64748b' }}
                      onClick={testSmtpConnection}
                    >
                      Test Connection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Jira Ticket Channel */}
            {(!channelSearch || "jira ticket project key auth token endpoint".includes(channelSearch.toLowerCase())) && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', backgroundColor: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: jiraConfig.enabled ? '#1a73e8' : '#cbd5e1' }} />
                    <img src="https://www.google.com/s2/favicons?sz=64&domain=atlassian.com" alt="Jira" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>Jira Ticket Escalation</span>
                  </div>
                  <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={jiraConfig.enabled} 
                      onChange={e => {
                        const newVal = e.target.checked;
                        setJiraConfig(prev => ({ ...prev, enabled: newVal }));
                        saveJiraConfig(newVal);
                      }}
                    />
                    <span>{jiraConfig.enabled ? "Active" : "Disabled"}</span>
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Jira Endpoint URL</span>
                    <input 
                      type="text" 
                      className="anomaly-control-input" 
                      style={{ fontSize: '11px', height: '26px' }}
                      value={jiraConfig.endpoint} 
                      onChange={e => setJiraConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Project Key</span>
                      <input 
                        type="text" 
                        className="anomaly-control-input" 
                        style={{ fontSize: '11px', height: '26px' }}
                        value={jiraConfig.projectKey} 
                        onChange={e => setJiraConfig(prev => ({ ...prev, projectKey: e.target.value }))}
                      />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Issue Type</span>
                      <input 
                        type="text" 
                        className="anomaly-control-input" 
                        style={{ fontSize: '11px', height: '26px' }}
                        value={jiraConfig.issueType} 
                        onChange={e => setJiraConfig(prev => ({ ...prev, issueType: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Auth Token</span>
                    <input 
                      type="text" 
                      className="anomaly-control-input" 
                      style={{ fontSize: '11px', height: '26px' }}
                      value={jiraConfig.token} 
                      onChange={e => setJiraConfig(prev => ({ ...prev, token: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button 
                      className="add-funds-btn" 
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => saveJiraConfig()}
                    >
                      Save Settings
                    </button>
                    <button 
                      className="add-funds-btn" 
                      style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#64748b' }}
                      onClick={testJiraConnection}
                    >
                      Test Connection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Teams Integration Channel */}
            {(!channelSearch || "teams webhook url microsoft teams channel".includes(channelSearch.toLowerCase())) && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', backgroundColor: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: teamsConfig.enabled ? '#1a73e8' : '#cbd5e1' }} />
                    <img src="https://www.google.com/s2/favicons?sz=64&domain=microsoft.com" alt="Teams" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>Microsoft Teams Webhook</span>
                  </div>
                  <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={teamsConfig.enabled} 
                      onChange={e => {
                        const newVal = e.target.checked;
                        setTeamsConfig(prev => ({ ...prev, enabled: newVal }));
                        saveTeamsConfig(newVal);
                      }}
                    />
                    <span>{teamsConfig.enabled ? "Active" : "Disabled"}</span>
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Webhook URL</span>
                    <input 
                      type="text" 
                      className="anomaly-control-input" 
                      style={{ fontSize: '11px', height: '26px' }}
                      value={teamsConfig.webhookUrl} 
                      onChange={e => setTeamsConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', marginBottom: '3px' }}>Channel Name</span>
                    <input 
                      type="text" 
                      className="anomaly-control-input" 
                      style={{ fontSize: '11px', height: '26px' }}
                      value={teamsConfig.channelName} 
                      onChange={e => setTeamsConfig(prev => ({ ...prev, channelName: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button 
                      className="add-funds-btn" 
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => saveTeamsConfig()}
                    >
                      Save Settings
                    </button>
                    <button 
                      className="add-funds-btn" 
                      style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#64748b' }}
                      onClick={testTeamsConnection}
                    >
                      Test Webhook
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : currentView === 'policies' ? (
        <div className="policies-container" style={{ padding: '20px', backgroundColor: '#f8fafc', height: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>Automated Policy Manager</h2>
              <p style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Define automated actions and routing protocols triggered by compliance anomalies.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="file" 
                id="policy-import-input" 
                accept=".json" 
                style={{ display: 'none' }} 
                onChange={handleImportPolicies} 
              />
              <button 
                className="add-funds-btn" 
                style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#edf2f7', color: '#475569', border: '1px solid #cbd5e1' }}
                onClick={() => document.getElementById("policy-import-input")?.click()}
              >
                <Upload size={12} /> Import
              </button>
              <button 
                className="add-funds-btn" 
                style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#edf2f7', color: '#475569', border: '1px solid #cbd5e1' }}
                onClick={() => exportPolicies(policies)}
              >
                <Download size={12} /> Export All
              </button>

              {/* Search input */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Search rules..." 
                  className="anomaly-control-input"
                  style={{ width: '180px', paddingLeft: '28px', fontSize: '11px', height: '28px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  value={policySearch}
                  onChange={e => setPolicySearch(e.target.value)}
                />
                <Search size={12} style={{ position: 'absolute', left: '10px', color: '#64748b' }} />
                {policySearch && (
                  <button 
                    onClick={() => setPolicySearch("")} 
                    style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '10px' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <button 
                className="add-funds-btn" 
                style={{ padding: '6px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setShowAddPolicyModal(true)}
              >
                <Plus size={12} /> Add Rule
              </button>
            </div>
          </div>

          {/* Bulk Actions and Select All Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '10px', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={policies.length > 0 && selectedPolicyIds.length === policies.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPolicyIds(policies.map(p => p.id));
                  } else {
                    setSelectedPolicyIds([]);
                  }
                }}
              />
              <span style={{ color: '#475569', fontWeight: '500' }}>
                {selectedPolicyIds.length} of {policies.length} selected
              </span>
            </div>
            
            {selectedPolicyIds.length > 0 && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="add-funds-btn" 
                  style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#fed7d7', color: '#9b2c2c', border: '1px solid #feb2b2' }}
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete ${selectedPolicyIds.length} policy rules?`)) {
                      fetch(`${BACKEND_URL}/api/v1/detect/policies/bulk-delete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: selectedPolicyIds })
                      })
                      .then(res => {
                        if (!res.ok) throw new Error("API error");
                        return res.json();
                      })
                      .then(() => {
                        refreshPoliciesList();
                        triggerToast(`Deleted ${selectedPolicyIds.length} policy rules.`);
                        setSelectedPolicyIds([]);
                      })
                      .catch(err => {
                        console.error("Failed to bulk delete policies:", err);
                        triggerToast("Failed to delete policies from database.");
                      });
                    }
                  }}
                >
                  <Trash size={11} style={{ marginRight: '3px', display: 'inline' }} /> Delete Selected
                </button>
                <button 
                  className="add-funds-btn" 
                  style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#edf2f7', color: '#475569', border: '1px solid #cbd5e1' }}
                  onClick={() => {
                    const selected = policies.filter(p => selectedPolicyIds.includes(p.id));
                    exportPolicies(selected);
                  }}
                >
                  <Download size={11} style={{ marginRight: '3px', display: 'inline' }} /> Export Selected
                </button>
              </div>
            )}
          </div>

          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 'bold' }}>
                  <th style={{ padding: '10px 14px', width: '40px' }}>Select</th>
                  <th style={{ padding: '10px 14px' }}>Rule ID</th>
                  <th style={{ padding: '10px 14px' }}>Rule Name</th>
                  <th style={{ padding: '10px 14px' }}>Target Pattern</th>
                  <th style={{ padding: '10px 14px' }}>Severity Threshold</th>
                  <th style={{ padding: '10px 14px' }}>Mitigation Action</th>
                  <th style={{ padding: '10px 14px' }}>Channels</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies
                  .filter(p => {
                    if (!policySearch) return true;
                    const q = policySearch.toLowerCase();
                    return p.name.toLowerCase().includes(q) || 
                           p.pattern.toLowerCase().includes(q) || 
                           p.action.toLowerCase().includes(q) ||
                           p.severity.toLowerCase().includes(q);
                  })
                  .map(policy => {
                    const isSelected = selectedPolicyIds.includes(policy.id);
                    return (
                      <tr key={policy.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155', backgroundColor: isSelected ? '#f8fafc' : 'transparent' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedPolicyIds(prev => prev.filter(id => id !== policy.id));
                              } else {
                                setSelectedPolicyIds(prev => [...prev, policy.id]);
                              }
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 'bold' }}>{policy.id}</td>
                        <td style={{ padding: '10px 14px' }}>{policy.name}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold', backgroundColor: '#f1f5f9' }}>
                            {policy.pattern}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: '9.5px', padding: '2px 5px', borderRadius: '2px', fontWeight: 'bold',
                            color: policy.severity === 'CRITICAL' ? '#9b2c2c' : policy.severity === 'HIGH' ? '#c05621' : policy.severity === 'MEDIUM' ? '#dd6b20' : '#4a5568',
                            backgroundColor: policy.severity === 'CRITICAL' ? '#fff5f5' : policy.severity === 'HIGH' ? '#fffaf0' : policy.severity === 'MEDIUM' ? '#fffaf0' : '#f7fafc',
                          }}>
                            {policy.severity}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#2b6cb0', fontWeight: '500' }}>
                          {policy.action.replace('_', ' ')}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {policy.channels.map(ch => (
                              <span key={ch} style={{ fontSize: '9px', backgroundColor: '#edf2f7', padding: '1px 4px', borderRadius: '2px' }}>{ch}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <label className="switch" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input 
                              type="checkbox" 
                              checked={policy.enabled} 
                              onChange={() => {
                                const updatedPolicy = { ...policy, enabled: !policy.enabled };
                                fetch(`${BACKEND_URL}/api/v1/detect/policies/${policy.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(updatedPolicy)
                                })
                                .then(res => {
                                  if (!res.ok) throw new Error("API error");
                                  return res.json();
                                })
                                .then(() => {
                                  refreshPoliciesList();
                                  triggerToast(`Policy ${policy.id} status updated.`);
                                })
                                .catch(err => {
                                  console.error("Failed to toggle policy status:", err);
                                  triggerToast("Failed to toggle policy status in database.");
                                });
                              }}
                            />
                            <span style={{ fontSize: '10.5px', color: policy.enabled ? '#1a73e8' : '#94a3b8' }}>
                              {policy.enabled ? "Active" : "Paused"}
                            </span>
                          </label>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button 
                              style={{ border: 'none', background: 'none', color: '#475569', cursor: 'pointer', padding: '2px' }}
                              title="Export Rule"
                              onClick={() => exportPolicies([policy])}
                            >
                              <Download size={13} />
                            </button>
                            <button 
                              style={{ border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: '2px' }}
                              title="Edit Rule"
                              onClick={() => {
                                setEditingPolicy(policy);
                                setShowEditPolicyModal(true);
                              }}
                            >
                              <Edit size={13} />
                            </button>
                            <button 
                              style={{ border: 'none', background: 'none', color: '#e53e3e', cursor: 'pointer', padding: '2px' }}
                              title="Delete Rule"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete policy ${policy.id}?`)) {
                                  fetch(`${BACKEND_URL}/api/v1/detect/policies/${policy.id}`, {
                                    method: 'DELETE'
                                  })
                                  .then(res => {
                                    if (!res.ok) throw new Error("API error");
                                    return res.json();
                                  })
                                  .then(() => {
                                    refreshPoliciesList();
                                    setSelectedPolicyIds(prev => prev.filter(id => id !== policy.id));
                                    triggerToast(`Policy ${policy.id} deleted successfully.`);
                                  })
                                  .catch(err => {
                                    console.error("Failed to delete policy:", err);
                                    triggerToast("Failed to delete policy from database.");
                                  });
                                }
                              }}
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 3. Bottom Status Bar */}
      <footer className="bottom-status-panel">
        <div className="status-left">
          <div className="status-tabs">
            <div className={`status-tab ${currentView === 'compliance' ? 'active' : ''}`} onClick={() => setCurrentView('compliance')}>Compliance</div>
            <div className={`status-tab ${currentView === 'incidents' ? 'active' : ''}`} onClick={() => setCurrentView('incidents')}>Incidents</div>
            <div className={`status-tab ${currentView === 'events' ? 'active' : ''}`} onClick={() => setCurrentView('events')}>Events</div>
            <div className={`status-tab ${currentView === 'rca' ? 'active' : ''}`} onClick={() => setCurrentView('rca')}>Analysis</div>
            <div className={`status-tab ${currentView === 'channels' ? 'active' : ''}`} onClick={() => setCurrentView('channels')}>Channels</div>
            <div className={`status-tab ${currentView === 'policies' ? 'active' : ''}`} onClick={() => setCurrentView('policies')}>Policy</div>
            <div className={`status-tab ${currentView === 'simulators' ? 'active' : ''}`} onClick={() => setCurrentView('simulators')}>Simulators</div>
          </div>
          
          <div className="speed-control">
            <span className="speed-label">REPLAY MULTIPLIER:</span>
            <div className="speed-buttons">
              <button className={`speed-btn ${replaySpeed === 1 ? 'active' : ''}`} onClick={() => setReplaySpeed(1)}>1x</button>
              <button className={`speed-btn ${replaySpeed === 10 ? 'active' : ''}`} onClick={() => setReplaySpeed(10)}>10x</button>
              <button className={`speed-btn ${replaySpeed === 50 ? 'active' : ''}`} onClick={() => setReplaySpeed(50)}>50x</button>
              <button className={`speed-btn ${replaySpeed === 100 ? 'active' : ''}`} onClick={() => setReplaySpeed(100)}>100x</button>
            </div>
          </div>
        </div>

        <div className="status-right">
          <div className="status-pnl">
            <span className="pnl-label">Day Net P&L:</span>
            <span className={`pnl-value ${positions.reduce((sum, p) => sum + p.pnl, 0) >= 0 ? 'text-up' : 'text-down'}`}>
              ₹{positions.reduce((sum, p) => sum + p.pnl, 0).toFixed(2)}
            </span>
          </div>
          
          <div style={{ color: '#858994' }}>Connected Node: 10.10.50.157 <span className="nse-badge">NSE_EQ</span></div>
        </div>
      </footer>

      {/* 4. Add Funds Modal Dialog */}
      {showAddFundsModal && (
        <div className="modal-overlay" onClick={() => setShowAddFundsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Deposit Margin Capital</span>
              <button className="modal-close-btn" onClick={() => setShowAddFundsModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)' }}>Deposit mock margin capital to place transactions against the replayer.</p>
              <div style={{ marginTop: '14px' }}>
                <span className="input-label">Amount (INR)</span>
                <input 
                  type="text" 
                  className="modal-input" 
                  value={addFundsAmount} 
                  onChange={e => setAddFundsAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowAddFundsModal(false)}>Cancel</button>
              <button className="modal-btn primary" onClick={handleAddFunds}>Deposit Funds</button>
            </div>
          </div>
        </div>
      )}

      {/* 4.5 Add Policy Modal Dialog */}
      {showAddPolicyModal && (
        <div className="modal-overlay" onClick={() => setShowAddPolicyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '380px', borderRadius: '4px' }}>
            <div className="modal-header">
              <span className="modal-title">Create Automated Policy Rule</span>
              <button className="modal-close-btn" onClick={() => setShowAddPolicyModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Rule Name</span>
                <input 
                  type="text" 
                  className="modal-input" 
                  style={{ fontSize: '11px', height: '28px', padding: '4px 8px' }}
                  placeholder="e.g. Rate limit on Layering detection"
                  value={newPolicyName} 
                  onChange={e => setNewPolicyName(e.target.value)}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Target Pattern</span>
                  <select 
                    className="anomaly-control-input" 
                    style={{ fontSize: '11px', height: '28px' }}
                    value={newPolicyPattern}
                    onChange={e => setNewPolicyPattern(e.target.value)}
                  >
                    <option value="SPOOFING">SPOOFING</option>
                    <option value="LAYERING">LAYERING</option>
                    <option value="WASH_TRADING">WASH TRADING</option>
                    <option value="QUOTE_STUFFING">QUOTE STUFFING</option>
                    <option value="PUMP_DUMP">PUMP & DUMP</option>
                  </select>
                </div>
                <div>
                  <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Min Severity</span>
                  <select 
                    className="anomaly-control-input" 
                    style={{ fontSize: '11px', height: '28px' }}
                    value={newPolicySeverity}
                    onChange={e => setNewPolicySeverity(e.target.value)}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Mitigation Response</span>
                <select 
                  className="anomaly-control-input" 
                  style={{ fontSize: '11px', height: '28px' }}
                  value={newPolicyAction}
                  onChange={e => setNewPolicyAction(e.target.value)}
                >
                  <option value="BLOCK_TRADER">BLOCK TRADER (Instant revoke)</option>
                  <option value="ESCALATE">ESCALATE (L2 compliance review)</option>
                  <option value="THROTTLE_RATE">THROTTLE RATE (Throttle Quote Ingress)</option>
                  <option value="LOG_AUDIT">LOG AUDIT (SQLite database persist only)</option>
                </select>
              </div>

              <div>
                <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Alert Channels</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {["Telegram", "SMTP", "Jira", "Teams"].map(ch => {
                    const isChecked = newPolicyChannels.includes(ch);
                    return (
                      <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setNewPolicyChannels(prev => prev.filter(c => c !== ch));
                            } else {
                              setNewPolicyChannels(prev => [...prev, ch]);
                            }
                          }}
                        />
                        {ch}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '10px 14px' }}>
              <button className="modal-btn secondary" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setShowAddPolicyModal(false)}>Cancel</button>
              <button 
                className="modal-btn primary" 
                style={{ fontSize: '11px', padding: '4px 10px' }} 
                onClick={() => {
                  if (!newPolicyName.trim()) {
                    triggerToast("Rule Name is required.");
                    return;
                  }
                  const newId = "POL-0" + (policies.length + 1).toString().padStart(2, '0');
                  const rule = {
                    id: newId,
                    name: newPolicyName,
                    pattern: newPolicyPattern,
                    severity: newPolicySeverity,
                    action: newPolicyAction,
                    channels: newPolicyChannels,
                    enabled: true
                  };
                  fetch(`${BACKEND_URL}/api/v1/detect/policies`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rule)
                  })
                  .then(res => {
                    if (!res.ok) throw new Error("API error");
                    return res.json();
                  })
                  .then(() => {
                    refreshPoliciesList();
                    triggerToast(`Created policy rule: ${newId}`);
                    setShowAddPolicyModal(false);
                    setNewPolicyName("");
                    setNewPolicyChannels(["Telegram"]);
                  })
                  .catch(err => {
                    console.error("Failed to create policy:", err);
                    triggerToast("Failed to create policy in database.");
                  });
                }}
              >
                Create Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Settings Modal Dialog */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '420px', borderRadius: '6px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={15} /> System &amp; AI Governance Settings
              </span>
              <button className="modal-close-btn" onClick={() => setShowSettingsModal(false)}><X size={16} /></button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
              
              {/* Profile section */}
              <div>
                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: '0 0 8px 0', fontWeight: '800' }}>Compliance Profile</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <span className="input-label" style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Officer Name</span>
                    <input 
                      type="text" 
                      className="modal-input" 
                      style={{ fontSize: '11px', height: '28px', padding: '4px 8px' }}
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="input-label" style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Role / Designation</span>
                    <input 
                      type="text" 
                      className="modal-input" 
                      style={{ fontSize: '11px', height: '28px', padding: '4px 8px' }}
                      value={profileRole}
                      onChange={e => setProfileRole(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

              {/* LLM section */}
              <div>
                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: '0 0 8px 0', fontWeight: '800' }}>AI Triage Model Settings</h4>
                
                <span className="input-label" style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Select LLM Provider</span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  {/* Anthropic Card */}
                  <div 
                    onClick={() => setLlmProvider('Anthropic Claude')}
                    style={{
                      border: llmProvider === 'Anthropic Claude' ? '2px solid #f97316' : '1.5px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '10px',
                      cursor: 'pointer',
                      backgroundColor: llmProvider === 'Anthropic Claude' ? '#fffaf8' : '#ffffff',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="#f97316" style={{ flexShrink: 0 }}>
                        <path d="M12 2L2 22h4.5l2-4.5h7l2 4.5H22L12 2zm-1 12l2.5-6 2.5 6h-5z" />
                      </svg>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b' }}>Anthropic</span>
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>Claude 3.5 Sonnet</div>
                    {llmProvider === 'Anthropic Claude' && (
                      <span style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: '#f97316', color: 'white', borderRadius: '50%', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>
                        <Check size={8} strokeWidth={3} />
                      </span>
                    )}
                  </div>

                  {/* OpenAI Card */}
                  <div 
                    onClick={() => setLlmProvider('OpenAI GPT')}
                    style={{
                      border: llmProvider === 'OpenAI GPT' ? '2px solid #10b981' : '1.5px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '10px',
                      cursor: 'pointer',
                      backgroundColor: llmProvider === 'OpenAI GPT' ? '#f0fdf4' : '#ffffff',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="#10b981" style={{ flexShrink: 0 }}>
                        <path d="M20.5 9.3c.3-.8.3-1.6 0-2.3-.4-.8-1-1.4-1.9-1.6-.3-.1-.7-.1-1 0-.4-.7-.9-1.2-1.6-1.5-.8-.4-1.7-.4-2.5-.1-.3-.3-.7-.5-1.1-.6-.9-.3-1.8-.1-2.6.4-.6.4-1.1.9-1.4 1.6h-.1c-.8-.2-1.6-.1-2.3.2-.8.4-1.4 1.1-1.6 2-.1.3-.1.7 0 1-.7.4-1.2.9-1.5 1.6-.4.8-.4 1.7-.1 2.5.3.3.5.7.6 1.1-.1.9.1 1.8.6 2.6.4.6.9 1.1 1.6 1.4v.1c-.2.8-.1 1.6.2 2.3.4.8 1.1 1.4 2 1.6.3.1.7.1 1 0 .4.7.9 1.2 1.6 1.5.8.4 1.7.4 2.5.1.3.3.7.5 1.1.6.9.3 1.8.1 2.6-.4.6-.4 1.1-.9 1.4-1.6h.1c.8.2 1.6.1 2.3-.2.8-.4 1.4-1.1 1.6-2 .1-.3.1-.7 0-1 .7-.4 1.2-.9 1.5-1.6.4-.8.4-1.7.1-2.5-.3-.3-.5-.7-.6-1.1.1-.9-.1-1.8-.6-2.6-.3-.6-.8-1.1-1.5-1.4zm-7.6 11.2c-.4.2-.9.3-1.4.3-.5 0-1-.1-1.4-.4l5-2.9 1.4.8-3.6 2.2zm-5.7-2.6c-.2-.4-.3-.9-.3-1.4 0-.5.1-1 .4-1.4l5 2.9v1.6l-5.1-3.1zm-1.8-6.1c.1-.5.3-.9.6-1.3.3-.4.7-.6 1.2-.8l5 2.9-1.4.8-5.4-1.6zm4.1-4.8c.4-.2.9-.3 1.4-.3.5 0 1 .1 1.4.4l-5 2.9-1.4-.8 3.6-2.2zm5.7 2.6c.2.4.3.9.3 1.4 0 .5-.1 1-.4 1.4l-5-2.9V6.6l5.1 3.1zm1.8 6.1c-.1.5-.3.9-.6 1.3-.3.4-.7.6-1.2.8l-5-2.9 1.4-.8 5.4 1.6zM12 13.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z" />
                      </svg>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b' }}>OpenAI</span>
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>GPT-4o Engine</div>
                    {llmProvider === 'OpenAI GPT' && (
                      <span style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: '#10b981', color: 'white', borderRadius: '50%', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>
                        <Check size={8} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </div>

                {/* API Key inputs */}
                {llmProvider === 'Anthropic Claude' ? (
                  <div>
                    <span className="input-label" style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Anthropic API Key</span>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showAnthropicKey ? "text" : "password"} 
                        className="modal-input" 
                        style={{ fontSize: '11.5px', height: '28px', padding: '4px 30px 4px 8px', letterSpacing: showAnthropicKey ? 'normal' : '0.15em' }}
                        placeholder="sk-ant-..."
                        value={anthropicApiKey}
                        onChange={e => setAnthropicApiKey(e.target.value)}
                      />
                      <button 
                        onClick={() => setShowAnthropicKey(prev => !prev)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {showAnthropicKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="input-label" style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>OpenAI API Key</span>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showOpenaiKey ? "text" : "password"} 
                        className="modal-input" 
                        style={{ fontSize: '11.5px', height: '28px', padding: '4px 30px 4px 8px', letterSpacing: showOpenaiKey ? 'normal' : '0.15em' }}
                        placeholder="sk-..."
                        value={openaiApiKey}
                        onChange={e => setOpenaiApiKey(e.target.value)}
                      />
                      <button 
                        onClick={() => setShowOpenaiKey(prev => !prev)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {showOpenaiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                )}
                
                <p style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '6px', lineHeight: '1.3' }}>
                  Your API key is stored locally in your browser's localStorage and is only used to connect to the triage endpoints.
                </p>
              </div>

            </div>

            <div className="modal-footer" style={{ padding: '10px 14px' }}>
              <button 
                className="modal-btn secondary" 
                style={{ fontSize: '11px', padding: '4px 10px' }} 
                onClick={() => setShowSettingsModal(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-btn primary" 
                style={{ fontSize: '11px', padding: '4px 10px' }} 
                onClick={() => {
                  localStorage.setItem("tradeSurveillance_profileName", profileName);
                  localStorage.setItem("tradeSurveillance_profileRole", profileRole);
                  localStorage.setItem("tradeSurveillance_llmProvider", llmProvider);
                  localStorage.setItem("tradeSurveillance_anthropicApiKey", anthropicApiKey);
                  localStorage.setItem("tradeSurveillance_openaiApiKey", openaiApiKey);
                  setShowSettingsModal(false);
                  triggerToast("System settings saved successfully!");
                }}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trader CRUD Modal Dialog */}
      {showTraderCRUDModal && (
        <div className="modal-overlay" onClick={() => setShowTraderCRUDModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '550px', borderRadius: '6px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <span className="modal-title">
                {crudModalMode === 'list' ? 'Trader Profiles Directory' :
                 crudModalMode === 'add' ? 'Create Trader Profile' : 'Edit Trader Profile'}
              </span>
              <button className="modal-close-btn" onClick={() => setShowTraderCRUDModal(false)}><X size={16} /></button>
            </div>
            
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {crudModalMode === 'list' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Manage trader accounts authorized for high-frequency or retail market participation.</p>
                    <button
                      className="add-funds-btn"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => {
                        setNewTraderId("");
                        setNewTraderName("");
                        setNewTraderRole("");
                        setNewTraderSector("");
                        setNewTraderStatus("ACTIVE");
                        setCrudModalMode('add');
                      }}
                    >
                      <Plus size={11} style={{ marginRight: '2px', display: 'inline' }} /> Add Trader
                    </button>
                  </div>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 'bold' }}>
                          <th style={{ padding: '8px 10px' }}>Trader ID</th>
                          <th style={{ padding: '8px 10px' }}>Name</th>
                          <th style={{ padding: '8px 10px' }}>Role</th>
                          <th style={{ padding: '8px 10px' }}>Sector</th>
                          <th style={{ padding: '8px 10px' }}>Status</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tradersList.map(t => (
                          <tr key={t.trader_id} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{t.trader_id}</td>
                            <td style={{ padding: '8px 10px' }}>{t.name}</td>
                            <td style={{ padding: '8px 10px' }}>{t.role}</td>
                            <td style={{ padding: '8px 10px' }}>{t.sector}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontWeight: 'bold',
                                color: t.status === 'ACTIVE' ? '#234e52' : '#742a2a',
                                backgroundColor: t.status === 'ACTIVE' ? '#e6fffa' : '#fff5f5'
                              }}>
                                {t.status || 'ACTIVE'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                style={{ border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', fontSize: '11px', padding: '2px' }}
                                onClick={() => {
                                  setEditingTrader(t);
                                  setNewTraderId(t.trader_id);
                                  setNewTraderName(t.name);
                                  setNewTraderRole(t.role);
                                  setNewTraderSector(t.sector);
                                  setNewTraderStatus(t.status || "ACTIVE");
                                  setCrudModalMode('edit');
                                }}
                              >
                                Edit
                              </button>
                              <button
                                style={{ border: 'none', background: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '11px', padding: '2px' }}
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete trader ${t.name}?`)) {
                                    fetch(`${BACKEND_URL}/api/v1/detect/traders/${t.trader_id}`, { method: 'DELETE' })
                                      .then(res => res.json())
                                      .then(() => {
                                        triggerToast(`Trader ${t.name} deleted.`);
                                        refreshTradersList();
                                      })
                                      .catch(() => {
                                        setTradersList(prev => prev.filter(x => x.trader_id !== t.trader_id));
                                        triggerToast(`Trader ${t.name} deleted locally.`);
                                      });
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              
              {(crudModalMode === 'add' || crudModalMode === 'edit') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {editingTrader && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Modifying Trader ID: <strong style={{ color: '#1e293b' }}>{editingTrader.trader_id}</strong>
                    </div>
                  )}
                  <div>
                    <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Trader ID</span>
                    <input
                      type="text"
                      className="modal-input"
                      style={{ fontSize: '11px', height: '28px', padding: '4px 8px' }}
                      disabled={crudModalMode === 'edit'}
                      placeholder="e.g. TRADER_999"
                      value={newTraderId}
                      onChange={e => setNewTraderId(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Trader Name</span>
                    <input
                      type="text"
                      className="modal-input"
                      style={{ fontSize: '11px', height: '28px', padding: '4px 8px' }}
                      placeholder="e.g. Rahul Verma"
                      value={newTraderName}
                      onChange={e => setNewTraderName(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Trader Role</span>
                    <input
                      type="text"
                      className="modal-input"
                      style={{ fontSize: '11px', height: '28px', padding: '4px 8px' }}
                      placeholder="e.g. Arbitrage Specialist"
                      value={newTraderRole}
                      onChange={e => setNewTraderRole(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Authorized Sector</span>
                    <input
                      type="text"
                      className="modal-input"
                      style={{ fontSize: '11px', height: '28px', padding: '4px 8px' }}
                      placeholder="e.g. Tech/Energy"
                      value={newTraderSector}
                      onChange={e => setNewTraderSector(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Account Status</span>
                    <select
                      className="modal-input"
                      style={{ fontSize: '11px', height: '28px', padding: '0 8px', backgroundColor: 'white' }}
                      value={newTraderStatus}
                      onChange={e => setNewTraderStatus(e.target.value)}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer" style={{ padding: '10px 14px' }}>
              {crudModalMode === 'list' ? (
                <button className="modal-btn secondary" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setShowTraderCRUDModal(false)}>Close</button>
              ) : (
                <>
                  <button className="modal-btn secondary" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setCrudModalMode('list')}>Back to Directory</button>
                  <button
                    className="modal-btn primary"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => {
                      if (!newTraderId.trim() || !newTraderName.trim()) {
                        triggerToast("Trader ID and Name are required.");
                        return;
                      }
                      if (crudModalMode === 'add') {
                        fetch(`${BACKEND_URL}/api/v1/detect/traders`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ trader_id: newTraderId, name: newTraderName, role: newTraderRole, sector: newTraderSector, status: newTraderStatus })
                        })
                        .then(res => {
                          if (!res.ok) return res.json().then(d => { throw new Error(d.detail || "API error"); });
                          return res.json();
                        })
                        .then(() => {
                          triggerToast("Trader profile created.");
                          refreshTradersList();
                          setCrudModalMode('list');
                        })
                        .catch(() => {
                          const exists = tradersList.some(x => x.trader_id === newTraderId);
                          if (exists) {
                            triggerToast("Trader ID already exists locally.");
                            return;
                          }
                          setTradersList(prev => [...prev, { trader_id: newTraderId, name: newTraderName, role: newTraderRole, sector: newTraderSector, status: newTraderStatus }]);
                          triggerToast("Trader profile created locally.");
                          setCrudModalMode('list');
                        });
                      } else {
                        fetch(`${BACKEND_URL}/api/v1/detect/traders/${newTraderId}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newTraderName, role: newTraderRole, sector: newTraderSector, status: newTraderStatus })
                        })
                        .then(res => {
                          if (!res.ok) return res.json().then(d => { throw new Error(d.detail || "API error"); });
                          return res.json();
                        })
                        .then(() => {
                          triggerToast("Trader profile updated.");
                          refreshTradersList();
                          setCrudModalMode('list');
                        })
                        .catch(() => {
                          setTradersList(prev => prev.map(x => x.trader_id === newTraderId ? { ...x, name: newTraderName, role: newTraderRole, sector: newTraderSector, status: newTraderStatus } : x));
                          triggerToast("Trader profile updated locally.");
                          setCrudModalMode('list');
                        });
                      }
                    }}
                  >
                    Save Trader
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Policy Modal Dialog */}
      {showEditPolicyModal && editingPolicy && (
        <div className="modal-overlay" onClick={() => setShowEditPolicyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '380px', borderRadius: '4px' }}>
            <div className="modal-header">
              <span className="modal-title">Edit Automated Policy Rule</span>
              <button className="modal-close-btn" onClick={() => setShowEditPolicyModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Rule Name</span>
                <input 
                  type="text" 
                  className="modal-input" 
                  style={{ fontSize: '11px', height: '28px', padding: '4px 8px' }}
                  value={editingPolicy.name} 
                  onChange={e => setEditingPolicy((prev: any) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Target Pattern</span>
                  <select 
                    className="anomaly-control-input" 
                    style={{ fontSize: '11px', height: '28px' }}
                    value={editingPolicy.pattern}
                    onChange={e => setEditingPolicy((prev: any) => ({ ...prev, pattern: e.target.value }))}
                  >
                    <option value="SPOOFING">SPOOFING</option>
                    <option value="LAYERING">LAYERING</option>
                    <option value="WASH_TRADING">WASH TRADING</option>
                    <option value="QUOTE_STUFFING">QUOTE STUFFING</option>
                    <option value="PUMP_DUMP">PUMP & DUMP</option>
                  </select>
                </div>
                <div>
                  <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Min Severity</span>
                  <select 
                    className="anomaly-control-input" 
                    style={{ fontSize: '11px', height: '28px' }}
                    value={editingPolicy.severity}
                    onChange={e => setEditingPolicy((prev: any) => ({ ...prev, severity: e.target.value }))}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Mitigation Response</span>
                <select 
                  className="anomaly-control-input" 
                  style={{ fontSize: '11px', height: '28px' }}
                  value={editingPolicy.action}
                  onChange={e => setEditingPolicy((prev: any) => ({ ...prev, action: e.target.value }))}
                >
                  <option value="BLOCK_TRADER">BLOCK TRADER (Instant revoke)</option>
                  <option value="ESCALATE">ESCALATE (L2 compliance review)</option>
                  <option value="THROTTLE_RATE">THROTTLE RATE (Throttle Quote Ingress)</option>
                  <option value="LOG_AUDIT">LOG AUDIT (SQLite database persist only)</option>
                </select>
              </div>

              <div>
                <span className="input-label" style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Alert Channels</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {["Telegram", "SMTP", "Jira", "Teams"].map(ch => {
                    const isChecked = editingPolicy.channels.includes(ch);
                    return (
                      <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setEditingPolicy((prev: any) => ({
                                ...prev,
                                channels: prev.channels.filter((c: string) => c !== ch)
                              }));
                            } else {
                              setEditingPolicy((prev: any) => ({
                                ...prev,
                                channels: [...prev.channels, ch]
                              }));
                            }
                          }}
                        />
                        {ch}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '10px 14px' }}>
              <button className="modal-btn secondary" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setShowEditPolicyModal(false)}>Cancel</button>
              <button 
                className="modal-btn primary" 
                style={{ fontSize: '11px', padding: '4px 10px' }} 
                onClick={() => {
                  if (!editingPolicy.name.trim()) {
                    triggerToast("Rule Name is required.");
                    return;
                  }
                  fetch(`${BACKEND_URL}/api/v1/detect/policies/${editingPolicy.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editingPolicy)
                  })
                  .then(res => {
                    if (!res.ok) throw new Error("API error");
                    return res.json();
                  })
                  .then(() => {
                    refreshPoliciesList();
                    triggerToast(`Updated policy rule: ${editingPolicy.id}`);
                    setShowEditPolicyModal(false);
                    setEditingPolicy(null);
                  })
                  .catch(err => {
                    console.error("Failed to update policy:", err);
                    triggerToast("Failed to update policy in database.");
                  });
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Incident Graph Modal */}
      {isFullscreenGraph && selectedIncident && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            width: '90vw',
            height: '90vh',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid var(--border)',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
                  Interactive Incident Forensic Relation Map
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Forensic audit trail for Incident ID: <strong>{selectedIncident.id}</strong> ({selectedIncident.pattern})
                </p>
              </div>
              <button
                onClick={() => setIsFullscreenGraph(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>
            {/* Modal Body */}
            <div style={{ flex: 1, padding: '24px', backgroundColor: '#fdfdfd', overflow: 'hidden' }}>
              <IncidentGraph 
                incident={selectedIncident} 
                isFullscreen={true} 
                onClose={() => setIsFullscreenGraph(false)}
                onUpdateIncident={handleUpdateIncidentStatus}
                triggerToast={triggerToast}
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Toasts Alert System */}
      {toasts.map((toast, idx) => (
        <div key={idx} className="notification-toast" style={{ bottom: `${20 + idx * 50}px` }}>
          {toast}
        </div>
      ))}
    </div>
  );
}

export default App;
