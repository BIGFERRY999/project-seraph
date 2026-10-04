/**
 * @module tacticalVectoring
 * @description Tactical Intercept, Closest Approach & Range Vectoring Engine
 * Computes great-circle range (NM/km), true bearing, relative bearing,
 * closure rate, and Estimated Time to Intercept (ETI) between two geospatial contacts.
 * Renders interactive 3D geodesic vector tapes and range rings on the globe.
 */

import * as Cesium from 'cesium';
import { tacticalSound } from './tacticalSound.js';

const EARTH_RADIUS_M = 6371008.8;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

export function computeGreatCircleDistance(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const meters = EARTH_RADIUS_M * c;
  return {
    meters,
    km: meters / 1000,
    nm: meters / 1852,
  };
}

export function computeInitialBearing(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);

  const bearing = (toDegrees(theta) + 360) % 360;
  return Math.round(bearing * 10) / 10;
}

export function computeRelativeBearing(targetBearingDeg, assetHeadingDeg) {
  if (!Number.isFinite(targetBearingDeg) || !Number.isFinite(assetHeadingDeg))
    return 0;
  let rel = ((targetBearingDeg - assetHeadingDeg + 540) % 360) - 180;
  const rounded = Math.round(rel * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function computeClosureRate(
  speed1Kts = 0,
  heading1Deg = 0,
  speed2Kts = 0,
  heading2Deg = 0,
  bearing1to2Deg = 0,
) {
  const s1 = Number.isFinite(speed1Kts) ? speed1Kts : 0;
  const s2 = Number.isFinite(speed2Kts) ? speed2Kts : 0;

  // Radial velocity component along the line connecting origin to target
  const angle1 = toRadians(heading1Deg - bearing1to2Deg);
  const angle2 = toRadians(heading2Deg - ((bearing1to2Deg + 180) % 360));

  const radial1 = s1 * Math.cos(angle1);
  const radial2 = s2 * Math.cos(angle2);

  const closureRateKts = radial1 + radial2;
  const rounded = Math.round(closureRateKts * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function computeAspect(targetHeadingDeg = 0, bearingFromOriginDeg = 0) {
  const reciprocalBearing = (bearingFromOriginDeg + 180) % 360;
  const aspectDiff = Math.abs(
    ((targetHeadingDeg - reciprocalBearing + 540) % 360) - 180,
  );
  const rounded = Math.round(aspectDiff * 10) / 10;

  let aspectCode = 'COLD';
  if (rounded <= 30) aspectCode = 'HOT';
  else if (rounded <= 65) aspectCode = 'FLANK';
  else if (rounded <= 115) aspectCode = 'BEAM';
  else aspectCode = 'COLD';

  return {
    angleDeg: rounded,
    aspectCode,
  };
}

export function computePredictedInterceptPoint(
  lat,
  lon,
  speedKts,
  headingDeg,
  etiSec,
) {
  if (!etiSec || etiSec <= 0 || !speedKts || speedKts <= 0) {
    return {
      lat: Math.round(lat * 1000) / 1000,
      lon: Math.round(lon * 1000) / 1000,
      formatted: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`,
    };
  }

  const speedMps = speedKts * 0.514444;
  const distM = speedMps * etiSec;
  const headingRad = toRadians(headingDeg);
  const deltaLat = (distM * Math.cos(headingRad)) / 111139;
  const cosLat = Math.cos(toRadians(lat));
  const deltaLon =
    (distM * Math.sin(headingRad)) /
    (111139 * (Math.abs(cosLat) > 1e-4 ? cosLat : 1));

  const pipLat = Math.max(-89.9, Math.min(89.9, lat + deltaLat));
  const pipLon = ((lon + deltaLon + 540) % 360) - 180;
  const rLat = Math.round(pipLat * 1000) / 1000;
  const rLon = Math.round(pipLon * 1000) / 1000;

  return {
    lat: rLat,
    lon: rLon,
    formatted: `${Math.abs(rLat).toFixed(2)}°${rLat >= 0 ? 'N' : 'S'} ${Math.abs(rLon).toFixed(2)}°${rLon >= 0 ? 'E' : 'W'}`,
  };
}

export function calculateInterceptSolution(origin, target) {
  if (!origin || !target) return null;

  const lat1 = origin.lat ?? origin.latitude ?? 0;
  const lon1 = origin.lon ?? origin.longitude ?? 0;
  const lat2 = target.lat ?? target.latitude ?? 0;
  const lon2 = target.lon ?? target.longitude ?? 0;

  const distance = computeGreatCircleDistance(lat1, lon1, lat2, lon2);
  const trueBearing = computeInitialBearing(lat1, lon1, lat2, lon2);
  const originCourse =
    origin.courseDeg ?? origin.headingDeg ?? origin.heading ?? 0;
  const relBearing = computeRelativeBearing(trueBearing, originCourse);

  const speed1 =
    origin.speedKts ??
    origin.velocityKts ??
    (origin.speedMps ? origin.speedMps * 1.94384 : 0);
  const speed2 =
    target.speedKts ??
    target.velocityKts ??
    (target.speedMps ? target.speedMps * 1.94384 : 0);
  const targetCourse =
    target.courseDeg ?? target.headingDeg ?? target.heading ?? 0;

  const closureRateKts = computeClosureRate(
    speed1,
    originCourse,
    speed2,
    targetCourse,
    trueBearing,
  );

  let etiSec = null;
  let timeFormatted = 'STATIONARY / PARALLEL';

  if (closureRateKts > 2.0) {
    etiSec = Math.round((distance.nm / closureRateKts) * 3600);
    const mins = Math.floor(etiSec / 60);
    const secs = etiSec % 60;
    timeFormatted = `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  } else if (closureRateKts < -2.0) {
    timeFormatted = 'DIVERGING (OPENING)';
  }

  // 1. Military Aspect Angle & Code (HOT / FLANK / BEAM / COLD)
  const aspectInfo = computeAspect(targetCourse, trueBearing);

  // 2. Altitude & ANGELS Formatter
  const altFt =
    target.altFt ?? (target.altM ? Math.round(target.altM * 3.28084) : 25000);
  const angels = Math.round(altFt / 1000);
  const angelsStr =
    altFt >= 1000
      ? `ANGELS ${angels}`
      : `CHERUBS ${Math.max(1, Math.round(altFt / 100))}`;

  // 3. Lead Pursuit Predicted Intercept Point (PIP)
  const pip = computePredictedInterceptPoint(
    lat2,
    lon2,
    speed2,
    targetCourse,
    etiSec,
  );

  // 4. Bullseye Anchor Reference (Default: C2 Master Bullseye Sector 01 DC: 38.8719, -77.0563)
  const bullseyeDist = computeGreatCircleDistance(
    38.8719,
    -77.0563,
    lat2,
    lon2,
  );
  const bullseyeBrg = computeInitialBearing(38.8719, -77.0563, lat2, lon2);
  const bullseyeStr = `BULLSEYE ${String(Math.round(bullseyeBrg)).padStart(3, '0')}/${Math.round(bullseyeDist.nm)} NM`;

  // 5. Military BRAA Standard Format
  const braaStr = `BRAA: ${String(Math.round(trueBearing)).padStart(3, '0')} / ${Math.round(distance.nm)} NM / ${angelsStr} / ${aspectInfo.aspectCode}`;

  const tacticalSummary = `${braaStr} (${closureRateKts >= 0 ? '+' : ''}${closureRateKts} KTS) // ${bullseyeStr} // PIP: ${pip.formatted} (ETI: ${timeFormatted})`;

  return {
    originName: origin.name || origin.callsign || origin.id || 'ORIGIN',
    targetName: target.name || target.callsign || target.id || 'TARGET',
    distanceM: Math.round(distance.meters),
    distanceKm: Math.round(distance.km * 10) / 10,
    distanceNm: Math.round(distance.nm * 10) / 10,
    trueBearingDeg: trueBearing,
    relativeBearingDeg: relBearing,
    closureRateKts,
    etiSec,
    timeFormatted,
    aspect: aspectInfo.aspectCode,
    aspectAngleDeg: aspectInfo.angleDeg,
    altitudeFt: altFt,
    angels: angelsStr,
    braa: braaStr,
    bullseye: bullseyeStr,
    pip,
    tacticalSummary,
  };
}

export class TacticalVectoringEngine {
  constructor() {
    this.viewer = null;
    this.activeSolution = null;
    this.vectorEntity = null;
    this.leadEntity = null;
    this.markerEntity = null;
    this.origin = null;
    this.target = null;
  }

  init(viewer) {
    this.viewer = viewer;
  }

  setIntercept(origin, target) {
    this.origin = origin;
    this.target = target;
    const solution = calculateInterceptSolution(origin, target);
    this.activeSolution = solution;
    this.renderLine();
    try {
      tacticalSound.playSonarPing?.();
    } catch {
      // AudioContext policy
    }
    return solution;
  }

  renderLine() {
    if (!this.viewer || !this.origin || !this.target || !this.activeSolution)
      return;

    this.clearLine();

    const lat1 = this.origin.lat ?? this.origin.latitude ?? 0;
    const lon1 = this.origin.lon ?? this.origin.longitude ?? 0;
    const alt1 = this.origin.altM ?? this.origin.altitudeM ?? 1000;

    const lat2 = this.target.lat ?? this.target.latitude ?? 0;
    const lon2 = this.target.lon ?? this.target.longitude ?? 0;
    const alt2 = this.target.altM ?? this.target.altitudeM ?? 1000;

    const p1 = Cesium.Cartesian3.fromDegrees(lon1, lat1, alt1);
    const p2 = Cesium.Cartesian3.fromDegrees(lon2, lat2, alt2);
    const midLon = (lon1 + lon2) / 2;
    const midLat = (lat1 + lat2) / 2;
    const midAlt = Math.max(alt1, alt2) + 2500;
    const midPoint = Cesium.Cartesian3.fromDegrees(midLon, midLat, midAlt);

    // 1. Geodesic Glowing Vector Tape
    this.vectorEntity = this.viewer.entities.add({
      id: 'tactical-intercept-vector',
      polyline: {
        positions: [p1, p2],
        width: 3.5,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.35,
          color: Cesium.Color.fromCssColorString('#00f0ff'),
        }),
      },
    });

    // 2. Midpoint Intercept Tactical Marker (compliant with noCesiumLabels)
    this.markerEntity = this.viewer.entities.add({
      id: 'tactical-intercept-marker',
      position: midPoint,
      point: {
        pixelSize: 8,
        color: Cesium.Color.fromCssColorString('#00f0ff'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    // 3. Lead Pursuit Target Track Line to Predicted Intercept Point (PIP)
    if (this.activeSolution?.pip && this.activeSolution.etiSec > 0) {
      const pipPoint = Cesium.Cartesian3.fromDegrees(
        this.activeSolution.pip.lon,
        this.activeSolution.pip.lat,
        alt2,
      );
      this.leadEntity = this.viewer.entities.add({
        id: 'tactical-intercept-lead',
        polyline: {
          positions: [p2, pipPoint],
          width: 2.0,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#f59e0b'),
            dashLength: 16.0,
          }),
        },
      });
    }
  }

  clearLine() {
    if (!this.viewer) return;
    if (this.vectorEntity) {
      this.viewer.entities.remove(this.vectorEntity);
      this.vectorEntity = null;
    }
    if (this.leadEntity) {
      this.viewer.entities.remove(this.leadEntity);
      this.leadEntity = null;
    }
    if (this.markerEntity) {
      this.viewer.entities.remove(this.markerEntity);
      this.markerEntity = null;
    }
  }

  clear() {
    this.clearLine();
    this.origin = null;
    this.target = null;
    this.activeSolution = null;
  }
}

export const tacticalVectoring = new TacticalVectoringEngine();
