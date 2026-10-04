import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TelemetryContact, DomainType } from '../../types/tactical';
import { createTacticalEarthTexture } from '../../utils/earthTextureGenerator';
import { createMilStd2525Texture, calculateVelocityLeaderPositions } from '../../utils/milStd2525';
import { STRATEGIC_SAM_BATTERIES, AirDefenseBattery } from '../../utils/airDefenseCatalog';
import { NoFlyZone } from '../../utils/sandboxEngine';

export type CameraViewMode = 'global' | 'chase' | 'cockpit' | 'satellite';

interface TacticalGlobeProps {
  contacts: TelemetryContact[];
  selectedContact: TelemetryContact | null;
  onSelectContact: (contact: TelemetryContact | null) => void;
  activeDomain: DomainType;
  cameraMode?: CameraViewMode;
  onSetCameraMode?: (mode: CameraViewMode) => void;
  hudTagMode?: 'all' | 'priority' | 'off';
  activeIntercept?: {
    targetId: string;
    originName: string;
    originLat: number;
    originLon: number;
    targetLat: number;
    targetLon: number;
    progress: number;
    etaSeconds: number;
    status: 'tracking' | 'intercepted';
  } | null;
  isMilStdSymbology?: boolean;
  showAirDefense?: boolean;
  customBatteries?: AirDefenseBattery[];
  noFlyZones?: NoFlyZone[];
  onGlobeCoordinateClick?: (lat: number, lon: number) => void;
  isDeployMode?: boolean;
}

function vector3ToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const norm = v.clone().normalize();
  const phi = Math.acos(Math.max(-1, Math.min(1, norm.y)));
  const lat = 90 - (phi * 180) / Math.PI;
  const theta = Math.atan2(norm.z, -norm.x);
  let lon = (theta * 180) / Math.PI - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

// Convert Lat/Lon to 3D Cartesian Vector3 on sphere of radius R
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Tactical delta-wing directional arrow (points in heading of aircraft/vessel)
function createDirectionalChevron(colorHex: number, isSelected: boolean): THREE.Mesh {
  const shape = new THREE.Shape();
  // Nose at +Y (forward direction)
  shape.moveTo(0, 0.24);
  // Right wing tip
  shape.lineTo(0.14, -0.16);
  // Right inner notch
  shape.lineTo(0.06, -0.08);
  // Tail notch
  shape.lineTo(0, -0.03);
  // Left inner notch
  shape.lineTo(-0.06, -0.08);
  // Left wing tip
  shape.lineTo(-0.14, -0.16);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({
    color: isSelected ? 0xffffff : colorHex,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  const s = isSelected ? 1.4 : 1.0;
  mesh.scale.set(s, s, s);
  return mesh;
}

// CCTV Optical Surveillance Camera 3D Glyph
function createCameraGlyph(colorHex: number, isSelected: boolean): THREE.Group {
  const group = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(0.15, 0.12, 0.1);
  const boxMat = new THREE.MeshBasicMaterial({ color: isSelected ? 0xffffff : colorHex });
  const box = new THREE.Mesh(boxGeo, boxMat);
  group.add(box);

  const lensGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 12);
  const lensMat = new THREE.MeshBasicMaterial({ color: isSelected ? 0x00f0ff : 0xd8b4fe });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.07;
  group.add(lens);

  const s = isSelected ? 1.35 : 1.0;
  group.scale.set(s, s, s);
  return group;
}

// Orbital Satellite 3D Glyph
function createSatelliteGlyph(colorHex: number, isSelected: boolean): THREE.Group {
  const group = new THREE.Group();
  const busGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const busMat = new THREE.MeshBasicMaterial({ color: isSelected ? 0xffffff : colorHex });
  const bus = new THREE.Mesh(busGeo, busMat);
  group.add(bus);

  const panelGeo = new THREE.BoxGeometry(0.38, 0.08, 0.02);
  const panelMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const panels = new THREE.Mesh(panelGeo, panelMat);
  group.add(panels);

  const s = isSelected ? 1.35 : 1.0;
  group.scale.set(s, s, s);
  return group;
}

// Seismic Epicenter Concentric Shockwave Rings
function createSeismicGlyph(colorHex: number, isSelected: boolean): THREE.Group {
  const group = new THREE.Group();
  const ring1 = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.11, 16),
    new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide })
  );
  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.22, 16),
    new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
  );
  group.add(ring1);
  group.add(ring2);
  const s = isSelected ? 1.4 : 1.0;
  group.scale.set(s, s, s);
  return group;
}

// Orient directional chevron tangentially on sphere surface towards true heading
function alignToSphereHeading(
  object: THREE.Object3D,
  pos: THREE.Vector3,
  lat: number,
  lon: number,
  heading: number,
  radius: number
) {
  const normal = pos.clone().normalize();
  const latDelta = lat > 85 ? -0.1 : 0.1;
  const northPos = latLonToVector3(lat + latDelta, lon, radius);
  let northDir = northPos.clone().sub(pos).projectOnPlane(normal).normalize();
  if (lat > 85) northDir.negate();
  const eastDir = new THREE.Vector3().crossVectors(northDir, normal).normalize();

  const rad = (heading * Math.PI) / 180;
  const forwardDir = northDir.clone().multiplyScalar(Math.cos(rad))
    .add(eastDir.clone().multiplyScalar(Math.sin(rad)))
    .normalize();

  const rightDir = new THREE.Vector3().crossVectors(forwardDir, normal).normalize();
  const rotMatrix = new THREE.Matrix4().makeBasis(rightDir, forwardDir, normal);
  object.setRotationFromMatrix(rotMatrix);
}

