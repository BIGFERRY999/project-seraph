import { createVoiceCommands as bindVoiceCommands } from './sessionCommands.js';
import { createLocalVoiceSession } from './localVoiceSession.js';
import { createRealtimeSession } from './realtimeSession.js';

export { createLocalVoiceSession, createRealtimeSession };

/**
 * Project Seraph Tactical Voice Commands.
 * Defaults to 100% on-device OmniVoice C2 session with zero cloud routing.
 */
export function createVoiceCommands(options) {
  return bindVoiceCommands({
    createSession: createLocalVoiceSession,
    ...options,
  });
}
