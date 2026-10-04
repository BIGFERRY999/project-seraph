import React, { useState, useEffect } from 'react';
import { 
  X, 
  Crosshair, 
  MapPin, 
  Radio, 
  ShieldCheck, 
  CheckCircle2, 
  Navigation,
  Video,
  Maximize2,
  Camera,
  Eye,
  RefreshCw,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { TelemetryContact } from '../../types/tactical';
import { tacticalSound } from '../../tacticalSound';
import { resolveMilSymbolConfig } from '../../utils/milStd2525';
import { getCotType } from '../../utils/cotParser';
import { analyzeEwAnomalies } from '../../utils/ewAnomalyEngine';
import { checkWezInterception } from '../../utils/airDefenseCatalog';

interface ContactInspectorProps {
  contact: TelemetryContact | null;
  onClose: () => void;
  cameraMode?: 'global' | 'chase' | 'cockpit' | 'satellite';
  onSetCameraMode?: (mode: 'global' | 'chase' | 'cockpit' | 'satellite') => void;
  onLaunchIntercept?: (target: TelemetryContact) => void;
  activeIntercept?: {
    targetId: string;
    originName: string;
    etaSeconds: number;
    progress: number;
    status: 'tracking' | 'intercepted';
  } | null;
}

export const ContactInspector: React.FC<ContactInspectorProps> = ({ 
  contact, 
  onClose,
  cameraMode = 'global',
  onSetCameraMode,
  onLaunchIntercept,
  activeIntercept
}) => {
  const [isArmed, setIsArmed] = useState(false);
  const [frameStamp, setFrameStamp] = useState(Date.now());
  const [isExpandedPip, setIsExpandedPip] = useState(false);

  // Auto-refresh camera frame every 3 seconds for live streaming feel
  useEffect(() => {
    if (contact?.domain === 'cctv') {
      const interval = setInterval(() => {
        setFrameStamp(Date.now());
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [contact]);

  if (!contact) return null;

  const isCurrentTargetIntercepting = activeIntercept && activeIntercept.targetId === contact.id;

  const handleArmIntercept = () => {
    setIsArmed(true);
    tacticalSound.playLockOn();
    setTimeout(() => {
      tacticalSound.playLaunchTone();
      onLaunchIntercept?.(contact);
    }, 450);
  };

  const isCamera = contact.domain === 'cctv' || !!contact.videoUrl;

  return (
    <aside className="w-88 h-full bg-[#080b12]/95 border-l border-[#1b2333] flex flex-col z-20 backdrop-blur-md select-none p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-[#1b2333]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono font-black text-base text-white tracking-wide">{contact.callsign}</h2>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
              contact.threatLevel === 'HIGH' || contact.threatLevel === 'CRITICAL'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                : contact.domain === 'cctv'
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                : contact.threatLevel === 'ELEVATED'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}>
              {contact.domain === 'cctv' ? 'OPTICAL FEED' : contact.threatLevel}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[210px]">{contact.name}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* VEHICLE / SATELLITE LIVE CAMERA LAUNCH BUTTONS */}
      {(contact.domain === 'air' || contact.domain === 'maritime') && (
        <div className="bg-[#0b101d] border border-cyan-500/30 p-2.5 rounded-xl space-y-2 font-mono">
          <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>LIVE ON-BOARD CAMERA</span>
            </span>
            <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30 font-bold">
              60 FPS
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSetCameraMode?.('cockpit')}
              className={`py-2 px-2.5 rounded-lg border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                cameraMode === 'cockpit'
                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30 ring-1 ring-cyan-300'
                  : 'bg-[#101726] border-[#1f2b40] text-cyan-300 hover:bg-cyan-500/15'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>COCKPIT POV</span>
            </button>

            <button
              type="button"
              onClick={() => onSetCameraMode?.('chase')}
              className={`py-2 px-2.5 rounded-lg border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                cameraMode === 'chase'
                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30 ring-1 ring-cyan-300'
                  : 'bg-[#101726] border-[#1f2b40] text-cyan-300 hover:bg-cyan-500/15'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>CHASE CAM</span>
            </button>
          </div>
        </div>
      )}

      {contact.domain === 'space' && (
        <div className="bg-[#0b101d] border border-amber-500/30 p-2.5 rounded-xl space-y-2 font-mono">
          <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>LIVE SATELLITE RECON APERTURE</span>
            </span>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
              ORBITAL LINK
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSetCameraMode?.('satellite')}
              className={`py-2 px-2.5 rounded-lg border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                cameraMode === 'satellite'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30 ring-1 ring-amber-300'
                  : 'bg-[#101726] border-[#1f2b40] text-amber-300 hover:bg-amber-500/15'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>NADIR SPY CAM</span>
            </button>

            <button
              type="button"
              onClick={() => onSetCameraMode?.('chase')}
              className={`py-2 px-2.5 rounded-lg border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                cameraMode === 'chase'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30 ring-1 ring-amber-300'
                  : 'bg-[#101726] border-[#1f2b40] text-amber-300 hover:bg-amber-500/15'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>ORBIT CHASE</span>
            </button>
          </div>
        </div>
      )}

      {/* LIVE CCTV OPTICAL SURVEILLANCE FEED */}
      {isCamera && (
        <div className="relative rounded-xl overflow-hidden border border-purple-500/40 bg-black shadow-lg shadow-purple-500/10">
          {contact.feedType === 'mp4' ? (
            <video
              src={contact.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-44 object-cover"
            />
          ) : (
            <img
              src={contact.videoUrl ? `${contact.videoUrl}?t=${frameStamp}` : undefined}
              alt={contact.name}
              className="w-full h-44 object-cover transition-opacity duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80';
              }}
            />
          )}

          {/* CRT scanlines effect */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />

          {/* Optical HUD Overlays */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/80 px-2 py-0.5 rounded border border-rose-500/50 text-[10px] font-mono text-rose-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>LIVE CAM</span>
          </div>

          <div className="absolute top-2 right-2 bg-black/80 px-2 py-0.5 rounded border border-[#222c42] text-[10px] font-mono text-cyan-400">
            OPTICAL 1080P
          </div>

          {/* Center Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
            <Crosshair className="w-10 h-10 text-cyan-400" />
          </div>

          {/* Bottom Feed Metadata */}
          <div className="absolute bottom-0 inset-x-0 bg-black/85 backdrop-blur-sm px-2.5 py-1 text-[10px] font-mono text-zinc-300 flex justify-between items-center border-t border-[#1b2333]">
            <span className="text-purple-300 font-semibold truncate max-w-[180px]">{contact.cameraCity || 'TACTICAL'}: {contact.callsign}</span>
            <span className="text-cyan-400 font-mono">AZ {contact.heading}°</span>
          </div>
        </div>
      )}

      {/* MILITARY C4ISR DIAGNOSTICS & ELECTRONIC WARFARE */}
      {(() => {
        const milConfig = resolveMilSymbolConfig(contact);
        const cotType = getCotType(contact);
        const ewReport = analyzeEwAnomalies(contact);
        const wez = checkWezInterception(contact);

        return (
          <div className="space-y-2 font-mono">
            {/* Electronic Warfare / Anomaly Alert */}
            {ewReport.isAnomaly && (
              <div className="bg-rose-950/40 border border-rose-500/60 p-2.5 rounded-xl space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                  <span>EW ANOMALY DETECTED: {ewReport.severity}</span>
                </div>
                <p className="text-[10px] text-zinc-300 leading-tight">{ewReport.description}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {ewReport.tags.map((t) => (
                    <span key={t} className="bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded text-[9px] font-bold border border-rose-500/30">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* SAM Weapon Engagement Zone (WEZ) Ingress */}
            {wez.inWez && (
              <div className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                wez.threatStatus === 'HOSTILE_THREAT'
                  ? 'bg-rose-950/50 border-rose-500 text-rose-300 shadow-lg shadow-rose-900/30 ring-1 ring-rose-500/50'
                  : 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
              }`}>
                <div className="flex items-center justify-between font-bold text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span>SAM WEAPON ENGAGEMENT ZONE</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/50 border border-current">
                    {wez.distanceKm} KM TO BATTERY
                  </span>
                </div>
                <p className="text-[10px] text-zinc-300">
                  Target inside engagement envelope of <strong className="text-white">{wez.battery?.name}</strong> ({wez.battery?.system.name}).
                </p>
              </div>
            )}

            {/* MIL-STD-2525 & Cursor-on-Target Metadata Box */}
            <div className="bg-[#0b101d] border border-[#1f2b40] p-2.5 rounded-xl space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold border-b border-[#1b2333] pb-1">
                <span>MIL-STD-2525 / CoT SPECS</span>
                <span className="text-cyan-400 font-bold">{milConfig.identity}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-zinc-500 block">SIDC CODE</span>
                  <span className="text-zinc-300 font-mono text-[9px] break-all">{milConfig.sidc}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">CoT ATOM TYPE</span>
                  <span className="text-cyan-300 font-mono text-[10px]">{cotType}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Target Status Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="bg-[#0e1320] p-2.5 rounded-xl border border-[#1b2333]">
          <span className="text-[10px] text-zinc-500 block">CLASSIFICATION</span>
          <span className="text-cyan-400 font-bold">{contact.category.toUpperCase()}</span>
        </div>

        <div className="bg-[#0e1320] p-2.5 rounded-xl border border-[#1b2333]">
          <span className="text-[10px] text-zinc-500 block">SQUAWK CODE</span>
          <span className="text-emerald-400 font-bold">{contact.squawk || 'N/A'}</span>
        </div>

        <div className="bg-[#0e1320] p-2.5 rounded-xl border border-[#1b2333]">
          <span className="text-[10px] text-zinc-500 block">ALTITUDE</span>
          <span className="text-white font-bold">
            {contact.domain === 'space'
              ? `${Math.round(contact.altitude / 1000).toLocaleString()} km`
              : contact.domain === 'air'
              ? `${contact.altitude.toLocaleString()} FT`
              : contact.domain === 'crisis'
              ? `${Math.abs(Math.round(contact.altitude / 1000))} km DEPTH`
              : 'SEA SURFACE'}
          </span>
        </div>

        <div className="bg-[#0e1320] p-2.5 rounded-xl border border-[#1b2333]">
          <span className="text-[10px] text-zinc-500 block">GROUND SPEED</span>
          <span className="text-white font-bold">{contact.speed.toLocaleString()} KTS</span>
        </div>
      </div>

      {/* Military Spatial Coordinates (MGRS & Geodetic) */}
      <div className="bg-[#0e1320] p-3 rounded-xl border border-[#1b2333] space-y-2 font-mono text-xs">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] uppercase font-bold text-zinc-300">Spatial Telemetry Fix</span>
        </div>

        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-zinc-500">MGRS GRID:</span>
            <span className="text-cyan-300 font-semibold">{contact.mgrs}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">LATITUDE:</span>
            <span className="text-zinc-300">{contact.lat.toFixed(4)}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">LONGITUDE:</span>
            <span className="text-zinc-300">{contact.lon.toFixed(4)}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">HEADING TAPE:</span>
            <span className="text-zinc-300">{contact.heading}° TRUE</span>
          </div>
        </div>
      </div>

      {/* Operator & Metadata Details */}
      <div className="bg-[#0e1320] p-3 rounded-xl border border-[#1b2333] space-y-2 font-mono text-xs">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Radio className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[10px] uppercase font-bold text-zinc-300">Operational Intelligence</span>
        </div>

        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-zinc-500">OPERATOR:</span>
            <span className="text-zinc-200 text-right truncate pl-2">{contact.country}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">PLATFORM TYPE:</span>
            <span className="text-zinc-200 text-right truncate pl-2">{contact.type}</span>
          </div>

          {contact.metadata && Object.entries(contact.metadata).map(([key, val]) => (
            <div key={key} className="flex justify-between pt-1 border-t border-[#172030]">
              <span className="text-zinc-500">{key.toUpperCase()}:</span>
              <span className="text-cyan-400 text-right">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Reticle Footer */}
      <div className="pt-2">
        {isCurrentTargetIntercepting ? (
          <div className="w-full p-3 bg-rose-500/15 border border-rose-500/50 rounded-xl space-y-2 font-mono shadow-lg shadow-rose-500/20">
            <div className="flex items-center justify-between text-xs font-bold text-rose-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>INTERCEPT VECTOR ACTIVE</span>
              </span>
              <span>ETA {activeIntercept.etaSeconds}s</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-[#101726] h-2 rounded-full overflow-hidden border border-rose-500/30">
              <div 
                className="bg-gradient-to-r from-amber-500 to-rose-500 h-full transition-all duration-300" 
                style={{ width: `${Math.min(100, Math.round(activeIntercept.progress * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>BATTERY: {activeIntercept.originName}</span>
              <span className="text-cyan-400 font-bold">MACH 4.8</span>
            </div>
          </div>
        ) : isArmed ? (
          <div className="w-full py-2.5 px-4 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>INTERCEPT VECTOR PINNED · TRACKING</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleArmIntercept}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-mono font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 transition-all hover:scale-102"
          >
            <Crosshair className="w-4 h-4 text-black" />
            <span>ARM TRACKING INTERCEPT</span>
          </button>
        )}
      </div>
    </aside>
  );
};
