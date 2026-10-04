import React, { useState } from 'react';
import { 
  Crosshair, 
  ShieldAlert, 
  Layers, 
  Trash2, 
  Plus, 
  X,
  Target,
  AlertTriangle
} from 'lucide-react';
import { AIR_DEFENSE_SYSTEMS } from '../../utils/airDefenseCatalog';

export type SandboxToolMode = 'INSPECT' | 'DEPLOY_BATTERY' | 'DRAW_NFZ';

interface SandboxToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: SandboxToolMode;
  onSelectMode: (mode: SandboxToolMode) => void;
  selectedSystemKey: string;
  onSelectSystemKey: (key: string) => void;
  batteryCount: number;
  nfzCount: number;
  onClearSandbox: () => void;
}

export const SandboxToolbar: React.FC<SandboxToolbarProps> = ({
  isOpen,
  onClose,
  activeMode,
  onSelectMode,
  selectedSystemKey,
  onSelectSystemKey,
  batteryCount,
  nfzCount,
  onClearSandbox,
}) => {
  if (!isOpen) return null;

  const systems = Object.keys(AIR_DEFENSE_SYSTEMS);

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-[#080c14]/95 border border-cyan-500/40 p-2.5 rounded-2xl shadow-2xl backdrop-blur-md select-none font-mono flex items-center gap-3 animate-in fade-in duration-150">
      {/* Brand & Status */}
      <div className="flex items-center gap-2 pr-3 border-r border-[#1f283d]">
        <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
          <Target className="w-3.5 h-3.5 animate-spin" />
        </div>
        <div>
          <span className="text-xs font-black text-white tracking-wider block">MISSION SANDBOX</span>
          <span className="text-[9px] text-cyan-400 font-bold">
            {activeMode === 'DEPLOY_BATTERY'
              ? 'CLICK GLOBE TO DEPLOY'
              : 'OPERATIONAL PLANNING'}
          </span>
        </div>
      </div>

      {/* Mode Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelectMode('INSPECT')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMode === 'INSPECT'
              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
              : 'bg-[#101726] border border-[#1b2333] text-zinc-400 hover:text-white'
          }`}
        >
          INSPECT
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('DEPLOY_BATTERY')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMode === 'DEPLOY_BATTERY'
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 ring-1 ring-rose-400 animate-pulse'
              : 'bg-[#101726] border border-[#1b2333] text-zinc-400 hover:text-white'
          }`}
        >
          <Plus className="w-3 h-3" />
          <span>DEPLOY SAM ({batteryCount})</span>
        </button>

        {/* System Type Selector (when in deploy mode) */}
        {activeMode === 'DEPLOY_BATTERY' && (
          <select
            value={selectedSystemKey}
            onChange={(e) => onSelectSystemKey(e.target.value)}
            className="bg-[#0e1422] border border-rose-500/50 text-white rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-rose-400 cursor-pointer"
          >
            {systems.map((key) => (
              <option key={key} value={key} className="bg-[#080c14] text-white">
                {AIR_DEFENSE_SYSTEMS[key].name} ({AIR_DEFENSE_SYSTEMS[key].engagementRangeKm}km)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Clear Sandbox Button */}
      <div className="flex items-center gap-2 pl-3 border-l border-[#1f283d]">
        <button
          type="button"
          onClick={onClearSandbox}
          className="flex items-center gap-1 bg-[#101726] hover:bg-rose-950/40 border border-[#1b2333] hover:border-rose-500/40 text-zinc-400 hover:text-rose-300 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          title="Clear all user-deployed sandbox batteries"
        >
          <Trash2 className="w-3 h-3" />
          <span>RESET</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          title="Close Sandbox Bar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
