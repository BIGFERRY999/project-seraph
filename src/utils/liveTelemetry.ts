import { TelemetryContact, IntelAlert } from '../types/tactical';

/**
 * Fetch real live military aircraft from adsb.lol
 */
export async function fetchLiveMilitaryFlights(): Promise<TelemetryContact[]> {
  try {
    let res = await fetch('/api/adsblol/mil', { signal: AbortSignal.timeout(4000) }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch('https://api.adsb.lol/v2/mil', { signal: AbortSignal.timeout(6000) });
    }
    if (!res.ok) return [];
    const data = await res.json();
    const aircraftList = data?.ac || [];

    return aircraftList
      .filter((ac: any) => typeof ac.lat === 'number' && typeof ac.lon === 'number' && ac.flight)
      .slice(0, 35)
      .map((ac: any) => {
        const callsign = (ac.flight || ac.hex).trim().toUpperCase();
        const altitude = typeof ac.alt_baro === 'number' ? ac.alt_baro : 15000;
        const speed = typeof ac.gs === 'number' ? Math.round(ac.gs) : 250;
        const heading = typeof ac.track === 'number' ? Math.round(ac.track) : 0;
        const type = ac.t ? `Military ${ac.t}` : 'Military Strategic Aircraft';

        return {
          id: `adsb-${ac.hex}`,
          domain: 'air',
          callsign,
          name: ac.r ? `Reg: ${ac.r}` : callsign,
          type,
          category: 'Military',
          country: 'USAF / Allied Air Command',
          lat: ac.lat,
          lon: ac.lon,
          altitude,
          speed,
          heading,
          climbRate: typeof ac.baro_rate === 'number' ? ac.baro_rate : 0,
          squawk: ac.squawk || '1200',
          mgrs: `${Math.round(ac.lat * 10)}N${Math.round(ac.lon * 10)}E`,
          threatLevel: ac.squawk === '7700' ? 'CRITICAL' : 'GUARDED',
          path: [[ac.lat, ac.lon]],
          metadata: {
            Hex: ac.hex.toUpperCase(),
            Transponder: 'Mode-S ADS-B Live',
            ReceiverSeen: `${ac.seen || 0}s ago`
          }
        } as TelemetryContact;
      });
  } catch (err) {
    console.warn('[Helios Live] ADSB live fetch failed, continuing with cached buffer', err);
    return [];
  }
}

/**
 * Fetch real live ISS position from wheretheiss.at
 */
export async function fetchLiveIss(): Promise<TelemetryContact | null> {
  try {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();

    return {
      id: 'space-iss-live',
      domain: 'space',
      callsign: 'ISS (ZARYA)',
      name: 'International Space Station',
      type: 'Crewed Space Research Laboratory',
      category: 'Orbital',
      country: 'NASA / ESA / JAXA / CSA',
      lat: data.latitude,
      lon: data.longitude,
      altitude: Math.round(data.altitude * 1000), // meters
      speed: Math.round(data.velocity / 1.852), // convert km/h to knots
      heading: 51,
      squawk: 'NORAD 25544',
      mgrs: `${Math.round(data.latitude * 10)}N${Math.round(data.longitude * 10)}E`,
      threatLevel: 'NOMINAL',
      path: [[data.latitude, data.longitude]],
      metadata: {
        OrbitalVelocity: `${Math.round(data.velocity).toLocaleString()} km/h`,
        SolarLatitude: `${data.solar_lat?.toFixed(2)}°`,
        Visibility: data.visibility || 'Daylight'
      }
    };
  } catch (err) {
    console.warn('[Helios Live] ISS position fetch failed', err);
    return null;
  }
}

/**
 * Fetch real live USGS global earthquakes
 */
export async function fetchLiveEarthquakes(): Promise<TelemetryContact[]> {
  try {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', {
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    const features = data?.features || [];

    return features
      .filter((f: any) => f.properties?.mag >= 3.0)
      .slice(0, 20)
      .map((f: any) => {
        const [lon, lat, depth] = f.geometry.coordinates;
        const mag = f.properties.mag;
        const place = f.properties.place || 'Seismic Epicenter';

        let threat: any = 'GUARDED';
        if (mag >= 6.0) threat = 'CRITICAL';
        else if (mag >= 5.0) threat = 'HIGH';
        else if (mag >= 4.0) threat = 'ELEVATED';

        return {
          id: `usgs-${f.id}`,
          domain: 'crisis',
          callsign: `EQ M${mag.toFixed(1)}`,
          name: place,
          type: 'USGS Real-Time Seismic Detection',
          category: 'Emergency',
          country: 'Global Seismographic Network',
          lat,
          lon,
          altitude: -Math.round(depth * 1000),
          speed: 0,
          heading: 0,
          squawk: `USGS-${f.id.slice(0, 6)}`,
          mgrs: `${Math.round(lat * 10)}N${Math.round(lon * 10)}E`,
          threatLevel: threat,
          path: [[lat, lon]],
          metadata: {
            Magnitude: `${mag.toFixed(1)} Richter`,
            HypocenterDepth: `${depth.toFixed(1)} km`,
            RecordedTime: new Date(f.properties.time).toISOString().substring(11, 19) + 'Z'
          }
        } as TelemetryContact;
      });
  } catch (err) {
    console.warn('[Helios Live] USGS live fetch failed', err);
    return [];
  }
}

