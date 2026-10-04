/**
 * @module terrainMasking
 * @description 3D Radar Line-of-Sight (LoS) & Terrain Elevation Masking Engine
 * Calculates 4/3 Earth curvature radar horizon, raycast terrain obstruction,
 * and flags low-altitude nap-of-the-earth (NOE) penetration corridors.
 */

import * as Cesium from 'cesium';
import { computeGreatCircleDistance } from '../tacticalVectoring.js';
import { STRATEGIC_SECTORS } from '../tacticalThreatGrid.js';
import { tacticalSound } from '../tacticalSound.js';

const K_EFFECTIVE_EARTH = 4 / 3;
const EARTH_RADIUS_KM = 6371;
const EFFECTIVE_RADIUS_KM = EARTH_RADIUS_KM * K_EFFECTIVE_EARTH;

/**
 * Calculates optical/radar horizon distance in km considering atmospheric refraction
 * @param {number} sensorAltM Radar antenna altitude above sea level
 * @param {number} targetAltM Target altitude above sea level
 * @returns {number} Radar horizon in kilometers
 */
export function calculateRadarHorizonKm(sensorAltM = 50, targetAltM = 100) {
  const dSensor =
    Math.sqrt(2 * (EFFECTIVE_RADIUS_KM * 1000) * Math.max(0, sensorAltM)) /
    1000;
  const dTarget =
    Math.sqrt(2 * (EFFECTIVE_RADIUS_KM * 1000) * Math.max(0, targetAltM)) /
    1000;
  return Math.round((dSensor + dTarget) * 10) / 10;
}

/**
 * Compute line-of-sight clearance over an intermediate terrain peak
 * @param {number} rangeKm Total distance from radar to target in km
 * @param {number} ridgeDistKm Distance from radar to intermediate ridge in km
 * @param {number} radarAltM Radar altitude (m)
 * @param {number} targetAltM Target altitude (m)
 * @param {number} ridgeElevationM Height of intervening terrain peak (m)
 * @returns {object} { isBlocked: boolean, clearanceM: number }
 */
export function evaluateLineOfSight(
  rangeKm,
  ridgeDistKm,
  radarAltM,
  targetAltM,
  ridgeElevationM,
) {
  if (ridgeDistKm <= 0 || ridgeDistKm >= rangeKm) {
    return { isBlocked: false, clearanceM: targetAltM };
  }

  // Linear line-of-sight ray height at ridge distance
  const f = ridgeDistKm / rangeKm;
  const straightLineAltM = radarAltM + f * (targetAltM - radarAltM);

  // Earth curvature drop at ridge distance: d^2 / (2 * R_eff)
  const curvatureDropM =
    (ridgeDistKm * 1000) ** 2 / (2 * (EFFECTIVE_RADIUS_KM * 1000));
  const effectiveBeamAltM = straightLineAltM - curvatureDropM;

  const clearanceM = Math.round(effectiveBeamAltM - ridgeElevationM);
  const isBlocked = clearanceM < 0;

  return {
    isBlocked,
    clearanceM,
    beamAltM: Math.round(effectiveBeamAltM),
    ridgeElevationM,
  };
}

/**
 * Evaluates whether an aerial contact is masked by terrain or below radar horizon
 */
export function evaluateContactMasking(radar, contact, knownRidge = null) {
  const dist = computeGreatCircleDistance(
    radar.lat,
    radar.lon,
    contact.lat,
    contact.lon,
  );
  const radarHorizon = calculateRadarHorizonKm(
    radar.altM || 50,
    contact.altM || 100,
  );

  // 1. Earth curvature horizon check
  if (dist.km > radarHorizon) {
    return {
      status: 'MASKED_BY_HORIZON',
      isMasked: true,
      rangeKm: Math.round(dist.km * 10) / 10,
      horizonKm: radarHorizon,
      reason: `Contact below radar horizon (Range ${Math.round(dist.km)}km vs Horizon ${radarHorizon}km)`,
    };
  }

  // 2. Terrain ridge obstruction check (if terrain peak intervening)
  if (knownRidge) {
    const los = evaluateLineOfSight(
      dist.km,
      knownRidge.distKm,
      radar.altM || 50,
      contact.altM || 100,
      knownRidge.elevationM,
    );
    if (los.isBlocked) {
      return {
        status: 'MASKED_BY_TERRAIN',
        isMasked: true,
        rangeKm: Math.round(dist.km * 10) / 10,
        horizonKm: radarHorizon,
        clearanceM: los.clearanceM,
        reason: `Nap-of-the-Earth terrain shadow (${Math.abs(los.clearanceM)}m below ridgeline)`,
      };
    }
  }

  return {
    status: 'CLEAR_LINE_OF_SIGHT',
    isMasked: false,
    rangeKm: Math.round(dist.km * 10) / 10,
    horizonKm: radarHorizon,
    reason: 'Unobstructed radar track',
  };
}

export class TerrainMaskingEngine {
  constructor() {
    this.viewer = null;
    this.isActive = false;
    this.cesiumEntities = [];
    this.maskedContacts = [];
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
    this.renderMaskingCones();
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
    this.maskedContacts = [];
  }

  renderMaskingCones() {
    if (!this.viewer) return;
    this.clear();

    // Render 3D Radar Horizon envelopes for strategic radar hubs
    for (const s of STRATEGIC_SECTORS.slice(0, 4)) {
      const horizonKm = calculateRadarHorizonKm(150, 1000);
      const horizonM = horizonKm * 1000;

      // 1. Radar Line-of-Sight Dome
      const domeEnt = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 0),
        ellipsoid: {
          radii: new Cesium.Cartesian3(horizonM, horizonM, 18000),
          material: Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.08),
          outline: true,
          outlineColor:
            Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.35),
          outlineWidth: 1,
        },
      });
      this.cesiumEntities.push(domeEnt);

      // 2. Simulated terrain shadow / dead-zone slice (behind mountain ridge)
      const shadowEnt = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(s.lon + 0.6, s.lat + 0.4, 0),
        ellipse: {
          semiMinorAxis: 45000,
          semiMajorAxis: 80000,
          height: 10,
          material: Cesium.Color.fromCssColorString('#ff2200').withAlpha(0.18),
          outline: true,
          outlineColor:
            Cesium.Color.fromCssColorString('#ff2200').withAlpha(0.6),
          outlineWidth: 1,
        },
      });
      this.cesiumEntities.push(shadowEnt);
    }

    try {
      tacticalSound.playCommsOpen?.(true);
    } catch {}
  }
}

export const terrainMasking = new TerrainMaskingEngine();
