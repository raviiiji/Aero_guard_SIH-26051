import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import {
  Layers,
  Flame,
  Sun,
  Users,
  Eye,
  Maximize2,
  RotateCcw,
  Box,
  MapPin,
  Mountain,
} from 'lucide-react';
import { ShelterGeometry, SimulationResult, ShelterAnchor, ShelterPartId, ShelterTerrain } from '../types';
import type { MapCameraState } from '../hooks/useMapGeoSync';
import { geoToScene, type SceneOrigin } from '../services/geoProjection';
import { applyMapCamera } from '../services/geoCamera';
import { SHELTER_PARTS } from '../services/shelterApi';

const SHELTER_PART_LABELS: Record<ShelterPartId, string> = Object.fromEntries(
  Object.entries(SHELTER_PARTS).map(([id, meta]) => [id, meta.label])
) as Record<ShelterPartId, string>;

interface Shelter3DViewerProps {
  geometry: ShelterGeometry;
  simResult: SimulationResult | null;
  troops: number;
  simulatedHour?: number;
  /**
   * Geographic anchor. When present the shelter is seated on real DEM terrain
   * and rotated to the anchor heading. When absent the viewer behaves exactly
   * as before (flat tactical grid, origin-centred).
   */
  anchor?: ShelterAnchor | null;
  /** Real DEM grid sampled around the anchor, in a WGS84 local tangent plane. */
  terrain?: ShelterTerrain | null;
  /** Fired when a shelter subsystem mesh is clicked. */
  onPartSelect?: (part: ShelterPartId) => void;
  /** Fired when the shelter body itself is clicked. */
  onShelterSelect?: () => void;
  /** Externally highlighted subsystem (e.g. from the info panel). */
  highlightPart?: ShelterPartId | null;
  /** Show the clickable equipment props around the shelter. */
  showEquipment?: boolean;
  /**
   * Map camera published by the existing Leaflet map. When present, the 3D
   * camera is derived from it every frame so the scene is geospatially locked
   * to the map: panning or zooming the map moves the scene identically.
   */
  cameraSync?: MapCameraState | null;
  /**
   * Origin of the 3D scene in WGS84. Defaults to the map camera centre, so
   * scene (0,0,0) is the map centre and the shelter is placed by projecting
   * its real coordinates relative to it.
   */
  sceneOrigin?: SceneOrigin | null;
  /** Render with a transparent background so the map shows through. */
  overlay?: boolean;
}

type RenderMode = 'CAMO' | 'THERMAL_IR' | 'SOLAR_RAYS' | 'INTERIOR_BUNKS';

