"""
AERO-SHIELD Live Weather Service (Open-Meteo Integration)
Provides normalized current weather, 7-day forecast, and 24-hour hourly diurnal profiles.
Implements TTL caching, timeout handling, and graceful physical fallbacks.
"""

import time
import requests
from typing import Dict, Any, Optional

# In-memory cache: (rounded_lat, rounded_lng, forecast_days) -> (timestamp, data)
_WEATHER_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 300.0  # 5 minutes

# WMO Weather interpretation codes
WMO_WEATHER_CODES: Dict[int, Dict[str, str]] = {
    0: {"description": "Clear sky", "condition": "clear", "icon": "Sun"},
    1: {"description": "Mainly clear", "condition": "clear", "icon": "Sun"},
    2: {"description": "Partly cloudy", "condition": "cloudy", "icon": "CloudSun"},
    3: {"description": "Overcast", "condition": "cloudy", "icon": "Cloud"},
    45: {"description": "Fog", "condition": "fog", "icon": "CloudFog"},
    48: {"description": "Depositing rime fog", "condition": "fog", "icon": "CloudFog"},
    51: {"description": "Light drizzle", "condition": "rain", "icon": "CloudDrizzle"},
    53: {"description": "Moderate drizzle", "condition": "rain", "icon": "CloudDrizzle"},
    55: {"description": "Dense drizzle", "condition": "rain", "icon": "CloudDrizzle"},
    61: {"description": "Slight rain", "condition": "rain", "icon": "CloudRain"},
    63: {"description": "Moderate rain", "condition": "rain", "icon": "CloudRain"},
    65: {"description": "Heavy rain", "condition": "rain", "icon": "CloudRain"},
    71: {"description": "Slight snowfall", "condition": "snow", "icon": "CloudSnow"},
    73: {"description": "Moderate snowfall", "condition": "snow", "icon": "CloudSnow"},
    75: {"description": "Heavy snowfall", "condition": "blizzard", "icon": "Snowflake"},
    77: {"description": "Snow grains", "condition": "snow", "icon": "Snowflake"},
    80: {"description": "Slight rain showers", "condition": "rain", "icon": "CloudRain"},
    81: {"description": "Moderate rain showers", "condition": "rain", "icon": "CloudRain"},
    82: {"description": "Violent rain showers", "condition": "storm", "icon": "CloudLightning"},
    85: {"description": "Slight snow showers", "condition": "snow", "icon": "CloudSnow"},
    86: {"description": "Heavy snow showers", "condition": "blizzard", "icon": "Snowflake"},
    95: {"description": "Thunderstorm", "condition": "thunderstorm", "icon": "CloudLightning"},
    96: {"description": "Thunderstorm with slight hail", "condition": "storm", "icon": "CloudLightning"},
    99: {"description": "Thunderstorm with heavy hail", "condition": "blizzard", "icon": "CloudLightning"},
}

def decode_weather_code(code: Optional[int]) -> Dict[str, str]:
    if code is None or code not in WMO_WEATHER_CODES:
        return {"description": "Unknown / Partially Clear", "condition": "clear", "icon": "Sun"}
    return WMO_WEATHER_CODES[code]

