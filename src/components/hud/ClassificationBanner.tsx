import React, { useState } from 'react';
import { Shield, ShieldAlert, Lock, Radio } from 'lucide-react';

export type ClassificationLevel = 
  | 'UNCLASSIFIED // FOUO'
  | 'CONFIDENTIAL'
  | 'SECRET // NOFORN'
  | 'TOP SECRET // SI-TK // REL TO USA, FVEY';

interface ClassificationBannerProps {
  position?: 'top' | 'bottom';
}

export const ClassificationBanner: React.FC<ClassificationBannerProps> = ({ position = 'top' }) => {
  const [level, setLevel] = useState<ClassificationLevel>('SECRET // NOFORN');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getStyle = () => {
    switch (level) {
      case 'TOP SECRET // SI-TK // REL TO USA, FVEY':
        return 'bg-amber-600 text-black font-black tracking-widest border-amber-400';
      case 'SECRET // NOFORN':
        return 'bg-red-700 text-white font-bold tracking-widest border-red-500';
      case 'CONFIDENTIAL':
        return 'bg-blue-700 text-white font-bold tracking-wider border-blue-500';
      case 'UNCLASSIFIED // FOUO':
      default:
        return 'bg-emerald-700 text-white font-semibold tracking-wider border-emerald-500';
    }
  };

  const levels: ClassificationLevel[] = [
    'UNCLASSIFIED // FOUO',
    'CONFIDENTIAL',
    'SECRET // NOFORN',
    'TOP SECRET // SI-TK // REL TO USA, FVEY'
  ];

  return (
    <div
      className={`w-full py-0.5 px-4 flex items-center justify-between text-[11px] font-mono select-none z-50 transition-colors duration-300 relative border-b ${
        position === 'bottom' ? 'border-t border-b-0' : ''
      } ${getStyle()}`}
    >
      <div className="flex items-center gap-2">
        <Lock className="w-3 h-3 opacity-80" />
        <span className="hidden sm:inline opacity-75">CONTROLLED DEFENSE SYSTEM // DISA STIG COMPLIANT</span>
      </div>

      {/* Interactive Level Switcher */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1.5 uppercase hover:underline cursor-pointer focus:outline-none"
        >
          <span>{level}</span>
          <span className="text-[9px] opacity-70">▼</span>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[#090d16] border border-[#2b354d] text-white rounded-lg shadow-2xl py-1 w-72 z-50 text-[10px]">
            <div className="px-3 py-1 text-zinc-400 border-b border-[#1b2333] font-bold">
              SELECT CLASSIFICATION MARKING
            </div>
            {levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  setLevel(lvl);
                  setIsDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 hover:bg-white/10 flex items-center justify-between cursor-pointer ${
                  level === lvl ? 'text-cyan-400 font-bold bg-cyan-950/40' : 'text-zinc-300'
                }`}
              >
                <span>{lvl}</span>
                {level === lvl && <span className="text-cyan-400 text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 opacity-80">
          <Radio className="w-2.5 h-2.5 text-emerald-300 animate-pulse" />
          <span className="hidden md:inline">CRYPTO: AES-256-GCM</span>
        </span>
      </div>
    </div>
  );
};
