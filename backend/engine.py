"""
AERO-SHIELD Thermodynamic Engine
Physics and heat transfer simulator for extreme high-altitude military shelters.
Includes:
- Multi-layer composite envelope U-value calculation
- Sol-Air and direct fenestration solar radiation models
- Dynamic 24-hour transient thermal balance differential solver
- Infiltration loss accounting for high-altitude wind pressure
- Metabolic and equipment internal heat generation
- Trombe wall thermal storage lag and Earth-berming ground damping
- Fossil fuel logistics translation (Arctic diesel/kerosene, barrels, logistics convoy burden)
"""

import math
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Material Database
# ---------------------------------------------------------------------------
MATERIALS_DB = {
    "aerogel": {
        "name": "Aerogel Blanket (Pyrogel/Cryogel)",
        "k": 0.014,  # W/m·K
        "density": 160.0,  # kg/m³
        "cp": 1000.0,  # J/kg·K
        "cost_per_m2_100mm": 4800,  # INR
        "embodied_co2_kg_m3": 18.0,
        "category": "insulation",
        "description": "Ultra-lightweight nanoporous silica aerogel. World-class thermal insulation for extreme arctic conditions."
    },
    "vip": {
        "name": "Vacuum Insulation Panel (VIP)",
        "k": 0.004,
        "density": 190.0,
        "cp": 800.0,
        "cost_per_m2_100mm": 7500,
        "embodied_co2_kg_m3": 25.0,
        "category": "insulation",
        "description": "State-of-the-art evacuated core panel with virtually zero gas conduction. Exceptional for space-constrained shelters."
    },
    "puf": {
        "name": "Polyurethane Foam (PUF / PIR Rigid)",
        "k": 0.022,
        "density": 40.0,
        "cp": 1400.0,
        "cost_per_m2_100mm": 1800,
        "embodied_co2_kg_m3": 70.0,
        "category": "insulation",
        "description": "Standard military sandwich panel insulation. Rigid, moisture-resistant, excellent strength-to-weight ratio."
    },
    "xps": {
        "name": "Extruded Polystyrene (XPS)",
        "k": 0.030,
        "density": 35.0,
        "cp": 1500.0,
        "cost_per_m2_100mm": 1400,
        "embodied_co2_kg_m3": 65.0,
        "category": "insulation",
        "description": "High compressive strength foam ideal for sub-floor ground insulation and perimeter frost protection."
    },
    "rockwool": {
        "name": "Mineral Rockwool High-Density",
        "k": 0.038,
        "density": 100.0,
        "cp": 840.0,
        "cost_per_m2_100mm": 1100,
        "embodied_co2_kg_m3": 22.0,
        "category": "insulation",
        "description": "Non-combustible volcanic rock fiber. Superior acoustic dampening and A1 fire rating."
    },
    "canvas_insulated": {
        "name": "Multi-Layer Insulated Military Canvas",
        "k": 0.120,
        "density": 350.0,
        "cp": 1200.0,
        "cost_per_m2_100mm": 950,
        "embodied_co2_kg_m3": 12.0,
        "category": "fabric",
        "description": "High-tensile waterproof canvas with quilted synthetic batting. Traditional deployable tent envelope."
    },
    "aluminum_composite": {
        "name": "Aluminum Composite Panel (ACP Shell)",
        "k": 1.200,
        "density": 1800.0,
        "cp": 900.0,
        "cost_per_m2_100mm": 2200,
        "embodied_co2_kg_m3": 140.0,
        "category": "sheathing",
        "description": "Durable external protective cladding with solar reflective coating."
    },
    "fiberglass_frp": {
        "name": "Fiberglass Reinforced Polymer (FRP)",
        "k": 0.300,
        "density": 1500.0,
        "cp": 1100.0,
        "cost_per_m2_100mm": 1900,
        "embodied_co2_kg_m3": 45.0,
        "category": "sheathing",
        "description": "Lightweight composite skin offering high impact resistance and low thermal bridging."
    },
    "rammed_earth": {
        "name": "Local Stone / Rammed Earth (Trombe Mass)",
        "k": 0.900,
        "density": 2100.0,
        "cp": 1000.0,
        "cost_per_m2_100mm": 400,
        "embodied_co2_kg_m3": 5.0,
        "category": "thermal_mass",
        "description": "High thermal capacitance native Himalayan stone/earth masonry. Provides 6-8 hour thermal lag."
    }
}

