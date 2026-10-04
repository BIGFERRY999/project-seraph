import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C2Header } from './components/hud/C2Header';
import { DomainSidebar } from './components/hud/DomainSidebar';
import { TacticalGlobe, CameraViewMode } from './components/globe/TacticalGlobe';
import { ContactInspector } from './components/hud/ContactInspector';
import { IntelTicker } from './components/hud/IntelTicker';
import { INITIAL_CONTACTS, INITIAL_INTEL_ALERTS } from './utils/telemetryEngine';
import { TelemetryContact, DomainType, IntelAlert } from './types/tactical';
import { threatMatrix } from './threatMatrix';
import { 
  fetchLiveMilitaryFlights, 
  fetchLiveIss, 
  fetchLiveEarthquakes,
  fetchLiveCctvCameras
} from './utils/liveTelemetry';
import { ClassificationBanner } from './components/hud/ClassificationBanner';
import { exportContactsToCotPackage } from './utils/cotParser';
import { SurveillanceWall } from './components/hud/SurveillanceWall';
import { SandboxToolbar, SandboxToolMode } from './components/hud/SandboxToolbar';
import { sandboxEngine, NoFlyZone } from './utils/sandboxEngine';
import { TacticalDvrBar } from './components/hud/TacticalDvrBar';
import { tacticalDvr } from './utils/tacticalDvr';
import { AirDefenseBattery } from './utils/airDefenseCatalog';
import { TacticalMicSidePod } from './components/hud/TacticalMicSidePod';

