"""
AERO-SHIELD Location & Geocoding Service
Integrates Open-Meteo Geocoding API with curated Indian high-altitude military defense bases.
Used for mission location search, UAV launch point centering, elevation lookup, and airport search.
"""

import urllib.parse
import requests
from typing import Dict, List, Any

# Curated strategic military presets
STRATEGIC_PRESETS = [
    {
        "id": "station_leh",
        "name": "Leh Military Garrison (14 Corps HQ)",
        "country": "India",
        "region": "Ladakh",
        "latitude": 34.15,
        "longitude": 77.58,
        "elevation": 3500.0,
        "timezone": "Asia/Kolkata",
        "is_defense_station": True,
        "type": "military_base",
        "description": "High-altitude corps headquarters & passive solar testbed"
    },
    {
        "id": "station_siachen",
        "name": "Siachen Glacier Base Camp",
        "country": "India",
        "region": "Karakoram / Nubra",
        "latitude": 35.20,
        "longitude": 77.00,
        "elevation": 3650.0,
        "timezone": "Asia/Kolkata",
        "is_defense_station": True,
        "type": "military_base",
        "description": "Highest battlefield on earth - extreme katabatic sub-zero"
    },
    {
        "id": "station_dras",
        "name": "Dras Kargil Defense Outpost",
        "country": "India",
        "region": "Kargil District, Ladakh",
        "latitude": 34.43,
        "longitude": 75.76,
        "elevation": 3280.0,
        "timezone": "Asia/Kolkata",
        "is_defense_station": True,
        "type": "military_base",
        "description": "2nd coldest inhabited valley on Earth (-38°C winter)"
    },
    {
        "id": "station_pangong",
        "name": "Pangong Tso Forward Post",
        "country": "India",
        "region": "Eastern Ladakh",
        "latitude": 33.75,
        "longitude": 78.65,
        "elevation": 4350.0,
        "timezone": "Asia/Kolkata",
        "is_defense_station": True,
        "type": "military_base",
        "description": "High-altitude lake basin with gale-force winds"
    },
    {
        "id": "station_nyoma",
        "name": "Nyoma Advance Landing Ground (ALG)",
        "country": "India",
        "region": "Changthang Plateau",
        "latitude": 33.19,
        "longitude": 78.99,
        "elevation": 4180.0,
        "timezone": "Asia/Kolkata",
        "is_defense_station": True,
        "type": "military_airfield",
        "description": "High plateau forward military airfield"
    },
    {
        "id": "station_tawang",
        "name": "Tawang Forward Border Outpost",
        "country": "India",
        "region": "Arunachal Pradesh",
        "latitude": 27.58,
        "longitude": 91.86,
        "elevation": 3048.0,
        "timezone": "Asia/Kolkata",
        "is_defense_station": True,
        "type": "military_base",
        "description": "Eastern Himalayan wet alpine snowstorm zone"
    }
]

def search_locations(query: str, count: int = 10) -> Dict[str, Any]:
    """
    Searches worldwide locations, airports, and military stations using Open-Meteo Geocoding.
    """
    clean_q = query.strip()
    if not clean_q or len(clean_q) < 2:
        return {
            "status": "success",
            "query": query,
            "count": len(STRATEGIC_PRESETS),
            "results": STRATEGIC_PRESETS
        }

    results: List[Dict[str, Any]] = []

    # Check local military presets first
    q_lower = clean_q.lower()
    for preset in STRATEGIC_PRESETS:
        if (q_lower in preset["name"].lower() or
            q_lower in preset["region"].lower() or
            q_lower in preset["country"].lower()):
            results.append(preset)

    # Query Open-Meteo Geocoding API
    encoded_q = urllib.parse.quote(clean_q)
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={encoded_q}&count={count}&language=en&format=json"

    try:
        resp = requests.get(url, timeout=4.0)
        if resp.status_code == 200:
            data = resp.json()
            raw_results = data.get("results", [])
            for item in raw_results:
                loc_id = f"om_{item.get('id', item.get('name'))}"
                # Avoid duplicates
                if any(r["name"] == item.get("name") and abs(r["latitude"] - item.get("latitude", 0)) < 0.05 for r in results):
                    continue

                results.append({
                    "id": str(loc_id),
                    "name": item.get("name", "Unknown"),
                    "country": item.get("country", ""),
                    "country_code": item.get("country_code", ""),
                    "region": item.get("admin1") or item.get("admin2") or item.get("country", ""),
                    "latitude": float(item.get("latitude", 0.0)),
                    "longitude": float(item.get("longitude", 0.0)),
                    "elevation": float(item.get("elevation", 0.0)) if item.get("elevation") is not None else 0.0,
                    "timezone": item.get("timezone", "UTC"),
                    "is_defense_station": False,
                    "type": "city_or_place"
                })
    except Exception as e:
        print(f"[Location Warning] Open-Meteo Geocoding API error: {e}")

    return {
        "status": "success",
        "query": clean_q,
        "count": len(results),
        "results": results[:count]
    }