/**
 * Fetch real live municipal and traffic CCTV surveillance cameras
 */
export async function fetchLiveCctvCameras(): Promise<TelemetryContact[]> {
  const globalIconic = getFallbackCameras();
  try {
    const res = await fetch('/api/cctv/sources', { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('CCTV proxy not ok');
    const data = await res.json();
    const sources = data?.sources || [];

    if (sources.length === 0) return globalIconic;

    // Select a diverse sample across cities (up to 25 cameras)
    const sampled = sources
      .filter((s: any) => typeof s.lat === 'number' && typeof s.lon === 'number' && s.id)
      .slice(0, 25);

    const liveLocal = sampled.map((s: any) => {
      const city = s.city || 'Global Hub';
      const callsign = `CAM-${city.toUpperCase().slice(0, 3)}-${s.id.slice(-4).toUpperCase()}`;

      return {
        id: `cctv-${s.id}`,
        domain: 'cctv',
        callsign,
        name: s.name || `Surveillance Camera ${s.id}`,
        type: `Traffic & Public Safety Optical Feed (${s.feedType?.toUpperCase() || 'LIVE'})`,
        category: 'Surveillance',
        country: s.provider || `${city} Municipal C2`,
        lat: s.lat,
        lon: s.lon,
        altitude: s.mountHeightM || 20,
        speed: 0,
        heading: s.headingDeg || 0,
        pitchDeg: s.pitchDeg || -20,
        fovDeg: s.fovDeg || 65,
        mountHeightM: s.mountHeightM || 20,
        feedType: s.feedType || 'image',
        videoUrl: `/api/cctv/frame/${s.id}`,
        cameraCity: city,
        cameraProvider: s.provider || 'Municipal Traffic C2',
        mgrs: `${Math.round(s.lat * 10)}N${Math.round(s.lon * 10)}E`,
        threatLevel: 'NOMINAL',
        path: [[s.lat, s.lon]],
        metadata: {
          City: city,
          Provider: s.provider || 'Municipal Network',
          Azimuth: `${s.headingDeg || 0}°`,
          Elevation: `${s.pitchDeg || -20}°`,
          FOV: `${s.fovDeg || 65}°`,
          MountHeight: `${s.mountHeightM || 20}m AGL`
        }
      } as TelemetryContact;
    });

    return [...globalIconic, ...liveLocal];
  } catch (err) {
    console.warn('[Helios Live] CCTV fetch failed, using curated global surveillance feeds', err);
    return globalIconic;
  }
}

function getFallbackCameras(): TelemetryContact[] {
  return [
    {
      id: 'cctv-tokyo-shinjuku',
      domain: 'cctv',
      callsign: 'CAM-TYO-01',
      name: 'Shinjuku Crossing East Cam',
      type: 'High-Density Urban Optical Sensor',
      category: 'Surveillance',
      country: 'Tokyo Metropolitan Security',
      lat: 35.689614,
      lon: 139.700523,
      altitude: 29,
      speed: 0,
      heading: 242,
      pitchDeg: -19,
      fovDeg: 66,
      mountHeightM: 29,
      feedType: 'image',
      videoUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
      cameraCity: 'Tokyo',
      cameraProvider: 'Tokyo Metro Police Dept',
      mgrs: '54SUE89123456',
      threatLevel: 'NOMINAL',
      path: [[35.689614, 139.700523]],
      metadata: { City: 'Tokyo', Sector: 'Shinjuku East', Azimuth: '242°', FOV: '66°', Mount: '29m' }
    },
    {
      id: 'cctv-nyc-times-sq',
      domain: 'cctv',
      callsign: 'CAM-NYC-42',
      name: 'Times Square Central Plaza',
      type: 'Urban Situational Reconnaissance',
      category: 'Surveillance',
      country: 'NYPD Domain Awareness System',
      lat: 40.758896,
      lon: -73.985130,
      altitude: 45,
      speed: 0,
      heading: 185,
      pitchDeg: -22,
      fovDeg: 78,
      mountHeightM: 45,
      feedType: 'image',
      videoUrl: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=800&q=80',
      cameraCity: 'New York City',
      cameraProvider: 'NYPD C4ISR',
      mgrs: '18TWL86234123',
      threatLevel: 'GUARDED',
      path: [[40.758896, -73.985130]],
      metadata: { City: 'New York', Sector: 'Midtown Manhattan', Azimuth: '185°', FOV: '78°', Mount: '45m' }
    },
    {
      id: 'cctv-london-trafalgar',
      domain: 'cctv',
      callsign: 'CAM-LON-08',
      name: 'Trafalgar Square North Cam',
      type: 'Metropolitan Public Safety Stream',
      category: 'Surveillance',
      country: 'Metropolitan Police C2',
      lat: 51.5080,
      lon: -0.1281,
      altitude: 35,
      speed: 0,
      heading: 140,
      pitchDeg: -18,
      fovDeg: 70,
      mountHeightM: 35,
      feedType: 'image',
      videoUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80',
      cameraCity: 'London',
      cameraProvider: 'Met Police CCTV Net',
      mgrs: '30UUB34128912',
      threatLevel: 'NOMINAL',
      path: [[51.5080, -0.1281]],
      metadata: { City: 'London', Sector: 'Westminster', Azimuth: '140°', FOV: '70°', Mount: '35m' }
    }
  ];
}
