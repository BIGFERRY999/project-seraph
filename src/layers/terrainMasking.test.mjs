import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRadarHorizonKm,
  evaluateLineOfSight,
  evaluateContactMasking,
  TerrainMaskingEngine,
} from './terrainMasking.js';

test('calculateRadarHorizonKm computes 4/3 earth refraction horizon accurately', () => {
  // Sensor at 50m, target at 100m
  const horizon = calculateRadarHorizonKm(50, 100);
  assert.ok(horizon > 60 && horizon < 80);

  // High-altitude AWACS (10,000m) detecting aircraft at 10,000m
  const awacsHorizon = calculateRadarHorizonKm(10000, 10000);
  assert.ok(awacsHorizon > 750);
});

test('evaluateLineOfSight detects intermediate terrain peak obstruction', () => {
  // Radar at 100m, target at 500m, range 100km
  // Intervening mountain peak at 50km with 1,500m height
  const losBlocked = evaluateLineOfSight(100, 50, 100, 500, 1500);
  assert.equal(losBlocked.isBlocked, true);
  assert.ok(losBlocked.clearanceM < 0);

  // Clear line of sight over low hill (100m)
  const losClear = evaluateLineOfSight(100, 50, 100, 500, 100);
  assert.equal(losClear.isBlocked, false);
  assert.ok(losClear.clearanceM > 0);
});

test('evaluateContactMasking correctly classifies horizon vs terrain blockage', () => {
  const radar = { lat: 38.0, lon: -77.0, altM: 50 };

  // Contact beyond 500 km (beyond radar horizon for 100m target)
  const farContact = { lat: 43.0, lon: -77.0, altM: 100 };
  const resFar = evaluateContactMasking(radar, farContact);
  assert.equal(resFar.status, 'MASKED_BY_HORIZON');
  assert.equal(resFar.isMasked, true);

  // Near contact masked by intervening ridge
  const nearContact = { lat: 38.4, lon: -77.0, altM: 200 };
  const ridge = { distKm: 20, elevationM: 1800 };
  const resTerrain = evaluateContactMasking(radar, nearContact, ridge);
  assert.equal(resTerrain.status, 'MASKED_BY_TERRAIN');
  assert.equal(resTerrain.isMasked, true);
});

test('TerrainMaskingEngine initializes and manages Cesium entities cleanly without labels', () => {
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

  const engine = new TerrainMaskingEngine();
  engine.init(fakeViewer);

  assert.equal(engine.isActive, false);
  engine.enable(fakeViewer);
  assert.equal(engine.isActive, true);
  assert.ok(entities.length > 0);

  engine.disable();
  assert.equal(engine.isActive, false);
  assert.equal(entities.length, 0);
});
