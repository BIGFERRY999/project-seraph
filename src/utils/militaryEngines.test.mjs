import test from 'node:test';
import assert from 'node:assert/strict';
import { getCotType, contactToCotXml, exportContactsToCotPackage } from './cotParser.js';
import { getStandardIdentity, generateSIDC, resolveMilSymbolConfig, calculateVelocityLeaderPositions } from './milStd2525.js';
import { analyzeEwAnomalies } from './ewAnomalyEngine.js';
import { getDistanceKm, checkWezInterception, STRATEGIC_SAM_BATTERIES } from './airDefenseCatalog.js';

test('MIL-STD-2525D Standard Identity & SIDC Generation', () => {
  const hostileContact = {
    id: 'test-hostile',
    domain: 'air',
    callsign: 'BOGEY-01',
    name: 'Unidentified Strike Fighter',
    type: 'Su-35 Flanker-E',
    category: 'Military',
    country: 'Hostile Forces',
    lat: 44.5,
    lon: 33.5,
    altitude: 25000,
    speed: 550,
    heading: 180,
    threatLevel: 'CRITICAL',
    path: [[44.5, 33.5]],
    mgrs: '36TWT1234'
  };

  const identity = getStandardIdentity(hostileContact);
  assert.equal(identity, 'HOSTILE');

  const config = resolveMilSymbolConfig(hostileContact);
  assert.equal(config.identity, 'HOSTILE');
  assert.equal(config.frameType, 'diamond');
  assert.equal(config.colorHex, 0xef4444);

  const sidc = generateSIDC(hostileContact, identity);
  assert.ok(sidc.startsWith('100601')); // 6 = Hostile, 01 = Air
});

test('Kinematic Velocity Leader Projection', () => {
  const leaders = calculateVelocityLeaderPositions(0, 0, 90, 600, 5); // 600 kts East along equator
  assert.ok(leaders.min1);
  assert.ok(leaders.min3);
  assert.ok(leaders.min5);
  // min5 should have greater X displacement than min1
  assert.ok(Math.abs(leaders.min5.x) > Math.abs(leaders.min1.x) || Math.abs(leaders.min5.z) > Math.abs(leaders.min1.z));
});

test('Cursor-on-Target (CoT 2.0) XML Serialization', () => {
  const contact = {
    id: 'test-cot-01',
    domain: 'air',
    callsign: 'VIPER-21',
    name: 'F-16C Fighting Falcon',
    type: 'Multi-Role Combat Aircraft',
    category: 'Military',
    country: 'USAF / Allied Air Command',
    lat: 32.5,
    lon: 35.0,
    altitude: 18000,
    speed: 420,
    heading: 270,
    threatLevel: 'NOMINAL',
    path: [[32.5, 35.0]],
    mgrs: '36RUU'
  };

  const cotType = getCotType(contact);
  assert.equal(cotType, 'a-f-A-M-F'); // Atom - Friend - Air - Military - Fixed-wing

  const xml = contactToCotXml(contact);
  assert.ok(xml.includes('version="2.0"'));
  assert.ok(xml.includes('uid="test-cot-01"'));
  assert.ok(xml.includes('type="a-f-A-M-F"'));
  assert.ok(xml.includes('lat="32.500000"'));
  assert.ok(xml.includes('callsign="VIPER-21"'));

  const pkg = exportContactsToCotPackage([contact]);
  assert.ok(pkg.startsWith('<?xml version="1.0" standalone="yes"?>'));
  assert.ok(pkg.includes('<events>'));
  assert.ok(pkg.includes('</events>'));
});

test('Air Defense SAM Threat Dome & WEZ Detection', () => {
  // Test distance between London and Paris (~343 km)
  const dist = getDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
  assert.ok(dist > 330 && dist < 360);

  // Position an aircraft right inside Sevastopol S-400 battery (44.6167, 33.5254)
  const targetInCrimea = {
    id: 'target-01',
    domain: 'air',
    callsign: 'TARGET-CRIMEA',
    name: 'Target Aircraft',
    type: 'Reconnaissance',
    category: 'Military',
    country: 'Allied',
    lat: 44.62,
    lon: 33.53,
    altitude: 20000,
    speed: 400,
    heading: 90,
    threatLevel: 'GUARDED',
    path: [[44.62, 33.53]],
    mgrs: '36TWT'
  };

  const wez = checkWezInterception(targetInCrimea);
  assert.equal(wez.inWez, true);
  assert.equal(wez.threatStatus, 'HOSTILE_THREAT');
  assert.ok(wez.battery?.name.includes('S-400'));
});

test('Electronic Warfare (EW) Anomaly Detector', () => {
  // Civilian supersonic anomaly
  const spoofedContact = {
    id: 'spoofed-01',
    domain: 'air',
    callsign: 'CIV-GHOST',
    name: 'Cessna 172 Skyhawk',
    type: 'Single Engine Piston',
    category: 'Commercial',
    country: 'Civilian',
    lat: 30,
    lon: -90,
    altitude: 45000,
    speed: 850, // Supersonic Cessna!
    heading: 45,
    threatLevel: 'NOMINAL',
    path: [[30, -90]],
    mgrs: '15RTT'
  };

  const report = analyzeEwAnomalies(spoofedContact);
  assert.equal(report.isAnomaly, true);
  assert.equal(report.severity, 'CRITICAL');
  assert.ok(report.tags.includes('SUPERSONIC_CIVILIAN_ANOMALY'));

  // Emergency squawk 7700
  const emergencyContact = {
    ...spoofedContact,
    speed: 120,
    squawk: '7700'
  };
  const report7700 = analyzeEwAnomalies(emergencyContact);
  assert.equal(report7700.isAnomaly, true);
  assert.ok(report7700.tags.includes('SQUAWK_7700_EMERGENCY'));
});
