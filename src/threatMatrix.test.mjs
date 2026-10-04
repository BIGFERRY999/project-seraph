import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threatMatrix } from './threatMatrix.js';

test('ThreatMatrixEngine defaults to DEFCON 4 nominal status', () => {
  const summary = threatMatrix.getThreatSummary();
  assert.equal(summary.currentDefcon, 4);
  assert.equal(summary.defconLabel, '4 · GUARDED');
  assert.equal(summary.anomalyCount, 0);
});

test('ThreatMatrixEngine formats DEFCON labels accurately across all levels', () => {
  assert.equal(threatMatrix.getDefconLabel(1), '1 · COCKED PISTOL');
  assert.equal(threatMatrix.getDefconLabel(2), '2 · FAST PACE');
  assert.equal(threatMatrix.getDefconLabel(3), '3 · ROUND HOUSE');
  assert.equal(threatMatrix.getDefconLabel(4), '4 · GUARDED');
  assert.equal(threatMatrix.getDefconLabel(5), '5 · FADE OUT');
});

test('ThreatMatrixEngine evaluates nominal contact without triggering escalation', () => {
  const normalContact = {
    id: 'flight-UAL101',
    callsign: 'UAL101',
    domain: 'air',
    speed: 450,
    squawk: '1200',
  };

  const result = threatMatrix.evaluateContact(normalContact);
  assert.ok(result);
  assert.equal(result.isAnomaly, false);
  assert.equal(threatMatrix.currentDefcon, 4);
});

test('ThreatMatrixEngine detects Squawk 7700 emergency and escalates to DEFCON 3', () => {
  threatMatrix.clearAnomalies();

  const emergencyContact = {
    id: 'flight-AAL992',
    callsign: 'AAL992',
    domain: 'air',
    speed: 380,
    squawk: '7700',
  };

  const result = threatMatrix.evaluateContact(emergencyContact);
  assert.ok(result);
  assert.equal(result.isAnomaly, true);
  assert.equal(result.severity, 'WARNING');
  assert.equal(threatMatrix.currentDefcon, 3);
  assert.equal(threatMatrix.getDefconLabel(), '3 · ROUND HOUSE');

  const summary = threatMatrix.getThreatSummary();
  assert.equal(summary.anomalyCount, 1);
  assert.equal(summary.activeAnomalies.length, 1);
  assert.equal(summary.activeAnomalies[0].contact.id, 'flight-AAL992');
});

test('ThreatMatrixEngine detects Squawk 7500 hijack and escalates to DEFCON 2', () => {
  threatMatrix.clearAnomalies();

  const hijackContact = {
    id: 'flight-BAW007',
    callsign: 'BAW007',
    domain: 'air',
    speed: 490,
    squawk: '7500',
  };

  const result = threatMatrix.evaluateContact(hijackContact);
  assert.ok(result);
  assert.equal(result.isAnomaly, true);
  assert.equal(result.severity, 'CRITICAL');
  assert.equal(threatMatrix.currentDefcon, 2);
  assert.equal(threatMatrix.getDefconLabel(), '2 · FAST PACE');

  threatMatrix.clearAnomalies();
  assert.equal(threatMatrix.currentDefcon, 4);
});

test('ThreatMatrixEngine onAlert subscriber receives emitted alerts and unsubscribes cleanly', () => {
  let receivedAlert = null;
  const unsubscribe = threatMatrix.onAlert((alert) => {
    receivedAlert = alert;
  });

  threatMatrix.tick();
  assert.ok(receivedAlert);
  assert.ok(receivedAlert.level);
  assert.ok(receivedAlert.text);

  receivedAlert = null;
  unsubscribe();
  threatMatrix.tick();
  assert.equal(receivedAlert, null);
});

test('ThreatMatrixEngine detects hypersonic boost-glide weapons and escalates to DEFCON 2', () => {
  threatMatrix.clearAnomalies();

  const hypersonicGlide = {
    id: 'track-AVANGARD-01',
    callsign: 'GLIDER-X',
    domain: 'air',
    speedKts: 3800, // > Mach 5
    mach: 5.8,
    altM: 32000,
  };

  const result = threatMatrix.evaluateContact(hypersonicGlide);
  assert.ok(result);
  assert.equal(result.isAnomaly, true);
  assert.equal(result.severity, 'CRITICAL');
  assert.ok(result.tags.includes('HYPERSONIC_BOOST_GLIDE'));
  assert.equal(threatMatrix.currentDefcon, 2);
  assert.equal(threatMatrix.getDefconLabel(), '2 · FAST PACE');

  threatMatrix.clearAnomalies();
});

test('ThreatMatrixEngine detects dark vessels transiting maritime chokepoints and flags critical alert', () => {
  threatMatrix.clearAnomalies();

  const darkTanker = {
    id: 'vessel-SHADOW-99',
    domain: 'maritime',
    lat: 26.56,
    lon: 56.25, // Strait of Hormuz
    speedKts: 14,
    isDark: true,
  };

  const result = threatMatrix.evaluateContact(darkTanker);
  assert.ok(result);
  assert.equal(result.isAnomaly, true);
  assert.equal(result.severity, 'CRITICAL');
  assert.ok(result.tags.includes('DARK_VESSEL_CHOKEPOINT'));
  assert.equal(threatMatrix.currentDefcon, 2);

  threatMatrix.clearAnomalies();
});
