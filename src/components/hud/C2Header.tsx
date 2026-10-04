import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Radio, 
  Globe2, 
  Crosshair, 
  Volume2, 
  VolumeX, 
  RotateCcw,
  Sparkles,
  Tag,
  PanelLeftClose,
  PanelLeftOpen,
  Camera,
  Target,
  Clock
} from 'lucide-react';
import { tacticalSound } from '../../tacticalSound';

interface C2HeaderProps {
  totalContacts: number;
  liveStats?: {
    flightsCount: number;
    quakesCount: number;
    cctvCount?: number;
    issActive: boolean;
    isSyncing: boolean;
  };
  onResetView: () => void;
  hudTagMode?: 'all' | 'priority' | 'off';
  onToggleHudTags?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isMilStdSymbology?: boolean;
  onToggleMilStd?: () => void;
  showAirDefense?: boolean;
  onToggleAirDefense?: () => void;
  onExportCot?: () => void;
  onToggleVideoWall?: () => void;
  isVideoWallOpen?: boolean;
  onToggleSandbox?: () => void;
  isSandboxOpen?: boolean;
  onToggleDvr?: () => void;
  isDvrOpen?: boolean;
  isDvrReplaying?: boolean;
}

export const C2Header: React.FC<C2HeaderProps> = ({ 
  totalContacts, 
  liveStats, 
  onResetView,
  hudTagMode = 'priority',
  onToggleHudTags,
  isSidebarOpen = true,
  onToggleSidebar,
  isMilStdSymbology = false,
  onToggleMilStd,
  showAirDefense = false,
  onToggleAirDefense,
  onExportCot,
  onToggleVideoWall,
  isVideoWallOpen = false,
  onToggleSandbox,
  isSandboxOpen = false,
  onToggleDvr,
  isDvrOpen = false,
  isDvrReplaying = false
}) => {
  const [zuluTime, setZuluTime] = useState<string>('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [defconLevel, setDefconLevel] = useState<3 | 4>(4);

  // UTC Zulu Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setZuluTime(now.toISOString().substring(11, 19) + ' Z');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAudio = () => {
    const active = tacticalSound.toggle();
    setIsAudioEnabled(active);
  };

  return (
    <header className="h-14 bg-[#080b12]/95 border-b border-[#1b2333] px-5 flex items-center justify-between select-none z-30 backdrop-blur-md">
      {/* Brand & Mission Mark */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Globe2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black tracking-wider text-sm text-white">
                HELIOS <span className="text-cyan-400">C2</span>
              </span>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-300 font-mono font-bold px-1.5 py-0.2 rounded border border-cyan-500/30">
                MULTI-DOMAIN C4ISR
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">Planetary Defense & Spatial Situational Awareness</p>
          </div>
        </div>

        {/* UTC Zulu Time */}
        <div className="hidden md:flex items-center gap-2 bg-[#0e1320] border border-[#1b2333] px-3 py-1 rounded-lg font-mono text-xs text-zinc-300">
          <span className="text-[10px] text-zinc-500 font-bold">ZULU TIME:</span>
          <span className="text-cyan-400 font-bold">{zuluTime}</span>
        </div>
      </div>

      {/* Center Tactical Status */}
      <div className="flex items-center gap-3">
        {/* DEFCON Rating Badge */}
        <div 
          onClick={() => setDefconLevel(defconLevel === 3 ? 4 : 3)}
          className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-mono text-xs font-bold cursor-pointer transition-all ${
            defconLevel === 3
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
          }`}
          title="Click to toggle operational readiness"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{defconLevel === 3 ? 'DEFCON 3 · ROUND HOUSE' : 'DEFCON 4 · GUARDED'}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${defconLevel === 3 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
        </div>

        {/* Live Feeds Status Indicator */}
        {liveStats && (
          <div className="hidden lg:flex items-center gap-2 bg-[#0b101c] border border-cyan-500/30 px-3 py-1 rounded-lg font-mono text-xs text-cyan-300">
            <span className={`w-2 h-2 rounded-full ${liveStats.isSyncing ? 'bg-amber-400 animate-spin' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="font-bold text-white text-[11px]">FEEDS:</span>
            <span className="text-cyan-400 text-[11px] font-semibold">{liveStats.flightsCount} AIR</span>
            <span className="text-zinc-600">·</span>
            <span className="text-purple-400 text-[11px] font-semibold">{liveStats.cctvCount || 0} CCTV</span>
            <span className="text-zinc-600">·</span>
            <span className="text-amber-400 text-[11px] font-semibold">{liveStats.quakesCount} EQ</span>
            <span className="text-zinc-600">·</span>
            <span className="text-emerald-400 text-[11px] font-semibold">ISS {liveStats.issActive ? 'LIVE' : 'SYNC'}</span>
          </div>
        )}

        {/* Active Contact Count Pill */}
        <div className="hidden sm:flex items-center gap-2 bg-[#0e1320] border border-[#1b2333] px-3 py-1 rounded-lg font-mono text-xs text-zinc-300">
          <span className="text-zinc-500">TRACKED:</span>
          <span className="text-white font-bold">{totalContacts} VECTORS</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Tactical Acoustic Audio Button */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all cursor-pointer ${
            isAudioEnabled
              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30'
              : 'bg-[#0e1320] border-[#1b2333] text-zinc-400 hover:text-white'
          }`}
          title="Toggle Submarine Acoustic Sonar & Radio Squelch"
        >
          {isAudioEnabled ? (
            <>
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>SONAR AUDIO ON</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
              <span>SONAR MUTED</span>
            </>
          )}
        </button>

        {/* MIL-STD-2525 Symbology Toggle */}
        {onToggleMilStd && (
          <button
            type="button"
            onClick={onToggleMilStd}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
              isMilStdSymbology
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/30'
                : 'bg-[#0e1320] border-[#1b2333] text-zinc-400 hover:text-white'
            }`}
            title="Toggle NATO MIL-STD-2525D / APP-6D Symbology & Velocity Leaders"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isMilStdSymbology ? 'MIL-STD-2525 ON' : 'MIL-STD'}</span>
          </button>
        )}

        {/* Air Defense SAM Threat Domes Toggle */}
        {onToggleAirDefense && (
          <button
            type="button"
            onClick={onToggleAirDefense}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
              showAirDefense
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-md shadow-rose-500/20 ring-1 ring-rose-400/30'
                : 'bg-[#0e1320] border-[#1b2333] text-zinc-400 hover:text-white'
            }`}
            title="Toggle 3D Surface-to-Air Missile (SAM) Threat Envelopes (Patriot, S-400, Iron Dome, SM-6)"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{showAirDefense ? 'SAM DOMES ON' : 'SAM DOMES'}</span>
          </button>
        )}

        {/* Multi-Camera SOC Surveillance Wall */}
        {onToggleVideoWall && (
          <button
            type="button"
            onClick={onToggleVideoWall}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
              isVideoWallOpen
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-md shadow-purple-500/20 ring-1 ring-purple-400/30'
                : 'bg-[#0e1320] border-[#1b2333] text-zinc-400 hover:text-white'
            }`}
            title="Toggle Multi-Camera SOC Surveillance Wall"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isVideoWallOpen ? 'WALL ON' : 'VIDEO WALL'}</span>
          </button>
        )}

        {/* Mission Planning Sandbox */}
        {onToggleSandbox && (
          <button
            type="button"
            onClick={onToggleSandbox}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
              isSandboxOpen
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/30'
                : 'bg-[#0e1320] border-[#1b2333] text-zinc-400 hover:text-white'
            }`}
            title="Toggle Mission Planning Sandbox (SAM placement, NFZ, Intercept trajectories)"
          >
            <Target className="w-3.5 h-3.5" />
            <span>{isSandboxOpen ? 'SANDBOX ON' : 'SANDBOX'}</span>
          </button>
        )}

        {/* 4D Tactical DVR & Time Scrubber */}
        {onToggleDvr && (
          <button
            type="button"
            onClick={onToggleDvr}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
              isDvrReplaying
                ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 shadow-md shadow-amber-500/25 ring-1 ring-amber-400/40 animate-pulse'
                : isDvrOpen
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/30'
                : 'bg-[#0e1320] border-[#1b2333] text-zinc-400 hover:text-white'
            }`}
            title="Toggle 4D Tactical Telemetry DVR and Time Scrubber"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isDvrReplaying ? 'REPLAYING' : isDvrOpen ? 'DVR ON' : '4D DVR'}</span>
          </button>
        )}

        {/* CoT XML Export Button for ATAK / WinTAK */}
        {onExportCot && (
          <button
            type="button"
            onClick={onExportCot}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/20 text-cyan-300 hover:bg-cyan-500/20 text-xs font-mono font-bold transition-all cursor-pointer"
            title="Export Active COP to Cursor-on-Target (CoT 2.0) XML Package for ATAK / WinTAK"
          >
            <span>EXPORT CoT</span>
          </button>
        )}

        {/* HUD Tags Declutter Filter */}
        {onToggleHudTags && (
          <button
            type="button"
            onClick={onToggleHudTags}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
              hudTagMode === 'all'
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : hudTagMode === 'priority'
                ? 'bg-[#0e1320] border-cyan-500/30 text-cyan-400'
                : 'bg-[#0e1320] border-[#1b2333] text-zinc-500 hover:text-zinc-300'
            }`}
            title="Toggle Billboard Info Tags: Priority Only / All / Off"
          >
            <Tag className="w-3.5 h-3.5" />
            <span className="text-[10px]">TAGS: {hudTagMode.toUpperCase()}</span>
          </button>
        )}

        {/* Sidebar Collapse / Expand Toggle */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isSidebarOpen
                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                : 'bg-[#0e1320] border-[#1b2333] text-zinc-400 hover:text-white'
            }`}
            title={isSidebarOpen ? 'Hide Target Sidebar' : 'Show Target Sidebar'}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        )}

        {/* Reset Camera to Full Globe */}
        <button
          type="button"
          onClick={onResetView}
          className="p-1.5 bg-[#0e1320] hover:bg-[#151c2e] border border-[#1b2333] text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Reset Camera to Global Overhead"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
