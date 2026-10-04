import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSensorFootprintRadiusKm,
  evaluateOverflightAccess,
  evaluateOrbitalConjunction,
  SpaceDomainAwarenessEngine,
  PROTECTED_INSTALLATIONS,
} from './spaceDomainAwareness.js';

test('calculateSensorFootprintRadiusKm calculates geometric sensor footprint', () => {
  // LEO satellite at 500 km with 30 deg half-angle FOV: 500 * tan(30 deg) ~= 288 km
  const radius = calculateSensorFootprintRadiusKm(500, 30);
  assert.ok(radius > 280 && radius < 295);
});

test('evaluateOverflightAccess detects when facility is within reconnaissance footprint', () => {
  const sat = { id: 'recon-01', name: 'YAOGAN-35', lat: 38.9, lon: -77.0, orbitAltKm: 500, halfFovDeg: 30 };
  const fac = PROTECTED_INSTALLATIONS[0]; // Pentagon (lat 38.87, lon -77.05)

  const access = evaluateOverflightAccess(sat, fac);
  assert.equal(access.isOverhead, true);
  assert.equal(access.threatLevel, 'CRITICAL_COLLECTION_RISK');
  assert.ok(access.elevationAngleDeg > 70); // Nearly directly overhead
});

test('evaluateOrbitalConjunction flags close approaches under 50 km', () => {
  const sat1 = { lat: 30.0, lon: 40.0, orbitAltKm: 500 };
  const satClose = { lat: 30.1, lon: 40.1, orbitAltKm: 505 };
  const satFar = { lat: 35.0, lon: 45.0, orbitAltKm: 800 };

  const closeCheck = evaluateOrbitalConjunction(sat1, satClose);
  assert.equal(closeCheck.isCloseApproach, true);
  assert.equal(closeCheck.status, 'ASAT_PROXIMITY_ALERT');

  const farCheck = evaluateOrbitalConjunction(sat1, satFar);
  assert.equal(farCheck.isCloseApproach, false);
  assert.equal(farCheck.status, 'SEPARATION_NOMINAL');
});

test('SpaceDomainAwarenessEngine manages Cesium entities cleanly without labels', () => {
  const entities = [];
  const fakeViewer = {
    entities: {
      add: (ent) => {
        assert.equal(ent.label, undefined, 'Must adhere to noCesiumLabels architectural guard');
        entities.push(ent);
        return ent;
      },
      remove: (ent) => {
        const idx = entities.indexOf(ent);
        if (idx !== -1) entities.splice(idx, 1);
      },
    },
  };

  const engine = new SpaceDomainAwarenessEngine();
  engine.init(fakeViewer);

  assert.equal(engine.isActive, false);
  engine.enable(fakeViewer);
  assert.equal(engine.isActive, true);
  assert.ok(entities.length > 0);

  engine.disable();
  assert.equal(engine.isActive, false);
  assert.equal(entities.length, 0);
});
