import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSingleShotPk,
  calculateDualSalvoPk,
  solveWtaAssignment,
  TacticalWtaEngine,
} from './tacticalWta.js';

test('calculateSingleShotPk applies realistic aspect and Mach degradation', () => {
  const basePk = 0.90;
  const hotPk = calculateSingleShotPk(basePk, 'HOT', 1.0);
  assert.equal(hotPk, 0.90);

  const beamPk = calculateSingleShotPk(basePk, 'BEAM', 1.0);
  assert.ok(beamPk < hotPk);

  const hypersonicPk = calculateSingleShotPk(basePk, 'HOT', 6.0);
  assert.ok(hypersonicPk < hotPk);
});

test('calculateDualSalvoPk reflects high kill probability of dual-shot ripple fire', () => {
  const single = 0.85;
  const salvo = calculateDualSalvoPk(single);
  assert.ok(salvo > single);
  assert.ok(salvo >= 0.97);
});

test('solveWtaAssignment pairs threats to defense batteries within kinematic range', () => {
  const batteries = [
    { id: 'bat-01', name: 'NORAD PAC-3', lat: 38.0, lon: -77.0, engagementRangeM: 200000, basePk: 0.9 },
    { id: 'bat-02', name: 'JMSDF SM-6', lat: 35.0, lon: 139.0, engagementRangeM: 240000, basePk: 0.88 },
  ];

  const threats = [
    { id: 't-01', callsign: 'BOGEY-1', lat: 38.5, lon: -76.2, altM: 10000, aspect: 'HOT', mach: 1.5 },
    { id: 't-02', callsign: 'BOGEY-2', lat: 35.4, lon: 139.8, altM: 12000, aspect: 'HOT', mach: 1.2 },
  ];

  const solution = solveWtaAssignment(batteries, threats);
  assert.equal(solution.length, 2);
  assert.equal(solution[0].batteryId, 'bat-01');
  assert.equal(solution[0].threatId, 't-01');
  assert.equal(solution[1].batteryId, 'bat-02');
  assert.equal(solution[1].threatId, 't-02');
  assert.ok(solution[0].singlePk > 0);
  assert.ok(solution[0].dualSalvoPk > solution[0].singlePk);
});

test('TacticalWtaEngine renders entities cleanly without Cesium labels', () => {
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

  const engine = new TacticalWtaEngine();
  engine.init(fakeViewer);

  assert.equal(engine.isActive, false);
  engine.enable(fakeViewer);
  assert.equal(engine.isActive, true);
  assert.ok(entities.length > 0);

  engine.disable();
  assert.equal(engine.isActive, false);
  assert.equal(entities.length, 0);
});
