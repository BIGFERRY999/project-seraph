import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GpsJammingLayer, EW_HOTSPOTS } from './gpsJammingLayer.js';

test('GpsJammingLayer indexes electronic warfare sectors with proper geometry', () => {
  const ew = new GpsJammingLayer();
  assert.equal(ew.isActive, false);

  const sectors = ew.getActiveSectors();
  assert.ok(sectors.length >= 6);

  sectors.forEach((sec) => {
    assert.ok(sec.id);
    assert.ok(sec.name);
    assert.ok(Number.isFinite(sec.lat));
    assert.ok(Number.isFinite(sec.lon));
    assert.ok(sec.radius > 50000);
    assert.ok(sec.color.startsWith('#'));
  });
});
