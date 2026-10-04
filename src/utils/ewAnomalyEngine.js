function isInsideChokepoint(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  // Strait of Hormuz
  if (lat >= 25.5 && lat <= 27.5 && lon >= 55.0 && lon <= 57.5) return true;
  // Bab el-Mandeb / Southern Red Sea
  if (lat >= 12.0 && lat <= 14.5 && lon >= 42.5 && lon <= 44.5) return true;
  // Taiwan Strait
  if (lat >= 22.5 && lat <= 26.0 && lon >= 118.0 && lon <= 122.0) return true;
  // Strait of Malacca
  if (lat >= 1.0 && lat <= 4.5 && lon >= 100.0 && lon <= 104.5) return true;
  return false;
}

function analyzeEwAnomalies(contact) {
  const tags = [];
  let severity = 'NOMINAL';
  let description = 'Kinematic & RF profile nominal';
  let confidence = 0.95;

  if (contact.squawk === '7500') {
    tags.push('SQUAWK_7500_HIJACK');
    severity = 'CRITICAL';
    description = 'UNLAWFUL INTERFERENCE / HIJACK CODE BROADCAST';
  } else if (contact.squawk === '7600') {
    tags.push('SQUAWK_7600_NORDO');
    if (severity !== 'CRITICAL') severity = 'WARNING';
    description = 'LOST COMMUNICATIONS / RADIO FAILURE (NORDO)';
  } else if (contact.squawk === '7700') {
    tags.push('SQUAWK_7700_EMERGENCY');
    if (severity !== 'CRITICAL') severity = 'WARNING';
    description = 'GENERAL IN-FLIGHT EMERGENCY DECLARED';
  }

  // Air Domain Anomalies
  if (contact.domain === 'air') {
    const spd = contact.speedKts ?? contact.speed ?? contact.velocityKts ?? 0;
    const altFt =
      contact.altFt ??
      (contact.altitude
        ? contact.altitude
        : contact.altM
          ? contact.altM * 3.28084
          : 0);

    // Hypersonic Boost-Glide Detection (> Mach 5 / >3300 kts at upper atmosphere)
    if (spd > 3300 || (contact.mach && contact.mach > 5.0)) {
      tags.push('HYPERSONIC_BOOST_GLIDE');
      severity = 'CRITICAL';
      description = `Hypersonic boost-glide kinematic signature (${Math.round(spd)} kts / Mach > 5.0)`;
      confidence = 0.99;
    } else if (contact.category !== 'Military' && spd > 680) {
      tags.push('SUPERSONIC_CIVILIAN_ANOMALY');
      severity = 'CRITICAL';
      description = `Physically impossible civilian ground speed (${spd} kts / Mach > 1.1)`;
      confidence = 0.98;
    }

    if (contact.climbRate && Math.abs(contact.climbRate) > 12e3) {
      tags.push('EXTREME_VERTICAL_ACCEL');
      if (severity === 'NOMINAL') severity = 'WARNING';
      description = `Abnormal vertical velocity: ${contact.climbRate} fpm`;
    }

    // Military IFF Cryptographic Handshake Check
    if (
      contact.category === 'Military' &&
      (contact.iffMode4 === false || contact.iffMode5 === false)
    ) {
      tags.push('MIL_IFF_MODE_DISCREPANCY');
      if (severity === 'NOMINAL') severity = 'WARNING';
      description =
        'Military aircraft lacking secure Mode 4/5 cryptographic reply (Bogey suspect)';
    }
  }

  if (contact.metadata && contact.metadata.Transponder) {
    const rawAlt = contact.altitude;
    if (rawAlt < -500 && contact.domain === 'air') {
      tags.push('GPS_SPOOF_ALTITUDE_DISCREPANCY');
      if (severity !== 'CRITICAL') severity = 'WARNING';
      description = `Negative barometric altitude (${rawAlt} ft) while airborne - GPS spoofing suspect`;
    }
  }

  // Maritime Domain Anomalies & Chokepoint Dark Vessels
  if (contact.domain === 'maritime') {
    const lat = contact.lat ?? contact.latitude ?? 0;
    const lon = contact.lon ?? contact.longitude ?? 0;
    const spd = contact.speedKts ?? contact.speed ?? 0;

    if (
      contact.isDark ||
      contact.aisDisabled ||
      (contact.transponder === false && isInsideChokepoint(lat, lon))
    ) {
      tags.push('DARK_VESSEL_CHOKEPOINT');
      severity = 'CRITICAL';
      description =
        'Dark vessel operating without active AIS transmission in strategic chokepoint';
      confidence = 0.97;
    } else if (contact.category === 'Commercial' && spd > 48) {
      tags.push('AIS_SPOOF_GHOST_VESSEL');
      if (severity !== 'CRITICAL') severity = 'WARNING';
      description = `Commercial surface vessel reporting ${spd} kts (AIS ghost/spoofing candidate)`;
    }
  }

  return {
    contactId: contact.id,
    isAnomaly: tags.length > 0,
    severity,
    tags,
    description,
    confidence,
  };
}
export { analyzeEwAnomalies, isInsideChokepoint };
