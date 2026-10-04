export type DomainType = 'all' | 'air' | 'maritime' | 'space' | 'cctv' | 'crisis';

export type ThreatLevel = 'NOMINAL' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface TelemetryContact {
  id: string;
  domain: 'air' | 'maritime' | 'space' | 'cctv' | 'crisis';
  callsign: string;
  name: string;
  type: string;
  category: 'Military' | 'Commercial' | 'Strategic' | 'Orbital' | 'Emergency' | 'Surveillance';
  country: string;
  lat: number;
  lon: number;
  altitude: number; // feet or meters for satellites
  speed: number; // knots or km/s
  heading: number; // degrees 0-360
  climbRate?: number; // fpm
  squawk?: string;
  mgrs: string;
  threatLevel: ThreatLevel;
  path: [number, number][]; // lat, lon trail
  videoUrl?: string; // Live CCTV video stream URL
  feedType?: 'image' | 'mp4' | 'm3u8';
  cameraCity?: string;
  cameraProvider?: string;
  pitchDeg?: number;
  fovDeg?: number;
  mountHeightM?: number;
  metadata?: Record<string, string | number>;
}

export interface IntelAlert {
  id: string;
  timestamp: string;
  domain: 'AIR' | 'SPACE' | 'MARITIME' | 'SEISMIC' | 'DEFCON';
  level: 'INFO' | 'WARN' | 'ALERT';
  text: string;
}
