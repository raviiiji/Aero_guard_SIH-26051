import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { ShelterGeometry, SimulationResult } from '../types';

interface Shelter3DViewerProps {
  geometry: ShelterGeometry;
  simResult: SimulationResult | null;
  troops: number;
  simulatedHour?: number;
}

type RenderMode = 'CAMO' | 'THERMAL_IR' | 'SOLAR_RAYS' | 'INTERIOR_BUNKS';

export const Shelter3DViewer: React.FC<Shelter3DViewerProps> = ({
  geometry,
  simResult,
  troops,
  simulatedHour = 12,
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

  // Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 450;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070b14');
    scene.fog = new THREE.FogExp2('#070b14', 0.035);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
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
      controls.update();
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
      group.add(archMesh);

      // End Caps
      const endCapGeo = new THREE.CircleGeometry(radius, 32, 0, Math.PI);
      const endCap1 = new THREE.Mesh(endCapGeo, wallMat);
      endCap1.position.set(-L / 2, radius, 0);
      endCap1.rotation.y = -Math.PI / 2;
      group.add(endCap1);

      const endCap2 = new THREE.Mesh(endCapGeo, wallMat);
      endCap2.position.set(L / 2, radius, 0);
      endCap2.rotation.y = Math.PI / 2;
      group.add(endCap2);

      // Windows on End Cap
      const winGeo = new THREE.BoxGeometry(0.1, 1.2, 1.4);
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(L / 2 + 0.05, radius / 2, 0);
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
        group.add(roofSouth);

        // North Pitch
        const roofNorth = new THREE.Mesh(roofSlabGeo, roofMat);
        roofNorth.position.set(0, H + 0.2 + roofRise / 2, -W / 4);
        roofNorth.rotation.x = -pitchRad;
        roofNorth.castShadow = true;
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
        group.add(trombeGlass);
      }

      // 6. Tactical Entrance Airlock Door (West side)
      const doorGeo = new THREE.BoxGeometry(0.1, 1.9, 0.9);
      const doorMat = new THREE.MeshStandardMaterial({ color: '#06b6d4', metalness: 0.7 });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(L / 2 + 0.05, 1.9 / 2 + 0.2, 0);
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
