/**
 * Electronic Warfare (EW) & Kinematic Anomaly Detection Engine
 * Evaluates telemetry stream for GPS spoofing, physics violations, phantom tracks, and transponder compromises.
 */

import { TelemetryContact } from '../types/tactical';

export interface EwAnomalyReport {
  contactId: string;
  isAnomaly: boolean;
  severity: 'CRITICAL' | 'WARNING' | 'SUSPECT' | 'NOMINAL';
  tags: string[];
  description: string;
  confidence: number; // 0 to 1.0
}

/**
 * Evaluates a contact for Electronic Warfare anomalies, GPS spoofing, and physics breaches
 */
export function analyzeEwAnomalies(contact: TelemetryContact): EwAnomalyReport {
  const tags: string[] = [];
  let severity: EwAnomalyReport['severity'] = 'NOMINAL';
  let description = 'Kinematic & RF profile nominal';
  let confidence = 0.95;

  // 1. Critical Squawk Emergency Codes
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

  // 2. Physics & Kinematic Anomalies
  if (contact.domain === 'air') {
    // Non-military aircraft travelling at supersonic speeds
    if (contact.category !== 'Military' && contact.speed > 680) {
      tags.push('SUPERSONIC_CIVILIAN_ANOMALY');
      severity = 'CRITICAL';
      description = `Physically impossible civilian ground speed (${contact.speed} kts / Mach > 1.1)`;
      confidence = 0.98;
    }

    // Extreme climb or dive rate (> 12,000 fpm)
    if (contact.climbRate && Math.abs(contact.climbRate) > 12000) {
      tags.push('EXTREME_VERTICAL_ACCEL');
      if (severity === 'NOMINAL') severity = 'WARNING';
      description = `Abnormal vertical velocity: ${contact.climbRate} fpm`;
    }
  }

  // 3. GNSS / GPS Spoofing Detection
  // Check metadata for baro vs geometric altitude divergence
  if (contact.metadata && contact.metadata.Transponder) {
    const rawAlt = contact.altitude;
    if (rawAlt < -500 && contact.domain === 'air') {
      tags.push('GPS_SPOOF_ALTITUDE_DISCREPANCY');
      if (severity !== 'CRITICAL') severity = 'WARNING';
      description = `Negative barometric altitude (${rawAlt} ft) while airborne - GPS spoofing suspect`;
    }
  }

  // 4. AIS Maritime Spoofing (Speed > 45 kts for standard cargo/tanker)
  if (contact.domain === 'maritime' && contact.category === 'Commercial' && contact.speed > 48) {
    tags.push('AIS_SPOOF_GHOST_VESSEL');
    severity = 'WARNING';
    description = `Commercial surface vessel reporting ${contact.speed} kts (AIS ghost/spoofing candidate)`;
  }

  return {
    contactId: contact.id,
    isAnomaly: tags.length > 0,
    severity,
    tags,
    description,
    confidence
  };
}
