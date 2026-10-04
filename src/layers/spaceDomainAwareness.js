/**
 * @module spaceDomainAwareness
 * @description Space Domain Awareness (SDA) & Satellite Overflight Warning Engine
 * Computes reconnaissance satellite overflight access windows over strategic defense installations,
 * ground sample distance (GSD), and co-orbital conjunction / ASAT proximity alerts.
 */

import * as Cesium from 'cesium';
import { computeGreatCircleDistance } from '../tacticalVectoring.js';
import { tacticalSound } from '../tacticalSound.js';

export const PROTECTED_INSTALLATIONS = [
  {
    id: 'dc-pentagon',
    name: 'THE PENTAGON / NCR DEFENSE CORE',
    lat: 38.8719,
    lon: -77.0563,
    radiusM: 25000,
  },
  {
    id: 'stratcom',
    name: 'US STRATCOM HQ // OFFUTT AFB',
    lat: 41.1186,
    lon: -95.9133,
    radiusM: 30000,
  },
  {
    id: 'groom-lake',
    name: 'NEVADA TEST & TRAINING RANGE (NTTR)',
    lat: 37.2431,
    lon: -115.8115,
    radiusM: 50000,
  },
  {
    id: 'yokosuka',
    name: '7TH FLEET NAVAL BASE // YOKOSUKA',
    lat: 35.2931,
    lon: 139.6672,
    radiusM: 20000,
  },
  {
    id: 'ramstein',
    name: 'NATO ALLIED AIR COMMAND // RAMSTEIN',
    lat: 49.4369,
    lon: 7.6003,
    radiusM: 25000,
  },
  {
    id: 'pine-gap',
    name: 'JOINT DEFENSE FACILITY PINE GAP',
    lat: -23.7994,
    lon: 133.737,
    radiusM: 40000,
  },
];

export const RECON_SATELLITE_CATALOG = [
  {
    id: 'yaogan-35a',
    name: 'YAOGAN-35A',
    type: 'SAR / RADAR IMINT',
    orbitAltKm: 495,
    halfFovDeg: 35,
  },
  {
    id: 'kosmos-2558',
    name: 'KOSMOS-2558',
    type: 'CO-ORBITAL INSPECTOR',
    orbitAltKm: 440,
    halfFovDeg: 30,
  },
  {
    id: 'shijian-21',
    name: 'SHIJIAN-21',
    type: 'SPACE TUG / ASAT CAPABLE',
    orbitAltKm: 35786,
    halfFovDeg: 15,
  },
  {
    id: 'yaogan-41',
    name: 'YAOGAN-41',
    type: 'HIGH-ORBIT OPTICAL IMINT',
    orbitAltKm: 35800,
    halfFovDeg: 8,
  },
];

/**
 * Calculates sensor footprint radius on Earth's surface (in km)
 */
export function calculateSensorFootprintRadiusKm(altitudeKm, halfFovDeg) {
  const rad = (halfFovDeg * Math.PI) / 180;
  return Math.round(altitudeKm * Math.tan(rad) * 10) / 10;
}

/**
 * Evaluate if a satellite sensor cone covers a protected facility
 */
export function evaluateOverflightAccess(satellite, facility) {
  const dist = computeGreatCircleDistance(
    satellite.lat,
    satellite.lon,
    facility.lat,
    facility.lon,
  );
  const sensorFootprintKm = calculateSensorFootprintRadiusKm(
    satellite.orbitAltKm || 500,
    satellite.halfFovDeg || 30,
  );

  const isOverhead = dist.km <= sensorFootprintKm;
  const slantRangeKm = Math.sqrt(
    dist.km ** 2 + (satellite.orbitAltKm || 500) ** 2,
  );
  const elevationAngleDeg = Math.round(
    Math.atan2(satellite.orbitAltKm || 500, dist.km) * (180 / Math.PI),
  );

  return {
    isOverhead,
    satelliteName: satellite.name || satellite.id,
    facilityName: facility.name,
    distanceKm: Math.round(dist.km * 10) / 10,
    footprintRadiusKm: sensorFootprintKm,
    elevationAngleDeg,
    slantRangeKm: Math.round(slantRangeKm * 10) / 10,
    threatLevel: isOverhead ? 'CRITICAL_COLLECTION_RISK' : 'PASSING_STANDBY',
  };
}

/**
 * Check orbital conjunction / close approach between two satellites
 */
