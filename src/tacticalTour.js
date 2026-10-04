/**
 * Project Seraph — Tactical Reconnaissance Tour Engine
 * Orchestrates an automated, cinematic multi-domain demonstration
 * across global flashpoints (Pentagon/DC, Tokyo Bay, San Francisco)
 * with dynamic visual spectrum switching (FLIR, NVG, 3D Photoreal),
 * real-world defense sector highlight, and synchronized voice narration.
 */

import { tacticalSound } from './tacticalSound.js';
import { tacticalThreatGrid } from './tacticalThreatGrid.js';
import { tacticalSitrep } from './tacticalSitrep.js';

export class TacticalTourController {
  constructor({ showToast }) {
    this.showToast = showToast;
    this.isRunning = false;
    this.abortController = null;
    this.btn = null;
  }

  init() {
    this.btn = document.getElementById('tactical-tour-btn');
    if (this.btn) {
      this.btn.addEventListener('click', () => {
        if (this.isRunning) {
          this.stop();
        } else {
          this.start();
        }
      });
    }
  }

  toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  _sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Tour aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  }

  _clickElement(selector) {
    const el = document.querySelector(selector);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    if (this.btn) {
      this.btn.classList.add('running');
      this.btn.innerHTML =
        '<span class="tour-icon" aria-hidden="true">■</span> <span>ABORT TOUR</span>';
      this.btn.title = 'Stop Tactical Recon Tour [M]';
    }

    try {
      // ── Stage 1: Planetary Situation Assessment ──
      this.showToast(
        '[STAGE 1/4] KH-11 KENNAN DOWNLINK · GLOBAL C4ISR SURVEILLANCE',
        4500,
      );
      tacticalSound.playRadioChirp();
      tacticalSitrep.speakAlert(
        'Planetary surveillance online. Global reconnaissance commenced.',
      );
      this._clickElement('#reset-globe-view');
      this._clickElement('.style-btn[data-style="retro"]');
      await this._sleep(5500, signal);

      // ── Stage 2: Washington D.C. // Capital Defense Grid ──
      this.showToast(
        '[STAGE 2/4] SECTOR DC // CAPITAL DEFENSE GRID · PATRIOT PAC-3 & NVG',
        5000,
      );
      tacticalSound.playSonarPing();
      tacticalSitrep.speakAlert(
        'Sector D C. Capital defense grid, Patriot PAC three batteries armed.',
      );
      tacticalThreatGrid.highlightSector('dc');
      this._clickElement('.location-pill[data-location-id="dc"]');
      this._clickElement('.style-btn[data-style="surveillance"]');
      await this._sleep(7500, signal);

      // ── Stage 3: Tokyo Bay // Maritime & Air Telemetry Lock ──
      this.showToast(
        '[STAGE 3/4] SECTOR TOKYO // AEGIS BMD MARITIME SHIELD · FLIR THERMAL',
        5000,
      );
      tacticalSound.playSonarPing();
      tacticalSitrep.speakAlert(
        'Sector Tokyo. Aegis SM six radar lock active.',
      );
      tacticalThreatGrid.highlightSector('tokyo');
      this._clickElement('.location-pill[data-location-id="tokyo"]');
      this._clickElement('.style-btn[data-style="thermal"]');
      await this._sleep(7500, signal);

      // ── Stage 4: San Francisco // Photorealistic 3D Urban Recon ──
      this.showToast(
        '[STAGE 4/4] SECTOR SF // 3D PHOTOREALISTIC TERRAIN · ALL DOMAINS NOMINAL',
        5000,
      );
      tacticalSound.playRadioChirp();
      tacticalSitrep.speakAlert(
        'Sector San Francisco. Photorealistic terrain lock nominal.',
      );
      tacticalThreatGrid.highlightSector('sf');
      this._clickElement('.location-pill[data-location-id="sf"]');
      this._clickElement('.style-btn[data-style="normal"]');
      // Tilt for dramatic oblique urban view
      const tiltBtn = document.getElementById('tilt-map-view');
      if (tiltBtn && tiltBtn.getAttribute('aria-pressed') !== 'true') {
        tiltBtn.click();
      }
      await this._sleep(7500, signal);

      // ── Stage 5: Mission Complete & Restoration ──
      this.showToast(
        'TACTICAL RECON TOUR COMPLETE · OPERATOR CONTROL RESTORED',
        4500,
      );
      tacticalSound.playAlertBeep();
      tacticalSitrep.speakAlert(
        'Reconnaissance tour complete. Seraph Watch standing by.',
      );
      tacticalThreatGrid.resetHighlight();
      this._clickElement('#reset-globe-view');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Tactical tour error:', err);
      }
    } finally {
      this.isRunning = false;
      this.abortController = null;
      tacticalThreatGrid.resetHighlight();
      if (this.btn) {
        this.btn.classList.remove('running');
        this.btn.innerHTML =
          '<span class="tour-icon" aria-hidden="true">▶</span> <span>TACTICAL TOUR</span>';
        this.btn.title = 'Launch Automated Global Tactical Recon Tour [M]';
      }
    }
  }

  stop() {
    if (!this.isRunning) return;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isRunning = false;
    tacticalSitrep.stopBriefing?.();
    tacticalThreatGrid.resetHighlight();
    if (this.btn) {
      this.btn.classList.remove('running');
      this.btn.innerHTML =
        '<span class="tour-icon" aria-hidden="true">▶</span> <span>TACTICAL TOUR</span>';
      this.btn.title = 'Launch Automated Global Tactical Recon Tour [M]';
    }
    this.showToast('TACTICAL TOUR ABORTED · MANUAL OVERRIDE RESTORED', 2500);
    tacticalSound.playRadioChirp();
  }
}
