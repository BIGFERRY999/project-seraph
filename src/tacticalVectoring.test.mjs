import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGreatCircleDistance,
  computeInitialBearing,
  computeRelativeBearing,
  computeClosureRate,
  computeAspect,
  computePredictedInterceptPoint,
  calculateInterceptSolution,
  TacticalVectoringEngine,
  tacticalVectoring,
} from './tacticalVectoring.js';

test('computeGreatCircleDistance calculates accurate distances in m, km, and NM', () => {
  // Test 0 distance
  const zeroDist = computeGreatCircleDistance(35.0, 139.0, 35.0, 139.0);
  assert.equal(Math.round(zeroDist.meters), 0);
  assert.equal(Math.round(zeroDist.km), 0);
  assert.equal(Math.round(zeroDist.nm), 0);

  // 1 degree of latitude along meridian (~111.19 km, ~60.04 NM)
  const oneDeg = computeGreatCircleDistance(0, 0, 1, 0);
  assert.ok(oneDeg.km > 110.5 && oneDeg.km < 111.8, `Expected ~111.2 km, got ${oneDeg.km}`);
  assert.ok(oneDeg.nm > 59.5 && oneDeg.nm < 60.5, `Expected ~60 NM, got ${oneDeg.nm}`);

  // Transatlantic: Washington DC (38.8951, -77.0364) to London (51.5074, -0.1278)
  const transatlantic = computeGreatCircleDistance(38.8951, -77.0364, 51.5074, -0.1278);
  assert.ok(transatlantic.km > 5850 && transatlantic.km < 6000, `Expected ~5900 km, got ${transatlantic.km}`);
  assert.ok(transatlantic.nm > 3150 && transatlantic.nm < 3250, `Expected ~3185 NM, got ${transatlantic.nm}`);
});

test('computeInitialBearing computes correct cardinal and intercardinal azimuths', () => {
  // Due North
  assert.equal(computeInitialBearing(0, 0, 10, 0), 0);

  // Due East along equator
  assert.equal(computeInitialBearing(0, 0, 0, 10), 90);

  // Due South
  assert.equal(computeInitialBearing(10, 0, 0, 0), 180);

  // Due West along equator
  assert.equal(computeInitialBearing(0, 10, 0, 0), 270);
});

test('computeRelativeBearing calculates port/starboard relative angles', () => {
  // Directly ahead
  assert.equal(computeRelativeBearing(90, 90), 0);

  // 90 degrees to starboard (+90)
  assert.equal(computeRelativeBearing(90, 0), 90);

  // 90 degrees to port (-90)
  assert.equal(computeRelativeBearing(0, 90), -90);

  // Directly behind (180 or -180)
  assert.equal(Math.abs(computeRelativeBearing(180, 0)), 180);
});

test('computeClosureRate handles closing, diverging, and perpendicular vectors', () => {
  // Head-on closing: Asset eastbound at 400 kts, Target westbound at 400 kts, Bearing 90
  const headOn = computeClosureRate(400, 90, 400, 270, 90);
  assert.equal(headOn, 800);

  // Diverging: Asset heading west at 300 kts, Target heading east at 300 kts, Bearing 90
  const diverging = computeClosureRate(300, 270, 300, 90, 90);
  assert.equal(diverging, -600);

  // Perpendicular crossing: Asset heading North at 300 kts, Target heading North at 300 kts, Bearing East (90)
  const parallel = computeClosureRate(300, 0, 300, 0, 90);
  assert.equal(Math.round(parallel), 0);
});

test('calculateInterceptSolution generates complete kinematic intercept solution', () => {
  const origin = {
    id: 'F-22-ALPHA',
    callsign: 'RAPTOR-01',
    lat: 38.0,
    lon: -77.0,
    speedKts: 600,
    courseDeg: 90,
  };

  const target = {
    id: 'BOGEY-99',
    callsign: 'HOSTILE-LEADER',
    lat: 38.0,
    lon: -75.0, // East of origin
    speedKts: 400,
    courseDeg: 270, // Flying West directly towards origin
  };

  const solution = calculateInterceptSolution(origin, target);
  assert.ok(solution);
  assert.equal(solution.originName, 'RAPTOR-01');
  assert.equal(solution.targetName, 'HOSTILE-LEADER');
  assert.ok(solution.distanceNm > 80 && solution.distanceNm < 110);
  assert.equal(Math.round(solution.trueBearingDeg), 89); // Spherical geodesic curves poleward
  assert.equal(Math.round(solution.relativeBearingDeg), -1); // 89.4 - 90 = -0.6 -> -1
  assert.ok(solution.closureRateKts > 990); // ~1000 kts closing
  assert.ok(solution.etiSec > 0);
  assert.ok(solution.timeFormatted.includes('m '));
});

