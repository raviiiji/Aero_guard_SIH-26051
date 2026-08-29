"""
AERO-SHIELD Multi-Objective AI Recommender & Optimizer
Evaluates material combinations, insulation thicknesses, and structural archetypes
to identify Pareto-optimal shelter designs balancing Fuel Logistics, Transport Payload Weight, and Cost.
"""

from typing import Dict, List, Any
from engine import (
    MATERIALS_DB, GLAZING_DB, ShelterGeometry, EnvelopeSection, LayerSpec,
    SimulationParameters, SimulationRequest, run_transient_simulation
)


def run_multi_objective_optimization(
    troops: int = 8,
    target_temp_c: float = 19.0,
    mission_duration_days: int = 90,
    latitude: float = 34.15,
    elevation_m: float = 3500.0,
    hourly_weather: List[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Simulates a spectrum of structural archetypes and insulation stacks to construct
    the Pareto trade-off frontier.
    """
    # Define design candidate configurations
    candidate_configs = [
        {
            "id": "baseline_canvas",
            "name": "Legacy Deployable Canvas Tent (Baseline)",
            "archetype": "modular_box",
            "tag": "BASELINE",
            "description": "Standard military canvas tent with minimal synthetic lining. Extreme fuel penalty.",
            "wall_layers": [LayerSpec(material_id="canvas_insulated", thickness_mm=25)],
            "roof_layers": [LayerSpec(material_id="canvas_insulated", thickness_mm=25)],
            "floor_layers": [LayerSpec(material_id="canvas_insulated", thickness_mm=15)],
            "glazing_id": "single_clear",
            "window_area_m2": 1.5,
            "trombe_area_m2": 0.0,
            "earth_bermed_depth_m": 0.0
        },
        {
            "id": "puf_standard_box",
            "name": "Prefab Modular PUF Box (80mm)",
            "archetype": "modular_box",
            "tag": "STANDARD MILITARY",
            "description": "80mm Polyurethane sandwich panel with aluminum cladding. Rugged, quick assembly.",
            "wall_layers": [
                LayerSpec(material_id="aluminum_composite", thickness_mm=3),
                LayerSpec(material_id="puf", thickness_mm=80),
                LayerSpec(material_id="aluminum_composite", thickness_mm=3)
            ],
            "roof_layers": [
                LayerSpec(material_id="aluminum_composite", thickness_mm=3),
                LayerSpec(material_id="puf", thickness_mm=100),
                LayerSpec(material_id="aluminum_composite", thickness_mm=3)
            ],
            "floor_layers": [
                LayerSpec(material_id="xps", thickness_mm=80)
            ],
            "glazing_id": "double_low_e",
            "window_area_m2": 3.0,
            "trombe_area_m2": 0.0,
            "earth_bermed_depth_m": 0.0
        },
        {
            "id": "passive_trombe_wall",
            "name": "AERO-SHIELD Trombe Wall Solar Storage",
            "archetype": "trombe_wall",
            "tag": "BEST PASSIVE SOLAR",
            "description": "Combines South-facing high-capacitance Trombe stone wall (200mm) with 100mm PUF envelope. Stores daytime sun for 6-8h night release.",
            "wall_layers": [
                LayerSpec(material_id="fiberglass_frp", thickness_mm=4),
                LayerSpec(material_id="puf", thickness_mm=100),
                LayerSpec(material_id="fiberglass_frp", thickness_mm=4)
            ],
            "roof_layers": [
                LayerSpec(material_id="aluminum_composite", thickness_mm=3),
                LayerSpec(material_id="puf", thickness_mm=120),
                LayerSpec(material_id="fiberglass_frp", thickness_mm=4)
            ],
            "floor_layers": [
                LayerSpec(material_id="xps", thickness_mm=100)
            ],
            "glazing_id": "triple_low_e",
            "window_area_m2": 3.8,
            "trombe_area_m2": 6.0,
            "earth_bermed_depth_m": 0.0
        },
        {
            "id": "earth_bermed_bunker",
            "name": "Earth-Bermed Semi-Subterranean Bunker",
            "archetype": "earth_bermed",
            "tag": "EXTREME WIND / BLIZZARD",
            "description": "3 walls bermed into mountain hillside (2.0m soil cover). Reduces perimeter freeze and wind chill losses by 65%.",
            "wall_layers": [
                LayerSpec(material_id="rammed_earth", thickness_mm=150),
                LayerSpec(material_id="xps", thickness_mm=100),
                LayerSpec(material_id="fiberglass_frp", thickness_mm=4)
            ],
            "roof_layers": [
                LayerSpec(material_id="aluminum_composite", thickness_mm=4),
                LayerSpec(material_id="aerogel", thickness_mm=30),
                LayerSpec(material_id="puf", thickness_mm=80)
            ],
            "floor_layers": [
                LayerSpec(material_id="xps", thickness_mm=120)
            ],
            "glazing_id": "triple_low_e",
            "window_area_m2": 3.0,
            "trombe_area_m2": 0.0,
            "earth_bermed_depth_m": 2.0
        },
        {
            "id": "aerogel_ultralight",
            "name": "Aerogel Ultra-Lightweight Tactical Pod",
            "archetype": "modular_box",
            "tag": "AIRLIFT OPTIMIZED",
            "description": "Nanoporous Aerogel blankets with carbon/FRP skin. 60% lighter for helicopter sling loads while maintaining R-7 insulation.",
            "wall_layers": [
                LayerSpec(material_id="fiberglass_frp", thickness_mm=3),
                LayerSpec(material_id="aerogel", thickness_mm=40),
                LayerSpec(material_id="fiberglass_frp", thickness_mm=3)
            ],
            "roof_layers": [
                LayerSpec(material_id="fiberglass_frp", thickness_mm=3),
                LayerSpec(material_id="aerogel", thickness_mm=50),
                LayerSpec(material_id="fiberglass_frp", thickness_mm=3)
            ],
            "floor_layers": [
                LayerSpec(material_id="aerogel", thickness_mm=40),
                LayerSpec(material_id="xps", thickness_mm=50)
            ],
            "glazing_id": "polycarbonate_multiwall",
            "window_area_m2": 2.8,
            "trombe_area_m2": 0.0,
            "earth_bermed_depth_m": 0.0
        },
        {
            "id": "vip_maximum_insulation",
            "name": "VIP Deep-Arctic Zero-Deficit Shelter",
            "archetype": "trombe_wall",
            "tag": "MINIMUM FUEL CONSUMPTION",
            "description": "Vacuum Insulation Panels (VIP k=0.004) + Triple Argon Low-E fenestration. Achieves ultra-low U=0.12 W/m²K envelope.",
            "wall_layers": [
                LayerSpec(material_id="fiberglass_frp", thickness_mm=3),
                LayerSpec(material_id="vip", thickness_mm=35),
                LayerSpec(material_id="puf", thickness_mm=40),
                LayerSpec(material_id="fiberglass_frp", thickness_mm=3)
            ],
            "roof_layers": [
                LayerSpec(material_id="aluminum_composite", thickness_mm=3),
                LayerSpec(material_id="vip", thickness_mm=40),
                LayerSpec(material_id="puf", thickness_mm=50),
                LayerSpec(material_id="fiberglass_frp", thickness_mm=3)
            ],
            "floor_layers": [
                LayerSpec(material_id="vip", thickness_mm=30),
                LayerSpec(material_id="xps", thickness_mm=60)
            ],
            "glazing_id": "triple_low_e",
            "window_area_m2": 4.0,
            "trombe_area_m2": 5.0,
            "earth_bermed_depth_m": 0.0
        }
    ]

    sim_params = SimulationParameters(
        troops=troops,
        target_temp_c=target_temp_c,
        mission_duration_days=mission_duration_days
    )

    results = []
    
    # Scale dimension based on troop count (min 3.5m² per troop military standard)
    min_floor_area = max(18.0, troops * 3.2)
    l_m = round((min_floor_area * 1.5) ** 0.5, 1)
    w_m = round(min_floor_area / l_m, 1)
    h_m = 2.7

    for cand in candidate_configs:
        geom = ShelterGeometry(
            archetype=cand["archetype"],
            length_m=l_m,
            width_m=w_m,
            height_m=h_m,
            roof_pitch_deg=15.0,
            window_area_m2=cand["window_area_m2"],
            glazing_id=cand["glazing_id"],
            trombe_wall_area_m2=cand["trombe_area_m2"],
            earth_bermed_depth_m=cand["earth_bermed_depth_m"]
        )
        
        req = SimulationRequest(
            geometry=geom,
            roof_envelope=EnvelopeSection(layers=cand["roof_layers"]),
            wall_envelope=EnvelopeSection(layers=cand["wall_layers"]),
            floor_envelope=EnvelopeSection(layers=cand["floor_layers"]),
            params=sim_params,
            hourly_weather=hourly_weather,
            latitude=latitude,
            elevation_m=elevation_m
        )

        sim_output = run_transient_simulation(req)
        summary = sim_output["summary"]
        u_vals = sim_output["u_values"]

        results.append({
            "config_id": cand["id"],
            "name": cand["name"],
            "archetype": cand["archetype"],
            "tag": cand["tag"],
            "description": cand["description"],
            "glazing_name": u_vals["glazing"]["name"],
            "u_value_wall": u_vals["walls"]["u_value"],
            "u_value_roof": u_vals["roof"]["u_value"],
            "campaign_fuel_liters": summary["campaign_fuel_liters"],
            "campaign_fuel_barrels_200l": summary["campaign_fuel_barrels_200l"],
            "fuel_saved_liters": summary["fuel_saved_liters"],
            "fuel_saving_percentage": summary["fuel_saving_percentage"],
            "daily_fuel_liters": summary["daily_fuel_liters"],
            "passive_solar_fraction_pct": summary["passive_solar_fraction_pct"],
            "total_shelter_weight_kg": summary["total_shelter_weight_kg"],
            "total_cost_inr": summary["total_construction_cost_inr"],
            "co2_saved_kg": summary["co2_emissions_saved_kg"],
            "wall_layers": [l.model_dump() for l in cand["wall_layers"]],
            "roof_layers": [l.model_dump() for l in cand["roof_layers"]],
            "floor_layers": [l.model_dump() for l in cand["floor_layers"]],
            "window_area_m2": cand["window_area_m2"],
            "trombe_area_m2": cand["trombe_area_m2"],
            "earth_bermed_depth_m": cand["earth_bermed_depth_m"]
        })

    # Rank & identify Best Recommendations
    results_by_fuel = sorted(results, key=lambda x: x["campaign_fuel_liters"])
    results_by_weight = sorted(results, key=lambda x: x["total_shelter_weight_kg"])
    
    best_fuel_config = results_by_fuel[0]
    best_weight_config = results_by_weight[0]
    # Best overall trade-off: Trombe wall or PUF standard hybrid
    best_overall_config = next((r for r in results if r["config_id"] == "passive_trombe_wall"), results_by_fuel[1])

    return {
        "candidate_comparisons": results,
        "recommendations": {
            "best_overall": best_overall_config,
            "min_fuel_consumption": best_fuel_config,
            "lightweight_airlift": best_weight_config
        }
    }