// Floating Tactical Billboard Sprite displaying domain, callsign, and live telemetry
function createTacticalBillboardSprite(contact: TelemetryContact, isSelected: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d')!;

  let domainColor = '#00f0ff';
  let icon = '✈';
  if (contact.domain === 'maritime') { domainColor = '#10b981'; icon = '🚢'; }
  else if (contact.domain === 'space') { domainColor = '#f59e0b'; icon = '🛰'; }
  else if (contact.domain === 'cctv') { domainColor = '#c084fc'; icon = '📹'; }
  else if (contact.domain === 'crisis') { domainColor = '#ef4444'; icon = '⚡'; }

  // Background card
  ctx.fillStyle = isSelected ? 'rgba(0, 240, 255, 0.35)' : 'rgba(6, 10, 18, 0.85)';
  ctx.strokeStyle = isSelected ? '#ffffff' : domainColor;
  ctx.lineWidth = isSelected ? 3.5 : 2;
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 64, 8);
  ctx.fill();
  ctx.stroke();

  // Callsign & icon
  ctx.fillStyle = isSelected ? '#ffffff' : domainColor;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`${icon} ${contact.callsign.slice(0, 14)}`, 12, 30);

  // Subtitle / telemetry readout
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px monospace';
  let subInfo = '';
  if (contact.domain === 'space') subInfo = `${Math.round(contact.altitude / 1000)}km · 27k km/h`;
  else if (contact.domain === 'air') subInfo = `FL${Math.round(contact.altitude / 100)} · ${contact.speed}kt`;
  else if (contact.domain === 'maritime') subInfo = `${contact.speed}kt · ${contact.heading}°`;
  else if (contact.domain === 'cctv') subInfo = `1080P · AZ ${contact.heading}°`;
  else if (contact.domain === 'crisis') subInfo = `DEPTH ${Math.abs(Math.round(contact.altitude / 1000))}km`;
  ctx.fillText(subInfo, 12, 54);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.95, 0.27, 1);
  return sprite;
}

