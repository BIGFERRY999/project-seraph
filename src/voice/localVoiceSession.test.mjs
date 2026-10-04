import test from 'node:test';
import assert from 'node:assert/strict';
import { matchTacticalIntent, createLocalVoiceSession } from './localVoiceSession.js';

test('matchTacticalIntent correctly parses DEFCON commands', () => {
  assert.equal(matchTacticalIntent('DEFCON 1')?.level, 1);
  assert.equal(matchTacticalIntent('cocked pistol')?.level, 1);
  assert.equal(matchTacticalIntent('set defcon 2')?.level, 2);
  assert.equal(matchTacticalIntent('fast pace')?.level, 2);
  assert.equal(matchTacticalIntent('defcon 3 status')?.level, 3);
  assert.equal(matchTacticalIntent('defcon 4')?.level, 4);
  assert.equal(matchTacticalIntent('defcon 5 peacetime')?.level, 5);
});

test('matchTacticalIntent correctly parses tactical C2 commands', () => {
  assert.equal(matchTacticalIntent('give me a SITREP')?.type, 'sitrep');
  assert.equal(matchTacticalIntent('vector intercept now')?.type, 'vector_intercept');
  assert.equal(matchTacticalIntent('scramble fighters')?.type, 'vector_intercept');
  assert.equal(matchTacticalIntent('scan threat grid')?.type, 'threat_grid');
  assert.equal(matchTacticalIntent('scan sector tokyo')?.sector, 'tokyo');
  assert.equal(matchTacticalIntent('start tactical tour')?.type, 'tactical_tour');
  assert.equal(matchTacticalIntent('simulate ballistic missile trajectory')?.type, 'ballistic_predictor');
  assert.equal(matchTacticalIntent('calculate weapons to target assignment wta')?.type, 'wta_assignment');
  assert.equal(matchTacticalIntent('scan terrain masking radar horizon')?.type, 'terrain_masking');
  assert.equal(matchTacticalIntent('satellite overflight warning')?.type, 'space_domain');
});

test('matchTacticalIntent correctly handles sensor filters and camera navigation', () => {
  assert.deepEqual(matchTacticalIntent('FLIR thermal mode'), {
    type: 'action',
    action: 'set_visual_style',
    args: { style: 'thermal' },
    spoken: 'FLIR thermal imagery online.',
  });
  assert.deepEqual(matchTacticalIntent('reset globe view'), {
    type: 'action',
    action: 'zoom_to_globe',
    args: {},
    spoken: 'Resetting camera to orbital globe view.',
  });
  assert.deepEqual(matchTacticalIntent('show flights'), {
    type: 'action',
    action: 'set_layer_visibility',
    args: { layerId: 'opensky', enabled: true },
    spoken: 'Air corridor telemetry active.',
  });
});

test('createLocalVoiceSession provides non-cloud on-device capabilities', () => {
  const events = [];
  const session = createLocalVoiceSession({
    emit: (e) => events.push(e),
    runAction: async () => ({ ok: true }),
    ui: {
      root: { dataset: {}, querySelector: () => null, querySelectorAll: () => [] },
      status: {},
      detail: {},
    },
  });

  assert.equal(session.capabilities.costControls, false);
  assert.equal(session.capabilities.cloudRouted, false);
  assert.equal(session.capabilities.localEngine, 'omnivoice');
  assert.equal(session.capabilities.pushToTalk, true);
});

test('createLocalVoiceSession start/stop transitions lifecycle states', async () => {
  const events = [];
  const ui = {
    root: { dataset: {}, querySelector: () => null, querySelectorAll: () => [] },
    status: {},
    detail: {},
  };
  const session = createLocalVoiceSession({
    emit: (e) => events.push(e),
    runAction: async () => ({ ok: true }),
    ui,
  });

  await session.start();
  assert.equal(events[0]?.state, 'listening');
  assert.equal(ui.status.textContent, 'LISTENING');

  session.stop();
  assert.equal(events[1]?.state, 'idle');
  assert.equal(ui.status.textContent, 'OFF');
});
