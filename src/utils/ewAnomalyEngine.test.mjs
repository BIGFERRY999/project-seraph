import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEwAnomalies, isInsideChokepoint } from './ewAnomalyEngine.js';

test('isInsideChokepoint correctly identifies strategic maritime chokepoints', () => {
  // Hormuz: lat 25.5-27.5, lon 55.0-57.5
  assert.equal(isInsideChokepoint(26.5, 56.2), true);
  // Bab el-Mandeb: lat 12.0-14.5, lon 42.5-44.5
  assert.equal(isInsideChokepoint(12.8, 43.3), true);
  // Taiwan Strait: lat 22.5-26.0, lon 118.0-122.0
  assert.equal(isInsideChokepoint(24.2, 119.5), true);
  // Malacca: lat 1.0-4.5, lon 100.0-104.5
  assert.equal(isInsideChokepoint(2.5, 101.8), true);
  // Open Atlantic (non-chokepoint)
  assert.equal(isInsideChokepoint(35.0, -40.0), false);
  // Degenerate inputs
  assert.equal(isInsideChokepoint(NaN, 50.0), false);
  assert.equal(isInsideChokepoint(20.0, Infinity), false);
});

test('analyzeEwAnomalies flags emergency squawk codes (7500, 7600, 7700)', () => {
  const hijack = analyzeEwAnomalies({ id: 'TRK-7500', squawk: '7500', domain: 'air' });
  assert.equal(hijack.isAnomaly, true);
  assert.equal(hijack.severity, 'CRITICAL');
  assert.ok(hijack.tags.includes('SQUAWK_7500_HIJACK'));

  const nordo = analyzeEwAnomalies({ id: 'TRK-7600', squawk: '7600', domain: 'air' });
  assert.equal(nordo.isAnomaly, true);
  assert.equal(nordo.severity, 'WARNING');
  assert.ok(nordo.tags.includes('SQUAWK_7600_NORDO'));

  const emergency = analyzeEwAnomalies({ id: 'TRK-7700', squawk: '7700', domain: 'air' });
  assert.equal(emergency.isAnomaly, true);
  assert.equal(emergency.severity, 'WARNING');
  assert.ok(emergency.tags.includes('SQUAWK_7700_EMERGENCY'));
});

test('analyzeEwAnomalies detects hypersonic boost-glide and supersonic civilian anomalies', () => {
  const hypersonic = analyzeEwAnomalies({
    id: 'AVANGARD-01',
    domain: 'air',
    speedKts: 3800,
    mach: 5.8,
  });
  assert.equal(hypersonic.isAnomaly, true);
  assert.equal(hypersonic.severity, 'CRITICAL');
  assert.ok(hypersonic.tags.includes('HYPERSONIC_BOOST_GLIDE'));

  const civilianSupersonic = analyzeEwAnomalies({
    id: 'CESSNA-172',
    domain: 'air',
    category: 'Civilian',
    speedKts: 720,
  });
  assert.equal(civilianSupersonic.isAnomaly, true);
  assert.equal(civilianSupersonic.severity, 'CRITICAL');
  assert.ok(civilianSupersonic.tags.includes('SUPERSONIC_CIVILIAN_ANOMALY'));
});

test('analyzeEwAnomalies detects military IFF Mode 4/5 crypto failure', () => {
  const rogueFighter = analyzeEwAnomalies({
    id: 'FOXHOUND-99',
    domain: 'air',
    category: 'Military',
    iffMode4: false,
    iffMode5: false,
  });
  assert.equal(rogueFighter.isAnomaly, true);
  assert.equal(rogueFighter.severity, 'WARNING');
  assert.ok(rogueFighter.tags.includes('MIL_IFF_MODE_DISCREPANCY'));
});

test('analyzeEwAnomalies detects dark vessels in chokepoints and AIS ghost speeders', () => {
  const darkVessel = analyzeEwAnomalies({
    id: 'SHADOW-TANKER',
    domain: 'maritime',
    lat: 26.2,
    lon: 56.4,
    transponder: false,
    isDark: true,
  });
  assert.equal(darkVessel.isAnomaly, true);
  assert.equal(darkVessel.severity, 'CRITICAL');
  assert.ok(darkVessel.tags.includes('DARK_VESSEL_CHOKEPOINT'));

  const ghostBoat = analyzeEwAnomalies({
    id: 'GHOST-CARGO',
    domain: 'maritime',
    category: 'Commercial',
    speedKts: 75,
  });
  assert.equal(ghostBoat.isAnomaly, true);
  assert.equal(ghostBoat.severity, 'WARNING');
  assert.ok(ghostBoat.tags.includes('AIS_SPOOF_GHOST_VESSEL'));
});

test('analyzeEwAnomalies returns nominal status for standard peaceful tracks', () => {
  const normalFlight = analyzeEwAnomalies({
    id: 'AAL-102',
    domain: 'air',
    category: 'Civilian',
    squawk: '1200',
    speedKts: 450,
  });
  assert.equal(normalFlight.isAnomaly, false);
  assert.equal(normalFlight.severity, 'NOMINAL');
  assert.equal(normalFlight.tags.length, 0);
});