export const TacticalGlobe: React.FC<TacticalGlobeProps> = ({
  contacts,
  selectedContact,
  onSelectContact,
  activeDomain,
  cameraMode = 'global',
  onSetCameraMode,
  hudTagMode = 'priority',
  activeIntercept,
  isMilStdSymbology = false,
  showAirDefense = false,
  customBatteries = [],
  noFlyZones = [],
  onGlobeCoordinateClick,
  isDeployMode = false
}) => {
  const [satelliteZoom, setSatelliteZoom] = useState<number>(1);
  const [sensorFilter, setSensorFilter] = useState<'optical' | 'flir' | 'nvg' | 'cyber'>('optical');

  const cameraModeRef = useRef<CameraViewMode>(cameraMode);
  cameraModeRef.current = cameraMode;

  const selectedContactRef = useRef<TelemetryContact | null>(selectedContact);
  selectedContactRef.current = selectedContact;

  const satelliteZoomRef = useRef<number>(satelliteZoom);
  satelliteZoomRef.current = satelliteZoom;

  const coreSphereRef = useRef<THREE.Mesh | null>(null);
  const isDeployModeRef = useRef<boolean>(isDeployMode);
  isDeployModeRef.current = isDeployMode;
  const onGlobeCoordinateClickRef = useRef(onGlobeCoordinateClick);
  onGlobeCoordinateClickRef.current = onGlobeCoordinateClick;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const interceptGroupRef = useRef<THREE.Group | null>(null);
  const radarSweepRef = useRef<THREE.Mesh | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);

  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0.25, y: -0.6 });
  const currentRotationRef = useRef({ x: 0.25, y: -0.6 });
  const zoomDistanceRef = useRef(14);
  const targetZoomRef = useRef(14);

  // Keyboard shortcut: ESC to exit cockpit or satellite camera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cameraMode !== 'global') {
        onSetCameraMode?.('global');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraMode, onSetCameraMode]);

  // Filter contacts by domain
  const filteredContacts = contacts.filter(c => {
    if (activeDomain === 'all') return true;
    return c.domain === activeDomain;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05070c');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = zoomDistanceRef.current;
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0x00f0ff, 1.6);
    sunLight.position.set(12, 10, 15);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x4f46e5, 1.0);
    rimLight.position.set(-15, -10, -10);
    scene.add(rimLight);

    // Master Globe Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const GLOBE_RADIUS = 5;

    // 1. Core Sphere with High-Contrast Tactical Earth Texture
    const earthTexture = createTacticalEarthTexture();
    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const sphereMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpScale: 0.05,
      specular: new THREE.Color('#0e1e38'),
      shininess: 25,
    });
    const coreSphere = new THREE.Mesh(sphereGeo, sphereMat);
    // Rotate texture 180 deg to align longitude 0
    coreSphere.rotation.y = -Math.PI / 2;
    globeGroup.add(coreSphere);
    coreSphereRef.current = coreSphere;

    // 2. Geodetic Coordinate Grid Wireframe
    const gridGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.003, 36, 18);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const gridSphere = new THREE.Mesh(gridGeo, gridMat);
    globeGroup.add(gridSphere);

    // 3. Equator Reference Ring
    const ringMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.5 });
    const ringGeo = new THREE.BufferGeometry();
    const ringPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      ringPoints.push(new THREE.Vector3(Math.cos(theta) * GLOBE_RADIUS * 1.006, 0, Math.sin(theta) * GLOBE_RADIUS * 1.006));
    }
    ringGeo.setFromPoints(ringPoints);
    const equator = new THREE.Line(ringGeo, ringMat);
    globeGroup.add(equator);

    // 4. Subtle Outer Atmosphere Glow Rim
    const glowGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.18, 32, 32);
    const glowMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0, 0, 1.0)), 2.5);
          gl_FragColor = vec4(0.0, 0.85, 1.0, 1.0) * intensity * 0.45;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphere = new THREE.Mesh(glowGeo, glowMat);
    scene.add(atmosphere);

    // 5. Starfield Dust
    const starsGeo = new THREE.BufferGeometry();
    const starVertices: number[] = [];
    for (let i = 0; i < 750; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      starVertices.push(x, y, z);
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0x4a6080, size: 0.16, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // 6. Polar Radar Sweep Plane
    const radarGeo = new THREE.RingGeometry(0.1, GLOBE_RADIUS * 1.25, 32);
    const radarMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.06,
    });
    const radarSweep = new THREE.Mesh(radarGeo, radarMat);
    radarSweep.rotation.x = Math.PI / 2;
    globeGroup.add(radarSweep);
    radarSweepRef.current = radarSweep;

    // Group for dynamic contact markers
    const markersGroup = new THREE.Group();
    globeGroup.add(markersGroup);
    markersGroupRef.current = markersGroup;

    // Group for missile intercept trajectory and missile beacon
    const interceptGroup = new THREE.Group();
    globeGroup.add(interceptGroup);
    interceptGroupRef.current = interceptGroup;

    // 7. ISS & Satellite Orbital Plane Track Ring (51.64 deg inclination)
    const orbitPoints: THREE.Vector3[] = [];
    const ORBIT_R = GLOBE_RADIUS + 1.6;
    for (let i = 0; i <= 96; i++) {
      const theta = (i / 96) * Math.PI * 2;
      orbitPoints.push(new THREE.Vector3(Math.cos(theta) * ORBIT_R, 0, Math.sin(theta) * ORBIT_R));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.35,
      gapSize: 0.25,
      transparent: true,
      opacity: 0.35
    });
    const orbitRing = new THREE.Line(orbitGeo, orbitMat);
    orbitRing.computeLineDistances();
    orbitRing.rotation.z = (51.64 * Math.PI) / 180;
    globeGroup.add(orbitRing);

    // Reticle Mesh
    const reticleGeo = new THREE.RingGeometry(0.24, 0.32, 16);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.visible = false;
    scene.add(reticle);
    reticleRef.current = reticle;

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      const mode = cameraModeRef.current;
      const target = selectedContactRef.current;

      if (mode !== 'global' && target && globeGroupRef.current && cameraRef.current) {
        const altOffset = target.domain === 'space' ? 1.6 : target.domain === 'air' ? 0.35 : 0.08;
        const localPos = latLonToVector3(target.lat, target.lon, GLOBE_RADIUS + altOffset);
        const worldPos = localPos.clone().applyMatrix4(globeGroupRef.current.matrixWorld);
        const worldNormal = worldPos.clone().normalize();

        const latDelta = target.lat > 85 ? -0.1 : 0.1;
        const northLocal = latLonToVector3(target.lat + latDelta, target.lon, GLOBE_RADIUS + altOffset);
        let northDir = northLocal.clone().sub(localPos).projectOnPlane(localPos.clone().normalize()).normalize();
        if (target.lat > 85) northDir.negate();
        const eastDir = new THREE.Vector3().crossVectors(northDir, localPos.clone().normalize()).normalize();
        const rad = (target.heading * Math.PI) / 180;
        const forwardLocal = northDir.clone().multiplyScalar(Math.cos(rad)).add(eastDir.clone().multiplyScalar(Math.sin(rad))).normalize();
        const worldForward = forwardLocal.clone().transformDirection(globeGroupRef.current.matrixWorld);

        if (mode === 'cockpit') {
          camera.fov = 55;
          camera.updateProjectionMatrix();
          camera.position.copy(worldPos)
            .add(worldForward.clone().multiplyScalar(0.32))
            .add(worldNormal.clone().multiplyScalar(0.05));
          camera.lookAt(worldPos.clone().add(worldForward.clone().multiplyScalar(8.0)));
          camera.up.copy(worldNormal);

          // Ensure target's own 3D chevron/pin is hidden from cockpit camera
          if (markersGroupRef.current) {
            markersGroupRef.current.children.forEach(child => {
              if (child.userData?.contactId === target.id) {
                child.visible = false;
              }
            });
          }
        } else if (mode === 'chase') {
          camera.fov = 50;
          camera.updateProjectionMatrix();
          camera.position.copy(worldPos)
            .sub(worldForward.clone().multiplyScalar(0.72))
            .add(worldNormal.clone().multiplyScalar(0.28));
          camera.lookAt(worldPos.clone().add(worldForward.clone().multiplyScalar(1.2)));
          camera.up.copy(worldNormal);
        } else if (mode === 'satellite') {
          const z = satelliteZoomRef.current || 1;
          camera.fov = 45 / z;
          camera.updateProjectionMatrix();
          camera.position.copy(worldPos);
          camera.lookAt(new THREE.Vector3(0, 0, 0));
          camera.up.copy(worldForward);
        }
      } else {
        // Global Orbit Mode
        if (cameraRef.current) {
          if (cameraRef.current.fov !== 45) {
            cameraRef.current.fov = 45;
            cameraRef.current.updateProjectionMatrix();
            cameraRef.current.up.set(0, 1, 0);
          }
        }

        // Subtle slow planetary idle spin if not dragging
        if (!isDraggingRef.current && !selectedContact) {
          targetRotationRef.current.y += 0.02 * delta;
        }

        // Smooth camera orbit damping
        currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.08;
        currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.08;

        if (globeGroupRef.current) {
          globeGroupRef.current.rotation.x = currentRotationRef.current.x;
          globeGroupRef.current.rotation.y = currentRotationRef.current.y;
        }

        // Smooth zoom damping
        zoomDistanceRef.current += (targetZoomRef.current - zoomDistanceRef.current) * 0.1;
        if (cameraRef.current) {
          cameraRef.current.position.set(0, 0, zoomDistanceRef.current);
        }
      }

      // Rotate radar sweep
      if (radarSweepRef.current) {
        radarSweepRef.current.rotation.z += 0.5 * delta;
      }

      // Hide billboards on the far side of the Earth
      if (markersGroupRef.current && cameraRef.current) {
        const camPos = cameraRef.current.position;
        const children = markersGroupRef.current.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.userData?.isBillboard) {
            const wp = new THREE.Vector3();
            child.getWorldPosition(wp);
            const normal = wp.clone().normalize();
            const toCam = camPos.clone().sub(wp).normalize();
            child.visible = normal.dot(toCam) > 0.12;
          }
        }
      }

      // Update Reticle position if target selected
      if (reticleRef.current && selectedContact && globeGroupRef.current) {
        const altOffset = selectedContact.domain === 'space' ? 1.6 : selectedContact.domain === 'air' ? 0.35 : 0.08;
        const localPos = latLonToVector3(selectedContact.lat, selectedContact.lon, GLOBE_RADIUS + altOffset);
        const worldPos = localPos.clone().applyMatrix4(globeGroupRef.current.matrixWorld);
        reticleRef.current.position.copy(worldPos);
        reticleRef.current.lookAt(camera.position);
        reticleRef.current.visible = true;
      } else if (reticleRef.current) {
        reticleRef.current.visible = false;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Mouse Drag & Orbit Controls
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragDistanceRef.current = 0;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - prevMouseRef.current.x;
      const deltaY = e.clientY - prevMouseRef.current.y;
      dragDistanceRef.current += Math.abs(deltaX) + Math.abs(deltaY);

      targetRotationRef.current.y += deltaX * 0.005;
      targetRotationRef.current.x += deltaY * 0.005;

      // Pitch clamping
      targetRotationRef.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotationRef.current.x));

      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoomRef.current += e.deltaY * 0.005;
      targetZoomRef.current = Math.max(6.5, Math.min(22.0, targetZoomRef.current));
    };

    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Dynamic Contact Markers
  useEffect(() => {
    const markersGroup = markersGroupRef.current;
    if (!markersGroup) return;

    // Clear old markers
    while (markersGroup.children.length > 0) {
      markersGroup.remove(markersGroup.children[0]);
    }

    const GLOBE_RADIUS = 5;

    filteredContacts.forEach(contact => {
      // Altitude offset
      const altOffset = contact.domain === 'space' ? 1.6 : contact.domain === 'air' ? 0.35 : 0.08;
      const pos = latLonToVector3(contact.lat, contact.lon, GLOBE_RADIUS + altOffset);

      // Marker Color
      let colorHex = 0x00f0ff; // Air cyan
      if (contact.domain === 'maritime') colorHex = 0x10b981; // Naval emerald
      if (contact.domain === 'space') colorHex = 0xf59e0b; // Space amber
      if (contact.domain === 'cctv') colorHex = 0xc084fc; // Surveillance purple
      if (contact.domain === 'crisis') colorHex = 0xef4444; // Crisis crimson

      const isSelected = selectedContact?.id === contact.id;

      // 1. Domain-Specific Tactical Glyph (Standard Chevron or NATO MIL-STD-2525D)
      let glyph: THREE.Object3D;
      if (isMilStdSymbology) {
        const milTexture = createMilStd2525Texture(contact, isSelected);
        const spriteMat = new THREE.SpriteMaterial({
          map: milTexture,
          transparent: true,
          depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMat);
        const s = isSelected ? 0.65 : 0.48;
        sprite.scale.set(s, s, 1);
        glyph = sprite;
      } else if (contact.domain === 'air' || contact.domain === 'maritime') {
        glyph = createDirectionalChevron(colorHex, isSelected);
        alignToSphereHeading(glyph, pos, contact.lat, contact.lon, contact.heading, GLOBE_RADIUS + altOffset);
      } else if (contact.domain === 'space') {
        glyph = createSatelliteGlyph(colorHex, isSelected);
        alignToSphereHeading(glyph, pos, contact.lat, contact.lon, contact.heading, GLOBE_RADIUS + altOffset);
      } else if (contact.domain === 'cctv') {
        glyph = createCameraGlyph(colorHex, isSelected);
        alignToSphereHeading(glyph, pos, contact.lat, contact.lon, contact.heading, GLOBE_RADIUS + altOffset);
      } else {
        glyph = createSeismicGlyph(colorHex, isSelected);
        const normal = pos.clone().normalize();
        glyph.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      }

      // In Cockpit mode, hide the selected vehicle's own chevron so it doesn't clip into camera view
      if (cameraMode === 'cockpit' && isSelected) {
        glyph.visible = false;
      }

      glyph.position.copy(pos);
      glyph.userData = { contactId: contact.id };
      glyph.traverse(child => { child.userData = { contactId: contact.id }; });
      markersGroup.add(glyph);

      // 2. Altitude Tether Pin to Ground (hidden in cockpit for selected vehicle)
      if (!(cameraMode === 'cockpit' && isSelected)) {
        const groundPos = latLonToVector3(contact.lat, contact.lon, GLOBE_RADIUS);
        const lineGeo = new THREE.BufferGeometry().setFromPoints([groundPos, pos]);
        const lineMat = new THREE.LineBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: isSelected ? 0.95 : 0.35,
        });
        const tether = new THREE.Line(lineGeo, lineMat);
        markersGroup.add(tether);
      }

      // 3. Velocity Heading Vector Line or MIL-STD Velocity Leaders (Air / Maritime / Space)
      if (contact.speed > 0 && !(cameraMode === 'cockpit' && isSelected)) {
        if (isMilStdSymbology && contact.speed > 25) {
          // MIL-STD-2525 Kinematic Velocity Leader (1-min, 3-min, 5-min projected vectors)
          const leaders = calculateVelocityLeaderPositions(
            contact.lat,
            contact.lon,
            contact.heading,
            contact.speed,
            GLOBE_RADIUS + altOffset
          );
          const leaderGeo = new THREE.BufferGeometry().setFromPoints([pos, leaders.min1, leaders.min3, leaders.min5]);
          const leaderMat = new THREE.LineDashedMaterial({
            color: isSelected ? 0xffffff : colorHex,
            dashSize: 0.08,
            gapSize: 0.04,
            transparent: true,
            opacity: 0.85
          });
          const leaderLine = new THREE.Line(leaderGeo, leaderMat);
          leaderLine.computeLineDistances();
          markersGroup.add(leaderLine);

          // 5-min projected arrival pip
          const tickMesh = new THREE.Mesh(
            new THREE.CircleGeometry(0.025, 8),
            new THREE.MeshBasicMaterial({ color: isSelected ? 0xffffff : colorHex, side: THREE.DoubleSide })
          );
          tickMesh.position.copy(leaders.min5);
          tickMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), leaders.min5.clone().normalize());
          markersGroup.add(tickMesh);
        } else {
          // Standard velocity ray
          const rad = (contact.heading * Math.PI) / 180;
          const forwardLat = contact.lat + Math.cos(rad) * 1.5;
          const forwardLon = contact.lon + Math.sin(rad) * 1.5;
          const forwardPos = latLonToVector3(forwardLat, forwardLon, GLOBE_RADIUS + altOffset);

          const headingGeo = new THREE.BufferGeometry().setFromPoints([pos, forwardPos]);
          const headingMat = new THREE.LineBasicMaterial({
            color: isSelected ? 0xffffff : colorHex,
            transparent: true,
            opacity: 0.6,
          });
          const headingLine = new THREE.Line(headingGeo, headingMat);
          markersGroup.add(headingLine);
        }
      }

      // 4. Floating Tactical Billboard Info Tag (displaying callsign + telemetry above dot)
      const shouldShowTag =
        hudTagMode === 'all'
          ? true
          : hudTagMode === 'priority'
          ? isSelected || contact.threatLevel === 'CRITICAL' || contact.threatLevel === 'HIGH' || contact.domain === 'space'
          : false;

      if (shouldShowTag && !(cameraMode === 'cockpit' && isSelected)) {
        const normal = pos.clone().normalize();
        const rightOffset = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0)).normalize();
        if (rightOffset.lengthSq() < 0.1) rightOffset.set(1, 0, 0);

        const billboardPos = pos.clone()
          .add(normal.clone().multiplyScalar(0.24))
          .add(rightOffset.clone().multiplyScalar(0.65));

        const billboard = createTacticalBillboardSprite(contact, isSelected);
        billboard.position.copy(billboardPos);
        billboard.userData = { contactId: contact.id, isBillboard: true };
        markersGroup.add(billboard);

        // Connecting lead line from marker to billboard tag
        const anchorGeo = new THREE.BufferGeometry().setFromPoints([pos, billboardPos]);
        const anchorMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0xffffff : colorHex,
          transparent: true,
          opacity: isSelected ? 0.8 : 0.4,
        });
        const anchorLine = new THREE.Line(anchorGeo, anchorMat);
        anchorLine.userData = { isBillboard: true };
        markersGroup.add(anchorLine);
      }
    });

    // 5. Strategic & Sandbox Air Defense (SAM) Threat Domes
    if (showAirDefense) {
      const allBatteries = [...STRATEGIC_SAM_BATTERIES, ...customBatteries];
      allBatteries.forEach(battery => {
        const bPos = latLonToVector3(battery.lat, battery.lon, GLOBE_RADIUS);
        const normal = bPos.clone().normalize();
        
        // Scale engagement dome radius: 100km ~= 0.08 units on 5-unit globe
        const domeRadius = (battery.system.engagementRangeKm / 6371) * GLOBE_RADIUS;
        
        // 3D Wireframe Hemisphere for Engagement Envelope
        const domeGeo = new THREE.SphereGeometry(
          domeRadius,
          16,
          10,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2
        );
        const domeMat = new THREE.MeshBasicMaterial({
          color: battery.system.colorHex,
          wireframe: true,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide
        });
        const domeMesh = new THREE.Mesh(domeGeo, domeMat);
        domeMesh.position.copy(bPos);
        domeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        markersGroup.add(domeMesh);

        // Ground Radar Coverage Perimeter Ring
        const ringGeo = new THREE.RingGeometry(domeRadius * 0.96, domeRadius, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: battery.system.colorHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(bPos);
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        markersGroup.add(ringMesh);

        // Battery Base Marker Pin
        const pinMesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.07, 0),
          new THREE.MeshBasicMaterial({ color: battery.system.colorHex })
        );
        pinMesh.position.copy(bPos);
        markersGroup.add(pinMesh);
      });
    }

    // 6. 3D Volumetric No-Fly Zones (NFZ / ROZ)
    noFlyZones.forEach(zone => {
      if (zone.points.length < 3) return;
      const groundPts = zone.points.map(p => latLonToVector3(p[0], p[1], GLOBE_RADIUS));
      const ceilPts = zone.points.map(p => latLonToVector3(p[0], p[1], GLOBE_RADIUS + 0.35));

      // Close polygon loop
      groundPts.push(groundPts[0]);
      ceilPts.push(ceilPts[0]);

      // Ground perimeter line
      const gGeo = new THREE.BufferGeometry().setFromPoints(groundPts);
      const gMat = new THREE.LineBasicMaterial({
        color: zone.colorHex,
        transparent: true,
        opacity: 0.75
      });
      markersGroup.add(new THREE.Line(gGeo, gMat));

      // Ceiling boundary line
      const cGeo = new THREE.BufferGeometry().setFromPoints(ceilPts);
      const cMat = new THREE.LineDashedMaterial({
        color: zone.colorHex,
        dashSize: 0.1,
        gapSize: 0.05,
        transparent: true,
        opacity: 0.9
      });
      const cLine = new THREE.Line(cGeo, cMat);
      cLine.computeLineDistances();
      markersGroup.add(cLine);

      // Vertical boundary fence struts
      for (let i = 0; i < zone.points.length; i++) {
        const strutGeo = new THREE.BufferGeometry().setFromPoints([groundPts[i], ceilPts[i]]);
        const strutMat = new THREE.LineBasicMaterial({
          color: zone.colorHex,
          transparent: true,
          opacity: 0.55
        });
        markersGroup.add(new THREE.Line(strutGeo, strutMat));
      }
    });
  }, [filteredContacts, selectedContact, hudTagMode, cameraMode, isMilStdSymbology, showAirDefense, customBatteries, noFlyZones]);

  // Render Dynamic Intercept Vector Spline & Hypersonic Missile Beacon
  useEffect(() => {
    const group = interceptGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    if (!activeIntercept) return;

    const GLOBE_RADIUS = 5;
    const start = latLonToVector3(activeIntercept.originLat, activeIntercept.originLon, GLOBE_RADIUS);
    const end = latLonToVector3(activeIntercept.targetLat, activeIntercept.targetLon, GLOBE_RADIUS + 0.35);

    // Ballistic apogee midpoint
    const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_RADIUS + 1.35);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(45);

    // Glowing trajectory line
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xff2255,
      dashSize: 0.18,
      gapSize: 0.09,
      transparent: true,
      opacity: 0.95,
    });
    const trajectoryLine = new THREE.Line(lineGeo, lineMat);
    trajectoryLine.computeLineDistances();
    group.add(trajectoryLine);

    // Launcher Base Platform Disc
    const baseMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    baseMesh.position.copy(start);
    baseMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), start.clone().normalize());
    group.add(baseMesh);

    // Missile Position along trajectory
    const t = Math.max(0.01, Math.min(0.99, activeIntercept.progress));
    const missilePos = curve.getPoint(t);

    const mslMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({ color: 0xffdd00 })
    );
    mslMesh.position.copy(missilePos);
    group.add(mslMesh);

    const exhaustMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.75 })
    );
    exhaustMesh.position.copy(missilePos);
    group.add(exhaustMesh);

    // Target Impact Engagement Zone Ring
    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.32, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0044, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    targetRing.position.copy(end);
    targetRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), end.clone().normalize());
    group.add(targetRing);
  }, [activeIntercept]);

  // Click Raycaster for Target Selection (Ensuring drag does not trigger click)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      // If user was dragging more than 6 pixels, don't treat as a click
      if (dragDistanceRef.current > 6) return;
      if (!cameraRef.current || !markersGroupRef.current) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      // If in deploy mode, raycast against the globe sphere to get lat/lon
      if (isDeployModeRef.current && coreSphereRef.current && globeGroupRef.current) {
        const sphereIntersects = raycaster.intersectObject(coreSphereRef.current, false);
        if (sphereIntersects.length > 0) {
          const pt = globeGroupRef.current.worldToLocal(sphereIntersects[0].point.clone());
          const coords = vector3ToLatLon(pt);
          onGlobeCoordinateClickRef.current?.(coords.lat, coords.lon);
          return;
        }
      }

      const intersects = raycaster.intersectObjects(markersGroupRef.current.children, true);
      if (intersects.length > 0) {
        for (let i = 0; i < intersects.length; i++) {
          let obj: THREE.Object3D | null = intersects[i].object;
          while (obj && !obj.userData?.contactId) {
            obj = obj.parent;
          }
          if (obj?.userData?.contactId) {
            const matched = contacts.find(c => c.id === obj!.userData.contactId);
            if (matched) {
              onSelectContact(matched);
              // Swing globe rotation to center target
              targetRotationRef.current.y = -(matched.lon * Math.PI) / 180 - Math.PI / 2;
              targetRotationRef.current.x = (matched.lat * Math.PI) / 180;
              targetZoomRef.current = 10.5;
              break;
            }
          }
        }
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [contacts, onSelectContact]);

  // Camera Target Fly-To on Prop Change
  useEffect(() => {
    if (selectedContact) {
      targetRotationRef.current.y = -(selectedContact.lon * Math.PI) / 180 - Math.PI / 2;
      targetRotationRef.current.x = (selectedContact.lat * Math.PI) / 180;
      targetZoomRef.current = 10.5;
    }
  }, [selectedContact]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#05070c]">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Tactical Coordinate Status when in Global Mode */}
      {cameraMode === 'global' && (
        <>
          <div className="absolute top-4 left-4 pointer-events-none font-mono text-[11px] text-cyan-400 bg-[#0c101c]/85 border border-cyan-500/30 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-lg shadow-black/60 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-bold">LIVE TELEMETRY STREAMING</span>
            </div>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400 text-[10px]">USGS · ADSB.LOL · ISS LIVE · CCTV</span>
          </div>

          <div className="absolute bottom-4 left-4 pointer-events-none font-mono text-[10px] text-zinc-500 bg-[#080b12]/80 px-2.5 py-1 rounded-md border border-[#1b2333]">
            DRAG TO ROTATE GLOBE · SCROLL TO ZOOM · CLICK TARGET TO LOCK & INSPECT
          </div>
        </>
      )}

      {/* 1. FIGHTER / RECON COCKPIT & CHASE CAMERA HUD */}
      {(cameraMode === 'cockpit' || cameraMode === 'chase') && selectedContact && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 select-none font-mono">
          {/* Top Heading Compass Tape */}
          <div className="flex flex-col items-center">
            <div className="bg-black/85 border border-cyan-500/50 px-6 py-2.5 rounded-xl backdrop-blur-md text-center pointer-events-auto flex items-center gap-4 shadow-xl shadow-cyan-500/20">
              <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                {cameraMode === 'cockpit' ? 'HUD COCKPIT POV' : 'TACTICAL CHASE CAM'}
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-white font-black text-sm tracking-widest">
                HDG {selectedContact.heading.toString().padStart(3, '0')}° TRUE
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-emerald-400 text-xs font-semibold">
                {selectedContact.callsign} ({selectedContact.type})
              </span>
              <button
                type="button"
                onClick={() => onSetCameraMode?.(cameraMode === 'cockpit' ? 'chase' : 'cockpit')}
                className="ml-3 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 rounded-lg border border-cyan-500/40 text-[11px] font-bold cursor-pointer transition-colors"
              >
                SWITCH TO {cameraMode === 'cockpit' ? 'CHASE CAM' : 'COCKPIT'}
              </button>
              <button
                type="button"
                onClick={() => onSetCameraMode?.('global')}
                className="px-3 py-1 bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 rounded-lg border border-rose-500/50 text-[11px] font-black cursor-pointer transition-colors"
              >
                EXIT CAM (ESC)
              </button>
            </div>
          </div>

          {/* Center Collimated Flight Pitch Ladder */}
          <div className="relative flex-1 flex items-center justify-center">
            <div className="w-88 border-t-2 border-cyan-400/80 relative flex items-center justify-center">
              <span className="absolute -top-3.5 left-2 text-[10px] text-cyan-400 font-black">00°</span>
              <span className="absolute -top-3.5 right-2 text-[10px] text-cyan-400 font-black">00°</span>
              {/* Flight Path Vector Reticle */}
              <div className="w-9 h-9 rounded-full border-2 border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-400/30">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              </div>
            </div>

            {/* Pitch +10 line */}
            <div className="absolute top-[36%] w-52 border-t-2 border-dashed border-cyan-400/50 flex justify-between px-2 text-[10px] text-cyan-400 font-bold">
              <span>+10</span>
              <span>+10</span>
            </div>

            {/* Pitch -10 line */}
            <div className="absolute top-[64%] w-52 border-t-2 border-dashed border-cyan-400/50 flex justify-between px-2 text-[10px] text-cyan-400 font-bold">
              <span>-10</span>
              <span>-10</span>
            </div>
          </div>

          {/* Bottom Telemetry Tapes: Airspeed on Left, Altitude on Right */}
          <div className="flex justify-between items-end">
            {/* Speed Tape */}
            <div className="bg-black/85 border border-cyan-500/40 p-3.5 rounded-xl backdrop-blur-md space-y-1 shadow-lg shadow-black/80">
              <span className="text-[10px] text-zinc-400 block font-bold">AIRSPEED (KTS)</span>
              <span className="text-3xl font-black text-cyan-400 tracking-wider">
                {selectedContact.speed}
              </span>
              <span className="text-[10px] text-zinc-500 block">MACH {(selectedContact.speed / 661).toFixed(2)}</span>
            </div>

            {/* Attitude & G-Load */}
            <div className="text-center text-[10px] text-zinc-500 bg-black/60 px-3 py-1 rounded-md border border-[#1b2333]">
              MIL-STD-1787D HEAD-UP DISPLAY · 60 FPS REAL-TIME
            </div>

            {/* Altitude Tape */}
            <div className="bg-black/85 border border-cyan-500/40 p-3.5 rounded-xl backdrop-blur-md space-y-1 text-right shadow-lg shadow-black/80">
              <span className="text-[10px] text-zinc-400 block font-bold">BARO ALTITUDE (FT)</span>
              <span className="text-3xl font-black text-emerald-400 tracking-wider">
                {selectedContact.altitude.toLocaleString()}
              </span>
              <span className="text-[10px] text-zinc-500 block">SQUAWK {selectedContact.squawk || '1200'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. SPY SATELLITE DOWNWARD EARTH RECON HUD OVERLAY */}
      {cameraMode === 'satellite' && selectedContact && (
        <div className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-6 select-none font-mono ${
          sensorFilter === 'flir'
            ? 'backdrop-contrast-150 backdrop-grayscale backdrop-sepia'
            : sensorFilter === 'nvg'
            ? 'backdrop-hue-rotate-90 backdrop-brightness-125'
            : sensorFilter === 'cyber'
            ? 'backdrop-invert-[0.15] backdrop-hue-rotate-180'
            : ''
        }`}>
          {/* CRT scanlines effect */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px] opacity-70 pointer-events-none" />

          {/* Top Satellite Command Banner */}
          <div className="flex justify-between items-start z-10">
            <div className="bg-black/85 border border-amber-500/40 p-3 rounded-xl backdrop-blur-md shadow-xl shadow-amber-500/10">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span>ORBITAL RECONNAISSANCE SENSOR: {selectedContact.callsign}</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                DOWNWARD NADIR APERTURE · SUB-SATELLITE POINT: {selectedContact.lat.toFixed(4)}°N {selectedContact.lon.toFixed(4)}°E
              </p>
            </div>

            {/* Filter & Zoom Controls */}
            <div className="flex items-center gap-2 pointer-events-auto bg-black/85 border border-amber-500/40 p-2 rounded-xl backdrop-blur-md shadow-xl">
              <span className="text-[10px] text-zinc-400 font-bold px-1">SPECTRUM:</span>
              {(['optical', 'flir', 'nvg', 'cyber'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSensorFilter(f)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    sensorFilter === f
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-[#151c2a] text-zinc-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}

              <span className="text-zinc-600 px-1">|</span>
              <span className="text-[10px] text-zinc-400 font-bold px-1">ZOOM:</span>
              {([1, 2, 5, 10] as const).map(z => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setSatelliteZoom(z)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    satelliteZoom === z
                      ? 'bg-cyan-500 text-black shadow-md'
                      : 'bg-[#151c2a] text-zinc-400 hover:text-white'
                  }`}
                >
                  {z}X
                </button>
              ))}

              <button
                type="button"
                onClick={() => onSetCameraMode?.('global')}
                className="ml-2 px-3 py-1 bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 rounded border border-rose-500/50 text-[10px] font-bold cursor-pointer transition-colors"
              >
                EXIT SATELLITE CAM (ESC)
              </button>
            </div>
          </div>

          {/* Center Spy Recon Reticle & Stadiametric Crosshairs */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative flex items-center justify-center">
              <div className="w-64 h-64 rounded-full border border-amber-500/30 animate-pulse" />
              <div className="w-96 h-96 rounded-full border border-dashed border-amber-500/20" />
              <div className="absolute w-[450px] h-[1px] bg-amber-500/30" />
              <div className="absolute h-[450px] w-[1px] bg-amber-500/30" />
              <div className="w-14 h-14 border border-amber-400 flex items-center justify-center">
                <div className="w-2 h-2 bg-amber-400" />
              </div>
            </div>
          </div>

          {/* Bottom Telemetry Strip */}
          <div className="flex justify-between items-end z-10">
            <div className="bg-black/85 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs text-amber-300 backdrop-blur-md">
              <span className="text-[10px] text-zinc-500 block">ORBITAL VELOCITY</span>
              <span className="font-bold text-sm">27,600 KM/H (7.66 KM/S)</span>
            </div>

            <div className="bg-black/85 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs text-right text-cyan-300 backdrop-blur-md">
              <span className="text-[10px] text-zinc-500 block">APOGEE ALTITUDE</span>
              <span className="font-bold text-sm">420 KM ORBITAL PLANE</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
