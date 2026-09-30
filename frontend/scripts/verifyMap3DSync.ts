/**
 * Verifies the real map<->3D alignment chain, not just the projection maths:
 *   selectedLocation -> geoToScene -> applyMapCamera -> project to screen px
 * is compared against what a real Leaflet map reports for the same lat/lng.
 *
 * Run: npx vite-node scripts/verifyMap3DSync.ts
 */
import * as THREE from 'three';

// Leaflet's bundle reads `window`/`document` at module-evaluation time. This
// test only needs the pure projection maths, so a minimal shim is enough to
// let the real CRS load outside a browser.
(globalThis as unknown as { window: Record<string, unknown> }).window = globalThis as unknown as Record<string, unknown>;
(globalThis as unknown as { screen: unknown }).screen = { deviceXDPI: 96, logicalXDPI: 96 };
(globalThis as unknown as { document: unknown }).document = {
  createElement: () => ({ style: {} }),
  documentElement: { style: {} },
};
const L = await import('leaflet');
import { geoToScene, metersPerPixel, type SceneOrigin } from '../src/services/geoProjection';
import { applyMapCamera } from '../src/services/geoCamera';

const SHELTER = { latitude: 28.5539, longitude: 77.1853, elevation: 216 };
const WIDTH = 1280;
const HEIGHT = 800;
const FOV = 45;

let failures = 0;
const check = (label: string, got: number, want: number, tol: number) => {
  const err = Math.abs(got - want);
  const ok = err <= tol;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} got=${got.toFixed(4)} want=${want.toFixed(4)} err=${err.toExponential(2)} tol=${tol}`
  );
};

/**
 * Exact container-pixel offset Leaflet would report for a lat/lng relative to
 * the map centre. `Map.latLngToContainerPoint(p)` is defined as
 * `CRS.latLngToPoint(p, zoom) - pixelOrigin`, and the pixel origin is
 * `CRS.latLngToPoint(center, zoom)`, so this difference is the identical
 * quantity -- just without needing a DOM.
 */
const leafletOffsetPx = (
  centre: { latitude: number; longitude: number },
  target: { latitude: number; longitude: number },
  zoom: number
) => {
  const c = L.CRS.EPSG3857.latLngToPoint(L.latLng(centre.latitude, centre.longitude), zoom);
  const t = L.CRS.EPSG3857.latLngToPoint(L.latLng(target.latitude, target.longitude), zoom);
  return { x: t.x - c.x, y: t.y - c.y };
};

const scenarios = [
  { name: 'zoom 16, centred on shelter', center: { ...SHELTER }, zoom: 16, pitch: 0 },
  { name: 'zoom 18, centred on shelter', center: { ...SHELTER }, zoom: 18, pitch: 0 },
  { name: 'zoom 20, centred on shelter', center: { ...SHELTER }, zoom: 20, pitch: 0 },
  { name: 'zoom 17, panned +0.010 lat',   center: { latitude: SHELTER.latitude + 0.01, longitude: SHELTER.longitude }, zoom: 17, pitch: 0 },
  { name: 'zoom 17, panned +0.030 lon',   center: { latitude: SHELTER.latitude, longitude: SHELTER.longitude + 0.03 }, zoom: 17, pitch: 0 },
  { name: 'zoom 15, panned to 2nd city',  center: { latitude: 22.5726, longitude: 88.3639 }, zoom: 15, pitch: 0 },
];

console.log('\n=== Top-down (pitch 0): 3D must land on the map pixel-for-pixel ===');
for (const sc of scenarios) {
  console.log(`\n${sc.name}`);
  const mpp = metersPerPixel(sc.center.latitude, sc.zoom);

  const origin: SceneOrigin = {
    latitude: sc.center.latitude,
    longitude: sc.center.longitude,
    elevation: SHELTER.elevation,
  };
  const scene = geoToScene(SHELTER, origin);

  const camera = new THREE.PerspectiveCamera(FOV, WIDTH / HEIGHT, 0.1, 5000);
  applyMapCamera(camera, {
    center: sc.center,
    centerElevation: SHELTER.elevation,
    zoom: sc.zoom,
    bearing: 0,
    pitchDeg: sc.pitch,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    metersPerPixel: mpp,
  });

  const p = new THREE.Vector3(scene.x, 0, scene.z).project(camera);
  const threeX = ((p.x + 1) / 2) * WIDTH;
  const threeY = ((1 - p.y) / 2) * HEIGHT;

  const want = leafletOffsetPx(sc.center, SHELTER, sc.zoom);

  check('x offset vs Leaflet (px)', threeX - WIDTH / 2, want.x, 0.01);
  check('y offset vs Leaflet (px)', threeY - HEIGHT / 2, want.y, 0.01);
}

console.log('\n=== Tilted (pitch 55): east-west must stay map-locked, north-south foreshortens ===');
{
  const sc = { name: 'zoom 18, tilted 55 deg', center: { ...SHELTER }, zoom: 18, pitch: 55 };
  console.log(`\n${sc.name}`);
  const mpp = metersPerPixel(sc.center.latitude, sc.zoom);

  const origin: SceneOrigin = { ...sc.center, elevation: SHELTER.elevation };
  const eastPt = geoToScene({ ...SHELTER, longitude: SHELTER.longitude + 0.001 }, origin);
  const northPt = geoToScene({ ...SHELTER, latitude: SHELTER.latitude + 0.001 }, origin);

  const camera = new THREE.PerspectiveCamera(FOV, WIDTH / HEIGHT, 0.1, 5000);
  applyMapCamera(camera, {
    center: sc.center,
    centerElevation: SHELTER.elevation,
    zoom: sc.zoom,
    bearing: 0,
    pitchDeg: sc.pitch,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    metersPerPixel: mpp,
  });

  const proj = (v: THREE.Vector3) => {
    const q = v.clone().project(camera);
    return { x: ((q.x + 1) / 2) * WIDTH, y: ((1 - q.y) / 2) * HEIGHT };
  };
  const c = proj(new THREE.Vector3(0, 0, 0));
  const e = proj(new THREE.Vector3(eastPt.x, 0, eastPt.z));
  const n = proj(new THREE.Vector3(northPt.x, 0, northPt.z));

  const cx = leafletOffsetPx(sc.center, sc.center, sc.zoom);
  const ex = leafletOffsetPx(sc.center, { ...SHELTER, longitude: SHELTER.longitude + 0.001 }, sc.zoom);
  const nx = leafletOffsetPx(sc.center, { ...SHELTER, latitude: SHELTER.latitude + 0.001 }, sc.zoom);

  const ewThree = Math.abs(e.x - c.x);
  const ewMap = Math.abs(ex.x - cx.x);
  // 1) The 3D overlay must draw the same east-west ground span as the map.
  check('east-west span vs Leaflet (px)', ewThree, ewMap, 0.01);
  // 2) That span must also resolve to the map's own ground resolution, i.e.
  //    zooming the map zooms the 3D scene by the identical factor.
  check('ground scale (m per px)', Math.abs(eastPt.x) / ewThree, mpp, mpp * 0.001);

  const nsThree = Math.abs(n.y - c.y);
  const nsMap = Math.abs(nx.y - cx.y);
  const ratio = nsThree / nsMap;
  console.log(`  INFO  north-south foreshortening          ratio=${ratio.toFixed(4)} (1.0 = no tilt, <1 = recedes)`);
  if (!(ratio > 0.2 && ratio < 1.0)) {
    console.log('  FAIL  tilt did not foreshorten as expected');
    failures += 1;
  } else {
    console.log('  PASS  tilt foreshortens the ground plane as expected');
  }
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
