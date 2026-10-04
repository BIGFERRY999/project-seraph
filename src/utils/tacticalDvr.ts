/**
 * 4D Tactical DVR & Historical Telemetry Playback Engine
 * Maintains an in-memory high-precision ring buffer of all multi-domain contact states for temporal rewind and incident replay.
 */

import { TelemetryContact } from '../types/tactical';

export interface DvrSnapshot {
  timestamp: number; // Epoch milliseconds
  isoTime: string;
  contacts: TelemetryContact[];
}

export class TacticalDvrEngine {
  private snapshots: DvrSnapshot[] = [];
  private maxDurationMs: number = 60 * 60 * 1000; // 60 minutes
  private lastRecordTime: number = 0;
  private minIntervalMs: number = 4000; // Record at most once every 4 seconds

  /**
   * Records a snapshot of active contacts into the ring buffer
   */
  public recordSnapshot(contacts: TelemetryContact[]): void {
    const now = Date.now();
    if (now - this.lastRecordTime < this.minIntervalMs) return;

    this.lastRecordTime = now;
    const clonedContacts: TelemetryContact[] = contacts.map(c => ({
      ...c,
      path: [...c.path]
    }));

    this.snapshots.push({
      timestamp: now,
      isoTime: new Date(now).toISOString(),
      contacts: clonedContacts
    });

    // Prune snapshots older than maxDurationMs
    const cutoff = now - this.maxDurationMs;
    while (this.snapshots.length > 1 && this.snapshots[0].timestamp < cutoff) {
      this.snapshots.shift();
    }
  }

  public getSnapshotCount(): number {
    return this.snapshots.length;
  }

  public getEarliestTimestamp(): number {
    return this.snapshots.length > 0 ? this.snapshots[0].timestamp : Date.now();
  }

  public getLatestTimestamp(): number {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].timestamp : Date.now();
  }

  public getAvailableSpanSeconds(): number {
    if (this.snapshots.length < 2) return 0;
    return Math.round((this.getLatestTimestamp() - this.getEarliestTimestamp()) / 1000);
  }

  /**
   * Retrieves contacts at a specified negative time offset (e.g. -300 for 5 minutes ago)
   * 0 or positive offset returns the latest live contacts.
   */
  public getContactsAtOffset(offsetSeconds: number, liveFallback: TelemetryContact[] = []): {
    contacts: TelemetryContact[];
    replayedTimestamp: number;
    isLive: boolean;
  } {
    if (offsetSeconds >= 0 || this.snapshots.length === 0) {
      return {
        contacts: liveFallback,
        replayedTimestamp: Date.now(),
        isLive: true
      };
    }

    const targetTime = Date.now() + offsetSeconds * 1000;

    // Binary search for nearest snapshot
    let low = 0;
    let high = this.snapshots.length - 1;
    let bestIdx = 0;
    let minDiff = Infinity;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const diff = Math.abs(this.snapshots[mid].timestamp - targetTime);

      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = mid;
      }

      if (this.snapshots[mid].timestamp < targetTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const snap = this.snapshots[bestIdx];
    return {
      contacts: snap ? snap.contacts : liveFallback,
      replayedTimestamp: snap ? snap.timestamp : targetTime,
      isLive: false
    };
  }

  public clear(): void {
    this.snapshots = [];
  }
}

export const tacticalDvr = new TacticalDvrEngine();
