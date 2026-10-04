/**
 * @module localVoiceSession
 * @description 100% On-Device Tactical Voice C2 Session for Project Seraph.
 * Replaces cloud-routed WebRTC sessions (OpenAI Realtime) with local speech
 * recognition and open-source OmniVoice / neural studio voice synthesis.
 * Zero external API fees, zero cloud audio streaming, zero data leakage.
 */

import { tacticalSound } from '../tacticalSound.js';

/** Tactical NATO / Military Intent Matcher */
export function matchTacticalIntent(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim().toLowerCase();

  // 1. DEFCON Levels
  if (text.includes('defcon 1') || text.includes('cocked pistol')) {
    return {
      type: 'defcon',
      level: 1,
      label: 'COCKED PISTOL',
      spoken: 'Threat Matrix escalated to DEFCON 1. Cocked Pistol.',
    };
  }
  if (text.includes('defcon 2') || text.includes('fast pace')) {
    return {
      type: 'defcon',
      level: 2,
      label: 'FAST PACE',
      spoken: 'Threat Matrix set to DEFCON 2. Fast Pace.',
    };
  }
  if (text.includes('defcon 3') || text.includes('round house')) {
    return {
      type: 'defcon',
      level: 3,
      label: 'ROUND HOUSE',
      spoken: 'Threat Matrix updated to DEFCON 3. Round House.',
    };
  }
  if (text.includes('defcon 4') || text.includes('double take')) {
    return {
      type: 'defcon',
      level: 4,
      label: 'DOUBLE TAKE',
      spoken: 'Threat Matrix set to DEFCON 4. Guarded.',
    };
  }
  if (text.includes('defcon 5') || text.includes('fade out')) {
    return {
      type: 'defcon',
      level: 5,
      label: 'FADE OUT',
      spoken: 'Threat Matrix reset to DEFCON 5. Normal peacetime watch.',
    };
  }

  // 2. Tactical Situation Report (SITREP)
  if (
    text.includes('sitrep') ||
    text.includes('situation report') ||
    text.includes('briefing') ||
    text.includes('status report')
  ) {
    return { type: 'sitrep', spoken: 'Delivering operational SITREP.' };
  }

  // 3. Vector Intercept / Scramble
  if (
    text.includes('vector') ||
    text.includes('intercept') ||
    text.includes('scramble') ||
    text.includes('engage target')
  ) {
    return {
      type: 'vector_intercept',
      spoken:
        'Calculating tactical intercept vectors. Defense assets scrambled.',
    };
  }

  // 4. Strategic Threat Grid & Sector Scans
  if (
    text.includes('threat grid') ||
    text.includes('tactical grid') ||
    text.includes('scan grid') ||
    text.includes('grid scan')
  ) {
    return {
      type: 'threat_grid',
      spoken:
        'Synchronizing planetary threat grid across all 8 strategic sectors.',
    };
  }

  // Specific Sector scans
  const sectors = [
    'tokyo',
    'hawaii',
    'london',
    'ukraine',
    'taiwan',
    'hormuz',
    'arctic',
    'washington',
  ];
  for (const s of sectors) {
    if (text.includes(`sector ${s}`) || text.includes(`scan ${s}`)) {
      return {
        type: 'sector_scan',
        sector: s,
        spoken: `Scanning strategic defense sector: ${s.toUpperCase()}.`,
      };
    }
  }

  // 4b. Advanced Defense Modules
  if (
    text.includes('ballistic') ||
    text.includes('bmews') ||
    text.includes('hypersonic trajectory') ||
    text.includes('missile trajectory')
  ) {
    return {
      type: 'ballistic_predictor',
      spoken:
        'Ballistic missile early warning trajectory and ground zero CEP computed.',
    };
  }
  if (
    text.includes('weapon assignment') ||
    text.includes('wta') ||
    text.includes('engage raid') ||
    text.includes('battle management') ||
    text.includes('intercept queue')
  ) {
    return {
      type: 'wta_assignment',
      spoken:
        'Weapons to target assignment solved. Multi-target intercept vectors locked.',
    };
  }
  if (
    text.includes('terrain masking') ||
    text.includes('radar horizon') ||
    text.includes('nap of the earth') ||
    text.includes('blind zone')
  ) {
    return {
      type: 'terrain_masking',
      spoken: '3D radar horizon and terrain elevation masking contours online.',
    };
  }
  if (
    text.includes('satellite overflight') ||
    text.includes('space domain') ||
    text.includes('sda') ||
    text.includes('recon satellite') ||
    text.includes('overflight')
  ) {
    return {
      type: 'space_domain',
      spoken:
        'Space domain awareness active. Reconnaissance satellite overflight detection armed.',
    };
  }

  // 5. Tactical Tour
  if (
    text.includes('tour') ||
    text.includes('start tour') ||
    text.includes('tactical tour') ||
    text.includes('recon tour')
  ) {
    return {
      type: 'tactical_tour',
      spoken: 'Initiating Project Seraph tactical planetary recon tour.',
    };
  }

  // 6. Sensor & Visual Style Filters
  if (
    text.includes('flir') ||
    text.includes('thermal') ||
    text.includes('infrared')
  ) {
    return {
      type: 'action',
      action: 'set_visual_style',
      args: { style: 'thermal' },
      spoken: 'FLIR thermal imagery online.',
    };
  }
  if (text.includes('surveillance') || text.includes('recon view')) {
    return {
      type: 'action',
      action: 'set_visual_style',
      args: { style: 'surveillance' },
      spoken: 'Tactical surveillance visual filter engaged.',
    };
  }
  if (
    text.includes('night vision') ||
    text.includes('retro') ||
    text.includes('phosphor')
  ) {
    return {
      type: 'action',
      action: 'set_visual_style',
      args: { style: 'retro' },
      spoken: 'Night surveillance filter active.',
    };
  }
  if (
    text.includes('normal') ||
    text.includes('daylight') ||
    text.includes('standard view')
  ) {
    return {
      type: 'action',
      action: 'set_visual_style',
      args: { style: 'normal' },
      spoken: 'Standard visual rendering restored.',
    };
  }

  // 7. Navigation & Camera Controls
  if (
    text.includes('reset globe') ||
    text.includes('globe view') ||
    text.includes('orbital view') ||
    text.includes('full earth')
  ) {
    return {
      type: 'action',
      action: 'zoom_to_globe',
      args: {},
      spoken: 'Resetting camera to orbital globe view.',
    };
  }
  if (text.includes('zoom in') || text.includes('punch in')) {
    return {
      type: 'action',
      action: 'adjust_camera_zoom',
      args: { direction: 'in', amount: 'medium' },
      spoken: 'Zooming in.',
    };
  }
  if (text.includes('zoom out')) {
    return {
      type: 'action',
      action: 'adjust_camera_zoom',
      args: { direction: 'out', amount: 'medium' },
      spoken: 'Zooming out.',
    };
  }

  // Fly to location
  const flyMatch = text.match(
    /(?:fly to|go to|navigate to|look at|view)\s+([a-z\s]+)/i,
  );
  if (flyMatch && flyMatch[1]) {
    const loc = flyMatch[1].trim();
    return {
      type: 'action',
      action: 'fly_to_location',
      args: { query: loc },
      spoken: `Navigating orbital optics to ${loc}.`,
    };
  }

  // 8. Data Layers
  if (
    text.includes('flight') ||
    text.includes('aircraft') ||
    text.includes('air track')
  ) {
    return {
      type: 'action',
      action: 'set_layer_visibility',
      args: { layerId: 'opensky', enabled: true },
      spoken: 'Air corridor telemetry active.',
    };
  }
  if (
    text.includes('ship') ||
    text.includes('vessel') ||
    text.includes('maritime') ||
    text.includes('ais')
  ) {
    return {
      type: 'action',
      action: 'set_layer_visibility',
      args: { layerId: 'aisstream', enabled: true },
      spoken: 'Maritime surface tracking online.',
    };
  }
  if (
    text.includes('satellite') ||
    text.includes('orbit') ||
    text.includes('space')
  ) {
    return {
      type: 'action',
      action: 'set_layer_visibility',
      args: { layerId: 'celestrak', enabled: true },
      spoken: 'Orbital assets telemetry displayed.',
    };
  }
  if (
    text.includes('earthquake') ||
    text.includes('quake') ||
    text.includes('seismic')
  ) {
    return {
      type: 'action',
      action: 'set_layer_visibility',
      args: { layerId: 'usgs-quakes', enabled: true },
      spoken: 'USGS seismic sensor grid active.',
    };
  }
  if (
    text.includes('hotspot') ||
    text.includes('fire') ||
    text.includes('thermal anomaly')
  ) {
    return {
      type: 'action',
      action: 'set_layer_visibility',
      args: { layerId: 'firms', enabled: true },
      spoken: 'NASA thermal anomaly grid displayed.',
    };
  }

  // 9. Cockpit
  if (text.includes('enter cockpit') || text.includes('cockpit')) {
    return {
      type: 'action',
      action: 'control_cockpit',
      args: { mode: 'enter' },
      spoken: 'Entering tactical cockpit perspective.',
    };
  }
  if (text.includes('exit cockpit') || text.includes('leave cockpit')) {
    return {
      type: 'action',
      action: 'control_cockpit',
      args: { mode: 'exit' },
      spoken: 'Exiting cockpit perspective.',
    };
  }

  // 10. General / Analyst query fallback
  return {
    type: 'analyst',
    query: text,
    spoken: `Tactical query received: ${text}`,
  };
}