export const Shelter3DViewer: React.FC<Shelter3DViewerProps> = ({
  geometry,
  simResult,
  troops,
  simulatedHour = 12,
  anchor = null,
  terrain = null,
  onPartSelect,
  onShelterSelect,
  highlightPart = null,
  showEquipment = false,
  cameraSync = null,
  sceneOrigin: sceneOriginProp = null,
  overlay = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('CAMO');
  const [isWireframe, setIsWireframe] = useState(false);
  const [currentHour, setCurrentHour] = useState(simulatedHour);

  // Three.js object references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const shelterGroupRef = useRef<THREE.Group | null>(null);

  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunSphereRef = useRef<THREE.Mesh | null>(null);
  const bunksGroupRef = useRef<THREE.Group | null>(null);
  const earthBermGroupRef = useRef<THREE.Group | null>(null);
  const solarRayArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const cameraSyncRef = useRef<MapCameraState | null>(null);
  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);
  const sceneOriginRef = useRef<SceneOrigin | null>(null);
  const [selectedPart, setSelectedPart] = useState<ShelterPartId | null>(null);

  /**
   * Cut-and-fill pad geometry for the shelter footprint: the half-extents, the
   * vertical lift that keeps the shell out of the ground, and the pad
   * thickness needed to reach the lowest corner of the footprint.
   */
  const computePad = useCallback(
    (
      g: ShelterGeometry,
      t: ShelterTerrain | null,
      a: ShelterAnchor | null | undefined,
      sample: (x: number, z: number) => number
    ) => {
      const padX = g.length_m / 2 + 1.4;
      const padZ = g.width_m / 2 + 1.4;
      if (!t || !a) return { padX, padZ, lift: 0, padH: 0.05 };
      const corners = [
        sample(-padX, -padZ),
        sample(padX, -padZ),
        sample(-padX, padZ),
        sample(padX, padZ),
      ];
      const lift = Math.max(...corners, 0);
      const padH = Math.max(0.05, lift - Math.min(...corners, 0) + 0.1);
      return { padX, padZ, lift, padH };
    },
    []
  );

  /** Report 3D clicks upward. Selection is owned by the parent, so the viewer
   *  stays a pure view and never duplicates highlight state. */
  const handlePartSelect = useCallback(
    (part: ShelterPartId) => {
      setSelectedPart(part);
      onPartSelect?.(part);
    },
    [onPartSelect]
  );

  // Parent-supplied highlight wins; otherwise fall back to the local 3D pick.
  const activePart = highlightPart ?? (showEquipment ? selectedPart : null);

  // The render loop reads these, so mirror them into refs instead of forcing
  // the WebGL context to be torn down and rebuilt on every map move.
  useEffect(() => {
    cameraSyncRef.current = cameraSync;
  }, [cameraSync]);

  const activeSceneOrigin = useMemo<SceneOrigin | null>(() => {
    if (sceneOriginProp) return sceneOriginProp;
    if (cameraSync) {
      return {
        latitude: cameraSync.center.latitude,
        longitude: cameraSync.center.longitude,
        elevation: cameraSync.centerElevation,
      };
    }
    return null;
  }, [sceneOriginProp, cameraSync]);

  useEffect(() => {
    sceneOriginRef.current = activeSceneOrigin;
  }, [activeSceneOrigin]);

  /**
   * Where the shelter sits in scene metres, derived from its real coordinates
   * relative to the map-centred scene origin. This is the only place the
   * shelter's position is decided, so the 3D shelter cannot drift from the
   * map point it is anchored to.
   */
  const anchorScenePoint = useMemo(() => {
    if (!anchor || !activeSceneOrigin) return null;
    return geoToScene(
      { latitude: anchor.latitude, longitude: anchor.longitude, elevation: anchor.elevation },
      activeSceneOrigin
    );
  }, [anchor, activeSceneOrigin]);

  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const equipmentGroupRef = useRef<THREE.Group | null>(null);
  const flatGroundRef = useRef<THREE.Object3D[]>([]);
  const hoveredPartRef = useRef<ShelterPartId | null>(null);

  /** Bilinear sample of the DEM grid in local tangent-plane metres. */
  const sampleTerrain = useCallback(
    (x: number, z: number): number => {
      if (!terrain) return 0;
      const n = terrain.samples;
      const half = terrain.span_m / 2;
      const fx = (x + half) / terrain.span_m; // 0..1 west->east
      const fz = (half - z) / terrain.span_m; // 0..1 north->south
      const gx = Math.min(Math.max(fx * (n - 1), 0), n - 1);
      const gz = Math.min(Math.max(fz * (n - 1), 0), n - 1);
      const x0 = Math.floor(gx);
      const z0 = Math.floor(gz);
      const x1 = Math.min(x0 + 1, n - 1);
      const z1 = Math.min(z0 + 1, n - 1);
      const tx = gx - x0;
      const tz = gz - z0;
      const a = terrain.grid_m[z0][x0] * (1 - tx) + terrain.grid_m[z0][x1] * tx;
      const b = terrain.grid_m[z1][x0] * (1 - tx) + terrain.grid_m[z1][x1] * tx;
      // Relative to the anchor elevation, so the anchor itself sits at y = 0.
      return a * (1 - tz) + b * tz - (anchor ? anchor.elevation : 0);
    },
    [terrain, anchor]
  );

  // Extend the camera far plane / orbit range only when georeferenced terrain
  // is active, so the original un-anchored framing is left untouched.
  useEffect(() => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    if (anchor && terrain) {
      cam.far = 5000;
      cam.updateProjectionMatrix();
      ctrl.maxDistance = 400;
    } else {
      cam.far = 100;
      cam.updateProjectionMatrix();
      ctrl.maxDistance = 35;
    }
  }, [anchor, terrain]);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 450;

    // 1. Scene
    const scene = new THREE.Scene();
    if (overlayRef.current) {
      // Overlay mode: the Leaflet map is the backdrop, so the scene must be
      // fully transparent and unfogged or it would paint over the map.
      scene.background = null;
      scene.fog = null;
    } else {
      scene.background = new THREE.Color('#070b14');
      scene.fog = new THREE.FogExp2('#070b14', 0.035);
    }
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(10, 8, 12);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    // In overlay mode the map is the backdrop, so keep the buffer transparent
    // and drop the fog that would otherwise tint it.
    if (overlayRef.current) {
      renderer.setClearColor(0x000000, 0);
    }
    rendererRef.current = renderer;

    mountRef.current.replaceChildren(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Do not go below ground
    controls.minDistance = 4;
    controls.maxDistance = 35;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight('#94a3b8', 0.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#38bdf8', '#0f172a', 0.6);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fffbeb', 2.2);
    sunLight.position.set(8, 14, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Sun Sphere Visualizer
    const sunGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
    const sunSphere = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunSphere);
    sunSphereRef.current = sunSphere;

    // 6. Tactical Ground Grid
    const grid = new THREE.GridHelper(30, 30, '#06b6d4', '#1e293b');
    grid.position.y = -0.01;
    scene.add(grid);

    // Snow/Ground plane
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    // Retained so they can be hidden when real terrain is loaded.
    flatGroundRef.current = [grid, ground];

    // 7. Shelter Root Group
    const shelterGroup = new THREE.Group();
    scene.add(shelterGroup);
    shelterGroupRef.current = shelterGroup;

    // 8. Bunks Group
    const bunksGroup = new THREE.Group();
    scene.add(bunksGroup);
    bunksGroupRef.current = bunksGroup;

    // 9. Earth Berm Group
    const bermGroup = new THREE.Group();
    scene.add(bermGroup);
    earthBermGroupRef.current = bermGroup;

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const sync = cameraSyncRef.current;
      if (sync) {
        applyMapCamera(camera, sync);
        // OrbitControls would fight the map, so they are inert while synced.
        controls.enabled = false;
      } else {
        controls.enabled = true;
        controls.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight || 450;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, []);

  // Update Sun Position Based on Hour
  useEffect(() => {
    if (!sunLightRef.current || !sunSphereRef.current || !sceneRef.current) return;

    const hour = currentHour;
    if (hour < 6 || hour > 18) {
      // Night
      sunLightRef.current.intensity = 0.15;
      sunLightRef.current.color.set('#38bdf8');
      sunSphereRef.current.visible = false;
      if (solarRayArrowRef.current) solarRayArrowRef.current.visible = false;
    } else {
      // Daytime Solar Arc
      const solarAngle = Math.PI * (hour - 6) / 12; // 0 to PI
      const sunDist = 18;
      const sunX = Math.cos(solarAngle) * sunDist;
      const sunY = Math.sin(solarAngle) * sunDist * 0.9 + 2;
      const sunZ = 12; // South facing illumination

      sunLightRef.current.position.set(sunX, sunY, sunZ);
      sunLightRef.current.intensity = Math.sin(solarAngle) * 2.8 + 0.5;
      sunLightRef.current.color.set('#fffbeb');

      sunSphereRef.current.position.set(sunX, sunY, sunZ);
      sunSphereRef.current.visible = renderMode === 'SOLAR_RAYS';

      // Solar Ray Vector Arrow pointing towards South window
      if (renderMode === 'SOLAR_RAYS') {
        if (!solarRayArrowRef.current) {
          const dir = new THREE.Vector3(-sunX, -sunY, -sunZ).normalize();
          const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(sunX * 0.7, sunY * 0.7, sunZ * 0.7), 6, 0xf59e0b, 1.2, 0.6);
          sceneRef.current.add(arrow);
          solarRayArrowRef.current = arrow;
        } else {
          solarRayArrowRef.current.visible = true;
          const dir = new THREE.Vector3(-sunX, -sunY, -sunZ).normalize();
          solarRayArrowRef.current.setDirection(dir);
          solarRayArrowRef.current.position.set(sunX * 0.6, sunY * 0.6, sunZ * 0.6);
        }
      } else if (solarRayArrowRef.current) {
        solarRayArrowRef.current.visible = false;
      }
    }
  }, [currentHour, renderMode]);

  // Build / Reconstruct Shelter 3D Mesh on Dimension & Mode Changes
  useEffect(() => {
    if (!shelterGroupRef.current || !bunksGroupRef.current || !earthBermGroupRef.current) return;

    const group = shelterGroupRef.current;
    const bunksGroup = bunksGroupRef.current;
    const bermGroup = earthBermGroupRef.current;

    // Clear previous geometries
    group.clear();
    bunksGroup.clear();
    bermGroup.clear();

    const {
      length_m: L,
      width_m: W,
      height_m: H,
      roof_pitch_deg: pitch,
      window_area_m2: winArea,
      trombe_wall_area_m2: trombeArea,
      earth_bermed_depth_m: bermDepth,
      archetype,
    } = geometry;

    // Materials Configuration by Render Mode
    let wallMat: THREE.Material;
    let roofMat: THREE.Material;
    let winMat: THREE.Material;
    let frameMat: THREE.Material;
    let trombeMat: THREE.Material;

    if (renderMode === 'THERMAL_IR') {
      // Infrared Heat Loss Shader / Colors:
      // Red = Highest Heat Loss (Windows, uninsulated seams)
      // Orange/Yellow = Moderate Loss (Roof)
      // Cyan/Blue = Lowest Heat Loss (Super insulated walls)
      wallMat = new THREE.MeshStandardMaterial({
        color: '#06b6d4', // Low loss well insulated
        wireframe: isWireframe,
        roughness: 0.4,
        metalness: 0.2,
      });
      roofMat = new THREE.MeshStandardMaterial({
        color: '#f59e0b', // Moderate loss
        wireframe: isWireframe,
        roughness: 0.3,
      });
      winMat = new THREE.MeshStandardMaterial({
        color: '#ef4444', // High heat escape through glazing
        wireframe: isWireframe,
        emissive: '#7f1d1d',
        emissiveIntensity: 0.6,
      });
      trombeMat = new THREE.MeshStandardMaterial({
        color: '#8b5cf6', // Solar storage
        wireframe: isWireframe,
      });
      frameMat = new THREE.MeshStandardMaterial({ color: '#f87171', wireframe: isWireframe });
    } else {
      // CAMO / Standard Military Mode
      wallMat = new THREE.MeshStandardMaterial({
        color: archetype === 'earth_bermed' ? '#334155' : '#1e293b',
        roughness: 0.7,
        metalness: 0.2,
        wireframe: isWireframe,
      });
      roofMat = new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 0.6,
        metalness: 0.4,
        wireframe: isWireframe,
      });
      winMat = new THREE.MeshPhysicalMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: renderMode === 'INTERIOR_BUNKS' ? 0.3 : 0.65,
        roughness: 0.1,
        metalness: 0.9,
        reflectivity: 0.9,
        wireframe: isWireframe,
      });
      trombeMat = new THREE.MeshStandardMaterial({
        color: '#1e1b4b', // Dark solar absorbing mass
        roughness: 0.9,
        wireframe: isWireframe,
      });
      frameMat = new THREE.MeshStandardMaterial({
        color: '#06b6d4',
        metalness: 0.8,
        roughness: 0.2,
        wireframe: isWireframe,
      });
    }

    // Handle archetype specific properties
    const effectiveTrombeArea = archetype === 'trombe_wall' ? (trombeArea > 0 ? trombeArea : 4.5) : trombeArea;
    const effectiveBermDepth = archetype === 'earth_bermed' ? (bermDepth > 0 ? bermDepth : 2.0) : bermDepth;

    if (archetype === 'quonset_dome') {
      // Quonset Arch Geometry
      const radius = W / 2;
      const archGeo = new THREE.CylinderGeometry(radius, radius, L, 32, 1, false, 0, Math.PI);
      const archMesh = new THREE.Mesh(archGeo, roofMat);
      archMesh.rotation.z = Math.PI / 2;
      archMesh.rotation.y = Math.PI / 2;
      archMesh.position.set(0, radius, 0);
      archMesh.castShadow = true;
      archMesh.receiveShadow = true;
      archMesh.userData.part = 'shelter_shell';
      group.add(archMesh);

      // End Caps
      const endCapGeo = new THREE.CircleGeometry(radius, 32, 0, Math.PI);
      const endCap1 = new THREE.Mesh(endCapGeo, wallMat);
      endCap1.position.set(-L / 2, radius, 0);
      endCap1.rotation.y = -Math.PI / 2;
      endCap1.userData.part = 'shelter_shell';
      group.add(endCap1);

      const endCap2 = new THREE.Mesh(endCapGeo, wallMat);
      endCap2.position.set(L / 2, radius, 0);
      endCap2.rotation.y = Math.PI / 2;
      group.add(endCap2);

      // Windows on End Cap
      const winGeo = new THREE.BoxGeometry(0.1, 1.2, 1.4);
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(L / 2 + 0.05, radius / 2, 0);
      win.userData.part = 'glazing';
      group.add(win);
    } else {
      // Modular Box, Trombe Wall, or Earth-Bermed

      // 1. Floor Foundation Slab
      const floorGeo = new THREE.BoxGeometry(L, 0.2, W);
      const floorMat = new THREE.MeshStandardMaterial({
        color: archetype === 'earth_bermed' ? '#1e293b' : '#334155',
        metalness: 0.3,
        roughness: 0.8
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.position.y = 0.1;
      floor.receiveShadow = true;
      group.add(floor);

      // 2. Main Wall Structure
      const wallGeo = new THREE.BoxGeometry(L, H, W);
      const wallMesh = new THREE.Mesh(
        wallGeo,
        renderMode === 'INTERIOR_BUNKS'
          ? new THREE.MeshStandardMaterial({ color: '#1e293b', transparent: true, opacity: 0.25 })
          : wallMat
      );
      wallMesh.position.y = H / 2 + 0.2;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallMesh.userData.part = 'shelter_shell';
      group.add(wallMesh);

      // 3. Roof (Gable Pitch vs Flat)
      const effectivePitch = archetype === 'modular_box' ? 0 : (pitch > 0 ? pitch : 15.0);
      const pitchRad = (effectivePitch * Math.PI) / 180;
      const roofRise = (W / 2) * Math.tan(pitchRad);

      if (effectivePitch > 0) {
        // Gable Triangular Pitched Slabs
        const roofSlabGeo = new THREE.BoxGeometry(L + 0.4, 0.15, (W / (2 * Math.cos(pitchRad))) + 0.3);
        
        // South Pitch
        const roofSouth = new THREE.Mesh(roofSlabGeo, roofMat);
        roofSouth.position.set(0, H + 0.2 + roofRise / 2, W / 4);
        roofSouth.rotation.x = pitchRad;
        roofSouth.castShadow = true;
        roofSouth.userData.part = 'shelter_shell';
        group.add(roofSouth);

        // North Pitch
        const roofNorth = new THREE.Mesh(roofSlabGeo, roofMat);
        roofNorth.position.set(0, H + 0.2 + roofRise / 2, -W / 4);
        roofNorth.rotation.x = -pitchRad;
        roofNorth.castShadow = true;
        roofNorth.userData.part = 'shelter_shell';
        group.add(roofNorth);
      } else {
        // Flat Modular Roof Slab with parapet edges
        const flatRoofGeo = new THREE.BoxGeometry(L + 0.4, 0.2, W + 0.4);
        const flatRoof = new THREE.Mesh(flatRoofGeo, roofMat);
        flatRoof.position.y = H + 0.3;
        flatRoof.castShadow = true;
        group.add(flatRoof);
      }

      // 4. Glazing / Solar Windows (South Facade: +Z coordinate)
      const winW = Math.min(L * 0.75, Math.max(1.5, Math.sqrt(winArea * 1.5)));
      const winH = Math.min(H * 0.65, Math.max(1.0, winArea / Math.max(winW, 0.5)));
      const windowGeo = new THREE.BoxGeometry(winW, winH, 0.12);
      const windowMesh = new THREE.Mesh(windowGeo, winMat);
      windowMesh.position.set(0, H / 2 + 0.2, W / 2 + 0.05);
      group.add(windowMesh);

      // Window Frame Outline
      const frameEdgeGeo = new THREE.BoxGeometry(winW + 0.1, winH + 0.1, 0.08);
      const frameEdge = new THREE.Mesh(frameEdgeGeo, frameMat);
      frameEdge.position.set(0, H / 2 + 0.2, W / 2 + 0.02);
      group.add(frameEdge);

      // 5. Trombe Wall Solar Storage Mass (South Facade)
      if (effectiveTrombeArea > 0) {
        const trombeW = Math.min(L * 0.45, Math.max(2.0, effectiveTrombeArea / 1.8));
        const trombeH = 1.9;
        const trombeGeo = new THREE.BoxGeometry(trombeW, trombeH, 0.28);
        const trombeMesh = new THREE.Mesh(trombeGeo, trombeMat);
        trombeMesh.position.set(-L / 4, H / 2 + 0.1, W / 2 + 0.16);
        group.add(trombeMesh);

        // Trombe Glazing Frame
        const trombeGlassGeo = new THREE.BoxGeometry(trombeW + 0.1, trombeH + 0.1, 0.05);
        const trombeGlass = new THREE.Mesh(trombeGlassGeo, winMat);
        trombeGlass.position.set(-L / 4, H / 2 + 0.1, W / 2 + 0.32);
        trombeGlass.userData.part = 'glazing';
        group.add(trombeGlass);
      }

      // 6. Tactical Entrance Airlock Door (West side)
      const doorGeo = new THREE.BoxGeometry(0.1, 1.9, 0.9);
      const doorMat = new THREE.MeshStandardMaterial({ color: '#06b6d4', metalness: 0.7 });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(L / 2 + 0.05, 1.9 / 2 + 0.2, 0);
      door.userData.part = 'entrance';
      group.add(door);

      // 7. Structural Frame Edge Highlights
      const edges = new THREE.EdgesGeometry(wallGeo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: '#06b6d4', transparent: true, opacity: 0.7 })
      );
      line.position.y = H / 2 + 0.2;
      group.add(line);
    }

    // 8. Earth-Berm Soil Embankments (for Earth-Bermed Bunker Archetype)
    if (effectiveBermDepth > 0) {
      const bermMat = new THREE.MeshStandardMaterial({
        color: '#475569',
        roughness: 0.95,
        wireframe: isWireframe,
      });

      // North Berm (Rear)
      const northBermGeo = new THREE.BoxGeometry(L * 1.4, effectiveBermDepth * 1.1, W * 0.7);
      const northBerm = new THREE.Mesh(northBermGeo, bermMat);
      northBerm.position.set(0, (effectiveBermDepth * 1.1) / 2, -W * 0.6);
      northBerm.receiveShadow = true;
      northBerm.userData.part = 'shelter_shell';
      bermGroup.add(northBerm);

      // East Berm (Side)
      const eastBermGeo = new THREE.BoxGeometry(L * 0.6, effectiveBermDepth * 1.0, W * 1.2);
      const eastBerm = new THREE.Mesh(eastBermGeo, bermMat);
      eastBerm.position.set(-L * 0.6, (effectiveBermDepth * 1.0) / 2, 0);
      eastBerm.receiveShadow = true;
      bermGroup.add(eastBerm);

      // West Berm (Side)
      const westBermGeo = new THREE.BoxGeometry(L * 0.6, effectiveBermDepth * 1.0, W * 1.2);
      const westBerm = new THREE.Mesh(westBermGeo, bermMat);
      westBerm.position.set(L * 0.6, (effectiveBermDepth * 1.0) / 2, 0);
      westBerm.receiveShadow = true;
      bermGroup.add(westBerm);
    }

    // 9. Interior Troop Bunks
    if (renderMode === 'INTERIOR_BUNKS') {
      const bunkCount = Math.min(troops, 16);
      const bunkL = 1.9;
      const bunkW = 0.75;
      const bunkH = 0.45;

      const bunkGeo = new THREE.BoxGeometry(bunkL, bunkH, bunkW);
      const bunkMat = new THREE.MeshStandardMaterial({ color: '#0284c7' });
      const sleepingBagMat = new THREE.MeshStandardMaterial({ color: '#f59e0b' });

      for (let i = 0; i < bunkCount; i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const xPos = -L / 2 + 1.2 + row * 1.0;
        const zPos = col === 0 ? -W / 2 + 0.6 : W / 2 - 0.6;

        if (Math.abs(xPos) < L / 2 - 0.6) {
          const bunk = new THREE.Mesh(bunkGeo, bunkMat);
          bunk.position.set(xPos, 0.2 + bunkH / 2, zPos);
          bunksGroup.add(bunk);

          // Sleeping pad on bunk
          const padGeo = new THREE.BoxGeometry(bunkL * 0.85, 0.08, bunkW * 0.8);
          const pad = new THREE.Mesh(padGeo, sleepingBagMat);
          pad.position.set(xPos, 0.2 + bunkH + 0.04, zPos);
          bunksGroup.add(pad);
        }
      }
    }

    // Smooth GSAP spawn animation
    gsap.fromTo(
      group.scale,
      { x: 0.95, y: 0.95, z: 0.95 },
      { x: 1.0, y: 1.0, z: 1.0, duration: 0.35, ease: 'power2.out' }
    );
  }, [geometry, renderMode, isWireframe, troops]);

  // -------------------------------------------------------------------------
  // Georeferenced terrain: displace a plane by the real DEM grid
  // Local tangent plane: x = +East, z = -North, y = up. 1 unit = 1 metre.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const previous = terrainMeshRef.current;
    if (previous) {
      scene.remove(previous);
      previous.geometry.dispose();
      (previous.material as THREE.Material).dispose();
      terrainMeshRef.current = null;
    }

    const useTerrain = Boolean(terrain && anchor);
    flatGroundRef.current.forEach((o) => {
      o.visible = !useTerrain;
    });

    if (!useTerrain || !terrain || !anchor) return;

    const n = terrain.samples;
    const geo = new THREE.PlaneGeometry(terrain.span_m, terrain.span_m, n - 1, n - 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(n * n * 3);

    const lo = terrain.min_elevation_m;
    const hi = terrain.max_elevation_m;
    const range = Math.max(1, hi - lo);

    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iy * n + ix;
        const elev = terrain.grid_m[iy][ix];
        // Local +Y of the plane maps to world -Z after the -90 deg X rotation.
        pos.setZ(i, elev - anchor.elevation);
        // Tint by relative elevation: low = exposed rock, high = snow.
        const t = (elev - lo) / range;
        colors[i * 3] = 0.16 + 0.74 * t;
        colors[i * 3 + 1] = 0.2 + 0.74 * t;
        colors[i * 3 + 2] = 0.3 + 0.7 * t;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      wireframe: isWireframe,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);
    terrainMeshRef.current = mesh;
  }, [terrain, anchor, isWireframe]);

  // -------------------------------------------------------------------------
  // Orient the shelter to the anchor heading (0 deg = north, compass).
  // -------------------------------------------------------------------------
  useEffect(() => {
    const heading = anchor?.heading ?? 0;
    // Scene convention: -Z is north, +X is east.
    const yaw = THREE.MathUtils.degToRad(heading - 180);
    if (shelterGroupRef.current) shelterGroupRef.current.rotation.y = yaw;
    if (bunksGroupRef.current) bunksGroupRef.current.rotation.y = yaw;
    if (earthBermGroupRef.current) earthBermGroupRef.current.rotation.y = yaw;
    if (equipmentGroupRef.current) equipmentGroupRef.current.rotation.y = yaw;
  }, [anchor?.heading]);

  // -------------------------------------------------------------------------
  // Clickable equipment subsystems, seated on the real terrain
  // -------------------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let old = equipmentGroupRef.current;
    if (old) {
      scene.remove(old);
      old.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      equipmentGroupRef.current = null;
    }
    if (!showEquipment) return;

    const group = new THREE.Group();
    const { length_m: L, width_m: W } = geometry;
    const { padX, padZ, lift, padH } = computePad(geometry, terrain, anchor, sampleTerrain);

    // Level the shelter on a cut-and-fill pad so the shell never floats above
    // or sinks into a slope. The group is lifted onto it by the positioning
    // effect, which is the single owner of scene placement.
    if (terrain && anchor) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(L + 2.8, padH, W + 2.8),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.95 })
      );
      pad.position.set(0, lift - padH / 2, 0);
      pad.receiveShadow = true;
      pad.userData.part = 'shelter_shell' as ShelterPartId;
      group.add(pad);
    }

    const addPart = (
      part: ShelterPartId,
      mesh: THREE.Mesh,
      x: number,
      z: number,
      lift: number
    ) => {
      const y = (terrain && anchor ? sampleTerrain(x, z) : 0) + lift;
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.userData.part = part;
      group.add(mesh);
    };

    const steel = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.7 });
    const body = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.4 });

    // Generator set (west flank)
    addPart('generator', new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.0), body('#f59e0b')),
      -padX - 1.1, 0, 0.55);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 10), steel('#475569'));
    addPart('generator', exhaust, -padX - 1.1, 0.35, 1.6);

    // Fuel tank (bulk storage, north-east)
    addPart('fuel_tank', new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.0, 20), body('#e2e8f0')),
      padX + 1.0, -1.0, 0.75);
    addPart('fuel_tank', new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 20), steel('#64748b')),
      padX + 1.0, -1.0, 0.0);

    // Battery bank (south-east enclosure)
    addPart('battery', new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), body('#22c55e')),
      padX + 0.9, 1.2, 0.45);

    // Solar array (south, facing the solar facade)
    for (let i = 0; i < 3; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.9), body('#1e3a8a'));
      panel.rotation.x = -0.5;
      addPart('solar_array', panel, (i - 1) * 1.75, padZ + 0.9, 0.85);
    }

    // Ventilation cowl (roof-adjacent, north)
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 14), steel('#94a3b8'));
    addPart('ventilation', vent, L / 2 - 0.6, -padZ - 0.7, 0.25);

    // Communications mast (north-east corner)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), steel('#cbd5e1'));
    addPart('comms', mast, -padX - 0.6, -padZ - 0.6, 1.6);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), body('#38bdf8'));
    addPart('comms', dish, -padX - 0.6, -padZ - 0.6, 3.1);

    scene.add(group);
    equipmentGroupRef.current = group;
  }, [showEquipment, terrain, anchor, geometry, sampleTerrain, computePad]);

  /**
   * Single owner of scene placement.
   *
   * Every geo-located object (terrain patch, shell, bunks, berms, equipment)
   * is moved to the shelter's projected scene position plus its ground lift.
   * Because the position comes from `geoToScene` against the live map origin,
   * the shelter stays locked to its real coordinates while the map is panned
   * and zoomed.
   */
  useEffect(() => {
    const sx = anchorScenePoint?.x ?? 0;
    const sz = anchorScenePoint?.z ?? 0;
    // Level the footprint against the real DEM so the shell never floats or
    // sinks. `lift` is the height of the highest footprint corner above the
    // anchor datum.
    const { lift } = computePad(geometry, terrain, anchor, sampleTerrain);

    const targets: Array<THREE.Object3D | null> = [
      terrainMeshRef.current,
      shelterGroupRef.current,
      bunksGroupRef.current,
      earthBermGroupRef.current,
      equipmentGroupRef.current,
    ];
    targets.forEach((obj) => {
      if (!obj) return;
      // The terrain patch carries no lift: its vertex heights are already
      // relative to the anchor.
      const isTerrain = obj === terrainMeshRef.current;
      obj.position.set(sx, isTerrain ? 0 : lift, sz);
    });
  }, [anchorScenePoint, geometry, terrain, anchor, sampleTerrain, computePad, showEquipment]);

  // -------------------------------------------------------------------------
  // Raycast picking for hover highlighting and subsystem clicks
  // -------------------------------------------------------------------------
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!renderer || !camera || !scene) return;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const el = renderer.domElement;

    const pick = (ev: PointerEvent): ShelterPartId | null => {
      const rect = el.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const targets: THREE.Object3D[] = [];
      [equipmentGroupRef.current, shelterGroupRef.current, earthBermGroupRef.current]
        .forEach((g) => g && targets.push(g));
      const hits = raycaster.intersectObjects(targets, true);
      for (const hit of hits) {
        const part = hit.object.userData?.part as ShelterPartId | undefined;
        if (part) return part;
      }
      return null;
    };

    const applyHighlight = (part: ShelterPartId | null) => {
      hoveredPartRef.current = part;
      el.style.cursor = part ? 'pointer' : 'default';
      const active = part ?? highlightPart ?? null;
      const roots = [equipmentGroupRef.current, shelterGroupRef.current];
      roots.forEach((root) => {
        if (!root) return;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.material) return;
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.emissive) {
            const isActive = Boolean(m.userData?.part) && m.userData.part === active;
            mat.emissive.set(isActive ? '#0e7490' : '#000000');
            mat.emissiveIntensity = isActive ? 0.9 : 0;
          }
        });
      });
    };

    const onMove = (ev: PointerEvent) => applyHighlight(pick(ev));
    const onClick = (ev: PointerEvent) => {
      const part = pick(ev);
      if (part === 'shelter_shell') {
        onShelterSelect?.();
        handlePartSelect('shelter_shell');
      } else if (part) {
        handlePartSelect(part);
      }
    };
    const onLeave = () => applyHighlight(null);

    el.addEventListener('pointermove', onMove);
    el.addEventListener('click', onClick);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('click', onClick);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [handlePartSelect, onShelterSelect, highlightPart, showEquipment, terrain, anchor]);

  // Camera Presets
  const setCameraView = (view: 'ISO' | 'SOUTH' | 'TOP' | 'FRONT') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    let targetPos = { x: 10, y: 8, z: 12 };
    if (view === 'SOUTH') targetPos = { x: 0, y: 3, z: 12 };
    if (view === 'TOP') targetPos = { x: 0, y: 16, z: 0.1 };
    if (view === 'FRONT') targetPos = { x: 12, y: 3, z: 0 };

    gsap.to(cam.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => ctrl.update(),
    });
  };

  return (
    <div className="tactical-card p-3.5 flex flex-col h-full relative">
      {/* 3D Canvas Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 z-10">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-tactical-cyan" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Parametric 3D Shelter Visualizer
          </h2>
          <span className="tactical-badge bg-command-800 text-slate-300 border border-command-600">
            {geometry.archetype.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Render Mode Tabs */}
        <div className="flex items-center gap-1 bg-command-950/90 border border-command-700/80 rounded p-0.5 font-mono text-[11px]">
          <button
            onClick={() => setRenderMode('CAMO')}
            className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
              renderMode === 'CAMO'
                ? 'bg-tactical-cyan text-command-950 font-bold shadow-glow-cyan/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Camo</span>
          </button>

          <button
            onClick={() => setRenderMode('THERMAL_IR')}
            className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
              renderMode === 'THERMAL_IR'
                ? 'bg-rose-500 text-white font-bold shadow-glow-crimson/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>Thermal IR</span>
          </button>

          <button
            onClick={() => setRenderMode('SOLAR_RAYS')}
            className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
              renderMode === 'SOLAR_RAYS'
                ? 'bg-amber-400 text-command-950 font-bold shadow-glow-amber/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-3 h-3" />
            <span>Solar Ray</span>
          </button>

          <button
            onClick={() => setRenderMode('INTERIOR_BUNKS')}
            className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
              renderMode === 'INTERIOR_BUNKS'
                ? 'bg-blue-500 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>Troop Layout</span>
          </button>
        </div>
      </div>

      {/* Three.js Container */}
      <div className="relative rounded-lg overflow-hidden border border-command-700/80 bg-command-950 h-72 md:h-80 w-full flex-grow">
        <div ref={mountRef} className="three-canvas-container" />

        {/* Georeference HUD (Bottom Left) - real WGS84 + DEM provenance */}
        {anchor && (
          <div className="absolute bottom-2.5 left-2.5 bg-command-950/85 backdrop-blur-md border border-command-700/80 rounded px-2.5 py-1.5 font-mono text-[10px] text-slate-300 pointer-events-none space-y-0.5">
            <div className="flex items-center gap-1.5 text-tactical-cyan font-bold">
              <MapPin size={10} />
              WGS84 ANCHOR
            </div>
            <div>
              {anchor.latitude.toFixed(5)}&deg;N, {anchor.longitude.toFixed(5)}&deg;E
            </div>
            <div className="flex items-center gap-1.5">
              <Mountain size={10} />
              {anchor.elevation.toFixed(0)} m {terrain ? (terrain.is_simulated ? 'ESTIMATED' : 'DEM') : 'ELEV'}
              {terrain ? ` · ${terrain.min_elevation_m.toFixed(0)}–${terrain.max_elevation_m.toFixed(0)} m` : ''}
            </div>
            <div>HDG {anchor.heading.toFixed(0)}&deg; · 1 unit = 1 m</div>
          </div>
        )}

        {/* Selected subsystem indicator */}
        {activePart && (
          <div className="absolute bottom-2.5 right-2.5 bg-command-950/85 backdrop-blur-md border border-tactical-cyan/50 rounded px-2.5 py-1.5 font-mono text-[10px] text-tactical-cyan pointer-events-none">
            SELECTED: {SHELTER_PART_LABELS[activePart].toUpperCase()}
          </div>
        )}

        {/* Camera View Controls Overlay (Top Right) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-command-950/85 backdrop-blur-md border border-command-700/80 rounded p-1 font-mono text-[10px]">
          <button
            onClick={() => setCameraView('ISO')}
            className="px-2 py-0.5 rounded bg-command-800 hover:bg-command-700 text-slate-200"
            title="Isometric 3D View"
          >
            ISO
          </button>
          <button
            onClick={() => setCameraView('SOUTH')}
            className="px-2 py-0.5 rounded bg-command-800 hover:bg-command-700 text-slate-200"
            title="South Solar Facade"
          >
            South
          </button>
          <button
            onClick={() => setCameraView('TOP')}
            className="px-2 py-0.5 rounded bg-command-800 hover:bg-command-700 text-slate-200"
            title="Top Roof View"
          >
            Top
          </button>
          <button
            onClick={() => setCameraView('FRONT')}
            className="px-2 py-0.5 rounded bg-command-800 hover:bg-command-700 text-slate-200"
            title="West Door Entrance"
          >
            Door
          </button>
          <button
            onClick={() => setIsWireframe(!isWireframe)}
            className={`px-2 py-0.5 rounded border ${
              isWireframe
                ? 'bg-tactical-cyan/20 border-tactical-cyan text-tactical-cyan font-bold'
                : 'bg-command-800 border-command-700 text-slate-400'
            }`}
            title="Toggle Wireframe Mesh"
          >
            Wire
          </button>
        </div>

        {/* 3D Telemetry HUD (Bottom Left) */}
        {simResult && (
          <div className="absolute bottom-2.5 left-2.5 bg-command-950/90 backdrop-blur-md border border-command-700/80 rounded-md p-2 font-mono text-[11px] space-y-1">
            <div className="flex items-center gap-3 text-slate-300">
              <span>
                Dim:{' '}
                <strong className="text-tactical-cyan">
                  {geometry.length_m}m × {geometry.width_m}m × {geometry.height_m}m
                </strong>
              </span>
              <span>
                Vol: <strong className="text-amber-400">{simResult.geometry.volume} m³</strong>
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-[10px]">
              <span>
                Roof U: <strong className="text-slate-200">{simResult.u_values.roof.u_value}</strong>
              </span>
              <span>
                Wall U: <strong className="text-slate-200">{simResult.u_values.walls.u_value}</strong>
              </span>
              <span>
                Solar Glazing:{' '}
                <strong className="text-emerald-400">{geometry.window_area_m2} m²</strong>
              </span>
            </div>
          </div>
        )}

        {/* Solar Ray Time-of-Day Slider (When Solar Mode active) */}
        {renderMode === 'SOLAR_RAYS' && (
          <div className="absolute bottom-2.5 right-2.5 bg-command-950/90 backdrop-blur-md border border-amber-500/50 rounded-md p-2 font-mono text-xs text-amber-300 flex items-center gap-2">
            <Sun className="w-3.5 h-3.5 animate-spin" />
            <span>Solar Hour: {currentHour}:00</span>
            <input
              type="range"
              min={6}
              max={18}
              value={currentHour}
              onChange={(e) => setCurrentHour(Number(e.target.value))}
              className="w-24 accent-amber-400 cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
};
