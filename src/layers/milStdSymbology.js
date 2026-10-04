/**
 * @module milStdSymbology
 * @description MIL-STD-2525D / NATO APP-6 Joint Military Tactical Symbology Layer.
 * Renders standard tactical geometric frames:
 * - Hostile: Red Diamond
 * - Friendly: Cyan/Blue Circle (Air) or Rectangle (Surface)
 * - Neutral: Green Square
 * - Unknown: Yellow Arch / Clover
 * Encodes standardized 15-character SIDC (Symbol Identification Code) for multi-domain contacts.
 */

import * as Cesium from 'cesium';

export function getStandardIdentity(contact = {}) {
  if (
    contact.threatLevel === 'CRITICAL' ||
    contact.threatLevel === 'HIGH' ||
    contact.isHostile
  ) {
    return 'HOSTILE';
  }
  if (
    contact.category === 'Military' &&
    (contact.country?.includes('Allied') || contact.affiliation === 'FRIEND')
  ) {
    return 'FRIEND';
  }
  if (contact.category === 'Commercial') {
    return 'NEUTRAL';
  }
  if (contact.threatLevel === 'ELEVATED' || contact.isUnknown) {
    return 'UNKNOWN';
  }
  return contact.affiliation || 'FRIEND';
}

export function generateSIDC(contact = {}, identity = 'FRIEND') {
  const identityCode =
    identity === 'HOSTILE'
      ? '6'
      : identity === 'FRIEND'
        ? '3'
        : identity === 'NEUTRAL'
          ? '4'
          : '1';
  let symbolSet = '01'; // Air default
  if (contact.domain === 'maritime') symbolSet = '30';
  else if (contact.domain === 'space') symbolSet = '05';
  else if (contact.domain === 'ground') symbolSet = '10';
  return `100${identityCode}${symbolSet}00001100000000`;
}

export function generateMilStd2525Svg(
  identity = 'FRIEND',
  domain = 'air',
  isSelected = false,
) {
  const colorMap = {
    HOSTILE: '#ef4444',
    FRIEND: '#38bdf8',
    NEUTRAL: '#22c55e',
    UNKNOWN: '#eab308',
  };
  const color = isSelected ? '#ffffff' : colorMap[identity] || '#38bdf8';
  const fillColor = isSelected
    ? 'rgba(255,255,255,0.25)'
    : identity === 'HOSTILE'
      ? 'rgba(239,68,68,0.2)'
      : 'rgba(56,189,248,0.2)';

  let frameSvg = '';
  if (identity === 'HOSTILE') {
    // Red Diamond
    frameSvg = `<polygon points="24,4 44,24 24,44 4,24" stroke="${color}" stroke-width="2.5" fill="${fillColor}" />`;
  } else if (identity === 'NEUTRAL') {
    // Green Square
    frameSvg = `<rect x="6" y="6" width="36" height="36" stroke="${color}" stroke-width="2.5" fill="${fillColor}" rx="2" />`;
  } else if (identity === 'UNKNOWN') {
    // Yellow Clover / Arch
    frameSvg = `<path d="M 6 36 C 6 12, 42 12, 42 36 Z" stroke="${color}" stroke-width="2.5" fill="${fillColor}" />`;
  } else {
    // Friend: Blue Circle for air, Rectangle for surface
    if (domain === 'air') {
      frameSvg = `<circle cx="24" cy="24" r="18" stroke="${color}" stroke-width="2.5" fill="${fillColor}" />`;
    } else {
      frameSvg = `<rect x="6" y="10" width="36" height="28" stroke="${color}" stroke-width="2.5" fill="${fillColor}" rx="4" />`;
    }
  }

  // Inner Domain Icon
  let iconSvg = '';
  if (domain === 'air') {
    iconSvg = `<polygon points="24,14 32,28 24,24 16,28" fill="${color}" />`;
  } else if (domain === 'maritime') {
    iconSvg = `<path d="M 16,20 L 32,20 L 28,30 L 20,30 Z" fill="${color}" />`;
  } else if (domain === 'space') {
    iconSvg = `<circle cx="24" cy="24" r="3" fill="${color}" /><line x1="14" y1="24" x2="34" y2="24" stroke="${color}" stroke-width="2" />`;
  } else {
    iconSvg = `<circle cx="24" cy="24" r="4" fill="${color}" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">${frameSvg}${iconSvg}</svg>`;
}

export function generateMilStd2525DataUrl(
  identity,
  domain,
  isSelected = false,
) {
  const svg = generateMilStd2525Svg(identity, domain, isSelected);
  if (typeof btoa !== 'undefined') {
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

export class MilStdSymbologyLayer {
  constructor() {
    this.viewer = null;
    this.isActive = false;
    this.entities = new Map();
  }

  init(viewer) {
    this.viewer = viewer;
  }

  toggle(viewer) {
    if (viewer && !this.viewer) this.viewer = viewer;
    this.isActive = !this.isActive;
    this.entities.forEach((ent) => {
      ent.show = this.isActive;
    });
    return this.isActive;
  }

  enable() {
    this.isActive = true;
    this.entities.forEach((ent) => {
      ent.show = true;
    });
  }

  disable() {
    this.isActive = false;
    this.entities.forEach((ent) => {
      ent.show = false;
    });
  }

  upsertContactSymbol(contact, isSelected = false) {
    if (!this.viewer || !contact?.id) return null;

    const identity = getStandardIdentity(contact);
    const domain = contact.domain || 'air';
    const sidc = generateSIDC(contact, identity);
    const dataUrl = generateMilStd2525DataUrl(identity, domain, isSelected);

    const lat = contact.lat ?? contact.latitude ?? 0;
    const lon = contact.lon ?? contact.longitude ?? 0;
    const alt =
      contact.altM ??
      contact.altitudeM ??
      (contact.altFt ? contact.altFt * 0.3048 : 5000);
    const pos = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

    let ent = this.entities.get(contact.id);
    if (!ent) {
      ent = this.viewer.entities.add({
        id: 'mil-sym-' + contact.id,
        position: pos,
        show: this.isActive,
        billboard: {
          image: dataUrl,
          width: 32,
          height: 32,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        },
      });
      ent.__sidc = sidc;
      this.entities.set(contact.id, ent);
    } else {
      ent.position = pos;
      if (ent.billboard) {
        ent.billboard.image = dataUrl;
      }
    }
    return ent;
  }

  removeContactSymbol(contactId) {
    const ent = this.entities.get(contactId);
    if (ent && this.viewer) {
      this.viewer.entities.remove(ent);
      this.entities.delete(contactId);
    }
  }

  clear() {
    if (this.viewer) {
      this.entities.forEach((ent) => {
        this.viewer.entities.remove(ent);
      });
    }
    this.entities.clear();
  }
}

export const milStdSymbology = new MilStdSymbologyLayer();
