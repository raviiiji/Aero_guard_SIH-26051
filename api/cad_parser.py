"""
AERO-SHIELD CAD Geometry Parser
Extracts volume, surface areas, and normal vector face classifications from uploaded 3D CAD models (STL, OBJ, etc.) using trimesh.
"""

import io
import trimesh
import numpy as np
from typing import Dict, Any, Optional


def parse_cad_mesh_file(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Parses a 3D CAD mesh file and extracts thermal surface areas and volume.
    """
    file_ext = filename.split(".")[-1].lower() if "." in filename else "stl"
    
    # Load mesh with trimesh
    try:
        mesh = trimesh.load(io.BytesIO(file_bytes), file_type=file_ext)
    except Exception as e:
        # Fallback if multiple geometries or scene
        try:
            scene = trimesh.load(io.BytesIO(file_bytes), file_type=file_ext, force="mesh")
            mesh = scene
        except Exception as e2:
            raise ValueError(f"Failed to parse 3D mesh: {str(e2)}")

    if not isinstance(mesh, trimesh.Trimesh):
        # Concatenate if scene with multiple geometries
        if hasattr(mesh, 'dump'):
            mesh = trimesh.util.concatenate(mesh.dump())
        else:
            raise ValueError("Parsed file is not a valid 3D surface mesh.")

    # Check if mesh is watertight
    is_watertight = mesh.is_watertight
    
    # Bounding box & dimensions (ensure units are in meters)
    extents = mesh.extents  # [dx, dy, dz]
    
    # Heuristic unit detection (if dimensions are > 50, likely in mm; scale to meters)
    scale_factor = 1.0
    if max(extents) > 50.0:
        scale_factor = 0.001  # mm to meters
    elif max(extents) > 15.0 and min(extents) > 2.0:
        scale_factor = 0.1   # cm to meters
        
    length_m = float(extents[0] * scale_factor)
    width_m = float(extents[1] * scale_factor)
    height_m = float(extents[2] * scale_factor)
    
    # Surface Area and Volume
    total_surface_area_m2 = float(mesh.area * (scale_factor ** 2))
    
    # Volume calculation
    try:
        raw_volume = float(mesh.volume * (scale_factor ** 3))
        volume_m3 = abs(raw_volume) if raw_volume != 0 else (length_m * width_m * height_m * 0.85)
    except Exception:
        volume_m3 = length_m * width_m * height_m * 0.85

    # Face Normal Classification (Vector Z > 0.65 = Roof, Z < -0.65 = Floor, else Walls)
    face_normals = mesh.face_normals
    face_areas = mesh.area_faces * (scale_factor ** 2)

    roof_mask = face_normals[:, 2] > 0.65
    floor_mask = face_normals[:, 2] < -0.65
    wall_mask = (~roof_mask) & (~floor_mask)

    roof_area_m2 = float(np.sum(face_areas[roof_mask]))
    floor_area_m2 = float(np.sum(face_areas[floor_mask]))
    wall_area_m2 = float(np.sum(face_areas[wall_mask]))

    # Directional Wall Decomposition (South, North, East, West)
    wall_normals = face_normals[wall_mask]
    wall_areas_sub = face_areas[wall_mask]

    # In standard coordinate frame: Y negative is South (or azimuth ~ 180°)
    south_wall_mask = (wall_normals[:, 1] < -0.5)
    north_wall_mask = (wall_normals[:, 1] > 0.5)
    east_wall_mask = (wall_normals[:, 0] > 0.5)
    west_wall_mask = (wall_normals[:, 0] < -0.5)

    south_wall_area = float(np.sum(wall_areas_sub[south_wall_mask])) if len(wall_areas_sub) > 0 else (wall_area_m2 * 0.25)
    north_wall_area = float(np.sum(wall_areas_sub[north_wall_mask])) if len(wall_areas_sub) > 0 else (wall_area_m2 * 0.25)

    return {
        "filename": filename,
        "is_watertight": is_watertight,
        "vertex_count": len(mesh.vertices),
        "face_count": len(mesh.faces),
        "unit_detected": "millimeters (scaled to m)" if scale_factor == 0.001 else "meters",
        "dimensions": {
            "length_m": round(length_m, 2),
            "width_m": round(width_m, 2),
            "height_m": round(height_m, 2),
            "volume_m3": round(volume_m3, 2),
            "total_surface_area_m2": round(total_surface_area_m2, 2)
        },
        "surface_decomposition": {
            "roof_area_m2": round(roof_area_m2, 2),
            "wall_area_m2": round(wall_area_m2, 2),
            "floor_area_m2": round(floor_area_m2, 2),
            "south_facing_wall_m2": round(south_wall_area, 2),
            "north_facing_wall_m2": round(north_wall_area, 2)
        },
        "recommended_simulation_inputs": {
            "length_m": round(length_m, 2),
            "width_m": round(width_m, 2),
            "height_m": round(height_m, 2),
            "roof_area_m2": round(roof_area_m2, 2),
            "wall_area_m2": round(wall_area_m2, 2),
            "window_area_m2": round(min(south_wall_area * 0.4, 4.0), 2)
        }
    }
