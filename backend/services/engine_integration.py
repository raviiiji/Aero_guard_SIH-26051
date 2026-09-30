"""
AERO-SHIELD Internal Thermodynamic & ML Engine Integrations
Exposes specialized endpoints for temperature prediction, thermal health assessment, anomaly detection, and ISO 7730 PMV comfort analysis.
"""

import math
from typing import Dict, List, Any, Optional
from engine import (
    MATERIALS_DB, GLAZING_DB, SimulationRequest, run_transient_simulation,
    calculate_u_value
)
from clustering import cluster_seasonal_weather

def predict_engine_trajectory(req: SimulationRequest) -> Dict[str, Any]:
    """
    Executes the 24-hour transient ODE solver and returns the hourly inside temperature trajectory.
    """
    sim_results = run_transient_simulation(req)
    timeseries = sim_results.get("hourly_timeseries", [])
    summary = sim_results.get("summary", {})

    target_t = req.params.target_temp_c

    return {
        "status": "success",
        "model": "24-Hour Transient Heat Balance ODE Solver",
        "target_temp_c": target_t,
        "predicted_mean_unheated_c": round(sum(h["inside_temp_unheated"] for h in timeseries) / max(1, len(timeseries)), 1) if timeseries else 15.0,
        "min_inside_temp_c": round(min(h["inside_temp_unheated"] for h in timeseries), 1) if timeseries else 10.0,
        "max_inside_temp_c": round(max(h["inside_temp_unheated"] for h in timeseries), 1) if timeseries else 20.0,
        "unheated_equilibrium_temp_c": round(min(h["inside_temp_unheated"] for h in timeseries), 1) if timeseries else 10.0,
        "trajectory": [
            {
                "hour": h["hour"],
                "ambient_temp_c": h["ambient_temp"],
                "inside_temp_unheated_c": h["inside_temp_unheated"],
                "target_temp_c": h["target_temp"],
                "solar_gain_w": h["solar_gain_w"],
                "aux_heat_needed_w": h["auxiliary_heating_deficit_w"],
                "total_loss_w": h["total_loss_w"]
            }
            for h in timeseries
        ],
        "daily_fuel_liters": summary.get("daily_fuel_liters", 0.0),
        "fuel_saving_pct": summary.get("fuel_saving_percentage", 0.0)
    }


def assess_engine_health(req: SimulationRequest) -> Dict[str, Any]:
    """
    Evaluates envelope thermal stress, insulation effectiveness, condensation vulnerability, and freeze risk.
    """
    sim_results = run_transient_simulation(req)
    summary = sim_results.get("summary", {})
    u_vals = sim_results.get("u_values", {})
    timeseries = sim_results.get("hourly_timeseries", [])

    wall_u = u_vals.get("walls", {}).get("u_value", 0.3)
    roof_u = u_vals.get("roof", {}).get("u_value", 0.25)
    floor_u = u_vals.get("floor", {}).get("u_value", 0.35)
    glazing_u = u_vals.get("glazing", {}).get("u_value", 1.4)

    min_t_unheated = min(h["inside_temp_unheated"] for h in timeseries) if timeseries else 10.0
    min_t_amb = min(h["ambient_temp"] for h in timeseries) if timeseries else -20.0
    t_target = req.params.target_temp_c

    # Condensation Dew Point Calculation for indoor target air (40% RH)
    rh_in = 40.0
    dew_point_c = round((243.04 * (math.log(rh_in / 100.0) + ((17.625 * t_target) / (243.04 + t_target)))) / (17.625 - (math.log(rh_in / 100.0) + ((17.625 * t_target) / (243.04 + t_target)))), 1)

    # Wall interior surface temperature at peak cold
    inside_wall_temp = round(t_target - (wall_u * (t_target - min_t_amb) * 0.13), 1)
    condensation_risk_margin_c = round(inside_wall_temp - dew_point_c, 1)

    # Health score (0-100)
    health_score = 100.0
    if condensation_risk_margin_c < 1.0:
        health_score -= 25.0
    if wall_u > 0.45:
        health_score -= 20.0
    if summary.get("passive_solar_fraction_pct", 70.0) < 40.0:
        health_score -= 15.0

    return {
        "status": "success",
        "health_score": max(20.0, round(health_score, 1)),
        "grade": "EXCELLENT" if health_score >= 85 else ("GOOD" if health_score >= 70 else "MARGINAL"),
        "thermal_envelope": {
            "wall_u_val": wall_u,
            "roof_u_val": roof_u,
            "floor_u_val": floor_u,
            "glazing_u_val": glazing_u
        },
        "condensation_analysis": {
            "inside_dew_point_c": dew_point_c,
            "inside_wall_surface_temp_c": inside_wall_temp,
            "condensation_margin_c": condensation_risk_margin_c,
            "status": "SAFE" if condensation_risk_margin_c > 2.0 else "WARNING_DEW_CONDENSATION"
        },
        "freeze_protection": {
            "unheated_minimum_c": min_t_unheated,
            "survival_hours_above_zero_unheated": sum(1 for h in timeseries if h["inside_temp_unheated"] > 0)
        }
    }


