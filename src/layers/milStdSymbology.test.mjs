import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getStandardIdentity,
  generateSIDC,
  generateMilStd2525Svg,
  generateMilStd2525DataUrl,
  MilStdSymbologyLayer,
  milStdSymbology,
} from './milStdSymbology.js';

test('getStandardIdentity accurately maps contact profiles to NATO identities', () => {
  assert.equal(getStandardIdentity({ isHostile: true }), 'HOSTILE');
  assert.equal(getStandardIdentity({ threatLevel: 'CRITICAL' }), 'HOSTILE');
  assert.equal(getStandardIdentity({ category: 'Military', affiliation: 'FRIEND' }), 'FRIEND');
  assert.equal(getStandardIdentity({ category: 'Commercial' }), 'NEUTRAL');
  assert.equal(getStandardIdentity({ isUnknown: true }), 'UNKNOWN');
});

test('generateSIDC constructs standard 15-character NATO SIDC strings', () => {
  const hostileAir = generateSIDC({ domain: 'air' }, 'HOSTILE');
  assert.equal(hostileAir, '10060100001100000000');
  assert.equal(hostileAir.length, 20);

  const friendMaritime = generateSIDC({ domain: 'maritime' }, 'FRIEND');
  assert.equal(friendMaritime, '10033000001100000000');

  const neutralGround = generateSIDC({ domain: 'ground' }, 'NEUTRAL');
  assert.equal(neutralGround, '10041000001100000000');
});

test('generateMilStd2525Svg outputs valid tactical SVGs with NATO geometry', () => {
  // Hostile diamond
  const hostileSvg = generateMilStd2525Svg('HOSTILE', 'air');
  assert.ok(hostileSvg.includes('polygon points="24,4 44,24 24,44 4,24"'));
  assert.ok(hostileSvg.includes('#ef4444'));

  // Neutral square
  const neutralSvg = generateMilStd2525Svg('NEUTRAL', 'maritime');
  assert.ok(neutralSvg.includes('<rect x="6" y="6"'));
  assert.ok(neutralSvg.includes('#22c55e'));

  // Friend air circle
  const friendSvg = generateMilStd2525Svg('FRIEND', 'air');
  assert.ok(friendSvg.includes('<circle cx="24" cy="24" r="18"'));
  assert.ok(friendSvg.includes('#38bdf8'));

  // Base64 data URL
  const dataUrl = generateMilStd2525DataUrl('HOSTILE', 'air');
  assert.ok(dataUrl.startsWith('data:image/svg+xml;base64,'));
});

test('MilStdSymbologyLayer manages Cesium billboards and toggle state', () => {
  const layer = new MilStdSymbologyLayer();
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

  layer.init(mockViewer);
  assert.equal(layer.isActive, false);

  layer.enable();
  assert.equal(layer.isActive, true);

  const contact = {
    id: 'TGT-901',
    isHostile: true,
    domain: 'air',
    lat: 38.0,
    lon: -77.0,
    altM: 8000,
  };

  const ent = layer.upsertContactSymbol(contact);
  assert.ok(ent);
  assert.equal(addedEntities.length, 1);
  assert.equal(ent.__sidc, '10060100001100000000');

  layer.removeContactSymbol('TGT-901');
  assert.equal(removedEntities.length, 1);
  assert.equal(layer.entities.size, 0);

  layer.disable();
  assert.equal(layer.isActive, false);
});
