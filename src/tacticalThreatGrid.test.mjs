import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tacticalThreatGrid, STRATEGIC_SECTORS } from './tacticalThreatGrid.js';

test('STRATEGIC_SECTORS contains 8 global defense zones with valid geospatial coordinates', () => {
  assert.equal(STRATEGIC_SECTORS.length, 8);
  const ids = STRATEGIC_SECTORS.map((s) => s.id);

  assert.ok(ids.includes('dc'));
  assert.ok(ids.includes('tokyo'));
  assert.ok(ids.includes('sf'));
  assert.ok(ids.includes('austin'));
  assert.ok(ids.includes('hormuz'));
  assert.ok(ids.includes('redsea'));
  assert.ok(ids.includes('taiwan'));
  assert.ok(ids.includes('baltic'));

  STRATEGIC_SECTORS.forEach((sec) => {
    assert.ok(sec.lat >= -90 && sec.lat <= 90, `Invalid lat for ${sec.id}`);
    assert.ok(sec.lon >= -180 && sec.lon <= 180, `Invalid lon for ${sec.id}`);
    assert.ok(sec.radius >= 50000, `Radius too small for ${sec.id}`);
    assert.ok(sec.color.startsWith('#'), `Invalid color for ${sec.id}`);
    assert.ok(sec.status.length > 5, `Missing status for ${sec.id}`);
    assert.ok(sec.system, `Missing air defense system for ${sec.id}`);
    assert.ok(sec.radarRangeM >= 200000, `Radar range too small for ${sec.id}`);
    assert.ok(sec.engagementRangeM >= 100000, `WEZ engagement range too small for ${sec.id}`);
    assert.ok(sec.maxAltitudeM >= 20000, `Ceiling too low for ${sec.id}`);
    assert.ok(['FRIEND', 'HOSTILE'].includes(sec.affiliation), `Invalid affiliation for ${sec.id}`);
  });
});

test('TacticalThreatGrid toggle, enable, and disable update active state correctly', () => {
  tacticalThreatGrid.enable();
  assert.equal(tacticalThreatGrid.isActive, true);

  tacticalThreatGrid.disable();
  assert.equal(tacticalThreatGrid.isActive, false);

  const toggled = tacticalThreatGrid.toggle();
  assert.equal(toggled, true);
  assert.equal(tacticalThreatGrid.isActive, true);
});

test('TacticalThreatGrid getSectors returns a copy of strategic sectors', () => {
  const sectors = tacticalThreatGrid.getSectors();
  assert.equal(sectors.length, 8);
  assert.equal(sectors[0].id, 'dc');
  assert.equal(sectors[4].id, 'hormuz');
});

test('TacticalThreatGrid cycleNextSector advances across sectors and triggers camera flight', () => {
  let flyToCalled = false;
  let targetDest = null;

  const mockViewer = {
    entities: {
      add: (ent) => ent,
      getById: () => null,
    },
    camera: {
      flyTo: (opts) => {
        flyToCalled = true;
        targetDest = opts.destination;
      },
    },
  };

  tacticalThreatGrid.viewer = mockViewer;

  const firstSector = tacticalThreatGrid.cycleNextSector();
  assert.ok(firstSector);
  assert.equal(flyToCalled, true);
  assert.ok(targetDest);

  const secondSector = tacticalThreatGrid.cycleNextSector();
  assert.ok(secondSector);
  assert.notEqual(firstSector.id, secondSector.id);
});
