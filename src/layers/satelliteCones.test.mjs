import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SatelliteConesLayer } from './satelliteCones.js';

test('SatelliteConesLayer computes reasonable ground swath footprints from altitude', () => {
  const cones = new SatelliteConesLayer();
  assert.equal(cones.isActive, false);

  // LEO satellite at 500 km
  const rLEO = cones.calculateFootprintRadius(500000);
  assert.ok(rLEO > 100000 && rLEO < 600000, `LEO radius was ${rLEO}`);

  // MEO satellite at 20,000 km (clamped to max ground horizon)
  const rMEO = cones.calculateFootprintRadius(20000000);
  assert.ok(rMEO <= 2500000);
});
