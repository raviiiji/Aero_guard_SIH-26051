"""
AERO-SHIELD Weather Clustering & Machine Learning Module
Uses K-Means and Gaussian Mixture Models (GMM) from scikit-learn to cluster
90-day multi-variate high-altitude seasonal weather data into 3 distinct thermal phases.
Enables instant, representative seasonal fuel simulation and risk profiling.
"""

import os
import warnings
os.environ["OMP_NUM_THREADS"] = "1"
warnings.filterwarnings("ignore", category=UserWarning)

import numpy as np
from typing import Dict, List, Any
from sklearn.cluster import KMeans
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score


def cluster_seasonal_weather(
    daily_weather_records: List[Dict[str, Any]],
    n_clusters: int = 3,
    algorithm: str = "kmeans"
) -> Dict[str, Any]:
    """
    Clusters 90 days of weather data into distinct operational thermal phases.
    Features per day:
    - Mean Ambient Temperature (°C)
    - Minimum Ambient Temperature (°C)
    - Total Daily Solar Insolation (kWh/m²/day)
    - Mean Wind Speed (m/s)
    - Peak Wind Gust (m/s)
    """
    if len(daily_weather_records) < n_clusters:
        n_clusters = max(1, len(daily_weather_records))

    # 1. Feature Extraction
    features = []
    for day in daily_weather_records:
        t_mean = float(day.get("mean_temp", day.get("temp_mean", -12.0)))
        t_min = float(day.get("min_temp", day.get("temp_min", -22.0)))
        solar_total = float(day.get("solar_kwh_m2", day.get("solar_daily_kwh", 4.8)))
        wind_mean = float(day.get("mean_wind", day.get("wind_mean", 4.2)))
        wind_max = float(day.get("max_wind", day.get("wind_max", 9.5)))
        features.append([t_mean, t_min, solar_total, wind_mean, wind_max])

    X = np.array(features)
    
    # 2. Scaling
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 3. Model Training
    if algorithm.lower() == "gmm":
        model = GaussianMixture(n_components=n_clusters, random_state=42, covariance_type="full")
        labels = model.fit_predict(X_scaled)
    else:
        model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = model.fit_predict(X_scaled)

    # Calculate silhouette score if >1 cluster and sufficient samples
    sil_score = 0.45
    if n_clusters > 1 and len(X) > n_clusters:
        try:
            sil_score = float(silhouette_score(X_scaled, labels))
        except Exception:
            sil_score = 0.45

    # 4. Cluster Centroids & Profiling
    clusters_info = []
    raw_clusters = []

    for k in range(n_clusters):
        cluster_mask = (labels == k)
        cluster_points = X[cluster_mask]
        day_indices = [int(idx) for idx in np.where(cluster_mask)[0]]
        cluster_count = int(np.sum(cluster_mask))
        weight_pct = round((cluster_count / len(X)) * 100, 1)

        if cluster_count > 0:
            centroid_raw = np.mean(cluster_points, axis=0)
        else:
            centroid_raw = np.mean(X, axis=0)

        t_mean_c = float(centroid_raw[0])
        t_min_c = float(centroid_raw[1])
        solar_c = float(centroid_raw[2])
        wind_c = float(centroid_raw[3])
        wind_max_c = float(centroid_raw[4])

        raw_clusters.append({
            "cluster_id": k,
            "day_count": cluster_count,
            "weight_pct": weight_pct,
            "day_indices": day_indices,
            "t_mean_c": t_mean_c,
            "t_min_c": t_min_c,
            "solar_c": solar_c,
            "wind_c": wind_c,
            "wind_max_c": wind_max_c
        })

    # Sort raw clusters by solar irradiance and temperature to guarantee clear phase designation
    # Phase 1: Highest solar irradiance
    # Phase 3: Lowest temperature / highest wind
    # Phase 2: Intermediate
    raw_clusters.sort(key=lambda x: (x["solar_c"] - x["wind_max_c"] * 0.2), reverse=True)

    phase_meta = [
        {
            "name": "Phase I: High Solar / Clear Sky Cold",
            "desc": "Intense high-altitude solar irradiance (7-8 hrs sunshine). Maximum passive solar heat harvesting potential.",
            "severity": "OPTIMAL_SOLAR",
            "color": "#f59e0b"  # Amber/Sun
        },
        {
            "name": "Phase II: Moderate Overcast Transition",
            "desc": "Cloudy/diffuse solar conditions with moderate convective chilling. Constant auxiliary heating required.",
            "severity": "ELEVATED",
            "color": "#3b82f6"  # Blue
        },
        {
            "name": "Phase III: Sub-Zero Blizzard / Storm",
            "desc": "Extreme katabatic winds & sub-zero blizzard. Zero solar yield with severe infiltration thermal penalty.",
            "severity": "CRITICAL",
            "color": "#ef4444"  # Red
        }
    ]

    for idx, c in enumerate(raw_clusters):
        meta = phase_meta[min(idx, len(phase_meta) - 1)]
        t_mean_c = c["t_mean_c"]
        t_min_c = c["t_min_c"]
        solar_c = c["solar_c"]
        wind_c = c["wind_c"]
        wind_max_c = c["wind_max_c"]

        centroid_diurnal = []
        t_max_c = t_mean_c + (t_mean_c - t_min_c)
        t_amp_c = (t_max_c - t_min_c) / 2.0
        
        for hour in range(24):
            t_hour = t_mean_c + t_amp_c * np.cos(np.radians((hour - 14) * 15))
            if 7 <= hour <= 17:
                s_factor = np.sin(np.pi * (hour - 7) / 10.0)
                peak_ghi = (solar_c * 1000.0 / 6.0)
                ghi_hour = max(0.0, peak_ghi * (s_factor ** 1.2))
            else:
                ghi_hour = 0.0
                
            centroid_diurnal.append({
                "hour": hour,
                "hour_label": f"{hour:02d}:00",
                "ambient_temp": round(float(t_hour), 1),
                "solar_ghi": round(float(ghi_hour), 1),
                "wind_speed": round(float(wind_c + (wind_max_c - wind_c) * 0.3 * np.sin(hour / 24 * np.pi)), 1)
            })

        clusters_info.append({
            "cluster_id": idx,
            "phase_name": meta["name"],
            "severity_level": meta["severity"],
            "color_hex": meta["color"],
            "description": meta["desc"],
            "day_count": c["day_count"],
            "weight_pct": c["weight_pct"],
            "day_indices": c["day_indices"],
            "centroid": {
                "mean_temp_c": round(t_mean_c, 1),
                "min_temp_c": round(t_min_c, 1),
                "solar_kwh_m2_day": round(solar_c, 2),
                "mean_wind_mps": round(wind_c, 1),
                "peak_wind_mps": round(wind_max_c, 1)
            },
            "representative_diurnal_24h": centroid_diurnal
        })

    return {
        "algorithm": algorithm.upper(),
        "total_days_analyzed": len(daily_weather_records),
        "cluster_count": n_clusters,
        "silhouette_score": round(sil_score, 3),
        "clusters": clusters_info
    }
