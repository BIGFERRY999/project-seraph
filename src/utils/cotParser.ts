/**
 * Cursor-on-Target (CoT) XML Parser & Serializer (Schema 2.0)
 * Provides seamless bidirectional interoperability with ATAK, WinTAK, and military TAK servers.
 */

import { TelemetryContact } from '../types/tactical';
import { getStandardIdentity } from './milStd2525.js';

export interface CotEvent {
  uid: string;
  type: string;
  time: string;
  start: string;
  stale: string;
  how: string;
  lat: number;
  lon: number;
  hae: number; // Height Above Ellipsoid (meters)
  ce: number;  // Circular Error (meters)
  le: number;  // Linear Error (meters)
  callsign: string;
  course?: number;
  speed?: number; // m/s
  remarks?: string;
}

/**
 * Maps Helios C2 domain and identity to standard MIL-STD-2525 / CoT atom string
 * e.g., 'a-h-A-M-F' (Atom - Hostile - Air - Military - Fixed-wing)
 */
export function getCotType(contact: TelemetryContact): string {
  const identity = getStandardIdentity(contact);
  const idChar = identity === 'HOSTILE' ? 'h' : identity === 'FRIEND' ? 'f' : identity === 'NEUTRAL' ? 'n' : 'u';

  if (contact.domain === 'air') {
    return contact.category === 'Military' ? `a-${idChar}-A-M-F` : `a-${idChar}-A-C`;
  }
  if (contact.domain === 'maritime') {
    return contact.category === 'Military' ? `a-${idChar}-S-C` : `a-${idChar}-S`;
  }
  if (contact.domain === 'space') {
    return `a-${idChar}-P`;
  }
  if (contact.domain === 'cctv') {
    return 'b-m-p-s-p-loc'; // Sensor observation post
  }
  if (contact.domain === 'crisis') {
    return 't-x-e-s'; // Incident / seismic event
  }
  return `a-${idChar}-G`;
}

/**
 * Converts a TelemetryContact into a standard Cursor-on-Target (CoT) XML string
 */
export function contactToCotXml(contact: TelemetryContact): string {
  const now = new Date();
  const timeStr = now.toISOString();
  const staleStr = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes stale
  const cotType = getCotType(contact);

  // Speed in m/s (1 knot = 0.514444 m/s)
  const speedMps = (contact.speed * 0.514444).toFixed(2);
  const hae = (contact.altitude * 0.3048).toFixed(1); // Feet to meters if applicable

  return `<event version="2.0" uid="${contact.id}" type="${cotType}" time="${timeStr}" start="${timeStr}" stale="${staleStr}" how="m-g">
  <point lat="${contact.lat.toFixed(6)}" lon="${contact.lon.toFixed(6)}" hae="${hae}" ce="25.0" le="10.0"/>
  <detail>
    <contact callsign="${escapeXml(contact.callsign)}" endpoint=""/>
    <track course="${contact.heading.toFixed(1)}" speed="${speedMps}"/>
    <remarks>${escapeXml(contact.name)} [${contact.type}] (${contact.country})</remarks>
  </detail>
</event>`;
}

/**
 * Batch exports all active tactical contacts as a unified CoT package
 */
export function exportContactsToCotPackage(contacts: TelemetryContact[]): string {
  const xmlEvents = contacts.map(c => contactToCotXml(c)).join('\n');
  return `<?xml version="1.0" standalone="yes"?>\n<events>\n${xmlEvents}\n</events>`;
}

/**
 * Parses a CoT XML string into a CotEvent object
 */
export function parseCotXml(xmlString: string): CotEvent | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const event = doc.querySelector('event');
    if (!event) return null;

    const point = event.querySelector('point');
    const track = event.querySelector('track');
    const contact = event.querySelector('contact');
    const remarks = event.querySelector('remarks');

    return {
      uid: event.getAttribute('uid') || `cot-${Date.now()}`,
      type: event.getAttribute('type') || 'a-u-G',
      time: event.getAttribute('time') || new Date().toISOString(),
      start: event.getAttribute('start') || new Date().toISOString(),
      stale: event.getAttribute('stale') || new Date().toISOString(),
      how: event.getAttribute('how') || 'm-g',
      lat: parseFloat(point?.getAttribute('lat') || '0'),
      lon: parseFloat(point?.getAttribute('lon') || '0'),
      hae: parseFloat(point?.getAttribute('hae') || '0'),
      ce: parseFloat(point?.getAttribute('ce') || '0'),
      le: parseFloat(point?.getAttribute('le') || '0'),
      callsign: contact?.getAttribute('callsign') || 'UNKNOWN',
      course: track ? parseFloat(track.getAttribute('course') || '0') : undefined,
      speed: track ? parseFloat(track.getAttribute('speed') || '0') : undefined,
      remarks: remarks?.textContent || ''
    };
  } catch (err) {
    console.warn('[CoT Parser] Failed to parse CoT XML:', err);
    return null;
  }
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
