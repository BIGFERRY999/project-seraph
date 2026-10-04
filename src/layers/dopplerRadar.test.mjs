import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DopplerRadarLayer } from './dopplerRadar.js';

test('DopplerRadarLayer initializes with default parameters and falls back gracefully', async () => {
  const radar = new DopplerRadarLayer();
  assert.equal(radar.isActive, false);
  assert.equal(radar.currentFrameIndex, 0);

  const frames = await radar.fetchRadarMetadata();
  assert.ok(Array.isArray(frames));
  assert.ok(frames.length > 0);
  assert.ok(frames[0].path);

  // Test frame stepping
  radar.frames = frames;
  radar.imageryLayers = new Array(frames.length).fill({});
  radar.nextFrame();
  assert.equal(radar.currentFrameIndex, 1);
  radar.prevFrame();
  assert.equal(radar.currentFrameIndex, 0);
});