GLAZING_DB = {
    "triple_low_e": {
        "name": "Triple-Glazed Argon Low-E (Military Grade)",
        "u_value": 0.80,  # W/m²·K
        "shgc": 0.52,     # Solar Heat Gain Coefficient
        "cost_per_m2": 6500,
        "description": "Superior triple pane with krypton/argon fill and dual Low-E coatings for maximum solar gain and zero frost condensation."
    },
    "double_low_e": {
        "name": "Double-Glazed Low-E Argon",
        "u_value": 1.40,
        "shgc": 0.65,
        "cost_per_m2": 3800,
        "description": "Standard high-performance insulated glass unit."
    },
    "polycarbonate_multiwall": {
        "name": "Multiwall Polycarbonate (16mm UV-Protected)",
        "u_value": 1.80,
        "shgc": 0.72,
        "cost_per_m2": 2200,
        "description": "Impact resistant, shatterproof lightweight glazing ideal for forward operating tactical shelters."
    },
    "single_clear": {
        "name": "Single Pane Glass (Baseline/Legacy)",
        "u_value": 5.80,
        "shgc": 0.85,
        "cost_per_m2": 1100,
        "description": "Legacy single glazing with extreme conductive heat loss."
    }
}

# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------
class LayerSpec(BaseModel):
    material_id: str
    thickness_mm: float = Field(gt=0, description="Thickness in millimeters")

class EnvelopeSection(BaseModel):
    layers: List[LayerSpec]

class ShelterGeometry(BaseModel):
    archetype: str = "modular_box"  # modular_box, trombe_wall, earth_bermed, quonset_dome, custom_cad
    length_m: float = 6.0
    width_m: float = 4.0
    height_m: float = 2.8
    roof_pitch_deg: float = 15.0
    window_area_m2: float = 3.5
    glazing_id: str = "triple_low_e"
    window_orientation_deg: float = 180.0  # 180 = South facing (optimal for northern hemisphere Ladakh)
    trombe_wall_area_m2: float = 0.0
    earth_bermed_depth_m: float = 0.0

class SimulationParameters(BaseModel):
    troops: int = 8
    target_temp_c: float = 19.0  # DGQA / DRDO military comfort standard
    mission_duration_days: int = 90
    infiltration_ach_base: float = 0.45  # Air changes per hour for well-sealed shelter
    equipment_heat_w: float = 150.0  # Radios, GPS, tactical tactical gear
    burner_efficiency: float = 0.82  # Standard Bukhari / Arctic diesel burner efficiency
    diesel_energy_density_kwh_l: float = 10.6  # kWh per liter of arctic diesel / kerosene SKO

class SimulationRequest(BaseModel):
    geometry: ShelterGeometry
    roof_envelope: EnvelopeSection
    wall_envelope: EnvelopeSection
    floor_envelope: EnvelopeSection
    params: SimulationParameters
    hourly_weather: Optional[List[Dict[str, float]]] = None  # 24 hours of ambient_temp, solar_ghi, wind_speed
    latitude: float = 34.15  # Leh, Ladakh default
    elevation_m: float = 3500.0


