import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Rewind, 
  Clock, 
  Radio, 
  AlertCircle,
  X
} from 'lucide-react';

interface TacticalDvrBarProps {
  isOpen: boolean;
  onClose: () => void;
  offsetSeconds: number; // 0 for Live, negative for historical
  onSeek: (offset: number | ((prev: number) => number)) => void;
  availableSpanSeconds: number;
  replayedTimestamp: number;
}

export const TacticalDvrBar: React.FC<TacticalDvrBarProps> = ({
  isOpen,
  onClose,
  offsetSeconds,
  onSeek,
  availableSpanSeconds,
  replayedTimestamp,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 5 | 15>(1);

  const isLive = offsetSeconds >= 0;

  // Auto-advance scrubber when playing
  useEffect(() => {
    if (!isPlaying || isLive) return;

    const interval = setInterval(() => {
      onSeek((prev: number) => {
        const next = prev + playbackSpeed;
        if (next >= 0) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, isLive, playbackSpeed, onSeek]);

  if (!isOpen) return null;

  const maxBack = Math.max(300, Math.min(3600, availableSpanSeconds)); // Up to 60 minutes
  const replayedTimeStr = new Date(replayedTimestamp).toISOString().substring(11, 19) + ' Z';
  const offsetMin = Math.abs(Math.round(offsetSeconds / 60));
  const offsetSec = Math.abs(Math.round(offsetSeconds % 60));

  return (
    <div className="absolute bottom-12 inset-x-8 z-40 bg-[#060912]/95 border border-[#1f2b42] p-3 rounded-2xl shadow-2xl backdrop-blur-xl select-none font-mono text-xs flex flex-col gap-2 animate-in slide-in-from-bottom duration-200">
      {/* Top Status & Controls Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isLive ? 'text-emerald-400' : 'text-amber-400 animate-spin'}`} />
            <span className="font-black text-white text-xs tracking-wider">4D TACTICAL DVR</span>
          </div>

          <div className={`px-2.5 py-0.5 rounded-lg border font-bold text-[10px] flex items-center gap-1.5 ${
            isLive
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/50 border-amber-500/60 text-amber-300 ring-1 ring-amber-400/40 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>
              {isLive ? 'LIVE STREAMING' : `HISTORICAL REPLAY · -${offsetMin}m ${offsetSec}s`}
            </span>
          </div>

          {!isLive && (
            <span className="text-zinc-400 text-[11px]">
              TIMESTAMP: <strong className="text-white">{replayedTimeStr}</strong>
            </span>
          )}
        </div>

        {/* Playback Transport & Speed Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Jump Buttons */}
          <div className="flex items-center gap-1 bg-[#0b101c] p-0.5 rounded-lg border border-[#1b2333] text-[10px]">
            <button
              type="button"
              onClick={() => onSeek(-60)}
              className="px-2 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              -1m
            </button>
            <button
              type="button"
              onClick={() => onSeek(-300)}
              className="px-2 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              -5m
            </button>
            <button
              type="button"
              onClick={() => onSeek(-900)}
              className="px-2 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              -15m
            </button>
            <button
              type="button"
              onClick={() => onSeek(-1800)}
              className="px-2 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              -30m
            </button>
          </div>

          {/* Play/Pause Button */}
          {!isLive && (
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#111827] border border-[#27354d] text-cyan-300 hover:bg-cyan-500/20 font-bold cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>
          )}

          {/* Speed Multiplier */}
          {!isLive && (
            <button
              type="button"
              onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 5 : playbackSpeed === 5 ? 15 : 1)}
              className="px-2 py-1 bg-[#111827] border border-[#27354d] text-zinc-300 hover:text-white rounded-lg text-[10px] font-bold cursor-pointer"
            >
              {playbackSpeed}x SPEED
            </button>
          )}

          {/* Return to LIVE Button */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              onSeek(0);
            }}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              isLive
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-md shadow-emerald-500/30 ring-1 ring-emerald-300 animate-pulse'
            }`}
          >
            SNAP TO LIVE
          </button>

          {/* Close DVR Bar */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Time Slider */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-[10px] text-zinc-500">-{Math.round(maxBack / 60)}M</span>
        <input
          type="range"
          min={-maxBack}
          max={0}
          step={5}
          value={offsetSeconds}
          onChange={(e) => {
            setIsPlaying(false);
            onSeek(parseInt(e.target.value, 10));
          }}
          className="w-full accent-cyan-400 bg-[#141b2b] rounded-lg h-2 cursor-pointer focus:outline-none"
        />
        <span className="text-[10px] text-emerald-400 font-bold">LIVE</span>
      </div>
    </div>
  );
};