export default function App() {
  const [curatedContacts, setCuratedContacts] = useState<TelemetryContact[]>(INITIAL_CONTACTS);
  const [liveFlights, setLiveFlights] = useState<TelemetryContact[]>([]);
  const [liveIss, setLiveIss] = useState<TelemetryContact | null>(null);
  const [liveQuakes, setLiveQuakes] = useState<TelemetryContact[]>([]);
  const [liveCctv, setLiveCctv] = useState<TelemetryContact[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [selectedContact, setSelectedContact] = useState<TelemetryContact | null>(null);
  const [activeDomain, setActiveDomain] = useState<DomainType>('all');
  const [alerts, setAlerts] = useState<IntelAlert[]>(INITIAL_INTEL_ALERTS);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('global');
  const [hudTagMode, setHudTagMode] = useState<'all' | 'priority' | 'off'>('priority');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isMilStdSymbology, setIsMilStdSymbology] = useState<boolean>(true);
  const [showAirDefense, setShowAirDefense] = useState<boolean>(true);

  // Multi-Camera SOC Surveillance Wall State
  const [isVideoWallOpen, setIsVideoWallOpen] = useState<boolean>(false);

  // Mission Planning Sandbox State
  const [isSandboxOpen, setIsSandboxOpen] = useState<boolean>(false);
  const [sandboxMode, setSandboxMode] = useState<SandboxToolMode>('INSPECT');
  const [selectedSystemKey, setSelectedSystemKey] = useState<string>('patriot-pac3');
  const [customBatteries, setCustomBatteries] = useState<AirDefenseBattery[]>(() => sandboxEngine.getBatteries());
  const [noFlyZones, setNoFlyZones] = useState<NoFlyZone[]>(() => sandboxEngine.getNoFlyZones());

  // 4D Tactical DVR Telemetry State
  const [isDvrOpen, setIsDvrOpen] = useState<boolean>(false);
  const [dvrOffsetSeconds, setDvrOffsetSeconds] = useState<number>(0);

  const [activeIntercept, setActiveIntercept] = useState<{
    id: string;
    targetId: string;
    targetCallsign: string;
    originName: string;
    originLat: number;
    originLon: number;
    targetLat: number;
    targetLon: number;
    progress: number;
    etaSeconds: number;
    status: 'tracking' | 'intercepted';
  } | null>(null);

  // Initialize Threat Matrix and register simulated threat engine
  useEffect(() => {
    threatMatrix.init();
    threatMatrix.onAlert((newAlert: any) => {
      setAlerts(prev => [
        {
          id: `alert-${Date.now()}-${Math.random()}`,
          timestamp: newAlert.timestamp || new Date().toISOString().substring(11, 19) + 'Z',
          domain: (newAlert.type?.split('-')[0] as any) || 'AIR',
          level: newAlert.level === 'DEFCON 3' ? 'WARN' : 'INFO',
          text: newAlert.text
        },
        ...prev.slice(0, 12)
      ]);
    });
  }, []);

  // Fetch real-world live telemetry: Military Flights, ISS, CCTV Cameras, and USGS Earthquakes
  const refreshLiveTelemetry = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [flights, iss, quakes, cctv] = await Promise.all([
        fetchLiveMilitaryFlights().catch(() => []),
        fetchLiveIss().catch(() => null),
        fetchLiveEarthquakes().catch(() => []),
        fetchLiveCctvCameras().catch(() => [])
      ]);

      if (flights && flights.length > 0) {
        setLiveFlights(flights);
      }

      if (iss) {
        setLiveIss(iss);
      }

      if (cctv && cctv.length > 0) {
        setLiveCctv(cctv);
      }

      if (quakes && quakes.length > 0) {
        setLiveQuakes(quakes);
        // Dispatch alert if major quake detected
        const majorQuake = quakes.find(q => q.threatLevel === 'CRITICAL' || q.threatLevel === 'HIGH');
        if (majorQuake) {
          setAlerts(prev => [
            {
              id: `quake-${Date.now()}`,
              timestamp: new Date().toISOString().substring(11, 19) + 'Z',
              domain: 'CRISIS',
              level: 'WARN',
              text: `USGS SEISMIC ALERT: ${majorQuake.callsign} detected at ${majorQuake.name}`
            },
            ...prev.slice(0, 12)
          ]);
        }
      }
    } catch (err) {
      console.warn('[Helios C2] Live telemetry sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initial load and periodic telemetry refresh
  useEffect(() => {
    refreshLiveTelemetry();

    // Fast interval for ISS orbital glide
    const issInterval = setInterval(async () => {
      const iss = await fetchLiveIss().catch(() => null);
      if (iss) setLiveIss(iss);
    }, 6000);

    // Medium interval for military flights & USGS seismic events
    const feedsInterval = setInterval(() => {
      refreshLiveTelemetry();
    }, 18000);

    return () => {
      clearInterval(issInterval);
      clearInterval(feedsInterval);
    };
  }, [refreshLiveTelemetry]);

  // Active Hypersonic Interceptor Missile Guidance Simulation
  useEffect(() => {
    if (!activeIntercept || activeIntercept.status === 'intercepted') return;

    const timer = setInterval(() => {
      setActiveIntercept(prev => {
        if (!prev) return null;
        const nextProgress = prev.progress + 0.05;
        const nextEta = Math.max(0, Math.round(20 * (1 - nextProgress)));

        if (nextProgress >= 1.0) {
          setAlerts(al => [
            {
              id: `splash-${Date.now()}`,
              timestamp: new Date().toISOString().substring(11, 19) + 'Z',
              domain: 'DEFCON',
              level: 'ALERT',
              text: `[INTERCEPT CONFIRMED] Target ${prev.targetCallsign} engagement envelope closed. Impact splashdown verified.`
            },
            ...al.slice(0, 12)
          ]);

          setTimeout(() => setActiveIntercept(null), 3500);

          return {
            ...prev,
            progress: 1.0,
            etaSeconds: 0,
            status: 'intercepted'
          };
        }

        return {
          ...prev,
          progress: nextProgress,
          etaSeconds: nextEta
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeIntercept?.status]);

  // Merge all curated strategic contacts with real live feeds
  const contacts = useMemo(() => {
    const list: TelemetryContact[] = [];
    if (liveIss) list.push(liveIss);
    list.push(...liveFlights);
    list.push(...liveCctv);
    list.push(...liveQuakes);
    list.push(...curatedContacts);
    return list;
  }, [liveIss, liveFlights, liveCctv, liveQuakes, curatedContacts]);

  // Continuously record live contacts into 4D DVR Ring Buffer (up to 60 mins)
  useEffect(() => {
    if (contacts.length > 0) {
      tacticalDvr.recordSnapshot(contacts);
    }
  }, [contacts]);

  // 4D Telemetry Resolution: Live vs Historical Replay
  const { displayedContacts, replayedTimestamp } = useMemo(() => {
    if (dvrOffsetSeconds < 0) {
      const res = tacticalDvr.getContactsAtOffset(dvrOffsetSeconds, contacts);
      return {
        displayedContacts: res.contacts,
        replayedTimestamp: res.replayedTimestamp
      };
    }
    return {
      displayedContacts: contacts,
      replayedTimestamp: Date.now()
    };
  }, [contacts, dvrOffsetSeconds]);

  // Set default selection once contacts are ready
  useEffect(() => {
    if (!selectedContact && displayedContacts.length > 0) {
      const initial = displayedContacts.find(c => c.id === 'space-iss-live') || displayedContacts[0];
      setSelectedContact(initial);
    }
  }, [displayedContacts, selectedContact]);

  // Keep selected contact synced with live coordinate updates
  useEffect(() => {
    if (selectedContact) {
      const matched = displayedContacts.find(c => c.id === selectedContact.id);
      if (matched && (matched.lat !== selectedContact.lat || matched.lon !== selectedContact.lon)) {
        setSelectedContact(matched);
      }
    }
  }, [displayedContacts]);

  // Gentle coordinate drift simulation for curated targets
  useEffect(() => {
    const driftInterval = setInterval(() => {
      setCuratedContacts(prev => prev.map(c => {
        if (c.speed === 0) return c; // Stationary ground/crisis nodes

        const speedScale = c.domain === 'space' ? 0.05 : 0.003;
        const rad = (c.heading * Math.PI) / 180;
        const dLat = Math.cos(rad) * speedScale;
        const dLon = Math.sin(rad) * speedScale;

        let nextLat = c.lat + dLat;
        let nextLon = c.lon + dLon;

        if (nextLon > 180) nextLon -= 360;
        if (nextLon < -180) nextLon += 360;
        if (nextLat > 85) nextLat = 85;
        if (nextLat < -85) nextLat = -85;

        return {
          ...c,
          lat: nextLat,
          lon: nextLon,
        };
      }));
    }, 1000);

    return () => clearInterval(driftInterval);
  }, []);

  const handleResetView = () => {
    setSelectedContact(null);
    setCameraMode('global');
  };

  const handleSelectContact = (c: TelemetryContact | null) => {
    setSelectedContact(c);
    if (!c) {
      setCameraMode('global');
    }
  };

  const handleSelectDomain = (d: DomainType) => {
    setActiveDomain(d);
    setCameraMode('global');
    const firstMatch = displayedContacts.find(c => d === 'all' ? true : c.domain === d);
    if (firstMatch) {
      setSelectedContact(firstMatch);
    }
  };

  const handleToggleHudTags = () => {
    setHudTagMode(prev => {
      if (prev === 'priority') return 'all';
      if (prev === 'all') return 'off';
      return 'priority';
    });
  };

  const handleGlobeCoordinateClick = useCallback((lat: number, lon: number) => {
    if (isSandboxOpen && sandboxMode === 'DEPLOY_BATTERY') {
      const newBat = sandboxEngine.addBattery(selectedSystemKey, lat, lon);
      setCustomBatteries([...sandboxEngine.getBatteries()]);
      setAlerts(prev => [
        {
          id: `sandbox-deploy-${Date.now()}`,
          timestamp: new Date().toISOString().substring(11, 19) + 'Z',
          domain: 'DEFCON',
          level: 'INFO',
          text: `[SANDBOX DEPLOYMENT] Installed ${newBat.name} (${newBat.systemType}) at ${lat.toFixed(2)}°, ${lon.toFixed(2)}° [Range: ${newBat.rangeKm}km]`
        },
        ...prev.slice(0, 12)
      ]);
    }
  }, [isSandboxOpen, sandboxMode, selectedSystemKey]);

  const handleClearSandbox = useCallback(() => {
    sandboxEngine.reset();
    setCustomBatteries([...sandboxEngine.getBatteries()]);
    setNoFlyZones([...sandboxEngine.getNoFlyZones()]);
    setAlerts(prev => [
      {
        id: `sandbox-clear-${Date.now()}`,
        timestamp: new Date().toISOString().substring(11, 19) + 'Z',
        domain: 'DEFCON',
        level: 'INFO',
        text: `[SANDBOX RESET] Restored sandbox deployments and tactical exclusion zones.`
      },
      ...prev.slice(0, 12)
    ]);
  }, []);

  const handleLaunchIntercept = (target: TelemetryContact) => {
    let origin = { name: 'USS GERALD R. FORD (CVN-78)', lat: 34.25, lon: 18.62 };
    if (target.lon > 20 && target.lon < 145) {
      origin = { name: 'PACIFIC 7TH FLEET / YOKOSUKA', lat: 35.29, lon: 139.67 };
    } else if (target.lon <= -30 || target.lon >= 145) {
      origin = { name: 'NORAD THAAD BATTERY / FT BLISS', lat: 31.80, lon: -106.42 };
    }

    setActiveIntercept({
      id: `msl-${Date.now()}`,
      targetId: target.id,
      targetCallsign: target.callsign,
      originName: origin.name,
      originLat: origin.lat,
      originLon: origin.lon,
      targetLat: target.lat,
      targetLon: target.lon,
      progress: 0.05,
      etaSeconds: 20,
      status: 'tracking'
    });

    setAlerts(prev => [
      {
        id: `intercept-${Date.now()}`,
        timestamp: new Date().toISOString().substring(11, 19) + 'Z',
        domain: 'DEFCON',
        level: 'WARN',
        text: `[DEFCON INTERCEPT] PAC-3 MSE / SM-6 Interceptor launched from ${origin.name} toward ${target.callsign}. Tracking engaged.`
      },
      ...prev.slice(0, 12)
    ]);
  };

  const handleExportCot = useCallback(() => {
    const cotXml = exportContactsToCotPackage(displayedContacts);
    const blob = new Blob([cotXml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `helios-c2-cop-${Date.now()}.cot`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Also mirror to server-side CoT injector
    fetch('/api/cot/inject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: cotXml
    }).catch(() => {});

    setAlerts(prev => [
      {
        id: `cot-export-${Date.now()}`,
        timestamp: new Date().toISOString().substring(11, 19) + 'Z',
        domain: 'DEFCON',
        level: 'INFO',
        text: `[CURSOR-ON-TARGET] Exported ${displayedContacts.length} tracks into ATAK/WinTAK CoT 2.0 XML schema.`
      },
      ...prev.slice(0, 12)
    ]);
  }, [displayedContacts]);

  const showSidebar = isSidebarOpen && cameraMode === 'global';
  const showInspector = selectedContact && cameraMode === 'global';

  return (
    <div className="h-screen w-screen bg-[#05070c] text-zinc-100 flex flex-col overflow-hidden font-sans select-none">
      {/* Top Military Classification Banner */}
      <ClassificationBanner position="top" />

      {/* Top Tactical Status Bar */}
      <C2Header
        totalContacts={displayedContacts.length}
        liveStats={{
          flightsCount: liveFlights.length,
          quakesCount: liveQuakes.length,
          cctvCount: liveCctv.length,
          issActive: liveIss !== null,
          isSyncing
        }}
        onResetView={handleResetView}
        hudTagMode={hudTagMode}
        onToggleHudTags={handleToggleHudTags}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        isMilStdSymbology={isMilStdSymbology}
        onToggleMilStd={() => setIsMilStdSymbology(prev => !prev)}
        showAirDefense={showAirDefense}
        onToggleAirDefense={() => setShowAirDefense(prev => !prev)}
        onExportCot={handleExportCot}
        onToggleVideoWall={() => setIsVideoWallOpen(prev => !prev)}
        isVideoWallOpen={isVideoWallOpen}
        onToggleSandbox={() => setIsSandboxOpen(prev => !prev)}
        isSandboxOpen={isSandboxOpen}
        onToggleDvr={() => setIsDvrOpen(prev => !prev)}
        isDvrOpen={isDvrOpen}
        isDvrReplaying={dvrOffsetSeconds < 0}
      />

      {/* Main Tactical Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sandbox Mission Planning Floating Toolbar */}
        <SandboxToolbar
          isOpen={isSandboxOpen}
          onClose={() => setIsSandboxOpen(false)}
          activeMode={sandboxMode}
          onSelectMode={setSandboxMode}
          selectedSystemKey={selectedSystemKey}
          onSelectSystemKey={setSelectedSystemKey}
          batteryCount={customBatteries.length}
          nfzCount={noFlyZones.length}
          onClearSandbox={handleClearSandbox}
        />

        {/* 4D Tactical DVR Scrubber Bar */}
        <TacticalDvrBar
          isOpen={isDvrOpen}
          onClose={() => {
            setIsDvrOpen(false);
            setDvrOffsetSeconds(0);
          }}
          offsetSeconds={dvrOffsetSeconds}
          onSeek={setDvrOffsetSeconds}
          availableSpanSeconds={tacticalDvr.getAvailableSpanSeconds()}
          replayedTimestamp={replayedTimestamp}
        />

        {/* Left Domain Navigation Rail */}
        {showSidebar && (
          <DomainSidebar
            contacts={displayedContacts}
            activeDomain={activeDomain}
            onSelectDomain={handleSelectDomain}
            selectedContact={selectedContact}
            onSelectContact={handleSelectContact}
          />
        )}

        {/* Center 3D WebGL Tactical Globe */}
        <main className="flex-1 relative overflow-hidden bg-[#05070c]">
          <TacticalGlobe
            contacts={displayedContacts}
            selectedContact={selectedContact}
            onSelectContact={handleSelectContact}
            activeDomain={activeDomain}
            cameraMode={cameraMode}
            onSetCameraMode={setCameraMode}
            hudTagMode={hudTagMode}
            activeIntercept={activeIntercept}
            isMilStdSymbology={isMilStdSymbology}
            showAirDefense={showAirDefense}
            customBatteries={customBatteries}
            noFlyZones={noFlyZones}
            onGlobeCoordinateClick={handleGlobeCoordinateClick}
            isDeployMode={isSandboxOpen && sandboxMode === 'DEPLOY_BATTERY'}
          />
        </main>

        {/* Right Contact Telemetry Inspector */}
        {showInspector && (
          <ContactInspector
            contact={selectedContact}
            onClose={() => {
              setSelectedContact(null);
              setCameraMode('global');
            }}
            cameraMode={cameraMode}
            onSetCameraMode={setCameraMode}
            onLaunchIntercept={handleLaunchIntercept}
            activeIntercept={activeIntercept}
          />
        )}
      </div>

      {/* Multi-Camera SOC Surveillance Wall Modal */}
      <SurveillanceWall
        cameras={contacts.filter(c => c.domain === 'cctv')}
        isOpen={isVideoWallOpen}
        onClose={() => setIsVideoWallOpen(false)}
        onSelectCamera={(cam) => {
          setSelectedContact(cam);
          setIsVideoWallOpen(false);
          setCameraMode('global');
        }}
      />

      {/* Redesigned Military-Grade Tactical Microphone Side Pod */}
      <TacticalMicSidePod
        onSelectDomain={handleSelectDomain}
        onFilterSearch={(query) => {
          if (query) {
            const match = displayedContacts.find(c => 
              c.callsign.toLowerCase().includes(query.toLowerCase()) || 
              c.name.toLowerCase().includes(query.toLowerCase())
            );
            if (match) setSelectedContact(match);
          }
        }}
        onToggleAirDefense={() => setShowAirDefense(prev => !prev)}
        onToggleVideoWall={() => setIsVideoWallOpen(prev => !prev)}
        onToggleSandbox={() => setIsSandboxOpen(prev => !prev)}
        onToggleDvr={() => setIsDvrOpen(prev => !prev)}
        onVoiceCommand={(_cmd, raw) => {
          setAlerts(prev => [
            {
              id: `voice-${Date.now()}`,
              timestamp: new Date().toISOString().substring(11, 19) + 'Z',
              domain: 'DEFCON',
              level: 'INFO',
              text: `[VOICE RECON] Tactical voice command recognized: "${raw.toUpperCase()}"`
            },
            ...prev.slice(0, 12)
          ]);
        }}
      />

      {/* Bottom Live Streaming Intelligence Ticker */}
      <IntelTicker alerts={alerts} />

      {/* Bottom Military Classification Banner */}
      <ClassificationBanner position="bottom" />
    </div>
  );
}
