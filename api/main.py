"""
AERO-SHIELD FastAPI Backend Application
DRDO Problem ID: 26051 - Area Specific Shelter Thermal Comfort Maintenance System
Integrated with Open-Meteo, OpenTopography, OpenSky Network, Copernicus Sentinel Hub, and OpenAI API.
"""

import uvicorn
import csv
import io
import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional

from engine import (
    MATERIALS_DB, GLAZING_DB, SimulationRequest, run_transient_simulation,
    generate_ladakh_diurnal_weather
)
from weather_service import DEFENSE_STATIONS, fetch_weather_and_cluster, generate_site_design_template
from clustering import cluster_seasonal_weather
from cad_parser import parse_cad_mesh_file
from optimizer import run_multi_objective_optimization

# Integrated Modular Services
from services.weather_integration import get_live_weather
from services.location_service import search_locations
from services.elevation_service import get_elevation_for_point, get_elevation_profile
from services.satellite_service import search_satellite_scenes, get_satellite_imagery_layer, get_satellite_statistics
from services.aircraft_service import get_aircraft_in_bounding_box, get_aircraft_near_point
from services.ai_service import handle_ai_chat
from services.status_service import get_system_status
from services.engine_integration import (
    predict_engine_trajectory, assess_engine_health, detect_engine_anomalies, analyze_thermal_comfort
)
from services.mission_service import analyze_unified_mission, MissionAnalyzeRequest
from services.shelter_service import (
    deploy_shelter, list_shelters, get_shelter, update_shelter,
    execute_command, get_shelter_fuel, get_shelter_power,
    get_shelter_telemetry, terrain_profile,
    ShelterDeployRequest, ShelterUpdateRequest, ShelterCommandRequest,
)

# Initialize FastAPI App
app = FastAPI(
    title="AERO-SHIELD API (DRDO ID: 26051)",
    description="Autonomous Environment, Aeronautical & Regional Optimization for High-Altitude Military Shelters",
    version="1.0.0"
)

# Enable CORS for Frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------
class WeatherRequest(BaseModel):
    latitude: float = 34.15
    longitude: float = 77.58
    elevation_m: Optional[float] = 3500.0
    algorithm: str = "kmeans"  # kmeans or gmm

class OptimizeRequest(BaseModel):
    troops: int = 8
    target_temp_c: float = 19.0
    mission_duration_days: int = 90
    latitude: float = 34.15
    elevation_m: float = 3500.0
    hourly_weather: Optional[List[Dict[str, float]]] = None

class AIChatRequest(BaseModel):
    message: str = Field(..., description="Tactical question or engineering analysis request")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Current telemetry and simulation context")

class ClusteringRequest(BaseModel):
    data: Optional[List[Dict[str, float]]] = Field(None, description="Optional raw timeseries array")
    n_clusters: int = Field(3, description="Target cluster count")
    algorithm: str = Field("kmeans", description="Clustering algorithm: kmeans or gmm")


# ---------------------------------------------------------------------------
# 1. Health & Subsystem Status (Section 13)
# ---------------------------------------------------------------------------
@app.get("/")
@app.get("/api")
def root_index():
    return {
        "status": "online",
        "service": "AERO-SHIELD Thermal Simulation & Multi-Service Engine (DRDO ID: 26051)",
        "version": "1.0.0"
    }

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "AERO-SHIELD Thermal Simulation & Optimization Engine",
        "drdo_problem_id": "26051",
        "version": "1.0.0"
    }

@app.get("/status")
@app.get("/api/status")
def system_status():
    """Returns comprehensive health and configuration state for all 11 subsystems."""
    return get_system_status()


