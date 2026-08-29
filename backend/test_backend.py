"""
Backend Verification Test for AERO-SHIELD
"""
import sys
import numpy as np
from engine import (
    LayerSpec, EnvelopeSection, ShelterGeometry, SimulationParameters,
    SimulationRequest, run_transient_simulation
)
from weather_service import fetch_weather_and_cluster
from optimizer import run_multi_objective_optimization
import trimesh
from cad_parser import parse_cad_mesh_file

def test_all():
    print("1. Testing Physics Engine...")
    geom = ShelterGeometry(
        archetype="trombe_wall",
        length_m=6.0,
        width_m=4.0,
        height_m=2.8,
        window_area_m2=3.5,
        glazing_id="triple_low_e",
        trombe_wall_area_m2=4.0
    )
    roof_env = EnvelopeSection(layers=[
        LayerSpec(material_id="aluminum_composite", thickness_mm=3),
        LayerSpec(material_id="puf", thickness_mm=100)
    ])
    wall_env = EnvelopeSection(layers=[
        LayerSpec(material_id="fiberglass_frp", thickness_mm=4),
        LayerSpec(material_id="puf", thickness_mm=80)
    ])
    floor_env = EnvelopeSection(layers=[
        LayerSpec(material_id="xps", thickness_mm=80)
    ])
    params = SimulationParameters(troops=8, target_temp_c=19.0, mission_duration_days=90)
    
    req = SimulationRequest(
        geometry=geom,
        roof_envelope=roof_env,
        wall_envelope=wall_env,
        floor_envelope=floor_env,
        params=params,
        latitude=34.15,
        elevation_m=3500.0
    )
    
    sim_res = run_transient_simulation(req)
    summary = sim_res["summary"]
    print(f"   Simulation OK! Daily deficit: {summary['daily_deficit_kwh']} kWh, Daily fuel: {summary['daily_fuel_liters']} L, 90-day barrels: {summary['campaign_fuel_barrels_200l']}")
    print(f"   Passive solar fraction: {summary['passive_solar_fraction_pct']}%, Fuel saved: {summary['fuel_saving_percentage']}%")

    print("\n2. Testing Weather Ingestion & ML Clustering...")
    weather_res = fetch_weather_and_cluster(34.15, 77.58, 3500.0, "kmeans")
    clustering = weather_res["clustering"]
    print(f"   Weather & ML OK! Silhouette Score: {clustering['silhouette_score']}, Clusters: {len(clustering['clusters'])}")
    for c in clustering["clusters"]:
        print(f"   -> [{c['severity_level']}] {c['phase_name']} ({c['weight_pct']}% of days) | Min T: {c['centroid']['min_temp_c']}°C, Solar: {c['centroid']['solar_kwh_m2_day']} kWh/m²")

    print("\n3. Testing Multi-Objective Optimizer...")
    opt_res = run_multi_objective_optimization(troops=8, target_temp_c=19.0, mission_duration_days=90)
    best = opt_res["recommendations"]["best_overall"]
    print(f"   Optimizer OK! Best Overall: {best['name']} | 90d Fuel: {best['campaign_fuel_liters']} L, Saved: {best['fuel_saving_percentage']}%")

    print("\n4. Testing Trimesh CAD Parser...")
    # Create sample box mesh
    box = trimesh.creation.box(extents=[6.0, 4.0, 2.8])
    stl_bytes = box.export(file_type="stl")
    cad_res = parse_cad_mesh_file(stl_bytes, "sample_shelter.stl")
    print(f"   CAD Parser OK! Extracted volume: {cad_res['dimensions']['volume_m3']} m³, Roof: {cad_res['surface_decomposition']['roof_area_m2']} m², Wall: {cad_res['surface_decomposition']['wall_area_m2']} m²")

    print("\n>>> ALL BACKEND TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_all()
