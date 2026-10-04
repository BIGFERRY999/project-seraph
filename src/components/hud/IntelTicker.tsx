import React from 'react';
import { AlertCircle, ShieldAlert, Radio, Activity } from 'lucide-react';
import { IntelAlert } from '../../types/tactical';

interface IntelTickerProps {
  alerts: IntelAlert[];
}

export const IntelTicker: React.FC<IntelTickerProps> = ({ alerts }) => {
  return (
    <footer className="h-9 bg-[#07090f]/95 border-t border-[#1b2333] px-4 flex items-center justify-between select-none z-30 font-mono text-[11px] text-zinc-400 backdrop-blur-md">
      {/* Ticker Lead */}
      <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-[#1b2333]">
        <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span className="font-bold text-zinc-200 uppercase tracking-wider text-[10px]">
          INTEL STREAM:
        </span>
      </div>

      {/* Scrolling Alerts */}
      <div className="flex-1 overflow-x-hidden whitespace-nowrap px-3 flex items-center gap-6">
        {alerts.map((al) => (
          <div key={al.id} className="inline-flex items-center gap-2">
            <span className="text-zinc-500">{al.timestamp}</span>
            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
              al.level === 'ALERT'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : al.level === 'WARN'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            }`}>
              {al.domain}
            </span>
            <span className="text-zinc-300">{al.text}</span>
          </div>
        ))}
      </div>

      {/* Right Operational Status */}
      <div className="hidden lg:flex items-center gap-4 shrink-0 pl-4 border-l border-[#1b2333] text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          SENSORS SYNCHRONIZED
        </span>
        <span>LATENCY: &lt; 8ms</span>
      </div>
    </footer>
  );
};
