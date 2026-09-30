"""
AERO-SHIELD Shelter Digital Twin Service
DRDO Problem ID: 26051

Maintains deployed shelter instances as live digital twins anchored to real
geographic coordinates. Each twin tracks location, environment, fuel, generator,
power, battery, occupancy and communication subsystems.

Design notes:
- State lives in a process-local registry (the project has no database).
  This matches the existing caching pattern in weather_integration.py,
  elevation_service.py and aircraft_service.py.
- Twin state ADVANCES LAZILY from wall-clock elapsed time, so fuel and battery
  values are correct no matter how often the client polls.
- Environmental data is fetched from the existing real Open-Meteo integration.
  When that fails, a clearly labelled simulated fallback is used and the
  response marks it with `is_simulated: True` so the UI never presents
  fabricated telemetry as live sensor data.
"""

import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from services.elevation_service import get_elevation_for_point
from services.weather_integration import get_live_weather


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FUEL_CAPACITY_L = 500.0
FUEL_CONSUMPTION_RATE_LPH = 4.2      # Rated burn at 100% generator load
GENERATOR_RATED_LOAD_W = 2400.0

BATTERY_CAPACITY_KWH = 5.0
SOLAR_CAPACITY_KW = 2.0

# Fuel status thresholds (percent of tank capacity)
FUEL_THRESHOLD_NORMAL_PCT = 40.0
FUEL_THRESHOLD_LOW_PCT = 20.0
FUEL_THRESHOLD_CRITICAL_PCT = 5.0

# Physical constants
METERS_PER_DEGREE_LAT = 111132.0
METERS_PER_DEGREE_LON_AT_EQUATOR = 111320.0

SHELTER_REGISTRY: Dict[str, Dict[str, Any]] = {}
# Identifier of the single active shelter twin tracked by the application.
_PRIMARY_ID: Optional[str] = None
# RLock (not Lock): deploy_shelter() holds this while calling _next_shelter_id(),
# which acquires it again. A plain Lock would self-deadlock.
_REGISTRY_LOCK = threading.RLock()
_ID_COUNTER = {"n": 0}


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------
class ShelterDeployRequest(BaseModel):
    """POST /api/shelters/deploy body."""
    latitude: float
    longitude: float
    elevation: Optional[float] = None
    heading_deg: Optional[float] = None
    name: Optional[str] = None
    archetype: str = "trombe_wall"
    troops: int = 8
    fuel_level_l: float = FUEL_CAPACITY_L


class ShelterUpdateRequest(BaseModel):
    """PATCH /api/shelters/{id} body. All fields optional."""
    name: Optional[str] = None
    heading_deg: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    elevation: Optional[float] = None
    troops: Optional[int] = None
    grid_connected: Optional[bool] = None