# ---------------------------------------------------------------------------
# 2. Live Weather (Open-Meteo Integration - Section 1)
# ---------------------------------------------------------------------------
@app.get("/weather")
@app.get("/api/weather")
def get_live_weather_endpoint(
    latitude: float = Query(34.15, description="Latitude in decimal degrees"),
    longitude: float = Query(77.58, description="Longitude in decimal degrees"),
    forecast_days: int = Query(7, ge=1, le=14, description="Forecast range in days")
):
    """
    GET /api/weather
    Fetches real-time, hourly diurnal, and 7-day forecast from Open-Meteo.
    Normalized into Aero-Guard standard telemetry format.
    """
    try:
        return get_live_weather(latitude, longitude, forecast_days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch live weather: {str(e)}")

@app.get("/weather/current")
@app.get("/api/weather/current")
def get_current_weather_endpoint(
    latitude: float = Query(34.15, description="Latitude"),
    longitude: float = Query(77.58, description="Longitude")
):
    """GET /api/weather/current: Instant current weather snapshot."""
    try:
        full_w = get_live_weather(latitude, longitude, forecast_days=1)
        return {
            "status": "online",
            "location": full_w.get("location"),
            "current": full_w.get("current")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Current weather failed: {str(e)}")

@app.get("/weather/forecast")
@app.get("/api/weather/forecast")
def get_forecast_weather_endpoint(
    latitude: float = Query(34.15, description="Latitude"),
    longitude: float = Query(77.58, description="Longitude"),
    days: int = Query(7, ge=1, le=14, description="Forecast days")
):
    """GET /api/weather/forecast: 7-day meteorological forecast."""
    try:
        full_w = get_live_weather(latitude, longitude, forecast_days=days)
        return {
            "status": "online",
            "location": full_w.get("location"),
            "daily": full_w.get("daily"),
            "hourly": full_w.get("hourly")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast weather failed: {str(e)}")

@app.post("/weather")
@app.post("/api/weather")
def post_weather_data(req: WeatherRequest):
    """
    POST /api/weather (Preserved SIH-26051 Feature)
    Ingests 90-day time-series weather dataset for the given coordinates
    and runs unsupervised machine learning clustering (K-Means / GMM) into 3 thermal phases.
    """
    try:
        return fetch_weather_and_cluster(
            lat=req.latitude,
            lng=req.longitude,
            elevation_m=req.elevation_m,
            clustering_algo=req.algorithm
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather ingestion failed: {str(e)}")


# ---------------------------------------------------------------------------
# 3. Location Search (Open-Meteo Geocoding - Section 2)
# ---------------------------------------------------------------------------
@app.get("/location/search")
@app.get("/api/location/search")
def location_search_endpoint(
    q: str = Query(..., min_length=2, description="City, airport, or military station name"),
    count: int = Query(10, ge=1, le=20, description="Max results")
):
    """
    GET /api/location/search?q=<query>
    Searches worldwide places and airports using Open-Meteo Geocoding + strategic military bases.
    """
    try:
        return search_locations(q, count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Location search failed: {str(e)}")


# ---------------------------------------------------------------------------
# 4. Elevation / Terrain (OpenTopography Integration - Section 5)
# ---------------------------------------------------------------------------
@app.get("/elevation")
@app.get("/api/elevation")
def elevation_endpoint(
    latitude: float = Query(34.15, description="Latitude"),
    longitude: float = Query(77.58, description="Longitude"),
    locations: Optional[str] = Query(None, description="Optional multi-point coordinates 'lat,lng|lat,lng'")
):
    """
    GET /api/elevation?latitude=...&longitude=...
    Retrieves ground elevation via OpenTopography SRTM DEM (or Open-Meteo DEM fallback).
    Supports multi-point profile via 'locations' parameter.
    """
    try:
        if locations:
            pts = []
            for pair in locations.split("|"):
                if "," in pair:
                    parts = pair.strip().split(",")
                    pts.append({"lat": float(parts[0]), "lng": float(parts[1])})
            return get_elevation_profile(pts)
        else:
            return get_elevation_for_point(latitude, longitude)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Elevation lookup failed: {str(e)}")


# ---------------------------------------------------------------------------
# 5. Satellite Earth Observation (Copernicus Sentinel Hub - Section 4)
# ---------------------------------------------------------------------------
@app.get("/satellite/search")
@app.get("/api/satellite/search")
def satellite_search_endpoint(
    lat: float = Query(34.15, description="Latitude"),
    lng: float = Query(77.58, description="Longitude"),
    start_date: str = Query("2026-09-01", description="Start date YYYY-MM-DD"),
    end_date: str = Query("2026-09-29", description="End date YYYY-MM-DD"),
    cloud_cover: float = Query(30.0, ge=0.0, le=100.0, description="Max cloud coverage percentage")
):
    """
    GET /api/satellite/search
    Searches Copernicus Sentinel-2 L2A multispectral scenes for the mission area.
    """
    try:
        return search_satellite_scenes(lat, lng, start_date, end_date, cloud_cover)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Satellite search failed: {str(e)}")

@app.get("/satellite/imagery")
@app.get("/api/satellite/imagery")
def satellite_imagery_endpoint(
    bbox: Optional[str] = Query(None, description="Bounding box minx,miny,maxx,maxy"),
    date: Optional[str] = Query(None, description="Acquisition date")
):
    """GET /api/satellite/imagery: Returns WMS tile layer configuration."""
    return get_satellite_imagery_layer(bbox, date)

@app.get("/satellite/statistics")
@app.get("/api/satellite/statistics")
def satellite_statistics_endpoint(
    lat: float = Query(34.15, description="Latitude"),
    lng: float = Query(77.58, description="Longitude")
):
    """GET /api/satellite/statistics: Environmental NDSI snow index & surface albedo."""
    return get_satellite_statistics(lat, lng)


# ---------------------------------------------------------------------------
# 6. Aircraft Traffic & UAV Telemetry (OpenSky Network - Section 6)
# ---------------------------------------------------------------------------
@app.get("/aircraft")
@app.get("/api/aircraft")
def aircraft_traffic_endpoint(
    lamin: Optional[float] = Query(None, description="Min Latitude"),
    lomin: Optional[float] = Query(None, description="Min Longitude"),
    lamax: Optional[float] = Query(None, description="Max Latitude"),
    lomax: Optional[float] = Query(None, description="Max Longitude"),
    latitude: Optional[float] = Query(None, description="Center Latitude for radius search"),
    longitude: Optional[float] = Query(None, description="Center Longitude for radius search"),
    radius_km: float = Query(80.0, ge=10.0, le=300.0, description="Radius in km")
):
    """
    GET /api/aircraft
    Fetches real aircraft positions from OpenSky Network and streams tactical UAV telemetry.
    """
    try:
        if lamin is not None and lomin is not None and lamax is not None and lomax is not None:
            return get_aircraft_in_bounding_box(lamin, lomin, lamax, lomax)
        else:
            c_lat = latitude if latitude is not None else 34.15
            c_lng = longitude if longitude is not None else 77.58
            return get_aircraft_near_point(c_lat, c_lng, radius_km)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Aircraft traffic query failed: {str(e)}")


# ---------------------------------------------------------------------------
# 7. Tactical AI Assistant (OpenAI Integration - Section 7)
# ---------------------------------------------------------------------------
@app.post("/ai/chat")
@app.post("/api/ai/chat")
def ai_chat_endpoint(req: AIChatRequest):
    """
    POST /api/ai/chat
    Provides engineering explanations, anomaly diagnoses, and mission advice grounded in simulation data.
    """
    try:
        return handle_ai_chat(req.message, req.context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Assistant error: {str(e)}")


# ---------------------------------------------------------------------------
# 8. Internal AI/ML Engine Endpoints (Section 8)
# ---------------------------------------------------------------------------
@app.post("/engine/predict")
@app.post("/api/engine/predict")
def engine_predict_endpoint(req: SimulationRequest):
    """POST /api/engine/predict: Predicts inside temperature trajectory using 24h transient ODE solver."""
    try:
        return predict_engine_trajectory(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine prediction failed: {str(e)}")

@app.post("/engine/health")
@app.post("/api/engine/health")
def engine_health_endpoint(req: SimulationRequest):
    """POST /api/engine/health: Evaluates envelope insulation integrity, condensation dew point, and freeze vulnerability."""
    try:
        return assess_engine_health(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine health evaluation failed: {str(e)}")

@app.post("/engine/anomaly")
@app.post("/api/engine/anomaly")
def engine_anomaly_endpoint(req: SimulationRequest):
    """POST /api/engine/anomaly: Detects negative heat balance and extreme infiltration spikes."""
    try:
        return detect_engine_anomalies(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")

@app.post("/engine/analyze")
@app.post("/api/engine/analyze")
def engine_analyze_endpoint(req: SimulationRequest):
    """POST /api/engine/analyze: ISO 7730 PMV/PPD comfort index and granular loss channels."""
    try:
        return analyze_thermal_comfort(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Thermal analysis failed: {str(e)}")

@app.post("/clustering")
@app.post("/api/clustering")
def clustering_endpoint(req: ClusteringRequest):
    """POST /api/clustering: Runs K-Means or GMM unsupervised seasonal clustering."""
    try:
        data = req.data or generate_ladakh_diurnal_weather()
        return cluster_seasonal_weather(data, n_clusters=req.n_clusters, algorithm=req.algorithm)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


# ---------------------------------------------------------------------------
# 9. 3D CAD Parser (Section 9)
# ---------------------------------------------------------------------------
@app.post("/cad/upload")
@app.post("/api/cad/upload")
@app.post("/parse-cad")
@app.post("/api/parse-cad")
async def upload_cad_file(file: UploadFile = File(...)):
    """
    POST /api/cad/upload & POST /api/parse-cad
    Accepts 3D CAD mesh files (.STL, .OBJ, .PLY, .GLTF, etc., max 25MB), extracts volume,
    surface area, and categorizes face normal vectors into Roof, Wall, Floor, and directional azimuths.
    """
    filename = file.filename or "model.stl"
    allowed_exts = [".stl", ".obj", ".ply", ".gltf", ".glb", ".3mf", ".dae", ".off"]
    ext = os.path.splitext(filename)[1].lower()

    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported CAD file type '{ext}'. Supported formats: {', '.join(allowed_exts)}"
        )

    try:
        contents = await file.read()
        if len(contents) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds maximum 25MB threshold.")

        parsed_data = parse_cad_mesh_file(contents, filename)
        return parsed_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CAD file parsing error: {str(e)}")


# ---------------------------------------------------------------------------
# 10. Multi-Objective Optimization (Section 10)
# ---------------------------------------------------------------------------
@app.post("/optimize")
@app.post("/api/optimize")
def optimize_shelter(req: OptimizeRequest):
    """
    POST /api/optimize
    Runs multi-objective AI optimization evaluating candidate archetypes and insulation stacks
    to deliver Pareto frontier trade-offs.
    """
    try:
        opt_results = run_multi_objective_optimization(
            troops=req.troops,
            target_temp_c=req.target_temp_c,
            mission_duration_days=req.mission_duration_days,
            latitude=req.latitude,
            elevation_m=req.elevation_m,
            hourly_weather=req.hourly_weather
        )
        return opt_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


# ---------------------------------------------------------------------------
# 11. Digital Twin Simulation (Section 11)
# ---------------------------------------------------------------------------
@app.post("/simulate")
@app.post("/api/simulate")
def simulate_shelter(req: SimulationRequest):
    """
    POST /api/simulate
    Executes the 24-hour dynamic transient thermal simulation, calculating inside temperatures,
    solar gains, conduction/infiltration losses, and 90-day fuel logistics.
    """
    try:
        results = run_transient_simulation(req)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Thermal simulation failed: {str(e)}")


# ---------------------------------------------------------------------------
# 12. Unified Mission Analysis (Section 12)
# ---------------------------------------------------------------------------
@app.post("/mission/analyze")
@app.post("/api/mission/analyze")
def mission_analyze_endpoint(req: MissionAnalyzeRequest):
    """
    POST /api/mission/analyze
    Orchestrates end-to-end mission assessment: Location -> Weather -> Elevation -> Airspace ->
    Thermodynamic Simulation -> Anomaly Diagnostics -> AI Executive Mission Brief.
    """
    try:
        return analyze_unified_mission(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mission analysis failed: {str(e)}")


# ---------------------------------------------------------------------------
# 13. Curated Presets & CSV Import (Preserved Legacy Endpoints)
# ---------------------------------------------------------------------------
@app.get("/materials")
@app.get("/api/materials")
def get_materials_and_glazing():
    """Returns database of envelope insulation materials, sheathing, and glazing specifications."""
    return {
        "materials": MATERIALS_DB,
        "glazing": GLAZING_DB
    }

@app.get("/stations")
@app.get("/api/stations")
def get_defense_stations():
    """Returns curated high-altitude strategic defense station presets."""
    return {
        "stations": DEFENSE_STATIONS
    }

@app.get("/design-template")
@app.get("/api/design-template")
def get_design_template(
    latitude: float = Query(34.15, description="Latitude in decimal degrees"),
    elevation_m: float = Query(3500.0, description="Elevation in meters ASL"),
    troops: int = Query(8, description="Troop capacity")
):
    """
    Returns dynamically computed certified DRDO architectural, structural and material design template
    tailored to the site's live elevation, solar irradiance, and troop requirements.
    """
    try:
        return generate_site_design_template(latitude, elevation_m, troops)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate design template: {str(e)}")

@app.post("/import-csv-weather")
@app.post("/api/import-csv-weather")
async def import_csv_weather(file: UploadFile = File(...)):
    """Accepts a CSV file of measured field weather data and parses it into 24-hour format."""
    try:
        content = await file.read()
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        raw_rows = list(reader)
        if not raw_rows:
            raise HTTPException(status_code=400, detail="CSV file is empty.")

        def find_col(row: dict, *candidates: str) -> str | None:
            for k in row.keys():
                if k.strip().lower() in [c.lower() for c in candidates]:
                    return k
            return None

        sample = raw_rows[0]
        col_hour  = find_col(sample, "hour", "hr", "time", "hour_utc")
        col_temp  = find_col(sample, "ambient_temp", "temp", "temperature", "t_amb", "t_ambient", "temp_c")
        col_solar = find_col(sample, "solar_ghi", "ghi", "irradiance", "solar", "radiation", "solar_radiation")
        col_wind  = find_col(sample, "wind_speed", "wind", "windspeed", "wind_mps", "wind_ms")
        col_rh    = find_col(sample, "relative_humidity", "rh", "humidity")

        missing = [n for n, c in [("hour", col_hour), ("ambient_temp", col_temp), ("solar_ghi", col_solar), ("wind_speed", col_wind)] if c is None]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {missing}. Found: {list(sample.keys())}."
            )

        hourly_weather = []
        for i, row in enumerate(raw_rows[:24]):
            try:
                hourly_weather.append({
                    "hour": int(float(row[col_hour])),
                    "ambient_temp": float(row[col_temp]),
                    "solar_ghi": max(0.0, float(row[col_solar])),
                    "wind_speed": max(0.0, float(row[col_wind])),
                    "relative_humidity": float(row[col_rh]) if col_rh and row.get(col_rh) else 30.0
                })
            except (ValueError, KeyError) as e:
                raise HTTPException(status_code=400, detail=f"Row {i+2} parse error: {e}")

        if len(hourly_weather) < 24:
            raise HTTPException(status_code=400, detail=f"Need exactly 24 hourly rows (hours 0–23). Got {len(hourly_weather)} rows.")

        temps = [r["ambient_temp"] for r in hourly_weather]
        ghis  = [r["solar_ghi"] for r in hourly_weather]
        winds = [r["wind_speed"] for r in hourly_weather]

        return {
            "status": "ok",
            "rows_parsed": len(hourly_weather),
            "hourly_weather": hourly_weather,
            "summary": {
                "min_temp_c": round(min(temps), 1),
                "max_temp_c": round(max(temps), 1),
                "avg_temp_c": round(sum(temps) / len(temps), 1),
                "peak_solar_w_m2": round(max(ghis), 1),
                "daily_ghi_kwh_m2": round(sum(ghis) / 1000, 2),
                "avg_wind_mps": round(sum(winds) / len(winds), 1),
                "max_wind_mps": round(max(winds), 1),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV weather parse failed: {str(e)}")

@app.post("/import-csv-materials")
@app.post("/api/import-csv-materials")
async def import_csv_materials(file: UploadFile = File(...)):
    """Accepts a CSV file of custom laboratory-measured material properties."""
    try:
        content = await file.read()
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        raw_rows = list(reader)
        if not raw_rows:
            raise HTTPException(status_code=400, detail="CSV file is empty.")

        def find_col(row: dict, *candidates: str) -> str | None:
            for k in row.keys():
                if k.strip().lower() in [c.lower() for c in candidates]:
                    return k
            return None

        sample = raw_rows[0]
        col_name    = find_col(sample, "name", "material", "material_name", "description")
        col_k       = find_col(sample, "k", "thermal_conductivity", "conductivity", "k_w_mk")
        col_density = find_col(sample, "density", "rho", "density_kg_m3")
        col_cp      = find_col(sample, "cp", "specific_heat", "heat_capacity", "cp_j_kgk")
        col_thick   = find_col(sample, "thickness_mm", "thickness", "t_mm")
        col_cost    = find_col(sample, "cost_per_m2_100mm", "cost", "cost_inr")
        col_cat     = find_col(sample, "category", "type", "material_type")

        missing = [n for n, c in [("name", col_name), ("k", col_k), ("density", col_density)] if c is None]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required columns: {missing}.")

        materials = {}
        for i, row in enumerate(raw_rows):
            try:
                name = str(row[col_name]).strip()
                mat_id = name.lower().replace(" ", "_").replace("-", "_")[:32]
                k_val = float(row[col_k])
                if k_val <= 0:
                    raise ValueError("k must be > 0")

                materials[mat_id] = {
                    "name": name,
                    "k": round(k_val, 4),
                    "density": round(float(row[col_density]), 2),
                    "cp": round(float(row[col_cp]), 1) if col_cp and row.get(col_cp) else 1000.0,
                    "cost_per_m2_100mm": round(float(row[col_cost]), 0) if col_cost and row.get(col_cost) else 2000.0,
                    "default_thickness_mm": int(float(row[col_thick])) if col_thick and row.get(col_thick) else 80,
                    "category": str(row[col_cat]).strip().lower() if col_cat and row.get(col_cat) else "custom",
                    "description": f"Custom imported material. k={k_val} W/mK, ρ={row[col_density]} kg/m³",
                    "embodied_co2_kg_m3": 0.0
                }
            except (ValueError, KeyError) as e:
                raise HTTPException(status_code=400, detail=f"Row {i+2} parse error: {e}")

        return {
            "status": "ok",
            "materials_imported": len(materials),
            "materials": materials
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV material parse failed: {str(e)}")


# ---------------------------------------------------------------------------
# 12. Shelter Digital Twin (Location-Aware Deployment Telemetry)
# ---------------------------------------------------------------------------
@app.get("/shelters")
@app.get("/api/shelters")
def list_shelters_endpoint():
    """
    GET /api/shelters
    Lists every deployed shelter digital twin with its current fuel, generator,
    power, battery and environmental state.
    """
    try:
        return list_shelters()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shelter registry failed: {str(e)}")


@app.post("/shelters/deploy")
@app.post("/api/shelters/deploy")
def deploy_shelter_endpoint(req: ShelterDeployRequest):
    """
    POST /api/shelters/deploy
    Anchors a shelter digital twin to real coordinates. If a twin already exists
    within 100 m it is relocated rather than duplicated.
    """
    try:
        return deploy_shelter(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid deployment: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shelter deployment failed: {str(e)}")


@app.get("/shelters/{shelter_id}")
@app.get("/api/shelters/{shelter_id}")
def get_shelter_endpoint(shelter_id: str):
    """
    GET /api/shelters/{id}
    Full digital twin state for a single deployed shelter.
    """
    result = get_shelter(shelter_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Shelter '{shelter_id}' not found.")
    return result


@app.patch("/shelters/{shelter_id}")
@app.patch("/api/shelters/{shelter_id}")
def update_shelter_endpoint(shelter_id: str, req: ShelterUpdateRequest):
    """
    PATCH /api/shelters/{id}
    Updates mutable twin attributes: name, heading, position, elevation,
    occupancy and grid connection.
    """
    result = update_shelter(shelter_id, req)
    if not result:
        raise HTTPException(status_code=404, detail=f"Shelter '{shelter_id}' not found.")
    return result


@app.post("/shelters/{shelter_id}/command")
@app.post("/api/shelters/{shelter_id}/command")
def shelter_command_endpoint(shelter_id: str, req: ShelterCommandRequest):
    """
    POST /api/shelters/{id}/command
    Interactive subsystem control: start_generator, stop_generator, refuel,
    toggle_grid. Impossible states (e.g. starting on an empty tank) are
    rejected and reported in the `command` block.
    """
    try:
        return execute_command(shelter_id, req)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Shelter '{shelter_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shelter command failed: {str(e)}")


@app.get("/shelters/{shelter_id}/telemetry")
@app.get("/api/shelters/{shelter_id}/telemetry")
def shelter_telemetry_endpoint(shelter_id: str):
    """
    GET /api/shelters/{id}/telemetry
    Environment + systems telemetry. Environmental fields come from the live
    Open-Meteo integration and are flagged with `is_simulated` when a labelled
    fallback was used.
    """
    result = get_shelter_telemetry(shelter_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Shelter '{shelter_id}' not found.")
    return result


@app.get("/shelters/{shelter_id}/fuel")
@app.get("/api/shelters/{shelter_id}/fuel")
def shelter_fuel_endpoint(shelter_id: str):
    """
    GET /api/shelters/{id}/fuel
    Fuel level, status band, live consumption rate and remaining runtime.
    """
    result = get_shelter_fuel(shelter_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Shelter '{shelter_id}' not found.")
    return result


@app.get("/shelters/{shelter_id}/power")
@app.get("/api/shelters/{shelter_id}/power")
def shelter_power_endpoint(shelter_id: str):
    """
    GET /api/shelters/{id}/power
    Active power source, electrical load, battery bank state and solar input.
    """
    result = get_shelter_power(shelter_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Shelter '{shelter_id}' not found.")
    return result


@app.get("/shelter-terrain")
@app.get("/api/shelter-terrain")
def shelter_terrain_endpoint(
    latitude: float = Query(34.15, description="Anchor latitude"),
    longitude: float = Query(77.58, description="Anchor longitude"),
    span_m: float = Query(300.0, ge=50.0, le=3000.0, description="Terrain patch width in metres"),
    samples: int = Query(5, ge=2, le=9, description="Grid resolution per axis")
):
    """
    GET /api/shelter-terrain?latitude=...&longitude=...
    Samples real DEM elevations on a grid around the anchor so the 3D shelter
    is seated on actual ground. Returns a WGS84 local tangent plane grid in metres.
    """
    try:
        return terrain_profile(latitude, longitude, span_m, samples)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Terrain sampling failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
