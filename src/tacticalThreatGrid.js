/**
 * Project Seraph — Tactical Threat & Radar Coverage Grid Engine
 * Renders 3D geodesic early-warning radar coverage envelopes,
 * surface-to-air missile (SAM) intercept domes, and concentric range rings
 * across strategic defense sectors in real time.
 */

import * as Cesium from 'cesium';
import { tacticalSound } from './tacticalSound.js';
import { AIR_DEFENSE_SYSTEMS } from './utils/airDefenseCatalog.js';

export const STRATEGIC_SECTORS = [
  {
    id: 'dc',
    name: 'CAPITAL DEFENSE GRID // MIM-104 PATRIOT PAC-3 MSE',
    shortCode: 'DEF-SECTOR 01 [DC]',
    lat: 38.8719,
    lon: -77.0563,
    radius: 160000,
    system: AIR_DEFENSE_SYSTEMS.PATRIOT,
    radarRangeM: 240000,
    engagementRangeM: 160000,
    maxAltitudeM: 24200,
    affiliation: 'FRIEND',
    color: '#10b981',
    status: 'ACTIVE · LAYERED IAMD RADAR & WEZ ENVELOPE',
  },
  {
    id: 'tokyo',
    name: 'PACIFIC MARITIME SHIELD // AEGIS BMD (RIM-174 SM-6)',
    shortCode: 'DEF-SECTOR 02 [TYO]',
    lat: 35.281,
    lon: 139.673,
    radius: 240000,
    system: AIR_DEFENSE_SYSTEMS.AEGIS_SM6,
    radarRangeM: 370000,
    engagementRangeM: 240000,
    maxAltitudeM: 34000,
    affiliation: 'FRIEND',
    color: '#00f0ff',
    status: 'ACTIVE · STRATEGIC BALLISTIC MISSILE DEFENSE LOCK',
  },
  {
    id: 'sf',
    name: 'WEST COAST AIR RECON // NORAD SECTOR 12 (PATRIOT PAC-3)',
    shortCode: 'DEF-SECTOR 03 [SFO]',
    lat: 37.7749,
    lon: -122.4194,
    radius: 160000,
    system: AIR_DEFENSE_SYSTEMS.PATRIOT,
    radarRangeM: 240000,
    engagementRangeM: 160000,
    maxAltitudeM: 24200,
    affiliation: 'FRIEND',
    color: '#38bdf8',
    status: 'ACTIVE · MULTI-DOMAIN AIR RECON & SAM GRID',
  },
  {
    id: 'austin',
    name: 'STRATCOM HQ LINK // AUSTIN AIR DEFENSE BATTERY',
    shortCode: 'DEF-SECTOR 04 [ATX]',
    lat: 30.2672,
    lon: -97.7431,
    radius: 160000,
    system: AIR_DEFENSE_SYSTEMS.PATRIOT,
    radarRangeM: 240000,
    engagementRangeM: 160000,
    maxAltitudeM: 24200,
    affiliation: 'FRIEND',
    color: '#3b82f6',
    status: 'ACTIVE · HOMELAND DEFENSE SECURE UPLINK',
  },
  {
    id: 'hormuz',
    name: 'STRAIT OF HORMUZ // 5TH FLEET AEGIS SM-6 TASK FORCE',
    shortCode: 'DEF-SECTOR 05 [HRM]',
    lat: 26.5667,
    lon: 56.25,
    radius: 240000,
    system: AIR_DEFENSE_SYSTEMS.AEGIS_SM6,
    radarRangeM: 370000,
    engagementRangeM: 240000,
    maxAltitudeM: 34000,
    affiliation: 'FRIEND',
    color: '#f59e0b',
    status: 'ACTIVE · CHOKEPOINT AIR & SURFACE INTERDICTION',
  },
  {
    id: 'redsea',
    name: 'BAB EL-MANDEB // USS CARNEY (DDG-64) AEGIS SM-6',
    shortCode: 'DEF-SECTOR 06 [BAM]',
    lat: 12.5833,
    lon: 43.3333,
    radius: 240000,
    system: AIR_DEFENSE_SYSTEMS.AEGIS_SM6,
    radarRangeM: 370000,
    engagementRangeM: 240000,
    maxAltitudeM: 34000,
    affiliation: 'FRIEND',
    color: '#ef4444',
    status: 'ACTIVE · COMBAT MARITIME WEZ INTERCEPTION',
  },
  {
    id: 'taiwan',
    name: 'TAIWAN STRAIT // PATRIOT PAC-3 & TIEN KUNG III ADIZ',
    shortCode: 'DEF-SECTOR 07 [TPE]',
    lat: 24.2,
    lon: 119.5,
    radius: 200000,
    system: AIR_DEFENSE_SYSTEMS.PATRIOT,
    radarRangeM: 280000,
    engagementRangeM: 200000,
    maxAltitudeM: 28000,
    affiliation: 'FRIEND',
    color: '#ec4899',
    status: 'ACTIVE · AIR & NAVAL IDENTIFICATION ZONE',
  },
  {
    id: 'baltic',
    name: 'BALTIC CORRIDOR // KALININGRAD BASTION S-400 & SUWALKI GAP',
    shortCode: 'DEF-SECTOR 08 [BAL]',
    lat: 54.2,
    lon: 23.3,
    radius: 380000,
    system: AIR_DEFENSE_SYSTEMS.S400,
    radarRangeM: 600000,
    engagementRangeM: 380000,
    maxAltitudeM: 30000,
    affiliation: 'HOSTILE',
    color: '#8b5cf6',
    status: 'ACTIVE · STRATEGIC S-400 A2/AD & NATO IAMD',
  },
];

