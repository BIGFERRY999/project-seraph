import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBallisticTrajectory,
  calculateHypersonicGlideTrajectory,
  intermediatePoint,
  BallisticPredictorEngine,
} from './ballisticPredictor.js';

test('intermediatePoint calculates accurate midpoint between two coordinates', () => {
  const pt = intermediatePoint(0, 0, 0, 10, 0.5);
  assert.equal(Math.round(pt.lat), 0);
  assert.equal(Math.round(pt.lon), 5);
});

test('calculateBallisticTrajectory outputs valid Keplerian parabola parameters', () => {
  const launch = { lat: 38.0, lon: 125.0 };
  const target = { lat: 35.0, lon: 139.0 };
  const trajectory = calculateBallisticTrajectory(launch, target, 500, 50);

  assert.equal(trajectory.type, 'BALLISTIC_KEPLERIAN');
  assert.ok(trajectory.rangeKm > 1000);
  assert.equal(trajectory.apogeeKm, 500);
  assert.ok(trajectory.ttiSec > 300);
  assert.ok(trajectory.cepRadiusM > 0);
  assert.equal(trajectory.points.length, 51);

  // Peak altitude occurs near midpoint
  const mid = trajectory.points[25];
  assert.ok(mid.altM > 450000); // Near 500 km
});

test('calculateHypersonicGlideTrajectory outputs sustained atmospheric glide altitude', () => {
  const launch = { lat: 38.0, lon: 125.0 };
  const target = { lat: 13.4, lon: 144.8 };
  const trajectory = calculateHypersonicGlideTrajectory(launch, target, 70, 60);

  assert.equal(trajectory.type, 'HYPERSONIC_BOOST_GLIDE');
  assert.ok(trajectory.rangeKm > 2000);
  assert.equal(trajectory.glideAltKm, 70);
  assert.ok(trajectory.ttiSec > 0);
  assert.equal(trajectory.cepRadiusM, 45); // High-precision terminal homing

  // Waverider glide phase check
  const glidePoint = trajectory.points[30]; // 50% fraction
  assert.ok(glidePoint.altM >= 50000 && glidePoint.altM <= 90000);
});

test('BallisticPredictorEngine toggles and manages Cesium primitives cleanly without labels', () => {
  const entities = [];
  const fakeViewer = {
    entities: {
      add: (ent) => {
        // Guard check: ensure no Cesium label: property is ever attached
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

  const engine = new BallisticPredictorEngine();
  engine.init(fakeViewer);

  assert.equal(engine.isActive, false);
  engine.enable(fakeViewer);
  assert.equal(engine.isActive, true);
  assert.ok(entities.length >= 2);

  engine.disable();
  assert.equal(engine.isActive, false);
  assert.equal(entities.length, 0);
});