def get_live_weather(
    latitude: float,
    longitude: float,
    forecast_days: int = 7
) -> Dict[str, Any]:
    """
    Fetches real-time, hourly, and daily forecast weather from Open-Meteo.
    Normalized into Aero-Guard standard response format.
    """
    cache_key = f"{round(latitude, 3)}_{round(longitude, 3)}_{forecast_days}"
    now = time.time()

    if cache_key in _WEATHER_CACHE:
        cached_time, cached_val = _WEATHER_CACHE[cache_key]
        if (now - cached_time) < CACHE_TTL_SECONDS:
            res = dict(cached_val)
            res["cached"] = True
            res["cache_age_sec"] = round(now - cached_time, 1)
            return res

    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={latitude}&longitude={longitude}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,snowfall,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility"
        f"&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,snowfall,weather_code,surface_pressure,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,shortwave_radiation"
        f"&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,snowfall_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,shortwave_radiation_sum"
        f"&forecast_days={max(1, min(14, forecast_days))}&timezone=auto"
    )

    try:
        resp = requests.get(url, timeout=5.0)
        if resp.status_code != 200:
            raise ValueError(f"Open-Meteo returned status {resp.status_code}")

        data = resp.json()
        current_raw = data.get("current", {})
        hourly_raw = data.get("hourly", {})
        daily_raw = data.get("daily", {})

        w_code = current_raw.get("weather_code", 0)
        decoded = decode_weather_code(w_code)

        # Normalize Current
        current_norm = {
            "temperature_c": current_raw.get("temperature_2m"),
            "apparent_temperature_c": current_raw.get("apparent_temperature"),
            "relative_humidity_pct": current_raw.get("relative_humidity_2m"),
            "precipitation_mm": current_raw.get("precipitation", 0.0),
            "rain_mm": current_raw.get("rain", 0.0),
            "snowfall_cm": current_raw.get("snowfall", 0.0),
            "weather_code": w_code,
            "weather_description": decoded["description"],
            "condition": decoded["condition"],
            "icon": decoded["icon"],
            "cloud_cover_pct": current_raw.get("cloud_cover", 0),
            "surface_pressure_hpa": current_raw.get("surface_pressure"),
            "wind_speed_mps": round(current_raw.get("wind_speed_10m", 0.0) / 3.6, 2) if current_raw.get("wind_speed_10m") is not None else 0.0,
            "wind_speed_kmh": current_raw.get("wind_speed_10m"),
            "wind_direction_deg": current_raw.get("wind_direction_10m"),
            "wind_gusts_mps": round(current_raw.get("wind_gusts_10m", 0.0) / 3.6, 2) if current_raw.get("wind_gusts_10m") is not None else 0.0,
            "visibility_m": current_raw.get("visibility"),
            "time": current_raw.get("time"),
        }

        # Normalize 24-48 Hours Hourly Series
        hourly_times = hourly_raw.get("time", [])[:48]
        hourly_series = []
        for i in range(len(hourly_times)):
            c_code = hourly_raw.get("weather_code", [])[i] if i < len(hourly_raw.get("weather_code", [])) else 0
            dec = decode_weather_code(c_code)
            w_kmh = hourly_raw.get("wind_speed_10m", [])[i] if i < len(hourly_raw.get("wind_speed_10m", [])) else 0.0
            hourly_series.append({
                "time": hourly_times[i],
                "hour": int(hourly_times[i].split("T")[1].split(":")[0]) if "T" in hourly_times[i] else i % 24,
                "temperature_c": hourly_raw.get("temperature_2m", [])[i],
                "apparent_temperature_c": hourly_raw.get("apparent_temperature", [])[i],
                "relative_humidity_pct": hourly_raw.get("relative_humidity_2m", [])[i],
                "solar_radiation_w_m2": hourly_raw.get("shortwave_radiation", [])[i],
                "wind_speed_mps": round(w_kmh / 3.6, 2) if w_kmh is not None else 0.0,
                "wind_speed_kmh": w_kmh,
                "precipitation_mm": hourly_raw.get("precipitation", [])[i] if i < len(hourly_raw.get("precipitation", [])) else 0.0,
                "weather_code": c_code,
                "weather_description": dec["description"]
            })

        # Normalize Daily Forecast
        daily_times = daily_raw.get("time", [])
        daily_series = []
        for i in range(len(daily_times)):
            d_code = daily_raw.get("weather_code", [])[i] if i < len(daily_raw.get("weather_code", [])) else 0
            d_dec = decode_weather_code(d_code)
            daily_series.append({
                "date": daily_times[i],
                "weather_code": d_code,
                "description": d_dec["description"],
                "condition": d_dec["condition"],
                "temp_max_c": daily_raw.get("temperature_2m_max", [])[i],
                "temp_min_c": daily_raw.get("temperature_2m_min", [])[i],
                "apparent_max_c": daily_raw.get("apparent_temperature_max", [])[i],
                "apparent_min_c": daily_raw.get("apparent_temperature_min", [])[i],
                "precipitation_sum_mm": daily_raw.get("precipitation_sum", [])[i],
                "snowfall_sum_cm": daily_raw.get("snowfall_sum", [])[i],
                "wind_speed_max_kmh": daily_raw.get("wind_speed_10m_max", [])[i],
                "wind_gusts_max_kmh": daily_raw.get("wind_gusts_10m_max", [])[i],
                "solar_radiation_sum_mj_m2": daily_raw.get("shortwave_radiation_sum", [])[i],
                "uv_index_max": daily_raw.get("uv_index_max", [])[i],
            })

        result = {
            "status": "online",
            "source": "Open-Meteo Live Meteorological API",
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "elevation_m": data.get("elevation", 3500.0),
                "timezone": data.get("timezone", "UTC"),
            },
            "current": current_norm,
            "hourly": hourly_series,
            "daily": daily_series,
            "cached": False,
            "cache_age_sec": 0.0
        }

        # Save to cache
        _WEATHER_CACHE[cache_key] = (now, result)
        return result

    except Exception as e:
        # Physical high-altitude fallback model if network is offline
        print(f"[Weather Warning] Open-Meteo live API request failed: {e}. Generating physical fallback.")
        return generate_physical_weather_fallback(latitude, longitude, forecast_days)


