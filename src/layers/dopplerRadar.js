/**
 * @module dopplerRadar
 * @description Live composite Doppler Weather Radar layer using RainViewer public API.
 * Projects real-time animated precipitation and storm clouds over the 3D globe.
 */

import * as Cesium from 'cesium';

export class DopplerRadarLayer {
  constructor() {
    this.viewer = null;
    this.isActive = false;
    this.frames = [];
    this.currentFrameIndex = 0;
    this.imageryLayers = [];
    this.animationTimer = null;
    this.isPlaying = true;
    this.frameIntervalMs = 1200;
    this.opacity = 0.72;
    this.host = 'https://tilecache.rainviewer.com';
    this.isLoading = false;
    this.lastFetched = 0;
  }

  /**
   * Fetch current radar frames from RainViewer API
   * @returns {Promise<Array<{time: number, path: string}>>}
   */
  async fetchRadarMetadata() {
    try {
      const resp = await fetch(
        'https://api.rainviewer.com/public/weather-maps.json',
      );
      if (!resp.ok) throw new Error(`RainViewer API returned ${resp.status}`);
      const data = await resp.json();
      this.host = data.host || 'https://tilecache.rainviewer.com';
      const past = Array.isArray(data.radar?.past) ? data.radar.past : [];
      const nowcast = Array.isArray(data.radar?.nowcast)
        ? data.radar.nowcast
        : [];
      this.frames = [...past.slice(-6), ...nowcast.slice(0, 3)];
      this.lastFetched = Date.now();
      return this.frames;
    } catch (err) {
      console.warn(
        '[DopplerRadar] Fallback to synthetic radar sequence:',
        err.message,
      );
      const now = Math.floor(Date.now() / 600000) * 600;
      this.frames = [
        { time: now - 1800, path: `/v2/radar/${now - 1800}` },
        { time: now - 1200, path: `/v2/radar/${now - 1200}` },
        { time: now - 600, path: `/v2/radar/${now - 600}` },
        { time: now, path: `/v2/radar/${now}` },
      ];
      return this.frames;
    }
  }

  /**
   * Initialize and attach radar imagery layers to the Cesium viewer
   * @param {object} viewer Cesium.Viewer instance
   */
  async init(viewer) {
    if (!viewer) return;
    this.viewer = viewer;
    if (this.frames.length === 0) {
      await this.fetchRadarMetadata();
    }
    this._buildImageryLayers();
    if (this.isActive) {
      await this.enable(viewer);
    }
  }

  _buildImageryLayers() {
    if (!this.viewer || !this.viewer.imageryLayers) return;

    this.clearLayers();

    if (this.frames.length === 0) return;

    this.frames.forEach((frame, idx) => {
      try {
        const provider = new Cesium.UrlTemplateImageryProvider({
          url: `${this.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
          maximumLevel: 8,
          credit: 'RainViewer Radar',
        });
        const layer = this.viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha =
          idx === this.currentFrameIndex && this.isActive ? this.opacity : 0.0;
        layer.show = this.isActive;
        this.imageryLayers.push(layer);
      } catch (e) {
        console.warn('[DopplerRadar] Error adding frame layer:', e);
      }
    });

    this.currentFrameIndex = Math.max(0, this.imageryLayers.length - 1);
    this._updateFrameVisibility();
  }

  _updateFrameVisibility() {
    if (!this.imageryLayers.length) return;
    this.imageryLayers.forEach((layer, idx) => {
      if (idx === this.currentFrameIndex) {
        layer.alpha = this.isActive ? this.opacity : 0.0;
        layer.show = this.isActive;
      } else {
        layer.alpha = 0.0;
        layer.show = false;
      }
    });
  }

  nextFrame() {
    if (!this.imageryLayers.length) return;
    this.currentFrameIndex =
      (this.currentFrameIndex + 1) % this.imageryLayers.length;
    this._updateFrameVisibility();
    this._notifyFrameChange();
  }

  prevFrame() {
    if (!this.imageryLayers.length) return;
    this.currentFrameIndex =
      (this.currentFrameIndex - 1 + this.imageryLayers.length) %
      this.imageryLayers.length;
    this._updateFrameVisibility();
    this._notifyFrameChange();
  }

  startAnimation() {
    this.stopAnimation();
    this.isPlaying = true;
    this.animationTimer = setInterval(() => {
      this.nextFrame();
    }, this.frameIntervalMs);
  }

  stopAnimation() {
    this.isPlaying = false;
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  async toggle(viewer) {
    if (!this.isActive) {
      return await this.enable(viewer);
    } else {
      return this.disable();
    }
  }

  async enable(viewer) {
    if (viewer && !this.viewer) this.viewer = viewer;
    this.isActive = true;
    if (
      this.imageryLayers.length === 0 ||
      Date.now() - this.lastFetched > 600000
    ) {
      await this.init(this.viewer);
    }
    this._updateFrameVisibility();
    this.startAnimation();
    this._dispatchStateEvent();
    return true;
  }

  disable() {
    this.isActive = false;
    this.stopAnimation();
    this.imageryLayers.forEach((layer) => {
      layer.alpha = 0.0;
      layer.show = false;
    });
    this._dispatchStateEvent();
    return false;
  }

  setOpacity(val) {
    this.opacity = Math.max(0.1, Math.min(1.0, val));
    if (this.isActive) this._updateFrameVisibility();
  }

  clearLayers() {
    if (!this.viewer || !this.viewer.imageryLayers) return;
    this.imageryLayers.forEach((layer) => {
      try {
        this.viewer.imageryLayers.remove(layer, true);
      } catch {
        // ignore
      }
    });
    this.imageryLayers = [];
  }

  _notifyFrameChange() {
    const frame = this.frames[this.currentFrameIndex];
    if (frame && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('doppler-radar-frame', {
          detail: {
            index: this.currentFrameIndex,
            total: this.frames.length,
            time: frame.time,
            dateStr: new Date(frame.time * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        }),
      );
    }
  }

  _dispatchStateEvent() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('doppler-radar-toggle', {
          detail: { active: this.isActive },
        }),
      );
    }
  }
}

export const dopplerRadar = new DopplerRadarLayer();
