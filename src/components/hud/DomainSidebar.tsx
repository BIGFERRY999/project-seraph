import React, { useState, useRef, useEffect } from 'react';
import { 
  Plane, 
  Ship, 
  Satellite, 
  Flame, 
  Layers, 
  Search, 
  Crosshair,
  Filter,
  Video,
  Camera,
  Mic,
  MicOff,
  Radio,
  X
} from 'lucide-react';
import { TelemetryContact, DomainType } from '../../types/tactical';
import { tacticalSound } from '../../tacticalSound';

interface DomainSidebarProps {
  contacts: TelemetryContact[];
  activeDomain: DomainType;
  onSelectDomain: (domain: DomainType) => void;
  selectedContact: TelemetryContact | null;
  onSelectContact: (contact: TelemetryContact) => void;
}

export const DomainSidebar: React.FC<DomainSidebarProps> = ({
  contacts,
  activeDomain,
  onSelectDomain,
  selectedContact,
  onSelectContact,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string>('');
  const recognitionRef = useRef<any>(null);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const handleToggleVoice = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      setVoiceNotice('');
      tacticalSound.playRadioChirp?.();
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      tacticalSound.playAlertBeep?.();
      setVoiceNotice('BROWSER SPEECH API UNAVAILABLE');
      setTimeout(() => setVoiceNotice(''), 2600);
      return;
    }

    try {
      tacticalSound.playRadioChirp?.();
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setVoiceNotice('LISTENING... SPEAK TARGET OR DOMAIN');
      };

      rec.onresult = (event: any) => {
        const spoken = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('')
          .trim();

        setVoiceNotice(`"${spoken.toUpperCase()}"`);
        setSearchQuery(spoken);

        const lower = spoken.toLowerCase();
        if (lower.includes('air') || lower.includes('flight') || lower.includes('plane') || lower.includes('jet')) {
          onSelectDomain('air');
        } else if (lower.includes('naval') || lower.includes('maritime') || lower.includes('ship') || lower.includes('vessel')) {
          onSelectDomain('maritime');
        } else if (lower.includes('space') || lower.includes('satellite') || lower.includes('iss') || lower.includes('orbit')) {
          onSelectDomain('space');
        } else if (lower.includes('camera') || lower.includes('cctv') || lower.includes('feed') || lower.includes('surveillance')) {
          onSelectDomain('cctv');
        } else if (lower.includes('crisis') || lower.includes('quake') || lower.includes('emergency')) {
          onSelectDomain('crisis');
        } else if (lower.includes('all') || lower.includes('reset') || lower.includes('clear')) {
          onSelectDomain('all');
          setSearchQuery('');
        }
      };

      rec.onerror = (err: any) => {
        console.warn('[Helios C2 Voice] Error:', err);
        setIsListening(false);
        tacticalSound.playAlertBeep?.();
        setVoiceNotice(`MIC ERROR: ${err.error || 'ACCESS BLOCKED'}`);
        setTimeout(() => setVoiceNotice(''), 2500);
      };

      rec.onend = () => {
        setIsListening(false);
        tacticalSound.playSelect?.();
        setTimeout(() => setVoiceNotice(''), 2500);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('[Helios C2 Voice] Initialization failure:', err);
      setIsListening(false);
    }
  };

  // Count by domain
  const airCount = contacts.filter(c => c.domain === 'air').length;
  const marCount = contacts.filter(c => c.domain === 'maritime').length;
  const spaceCount = contacts.filter(c => c.domain === 'space').length;
  const cctvCount = contacts.filter(c => c.domain === 'cctv').length;
  const crisisCount = contacts.filter(c => c.domain === 'crisis').length;

  const filteredContacts = contacts.filter(c => {
    if (activeDomain !== 'all' && c.domain !== activeDomain) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.callsign.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q)
    );
  });

  return (
    <aside className="w-80 h-full bg-[#080b12]/90 border-r border-[#1b2333] flex flex-col z-20 backdrop-blur-md select-none">
      {/* Search Input with Tactical Microphone Side Button */}
      <div className="p-3 border-b border-[#1b2333] flex flex-col gap-1.5">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter callsign, type, hex..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d121c] border border-[#1b2333] rounded-lg pl-8 pr-16 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
          />
          <div className="absolute right-1.5 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-zinc-500 hover:text-zinc-300 text-[10px] font-mono cursor-pointer transition-colors"
                title="Clear query"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {/* Tactical Microphone Side Button */}
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-1.5 rounded-md border text-xs font-mono transition-all cursor-pointer flex items-center justify-center ${
                isListening
                  ? 'bg-rose-500/25 border-rose-500 text-rose-300 shadow-lg shadow-rose-500/40 ring-1 ring-rose-400 animate-pulse'
                  : 'bg-[#121927] border-[#223049] text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-cyan-300 hover:shadow-md hover:shadow-cyan-500/20'
              }`}
              title={isListening ? 'Voice Recon Active (Click to mute)' : 'Microphone Voice Recon — Click to dictate target or domain'}
            >
              {isListening ? (
                <Mic className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Live Audio / Voice Feedback Ribbon */}
        {voiceNotice && (
          <div className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] flex items-center justify-between animate-in fade-in slide-in-from-top duration-150 ${
            isListening 
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
          }`}>
            <span className="flex items-center gap-1.5 truncate">
              <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-rose-400 animate-ping' : 'bg-cyan-400'}`} />
              <span className="font-semibold">{voiceNotice}</span>
            </span>
            {isListening && (
              <span className="flex items-center gap-0.5 shrink-0 pl-1">
                <span className="w-0.5 h-2.5 bg-rose-400 animate-pulse" />
                <span className="w-0.5 h-3.5 bg-rose-400 animate-pulse delay-75" />
                <span className="w-0.5 h-1.5 bg-rose-400 animate-pulse delay-150" />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Domain Switcher Tabs */}
      <div className="p-2 border-b border-[#1b2333] grid grid-cols-2 gap-1.5 font-mono text-[11px]">
        <button
          type="button"
          onClick={() => onSelectDomain('all')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeDomain === 'all'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'bg-[#0d121c] text-zinc-400 hover:text-white border border-[#171f2e]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            <span>ALL</span>
          </div>
          <span className="text-[10px] text-zinc-500">{contacts.length}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectDomain('cctv')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeDomain === 'cctv'
              ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40'
              : 'bg-[#0d121c] text-zinc-400 hover:text-white border border-[#171f2e]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Video className="w-3 h-3 text-purple-400" />
            <span>CAMERAS</span>
          </div>
          <span className="text-[10px] text-zinc-500">{cctvCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectDomain('air')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeDomain === 'air'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'bg-[#0d121c] text-zinc-400 hover:text-white border border-[#171f2e]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Plane className="w-3 h-3 text-cyan-400" />
            <span>AIR OPS</span>
          </div>
          <span className="text-[10px] text-zinc-500">{airCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectDomain('maritime')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeDomain === 'maritime'
              ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
              : 'bg-[#0d121c] text-zinc-400 hover:text-white border border-[#171f2e]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Ship className="w-3 h-3 text-emerald-400" />
            <span>NAVAL</span>
          </div>
          <span className="text-[10px] text-zinc-500">{marCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectDomain('space')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeDomain === 'space'
              ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
              : 'bg-[#0d121c] text-zinc-400 hover:text-white border border-[#171f2e]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Satellite className="w-3 h-3 text-amber-400" />
            <span>SPACE</span>
          </div>
          <span className="text-[10px] text-zinc-500">{spaceCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectDomain('crisis')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeDomain === 'crisis'
              ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
              : 'bg-[#0d121c] text-zinc-400 hover:text-white border border-[#171f2e]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-rose-400" />
            <span>CRISIS</span>
          </div>
          <span className="text-[10px] text-zinc-500">{crisisCount}</span>
        </button>
      </div>

      {/* Target Contacts Feed */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
          <span>Active Tracked Targets</span>
          <span>{filteredContacts.length} Found</span>
        </div>

        {filteredContacts.map(contact => {
          const isSelected = selectedContact?.id === contact.id;

          let badgeColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
          if (contact.domain === 'maritime') badgeColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
          if (contact.domain === 'space') badgeColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
          if (contact.domain === 'cctv') badgeColor = 'text-purple-400 border-purple-500/30 bg-purple-500/10';
          if (contact.domain === 'crisis') badgeColor = 'text-rose-400 border-rose-500/30 bg-rose-500/10';

          return (
            <div
              key={contact.id}
              onClick={() => onSelectContact(contact)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                isSelected
                  ? 'bg-cyan-500/15 border-cyan-400/60 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/40'
                  : 'bg-[#0c1018] border-[#182030] hover:bg-[#121724] hover:border-[#222c42]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-white">{contact.callsign}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${badgeColor}`}>
                  {contact.category}
                </span>
              </div>

              <div className="text-[11px] text-zinc-400 truncate">{contact.name}</div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-[#161d2b]">
                <span>
                  {contact.domain === 'space'
                    ? `${Math.round(contact.altitude / 1000)} km ASL`
                    : contact.domain === 'air'
                    ? `FL${Math.round(contact.altitude / 100)}`
                    : contact.domain === 'cctv'
                    ? `${contact.altitude}m CAM`
                    : 'SEA LVL'}
                </span>
                <span>{contact.domain === 'cctv' ? 'LIVE 1080p' : contact.speed > 0 ? `${contact.speed} kts` : 'STATIONARY'}</span>
                <span>{contact.heading}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
