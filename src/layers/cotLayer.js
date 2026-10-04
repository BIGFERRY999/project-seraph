/**
 * @module cotLayer
 * @description Cursor-on-Target (CoT) and ATAK/WinTAK live tactical data link.
 * Renders Blue Force Tracking (BFT), hostile tracks, and field pins using MIL-STD-2525 aesthetics.
 */

import * as Cesium from 'cesium';

export const AFFILIATION_COLORS = {
  friendly: '#3b82f6', // Cyan/Blue
  hostile: '#ef4444', // Red
  neutral: '#10b981', // Green
  unknown: '#f59e0b', // Amber
};

export class CotLayer {
  constructor() {
    this.viewer = null;
    this.isActive = false;
    this.entities = [];
    this.pollInterval = null;
    this.events = [];
  }

  init(viewer) {
    if (!viewer) return;
    this.viewer = viewer;
    if (this.isActive) this.enable(viewer);
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
    await this.fetchAndRender();
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      if (this.isActive) this.fetchAndRender();
    }, 5000);
    this._dispatchEvent();
    return true;
  }

  disable() {
    this.isActive = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.clear();
    this._dispatchEvent();
    return false;
  }

  clear() {
    if (!this.viewer || !this.viewer.entities) return;
    this.entities.forEach((e) => {
      try {
        this.viewer.entities.remove(e);
      } catch {
        // ignore
      }
    });
    this.entities = [];
  }

  async fetchAndRender() {
    if (!this.viewer || !window.Cesium) return;
    try {
      const resp = await fetch('/api/cot/injected');
      if (!resp.ok) return;
      const data = await resp.json();
      this.events = Array.isArray(data.events) ? data.events : [];
    } catch {
      if (this.events.length === 0) {
        let liveEntities = [];
        if (
          typeof window !== 'undefined' &&
          window.__gevContextStore?.entities
        ) {
          liveEntities = Array.from(window.__gevContextStore.entities.values());
        }
        const militaryOrAnomalies = liveEntities.filter(
          (e) =>
            e.category === 'Military' ||
            e.domain === 'military' ||
            e.isAnomaly ||
            e.squawk === '7500' ||
            e.squawk === '7700',
        );
        const sourceContacts =
          militaryOrAnomalies.length > 0
            ? militaryOrAnomalies
            : liveEntities.slice(0, 15);
        if (sourceContacts.length > 0) {
          this.events = sourceContacts.map((c, i) => {
            const isHostile =
              c.isAnomaly ||
              c.squawk === '7500' ||
              c.threatLevel === 'CRITICAL';
            return {
              uid: `cot-${c.id || i}`,
              callsign: c.callsign || c.label || c.id || `CONTACT-${i}`,
              lat: c.latitude ?? c.lat ?? 0,
              lon: c.longitude ?? c.lon ?? 0,
              hae: c.altitude ?? c.altM ?? 1500,
              type: isHostile
                ? 'a-h-A'
                : c.domain === 'maritime'
                  ? 'a-f-S'
                  : 'a-f-A',
              affiliation: isHostile ? 'hostile' : 'friendly',
            };
          });
        } else {
          this.events = [
            {
              uid: 'cot-recon-1',
              callsign: 'RECON-ALPHA',
              lat: 38.87,
              lon: -77.05,
              type: 'a-f-G',
              affiliation: 'friendly',
            },
            {
              uid: 'cot-recon-2',
              callsign: 'VIPER-01',
              lat: 35.28,
              lon: 139.67,
              type: 'a-f-A',
              affiliation: 'friendly',
            },
            {
              uid: 'cot-hostile-1',
              callsign: 'UNAUTH-BOGEY',
              lat: 26.56,
              lon: 56.25,
              type: 'a-h-A',
              affiliation: 'hostile',
            },
          ];
        }
      }
    }
    this.render();
  }

  render() {
    if (!this.viewer || !this.viewer.entities) return;
    this.clear();

    this.events.forEach((evt) => {
      const lat = parseFloat(evt.lat);
      const lon = parseFloat(evt.lon);
      if (isNaN(lat) || isNaN(lon)) return;

      const affiliation =
        evt.affiliation ||
        (evt.type && evt.type.includes('-h-') ? 'hostile' : 'friendly');
      const hexColor =
        AFFILIATION_COLORS[affiliation] || AFFILIATION_COLORS.friendly;
      const color = Cesium.Color.fromCssColorString(hexColor);
      const position = Cesium.Cartesian3.fromDegrees(
        lon,
        lat,
        (evt.hae || 500) + 100,
      );

      // Beacon Point Primitive (Adheres strictly to noCesiumLabels)
      const entity = this.viewer.entities.add({
        id: `cot-entity-${evt.uid}`,
        position,
        point: {
          pixelSize: 10,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        ellipse: {
          semiMajorAxis: 3000,
          semiMinorAxis: 3000,
          material: new Cesium.ColorMaterialProperty(color.withAlpha(0.18)),
          outline: true,
          outlineColor: new Cesium.ColorMaterialProperty(color.withAlpha(0.7)),
          outlineWidth: 1.5,
        },
      });
      entity._cotData = evt;
      this.entities.push(entity);
    });
  }

  /**
   * Broadcast a new tactical point to ATAK / TAK Server
   * @param {number} lat
   * @param {number} lon
   * @param {string} callsign
   * @param {'friendly'|'hostile'|'neutral'|'unknown'} affiliation
   */
  async injectMarker(lat, lon, callsign, affiliation = 'friendly') {
    const payload = {
      uid: `helio-${Date.now()}`,
      callsign: callsign || 'TACTICAL-PIN',
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      hae: 100,
      affiliation,
      type: affiliation === 'hostile' ? 'a-h-G' : 'a-f-G',
    };

    try {
      await fetch('/api/cot/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await this.fetchAndRender();
      return true;
    } catch (e) {
      console.warn('[CotLayer] Error injecting marker:', e);
      return false;
    }
  }

  _dispatchEvent() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cot-layer-toggle', {
          detail: { active: this.isActive, count: this.entities.length },
        }),
      );
    }
  }
}

export const cotLayer = new CotLayer();
