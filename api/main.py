"""
AERO-SHIELD FastAPI Backend Application
DRDO Problem ID: 26051 - Area Specific Shelter Thermal Comfort Maintenance System
"""

import uvicorn
import csv
import io
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

# Initialize FastAPI App
app = FastAPI(
    title="AERO-SHIELD API (DRDO ID: 26051)",
    description="Autonomous Environment & Regional Optimization for High-Altitude Military Shelters",
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


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "AERO-SHIELD Thermal Simulation & Optimization Engine",
        "drdo_problem_id": "26051",
        "version": "1.0.0"
    }


@app.get("/api/materials")
def get_materials_and_glazing():
    """Returns database of envelope insulation materials, sheathing, and glazing specifications."""
    return {
        "materials": MATERIALS_DB,
        "glazing": GLAZING_DB
    }


@app.get("/api/stations")
def get_defense_stations():
    """Returns curated high-altitude strategic defense station presets."""
    return {
        "stations": DEFENSE_STATIONS
    }


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
        template = generate_site_design_template(latitude, elevation_m, troops)
        return template
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate design template: {str(e)}")


@app.post("/api/weather")
def get_weather_data(req: WeatherRequest):
    """
    Ingests 90-day time-series weather dataset for the given coordinates
    and runs unsupervised machine learning clustering (K-Means / GMM) into 3 thermal phases.
    """
    try:
        data = fetch_weather_and_cluster(
            lat=req.latitude,
            lng=req.longitude,
            elevation_m=req.elevation_m,
            clustering_algo=req.algorithm
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather ingestion failed: {str(e)}")


@app.post("/api/simulate")
def simulate_shelter(req: SimulationRequest):
    """
    Executes the 24-hour dynamic transient thermal simulation, calculating inside temperatures,
    solar gains, conduction/infiltration losses, and 90-day fuel logistics.
    """
    try:
        results = run_transient_simulation(req)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Thermal simulation failed: {str(e)}")


@app.post("/api/optimize")
def optimize_shelter(req: OptimizeRequest):
    """
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


@app.post("/api/parse-cad")
async def parse_cad_file(file: UploadFile = File(...)):
    """
    Accepts 3D CAD mesh files (.STL, .OBJ, .PLY, etc.), extracts volume, surface area,
    and categorizes face normal vectors into Roof, Wall, Floor, and directional azimuths.
    """
    try:
        contents = await file.read()
        parsed_data = parse_cad_mesh_file(contents, file.filename)
        return parsed_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CAD file parsing error: {str(e)}")



@app.post("/api/import-csv-weather")
async def import_csv_weather(file: UploadFile = File(...)):
    """
    Accepts a CSV file of measured field weather data and parses it into the 24-hour
    hourly format expected by the transient simulation engine.

    Expected CSV columns (case-insensitive):
      hour | ambient_temp | solar_ghi | wind_speed | [relative_humidity]

    Returns parsed hourly_weather array ready to be fed directly into POST /api/simulate.
    """
    try:
        content = await file.read()
        text = content.decode("utf-8-sig")  # handle BOM from Excel exports
        reader = csv.DictReader(io.StringIO(text))

        # Normalize headers: lowercase + strip whitespace
        raw_rows = list(reader)
        if not raw_rows:
            raise HTTPException(status_code=400, detail="CSV file is empty.")

        # Map flexible header names to canonical names
        def find_col(row: dict, *candidates: str) -> str | None:
            for k in row.keys():
                if k.strip().lower() in [c.lower() for c in candidates]:
                    return k
            return None

        sample = raw_rows[0]
        col_hour     = find_col(sample, "hour", "hr", "time", "hour_utc")
        col_temp     = find_col(sample, "ambient_temp", "temp", "temperature", "t_amb", "t_ambient", "temp_c")
        col_solar    = find_col(sample, "solar_ghi", "ghi", "irradiance", "solar", "radiation", "solar_radiation")
        col_wind     = find_col(sample, "wind_speed", "wind", "windspeed", "wind_mps", "wind_ms")
        col_rh       = find_col(sample, "relative_humidity", "rh", "humidity")

        missing = [n for n, c in [("hour", col_hour), ("ambient_temp", col_temp), ("solar_ghi", col_solar), ("wind_speed", col_wind)] if c is None]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {missing}. "
                       f"Found columns: {list(sample.keys())}. "
                       f"Required: hour, ambient_temp, solar_ghi, wind_speed"
            )

        hourly_weather = []
        for i, row in enumerate(raw_rows[:24]):  # max 24 hourly rows
            try:
                parsed = {
                    "hour": int(float(row[col_hour])),
                    "ambient_temp": float(row[col_temp]),
                    "solar_ghi":    max(0.0, float(row[col_solar])),
                    "wind_speed":   max(0.0, float(row[col_wind])),
                    "relative_humidity": float(row[col_rh]) if col_rh and row.get(col_rh) else 30.0
                }
                hourly_weather.append(parsed)
            except (ValueError, KeyError) as e:
                raise HTTPException(status_code=400, detail=f"Row {i+2} parse error: {e}. Row data: {dict(row)}")

        if len(hourly_weather) < 24:
            raise HTTPException(
                status_code=400,
                detail=f"Need exactly 24 hourly rows (hours 0–23). Got {len(hourly_weather)} rows."
            )

        # Compute quick summary stats for frontend display
        temps = [r["ambient_temp"] for r in hourly_weather]
        ghis  = [r["solar_ghi"] for r in hourly_weather]
        winds = [r["wind_speed"] for r in hourly_weather]

        return {
            "status": "ok",
            "rows_parsed": len(hourly_weather),
            "hourly_weather": hourly_weather,
            "summary": {
                "min_temp_c":       round(min(temps), 1),
                "max_temp_c":       round(max(temps), 1),
                "avg_temp_c":       round(sum(temps) / len(temps), 1),
                "peak_solar_w_m2":  round(max(ghis), 1),
                "daily_ghi_kwh_m2": round(sum(ghis) / 1000, 2),
                "avg_wind_mps":     round(sum(winds) / len(winds), 1),
                "max_wind_mps":     round(max(winds), 1),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV weather parse failed: {str(e)}")


@app.post("/api/import-csv-materials")
async def import_csv_materials(file: UploadFile = File(...)):
    """
    Accepts a CSV file of custom laboratory-measured material properties and adds them
    to a session material palette for immediate use in envelope stack simulations.

    Expected CSV columns (case-insensitive):
      name | k | density | cp | [thickness_mm] | [cost_per_m2_100mm] | [category]

    Returns parsed material definitions compatible with the MATERIALS_DB format.
    """
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
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {missing}. Found: {list(sample.keys())}. Required: name, k, density"
            )

        materials = {}
        for i, row in enumerate(raw_rows):
            try:
                name = str(row[col_name]).strip()
                # Sanitize to slug-style ID
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
                raise HTTPException(status_code=400, detail=f"Row {i+2} parse error: {e}. Row: {dict(row)}")

        return {
            "status": "ok",
            "materials_imported": len(materials),
            "materials": materials
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV material parse failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
