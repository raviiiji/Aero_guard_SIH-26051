import * as THREE from 'three';

/**
 * Minimal camera description the 3D scene needs in order to be locked to a
 * map. Deliberately free of Leaflet and React so it can be unit-tested against
 * a real Leaflet CRS in isolation.
 */
export interface MapCameraLike {
  center: { latitude: number; longitude: number };
  centerElevation: number;
  zoom: number;
  bearing: number;
  pitchDeg: number;
  widthPx: number;
  heightPx: number;
  metersPerPixel: number;
}

const DEG2RAD = Math.PI / 180;

/**
 * Derive the 3D camera from the map camera so the two renderers agree.
 *
 * - The look-at target is always the map centre, which is also the scene
 *   origin, so the camera stares at exactly the point the map is centred on.
 * - The orbit distance is solved from the map's own `metersPerPixel`, so one
 *   ground unit projects to `1 / metersPerPixel` screen pixels at the target --
 *   the identical ground resolution the map draws. Zooming the map therefore
 *   zooms the 3D scene by the same factor, and panning moves it by the same
 *   distance. (`metersPerPixel` is the map's Mercator resolution, see
 *   geoProjection for why that is the correct shared value.)
 * - `bearing` rotates the camera around the target, so a rotated map rotates
 *   the 3D scene with it. Core Leaflet reports 0 (north-up).
 *
 * At `pitchDeg` near 0 the view is a pixel-exact overlay of the map. Beyond
 * that the ground is foreshortened away from the camera, which is precisely
 * what makes the terrain read as three-dimensional rather than as a flat
 * picture pasted on the map.
 */
export function applyMapCamera(camera: THREE.PerspectiveCamera, sync: MapCameraLike): void {
  const { widthPx, heightPx, metersPerPixel, bearing, pitchDeg } = sync;
  if (widthPx <= 0 || heightPx <= 0 || metersPerPixel <= 0) return;

  camera.aspect = widthPx / heightPx;

  const fovRad = camera.fov * DEG2RAD;
  // Below 1 deg the view is treated as exactly top-down (see the up-vector
  // branch below); anything larger is clamped only to keep the orbit stable.
  const tilt = THREE.MathUtils.degToRad(pitchDeg < 1 ? 0 : THREE.MathUtils.clamp(pitchDeg, 1, 89));
  const azimuth = THREE.MathUtils.degToRad(bearing);

  // Half the ground width the map currently shows, in metres.
  const halfGroundWidthM = (widthPx * metersPerPixel) / 2;
  const halfHFovTan = Math.tan(fovRad / 2) * camera.aspect;
  const distance = halfGroundWidthM / halfHFovTan;

  const target = new THREE.Vector3(0, 0, 0);
  const sinA = Math.sin(azimuth);
  const cosA = Math.cos(azimuth);

  if (pitchDeg < 1) {
    // Straight down: the camera has to be directly ABOVE the target. Orbiting
    // it into the ground plane instead would leave the up vector parallel to
    // the view direction and collapse the projection.
    camera.position.set(0, distance, 0);
    // Straight down: a world-up vector would be parallel to the view direction
    // and the lookAt would be degenerate. Tilt the up vector into the ground
    // plane instead, keeping north pointing up the screen so the render is a
    // pixel-exact, north-up replica of the map.
    camera.up.set(-sinA, 0, -cosA);
  } else {
    camera.position.set(
      distance * sinA * Math.cos(tilt),
      distance * Math.sin(tilt),
      distance * cosA * Math.cos(tilt)
    );
    camera.up.set(0, 1, 0);
  }
  camera.lookAt(target);
  camera.near = Math.max(0.05, metersPerPixel * 0.5);
  camera.far = Math.max(2000, distance * 6);
  camera.updateProjectionMatrix();
  // lookAt() only sets the quaternion; refresh the world matrix so the camera
  // is immediately usable for projection without waiting for a render call.
  camera.updateMatrixWorld(true);
}
