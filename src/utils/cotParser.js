import { getStandardIdentity } from './milStd2525.js';
function getCotType(contact) {
  const identity = getStandardIdentity(contact);
  const idChar =
    identity === 'HOSTILE'
      ? 'h'
      : identity === 'FRIEND'
        ? 'f'
        : identity === 'NEUTRAL'
          ? 'n'
          : 'u';
  if (contact.domain === 'air') {
    return contact.category === 'Military'
      ? `a-${idChar}-A-M-F`
      : `a-${idChar}-A-C`;
  }
  if (contact.domain === 'maritime') {
    return contact.category === 'Military'
      ? `a-${idChar}-S-C`
      : `a-${idChar}-S`;
  }
  if (contact.domain === 'space') {
    return `a-${idChar}-P`;
  }
  if (contact.domain === 'cctv') {
    return 'b-m-p-s-p-loc';
  }
  if (contact.domain === 'crisis') {
    return 't-x-e-s';
  }
  return `a-${idChar}-G`;
}
function contactToCotXml(contact) {
  const now = /* @__PURE__ */ new Date();
  const timeStr = now.toISOString();
  const staleStr = new Date(now.getTime() + 10 * 60 * 1e3).toISOString();
  const cotType = getCotType(contact);
  const speedMps = (contact.speed * 0.514444).toFixed(2);
  const hae = (contact.altitude * 0.3048).toFixed(1);
  return `<event version="2.0" uid="${contact.id}" type="${cotType}" time="${timeStr}" start="${timeStr}" stale="${staleStr}" how="m-g">
  <point lat="${contact.lat.toFixed(6)}" lon="${contact.lon.toFixed(6)}" hae="${hae}" ce="25.0" le="10.0"/>
  <detail>
    <contact callsign="${escapeXml(contact.callsign)}" endpoint=""/>
    <track course="${contact.heading.toFixed(1)}" speed="${speedMps}"/>
    <remarks>${escapeXml(contact.name)} [${contact.type}] (${contact.country})</remarks>
  </detail>
</event>`;
}
function exportContactsToCotPackage(contacts) {
  const xmlEvents = contacts.map((c) => contactToCotXml(c)).join('\n');
  return `<?xml version="1.0" standalone="yes"?>
<events>
${xmlEvents}
</events>`;
}
function parseCotXml(xmlString) {
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
      time:
        event.getAttribute('time') || /* @__PURE__ */ new Date().toISOString(),
      start:
        event.getAttribute('start') || /* @__PURE__ */ new Date().toISOString(),
      stale:
        event.getAttribute('stale') || /* @__PURE__ */ new Date().toISOString(),
      how: event.getAttribute('how') || 'm-g',
      lat: parseFloat(point?.getAttribute('lat') || '0'),
      lon: parseFloat(point?.getAttribute('lon') || '0'),
      hae: parseFloat(point?.getAttribute('hae') || '0'),
      ce: parseFloat(point?.getAttribute('ce') || '0'),
      le: parseFloat(point?.getAttribute('le') || '0'),
      callsign: contact?.getAttribute('callsign') || 'UNKNOWN',
      course: track ? parseFloat(track.getAttribute('course') || '0') : void 0,
      speed: track ? parseFloat(track.getAttribute('speed') || '0') : void 0,
      remarks: remarks?.textContent || '',
    };
  } catch (err) {
    console.warn('[CoT Parser] Failed to parse CoT XML:', err);
    return null;
  }
}
function escapeXml(unsafe) {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
export { contactToCotXml, exportContactsToCotPackage, getCotType, parseCotXml };