# ---------------------------------------------------------------------------
# Engine Physics Functions
# ---------------------------------------------------------------------------
def calculate_u_value(envelope: EnvelopeSection, is_roof: bool = False, is_floor: bool = False) -> Dict[str, Any]:
    """
    Calculates overall thermal transmittance U (W/m²K), total R-value (m²K/W),
    weight per m² (kg/m²), and cost per m² (INR).
    Standard boundary film resistances:
    - Internal surface R_si: 0.13 (walls/roof), 0.17 (floor)
    - External surface R_so: 0.04 (high wind exterior)
    """
    r_si = 0.17 if is_floor else 0.13
    r_so = 0.00 if is_floor else 0.04  # ground contact has no wind film
    
    r_material = 0.0
    total_weight_per_m2 = 0.0
    total_cost_per_m2 = 0.0
    total_thickness_m = 0.0
    heat_capacity_per_m2 = 0.0  # J/m²K
    
    for layer in envelope.layers:
        mat = MATERIALS_DB.get(layer.material_id, MATERIALS_DB["puf"])
        d_m = layer.thickness_mm / 1000.0
        total_thickness_m += d_m
        
        # Thermal resistance R = d / k
        r_layer = d_m / max(mat["k"], 0.001)
        r_material += r_layer
        
        # Weight = density * thickness
        weight = mat["density"] * d_m
        total_weight_per_m2 += weight
        
        # Heat capacity = density * thickness * Cp
        heat_capacity_per_m2 += weight * mat["cp"]
        
        # Cost estimate
        cost_unit = (mat["cost_per_m2_100mm"] / 0.1) * d_m
        total_cost_per_m2 += cost_unit
        
    r_total = r_si + r_material + r_so
    u_value = 1.0 / max(r_total, 0.01)
    
    return {
        "u_value": round(u_value, 4),
        "r_value": round(r_total, 4),
        "thickness_mm": round(total_thickness_m * 1000, 1),
        "weight_per_m2": round(total_weight_per_m2, 2),
        "cost_per_m2": round(total_cost_per_m2, 2),
        "heat_capacity_per_m2": round(heat_capacity_per_m2, 1)
    }


def compute_geometry_metrics(geom: ShelterGeometry) -> Dict[str, float]:
    """
    Computes floor area, wall area, roof area, volume, and solar orientation factors.
    Supports modular box, trombe wall, earth bermed, and quonset dome archetypes.
    """
    l = geom.length_m
    w = geom.width_m
    h = geom.height_m
    pitch_rad = math.radians(geom.roof_pitch_deg)
    
    floor_area = l * w
    
    if geom.archetype == "quonset_dome":
        # Semicircular arch profile
        radius = w / 2.0
        arch_perimeter = math.pi * radius
        roof_wall_area = arch_perimeter * l
        end_wall_area = 2 * (0.5 * math.pi * (radius ** 2))
        total_wall_area = end_wall_area
        roof_area = roof_wall_area
        volume = 0.5 * math.pi * (radius ** 2) * l
    else:
        # Pitched or Flat Box
        roof_area = (l * (w / (2.0 * math.cos(pitch_rad)))) * 2.0 if geom.roof_pitch_deg > 0 else (l * w)
        gross_wall_area = 2 * (l * h) + 2 * (w * h)
        if geom.roof_pitch_deg > 0:
            # Gable triangular infill area
            gable_area = 2 * (0.5 * w * (0.5 * w * math.tan(pitch_rad)))
            gross_wall_area += gable_area
            
        net_wall_area = max(0.0, gross_wall_area - geom.window_area_m2 - geom.trombe_wall_area_m2)
        total_wall_area = net_wall_area
        
        # Volume
        volume = (l * w * h) + (0.5 * l * w * (0.5 * w * math.tan(pitch_rad)) if geom.roof_pitch_deg > 0 else 0)
        
    # Earth berming adjustment: earth contact dampens exposed wall area
    if geom.earth_bermed_depth_m > 0 and h > 0:
        berm_ratio = min(1.0, geom.earth_bermed_depth_m / h)
        bermed_wall_area = (2 * l + w) * geom.earth_bermed_depth_m  # 3 sides bermed, south exposed
        exposed_wall_area = max(1.0, total_wall_area - bermed_wall_area)
    else:
        bermed_wall_area = 0.0
        exposed_wall_area = total_wall_area
        
    return {
        "floor_area": round(floor_area, 2),
        "roof_area": round(roof_area, 2),
        "wall_area_exposed": round(exposed_wall_area, 2),
        "wall_area_bermed": round(bermed_wall_area, 2),
        "window_area": round(geom.window_area_m2, 2),
        "trombe_area": round(geom.trombe_wall_area_m2, 2),
        "volume": round(volume, 2),
        "total_envelope_area": round(floor_area + roof_area + exposed_wall_area + bermed_wall_area + geom.window_area_m2, 2)
    }


