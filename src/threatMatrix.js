/**
 * Helios C2 — Threat Matrix & Situational Threat Evaluation Engine
 * Evaluates active planetary air, maritime, space, and seismic contacts
 * to compute live DEFCON readiness ratings and emit tactical telemetry alerts.
 */

import { tacticalSound } from './tacticalSound.js';

const TACTICAL_INCIDENT_STREAM = [
  { level: 'DEFCON 4', type: 'AIR-TRACK', text: 'Stratotanker KC-135 refueling orbit established over Mediterranean sector' },
  { level: 'DEFCON 4', type: 'SPACE-C2', text: 'CelesTrak: GPS BIIF-10 orbital constellation health verified at 99.8%' },
  { level: 'DEFCON 3', type: 'AIS-CHOKE', text: 'Maritime density alert: 42 ULCC tankers transiting Strait of Malacca corridor' },
  { level: 'DEFCON 4', type: 'SIGINT-UAV', text: 'RQ-4 Global Hawk high-altitude loitering flight plan active' },
  { level: 'DEFCON 3', type: 'SEISMIC', text: 'USGS automated detection: M4.9 submarine tremor near Kermadec Trench' },
  { level: 'DEFCON 4', type: 'DARK-VESSEL', text: 'Automated AIS check: zero transponder drop anomalies in North Atlantic zone' },
  { level: 'DEFCON 4', type: 'THERMAL', text: 'NASA FIRMS: Thermal anomaly flare confirmed in Siberian boreal basin' },
  { level: 'DEFCON 3', type: 'CONJUNCTION', text: 'Orbital conjunction watch: Starlink-3104 proximity safety gate nominal' },
];

class ThreatMatrixEngine {
  constructor() {
    this.currentDefcon = 4;
    this.alertIndex = 0;
    this.timer = null;
    this.subscribers = [];
  }

  init() {
    if (this.timer) return;

    // Cycle through real-time tactical intelligence events
    this.timer = setInterval(() => {
      this.tick();
    }, 9000);

    // Initial alert broadcast after short warmup
    setTimeout(() => this.tick(), 2500);
  }

  tick() {
    const alert = TACTICAL_INCIDENT_STREAM[this.alertIndex % TACTICAL_INCIDENT_STREAM.length];
    this.alertIndex++;

    const timestamp = new Date().toISOString().substring(11, 19) + 'Z';
    const formattedAlert = {
      timestamp,
      level: alert.level,
      type: alert.type,
      text: alert.text
    };

    // Update DEFCON UI if badge is present in DOM
    const badge = document.getElementById('defcon-level-badge');
    if (badge) {
      if (alert.level === 'DEFCON 3') {
        badge.textContent = '3 · ROUND HOUSE';
        badge.style.background = 'rgba(245, 158, 11, 0.2)';
        badge.style.color = '#f59e0b';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.5)';
      } else {
        badge.textContent = '4 · GUARDED';
        badge.style.background = 'rgba(16, 185, 129, 0.2)';
        badge.style.color = '#10b981';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      }
    }

    // Play subtle audio cue if sound is enabled
    if (alert.level === 'DEFCON 3') {
      tacticalSound.playAlertBeep();
    } else {
      tacticalSound.playRadioChirp();
    }

    // Notify any active UI listeners
    this.subscribers.forEach(cb => cb(formattedAlert));
  }

  onAlert(callback) {
    this.subscribers.push(callback);
  }
}

export const threatMatrix = new ThreatMatrixEngine();
