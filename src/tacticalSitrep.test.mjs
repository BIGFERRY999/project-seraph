import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TacticalSitrepEngine } from './tacticalSitrep.js';

test('TacticalSitrepEngine generates formatted C4ISR intelligence report', () => {
  const engine = new TacticalSitrepEngine();
  const sitrep = engine.generateSitrep();

  assert.ok(sitrep.title);
  assert.equal(sitrep.classification, 'TOP SECRET // SI-TK // REL TO SERAPH');
  assert.ok(Array.isArray(sitrep.summary));
  assert.equal(sitrep.summary.length, 3);
  assert.match(sitrep.summary[0], /AIR DOMAIN/);
  assert.match(sitrep.summary[1], /MARITIME DOMAIN/);
  assert.match(sitrep.summary[2], /SPACE & EW/);
  assert.ok(sitrep.spokenScript.length > 20);
});

test('TacticalSitrepEngine produces human conversational prosody with greeting and natural pauses', () => {
  const engine = new TacticalSitrepEngine();
  const sitrep = engine.generateSitrep();

  // Verifies conversational military greeting addressing the Commander
  assert.match(sitrep.spokenScript, /Commander/);
  // Verifies military Zulu time cadence
  assert.match(sitrep.spokenScript, /hours Zulu/);
  // Verifies punctuation pauses (...) that introduce natural breathing room into browser speech engines
  assert.match(sitrep.spokenScript, /\.\.\./);
  // Verifies domain coverage in spoken script
  assert.match(sitrep.spokenScript, /air/i);
  assert.match(sitrep.spokenScript, /maritime/i);
  assert.match(sitrep.spokenScript, /orbit/i);
});

test('TacticalSitrepEngine intelligently scores and selects neural voices over robotic voices', () => {
  const engine = new TacticalSitrepEngine();
  engine.voices = [
    { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    { name: 'eSpeak English', lang: 'en' },
    { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US' },
    { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' },
    { name: 'Google US English', lang: 'en-US' },
  ];

  // Female preference selects high-quality natural Jenny
  const bestFemale = engine.getBestHumanVoice('female');
  assert.ok(bestFemale);
  assert.equal(bestFemale.name, 'Microsoft Jenny Online (Natural) - English (United States)');

  // Male preference selects high-quality natural Guy
  const bestMale = engine.getBestHumanVoice('male');
  assert.ok(bestMale);
  assert.equal(bestMale.name, 'Microsoft Guy Online (Natural) - English (United States)');
});

test('TacticalSitrepEngine toggles operator voice between female and male', () => {
  const engine = new TacticalSitrepEngine();
  assert.equal(engine.preferredGender, 'female');

  const toggledToMale = engine.toggleVoiceGender();
  assert.equal(toggledToMale, 'male');
  assert.equal(engine.preferredGender, 'male');

  const toggledToFemale = engine.toggleVoiceGender();
  assert.equal(toggledToFemale, 'female');
  assert.equal(engine.preferredGender, 'female');
});

test('TacticalSitrepEngine stopBriefing resets briefing state cleanly', () => {
  const engine = new TacticalSitrepEngine();
  engine.isBriefing = true;
  engine.stopBriefing();
  assert.equal(engine.isBriefing, false);
});
