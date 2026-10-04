import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CotLayer, AFFILIATION_COLORS } from './cotLayer.js';

test('CotLayer maps tactical affiliations to MIL-STD colors', () => {
  const layer = new CotLayer();
  assert.equal(layer.isActive, false);

  assert.equal(AFFILIATION_COLORS.friendly, '#3b82f6');
  assert.equal(AFFILIATION_COLORS.hostile, '#ef4444');
  assert.equal(AFFILIATION_COLORS.neutral, '#10b981');
  assert.equal(AFFILIATION_COLORS.unknown, '#f59e0b');
});