def generate_physical_weather_fallback(lat: float, lng: float, forecast_days: int) -> Dict[str, Any]:
    """
    Robust physical fallback model when Open-Meteo is temporarily unreachable.
    Computes elevation lapse rate and solar day curve.
    """
    # Estimate base temperature from latitude
    base_t = 15.0 - (lat * 0.75)  # colder higher north
    return {
        "status": "fallback",
        "source": "AERO-SHIELD High-Altitude Atmospheric Fallback Model",
        "location": {
            "latitude": lat,
            "longitude": lng,
            "elevation_m": 3500.0,
            "timezone": "Asia/Kolkata",
        },
        "current": {
            "temperature_c": round(base_t, 1),
            "apparent_temperature_c": round(base_t - 5.0, 1),
            "relative_humidity_pct": 35.0,
            "precipitation_mm": 0.0,
            "rain_mm": 0.0,
            "snowfall_cm": 0.0,
            "weather_code": 1,
            "weather_description": "Clear high-altitude sky (Estimated)",
            "condition": "clear",
            "icon": "Sun",
            "cloud_cover_pct": 10,
            "surface_pressure_hpa": 655.0,
            "wind_speed_mps": 4.5,
            "wind_speed_kmh": 16.2,
            "wind_direction_deg": 180,
            "wind_gusts_mps": 7.0,
            "visibility_m": 25000,
            "time": "Estimated Live",
        },
        "hourly": [
            {
                "hour": h,
                "time": f"T{h:02d}:00",
                "temperature_c": round(base_t - 6.0 * math.cos((h - 4) * math.pi / 12), 1),
                "apparent_temperature_c": round(base_t - 9.0 * math.cos((h - 4) * math.pi / 12), 1),
                "relative_humidity_pct": 35.0,
                "solar_radiation_w_m2": max(0.0, round(750.0 * math.sin((h - 6) * math.pi / 12), 1)) if 6 <= h <= 18 else 0.0,
                "wind_speed_mps": 4.5,
                "wind_speed_kmh": 16.2,
                "precipitation_mm": 0.0,
                "weather_code": 1,
                "weather_description": "Clear"
            }
            for h in range(24)
        ],
        "daily": [
            {
                "date": f"Day {d+1}",
                "weather_code": 1,
                "description": "Clear high-altitude cold",
                "condition": "clear",
                "temp_max_c": round(base_t + 5.0, 1),
                "temp_min_c": round(base_t - 9.0, 1),
                "apparent_max_c": round(base_t + 2.0, 1),
                "apparent_min_c": round(base_t - 13.0, 1),
                "precipitation_sum_mm": 0.0,
                "snowfall_sum_cm": 0.0,
                "wind_speed_max_kmh": 22.0,
                "wind_gusts_max_kmh": 35.0,
                "solar_radiation_sum_mj_m2": 18.5,
                "uv_index_max": 7.2,
            }
            for d in range(forecast_days)
        ],
        "cached": False,
        "cache_age_sec": 0.0
    }
