/**
 * Interactive Tactical Sandbox Engine
 * Handles user-placed SAM batteries, 3D No-Fly Zones (NFZ), and dynamic intercept flight physics.
 */

import * as THREE from 'three';
import { AirDefenseBattery, AIR_DEFENSE_SYSTEMS, getDistanceKm } from './airDefenseCatalog';
import { TelemetryContact } from '../types/tactical';

export interface NoFlyZone {
  id: string;
  name: string;
  type: 'NO_FLY_ZONE' | 'RESTRICTED_OPERATING_ZONE' | 'WEAPONS_FREE_ZONE';
  points: [number, number][]; // [lat, lon] polygon coordinates
  floorAltitudeFt: number;
  ceilingAltitudeFt: number;
  colorHex: number;
  colorStr: string;
}

export interface InterceptSolution {
  originLat: number;
  originLon: number;
  targetId: string;
  interceptLat: number;
  interceptLon: number;
  distanceKm: number;
  etaSeconds: number;
  missileSpeedMach: number;
  curvePoints: THREE.Vector3[];
}

export class SandboxEngine {
  private customBatteries: AirDefenseBattery[] = [];
  private noFlyZones: NoFlyZone[] = [
    {
      id: 'nfz-taiwan-strait',
      name: 'TAIWAN STRAIT ADIZ RESTRICTED CORRIDOR',
      type: 'RESTRICTED_OPERATING_ZONE',
      points: [
        [26.5, 119.5],
        [26.0, 122.5],
        [22.5, 121.5],
        [23.0, 118.5]
      ],
      floorAltitudeFt: 0,
      ceilingAltitudeFt: 60000,
      colorHex: 0xf59e0b, // Amber
      colorStr: '#f59e0b'
    },
    {
      id: 'nfz-black-sea',
      name: 'BLACK SEA MARITIME EXCLUSION ZONE',
      type: 'NO_FLY_ZONE',
      points: [
        [46.0, 31.0],
        [45.5, 36.5],
        [43.0, 35.5],
        [43.5, 30.5]
      ],
      floorAltitudeFt: 0,
      ceilingAltitudeFt: 50000,
      colorHex: 0xef4444, // Red
      colorStr: '#ef4444'
    }
  ];

  public getCustomBatteries(): AirDefenseBattery[] {
    return [...this.customBatteries];
  }

  public getNoFlyZones(): NoFlyZone[] {
    return [...this.noFlyZones];
  }

  public addBattery(systemKey: string, lat: number, lon: number, customName?: string): AirDefenseBattery {
    const system = AIR_DEFENSE_SYSTEMS[systemKey] || AIR_DEFENSE_SYSTEMS.PATRIOT;
    const battery: AirDefenseBattery = {
      id: `custom-battery-${Date.now()}`,
      name: customName || `Tactical ${system.name} Unit`,
      system,
      lat,
      lon,
      status: 'ACTIVE'
    };
    this.customBatteries.push(battery);
    return battery;
  }

  public removeBattery(id: string): void {
    this.customBatteries = this.customBatteries.filter(b => b.id !== id);
  }

  public addNoFlyZone(zone: NoFlyZone): void {
    this.noFlyZones.push(zone);
  }

  public removeNoFlyZone(id: string): void {
    this.noFlyZones = this.noFlyZones.filter(z => z.id !== id);
  }

  public clearAll(): void {
    this.customBatteries = [];
    this.noFlyZones = [];
  }

  /**
   * Calculates ballistic intercept trajectory and time-to-intercept against moving target
   */
  public calculateIntercept(
    originLat: number,
    originLon: number,
    target: TelemetryContact,
    globeRadius: number = 5
  ): InterceptSolution {
    const distKm = getDistanceKm(originLat, originLon, target.lat, target.lon);
    // PAC-3 / SM-6 average missile speed: Mach 4.5 (~1,530 m/s = 5,508 km/h)
    const missileSpeedKmh = 5508;
    const etaSeconds = Math.max(12, Math.round((distKm / missileSpeedKmh) * 3600));

    // Project lead intercept point based on target heading and speed
    const targetSpeedKmh = target.speed * 1.852;
    const targetTravelKm = (targetSpeedKmh * (etaSeconds / 3600));
    const headingRad = (target.heading * Math.PI) / 180;

    const deltaLat = (targetTravelKm * Math.cos(headingRad)) / 111.139;
    const cosLat = Math.cos((target.lat * Math.PI) / 180);
    const deltaLon = (targetTravelKm * Math.sin(headingRad)) / (111.139 * (Math.abs(cosLat) > 0.001 ? cosLat : 1));

    const interceptLat = target.lat + deltaLat * 0.7; // Lead intercept
    const interceptLon = target.lon + deltaLon * 0.7;

    // Convert to 3D Cartesian Bezier Spline
    const latLonToV3 = (lat: number, lon: number, r: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const x = -(r * Math.sin(phi) * Math.cos(theta));
      const z = r * Math.sin(phi) * Math.sin(theta);
      const y = r * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    };

    const start = latLonToV3(originLat, originLon, globeRadius);
    const end = latLonToV3(interceptLat, interceptLon, globeRadius + 0.35);
    const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(globeRadius + 1.25);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

    return {
      originLat,
      originLon,
      targetId: target.id,
      interceptLat,
      interceptLon,
      distanceKm: Math.round(distKm),
      etaSeconds,
      missileSpeedMach: 4.5,
      curvePoints: curve.getPoints(50)
    };
  }
}

export const sandboxEngine = new SandboxEngine();
