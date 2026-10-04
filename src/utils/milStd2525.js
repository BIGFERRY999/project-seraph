import * as THREE from 'three';
function getStandardIdentity(contact) {
  if (contact.threatLevel === 'CRITICAL' || contact.threatLevel === 'HIGH') {
    return 'HOSTILE';
  }
  if (contact.category === 'Military' && contact.country.includes('Allied')) {
    return 'FRIEND';
  }
  if (
    contact.country.includes('NASA') ||
    contact.country.includes('ESA') ||
    contact.category === 'Surveillance'
  ) {
    return 'FRIEND';
  }
  if (contact.category === 'Commercial') {
    return 'NEUTRAL';
  }
  if (contact.threatLevel === 'ELEVATED') {
    return 'UNKNOWN';
  }
  return 'FRIEND';
}
function generateSIDC(contact, identity) {
  const identityCode =
    identity === 'HOSTILE'
      ? '6'
      : identity === 'FRIEND'
        ? '3'
        : identity === 'NEUTRAL'
          ? '4'
          : '1';
  let symbolSet = '01';
  if (contact.domain === 'maritime') symbolSet = '30';
  else if (contact.domain === 'space') symbolSet = '05';
  else if (contact.domain === 'cctv') symbolSet = '15';
  else if (contact.domain === 'crisis') symbolSet = '25';
  return `100${identityCode}${symbolSet}00001100000000`;
}
function resolveMilSymbolConfig(contact) {
  const identity = getStandardIdentity(contact);
  const sidc = generateSIDC(contact, identity);
  switch (identity) {
    case 'HOSTILE':
      return {
        identity,
        domain: contact.domain,
        colorHex: 15680580,
        // Red
        colorStr: '#ef4444',
        frameType: 'diamond',
        sidc,
      };
    case 'FRIEND':
      return {
        identity,
        domain: contact.domain,
        colorHex: 3718648,
        // Cyan/Blue
        colorStr: '#38bdf8',
        frameType: contact.domain === 'air' ? 'circle' : 'rectangle',
        sidc,
      };
    case 'NEUTRAL':
      return {
        identity,
        domain: contact.domain,
        colorHex: 2278750,
        // Green
        colorStr: '#22c55e',
        frameType: 'square',
        sidc,
      };
    case 'UNKNOWN':
    default:
      return {
        identity: 'UNKNOWN',
        domain: contact.domain,
        colorHex: 15381256,
        // Yellow
        colorStr: '#eab308',
        frameType: 'circle',
        sidc,
      };
  }
}
function createMilStd2525Texture(contact, isSelected = false) {
  const config = resolveMilSymbolConfig(contact);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.clearRect(0, 0, 128, 128);
  const cx = 64;
  const cy = 64;
  const size = 42;
  const color = isSelected ? '#ffffff' : config.colorStr;
  ctx.lineWidth = isSelected ? 4 : 3;
  ctx.strokeStyle = color;
  ctx.fillStyle = config.colorStr + (isSelected ? '40' : '22');
  ctx.beginPath();
  if (config.identity === 'HOSTILE') {
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();
  } else if (config.identity === 'NEUTRAL') {
    ctx.rect(cx - size * 0.8, cy - size * 0.8, size * 1.6, size * 1.6);
  } else if (config.identity === 'UNKNOWN') {
    ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
  } else {
    if (contact.domain === 'air') {
      ctx.arc(cx, cy, size * 0.85, Math.PI, 0, false);
      ctx.lineTo(cx + size * 0.85, cy + size * 0.4);
      ctx.lineTo(cx - size * 0.85, cy + size * 0.4);
      ctx.closePath();
    } else {
      ctx.rect(cx - size * 0.9, cy - size * 0.65, size * 1.8, size * 1.3);
    }
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let iconText = '\u2708';
  if (contact.domain === 'maritime') iconText = '\u2693';
  else if (contact.domain === 'space') iconText = '\u{1F6F0}';
  else if (contact.domain === 'cctv') iconText = '\u25C9';
  else if (contact.domain === 'crisis') iconText = '\u25B2';
  ctx.fillText(iconText, cx, cy);
  if (contact.speed > 30) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx, cy - size - 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - size - 14);
    ctx.lineTo(cx + 4, cy - size - 14);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
function calculateVelocityLeaderPositions(
  lat,
  lon,
  headingDeg,
  speedKnots,
  radius,
) {
  const speedMps = speedKnots * 0.514444;
  const dist1Min = speedMps * 60;
  const dist3Min = speedMps * 180;
  const dist5Min = speedMps * 300;
  const projectPoint = (distMeters) => {
    const headingRad = (headingDeg * Math.PI) / 180;
    const deltaLat = (distMeters * Math.cos(headingRad)) / 111139;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const deltaLon =
      (distMeters * Math.sin(headingRad)) /
      (111139 * (Math.abs(cosLat) > 1e-4 ? cosLat : 1));
    const pLat = Math.max(-89.9, Math.min(89.9, lat + deltaLat));
    const pLon = ((lon + deltaLon + 540) % 360) - 180;
    const phi = (90 - pLat) * (Math.PI / 180);
    const theta = (pLon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  };
  return {
    min1: projectPoint(dist1Min),
    min3: projectPoint(dist3Min),
    min5: projectPoint(dist5Min),
  };
}
export {
  calculateVelocityLeaderPositions,
  createMilStd2525Texture,
  generateSIDC,
  getStandardIdentity,
  resolveMilSymbolConfig,
};