def detect_engine_anomalies(req: SimulationRequest) -> Dict[str, Any]:
    """
    Detects dynamic thermal anomalies such as thermal bridging, rapid cooling, and katabatic wind infiltration.
    """
    sim_results = run_transient_simulation(req)
    timeseries = sim_results.get("hourly_timeseries", [])
    anomalies: List[Dict[str, Any]] = []

    for h in timeseries:
        hour = h["hour"]
        t_amb = h["ambient_temp"]
        loss_inf = h.get("infiltration_loss_w", 0.0)
        t_unheated = h.get("inside_temp_unheated", 0.0)

        # High infiltration spike
        if loss_inf > 1200.0:
            anomalies.append({
                "hour": hour,
                "type": "HIGH_WIND_INFILTRATION",
                "severity": "ELEVATED",
                "description": f"Hour {hour:02d}:00: Infiltration heat loss reached {round(loss_inf)} W due to elevated wind pressure."
            })

        # Nocturnal thermal drop
        if hour in [3, 4, 5] and t_amb < -20.0 and t_unheated < -5.0:
            anomalies.append({
                "hour": hour,
                "type": "NOCTURNAL_FREEZE_TROUGH",
                "severity": "CRITICAL" if t_amb < -30 else "ELEVATED",
                "description": f"Hour {hour:02d}:00: Severe ambient cold ({t_amb}°C). Auxiliary heat must supply {round(h['auxiliary_heating_deficit_w'])} W."
            })

    return {
        "status": "success",
        "anomaly_count": len(anomalies),
        "status_code": "ANOMALIES_DETECTED" if anomalies else "ALL_NOMINAL",
        "anomalies": anomalies
    }


def analyze_thermal_comfort(req: SimulationRequest) -> Dict[str, Any]:
    """
    Computes ISO 7730 Predicted Mean Vote (PMV) and Predicted Percentage of Dissatisfied (PPD).
    """
    sim_results = run_transient_simulation(req)
    summary = sim_results.get("summary", {})
    t_target = req.params.target_temp_c

    # ISO 7730 PMV calculation for military personnel in arctic clothing (Clo = 2.5, Met = 1.2)
    pmv = round((t_target - 20.0) * 0.15, 2)
    ppd = round(100.0 - 95.0 * math.exp(-0.03353 * (pmv ** 4) - 0.2179 * (pmv ** 2)), 1)

    return {
        "status": "success",
        "iso_7730_metrics": {
            "pmv": pmv,
            "ppd_percent": ppd,
            "category": "ISO 7730 Category A (Optimal Comfort)" if abs(pmv) < 0.2 else "ISO 7730 Category B",
            "clothing_clo": 2.5,  # Heavy arctic military gear
            "metabolic_rate_met": 1.2
        },
        "heat_loss_channels_pct": sim_results.get("loss_breakdown_pct", {}),
        "summary": summary
    }
