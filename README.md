# AERO-SHIELD | AERO-GUARD (DRDO Problem ID: 26051)

> **Autonomous Environment & Regional Optimization for High-Altitude Military Shelters**
>
> Smart India Hackathon (SIH) — DRDO Problem ID: 26051

[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)](https://vercel.com)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React+Vite-61DAFB?logo=react)](https://react.dev)
[![Open-Meteo](https://img.shields.io/badge/Weather-Open--Meteo-4A90E2)](https://open-meteo.com)
[![OpenSky](https://img.shields.io/badge/Airspace-OpenSky%20Network-FFA500)](https://opensky-network.org)
[![MapTiler](https://img.shields.io/badge/Maps-MapTiler-00B4D8)](https://www.maptiler.com)
[![Sentinel](https://img.shields.io/badge/EO-Copernicus%20Sentinel--2-005B94)](https://sentinel-hub.com)

---

## 📌 System Overview

High-altitude forward defense posts in Ladakh, Siachen, and Sikkim (3,000–5,400 m ASL) face sub-zero temperatures down to -40°C, fierce katabatic winds, and extreme supply chain fragility. 

**AERO-SHIELD / AERO-GUARD** is an integrated tactical decision-support and engineering digital twin suite that combines:
1. **Live Atmospheric Intelligence:** Open-Meteo live hourly meteorological telemetry and WMO weather codes.
2. **Tactical Airspace & Drone Tracking:** OpenSky Network live ADS-B contacts + AERO-GUARD military UAV reconnaissance telemetry.
3. **High-Resolution Terrain & Elevation:** OpenTopography SRTM DEM and Copernicus 90m DEM ground elevation profiles.
4. **Satellite Remote Sensing:** ESA Copernicus Sentinel-2 L2A multispectral snow/ice (NDSI) analysis.
5. **Interactive Military Cartography:** MapTiler satellite, topographic terrain, and street raster tiles.
6. **Tactical AI Co-Pilot:** OpenAI GPT-4o-mini grounded in physical simulation state with military thermodynamic rules-engine fallback.
7. **DRDO Thermodynamic Engine:** 24-hour transient ODE solver, multi-layer envelope U-value synthesis, and Pareto frontier optimization.
8. **CAD Ingestion Pipeline:** Python `trimesh` geometry parser for STL/OBJ/STEP files with automated surface decomposition.

---

## 🏛️ Comprehensive Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    REACT 18 + VITE + TYPESCRIPT TACTICAL UI                     │
│  ─ Strategic Command Dashboard (3D WebGL Shelter Viewer + KPI Cards)            │
│  ─ MapTiler Geospatial Tactical Map (Satellite, Terrain, ADS-B, UAV, Hazards)   │
│  ─ Open-Meteo Geocoding Autocomplete Search Bar                                 │
│  ─ 11-Subsystem Live Health & Telemetry Status Modal (/api/status)              │
│  ─ Unified Multi-Domain Mission Assessment Auditor (/api/mission/analyze)       │
│  ─ Tactical AI Assistant Sliding Co-Pilot Drawer (/api/ai/chat)                 │
│  ─ 24h & 90-Day Thermal Analytics Dashboard (Recharts Diurnal Plots)           │
│  ─ Multi-Objective Pareto Envelope Optimizer & Blueprint Synthesis             │
│  ─ CAD Ingestion Studio (STL Upload with Surface Area Auto-Extraction)          │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Unified REST API Client Layer (/src/services)
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                        FASTAPI ASYNCHRONOUS BACKEND                             │
│                      (Port 8000 /api/* with Cache Layers)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│ EXTERNAL API INTEGRATIONS:                                                      │
│  ├─ Open-Meteo Live Weather & Forecast API (weather_integration.py)             │
│  ├─ Open-Meteo Geocoding API + Indian Military Base Registry (location_service) │
│  ├─ OpenTopography SRTM DEM + Copernicus DEM API (elevation_service.py)         │
│  ├─ OpenSky Network Live ADS-B Airspace Feed + UAV Telemetry (aircraft_service) │
│  ├─ ESA Copernicus Sentinel Hub Sentinel-2 MSI Service (satellite_service.py)   │
│  ├─ OpenAI GPT-4o-mini Grounded Military Assistant (ai_service.py)             │
│                                                                                 │
│ INTERNAL AI / ML & THERMODYNAMIC SERVICES:                                      │
│  ├─ 24-Hour Transient Heat Balance ODE Solver (engine.py)                       │
│  ├─ Unsupervised K-Means & GMM Weather Clustering (clustering.py)               │
│  ├─ Multi-Objective Genetic / Pareto Frontier Optimizer (optimizer.py)          │
│  ├─ 3D CAD Mesh Parser with Normal Vector Decomposition (cad_parser.py)         │
│  ├─ ISO 7730 PMV/PPD Thermal Comfort & Anomaly Diagnostics (engine_integration) │
│  ├─ High-Level Mission Orchestrator (mission_service.py)                        │
│  └─ 11-Subsystem Health & Security Monitor (status_service.py)                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### 🚀 One-Command Launch (Recommended)
From the project root:
```bash
npm run dev
```
- **Frontend Dashboard:** http://localhost:5173
- **FastAPI Backend:** http://localhost:8000
- **Interactive Swagger Docs:** http://localhost:8000/docs
- **Alternative ReDoc:** http://localhost:8000/redoc

### Starting Individually

#### 1. Backend Setup
```bash
cd backend
pip3 install -r requirements.txt
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Environment Variables Guide

All secret credentials **remain strictly on the backend** and are never exposed to the client.

### Backend (`backend/.env` or root `.env`)
```bash
# Server Port & Mode
PORT=8000
HOST=127.0.0.1
ENVIRONMENT=development

# 1. AI Assistant (OpenAI GPT-4o-mini)
# When omitted, system automatically falls back to DRDO Military Thermodynamic Rules Engine
OPENAI_API_KEY=sk-your-openai-api-key-here

# 2. OpenTopography High-Resolution DEM API
# When omitted, system automatically falls back to Open-Meteo Global 90m DEM
OPENTOPOGRAPHY_API_KEY=your_opentopography_key_here

# 3. Copernicus Sentinel Hub (ESA Satellite Imagery)
# When omitted, system runs in standard GIS mode with clear configuration instructions
SENTINELHUB_CLIENT_ID=your_sentinelhub_client_id_here
SENTINELHUB_CLIENT_SECRET=your_sentinelhub_client_secret_here

# 4. OpenSky Network Live Airspace API (Optional authentication for higher rate limits)
# Free anonymous requests are supported out of the box with backend TTL caching
OPENSKY_USERNAME=
OPENSKY_PASSWORD=

# 5. MapTiler Server-Side Key (Optional fallback)
MAPTILER_API_KEY=your_maptiler_key_here
```

### Frontend (`frontend/.env`)
```bash
# Backend API Base URL
VITE_API_URL=http://127.0.0.1:8000/api

# MapTiler Client Key (Public raster tiles; fallback to CARTO/Esri if empty)
VITE_MAPTILER_API_KEY=your_public_maptiler_key_here
```

---

## 📡 Complete REST API Endpoint Directory

Every endpoint validates incoming payloads with Pydantic, uses standard HTTP error codes, and provides caching and defensive fallbacks.

| Endpoint | Method | Purpose & Description | Query / Body Parameters |
|---|---|---|---|
| `/api/health` | `GET` | Rapid server health probe | None |
| `/api/status` | `GET` | Comprehensive 11-subsystem operational monitor | None |
| `/api/weather` | `GET` | Open-Meteo live weather, hourly, and daily metrics | `latitude`, `longitude`, `forecast_days` |
| `/api/weather/current` | `GET` | Current weather snapshot (temp, wind, humidity, WMO) | `latitude`, `longitude` |
| `/api/weather/forecast` | `GET` | 7-day daily forecast with solar irradiance & snow | `latitude`, `longitude`, `forecast_days` |
| `/api/location/search` | `GET` | Open-Meteo Geocoding + Indian defense base directory | `q` (query), `count` |
| `/api/elevation` | `GET` | Ground elevation (OpenTopography / Copernicus DEM) | `latitude`, `longitude` OR `points` (profile) |
| `/api/aircraft` | `GET` | OpenSky live ADS-B contacts + AERO-GUARD tactical UAV | `lamin`, `lomin`, `lamax`, `lomax` |
| `/api/satellite/search` | `GET` | Sentinel-2 L2A multispectral scene search | `latitude`, `longitude`, `start_date`, `end_date` |
| `/api/satellite/imagery` | `GET` | True-color / False-color infrared WMS tile stream | `bbox`, `layers`, `width`, `height` |
| `/api/satellite/statistics`| `GET` | NDSI snow cover index & surface albedo estimation | `latitude`, `longitude`, `radius_km` |
| `/api/cad/upload` | `POST` | STL/OBJ/STEP parser, bounding box, surface decomposition | Multipart `file` (max 50MB) |
| `/api/engine/predict` | `POST` | 24-hour transient ODE temperature prediction | Envelope sections, geometry, params, lat, elev |
| `/api/engine/health` | `POST` | Operational thermal envelope integrity assessment | Envelope sections, geometry, params, lat, elev |
| `/api/engine/anomaly` | `POST` | Thermal bridging, freezing risk & condensation detector | Envelope sections, geometry, params, lat, elev |
| `/api/engine/analyze` | `POST` | ISO 7730 PMV/PPD military thermal comfort analysis | Envelope sections, geometry, params, lat, elev |
| `/api/clustering` | `POST` | K-Means & GMM seasonal weather phase classifier | 90-day timeseries, `n_clusters` |
| `/api/optimize` | `POST` | Multi-objective Pareto frontier optimizer | Troops, target temp, duration, lat, elev |
| `/api/simulate` | `POST` | Full digital twin dynamic simulation pipeline | Full geometry, envelope layers, mission params |
| `/api/ai/chat` | `POST` | Tactical AI Co-Pilot chat grounded in physical state | `message`, `context` (weather, engine, cad) |
| `/api/mission/analyze` | `POST` | High-level unified mission assessment auditor | `latitude`, `longitude`, `location_name`, `troops` |

---

## 🗺️ Geospatial & MapTiler Integration

The interactive tactical map is built on Leaflet with MapTiler Cloud support:
- **Map Layers:** MapTiler Topographic Terrain, High-Resolution Satellite, Vector Streets, with CARTO Dark Matter and Esri World Imagery fallbacks.
- **Airspace Radar:** Live OpenSky aircraft contacts rendered with heading indicators, velocity, and ICAO callsigns.
- **Tactical UAV Orbit:** Live GPS position of the AERO-GUARD reconnaissance drone with FLIR EO/IR payload status.
- **Mission Flight Route:** Visual polyline linking base logistics depot to forward shelter outpost with waypoint markers.
- **Terrain Elevation Profile:** Multi-point DEM elevation sampler across the flight corridor.
- **Hazard Zones:** Visual circle overlays for katabatic wind corridors and sub-zero frostbite danger zones.

---

## 🤖 Tactical AI Assistant Capabilities

The AI assistant operates via `POST /api/ai/chat` and the UI sliding drawer:
- **State Grounding:** Ingests live telemetry (ambient temp, wind speed, elevation), CAD bounding volumes, ISO 7730 PMV comfort scores, and auxiliary diesel deficit.
- **Zero Hallucination Policy:** Does not fabricate sensor values; explicitly distinguishes live physical simulation data from AI recommendations.
- **Dual-Engine Operation:**
  - **Online Mode:** Uses OpenAI GPT-4o-mini when `OPENAI_API_KEY` is configured.
  - **Offline / Autonomous Mode:** Uses an internal deterministic DRDO military rules engine with zero external dependencies.

---

## 🛠️ Testing & Verification

Run the comprehensive automated test suite verifying all 20+ endpoints:
```bash
python3 backend/test_all_services.py
```
Expected output:
```
============================================================
AERO-GUARD / SIH26051 COMPREHENSIVE SERVICE VERIFICATION
============================================================
PASS: /api/health -> 200
PASS: /api/status -> 200
PASS: /api/weather -> 200
PASS: /api/weather/current -> 200
PASS: /api/weather/forecast -> 200
PASS: /api/location/search -> 200
PASS: /api/elevation -> 200
PASS: /api/elevation (multi-point profile) -> 200
PASS: /api/aircraft -> 200
PASS: /api/satellite/search -> 200
PASS: /api/satellite/statistics -> 200
PASS: /api/cad/upload -> 200
PASS: /api/engine/predict -> 200
PASS: /api/engine/health -> 200
PASS: /api/engine/anomaly -> 200
PASS: /api/engine/analyze -> 200
PASS: /api/clustering -> 200
PASS: /api/optimize -> 200
PASS: /api/simulate -> 200
PASS: /api/ai/chat -> 200
PASS: /api/mission/analyze -> 200
============================================================
ALL 21 INTEGRATION TESTS COMPLETED SUCCESSFULLY!
============================================================
```

---

## 🔧 Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| `Port 8000 already in use` | Stale uvicorn process running | Run `lsof -i :8000` and `kill -9 <PID>` or use `npm run dev` which handles cleanup. |
| `Port 5173 already in use` | Previous Vite process active | Vite configuration is locked to strict port 5173. Terminate old Vite process. |
| `Sentinel Hub unconfigured` | Missing ESA credentials | System operates gracefully with sample scenes. Add `SENTINELHUB_CLIENT_ID` to `.env` if satellite tiles are needed. |
| `OpenSky 429 Too Many Requests` | Anonymous rate limit hit | Backend uses a 15-second TTL cache to prevent throttling. Optionally add `OPENSKY_USERNAME` to `.env`. |
| `OpenAI fallback active` | `OPENAI_API_KEY` not set | System provides full tactical advice using local rules engine. Add key to `.env` to enable GPT-4o-mini. |

---

## 📄 License & Attribution
Developed for Smart India Hackathon (SIH) under DRDO Problem Statement ID: 26051.
- Open-Meteo Weather data under CC BY 4.0
- OpenSky Network data under CC BY 4.0
- Shuttle Radar Topography Mission (SRTM) via OpenTopography / NASA JPL