export function evaluateOrbitalConjunction(sat1, sat2) {
  const surfaceDist = computeGreatCircleDistance(
    sat1.lat,
    sat1.lon,
    sat2.lat,
    sat2.lon,
  );
  const altDiffKm = Math.abs(
    (sat1.orbitAltKm || 500) - (sat2.orbitAltKm || 500),
  );
  const totalSeparationKm = Math.sqrt(surfaceDist.km ** 2 + altDiffKm ** 2);

  const isCloseApproach = totalSeparationKm <= 50; // Under 50 km warning threshold

  return {
    isCloseApproach,
    separationKm: Math.round(totalSeparationKm * 10) / 10,
    surfaceDistKm: Math.round(surfaceDist.km * 10) / 10,
    altitudeDeltaKm: Math.round(altDiffKm * 10) / 10,
    status: isCloseApproach ? 'ASAT_PROXIMITY_ALERT' : 'SEPARATION_NOMINAL',
  };
}

export class SpaceDomainAwarenessEngine {
  constructor() {
    this.viewer = null;
    this.isActive = false;
    this.cesiumEntities = [];
    this.activeWarnings = [];
  }

  init(viewer) {
    if (!viewer) return;
    this.viewer = viewer;
  }

  toggle(viewer) {
    if (!this.isActive) return this.enable(viewer);
    return this.disable();
  }

  enable(viewer) {
    if (viewer && !this.viewer) this.viewer = viewer;
    this.isActive = true;
    this.scanOverflights();
    return true;
  }

  disable() {
    this.isActive = false;
    this.clear();
    return false;
  }

  clear() {
    if (this.viewer && this.cesiumEntities.length > 0) {
      for (const ent of this.cesiumEntities) {
        try {
          this.viewer.entities.remove(ent);
        } catch {}
      }
      this.cesiumEntities = [];
    }
    this.activeWarnings = [];
  }

  scanOverflights() {
    if (!this.viewer) return [];
    this.clear();

    const warnings = [];
    // Active satellite sub-satellite points (simulated passes)
    const activeSats = [
      { ...RECON_SATELLITE_CATALOG[0], lat: 39.1, lon: -76.8 }, // Near DC Pentagon
      { ...RECON_SATELLITE_CATALOG[1], lat: 37.5, lon: -115.5 }, // Near Nevada NTTR
      { ...RECON_SATELLITE_CATALOG[2], lat: 35.8, lon: 140.1 }, // Near Yokosuka
    ];

    for (const sat of activeSats) {
      for (const fac of PROTECTED_INSTALLATIONS) {
        const assessment = evaluateOverflightAccess(sat, fac);
        if (assessment.isOverhead) {
          warnings.push({ ...assessment, sat, fac });
          this.renderOverflightHazard(sat, fac, assessment);
        }
      }
    }

    this.activeWarnings = warnings;
    if (warnings.length > 0) {
      try {
        tacticalSound.playAlertBeep?.();
      } catch {}
    }

    return warnings;
  }

  renderOverflightHazard(sat, facility, assessment) {
    if (!this.viewer) return;

    // 1. Facility ground protection ring
    const facRing = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(facility.lon, facility.lat, 0),
      ellipse: {
        semiMinorAxis: facility.radiusM,
        semiMajorAxis: facility.radiusM,
        height: 10,
        material: Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.25),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#00f0ff'),
        outlineWidth: 2,
      },
    });
    this.cesiumEntities.push(facRing);

    // 2. Reconnaissance Satellite sensor ground footprint
    const footprintM = assessment.footprintRadiusKm * 1000;
    const footprintEnt = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(sat.lon, sat.lat, 0),
      ellipse: {
        semiMinorAxis: footprintM,
        semiMajorAxis: footprintM,
        height: 5,
        material: Cesium.Color.fromCssColorString('#ffaa00').withAlpha(0.18),
        outline: true,
        outlineColor:
          Cesium.Color.fromCssColorString('#ffaa00').withAlpha(0.75),
        outlineWidth: 2,
      },
    });
    this.cesiumEntities.push(footprintEnt);

    // 3. 3D Nadir / Look vector ray from satellite down to installation
    const satPos = Cesium.Cartesian3.fromDegrees(
      sat.lon,
      sat.lat,
      (sat.orbitAltKm || 500) * 1000,
    );
    const targetPos = Cesium.Cartesian3.fromDegrees(
      facility.lon,
      facility.lat,
      0,
    );

    const vectorEnt = this.viewer.entities.add({
      polyline: {
        positions: [satPos, targetPos],
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#ffaa00'),
          dashLength: 12.0,
        }),
      },
    });
    this.cesiumEntities.push(vectorEnt);
  }
}

export const spaceDomainAwareness = new SpaceDomainAwarenessEngine();
