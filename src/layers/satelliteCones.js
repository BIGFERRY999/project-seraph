/**
 * @module satelliteCones
 * @description Space Domain Awareness (SDA) - Projects optical & SAR reconnaissance
 * sensor ground cones and footprints onto the 3D globe, and computes next overflights.
 */

import * as Cesium from 'cesium';

export class SatelliteConesLayer {
  constructor() {
    this.viewer = null;
    this.isActive = false;
    this.footprintEntities = [];
    this.beamEntities = [];
    this.updateInterval = null;
    this.trackedSatelliteId = null;
    this.defaultHalfAngleDeg = 28; // Standard reconnaissance optical/SAR sensor FOV
  }

  init(viewer) {
    if (!viewer) return;
    this.viewer = viewer;
    if (this.isActive) this.enable(viewer);
  }

  /**
   * Toggle satellite recon sensor footprint cones
   * @param {object} [viewer]
   * @returns {boolean}
   */
  toggle(viewer) {
    if (!this.isActive) {
      return this.enable(viewer);
    } else {
      return this.disable();
    }
  }

  enable(viewer) {
    if (viewer && !this.viewer) this.viewer = viewer;
    this.isActive = true;
    this.renderCones();
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = setInterval(() => {
      if (this.isActive) this.updatePositions();
    }, 4000);
    this._dispatchEvent();
    return true;
  }

  disable() {
    this.isActive = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.clear();
    this._dispatchEvent();
    return false;
  }

  clear() {
    if (!this.viewer || !this.viewer.entities) return;
    this.footprintEntities.forEach((e) => {
      try {
        this.viewer.entities.remove(e);
      } catch {
        // ignore
      }
    });
    this.beamEntities.forEach((e) => {
      try {
        this.viewer.entities.remove(e);
      } catch {
        // ignore
      }
    });
    this.footprintEntities = [];
    this.beamEntities = [];
  }

  /**
   * Calculate ground footprint radius in meters from altitude
   * @param {number} altitudeMeters
   * @param {number} [halfAngleDeg]
   * @returns {number}
   */
  calculateFootprintRadius(
    altitudeMeters,
    halfAngleDeg = this.defaultHalfAngleDeg,
  ) {
    const alt = Math.max(150000, Math.min(36000000, altitudeMeters));
    const rad = (halfAngleDeg * Math.PI) / 180;
    // Approximated tangent ground swath bounded by horizon
    return Math.min(alt * Math.tan(rad), 2500000);
  }

  renderCones() {
    if (!this.viewer || !this.viewer.entities) return;
    this.clear();

    // Query active satellite positions from Cesium entities or global state
    const satelliteEntities = [];
    const all = this.viewer.entities.values;
    for (let i = 0; i < all.length; i++) {
      const ent = all[i];
      if (
        ent.id &&
        (ent.id.startsWith('sat-') ||
          ent.id.startsWith('satellite-') ||
          ent._satrec)
      ) {
        satelliteEntities.push(ent);
      }
    }

    // Limit to key reconnaissance or prominent satellites to preserve 60 FPS
    const targetEntities = satelliteEntities.slice(0, 24);

    targetEntities.forEach((sat, idx) => {
      try {
        const time = this.viewer.clock.currentTime;
        const position = sat.position ? sat.position.getValue(time) : null;
        if (!position) return;

        const cartographic = Cesium.Cartographic.fromCartesian(position);
        if (!cartographic) return;

        const lonDeg = Cesium.Math.toDegrees(cartographic.longitude);
        const latDeg = Cesium.Math.toDegrees(cartographic.latitude);
        const altMeters = cartographic.height;

        const radius = this.calculateFootprintRadius(altMeters);
        const groundPos = Cesium.Cartesian3.fromDegrees(lonDeg, latDeg, 0);

        // Ground footprint ellipse (pure geometry, NO Cesium labels)
        const footprint = this.viewer.entities.add({
          id: `sat-footprint-${sat.id || idx}`,
          position: groundPos,
          ellipse: {
            semiMajorAxis: radius,
            semiMinorAxis: radius,
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.CYAN.withAlpha(0.12),
            ),
            outline: true,
            outlineColor: new Cesium.ColorMaterialProperty(
              Cesium.Color.CYAN.withAlpha(0.65),
            ),
            outlineWidth: 1.5,
          },
        });
        this.footprintEntities.push(footprint);

        // Projected line beam connecting satellite down to ground footprint center
        const beam = this.viewer.entities.add({
          id: `sat-beam-${sat.id || idx}`,
          polyline: {
            positions: [position, groundPos],
            width: 1.5,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.CYAN.withAlpha(0.45),
              dashLength: 16.0,
            }),
          },
        });
        this.beamEntities.push(beam);
      } catch (err) {
        console.warn(
          '[SatelliteCones] Failed to project cone for',
          sat.id,
          err,
        );
      }
    });
  }

  updatePositions() {
    if (!this.isActive || !this.viewer) return;
    this.renderCones();
  }

  _dispatchEvent() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('satellite-cones-toggle', {
          detail: { active: this.isActive },
        }),
      );
    }
  }
}

export const satelliteCones = new SatelliteConesLayer();
