# AERO-SHIELD (Aero_guard_SIH-26051)

> **Software-Based Model Development for Design of Area-Specific Shelter for Thermal Comfort Maintenance**
>
> Smart India Hackathon (SIH) — DRDO Problem ID: 26051

[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)](https://vercel.com)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React+Vite-61DAFB?logo=react)](https://react.dev)

---

## 📌 Problem Statement Overview

High-altitude cold regions like Ladakh (3,000–5,400 m ASL) experience severe diurnal swings and extreme freezing temperatures down to -35°C. Traditional uninsulated shelters rely on heavy fossil-fuel logistics (Arctic Diesel) which are vulnerable and unsustainable.

**AERO-SHIELD** is an intelligent, software-based autonomous environment and regional optimization suite designed specifically to:
1. **Predict shelter inside temperature** based on user-defined parameters, materials, and real-time high-altitude weather data.
2. **Predict thermal energy generated from solar radiation** (direct window aperture gains + 6-hour lagged Trombe wall thermal storage release).
3. **Compute granular heat flow details** (conduction through walls, roof, floor, glazing + infiltration losses) across 24-hour diurnal cycles and extended 90-day missions.
4. **Synthesize and recommend optimal shelter archetypes** and multi-layer insulation envelopes to maximize thermal comfort while minimizing fuel consumption.

---

## 🏛️ System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Interactive Frontend (React 18 + Vite + TypeScript)         │
│  ─ 3D Real-time Shelter Visualizer (Three.js WebGL)          │
│  ─ Geospatial Defence Station Map (Leaflet)                  │
│  ─ Data Feeder (CSV Field Weather & Material Ingestion)      │
│  ─ Mission & Multi-Layer Envelope Configurator               │
│  ─ 24h & 90-Day Thermal Analytics Dashboard (Recharts)       │
│  ─ Multi-Objective Pareto AI Optimizer                       │
│  ─ Recommended Shelter Blueprints (CAD & ISO 7730 Metrics)   │
│  ─ DRDO Mission Dossier Exporter                             │
└──────────────────────────────┬───────────────────────────────┘
                               │ RESTful API JSON
┌──────────────────────────────▼───────────────────────────────┐
│  Thermodynamic Simulation Engine (Python / FastAPI)          │
│  ─ 24-Hour Transient Heat Balance Solver (engine.py)         │
│  ─ Live ERA5 Weather Ingestion (weather_service.py)          │
│  ─ Unsupervised Seasonal Weather Clustering (clustering.py)  │
│  ─ Genetic / Pareto Frontier Optimization (optimizer.py)     │
│  ─ CSV Ingestion & Validation Parser (main.py)               │
│  ─ 3D CAD Mesh Parser & Surface Normals (cad_parser.py)      │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧪 DRDO Mandatory Tasks Addressed

| Task # | DRDO Requirement | Implementation Detail |
|---|---|---|
| **Task 1** | Prediction of shelter inside temperature based on user defined inputs | 24-hour transient ODE solver: `C_total · dT/dt = Q_gains - UA · (T_in - T_amb)` calculating unheated equilibrium temperature at every hour. |
| **Task 2** | Prediction of thermal energy generated from solar radiation | Window fenestration solar gain (`GHI × Area × SHGC × Orientation`) + 6-hour thermal mass absorption and night release. |
| **Task 3** | Heat flow details as per temperature difference for defined time period | 5 discrete thermal loss channels: Roof, Walls (exposed & bermed), Floor (ground contact), Glazing, and Infiltration air changes. |

---

## ⚡ Quick Start (Local Development)

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

---

## 🚀 Vercel Deployment

This project is configured for single-command full-stack deployment on Vercel:
- The React frontend is built as optimized static assets (`frontend/dist/`).
- The Python FastAPI backend runs serverlessly at `/api/*` via `api/index.py`.

```bash
vercel --prod
```

---

## 📂 Pre-Loaded High-Altitude Defense Stations

- **Leh Garrison**: 3,524 m ASL (Cold Arid, Extreme Diurnal Swing)
- **Siachen Base Camp**: 3,651 m ASL (Sub-Zero Glacial Arctic)
- **Dras Sector**: 3,280 m ASL (2nd Coldest Inhabited Place on Earth)
- **Pangong Tso Post**: 4,248 m ASL (High Gale Winds & Intense UV)
- **Nyoma ALG**: 4,179 m ASL (Extreme Alpine Plateau)
- **Tawang Outpost**: 2,669 m ASL (High-Moisture Alpine Ridge)

---

## 📄 License

MIT License — Smart India Hackathon (DRDO ID: 26051).