def generate_ladakh_diurnal_weather(latitude: float = 34.15, elevation_m: float = 3500.0) -> List[Dict[str, float]]:
    """
    Generates high-accuracy 24-hour winter diurnal profile for Ladakh / Himalayan Cold Arid high altitude.
    Diurnal swing: Min -22°C at 06:00, Max -4°C at 14:00.
    Solar peak irradiance: ~950 W/m² at 12:30 (Intense clear sky UV/solar radiation).
    """
    profile = []
    t_min = -22.0
    t_max = -4.0
    t_mean = (t_max + t_min) / 2.0
    t_amp = (t_max - t_min) / 2.0
    
    for hour in range(24):
        # Diurnal temperature sinusoidal wave with minimum at sunrise (06:00) and peak at 14:00
        temp = t_mean + t_amp * math.cos(math.radians((hour - 14) * 15))
        
        # Solar radiation model for clear high altitude
        if 7 <= hour <= 17:
            # Solar elevation angle factor
            solar_factor = math.sin(math.pi * (hour - 7) / 10.0)
            solar_ghi = max(0.0, 920.0 * (solar_factor ** 1.15))
            solar_dni = max(0.0, 1020.0 * (solar_factor ** 1.1))
        else:
            solar_ghi = 0.0
            solar_dni = 0.0
            
        # Mountain katabatic wind cycle: stronger in late afternoon
        wind_speed = 3.5 + 4.5 * math.sin(math.pi * max(0, hour - 10) / 12.0)
        
        profile.append({
            "hour": hour,
            "ambient_temp": round(temp, 2),
            "solar_ghi": round(solar_ghi, 1),
            "solar_dni": round(solar_dni, 1),
            "wind_speed": round(wind_speed, 1),
            "relative_humidity": 28.0  # Typical dry Ladakh winter
        })
    return profile


