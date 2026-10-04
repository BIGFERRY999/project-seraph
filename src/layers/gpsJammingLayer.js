/**
 * @module gpsJammingLayer
 * @description Electronic Warfare (EW) & GPS Denial / Jamming Visualization.
 * Highlights areas with severe GNSS interference and degraded transponder telemetry.
 */

import * as Cesium from 'cesium';

export const EW_HOTSPOTS = [
  {
    id: 'ew-black-sea',
    name: 'BLACK SEA / CRIMEA EW SECTOR',
    lat: 44.8,
    lon: 34.5,
    radius: 380000,
    intensity: 'HIGH',
    jammingType: 'GNSS SPOOFING & MEACONING',
    color: '#ef4444',
  },
  {
    id: 'ew-baltic',
    name: 'BALTIC SEA / KALININGRAD CORRIDOR',
    lat: 54.9,
    lon: 20.2,
    radius: 260000,
    intensity: 'CRITICAL',
    jammingType: 'WIDEBAND L1/L2 NOISE JAMMING',
    color: '#f97316',
  },
  {
    id: 'ew-levant',
    name: 'EASTERN MEDITERRANEAN / LEVANT',
    lat: 33.5,
    lon: 35.3,
    radius: 290000,
    intensity: 'CRITICAL',
    jammingType: 'CONTINUOUS HIGH-POWER GNSS DENIAL',
    color: '#ef4444',
  },
  {
    id: 'ew-persian-gulf',
    name: 'PERSIAN GULF / HORMUZ APPROACH',
    lat: 26.2,
    lon: 56.1,
    radius: 220000,
    intensity: 'ELEVATED',
    jammingType: 'INTERMITTENT AIS/GPS SPOOFING',
    color: '#eab308',
  },
  {
    id: 'ew-korea-dmz',
    name: 'KOREAN PENINSULA / DMZ BORDER',
    lat: 38.0,
    lon: 126.8,
    radius: 170000,
    intensity: 'HIGH',
    jammingType: 'TARGETED PULSED GPS INTERFERENCE',
    color: '#f97316',
  },
  {
    id: 'ew-myanmar',
    name: 'NORTHERN MYANMAR BORDER CORRIDOR',
    lat: 23.8,
    lon: 98.6,
    radius: 190000,
    intensity: 'ELEVATED',
    jammingType: 'LOCALIZED ELECTRONIC COUNTERMEASURES',
    color: '#eab308',
  },
];

export class GpsJammingLayer {
  constructor() {
    this.viewer = null;
    this.isActive = false;
    this.entities = [];
  }

  init(viewer) {
    if (!viewer) return;
    this.viewer = viewer;
    if (this.isActive) this.render();
  }

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
    this.render();
    this._dispatchEvent();
    return true;
  }

  disable() {
    this.isActive = false;
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

  render() {
    if (!this.viewer || !this.viewer.entities) return;
    this.clear();

    EW_HOTSPOTS.forEach((spot) => {
      const color = Cesium.Color.fromCssColorString(spot.color);
      const center = Cesium.Cartesian3.fromDegrees(spot.lon, spot.lat, 0);

      // 1. Semi-transparent volumetric threat cylinder / dome
      const dome = this.viewer.entities.add({
        id: `ew-dome-${spot.id}`,
        position: center,
        cylinder: {
          length: 18000,
          topRadius: spot.radius * 0.85,
          bottomRadius: spot.radius,
          material: new Cesium.ColorMaterialProperty(color.withAlpha(0.14)),
          outline: true,
          outlineColor: new Cesium.ColorMaterialProperty(color.withAlpha(0.6)),
          outlineWidth: 2,
        },
      });
      this.entities.push(dome);

      // 2. Pulsing ground perimeter ring
      const groundRing = this.viewer.entities.add({
        id: `ew-ring-${spot.id}`,
        position: center,
        ellipse: {
          semiMajorAxis: spot.radius,
          semiMinorAxis: spot.radius,
          material: new Cesium.ColorMaterialProperty(color.withAlpha(0.06)),
          outline: true,
          outlineColor: new Cesium.ColorMaterialProperty(color.withAlpha(0.85)),
          outlineWidth: 2.5,
        },
      });
      this.entities.push(groundRing);

      // 3. Tactical Beacon Point (No Cesium canvas labels)
      const beacon = this.viewer.entities.add({
        id: `ew-beacon-${spot.id}`,
        position: Cesium.Cartesian3.fromDegrees(spot.lon, spot.lat, 22000),
        point: {
          pixelSize: 8,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      this.entities.push(beacon);
    });
  }

  getActiveSectors() {
    return EW_HOTSPOTS;
  }

  _dispatchEvent() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gps-jamming-toggle', {
          detail: { active: this.isActive, count: EW_HOTSPOTS.length },
        }),
      );
    }
  }
}

export const gpsJammingLayer = new GpsJammingLayer();
