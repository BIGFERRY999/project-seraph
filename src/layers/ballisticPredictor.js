/**
 * @module ballisticPredictor
 * @description Ballistic Missile Early Warning System (BMEWS) & Hypersonic Glide Vehicle (HGV)
 * Trajectory Predictor for Project Seraph.
 * Computes 3D Keplerian sub-orbital arcs, atmospheric boost-glide trajectories,
 * time-to-impact (TTI) countdowns, and Circular Error Probable (CEP) ground zero impact zones.
 */

import * as Cesium from 'cesium';
import { tacticalSound } from '../tacticalSound.js';

const EARTH_RADIUS_M = 6371008.8;
const G0 = 9.80665; // Standard gravity m/s^2

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Great-circle intermediate waypoint along geodesic arc
 */
export function intermediatePoint(lat1, lon1, lat2, lon2, f) {
  const phi1 = toRad(lat1);
  const lambda1 = toRad(lon1);
  const phi2 = toRad(lat2);
  const lambda2 = toRad(lon2);

  const deltaPhi = phi2 - phi1;
  const deltaLambda = lambda2 - lambda1;
  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (d === 0) return { lat: lat1, lon: lon1 };

  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);

  const x =
    A * Math.cos(phi1) * Math.cos(lambda1) +
    B * Math.cos(phi2) * Math.cos(lambda2);
  const y =
    A * Math.cos(phi1) * Math.sin(lambda1) +
    B * Math.cos(phi2) * Math.sin(lambda2);
  const z = A * Math.sin(phi1) + B * Math.sin(phi2);

  const phi = Math.atan2(z, Math.sqrt(x ** 2 + y ** 2));
  const lambda = Math.atan2(y, x);

  return {
    lat: toDeg(phi),
    lon: toDeg(lambda),
  };
}

/**
 * Compute 3D Keplerian ballistic missile trajectory profile
 * @param {object} launch { lat, lon, altM }
 * @param {object} target { lat, lon }
 * @param {number} [apogeeKm=450] Maximum apex altitude
 * @param {number} [steps=60]
 * @returns {object} { trajectoryPoints, ttiSec, apogeeM, groundZero, cepRadiusM }
 */
export function calculateBallisticTrajectory(
  launch,
  target,
  apogeeKm = 450,
  steps = 60,
) {
  const apogeeM = apogeeKm * 1000;
  const trajectoryPoints = [];

  // Great-circle distance
  const p1 = toRad(launch.lat);
  const p2 = toRad(target.lat);
  const dLat = toRad(target.lat - launch.lat);
  const dLon = toRad(target.lon - launch.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  const angularDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const groundRangeM = EARTH_RADIUS_M * angularDist;

  // Flight duration physics approximation: T = 2 * sqrt(2 * apogee / g) + range / V_horiz
  const freeFallTimeSec = 2 * Math.sqrt((2 * apogeeM) / G0);
  const averageHorizontalSpeed = Math.max(
    1200,
    groundRangeM / Math.max(1, freeFallTimeSec),
  );
  const ttiSec = Math.round(
    freeFallTimeSec + groundRangeM / averageHorizontalSpeed,
  );

  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const pt = intermediatePoint(
      launch.lat,
      launch.lon,
      target.lat,
      target.lon,
      fraction,
    );

    // Parabolic altitude profile: 4 * apogee * f * (1 - f)
    const altitudeM = Math.max(0, 4 * apogeeM * fraction * (1 - fraction));

    trajectoryPoints.push({
      lat: pt.lat,
      lon: pt.lon,
      altM: altitudeM,
      fraction,
      timeSec: Math.round(fraction * ttiSec),
    });
  }

  // Circular Error Probable (CEP) estimate based on range (typical ICBM/IRBM accuracy: 150m - 400m)
  const cepRadiusM = Math.min(2500, Math.max(120, groundRangeM * 0.00015));

  return {
    type: 'BALLISTIC_KEPLERIAN',
    launch,
    groundZero: { lat: target.lat, lon: target.lon },
    rangeKm: groundRangeM / 1000,
    rangeNm: groundRangeM / 1852,
    apogeeKm,
    apogeeM,
    ttiSec,
    cepRadiusM: Math.round(cepRadiusM),
    points: trajectoryPoints,
  };
}

/**
 * Compute Hypersonic Glide Vehicle (HGV) waverider / boost-glide trajectory
 * Characterized by rapid atmospheric pull-up, high-altitude sustained hypersonic glide (40-70 km), and cross-range skip
 */