test('calculateInterceptSolution detects diverging targets', () => {
  const origin = {
    id: 'PATROL-1',
    lat: 0.0,
    lon: 0.0,
    speedKts: 100,
    courseDeg: 270, // Opening / flying away west
  };

  const target = {
    id: 'MERCHANT-2',
    lat: 0.0,
    lon: 1.0, // East of origin
    speedKts: 100,
    courseDeg: 90, // Opening / flying away east
  };

  const solution = calculateInterceptSolution(origin, target);
  assert.ok(solution);
  assert.ok(solution.closureRateKts < -150);
  assert.equal(solution.timeFormatted, 'DIVERGING (OPENING)');
});

test('TacticalVectoringEngine renders and clears Cesium entities properly', () => {
  const engine = new TacticalVectoringEngine();
  const addedEntities = [];
  const removedEntities = [];

  const mockViewer = {
    entities: {
      add: (ent) => {
        addedEntities.push(ent);
        return ent;
      },
      remove: (ent) => {
        removedEntities.push(ent);
      },
    },
  };

  engine.init(mockViewer);

  const origin = { lat: 38.8951, lon: -77.0364, altM: 5000, callsign: 'VIPER-1' };
  const target = { lat: 39.0, lon: -76.0, altM: 6000, callsign: 'CONTACT-2' };

  const sol = engine.setIntercept(origin, target);
  assert.ok(sol);
  assert.equal(addedEntities.length, 2); // Vector polyline + tactical marker
  assert.ok(engine.vectorEntity);
  assert.ok(engine.markerEntity);

  engine.clear();
  assert.equal(removedEntities.length, 2);
  assert.equal(engine.vectorEntity, null);
  assert.equal(engine.markerEntity, null);
  assert.equal(engine.origin, null);
  assert.equal(engine.target, null);
});

test('computeAspect accurately calculates combat aspect angle and tactical codes', () => {
  // Head on (HOT)
  const hot = computeAspect(270, 90);
  assert.equal(hot.aspectCode, 'HOT');
  assert.equal(hot.angleDeg, 0);

  // Beam (BEAM) - attempting Doppler notch
  const beam = computeAspect(0, 90);
  assert.equal(beam.aspectCode, 'BEAM');
  assert.equal(beam.angleDeg, 90);

  // Cold / Drag (COLD) - running away
  const cold = computeAspect(90, 90);
  assert.equal(cold.aspectCode, 'COLD');
  assert.equal(cold.angleDeg, 180);
});

test('calculateInterceptSolution generates authentic military BRAA, Bullseye and PIP solutions', () => {
  const origin = {
    id: 'F-22-LEAD',
    callsign: 'RAPTOR-01',
    lat: 38.0,
    lon: -77.0,
    speedKts: 600,
    courseDeg: 90,
  };

  const target = {
    id: 'BOGEY-01',
    callsign: 'HOSTILE-1',
    lat: 38.0,
    lon: -75.0,
    speedKts: 450,
    courseDeg: 270,
    altFt: 35000,
  };

  const sol = calculateInterceptSolution(origin, target);
  assert.ok(sol);
  assert.equal(sol.aspect, 'HOT');
  assert.equal(sol.angels, 'ANGELS 35');
  assert.match(sol.braa, /^BRAA:\s+\d{3}\s+\/\s+\d+\s+NM\s+\/\s+ANGELS\s+35\s+\/\s+HOT/);
  assert.match(sol.bullseye, /^BULLSEYE\s+\d{3}\/\d+\s+NM/);
  assert.ok(sol.pip);
  assert.ok(sol.pip.formatted.includes('°'));
  assert.ok(sol.tacticalSummary.includes('BRAA:'));
  assert.ok(sol.tacticalSummary.includes('BULLSEYE'));
});