/** Synthesize and play voice acknowledgment using on-device OmniVoice / local server */
export async function playTacticalVoiceAck(text, gender = 'female') {
  if (!text) return;
  try {
    tacticalSound.playCommsOpen?.(true);
  } catch {}

  // 1. Primary: Local Seraph OmniVoice server
  if (typeof fetch !== 'undefined') {
    try {
      const query = new URLSearchParams({ text, gender, engine: 'omnivoice' });
      const resp = await fetch(`http://127.0.0.1:8111/tts?${query}`, {
        signal:
          typeof AbortSignal !== 'undefined' && AbortSignal.timeout
            ? AbortSignal.timeout(3500)
            : undefined,
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          try {
            tacticalSound.playCommsClose?.(true);
          } catch {}
        };
        await audio.play();
        return;
      }
    } catch {
      // Local fallback
    }
  }

  // 2. Secondary: Browser speech synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => {
      try {
        tacticalSound.playCommsClose?.(true);
      } catch {}
    };
    window.speechSynthesis.speak(utterance);
  }
}

/**
 * Creates a local, 100% on-device voice session.
 * Zero OpenAI cloud routing, zero WebRTC leaks, zero API billing.
 */
export function createLocalVoiceSession({
  emit,
  runAction,
  ui,
  runner,
  dataManager,
  ...options
}) {
  let isListening = false;
  let recognition = null;
  let audioStream = null;
  let animTimer = null;
  let spaceKeyHeld = false;

  // Setup Web Speech API if supported
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition || null
      : null;

  function setVisualizerActive(active) {
    if (!ui?.root) return;
    const bars = ui.root.querySelectorAll('.gev-voice-visualizer span');
    if (!bars || bars.length === 0) return;
    clearInterval(animTimer);
    if (active) {
      animTimer = setInterval(() => {
        bars.forEach((bar) => {
          const h = Math.floor(Math.random() * 20) + 4;
          bar.style.height = `${h}px`;
        });
      }, 100);
    } else {
      bars.forEach((bar) => {
        bar.style.height = '3px';
      });
    }
  }

  async function executeTacticalCommand(text) {
    if (!text) return;
    emit({ type: 'transcript', role: 'user', text, final: true });
    ui.detail.textContent = `CMD: ${text.toUpperCase()}`;

    const intent = matchTacticalIntent(text);
    if (!intent) return;

    try {
      if (intent.type === 'defcon') {
        window.__threatMatrix?.setDefcon?.(intent.level);
        await playTacticalVoiceAck(intent.spoken);
      } else if (intent.type === 'sitrep') {
        window.__tacticalSitrep?.deliverBriefing?.();
      } else if (intent.type === 'vector_intercept') {
        window.__tacticalVectoring?.vectorNearest?.();
        await playTacticalVoiceAck(intent.spoken);
      } else if (intent.type === 'threat_grid') {
        window.__tacticalThreatGrid?.scanAllSectors?.();
        await playTacticalVoiceAck(intent.spoken);
      } else if (intent.type === 'sector_scan') {
        window.__tacticalThreatGrid?.scanSectorByName?.(intent.sector);
        await playTacticalVoiceAck(intent.spoken);
      } else if (intent.type === 'ballistic_predictor') {
        window.ProjectSeraph?.ballisticPredictor?.toggle?.();
        await playTacticalVoiceAck(intent.spoken);
      } else if (intent.type === 'wta_assignment') {
        window.ProjectSeraph?.tacticalWta?.toggle?.();
        await playTacticalVoiceAck(intent.spoken);
      } else if (intent.type === 'terrain_masking') {
        window.ProjectSeraph?.terrainMasking?.toggle?.();
        await playTacticalVoiceAck(intent.spoken);
      } else if (intent.type === 'space_domain') {
        window.ProjectSeraph?.spaceDomainAwareness?.toggle?.();
        await playTacticalVoiceAck(intent.spoken);
      } else if (intent.type === 'tactical_tour') {
        window.__tacticalTour?.start?.();
      } else if (intent.type === 'action') {
        await runAction(intent.action, intent.args || {});
        await playTacticalVoiceAck(intent.spoken);
      } else if (intent.type === 'analyst') {
        await runAction('analyst_query', { query: intent.query });
        await playTacticalVoiceAck(intent.spoken);
      }
    } catch (err) {
      console.warn('[LocalVoiceSession] Command execution note:', err);
    }
  }

  function startRecognition() {
    if (!SpeechRecognition) {
      console.info(
        '[LocalVoiceSession] Browser speech recognition not available in this environment; on-device command terminal active.',
      );
      return;
    }
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setVisualizerActive(true);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (interim && ui?.detail) {
          ui.detail.textContent = interim.toUpperCase();
        }
        if (final) {
          executeTacticalCommand(final);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech') return;
        console.warn('[LocalVoiceSession] Recognition notice:', event.error);
      };

      recognition.onend = () => {
        if (isListening) {
          try {
            recognition.start();
          } catch {}
        } else {
          setVisualizerActive(false);
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('[LocalVoiceSession] Recognition initialization note:', err);
    }
  }

  function stopRecognition() {
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
      recognition = null;
    }
    setVisualizerActive(false);
  }

  const sessionAdapter = {
    capabilities: {
      costControls: false, // Disables OpenAI billing meter ($0.00 ticker)
      pushToTalk: true,
      cloudRouted: false, // 100% on-device local C2
      localEngine: 'omnivoice',
    },

    async start(settings = {}) {
      if (isListening) return;
      isListening = true;
      emit({
        type: 'state',
        state: 'listening',
        detail: 'OMNIVOICE · LOCAL C2 ARMED',
      });

      // Update UI kicker to Project Seraph OmniVoice
      if (ui?.root) {
        const kicker = ui.root.querySelector('.gev-voice-kicker');
        if (kicker) kicker.textContent = 'SERAPH // OMNIVOICE C2';
        ui.root.dataset.status = 'listening';
      }
      if (ui?.status) ui.status.textContent = 'LISTENING';
      if (ui?.detail)
        ui.detail.textContent = 'OMNIVOICE ACTIVE · HOLD SPACE TO SPEAK';

      try {
        tacticalSound.playCommsOpen?.(true);
      } catch {}

      startRecognition();
    },

    stop(settings = {}) {
      if (!isListening) return;
      isListening = false;
      stopRecognition();
      setVisualizerActive(false);
      emit({ type: 'state', state: 'idle', detail: 'OMNIVOICE STANDBY' });

      if (ui?.root) {
        ui.root.dataset.status = 'idle';
      }
      if (ui?.status) ui.status.textContent = 'OFF';
      if (ui?.detail) ui.detail.textContent = 'VOICE STANDBY';

      try {
        tacticalSound.playCommsClose?.(true);
      } catch {}
    },

    sendText(text) {
      return executeTacticalCommand(text);
    },

    sendMapEvent(event) {
      // Map annotations or outline events
    },

    ignoreButtonClick() {
      return spaceKeyHeld;
    },

    bindControls() {
      // Push-To-Talk Keyboard Shortcut (Space key)
      if (typeof window !== 'undefined') {
        const handleKeyDown = (e) => {
          if (e.code === 'Space' && !e.repeat) {
            const activeTag = document.activeElement
              ? document.activeElement.tagName.toLowerCase()
              : '';
            if (
              activeTag === 'input' ||
              activeTag === 'textarea' ||
              document.activeElement?.isContentEditable
            ) {
              return;
            }
            spaceKeyHeld = true;
            if (!isListening) {
              sessionAdapter.start({ pushToTalk: true });
            }
          }
        };

        const handleKeyUp = (e) => {
          if (e.code === 'Space') {
            if (spaceKeyHeld) {
              spaceKeyHeld = false;
            }
          }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
      }
    },
  };

  return sessionAdapter;
}