class ShelterCommandRequest(BaseModel):
    """POST /api/shelters/{id}/command body."""
    action: str = Field(
        ...,
        description="start_generator | stop_generator | refuel | toggle_grid"
    )
    liters: Optional[float] = Field(
        None, description="Litres to add. Required for the 'refuel' action."
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two WGS84 coordinates."""
    r = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def classify_fuel_status(fuel_pct: float) -> str:
    """NORMAL / LOW / CRITICAL / EMPTY from tank percentage."""
    if fuel_pct <= FUEL_THRESHOLD_CRITICAL_PCT:
        return "EMPTY"
    if fuel_pct <= FUEL_THRESHOLD_LOW_PCT:
        return "CRITICAL"
    if fuel_pct <= FUEL_THRESHOLD_NORMAL_PCT:
        return "LOW"
    return "NORMAL"


def _next_shelter_id() -> str:
    with _REGISTRY_LOCK:
        _ID_COUNTER["n"] += 1
        return f"AERO-SH-{_ID_COUNTER['n']:03d}"


def _default_name(latitude: float, longitude: float) -> str:
    ns = "N" if latitude >= 0 else "S"
    ew = "E" if longitude >= 0 else "W"
    return f"Shelter {abs(latitude):.3f}{ns} {abs(longitude):.3f}{ew}"


# ---------------------------------------------------------------------------
# Environment (real API with honest fallback)
# ---------------------------------------------------------------------------
def _simulated_environment(latitude: float, longitude: float) -> Dict[str, Any]:
    """Deterministic per-location fallback used ONLY when the live API fails."""
    seed = (abs(latitude) * 1000.0) + (abs(longitude) * 977.0)
    temp = -8.0 - (seed % 14.0)
    wind = 4.0 + (seed % 11.0)
    return {
        "source": "AERO-SHIELD Simulated Environment Model (live API unavailable)",
        "is_simulated": True,
        "temperature_c": round(temp, 1),
        "apparent_temperature_c": round(temp - wind * 0.35, 1),
        "relative_humidity_pct": round(28.0 + (seed % 40.0), 1),
        "wind_speed_mps": round(wind, 1),
        "wind_gusts_mps": round(wind * 1.7, 1),
        "wind_direction_deg": round((seed * 7.0) % 360.0, 1),
        "precipitation_mm": 0.0,
        "snowfall_cm": 0.0,
        "surface_pressure_hpa": round(560.0 + (seed % 40.0), 1),
        "visibility_m": 20000.0,
        "solar_radiation_w_m2": round(280.0 + (seed % 220.0), 1),
        "condition": "SIMULATED — Clear high altitude",
        "weather_code": 0,
        "observed_at": None,
    }


def _harvest_environment(latitude: float, longitude: float) -> Dict[str, Any]:
    """Read the existing Open-Meteo integration. Never raises."""
    try:
        wx = get_live_weather(latitude, longitude, forecast_days=1)
    except Exception as exc:
        env = _simulated_environment(latitude, longitude)
        env["error"] = str(exc)
        return env

    if not isinstance(wx, dict):
        return _simulated_environment(latitude, longitude)

    # status == "online" is the only marker the existing service sets for real data.
    is_simulated = wx.get("status") != "online"

    current = wx.get("current") or {}
    hourly = wx.get("hourly") or []
    current_hour = current.get("hour")
    solar_w_m2 = 0.0
    for h in hourly:
        if current_hour is not None and h.get("hour") == current_hour:
            solar_w_m2 = h.get("solar_radiation_w_m2") or 0.0
            break
    if not solar_w_m2 and hourly:
        solar_w_m2 = max(
            [h.get("solar_radiation_w_m2") or 0.0 for h in hourly[:6]] or [0.0]
        )

    return {
        "source": wx.get("source", "Unknown"),
        "is_simulated": is_simulated,
        "temperature_c": current.get("temperature_c"),
        "apparent_temperature_c": current.get("apparent_temperature_c"),
        "relative_humidity_pct": current.get("relative_humidity_pct"),
        "wind_speed_mps": current.get("wind_speed_mps"),
        "wind_gusts_mps": current.get("wind_gusts_mps"),
        "wind_direction_deg": current.get("wind_direction_deg"),
        "precipitation_mm": current.get("precipitation_mm"),
        "snowfall_cm": current.get("snowfall_cm"),
        "surface_pressure_hpa": current.get("surface_pressure_hpa"),
        "visibility_m": current.get("visibility_m"),
        "solar_radiation_w_m2": round(float(solar_w_m2), 1),
        "condition": current.get("condition") or current.get("weather_description"),
        "weather_code": current.get("weather_code"),
        "observed_at": current.get("time"),
    }


# ---------------------------------------------------------------------------
# Subsystem computation
# ---------------------------------------------------------------------------
def _compute_shelter_load(shelter: Dict[str, Any], env: Dict[str, Any]) -> float:
    """Total electrical demand in watts, derived from real state."""
    ambient = env.get("temperature_c")
    if ambient is None:
        ambient = -10.0
    # Colder ambient drives more heating/lighting load.
    thermal_w = max(0.0, (5.0 - float(ambient))) * 22.0
    occupancy_w = shelter["troops"] * 95.0
    return round(shelter["base_load_w"] + occupancy_w + thermal_w, 1)


def _resolve_power_source(
    generator_running: bool,
    solar_w: float,
    battery_kwh: float,
    grid_connected: bool,
) -> str:
    """GENERATOR > GRID > SOLAR > BATTERY > NONE."""
    if generator_running:
        return "GENERATOR"
    if grid_connected:
        return "GRID"
    if solar_w > 1.0:
        return "SOLAR"
    if battery_kwh > 0.0:
        return "BATTERY"
    return "NONE"


def _advance(shelter: Dict[str, Any], env: Dict[str, Any], now: float) -> None:
    """Recompute all derived state, integrating fuel/battery over elapsed time."""
    dt_h = max(0.0, (now - shelter["last_tick"]) / 3600.0)

    load_w = _compute_shelter_load(shelter, env)
    load_factor = min(1.5, max(0.25, load_w / GENERATOR_RATED_LOAD_W))
    generator_running = shelter["generator_status"] == "RUNNING"

    # --- Fuel -------------------------------------------------------------
    burn_lph = FUEL_CONSUMPTION_RATE_LPH * load_factor if generator_running else 0.0
    if generator_running and dt_h > 0:
        shelter["fuel_level_l"] = max(0.0, shelter["fuel_level_l"] - burn_lph * dt_h)

    fuel_pct = (shelter["fuel_level_l"] / FUEL_CAPACITY_L) * 100.0
    shelter["fuel_pct"] = round(fuel_pct, 2)
    shelter["fuel_status"] = classify_fuel_status(fuel_pct)
    shelter["fuel_consumption_rate_lph"] = round(burn_lph, 2)
    shelter["remaining_runtime_hours"] = (
        round(shelter["fuel_level_l"] / burn_lph, 1) if burn_lph > 0 else None
    )

    # A running generator that runs dry must shut itself off.
    if generator_running and shelter["fuel_level_l"] <= 0.0:
        shelter["generator_status"] = "OFF"
        shelter["generator_stop_reason"] = "Automatic shutdown: fuel exhausted"
        generator_running = False

    # --- Solar ------------------------------------------------------------
    solar_capacity_w = SOLAR_CAPACITY_KW * 1000.0
    irradiance = float(env.get("solar_radiation_w_m2") or 0.0)
    solar_w = round(min(solar_capacity_w, solar_capacity_w * (irradiance / 1000.0)), 1)

    # --- Power source -----------------------------------------------------
    source = _resolve_power_source(
        generator_running, solar_w, shelter["battery_level_kwh"], shelter["grid_connected"]
    )

    # --- Battery ----------------------------------------------------------
    if dt_h > 0:
        prev_battery = shelter["battery_level_kwh"]
        # Anything the active source produces beyond the live demand is surplus,
        # and surplus charges the bank when charging is enabled. The generator
        # runs at its rated output, so a lightly loaded shelter charges the
        # bank; grid is assumed metered to demand and solar is its measured input.
        if source == "GENERATOR":
            supply_w = GENERATOR_RATED_LOAD_W
        elif source == "GRID":
            supply_w = load_w
        else:
            supply_w = solar_w
        surplus_w = supply_w - load_w

        if surplus_w > 0 and shelter["battery_charging_enabled"]:
            shelter["battery_level_kwh"] = min(
                BATTERY_CAPACITY_KWH, prev_battery + (surplus_w * dt_h) / 1000.0
            )
            shelter["battery_charging"] = True
        else:
            shelter["battery_level_kwh"] = max(0.0, prev_battery - (load_w * dt_h) / 1000.0)
            shelter["battery_charging"] = False

    shelter["power_source"] = source
    shelter["load_w"] = load_w
    shelter["solar_input_w"] = solar_w
    shelter["battery_pct"] = round(
        (shelter["battery_level_kwh"] / BATTERY_CAPACITY_KWH) * 100.0, 2
    )
    shelter["last_tick"] = now
    shelter["last_updated"] = now


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------
def _operational_status(shelter: Dict[str, Any], env: Dict[str, Any]) -> str:
    if shelter["fuel_status"] == "EMPTY" and shelter["power_source"] == "NONE":
        return "OFFLINE"
    if shelter["fuel_status"] in ("EMPTY", "CRITICAL"):
        return "DEGRADED"
    if shelter["battery_pct"] < 15.0 and shelter["power_source"] == "BATTERY":
        return "DEGRADED"
    return "NOMINAL"


def _serialize(shelter: Dict[str, Any], env: Dict[str, Any]) -> Dict[str, Any]:
    sim_fields = [f for f, v in env.items() if v is None and f not in ("observed_at",)]
    simulated = bool(env.get("is_simulated")) or bool(sim_fields)

    return {
        "id": shelter["id"],
        "name": shelter["name"],
        "archetype": shelter["archetype"],
        "location": {
            "latitude": round(shelter["latitude"], 6),
            "longitude": round(shelter["longitude"], 6),
            "elevation_m": round(shelter["elevation_m"], 1),
            "elevation_source": shelter["elevation_source"],
            "heading_deg": round(shelter["heading_deg"], 1),
            "coordinate_system": "WGS84",
        },
        "telemetry": {
            "outside_temperature_c": env.get("temperature_c"),
            "inside_temperature_c": _inside_temperature(shelter, env),
            "relative_humidity_pct": env.get("relative_humidity_pct"),
            "pressure_hpa": env.get("surface_pressure_hpa"),
            "wind_speed_mps": env.get("wind_speed_mps"),
            "wind_gusts_mps": env.get("wind_gusts_mps"),
            "precipitation_mm": env.get("precipitation_mm"),
            "visibility_m": env.get("visibility_m"),
            "condition": env.get("condition"),
            "occupancy": shelter["troops"],
            "occupancy_capacity": shelter["capacity"],
            "air_quality": shelter["air_quality"],
            "water_availability_l": shelter["water_availability_l"],
            "communication": shelter["communication"],
        },
        "environment": {
            "source": env.get("source"),
            "is_simulated": bool(env.get("is_simulated")),
            "solar_radiation_w_m2": env.get("solar_radiation_w_m2"),
            "observed_at": env.get("observed_at"),
        },
        "fuel": {
            "fuel_level_l": round(shelter["fuel_level_l"], 2),
            "fuel_capacity_l": FUEL_CAPACITY_L,
            "fuel_pct": shelter["fuel_pct"],
            "status": shelter["fuel_status"],
            "consumption_rate_lph": shelter["fuel_consumption_rate_lph"],
            "remaining_runtime_hours": shelter["remaining_runtime_hours"],
        },
        "generator": {
            "status": shelter["generator_status"],
            "rated_load_w": GENERATOR_RATED_LOAD_W,
            "stop_reason": shelter.get("generator_stop_reason"),
        },
        "power": {
            "source": shelter["power_source"],
            "available_sources": _available_sources(shelter, env),
            "load_w": shelter["load_w"],
            "grid_connected": shelter["grid_connected"],
        },
        "battery": {
            "battery_level_kwh": round(shelter["battery_level_kwh"], 3),
            "battery_capacity_kwh": BATTERY_CAPACITY_KWH,
            "battery_pct": shelter["battery_pct"],
            "charging": shelter["battery_charging"],
            "charging_enabled": shelter["battery_charging_enabled"],
        },
        "solar": {
            "capacity_kw": SOLAR_CAPACITY_KW,
            "input_w": shelter["solar_input_w"],
            "generating": shelter["solar_input_w"] > 1.0,
        },
        "operational_status": _operational_status(shelter, env),
        "is_simulated": simulated,
        "simulated_fields": (
            ["environment.*"] if env.get("is_simulated") else ([] if not sim_fields else sim_fields)
        ),
        "deployed_at": shelter["deployed_at"],
        "last_updated": shelter["last_updated"],
        "last_updated_iso": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime(shelter["last_updated"])
        ),
    }


def _available_sources(shelter: Dict[str, Any], env: Dict[str, Any]) -> List[str]:
    sources = ["BATTERY"]
    if shelter["grid_connected"]:
        sources.insert(0, "GRID")
    if float(env.get("solar_radiation_w_m2") or 0) > 1.0:
        sources.insert(0, "SOLAR")
    if shelter["generator_status"] == "RUNNING":
        sources.insert(0, "GENERATOR")
    return sources


def _inside_temperature(shelter: Dict[str, Any], env: Dict[str, Any]) -> Optional[float]:
    """Estimate internal temperature from real geometry + real weather."""
    ambient = env.get("temperature_c")
    if ambient is None:
        return None
    passive_gain = shelter.get("solar_gain_c", 6.5)
    heater_on = 6.0 if shelter["generator_status"] == "RUNNING" else 0.0
    return round(float(ambient) + passive_gain + heater_on, 1)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def deploy_shelter(req: ShelterDeployRequest) -> Dict[str, Any]:
    """
    Deploy a digital twin, or relocate the currently active twin. The app
    tracks a single shelter, so this never accumulates duplicate shelters no
    matter how many times the deployment location changes.
    """
    lat = float(req.latitude)
    lng = float(req.longitude)

    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lng <= 180.0):
        raise ValueError("Latitude must be within [-90, 90] and longitude within [-180, 180].")

    elev_m = float(req.elevation) if req.elevation is not None else None
    elev_source = "Client-supplied" if elev_m is not None else None
    if elev_m is None:
        try:
            probe = get_elevation_for_point(lat, lng)
            if isinstance(probe, dict) and probe.get("elevation") is not None:
                elev_m = float(probe["elevation"])
                elev_source = probe.get("source", "Elevation service")
        except Exception:
            elev_m = None
    if elev_m is None:
        elev_m = 0.0
        elev_source = "Elevation unavailable"

    # Default heading matches the existing app convention: south-facing solar facade
    # (ShelterGeometry.window_orientation_deg defaults to 180.0 in the frontend).
    heading = float(req.heading_deg) if req.heading_deg is not None else 180.0
    now = time.time()

    with _REGISTRY_LOCK:
        # The application tracks exactly one active shelter, so deploying
        # always re-anchors the current twin instead of creating a duplicate.
        # A previous twin is only reused when it is still in the registry.
        existing_id = None
        if _PRIMARY_ID in SHELTER_REGISTRY:
            existing_id = _PRIMARY_ID
        elif SHELTER_REGISTRY:
            existing_id = next(reversed(SHELTER_REGISTRY))

        if existing_id:
            sh = SHELTER_REGISTRY[existing_id]
            sh["latitude"] = lat
            sh["longitude"] = lng
            sh["elevation_m"] = elev_m
            sh["elevation_source"] = elev_source
            if req.heading_deg is not None:
                sh["heading_deg"] = float(req.heading_deg)
            # Keep the twin in step with app state so a blueprint change in the
            # 3D viewer is reflected instead of going stale.
            if req.archetype:
                sh["archetype"] = req.archetype
            if req.name:
                sh["name"] = req.name
            else:
                # Without this the twin kept advertising the coordinates it was
                # deployed to originally, so a relocated shelter was labelled
                # with a stale position in the 3D view and telemetry headers.
                sh["name"] = _default_name(lat, lng)
            if req.troops:
                sh["troops"] = int(req.troops)
                sh["capacity"] = int(req.troops)
            shelter = sh
            relocated = True
        else:
            shelter_id = _next_shelter_id()
            shelter = {
                "id": shelter_id,
                "name": req.name or _default_name(lat, lng),
                "archetype": req.archetype,
                "latitude": lat,
                "longitude": lng,
                "elevation_m": elev_m,
                "elevation_source": elev_source,
                "heading_deg": heading,
                "troops": int(req.troops),
                "capacity": int(req.troops),
                "fuel_level_l": min(FUEL_CAPACITY_L, max(0.0, float(req.fuel_level_l))),
                "generator_status": "OFF",
                "generator_stop_reason": None,
                "grid_connected": False,
                "battery_charging_enabled": True,
                "battery_level_kwh": BATTERY_CAPACITY_KWH * 0.8,
                "battery_charging": False,
                "battery_pct": 80.0,
                "base_load_w": 150.0,
                "solar_gain_c": 6.5,
                "air_quality": "ADEQUATE",
                "water_availability_l": 1200.0,
                "communication": {
                    "status": "ONLINE",
                    "link": "SATCOM",
                    "signal_pct": 92,
                    "is_simulated": True,
                },
                "fuel_pct": 0.0,
                "fuel_status": "NORMAL",
                "fuel_consumption_rate_lph": 0.0,
                "remaining_runtime_hours": None,
                "power_source": "BATTERY",
                "load_w": 0.0,
                "solar_input_w": 0.0,
                "deployed_at": now,
                "last_tick": now,
                "last_updated": now,
            }
            SHELTER_REGISTRY[shelter_id] = shelter
            globals()["_PRIMARY_ID"] = shelter_id
            relocated = False

    env = _harvest_environment(shelter["latitude"], shelter["longitude"])
    _advance(shelter, env, now)
    payload = _serialize(shelter, env)
    payload["relocated"] = relocated
    return payload


def list_shelters() -> Dict[str, Any]:
    now = time.time()
    shelters = []
    for sh in list(SHELTER_REGISTRY.values()):
        env = _harvest_environment(sh["latitude"], sh["longitude"])
        _advance(sh, env, now)
        shelters.append(_serialize(sh, env))
    return {"status": "success", "count": len(shelters), "shelters": shelters}


def get_shelter(shelter_id: str) -> Optional[Dict[str, Any]]:
    sh = SHELTER_REGISTRY.get(shelter_id)
    if not sh:
        return None
    env = _harvest_environment(sh["latitude"], sh["longitude"])
    _advance(sh, env, time.time())
    return _serialize(sh, env)


def update_shelter(shelter_id: str, req: ShelterUpdateRequest) -> Optional[Dict[str, Any]]:
    sh = SHELTER_REGISTRY.get(shelter_id)
    if not sh:
        return None
    if req.name is not None:
        sh["name"] = req.name
    if req.heading_deg is not None:
        sh["heading_deg"] = float(req.heading_deg)
    if req.latitude is not None:
        sh["latitude"] = float(req.latitude)
    if req.longitude is not None:
        sh["longitude"] = float(req.longitude)
    if req.elevation is not None:
        sh["elevation_m"] = float(req.elevation)
        sh["elevation_source"] = "Client-supplied"
    if req.troops is not None:
        sh["troops"] = max(0, int(req.troops))
    if req.grid_connected is not None:
        sh["grid_connected"] = bool(req.grid_connected)
    env = _harvest_environment(sh["latitude"], sh["longitude"])
    _advance(sh, env, time.time())
    return _serialize(sh, env)


def execute_command(shelter_id: str, req: ShelterCommandRequest) -> Dict[str, Any]:
    """Generator / refuel / grid commands with impossible-state guards."""
    sh = SHELTER_REGISTRY.get(shelter_id)
    if not sh:
        raise KeyError(shelter_id)

    action = (req.action or "").strip().lower()
    message = ""
    ok = True

    env = _harvest_environment(sh["latitude"], sh["longitude"])
    _advance(sh, env, time.time())

    if action == "start_generator":
        if sh["fuel_level_l"] <= 0.0 or sh["fuel_status"] == "EMPTY":
            ok = False
            message = (
                "Generator cannot start: fuel tank is EMPTY. Refuel before starting."
            )
        else:
            sh["generator_status"] = "RUNNING"
            sh["generator_stop_reason"] = None
            message = "Generator started. Fuel consumption is now active."
    elif action == "stop_generator":
        sh["generator_status"] = "OFF"
        sh["generator_stop_reason"] = "Operator command"
        message = "Generator stopped. Fuel consumption halted."
    elif action == "refuel":
        liters = float(req.liters or FUEL_CAPACITY_L)
        if liters <= 0:
            ok = False
            message = "Refuel amount must be greater than zero litres."
        else:
            sh["fuel_level_l"] = min(FUEL_CAPACITY_L, sh["fuel_level_l"] + liters)
            sh["fuel_pct"] = round((sh["fuel_level_l"] / FUEL_CAPACITY_L) * 100.0, 2)
            sh["fuel_status"] = classify_fuel_status(sh["fuel_pct"])
            message = f"Refuelled {round(min(liters, FUEL_CAPACITY_L - sh['fuel_level_l'] + liters), 1)} L."
    elif action == "toggle_grid":
        sh["grid_connected"] = not sh["grid_connected"]
        message = f"Grid connection {'established' if sh['grid_connected'] else 'disconnected'}."
    else:
        ok = False
        message = f"Unknown action '{req.action}'."

    env = _harvest_environment(sh["latitude"], sh["longitude"])
    _advance(sh, env, time.time())
    payload = _serialize(sh, env)
    payload["command"] = {"action": action, "accepted": ok, "message": message}
    return payload


def get_shelter_fuel(shelter_id: str) -> Optional[Dict[str, Any]]:
    sh = SHELTER_REGISTRY.get(shelter_id)
    if not sh:
        return None
    env = _harvest_environment(sh["latitude"], sh["longitude"])
    _advance(sh, env, time.time())
    payload = _serialize(sh, env)
    return {"id": payload["id"], "fuel": payload["fuel"], "generator": payload["generator"],
            "last_updated_iso": payload["last_updated_iso"]}


def get_shelter_power(shelter_id: str) -> Optional[Dict[str, Any]]:
    sh = SHELTER_REGISTRY.get(shelter_id)
    if not sh:
        return None
    env = _harvest_environment(sh["latitude"], sh["longitude"])
    _advance(sh, env, time.time())
    payload = _serialize(sh, env)
    return {"id": payload["id"], "power": payload["power"], "battery": payload["battery"],
            "solar": payload["solar"], "last_updated_iso": payload["last_updated_iso"]}


def get_shelter_telemetry(shelter_id: str) -> Optional[Dict[str, Any]]:
    sh = SHELTER_REGISTRY.get(shelter_id)
    if not sh:
        return None
    env = _harvest_environment(sh["latitude"], sh["longitude"])
    _advance(sh, env, time.time())
    payload = _serialize(sh, env)
    return {
        "id": payload["id"],
        "name": payload["name"],
        "location": payload["location"],
        "telemetry": payload["telemetry"],
        "environment": payload["environment"],
        "fuel": payload["fuel"],
        "power": payload["power"],
        "battery": payload["battery"],
        "solar": payload["solar"],
        "generator": payload["generator"],
        "operational_status": payload["operational_status"],
        "is_simulated": payload["is_simulated"],
        "simulated_fields": payload["simulated_fields"],
        "last_updated_iso": payload["last_updated_iso"],
    }


def terrain_profile(latitude: float, longitude: float, span_m: float = 300.0,
                    samples: int = 5) -> Dict[str, Any]:
    """
    Sample real DEM elevations on a grid around the anchor so the 3D scene can
    be built on actual ground rather than a flat plane.
    """
    samples = max(2, min(9, int(samples)))
    half = span_m / 2.0
    dlat = span_m / METERS_PER_DEGREE_LAT
    cos_lat = max(0.05, math.cos(math.radians(latitude)))
    dlon = span_m / (METERS_PER_DEGREE_LON_AT_EQUATOR * cos_lat)

    coords: List[tuple] = []
    for r in range(samples):
        for c in range(samples):
            plat = latitude + (r / (samples - 1) - 0.5) * dlat
            plon = longitude + (c / (samples - 1) - 0.5) * dlon
            coords.append((r, c, plat, plon))

    def probe(point: tuple) -> Optional[float]:
        _, _, plat, plon = point
        try:
            res = get_elevation_for_point(plat, plon)
            if isinstance(res, dict) and res.get("elevation") is not None:
                return float(res["elevation"])
        except Exception:
            pass
        return None

    # Fan the DEM requests out; 25 sequential round-trips is unusable
    # interactively, and this is the only slow call in the deploy path.
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(probe, coords))

    grid: List[List[Optional[float]]] = [
        [None] * samples for _ in range(samples)
    ]
    is_simulated = False
    for (r, c, _, _), val in zip(coords, results):
        grid[r][c] = val
        if val is None:
            is_simulated = True

    # Fill any missing samples with the mean of what we did get.
    flat = [v for row in grid for v in row if v is not None]
    fallback = sum(flat) / len(flat) if flat else 0.0
    for r in range(samples):
        for c in range(samples):
            if grid[r][c] is None:
                grid[r][c] = fallback

    return {
        "latitude": latitude,
        "longitude": longitude,
        "span_m": span_m,
        "samples": samples,
        "grid_m": grid,
        "min_elevation_m": round(min(flat) if flat else fallback, 1),
        "max_elevation_m": round(max(flat) if flat else fallback, 1),
        "is_simulated": is_simulated,
        "coordinate_note": "WGS84 local tangent plane; x=+East, z=-North, y=up in metres",
    }
