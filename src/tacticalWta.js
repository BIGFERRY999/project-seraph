/**
 * @module tacticalWta
 * @description Autonomous Multi-Target Weapons-to-Target Assignment (WTA) Engine
 * Implements military joint air defense battle management algorithms.
 * Pairs active defense batteries (Patriot PAC-3, Aegis SM-6, S-400) to multiple
 * incoming bogeys, calculating single-shot and dual-salvo Kill Probability (Pk).
 */

import * as Cesium from 'cesium';
import {
  computeGreatCircleDistance,
  computeInitialBearing,
} from './tacticalVectoring.js';
import { STRATEGIC_SECTORS } from './tacticalThreatGrid.js';
import { tacticalSound } from './tacticalSound.js';

export function calculateSingleShotPk(basePk, aspect = 'HOT', speedMach = 1.0) {
  let aspectFactor = 1.0;
  if (aspect === 'BEAM') aspectFactor = 0.85;
  else if (aspect === 'FLANK') aspectFactor = 0.9;
  else if (aspect === 'COLD' || aspect === 'DRAG') aspectFactor = 0.65;

  let speedFactor = 1.0;
  if (speedMach > 5.0)
    speedFactor = 0.7; // Hypersonic evasion
  else if (speedMach > 2.0) speedFactor = 0.85; // Supersonic

  const effectivePk = basePk * aspectFactor * speedFactor;
  return Math.max(0.1, Math.min(0.99, Math.round(effectivePk * 100) / 100));
}

export function calculateDualSalvoPk(singlePk) {
  const salvo = 1 - (1 - singlePk) ** 2;
  return Math.round(salvo * 100) / 100;
}

/**
 * Solve Weapons-to-Target Assignment (WTA) pairing problem
 * @param {Array<object>} batteries Available air defense batteries
 * @param {Array<object>} threats Inbound aerial/missile contacts
 * @returns {Array<object>} Optimal pairing solutions
 */
export function solveWtaAssignment(batteries, threats) {
  if (
    !batteries ||
    !threats ||
    batteries.length === 0 ||
    threats.length === 0
  ) {
    return [];
  }

  const pairings = [];
  const assignedThreats = new Set();

  for (const b of batteries) {
    let bestThreat = null;
    let bestScore = -Infinity;
    let bestDistNm = 0;
    let bestBearing = 0;
    let bestPk = 0;

    for (let i = 0; i < threats.length; i++) {
      const threat = threats[i];
      if (assignedThreats.has(threat.id)) continue;

      const dist = computeGreatCircleDistance(
        b.lat,
        b.lon,
        threat.lat,
        threat.lon,
      );
      const bearing = computeInitialBearing(
        b.lat,
        b.lon,
        threat.lat,
        threat.lon,
      );
      const wezKm = (b.engagementRangeM || 160000) / 1000;

      // In-range kinematic feasibility check
      if (dist.km <= wezKm * 1.5) {
        const pk = calculateSingleShotPk(
          b.basePk || 0.88,
          threat.aspect || 'HOT',
          threat.mach || 1.2,
        );
        // Priority score balances Pk and range proximity
        const score = pk * 1000 - dist.km;
        if (score > bestScore) {
          bestScore = score;
          bestThreat = threat;
          bestDistNm = dist.nm;
          bestBearing = bearing;
          bestPk = pk;
        }
      }
    }

    if (bestThreat) {
      assignedThreats.add(bestThreat.id);
      pairings.push({
        batteryId: b.id,
        batteryName: b.name || b.system,
        system: b.system || 'MIM-104 Patriot PAC-3 MSE',
        threatId: bestThreat.id,
        threatCallsign: bestThreat.callsign || `BOGEY-${bestThreat.id}`,
        rangeNm: Math.round(bestDistNm * 10) / 10,
        bearingDeg: bestBearing,
        singlePk: bestPk,
        dualSalvoPk: calculateDualSalvoPk(bestPk),
        status: 'ENGAGED',
        batteryPos: { lat: b.lat, lon: b.lon },
        threatPos: {
          lat: bestThreat.lat,
          lon: bestThreat.lon,
          altM: bestThreat.altM || 10000,
        },
      });
    }
  }

  return pairings;
}

export class TacticalWtaEngine {
  constructor() {
    this.viewer = null;
    this.isActive = false;
    this.currentPairings = [];
    this.cesiumEntities = [];
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
    this.executeWta();
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
    this.currentPairings = [];
  }

  executeWta() {
    const batteries = STRATEGIC_SECTORS.map((s) => {
      const systemName =
        typeof s.system === 'object'
          ? s.system.name || ''
          : String(s.system || '');
      return {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        system: systemName || 'MIM-104 Patriot PAC-3 MSE',
        engagementRangeM: s.engagementRangeM,
        basePk: systemName.includes('SM-6') ? 0.9 : 0.88,
      };
    });

    // Ingest threats from contextStore or fallback defense scenario
    const threats = [];
    if (typeof window !== 'undefined' && window.__gevContextStore?.entities) {
      for (const rec of window.__gevContextStore.entities.values()) {
        if (rec.domain === 'air' || rec.layerId === 'flights') {
          threats.push({
            id: rec.id,
            callsign: rec.callsign || rec.id,
            lat: rec.lat || rec.latitude || 35.0,
            lon: rec.lon || rec.longitude || 139.0,
            altM: rec.alt || rec.altitude || 10000,
            aspect: 'HOT',
            mach: 1.5,
          });
        }
      }
    }

    // Default simulated saturation raid if telemetry bootstrapping
    if (threats.length === 0) {
      threats.push(
        {
          id: 'threat-01',
          callsign: 'RAID-ALPHA',
          lat: 39.5,
          lon: -76.5,
          altM: 11000,
          aspect: 'HOT',
          mach: 2.2,
        },
        {
          id: 'threat-02',
          callsign: 'RAID-BRAVO',
          lat: 36.2,
          lon: 140.8,
          altM: 14000,
          aspect: 'BEAM',
          mach: 1.8,
        },
        {
          id: 'threat-03',
          callsign: 'RAID-CHARLIE',
          lat: 26.8,
          lon: 56.9,
          altM: 8000,
          aspect: 'HOT',
          mach: 3.5,
        },
      );
    }

    const pairings = solveWtaAssignment(batteries, threats);
    this.currentPairings = pairings;
    this.renderPairings(pairings);

    try {
      tacticalSound.playRadarSweep?.();
    } catch {}

    return pairings;
  }

  renderPairings(pairings) {
    if (!this.viewer) return;
    this.clear();
    this.currentPairings = pairings;

    for (const p of pairings) {
      const start = Cesium.Cartesian3.fromDegrees(
        p.batteryPos.lon,
        p.batteryPos.lat,
        50,
      );
      const end = Cesium.Cartesian3.fromDegrees(
        p.threatPos.lon,
        p.threatPos.lat,
        p.threatPos.altM,
      );

      // Render glowing 3D intercept line
      const lineEnt = this.viewer.entities.add({
        polyline: {
          positions: [start, end],
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#00f0ff'),
            dashLength: 16.0,
          }),
        },
      });
      this.cesiumEntities.push(lineEnt);

      // Target lock marker point (strictly no Cesium label)
      const lockEnt = this.viewer.entities.add({
        position: end,
        point: {
          pixelSize: 7,
          color: Cesium.Color.fromCssColorString('#ff0033'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
      });
      this.cesiumEntities.push(lockEnt);
    }
  }
}

export const tacticalWta = new TacticalWtaEngine();