def run_transient_simulation(req: SimulationRequest) -> Dict[str, Any]:
    """
    Executes the comprehensive 24-hour differential transient thermal simulation.
    """
    # 1. Envelope U-values & Properties
    roof_prop = calculate_u_value(req.roof_envelope, is_roof=True)
    wall_prop = calculate_u_value(req.wall_envelope)
    floor_prop = calculate_u_value(req.floor_envelope, is_floor=True)
    
    glazing = GLAZING_DB.get(req.geometry.glazing_id, GLAZING_DB["triple_low_e"])
    u_glazing = glazing["u_value"]
    shgc = glazing["shgc"]
    
    # 2. Geometry Metrics
    geom = compute_geometry_metrics(req.geometry)
    
    # 3. Thermal Capacitance (Thermal Mass)
    # C_total = Sum(Area * Heat_Capacity_per_m2) + Air_Heat_Capacity + Interior furniture/Troop mass
    c_envelope = (
        geom["roof_area"] * roof_prop["heat_capacity_per_m2"] +
        geom["wall_area_exposed"] * wall_prop["heat_capacity_per_m2"] +
        geom["floor_area"] * floor_prop["heat_capacity_per_m2"]
    )
    
    # Trombe wall dedicated mass (if enabled, adds 200mm stone mass)
    if req.geometry.trombe_wall_area_m2 > 0:
        trombe_mat = MATERIALS_DB["rammed_earth"]
        c_trombe = req.geometry.trombe_wall_area_m2 * (0.20 * trombe_mat["density"] * trombe_mat["cp"])
        c_envelope += c_trombe
        
    c_air = geom["volume"] * 1.204 * 1005.0  # Volume * rho_air * Cp_air
    c_total = max(c_envelope * 0.4 + c_air + (req.params.troops * 70.0 * 3500.0), 500000.0) # J/K effective internal thermal capacitance
    
    # 4. Hourly Weather Data
    weather = req.hourly_weather if req.hourly_weather and len(req.hourly_weather) == 24 else generate_ladakh_diurnal_weather(req.latitude, req.elevation_m)
    
    # 5. Hourly Transient Loop
    hourly_results = []
    
    # Steady state initial temperature estimation
    t_inside_unheated = weather[0]["ambient_temp"] + 3.0
    t_target = req.params.target_temp_c
    
    total_daily_heat_loss_kwh = 0.0
    total_daily_solar_gain_kwh = 0.0
    total_daily_metabolic_gain_kwh = 0.0
    total_daily_deficit_kwh = 0.0
    
    # Loss breakdown accumulators (Watts * 1h = Wh)
    loss_walls_wh = 0.0
    loss_roof_wh = 0.0
    loss_floor_wh = 0.0
    loss_windows_wh = 0.0
    loss_infiltration_wh = 0.0
    
    # Ground temperature at 2m depth in Ladakh winter is buffered around +1°C to +3°C
    t_ground = 2.0
    
    # Trombe wall thermal storage lag array (6 hour release lag)
    trombe_solar_stored = [0.0] * 24
    if req.geometry.trombe_wall_area_m2 > 0:
        for h_idx in range(24):
            ghi = weather[h_idx]["solar_ghi"]
            # Solar absorption into 0.90 absorptance dark masonry
            stored_w = req.geometry.trombe_wall_area_m2 * ghi * 0.85 * 0.60
            release_h = (h_idx + 6) % 24  # Released 6 hours later during freezing evening/night
            trombe_solar_stored[release_h] += stored_w
            
    # Run 2 diurnal cycles for transient state settling, record the 2nd cycle
    for cycle in range(2):
        for h_idx, w_data in enumerate(weather):
            t_amb = w_data["ambient_temp"]
            ghi = w_data["solar_ghi"]
            wind = w_data["wind_speed"]
            
            # --- Conduction Losses (based on target temperature for heating requirement) ---
            q_loss_roof = roof_prop["u_value"] * geom["roof_area"] * (t_target - t_amb)
            q_loss_wall_exp = wall_prop["u_value"] * geom["wall_area_exposed"] * (t_target - t_amb)
            # Bermed wall is in contact with soil (T_ground)
            q_loss_wall_berm = wall_prop["u_value"] * geom["wall_area_bermed"] * (t_target - t_ground) if geom["wall_area_bermed"] > 0 else 0.0
            q_loss_wall = q_loss_wall_exp + q_loss_wall_berm
            
            q_loss_floor = floor_prop["u_value"] * geom["floor_area"] * (t_target - t_ground)
            q_loss_win_cond = u_glazing * geom["window_area"] * (t_target - t_amb)
            
            # --- Infiltration / Air Change Losses ---
            # Effective ACH increases with high altitude mountain wind
            ach_eff = req.params.infiltration_ach_base + (0.02 * wind)
            q_loss_inf = 0.33 * ach_eff * geom["volume"] * (t_target - t_amb)
            
            total_loss_target = max(0.0, q_loss_roof + q_loss_wall + q_loss_floor + q_loss_win_cond + q_loss_inf)
            
            # --- Heat Gains ---
            # Solar Fenestration Gain (South facing orientation factor)
            orientation_factor = math.cos(math.radians(req.geometry.window_orientation_deg - 180.0))
            orientation_factor = max(0.2, orientation_factor)
            q_solar_win = geom["window_area"] * ghi * shgc * orientation_factor
            
            # Trombe wall lagged release
            q_trombe_release = trombe_solar_stored[h_idx]
            
            # Total Solar Contribution
            q_solar_total = q_solar_win + q_trombe_release
            
            # Internal Metabolic (85 W per resting troop) & Equipment
            q_metabolic = req.params.troops * 85.0
            q_equipment = req.params.equipment_heat_w
            q_internal_total = q_metabolic + q_equipment
            
            # Total Free Heat Gains
            total_gains = q_solar_total + q_internal_total
            
            # --- Net Auxiliary Deficit (Heating Power Required to stay at T_target) ---
            q_deficit_w = max(0.0, total_loss_target - total_gains)
            
            # --- Free Floating Inside Temperature (If unheated) ---
            # Conductance total for unheated free floating balance
            ua_total = (
                roof_prop["u_value"] * geom["roof_area"] +
                wall_prop["u_value"] * geom["wall_area_exposed"] +
                floor_prop["u_value"] * geom["floor_area"] +
                u_glazing * geom["window_area"] +
                (0.33 * ach_eff * geom["volume"])
            )
            
            # dt = 3600 seconds
            # C_total * dT/dt = Q_gains - UA * (T_in - T_amb)
            dt = 3600.0
            t_steady_equilibrium = t_amb + (total_gains / max(ua_total, 1.0))
            # Exponential decay towards equilibrium
            decay_factor = math.exp(- (ua_total * dt) / c_total)
            t_inside_unheated = t_inside_unheated * decay_factor + t_steady_equilibrium * (1.0 - decay_factor)
            
            if cycle == 1:
                # Accumulate for official daily report
                total_daily_heat_loss_kwh += (total_loss_target / 1000.0)
                total_daily_solar_gain_kwh += (q_solar_total / 1000.0)
                total_daily_metabolic_gain_kwh += (q_internal_total / 1000.0)
                total_daily_deficit_kwh += (q_deficit_w / 1000.0)
                
                loss_walls_wh += q_loss_wall
                loss_roof_wh += q_loss_roof
                loss_floor_wh += q_loss_floor
                loss_windows_wh += q_loss_win_cond
                loss_infiltration_wh += q_loss_inf
                
                hourly_results.append({
                    "hour": h_idx,
                    "hour_label": f"{h_idx:02d}:00",
                    "ambient_temp": round(t_amb, 1),
                    "inside_temp_unheated": round(t_inside_unheated, 1),
                    "target_temp": round(t_target, 1),
                    "solar_ghi": round(ghi, 1),
                    "solar_gain_w": round(q_solar_total, 1),
                    "internal_gain_w": round(q_internal_total, 1),
                    "total_loss_w": round(total_loss_target, 1),
                    "auxiliary_heating_deficit_w": round(q_deficit_w, 1),
                    "roof_loss_w": round(q_loss_roof, 1),
                    "wall_loss_w": round(q_loss_wall, 1),
                    "floor_loss_w": round(q_loss_floor, 1),
                    "window_loss_w": round(q_loss_win_cond, 1),
                    "infiltration_loss_w": round(q_loss_inf, 1)
                })

    # 6. Logistics & Fuel Calculations
    # 1 liter of Arctic Diesel = 10.6 kWh. With burner efficiency eta_b:
    fuel_liters_per_day = total_daily_deficit_kwh / (req.params.diesel_energy_density_kwh_l * req.params.burner_efficiency)
    campaign_days = req.params.mission_duration_days
    campaign_fuel_liters = fuel_liters_per_day * campaign_days
    campaign_fuel_barrels = math.ceil(campaign_fuel_liters / 200.0)  # Standard 200L military fuel drum
    
    # Baseline comparison (Traditional single canvas uninsulated shelter)
    # Baseline U_wall = 4.5, U_roof = 5.0, high infiltration ACH = 2.5
    baseline_ua = 5.0 * geom["roof_area"] + 4.5 * geom["wall_area_exposed"] + 3.0 * geom["floor_area"] + (0.33 * 2.5 * geom["volume"])
    avg_delta_t = t_target - (-13.0)  # Avg winter Ladakh temp
    baseline_power_w = max(1000.0, (baseline_ua * avg_delta_t) - (req.params.troops * 85.0))
    baseline_daily_kwh = (baseline_power_w * 24.0) / 1000.0
    baseline_fuel_daily = baseline_daily_kwh / (10.6 * 0.70)
    baseline_campaign_fuel = baseline_fuel_daily * campaign_days
    
    fuel_saved_liters = max(0.0, baseline_campaign_fuel - campaign_fuel_liters)
    fuel_saving_percentage = round((fuel_saved_liters / max(baseline_campaign_fuel, 1.0)) * 100, 1)
    
    # Total Shelter Weight for logistics transport
    total_shelter_weight_kg = (
        geom["roof_area"] * roof_prop["weight_per_m2"] +
        geom["wall_area_exposed"] * wall_prop["weight_per_m2"] +
        geom["floor_area"] * floor_prop["weight_per_m2"] +
        geom["window_area"] * 25.0 +  # Average glazing weight kg/m²
        350.0  # Structural frame & anchor bolts
    )
    
    # Total Construction Cost Estimate (INR)
    total_cost_inr = (
        geom["roof_area"] * roof_prop["cost_per_m2"] +
        geom["wall_area_exposed"] * wall_prop["cost_per_m2"] +
        geom["floor_area"] * floor_prop["cost_per_m2"] +
        geom["window_area"] * glazing["cost_per_m2"] +
        45000.0  # Hardware, hinges, airlock seals
    )
    
    # Total Loss Percentages
    total_loss_sum = max(1.0, (loss_walls_wh + loss_roof_wh + loss_floor_wh + loss_windows_wh + loss_infiltration_wh))
    loss_breakdown_pct = {
        "walls": round((loss_walls_wh / total_loss_sum) * 100, 1),
        "roof": round((loss_roof_wh / total_loss_sum) * 100, 1),
        "floor": round((loss_floor_wh / total_loss_sum) * 100, 1),
        "windows": round((loss_windows_wh / total_loss_sum) * 100, 1),
        "infiltration": round((loss_infiltration_wh / total_loss_sum) * 100, 1)
    }
    
    # Passive Solar Fraction (% of heating load supplied by sun)
    passive_solar_fraction = round(min(100.0, (total_daily_solar_gain_kwh / max(total_daily_heat_loss_kwh, 0.1)) * 100.0), 1)
    
    return {
        "summary": {
            "daily_deficit_kwh": round(total_daily_deficit_kwh, 2),
            "daily_fuel_liters": round(fuel_liters_per_day, 2),
            "campaign_fuel_liters": round(campaign_fuel_liters, 1),
            "campaign_fuel_barrels_200l": campaign_fuel_barrels,
            "baseline_campaign_fuel_liters": round(baseline_campaign_fuel, 1),
            "fuel_saved_liters": round(fuel_saved_liters, 1),
            "fuel_saving_percentage": fuel_saving_percentage,
            "co2_emissions_saved_kg": round(fuel_saved_liters * 2.68, 1),  # 2.68 kg CO2 per liter diesel
            "total_daily_heat_loss_kwh": round(total_daily_heat_loss_kwh, 2),
            "total_daily_solar_gain_kwh": round(total_daily_solar_gain_kwh, 2),
            "total_daily_metabolic_gain_kwh": round(total_daily_metabolic_gain_kwh, 2),
            "passive_solar_fraction_pct": passive_solar_fraction,
            "total_shelter_weight_kg": round(total_shelter_weight_kg, 1),
            "total_construction_cost_inr": round(total_cost_inr, 0),
            "shelters_needed_for_platoon": math.ceil(req.params.troops / max(1, req.params.troops))
        },
        "u_values": {
            "roof": roof_prop,
            "walls": wall_prop,
            "floor": floor_prop,
            "glazing": {
                "name": glazing["name"],
                "u_value": u_glazing,
                "shgc": shgc
            }
        },
        "geometry": geom,
        "loss_breakdown_pct": loss_breakdown_pct,
        "hourly_timeseries": hourly_results
    }