export function calculateHypersonicGlideTrajectory(
  launch,
  target,
  glideAltKm = 65,
  steps = 60,
) {
  const glideAltM = glideAltKm * 1000;
  const trajectoryPoints = [];

  const p1 = toRad(launch.lat);
  const p2 = toRad(target.lat);
  const dLat = toRad(target.lat - launch.lat);
  const dLon = toRad(target.lon - launch.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  const angularDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const groundRangeM = EARTH_RADIUS_M * angularDist;

  // Hypersonic cruise speed: ~Mach 8 to Mach 15 (2,700 m/s to 5,100 m/s)
  const hypersonicSpeedMps = 3600; // ~Mach 10.5
  const ttiSec = Math.round(groundRangeM / hypersonicSpeedMps + 120);

  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const pt = intermediatePoint(
      launch.lat,
      launch.lon,
      target.lat,
      target.lon,
      f,
    );

    let altM;
    if (f < 0.15) {
      // Boost phase: rapid climb to glide altitude
      altM = (f / 0.15) * glideAltM;
    } else if (f > 0.85) {
      // Terminal hypersonic dive into target
      altM = ((1 - f) / 0.15) * glideAltM;
    } else {
      // Sustained atmospheric waverider glide with aerodynamic skip wave
      const glideProgress = (f - 0.15) / 0.7;
      const skipWave =
        Math.sin(glideProgress * Math.PI * 4) * (glideAltM * 0.12);
      altM = glideAltM + skipWave;
    }

    trajectoryPoints.push({
      lat: pt.lat,
      lon: pt.lon,
      altM: Math.max(0, altM),
      fraction: f,
      timeSec: Math.round(f * ttiSec),
    });
  }

  return {
    type: 'HYPERSONIC_BOOST_GLIDE',
    launch,
    groundZero: { lat: target.lat, lon: target.lon },
    rangeKm: groundRangeM / 1000,
    rangeNm: groundRangeM / 1852,
    glideAltKm,
    ttiSec,
    cepRadiusM: 45, // Pinpoint precision GPS/INS/optical terminal homing
    points: trajectoryPoints,
  };
}

export class BallisticPredictorEngine {
  constructor() {
    this.viewer = null;
    this.isActive = false;
    this.activeSimulations = [];
    this.cesiumEntities = [];
    this.timer = null;
    this.ttiCountdown = 0;
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
    this.simulateThreatVector();
    return true;
  }

  disable() {
    this.isActive = false;
    this.clear();
    return false;
  }

  clear() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.viewer && this.cesiumEntities.length > 0) {
      for (const ent of this.cesiumEntities) {
        try {
          this.viewer.entities.remove(ent);
        } catch {}
      }
      this.cesiumEntities = [];
    }
  }

  /**
   * Launch a threat trajectory scenario and render 3D flight arc and CEP ground zero
   */
  simulateThreatVector(type = 'HYPERSONIC') {
    if (!this.viewer) return null;
    this.clear();

    // Strategic Launch Scenario: Pacific / East Asian Theater into Pacific Defense Zone
    const launch = { lat: 38.9, lon: 125.7, altM: 0 }; // Launch facility
    const target = { lat: 13.4, lon: 144.8 }; // Andersen AFB, Guam

    const solution =
      type === 'HYPERSONIC'
        ? calculateHypersonicGlideTrajectory(launch, target, 75, 80)
        : calculateBallisticTrajectory(launch, target, 520, 80);

    this.renderTrajectory(solution);
    this.startCountdown(solution.ttiSec);

    try {
      tacticalSound.playAlertBeep?.();
    } catch {}

    return solution;
  }

  renderTrajectory(solution) {
    if (!this.viewer) return;

    // Convert points to Cesium Cartesian3
    const cartesianPositions = solution.points.map((pt) =>
      Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, pt.altM),
    );

    // 1. Render 3D Flight Arc with glowing laser pulse material
    const arcColor =
      solution.type === 'HYPERSONIC'
        ? Cesium.Color.fromCssColorString('#ff0055')
        : Cesium.Color.fromCssColorString('#ffaa00');

    const arcEntity = this.viewer.entities.add({
      polyline: {
        positions: cartesianPositions,
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: arcColor,
        }),
      },
    });
    this.cesiumEntities.push(arcEntity);

    // 2. Render Ground Zero Circular Error Probable (CEP) hazard circle
    const cepEntity = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        solution.groundZero.lon,
        solution.groundZero.lat,
        0,
      ),
      ellipse: {
        semiMinorAxis: solution.cepRadiusM * 200, // Visualized footprint scale
        semiMajorAxis: solution.cepRadiusM * 200,
        height: 10,
        material: Cesium.Color.fromCssColorString('#ff0033').withAlpha(0.25),
        outline: true,
        outlineColor:
          Cesium.Color.fromCssColorString('#ff0033').withAlpha(0.85),
        outlineWidth: 2,
      },
    });
    this.cesiumEntities.push(cepEntity);

    // 3. Render Apex point billboard (strictly no Cesium label to follow noCesiumLabels rule)
    const apexPt = solution.points[Math.floor(solution.points.length / 2)];
    if (apexPt) {
      const apexEntity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          apexPt.lon,
          apexPt.lat,
          apexPt.altM,
        ),
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString('#00f0ff'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
      });
      this.cesiumEntities.push(apexEntity);
    }
  }

  startCountdown(totalSec) {
    this.ttiCountdown = totalSec;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.ttiCountdown--;
      if (this.ttiCountdown <= 0) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 1000);
  }
}

export const ballisticPredictor = new BallisticPredictorEngine();
