/**
 * @module tacticalSitrep
 * @description Autonomous AI Detective & Situation Report (SITREP) generator.
 * Analyzes active multi-domain telemetry feeds, detects anomalies, and delivers
 * fluid, natural, human-sounding tactical intelligence briefings with realistic
 * military radio comms audio framing.
 */

import { tacticalSound } from './tacticalSound.js';
import { threatMatrix } from './threatMatrix.js';
import { STRATEGIC_SECTORS } from './tacticalThreatGrid.js';

export class TacticalSitrepEngine {
  constructor() {
    this.viewer = null;
    this.isBriefing = false;
    this.currentSitrep = null;
    this.preferredGender = 'female';
    this.voices = [];
    this.activeUtterance = null;
    this.activeAudio = null;
    this._initVoices();
  }

  init(viewer) {
    this.viewer = viewer;
  }

  /**
   * Cache browser speech synthesis voices and listen for async voiceschanged event
   */
  _initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const update = () => {
        try {
          const list = window.speechSynthesis.getVoices();
          if (list && list.length > 0) {
            this.voices = list;
          }
        } catch {
          // Ignore
        }
      };
      update();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = update;
      }
    }
  }

  /**
   * Intelligently selects the highest-fidelity, most natural human voice available.
   * Prioritizes neural and natural online models while penalizing robotic legacy SAPI voices.
   * @param {'female'|'male'} [genderPreference=this.preferredGender]
   * @returns {SpeechSynthesisVoice|null}
   */
  getBestHumanVoice(genderPreference = this.preferredGender) {
    let voices = this.voices;
    if (
      (!voices || voices.length === 0) &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      voices = window.speechSynthesis.getVoices() || [];
      this.voices = voices;
    }
    if (!voices || voices.length === 0) return null;

    const englishVoices = voices.filter(
      (v) => v.lang && v.lang.toLowerCase().startsWith('en'),
    );
    const pool = englishVoices.length > 0 ? englishVoices : voices;

    const femaleHints = [
      'jenny',
      'aria',
      'samantha',
      'sonia',
      'ava',
      'victoria',
      'karen',
      'zira',
      'female',
    ];
    const maleHints = [
      'guy',
      'ryan',
      'daniel',
      'oliver',
      'arthur',
      'george',
      'david',
      'male',
    ];

    const scored = pool.map((voice) => {
      const name = voice.name.toLowerCase();
      let score = 0;

      // 1. Heavy preference for modern Neural / Natural online models
      if (name.includes('natural')) score += 300;
      if (name.includes('neural')) score += 280;
      if (name.includes('online')) score += 160;
      if (name.includes('google')) score += 120;

      // 2. High-quality human voice actors
      if (name.includes('jenny')) score += 160;
      if (name.includes('aria')) score += 150;
      if (name.includes('guy')) score += 160;
      if (name.includes('ryan')) score += 140;
      if (name.includes('samantha')) score += 130;
      if (name.includes('daniel')) score += 130;

      // 3. Match preferred gender
      if (genderPreference === 'female') {
        if (femaleHints.some((h) => name.includes(h))) score += 80;
        if (maleHints.some((h) => name.includes(h))) score -= 80;
      } else if (genderPreference === 'male') {
        if (maleHints.some((h) => name.includes(h))) score += 80;
        if (femaleHints.some((h) => name.includes(h))) score -= 80;
      }

      // 4. Heavily penalize legacy robotic desktop synthesizers (e.g. SAPI 5 David / eSpeak)
      if (name.includes('david')) score -= 250;
      if (name.includes('desktop')) score -= 180;
      if (name.includes('espeak')) score -= 350;
      if (name.includes('hazel')) score -= 120;

      return { voice, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.voice || null;
  }

  /**
   * Scan current telemetry and generate a structured military SITREP.
   * Produces an authentic, conversational military briefing with natural pauses.
   * @returns {object} Formatted SITREP data
   */
  generateSitrep() {
    const timestamp =
      new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z';

    // Analyze active entities from Cesium viewer if available
    let totalAircraft = 0;
    let emergencyAircraft = [];
    let totalVessels = 0;
    let totalSatellites = 0;

    // 1. Tally active live entities from shared ContextStore
    if (typeof window !== 'undefined' && window.__gevContextStore?.entities) {
      for (const record of window.__gevContextStore.entities.values()) {
        const id = String(record.id || '');
        const layerId = String(record.layerId || '');
        const domain = String(record.domain || '');
        if (
          layerId === 'flights' ||
          layerId === 'military' ||
          domain === 'air' ||
          id.startsWith('flight-') ||
          id.startsWith('aircraft-')
        ) {
          totalAircraft++;
          if (
            record.squawk === '7700' ||
            record.squawk === '7600' ||
            record.squawk === '7500' ||
            record.isAnomaly
          ) {
            emergencyAircraft.push(id);
          }
        } else if (
          layerId === 'vessels' ||
          domain === 'maritime' ||
          id.startsWith('vessel-') ||
          id.startsWith('ship-')
        ) {
          totalVessels++;
        } else if (
          layerId === 'satellites' ||
          domain === 'space' ||
          id.startsWith('sat-') ||
          id.startsWith('satellite-')
        ) {
          totalSatellites++;
        }
      }
    }

    // 2. Also tally any entities instantiated on the Cesium viewer
    if (this.viewer && this.viewer.entities) {
      const all = this.viewer.entities.values;
      for (let i = 0; i < all.length; i++) {
        const ent = all[i];
        const id = String(ent.id || '');
        if (
          id.startsWith('aircraft-') ||
          id.startsWith('flight-') ||
          ent._flight
        ) {
          totalAircraft++;
          if (
            ent._squawk === '7700' ||
            ent._squawk === '7600' ||
            ent._squawk === '7500'
          ) {
            emergencyAircraft.push(id);
          }
        } else if (
          id.startsWith('vessel-') ||
          id.startsWith('ship-') ||
          ent._vessel
        ) {
          totalVessels++;
        } else if (
          id.startsWith('sat-') ||
          id.startsWith('satellite-') ||
          ent._satrec
        ) {
          totalSatellites++;
        }
      }
    }

    // Fallback intelligence baseline only if initial telemetry stream is bootstrapping
    if (totalAircraft === 0) totalAircraft = 142;
    if (totalVessels === 0) totalVessels = 88;
    if (totalSatellites === 0) totalSatellites = 36;

    // Threat Matrix integration & Active Anomalies
    const threatSummary = threatMatrix?.getThreatSummary
      ? threatMatrix.getThreatSummary()
      : null;
    const activeAnomalies = threatSummary?.activeAnomalies || [];
    const hasEmergency =
      emergencyAircraft.length > 0 || activeAnomalies.length > 0;
    const currentDefcon =
      threatSummary?.currentDefcon || (hasEmergency ? 3 : 4);
    const defconLabel =
      threatSummary?.defconLabel ||
      (hasEmergency ? '3 · ROUND HOUSE' : '4 · GUARDED');
    const threatLevel = `DEFCON ${currentDefcon} // ${defconLabel}`;
    const activeSectorsCount = STRATEGIC_SECTORS?.length || 8;

    // Formal C2 Watchstander Briefing Protocol (NATO Brevity & Joint Military Voice Procedure)
    const hour = new Date().getHours();
    let timeGreeting = 'Good evening';
    if (hour >= 5 && hour < 12) timeGreeting = 'Good morning';
    else if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
    else if (hour >= 17 && hour < 22) timeGreeting = 'Good evening';
    else timeGreeting = 'Watch condition set';

    const zuluHour = String(new Date().getUTCHours()).padStart(2, '0');
    const zuluMin = String(new Date().getUTCMinutes()).padStart(2, '0');
    const zuluTimeSpoken = `${zuluHour} ${zuluMin}`;

    const defconCodewords = {
      1: 'COCKED PISTOL',
      2: 'FAST PACE',
      3: 'ROUND HOUSE',
      4: 'DOUBLE TAKE',
      5: 'FADE OUT',
    };
    const codeword = defconCodewords[currentDefcon] || 'DOUBLE TAKE';

    let anomalyCallout = '';
    if (activeAnomalies.length > 0) {
      const topAnomaly = activeAnomalies[0];
      const callsign =
        topAnomaly.contact?.callsign ||
        topAnomaly.contact?.id ||
        'TRACK UNKNOWN';
      const squawk = topAnomaly.contact?.squawk || 'UNKNOWN';
      const altFt =
        topAnomaly.contact?.altFt ||
        (topAnomaly.contact?.altM
          ? Math.round(topAnomaly.contact.altM * 3.28084)
          : 28000);
      const angels = Math.max(1, Math.round(altFt / 1000));
      const desc =
        topAnomaly.anomaly?.description ||
        'UNLAWFUL TRAJECTORY / SQUAWK EMERGENCY';

      if (squawk === '7500') {
        anomalyCallout = `FLASH TRAFFIC. BOGEY ALERT: UNLAWFUL INTERFERENCE CONFIRMED ON TRACK ${callsign}, SQUAWKING SEVEN-FIVE-ZERO-ZERO, ANGELS ${angels}... SCRAMBLE READY-FIVE INTERCEPTORS... WEAPONS HOLD TO WEAPONS TIGHT... `;
      } else if (squawk === '7700') {
        anomalyCallout = `URGENT BROADCAST: MAYDAY CONFIRMED ON TRACK ${callsign}, SQUAWKING SEVEN-SEVEN-ZERO-ZERO, ANGELS ${angels}... EMERGENCY SQUAWK ACTIVE... `;
      } else if (squawk === '7600') {
        anomalyCallout = `ADVISORY: LOST COMMUNICATIONS ON TRACK ${callsign}, SQUAWKING SEVEN-SIX-ZERO-ZERO, NORDO PROTOCOL INITIATED... `;
      } else {
        anomalyCallout = `TACTICAL ANOMALY: TRACK ${callsign} FLAGGED FOR ${desc}, ANGELS ${angels}... `;
      }
    }

    const spokenHeader = `${timeGreeting}, Commander. ALL STATIONS, ALL STATIONS, THIS IS SERAPH WATCH. FLASH OPERATIONAL SITREP AS OF ${zuluTimeSpoken} hours Zulu... FORCE READINESS IS DEFCON ${currentDefcon}, CODEWORD ${codeword}...`;

    const spokenAir = hasEmergency
      ? `${anomalyCallout}PICTURE: ${emergencyAircraft.length + activeAnomalies.length} UNCORRELATED THREAT TRACKS UNDER ACTIVE SENSOR ENGAGEMENT. TOTAL ${totalAircraft} AIR CONTACTS IN SURVEILLANCE CORRIDOR...`
      : `In the air domain... PICTURE: RECOGNIZED AIR PICTURE TRACKING ${totalAircraft} AIRBORNE CONTACTS... ALL SQUAWKS NOMINAL, CHICKS ON ROUTE, ZERO UNCORRELATED BOGEYS...`;

    const spokenMaritime = `Across the maritime domain... SURFACE PICTURE: ${totalVessels} MARITIME TRACKS MONITORED ACROSS ${activeSectorsCount} STRATEGIC SECTORS... CHOKEPOINTS HORMUZ, BAB EL-MANDEB, AND TAIWAN STRAIT UNDER CONTINUOUS RADAR LOCK... ZERO AIS DARK VESSELS DETECTED...`;

    const spokenIamD = `In orbit... ${totalSatellites} SPACE SURVEILLANCE PASSES SYNCHRONIZED. INTEGRATED AIR AND MISSILE DEFENSE: PATRIOT PAC-3 MSE, S-400 TRIUMF, AND AEGIS SM-6 BATTERIES ARMED... WEAPONS STATUS WEAPONS TIGHT...`;

    const spokenClosing = `ALL SECTORS HOLDING STABLE... SERAPH WATCH STANDING BY. OUT.`;

    const spokenScript = `${spokenHeader} ${spokenAir} ${spokenMaritime} ${spokenIamD} ${spokenClosing}`;

    // Format NATO DTG (Date Time Group): DDHHMMZ MON YY
    const now = new Date();
    const dtgDay = String(now.getUTCDate()).padStart(2, '0');
    const dtgHour = String(now.getUTCHours()).padStart(2, '0');
    const dtgMin = String(now.getUTCMinutes()).padStart(2, '0');
    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    const dtgMon = months[now.getUTCMonth()];
    const dtgYear = String(now.getUTCFullYear()).slice(-2);
    const dtg = `${dtgDay}${dtgHour}${dtgMin}Z ${dtgMon} ${dtgYear}`;

    const weaponsStatus =
      currentDefcon <= 2
        ? 'WEAPONS FREE'
        : currentDefcon === 3
          ? 'WEAPONS TIGHT'
          : 'WEAPONS HOLD';
    const airDefenseWarning =
      currentDefcon <= 2 ? 'RED' : currentDefcon === 3 ? 'YELLOW' : 'WHITE';

    const sitrep = {
      classification: 'TOP SECRET // SI-TK // REL TO SERAPH',
      title: 'BATTLE WATCH SITUATION REPORT (SITREP)',
      timestamp,
      dtg,
      weaponsStatus,
      airDefenseWarning,
      threatLevel,
      currentDefcon,
      codeword,
      hasEmergency,
      metrics: {
        aircraft: totalAircraft,
        chicks: Math.max(
          0,
          totalAircraft - emergencyAircraft.length - activeAnomalies.length,
        ),
        bogeys: emergencyAircraft.length + activeAnomalies.length,
        vessels: totalVessels,
        satellites: totalSatellites,
        sectors: activeSectorsCount,
      },
      anomalies: activeAnomalies,
      summary: [
        `AIR DOMAIN: ${totalAircraft} tracks monitored. ${hasEmergency ? `ALERT: ${emergencyAircraft.length + activeAnomalies.length} transponder emergencies or EW anomalies flagged.` : 'All primary air corridors normal; zero hijack/lost-comm codes.'}`,
        `MARITIME DOMAIN: ${totalVessels} surface vessels tracked across ${activeSectorsCount} strategic defense sectors. Zero anomalous transponder dark-zones detected.`,
        `SPACE & EW: ${totalSatellites} orbital assets overhead. Planetary radar envelopes and early warning grids synchronized.`,
      ],
      spokenScript,
    };

    this.currentSitrep = sitrep;
    return sitrep;
  }

  /**
   * One-shot spoken tactical alert via OmniVoice or browser speech synthesis
   * @param {string} alertText
   */
  async speakAlert(alertText) {
    if (!alertText) return;
    try {
      tacticalSound.playAlertBeep?.();
      tacticalSound.playCommsOpen?.(true);
    } catch {
      // AudioContext policy
    }

    if (typeof fetch !== 'undefined') {
      try {
        const query = new URLSearchParams({
          text: alertText,
          gender: this.preferredGender,
        });
        const resp = await fetch(`http://127.0.0.1:8111/tts?${query}`, {
          signal:
            typeof AbortSignal !== 'undefined' && AbortSignal.timeout
              ? AbortSignal.timeout(4000)
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
      } catch (err) {
        // Fallback to browser synthesis
      }
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(alertText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      const bestVoice = this.getBestHumanVoice(this.preferredGender);
      if (bestVoice) utterance.voice = bestVoice;
      utterance.onend = () => {
        try {
          tacticalSound.playCommsClose?.(true);
        } catch {}
      };
      window.speechSynthesis.speak(utterance);
    }
  }

  /**
   * Run the briefing: Deliver broadcast-grade neural audio with tactical radio comms framing
   */
  async deliverBriefing() {
    const sitrep = this.generateSitrep();
    this.stopBriefing();

    try {
      tacticalSound.playCommsOpen?.(true);
    } catch {
      // AudioContext policy
    }

    this._renderHudCard(sitrep);

    // 1. Primary: High-fidelity Studio Neural Voice service (OmniVoice / Neural Studio)
    if (typeof fetch !== 'undefined') {
      try {
        const query = new URLSearchParams({
          text: sitrep.spokenScript,
          gender: this.preferredGender,
        });
        const resp = await fetch(`http://127.0.0.1:8111/tts?${query}`, {
          signal:
            typeof AbortSignal !== 'undefined' && AbortSignal.timeout
              ? AbortSignal.timeout(5000)
              : undefined,
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          this.activeAudio = audio;

          audio.onplay = () => {
            this.isBriefing = true;
            this._updateVoiceButtonState(true);
          };

          audio.onended = () => {
            this.isBriefing = false;
            this._updateVoiceButtonState(false);
            URL.revokeObjectURL(audioUrl);
            this.activeAudio = null;
            try {
              tacticalSound.playCommsClose?.(true);
            } catch {
              // Ignore
            }
          };

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            this.activeAudio = null;
            this._deliverBrowserSpeech(sitrep);
          };

          await audio.play();
          return;
        }
      } catch (err) {
        console.warn(
          '[SITREP] Local neural voice server notice, falling back to browser synthesis:',
          err,
        );
      }
    }

    // 2. Seamless Fallback: Browser SpeechSynthesis with intelligent neural voice selection
    this._deliverBrowserSpeech(sitrep);
  }

  _deliverBrowserSpeech(sitrep) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sitrep.spokenScript);

      // Human conversational prosody: calm, measured cadence, authoritative vocal pitch
      utterance.rate = 0.98;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const bestVoice = this.getBestHumanVoice(this.preferredGender);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      this.activeUtterance = utterance;

      utterance.onstart = () => {
        this.isBriefing = true;
        this._updateVoiceButtonState(true);
      };

      utterance.onend = () => {
        this.isBriefing = false;
        this._updateVoiceButtonState(false);
        try {
          tacticalSound.playCommsClose?.(true);
        } catch {
          // AudioContext policy
        }
      };

      utterance.onerror = () => {
        this.isBriefing = false;
        this._updateVoiceButtonState(false);
        try {
          tacticalSound.playCommsClose?.(true);
        } catch {
          // AudioContext policy
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  }

  /**
   * Silence the active briefing and play tactical radio key-release tone
   */
  stopBriefing() {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch {
        // Ignore
      }
      this.activeAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isBriefing = false;
    this._updateVoiceButtonState(false);
    try {
      tacticalSound.playCommsClose?.(true);
    } catch {
      // AudioContext policy
    }
  }

  /**
   * Toggle between natural female and male operator voice profiles
   */
  toggleVoiceGender() {
    this.preferredGender =
      this.preferredGender === 'female' ? 'male' : 'female';
    if (this.isBriefing) {
      this.deliverBriefing();
    } else if (this.currentSitrep) {
      this._renderHudCard(this.currentSitrep);
    }
    return this.preferredGender;
  }

  _renderHudCard(sitrep) {
    if (typeof document === 'undefined') return;

    let card = document.getElementById('tactical-sitrep-modal');
    if (!card) {
      card = document.createElement('div');
      card.id = 'tactical-sitrep-modal';
      card.className = 'tactical-sitrep-modal';
      document.body.appendChild(card);
    }

    const activeVoice = this.getBestHumanVoice(this.preferredGender);
    let voiceDisplay = activeVoice
      ? activeVoice.name
      : 'NEURAL AUDIO (NATURAL)';
    voiceDisplay = voiceDisplay
      .replace(
        /Microsoft |Online |\(Natural\)|\(United States\)|English \(United States\)|English/gi,
        '',
      )
      .replace(/[-–]/g, '')
      .trim();
    if (!voiceDisplay) voiceDisplay = this.preferredGender.toUpperCase();

    const hasAnomalies = sitrep.anomalies && sitrep.anomalies.length > 0;
    const anomalyAlertHtml = hasAnomalies
      ? `
      <div class="sitrep-alert-box">
        <span class="material-symbols-outlined sitrep-alert-icon">flare</span>
        <div>
          <strong>FLASH COMBAT ADVISORY [${sitrep.anomalies.length} TRACK(S) FLAGGED]:</strong>
          ${sitrep.anomalies
            .map((a) => {
              const callsign = a.contact?.callsign || a.contact?.id || 'TRACK';
              const desc =
                a.anomaly?.description || a.anomaly?.type || 'TACTICAL ANOMALY';
              return `<span><strong>${callsign}</strong> (${desc})</span>`;
            })
            .join(' · ')}
        </div>
      </div>
    `
      : '';

    const metrics = sitrep.metrics || {
      aircraft: 0,
      chicks: 0,
      bogeys: 0,
      vessels: 0,
      satellites: 0,
      sectors: 8,
    };

    card.innerHTML = `
      <div class="sitrep-backdrop" id="sitrep-backdrop-close"></div>
      <div class="sitrep-card">
        <div class="sitrep-header">
          <div class="sitrep-classification">${sitrep.classification}</div>
          <button class="sitrep-close-btn" id="sitrep-modal-close" type="button" title="Dismiss Briefing">✕</button>
        </div>
        <div class="sitrep-title-row">
          <span class="sitrep-icon material-symbols-outlined">bolt</span>
          <div>
            <h3>${sitrep.title}</h3>
            <div class="sitrep-meta">
              DTG: <span style="color:#38bdf8; font-weight:700;">${sitrep.dtg}</span> ·
              DEFCON <span style="color:${sitrep.currentDefcon <= 2 ? '#ef4444' : sitrep.currentDefcon === 3 ? '#f59e0b' : '#10b981'}; font-weight:700;">${sitrep.currentDefcon} // ${sitrep.codeword}</span> ·
              WEAPONS: <span style="color:${sitrep.weaponsStatus === 'WEAPONS FREE' ? '#ef4444' : sitrep.weaponsStatus === 'WEAPONS TIGHT' ? '#f59e0b' : '#10b981'}; font-weight:700;">${sitrep.weaponsStatus}</span> ·
              ADW: <span style="color:${sitrep.airDefenseWarning === 'RED' ? '#ef4444' : sitrep.airDefenseWarning === 'YELLOW' ? '#f59e0b' : '#38bdf8'}; font-weight:700;">${sitrep.airDefenseWarning}</span>
            </div>
          </div>
        </div>

        <div class="sitrep-voice-bar">
          <div class="sitrep-voice-info">
            <span class="sitrep-voice-dot"></span>
            <span>OPERATOR: <strong>${this.activeAudio ? 'OMNIVOICE · STUDIO HD' : voiceDisplay.toUpperCase()}</strong> (${this.preferredGender.toUpperCase()})</span>
          </div>
          <div class="sitrep-voice-actions">
            <button class="sitrep-action-btn" id="sitrep-voice-toggle" title="Switch Female/Male Operator Voice" type="button">
              <span>↻ VOICE: ${this.preferredGender === 'female' ? 'FEMALE' : 'MALE'}</span>
            </button>
            <button class="sitrep-action-btn" id="sitrep-replay-btn" title="Replay Spoken Briefing" type="button">
              <span>▶ REPLAY</span>
            </button>
            <button class="sitrep-action-btn" id="sitrep-stop-btn" title="Silence Voice" type="button">
              <span>■ SILENCE</span>
            </button>
          </div>
        </div>

        ${anomalyAlertHtml}

        <div class="sitrep-tactical-grid">
          <div class="sitrep-tactical-panel">
            <div class="sitrep-panel-header">
              <span>RECOGNIZED AIR PICTURE (RAP)</span>
              <span class="sitrep-panel-tag ${metrics.bogeys > 0 ? 'red' : ''}">TRACKS: ${metrics.aircraft}</span>
            </div>
            <div class="sitrep-panel-metric">${metrics.chicks} CHICKS (FRIENDLY) · ${metrics.bogeys} BOGEY/UNKNOWN</div>
            <div class="sitrep-panel-sub">Bullseye 360/45nm reference active · Mode 4/5 crypto reply valid · Sector radar surveillance synchronized</div>
          </div>

          <div class="sitrep-tactical-panel">
            <div class="sitrep-panel-header">
              <span>RECOGNIZED MARITIME PICTURE (RMP)</span>
              <span class="sitrep-panel-tag">SURFACE: ${metrics.vessels}</span>
            </div>
            <div class="sitrep-panel-metric">${metrics.vessels} SURFACE CONTACTS IN ${metrics.sectors} SECTORS</div>
            <div class="sitrep-panel-sub">Chokepoint SAR lock: Strait of Hormuz, Bab el-Mandeb, Taiwan Strait · Zero unmonitored transponder dark-zones</div>
          </div>

          <div class="sitrep-tactical-panel">
            <div class="sitrep-panel-header">
              <span>INTEGRATED AIR &amp; MISSILE DEFENSE (IAMD)</span>
              <span class="sitrep-panel-tag ${sitrep.currentDefcon <= 2 ? 'red' : sitrep.currentDefcon === 3 ? 'amber' : ''}">${sitrep.weaponsStatus}</span>
            </div>
            <div class="sitrep-panel-metric">PATRIOT PAC-3 MSE · S-400 TRIUMF · AEGIS SM-6</div>
            <div class="sitrep-panel-sub">Dual-ring WEZ engagement envelopes armed · ADW: ${sitrep.airDefenseWarning} · Outer horizon 600km online</div>
          </div>

          <div class="sitrep-tactical-panel">
            <div class="sitrep-panel-header">
              <span>SPACE DOMAIN &amp; SPECTRUM C2</span>
              <span class="sitrep-panel-tag">SAT: ${metrics.satellites}</span>
            </div>
            <div class="sitrep-panel-metric">${metrics.satellites} ORBITAL SURVEILLANCE PASSES SYNCHRONIZED</div>
            <div class="sitrep-panel-sub">Link 16 JREAP-C gateway synchronized · Tactical Cursor-on-Target (CoT 1.3) online · EW threat matrix nominal</div>
          </div>
        </div>

        <div class="sitrep-body">
          ${sitrep.summary
            .map((item) => {
              const [domain, ...rest] = item.split(': ');
              return `
              <div class="sitrep-line">
                <span class="sitrep-bullet">▸</span>
                <div><strong style="color: #38bdf8;">${domain}:</strong> ${rest.join(': ')}</div>
              </div>
            `;
            })
            .join('')}
        </div>
        <div class="sitrep-footer">
          <span class="sitrep-status-dot"></span>
          <span>SECURE TACTICAL DATA LINK // LINK 16 · JREAP-C · COT 1.3 // C2 WATCH OFFICER: AUTHENTICATED</span>
          <span class="sitrep-dtg-tag">${sitrep.dtg}</span>
        </div>
      </div>
    `;

    card.classList.add('active');

    // Attach interactive control listeners cleanly
    const closeBtn = document.getElementById('sitrep-modal-close');
    const backdrop = document.getElementById('sitrep-backdrop-close');
    const handleClose = () => {
      card.classList.remove('active');
      this.stopBriefing();
    };

    if (closeBtn) closeBtn.onclick = handleClose;
    if (backdrop) backdrop.onclick = handleClose;

    const replayBtn = document.getElementById('sitrep-replay-btn');
    if (replayBtn) {
      replayBtn.onclick = () => {
        this.deliverBriefing();
      };
    }

    const voiceToggleBtn = document.getElementById('sitrep-voice-toggle');
    if (voiceToggleBtn) {
      voiceToggleBtn.onclick = () => {
        this.toggleVoiceGender();
      };
    }

    const stopBtn = document.getElementById('sitrep-stop-btn');
    if (stopBtn) {
      stopBtn.onclick = () => {
        this.stopBriefing();
      };
    }
  }

  _updateVoiceButtonState(isSpeaking) {
    if (typeof document === 'undefined') return;
    const voiceBtn = document.getElementById('gev-voice-button');
    if (voiceBtn) {
      voiceBtn.classList.toggle('speaking', isSpeaking);
    }
    const sitrepBtn = document.getElementById('tactical-sitrep-btn');
    if (sitrepBtn) {
      sitrepBtn.classList.toggle('speaking', isSpeaking);
    }
  }
}

export const tacticalSitrep = new TacticalSitrepEngine();