class TacticalThreatGrid {
  constructor() {
    this.viewer = null;
    this.isActive = true;
    this.entities = [];
    this.activeSectorId = null;
    this._sectorIndex = -1;
  }

  init(viewer) {
    if (!viewer || this.viewer) return;
    this.viewer = viewer;
    this._buildGrid();
  }

  _buildGrid() {
    if (!this.viewer) return;

    STRATEGIC_SECTORS.forEach((sec) => {
      const center = Cesium.Cartesian3.fromDegrees(sec.lon, sec.lat, 0);
      const cesiumColor = Cesium.Color.fromCssColorString(sec.color);
      const radarR = sec.radarRangeM || sec.radius * 1.5;
      const wezR = sec.engagementRangeM || sec.radius;
      const deadR = (sec.system?.minRangeKm || 3) * 1000;
      const altMax = sec.maxAltitudeM || 24000;

      // 1. 3D Kinematic Intercept Dome (Physical Missile Ceiling & Envelope)
      const dome = this.viewer.entities.add({
        id: 'radar-dome-' + sec.id,
        name: sec.name,
        position: center,
        show: this.isActive,
        ellipsoid: {
          radii: new Cesium.Cartesian3(wezR, wezR, altMax),
          maximumCone: Cesium.Math.toRadians(90),
          material: new Cesium.ColorMaterialProperty(
            cesiumColor.withAlpha(0.1),
          ),
          outline: true,
          outlineColor: new Cesium.ColorMaterialProperty(
            cesiumColor.withAlpha(0.6),
          ),
          outlineWidth: 1.5,
        },
      });
      this.entities.push(dome);

      // 2. Outer Surveillance & Early Warning Radar Acquisition Ring
      const radarRing = this.viewer.entities.add({
        id: 'radar-ring-' + sec.id + '-acq',
        name: `${sec.shortCode} Radar Acquisition Envelope (${Math.round(radarR / 1000)} km)`,
        position: center,
        show: this.isActive,
        ellipse: {
          semiMajorAxis: radarR,
          semiMinorAxis: radarR,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.TRANSPARENT),
          outline: true,
          outlineColor: new Cesium.ColorMaterialProperty(
            cesiumColor.withAlpha(0.35),
          ),
          outlineWidth: 1.5,
          height: 10,
        },
      });
      this.entities.push(radarRing);

      // 3. Lethal Weapon Engagement Zone (WEZ / SAM Kill Ring)
      const wezRing = this.viewer.entities.add({
        id: 'radar-ring-' + sec.id + '-wez',
        name: `${sec.shortCode} Lethal Intercept WEZ (${Math.round(wezR / 1000)} km)`,
        position: center,
        show: this.isActive,
        ellipse: {
          semiMajorAxis: wezR,
          semiMinorAxis: wezR,
          material: new Cesium.ColorMaterialProperty(
            cesiumColor.withAlpha(0.06),
          ),
          outline: true,
          outlineColor: new Cesium.ColorMaterialProperty(
            cesiumColor.withAlpha(0.85),
          ),
          outlineWidth: 2.5,
          height: 10,
        },
      });
      this.entities.push(wezRing);

      // 4. Minimum Range / Blind Zone Dead Ring
      const deadZoneRing = this.viewer.entities.add({
        id: 'radar-ring-' + sec.id + '-dead',
        name: `${sec.shortCode} Minimum Dead Zone (${Math.round(deadR / 1000)} km)`,
        position: center,
        show: this.isActive,
        ellipse: {
          semiMajorAxis: deadR,
          semiMinorAxis: deadR,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.RED.withAlpha(0.15),
          ),
          outline: true,
          outlineColor: new Cesium.ColorMaterialProperty(
            Cesium.Color.RED.withAlpha(0.65),
          ),
          outlineWidth: 1.5,
          height: 10,
        },
      });
      this.entities.push(deadZoneRing);

      // 5. Tactical HUD Apex Beacon
      const labelPos = Cesium.Cartesian3.fromDegrees(
        sec.lon,
        sec.lat,
        altMax + 1500,
      );
      const beacon = this.viewer.entities.add({
        id: 'radar-beacon-' + sec.id,
        position: labelPos,
        show: this.isActive,
        point: {
          pixelSize: 6,
          color: cesiumColor,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      this.entities.push(beacon);
    });

    console.info(
      '[TacticalThreatGrid] Initialized ' +
        STRATEGIC_SECTORS.length +
        ' strategic IAMD air defense batteries.',
    );
  }

  toggle() {
    this.isActive = !this.isActive;
    this.entities.forEach((e) => {
      e.show = this.isActive;
    });
    return this.isActive;
  }

  enable() {
    this.isActive = true;
    this.entities.forEach((e) => {
      e.show = true;
    });
  }

  disable() {
    this.isActive = false;
    this.entities.forEach((e) => {
      e.show = false;
    });
  }

  highlightSector(sectorId) {
    this.activeSectorId = sectorId;
    if (!this.isActive) this.enable();

    STRATEGIC_SECTORS.forEach((sec) => {
      const dome =
        this.viewer && this.viewer.entities.getById('radar-dome-' + sec.id);
      if (dome && dome.ellipsoid) {
        const isTarget = sec.id === sectorId;
        const color = Cesium.Color.fromCssColorString(sec.color);
        dome.ellipsoid.material = new Cesium.ColorMaterialProperty(
          isTarget ? color.withAlpha(0.24) : color.withAlpha(0.08),
        );
        dome.ellipsoid.outlineColor = new Cesium.ColorMaterialProperty(
          isTarget ? color.withAlpha(0.85) : color.withAlpha(0.35),
        );
      }
    });
  }

  resetHighlight() {
    this.activeSectorId = null;
    STRATEGIC_SECTORS.forEach((sec) => {
      const dome =
        this.viewer && this.viewer.entities.getById('radar-dome-' + sec.id);
      if (dome && dome.ellipsoid) {
        const color = Cesium.Color.fromCssColorString(sec.color);
        dome.ellipsoid.material = new Cesium.ColorMaterialProperty(
          color.withAlpha(0.12),
        );
        dome.ellipsoid.outlineColor = new Cesium.ColorMaterialProperty(
          color.withAlpha(0.55),
        );
      }
    });
  }

  getSectors() {
    return [...STRATEGIC_SECTORS];
  }

  flyToSector(sectorId, duration = 2.0) {
    const sector = STRATEGIC_SECTORS.find((s) => s.id === sectorId);
    if (!sector || !this.viewer) return null;

    this.highlightSector(sectorId);
    try {
      tacticalSound.playRadioChirp?.();
    } catch {
      // AudioContext policy
    }

    const targetHeight = Math.max(sector.radius * 2.8, 350000);
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        sector.lon,
        sector.lat,
        targetHeight,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-55),
        roll: 0.0,
      },
      duration,
    });
    return sector;
  }

  cycleNextSector() {
    this._sectorIndex = (this._sectorIndex + 1) % STRATEGIC_SECTORS.length;
    const sector = STRATEGIC_SECTORS[this._sectorIndex];
    this.flyToSector(sector.id);
    return sector;
  }
}

export const tacticalThreatGrid = new TacticalThreatGrid();
