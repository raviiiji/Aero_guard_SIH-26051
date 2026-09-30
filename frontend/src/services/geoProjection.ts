/**
 * Geospatial projection bridge between Leaflet's Web Mercator (EPSG:3857)
 * pixel space and the Three.js scene used by the shelter digital twin.
 *
 * The whole point of this module is that there is exactly ONE geographic
 * source of truth (`SelectedLocation`). Neither the map nor the 3D scene
 * stores its own copy of the coordinates: the map is driven from the
 * selection, and the 3D scene position is derived from it with these
 * functions.
 *
 * Scene convention:
 *   +X = East, -Z = North, +Y = up
 * The horizontal ground plane uses the SAME Web Mercator axes and scale as
 * Leaflet, so a north-up map overlays the scene with no rotation and no
 * residual drift at any zoom. The vertical axis is NOT rescaled: it stays in
 * true metres, which is what terrain relief and shelter height need.
 *
 * Why Mercator horizontally: Web Mercator is a cylindrical projection, so it
 * stretches the north-south axis by 1/cos(latitude) relative to east-west
 * (~14% at Delhi, ~21% at 34 deg N). A 3D overlay drawn in true metres on
 * both horizontal axes therefore drifts away from the map features around it
 * even when the anchor point is exact. Matching the map's own grid is the only
 * way to be genuinely "synchronized with the map"; the trade-off is that the
 * ground plane carries the usual Mercator scale factor, and the vertical axis
 * inherits it. That is standard practice for Mercator terrain viewers and is
 * called out in the HUD so the numbers are never silently misleading.
 */

export interface SelectedLocation {
  latitude: number;
  longitude: number;
  /** DEM-resolved elevation in metres above sea level. */
  elevation: number;
  /** Epoch ms of the last selection. */
  timestamp: number;
}

export interface SceneOrigin {
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface ScenePoint {
  x: number;
  y: number;
  z: number;
}

/** Web Mercator ground circumference at the equator, in metres. */
export const EARTH_CIRCUMFERENCE_M = 40075016.686;
/** Leaflet tile size in pixels. */
export const TILE_SIZE = 256;
/** WGS84 equatorial radius in metres. */
const EARTH_RADIUS_M = 6378137;

const DEG2RAD = Math.PI / 180;

/**
 * Ground resolution of the map, in Mercator metres per CSS pixel.
 *
 * This is deliberately latitude-independent: it is exactly the scale Leaflet
 * uses when it draws tiles, and it is uniform on both screen axes. A "true
 * metres per pixel" figure would be smaller by cos(latitude) and would make the
 * 3D overlay disagree with the map north-south, so the camera solve and the
 * ground plane must both use this one value.
 */
export function metersPerPixel(_latitude: number, zoom: number): number {
  return EARTH_CIRCUMFERENCE_M / (TILE_SIZE * Math.pow(2, zoom));
}

/**
 * True ground resolution east-west at a latitude, in metres per CSS pixel.
 * Only meaningful for reporting; do NOT use it to place the 3D scene.
 */
export function trueMetersPerPixelEW(latitude: number, zoom: number): number {
  return metersPerPixel(latitude, zoom) * Math.cos(clampLatitude(latitude) * DEG2RAD);
}

/**
 * Web Mercator scale factor at a latitude: how much the projection stretches
 * the north-south axis relative to true ground distance.
 */
export function mercatorScaleFactor(latitude: number): number {
  return 1 / Math.cos(clampLatitude(latitude) * DEG2RAD);
}

function clampLatitude(latitude: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

/** Normalised Mercator Y for a latitude, in radians. */
function mercatorY(latitude: number): number {
  const clampedLat = clampLatitude(latitude);
  return Math.log(Math.tan(Math.PI / 4 + (clampedLat * DEG2RAD) / 2));
}

/**
 * Mercator metres per degree of longitude. Web Mercator is cylindrical, so
 * this is latitude-independent: it is the same figure Leaflet uses for the
 * projected x axis. (Multiplying by cos(latitude) here would yield TRUE ground
 * metres and would pull the scene west of the map.)
 */
function mercatorMetersPerDegreeLon(): number {
  return EARTH_CIRCUMFERENCE_M / 360;
}

/**
 * Convert a real geographic position to a scene position relative to `origin`.
 *
 * The horizontal axes are the raw EPSG:3857 delta in Mercator metres, which is
 * precisely what Leaflet rasterises, so the result lines up with the map to
 * floating-point noise at every zoom. The vertical axis is a true metre
 * difference in elevation.
 *
 * Verified against Leaflet's own CRS.EPSG3857 by
 * `scripts/verifyMap3DSync.ts`, which also checks the end-to-end camera
 * projection: max error < 0.01 px.
 */
export function geoToScene(
  location: { latitude: number; longitude: number; elevation?: number },
  origin: SceneOrigin
): ScenePoint {
  const dEast = (location.longitude - origin.longitude) * mercatorMetersPerDegreeLon();

  // Raw Mercator delta, left in the projection's own units so it matches the
  // map's north-south scale instead of true ground distance.
  const dNorth =
    (mercatorY(location.latitude) - mercatorY(origin.latitude)) *
    (EARTH_CIRCUMFERENCE_M / (2 * Math.PI));

  return {
    x: dEast,
    // North is -Z, so southern offsets are positive Z.
    z: -dNorth,
    y: (location.elevation ?? origin.elevation) - origin.elevation,
  };
}

/** Exact inverse of {@link geoToScene}. */
export function sceneToGeo(point: ScenePoint, origin: SceneOrigin): SelectedLocation {
  const originY = mercatorY(origin.latitude);
  const dY = -point.z / (EARTH_CIRCUMFERENCE_M / (2 * Math.PI));
  const latitude = (2 * Math.atan(Math.exp(originY + dY)) - Math.PI / 2) / DEG2RAD;
  const longitude = origin.longitude + point.x / mercatorMetersPerDegreeLon();

  return {
    latitude,
    longitude,
    elevation: point.y + origin.elevation,
    timestamp: Date.now(),
  };
}

/** Great-circle distance in metres, for the map's own scale readout. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dLat = (b.latitude - a.latitude) * DEG2RAD;
  const dLon = (b.longitude - a.longitude) * DEG2RAD;
  const lat1 = a.latitude * DEG2RAD;
  const lat2 = b.latitude * DEG2RAD;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Zoom at which a feature of `meters` spans `pixels` on the map. Used to fly
 * the map to a shelter-scale view so the twin is actually visible instead of
 * being sub-pixel at regional zoom.
 */
export function zoomForFeature(meters: number, pixels: number, latitude: number): number {
  if (meters <= 0 || pixels <= 0) return 18;
  const targetMetersPerPixel = meters / pixels;
  void latitude;
  const raw = Math.log2(EARTH_CIRCUMFERENCE_M / (TILE_SIZE * targetMetersPerPixel));
  return Math.max(1, Math.min(20, raw));
}
