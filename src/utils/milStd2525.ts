/**
 * MIL-STD-2525D / NATO APP-6D Tactical Symbology & Velocity Leader Engine
 * Generates standards-compliant military symbology frames and kinematic velocity vectors.
 */

import * as THREE from 'three';
import { TelemetryContact, ThreatLevel } from '../types/tactical';

export type StandardIdentity = 'HOSTILE' | 'FRIEND' | 'NEUTRAL' | 'UNKNOWN';

export interface MilSymbolConfig {
  identity: StandardIdentity;
  domain: 'air' | 'maritime' | 'space' | 'cctv' | 'crisis';
  colorHex: number;
  colorStr: string;
  frameType: 'diamond' | 'rectangle' | 'square' | 'circle';
  sidc: string; // 20-digit Symbol Identification Code
}

/**
 * Determine MIL-STD-2525 Standard Identity based on contact properties
 */
export function getStandardIdentity(contact: TelemetryContact): StandardIdentity {
  if (contact.threatLevel === 'CRITICAL' || contact.threatLevel === 'HIGH') {
    return 'HOSTILE';
  }
  if (contact.category === 'Military' && contact.country.includes('Allied')) {
    return 'FRIEND';
  }
  if (contact.country.includes('NASA') || contact.country.includes('ESA') || contact.category === 'Surveillance') {
    return 'FRIEND';
  }
  if (contact.category === 'Commercial') {
    return 'NEUTRAL';
  }
  if (contact.threatLevel === 'ELEVATED') {
    return 'UNKNOWN';
  }
  return 'FRIEND';
}

/**
 * Generate 20-digit MIL-STD-2525D SIDC
 */
export function generateSIDC(contact: TelemetryContact, identity: StandardIdentity): string {
  // SIDC Structure:
  // Set (10), Standard Identity (1-6), Symbol Set (01 Air, 30 Maritime, 05 Space, etc.)
  const identityCode = identity === 'HOSTILE' ? '6' : identity === 'FRIEND' ? '3' : identity === 'NEUTRAL' ? '4' : '1';
  let symbolSet = '01'; // Air
  if (contact.domain === 'maritime') symbolSet = '30';
  else if (contact.domain === 'space') symbolSet = '05';
  else if (contact.domain === 'cctv') symbolSet = '15'; // Sensor/Ground
  else if (contact.domain === 'crisis') symbolSet = '25'; // Emergency Management

  return `100${identityCode}${symbolSet}00001100000000`;
}

/**
 * Resolve full military symbology configuration for a contact
 */
export function resolveMilSymbolConfig(contact: TelemetryContact): MilSymbolConfig {
  const identity = getStandardIdentity(contact);
  const sidc = generateSIDC(contact, identity);

  switch (identity) {
    case 'HOSTILE':
      return {
        identity,
        domain: contact.domain,
        colorHex: 0xef4444, // Red
        colorStr: '#ef4444',
        frameType: 'diamond',
        sidc
      };
    case 'FRIEND':
      return {
        identity,
        domain: contact.domain,
        colorHex: 0x38bdf8, // Cyan/Blue
        colorStr: '#38bdf8',
        frameType: contact.domain === 'air' ? 'circle' : 'rectangle',
        sidc
      };
    case 'NEUTRAL':
      return {
        identity,
        domain: contact.domain,
        colorHex: 0x22c55e, // Green
        colorStr: '#22c55e',
        frameType: 'square',
        sidc
      };
    case 'UNKNOWN':
    default:
      return {
        identity: 'UNKNOWN',
        domain: contact.domain,
        colorHex: 0xeab308, // Yellow
        colorStr: '#eab308',
        frameType: 'circle',
        sidc
      };
  }
}

/**
 * Generates high-definition MIL-STD-2525 Canvas texture for Three.js Sprite
 */
export function createMilStd2525Texture(
  contact: TelemetryContact,
  isSelected: boolean = false
): THREE.CanvasTexture {
  const config = resolveMilSymbolConfig(contact);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, 128, 128);

  const cx = 64;
  const cy = 64;
  const size = 42;
  const color = isSelected ? '#ffffff' : config.colorStr;

  ctx.lineWidth = isSelected ? 4 : 3;
  ctx.strokeStyle = color;
  ctx.fillStyle = config.colorStr + (isSelected ? '40' : '22');

  // Draw MIL-STD-2525 Frame based on identity
  ctx.beginPath();
  if (config.identity === 'HOSTILE') {
    // Red Diamond (◆)
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();
  } else if (config.identity === 'NEUTRAL') {
    // Green Square (■)
    ctx.rect(cx - size * 0.8, cy - size * 0.8, size * 1.6, size * 1.6);
  } else if (config.identity === 'UNKNOWN') {
    // Yellow Arch / Quatrefoil
    ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
  } else {
    // Friend (Rectangle for surface/air, arch for air in 2525D)
    if (contact.domain === 'air') {
      ctx.arc(cx, cy, size * 0.85, Math.PI, 0, false);
      ctx.lineTo(cx + size * 0.85, cy + size * 0.4);
      ctx.lineTo(cx - size * 0.85, cy + size * 0.4);
      ctx.closePath();
    } else {
      ctx.rect(cx - size * 0.9, cy - size * 0.65, size * 1.8, size * 1.3);
    }
  }

  ctx.fill();
  ctx.stroke();

  // Internal Tactical Domain Symbol
  ctx.fillStyle = color;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let iconText = '✈';
  if (contact.domain === 'maritime') iconText = '⚓';
  else if (contact.domain === 'space') iconText = '🛰';
  else if (contact.domain === 'cctv') iconText = '◉';
  else if (contact.domain === 'crisis') iconText = '▲';

  ctx.fillText(iconText, cx, cy);

  // Velocity Leader Stems Indicator if moving
  if (contact.speed > 30) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx, cy - size - 14);
    ctx.stroke();
    // 1-minute tick
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - size - 14);
    ctx.lineTo(cx + 4, cy - size - 14);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Calculate Kinematic Velocity Leader Vector on a 3D Sphere.
 * Returns positions representing projected track at 1 minute, 3 minutes, and 5 minutes.
 */
export function calculateVelocityLeaderPositions(
  lat: number,
  lon: number,
  headingDeg: number,
  speedKnots: number,
  radius: number
): {
  min1: THREE.Vector3;
  min3: THREE.Vector3;
  min5: THREE.Vector3;
} {
  // Speed conversion: 1 knot = 1.852 km/h = 0.514444 m/s
  // 1 degree latitude ~= 111,139 meters
  const speedMps = speedKnots * 0.514444;
  const dist1Min = speedMps * 60;
  const dist3Min = speedMps * 180;
  const dist5Min = speedMps * 300;

  const projectPoint = (distMeters: number): THREE.Vector3 => {
    const headingRad = (headingDeg * Math.PI) / 180;
    const deltaLat = (distMeters * Math.cos(headingRad)) / 111139;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const deltaLon = (distMeters * Math.sin(headingRad)) / (111139 * (Math.abs(cosLat) > 0.0001 ? cosLat : 1));

    const pLat = Math.max(-89.9, Math.min(89.9, lat + deltaLat));
    const pLon = ((lon + deltaLon + 540) % 360) - 180;

    const phi = (90 - pLat) * (Math.PI / 180);
    const theta = (pLon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  };

  return {
    min1: projectPoint(dist1Min),
    min3: projectPoint(dist3Min),
    min5: projectPoint(dist5Min)
  };
}
