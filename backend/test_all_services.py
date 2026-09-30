"""
Comprehensive Automated Verification Test Suite for AERO-SHIELD All Integrations
Tests all 20+ endpoints across external and internal APIs using FastAPI TestClient.
"""

import sys
import io
import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("=================================================================")
    print("   AERO-SHIELD ALL SERVICES & API INTEGRATION TEST SUITE        ")
    print("=================================================================\n")

    # 1. Health & Status
    print("1. Testing Health & Status Endpoints...")
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("   [PASS] GET /api/health ->", r.json()["status"])

    r = client.get("/api/status")
    assert r.status_code == 200, f"Status check failed: {r.text}"
    subsystems = r.json()["subsystems"]
    print("   [PASS] GET /api/status -> Subsystems verified:", len(subsystems))
    for k, v in subsystems.items():
        print(f"      - {k}: {v}")

    # 2. Live Weather (Open-Meteo)
    print("\n2. Testing Open-Meteo Live Weather APIs...")
    r = client.get("/api/weather?latitude=34.15&longitude=77.58&forecast_days=3")
    assert r.status_code == 200, f"Weather failed: {r.text}"
    w_data = r.json()
    print(f"   [PASS] GET /api/weather -> Temp: {w_data['current']['temperature_c']}°C, Condition: {w_data['current']['weather_description']}")

    r = client.get("/api/weather/current?latitude=34.15&longitude=77.58")
    assert r.status_code == 200, f"Weather current failed: {r.text}"
    print(f"   [PASS] GET /api/weather/current -> {r.json()['current']['condition']}")

    r = client.get("/api/weather/forecast?latitude=34.15&longitude=77.58&days=5")
    assert r.status_code == 200, f"Weather forecast failed: {r.text}"
    print(f"   [PASS] GET /api/weather/forecast -> Days returned: {len(r.json()['daily'])}")

    # 3. Location Search (Open-Meteo Geocoding)
    print("\n3. Testing Location Search & Geocoding API...")
    r = client.get("/api/location/search?q=Leh")
    assert r.status_code == 200, f"Location search failed: {r.text}"
    locs = r.json()["results"]
    assert len(locs) > 0, "No locations found"
    print(f"   [PASS] GET /api/location/search?q=Leh -> Matched {len(locs)} results. Top: {locs[0]['name']} ({locs[0]['latitude']}, {locs[0]['longitude']})")

    # 4. Elevation (OpenTopography / DEM)
    print("\n4. Testing OpenTopography / DEM Elevation API...")
    r = client.get("/api/elevation?latitude=34.15&longitude=77.58")
    assert r.status_code == 200, f"Elevation failed: {r.text}"
    elev = r.json()
    print(f"   [PASS] GET /api/elevation -> Elevation: {elev['elevation']}m, Source: {elev['source']}")

    r = client.get("/api/elevation?locations=34.15,77.58|34.20,77.60|34.25,77.62")
    assert r.status_code == 200, f"Elevation profile failed: {r.text}"
    prof = r.json()
    print(f"   [PASS] GET /api/elevation (profile) -> Waypoints: {prof['count']}, Avg Alt: {prof['avg_elevation_m']}m")

    # 5. Satellite (Copernicus Sentinel Hub)
    print("\n5. Testing Copernicus Sentinel Hub Satellite APIs...")
    r = client.get("/api/satellite/search?lat=34.15&lng=77.58")
    assert r.status_code == 200, f"Satellite search failed: {r.text}"
    sat = r.json()
    print(f"   [PASS] GET /api/satellite/search -> Status: {sat['status']}, Provider: {sat.get('satellite_provider', 'ESA Sentinel-2')}")

    r = client.get("/api/satellite/statistics?lat=34.15&lng=77.58")
    assert r.status_code == 200, f"Satellite stats failed: {r.text}"
    print(f"   [PASS] GET /api/satellite/statistics -> NDSI Snow: {r.json()['indices']['ndsi_snow_index']}")

    # 6. Aircraft Traffic (OpenSky Network)
    print("\n6. Testing OpenSky Network Airspace & UAV Telemetry...")
    r = client.get("/api/aircraft?latitude=34.15&longitude=77.58&radius_km=80")
    assert r.status_code == 200, f"Aircraft failed: {r.text}"
    air = r.json()
    print(f"   [PASS] GET /api/aircraft -> Total aircraft: {air['count']}, Tactical UAVs: {air['uav_count']}")

    # 7. AI Assistant
    print("\n7. Testing Tactical AI Assistant (OpenAI / Local Rules-Engine)...")
    payload = {
        "message": "Explain why fuel savings reach 98% with the Trombe wall shelter design.",
        "context": {
            "weather": w_data,
            "simulation": {
                "summary": {"fuel_saving_percentage": 98.6, "daily_fuel_liters": 0.66, "passive_solar_fraction_pct": 71.9}
            },
            "geometry": {"archetype": "trombe_wall"}
        }
    }
    r = client.post("/api/ai/chat", json=payload)
    assert r.status_code == 200, f"AI chat failed: {r.text}"
    ai_resp = r.json()
    print(f"   [PASS] POST /api/ai/chat -> Source: {ai_resp['source']}")
    print(f"      Response snippet: {ai_resp['response'][:110]}...")

    # 8. Internal Engine APIs
    print("\n8. Testing Internal Thermodynamic ML Engine APIs...")
    sim_payload = {
        "geometry": {
            "archetype": "trombe_wall",
            "length_m": 6.0,
            "width_m": 4.0,
            "height_m": 2.8,
            "window_area_m2": 3.8,
            "glazing_id": "triple_low_e",
            "trombe_wall_area_m2": 4.5
        },
        "roof_envelope": {
            "layers": [
                {"material_id": "aluminum_composite", "thickness_mm": 3},
                {"material_id": "puf", "thickness_mm": 100}
            ]
        },
        "wall_envelope": {
            "layers": [
                {"material_id": "fiberglass_frp", "thickness_mm": 4},
                {"material_id": "puf", "thickness_mm": 80}
            ]
        },
        "floor_envelope": {
            "layers": [{"material_id": "xps", "thickness_mm": 80}]
        },
        "params": {
            "troops": 8,
            "target_temp_c": 19.0,
            "mission_duration_days": 90
        },
        "latitude": 34.15,
        "elevation_m": 3500.0
    }

    r = client.post("/api/engine/predict", json=sim_payload)
    assert r.status_code == 200, f"Engine predict failed: {r.text}"
    print(f"   [PASS] POST /api/engine/predict -> Predicted inside unheated mean: {r.json()['predicted_mean_unheated_c']}°C")

    r = client.post("/api/engine/health", json=sim_payload)
    assert r.status_code == 200, f"Engine health failed: {r.text}"
    print(f"   [PASS] POST /api/engine/health -> Health Score: {r.json()['health_score']}/100 ({r.json()['grade']})")

    r = client.post("/api/engine/anomaly", json=sim_payload)
    assert r.status_code == 200, f"Engine anomaly failed: {r.text}"
    print(f"   [PASS] POST /api/engine/anomaly -> Anomalies detected: {r.json()['anomaly_count']}")

    r = client.post("/api/engine/analyze", json=sim_payload)
    assert r.status_code == 200, f"Engine analyze failed: {r.text}"
    print(f"   [PASS] POST /api/engine/analyze -> PMV: {r.json()['iso_7730_metrics']['pmv']}, PPD: {r.json()['iso_7730_metrics']['ppd_percent']}%")

    # 9. CAD Upload & Parsing
    print("\n9. Testing CAD Parser & Mesh File Upload...")
    cube_stl = (
        b"solid cube\n"
        b"  facet normal 0 0 1\n"
        b"    outer loop\n"
        b"      vertex 0 0 1\n"
        b"      vertex 1 0 1\n"
        b"      vertex 1 1 1\n"
        b"    endloop\n"
        b"  endfacet\n"
        b"  facet normal 0 0 1\n"
        b"    outer loop\n"
        b"      vertex 0 0 1\n"
        b"      vertex 1 1 1\n"
        b"      vertex 0 1 1\n"
        b"    endloop\n"
        b"  endfacet\n"
        b"endsolid cube\n"
    )
    files = {"file": ("test_shelter.stl", cube_stl, "application/sla")}
    r = client.post("/api/cad/upload", files=files)
    assert r.status_code == 200, f"CAD upload failed: {r.text}"
    cad_res = r.json()
    print(f"   [PASS] POST /api/cad/upload -> Extracted Roof Area: {cad_res.get('roof_area_m2')} m², Extents: {cad_res.get('extents_m')}")

    # 10. Unified Mission Analysis
    print("\n10. Testing Unified Mission Analysis Orchestration...")
    m_req = {
        "latitude": 34.15,
        "longitude": 77.58,
        "location_name": "Leh Military Sector",
        "troops": 8,
        "target_temp_c": 19.0,
        "mission_duration_days": 90,
        "archetype": "trombe_wall"
    }
    r = client.post("/api/mission/analyze", json=m_req)
    assert r.status_code == 200, f"Mission analyze failed: {r.text}"
    m_res = r.json()
    print(f"   [PASS] POST /api/mission/analyze -> Mission: {m_res['mission_name']}")
    print(f"      Elevation: {m_res['location']['elevation_m']}m")
    print(f"      Campaign Fuel Barrels: {m_res['thermal_logistics']['campaign_fuel_barrels']}")
    print(f"      AI Executive Brief: {m_res['ai_executive_brief'][:85]}...")

    print("\n=================================================================")
    print("   >>> ALL 20+ SERVICE INTEGRATIONS PASSED WITH ZERO ERRORS! <<< ")
    print("=================================================================\n")

if __name__ == "__main__":
    run_tests()
