/**
 * Strategic Air Defense & Surface-to-Air Missile (SAM) Threat Dome Engine
 * Defines real-world missile defense systems, battery locations, and engagement envelope detection.
 */

import * as THREE from 'three';
import { TelemetryContact } from '../types/tactical';

export interface AirDefenseSystem {
  id: string;
  name: string;
  type: string;
  country: string;
  affiliation: 'FRIEND' | 'HOSTILE' | 'NEUTRAL';
  radarRangeKm: number;
  engagementRangeKm: number;
  minRangeKm: number;
  maxAltitudeM: number;
  colorHex: number;
  colorStr: string;
}

export interface AirDefenseBattery {
  id: string;
  name: string;
  system: AirDefenseSystem;
  lat: number;
  lon: number;
  status: 'ACTIVE' | 'STANDBY' | 'TRACKING';
}

export const AIR_DEFENSE_SYSTEMS: Record<string, AirDefenseSystem> = {
  PATRIOT: {
    id: 'patriot-pac3',
    name: 'MIM-104 Patriot PAC-3 MSE',
    type: 'Long-Range Air & Missile Defense System',
    country: 'USA / NATO',
    affiliation: 'FRIEND',
    radarRangeKm: 240,
    engagementRangeKm: 160,
    minRangeKm: 3,
    maxAltitudeM: 24200,
    colorHex: 0x38bdf8,
    colorStr: '#38bdf8'
  },
  S400: {
    id: 's400-triumf',
    name: 'S-400 Triumf (SA-21 Growler)',
    type: 'Strategic Anti-Aircraft & ABM System',
    country: 'Russian Aerospace Forces',
    affiliation: 'HOSTILE',
    radarRangeKm: 600,
    engagementRangeKm: 380,
    minRangeKm: 5,
    maxAltitudeM: 30000,
    colorHex: 0xef4444,
    colorStr: '#ef4444'
  },
  IRON_DOME: {
    id: 'iron-dome',
    name: 'Iron Dome (Tamir Interceptor)',
    type: 'Mobile C-RAM & Short-Range Air Defense',
    country: 'Israel Air Defense Command',
    affiliation: 'FRIEND',
    radarRangeKm: 100,
    engagementRangeKm: 70,
    minRangeKm: 2,
    maxAltitudeM: 10000,
    colorHex: 0x22c55e,
    colorStr: '#22c55e'
  },
  AEGIS_SM6: {
    id: 'aegis-sm6',
    name: 'Aegis Weapon System (RIM-174 SM-6)',
    type: 'Multi-Mission Naval Air & Ballistic Defense',
    country: 'US Navy / Allied Navies',
    affiliation: 'FRIEND',
    radarRangeKm: 370,
    engagementRangeKm: 240,
    minRangeKm: 4,
    maxAltitudeM: 34000,
    colorHex: 0x06b6d4,
    colorStr: '#06b6d4'
  },
  HQ9: {
    id: 'hq-9b',
    name: 'HQ-9B Long-Range SAM',
    type: 'Surface-to-Air Missile System',
    country: 'China (PLA Air Force)',
    affiliation: 'HOSTILE',
    radarRangeKm: 300,
    engagementRangeKm: 250,
    minRangeKm: 5,
    maxAltitudeM: 27000,
    colorHex: 0xf97316,
    colorStr: '#f97316'
  }
};

/** Pre-positioned strategic air defense batteries at real geopolitical locations */
export const STRATEGIC_SAM_BATTERIES: AirDefenseBattery[] = [
  {
    id: 'sam-crimea-s400',
    name: 'Sevastopol S-400 Air Defense Complex',
    system: AIR_DEFENSE_SYSTEMS.S400,
    lat: 44.6167,
    lon: 33.5254,
    status: 'ACTIVE'
  },
  {
    id: 'sam-kaliningrad-s400',
    name: 'Kaliningrad Baltic Bastion S-400',
    system: AIR_DEFENSE_SYSTEMS.S400,
    lat: 54.7104,
    lon: 20.4522,
    status: 'ACTIVE'
  },
  {
    id: 'sam-redsea-aegis',
    name: 'USS Carney (DDG-64) Aegis SM-6 Task Group',
    system: AIR_DEFENSE_SYSTEMS.AEGIS_SM6,
    lat: 13.9856,
    lon: 42.7541,
    status: 'ACTIVE'
  },
  {
    id: 'sam-qatar-patriot',
    name: 'Al Udeid Air Base Patriot Battery',
    system: AIR_DEFENSE_SYSTEMS.PATRIOT,
    lat: 25.1167,
    lon: 51.3167,
    status: 'ACTIVE'
  },
  {
    id: 'sam-israel-irondome',
    name: 'Central Command Iron Dome Battery',
    system: AIR_DEFENSE_SYSTEMS.IRON_DOME,
    lat: 32.0853,
    lon: 34.7818,
    status: 'ACTIVE'
  },
  {
    id: 'sam-taiwan-patriot',
    name: 'Taipei Northern AD Air Defense Battery',
    system: AIR_DEFENSE_SYSTEMS.PATRIOT,
    lat: 25.0330,
    lon: 121.5654,
    status: 'ACTIVE'
  },
  {
    id: 'sam-southchinasea-hq9',
    name: 'Subi Reef Outpost HQ-9B Battery',
    system: AIR_DEFENSE_SYSTEMS.HQ9,
    lat: 10.9167,
    lon: 114.0833,
    status: 'ACTIVE'
  }
];

/**
 * Calculates Great Circle surface distance in kilometers between two lat/lon points
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if a contact is inside any Weapon Engagement Zone (WEZ)
 */
export function checkWezInterception(contact: TelemetryContact): {
  inWez: boolean;
  battery?: AirDefenseBattery;
  distanceKm?: number;
  threatStatus?: 'HOSTILE_THREAT' | 'ALLIED_PROTECTED';
} {
  for (const battery of STRATEGIC_SAM_BATTERIES) {
    const dist = getDistanceKm(contact.lat, contact.lon, battery.lat, battery.lon);
    if (dist <= battery.system.engagementRangeKm) {
      // Check altitude ceiling (convert feet to meters: 1 ft = 0.3048 m)
      const altMeters = contact.altitude * 0.3048;
      if (altMeters <= battery.system.maxAltitudeM) {
        return {
          inWez: true,
          battery,
          distanceKm: Math.round(dist),
          threatStatus: battery.system.affiliation === 'HOSTILE' ? 'HOSTILE_THREAT' : 'ALLIED_PROTECTED'
        };
      }
    }
  }
  return { inWez: false };
}
